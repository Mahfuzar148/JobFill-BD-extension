// JobFill BD - Bdjobs Public Feed & Search Adapter
// Reads only Bdjobs' publicly exposed homepage spotlight JSON
// (https://storage.googleapis.com/bdjobs-home-static/GovtJobs.json).
// Community Apify scrapers (hipersoft/bdjobs-scraper, steadyscrape/bdjobs-jobs-scraper) were
// evaluated and intentionally NOT enabled (third-party hosted scrapers requiring paid Apify tokens,
// zero official Bdjobs authorization).
// For general listings, user-initiated external search links to official Bdjobs pages are generated.

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
import { JobTaxonomyClassifier } from '../../services/taxonomy-classifier';

export const BDJOBS_GOVT_JSON_URL = 'https://storage.googleapis.com/bdjobs-home-static/GovtJobs.json';
export const BDJOBS_HOME_URL = 'https://www.bdjobs.com/';

export const BDJOBS_COVERAGE_DISCLOSURE =
  'Limited public job highlights retrieved. Full private job coverage is not available through automated background crawling due to platform Terms of Service.';
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

export interface BdjobsStaticEntry {
  CompanyName?: string;
  CompanyNameBng?: string;
  JobTitle?: string;
  JobTitleBng?: string;
  JP_ID?: number | string;
  Deadline?: string;
  ExpDate?: string;
  PublishDate?: string;
  EduReq?: string;
  Experience?: string;
  Salary?: string;
  Location?: string;
  Vacancies?: string | number;
  Category?: string;
  CatName?: string;
  JobDescription?: string;
  EmploymentType?: string;
}

/**
 * Builds an official, authorized search URL on Bdjobs.com for user-initiated browsing in a new tab.
 */
export function buildBdjobsSearchUrl(query?: string, categoryId?: string): string {
  const base = 'https://jobs.bdjobs.com/jobsearch.asp';
  const params = new URLSearchParams();
  if (query && query.trim()) {
    params.set('txtsearch', query.trim());
  }
  if (categoryId && categoryId !== 'All') {
    params.set('qcat', categoryId);
  }
  const qs = params.toString();
  return qs ? `${base}?${qs}` : 'https://www.bdjobs.com/';
}

/**
 * Category mapping for Bdjobs categories to universal taxonomy
 */
export function inferBdjobsCategory(catName?: string, title?: string, org?: string): any {
  const norm = (catName || '').toLowerCase().trim();
  if (norm.includes('bank') || norm.includes('ব্যাংক')) return 'Bank';
  if (norm.includes('it') || norm.includes('software') || norm.includes('আইটি')) return 'IT / Technology';
  if (norm.includes('medical') || norm.includes('health') || norm.includes('স্বাস্থ্য')) return 'Healthcare';
  if (norm.includes('education') || norm.includes('teaching') || norm.includes('শিক্ষা')) return 'Education';
  if (norm.includes('ngo') || norm.includes('development') || norm.includes('এনজিও')) return 'NGO';
  if (norm.includes('govt') || norm.includes('government') || norm.includes('সরকারি')) return 'Government';
  if (norm.includes('private') || norm.includes('commercial') || norm.includes('বেসরকারি')) return 'Private';

  // Fallback to checking title and org
  const text = `${title || ''} ${org || ''}`.toLowerCase();
  if (text.includes('bank') || text.includes('ব্যাংক')) return 'Bank';
  if (text.includes('মন্ত্রণালয়') || text.includes('অধিদপ্তর') || text.includes('কমিশন')) return 'Government';
  return 'Private';
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
      const deadlineText = (entry.Deadline || entry.ExpDate || '').trim() || undefined;
      const publishedDateText = (entry.PublishDate || '').trim() || undefined;
      const qualification = (entry.EduReq || '').trim() || 'Any Qualification';
      const experience = (entry.Experience || '').trim() || undefined;
      const salary = (entry.Salary || '').trim() || undefined;
      const location = (entry.Location || '').trim() || 'All Bangladesh';
      const vacancies = entry.Vacancies ? Number(entry.Vacancies) || undefined : undefined;
      const category = inferBdjobsCategory(entry.CatName || entry.Category, title, org);
      const desc = entry.JobDescription && entry.JobDescription.trim()
        ? entry.JobDescription.trim()
        : `${title} at ${org}. Published on Bdjobs; view official listing to inspect full job description, eligibility and apply online.`;

      return {
        externalId: `bdjobs_${jpId}`,
        sourceJobId: jpId,
        organization: org,
        organizationBn: orgBn,
        jobTitle: title,
        titleBn,
        position: title,
        category,
        employmentType: (entry.EmploymentType as any) || 'Full Time',
        location,
        qualification,
        experience,
        salary,
        vacancies,
        deadlineText,
        publishedDateText,
        circularUrl: detailUrl,
        organizationUrl: BDJOBS_HOME_URL,
        sourceUrl: detailUrl,
        applicationUrl: detailUrl,
        description: desc,
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
  accessMethod: 'Public spotlight JSON feed (storage.googleapis.com/bdjobs-home-static/GovtJobs.json) & verified user browsing links; bulk private scrapers disabled per ToS',
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
        accessNotes: res.blockedReason || 'Bdjobs public highlight feed unavailable; open Bdjobs directly.',
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

    if (jobs.length === 0) {
      const outcome: SourceFetchOutcome = {
        sourceId: this.sourceId,
        sourceName: this.sourceName,
        compatibilityStatus: 'partially_supported',
        status: 'PARTIAL_SUCCESS',
        accessMethodType: 'Undocumented Static Feed',
        publisherType: 'Third-Party',
        success: false,
        jobs: [],
        checkedAt,
        httpStatus: res.status ?? null,
        blockedByCaptcha: false,
        retryPolicy: 'partial_scheduled',
        dataCoverageNote: BDJOBS_COVERAGE_DISCLOSURE,
        deadlineVerificationNote: BDJOBS_DEADLINE_DISCLOSURE,
        accessNotes: 'No job records found in Bdjobs public highlight feed.',
        directPortalUrl: BDJOBS_HOME_URL,
      };
      outcome.connectionStatus = deriveSourceConnectionStatus(outcome);
      return outcome;
    }

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
      accessNotes: `Fetched ${jobs.length} Bdjobs public highlight(s). ${BDJOBS_COVERAGE_DISCLOSURE}`,
      directPortalUrl: BDJOBS_HOME_URL,
    };
    outcome.connectionStatus = deriveSourceConnectionStatus(outcome);
    return outcome;
  },

  parseJob(raw: RawSourceJobItem, checkedAt?: number): NormalizedJobCircular {
    const normalized = normalizeJobRecord(raw, {
      sourceId: this.sourceId,
      sourceName: this.sourceName,
      verificationLevel: this.verificationLevel,
      checkedAt,
    });
    JobTaxonomyClassifier.enrichJobWithTaxonomy(normalized);
    return normalized;
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
