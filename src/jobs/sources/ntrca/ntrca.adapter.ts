// JobFill BD - NTRCA (Non-Government Teachers' Registration and Certification Authority) Adapter
// Parses https://ntrca.gov.bd/pages/notices and links verified recruitment/গণবিজ্ঞপ্তি
// notices with https://ntrcar.teletalk.com.bd/.
// Excludes routine hearings, fake-certificate investigations, and non-recruitment notices.

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

const NTRCA_NOTICES_URL = 'https://ntrca.gov.bd/pages/notices';
const NTRCA_BASE = 'https://ntrca.gov.bd';
const NTRCA_APPLY_URL = 'https://ntrcar.teletalk.com.bd/';

export function parseNtrcaNoticeTableHtml(html: string): RawSourceJobItem[] {
  return parseBangladeshPortalNoticeTableHtml(html, {
    idPrefix: 'ntrca',
    organization: 'NTRCA',
    organizationBn: 'বেসরকারি শিক্ষক নিবন্ধন ও প্রত্যয়ন কর্তৃপক্ষ (এনটিআরসিএ)',
    baseUrl: NTRCA_BASE,
    pageUrl: NTRCA_NOTICES_URL,
    category: 'Teaching',
    defaultApplyUrl: NTRCA_APPLY_URL,
    applyKeywordsPattern: /গণবিজ্ঞপ্তি|নিবন্ধন\s*পরীক্ষার\s*আবেদন|অনলাইনে\s*আবেদন|নিয়োগ\s*বিজ্ঞপ্তি|নিয়োগ\s*বিজ্ঞপ্তি/i,
    recruitmentPattern:
      /গণবিজ্ঞপ্তি|নিয়োগ|নিয়োগ|নিবন্ধন\s*পরীক্ষা|মৌখিক\s*পরীক্ষা|লিখিত\s*পরীক্ষা|সার্কুলার|বিজ্ঞপ্তি|recruitment|viva/i,
    excludePattern:
      /শুনানী|শুনানি|জাল\s*সনদ|ভূয়া|ভুয়া|তদন্ত|পুনঃযাচাই|প্রত্যাহার|বাতিলের\s*চিঠি|ছুটি|বদলি/i,
    qualificationDetector: () => 'Bachelor',
  });
}

export const NtrcaAdapter: JobSourceAdapter = {
  sourceId: 'ntrca',
  sourceName: 'NTRCA Teacher Recruitment',
  sourceType: 'official_commission',
  officialDomain: 'ntrca.gov.bd',
  compatibilityStatus: 'supported',
  accessMethodType: 'HTML',
  publisherType: 'Official',
  accessMethod: 'Official HTML notices (ntrca.gov.bd/pages/notices + ntrcar.teletalk.com.bd)',
  verificationLevel: 'official_verified',
  directSourceUrl: NTRCA_NOTICES_URL,
  notes:
    'Extracts teacher recruitment & গণবিজ্ঞপ্তি notices from NTRCA excluding disciplinary hearings/investigations.',

  async fetchJobs(signal?: AbortSignal): Promise<SourceFetchOutcome> {
    const checkedAt = Date.now();
    const res = await safePublicGet(NTRCA_NOTICES_URL, 'text/html,*/*', signal);

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
          'Could not reach ntrca.gov.bd directly (note: Node CLI lacks AIA cert chain, whereas Chrome/Edge browsers trust AIA automatically).',
        directPortalUrl: NTRCA_NOTICES_URL,
        error: res.blockedReason || 'Portal fetch failed',
      };
      outcome.connectionStatus = deriveSourceConnectionStatus(outcome);
      return outcome;
    }

    const rawItems = parseNtrcaNoticeTableHtml(res.body);
    await enrichSourceItemsFromDetailPages(rawItems, NTRCA_BASE, NTRCA_NOTICES_URL, signal, 6);
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
      accessNotes: `Fetched ${jobs.length} recruitment-filtered notice(s) from NTRCA official notices.`,
      directPortalUrl: NTRCA_NOTICES_URL,
    };
    outcome.connectionStatus = deriveSourceConnectionStatus(outcome);
    return outcome;
  },

  parseJob(raw: RawSourceJobItem, checkedAt?: number): NormalizedJobCircular {
    return normalizeJobRecord(
      {
        ...raw,
        organizationShortName: raw.organizationShortName || 'NTRCA',
      },
      {
        sourceId: this.sourceId,
        sourceName: this.sourceName,
        verificationLevel: this.verificationLevel,
        checkedAt,
      }
    );
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
