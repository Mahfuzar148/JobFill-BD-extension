// JobFill BD - Rate Limit & Network Safety Policy
// Enforces:
// 1. HTTP 429 Retry-After compliance.
// 2. HTTP 403 Access Denied reporting & cooldown.
// 3. CAPTCHA pause — zero automatic retry loops.
// 4. Conditional requests (ETag / If-None-Match, Last-Modified / If-Modified-Since).
// 5. Exponential backoff for transient failures (capped at 6 hours).

import { parseRetryAfterHeaderMs } from './job-fetcher';
import { ChallengeClassification, ChallengeDetectionResult } from './captcha-detector';

export interface SourceRateLimitState {
  sourceId: string;
  lastRequestedAt: number | null;
  lastSucceededAt: number | null;
  consecutiveFailures: number;
  cooldownUntil: number | null;
  etag?: string | null;
  lastModified?: string | null;
  rateLimitRetryAfterMs?: number | null;
  isBlockedByCaptcha?: boolean;
  isBlockedBy403?: boolean;
  lastStatus?: number | null;
}

const rateLimitRegistry = new Map<string, SourceRateLimitState>();

export class RateLimitPolicy {
  public static getState(sourceId: string): SourceRateLimitState {
    let state = rateLimitRegistry.get(sourceId);
    if (!state) {
      state = {
        sourceId,
        lastRequestedAt: null,
        lastSucceededAt: null,
        consecutiveFailures: 0,
        cooldownUntil: null,
      };
      rateLimitRegistry.set(sourceId, state);
    }
    return state;
  }

  /**
   * Determines if a request to the source is permitted right now or blocked by cooldown/Retry-After.
   */
  public static canRequestSource(
    sourceId: string,
    now: number = Date.now(),
    isExplicitManualRetry: boolean = false
  ): {
    allowed: boolean;
    reason?: string;
    cooldownRemainingMs?: number;
  } {
    const state = this.getState(sourceId);

    // If active CAPTCHA block and not an explicit user-initiated manual retry
    if (state.isBlockedByCaptcha && !isExplicitManualRetry) {
      return {
        allowed: false,
        reason: 'Paused by human verification requirement. Complete the challenge on the website, then select Resume.',
      };
    }

    if (state.cooldownUntil && state.cooldownUntil > now) {
      const remainingMs = state.cooldownUntil - now;
      if (state.lastStatus === 429) {
        return {
          allowed: false,
          reason: `Rate limited by server (HTTP 429). Retry permitted in ${Math.ceil(remainingMs / 1000)}s.`,
          cooldownRemainingMs: remainingMs,
        };
      }
      if (!isExplicitManualRetry) {
        return {
          allowed: false,
          reason: `Cooldown active. Next request permitted in ${Math.ceil(remainingMs / 1000)}s.`,
          cooldownRemainingMs: remainingMs,
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Updates state based on the HTTP response and challenge evaluation.
   */
  public static recordResponse(
    sourceId: string,
    status: number,
    headers?: Record<string, string | null | undefined>,
    challenge?: ChallengeDetectionResult,
    now: number = Date.now()
  ): void {
    const state = this.getState(sourceId);
    state.lastRequestedAt = now;
    state.lastStatus = status;

    // A. HTTP 429: Rate Limited
    if (status === 429) {
      state.consecutiveFailures += 1;
      const retryHeader = headers?.['retry-after'];
      const retryAfterMs = parseRetryAfterHeaderMs(retryHeader, now) || 15 * 60 * 1000;
      state.rateLimitRetryAfterMs = retryAfterMs;
      state.cooldownUntil = now + retryAfterMs;
      return;
    }

    // B. Anti-Bot / CAPTCHA Challenge
    if (challenge && challenge.requiresHumanVerification) {
      state.isBlockedByCaptcha = true;
      state.cooldownUntil = now + 60_000; // 60s minimum before checking
      return;
    }

    // C. HTTP 403: Access Denied
    if (status === 403) {
      state.consecutiveFailures += 1;
      state.isBlockedBy403 = true;
      state.cooldownUntil = now + 60 * 60 * 1000; // 1 hour cooldown for 403
      return;
    }

    // D. Success (200 / 304 Not Modified)
    if (status === 200 || status === 304) {
      state.lastSucceededAt = now;
      state.consecutiveFailures = 0;
      state.cooldownUntil = null;
      state.isBlockedByCaptcha = false;
      state.isBlockedBy403 = false;
      state.rateLimitRetryAfterMs = null;

      // Capture conditional request tags
      if (headers?.['etag']) {
        state.etag = headers['etag'];
      }
      if (headers?.['last-modified']) {
        state.lastModified = headers['last-modified'];
      }
      return;
    }

    // E. Other 5xx or transient failures: Exponential backoff
    if (status >= 500 || status === 0) {
      state.consecutiveFailures += 1;
      const backoffMs = Math.min(6 * 60 * 60 * 1000, 60_000 * Math.pow(2, state.consecutiveFailures - 1));
      state.cooldownUntil = now + backoffMs;
    }
  }

  /**
   * Generates conditional headers for bandwidth and cache efficiency.
   */
  public static getConditionalHeaders(sourceId: string): Record<string, string> {
    const state = this.getState(sourceId);
    const headers: Record<string, string> = {};
    if (state.etag) {
      headers['If-None-Match'] = state.etag;
    }
    if (state.lastModified) {
      headers['If-Modified-Since'] = state.lastModified;
    }
    return headers;
  }

  public static resetSource(sourceId: string): void {
    rateLimitRegistry.delete(sourceId);
  }

  public static clearAll(): void {
    rateLimitRegistry.clear();
  }
}
