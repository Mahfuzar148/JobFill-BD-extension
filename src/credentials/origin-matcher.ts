// JobFill BD - Strict Origin Matcher for Local Credential Vault
// Guarantees exact HTTPS origin equality and blocks HTTP, lookalike domains,
// subdomains, credentialed URLs, and substring matches.

export interface OriginMatchResult {
  matched: boolean;
  savedOrigin: string | null;
  pageOrigin: string | null;
  reason: string;
}

/**
 * Validates and normalizes an HTTPS website URL to its strict origin (`https://host[:port]`).
 * Returns null for HTTP, malformed URLs, non-HTTPS protocols, or URLs containing embedded auth.
 */
export function normalizeStrictOrigin(rawUrl?: string | null): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  try {
    const candidate = trimmed.includes('://') ? trimmed : `https://${trimmed}`;
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'https:') return null;
    if (parsed.username || parsed.password) return null;
    if (!parsed.hostname || parsed.hostname.includes('..') || parsed.hostname.startsWith('xn--')) {
      // Punycode IDNs rejected by default to protect users from homograph lookalike attacks
      return null;
    }
    return parsed.origin.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Requires an already-established full URL (no implicit scheme upgrade) and enforces exact HTTPS origin matching.
 */
export function normalizeActivePageHttpsOrigin(rawPageUrl?: string | null): string | null {
  if (!rawPageUrl || typeof rawPageUrl !== 'string') return null;
  try {
    const parsed = new URL(rawPageUrl.trim());
    if (parsed.protocol !== 'https:') return null;
    if (parsed.username || parsed.password) return null;
    if (!parsed.hostname || parsed.hostname.startsWith('xn--')) return null;
    return parsed.origin.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Strict equality check between a credential's stored HTTPS origin and the active browser page URL.
 * Rejects HTTP pages cleanly and never allows parent/child subdomain bleed unless exact origin matches.
 */
export function isStrictOriginMatch(savedUrlOrOrigin: string, activePageUrl: string): OriginMatchResult {
  const savedOrigin = normalizeStrictOrigin(savedUrlOrOrigin);
  if (!savedOrigin) {
    return {
      matched: false,
      savedOrigin: null,
      pageOrigin: null,
      reason: 'Saved credential does not have a valid HTTPS origin.',
    };
  }

  let rawProtocol = '';
  try {
    rawProtocol = new URL(activePageUrl.trim()).protocol;
  } catch {
    rawProtocol = '';
  }

  if (rawProtocol === 'http:') {
    return {
      matched: false,
      savedOrigin,
      pageOrigin: null,
      reason: 'Credential autofill is disabled on unencrypted HTTP websites.',
    };
  }

  const pageOrigin = normalizeActivePageHttpsOrigin(activePageUrl);
  if (!pageOrigin) {
    return {
      matched: false,
      savedOrigin,
      pageOrigin: null,
      reason: 'Active page does not have a valid HTTPS origin.',
    };
  }

  if (savedOrigin !== pageOrigin) {
    return {
      matched: false,
      savedOrigin,
      pageOrigin,
      reason: `Strict origin mismatch (${pageOrigin} != ${savedOrigin}).`,
    };
  }

  return {
    matched: true,
    savedOrigin,
    pageOrigin,
    reason: 'Exact HTTPS origin verified.',
  };
}
