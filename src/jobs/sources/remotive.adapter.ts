// JobFill BD - Remotive Public REST API Adapter
// Uses Remotive's free, unauthenticated public REST API (https://remotive.com/api/remote-jobs)
// for global remote IT/Software & remote-friendly opportunities (opt-out available in Settings).

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

const REMOTIVE_API_URL = 'https://remotive.com/api/remote-jobs?limit=20';
const REMOTIVE_HOME_URL = 'https://remotive.com/remote-jobs';

interface RemotiveApiJob {
  id?: number | string;
  url?: string;
  title?: string;
  company_name?: string;
  company_logo?: string;
  company_logo_url?: string;
  category?: string;
  job_type?: string;
  publication_date?: string;
  candidate_required_location?: string;
  salary?: string;
  description?: string;
}

export function parseRemotiveApiJson(jsonText: string): RawSourceJobItem[] {
  let parsed: any;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return [];
  }
  const rows: RemotiveApiJob[] = Array.isArray(parsed?.jobs) ? parsed.jobs : [];

  return rows
    .map((entry): RawSourceJobItem | null => {
      const id = entry.id ? String(entry.id).trim() : '';
      const org = (entry.company_name || '').trim();
      const title = (entry.title || '').trim();
      const jobUrl = (entry.url || '').trim();
      if (!id || !org || !title || !jobUrl) return null;

      const isTech = /software|dev|engineer|data|devops|cyber|qa|product|design|support|ai/i.test(
        `${entry.category || ''} ${title}`
      );
      const locRaw = (entry.candidate_required_location || '').trim();
      const location = !locRaw || /worldwide|anywhere|global/i.test(locRaw) ? 'All Bangladesh' : locRaw;

      const jobTypeLower = (entry.job_type || '').toLowerCase();
      const employmentType = jobTypeLower.includes('part')
        ? 'Part Time'
        : jobTypeLower.includes('contract') || jobTypeLower.includes('freelance')
          ? 'Contractual'
          : jobTypeLower.includes('intern')
            ? 'Internship'
            : 'Full Time';

      return {
        externalId: `remotive_${id}`,
        organization: org,
        organizationLogo: entry.company_logo || entry.company_logo_url || undefined,
        jobTitle: `${title} (Remote)`,
        position: title,
        category: isTech ? 'IT / Technology' : 'Private',
        employmentType,
        salary: entry.salary?.trim() || undefined,
        qualification: 'Any Qualification',
        location,
        publishedDateText: entry.publication_date ? entry.publication_date.slice(0, 10) : undefined,
        // Remotive feed does not publish closing deadlines — never invent one
        deadlineText: undefined,
        circularUrl: undefined,
        sourceUrl: jobUrl,
        applicationUrl: jobUrl,
        description: stripHtmlTags(entry.description || '').slice(0, 600) || `${title} at ${org} (${locRaw || 'Remote'}).`,
      };
    })
    .filter((item): item is RawSourceJobItem => item !== null);
}

export const RemotiveAdapter: JobSourceAdapter = {
  sourceId: 'remotive_remote',
  sourceName: 'Remotive Remote & Tech Jobs (REST API)',
  sourceType: 'remote_tech_api',
  officialDomain: 'remotive.com',
  compatibilityStatus: 'supported',
  accessMethodType: 'API',
  publisherType: 'Third-Party',
  accessMethod: 'Public Remotive REST JSON API (https://remotive.com/api/remote-jobs)',
  verificationLevel: 'official_partial',
  directSourceUrl: REMOTIVE_HOME_URL,
  minPollCooldownMs: 6 * 60 * 60 * 1000,
  complianceNotes: 'Remotive API lags by 24h, requires visible Remotive linkback attribution, and advises max ~4 fetches/day.',
  notes:
    'Fetches public remote & IT/tech job openings via Remotive REST API (no API key required). Can be toggled off under Settings.',

  async fetchJobs(signal?: AbortSignal): Promise<SourceFetchOutcome> {
    const checkedAt = Date.now();
    const prefs = await JobRepository.getPreferences();
    if (prefs.enableRemotiveSource === false) {
      return {
        sourceId: this.sourceId,
        sourceName: this.sourceName,
        compatibilityStatus: 'manual_only',
        connectionStatus: 'Not Implemented',
        success: true,
        jobs: [],
        checkedAt,
        accessNotes: 'Disabled in Settings -> Job & Notification Preferences.',
        directPortalUrl: REMOTIVE_HOME_URL,
      };
    }

    const res = await safePublicGet(REMOTIVE_API_URL, 'application/json,*/*', signal);
    if (!res.ok) {
      const outcome: SourceFetchOutcome = {
        sourceId: this.sourceId,
        sourceName: this.sourceName,
        compatibilityStatus: 'unavailable',
        success: false,
        jobs: [],
        checkedAt,
        accessNotes: res.blockedReason || 'Remotive public REST API unavailable.',
        directPortalUrl: REMOTIVE_HOME_URL,
        error: res.blockedReason,
      };
      outcome.connectionStatus = deriveSourceConnectionStatus(outcome);
      return outcome;
    }

    const rawItems = parseRemotiveApiJson(res.body);
    const jobs = rawItems.map((raw) => this.parseJob(raw, checkedAt)).filter((j) => this.validateJob(j).isValid);

    const outcome: SourceFetchOutcome = {
      sourceId: this.sourceId,
      sourceName: this.sourceName,
      compatibilityStatus: 'supported',
      success: true,
      jobs,
      checkedAt,
      accessNotes: `Fetched ${jobs.length} remote IT/tech opening(s) via Remotive REST API.`,
      directPortalUrl: REMOTIVE_HOME_URL,
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
