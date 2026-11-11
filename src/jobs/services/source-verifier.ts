// JobFill BD - Source & URL Security Verifier
// Validates URLs before opening, prefers official Bangladesh recruitment domains,
// and detects suspicious external redirects or unsafe URL schemes.

import { NormalizedJobCircular, SourceVerificationStatus } from '../types/job.types';

export interface UrlSecurityCheck {
  isValid: boolean;
  isSafeToOpen: boolean;
  isOfficialDomain: boolean;
  hasSuspiciousRedirect: boolean;
  normalizedUrl: string;
  hostname: string;
  warnings: string[];
}

export const TRUSTED_OFFICIAL_DOMAIN_SUFFIXES = [
  '.gov.bd',
  '.ac.bd',
  '.edu.bd',
  '.org.bd',
  '.teletalk.com.bd',
  'bb.org.bd',
  'erecruitment.bb.org.bd',
  'bpsc.gov.bd',
  'bdjobs.com',
];

const REDIRECT_PARAM_NAMES = ['url', 'redirect', 'redirect_uri', 'next', 'target', 'dest', 'destination', 'goto', 'to', 'r'];

function isIpLiteral(hostname: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || hostname.startsWith('[') || hostname.includes(':');
}

export function isOfficialBangladeshDomain(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  return TRUSTED_OFFICIAL_DOMAIN_SUFFIXES.some(
    (suffix) => lower === suffix.replace(/^\./, '') || lower.endsWith(suffix)
  );
}

export function verifyJobUrl(rawUrl?: string | null, expectedDomain?: string): UrlSecurityCheck {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) {
    return {
      isValid: false,
      isSafeToOpen: false,
      isOfficialDomain: false,
      hasSuspiciousRedirect: false,
      normalizedUrl: '',
      hostname: '',
      warnings: ['Missing URL'],
    };
  }

  // Block dangerous schemes immediately
  if (/^(javascript|data|vbscript|file|blob):/i.test(trimmed)) {
    return {
      isValid: false,
      isSafeToOpen: false,
      isOfficialDomain: false,
      hasSuspiciousRedirect: true,
      normalizedUrl: '',
      hostname: '',
      warnings: ['Blocked unsafe URL scheme'],
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      isValid: false,
      isSafeToOpen: false,
      isOfficialDomain: false,
      hasSuspiciousRedirect: false,
      normalizedUrl: '',
      hostname: '',
      warnings: ['Malformed URL'],
    };
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return {
      isValid: false,
      isSafeToOpen: false,
      isOfficialDomain: false,
      hasSuspiciousRedirect: true,
      normalizedUrl: '',
      hostname: parsed.hostname,
      warnings: [`Unsupported protocol: ${parsed.protocol}`],
    };
  }

  const warnings: string[] = [];
  const hostname = parsed.hostname.toLowerCase();
  const isOfficial = isOfficialBangladeshDomain(hostname);

  if (parsed.protocol === 'http:') {
    warnings.push('Non-HTTPS URL (http://) — verify authenticity before entering personal data.');
  }

  if (isIpLiteral(hostname) || hostname.startsWith('xn--')) {
    warnings.push('Suspicious IP-address or punycode hostname detected.');
  }

  let hasSuspiciousRedirect = false;
  for (const param of REDIRECT_PARAM_NAMES) {
    const val = parsed.searchParams.get(param);
    if (val && /^https?:\/\//i.test(val)) {
      try {
        const target = new URL(val);
        if (target.hostname.toLowerCase() !== hostname && !isOfficialBangladeshDomain(target.hostname)) {
          hasSuspiciousRedirect = true;
          warnings.push(`Suspicious external redirect parameter (${param} -> ${target.hostname})`);
        }
      } catch {
        hasSuspiciousRedirect = true;
        warnings.push(`Malformed redirect query parameter (${param})`);
      }
    }
  }

  if (expectedDomain && !hostname.endsWith(expectedDomain.toLowerCase()) && !isOfficial) {
    warnings.push(`Domain (${hostname}) differs from expected source domain (${expectedDomain}).`);
  }

  const isSafeToOpen =
    (parsed.protocol === 'https:' || parsed.protocol === 'http:') &&
    !isIpLiteral(hostname) &&
    !hasSuspiciousRedirect;

  return {
    isValid: true,
    isSafeToOpen,
    isOfficialDomain: isOfficial,
    hasSuspiciousRedirect,
    normalizedUrl: parsed.toString(),
    hostname,
    warnings,
  };
}

export function getVerificationBadgeMeta(status: SourceVerificationStatus): {
  labelEn: string;
  labelBn: string;
  colorClass: string;
  isOfficial: boolean;
} {
  switch (status) {
    case 'official_verified':
      return {
        labelEn: 'Official Source',
        labelBn: 'অফিশিয়াল সোর্স',
        colorClass: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
        isOfficial: true,
      };
    case 'official_partial':
      return {
        labelEn: 'Details Partially Verified',
        labelBn: 'আংশিক তথ্য যাচাইকৃত',
        colorClass: 'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800',
        isOfficial: true,
      };
    case 'discovery_only':
      return {
        labelEn: 'Unverified Discovery',
        labelBn: 'অযাচাইকৃত ডিসকভারি',
        colorClass: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
        isOfficial: false,
      };
    case 'user_submitted':
      return {
        labelEn: 'Manually Added — Official Source Pending Verification',
        labelBn: 'ম্যানুয়াল এন্ট্রি — অফিশিয়াল যাচাই বাকি',
        colorClass: 'bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800',
        isOfficial: false,
      };
    default:
      return {
        labelEn: 'Details Partially Verified',
        labelBn: 'আংশিক তথ্য যাচাইকৃত',
        colorClass: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
        isOfficial: false,
      };
  }
}

export interface DetailedVerificationBadge {
  key: 'official_source' | 'source_verified' | 'details_partial' | 'unverified_discovery' | 'manual';
  labelEn: string;
  labelBn: string;
  colorClass: string;
}

/**
 * Computes separate field-aware verification statuses so a job is never labeled
 * fully verified solely because its domain is official.
 */
export function getDetailedVerificationBadges(job: NormalizedJobCircular): DetailedVerificationBadge[] {
  const badges: DetailedVerificationBadge[] = [];

  if (job.sourceVerification === 'discovery_only' || job.sourceVerification === 'unverified') {
    badges.push({
      key: 'unverified_discovery',
      labelEn: 'Unverified Discovery',
      labelBn: 'অযাচাইকৃত ডিসকভারি',
      colorClass: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
    });
    return badges;
  }

  const appCheck = verifyJobUrl(job.applicationUrl);
  const circCheck = job.circularUrl ? verifyJobUrl(job.circularUrl) : null;
  const isOfficialSite =
    appCheck.isOfficialDomain ||
    Boolean(circCheck?.isOfficialDomain) ||
    job.sourceVerification === 'official_verified';

  const isIndependentlyVerifiedManual =
    job.sourceVerification === 'user_submitted' &&
    Boolean(
      job.verificationHistory?.some(
        (entry) => entry.action === 'independently_verified'
      )
    );

  // Manual entries are NEVER marked Official Source or Source Verified unless independently verified
  if (job.sourceVerification === 'user_submitted' && !isIndependentlyVerifiedManual) {
    badges.push({
      key: 'manual',
      labelEn: 'Manually Added — Official Source Pending Verification',
      labelBn: 'ম্যানুয়াল এন্ট্রি — অফিশিয়াল যাচাই বাকি',
      colorClass: 'bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800',
    });
    return badges;
  }

  if (isOfficialSite) {
    badges.push({
      key: 'official_source',
      labelEn: 'Official Source',
      labelBn: 'অফিশিয়াল সোর্স',
      colorClass: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
    });
  }

  const hasCoreMetadata = Boolean(job.publishedAt || job.circularUrl);
  const isFullyVerified =
    (job.sourceVerification === 'official_verified' ||
      (job.sourceVerification === 'official_partial' && isOfficialSite) ||
      isIndependentlyVerifiedManual) &&
    job.deadlineVerified &&
    hasCoreMetadata;

  if (isFullyVerified) {
    badges.push({
      key: 'source_verified',
      labelEn: 'Source Verified',
      labelBn: 'উৎস যাচাইকৃত',
      colorClass: 'bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-950/50 dark:text-teal-300 dark:border-teal-800',
    });
  } else {
    badges.push({
      key: 'details_partial',
      labelEn: 'Details Partially Verified',
      labelBn: 'আংশিক তথ্য যাচাইকৃত',
      colorClass: 'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800',
    });
  }

  return badges;
}

/**
 * Prevents raw encoded URLs or long database hashes from leaking into human-facing badges.
 */
export function sanitizeCircularRefForDisplay(raw?: string | null): string | null {
  const val = (raw || '').trim();
  if (!val) return null;
  if (/^https?:\/\//i.test(val) || val.includes('://') || val.includes('%2F') || val.includes('%3A') || val.length > 32) {
    return null;
  }
  return val;
}
