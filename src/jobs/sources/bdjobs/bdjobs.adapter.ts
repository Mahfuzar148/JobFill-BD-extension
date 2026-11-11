// JobFill BD - Bdjobs Public Feed Adapter
// Reads only Bdjobs' publicly exposed homepage spotlight JSON
// (https://storage.googleapis.com/bdjobs-home-static/GovtJobs.json).
// Community Apify scrapers (hipersoft/bdjobs-scraper, steadyscrape/bdjobs-jobs-scraper) were
// evaluated and intentionally NOT enabled (third-party hosted scrapers requiring paid Apify tokens,
// zero official Bdjobs authorization).

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

const BDJOBS_GOVT_JSON_URL = 'https://storage.googleapis.com/bdjobs-home-static/GovtJobs.json';
const BDJOBS_HOME_URL = 'https://www.bdjobs.com/';

export const BDJOBS_COVERAGE_DISCLOSURE =
  'Limited public job highlights retrieved. Full private job coverage is not available through the currently configured public source.';
export const BDJOBS_DEADLINE_DISCLOSURE =
  'Deadline verification: Required where unknown (static highlights omit closing dates; never fabricated).';

export const BDJOBS_COMMUNITY_EVALUATION = {
  officialPublicApiAvailable: false,
  officialRssAvailable: false,
  undocumentedStaticFeed: BDJOBS_GOVT_JSON_URL,
  permittedPublicStaticFeed: BDJOBS_GOVT_JSON_URL,
  evaluatedThirdPartyServices: [
    {
      name: 'hipersoft/bdjobs-scraper',
      type: 'Third-Party Apify Actor',
      activated: false,
      reason: 'Unofficial third-party hosted scraper requiring Apify platform account/paid compute credits.',
    },
    {
      name: 'steadyscrape/bdjobs-jobs-scraper',
      type: 'Third-Party Apify Actor',
      activated: false,
      reason: 'Unofficial third-party hosted scraper requiring Apify account/API token; not activated per zero-paid-token policy.',
    },
  ],
};

interface BdjobsStaticEntry {
  CompanyName?: string;
  CompanyNameBng?: string;
  JobTitle?: string;
  JobTitleBng?: string;
  JP_ID?: number | string;
}

export function parseBdjobsStaticJson(jsonText: string): RawSourceJobItem[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  return parsed
    .map((entry: BdjobsStaticEntry): RawSourceJobItem | null => {
      const jpId = entry.JP_ID ? String(entry.JP_ID).trim() : '';
      const org = (entry.CompanyName || entry.CompanyNameBng || '').trim();
      const orgBn = (entry.CompanyNameBng || '').trim() || null;
      const title = (entry.JobTitle || entry.JobTitleBng || '').trim();
      const titleBn = (entry.JobTitleBng || '').trim() || null;
      if (!jpId || !org || !title) return null;

      const detailUrl = `https://jobs.bdjobs.com/jobdetails/?id=${encodeURIComponent(jpId)}`;
      return {
        externalId: `bdjobs_${jpId}`,
        sourceJobId: jpId,
        organization: org,
        organizationBn: orgBn,
        jobTitle: title,
        titleBn,
        position: title,
        category: 'Government',
        employmentType: 'Full Time',
        location: 'All Bangladesh',
        deadlineText: undefined,
        circularUrl: undefined,
        organizationUrl: BDJOBS_HOME_URL,
        sourceUrl: detailUrl,
        applicationUrl: detailUrl,
        description: `${title} at ${org}. Listed on Bdjobs Government Spotlight; open official Bdjobs detail page to verify deadline and apply.`,
      };
    })
    .filter((item): item is RawSourceJobItem => item !== null);
}

export const BdjobsAdapter: JobSourceAdapter = {
  sourceId: 'bdjobs',
  sourceName: 'Bdjobs',
  sourceType: 'job_board',
  officialDomain: 'bdjobs.com',
  compatibilityStatus: 'partially_supported',
  accessMethodType: 'Undocumented Static Feed',
  publisherType: 'Third-Party',
  accessMethod: 'Undocumented public homepage static JSON (storage.googleapis.com/bdjobs-home-static/GovtJobs.json — NOT an official API; private feeds & Apify scrapers disabled)',
  verificationLevel: 'official_partial',
  directSourceUrl: BDJOBS_HOME_URL,
  minPollCooldownMs: 60 * 60 * 1000,
  complianceNotes: 'Reads only Bdjobs homepage static GovtJobs.json highlights; respects www.bdjobs.com/robots.txt and avoids unauthorized private/login scraping.',
  notes: BDJOBS_COVERAGE_DISCLOSURE,

  async fetchJobs(signal?: AbortSignal): Promise<SourceFetchOutcome> {
    const checkedAt = Date.now();
    const res = await safePublicGet(BDJOBS_GOVT_JSON_URL, 'application/json,*/*', signal);

    if (!res.ok) {
      const outcome: SourceFetchOutcome = {
        sourceId: this.sourceId,
        sourceName: this.sourceName,
        compatibilityStatus: 'partially_supported',
        status: res.blockedByCaptcha ? 'MANUAL_VERIFICATION_REQUIRED' : res.status === 429 ? 'TEMPORARILY_UNAVAILABLE' : 'FAILED',
        accessMethodType: 'Undocumented Static Feed',
        publisherType: 'Third-Party',
        success: false,
        jobs: [],
        checkedAt,
        httpStatus: res.status ?? null,
        blockedByCaptcha: Boolean(res.blockedByCaptcha),
        dataCoverageNote: BDJOBS_COVERAGE_DISCLOSURE,
        deadlineVerificationNote: BDJOBS_DEADLINE_DISCLOSURE,
        accessNotes: res.blockedReason || 'Bdjobs undocumented static highlight feed unavailable; open Bdjobs directly.',
        directPortalUrl: BDJOBS_HOME_URL,
        error: res.blockedReason,
      };
      outcome.connectionStatus = deriveSourceConnectionStatus(outcome);
      return outcome;
    }

    let parsedJsonOk = true;
    try {
      const checkArr = JSON.parse(res.body);
      if (!Array.isArray(checkArr)) parsedJsonOk = false;
    } catch {
      parsedJsonOk = false;
    }
    if (!parsedJsonOk) {
      const errMsg = 'Bdjobs static highlight feed returned invalid JSON structure.';
      const outcome: SourceFetchOutcome = {
        sourceId: this.sourceId,
        sourceName: this.sourceName,
        compatibilityStatus: 'unavailable',
        status: 'FAILED',
        accessMethodType: 'Undocumented Static Feed',
        publisherType: 'Third-Party',
        success: false,
        jobs: [],
        checkedAt,
        httpStatus: res.status ?? null,
        invalidResponse: true,
        retryPolicy: 'halted_invalid_response',
        dataCoverageNote: BDJOBS_COVERAGE_DISCLOSURE,
        deadlineVerificationNote: BDJOBS_DEADLINE_DISCLOSURE,
        accessNotes: errMsg,
        directPortalUrl: BDJOBS_HOME_URL,
        error: errMsg,
      };
      outcome.connectionStatus = deriveSourceConnectionStatus(outcome);
      return outcome;
    }

    const rawItems = parseBdjobsStaticJson(res.body);
    const jobs = rawItems.map((raw) => this.parseJob(raw, checkedAt)).filter((j) => this.validateJob(j).isValid);

    const outcome: SourceFetchOutcome = {
      sourceId: this.sourceId,
      sourceName: this.sourceName,
      compatibilityStatus: 'partially_supported',
      status: 'PARTIAL_SUCCESS',
      accessMethodType: 'Undocumented Static Feed',
      publisherType: 'Third-Party',
      success: true,
      jobs,
      checkedAt,
      httpStatus: res.status ?? null,
      blockedByCaptcha: false,
      retryPolicy: 'partial_scheduled',
      dataCoverageNote: BDJOBS_COVERAGE_DISCLOSURE,
      deadlineVerificationNote: BDJOBS_DEADLINE_DISCLOSURE,
      accessNotes: `Fetched ${jobs.length} Bdjobs public GovtJobs highlight(s). ${BDJOBS_COVERAGE_DISCLOSURE}`,
      directPortalUrl: BDJOBS_HOME_URL,
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
