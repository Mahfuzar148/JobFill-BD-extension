// JobFill BD - BD Govt Job (bdgovtjob.net) Adapter
// Fetches, discovers, parses, and cross-verifies Bangladesh Public Service Commission (BPSC)
// and Government recruitment circulars from secondary aggregator bdgovtjob.net.
// Never labels secondary sources as official sources. Strictly preserves official URLs.

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
import {
  BDGOVTJOB_ALL_JOBS_URL,
  BDGOVTJOB_BPSC_URL,
  BDGOVTJOB_BASE,
  BPSC_OFFICIAL_URL,
  BPSC_TELETALK_URL,
  discoverArticleMetadata,
  extractMultipleCirculars,
  detectConflicts,
  verifyOfficialSource,
  parseBdGovtJobTable,
} from './bdgovtjob.parser';
import {
  bdGovtJobCrawler,
  loadCheckpoint,
  saveCheckpoint,
  resetCheckpoint,
} from './bdgovtjob.crawler';

export { BDGOVTJOB_ALL_JOBS_URL, BDGOVTJOB_BPSC_URL, BDGOVTJOB_BASE, parseBdGovtJobTable };

const CACHE_TTL_MS = 5 * 60 * 1000; // 5-minute permitted caching

interface CacheEntry {
  fetchedAt: number;
  body: string;
  jobs: NormalizedJobCircular[];
}

let memoryCache: CacheEntry | null = null;

export function resetBdGovtJobCache(): void {
  memoryCache = null;
}

const KNOWN_BPSC_MEMOS = [
  '৮০.০০.০০০০',
  '78-82/2026',
  '83-96/2026',
  'Higher Scale',
  '51st BCS',
  '৫০তম বিসিএস',
  '৪৬তম বিসিএস',
];

import {
  BdGovtJobCrawlCheckpoint,
} from './bdgovtjob.types';

export interface BdGovtJobFetchOptions {
  forceRefresh?: boolean;
  mode?: 'ALL_JOBS' | 'BPSC_ONLY' | 'INCREMENTAL';
  maxPages?: number;
  deepExtraction?: boolean;
  rateLimitMs?: number;
}

export interface BdGovtJobAdapterType extends JobSourceAdapter {
  fetchJobs: (signal?: AbortSignal, options?: BdGovtJobFetchOptions) => Promise<SourceFetchOutcome>;
  startFullCrawl: (options?: { maxPages?: number; rateLimitMs?: number; deepExtraction?: boolean; signal?: AbortSignal }) => Promise<SourceFetchOutcome>;
  syncIncremental: (signal?: AbortSignal, rateLimitMs?: number) => Promise<SourceFetchOutcome>;
  retryFailed: (options?: { rateLimitMs?: number; signal?: AbortSignal }) => Promise<SourceFetchOutcome>;
  pauseCrawl: () => void;
  resumeCrawl: () => void;
  getCheckpoint: () => Promise<BdGovtJobCrawlCheckpoint>;
  resetCheckpoint: () => Promise<void>;
}

export const BdGovtJobAdapter: BdGovtJobAdapterType = {
  sourceId: 'bdgovtjob',
  sourceName: 'BD Govt Job (bdgovtjob.net)',
  sourceType: 'job_board',
  officialDomain: 'bdgovtjob.net',
  compatibilityStatus: 'supported',
  accessMethodType: 'HTML',
  publisherType: 'Third-Party',
  accessMethod: 'Secondary structured circular aggregator (bdgovtjob.net)',
  verificationLevel: 'discovery_only',
  directSourceUrl: BDGOVTJOB_BPSC_URL,
  notes:
    'Parses multiple distinct BPSC and Government job circulars from secondary aggregator bdgovtjob.net with official cross-verification.',

  async fetchJobs(
    signal?: AbortSignal,
    options?: {
      forceRefresh?: boolean;
      mode?: 'ALL_JOBS' | 'BPSC_ONLY' | 'INCREMENTAL';
      maxPages?: number;
      deepExtraction?: boolean;
      rateLimitMs?: number;
    }
  ): Promise<SourceFetchOutcome> {
    const checkedAt = Date.now();

    // Mode: ALL_JOBS dynamic pagination catalog crawl
    if (options?.mode === 'ALL_JOBS') {
      const crawlRes = await bdGovtJobCrawler.crawl({
        signal,
        maxPages: options?.maxPages,
        rateLimitMs: options?.rateLimitMs,
        deepExtraction: options?.deepExtraction,
      });
      const jobs = crawlRes.items
        .map((raw) => this.parseJob(raw, checkedAt))
        .filter((j) => this.validateJob(j).isValid);

      const outcome: SourceFetchOutcome = {
        sourceId: this.sourceId,
        sourceName: this.sourceName,
        compatibilityStatus: 'supported',
        accessMethodType: 'HTML',
        publisherType: 'Third-Party',
        success: true,
        jobs,
        jobCount: jobs.length,
        checkedAt,
        accessNotes: `Crawled ${crawlRes.pagesCrawled} page(s) and extracted ${jobs.length} circulars from bdgovtjob.net All Jobs category.`,
        directPortalUrl: BDGOVTJOB_ALL_JOBS_URL,
      };
      outcome.connectionStatus = deriveSourceConnectionStatus(outcome);
      return outcome;
    }

    // Mode: INCREMENTAL sync (Page 1 + BPSC)
    if (options?.mode === 'INCREMENTAL') {
      const rawItems = await bdGovtJobCrawler.syncIncremental(signal, options?.rateLimitMs ?? 0);
      const jobs = rawItems
        .map((raw) => this.parseJob(raw, checkedAt))
        .filter((j) => this.validateJob(j).isValid);

      const outcome: SourceFetchOutcome = {
        sourceId: this.sourceId,
        sourceName: this.sourceName,
        compatibilityStatus: 'supported',
        accessMethodType: 'HTML',
        publisherType: 'Third-Party',
        success: true,
        jobs,
        jobCount: jobs.length,
        checkedAt,
        accessNotes: `Incremental sync retrieved ${jobs.length} latest circulars from bdgovtjob.net.`,
        directPortalUrl: BDGOVTJOB_ALL_JOBS_URL,
      };
      outcome.connectionStatus = deriveSourceConnectionStatus(outcome);
      return outcome;
    }

    // Check caching permissions: avoid refetching unchanged article within TTL
    if (!options?.forceRefresh && memoryCache && checkedAt - memoryCache.fetchedAt < CACHE_TTL_MS) {
      const outcome: SourceFetchOutcome = {
        sourceId: this.sourceId,
        sourceName: this.sourceName,
        compatibilityStatus: 'supported',
        accessMethodType: 'HTML',
        publisherType: 'Third-Party',
        success: true,
        jobs: memoryCache.jobs,
        checkedAt,
        accessNotes: `Returned ${memoryCache.jobs.length} cached circular(s) from bdgovtjob.net (Cache TTL: 5m).`,
        directPortalUrl: this.directSourceUrl,
      };
      outcome.connectionStatus = deriveSourceConnectionStatus(outcome);
      return outcome;
    }

    const res = await safePublicGet(BDGOVTJOB_BPSC_URL, 'text/html,*/*', signal);

    if (!res.ok) {
      const outcome: SourceFetchOutcome = {
        sourceId: this.sourceId,
        sourceName: this.sourceName,
        compatibilityStatus: 'unavailable',
        accessMethodType: 'HTML',
        publisherType: 'Third-Party',
        success: false,
        jobs: [],
        checkedAt,
        accessNotes: res.blockedReason || 'bdgovtjob.net portal unreachable.',
        directPortalUrl: this.directSourceUrl,
        error: res.blockedReason || 'Portal fetch failed',
      };
      outcome.connectionStatus = deriveSourceConnectionStatus(outcome);
      return outcome;
    }

    // Phase 2/8 — Check for Cloudflare / anti-bot interstitial challenge pages
    if (
      res.body.includes('Just a moment...') ||
      res.body.includes('cf-chl-bypass') ||
      res.body.includes('challenge-running') ||
      res.body.includes('Turnstile')
    ) {
      const outcome: SourceFetchOutcome = {
        sourceId: this.sourceId,
        sourceName: this.sourceName,
        compatibilityStatus: 'partially_supported',
        connectionStatus: 'Manual Verification Required',
        accessMethodType: 'HTML',
        publisherType: 'Third-Party',
        success: false,
        jobs: [],
        checkedAt,
        blockedByCaptcha: true,
        accessNotes: 'bdgovtjob.net returned an anti-bot challenge page. Manual browser verification required.',
        directPortalUrl: this.directSourceUrl,
        error: 'Anti-bot challenge encountered',
      };
      return outcome;
    }

    // Phase 3 — Article Discovery
    const articleMeta = discoverArticleMetadata(res.body, BDGOVTJOB_BPSC_URL);

    // Phase 4 — Multiple Circular Extraction
    const parsedNotices = extractMultipleCirculars(res.body, articleMeta, BDGOVTJOB_BPSC_URL);

    // Phase 6 — Conflict Detection
    detectConflicts(parsedNotices, articleMeta);

    const rawItems: RawSourceJobItem[] = [];

    for (const notice of parsedNotices) {
      // Phase 5 — Official Source Verification
      const verification = verifyOfficialSource(notice, KNOWN_BPSC_MEMOS);

      const stableNoticeKey = notice.memorandumNumber
        ? notice.memorandumNumber.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 24)
        : `sec_${notice.sectionIndex}`;

      rawItems.push({
        externalId: `bdgovtjob-bpsc-${stableNoticeKey}`,
        sourceJobId: `bdgovtjob:bpsc:${stableNoticeKey}`,
        organization: notice.organization,
        organizationBn: notice.organizationBn,
        organizationShortName: 'BPSC',
        jobTitle: notice.jobTitle,
        titleBn: notice.titleBn,
        position: notice.postNames[0] || notice.jobTitle,
        circularNumber: notice.memorandumNumber || undefined,
        category: 'Government',
        employmentType: 'Full Time',
        vacancies: notice.vacancies,
        salary: notice.salary || undefined,
        cadreStatus: notice.recruitmentType.includes('BCS') ? 'Cadre' : 'Non-Cadre',
        qualification: notice.qualification || 'Bachelor',
        ageRequirement: notice.ageRequirement || undefined,
        experience: notice.experience || undefined,
        location: 'All Bangladesh',
        deadlineText: notice.deadlineText || undefined,
        applicationStartText: notice.applicationStartText || undefined,
        publishedDateText: notice.publishedDateText || undefined,
        circularUrl: notice.circularDocumentUrl || BDGOVTJOB_BPSC_URL,
        applicationUrl: notice.applicationUrl || BPSC_TELETALK_URL,
        organizationUrl: notice.officialSourceUrl || BPSC_OFFICIAL_URL,
        sourceUrl: BDGOVTJOB_BPSC_URL,
        secondarySourceUrl: BDGOVTJOB_BPSC_URL,
        officialSourceUrl: verification.officialSourceUrl,
        circularDocumentUrl: notice.circularDocumentUrl,
        circularImages: notice.circularImages,
        verificationStatus: verification.status,
        lastVerifiedAt: verification.lastVerifiedAt,
        hasConflict: notice.hasConflict,
        conflictNotes: notice.conflictNotes,
        recruitmentType: notice.recruitmentType,
        memorandumNumber: notice.memorandumNumber || undefined,
        applicationStartTime: notice.applicationStartTime || undefined,
        applicationDeadlineTime: notice.applicationDeadlineTime || undefined,
        description: `${notice.jobTitle}. মোট শূন্যপদ: ${notice.vacancies ?? 'উল্লেখ নেই'}টি। আবেদন পোর্টাল: ${notice.applicationUrl || BPSC_TELETALK_URL}। অফিশিয়াল ওয়েবসাইট: ${notice.officialSourceUrl || BPSC_OFFICIAL_URL}। মাধ্যমিক উৎস: bdgovtjob.net।`,
      });
    }

    const jobs = rawItems
      .map((raw) => this.parseJob(raw, checkedAt))
      .filter((j) => this.validateJob(j).isValid);

    // Update memory cache
    memoryCache = {
      fetchedAt: checkedAt,
      body: res.body,
      jobs,
    };

    const outcome: SourceFetchOutcome = {
      sourceId: this.sourceId,
      sourceName: this.sourceName,
      compatibilityStatus: 'supported',
      accessMethodType: 'HTML',
      publisherType: 'Third-Party',
      success: true,
      jobs,
      checkedAt,
      accessNotes: `Discovered and extracted ${jobs.length} separate BPSC circular(s) from bdgovtjob.net.`,
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

  async startFullCrawl(options?: { maxPages?: number; rateLimitMs?: number; deepExtraction?: boolean; signal?: AbortSignal }) {
    return this.fetchJobs(options?.signal, { mode: 'ALL_JOBS', ...options });
  },

  async syncIncremental(signal?: AbortSignal, rateLimitMs: number = 0) {
    return this.fetchJobs(signal, { mode: 'INCREMENTAL', rateLimitMs });
  },

  async retryFailed(options?: { rateLimitMs?: number; signal?: AbortSignal }): Promise<SourceFetchOutcome> {
    const checkedAt = Date.now();
    const retryRes = await bdGovtJobCrawler.retryFailed({
      rateLimitMs: options?.rateLimitMs,
      signal: options?.signal,
    });
    const jobs = retryRes.items
      .map((raw) => this.parseJob(raw, checkedAt))
      .filter((j) => this.validateJob(j).isValid);

    const outcome: SourceFetchOutcome = {
      sourceId: this.sourceId,
      sourceName: this.sourceName,
      compatibilityStatus: 'supported',
      accessMethodType: 'HTML',
      publisherType: 'Third-Party',
      success: true,
      jobs,
      jobCount: jobs.length,
      checkedAt,
      accessNotes: `Retried failed URLs: recovered ${jobs.length} circulars (${retryRes.checkpoint.failedUrls.length} remaining).`,
      directPortalUrl: BDGOVTJOB_ALL_JOBS_URL,
    };
    outcome.connectionStatus = deriveSourceConnectionStatus(outcome);
    return outcome;
  },

  pauseCrawl(): void {
    bdGovtJobCrawler.pause();
  },

  resumeCrawl(): void {
    bdGovtJobCrawler.resume();
  },

  getCheckpoint() {
    return loadCheckpoint();
  },

  resetCheckpoint() {
    return resetCheckpoint();
  },
};
