// JobFill BD - Arbeitnow Public Job Board REST API Adapter
// Uses Arbeitnow's free, unauthenticated public GET API (https://www.arbeitnow.com/api/job-board-api)
// filtering strictly to remote-eligible international positions (opt-out toggle in Settings).
// Attributed back to arbeitnow.com per Arbeitnow API terms; never invents deadlines.

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

const ARBEITNOW_API_URL = 'https://www.arbeitnow.com/api/job-board-api';
const ARBEITNOW_HOME_URL = 'https://www.arbeitnow.com/';

interface ArbeitnowApiJob {
  slug?: string;
  company_name?: string;
  title?: string;
  description?: string;
  remote?: boolean;
  url?: string;
  tags?: string[];
  job_types?: string[];
  location?: string;
  created_at?: number | string;
}

function formatArbeitnowCreatedAt(createdAt?: number | string): string | undefined {
  if (createdAt === undefined || createdAt === null || createdAt === '') return undefined;
  const num = typeof createdAt === 'number' ? createdAt : Number(createdAt);
  if (!Number.isFinite(num) || num <= 0) return undefined;
  const ms = num < 1e12 ? num * 1000 : num;
  return new Date(ms).toISOString().slice(0, 10);
}

export function parseArbeitnowApiJson(jsonText: string, maxItems: number = 25): RawSourceJobItem[] {
  let parsed: any;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return [];
  }

  const rows: ArbeitnowApiJob[] = Array.isArray(parsed?.data) ? parsed.data : [];
  const items: RawSourceJobItem[] = [];

  for (const entry of rows) {
    if (!entry || typeof entry !== 'object') continue;
    // Focus on remote=true roles so results remain relevant worldwide / Bangladesh-accessible
    if (entry.remote !== true) continue;

    const slug = (entry.slug || '').trim();
    const company = (entry.company_name || '').trim();
    const title = (entry.title || '').trim();
    const url = (entry.url || '').trim();
    if (!slug || !company || !title || !/^https?:\/\//i.test(url)) continue;

    const tags = Array.isArray(entry.tags)
      ? entry.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 6)
      : [];
    const jobTypes = Array.isArray(entry.job_types) ? entry.job_types.join(' ').toLowerCase() : '';
    const employmentType = jobTypes.includes('part')
      ? 'Part Time'
      : jobTypes.includes('contract') || jobTypes.includes('freelance')
        ? 'Contractual'
        : jobTypes.includes('intern')
          ? 'Internship'
          : 'Full Time';

    const locRaw = (entry.location || '').trim();
    const summary = stripHtmlTags(entry.description || '').slice(0, 500);
    const tagLine = tags.length > 0 ? `Tags: ${tags.join(', ')}. ` : '';

    items.push({
      externalId: `arbeitnow_${slug.slice(0, 72)}`,
      sourceJobId: slug.slice(0, 80),
      organization: company,
      jobTitle: `${title} (Remote - Arbeitnow)`,
      position: title,
      category: 'International Jobs',
      employmentType,
      qualification: 'Any Qualification',
      location: 'All Bangladesh',
      publishedDateText: formatArbeitnowCreatedAt(entry.created_at),
      // Arbeitnow API does not expose closing deadlines — never invent one
      deadlineText: undefined,
      circularUrl: undefined,
      sourceUrl: url,
      applicationUrl: url,
      description: `${tagLine}${summary || `${title} at ${company} (${locRaw || 'Remote'}) listed on Arbeitnow.`}`.trim(),
    });

    if (items.length >= maxItems) break;
  }

  return items;
}

export const ArbeitnowAdapter: JobSourceAdapter = {
  sourceId: 'arbeitnow_remote',
  sourceName: 'Arbeitnow International Remote (REST API)',
  sourceType: 'remote_tech_api',
  officialDomain: 'arbeitnow.com',
  compatibilityStatus: 'supported',
  accessMethodType: 'API',
  publisherType: 'Third-Party',
  accessMethod: 'Public Arbeitnow REST JSON API (https://www.arbeitnow.com/api/job-board-api)',
  verificationLevel: 'official_partial',
  directSourceUrl: ARBEITNOW_HOME_URL,
  minPollCooldownMs: 60 * 60 * 1000,
  complianceNotes: 'Arbeitnow updates hourly and expects non-abusive caching with backlink attribution.',
  notes:
    'Fetches public remote=true international openings via Arbeitnow REST API with direct linkback (no API key required). Opt-out toggle available in Settings.',

  async fetchJobs(signal?: AbortSignal): Promise<SourceFetchOutcome> {
    const checkedAt = Date.now();
    const prefs = await JobRepository.getPreferences();
    if (prefs.enableArbeitnowSource === false) {
      return {
        sourceId: this.sourceId,
        sourceName: this.sourceName,
        compatibilityStatus: 'manual_only',
        connectionStatus: 'Not Implemented',
        success: true,
        jobs: [],
        checkedAt,
        accessNotes: 'Disabled in Settings -> Job & Notification Preferences.',
        directPortalUrl: ARBEITNOW_HOME_URL,
      };
    }

    const res = await safePublicGet(ARBEITNOW_API_URL, 'application/json,*/*', signal);
    if (!res.ok) {
      const outcome: SourceFetchOutcome = {
        sourceId: this.sourceId,
        sourceName: this.sourceName,
        compatibilityStatus: 'unavailable',
        accessMethodType: 'API',
        publisherType: 'Third-Party',
        success: false,
        jobs: [],
        checkedAt,
        accessNotes: res.blockedReason || 'Arbeitnow public REST API unavailable.',
        directPortalUrl: ARBEITNOW_HOME_URL,
        error: res.blockedReason,
      };
      outcome.connectionStatus = deriveSourceConnectionStatus(outcome);
      return outcome;
    }

    const rawItems = parseArbeitnowApiJson(res.body);
    const jobs = rawItems.map((raw) => this.parseJob(raw, checkedAt)).filter((j) => this.validateJob(j).isValid);

    const outcome: SourceFetchOutcome = {
      sourceId: this.sourceId,
      sourceName: this.sourceName,
      compatibilityStatus: 'supported',
      accessMethodType: 'API',
      publisherType: 'Third-Party',
      success: true,
      jobs,
      checkedAt,
      accessNotes: `Fetched ${jobs.length} remote international opening(s) via Arbeitnow REST API.`,
      directPortalUrl: ARBEITNOW_HOME_URL,
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
