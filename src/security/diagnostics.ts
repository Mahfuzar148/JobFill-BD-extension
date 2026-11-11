// JobFill BD — Privacy-Safe Internal Diagnostics (Hostname-Only)
// Records coarse runtime counters and hostname-only events for excluded site guards,
// content script injection gating, DOM observer lifecycle, background checks, and fetch frequency.
// NEVER stores full URLs, URL paths, meeting IDs, query parameters, tokens, or PII.

import { extractSafeHostname } from './site-policy';

export type DiagnosticEventKind =
  | 'excluded_site_detected'
  | 'script_injection_allowed'
  | 'script_injection_blocked'
  | 'observer_started'
  | 'observer_stopped'
  | 'background_task_run'
  | 'api_fetch_call';

export interface PrivacySafeDiagnosticEvent {
  kind: DiagnosticEventKind;
  hostname: string;
  source: string;
  detail?: string;
  timestamp: number;
}

export interface ExtensionDiagnosticCounters {
  excludedSiteDetections: number;
  injectionAllowed: number;
  injectionBlocked: number;
  observerStarts: number;
  observerStops: number;
  backgroundTaskRuns: number;
  apiFetchCalls: number;
}

export interface ExtensionDiagnosticsSnapshot {
  counters: ExtensionDiagnosticCounters;
  recentEvents: PrivacySafeDiagnosticEvent[];
}

const MAX_RECENT_EVENTS = 50;

const counters: ExtensionDiagnosticCounters = {
  excludedSiteDetections: 0,
  injectionAllowed: 0,
  injectionBlocked: 0,
  observerStarts: 0,
  observerStops: 0,
  backgroundTaskRuns: 0,
  apiFetchCalls: 0,
};

const recentEvents: PrivacySafeDiagnosticEvent[] = [];

function sanitizeDetail(detail?: string): string | undefined {
  if (!detail) return undefined;
  // Strip any accidental URL-like paths/queries from free-text diagnostic detail
  return detail.replace(/https?:\/\/[^\s]+/gi, '[redacted-url]').slice(0, 80);
}

export function recordExtensionDiagnostic(
  kind: DiagnosticEventKind,
  options: { url?: string | null; hostname?: string | null; source: string; detail?: string },
): PrivacySafeDiagnosticEvent {
  const hostname =
    extractSafeHostname(options.url) ||
    extractSafeHostname(options.hostname ? `https://${options.hostname}` : null) ||
    'extension-internal';

  switch (kind) {
    case 'excluded_site_detected':
      counters.excludedSiteDetections += 1;
      break;
    case 'script_injection_allowed':
      counters.injectionAllowed += 1;
      break;
    case 'script_injection_blocked':
      counters.injectionBlocked += 1;
      break;
    case 'observer_started':
      counters.observerStarts += 1;
      break;
    case 'observer_stopped':
      counters.observerStops += 1;
      break;
    case 'background_task_run':
      counters.backgroundTaskRuns += 1;
      break;
    case 'api_fetch_call':
      counters.apiFetchCalls += 1;
      break;
  }

  const event: PrivacySafeDiagnosticEvent = {
    kind,
    hostname,
    source: options.source.slice(0, 48),
    detail: sanitizeDetail(options.detail),
    timestamp: Date.now(),
  };

  recentEvents.push(event);
  if (recentEvents.length > MAX_RECENT_EVENTS) {
    recentEvents.splice(0, recentEvents.length - MAX_RECENT_EVENTS);
  }
  return event;
}

export function getExtensionDiagnostics(): ExtensionDiagnosticsSnapshot {
  return {
    counters: { ...counters },
    recentEvents: recentEvents.map((e) => ({ ...e })),
  };
}

export function resetExtensionDiagnostics(): void {
  counters.excludedSiteDetections = 0;
  counters.injectionAllowed = 0;
  counters.injectionBlocked = 0;
  counters.observerStarts = 0;
  counters.observerStops = 0;
  counters.backgroundTaskRuns = 0;
  counters.apiFetchCalls = 0;
  recentEvents.length = 0;
}
