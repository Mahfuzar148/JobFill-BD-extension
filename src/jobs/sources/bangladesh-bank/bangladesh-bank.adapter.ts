// JobFill BD - Bangladesh Bank & Bankers' Selection Committee (BSC) eRecruitment Adapter
// Inspects official public tables on:
// - https://erecruitment.bb.org.bd/career/jobopportunity.php
// - https://erecruitment.bb.org.bd/onlineapp/joblist.php
// Strictly excludes monetary/banking/financial policy circulars.

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
import { stripHtmlTags, extractFirstHref } from '../national-portal';
import { detectApplicationLinksFromDetailHtml } from '../../services/application-link-detector';

const BB_CAREER_URL = 'https://erecruitment.bb.org.bd/career/jobopportunity.php';
const BB_ONLINEAPP_URL = 'https://erecruitment.bb.org.bd/onlineapp/joblist.php';
const BB_CAREER_BASE = 'https://erecruitment.bb.org.bd/career/';
export const BB_PORTAL_ROOT_URL = 'https://erecruitment.bb.org.bd/';
const BB_HOMEPAGE_URL = 'https://www.bb.org.bd/';

const FINANCIAL_POLICY_EXCLUDE_RE =
  /\b(brpd|fepd|dfim|dos|mpd|feid|smed|gbsd)\s*circular\b|monetary\s*policy|foreign\s*exchange\s*policy|interest\s*rate|treasury\s*bond|repo\s*rate/i;

const BB_OPEN_ADVERTISEMENT_RE = /\b(advertisement|recruitment|job\s*circular|online\s*application)\b/i;
const BB_NON_APPLY_NOTICE_RE =
  /\b(mcq|viva|written|result|seat[-\s]*plan|selected|offer\s*letter|admit|interview|schedule|panel|center|document)\b/i;

export function parseBangladeshBankCareerHtml(html: string): RawSourceJobItem[] {
  const items: RawSourceJobItem[] = [];
  const rowMatches = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];

  for (const row of rowMatches) {
    const cells = row.match(/<td[^>]*>[\s\S]*?<\/td>/gi);
    if (!cells || cells.length < 6) continue;

    const jobId = stripHtmlTags(cells[0]);
    const circularFor = stripHtmlTags(cells[1]);
    const title = stripHtmlTags(cells[2]);
    const detailsHtml = cells[3];
    const publishDate = stripHtmlTags(cells[4]);
    const closeDate = stripHtmlTags(cells[5]);

    if (!title || /no advertised|there are no/i.test(title)) continue;
    if (FINANCIAL_POLICY_EXCLUDE_RE.test(`${circularFor} ${title}`)) continue;

    let pdfUrl = extractFirstHref(detailsHtml, BB_CAREER_BASE);
    if (!pdfUrl) {
      const pdfMatch = detailsHtml.match(/showpdf\(\s*['"]([^'"]+\.pdf)['"]\s*\)/i);
      if (pdfMatch) {
        try {
          pdfUrl = new URL(pdfMatch[1], BB_CAREER_BASE).toString();
        } catch {
          // ignore
        }
      }
    }

    const isSpcbl = /spcbl/i.test(title);
    const org = isSpcbl ? 'Security Printing Corporation (Bangladesh) Ltd. (SPCBL)' : 'Bangladesh Bank (BSC)';
    const combinedHeading = `${circularFor} ${title}`;
    const isActiveApplicationCircular =
      BB_OPEN_ADVERTISEMENT_RE.test(combinedHeading) && !BB_NON_APPLY_NOTICE_RE.test(circularFor);

    items.push({
      externalId: `bb_career_${jobId.replace(/\s+/g, '_').slice(0, 20)}_${publishDate}_${title.slice(0, 24)}`,
      sourceJobId: jobId || `career_${publishDate}_${title.slice(0, 20)}`,
      organization: org,
      organizationBn: isSpcbl ? null : 'বাংলাদেশ ব্যাংক (ব্যাংকার্স সিলেকশন কমিটি)',
      jobTitle: circularFor ? `[${circularFor}] ${title}` : title,
      position: title,
      circularNumber: jobId ? `BB Job ID: ${jobId}` : undefined,
      category: 'Bank',
      employmentType: 'Full Time',
      location: 'Dhaka',
      publishedDateText: publishDate,
      deadlineText: closeDate,
      circularUrl: pdfUrl || undefined,
      organizationUrl: BB_HOMEPAGE_URL,
      sourceUrl: BB_CAREER_URL,
      applicationUrl: isActiveApplicationCircular ? BB_ONLINEAPP_URL : null,
      description: `${circularFor ? `Notice Type: ${circularFor}. ` : ''}${title}`,
    });
  }

  return items;
}

export function parseBangladeshBankOnlineAppHtml(html: string): RawSourceJobItem[] {
  const items: RawSourceJobItem[] = [];
  const rowMatches = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];

  for (const row of rowMatches) {
    const cells = row.match(/<td[^>]*>[\s\S]*?<\/td>/gi);
    if (!cells || cells.length < 8) continue;

    const jobId = stripHtmlTags(cells[0]);
    const position = stripHtmlTags(cells[1]);
    const vacanciesText = stripHtmlTags(cells[2]);
    const salary = stripHtmlTags(cells[3]);
    const ageReq = stripHtmlTags(cells[4]);
    const education = stripHtmlTags(cells[5]);
    const fee = stripHtmlTags(cells[6]);
    const deadline = stripHtmlTags(cells[7]);

    if (!position || /no advertised|there are no/i.test(position)) continue;
    if (FINANCIAL_POLICY_EXCLUDE_RE.test(position)) continue;

    const parsedVacancies = parseInt(vacanciesText.replace(/[^\d]/g, ''), 10);
    const rowLinks = detectApplicationLinksFromDetailHtml(row, BB_ONLINEAPP_URL, BB_ONLINEAPP_URL);

    items.push({
      externalId: `bb_apply_${jobId}`,
      sourceJobId: jobId || position.slice(0, 30),
      organization: 'Bangladesh Bank',
      organizationBn: 'বাংলাদেশ ব্যাংক',
      jobTitle: position,
      position,
      circularNumber: `BB Job ID: ${jobId}`,
      category: 'Bank',
      employmentType: 'Full Time',
      vacancies: Number.isFinite(parsedVacancies) && parsedVacancies > 0 ? parsedVacancies : null,
      salary: salary || undefined,
      ageRequirement: ageReq || undefined,
      qualification: education || 'Bachelor',
      applicationFee: fee || undefined,
      location: 'All Bangladesh',
      deadlineText: deadline,
      circularUrl: rowLinks.circularPdfUrl || undefined,
      organizationUrl: BB_HOMEPAGE_URL,
      sourceUrl: BB_ONLINEAPP_URL,
      applicationUrl: rowLinks.applicationUrl || BB_ONLINEAPP_URL,
      description: `Official Bangladesh Bank eRecruitment opening for ${position}.`,
    });
  }

  return items;
}

export const BangladeshBankAdapter: JobSourceAdapter = {
  sourceId: 'bangladesh_bank',
  sourceName: 'Bangladesh Bank Recruitment',
  sourceType: 'official_bank',
  officialDomain: 'erecruitment.bb.org.bd',
  compatibilityStatus: 'supported',
  accessMethodType: 'HTML',
  publisherType: 'Official',
  accessMethod: 'Official eRecruitment HTML tables (erecruitment.bb.org.bd)',
  verificationLevel: 'official_verified',
  directSourceUrl: BB_CAREER_URL,
  minPollCooldownMs: 6 * 60 * 60 * 1000,
  complianceNotes: 'robots.txt declares Disallow: / — automated background polling is cooldown-throttled; inspect directly via Official Portals when unavailable.',
  notes:
    'Parses official Bangladesh Bank & Bankers Selection Committee eRecruitment tables with verified publish/close dates (excludes banking policy circulars).',

  /**
   * Fetch public recruitment notices from Bangladesh Bank eRecruitment portal.
   *
   * Future API/RSS note: Bangladesh Bank currently exposes only HTML pages behind
   * WAF/anti-bot protection (/tspd/ challenge) with no documented public JSON API
   * or RSS feed. If an official open API/RSS endpoint becomes available, switch to
   * that endpoint instead of HTML fetching.
   */
  async fetchJobs(signal?: AbortSignal): Promise<SourceFetchOutcome> {
    const checkedAt = Date.now();
    // Pass 0 retries so anti-bot/CAPTCHA challenge endpoints are never hammered repeatedly.
    const [onlineRes, careerRes] = await Promise.all([
      safePublicGet(BB_ONLINEAPP_URL, 'text/html,*/*', signal, 0),
      safePublicGet(BB_CAREER_URL, 'text/html,*/*', signal, 0),
    ]);

    const blockedByCaptcha = Boolean(onlineRes.blockedByCaptcha || careerRes.blockedByCaptcha);
    const httpStatus =
      (onlineRes.blockedByCaptcha ? onlineRes.status : undefined) ??
      (careerRes.blockedByCaptcha ? careerRes.status : undefined) ??
      onlineRes.status ??
      careerRes.status ??
      null;

    const rawItems: RawSourceJobItem[] = [
      ...(onlineRes.ok && !onlineRes.blockedByCaptcha ? parseBangladeshBankOnlineAppHtml(onlineRes.body) : []),
      ...(careerRes.ok && !careerRes.blockedByCaptcha ? parseBangladeshBankCareerHtml(careerRes.body) : []),
    ];

    const jobs = rawItems.map((raw) => this.parseJob(raw, checkedAt)).filter((j) => this.validateJob(j).isValid);

    if ((!onlineRes.ok && !careerRes.ok) || (blockedByCaptcha && jobs.length === 0)) {
      const errMsg =
        (onlineRes.blockedByCaptcha ? onlineRes.blockedReason : undefined) ||
        (careerRes.blockedByCaptcha ? careerRes.blockedReason : undefined) ||
        onlineRes.blockedReason ||
        careerRes.blockedReason ||
        'Bangladesh Bank portal unreachable.';
      const outcome: SourceFetchOutcome = {
        sourceId: this.sourceId,
        sourceName: this.sourceName,
        compatibilityStatus: 'unavailable',
        status: blockedByCaptcha ? 'MANUAL_VERIFICATION_REQUIRED' : 'FAILED',
        accessMethodType: 'HTML',
        publisherType: 'Official',
        success: false,
        jobs: [],
        checkedAt,
        httpStatus,
        blockedByCaptcha,
        retryAfterMs: blockedByCaptcha ? checkedAt + 60_000 : null,
        nextEligibleCheckAt: blockedByCaptcha ? checkedAt + 60_000 : null,
        retryPolicy: blockedByCaptcha ? 'halted_captcha_manual' : 'exponential_backoff',
        dataCoverageNote: blockedByCaptcha
          ? 'Automatic fetch paused due to portal CAPTCHA protection and robots.txt Disallow: /. Open portal directly or add verified circulars manually.'
          : undefined,
        accessNotes: blockedByCaptcha
          ? `${errMsg} Automatic extraction stopped per policy; manual verification required via official portal.`
          : errMsg,
        directPortalUrl: this.directSourceUrl,
        openPortalUrl: BB_PORTAL_ROOT_URL,
        error: errMsg,
      };
      outcome.connectionStatus = deriveSourceConnectionStatus(outcome);
      return outcome;
    }

    if (blockedByCaptcha && jobs.length > 0) {
      const partialErr =
        (onlineRes.blockedByCaptcha ? onlineRes.blockedReason : undefined) ||
        (careerRes.blockedByCaptcha ? careerRes.blockedReason : undefined) ||
        'One Bangladesh Bank endpoint returned an anti-bot/CAPTCHA challenge page.';
      const outcome: SourceFetchOutcome = {
        sourceId: this.sourceId,
        sourceName: this.sourceName,
        compatibilityStatus: 'partially_supported',
        status: 'PARTIAL_SUCCESS',
        accessMethodType: 'HTML',
        publisherType: 'Official',
        success: true,
        jobs,
        checkedAt,
        httpStatus,
        blockedByCaptcha: true,
        retryAfterMs: checkedAt + 60_000,
        nextEligibleCheckAt: checkedAt + 60_000,
        retryPolicy: 'halted_captcha_manual',
        accessNotes: `Fetched ${jobs.length} entries; secondary endpoint blocked by CAPTCHA (${partialErr}).`,
        directPortalUrl: this.directSourceUrl,
        openPortalUrl: BB_PORTAL_ROOT_URL,
        error: partialErr,
      };
      outcome.connectionStatus = deriveSourceConnectionStatus(outcome);
      return outcome;
    }

    const outcome: SourceFetchOutcome = {
      sourceId: this.sourceId,
      sourceName: this.sourceName,
      compatibilityStatus: onlineRes.ok && careerRes.ok ? 'supported' : 'partially_supported',
      status: onlineRes.ok && careerRes.ok ? 'SUCCESS' : 'PARTIAL_SUCCESS',
      accessMethodType: 'HTML',
      publisherType: 'Official',
      success: true,
      jobs,
      checkedAt,
      httpStatus,
      blockedByCaptcha: false,
      retryAfterMs: null,
      nextEligibleCheckAt: checkedAt + 6 * 60 * 60 * 1000,
      retryPolicy: 'scheduled_interval',
      accessNotes: `Fetched ${jobs.length} verified Bangladesh Bank / BSC recruitment entries.`,
      directPortalUrl: this.directSourceUrl,
      openPortalUrl: BB_PORTAL_ROOT_URL,
      ...(onlineRes.blockedReason || careerRes.blockedReason
        ? { error: onlineRes.blockedReason || careerRes.blockedReason }
        : {}),
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
