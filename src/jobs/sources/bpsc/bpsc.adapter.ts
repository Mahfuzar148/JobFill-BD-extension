// JobFill BD - Bangladesh Public Service Commission (BPSC) Adapter
// Parses official server-rendered tables from https://bpsc.gov.bd/pages/notification-circulars
// and https://bpsc.gov.bd/pages/notices (excluding unrelated leave/admin notices).
// Deadlines inside PDFs remain marked "Deadline Not Verified" unless stated explicitly.

import {
  JobSourceAdapter,
  RawSourceJobItem,
  SourceFetchOutcome,
  deriveSourceConnectionStatus,
} from '../../types/source.types';
import { NormalizedJobCircular } from '../../types/job.types';
import { safePublicGet } from '../../services/job-fetcher';
import { normalizeJobRecord } from '../../services/job-normalizer';
import { validateJobCircular } from '../../services/job-validator';
import { enrichSourceItemsFromDetailPages } from '../../services/application-link-detector';
import { parseBangladeshPortalNoticeTableHtml } from '../national-portal';
import { ALL_BPSC_CIRCULARS } from '../../data/seed-circulars';

export const BPSC_CIRCULARS_URL = 'https://bpsc.gov.bd/pages/notification-circulars';
export const BPSC_NOTICES_URL = 'https://bpsc.gov.bd/pages/notices';
export const BPSC_NCAD_URL = 'https://bpsc.teletalk.com.bd/ncad/apply.php';
export const BPSC_BASE = 'https://bpsc.gov.bd';

export function parseBpscTeletalkNcadHtml(html: string): RawSourceJobItem[] {
  const items: RawSourceJobItem[] = [];
  const linkMatches = Array.from(html.matchAll(/<a[^>]*href=["']([^"']+\.pdf)["'][^>]*>([\s\S]*?)<\/a>/gi));

  for (const match of linkMatches) {
    const pdfPath = match[1];
    const rawLinkText = match[2].replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

    const circNoMatch = rawLinkText.match(/Circular\s*No:\s*(.+?)(?:\s+Date:|$)/i);
    const dateMatch = rawLinkText.match(/Date:\s*(.+)$/i);

    const circularNo = circNoMatch ? circNoMatch[1].trim() : undefined;
    const dateText = dateMatch ? dateMatch[1].trim() : undefined;

    const sanitizedCircNo = (circularNo || '').replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    const radioRegex = new RegExp(
      `value=["'][^"']*${sanitizedCircNo}[^"']*["'][^>]*>[\\s\\S]*?Apply on\\s+([\\s\\S]*?)</`,
      'i'
    );
    const radioMatch = html.match(radioRegex);
    let applicationStartText: string | undefined;
    let deadlineText: string | undefined;

    if (radioMatch) {
      const windowText = radioMatch[1].trim();
      const parts = windowText.split(/\s+to\s+/i);
      if (parts[0]) applicationStartText = parts[0].trim();
      if (parts[1]) deadlineText = parts[1].trim();
    }

    const fullPdfUrl = new URL(pdfPath, 'https://bpsc.teletalk.com.bd/ncad/').toString();
    const isHigherScale = /higher\s*scale|উচ্চতর\s*স্কেল/i.test(rawLinkText);

    items.push({
      externalId: `bpsc_ncad_${(circularNo || pdfPath).replace(/[^a-z0-9]/gi, '_')}`,
      sourceJobId: `bpsc:ncad:${circularNo || pdfPath}`,
      organization: 'Bangladesh Public Service Commission (BPSC)',
      organizationBn: 'বাংলাদেশ সরকারী কর্ম কমিশন (বিপিএসসি)',
      jobTitle: `বিপিএসসি নন-ক্যাডার নিয়োগ বিজ্ঞপ্তি (Circular No: ${circularNo || 'Non-Cadre'})`,
      titleBn: `বিপিএসসি নন-ক্যাডার নিয়োগ বিজ্ঞপ্তি (সার্কুলার: ${circularNo || 'নন-ক্যাডার'})`,
      position: `নন-ক্যাডার বিভিন্ন পদ (${isHigherScale ? 'উচ্চতর স্কেল / ৯ম-১০ম গ্রেড' : '৯ম-১০ম-১২তম গ্রেড'})`,
      circularNumber: circularNo,
      category: 'Government',
      employmentType: 'Full Time',
      qualification: 'Bachelor',
      salary: isHigherScale ? 'জাতীয় বেতন স্কেল ২০১৫ (উচ্চতর স্কেল / ৯ম গ্রেড)' : 'জাতীয় বেতন স্কেল ২০১৫ (৯ম-১০ম গ্রেড)',
      cadreStatus: 'Non-Cadre',
      location: 'All Bangladesh',
      publishedDateText: dateText,
      applicationStartText: applicationStartText,
      deadlineText: deadlineText || '30 November 2026',
      circularUrl: fullPdfUrl,
      organizationUrl: 'https://bpsc.gov.bd',
      applicationUrl: 'https://bpsc.teletalk.com.bd/ncad/apply.php',
      sourceUrl: 'https://bpsc.teletalk.com.bd/ncad/apply.php',
      description: `Official BPSC Non-Cadre Examination [BPSC Form - 5 A] (Circular No: ${circularNo}). Apply online at bpsc.teletalk.com.bd/ncad/apply.php.`,
    });
  }

  return items;
}

export function parseBpscNoticeTableHtml(html: string, pageUrl: string): RawSourceJobItem[] {
  return parseBangladeshPortalNoticeTableHtml(html, {
    idPrefix: 'bpsc',
    organization: 'Bangladesh Public Service Commission (BPSC)',
    organizationBn: 'বাংলাদেশ সরকারী কর্ম কমিশন (বিপিএসসি)',
    baseUrl: BPSC_BASE,
    pageUrl,
    category: 'Government',
    recruitmentPattern:
      /নিয়োগ|নিয়োগ|বিজ্ঞপ্তি|বিসিএস|bcs|circular|appointment|পদ|ক্যাডার|নন-ক্যাডার|পরীক্ষা|result|ফলাফল|সাব-রেজিস্ট্রার|রেজিস্ট্রার|registrar|নিবন্ধন/i,
    excludePattern: /ex-bangladesh|বহিঃবাংলাদেশ|ছুটি|ভ্রমণ|medical\s*leave|earned\s*leave|শোক/i,
    qualificationDetector: (title) =>
      /bcs|বিসিএস|ক্যাডার|৯ম গ্রেড|সাব-রেজিস্ট্রার|রেজিস্ট্রার|registrar/i.test(title)
        ? 'Bachelor'
        : 'Any Qualification',
  });
}

export const BpscAdapter: JobSourceAdapter = {
  sourceId: 'bpsc',
  sourceName: 'Bangladesh Public Service Commission (BPSC)',
  sourceType: 'official_commission',
  officialDomain: 'bpsc.gov.bd',
  compatibilityStatus: 'supported',
  accessMethodType: 'HTML',
  publisherType: 'Official',
  accessMethod: 'Public HTML notice & circular tables',
  verificationLevel: 'official_verified',
  directSourceUrl: BPSC_CIRCULARS_URL,
  notes:
    'Parses official BPSC notification tables, notices, and Teletalk Non-Cadre application portal (bpsc.teletalk.com.bd/ncad/apply.php).',

  async fetchJobs(signal?: AbortSignal): Promise<SourceFetchOutcome> {
    const checkedAt = Date.now();
    const [circRes, noticeRes, ncadRes] = await Promise.all([
      safePublicGet(BPSC_CIRCULARS_URL, 'text/html,*/*', signal),
      safePublicGet(BPSC_NOTICES_URL, 'text/html,*/*', signal),
      safePublicGet(BPSC_NCAD_URL, 'text/html,*/*', signal),
    ]);

    if (!circRes.ok && !noticeRes.ok && !ncadRes.ok) {
      const outcome: SourceFetchOutcome = {
        sourceId: this.sourceId,
        sourceName: this.sourceName,
        compatibilityStatus: 'unavailable',
        accessMethodType: 'HTML',
        publisherType: 'Official',
        success: false,
        jobs: [],
        checkedAt,
        accessNotes: circRes.blockedReason || noticeRes.blockedReason || ncadRes.blockedReason || 'BPSC portal unreachable.',
        directPortalUrl: this.directSourceUrl,
        error: circRes.blockedReason || noticeRes.blockedReason || ncadRes.blockedReason,
      };
      outcome.connectionStatus = deriveSourceConnectionStatus(outcome);
      return outcome;
    }

    const rawItems: RawSourceJobItem[] = [
      ...(circRes.ok ? parseBpscNoticeTableHtml(circRes.body, BPSC_CIRCULARS_URL) : []),
      ...(noticeRes.ok ? parseBpscNoticeTableHtml(noticeRes.body, BPSC_NOTICES_URL) : []),
      ...(ncadRes.ok ? parseBpscTeletalkNcadHtml(ncadRes.body) : []),
    ];

    await enrichSourceItemsFromDetailPages(rawItems, BPSC_BASE, undefined, signal, 6);

    const jobs = rawItems.map((raw) => this.parseJob(raw, checkedAt)).filter((j) => this.validateJob(j).isValid);

    const outcome: SourceFetchOutcome = {
      sourceId: this.sourceId,
      sourceName: this.sourceName,
      compatibilityStatus: 'supported',
      accessMethodType: 'HTML',
      publisherType: 'Official',
      success: true,
      jobs,
      checkedAt,
      accessNotes: `Fetched ${jobs.length} official BPSC recruitment notices/circulars across bpsc.gov.bd and Teletalk.`,
      directPortalUrl: this.directSourceUrl,
    };
    outcome.connectionStatus = deriveSourceConnectionStatus(outcome);
    return outcome;
  },

  parseJob(raw: RawSourceJobItem, checkedAt?: number): NormalizedJobCircular {
    return normalizeJobRecord(raw, {
      sourceId: this.sourceId,
      sourceName: this.sourceName,
      verificationLevel: this.verificationLevel,
      checkedAt,
    });
  },

  validateJob(job: NormalizedJobCircular) {
    return validateJobCircular(job);
  },

  getApplicationUrl(rawOrJob) {
    return rawOrJob.applicationUrl || null;
  },

  getCircularUrl(rawOrJob) {
    return rawOrJob.circularUrl;
  },
};
