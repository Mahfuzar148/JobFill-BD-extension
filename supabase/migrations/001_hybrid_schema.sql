-- JobFill BD — Hybrid Architecture Shared Public Job Database & Optional Encrypted User Sync Schema
-- Target: Supabase PostgreSQL 15+ with strict Row Level Security (RLS)
-- Guarantees:
--   1. Public job tables allow anonymous read-only access ONLY to approved public jobs.
--   2. Only trusted server-side service_role processes may insert/update/delete public jobs.
--   3. Private sync tables store strictly client-encrypted AES-256-GCM ciphertext blobs.
--   4. User isolation derives identity from auth.uid() (JWT), never trusting client-supplied user_id.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- A. SHARED PUBLIC JOB DATABASE TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.job_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name_en TEXT NOT NULL,
  name_bn TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.job_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  source_type TEXT NOT NULL,
  publisher_type TEXT NOT NULL CHECK (publisher_type IN ('Official', 'Third-Party')),
  base_url TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_org_id INTEGER,
  name TEXT NOT NULL,
  name_bn TEXT,
  short_name TEXT,
  short_code TEXT,
  logo_url TEXT,
  website TEXT,
  category_id UUID REFERENCES public.job_categories(id) ON DELETE SET NULL,
  opening_count INTEGER NOT NULL DEFAULT 0 CHECK (opening_count >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_org_id, name)
);

CREATE TABLE IF NOT EXISTS public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES public.job_sources(id) ON DELETE CASCADE,
  source_job_id TEXT,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  category_id UUID REFERENCES public.job_categories(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  title_bn TEXT,
  position TEXT NOT NULL,
  circular_number TEXT,
  vacancies INTEGER CHECK (vacancies IS NULL OR vacancies >= 0),
  qualification TEXT,
  salary TEXT,
  location TEXT NOT NULL DEFAULT 'All Bangladesh',
  published_at TIMESTAMPTZ,
  application_start_at TIMESTAMPTZ,
  deadline_at TIMESTAMPTZ,
  deadline_verified BOOLEAN NOT NULL DEFAULT false,
  -- Strict URL separation: PDF circular never stored as application_url
  circular_url TEXT CHECK (circular_url IS NULL OR circular_url ~* '^https?://'),
  application_url TEXT CHECK (
    application_url IS NULL
    OR (application_url ~* '^https?://' AND application_url !~* '\.pdf($|\?)')
  ),
  organization_url TEXT CHECK (organization_url IS NULL OR organization_url ~* '^https?://'),
  source_url TEXT CHECK (source_url IS NULL OR source_url ~* '^https?://'),
  verification_status TEXT NOT NULL DEFAULT 'official_verified'
    CHECK (verification_status IN ('official_verified', 'official_partial', 'discovery_only', 'unverified', 'rejected')),
  is_approved BOOLEAN NOT NULL DEFAULT true,
  fingerprint_hash TEXT NOT NULL UNIQUE,
  last_checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.source_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL UNIQUE REFERENCES public.job_sources(id) ON DELETE CASCADE,
  connection_status TEXT NOT NULL CHECK (
    connection_status IN ('Working', 'Partially Working', 'Failed', 'Not Implemented', 'Not Tested')
  ),
  retrieved_count INTEGER NOT NULL DEFAULT 0 CHECK (retrieved_count >= 0),
  saved_count INTEGER NOT NULL DEFAULT 0 CHECK (saved_count >= 0),
  last_checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_success_at TIMESTAMPTZ,
  error_message TEXT
);

CREATE TABLE IF NOT EXISTS public.job_verification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES public.job_sources(id) ON DELETE CASCADE,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL CHECK (status IN ('verified', 'partial', 'failed', 'unchanged', 'updated')),
  http_status INTEGER,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS public.job_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  field_changed TEXT NOT NULL,
  old_value_summary TEXT,
  new_value_summary TEXT,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jobs_approved_deadline
  ON public.jobs (is_approved, verification_status, deadline_at);
CREATE INDEX IF NOT EXISTS idx_jobs_source_id ON public.jobs (source_id);
CREATE INDEX IF NOT EXISTS idx_jobs_category_id ON public.jobs (category_id);
CREATE INDEX IF NOT EXISTS idx_jobs_org_id ON public.jobs (organization_id);
CREATE INDEX IF NOT EXISTS idx_jobs_updated_at ON public.jobs (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_orgs_short_name ON public.organizations (short_name);
CREATE INDEX IF NOT EXISTS idx_verif_logs_source ON public.job_verification_logs (source_id, checked_at DESC);

-- ============================================================================
-- B. OPTIONAL ENCRYPTED USER SYNC TABLES (CLIENT-SIDE E2EE CIPHERTEXT ONLY)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_vault_blobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  record_scope TEXT NOT NULL CHECK (record_scope IN ('profiles_bundle', 'documents_bundle', 'activity_bundle')),
  -- Must be AES-GCM ciphertext envelope; never plaintext personal data
  ciphertext_payload JSONB NOT NULL CHECK (
    ciphertext_payload ? 'algorithm'
    AND (ciphertext_payload->>'algorithm') = 'AES-GCM'
    AND ciphertext_payload ? 'ivHex'
    AND ciphertext_payload ? 'ciphertextHex'
  ),
  schema_version INTEGER NOT NULL DEFAULT 1,
  client_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, record_scope)
);

CREATE TABLE IF NOT EXISTS public.user_sync_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  device_label TEXT NOT NULL,
  last_sync_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Server-enforced trigger preventing client user_id spoofing on private writes
CREATE OR REPLACE FUNCTION public.enforce_authenticated_user_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.user_id := auth.uid();
  ELSIF TG_OP = 'UPDATE' AND NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Changing user_id ownership is forbidden';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_vault_blobs_auth ON public.user_vault_blobs;
CREATE TRIGGER trg_user_vault_blobs_auth
  BEFORE INSERT OR UPDATE ON public.user_vault_blobs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_authenticated_user_id();

-- ============================================================================
-- C. STRICT ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE public.job_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_verification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_vault_blobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sync_devices ENABLE ROW LEVEL SECURITY;

-- Public Read-Only Policies (No INSERT/UPDATE/DELETE policies -> denied to anon & authenticated; service_role bypasses)
CREATE POLICY "Public read approved jobs" ON public.jobs
  FOR SELECT TO anon, authenticated
  USING (is_approved = true AND verification_status <> 'rejected');

CREATE POLICY "Public read job categories" ON public.job_categories
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Public read active job sources" ON public.job_sources
  FOR SELECT TO anon, authenticated USING (is_active = true);

CREATE POLICY "Public read organizations" ON public.organizations
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Public read source health" ON public.source_health
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Public read verification logs" ON public.job_verification_logs
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Public read job updates" ON public.job_updates
  FOR SELECT TO anon, authenticated USING (true);

-- Strict Private User Isolation Policies (Authenticated User Only)
CREATE POLICY "Users read own encrypted vault" ON public.user_vault_blobs
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own encrypted vault" ON public.user_vault_blobs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own encrypted vault" ON public.user_vault_blobs
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own encrypted vault" ON public.user_vault_blobs
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users manage own sync devices" ON public.user_sync_devices
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
