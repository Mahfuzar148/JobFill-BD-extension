// JobFill BD - Remote OK Public REST API Adapter
// Uses Remote OK's public unauthenticated JSON feed (https://remoteok.com/api).
// Attribution & trademark compliance: names "Remote OK", links back directly to each remoteok.com URL,
// and omits Remote OK trademark logos. User-toggleable in Settings.

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

const REMOTEOK_API_URL = 'https://remoteok.com/api';
const REMOTEOK_HOME_URL = 'https://remoteok.com/';

interface RemoteOkApiEntry {
  legal?: string;
  id?: string | number;
  slug?: string;
  company?: string;
  position?: string;
  tags?: string[];
  location?: string;
  date?: string;
  salary_min?: number;
  salary_max?: number;
  url?: string;
  apply_url?: string;
  description?: string;
}

export function parseRemoteOkApiJson(jsonText: string, maxItems: number = 25): RawSourceJobItem[] {
  let parsed: any;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const items: RawSourceJobItem[] = [];
  for (const entry of parsed as RemoteOkApiEntry[]) {
    if (!entry || typeof entry !== 'object' || entry.legal) continue;
    const id = entry.id !== undefined && entry.id !== null ? String(entry.id).trim() : '';
    const company = (entry.company || '').trim();
    const title = (entry.position || '').trim();
    const rawUrl = (entry.url || (entry.slug ? `https://remoteok.com/remote-jobs/${entry.slug}` : '')).trim();
    if (!id || !company || !title || !/^https?:\/\//i.test(rawUrl)) continue;

    const locRaw = (entry.location || '').trim();
    const location = !locRaw || /worldwide|anywhere|global|remote/i.test(locRaw) ? 'All Bangladesh' : locRaw;

    const tags = Array.isArray(entry.tags)
      ? entry.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 6)
      : [];

    let salary: string | undefined;
    if (typeof entry.salary_min === 'number' && entry.salary_min > 0) {
      salary =
        typeof entry.salary_max === 'number' && entry.salary_max >= entry.salary_min
          ? `$${entry.salary_min.toLocaleString()} - $${entry.salary_max.toLocaleString()}/yr`
          : `From $${entry.salary_min.toLocaleString()}/yr`;
    }

    const descriptionBody = stripHtmlTags(entry.description || '').slice(0, 500);
    const tagLine = tags.length > 0 ? `Skills/Tags: ${tags.join(', ')}. ` : '';

    const applyCandidate = (entry.apply_url || '').trim();
    const resolvedApplyUrl =
      /^https?:\/\//i.test(applyCandidate) && !/\.pdf(\?|$)/i.test(applyCandidate)
        ? applyCandidate
        : rawUrl;

    items.push({
      externalId: `remoteok_${id}`,
      sourceJobId: id,
      organization: company,
      // Omit Remote OK branding assets per API terms
      organizationLogo: undefined,
      jobTitle: `${title} (Remote OK)`,
      position: title,
      category: 'Remote Jobs',
      employmentType: 'Full Time',
      salary,
      qualification: 'Any Qualification',
      location,
      publishedDateText: entry.date ? String(entry.date).slice(0, 10) : undefined,
      // Remote OK feed does not include closing deadlines — never invent one
      deadlineText: undefined,
      circularUrl: undefined,
      sourceUrl: rawUrl,
      applicationUrl: resolvedApplyUrl,
      description: `${tagLine}${descriptionBody || `${title} at ${company} (${locRaw || 'Remote'}) via Remote OK.`}`.trim(),
    });

    if (items.length >= maxItems) break;
  }

  return items;
}

export const RemoteOkAdapter: JobSourceAdapter = {
  sourceId: 'remoteok_remote',
  sourceName: 'Remote OK (Public REST API)',
  sourceType: 'remote_tech_api',
  officialDomain: 'remoteok.com',
  compatibilityStatus: 'supported',
  accessMethodType: 'API',
  publisherType: 'Third-Party',
  accessMethod: 'Public Remote OK JSON Feed (https://remoteok.com/api)',
  verificationLevel: 'official_partial',
  directSourceUrl: REMOTEOK_HOME_URL,
  minPollCooldownMs: 60 * 60 * 1000,
  complianceNotes: 'Requires Remote OK linkback attribution without trademark logo misuse.',
  notes:
    'Fetches public remote openings via Remote OK API (attribution linkback to remoteok.com, no API key required). Can be toggled off under Settings.',

  async fetchJobs(signal?: AbortSignal): Promise<SourceFetchOutcome> {
    const checkedAt = Date.now();
    const prefs = await JobRepository.getPreferences();
    if (prefs.enableRemoteOkSource === false) {
      return {
        sourceId: this.sourceId,
        sourceName: this.sourceName,
        compatibilityStatus: 'manual_only',
        connectionStatus: 'Not Implemented',
        success: true,
        jobs: [],
        checkedAt,
        accessNotes: 'Disabled in Settings -> Job & Notification Preferences.',
        directPortalUrl: REMOTEOK_HOME_URL,
      };
    }

    const res = await safePublicGet(REMOTEOK_API_URL, 'application/json,*/*', signal);
    if (!res.ok) {
      const outcome: SourceFetchOutcome = {
        sourceId: this.sourceId,
        sourceName: this.sourceName,
        compatibilityStatus: 'unavailable',
        success: false,
        jobs: [],
        checkedAt,
        accessNotes: res.blockedReason || 'Remote OK public API unavailable.',
        directPortalUrl: REMOTEOK_HOME_URL,
        error: res.blockedReason,
      };
      outcome.connectionStatus = deriveSourceConnectionStatus(outcome);
      return outcome;
    }

    const rawItems = parseRemoteOkApiJson(res.body);
    const jobs = rawItems.map((raw) => this.parseJob(raw, checkedAt)).filter((j) => this.validateJob(j).isValid);

    const outcome: SourceFetchOutcome = {
      sourceId: this.sourceId,
      sourceName: this.sourceName,
      compatibilityStatus: 'supported',
      success: true,
      jobs,
      checkedAt,
      accessNotes: `Fetched ${jobs.length} remote opening(s) via Remote OK public API.`,
      directPortalUrl: REMOTEOK_HOME_URL,
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
