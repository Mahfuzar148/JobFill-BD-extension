// JobFill BD - Centralized Source Health & Search Result Metrics State
// Single source of truth for live source status counting, retry targeting,
// summary headlines, failure alerts, and distinct search/index count metrics.

import {
  CentralizedSourceStatus,
  JobSourceAdapter,
  RetryPolicyKind,
  SourceConnectionStatus,
  SourceFetchOutcome,
  deriveSourceConnectionStatus,
} from '../types/source.types';
import { SyncHistoryRecord } from '../types/job.types';

export type CanonicalSourceHealthStatus =
  | 'Successful'
  | 'Partially Successful'
  | 'Failed'
  | 'Manual Verification Required'
  | 'Not Tested'
  | 'Waiting'
  | 'Temporarily Unavailable';

export const CENTRALIZED_TO_CANONICAL_STATUS: Record<CentralizedSourceStatus, CanonicalSourceHealthStatus> = {
  SUCCESS: 'Successful',
  PARTIAL_SUCCESS: 'Partially Successful',
  FAILED: 'Failed',
  MANUAL_VERIFICATION_REQUIRED: 'Manual Verification Required',
  NOT_TESTED: 'Not Tested',
  WAITING: 'Waiting',
  TEMPORARILY_UNAVAILABLE: 'Temporarily Unavailable',
};

export interface SourceHealthItem {
  sourceId: string;
  sourceName: string;
  officialDomain: string;
  directPortalUrl: string;
  openPortalUrl: string;
  accessMethodType: string;
  publisherType: string;
  centralizedStatus: CentralizedSourceStatus;
  status: CanonicalSourceHealthStatus;
  rawConnectionStatus: SourceConnectionStatus;
  lastCheckedAt: number | null;
  lastSuccessfulFetchAt: number | null;
  retrievedCount: number;
  insertedCount: number;
  updatedCount: number;
  duplicateCount: number;
  rejectedCount: number;
  savedCount: number;
  totalIndexedCount: number;
  httpStatus: number | null;
  blockedByCaptcha: boolean;
  rateLimited: boolean;
  invalidResponse: boolean;
  skippedByCooldown: boolean;
  cacheOnly: boolean;
  retryAvailable: boolean;
  retryCooldownUntil: number | null;
  nextEligibleCheckAt: number | null;
  retryPolicy: RetryPolicyKind;
  consecutiveFailures: number;
  retryAvailabilityNote: string;
  retryAvailabilityNoteBn: string;
  dataCoverageNote?: string;
  deadlineVerificationNote?: string;
  error?: string;
  sanitizedError?: string;
  accessNotes?: string;
}

export function isCaptchaRestrictionText(text?: string | null): boolean {
  if (!text) return false;
  return /anti-bot|captcha|challenge page|blocked by captcha|\/tspd\//i.test(String(text));
}

export function isRateLimitText(text?: string | null, httpStatus?: number | null): boolean {
  if (httpStatus === 429) return true;
  if (!text) return false;
  return /\b429\b|too many requests|rate[- ]?limit|retry-after/i.test(String(text));
}

export function formatRetryAvailabilityNote(item: Pick<SourceHealthItem, 'blockedByCaptcha' | 'retryAvailabilityNote' | 'retryAvailabilityNoteBn'>, bn: boolean): string {
  return bn ? item.retryAvailabilityNoteBn : item.retryAvailabilityNote;
}

export interface SourceHealthSummary {
  totalSources: number;
  attemptedSources: number;
  successfulSources: number;
  partiallySuccessfulSources: number;
  failedSources: number;
  manualVerificationSources: number;
  temporarilyUnavailableSources: number;
  waitingSources: number;
  notTestedSources: number;
  captchaBlockedSources: number;
  skippedCooldownSources: number;
  cacheOnlySources: number;
  lastCheckedAt: number | null;
  lastSuccessfulSyncAt: number | null;
  retrievedCount: number;
  savedCount: number;
  retryableSourceIds: string[];
  failedSourceIds: string[];
  captchaBlockedSourceIds: string[];
  manualVerificationSourceIds: string[];
  temporarilyUnavailableSourceIds: string[];
  partiallySuccessfulSourceIds: string[];
  sources: SourceHealthItem[];
}

export function sanitizeSourceErrorMessage(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  const cleaned = String(raw)
    .replace(/(https?:\/\/[^\s?#]+)\?[^\s#]*/gi, '$1')
    .replace(/\b(appname|token|api[_-]?key|key|secret|password|authorization)\s*[:=]\s*\S+/gi, '$1=[redacted]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [redacted]')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.length > 0 ? cleaned : undefined;
}

export interface SearchResultMetrics {
  totalIndexedJobs: number;
  totalStoredJobs: number;
  totalMatchingJobs: number;
  currentlyDisplayedJobs: number;
  successfullyRetrievedJobs: number;
  newlyAddedJobs: number;
}

const BANGLA_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

export function toBanglaDigits(value: number | string): string {
  return String(value).replace(/\d/g, (digit) => BANGLA_DIGITS[Number(digit)] ?? digit);
}

/**
 * Normalizes a source adapter outcome (including legacy cached outcomes) into the centralized 7-state model:
 * SUCCESS | PARTIAL_SUCCESS | FAILED | MANUAL_VERIFICATION_REQUIRED | NOT_TESTED | WAITING | TEMPORARILY_UNAVAILABLE.
 */
export function deriveCentralizedSourceStatus(
  outcome?: (Partial<SourceFetchOutcome> & { jobCount?: number; savedCount?: number }) | null
): CentralizedSourceStatus {
  if (!outcome) {
    return 'NOT_TESTED';
  }

  const rawStatusStr = typeof outcome.status === 'string' ? outcome.status.toUpperCase() : '';
  if (rawStatusStr === 'WAITING' || outcome.connectionStatus === 'Waiting') {
    return 'WAITING';
  }

  const captchaBlocked =
    rawStatusStr === 'MANUAL_VERIFICATION_REQUIRED' ||
    outcome.connectionStatus === 'Manual Verification Required' ||
    Boolean(outcome.blockedByCaptcha) ||
    isCaptchaRestrictionText(outcome.error) ||
    isCaptchaRestrictionText(outcome.accessNotes);

  if (captchaBlocked && outcome.success !== true) {
    return 'MANUAL_VERIFICATION_REQUIRED';
  }

  const rateLimited =
    rawStatusStr === 'TEMPORARILY_UNAVAILABLE' ||
    outcome.connectionStatus === 'Temporarily Unavailable' ||
    Boolean(outcome.rateLimited) ||
    isRateLimitText(outcome.error, outcome.httpStatus);

  if (rateLimited && outcome.success !== true) {
    return 'TEMPORARILY_UNAVAILABLE';
  }

  const hasExplicitState =
    Boolean(outcome.status) ||
    Boolean(outcome.connectionStatus) ||
    typeof outcome.success === 'boolean' ||
    Boolean(outcome.compatibilityStatus);

  if (!outcome.checkedAt && !hasExplicitState) {
    return 'NOT_TESTED';
  }

  if (rawStatusStr === 'NOT_TESTED') {
    return 'NOT_TESTED';
  }
  if (rawStatusStr === 'FAILED') {
    return 'FAILED';
  }
  if (rawStatusStr === 'PARTIAL_SUCCESS') {
    return 'PARTIAL_SUCCESS';
  }
  if (rawStatusStr === 'SUCCESS') {
    return 'SUCCESS';
  }

  const rawConn = outcome.connectionStatus || deriveSourceConnectionStatus(outcome);

  if (
    outcome.compatibilityStatus === 'manual_only' ||
    rawConn === 'Not Implemented' ||
    rawConn === 'Not Tested' ||
    rawStatusStr === 'NOT_TESTED'
  ) {
    return 'NOT_TESTED';
  }

  if (
    outcome.success === false ||
    outcome.compatibilityStatus === 'unavailable' ||
    rawConn === 'Failed' ||
    rawStatusStr === 'FAILED'
  ) {
    return 'FAILED';
  }

  if (
    outcome.compatibilityStatus === 'partially_supported' ||
    rawConn === 'Partially Working' ||
    rawStatusStr === 'PARTIAL_SUCCESS'
  ) {
    return 'PARTIAL_SUCCESS';
  }

  return 'SUCCESS';
}

export function deriveCanonicalSourceHealthStatus(
  outcome?: (Partial<SourceFetchOutcome> & { jobCount?: number; savedCount?: number }) | null
): CanonicalSourceHealthStatus {
  return CENTRALIZED_TO_CANONICAL_STATUS[deriveCentralizedSourceStatus(outcome)];
}

/**
 * Migrates legacy persisted SourceFetchOutcome records cleanly into the centralized 7-state schema.
 */
export function migrateLegacySourceOutcome(
  outcome: Partial<SourceFetchOutcome> & { jobCount?: number; savedCount?: number }
): SourceFetchOutcome {
  const centralizedStatus = deriveCentralizedSourceStatus(outcome);
  const blockedByCaptcha = centralizedStatus === 'MANUAL_VERIFICATION_REQUIRED';
  const rateLimited = centralizedStatus === 'TEMPORARILY_UNAVAILABLE';
  const lastSuccessfulFetchAt =
    typeof outcome.lastSuccessfulFetchAt === 'number' && outcome.lastSuccessfulFetchAt > 0
      ? outcome.lastSuccessfulFetchAt
      : centralizedStatus === 'SUCCESS' || centralizedStatus === 'PARTIAL_SUCCESS'
        ? (typeof outcome.checkedAt === 'number' && outcome.checkedAt > 0 ? outcome.checkedAt : null)
        : null;

  return {
    sourceId: outcome.sourceId || '',
    sourceName: outcome.sourceName || outcome.sourceId || '',
    compatibilityStatus:
      outcome.compatibilityStatus ||
      (centralizedStatus === 'SUCCESS'
        ? 'supported'
        : centralizedStatus === 'PARTIAL_SUCCESS'
          ? 'partially_supported'
          : centralizedStatus === 'NOT_TESTED'
            ? 'manual_only'
            : 'unavailable'),
    connectionStatus: deriveSourceConnectionStatus({ ...outcome, status: centralizedStatus, blockedByCaptcha, rateLimited }),
    status: centralizedStatus,
    accessMethodType: outcome.accessMethodType,
    publisherType: outcome.publisherType,
    success: centralizedStatus === 'SUCCESS' || centralizedStatus === 'PARTIAL_SUCCESS',
    jobs: Array.isArray(outcome.jobs) ? outcome.jobs : [],
    jobCount: typeof outcome.jobCount === 'number' ? outcome.jobCount : Array.isArray(outcome.jobs) ? outcome.jobs.length : 0,
    insertedCount: outcome.insertedCount ?? 0,
    updatedCount: outcome.updatedCount ?? 0,
    duplicateCount: outcome.duplicateCount ?? 0,
    rejectedCount: outcome.rejectedCount ?? 0,
    savedCount: typeof outcome.savedCount === 'number' ? outcome.savedCount : 0,
    totalIndexedCount: outcome.totalIndexedCount ?? outcome.savedCount ?? 0,
    checkedAt: typeof outcome.checkedAt === 'number' ? outcome.checkedAt : 0,
    lastSuccessfulFetchAt,
    httpStatus: typeof outcome.httpStatus === 'number' ? outcome.httpStatus : null,
    blockedByCaptcha,
    invalidResponse: Boolean(outcome.invalidResponse),
    rateLimited,
    retryAfterMs: outcome.retryAfterMs ?? null,
    nextEligibleCheckAt: outcome.nextEligibleCheckAt ?? outcome.retryAfterMs ?? null,
    consecutiveFailures: outcome.consecutiveFailures ?? (centralizedStatus === 'FAILED' ? 1 : 0),
    retryPolicy:
      outcome.retryPolicy ||
      (blockedByCaptcha
        ? 'halted_captcha_manual'
        : rateLimited
          ? 'rate_limit_retry_after'
          : centralizedStatus === 'FAILED'
            ? 'exponential_backoff'
            : centralizedStatus === 'PARTIAL_SUCCESS'
              ? 'partial_scheduled'
              : centralizedStatus === 'SUCCESS'
                ? 'scheduled_interval'
                : 'none'),
    dataCoverageNote: outcome.dataCoverageNote,
    deadlineVerificationNote: outcome.deadlineVerificationNote,
    skippedByCooldown: Boolean(outcome.skippedByCooldown),
    accessNotes: outcome.accessNotes || '',
    directPortalUrl: outcome.directPortalUrl || '',
    openPortalUrl: outcome.openPortalUrl || outcome.directPortalUrl || '',
    error: outcome.error,
  };
}

/**
 * Ensures stale cached outcomes never overwrite fresher attempts or newer failure states.
 */
export function selectAuthoritativeSourceOutcome(
  existing?: Partial<SourceFetchOutcome> | null,
  incoming?: Partial<SourceFetchOutcome> | null
): Partial<SourceFetchOutcome> | undefined {
  if (!incoming) return existing ?? undefined;
  if (!existing) return incoming;
  const prevTs = typeof existing.checkedAt === 'number' ? existing.checkedAt : 0;
  const nextTs = typeof incoming.checkedAt === 'number' ? incoming.checkedAt : 0;
  if (nextTs < prevTs) {
    return existing;
  }
  const existingStatus = deriveCentralizedSourceStatus(existing);
  const incomingStatus = deriveCentralizedSourceStatus(incoming);
  if (
    nextTs === prevTs &&
    incoming.skippedByCooldown &&
    (incomingStatus === 'SUCCESS' || incomingStatus === 'PARTIAL_SUCCESS') &&
    (existingStatus === 'FAILED' ||
      existingStatus === 'MANUAL_VERIFICATION_REQUIRED' ||
      existingStatus === 'TEMPORARILY_UNAVAILABLE')
  ) {
    return existing;
  }
  return incoming;
}

export function computeSourceHealthSummary(
  adapters: JobSourceAdapter[],
  outcomes: Array<Partial<SourceFetchOutcome> & { jobCount?: number; savedCount?: number }>,
  lastSuccessfulSyncAt: number | null = null,
  now: number = Date.now()
): SourceHealthSummary {
  const outcomeById = new Map<string, Partial<SourceFetchOutcome> & { jobCount?: number; savedCount?: number }>();
  for (const out of outcomes || []) {
    if (out?.sourceId) {
      const selected = selectAuthoritativeSourceOutcome(outcomeById.get(out.sourceId), out);
      if (selected) {
        outcomeById.set(out.sourceId, selected);
      }
    }
  }

  const seenIds = new Set<string>();
  const sources: SourceHealthItem[] = [];

  let successfulSources = 0;
  let partiallySuccessfulSources = 0;
  let failedSources = 0;
  let manualVerificationSources = 0;
  let temporarilyUnavailableSources = 0;
  let waitingSources = 0;
  let notTestedSources = 0;
  let captchaBlockedSources = 0;
  let skippedCooldownSources = 0;
  let cacheOnlySources = 0;
  let maxCheckedAt: number | null = null;
  let totalRetrievedCount = 0;
  let totalSavedCount = 0;

  const failedSourceIds: string[] = [];
  const captchaBlockedSourceIds: string[] = [];
  const manualVerificationSourceIds: string[] = [];
  const temporarilyUnavailableSourceIds: string[] = [];
  const partiallySuccessfulSourceIds: string[] = [];
  const retryableSourceIds: string[] = [];

  for (const adapter of adapters || []) {
    if (!adapter?.sourceId || seenIds.has(adapter.sourceId)) continue;
    seenIds.add(adapter.sourceId);

    const rawOut = outcomeById.get(adapter.sourceId);
    const out = rawOut ? migrateLegacySourceOutcome(rawOut) : undefined;
    const centralizedStatus = deriveCentralizedSourceStatus(out);
    const status = CENTRALIZED_TO_CANONICAL_STATUS[centralizedStatus];
    const rawConnectionStatus: SourceConnectionStatus = out
      ? out.connectionStatus || deriveSourceConnectionStatus(out)
      : 'Not Tested';

    const retrievedCount = out?.skippedByCooldown
      ? typeof out.jobCount === 'number'
        ? out.jobCount
        : 0
      : Array.isArray(out?.jobs) && out.jobs.length > 0
        ? out.jobs.length
        : typeof out?.jobCount === 'number'
          ? out.jobCount
          : 0;
    const insertedCount = typeof out?.insertedCount === 'number' ? out.insertedCount : 0;
    const updatedCount = typeof out?.updatedCount === 'number' ? out.updatedCount : 0;
    const duplicateCount = typeof out?.duplicateCount === 'number' ? out.duplicateCount : 0;
    const rejectedCount = typeof out?.rejectedCount === 'number' ? out.rejectedCount : 0;
    const savedCount = typeof out?.savedCount === 'number' ? out.savedCount : 0;
    const totalIndexedCount = typeof out?.totalIndexedCount === 'number' ? out.totalIndexedCount : savedCount;
    const lastCheckedAt =
      typeof out?.checkedAt === 'number' && out.checkedAt > 0 ? out.checkedAt : null;
    const lastSuccessfulFetchAt =
      typeof out?.lastSuccessfulFetchAt === 'number' && out.lastSuccessfulFetchAt > 0
        ? out.lastSuccessfulFetchAt
        : centralizedStatus === 'SUCCESS' || centralizedStatus === 'PARTIAL_SUCCESS'
          ? lastCheckedAt
          : null;
    const httpStatus = typeof out?.httpStatus === 'number' ? out.httpStatus : null;
    const blockedByCaptcha = centralizedStatus === 'MANUAL_VERIFICATION_REQUIRED' || Boolean(out?.blockedByCaptcha);
    const rateLimited = centralizedStatus === 'TEMPORARILY_UNAVAILABLE' || Boolean(out?.rateLimited);
    const invalidResponse = Boolean(out?.invalidResponse);
    const skippedByCooldown = Boolean(out?.skippedByCooldown);
    const cacheOnly = Boolean(
      skippedByCooldown && (centralizedStatus === 'SUCCESS' || centralizedStatus === 'PARTIAL_SUCCESS')
    );
    const sanitizedError = sanitizeSourceErrorMessage(out?.error);

    if (skippedByCooldown) {
      skippedCooldownSources += 1;
    }
    if (cacheOnly) {
      cacheOnlySources += 1;
    }

    const nextEligibleCheckAt =
      typeof out?.nextEligibleCheckAt === 'number'
        ? out.nextEligibleCheckAt
        : blockedByCaptcha
          ? typeof out?.retryAfterMs === 'number'
            ? out.retryAfterMs
            : lastCheckedAt
              ? lastCheckedAt + 60_000
              : null
          : typeof out?.retryAfterMs === 'number'
            ? out.retryAfterMs
            : null;
    const retryCooldownUntil = nextEligibleCheckAt;
    const inBackoffOrCooldown = Boolean(nextEligibleCheckAt && now < nextEligibleCheckAt);
    const retryAvailable =
      centralizedStatus === 'WAITING'
        ? false
        : blockedByCaptcha || rateLimited
          ? !inBackoffOrCooldown
          : true;
    const cooldownSecs = nextEligibleCheckAt
      ? Math.max(1, Math.ceil((nextEligibleCheckAt - now) / 1000))
      : 0;

    let retryAvailabilityNote = 'Ready for scheduled or manual check';
    let retryAvailabilityNoteBn = 'যাচাইয়ের জন্য প্রস্তুত';
    if (centralizedStatus === 'MANUAL_VERIFICATION_REQUIRED') {
      retryAvailabilityNote = inBackoffOrCooldown
        ? `Manual retry cooldown active (${cooldownSecs}s) • auto-polling paused`
        : 'Manual check allowed (auto-retries paused)';
      retryAvailabilityNoteBn = inBackoffOrCooldown
        ? `ক্যাপচা বিরতি চলছে (${toBanglaDigits(cooldownSecs)} সেকেন্ড) • স্বয়ংক্রিয় চেষ্টা বন্ধ`
        : 'ম্যানুয়াল যাচাই অনুমোদিত (স্বয়ংক্রিয় চেষ্টা স্থগিত)';
    } else if (centralizedStatus === 'TEMPORARILY_UNAVAILABLE') {
      retryAvailabilityNote = inBackoffOrCooldown
        ? `Temporarily unavailable (Retry-After ${cooldownSecs}s)`
        : 'Rate-limit window elapsed • ready to re-check';
      retryAvailabilityNoteBn = inBackoffOrCooldown
        ? `সাময়িকভাবে অনুপলব্ধ (${toBanglaDigits(cooldownSecs)} সেকেন্ড পর চেষ্টা)`
        : 'রেট-লিমিট বিরতি শেষ • যাচাইয়ের জন্য প্রস্তুত';
    } else if (centralizedStatus === 'FAILED') {
      retryAvailabilityNote = invalidResponse
        ? 'Auto-polling halted on invalid response • manual check allowed'
        : inBackoffOrCooldown
          ? `Backoff active (${cooldownSecs}s remaining)`
          : 'Failed last attempt • ready to retry';
      retryAvailabilityNoteBn = invalidResponse
        ? 'অকার্যকর রেসপন্সে স্বয়ংক্রিয় চেষ্টা স্থগিত'
        : inBackoffOrCooldown
          ? `ব্যাকঅফ বিরতি চলছে (${toBanglaDigits(cooldownSecs)} সেকেন্ড)`
          : 'পুনঃচেষ্টার জন্য প্রস্তুত';
    } else if (centralizedStatus === 'WAITING') {
      retryAvailabilityNote = 'Waiting in sync queue';
      retryAvailabilityNoteBn = 'সিঙ্ক কিউতে অপেক্ষমাণ';
    } else if (centralizedStatus === 'NOT_TESTED') {
      retryAvailabilityNote = 'Not Tested';
      retryAvailabilityNoteBn = 'পরীক্ষিত নয়';
    } else if (cacheOnly) {
      retryAvailabilityNote = 'Cached within cooldown window';
      retryAvailabilityNoteBn = 'ক্যাশ সক্রিয় (কুলডাউন বিরতি)';
    }

    if (lastCheckedAt !== null && (maxCheckedAt === null || lastCheckedAt > maxCheckedAt)) {
      maxCheckedAt = lastCheckedAt;
    }

    if (centralizedStatus === 'SUCCESS') {
      successfulSources += 1;
      totalRetrievedCount += retrievedCount;
      totalSavedCount += savedCount;
    } else if (centralizedStatus === 'PARTIAL_SUCCESS') {
      partiallySuccessfulSources += 1;
      partiallySuccessfulSourceIds.push(adapter.sourceId);
      retryableSourceIds.push(adapter.sourceId);
      totalRetrievedCount += retrievedCount;
      totalSavedCount += savedCount;
    } else if (centralizedStatus === 'MANUAL_VERIFICATION_REQUIRED') {
      manualVerificationSources += 1;
      captchaBlockedSources += 1;
      manualVerificationSourceIds.push(adapter.sourceId);
      captchaBlockedSourceIds.push(adapter.sourceId);
    } else if (centralizedStatus === 'TEMPORARILY_UNAVAILABLE') {
      temporarilyUnavailableSources += 1;
      temporarilyUnavailableSourceIds.push(adapter.sourceId);
      if (retryAvailable) {
        retryableSourceIds.push(adapter.sourceId);
      }
    } else if (centralizedStatus === 'FAILED') {
      failedSources += 1;
      failedSourceIds.push(adapter.sourceId);
      retryableSourceIds.push(adapter.sourceId);
    } else if (centralizedStatus === 'WAITING') {
      waitingSources += 1;
    } else {
      notTestedSources += 1;
    }

    sources.push({
      sourceId: adapter.sourceId,
      sourceName: adapter.sourceName,
      officialDomain: adapter.officialDomain,
      directPortalUrl: out?.directPortalUrl || adapter.directSourceUrl,
      openPortalUrl: out?.openPortalUrl || out?.directPortalUrl || adapter.directSourceUrl,
      accessMethodType: out?.accessMethodType || adapter.accessMethodType || 'API',
      publisherType: out?.publisherType || adapter.publisherType || 'Third-Party',
      centralizedStatus,
      status,
      rawConnectionStatus,
      lastCheckedAt,
      lastSuccessfulFetchAt,
      retrievedCount,
      insertedCount,
      updatedCount,
      duplicateCount,
      rejectedCount,
      savedCount,
      totalIndexedCount,
      httpStatus,
      blockedByCaptcha,
      rateLimited,
      invalidResponse,
      skippedByCooldown,
      cacheOnly,
      retryAvailable,
      retryCooldownUntil,
      nextEligibleCheckAt,
      retryPolicy: out?.retryPolicy || 'none',
      consecutiveFailures: out?.consecutiveFailures ?? 0,
      retryAvailabilityNote,
      retryAvailabilityNoteBn,
      dataCoverageNote: out?.dataCoverageNote,
      deadlineVerificationNote: out?.deadlineVerificationNote,
      error: out?.error,
      sanitizedError,
      accessNotes: out?.accessNotes || adapter.notes,
    });
  }

  const totalSources = sources.length;
  const attemptedSources =
    successfulSources +
    partiallySuccessfulSources +
    failedSources +
    manualVerificationSources +
    temporarilyUnavailableSources;

  return {
    totalSources,
    attemptedSources,
    successfulSources,
    partiallySuccessfulSources,
    failedSources,
    manualVerificationSources,
    temporarilyUnavailableSources,
    waitingSources,
    notTestedSources,
    captchaBlockedSources,
    skippedCooldownSources,
    cacheOnlySources,
    lastCheckedAt: maxCheckedAt,
    lastSuccessfulSyncAt,
    retrievedCount: totalRetrievedCount,
    savedCount: totalSavedCount,
    retryableSourceIds,
    failedSourceIds,
    captchaBlockedSourceIds,
    manualVerificationSourceIds,
    temporarilyUnavailableSourceIds,
    partiallySuccessfulSourceIds,
    sources,
  };
}

export function formatSourceStatusLabel(status: CanonicalSourceHealthStatus, bn: boolean): string {
  if (!bn) return status;
  switch (status) {
    case 'Successful':
      return 'সফল';
    case 'Partially Successful':
      return 'আংশিক সফল';
    case 'Failed':
      return 'ব্যর্থ';
    case 'Manual Verification Required':
      return 'ম্যানুয়াল যাচাই প্রয়োজন';
    case 'Temporarily Unavailable':
      return 'সাময়িকভাবে অনুপলব্ধ';
    case 'Waiting':
      return 'অপেক্ষমাণ';
    case 'Not Tested':
    default:
      return 'পরীক্ষিত নয়';
  }
}

export function formatSourceHealthHeadline(summary: SourceHealthSummary, bn: boolean): string {
  if (summary.attemptedSources === 0) {
    return bn
      ? `${toBanglaDigits(summary.notTestedSources)}/${toBanglaDigits(summary.totalSources)} পরীক্ষিত নয়`
      : `0/${summary.totalSources} Successful (Not Tested: ${summary.notTestedSources})`;
  }

  return bn
    ? `${toBanglaDigits(summary.successfulSources)}/${toBanglaDigits(summary.attemptedSources)} সূত্র সফল`
    : `${summary.successfulSources}/${summary.attemptedSources} Successful`;
}

export function formatFailedSourcesLabel(failedCount: number, bn: boolean): string {
  return bn
    ? `${toBanglaDigits(failedCount)}টি সূত্র ব্যর্থ`
    : `Failed: ${failedCount}`;
}

export function formatPartialSourcesLabel(partialCount: number, bn: boolean): string {
  return bn
    ? `আংশিক সফল: ${toBanglaDigits(partialCount)}`
    : `Partially Successful: ${partialCount}`;
}

export function formatManualVerificationSourcesLabel(count: number, bn: boolean): string {
  return bn
    ? `ম্যানুয়াল যাচাই: ${toBanglaDigits(count)}`
    : `Manual Verify: ${count}`;
}

export function formatTemporarilyUnavailableSourcesLabel(count: number, bn: boolean): string {
  return bn
    ? `সাময়িক বিরতি: ${toBanglaDigits(count)}`
    : `Temporarily Unavailable: ${count}`;
}

export function formatWaitingSourcesLabel(count: number, bn: boolean): string {
  return bn
    ? `অপেক্ষমাণ: ${toBanglaDigits(count)}`
    : `Waiting: ${count}`;
}

export function formatNotTestedSourcesLabel(notTestedCount: number, bn: boolean): string {
  return bn
    ? `পরীক্ষিত নয়: ${toBanglaDigits(notTestedCount)}`
    : `Not Tested: ${notTestedCount}`;
}

export function formatSourceFailureAlertMessage(summary: SourceHealthSummary, bn: boolean): string | null {
  const unavailableCount = summary.failedSources + summary.temporarilyUnavailableSources;
  if (summary.attemptedSources === 0 || (unavailableCount === 0 && summary.manualVerificationSources === 0)) {
    return null;
  }

  if (unavailableCount === 0 && summary.manualVerificationSources > 0) {
    return bn
      ? `${toBanglaDigits(summary.manualVerificationSources)}টি পোর্টালে ক্যাপচা/অ্যান্টি-বট সুরক্ষা থাকায় ম্যানুয়াল যাচাই প্রয়োজন; অন্যান্য সূত্রের ফলাফল অক্ষত রয়েছে।`
      : `${summary.manualVerificationSources} portal(s) require manual verification due to CAPTCHA/anti-bot protection; available results from other sources were preserved.`;
  }

  if (unavailableCount === summary.attemptedSources) {
    return bn
      ? `চেষ্টা করা ${toBanglaDigits(summary.attemptedSources)}টি সূত্রের সবগুলোই সাড়া দেয়নি; পূর্ববর্তী সংরক্ষিত ফলাফল দেখানো হচ্ছে।`
      : `All ${summary.attemptedSources} attempted live sources failed to respond; preserved your last saved search dataset.`;
  }

  if (bn) {
    return `${toBanglaDigits(summary.attemptedSources)}টির মধ্যে ${toBanglaDigits(unavailableCount)}টি সূত্র ব্যর্থ (${toBanglaDigits(summary.successfulSources)}/${toBanglaDigits(summary.attemptedSources)} সূত্র সফল); সফল সূত্রগুলোর ফলাফল আপডেট হয়েছে।`;
  }

  const partialSuffix =
    summary.partiallySuccessfulSources > 0
      ? `, ${summary.partiallySuccessfulSources} Partially Successful`
      : '';
  const manualSuffix =
    summary.manualVerificationSources > 0
      ? `, ${summary.manualVerificationSources} Manual Verification Required`
      : '';
  return `${unavailableCount} of ${summary.attemptedSources} sources failed (${summary.successfulSources}/${summary.attemptedSources} Successful${partialSuffix}${manualSuffix}); available results were preserved and updated.`;
}

export function computeSearchResultMetrics(params: {
  totalIndexedJobs: number;
  totalStoredJobs: number;
  totalMatchingJobs: number;
  currentlyDisplayedJobs: number;
  sourceHealth: SourceHealthSummary;
  latestSync?: SyncHistoryRecord | null;
  lastRunNewJobsCount?: number | null;
}): SearchResultMetrics {
  const {
    totalIndexedJobs,
    totalStoredJobs,
    totalMatchingJobs,
    currentlyDisplayedJobs,
    sourceHealth,
    latestSync,
    lastRunNewJobsCount,
  } = params;

  const successfullyRetrievedJobs =
    sourceHealth.attemptedSources > 0
      ? sourceHealth.retrievedCount
      : latestSync?.totalRetrieved ?? 0;

  const newlyAddedJobs =
    typeof lastRunNewJobsCount === 'number'
      ? lastRunNewJobsCount
      : latestSync?.newJobsCount ?? 0;

  return {
    totalIndexedJobs,
    totalStoredJobs,
    totalMatchingJobs,
    currentlyDisplayedJobs,
    successfullyRetrievedJobs,
    newlyAddedJobs,
  };
}

const JOB_CATEGORY_LABELS_BN: Record<string, string> = {
  All: 'সব',
  Government: 'সরকারি',
  Private: 'বেসরকারি',
  Bank: 'ব্যাংক',
  NGO: 'এনজিও',
  University: 'বিশ্ববিদ্যালয়',
  'Autonomous Organization': 'স্বায়ত্তশাসিত',
  'Defence / Security': 'প্রতিরক্ষা ও নিরাপত্তা',
  Defence: 'প্রতিরক্ষা',
  Education: 'শিক্ষা',
  Teaching: 'শিক্ষকতা',
  'IT / Technology': 'আইটি ও প্রযুক্তি',
  Healthcare: 'স্বাস্থ্যসেবা',
  'Remote Jobs': 'রিমোট চাকরি',
  'International Jobs': 'আন্তর্জাতিক',
  Other: 'অন্যান্য',
};

const APPLICATION_STATUS_LABELS_BN: Record<string, string> = {
  Bookmarked: 'সংরক্ষিত',
  'Ready to Apply': 'আবেদনের জন্য প্রস্তুত',
  Applied: 'আবেদনকৃত',
  'Exam Scheduled': 'পরীক্ষার সূচি',
  'Result Published': 'ফলাফল প্রকাশিত',
  Selected: 'নির্বাচিত',
  Rejected: 'বাতিল / অকৃতকার্য',
};

export function formatJobCategoryLabel(category: string, bn: boolean): string {
  if (!bn) return category;
  return JOB_CATEGORY_LABELS_BN[category] || category;
}

export function formatApplicationStatusLabel(status: string, bn: boolean): string {
  if (!bn) return status;
  return APPLICATION_STATUS_LABELS_BN[status] || status;
}
