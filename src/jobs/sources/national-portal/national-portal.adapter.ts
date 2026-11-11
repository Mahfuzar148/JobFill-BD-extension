// JobFill BD - Bangladesh National Portal & Ministries/Directorates Adapter
// Aggregates:
// 1. Central Job Announcements: https://bangladesh.gov.bd/pages/job-tender-announcements (strictly category === 'job', excluding 'tender')
// 2. Verified Ministries & Directorates (MOPA, DSHE, DoICT, DME, DTE, DGHS, Cabinet, Finance)
// 3. Public University Notices (University of Dhaka strictly filtered for recruitment)
// Also provides shared pure-JS HTML/XML parsing helpers (MV3 Service Worker safe).

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
import { verifyJobUrl } from '../../services/source-verifier';
import {
  detectApplicationLinksFromDetailHtml,
  enrichSourceItemsFromDetailPages,
} from '../../services/application-link-detector';

export function decodeHtmlEntities(input: string): string {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, dec) => {
      const code = Number(dec);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const code = parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    });
}

export function stripHtmlTags(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractTagText(xmlOrHtml: string, tag: string): string {
  const regex = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = xmlOrHtml.match(regex);
  return m ? decodeHtmlEntities(m[1]).trim() : '';
}

export function extractFirstHref(html: string, baseUrl: string): string | undefined {
  const m = html.match(/href\s*=\s*["']([^"']+)["']/i);
  if (!m) return undefined;
  try {
    return new URL(decodeHtmlEntities(m[1]), baseUrl).toString();
  } catch {
    return undefined;
  }
}

export function extractAllHrefs(html: string, baseUrl: string): string[] {
  const urls: string[] = [];
  const matches = html.matchAll(/href\s*=\s*["']([^"']+)["']/gi);
  for (const m of matches) {
    try {
      urls.push(new URL(decodeHtmlEntities(m[1]), baseUrl).toString());
    } catch {
      // skip invalid href
    }
  }
  return urls;
}

export function extractColumnCell(rowHtml: string, columnName: string): string {
  const re = new RegExp(`<td[^>]*data-column=["']${columnName}["'][^>]*>([\\s\\S]*?)<\\/td>`, 'i');
  const m = rowHtml.match(re);
  return m ? m[1] : '';
}

export function parseBangladeshPortalNoticeTableHtml(
  html: string,
  opts: {
    idPrefix: string;
    organization: string;
    organizationBn?: string;
    baseUrl: string;
    pageUrl: string;
    category?: RawSourceJobItem['category'];
    defaultApplyUrl?: string;
    applyKeywordsPattern?: RegExp;
    recruitmentPattern?: RegExp;
    excludePattern?: RegExp;
    qualificationDetector?: (title: string) => string;
  }
): RawSourceJobItem[] {
  const items: RawSourceJobItem[] = [];
  const tbodyMatch = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
  const scope = tbodyMatch ? tbodyMatch[1] : html;
  const rows = scope.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];

  const recruitmentPattern =
    opts.recruitmentPattern ||
    /নিয়োগ|নিয়োগ|বিজ্ঞপ্তি|সার্কুলার|বিসিএস|bcs|circular|appointment|recruitment|vacancy|পদ|ক্যাডার|নন-ক্যাডার|পরীক্ষা|result|ফলাফল/i;

  for (const row of rows) {
    const titleHtml = extractColumnCell(row, 'title');
    if (!titleHtml) continue;

    const title = stripHtmlTags(titleHtml);
    if (!title || !recruitmentPattern.test(title)) continue;
    if (opts.excludePattern && opts.excludePattern.test(title)) continue;

    const memorialNo = stripHtmlTags(extractColumnCell(row, 'memorial_no'));
    const filesHtml = extractColumnCell(row, 'files');
    const pubDateText = stripHtmlTags(extractColumnCell(row, 'publish_date'));

    const fileLinks = extractAllHrefs(filesHtml, opts.baseUrl);
    const pdfUrl = fileLinks.find((u) => /\.pdf(\?|$)/i.test(u)) || fileLinks[0];
    const allRowHrefs = extractAllHrefs(row, opts.baseUrl);
    const detailLink = allRowHrefs.find((u) => !fileLinks.includes(u) && /\/pages\//i.test(u));
    const circularUrl = pdfUrl || detailLink || undefined;
    const sourceUrl = detailLink || opts.pageUrl;

    const explicitDeadlineMatch = title.match(
      /(?:deadline|last\s*date|শেষ\s*তারিখ)\s*[:：-]?\s*([০-৯0-9]{1,2}[-/.][০-৯0-9]{1,2}[-/.][০-৯0-9]{4})/i
    );

    const rowDetected = detectApplicationLinksFromDetailHtml(row, opts.baseUrl, detailLink || opts.pageUrl);
    const hasExplicitApplyPortal =
      Boolean(opts.defaultApplyUrl) &&
      (!opts.applyKeywordsPattern || opts.applyKeywordsPattern.test(title));
    const applicationUrl =
      rowDetected.applicationUrl || (hasExplicitApplyPortal ? opts.defaultApplyUrl! : null);

    items.push({
      externalId: `${opts.idPrefix}_${memorialNo || pubDateText}_${title.slice(0, 32)}`,
      sourceJobId: `${opts.idPrefix}:${memorialNo || detailLink || title.slice(0, 40)}`,
      organization: opts.organization,
      organizationBn: opts.organizationBn || null,
      jobTitle: title,
      titleBn: /[\u0980-\u09FF]/.test(title) ? title : null,
      position: title,
      circularNumber: memorialNo || undefined,
      category: opts.category || 'Government',
      employmentType: 'Full Time',
      qualification: opts.qualificationDetector ? opts.qualificationDetector(title) : 'Any Qualification',
      location: 'All Bangladesh',
      publishedDateText: pubDateText || undefined,
      deadlineText: explicitDeadlineMatch ? explicitDeadlineMatch[1] : undefined,
      circularUrl,
      organizationUrl: opts.baseUrl,
      sourceUrl,
      applicationUrl,
      description: `Official ${opts.organization} Notice/Circular${memorialNo ? ` (Memo: ${memorialNo})` : ''}. Check official circular/PDF for full details and verified deadline.`,
    });
  }

  return items;
}

/**
 * Parses central Bangladesh National Portal Jobs & Tenders page
 * (https://bangladesh.gov.bd/pages/job-tender-announcements).
 * Strictly filters by category === 'job' and rejects tender entries.
 */
export function parseNationalPortalJobTenderHtml(html: string): RawSourceJobItem[] {
  const items: RawSourceJobItem[] = [];
  const tbodyMatch = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
  const scope = tbodyMatch ? tbodyMatch[1] : html;
  const rows = scope.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];

  for (const row of rows) {
    const title = stripHtmlTags(extractColumnCell(row, 'title'));
    if (!title) continue;

    const categoryRaw = stripHtmlTags(extractColumnCell(row, 'category')).toLowerCase();
    // Must match verified 'job' category metadata and never include tenders
    if (categoryRaw !== 'job' && categoryRaw !== 'চাকরি' && categoryRaw !== 'jobs') {
      continue;
    }
    if (/টেন্ডার|দরপত্র|tender|rfp|eoi|quotation|auction|নিলাম/i.test(title)) {
      continue;
    }

    const filesHtml = extractColumnCell(row, 'files');
    const fileLinks = extractAllHrefs(filesHtml, 'https://bangladesh.gov.bd');
    const attachmentUrl = fileLinks.find((u) => /\.pdf(\?|$)/i.test(u)) || fileLinks[0];
    const allRowHrefs = extractAllHrefs(row, 'https://bangladesh.gov.bd');
    const detailUrl = allRowHrefs.find((u) => u.includes('/pages/job-tender-announcements/'));

    const startDate = stripHtmlTags(extractColumnCell(row, 'start_date'));
    const endDate = stripHtmlTags(extractColumnCell(row, 'end_date'));
    const publishFallback = stripHtmlTags(extractColumnCell(row, 'publish_date'));

    const officialUrl = detailUrl || attachmentUrl || 'https://bangladesh.gov.bd/pages/job-tender-announcements';
    const rowDetected = detectApplicationLinksFromDetailHtml(row, 'https://bangladesh.gov.bd', officialUrl);

    items.push({
      externalId: `natportal_${detailUrl?.split('/').pop()?.slice(-24) || title.slice(0, 28)}`,
      sourceJobId: detailUrl?.split('/').pop() || title.slice(0, 48),
      organization: 'Bangladesh National Portal (বাংলাদেশ জাতীয় তথ্য বাতায়ন)',
      organizationBn: 'বাংলাদেশ জাতীয় তথ্য বাতায়ন',
      jobTitle: title,
      titleBn: /[\u0980-\u09FF]/.test(title) ? title : null,
      position: title,
      category: 'Government',
      employmentType: /ইন্টার্?ন|intern/i.test(title) ? 'Internship' : 'Full Time',
      qualification: 'Any Qualification',
      location: 'All Bangladesh',
      publishedDateText: startDate || publishFallback || undefined,
      applicationStartText: startDate || undefined,
      deadlineText: endDate || undefined,
      circularUrl: attachmentUrl || detailUrl || undefined,
      organizationUrl: 'https://bangladesh.gov.bd',
      sourceUrl: officialUrl,
      applicationUrl: rowDetected.applicationUrl,
      description: `Official announcement published via Bangladesh National Portal. Review attachment & detail page before applying.`,
    });
  }

  return items;
}

export function parseDhakaUniversityNoticeLinks(html: string): RawSourceJobItem[] {
  const items: RawSourceJobItem[] = [];
  const seenHrefs = new Set<string>();
  const matches = html.matchAll(/<a[^>]+href=["']([^"']*du_post_details[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi);

  for (const m of matches) {
    const href = m[1];
    const title = stripHtmlTags(m[2]);
    if (!href || !title || seenHrefs.has(href)) continue;

    if (/ভর্তি|admission|সমাবর্তন|convocation|বাসা|হল|রেজাল্ট|result|syllabus|ফরম\s*পূরণ/i.test(title)) {
      continue;
    }
    if (!/নিয়োগ|নিয়োগ|appointment|lecturer|professor|recruitment|officer|কর্মকর্তা|কর্মচারী/i.test(title)) {
      continue;
    }

    seenHrefs.add(href);
    let normalizedHref = href;
    try {
      normalizedHref = new URL(href, 'https://www.du.ac.bd').toString();
    } catch {
      continue;
    }

    items.push({
      externalId: `du_${normalizedHref.split('/').pop() || title.slice(0, 24)}`,
      sourceJobId: `du_${normalizedHref.split('/').pop() || title.slice(0, 24)}`,
      organization: 'University of Dhaka',
      organizationBn: 'ঢাকা বিশ্ববিদ্যালয়',
      jobTitle: title,
      titleBn: /[\u0980-\u09FF]/.test(title) ? title : null,
      position: title,
      category: 'University',
      employmentType: 'Full Time',
      qualification: /lecturer|professor|প্রভাষক|অধ্যাপক/i.test(title) ? 'Masters' : 'Any Qualification',
      location: 'Dhaka',
      deadlineText: undefined,
      circularUrl: normalizedHref,
      organizationUrl: 'https://www.du.ac.bd',
      sourceUrl: normalizedHref,
      applicationUrl: null,
      description: `Official University of Dhaka notice: ${title}. Open official DU page for details and deadline.`,
    });
  }

  return items;
}

export interface OfficialPortalDirectoryEntry {
  name: string;
  category: 'Government' | 'Autonomous Organization' | 'University' | 'Bank' | 'Defence / Security';
  url: string;
  notes: string;
}

export const OFFICIAL_PORTAL_DIRECTORY: OfficialPortalDirectoryEntry[] = [
  {
    name: 'Bangladesh National Portal (Jobs)',
    category: 'Government',
    url: 'https://bangladesh.gov.bd/pages/job-tender-announcements',
    notes: 'Central official government job announcements table (filtered to exclude tenders).',
  },
  {
    name: 'Teletalk All Jobs Portal',
    category: 'Government',
    url: 'https://alljobs.teletalk.com.bd/',
    notes: 'Central Teletalk government recruitment portal.',
  },
  {
    name: 'Bangladesh Public Service Commission (BPSC)',
    category: 'Government',
    url: 'https://bpsc.gov.bd/pages/notification-circulars',
    notes: 'BCS & Non-Cadre official circulars and notices.',
  },
  {
    name: 'Bangladesh Bank eRecruitment',
    category: 'Bank',
    url: 'https://erecruitment.bb.org.bd/career/jobopportunity.php',
    notes: 'Bangladesh Bank & Bankers Selection Committee circulars.',
  },
  {
    name: 'NTRCA Official Portal',
    category: 'Government',
    url: 'https://ntrca.gov.bd/pages/notices',
    notes: 'Non-Government Teachers Registration & Certification Authority notices.',
  },
  {
    name: 'Directorate of Primary Education (DPE)',
    category: 'Government',
    url: 'https://dpe.gov.bd/pages/notices/',
    notes: 'Primary Assistant Teacher & DPE recruitment circulars.',
  },
  {
    name: 'Ministry of Public Administration (MOPA)',
    category: 'Government',
    url: 'https://mopa.gov.bd/pages/notices',
    notes: 'Government ministry circulars and recruitment notifications.',
  },
  {
    name: 'DSHE (Secondary & Higher Education)',
    category: 'Government',
    url: 'https://dshe.gov.bd/pages/notices',
    notes: 'Directorate of Secondary & Higher Education circulars.',
  },
  {
    name: 'DoICT (Dept. of ICT)',
    category: 'Government',
    url: 'https://doict.gov.bd/pages/notices',
    notes: 'Department of ICT recruitment notices.',
  },
  {
    name: 'DGHS (Health Services)',
    category: 'Government',
    url: 'https://dghs.gov.bd/pages/notices',
    notes: 'Directorate General of Health Services circulars.',
  },
  {
    name: 'DTE (Technical Education)',
    category: 'Government',
    url: 'https://techedu.gov.bd/pages/notices',
    notes: 'Directorate of Technical Education notices.',
  },
  {
    name: 'Finance Division (MOF)',
    category: 'Government',
    url: 'https://mof.gov.bd/pages/notices',
    notes: 'Ministry of Finance notices and circulars.',
  },
  {
    name: 'University of Dhaka (Notices)',
    category: 'University',
    url: 'https://www.du.ac.bd/notice',
    notes: 'Official University of Dhaka notices (filtered for faculty & officer recruitment).',
  },
  {
    name: 'BUET Official Portal',
    category: 'University',
    url: 'https://www.buet.ac.bd/',
    notes: 'Bangladesh University of Engineering and Technology official portal.',
  },
  {
    name: 'PetroBangla (BOGMC)',
    category: 'Autonomous Organization',
    url: 'https://petrobangla.org.bd/',
    notes: 'Autonomous energy sector recruitment notices.',
  },
];

export interface PublicUrlExtractionResult {
  success: boolean;
  uncertain: boolean;
  extracted: Partial<RawSourceJobItem>;
  message: string;
}

export async function inspectPublicCircularUrl(
  publicUrl: string,
  signal?: AbortSignal
): Promise<PublicUrlExtractionResult> {
  const urlCheck = verifyJobUrl(publicUrl);
  if (!urlCheck.isValid || !urlCheck.isSafeToOpen) {
    return {
      success: false,
      uncertain: true,
      extracted: {},
      message: `Unsafe or invalid URL: ${urlCheck.warnings.join(', ')}`,
    };
  }

  const res = await safePublicGet(urlCheck.normalizedUrl, 'text/html,application/xhtml+xml,*/*', signal);
  if (!res.ok) {
    return {
      success: false,
      uncertain: true,
      extracted: {
        circularUrl: urlCheck.normalizedUrl,
        organizationUrl: `https://${urlCheck.hostname}`,
      },
      message: res.blockedReason || 'Could not fetch public page; please fill details manually.',
    };
  }

  const titleTag = extractTagText(res.body, 'title');
  const h1Tag = stripHtmlTags(extractTagText(res.body, 'h1'));
  const plainText = stripHtmlTags(res.body).slice(0, 3000);
  const detected = detectApplicationLinksFromDetailHtml(res.body, urlCheck.normalizedUrl, urlCheck.normalizedUrl);

  const deadlineMatch = plainText.match(
    /(?:application\s*deadline|last\s*date(?:\s*of\s*application)?|closing\s*date|আবেদনের\s*শেষ\s*তারিখ)\s*[:：-]?\s*([০-৯0-9]{1,2}[-/.][০-৯0-9]{1,2}[-/.][০-৯0-9]{4}|[০-৯0-9]{1,2}\s+[A-Za-zঅ-হ]+\s+[০-৯0-9]{4})/i
  );

  const jobTitle = h1Tag || titleTag || '';
  const hostnameOrg = urlCheck.hostname.replace(/^www\./, '');

  return {
    success: true,
    uncertain: !jobTitle || !deadlineMatch,
    extracted: {
      organization: hostnameOrg,
      jobTitle,
      position: jobTitle,
      deadlineText: deadlineMatch ? deadlineMatch[1] : undefined,
      circularUrl: detected.circularPdfUrl || urlCheck.normalizedUrl,
      organizationUrl: detected.organizationUrl || `https://${urlCheck.hostname}`,
      applicationUrl: detected.applicationUrl,
      sourceUrl: urlCheck.normalizedUrl,
      description: plainText.slice(0, 500),
    },
    message: deadlineMatch
      ? 'Extracted partial public metadata. Please review carefully before saving.'
      : 'Page loaded, but verified deadline could not be automatically confirmed. Please review and verify manually.',
  };
}

interface NationalPortalSourceConfig {
  idPrefix: string;
  organization: string;
  organizationBn: string;
  baseUrl: string;
  pages: string[];
}

const VERIFIED_GOVT_PORTALS: NationalPortalSourceConfig[] = [
  {
    idPrefix: 'mopa',
    organization: 'Ministry of Public Administration (MOPA)',
    organizationBn: 'জনপ্রশাসন মন্ত্রণালয়',
    baseUrl: 'https://mopa.gov.bd',
    pages: ['https://mopa.gov.bd/pages/notices', 'https://mopa.gov.bd/pages/notification-circulars'],
  },
  {
    idPrefix: 'dshe',
    organization: 'Directorate of Secondary & Higher Education (DSHE)',
    organizationBn: 'মাধ্যমিক ও উচ্চশিক্ষা অধিদপ্তর (মাউশি)',
    baseUrl: 'https://dshe.gov.bd',
    pages: ['https://dshe.gov.bd/pages/notices'],
  },
  {
    idPrefix: 'doict',
    organization: 'Department of ICT (DoICT)',
    organizationBn: 'তথ্য ও যোগাযোগ প্রযুক্তি অধিদপ্তর',
    baseUrl: 'https://doict.gov.bd',
    pages: ['https://doict.gov.bd/pages/notices'],
  },
  {
    idPrefix: 'dme',
    organization: 'Directorate of Madrasah Education (DME)',
    organizationBn: 'মাদ্রাসা শিক্ষা অধিদপ্তর',
    baseUrl: 'https://dme.gov.bd',
    pages: ['https://dme.gov.bd/pages/notices'],
  },
  {
    idPrefix: 'techedu',
    organization: 'Directorate of Technical Education (DTE)',
    organizationBn: 'কারিগরি শিক্ষা অধিদপ্তর',
    baseUrl: 'https://techedu.gov.bd',
    pages: ['https://techedu.gov.bd/pages/notices'],
  },
  {
    idPrefix: 'dghs',
    organization: 'Directorate General of Health Services (DGHS)',
    organizationBn: 'স্বাস্থ্য অধিদপ্তর',
    baseUrl: 'https://dghs.gov.bd',
    pages: ['https://dghs.gov.bd/pages/notices'],
  },
  {
    idPrefix: 'cabinet',
    organization: 'Cabinet Division',
    organizationBn: 'মন্ত্রিপরিষদ বিভাগ',
    baseUrl: 'https://cabinet.gov.bd',
    pages: ['https://cabinet.gov.bd/pages/notices'],
  },
  {
    idPrefix: 'mof',
    organization: 'Finance Division (Ministry of Finance)',
    organizationBn: 'অর্থ বিভাগ, অর্থ মন্ত্রণালয়',
    baseUrl: 'https://mof.gov.bd',
    pages: ['https://mof.gov.bd/pages/notices'],
  },
];

const NATIONAL_PORTAL_JOBS_URL = 'https://bangladesh.gov.bd/pages/job-tender-announcements';
const DU_NOTICE_URL = 'https://www.du.ac.bd/notice';

export const OfficialWebsiteAdapter: JobSourceAdapter = {
  sourceId: 'official_website',
  sourceName: 'Bangladesh National Portal & Ministries/Universities',
  sourceType: 'ministry_directory',
  officialDomain: 'bangladesh.gov.bd',
  compatibilityStatus: 'supported',
  accessMethodType: 'HTML',
  publisherType: 'Official',
  accessMethod: 'Official National Portal Jobs Table (excluding tenders) + 8 Ministries/Directorates + DU Notices',
  verificationLevel: 'official_verified',
  directSourceUrl: NATIONAL_PORTAL_JOBS_URL,
  notes:
    'Extracts official job announcements (strictly excluding tenders) from bangladesh.gov.bd plus MOPA, DSHE, DoICT, DME, DTE, DGHS, Cabinet, Finance & DU.',

  async fetchJobs(signal?: AbortSignal): Promise<SourceFetchOutcome> {
    const checkedAt = Date.now();
    const strictRecruitmentRegex =
      /নিয়োগ|নিয়োগ|recruitment|job\s*circular|চাকরির?\s*বিজ্ঞপ্তি|সার্কুলার|পদ(?:ে|ের)\s*নিয়োগ|শূন্য\s*পদ/i;

    const portalJobsTask = (async () => {
      const res = await safePublicGet(NATIONAL_PORTAL_JOBS_URL, 'text/html,*/*', signal);
      if (!res.ok) {
        return { host: 'bangladesh.gov.bd', ok: false, status: res.status ?? null, error: res.blockedReason || 'Unreachable', items: [] as RawSourceJobItem[] };
      }
      return { host: 'bangladesh.gov.bd', ok: true, status: res.status ?? 200, error: undefined, items: parseNationalPortalJobTenderHtml(res.body) };
    })();

    const ministryTasks = VERIFIED_GOVT_PORTALS.flatMap((portal) =>
      portal.pages.map(async (pageUrl) => {
        const res = await safePublicGet(pageUrl, 'text/html,*/*', signal);
        if (!res.ok) {
          return { host: portal.idPrefix, ok: false, status: res.status ?? null, error: res.blockedReason || 'Unreachable', items: [] as RawSourceJobItem[] };
        }
        const items = parseBangladeshPortalNoticeTableHtml(res.body, {
          idPrefix: portal.idPrefix,
          organization: portal.organization,
          organizationBn: portal.organizationBn,
          baseUrl: portal.baseUrl,
          pageUrl,
          recruitmentPattern: strictRecruitmentRegex,
        });
        return { host: portal.idPrefix, ok: true, status: res.status ?? 200, error: undefined, items };
      })
    );

    const duTask = (async () => {
      const res = await safePublicGet(DU_NOTICE_URL, 'text/html,*/*', signal);
      if (!res.ok) {
        return { host: 'du.ac.bd', ok: false, status: res.status ?? null, error: res.blockedReason || 'Unreachable', items: [] as RawSourceJobItem[] };
      }
      return { host: 'du.ac.bd', ok: true, status: res.status ?? 200, error: undefined, items: parseDhakaUniversityNoticeLinks(res.body) };
    })();

    const results = await Promise.all([portalJobsTask, ...ministryTasks, duTask]);
    const reachableCount = results.filter((r) => r.ok).length;
    const failedResults = results.filter((r) => !r.ok);
    const failedHosts = failedResults.map((r) => r.host);

    if (reachableCount === 0) {
      const errMsg = failedResults.find((r) => r.error)?.error || 'National Portal & ministry notice pages unreachable.';
      const outcome: SourceFetchOutcome = {
        sourceId: this.sourceId,
        sourceName: this.sourceName,
        compatibilityStatus: 'unavailable',
        accessMethodType: 'HTML',
        publisherType: 'Official',
        success: false,
        jobs: [],
        checkedAt,
        httpStatus: failedResults.find((r) => r.status !== null)?.status ?? null,
        accessNotes: `Could not reach National Portal/ministry notice pages (${errMsg}).`,
        directPortalUrl: this.directSourceUrl,
        error: errMsg,
      };
      outcome.connectionStatus = deriveSourceConnectionStatus(outcome);
      return outcome;
    }

    const rawItems = results.flatMap((r) => r.items);
    await enrichSourceItemsFromDetailPages(rawItems, 'https://bangladesh.gov.bd', undefined, signal, 8);
    const jobs = rawItems.map((raw) => this.parseJob(raw, checkedAt)).filter((j) => this.validateJob(j).isValid);
    const unreachableSuffix =
      failedHosts.length > 0 ? ` Unreachable: ${failedHosts.slice(0, 5).join(', ')}.` : '';
    const partialErrorSummary =
      failedResults.length > 0
        ? failedResults
            .slice(0, 4)
            .map((r) => `${r.host}: ${r.error || 'Unreachable'}`)
            .join('; ')
        : undefined;
    const outcome: SourceFetchOutcome = {
      sourceId: this.sourceId,
      sourceName: this.sourceName,
      compatibilityStatus: reachableCount === results.length ? 'supported' : 'partially_supported',
      accessMethodType: 'HTML',
      publisherType: 'Official',
      success: true,
      jobs,
      checkedAt,
      httpStatus: results.find((r) => r.ok && r.status !== null)?.status ?? null,
      accessNotes: `Fetched ${jobs.length} official job announcement(s) across ${reachableCount}/${results.length} National Portal & ministry/university endpoints.${unreachableSuffix}`,
      directPortalUrl: this.directSourceUrl,
      ...(partialErrorSummary ? { error: partialErrorSummary } : {}),
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

export const NationalPortalAdapter = OfficialWebsiteAdapter;
