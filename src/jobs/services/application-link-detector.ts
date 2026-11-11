// JobFill BD - Intelligent Application Link Detector & URL Separator
// Strictly distinguishes circular PDFs/notice pages from genuine online application portals,
// extracts real Apply links from HTML detail pages, and migrates mixed legacy records.

import { NormalizedJobCircular } from '../types/job.types';
import { RawSourceJobItem } from '../types/source.types';
import { verifyJobUrl } from './source-verifier';
import { safePublicGet } from './job-fetcher';

export interface ApplicationDestinationClassification {
  isApplicationUrl: boolean;
  isCircularDocument: boolean;
  isNoticePage: boolean;
  isLoginRequired: boolean;
  kind:
    | 'teletalk'
    | 'login_portal'
    | 'online_portal'
    | 'job_board_apply'
    | 'pdf_document'
    | 'notice_page'
    | 'invalid';
  reason: string;
}

export interface DetectedDetailPageLinks {
  applicationUrl: string | null;
  circularPdfUrl?: string;
  organizationUrl?: string;
  matchedAnchorText?: string;
  requiresLogin?: boolean;
}

const DOCUMENT_URL_RE =
  /\.(?:pdf|docx?|xlsx?|pptx?|zip|rar|exe|jpe?g|png|gif)(?:[?#&]|$)|\/showpdf(?:\?|\(|$)|[?&]file=[^&]+\.pdf/i;

const NOTICE_OR_ARTICLE_PATH_RE =
  /^https?:\/\/news\.google\.com\/|\/pages\/(?:notices|notification-circulars|job-tender-announcements)(?:\/|$)|\/du_post_details\/|\/career\/jobopportunity(?:_bscs)?\.php/i;

const APPLICATION_ACTION_ANCHOR_RE =
  /apply\s*now|apply\s*online|online\s*application|online\s*apply|application\s*form|আবেদন\s*করুন|অনলাইন(?:ে)?\s*আবেদন|আবেদন\s*ফরম|সাবমিট\s*করুন/i;

const APPLICATION_PORTAL_URL_RE =
  /teletalk\.com\.bd|erecruitment\.bb\.org\.bd\/onlineapp|mybdjobs\.bdjobs\.com|\/(?:apply|online[-_]?app(?:lication)?|onlineapp|application[-_]?form|applicant|candidate|registration|e-?recruitment)(?:\/|\.php|\.aspx|\?|$)/i;

const LOGIN_GATE_URL_RE =
  /\/(?:login|signin|sign-in|auth|sso|account\/login|candidate\/login|applicant\/login)(?:\/|\.php|\.aspx|\?|$)|erecruitment\.bb\.org\.bd\/onlineapp\/(?:front_|app_)?login|mybdjobs\.bdjobs\.com/i;

const IGNORE_CHROME_URL_RE =
  /facebook\.com|twitter\.com|x\.com|linkedin\.com|youtube\.com|instagram\.com|mailto:|tel:|nvaccess\.org|portal\.gov\.bd\/office\/outauth|javascript:|#$/i;

function decodeBasicEntities(input: string): string {
  return input
    .replace(/&amp;/gi, '&')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}

function stripTags(html: string): string {
  return decodeBasicEntities(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

export function isCircularDocumentUrl(url?: string | null): boolean {
  const trimmed = (url || '').trim();
  if (!trimmed) return false;
  return DOCUMENT_URL_RE.test(trimmed);
}

export function isNoticeOrNewsPageUrl(url?: string | null): boolean {
  const trimmed = (url || '').trim();
  if (!trimmed) return false;
  if (NOTICE_OR_ARTICLE_PATH_RE.test(trimmed)) return true;
  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();
    // Bare alljobs.teletalk.com.bd catalog root without /apply or /jobs/government/<id>/apply
    if (host === 'alljobs.teletalk.com.bd' && !/apply/i.test(parsed.pathname)) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

export function isTeletalkApplicationPortalUrl(url?: string | null): boolean {
  const trimmed = (url || '').trim();
  if (!trimmed || isCircularDocumentUrl(trimmed)) return false;
  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();
    if (!host.endsWith('.teletalk.com.bd')) return false;
    if (host === 'alljobs.teletalk.com.bd') {
      return /apply/i.test(parsed.pathname);
    }
    return true;
  } catch {
    return false;
  }
}

export function classifyApplicationDestination(
  url?: string | null,
  anchorText?: string
): ApplicationDestinationClassification {
  const trimmed = (url || '').trim();
  if (!trimmed) {
    return {
      isApplicationUrl: false,
      isCircularDocument: false,
      isNoticePage: false,
      isLoginRequired: false,
      kind: 'invalid',
      reason: 'Missing application URL',
    };
  }

  const security = verifyJobUrl(trimmed);
  if (!security.isValid || !security.isSafeToOpen) {
    return {
      isApplicationUrl: false,
      isCircularDocument: isCircularDocumentUrl(trimmed),
      isNoticePage: false,
      isLoginRequired: false,
      kind: 'invalid',
      reason: security.warnings[0] || 'Unsafe or invalid URL',
    };
  }

  if (isCircularDocumentUrl(security.normalizedUrl)) {
    return {
      isApplicationUrl: false,
      isCircularDocument: true,
      isNoticePage: false,
      isLoginRequired: false,
      kind: 'pdf_document',
      reason: 'Points to circular PDF or downloadable document',
    };
  }

  if (isTeletalkApplicationPortalUrl(security.normalizedUrl)) {
    return {
      isApplicationUrl: true,
      isCircularDocument: false,
      isNoticePage: false,
      isLoginRequired: false,
      kind: 'teletalk',
      reason: 'Official Teletalk application portal',
    };
  }

  const isLoginRequired =
    LOGIN_GATE_URL_RE.test(security.normalizedUrl) ||
    /login|sign\s*in|লগইন/i.test(anchorText || '');

  if (isLoginRequired) {
    return {
      isApplicationUrl: true,
      isCircularDocument: false,
      isNoticePage: false,
      isLoginRequired: true,
      kind: 'login_portal',
      reason: 'Applicant login / application portal',
    };
  }

  if (isNoticeOrNewsPageUrl(security.normalizedUrl)) {
    return {
      isApplicationUrl: false,
      isCircularDocument: false,
      isNoticePage: true,
      isLoginRequired: false,
      kind: 'notice_page',
      reason: 'Points to notice or news listing page rather than application form',
    };
  }

  if (
    APPLICATION_PORTAL_URL_RE.test(security.normalizedUrl) ||
    (anchorText && APPLICATION_ACTION_ANCHOR_RE.test(anchorText))
  ) {
    return {
      isApplicationUrl: true,
      isCircularDocument: false,
      isNoticePage: false,
      isLoginRequired: false,
      kind: 'online_portal',
      reason: 'Verified online application URL',
    };
  }

  return {
    isApplicationUrl: true,
    isCircularDocument: false,
    isNoticePage: false,
    isLoginRequired: false,
    kind: 'job_board_apply',
    reason: 'Direct HTTP/HTTPS application landing page',
  };
}

/**
 * Inspects a portal detail page or notice HTML block to locate genuine application form links
 * (Apply Now, Apply Online, আবেদন করুন, *.teletalk.com.bd, eRecruitment), ignoring nav/PDF clutter.
 */
export function detectApplicationLinksFromDetailHtml(
  html: string,
  baseUrl: string,
  detailPageUrl?: string
): DetectedDetailPageLinks {
  let organizationUrl: string | undefined;
  try {
    organizationUrl = new URL(baseUrl).origin;
  } catch {
    organizationUrl = undefined;
  }

  // Strip nav/header/footer blocks when scoping body if identifiable, otherwise scan HTML body
  const strippedChrome = html
    .replace(/<header[\s\S]*?<\/header>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ');

  const candidates: Array<{
    url: string;
    score: number;
    anchorText: string;
    requiresLogin: boolean;
  }> = [];

  let firstPdfUrl: string | undefined;
  const anchorMatches = strippedChrome.matchAll(
    /<a[^>]+href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  );

  for (const m of anchorMatches) {
    const rawHref = decodeBasicEntities((m[1] || '').trim());
    if (!rawHref || IGNORE_CHROME_URL_RE.test(rawHref)) continue;

    let absUrl = '';
    try {
      absUrl = new URL(rawHref, baseUrl).toString();
    } catch {
      continue;
    }

    if (detailPageUrl && absUrl.replace(/\/$/, '') === detailPageUrl.replace(/\/$/, '')) {
      continue;
    }

    const sec = verifyJobUrl(absUrl);
    if (!sec.isValid || !sec.isSafeToOpen) continue;

    const anchorText = stripTags(m[2] || '');

    if (isCircularDocumentUrl(sec.normalizedUrl)) {
      if (/\.pdf(\?|$|#)/i.test(sec.normalizedUrl) && !firstPdfUrl) {
        // Ignore payment/user guides on Bangladesh Bank
        if (!/appguidemoti|rocketpreepay|banglaqr/i.test(sec.normalizedUrl)) {
          firstPdfUrl = sec.normalizedUrl;
        }
      }
      continue;
    }

    const cls = classifyApplicationDestination(sec.normalizedUrl, anchorText);
    if (!cls.isApplicationUrl) continue;

    let score = 0;
    if (isTeletalkApplicationPortalUrl(sec.normalizedUrl)) score += 60;
    if (APPLICATION_ACTION_ANCHOR_RE.test(anchorText)) score += 50;
    if (APPLICATION_PORTAL_URL_RE.test(sec.normalizedUrl)) score += 35;
    if (cls.isLoginRequired) score += 20;

    // Require strong application evidence from detail HTML (avoid generic homepage links)
    if (score >= 35) {
      candidates.push({
        url: sec.normalizedUrl,
        score,
        anchorText,
        requiresLogin: cls.isLoginRequired,
      });
    }
  }

  // Also scan plain-text URLs mentioning Teletalk or Apply portals inside body text
  const plainText = stripTags(strippedChrome);
  const urlMatches = plainText.match(/https?:\/\/[a-z0-9.-]+\.[a-z]{2,}(?:\/[^\s<>"')।,]*)?/gi) || [];
  for (const rawTextUrl of urlMatches) {
    const cleaned = rawTextUrl.replace(/[.,;:)।]+$/, '');
    if (IGNORE_CHROME_URL_RE.test(cleaned)) continue;
    const cls = classifyApplicationDestination(cleaned);
    if (!cls.isApplicationUrl) continue;
    if (cls.kind === 'teletalk' || APPLICATION_PORTAL_URL_RE.test(cleaned)) {
      const score = cls.kind === 'teletalk' ? 55 : 35;
      candidates.push({
        url: cleaned,
        score,
        anchorText: 'Text Link',
        requiresLogin: cls.isLoginRequired,
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];

  return {
    applicationUrl: best ? best.url : null,
    circularPdfUrl: firstPdfUrl,
    organizationUrl,
    matchedAnchorText: best?.anchorText,
    requiresLogin: best?.requiresLogin,
  };
}

/**
 * Migrates legacy records where circularUrl or notice URLs were mistakenly stored as applicationUrl.
 * Preserves circularUrl intact, checks alternateSources for any verified application portal,
 * and sets applicationUrl = null when no genuine online application link is available.
 */
export function migrateLegacyCircularRecord(job: NormalizedJobCircular): {
  job: NormalizedJobCircular;
  changed: boolean;
} {
  let changed = false;
  let nextCircularUrl = job.circularUrl;
  let nextOrgUrl = job.organizationUrl;
  let nextAppUrl: string | null = job.applicationUrl || null;

  // Separate Teletalk organization homepage mistakenly placed into circularUrl
  if (
    job.sourceId === 'teletalk' &&
    nextCircularUrl &&
    !isCircularDocumentUrl(nextCircularUrl) &&
    nextCircularUrl !== nextAppUrl &&
    verifyJobUrl(nextCircularUrl).isSafeToOpen &&
    !/notice|circular|pdf|alljobs/i.test(nextCircularUrl)
  ) {
    if (!nextOrgUrl) {
      nextOrgUrl = nextCircularUrl;
    }
    nextCircularUrl = undefined;
    changed = true;
  }

  const appCls = nextAppUrl ? classifyApplicationDestination(nextAppUrl) : null;
  const looksCorruptedPdf = Boolean(appCls && appCls.isCircularDocument);
  const looksNoticePage = Boolean(appCls && appCls.isNoticePage);
  const isBoardApplySource =
    job.sourceId === 'remotive_remote' ||
    job.sourceId === 'remoteok_remote' ||
    job.sourceId === 'arbeitnow_remote' ||
    job.sourceId === 'himalayas_remote' ||
    job.sourceId === 'reliefweb_bd';
  const sameAsCircular =
    !isBoardApplySource &&
    Boolean(nextAppUrl && nextCircularUrl && nextAppUrl.replace(/\/$/, '') === nextCircularUrl.replace(/\/$/, '')) &&
    !isTeletalkApplicationPortalUrl(nextAppUrl) &&
    !(appCls && (appCls.kind === 'online_portal' || appCls.kind === 'login_portal'));

  if (isBoardApplySource && nextCircularUrl && nextAppUrl && nextCircularUrl === nextAppUrl) {
    nextCircularUrl = undefined;
    changed = true;
  }

  if (nextAppUrl && (looksCorruptedPdf || looksNoticePage || sameAsCircular)) {
    if (looksCorruptedPdf && !nextCircularUrl) {
      nextCircularUrl = nextAppUrl;
    }

    // Look for a verified non-PDF application URL from merged alternateSources
    const altApp = (job.alternateSources || []).find((alt) => {
      if (!alt.applicationUrl) return false;
      const altCls = classifyApplicationDestination(alt.applicationUrl);
      return altCls.isApplicationUrl && !altCls.isNoticePage && !altCls.isCircularDocument;
    });

    nextAppUrl = altApp?.applicationUrl || null;
    changed = true;
  }

  if (!changed) {
    return { job, changed: false };
  }

  return {
    job: {
      ...job,
      circularUrl: nextCircularUrl,
      applicationUrl: nextAppUrl,
      organizationUrl: nextOrgUrl,
    },
    changed: true,
  };
}

export function buildApplicationSearchUrl(job: NormalizedJobCircular): string {
  const query = [job.organization, job.position || job.jobTitle, 'online apply application']
    .filter(Boolean)
    .join(' ')
    .slice(0, 140);
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

/**
 * Inspects up to `maxPages` detail HTML pages in bounded concurrency to locate genuine
 * online application links (without letting single detail failures block source extraction).
 */
export async function enrichSourceItemsFromDetailPages(
  items: RawSourceJobItem[],
  baseUrl: string,
  pageUrl?: string,
  signal?: AbortSignal,
  maxPages: number = 8
): Promise<RawSourceJobItem[]> {
  const candidates = items
    .filter(
      (item) =>
        !item.applicationUrl &&
        item.sourceUrl &&
        (!pageUrl || item.sourceUrl.replace(/\/$/, '') !== pageUrl.replace(/\/$/, '')) &&
        !isCircularDocumentUrl(item.sourceUrl) &&
        verifyJobUrl(item.sourceUrl).isSafeToOpen
    )
    .slice(0, maxPages);

  if (candidates.length === 0) return items;

  const CONCURRENCY = 3;
  let cursor = 0;

  const worker = async () => {
    while (cursor < candidates.length) {
      if (signal?.aborted) break;
      const idx = cursor++;
      const item = candidates[idx];
      if (!item?.sourceUrl) continue;
      try {
        const res = await safePublicGet(item.sourceUrl, 'text/html,*/*', signal, 0);
        if (!res.ok || !res.body) continue;
        const effectiveBase = item.organizationUrl || baseUrl;
        const detected = detectApplicationLinksFromDetailHtml(res.body, effectiveBase, item.sourceUrl);
        if (detected.applicationUrl) {
          item.applicationUrl = detected.applicationUrl;
        }
        if (detected.circularPdfUrl && (!item.circularUrl || !isCircularDocumentUrl(item.circularUrl))) {
          item.circularUrl = detected.circularPdfUrl;
        }
      } catch {
        // Detail page inspection failure must never fail the parent source
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, candidates.length) }, () => worker())
  );

  return items;
}
