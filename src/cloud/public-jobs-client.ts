// JobFill BD - Shared Public Job Database Client (Anonymous Read-Only via RLS)
// Fetches approved public job circulars and source health cleanly with pagination.
// Never sends user profile data, tokens, or PII; fails open to local IndexedDB/adapters when offline.

import { NormalizedJobCircular, SourceVerificationStatus } from '../jobs/types/job.types';
import { getCloudConfig, isCloudBackendConfigured, isCloudSyncFeatureEnabled } from './supabase-config';
import { refreshJobStatus } from '../jobs/services/job-validator';

export interface PublicJobsPageResult {
  jobs: NormalizedJobCircular[];
  totalCount: number;
  offset: number;
  limit: number;
}

function mapSupabaseJobRowToCircular(row: any): NormalizedJobCircular | null {
  if (!row || !row.id || !row.title || row.is_approved === false || row.verification_status === 'rejected') {
    return null;
  }

  const deadlineAt = row.deadline_at ? new Date(row.deadline_at).getTime() : null;
  const publishedAt = row.published_at ? new Date(row.published_at).getTime() : null;
  const applicationStartAt = row.application_start_at ? new Date(row.application_start_at).getTime() : null;
  const safeAppUrl =
    row.application_url && !/\.pdf($|\?)/i.test(String(row.application_url))
      ? String(row.application_url)
      : null;

  const base: NormalizedJobCircular = {
    id: `cloud_${row.id}`,
    sourceId: String(row.job_sources?.source_key || row.source_key || 'official_website'),
    sourceName: String(row.job_sources?.display_name || 'Public Verified Source'),
    sourceJobId: row.source_job_id || null,
    organization: String(row.organizations?.name || row.organization_name || 'Bangladesh Organization'),
    organizationBn: row.organizations?.name_bn || null,
    organizationShortName: row.organizations?.short_name || undefined,
    jobTitle: String(row.title),
    titleBn: row.title_bn || null,
    position: String(row.position || row.title),
    circularNumber: row.circular_number || undefined,
    category: (row.job_categories?.name_en || 'Government') as any,
    employmentType: 'Full Time',
    vacancies: typeof row.vacancies === 'number' ? row.vacancies : null,
    salary: row.salary || undefined,
    qualification: row.qualification || 'Any Qualification',
    location: row.location || 'All Bangladesh',
    publishedAt: Number.isFinite(publishedAt) ? publishedAt : null,
    applicationStartAt: Number.isFinite(applicationStartAt) ? applicationStartAt : null,
    deadlineAt: Number.isFinite(deadlineAt) ? deadlineAt : null,
    deadlineTimezone: 'Asia/Dhaka',
    timezone: 'Asia/Dhaka',
    deadlineVerified: Boolean(row.deadline_verified && Number.isFinite(deadlineAt)),
    circularUrl: row.circular_url || undefined,
    applicationUrl: safeAppUrl,
    organizationUrl: row.organization_url || undefined,
    sourceUrl: row.source_url || undefined,
    description: String(row.position || row.title),
    requirements: [],
    sourceVerification: (row.verification_status || 'official_partial') as SourceVerificationStatus,
    sourceLastCheckedAt: row.last_checked_at ? new Date(row.last_checked_at).getTime() : Date.now(),
    sourceLastVerifiedAt: row.last_verified_at ? new Date(row.last_verified_at).getTime() : null,
    firstDiscoveredAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    lastUpdatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
    status: 'active',
    fingerprintHash: row.fingerprint_hash || undefined,
  };

  return refreshJobStatus(base);
}

export async function fetchApprovedPublicJobsPage(options: {
  offset?: number;
  limit?: number;
  categoryName?: string;
} = {}): Promise<PublicJobsPageResult | null> {
  if ((typeof __JOBFILL_CLOUD_SYNC_DISABLED__ !== 'undefined' && __JOBFILL_CLOUD_SYNC_DISABLED__) || !isCloudSyncFeatureEnabled()) {
    return null;
  }
  const cfg = await getCloudConfig();
  if (!cfg.usePublicCloudJobsFeed || !isCloudBackendConfigured(cfg)) {
    return null;
  }

  const offset = Math.max(0, options.offset || 0);
  const limit = Math.min(100, Math.max(1, options.limit || 50));
  const queryParams = new URLSearchParams({
    select: '*,job_sources(source_key,display_name),organizations(name,name_bn,short_name),job_categories(name_en)',
    is_approved: 'eq.true',
    verification_status: 'neq.rejected',
    order: 'deadline_at.asc.nullslast,updated_at.desc',
  });
  if (options.categoryName && options.categoryName !== 'All') {
    queryParams.set('job_categories.name_en', `eq.${options.categoryName}`);
  }

  const resp = await fetch(`${cfg.supabaseUrl}/rest/v1/jobs?${queryParams.toString()}`, {
    method: 'GET',
    credentials: 'omit',
    headers: {
      apikey: cfg.supabaseAnonKey,
      Prefer: 'count=exact',
      Range: `${offset}-${offset + limit - 1}`,
    },
  });

  if (!resp.ok) {
    throw new Error(`Public jobs query failed (HTTP ${resp.status})`);
  }

  const rows = await resp.json();
  const contentRange = resp.headers?.get('content-range') || '';
  const totalMatch = contentRange.match(/\/(\d+)$/);
  const totalCount = totalMatch ? Number(totalMatch[1]) : Array.isArray(rows) ? rows.length : 0;

  const jobs = (Array.isArray(rows) ? rows : [])
    .map(mapSupabaseJobRowToCircular)
    .filter((j): j is NormalizedJobCircular => j !== null);

  return { jobs, totalCount, offset, limit };
}
