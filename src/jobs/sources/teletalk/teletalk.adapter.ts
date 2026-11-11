// JobFill BD - Teletalk All Jobs Hybrid Adapter
// Endpoint: GET https://alljobs.teletalk.com.bd/api/v1/published-jobs/search?searchKeyword=&page=N
// Investigated live: returns HTTP 200 JSON under `govtJobs` with `access-control-allow-origin: *` and no auth.
// Caveat: Community-discovered SPA JSON endpoint (not formally documented as permanent),
// so verificationLevel is `official_partial` with automatic portal HTML fallback.

import {
  JobSourceAdapter,
  RawSourceJobItem,
  SourceFetchOutcome,
  deriveSourceConnectionStatus,
} from '../../types/source.types';
import { NormalizedJobCircular, GovtOrganizationRecord } from '../../types/job.types';
import { safePublicGet } from '../../services/job-fetcher';
import { normalizeJobRecord } from '../../services/job-normalizer';
import { validateJobCircular } from '../../services/job-validator';
import { verifyJobUrl } from '../../services/source-verifier';
import { classifyApplicationDestination } from '../../services/application-link-detector';

const TELETALK_ALLJOBS_URL = 'https://alljobs.teletalk.com.bd/';
const TELETALK_GOVT_PORTAL_URL = 'https://alljobs.teletalk.com.bd/jobs/government';
const TELETALK_SEARCH_API_BASE = 'https://alljobs.teletalk.com.bd/api/v1/published-jobs/search';
const TELETALK_ORG_LIST_API_BASE = 'https://alljobs.teletalk.com.bd/api/v1/govt-jobs/org-list';
const TELETALK_GOVT_LIST_API_BASE = 'https://alljobs.teletalk.com.bd/api/v1/govt-jobs/list';
const TELETALK_MEDIA_BASE = 'https://alljobs.teletalk.com.bd/media/';
const MAX_TELETALK_PAGES = 25;

export interface TeletalkPublishedJob {
  job_primary_id?: number;
  job_id?: string;
  job_title?: string;
  job_title_bn?: string | null;
  job_type?: number;
  vacancy?: string | number | null;
  vacancy_not_specific?: boolean;
  application_site_url?: string | null;
  published_date?: string | null;
  deadline_date?: string | null;
  status?: number;
  created_at?: string | null;
  organization_id?: number;
  category_id?: number;
  recruiter_id?: number;
  job_location?: string | null;
  salary?: number | string | null;
  org_name?: string | null;
  org_name_bn?: string | null;
  short_name?: string | null;
  logo?: string | null;
  website?: string | null;
  short_code?: string | null;
  industry_type_id?: number | null;
  industry_title?: string | null;
}

export interface TeletalkParsedResponse {
  ok: boolean;
  totalCount: number;
  items: RawSourceJobItem[];
}

function resolveValidHttpUrl(raw?: string | null): string | undefined {
  const trimmed = (raw || '').trim();
  if (!trimmed) return undefined;
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const check = verifyJobUrl(candidate);
  return check.isValid && check.isSafeToOpen ? check.normalizedUrl : undefined;
}

function resolveTeletalkLogo(rawLogo?: string | null): string | undefined {
  const cleaned = (rawLogo || '').trim().replace(/^\/+/, '');
  if (!cleaned) return undefined;
  if (/^https?:\/\//i.test(cleaned)) return cleaned;
  return `${TELETALK_MEDIA_BASE}${cleaned}`;
}

export function parseTeletalkPublishedJobsJson(jsonText: string): TeletalkParsedResponse {
  let parsed: any;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return { ok: false, totalCount: 0, items: [] };
  }

  if (!parsed || !Array.isArray(parsed.govtJobs)) {
    return { ok: false, totalCount: 0, items: [] };
  }

  const totalCount = Number(parsed.count) || parsed.govtJobs.length;
  const items: RawSourceJobItem[] = [];

  for (const j of parsed.govtJobs as TeletalkPublishedJob[]) {
    const titleEn = (j.job_title || '').trim();
    const titleBn = (j.job_title_bn || '').trim();
    const position = titleEn || titleBn;
    const orgEn = (j.org_name || '').trim();
    const orgBn = (j.org_name_bn || '').trim();
    const organization =
      orgEn && orgBn && orgEn !== orgBn
        ? `${orgEn} (${orgBn})`
        : orgEn || orgBn || (j.short_name || '').trim() || 'Teletalk Bangladesh Employer';

    if (!position) continue;

    const jobCode = (j.job_id || (j.job_primary_id ? `GJOB${j.job_primary_id}` : '')).trim();
    const candidateAppUrl = resolveValidHttpUrl(j.application_site_url);
    const appCls = candidateAppUrl ? classifyApplicationDestination(candidateAppUrl) : null;
    const appUrl = appCls && appCls.isApplicationUrl && !appCls.isCircularDocument ? candidateAppUrl! : null;
    const websiteUrl = resolveValidHttpUrl(j.website);

    const vacancyNum =
      j.vacancy_not_specific === true ? null : parseInt(String(j.vacancy ?? '').replace(/[^\d]/g, ''), 10);
    const vacancies = Number.isFinite(vacancyNum) && (vacancyNum as number) > 0 ? (vacancyNum as number) : null;

    const numericSalary = typeof j.salary === 'number' ? j.salary : Number(j.salary);
    const salary =
      Number.isFinite(numericSalary) && numericSalary > 0
        ? `${numericSalary} BDT`
        : typeof j.salary === 'string' && j.salary.trim() && j.salary.trim() !== '0'
          ? j.salary.trim()
          : undefined;

    const combinedTitle =
      titleEn && titleBn && titleEn !== titleBn ? `${titleEn} — ${titleBn}` : position;

    const shortName = (j.short_name || j.short_code || '').trim() || undefined;
    items.push({
      externalId: jobCode ? `teletalk_${jobCode}` : `teletalk_${j.job_primary_id || position.slice(0, 24)}`,
      sourceJobId: jobCode || (j.job_primary_id ? String(j.job_primary_id) : null),
      organizationId: typeof j.organization_id === 'number' ? j.organization_id : undefined,
      organizationShortName: shortName,
      organization,
      organizationBn: orgBn || null,
      organizationLogo: resolveTeletalkLogo(j.logo),
      jobTitle: combinedTitle,
      titleBn: titleBn || null,
      position,
      circularNumber: jobCode || undefined,
      category: 'Government',
      employmentType: 'Full Time',
      vacancies,
      salary,
      qualification: 'Any Qualification',
      location: (j.job_location || '').trim() || 'All Bangladesh',
      publishedDateText: j.published_date || j.created_at || undefined,
      applicationStartText: j.published_date || j.created_at || undefined,
      deadlineText: j.deadline_date || undefined,
      circularUrl: undefined,
      organizationUrl: websiteUrl,
      sourceUrl:
        typeof j.organization_id === 'number'
          ? `${TELETALK_GOVT_PORTAL_URL}/${j.organization_id}`
          : websiteUrl || TELETALK_ALLJOBS_URL,
      applicationUrl: appUrl,
      description: `Teletalk AllJobs circular (${jobCode || 'Govt Job'}) for ${organization}. Verify official eligibility & PDF details on ${appUrl || websiteUrl || TELETALK_ALLJOBS_URL}.`,
      rawPayload: {
        job_primary_id: j.job_primary_id,
        job_id: jobCode,
        organization_id: j.organization_id,
        short_name: shortName,
        status: j.status,
      },
    });
  }

  return { ok: true, totalCount, items };
}

export interface TeletalkOrgApiEntry {
  id?: number;
  name?: string | null;
  name_bn?: string | null;
  short_name?: string | null;
  logo?: string | null;
  website?: string | null;
  govt_jobs?: Array<{ id?: number; job_title?: string; job_title_bn?: string | null }>;
}

export function parseTeletalkGovtOrgListJson(jsonText: string): {
  ok: boolean;
  totalCount: number;
  orgs: Array<TeletalkOrgApiEntry>;
} {
  let parsed: any;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return { ok: false, totalCount: 0, orgs: [] };
  }
  if (!parsed || !Array.isArray(parsed.govtOrgJobs)) {
    return { ok: false, totalCount: 0, orgs: [] };
  }
  return {
    ok: true,
    totalCount: Number(parsed.count) || parsed.govtOrgJobs.length,
    orgs: parsed.govtOrgJobs,
  };
}

export function parseTeletalkGovtJobsListJson(jsonText: string): TeletalkParsedResponse {
  let parsed: any;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return { ok: false, totalCount: 0, items: [] };
  }
  if (!parsed || !Array.isArray(parsed.govtJobs)) {
    return { ok: false, totalCount: 0, items: [] };
  }

  const mappedRows: TeletalkPublishedJob[] = (parsed.govtJobs as any[]).map((row) => {
    const orgMeta = row.job_utilities_govtorganization || {};
    return {
      job_primary_id: row.id ?? row.job_primary_id,
      job_id: row.job_id,
      job_title: row.job_title,
      job_title_bn: row.job_title_bn,
      vacancy: row.vacancy,
      vacancy_not_specific: row.vacancy_not_specific,
      application_site_url: row.application_site || row.application_site_url,
      published_date: row.published_date,
      deadline_date: row.deadline_date,
      created_at: row.created_at,
      organization_id: row.organization_id ?? orgMeta.id,
      org_name: orgMeta.name ?? row.org_name,
      org_name_bn: orgMeta.name_bn ?? row.org_name_bn,
      short_name: orgMeta.short_name ?? row.short_name,
      logo: orgMeta.logo ?? row.logo,
      website: orgMeta.website ?? row.website,
      status: 5,
    };
  });

  return parseTeletalkPublishedJobsJson(
    JSON.stringify({
      count: parsed.count || mappedRows.length,
      govtJobs: mappedRows,
    })
  );
}

export function buildGovtOrganizationsFromJobs(
  jobs: NormalizedJobCircular[],
  now: number = Date.now()
): GovtOrganizationRecord[] {
  const byOrg = new Map<number, GovtOrganizationRecord>();
  for (const job of jobs) {
    if (job.sourceId !== 'teletalk') continue;
    const orgId = typeof job.organizationId === 'number' ? job.organizationId : undefined;
    if (!orgId) continue;

    let rec = byOrg.get(orgId);
    if (!rec) {
      rec = {
        organizationId: orgId,
        name: job.organization,
        nameBn: job.organizationBn || null,
        shortName: job.organizationShortName || `ORG-${orgId}`,
        shortCode: job.organizationShortName || null,
        logoUrl: job.organizationLogo,
        website: job.organizationUrl,
        openingCount: 0,
        expiredCount: 0,
        sourceId: 'teletalk',
        sourceUrl: `${TELETALK_GOVT_PORTAL_URL}/${orgId}`,
        lastUpdatedAt: now,
      };
      byOrg.set(orgId, rec);
    }
    if (job.status === 'expired' || (job.deadlineVerified && typeof job.deadlineAt === 'number' && job.deadlineAt <= now)) {
      rec.expiredCount += 1;
    } else {
      rec.openingCount += 1;
    }
    if (!rec.logoUrl && job.organizationLogo) rec.logoUrl = job.organizationLogo;
  }

  return Array.from(byOrg.values()).sort((a, b) => b.openingCount - a.openingCount || a.name.localeCompare(b.name));
}

export async function fetchTeletalkGovtOrganizations(
  jobs: NormalizedJobCircular[] = [],
  signal?: AbortSignal
): Promise<{
  ok: boolean;
  organizations: GovtOrganizationRecord[];
  error?: string;
}> {
  const checkedAt = Date.now();
  const page1Res = await safePublicGet(`${TELETALK_ORG_LIST_API_BASE}?page=1&limit=20`, 'application/json,text/plain,*/*', signal);
  const parsed1 = page1Res.ok ? parseTeletalkGovtOrgListJson(page1Res.body) : { ok: false, totalCount: 0, orgs: [] };

  const jobsByOrgId = new Map<number, NormalizedJobCircular[]>();
  for (const job of jobs) {
    if (typeof job.organizationId === 'number') {
      const arr = jobsByOrgId.get(job.organizationId) || [];
      arr.push(job);
      jobsByOrgId.set(job.organizationId, arr);
    }
  }

  if (parsed1.ok) {
    const rawOrgs = [...parsed1.orgs];
    const totalPages = Math.min(10, Math.max(1, Math.ceil(parsed1.totalCount / 20)));
    for (let p = 2; p <= totalPages; p++) {
      if (signal?.aborted) break;
      const nextRes = await safePublicGet(`${TELETALK_ORG_LIST_API_BASE}?page=${p}&limit=20`, 'application/json,text/plain,*/*', signal);
      if (!nextRes.ok) break;
      const parsedNext = parseTeletalkGovtOrgListJson(nextRes.body);
      if (!parsedNext.ok || parsedNext.orgs.length === 0) break;
      rawOrgs.push(...parsedNext.orgs);
    }

    const byId = new Map<number, GovtOrganizationRecord>();
    for (const o of rawOrgs) {
      if (typeof o.id !== 'number' || !o.name) continue;
      const matchedJobs = jobsByOrgId.get(o.id) || [];
      const activeJobsCount =
        matchedJobs.length > 0
          ? matchedJobs.filter(
              (j) =>
                j.status !== 'expired' &&
                !(j.deadlineVerified && typeof j.deadlineAt === 'number' && j.deadlineAt <= checkedAt)
            ).length
          : Array.isArray(o.govt_jobs)
            ? o.govt_jobs.length
            : 0;
      const expiredJobsCount =
        matchedJobs.length > 0
          ? matchedJobs.filter(
              (j) =>
                j.status === 'expired' ||
                (j.deadlineVerified && typeof j.deadlineAt === 'number' && j.deadlineAt <= checkedAt)
            ).length
          : 0;

      const shortName = (o.short_name || '').trim() || `ORG-${o.id}`;
      byId.set(o.id, {
        organizationId: o.id,
        name: String(o.name).trim(),
        nameBn: o.name_bn ? String(o.name_bn).trim() : null,
        shortName,
        shortCode: shortName,
        logoUrl: resolveTeletalkLogo(o.logo),
        website: resolveValidHttpUrl(o.website),
        openingCount: activeJobsCount,
        expiredCount: expiredJobsCount,
        sourceId: 'teletalk',
        sourceUrl: `${TELETALK_GOVT_PORTAL_URL}/${o.id}`,
        lastUpdatedAt: checkedAt,
      });
    }

    return {
      ok: true,
      organizations: Array.from(byId.values()).sort((a, b) => b.openingCount - a.openingCount || a.name.localeCompare(b.name)),
    };
  }

  const derived = buildGovtOrganizationsFromJobs(jobs, checkedAt);
  return {
    ok: derived.length > 0,
    organizations: derived,
    error: page1Res.blockedReason || 'Teletalk govt organization list endpoint unavailable',
  };
}

export async function fetchTeletalkOrgJobsById(
  organizationId: number,
  signal?: AbortSignal
): Promise<{
  ok: boolean;
  jobs: NormalizedJobCircular[];
  error?: string;
}> {
  const url = `${TELETALK_GOVT_LIST_API_BASE}?orgId=${encodeURIComponent(String(organizationId))}&skipLimit=YES`;
  const res = await safePublicGet(url, 'application/json,text/plain,*/*', signal);
  if (!res.ok) {
    return { ok: false, jobs: [], error: res.blockedReason || `HTTP ${res.status}` };
  }
  const parsed = parseTeletalkGovtJobsListJson(res.body);
  if (!parsed.ok) {
    return { ok: false, jobs: [], error: 'Unexpected response format from organization jobs endpoint' };
  }
  const checkedAt = Date.now();
  const jobs = parsed.items
    .map((raw) => TeletalkAdapter.parseJob(raw, checkedAt))
    .filter((j) => TeletalkAdapter.validateJob(j).isValid);
  return { ok: true, jobs };
}

export async function searchTeletalkPublishedJobs(
  searchKeyword: string = '',
  page: number = 1,
  signal?: AbortSignal
): Promise<{
  ok: boolean;
  totalCount: number;
  jobs: NormalizedJobCircular[];
  error?: string;
}> {
  const url = `${TELETALK_SEARCH_API_BASE}?searchKeyword=${encodeURIComponent(searchKeyword)}&page=${Math.max(1, page)}`;
  const res = await safePublicGet(url, 'application/json,text/plain,*/*', signal);
  if (!res.ok) {
    return { ok: false, totalCount: 0, jobs: [], error: res.blockedReason || `HTTP ${res.status}` };
  }

  const parsed = parseTeletalkPublishedJobsJson(res.body);
  if (!parsed.ok) {
    return { ok: false, totalCount: 0, jobs: [], error: 'Non-JSON or unexpected payload from Teletalk endpoint' };
  }

  const checkedAt = Date.now();
  const jobs = parsed.items
    .map((raw) => TeletalkAdapter.parseJob(raw, checkedAt))
    .filter((j) => TeletalkAdapter.validateJob(j).isValid);

  return { ok: true, totalCount: parsed.totalCount, jobs };
}

export const TeletalkAdapter: JobSourceAdapter = {
  sourceId: 'teletalk',
  sourceName: 'Teletalk All Jobs',
  sourceType: 'official_portal',
  officialDomain: 'alljobs.teletalk.com.bd',
  compatibilityStatus: 'supported',
  accessMethodType: 'Hybrid API + HTML',
  publisherType: 'Official',
  accessMethod: 'Public SPA JSON feed (/api/v1/published-jobs/search — undocumented) + HTML SPA fallback',
  verificationLevel: 'official_partial',
  directSourceUrl: TELETALK_ALLJOBS_URL,
  notes:
    'Uses Teletalk public published-jobs search JSON endpoint (community-discovered, not a guaranteed permanent official API) with automatic SPA portal fallback.',

  async fetchJobs(signal?: AbortSignal): Promise<SourceFetchOutcome> {
    const checkedAt = Date.now();
    const firstPageUrl = `${TELETALK_SEARCH_API_BASE}?searchKeyword=&page=1`;
    const page1Res = await safePublicGet(firstPageUrl, 'application/json,text/plain,*/*', signal);
    const parsedPage1 = page1Res.ok ? parseTeletalkPublishedJobsJson(page1Res.body) : { ok: false, totalCount: 0, items: [] };

    if (parsedPage1.ok) {
      const collectedRaw: RawSourceJobItem[] = [...parsedPage1.items];
      const totalPages = Math.min(MAX_TELETALK_PAGES, Math.max(1, Math.ceil(parsedPage1.totalCount / 20)));
      const failedPages: number[] = [];
      let lastPageError: string | undefined;

      // Fetch remaining pages in small concurrent batches for fast retrieval without rate-limit spikes
      for (let batchStart = 2; batchStart <= totalPages; batchStart += 4) {
        if (signal?.aborted) break;
        const pageNums: number[] = [];
        for (let p = batchStart; p < batchStart + 4 && p <= totalPages; p++) {
          pageNums.push(p);
        }
        const batchResponses = await Promise.all(
          pageNums.map(async (p) => ({
            page: p,
            res: await safePublicGet(`${TELETALK_SEARCH_API_BASE}?searchKeyword=&page=${p}`, 'application/json,text/plain,*/*', signal),
          }))
        );
        let batchHadItems = false;
        for (const { page, res: nextRes } of batchResponses) {
          if (!nextRes.ok) {
            failedPages.push(page);
            if (!lastPageError && nextRes.blockedReason) lastPageError = nextRes.blockedReason;
            continue;
          }
          const parsedNext = parseTeletalkPublishedJobsJson(nextRes.body);
          if (!parsedNext.ok) {
            failedPages.push(page);
            continue;
          }
          if (parsedNext.items.length > 0) {
            collectedRaw.push(...parsedNext.items);
            batchHadItems = true;
          }
        }
        if (!batchHadItems) break;
      }

      const uniqueById = new Map<string, NormalizedJobCircular>();
      for (const raw of collectedRaw) {
        const normalized = this.parseJob(raw, checkedAt);
        if (this.validateJob(normalized).isValid && !uniqueById.has(normalized.id)) {
          uniqueById.set(normalized.id, normalized);
        }
      }

      const jobs = Array.from(uniqueById.values());
      const hasPaginationFailure = failedPages.length > 0;
      const partialNote = hasPaginationFailure
        ? ` (${failedPages.length} pagination page(s) failed: p${failedPages.slice(0, 4).join(', p')}${lastPageError ? ` — ${lastPageError}` : ''})`
        : '';
      return {
        sourceId: this.sourceId,
        sourceName: this.sourceName,
        compatibilityStatus: hasPaginationFailure ? 'partially_supported' : 'supported',
        connectionStatus: hasPaginationFailure ? 'Partially Working' : 'Working',
        accessMethodType: 'Hybrid API + HTML',
        publisherType: 'Official',
        success: true,
        jobs,
        checkedAt,
        httpStatus: page1Res.status ?? null,
        blockedByCaptcha: false,
        accessNotes: `Fetched ${jobs.length} of ${parsedPage1.totalCount} active government jobs via Teletalk published-jobs search endpoint (pages 1-${totalPages}).${partialNote}`,
        directPortalUrl: TELETALK_GOVT_PORTAL_URL,
        ...(hasPaginationFailure
          ? { error: lastPageError || `Pagination failed on page(s): ${failedPages.join(', ')}` }
          : {}),
      };
    }

    // Fallback 1: Permitted public Teletalk govt-jobs/list endpoint used by Alljobs Government directory
    const listRes = await safePublicGet(`${TELETALK_GOVT_LIST_API_BASE}?skipLimit=YES`, 'application/json,text/plain,*/*', signal);
    const parsedList = listRes.ok ? parseTeletalkGovtJobsListJson(listRes.body) : { ok: false, totalCount: 0, items: [] };
    if (parsedList.ok && parsedList.items.length > 0) {
      const uniqueById = new Map<string, NormalizedJobCircular>();
      for (const raw of parsedList.items) {
        const normalized = this.parseJob(raw, checkedAt);
        if (this.validateJob(normalized).isValid && !uniqueById.has(normalized.id)) {
          uniqueById.set(normalized.id, normalized);
        }
      }
      const jobs = Array.from(uniqueById.values());
      return {
        sourceId: this.sourceId,
        sourceName: this.sourceName,
        compatibilityStatus: 'supported',
        connectionStatus: 'Working',
        accessMethodType: 'Hybrid API + HTML',
        publisherType: 'Official',
        success: true,
        jobs,
        checkedAt,
        httpStatus: listRes.status ?? null,
        blockedByCaptcha: false,
        accessNotes: `Primary search endpoint unavailable; recovered ${jobs.length} jobs via public Teletalk govt-jobs/list fallback.`,
        directPortalUrl: TELETALK_GOVT_PORTAL_URL,
      };
    }

    const spaRes = await safePublicGet(TELETALK_ALLJOBS_URL, 'text/html,*/*', signal);
    if (!spaRes.ok) {
      const errMsg = page1Res.blockedReason || spaRes.blockedReason || 'Could not reach Teletalk All Jobs portal.';
      const outcome: SourceFetchOutcome = {
        sourceId: this.sourceId,
        sourceName: this.sourceName,
        compatibilityStatus: 'unavailable',
        accessMethodType: 'Hybrid API + HTML',
        publisherType: 'Official',
        success: false,
        jobs: [],
        checkedAt,
        httpStatus: spaRes.status ?? page1Res.status ?? null,
        blockedByCaptcha: Boolean(spaRes.blockedByCaptcha || page1Res.blockedByCaptcha),
        accessNotes: errMsg,
        directPortalUrl: TELETALK_ALLJOBS_URL,
        error: errMsg,
      };
      outcome.connectionStatus = deriveSourceConnectionStatus(outcome);
      return outcome;
    }

    const isSpaShell = spaRes.body.includes('<div id="root">');
    return {
      sourceId: this.sourceId,
      sourceName: this.sourceName,
      compatibilityStatus: 'partially_supported',
      connectionStatus: 'Partially Working',
      accessMethodType: 'Hybrid API + HTML',
      publisherType: 'Official',
      success: true,
      jobs: [],
      checkedAt,
      accessNotes: isSpaShell
        ? 'Teletalk JSON feed unavailable; portal SPA reachable for direct browsing or manual circular add.'
        : 'Portal reachable.',
      directPortalUrl: TELETALK_ALLJOBS_URL,
    };
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
