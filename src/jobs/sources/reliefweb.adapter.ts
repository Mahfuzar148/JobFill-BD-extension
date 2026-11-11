// JobFill BD - ReliefWeb API v2 Adapter (Bangladesh UN & NGO Jobs)
// Official UN OCHA ReliefWeb v2 REST API (free registered appname required by ReliefWeb v2).
// Users can enter their free approved appname in Settings -> Job & Notification Preferences.

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

const RELIEFWEB_PORTAL_URL = 'https://reliefweb.int/jobs?search=country%3ABangladesh';

interface ReliefWebV2Entry {
  id?: string | number;
  fields?: {
    title?: string;
    url?: string;
    date?: {
      created?: string;
      closing?: string;
    };
    source?: Array<{ name?: string; shortname?: string }>;
    city?: Array<{ name?: string }>;
  };
}

export function parseReliefWebV2Json(jsonText: string): RawSourceJobItem[] {
  let parsed: any;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return [];
  }
  const entries: ReliefWebV2Entry[] = Array.isArray(parsed?.data) ? parsed.data : [];

  return entries
    .map((entry): RawSourceJobItem | null => {
      const id = entry.id ? String(entry.id).trim() : '';
      const f = entry.fields;
      const title = (f?.title || '').trim();
      const jobUrl = (f?.url || '').trim();
      if (!id || !title || !jobUrl) return null;

      const org = (f?.source?.[0]?.name || f?.source?.[0]?.shortname || 'UN / NGO Organization').trim();
      const city = (f?.city?.[0]?.name || '').trim();

      return {
        externalId: `reliefweb_${id}`,
        organization: org,
        jobTitle: title,
        position: title,
        category: 'NGO',
        employmentType: 'Contractual',
        qualification: 'Bachelor',
        location: city || 'All Bangladesh',
        publishedDateText: f?.date?.created ? f.date.created.slice(0, 10) : undefined,
        deadlineText: f?.date?.closing ? f.date.closing : undefined,
        circularUrl: undefined,
        sourceUrl: jobUrl,
        applicationUrl: jobUrl,
        description: `Official UN / NGO job in Bangladesh published by ${org} on ReliefWeb.`,
      };
    })
    .filter((item): item is RawSourceJobItem => item !== null);
}

export const ReliefWebAdapter: JobSourceAdapter = {
  sourceId: 'reliefweb_bd',
  sourceName: 'ReliefWeb Bangladesh (UN & NGO REST API v2)',
  sourceType: 'un_ngo_api',
  officialDomain: 'reliefweb.int',
  compatibilityStatus: 'partially_supported',
  accessMethodType: 'API',
  publisherType: 'Official',
  accessMethod: 'Official ReliefWeb REST API v2 (free approved appname required)',
  verificationLevel: 'official_verified',
  directSourceUrl: RELIEFWEB_PORTAL_URL,
  notes:
    'Fetches official UN/INGO/NGO openings in Bangladesh from ReliefWeb v2 REST API when a free ReliefWeb appname is set in Settings.',

  async fetchJobs(signal?: AbortSignal): Promise<SourceFetchOutcome> {
    const checkedAt = Date.now();
    const prefs = await JobRepository.getPreferences();
    const appName = (prefs.reliefwebAppName || '').trim();

    if (!appName) {
      return {
        sourceId: this.sourceId,
        sourceName: this.sourceName,
        compatibilityStatus: 'manual_only',
        connectionStatus: 'Not Implemented',
        success: true,
        jobs: [],
        checkedAt,
        accessNotes:
          'ReliefWeb v2 API requires a free approved appname. Add your appname in Settings -> Job Preferences to enable Bangladesh UN/NGO jobs.',
        directPortalUrl: RELIEFWEB_PORTAL_URL,
      };
    }

    const endpoint =
      `https://api.reliefweb.int/v2/jobs?appname=${encodeURIComponent(appName)}` +
      `&filter[field]=country&filter[value]=Bangladesh&limit=20` +
      `&fields[include][]=title&fields[include][]=url&fields[include][]=date.closing` +
      `&fields[include][]=date.created&fields[include][]=source.name&fields[include][]=city.name`;

    const res = await safePublicGet(endpoint, 'application/json,*/*', signal);
    if (!res.ok) {
      const outcome: SourceFetchOutcome = {
        sourceId: this.sourceId,
        sourceName: this.sourceName,
        compatibilityStatus: 'unavailable',
        success: false,
        jobs: [],
        checkedAt,
        accessNotes: res.blockedReason || 'ReliefWeb v2 API returned an error; confirm your approved appname in Settings.',
        directPortalUrl: RELIEFWEB_PORTAL_URL,
        error: res.blockedReason,
      };
      outcome.connectionStatus = deriveSourceConnectionStatus(outcome);
      return outcome;
    }

    const rawItems = parseReliefWebV2Json(res.body);
    const jobs = rawItems.map((raw) => this.parseJob(raw, checkedAt)).filter((j) => this.validateJob(j).isValid);

    const outcome: SourceFetchOutcome = {
      sourceId: this.sourceId,
      sourceName: this.sourceName,
      compatibilityStatus: 'supported',
      success: true,
      jobs,
      checkedAt,
      accessNotes: `Fetched ${jobs.length} Bangladesh UN/NGO opening(s) from ReliefWeb API v2.`,
      directPortalUrl: RELIEFWEB_PORTAL_URL,
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
