// JobFill BD - Bangladesh Government Organization Discovery & Missing Circular Diagnostics
// Discovers new official government bodies from central portal directories, verifies official domains,
// classifies candidate sources, and diagnoses why a requested circular may be missing.

import {
  GovernmentSourceRecord,
  GovernmentOrganizationType,
  GovernmentSourceGroup,
  MissingCircularDiagnosticResult,
  MissingCircularReasonCode,
} from '../types/government.types';
import { GovernmentSourceRegistry } from '../sources/government-registry/government-source-registry';
import { GovernmentNoticeClassifier } from './government-notice-classifier';
import { JobRepository } from '../database/job-repository';
import { verifyJobUrl } from './source-verifier';

export class GovernmentOrganizationDiscoveryEngine {
  /**
   * Evaluates if a domain is a verified Bangladesh Government entity (.gov.bd, .mil.bd, .edu.bd).
   */
  public static isOfficialGovernmentDomain(domain: string): {
    isOfficial: boolean;
    domainType: 'GOVERNMENT' | 'MILITARY' | 'PUBLIC_UNIVERSITY' | 'UNOFFICIAL';
  } {
    let host = (domain || '').toLowerCase().trim();
    try {
      if (host.startsWith('http://') || host.startsWith('https://')) {
        host = new URL(host).hostname.toLowerCase();
      }
    } catch {
      // safe fallback
    }

    if (host.endsWith('.gov.bd') || host === 'bangladesh.gov.bd') {
      return { isOfficial: true, domainType: 'GOVERNMENT' };
    }
    if (host.endsWith('.mil.bd')) {
      return { isOfficial: true, domainType: 'MILITARY' };
    }
    if (host.endsWith('.edu.bd') || host.endsWith('.ac.bd')) {
      return { isOfficial: true, domainType: 'PUBLIC_UNIVERSITY' };
    }
    if (host === 'alljobs.teletalk.com.bd' || host.endsWith('.teletalk.com.bd')) {
      return { isOfficial: true, domainType: 'GOVERNMENT' };
    }
    return { isOfficial: false, domainType: 'UNOFFICIAL' };
  }

  /**
   * Evaluates organization name and infers organizational category and group.
   */
  public static inferOrganizationMeta(...names: string[]): {
    orgType: GovernmentOrganizationType;
    sourceGroup: GovernmentSourceGroup;
  } {
    const combined = names.filter(Boolean).join(' ').toLowerCase();
    if (/মন্ত্রণালয়|মন্ত্রণালয়|ministry|mopa|mof|mod|minland/i.test(combined)) {
      return { orgType: 'Ministry', sourceGroup: 'ministries_divisions' };
    }
    if (/বিভাগ|division/i.test(combined)) {
      return { orgType: 'Division', sourceGroup: 'ministries_divisions' };
    }
    if (/অধিদপ্তর|directorate/i.test(combined)) {
      return { orgType: 'Directorate', sourceGroup: 'directorates_departments' };
    }
    if (/জেলা\s*প্রশাসক|dc\s*office|deputy\s*commissioner|divisional\s*commissioner|উপজেলা|পৌরসভা|সিটি\s*কর্পোরেশন|chattogram|dhaka/i.test(combined)) {
      return { orgType: 'District Administration', sourceGroup: 'district_local_govt' };
    }
    if (/কমিশন|\bcommission\b|বিপিএসসি|bpsc/i.test(combined)) {
      return { orgType: 'Commission', sourceGroup: 'public_service_commissions' };
    }
    if (/পুলিশ|police/i.test(combined)) {
      return { orgType: 'Law Enforcement Agency', sourceGroup: 'defence_uniformed' };
    }
    if (/সেনাবাহিনী|নৌবাহিনী|বিমান\s*বাহিনী|কোস্ট\s*গার্ড|আনসার|army|navy|air\s*force/i.test(combined)) {
      return { orgType: 'Defence Force', sourceGroup: 'defence_uniformed' };
    }
    if (/ব্যাংক|bank/i.test(combined)) {
      return { orgType: 'Government Bank', sourceGroup: 'government_financial' };
    }
    if (/বিশ্ববিদ্যালয়|বিশ্ববিদ্যালয়|university|college|স্কুল|school|বুয়েট|buet|ঢাবি/i.test(combined)) {
      return { orgType: 'Public University', sourceGroup: 'public_education' };
    }
    if (/হাসপাতাল|মেডিকেল|স্বাস্থ্য|hospital|medical|health|dghs/i.test(combined)) {
      return { orgType: 'Government Hospital or Medical Institution', sourceGroup: 'public_healthcare' };
    }
    if (/জেলা\s*প্রশাসক|dc\s*office|উপজেলা|পৌরসভা|সিটি\s*কর্পোরেশন|chattogram|dhaka/i.test(combined)) {
      return { orgType: 'District Administration', sourceGroup: 'district_local_govt' };
    }
    return { orgType: 'Autonomous Organization', sourceGroup: 'public_corporations' };
  }

  /**
   * Diagnoses why a specific government circular might be missing from the Hub.
   */
  public static async diagnoseMissingCircular(
    targetUrlOrOrg: string,
    queryTitle?: string,
    queryUrlOrFilters?: string | any,
    maybeFilters?: any
  ): Promise<MissingCircularDiagnosticResult> {
    let queryUrl: string | undefined;
    let queryOrganization = '';
    let title = queryTitle || '';
    let filters: any;

    if (targetUrlOrOrg.startsWith('http://') || targetUrlOrOrg.startsWith('https://')) {
      queryUrl = targetUrlOrOrg;
      title = queryTitle || '';
      filters = typeof queryUrlOrFilters === 'object' ? queryUrlOrFilters : maybeFilters;
      try {
        queryOrganization = new URL(queryUrl).hostname;
      } catch {
        queryOrganization = 'Government Organization';
      }
    } else {
      queryOrganization = targetUrlOrOrg;
      title = queryTitle || '';
      if (typeof queryUrlOrFilters === 'string') {
        queryUrl = queryUrlOrFilters;
        filters = maybeFilters;
      } else {
        filters = queryUrlOrFilters;
      }
    }

    const orgNorm = queryOrganization.toLowerCase().trim();
    const isGovtDomain = queryUrl ? this.isOfficialGovernmentDomain(queryUrl).isOfficial : true;

    // 1. Check if URL is provided and valid government domain
    if (queryUrl && !isGovtDomain) {
      return {
        queryOrganization,
        queryTitle: title,
        queryUrl,
        diagnosticReasonCode: 'UNVERIFIED_EXTERNAL_LINK',
        primaryReason: 'UNOFFICIAL_DOMAIN',
        isRecognizedGovernmentDomain: false,
        reasonEn: 'Provided link is not an official verified government domain.',
        reasonBn: 'প্রদত্ত লিংকটি কোনো ভেরিফায়েড সরকারি ডোমেইন নয়।',
        explanation: 'প্রদত্ত লিংকটি কোনো ভেরিফায়েড সরকারি ডোমেইন (.gov.bd, .mil.bd, .edu.bd) নয়।',
        evidence: ['Domain does not match verified government portal patterns.'],
        suggestedActionEn: 'Please provide the official .gov.bd or .mil.bd notice URL.',
        suggestedActionBn: 'অনুগ্রহ করে অফিশিয়াল .gov.bd বা .mil.bd নোটিশ লিংক প্রদান করুন।',
        recommendation: 'অনুগ্রহ করে অফিশিয়াল .gov.bd বা .mil.bd নোটিশ লিংক প্রদান করুন।',
      };
    }

    // 2. Check if job circular is already saved in JobRepository, but hidden by active filters!
    try {
      const allJobs = await JobRepository.getAllJobs();
      const existingJob = allJobs.find(
        (j) =>
          (queryUrl && (j.circularUrl === queryUrl || j.applicationUrl === queryUrl)) ||
          (title && j.jobTitle.toLowerCase().includes(title.toLowerCase()))
      );

      if (existingJob) {
        if (filters && filters.selectedGrades && filters.selectedGrades.length > 0) {
          const jobGradeStr = existingJob.gradeNumber ? String(existingJob.gradeNumber) : '';
          if (!filters.selectedGrades.includes(jobGradeStr)) {
            return {
              queryOrganization: existingJob.organization,
              queryTitle: existingJob.jobTitle,
              queryUrl,
              diagnosticReasonCode: 'RECORD_EXPIRED_OR_FILTERED',
              primaryReason: 'ACTIVE_FILTER_MISMATCH',
              isRecognizedGovernmentDomain: true,
              reasonEn: 'Job circular exists in database but is hidden by active grade filter.',
              reasonBn: 'সার্কুলারটি ডাটাবেজে সংরক্ষিত আছে কিন্তু সক্রিয় ফিল্টারের কারণে লুকায়িত।',
              explanation: 'সার্কুলারটি ডাটাবেজে সংরক্ষিত আছে কিন্তু আপনার বর্তমান সক্রিয় গ্রেড বা ক্যাটাগরি ফিল্টারের কারণে লুকায়িত দেখাচ্ছে।',
              evidence: [`Current filter grades: ${filters.selectedGrades.join(', ')}, Job grade: ${jobGradeStr || 'Not Specified'}`],
              suggestedActionEn: 'Reset grade filter to view this circular.',
              suggestedActionBn: 'সব গ্রেড ফিল্টার রিসেট করে আবার দেখুন।',
              recommendation: 'সব গ্রেড ফিল্টার রিসেট করে আবার দেখুন।',
            };
          }
        }
      }
    } catch {
      // safe fallback
    }

    // 3. Check if the notice was classified as an Administrative Non-Job (e.g. Tender, Transfer, Memo)
    const noticeClassification = GovernmentNoticeClassifier.classifyNotice(title);
    if (noticeClassification.category === 'ADMINISTRATIVE_NON_JOB') {
      return {
        queryOrganization,
        queryTitle: title,
        queryUrl,
        diagnosticReasonCode: 'RECRUITMENT_CLASSIFIER_REJECTED',
        primaryReason: 'REJECTED_AS_ADMINISTRATIVE_NOTICE',
        isRecognizedGovernmentDomain: true,
        reasonEn: `Notice classified as administrative non-job memo (${noticeClassification.subtype}).`,
        reasonBn: `নোটিশটি সাধারণ প্রশাসনিক আদেশ বা দরপত্র হিসেবে শনাক্ত হয়েছে (${noticeClassification.subtype})।`,
        explanation: 'নোটিশটি একটি প্রশাসনিক নোটিশ (বদলি, পদোন্নতি বা রুটিন মেমো) হিসেবে শনাক্ত হওয়ায় ফিল্টার আউট হয়েছে।',
        evidence: [
          noticeClassification.exclusionEvidence || 'Matched internal memo / office order patterns.',
          `Matched tags: ${noticeClassification.matchedKeywords.join(', ')}`,
        ],
        suggestedActionEn: 'Administrative notices are intentionally excluded to keep job listings clean.',
        suggestedActionBn: 'চাকরিপ্রার্থীদের সুবিধার জন্য প্রশাসনিক আদেশ ও দরপত্র বাদ দেওয়া হয়েছে।',
        recommendation: 'চাকরিপ্রার্থীদের সুবিধার জন্য প্রশাসনিক আদেশ ও দরপত্র বাদ দেওয়া হয়েছে।',
      };
    }

    // 3. Check if the organization exists in Government Source Registry
    const allSources = GovernmentSourceRegistry.getAllSources();
    const matchedSource = allSources.find(
      (s) =>
        s.organizationName.toLowerCase().includes(orgNorm) ||
        s.organizationNameBn.toLowerCase().includes(orgNorm) ||
        (queryUrl && queryUrl.includes(s.officialDomain))
    );

    const titleNorm = title.toLowerCase().trim();

    if (!matchedSource) {
      return {
        queryOrganization,
        queryTitle: title,
        queryUrl,
        diagnosticReasonCode: 'ORGANIZATION_SOURCE_NOT_DISCOVERED',
        reasonEn: 'Organization is not yet registered in the Government Source Registry.',
        reasonBn: 'উক্ত সরকারি প্রতিষ্ঠানটি এখনো সরকারি সোর্স রেজিস্ট্রিতে নিবন্ধিত হয়নি।',
        evidence: [`Queried organization: "${queryOrganization}" not found in ${allSources.length} registered sources.`],
        suggestedActionEn: 'Submit organization details for administrative verification and registry inclusion.',
        suggestedActionBn: 'প্রতিষ্ঠানটির অফিশিয়াল ওয়েবসাইট রিভিউ ও সোর্স রেজিস্ট্রিতে যুক্ত করার জন্য জমা দিন।',
      };
    }

    // 4. Check if the matched source is disabled or blocked
    if (!matchedSource.enabled) {
      return {
        queryOrganization,
        queryTitle: title,
        queryUrl,
        diagnosticReasonCode: 'SOURCE_NOT_CONFIGURED',
        reasonEn: `Source "${matchedSource.sourceName}" is currently disabled or awaiting review.`,
        reasonBn: `সোর্স "${matchedSource.sourceNameBn || matchedSource.sourceName}" বর্তমানে নিষ্ক্রিয় বা পর্যালোচনার অপেক্ষায়।`,
        evidence: [`Status: ${matchedSource.verificationStatus}`],
        suggestedActionEn: 'Enable this source in the Government Source Registry.',
        suggestedActionBn: 'সরকারি সোর্স রেজিস্ট্রি থেকে এই সোর্সটি সক্রিয় করুন।',
        sourceRecord: matchedSource,
      };
    }

    if (matchedSource.sourceHealth === 'BLOCKED') {
      return {
        queryOrganization,
        queryTitle: title,
        queryUrl,
        diagnosticReasonCode: 'SOURCE_ACCESS_RESTRICTED',
        reasonEn: `Automated access to ${matchedSource.officialDomain} was halted by access challenge or CAPTCHA.`,
        reasonBn: `${matchedSource.officialDomain} সাইটে স্বয়ংক্রিয় সংগ্রহ ক্যাপচা বা সিকিউরিটি ওয়ালের কারণে স্থগিত আছে।`,
        evidence: ['CAPTCHA or bot-protection page detected during last fetch attempt.'],
        suggestedActionEn: 'Open the portal directly in a browser tab and use "Sync from Open Tab".',
        suggestedActionBn: 'ব্রাউজার ট্যাবে পোর্টালটি সরাসরি খুলে "খোলা ট্যাব থেকে সিঙ্ক" ব্যবহার করুন।',
        sourceRecord: matchedSource,
      };
    }

    // 5. Check if the job already exists in IndexedDB (maybe merged as duplicate or hidden by active filter)
    const storedJobs = await JobRepository.getAllJobs();
    const existingJob = storedJobs.find(
      (j) =>
        j.organization.toLowerCase().includes(orgNorm) &&
        (j.position.toLowerCase().includes(titleNorm) || j.jobTitle.toLowerCase().includes(titleNorm))
    );

    if (existingJob) {
      return {
        queryOrganization,
        queryTitle: title,
        queryUrl,
        diagnosticReasonCode: 'RECORD_EXPIRED_OR_FILTERED',
        reasonEn: 'Job circular is present in database but may be expired or hidden by an active filter.',
        reasonBn: 'সার্কুলারটি ডাটাবেজে সংরক্ষিত আছে, তবে মেয়াদের কারণে বা কোনো ফিল্টারের জন্য আড়ালে থাকতে পারে।',
        evidence: [
          `Found Job ID: ${existingJob.id}`,
          `Status: ${existingJob.status}`,
          `Deadline: ${existingJob.deadlineText || 'Not specified'}`,
        ],
        suggestedActionEn: 'Check "All Government Jobs" or reset your search filters to view the circular.',
        suggestedActionBn: '"সব সরকারি চাকরি (All Government Jobs)" ট্যাবে দেখুন অথবা ফিল্টার রিসেট করুন।',
        sourceRecord: matchedSource,
      };
    }

    // 6. Pagination Incomplete / Pending Next Sync
    return {
      queryOrganization,
      queryTitle: title,
      queryUrl,
      diagnosticReasonCode: 'PAGINATION_INCOMPLETE',
      reasonEn: 'Notice may be located beyond the currently scanned pages or waiting for scheduled sync.',
      reasonBn: 'বিজ্ঞপ্তিটি বর্তমানে স্ক্যানকৃত পৃষ্ঠার বাইরে রয়েছে অথবা পরবর্তী সিঙ্কের অপেক্ষায় আছে।',
      evidence: [
        `Scanned pages limit: ${matchedSource.maxPagesToScan || 5}`,
        `Last checked: ${matchedSource.lastCheckedAt ? new Date(matchedSource.lastCheckedAt).toLocaleString() : 'Not yet'}`,
      ],
      suggestedActionEn: 'Trigger a manual sync or increase pagination depth for this source.',
      suggestedActionBn: 'ম্যানুয়াল রিফ্রেশ চালান অথবা এই সোর্সের পেজিনেশন সংখ্যা বৃদ্ধি করুন।',
      sourceRecord: matchedSource,
    };
  }
}
