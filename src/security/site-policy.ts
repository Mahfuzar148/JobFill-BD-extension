// JobFill BD - Strict Origin, Host Exclusion & Least-Privilege Site Policy
// Hard-excludes Google Meet, media streaming/conferencing domains, and internal browser pages
// so JobFill BD NEVER injects scripts, attaches DOM observers, or interferes with WebRTC/media.

export const EXCLUDED_EXACT_OR_SUBDOMAIN_HOSTS = [
  'meet.google.com',
  'hangouts.google.com',
  'talkgadget.google.com',
  'workspace.google.com',
  'zoom.us',
  'zoom.com',
  'youtube.com',
  'studio.youtube.com',
  'music.youtube.com',
  'mail.google.com',
  'docs.google.com',
  'drive.google.com',
  'calendar.google.com',
  'accounts.google.com',
] as const;

export const VIDEO_CONFERENCING_EXACT_OR_SUBDOMAIN_HOSTS = [
  'meet.google.com',
  'hangouts.google.com',
  'talkgadget.google.com',
  'zoom.us',
  'zoom.com',
] as const;

export function extractSafeHostname(rawUrl?: string | null): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  try {
    const parsed = new URL(rawUrl);
    return parsed.hostname.toLowerCase().replace(/\.+$/, '');
  } catch {
    return '';
  }
}

export function matchesExactOrSubdomain(
  rawUrl: string | null | undefined,
  allowedHosts: readonly string[],
): boolean {
  const hostname = extractSafeHostname(rawUrl);
  if (!hostname) return false;
  return allowedHosts.some((target) => hostname === target || hostname.endsWith(`.${target}`));
}

export function isZoomUrl(rawUrl?: string | null): boolean {
  return matchesExactOrSubdomain(rawUrl, ['zoom.us', 'zoom.com']);
}

export function isVideoConferencingUrl(rawUrl?: string | null): boolean {
  return matchesExactOrSubdomain(rawUrl, VIDEO_CONFERENCING_EXACT_OR_SUBDOMAIN_HOSTS);
}

export const SUPPORTED_RECRUITMENT_HOST_SUFFIXES = [
  '.teletalk.com.bd',
  '.gov.bd',
  '.bb.org.bd',
  '.org.bd',
  '.ac.bd',
  '.edu.bd',
  '.bdjobs.com',
] as const;

export const SUPPORTED_RECRUITMENT_EXACT_HOSTS = [
  'teletalk.com.bd',
  'bdjobs.com',
  '127.0.0.1',
  'localhost',
] as const;

function matchesHostOrSubdomain(hostname: string, target: string): boolean {
  return hostname === target || hostname.endsWith(`.${target}`);
}

/**
 * Returns true if the URL is an excluded origin (e.g. Google Meet, YouTube, Gmail)
 * or browser-restricted internal URL where JobFill BD must remain 100% inactive.
 */
export function isDevExtensionTestPageUrl(rawUrl?: string | null): boolean {
  const isStoreClean =
    typeof __JOBFILL_STORE_CLEAN__ !== 'undefined' && Boolean(__JOBFILL_STORE_CLEAN__);
  if (isStoreClean || !rawUrl || typeof rawUrl !== 'string') return false;

  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol !== 'chrome-extension:' || !parsed.pathname.startsWith('/test-pages/')) {
      return false;
    }
    const runtimeId = typeof chrome !== 'undefined' ? chrome.runtime?.id : undefined;
    if (!runtimeId) return false;
    return parsed.hostname.toLowerCase() === runtimeId.toLowerCase();
  } catch {
    return false;
  }
}

export function isExcludedSiteUrl(rawUrl?: string | null): boolean {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  const trimmed = rawUrl.trim();
  const lower = trimmed.toLowerCase();

  if (isDevExtensionTestPageUrl(trimmed)) {
    return false;
  }

  if (
    lower.startsWith('chrome://') ||
    lower.startsWith('chrome-extension://') ||
    lower.startsWith('edge://') ||
    lower.startsWith('devtools://') ||
    lower.startsWith('about:') ||
    lower.includes('chrome.google.com/webstore') ||
    lower.includes('microsoftedge.microsoft.com/addons')
  ) {
    return true;
  }

  try {
    const parsed = new URL(trimmed);
    const hostname = parsed.hostname.toLowerCase();
    return EXCLUDED_EXACT_OR_SUBDOMAIN_HOSTS.some((blocked) =>
      matchesHostOrSubdomain(hostname, blocked)
    );
  } catch {
    return false;
  }
}

/**
 * Returns true strictly for Google Meet and closely related Google Workspace real-time media hosts.
 */
export function isGoogleMeetUrl(rawUrl?: string | null): boolean {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  try {
    const hostname = new URL(rawUrl.trim()).hostname.toLowerCase();
    return (
      matchesHostOrSubdomain(hostname, 'meet.google.com') ||
      matchesHostOrSubdomain(hostname, 'hangouts.google.com') ||
      matchesHostOrSubdomain(hostname, 'talkgadget.google.com')
    );
  } catch {
    return false;
  }
}

/**
 * Returns true if the URL belongs to a supported Bangladesh job portal domain
 * or local test harness origin.
 */
export function isSupportedJobPortalUrl(rawUrl?: string | null): boolean {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  if (isExcludedSiteUrl(rawUrl)) return false;

  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    const hostname = parsed.hostname.toLowerCase();
    if (SUPPORTED_RECRUITMENT_EXACT_HOSTS.includes(hostname as any)) {
      return true;
    }
    return SUPPORTED_RECRUITMENT_HOST_SUFFIXES.some((suffix) =>
      hostname.endsWith(suffix)
    );
  } catch {
    return false;
  }
}

export const SENSITIVE_AUTOFILL_CANONICAL_IDS = [
  'identity.nationalId',
  'identity.birthRegistration',
  'identity.passport',
  'applicant.dob',
  'contact.mobile',
  'contact.confirmMobile',
  'contact.email',
] as const;

export interface HttpAutofillRiskAssessment {
  isInsecureHttp: boolean;
  isLocalDev: boolean;
  hasSensitiveFields: boolean;
  requiresExplicitWarning: boolean;
  warningMessage: string;
}

export function canRequestCustomPortalPermission(rawUrl?: string | null): boolean {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  if (isExcludedSiteUrl(rawUrl)) return false;
  try {
    const parsed = new URL(rawUrl.trim());
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * Assesses whether autofilling sensitive credentials (NID, Birth Reg, Passport, Phone, Email)
 * on an unencrypted http:// origin requires an explicit user warning first.
 * Local development loopback hosts (localhost, 127.0.0.1, ::1) are excluded cleanly.
 */
export function assessHttpSensitiveAutofillRisk(
  rawUrl?: string | null,
  canonicalIds: readonly string[] = []
): HttpAutofillRiskAssessment {
  let isInsecureHttp = false;
  let isLocalDev = false;
  let host = '';
  try {
    if (rawUrl && typeof rawUrl === 'string') {
      const parsed = new URL(rawUrl.trim());
      host = parsed.hostname.toLowerCase();
      isLocalDev = host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1';
      isInsecureHttp = parsed.protocol === 'http:' && !isLocalDev;
    }
  } catch {
    isInsecureHttp = false;
  }

  const hasSensitiveFields = canonicalIds.some((id) =>
    (SENSITIVE_AUTOFILL_CANONICAL_IDS as readonly string[]).includes(id)
  );
  const requiresExplicitWarning = isInsecureHttp && hasSensitiveFields;
  const warningMessage = isInsecureHttp
    ? `Security Notice: ${host || 'This site'} uses unencrypted HTTP (not HTTPS). Sensitive credentials such as NID, Birth Registration, Passport, DOB, or Mobile number could be observed on the network once submitted.`
    : '';

  return {
    isInsecureHttp,
    isLocalDev,
    hasSensitiveFields,
    requiresExplicitWarning,
    warningMessage,
  };
}
