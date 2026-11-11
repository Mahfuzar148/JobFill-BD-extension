// JobFill BD - Himalayas Remote Public API Adapter
// Fetches unauthenticated public remote jobs from https://himalayas.app/jobs/api
// and filters strictly to Worldwide or Bangladesh-eligible positions with attribution.

import {
  JobSourceAdapter,
  RawSourceJobItem,
  SourceFetchOutcome,
  deriveSourceConnectionStatus,
} from '../types/source.types';
import { NormalizedJobCircular } from '../types/job.types';
import { safePublicGet } from '../services/job-fetcher';
import { normalizeJobRecord } from '../services/job-normalizer';
import { validateJobCircular } from '../services/job-validator';
import { JobRepository } from '../database/job-repository';
import { stripHtmlTags } from './official-website.adapter';

const HIMALAYAS_API_BASE = 'https://himalayas.app/jobs/api?limit=50';
const HIMALAYAS_HOME_URL = 'https://himalayas.app/jobs';

interface HimalayasApiJob {
  guid?: string;
  id?: string | number;
  title?: string;
  companyName?: string;
  companyLogo?: string;
  applicationLink?: string;
  pubDate?: number | string;
  categories?: string[];
  seniority?: string[];
  employmentType?: string;
  locationRestrictions?: string[];
  minSalary?: number | null;
  maxSalary?: number | null;
  currency?: string | null;
  excerpt?: string;
  description?: string;
}

export interface HimalayasParsedPage {
  items: RawSourceJobItem[];
  totalScanned: number;
  nextCursor?: string | null;
}

export function isBangladeshOrWorldwideEligible(locationRestrictions?: string[]): boolean {
  if (!Array.isArray(locationRestrictions) || locationRestrictions.length === 0) {
    return true;
  }
  const joined = locationRestrictions.join(' ').toLowerCase();
  return /\b(worldwide|anywhere|global|international|remote worldwide|all countries|bangladesh|south asia|asia|apac)\b/i.test(
    joined
  );
}

function formatHimalayasPubDate(pubDate?: number | string): string | undefined {
  if (pubDate === undefined || pubDate === null || pubDate === '') return undefined;
  if (typeof pubDate === 'number' && Number.isFinite(pubDate)) {
    const ms = pubDate < 1e12 ? pubDate * 1000 : pubDate;
    return new Date(ms).toISOString().slice(0, 10);
  }
  const str = String(pubDate).trim();
  if (/^\d{9,13}$/.test(str)) {
    const n = Number(str);
    const ms = n < 1e12 ? n * 1000 : n;
    return new Date(ms).toISOString().slice(0, 10);
  }
  const parsed = Date.parse(str);
  return Number.isNaN(parsed) ? undefined : new Date(parsed).toISOString().slice(0, 10);
}

export function parseHimalayasApiJson(jsonText: string): HimalayasParsedPage {
  let parsed: any;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return { items: [], totalScanned: 0, nextCursor: null };
  }

  const rows: HimalayasApiJob[] = Array.isArray(parsed?.jobs) ? parsed.jobs : [];
  const nextCursor = typeof parsed?.nextCursor === 'string' && parsed.nextCursor.trim()
    ? parsed.nextCursor.trim()
    : typeof parsed?.cursor === 'string' && parsed.cursor.trim()
      ? parsed.cursor.trim()
      : null;

  const items: RawSourceJobItem[] = [];
  for (const entry of rows) {
    if (!entry || typeof entry !== 'object') continue;
    if (!isBangladeshOrWorldwideEligible(entry.locationRestrictions)) continue;

    const rawId = entry.guid || (entry.id !== undefined ? String(entry.id) : '');
    const title = (entry.title || '').trim();
    const company = (entry.companyName || '').trim();
    const appLink = (entry.applicationLink || '').trim();
    const guidUrl = typeof entry.guid === 'string' && /^https?:\/\//i.test(entry.guid) ? entry.guid.trim() : '';
    const link = /^https?:\/\//i.test(appLink) ? appLink : guidUrl;
    if (!rawId || !title || !company || !link) continue;

    const safeId = rawId
      .replace(/^https?:\/\//i, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .slice(0, 80);

    let salary: string | undefined;
    if (typeof entry.minSalary === 'number' && entry.minSalary > 0) {
      const currency = (entry.currency || 'USD').trim();
      salary =
        typeof entry.maxSalary === 'number' && entry.maxSalary >= entry.minSalary
          ? `${currency} ${entry.minSalary.toLocaleString()} - ${entry.maxSalary.toLocaleString()}`
          : `From ${currency} ${entry.minSalary.toLocaleString()}`;
    }

    const empRaw = (entry.employmentType || '').toLowerCase();
    const employmentType = empRaw.includes('part')
      ? 'Part Time'
      : empRaw.includes('contract') || empRaw.includes('freelance')
        ? 'Contractual'
        : empRaw.includes('intern')
          ? 'Internship'
          : 'Full Time';

    const locText =
      Array.isArray(entry.locationRestrictions) && entry.locationRestrictions.length > 0
        ? entry.locationRestrictions.join(', ')
        : 'All Bangladesh (Worldwide Remote)';

    const summary = stripHtmlTags(entry.excerpt || entry.description || '').slice(0, 500);
    const seniority = Array.isArray(entry.seniority) && entry.seniority.length > 0 ? entry.seniority.join(', ') : '';

    items.push({
      externalId: `himalayas_${safeId}`,
      sourceJobId: safeId,
      organization: company,
      organizationLogo: entry.companyLogo || undefined,
      jobTitle: `${title} (International Remote)`,
      position: title,
      category: 'International Jobs',
      employmentType,
      salary,
      qualification: 'Any Qualification',
      experience: seniority || undefined,
      location: /worldwide|anywhere|global/i.test(locText) ? 'All Bangladesh' : locText,
      publishedDateText: formatHimalayasPubDate(entry.pubDate),
      // Himalayas API does not publish closing dates — never fabricate one
      deadlineText: undefined,
      circularUrl: undefined,
      sourceUrl: guidUrl || link,
      applicationUrl: /^https?:\/\//i.test(appLink) && !/\.pdf(\?|$)/i.test(appLink) ? appLink : null,
      description: summary || `${title} at ${company} via Himalayas Remote (${locText}).`,
    });
  }

  return {
    items,
    totalScanned: rows.length,
    nextCursor,
  };
}

export const HimalayasAdapter: JobSourceAdapter = {
  sourceId: 'himalayas_remote',
  sourceName: 'Himalayas Remote (Public API)',
  sourceType: 'remote_tech_api',
  officialDomain: 'himalayas.app',
  compatibilityStatus: 'supported',
  accessMethodType: 'API',
  publisherType: 'Third-Party',
  accessMethod: 'Public Himalayas Remote Jobs JSON API (https://himalayas.app/jobs/api)',
  verificationLevel: 'official_partial',
  directSourceUrl: HIMALAYAS_HOME_URL,
  minPollCooldownMs: 60 * 60 * 1000,
  complianceNotes: 'Preserves exact applicationLink per Himalayas terms and attributes himalayas.app.',
  notes:
    'Fetches public international remote openings from Himalayas API and filters specifically to Worldwide / Bangladesh-eligible roles. User-toggleable in Settings.',

  async fetchJobs(signal?: AbortSignal): Promise<SourceFetchOutcome> {
    const checkedAt = Date.now();
    const prefs = await JobRepository.getPreferences();
    if (prefs.enableHimalayasSource === false) {
      return {
        sourceId: this.sourceId,
        sourceName: this.sourceName,
        compatibilityStatus: 'manual_only',
        connectionStatus: 'Not Implemented',
        success: true,
        jobs: [],
        checkedAt,
        accessNotes: 'Disabled in Settings -> Job & Notification Preferences.',
        directPortalUrl: HIMALAYAS_HOME_URL,
      };
    }

    const collectedRaw: RawSourceJobItem[] = [];
    let totalScanned = 0;
    let cursor: string | null | undefined = null;
    let lastError: string | undefined;
    let lastHttpStatus: number | null = null;
    let blockedByCaptcha = false;
    let anyPageOk = false;
    let hadPartialFailure = false;

    for (let page = 0; page < 4; page += 1) {
      if (signal?.aborted) break;
      const url: string = cursor
        ? `${HIMALAYAS_API_BASE}&cursor=${encodeURIComponent(cursor)}`
        : HIMALAYAS_API_BASE;
      const res = await safePublicGet(url, 'application/json,*/*', signal);
      if (res.status !== null && (lastHttpStatus === null || !res.ok)) {
        lastHttpStatus = res.status;
      }
      if (!res.ok) {
        lastError = res.blockedReason || `HTTP ${res.status}`;
        if (res.blockedByCaptcha) blockedByCaptcha = true;
        if (anyPageOk) hadPartialFailure = true;
        break;
      }
      anyPageOk = true;
      const parsedPage = parseHimalayasApiJson(res.body);
      totalScanned += parsedPage.totalScanned;
      collectedRaw.push(...parsedPage.items);
      cursor = parsedPage.nextCursor;
      if (!cursor || collectedRaw.length >= 15) break;
    }

    if (!anyPageOk) {
      const outcome: SourceFetchOutcome = {
        sourceId: this.sourceId,
        sourceName: this.sourceName,
        compatibilityStatus: 'unavailable',
        success: false,
        jobs: [],
        checkedAt,
        httpStatus: lastHttpStatus,
        blockedByCaptcha,
        accessNotes: lastError || 'Himalayas public API unavailable.',
        directPortalUrl: HIMALAYAS_HOME_URL,
        error: lastError,
      };
      outcome.connectionStatus = deriveSourceConnectionStatus(outcome);
      return outcome;
    }

    const jobs = collectedRaw
      .slice(0, 25)
      .map((raw) => this.parseJob(raw, checkedAt))
      .filter((j) => this.validateJob(j).isValid);

    const outcome: SourceFetchOutcome = {
      sourceId: this.sourceId,
      sourceName: this.sourceName,
      compatibilityStatus: hadPartialFailure ? 'partially_supported' : 'supported',
      success: true,
      jobs,
      checkedAt,
      httpStatus: lastHttpStatus,
      blockedByCaptcha,
      accessNotes: `Checked ${totalScanned} Himalayas listings; ${jobs.length} Worldwide/Bangladesh-eligible remote opening(s) matched.${hadPartialFailure && lastError ? ` Partial pagination warning: ${lastError}` : ''}`,
      directPortalUrl: HIMALAYAS_HOME_URL,
      ...(hadPartialFailure && lastError ? { error: lastError } : {}),
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
