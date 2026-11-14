// JobFill BD - Missing Job Circular Diagnostic Engine
// Answers user queries: "Why can't I find this circular?"
// Performs systematic diagnosis across source coverage, database persistence,
// active filter occlusion, deadline expiration, and access restrictions.
// Never fabricates explanations.

import { NormalizedJobCircular, JobSearchFilters } from '../types/job.types';
import { JobSourceRegistry } from '../sources/source-registry';
import { OFFICIAL_PORTAL_DIRECTORY } from '../sources/official-website.adapter';
import { matchesSearchCategory, matchesJobEducation, matchesJobLocation, matchesJobDeadline } from './search-engine';
import { JobGradeExtractor } from './grade-extractor';

export type DiagnosticResultType =
  | 'FOUND_IN_DATABASE_VISIBLE'
  | 'FOUND_IN_DATABASE_HIDDEN_BY_FILTER'
  | 'FOUND_IN_DATABASE_EXPIRED'
  | 'SOURCE_SUPPORTED_NOT_YET_FETCHED'
  | 'SOURCE_UNSUPPORTED_OR_RESTRICTED'
  | 'INVALID_OR_UNKNOWN_QUERY';

export interface CircularDiagnosticReport {
  query: string;
  matchedJob: NormalizedJobCircular | null;
  matchingJob?: NormalizedJobCircular | null;
  resultType: DiagnosticResultType;
  diagnosisCode:
    | DiagnosticResultType
    | 'IN_DATABASE_SHOWN'
    | 'IN_DATABASE_HIDDEN_BY_FILTERS'
    | 'IN_DATABASE_EXPIRED'
    | 'SUPPORTED_SOURCE_PENDING_FETCH'
    | 'UNSUPPORTED_PORTAL';
  titleEn: string;
  titleBn: string;
  explanationEn: string;
  explanationBn: string;
  blockingFilters: string[];
  conflictingFilters?: string[];
  recommendedAction: 'VIEW_JOB' | 'CLEAR_FILTERS' | 'SWITCH_TAB_EXPIRED' | 'FETCH_LATEST' | 'ADD_MANUALLY' | 'CHECK_PORTAL';
  actionType: 'view_now' | 'clear_filters' | 'view_expired' | 'fetch_latest' | 'add_manually' | 'check_portal';
  actionUrl?: string;
}

export class CircularDiagnosticEngine {
  /**
   * Diagnoses why a user cannot find a specific circular using its URL or title keywords.
   */
  public static diagnoseMissingCircular(options: {
    queryUrlOrText?: string;
    inputQueryOrUrl?: string;
    allStoredJobs?: NormalizedJobCircular[];
    allJobs?: NormalizedJobCircular[];
    activeFilters?: JobSearchFilters;
    now?: number;
  }): CircularDiagnosticReport {
    const rawQuery = options.queryUrlOrText ?? options.inputQueryOrUrl ?? '';
    const allStoredJobs = options.allStoredJobs ?? options.allJobs ?? [];
    const { activeFilters, now = Date.now() } = options;
    const query = rawQuery.trim();

    if (!query) {
      return {
        query,
        matchedJob: null,
        matchingJob: null,
        resultType: 'INVALID_OR_UNKNOWN_QUERY',
        diagnosisCode: 'INVALID_OR_UNKNOWN_QUERY',
        titleEn: 'No Circular Query Entered',
        titleBn: 'কোনো সার্কুলার লিঙ্ক বা তথ্য দেওয়া হয়নি',
        explanationEn: 'Please enter a circular URL or job title to diagnose.',
        explanationBn: 'অনুগ্রহ করে সার্কুলারের লিংক বা পদের নাম লিখে অনুসন্ধান করুন।',
        blockingFilters: [],
        conflictingFilters: [],
        recommendedAction: 'CHECK_PORTAL',
        actionType: 'check_portal',
      };
    }

    const cleanQuery = query.toLowerCase().replace(/[#?].*$/, '').trim();

    // 1. Check if the circular exists in stored IndexedDB records
    const matchedJob = allStoredJobs.find((j) => {
      if (j.circularUrl && j.circularUrl.toLowerCase().includes(cleanQuery)) return true;
      if (j.applicationUrl && j.applicationUrl.toLowerCase().includes(cleanQuery)) return true;
      if (j.sourceUrl && j.sourceUrl.toLowerCase().includes(cleanQuery)) return true;
      if (cleanQuery.length >= 3) {
        if (j.jobTitle.toLowerCase().includes(cleanQuery)) return true;
        if (j.organization.toLowerCase().includes(cleanQuery)) return true;
        if (j.position.toLowerCase().includes(cleanQuery)) return true;
      }
      return false;
    }) || null;

    if (matchedJob) {
      const isExpired =
        matchedJob.status === 'expired' ||
        (matchedJob.deadlineVerified && typeof matchedJob.deadlineAt === 'number' && matchedJob.deadlineAt <= now);

      // Check if active filters are hiding it
      const blockingFilters: string[] = [];
      const conflictingFilters: string[] = [];
      if (activeFilters) {
        if (activeFilters.category !== 'All' && !matchesSearchCategory(matchedJob, activeFilters.category)) {
          blockingFilters.push(`Category: ${activeFilters.category}`);
          conflictingFilters.push('category');
        }
        if (activeFilters.education !== 'All' && !matchesJobEducation(matchedJob, activeFilters.education)) {
          blockingFilters.push(`Education: ${activeFilters.education}`);
          conflictingFilters.push('education');
        }
        if (activeFilters.location !== 'All' && !matchesJobLocation(matchedJob, activeFilters.location)) {
          blockingFilters.push(`Location: ${activeFilters.location}`);
          conflictingFilters.push('location');
        }
        if (activeFilters.deadline !== 'all' && !matchesJobDeadline(matchedJob, activeFilters.deadline, now)) {
          blockingFilters.push(`Deadline Filter: ${activeFilters.deadline}`);
          conflictingFilters.push('deadline');
        }
        if (activeFilters.selectedGrades && activeFilters.selectedGrades.length > 0 && !activeFilters.selectedGrades.includes('All')) {
          if (!JobGradeExtractor.matchesGradeFilter(matchedJob, activeFilters.selectedGrades)) {
            blockingFilters.push(`Grade Filter: ${activeFilters.selectedGrades.join(', ')}`);
            conflictingFilters.push('selectedGrades');
          }
        }
      }

      if (blockingFilters.length > 0) {
        return {
          query,
          matchedJob,
          matchingJob: matchedJob,
          resultType: 'FOUND_IN_DATABASE_HIDDEN_BY_FILTER',
          diagnosisCode: 'IN_DATABASE_HIDDEN_BY_FILTERS',
          titleEn: 'Circular Stored But Hidden by Active Filters',
          titleBn: 'বিজ্ঞপ্তিটি সংরক্ষিত আছে কিন্তু ফিল্টারের কারণে প্রদর্শিত হচ্ছে না',
          explanationEn: `This circular is already saved in your extension database for "${matchedJob.organization}", but it is hidden because of active filter(s): ${blockingFilters.join('; ')}.`,
          explanationBn: `বিজ্ঞপ্তিটি (${matchedJob.organization}) ইতোমধ্যে আপনার এক্সটেনশনে সংরক্ষিত আছে, তবে বর্তমান ফিল্টারের (${blockingFilters.join('; ')}) কারণে তালিকায় দেখা যাচ্ছে না।`,
          blockingFilters,
          conflictingFilters,
          recommendedAction: 'CLEAR_FILTERS',
          actionType: 'clear_filters',
          actionUrl: matchedJob.applicationUrl || matchedJob.circularUrl || undefined,
        };
      }

      if (isExpired) {
        return {
          query,
          matchedJob,
          matchingJob: matchedJob,
          resultType: 'FOUND_IN_DATABASE_EXPIRED',
          diagnosisCode: 'IN_DATABASE_EXPIRED',
          titleEn: 'Circular Deadline Has Passed',
          titleBn: 'বিজ্ঞপ্তির আবেদনের সময়সীমা শেষ হয়েছে',
          explanationEn: `This circular for "${matchedJob.jobTitle}" at ${matchedJob.organization} was saved, but its official deadline (${matchedJob.deadlineText || 'past'}) has expired. It appears in the "All Jobs" or "Expired" views.`,
          explanationBn: `বিজ্ঞপ্তিটি সংরক্ষিত রয়েছে, তবে আবেদনের সময়সীমা পার হয়ে গেছে। এটি "সব সার্কুলার" বা "সময় শেষ" ট্যাবে দেখতে পাবেন।`,
          blockingFilters: [],
          conflictingFilters: [],
          recommendedAction: 'SWITCH_TAB_EXPIRED',
          actionType: 'view_expired',
          actionUrl: matchedJob.circularUrl || undefined,
        };
      }

      return {
        query,
        matchedJob,
        matchingJob: matchedJob,
        resultType: 'FOUND_IN_DATABASE_VISIBLE',
        diagnosisCode: 'IN_DATABASE_SHOWN',
        titleEn: 'Circular Found in Hub',
        titleBn: 'বিজ্ঞপ্তিটি জব হাবে পাওয়া গেছে',
        explanationEn: `"${matchedJob.jobTitle}" at ${matchedJob.organization} is actively present in your Job Circular Hub.`,
        explanationBn: `"${matchedJob.jobTitle}" (${matchedJob.organization}) বর্তমানে আপনার জব হাবে সক্রিয় রয়েছে।`,
        blockingFilters: [],
        conflictingFilters: [],
        recommendedAction: 'VIEW_JOB',
        actionType: 'view_now',
        actionUrl: matchedJob.applicationUrl || matchedJob.circularUrl || undefined,
      };
    }

    // 2. Circular NOT found in stored database. Determine source compatibility.
    let supportedSource: any = null;
    let officialPortal: any = null;

    try {
      const urlObj = new URL(/^https?:\/\//i.test(query) ? query : `https://${query}`);
      const hostname = urlObj.hostname.toLowerCase();

      // Check registered adapters
      supportedSource = JobSourceRegistry.getAll().find((a) => {
        const dom = a.officialDomain.toLowerCase();
        if (hostname.includes(dom) || dom.includes(hostname)) return true;
        // All *.teletalk.com.bd portals fall under Teletalk / Government job ecosystem
        if (dom.includes('teletalk') && hostname.includes('teletalk.com.bd')) return true;
        return false;
      });

      // Check official portals directory
      officialPortal = OFFICIAL_PORTAL_DIRECTORY.find((p) => {
        try {
          const pHost = new URL(p.url).hostname.toLowerCase();
          return hostname.includes(pHost) || pHost.includes(hostname);
        } catch {
          return false;
        }
      });

      // Also recognize any Bangladesh Government domain (*.gov.bd)
      if (!supportedSource && !officialPortal && hostname.endsWith('.gov.bd')) {
        officialPortal = {
          name: 'Bangladesh Government Portal (.gov.bd)',
          url: `https://${hostname}`,
        };
      }
    } catch {
      // not a valid URL, search by keyword
    }

    if (supportedSource || officialPortal) {
      const sourceName = supportedSource?.sourceName || officialPortal?.name || 'Supported Source';
      return {
        query,
        matchedJob: null,
        matchingJob: null,
        resultType: 'SOURCE_SUPPORTED_NOT_YET_FETCHED',
        diagnosisCode: 'SUPPORTED_SOURCE_PENDING_FETCH',
        titleEn: `Supported Source (${sourceName}): Not Yet Fetched`,
        titleBn: `অনুমোদিত সূত্র (${sourceName}): এখনও সংগ্রহ করা হয়নি`,
        explanationEn: `The portal "${sourceName}" is an authorized source, but this specific circular has not been retrieved yet (it may be newly published or on another page). You can click "Fetch Latest" or add it manually.`,
        explanationBn: `"${sourceName}" আমাদের অনুমোদিত সূত্রের অন্তর্ভুক্ত, তবে নির্দিষ্ট বিজ্ঞপ্তিটি এখনও সিঙ্ক হয়নি (হতে পারে এটি নতুন বা অন্য পেজে রয়েছে)। আপনি "আপডেট চেক করুন" বাটনে ক্লিক করতে পারেন অথবা নিজে যোগ করতে পারেন।`,
        blockingFilters: [],
        conflictingFilters: [],
        recommendedAction: 'FETCH_LATEST',
        actionType: 'fetch_latest',
        actionUrl: supportedSource?.directSourceUrl || officialPortal?.portalUrl || undefined,
      };
    }

    // 3. Source is not currently supported or is private/restricted
    return {
      query,
      matchedJob: null,
      matchingJob: null,
      resultType: 'SOURCE_UNSUPPORTED_OR_RESTRICTED',
      diagnosisCode: 'UNSUPPORTED_PORTAL',
      titleEn: 'Source Not Configured or Requires Manual Entry',
      titleBn: 'সূত্রটি কনফিগার করা নেই বা ম্যানুয়াল এন্ট্রি প্রয়োজন',
      explanationEn: `JobFill BD prioritizes official public government and authorized portal endpoints. Unregistered third-party job boards or private login-protected pages cannot be automatically crawled without authorization. You can safely add this circular manually.`,
      explanationBn: `JobFill BD কেবলমাত্র সরকারি ও অনুমোদিত পাবলিক সূত্র থেকে তথ্য সংগ্রহ করে। অননুমোদিত ওয়েবসাইট বা লগইন-সংরক্ষিত পেজ স্বয়ংক্রিয়ভাবে সংগ্রহ করা হয় না। আপনি চাইলে "সার্কুলার যোগ করুন" বাটনে ক্লিক করে এটি সংরক্ষণ করতে পারেন।`,
      blockingFilters: [],
      conflictingFilters: [],
      recommendedAction: 'ADD_MANUALLY',
      actionType: 'add_manually',
    };
  }
}
