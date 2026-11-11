// Supabase Edge Function: Trusted Server-Side Public Job Ingestion Pipeline
// Runs ONLY on Supabase Edge Runtime using SUPABASE_SERVICE_ROLE_KEY (never exposed in extension).
// Validates public circulars, rejects PII/PDF-as-application-URL errors, tracks job updates & health.

// @ts-nocheck — Deno Edge Runtime entrypoint
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface IngestJobInput {
  sourceKey: string;
  sourceJobId?: string;
  title: string;
  titleBn?: string;
  organization: string;
  position: string;
  categorySlug: string;
  vacancies?: number | null;
  qualification?: string;
  salary?: string;
  location?: string;
  publishedAt?: string | null;
  applicationStartAt?: string | null;
  deadlineAt?: string | null;
  deadlineVerified?: boolean;
  circularUrl?: string | null;
  applicationUrl?: string | null;
  organizationUrl?: string | null;
  sourceUrl?: string | null;
  verificationStatus?: 'official_verified' | 'official_partial' | 'discovery_only' | 'unverified';
  fingerprintHash: string;
}

function isValidHttpUrl(url?: string | null): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function containsPrivatePiiIndicators(record: Record<string, unknown>): boolean {
  const forbiddenKeys = ['nid', 'birthReg', 'password', 'passport', 'signature', 'dataUrl'];
  return forbiddenKeys.some((k) => k in record && Boolean(record[k]));
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const cronSecret = Deno.env.get('INGEST_CRON_SECRET') || '';
  const authHeader = req.headers.get('Authorization') || '';
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized ingestion trigger' }), { status: 401 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Missing server configuration' }), { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const payload = await req.json().catch(() => null);
  const incomingJobs: IngestJobInput[] = Array.isArray(payload?.jobs) ? payload.jobs : [];
  let savedCount = 0;
  let rejectedCount = 0;
  const errors: string[] = [];

  for (const job of incomingJobs) {
    if (
      !job?.sourceKey ||
      !job?.title ||
      !job?.organization ||
      !job?.fingerprintHash ||
      containsPrivatePiiIndicators(job as any)
    ) {
      rejectedCount++;
      errors.push(`Rejected invalid/unsafe record: ${job?.title || 'unknown'}`);
      continue;
    }

    // Never allow a PDF circular link to masquerade as application_url
    const safeAppUrl =
      job.applicationUrl && isValidHttpUrl(job.applicationUrl) && !/\.pdf($|\?)/i.test(job.applicationUrl)
        ? job.applicationUrl
        : null;
    const safeCircularUrl = job.circularUrl && isValidHttpUrl(job.circularUrl) ? job.circularUrl : null;
    const safeSourceUrl = job.sourceUrl && isValidHttpUrl(job.sourceUrl) ? job.sourceUrl : null;

    const { data: sourceRow } = await supabase
      .from('job_sources')
      .select('id')
      .eq('source_key', job.sourceKey)
      .maybeSingle();

    if (!sourceRow?.id) {
      rejectedCount++;
      errors.push(`Unknown sourceKey: ${job.sourceKey}`);
      continue;
    }

    const { data: existingJob } = await supabase
      .from('jobs')
      .select('id, deadline_at, vacancies')
      .eq('fingerprint_hash', job.fingerprintHash)
      .maybeSingle();

    const { data: upserted, error: upsertErr } = await supabase
      .from('jobs')
      .upsert(
        {
          source_id: sourceRow.id,
          source_job_id: job.sourceJobId || null,
          title: job.title.trim(),
          title_bn: job.titleBn || null,
          position: (job.position || job.title).trim(),
          vacancies: typeof job.vacancies === 'number' ? job.vacancies : null,
          qualification: job.qualification || 'Any Qualification',
          salary: job.salary || null,
          location: job.location || 'All Bangladesh',
          published_at: job.publishedAt || null,
          application_start_at: job.applicationStartAt || null,
          deadline_at: job.deadlineAt || null,
          deadline_verified: Boolean(job.deadlineVerified),
          circular_url: safeCircularUrl,
          application_url: safeAppUrl,
          organization_url: job.organizationUrl && isValidHttpUrl(job.organizationUrl) ? job.organizationUrl : null,
          source_url: safeSourceUrl,
          verification_status: job.verificationStatus || 'official_partial',
          is_approved: true,
          fingerprint_hash: job.fingerprintHash,
          last_checked_at: new Date().toISOString(),
          last_verified_at: new Date().toISOString(),
        },
        { onConflict: 'fingerprint_hash' }
      )
      .select('id')
      .single();

    if (upsertErr || !upserted?.id) {
      rejectedCount++;
      errors.push(upsertErr?.message || 'Upsert failed');
      continue;
    }

    if (existingJob?.id && existingJob.deadline_at !== (job.deadlineAt || null)) {
      await supabase.from('job_updates').insert({
        job_id: upserted.id,
        field_changed: 'deadline_at',
        old_value_summary: existingJob.deadline_at || 'null',
        new_value_summary: job.deadlineAt || 'null',
      });
    }

    await supabase.from('job_verification_logs').insert({
      job_id: upserted.id,
      source_id: sourceRow.id,
      status: existingJob?.id ? 'updated' : 'verified',
      notes: 'Validated & persisted by server ingestion pipeline',
    });

    savedCount++;
  }

  return new Response(
    JSON.stringify({ ok: true, savedCount, rejectedCount, errors }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
