// JobFill BD - Read-Only Job Source Fetcher
// Strictly issues unauthenticated HTTP GET requests without user profile/NID/document data.
// Detects anti-bot challenges or login walls and refuses to bypass them.

import {
  CentralizedSourceStatus,
  JobSourceAdapter,
  RetryPolicyKind,
  SourceFetchOutcome,
  deriveSourceConnectionStatus,
} from '../types/source.types';
import { recordExtensionDiagnostic } from '../../security/diagnostics';
import {
  detectAccessRestriction,
  detectAccessRestrictionWithReason,
} from './captcha-detector';

export { detectAccessRestriction, detectAccessRestrictionWithReason };

export interface SafeFetchResult {
  ok: boolean;
  status: number;
  contentType: string;
  body: string;
  blockedReason?: string;
  blockedByCaptcha?: boolean;
  rateLimited?: boolean;
  retryAfterHeaderMs?: number | null;
}

const activeSourceFetchPromises = new Map<string, Promise<SourceFetchOutcome>>();
const MAX_BACKOFF_MS = 6 * 60 * 60 * 1000;
const DEFAULT_RATE_LIMIT_WAIT_MS = 15 * 60 * 1000;
const INVALID_RESPONSE_COOLDOWN_MS = 12 * 60 * 60 * 1000;

export function parseRetryAfterHeaderMs(headerVal: string | null | undefined, now: number = Date.now()): number | null {
  if (!headerVal) return null;
  const trimmed = headerVal.trim();
  if (!trimmed) return null;
  if (/^\d+$/.test(trimmed)) {
    const secs = Number(trimmed);
    if (Number.isFinite(secs) && secs >= 0) {
      return Math.min(24 * 60 * 60 * 1000, Math.max(1000, secs * 1000));
    }
  }
  const dateMs = Date.parse(trimmed);
  if (Number.isFinite(dateMs)) {
    return Math.min(24 * 60 * 60 * 1000, Math.max(1000, dateMs - now));
  }
  return null;
}

export function computeExponentialBackoffMs(consecutiveFailures: number, baseMs: number = 60_000): number {
  const n = Math.max(1, Math.floor(consecutiveFailures));
  return Math.min(MAX_BACKOFF_MS, baseMs * Math.pow(2, n - 1));
}

export interface SourceProgressEvent {
  sourceId: string;
  sourceName: string;
  phase: 'fetching' | 'completed' | 'failed';
  completedCount: number;
  totalCount: number;
  outcome?: SourceFetchOutcome;
}

export interface FetchSourcesOptions {
  concurrency?: number;
  respectCooldowns?: boolean;
  isManualRetry?: boolean;
  previousOutcomesById?: Map<string, Partial<SourceFetchOutcome> & { jobCount?: number; savedCount?: number }>;
  onSourceProgress?: (event: SourceProgressEvent) => void;
}

export const CAPTCHA_MANUAL_RETRY_INTERVAL_MS = 60 * 1000;
export const CAPTCHA_AUTO_COOLDOWN_MS = 6 * 60 * 60 * 1000;

const DEFAULT_SOURCE_COOLDOWNS_MS: Record<string, number> = {
  remotive_remote: 6 * 60 * 60 * 1000,
  arbeitnow_remote: 60 * 60 * 1000,
  remoteok_remote: 60 * 60 * 1000,
  himalayas_remote: 60 * 60 * 1000,
  bangladesh_bank: 6 * 60 * 60 * 1000,
};

const DEFAULT_TIMEOUT_MS = 12000;
const TRANSIENT_RETRY_DELAY_MS = 500;
const DEFAULT_CONCURRENCY_LIMIT = 4;

function sleepWithSignal(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      cleanup();
      resolve();
    };
    const cleanup = () => {
      if (signal) signal.removeEventListener('abort', onAbort);
    };
    if (signal) {
      signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}

function isTransientFailure(result: SafeFetchResult): boolean {
  if (result.ok) return false;
  if (result.blockedReason && /anti-bot|captcha|restricted|only http/i.test(result.blockedReason)) {
    return false;
  }
  if (result.status === 429) {
    // Only retry 429 in-flight when server explicitly asked for a short Retry-After (<= 2.5s)
    return typeof result.retryAfterHeaderMs === 'number' && result.retryAfterHeaderMs <= 2500;
  }
  if (result.status === 400 || result.status === 401 || result.status === 403 || result.status === 404) {
    return false;
  }
  return result.status === 0 || result.status >= 500;
}

async function singlePublicGet(
  url: string,
  accept: string,
  externalSignal?: AbortSignal
): Promise<SafeFetchResult> {
  if (!/^https?:\/\//i.test(url)) {
    return { ok: false, status: 0, contentType: '', body: '', blockedReason: 'Only HTTP/HTTPS URLs are permitted.' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(timer);
      return { ok: false, status: 0, contentType: '', body: '', blockedReason: 'Request cancelled' };
    }
    externalSignal.addEventListener('abort', onExternalAbort, { once: true });
  }

  try {
    recordExtensionDiagnostic('api_fetch_call', {
      url,
      source: 'job-fetcher',
      detail: 'public_get',
    });
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'omit',
      headers: { Accept: accept },
      signal: controller.signal,
    });

    const contentType = response.headers?.get('content-type') || '';
    const body = await response.text();
    const restriction = detectAccessRestrictionWithReason(body, response.status);

    if (restriction.blockedReason) {
      return {
        ok: false,
        status: response.status,
        contentType,
        body: '',
        blockedReason: restriction.blockedReason,
        blockedByCaptcha: restriction.blockedByCaptcha,
      };
    }

    if (!response.ok) {
      const retryAfterHeaderMs =
        response.status === 429 ? parseRetryAfterHeaderMs(response.headers?.get('retry-after')) : null;
      return {
        ok: false,
        status: response.status,
        contentType,
        body: '',
        rateLimited: response.status === 429,
        retryAfterHeaderMs,
        blockedReason:
          response.status === 429
            ? retryAfterHeaderMs
              ? `HTTP 429 Too Many Requests (Retry-After ${Math.ceil(retryAfterHeaderMs / 1000)}s)`
              : 'HTTP 429 Too Many Requests'
            : `HTTP ${response.status}`,
      };
    }

    return { ok: true, status: response.status, contentType, body };
  } catch (err: any) {
    return {
      ok: false,
      status: 0,
      contentType: '',
      body: '',
      blockedReason: err?.name === 'AbortError' ? 'Request timed out' : err?.message || 'Network request failed',
    };
  } finally {
    clearTimeout(timer);
    if (externalSignal) {
      externalSignal.removeEventListener('abort', onExternalAbort);
    }
  }
}

export async function safePublicGet(
  url: string,
  accept: string = 'text/html,application/xhtml+xml,application/xml,application/json;q=0.9,*/*;q=0.8',
  externalSignal?: AbortSignal,
  maxTransientRetries: number = 1
): Promise<SafeFetchResult> {
  let attempt = 0;
  while (true) {
    const result = await singlePublicGet(url, accept, externalSignal);
    if (result.ok || attempt >= maxTransientRetries || externalSignal?.aborted || !isTransientFailure(result)) {
      return result;
    }
    attempt += 1;
    const delayMs =
      result.status === 429 && typeof result.retryAfterHeaderMs === 'number'
        ? result.retryAfterHeaderMs
        : TRANSIENT_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
    await sleepWithSignal(delayMs, externalSignal);
    if (externalSignal?.aborted) {
      return { ok: false, status: 0, contentType: '', body: '', blockedReason: 'Request cancelled' };
    }
  }
}

export async function fetchFromSources(
  adapters: JobSourceAdapter[],
  signal?: AbortSignal,
  options?: FetchSourcesOptions
): Promise<SourceFetchOutcome[]> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    console.warn('JobFill BD [JobFetcher]: Browser reports offline state; returning source failure outcomes.');
    const checkedAt = Date.now();
    return adapters.map((adapter) => {
      const failedOutcome: SourceFetchOutcome = {
        sourceId: adapter.sourceId,
        sourceName: adapter.sourceName,
        compatibilityStatus: 'unavailable',
        connectionStatus: 'Failed',
        success: false,
        jobs: [],
        savedCount: 0,
        checkedAt,
        accessNotes: 'Device appears to be offline.',
        directPortalUrl: adapter.directSourceUrl,
        error: 'Offline: No internet connection available',
      };
      options?.onSourceProgress?.({
        sourceId: adapter.sourceId,
        sourceName: adapter.sourceName,
        phase: 'failed',
        completedCount: adapters.length,
        totalCount: adapters.length,
        outcome: failedOutcome,
      });
      return failedOutcome;
    });
  }

  if (adapters.length === 0) return [];

  const totalCount = adapters.length;
  const concurrency = Math.max(1, Math.min(options?.concurrency ?? DEFAULT_CONCURRENCY_LIMIT, totalCount));
  const results = new Array<SourceFetchOutcome>(totalCount);
  let nextIndex = 0;
  let completedCount = 0;

  async function runWorker(): Promise<void> {
    while (nextIndex < totalCount) {
      const idx = nextIndex++;
      const adapter = adapters[idx];
      options?.onSourceProgress?.({
        sourceId: adapter.sourceId,
        sourceName: adapter.sourceName,
        phase: 'fetching',
        completedCount,
        totalCount,
      });

      const startMs = Date.now();
      const prevOut = options?.previousOutcomesById?.get(adapter.sourceId);
      const cooldownMs = adapter.minPollCooldownMs ?? DEFAULT_SOURCE_COOLDOWNS_MS[adapter.sourceId] ?? 0;

      // 1. CAPTCHA / Manual Verification Required:
      // Stop ALL automatic polling permanently; allow manual "Check Again" only when eligible.
      const prevWasCaptcha =
        Boolean(prevOut?.blockedByCaptcha) || prevOut?.status === 'MANUAL_VERIFICATION_REQUIRED';
      if (prevWasCaptcha && typeof prevOut?.checkedAt === 'number') {
        const eligibleAt =
          typeof prevOut.nextEligibleCheckAt === 'number'
            ? prevOut.nextEligibleCheckAt
            : typeof prevOut.retryAfterMs === 'number'
              ? prevOut.retryAfterMs
              : prevOut.checkedAt + CAPTCHA_MANUAL_RETRY_INTERVAL_MS;
        const blockAutoCheck = !options?.isManualRetry;
        const blockRapidManualCheck = Boolean(options?.isManualRetry && startMs < eligibleAt);

        if (blockAutoCheck || blockRapidManualCheck) {
          const retainedOutcome: SourceFetchOutcome = {
            sourceId: adapter.sourceId,
            sourceName: adapter.sourceName,
            compatibilityStatus: 'unavailable',
            connectionStatus: 'Manual Verification Required',
            status: 'MANUAL_VERIFICATION_REQUIRED',
            accessMethodType: prevOut.accessMethodType || adapter.accessMethodType || 'HTML',
            publisherType: prevOut.publisherType || adapter.publisherType || 'Official',
            success: false,
            jobs: [],
            jobCount: 0,
            savedCount: 0,
            checkedAt: prevOut.checkedAt,
            lastSuccessfulFetchAt: prevOut.lastSuccessfulFetchAt ?? null,
            httpStatus: prevOut.httpStatus ?? null,
            blockedByCaptcha: true,
            retryAfterMs: eligibleAt,
            nextEligibleCheckAt: eligibleAt,
            retryPolicy: 'halted_captcha_manual',
            skippedByCooldown: true,
            dataCoverageNote:
              prevOut.dataCoverageNote ||
              'Automatic extraction stopped per CAPTCHA/anti-bot policy; manual verification required.',
            accessNotes:
              prevOut.accessNotes ||
              'Automatic fetch stopped while portal CAPTCHA protection is active. Open Official Portal or add circular manually.',
            directPortalUrl: prevOut.directPortalUrl || adapter.directSourceUrl,
            openPortalUrl: prevOut.openPortalUrl || adapter.directSourceUrl,
            error:
              prevOut.error ||
              'Portal returned an anti-bot/CAPTCHA challenge page — automatic extraction halted per policy.',
          };
          results[idx] = retainedOutcome;
          completedCount += 1;
          options?.onSourceProgress?.({
            sourceId: adapter.sourceId,
            sourceName: adapter.sourceName,
            phase: 'failed',
            completedCount,
            totalCount,
            outcome: retainedOutcome,
          });
          continue;
        }
      }

      // 2. HTTP 429 Retry-After / Exponential Backoff / Halted Invalid Response guard
      if (
        prevOut &&
        !prevWasCaptcha &&
        typeof prevOut.nextEligibleCheckAt === 'number' &&
        startMs < prevOut.nextEligibleCheckAt &&
        (!options?.isManualRetry || Boolean(prevOut.rateLimited))
      ) {
        const retainedBackoff: SourceFetchOutcome = {
          sourceId: adapter.sourceId,
          sourceName: adapter.sourceName,
          compatibilityStatus: prevOut.compatibilityStatus || 'unavailable',
          connectionStatus: prevOut.rateLimited
            ? 'Temporarily Unavailable'
            : prevOut.connectionStatus || deriveSourceConnectionStatus(prevOut),
          status: prevOut.rateLimited
            ? 'TEMPORARILY_UNAVAILABLE'
            : (prevOut.status as CentralizedSourceStatus) || 'FAILED',
          accessMethodType: prevOut.accessMethodType || adapter.accessMethodType || 'API',
          publisherType: prevOut.publisherType || adapter.publisherType || 'Third-Party',
          success: false,
          jobs: [],
          jobCount: 0,
          savedCount: 0,
          checkedAt: prevOut.checkedAt ?? startMs,
          lastSuccessfulFetchAt: prevOut.lastSuccessfulFetchAt ?? null,
          httpStatus: prevOut.httpStatus ?? null,
          blockedByCaptcha: false,
          rateLimited: Boolean(prevOut.rateLimited),
          invalidResponse: Boolean(prevOut.invalidResponse),
          retryAfterMs: prevOut.nextEligibleCheckAt,
          nextEligibleCheckAt: prevOut.nextEligibleCheckAt,
          consecutiveFailures: prevOut.consecutiveFailures ?? 1,
          retryPolicy: prevOut.retryPolicy || 'exponential_backoff',
          skippedByCooldown: true,
          accessNotes: prevOut.accessNotes || adapter.notes,
          directPortalUrl: prevOut.directPortalUrl || adapter.directSourceUrl,
          error: prevOut.error || 'Waiting until retry backoff/Retry-After window expires.',
        };
        results[idx] = retainedBackoff;
        completedCount += 1;
        options?.onSourceProgress?.({
          sourceId: adapter.sourceId,
          sourceName: adapter.sourceName,
          phase: 'failed',
          completedCount,
          totalCount,
          outcome: retainedBackoff,
        });
        continue;
      }

      if (
        options?.respectCooldowns &&
        cooldownMs > 0 &&
        prevOut?.checkedAt &&
        prevOut.success &&
        prevOut.compatibilityStatus !== 'unavailable' &&
        prevOut.compatibilityStatus !== 'manual_only' &&
        startMs - prevOut.checkedAt < cooldownMs
      ) {
        const baseNotes = (prevOut.accessNotes || adapter.notes || '')
          .replace(/\s*\(Rate-limit cache cooldown active\)$/i, '')
          .trim();
        const cachedOutcome: SourceFetchOutcome = {
          sourceId: adapter.sourceId,
          sourceName: adapter.sourceName,
          compatibilityStatus: prevOut.compatibilityStatus || adapter.compatibilityStatus,
          connectionStatus: prevOut.connectionStatus || deriveSourceConnectionStatus(prevOut),
          status:
            prevOut.compatibilityStatus === 'partially_supported' ? 'PARTIAL_SUCCESS' : 'SUCCESS',
          accessMethodType: prevOut.accessMethodType || adapter.accessMethodType || 'API',
          publisherType: prevOut.publisherType || adapter.publisherType || 'Third-Party',
          success: true,
          jobs: [],
          jobCount:
            typeof prevOut.jobCount === 'number'
              ? prevOut.jobCount
              : Array.isArray(prevOut.jobs)
                ? prevOut.jobs.length
                : 0,
          savedCount: prevOut.savedCount ?? 0,
          totalIndexedCount: prevOut.totalIndexedCount ?? prevOut.savedCount ?? 0,
          checkedAt: prevOut.checkedAt,
          lastSuccessfulFetchAt: prevOut.lastSuccessfulFetchAt ?? prevOut.checkedAt,
          httpStatus: prevOut.httpStatus ?? null,
          blockedByCaptcha: false,
          retryAfterMs: null,
          nextEligibleCheckAt: prevOut.checkedAt + cooldownMs,
          retryPolicy:
            prevOut.compatibilityStatus === 'partially_supported'
              ? 'partial_scheduled'
              : 'scheduled_interval',
          skippedByCooldown: true,
          accessNotes: `${baseNotes} (Rate-limit cache cooldown active)`.trim(),
          directPortalUrl: prevOut.directPortalUrl || adapter.directSourceUrl,
        };
        results[idx] = cachedOutcome;
        completedCount += 1;
        options?.onSourceProgress?.({
          sourceId: adapter.sourceId,
          sourceName: adapter.sourceName,
          phase: 'completed',
          completedCount,
          totalCount,
          outcome: cachedOutcome,
        });
        continue;
      }

      let enriched: SourceFetchOutcome;
      try {
        // Coalesce concurrent duplicate requests targeting the exact same sourceId
        let inFlight = activeSourceFetchPromises.get(adapter.sourceId);
        if (!inFlight) {
          inFlight = adapter.fetchJobs(signal).finally(() => {
            activeSourceFetchPromises.delete(adapter.sourceId);
          });
          activeSourceFetchPromises.set(adapter.sourceId, inFlight);
        }
        const outcome = await inFlight;
        const isHealthyFetch =
          outcome.success &&
          outcome.compatibilityStatus !== 'unavailable' &&
          outcome.compatibilityStatus !== 'manual_only';
        const isRateLimited =
          Boolean(outcome.rateLimited) || outcome.httpStatus === 429 || /\b429\b/.test(outcome.error || '');
        const isCaptcha = Boolean(outcome.blockedByCaptcha);
        const isInvalidResp = Boolean(outcome.invalidResponse);
        const failuresCount = isHealthyFetch ? 0 : (prevOut?.consecutiveFailures ?? 0) + 1;

        let derivedStatus: CentralizedSourceStatus = outcome.status || 'SUCCESS';
        let retryPolicy: RetryPolicyKind = outcome.retryPolicy || 'scheduled_interval';
        let nextEligibleCheckAt: number | null = outcome.nextEligibleCheckAt ?? null;

        if (isCaptcha && !outcome.success) {
          derivedStatus = 'MANUAL_VERIFICATION_REQUIRED';
          retryPolicy = 'halted_captcha_manual';
          nextEligibleCheckAt = nextEligibleCheckAt ?? outcome.checkedAt + CAPTCHA_MANUAL_RETRY_INTERVAL_MS;
        } else if (isRateLimited) {
          derivedStatus = 'TEMPORARILY_UNAVAILABLE';
          retryPolicy = 'rate_limit_retry_after';
          const waitMs =
            typeof outcome.retryAfterMs === 'number' && outcome.retryAfterMs > outcome.checkedAt
              ? outcome.retryAfterMs - outcome.checkedAt
              : DEFAULT_RATE_LIMIT_WAIT_MS;
          nextEligibleCheckAt = nextEligibleCheckAt ?? outcome.checkedAt + waitMs;
        } else if (isInvalidResp && !outcome.success) {
          derivedStatus = 'FAILED';
          retryPolicy = 'halted_invalid_response';
          nextEligibleCheckAt = nextEligibleCheckAt ?? outcome.checkedAt + INVALID_RESPONSE_COOLDOWN_MS;
        } else if (!outcome.success || outcome.compatibilityStatus === 'unavailable') {
          derivedStatus = 'FAILED';
          retryPolicy = 'exponential_backoff';
          nextEligibleCheckAt =
            nextEligibleCheckAt ?? outcome.checkedAt + computeExponentialBackoffMs(failuresCount);
        } else if (outcome.compatibilityStatus === 'manual_only') {
          derivedStatus = 'NOT_TESTED';
          retryPolicy = 'none';
          nextEligibleCheckAt = null;
        } else if (outcome.compatibilityStatus === 'partially_supported') {
          derivedStatus = 'PARTIAL_SUCCESS';
          retryPolicy = 'partial_scheduled';
          nextEligibleCheckAt = cooldownMs > 0 ? outcome.checkedAt + cooldownMs : null;
        } else {
          derivedStatus = 'SUCCESS';
          retryPolicy = 'scheduled_interval';
          nextEligibleCheckAt = cooldownMs > 0 ? outcome.checkedAt + cooldownMs : null;
        }

        enriched = {
          ...outcome,
          status: derivedStatus,
          connectionStatus:
            outcome.connectionStatus || deriveSourceConnectionStatus({ ...outcome, status: derivedStatus }),
          httpStatus: outcome.httpStatus ?? null,
          blockedByCaptcha: isCaptcha,
          rateLimited: isRateLimited,
          invalidResponse: isInvalidResp,
          retryAfterMs: outcome.retryAfterMs ?? (isRateLimited || isCaptcha ? nextEligibleCheckAt : null),
          nextEligibleCheckAt,
          consecutiveFailures: failuresCount,
          retryPolicy,
          savedCount: isHealthyFetch ? outcome.savedCount : 0,
          lastSuccessfulFetchAt: isHealthyFetch
            ? outcome.checkedAt
            : prevOut?.lastSuccessfulFetchAt ?? null,
          accessMethodType:
            outcome.accessMethodType ||
            adapter.accessMethodType ||
            (adapter.sourceType === 'discovery_rss' ? 'RSS' : 'HTML'),
          publisherType:
            outcome.publisherType ||
            adapter.publisherType ||
            (adapter.sourceType.startsWith('official') ||
            adapter.sourceType === 'ministry_directory' ||
            adapter.sourceType === 'un_ngo_api'
              ? 'Official'
              : 'Third-Party'),
        };
        console.info(
          `JobFill BD [JobFetcher]: source=${adapter.sourceId} status=${enriched.status} ok=${enriched.success} retrieved=${enriched.jobs.length} elapsedMs=${Date.now() - startMs}`
        );
      } catch (err: any) {
        const errorMsg = err?.message || 'Source fetch error';
        const nowFail = Date.now();
        const failuresCount = (prevOut?.consecutiveFailures ?? 0) + 1;
        const backoffUntil = nowFail + computeExponentialBackoffMs(failuresCount);
        console.warn(`JobFill BD [JobFetcher]: source=${adapter.sourceId} failed error=${errorMsg}`);
        enriched = {
          sourceId: adapter.sourceId,
          sourceName: adapter.sourceName,
          compatibilityStatus: 'unavailable',
          connectionStatus: 'Failed',
          status: 'FAILED',
          accessMethodType: adapter.accessMethodType || 'HTML',
          publisherType: adapter.publisherType || 'Third-Party',
          success: false,
          jobs: [],
          savedCount: 0,
          checkedAt: nowFail,
          lastSuccessfulFetchAt: prevOut?.lastSuccessfulFetchAt ?? null,
          consecutiveFailures: failuresCount,
          nextEligibleCheckAt: backoffUntil,
          retryPolicy: 'exponential_backoff',
          accessNotes: adapter.notes,
          directPortalUrl: adapter.directSourceUrl,
          error: errorMsg,
        };
      }

      results[idx] = enriched;
      completedCount += 1;
      options?.onSourceProgress?.({
        sourceId: adapter.sourceId,
        sourceName: adapter.sourceName,
        phase: enriched.success ? 'completed' : 'failed',
        completedCount,
        totalCount,
        outcome: enriched,
      });
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => runWorker()));
  return results;
}
