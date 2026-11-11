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

const BPSC_CIRCULARS_URL = 'https://bpsc.gov.bd/pages/notification-circulars';
const BPSC_NOTICES_URL = 'https://bpsc.gov.bd/pages/notices';
const BPSC_BASE = 'https://bpsc.gov.bd';

export function parseBpscNoticeTableHtml(html: string, pageUrl: string): RawSourceJobItem[] {
  return parseBangladeshPortalNoticeTableHtml(html, {
    idPrefix: 'bpsc',
    organization: 'Bangladesh Public Service Commission (BPSC)',
    organizationBn: 'বাংলাদেশ সরকারী কর্ম কমিশন (বিপিএসসি)',
    baseUrl: BPSC_BASE,
    pageUrl,
    category: 'Government',
    recruitmentPattern: /নিয়োগ|নিয়োগ|বিজ্ঞপ্তি|বিসিএস|bcs|circular|appointment|পদ|ক্যাডার|নন-ক্যাডার|পরীক্ষা|result|ফলাফল/i,
    excludePattern: /ex-bangladesh|বহিঃবাংলাদেশ|ছুটি|ভ্রমণ|medical\s*leave|earned\s*leave|শোক/i,
    qualificationDetector: (title) => (/bcs|বিসিএস|ক্যাডার|৯ম গ্রেড/i.test(title) ? 'Bachelor' : 'Any Qualification'),
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
    'Parses official BPSC notice and circular tables excluding leave/admin memos. PDF-only deadlines show "Deadline Not Verified".',

  async fetchJobs(signal?: AbortSignal): Promise<SourceFetchOutcome> {
    const checkedAt = Date.now();
    const [circRes, noticeRes] = await Promise.all([
      safePublicGet(BPSC_CIRCULARS_URL, 'text/html,*/*', signal),
      safePublicGet(BPSC_NOTICES_URL, 'text/html,*/*', signal),
    ]);

    if (!circRes.ok && !noticeRes.ok) {
      const outcome: SourceFetchOutcome = {
        sourceId: this.sourceId,
        sourceName: this.sourceName,
        compatibilityStatus: 'unavailable',
        accessMethodType: 'HTML',
        publisherType: 'Official',
        success: false,
        jobs: [],
        checkedAt,
        accessNotes: circRes.blockedReason || noticeRes.blockedReason || 'BPSC portal unreachable.',
        directPortalUrl: this.directSourceUrl,
        error: circRes.blockedReason || noticeRes.blockedReason,
      };
      outcome.connectionStatus = deriveSourceConnectionStatus(outcome);
      return outcome;
    }

    const rawItems: RawSourceJobItem[] = [
      ...(circRes.ok ? parseBpscNoticeTableHtml(circRes.body, BPSC_CIRCULARS_URL) : []),
      ...(noticeRes.ok ? parseBpscNoticeTableHtml(noticeRes.body, BPSC_NOTICES_URL) : []),
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
      accessNotes: `Fetched ${jobs.length} official BPSC recruitment notices/circulars.`,
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
