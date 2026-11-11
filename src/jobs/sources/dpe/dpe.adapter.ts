// JobFill BD - DPE (Directorate of Primary Education) Adapter
// Parses https://dpe.gov.bd/pages/notices/ strictly for recruitment circulars & exam notices.
// Explicitly excludes condolence, holiday, transfer, and routine administrative notices.

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

const DPE_NOTICES_URL = 'https://dpe.gov.bd/pages/notices/';
const DPE_BASE = 'https://dpe.gov.bd';

export function parseDpeNoticeTableHtml(html: string): RawSourceJobItem[] {
  return parseBangladeshPortalNoticeTableHtml(html, {
    idPrefix: 'dpe',
    organization: 'Directorate of Primary Education (DPE)',
    organizationBn: 'প্রাথমিক শিক্ষা অধিদপ্তর',
    baseUrl: DPE_BASE,
    pageUrl: DPE_NOTICES_URL,
    category: 'Teaching',
    recruitmentPattern:
      /নিয়োগ|নিয়োগ|শূন্য\s*পদে?|সহকারী\s*শিক্ষক|অফিস\s*সহকারী|হিসাব\s*সহকারী|বাছাই\s*পরীক্ষা|লিখিত\s*পরীক্ষা|মৌখিক\s*পরীক্ষা|recruitment|job\s*circular/i,
    excludePattern:
      /শোক|মৃত্যু|ছুটি|ভর্তি|বদলি|অবসর|প্রশিক্ষণ|উপবৃত্তি|পাঠ্যপুস্তক|স্বাস্থ্য\s*ক্যাম্প|জরিপ/i,
    qualificationDetector: (title) => (/সহকারী\s*শিক্ষক/i.test(title) ? 'Bachelor' : 'HSC'),
  });
}

export const DpeAdapter: JobSourceAdapter = {
  sourceId: 'dpe',
  sourceName: 'DPE Primary Education Recruitment',
  sourceType: 'official_commission',
  officialDomain: 'dpe.gov.bd',
  compatibilityStatus: 'supported',
  accessMethodType: 'HTML',
  publisherType: 'Official',
  accessMethod: 'Official HTML notices (dpe.gov.bd/pages/notices/)',
  verificationLevel: 'official_verified',
  directSourceUrl: DPE_NOTICES_URL,
  notes:
    'Extracts Primary Assistant Teacher & DPE staff recruitment notices while filtering out administrative/mourning/transfer memos.',

  async fetchJobs(signal?: AbortSignal): Promise<SourceFetchOutcome> {
    const checkedAt = Date.now();
    const res = await safePublicGet(DPE_NOTICES_URL, 'text/html,*/*', signal);

    if (!res.ok) {
      const outcome: SourceFetchOutcome = {
        sourceId: this.sourceId,
        sourceName: this.sourceName,
        compatibilityStatus: 'unavailable',
        accessMethodType: 'HTML',
        publisherType: 'Official',
        success: false,
        jobs: [],
        checkedAt,
        accessNotes:
          res.blockedReason ||
          'Could not reach dpe.gov.bd directly (note: Chrome/Edge browsers resolve its intermediate TLS chain automatically).',
        directPortalUrl: DPE_NOTICES_URL,
        error: res.blockedReason || 'Portal fetch failed',
      };
      outcome.connectionStatus = deriveSourceConnectionStatus(outcome);
      return outcome;
    }

    const rawItems = parseDpeNoticeTableHtml(res.body);
    await enrichSourceItemsFromDetailPages(rawItems, DPE_BASE, DPE_NOTICES_URL, signal, 6);
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
      accessNotes: `Fetched ${jobs.length} recruitment-filtered notice(s) from DPE official notices.`,
      directPortalUrl: DPE_NOTICES_URL,
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
