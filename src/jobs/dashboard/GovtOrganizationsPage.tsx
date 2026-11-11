// JobFill BD - Teletalk Alljobs Government Organizations & Job Directory Page
// Fetches real organizations & openings from public Teletalk Alljobs endpoints,
// integrates cleanly with IndexedDB cache, Search, Filters, Deadlines & Smart Autofill.

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Building2,
  Search,
  RefreshCw,
  ArrowLeft,
  ExternalLink,
  Calendar,
  Clock,
  Users,
  CheckCircle2,
  AlertTriangle,
  Globe,
  RotateCcw,
  Eye,
  Briefcase,
} from 'lucide-react';
import { useApp } from '../../dashboard/context/AppContext';
import {
  NormalizedJobCircular,
  GovtOrganizationRecord,
  ApplicationTrackerRecord,
  DeadlineFilterOption,
} from '../types/job.types';
import { JobRepository } from '../database/job-repository';
import { BookmarkRepository } from '../database/bookmark-repository';
import { ApplicationRepository } from '../database/application-repository';
import { JobCheckService } from '../background/job-check-service';
import { deduplicateAndMergeJobs } from '../services/job-deduplicator';
import { DAY_MS, formatDhakaDate } from '../services/deadline-parser';
import { verifyJobUrl, sanitizeCircularRefForDisplay } from '../services/source-verifier';
import {
  buildGovtOrganizationsFromJobs,
  fetchTeletalkOrgJobsById,
} from '../sources/teletalk/teletalk.adapter';
import {
  openJobApplicationWithContext,
  toggleJobBookmarkAndSync,
  markJobAppliedAndSync,
  verifyJobManualDeadline,
  shareJobCircular,
} from '../services/job-ui-actions';
import { DeadlineCountdown } from './DeadlineCountdown';
import { BookmarkButton } from './BookmarkButton';
import { JobDetails } from './JobDetails';
import { MissingApplicationUrlModal } from './MissingApplicationUrlModal';

type ViewMode = 'organizations' | 'all_active_jobs' | 'closing_soon_jobs' | 'expired_jobs';
type VacancyFilter = 'all' | '1+' | '5+' | '10+' | '25+';

interface GovtOrganizationsPageProps {
  onDataChanged?: () => void;
}

function getOrgInitials(name: string, shortName?: string): string {
  if (shortName && shortName.trim() && !shortName.startsWith('ORG-')) {
    return shortName.trim().slice(0, 6).toUpperCase();
  }
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 3)
      .map((w) => w[0]?.toUpperCase())
      .join('') || 'GOV'
  );
}

export const GovtOrganizationsPage: React.FC<GovtOrganizationsPageProps> = ({
  onDataChanged,
}) => {
  const { language, showToast } = useApp();
  const bn = language === 'bn';

  const [orgs, setOrgs] = useState<GovtOrganizationRecord[]>([]);
  const [teletalkJobs, setTeletalkJobs] = useState<NormalizedJobCircular[]>([]);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [applications, setApplications] = useState<ApplicationTrackerRecord[]>([]);
  const [sourceOutcome, setSourceOutcome] = useState<any | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>('organizations');
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null);
  const [orgFilterId, setOrgFilterId] = useState<string>('All');
  const [query, setQuery] = useState('');
  const [deadlineFilter, setDeadlineFilter] = useState<DeadlineFilterOption>('all');
  const [vacancyFilter, setVacancyFilter] = useState<VacancyFilter>('all');

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [orgDetailLoading, setOrgDetailLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [failedLogos, setFailedLogos] = useState<Set<number>>(new Set());
  const [selectedJob, setSelectedJob] = useState<NormalizedJobCircular | null>(null);
  const [missingAppJob, setMissingAppJob] = useState<NormalizedJobCircular | null>(null);

  const bnRef = React.useRef(bn);
  bnRef.current = bn;
  const onDataChangedRef = React.useRef(onDataChanged);
  onDataChangedRef.current = onDataChanged;
  const showToastRef = React.useRef(showToast);
  showToastRef.current = showToast;

  const loadStoredState = useCallback(async () => {
    const now = Date.now();
    const [storedOrgs, allJobs, bmIds, apps, outcomes, schedState] = await Promise.all([
      JobRepository.getGovtOrganizations(),
      JobRepository.getAllJobs(now),
      BookmarkRepository.getBookmarkedJobIds(),
      ApplicationRepository.getAll(),
      JobRepository.getSourceOutcomes(),
      JobRepository.getSchedulerState(),
    ]);

    const tJobs = allJobs.filter((j) => j.sourceId === 'teletalk');
    const derived = buildGovtOrganizationsFromJobs(tJobs, now);

    // Reconcile org metadata from org-list with exact job counts from stored Teletalk circulars
    const mergedByOrgId = new Map<number, GovtOrganizationRecord>();
    for (const o of storedOrgs) {
      mergedByOrgId.set(o.organizationId, { ...o });
    }
    for (const d of derived) {
      const existing = mergedByOrgId.get(d.organizationId);
      if (existing) {
        mergedByOrgId.set(d.organizationId, {
          ...existing,
          openingCount: d.openingCount,
          expiredCount: d.expiredCount,
          logoUrl: existing.logoUrl || d.logoUrl,
          nameBn: existing.nameBn || d.nameBn,
        });
      } else {
        mergedByOrgId.set(d.organizationId, d);
      }
    }

    const reconciledOrgs = Array.from(mergedByOrgId.values()).sort(
      (a, b) => b.openingCount - a.openingCount || a.name.localeCompare(b.name)
    );

    const ttOutcome = outcomes.find((o: any) => o.sourceId === 'teletalk') || null;
    const isTeletalkDegraded =
      ttOutcome &&
      (!ttOutcome.success ||
        ttOutcome.compatibilityStatus === 'unavailable' ||
        (ttOutcome.compatibilityStatus === 'partially_supported' && (ttOutcome.jobCount ?? 0) === 0));
    if (isTeletalkDegraded) {
      setErrorBanner(
        ttOutcome.error ||
          ttOutcome.accessNotes ||
          (bnRef.current
            ? 'Teletalk Alljobs API থেকে সর্বশেষ তথ্য আনা যায়নি।'
            : 'Could not fetch latest data from Teletalk Alljobs API.')
      );
    } else {
      setErrorBanner(null);
    }

    setOrgs(reconciledOrgs);
    setTeletalkJobs(tJobs);
    setBookmarkedIds(bmIds);
    setApplications(apps);
    setSourceOutcome(ttOutcome);
    setLastSyncedAt(schedState.lastSuccessfulSyncAt ?? schedState.lastDailyCheckAt ?? null);

    return { reconciledOrgs, tJobs, ttOutcome };
  }, []);

  const handleFetchLatest = useCallback(async () => {
    setSyncing(true);
    setErrorBanner(null);
    try {
      const report = await JobCheckService.runFullCheck({ sourceIds: ['teletalk'] });
      await loadStoredState();
      onDataChangedRef.current?.();
      const ttOut = report.sourceOutcomes.find((o) => o.sourceId === 'teletalk');
      const isDegradedOut =
        ttOut &&
        (!ttOut.success ||
          ttOut.compatibilityStatus === 'unavailable' ||
          (ttOut.compatibilityStatus === 'partially_supported' && (ttOut.jobs?.length ?? 0) === 0));
      if (isDegradedOut) {
        const errText = ttOut.error || ttOut.accessNotes || 'Teletalk API fetch failed';
        setErrorBanner(errText);
        showToastRef.current(`⚠️ ${errText}`);
      } else {
        showToastRef.current(
          bnRef.current
            ? `✅ Teletalk আপডেট সম্পন্ন: ${report.newJobsCount}টি নতুন, ${report.updatedJobsCount}টি আপডেট`
            : `✅ Teletalk synced: ${report.newJobsCount} new, ${report.updatedJobsCount} updated`
        );
      }
    } catch (err: any) {
      const msg = err?.message || 'Failed to fetch Teletalk organizations';
      setErrorBanner(msg);
      showToastRef.current(`❌ ${msg}`);
    } finally {
      setSyncing(false);
    }
  }, [loadStoredState]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await loadStoredState();
        const isExt = typeof chrome !== 'undefined' && Boolean(chrome.runtime?.id);
        if (!cancelled && isExt && (res.reconciledOrgs.length === 0 || res.tJobs.length === 0)) {
          setLoading(false);
          await handleFetchLatest();
          return;
        }
      } catch (err: any) {
        if (!cancelled) setErrorBanner(err?.message || 'Failed to load government organizations');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadStoredState, handleFetchLatest]);

  const appByJobId = useMemo(() => {
    const map = new Map<string, ApplicationTrackerRecord>();
    for (const a of applications) map.set(a.jobId, a);
    return map;
  }, [applications]);

  const orgById = useMemo(() => {
    const map = new Map<number, GovtOrganizationRecord>();
    for (const o of orgs) map.set(o.organizationId, o);
    return map;
  }, [orgs]);

  const handleSelectOrganization = async (org: GovtOrganizationRecord) => {
    setSelectedOrgId(org.organizationId);
    setOrgFilterId(String(org.organizationId));
    // Verify/fetch latest openings for this organization if cached job count mismatches expected count
    const localCount = teletalkJobs.filter((j) => j.organizationId === org.organizationId).length;
    if (localCount < org.openingCount) {
      setOrgDetailLoading(true);
      try {
        const res = await fetchTeletalkOrgJobsById(org.organizationId);
        if (res.ok && res.jobs.length > 0) {
          const allStored = await JobRepository.getAllJobs();
          const merged = deduplicateAndMergeJobs(allStored, res.jobs);
          await JobRepository.saveJobs(merged.mergedJobs);
          await JobRepository.rebuildSearchIndex(merged.mergedJobs);
          await loadStoredState();
        }
      } finally {
        setOrgDetailLoading(false);
      }
    }
  };

  const clearAllFilters = () => {
    setQuery('');
    setViewMode('organizations');
    setSelectedOrgId(null);
    setOrgFilterId('All');
    setDeadlineFilter('all');
    setVacancyFilter('all');
  };

  const normalizedQ = query.trim().toLowerCase();

  // Filter organizations in Directory view
  const filteredOrgs = useMemo(() => {
    return orgs.filter((o) => {
      if (orgFilterId !== 'All' && String(o.organizationId) !== orgFilterId) return false;
      if (normalizedQ) {
        const hay = `${o.name} ${o.nameBn || ''} ${o.shortName} ${o.shortCode || ''} ${o.organizationId}`.toLowerCase();
        const orgDirectMatch = hay.includes(normalizedQ);
        const orgHasMatchingJob = teletalkJobs.some(
          (j) =>
            j.organizationId === o.organizationId &&
            `${j.jobTitle} ${j.titleBn || ''} ${j.position} ${j.circularNumber || ''} ${j.sourceJobId || ''}`
              .toLowerCase()
              .includes(normalizedQ)
        );
        if (!orgDirectMatch && !orgHasMatchingJob) return false;
      }
      return true;
    });
  }, [orgs, orgFilterId, normalizedQ, teletalkJobs]);

  // Filter Teletalk jobs across selected organization, search query, preset status, deadline, and vacancy
  const filteredJobs = useMemo(() => {
    const now = Date.now();
    const effectiveOrgId = selectedOrgId !== null ? String(selectedOrgId) : orgFilterId;

    const list = teletalkJobs.filter((j) => {
      if (effectiveOrgId !== 'All' && String(j.organizationId ?? '') !== effectiveOrgId) {
        return false;
      }

      if (normalizedQ) {
        const orgMeta = typeof j.organizationId === 'number' ? orgById.get(j.organizationId) : undefined;
        const hay = [
          j.organization,
          j.organizationBn || '',
          j.organizationShortName || '',
          orgMeta?.name || '',
          orgMeta?.nameBn || '',
          orgMeta?.shortName || '',
          j.jobTitle,
          j.titleBn || '',
          j.position,
          j.circularNumber || '',
          j.sourceJobId || '',
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(normalizedQ)) return false;
      }

      const isExpired =
        j.status === 'expired' ||
        (j.deadlineVerified && typeof j.deadlineAt === 'number' && j.deadlineAt <= now);

      if (viewMode === 'all_active_jobs' && isExpired) return false;
      if (viewMode === 'closing_soon_jobs') {
        if (!j.deadlineVerified || !j.deadlineAt || j.deadlineAt <= now || j.deadlineAt - now > 7 * DAY_MS) {
          return false;
        }
      }
      if (viewMode === 'expired_jobs' && !isExpired) return false;

      if (deadlineFilter !== 'all') {
        if (deadlineFilter === 'expired') {
          if (!isExpired) return false;
        } else {
          if (!j.deadlineVerified || !j.deadlineAt || j.deadlineAt <= now) return false;
          const rem = j.deadlineAt - now;
          if (deadlineFilter === 'closing_soon' && rem > 7 * DAY_MS) return false;
          if (deadlineFilter === 'more_than_7_days' && rem <= 7 * DAY_MS) return false;
          if (deadlineFilter === '3_to_7_days' && (rem < 2 * DAY_MS || rem > 7 * DAY_MS)) return false;
          if (deadlineFilter === '1_to_2_days' && (rem <= 1 * DAY_MS || rem > 2 * DAY_MS)) return false;
          if (deadlineFilter === 'closing_today' && rem > 1 * DAY_MS) return false;
        }
      }

      if (vacancyFilter !== 'all') {
        const minVac = Number(vacancyFilter.replace('+', ''));
        if (!j.vacancies || j.vacancies < minVac) return false;
      }

      return true;
    });

    list.sort((a, b) => {
      if (viewMode === 'closing_soon_jobs') {
        return (a.deadlineAt ?? Number.MAX_SAFE_INTEGER) - (b.deadlineAt ?? Number.MAX_SAFE_INTEGER);
      }
      if (viewMode === 'expired_jobs' || deadlineFilter === 'expired') {
        return (b.deadlineAt ?? 0) - (a.deadlineAt ?? 0);
      }
      return (a.deadlineAt ?? Number.MAX_SAFE_INTEGER) - (b.deadlineAt ?? Number.MAX_SAFE_INTEGER);
    });

    return list;
  }, [
    teletalkJobs,
    selectedOrgId,
    orgFilterId,
    normalizedQ,
    viewMode,
    deadlineFilter,
    vacancyFilter,
    orgById,
  ]);

  const showJobsList =
    selectedOrgId !== null ||
    viewMode !== 'organizations' ||
    orgFilterId !== 'All' ||
    deadlineFilter !== 'all' ||
    vacancyFilter !== 'all';

  const ORG_JOBS_PAGE_SIZE = 24;
  const [jobsPage, setJobsPage] = useState(1);
  const totalJobsPages = Math.max(1, Math.ceil(filteredJobs.length / ORG_JOBS_PAGE_SIZE));
  const safeJobsPage = Math.min(jobsPage, totalJobsPages);
  const paginatedJobs = useMemo(() => {
    const start = (safeJobsPage - 1) * ORG_JOBS_PAGE_SIZE;
    return filteredJobs.slice(start, start + ORG_JOBS_PAGE_SIZE);
  }, [filteredJobs, safeJobsPage]);

  useEffect(() => {
    setJobsPage(1);
  }, [selectedOrgId, orgFilterId, viewMode, normalizedQ, deadlineFilter, vacancyFilter]);

  if (selectedJob) {
    return (
      <>
        <JobDetails
          job={selectedJob}
          isBookmarked={bookmarkedIds.has(selectedJob.id)}
          applicationStatus={appByJobId.get(selectedJob.id)?.status}
          language={language}
          onBack={() => setSelectedJob(null)}
          onApplyNow={(job) => openJobApplicationWithContext(job, showToast, bn, setMissingAppJob)}
          onToggleBookmark={async (jobId) => {
            const res = await toggleJobBookmarkAndSync(
              jobId,
              teletalkJobs,
              appByJobId.get(jobId),
              showToast,
              bn
            );
            setBookmarkedIds(res.bookmarkedIds);
            setApplications(res.applications);
            onDataChanged?.();
          }}
          onMarkApplied={async (job) => {
            const apps = await markJobAppliedAndSync(job, appByJobId.get(job.id), showToast, bn);
            setApplications(apps);
            onDataChanged?.();
          }}
          onUpdateDeadline={async (jobId, newDeadlineText) => {
            const target = teletalkJobs.find((j) => j.id === jobId);
            if (!target) return;
            const updated = await verifyJobManualDeadline(target, newDeadlineText, showToast, bn);
            if (updated) {
              await loadStoredState();
              setSelectedJob(updated);
              onDataChanged?.();
            }
          }}
          onShare={(job) => shareJobCircular(job, showToast, bn)}
        />
        <MissingApplicationUrlModal
          job={missingAppJob}
          language={language}
          onClose={() => setMissingAppJob(null)}
        />
      </>
    );
  }

  const selectedOrg = selectedOrgId !== null ? orgById.get(selectedOrgId) || null : null;
  const totalLiveOpenings = orgs.reduce((sum, o) => sum + o.openingCount, 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2">
            <Building2 className="w-6 h-6 text-petro-600" />
            <span>
              {bn
                ? 'সরকারি প্রতিষ্ঠান ডিরেক্টরি (Teletalk Alljobs)'
                : 'Government Organizations Directory (Teletalk Alljobs)'}
            </span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {bn
              ? `মোট ${orgs.length}টি সরকারি প্রতিষ্ঠান এবং ${totalLiveOpenings}টি চলমান পদ সরাসরি Alljobs পাবলিক API থেকে সংগৃহীত`
              : `${orgs.length} live Government Organization(s) & ${totalLiveOpenings} open job circular(s) fetched from alljobs.teletalk.com.bd`}
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
            {bn ? 'সর্বশেষ আপডেট:' : 'Last Updated:'}{' '}
            <strong className="text-slate-600 dark:text-slate-300">
              {lastSyncedAt ? new Date(lastSyncedAt).toLocaleString() : bn ? 'এখনো হয়নি' : 'Not synced yet'}
            </strong>
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <a
            href="https://alljobs.teletalk.com.bd/jobs/government"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50"
          >
            <span>{bn ? 'Alljobs পোর্টাল' : 'Alljobs Portal'}</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <button
            type="button"
            onClick={handleFetchLatest}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-petro-600 hover:bg-petro-700 text-white shadow-sm disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            <span>
              {syncing
                ? bn ? 'আপডেট হচ্ছে...' : 'Fetching Latest...'
                : bn ? 'সর্বশেষ আনুন (Fetch Latest)' : 'Fetch Latest'}
            </span>
          </button>
        </div>
      </div>

      {/* Actual Source Failure / Fallback Notice */}
      {errorBanner && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-start gap-2 text-amber-900 dark:text-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold">
                {bn ? 'উৎস সতর্কতা (সর্বশেষ সংরক্ষিত তথ্য প্রদর্শিত হচ্ছে):' : 'Teletalk Source Warning (Showing last cached data):'}
              </div>
              <div className="text-[11px] opacity-90">{errorBanner}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleFetchLatest}
            disabled={syncing}
            className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-amber-600 hover:bg-amber-700 text-white shrink-0 cursor-pointer"
          >
            {bn ? 'পুনরায় চেষ্টা' : 'Retry'}
          </button>
        </div>
      )}

      {/* Search + Preset Mode Pills + Filters */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 shadow-xs">
        <div className="flex flex-col md:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="search"
              aria-label="Search government organizations and jobs"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                bn
                  ? 'প্রতিষ্ঠানের নাম, সংক্ষিপ্ত নাম (DSCC, DGBPO), পদবি বা Job ID (GJOB...) লিখুন...'
                  : 'Search organization name, short name (DSCC, BOGMC), job title, or Job ID (GJOB...)...'
              }
              className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:border-petro-600"
            />
          </div>

          <button
            type="button"
            onClick={clearAllFilters}
            className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{bn ? 'ফিল্টার রিসেট' : 'Clear Filters'}</span>
          </button>
        </div>

        {/* Preset Quick Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {[
            {
              id: 'organizations' as ViewMode,
              label: bn ? `সব প্রতিষ্ঠান (${orgs.length})` : `All Organizations (${orgs.length})`,
            },
            {
              id: 'all_active_jobs' as ViewMode,
              label: bn ? `সব চলমান চাকরি` : 'All Active Jobs',
            },
            {
              id: 'closing_soon_jobs' as ViewMode,
              label: bn ? 'শীঘ্রই শেষ' : 'Closing Soon',
            },
            {
              id: 'expired_jobs' as ViewMode,
              label: bn ? 'মেয়াদোত্তীর্ণ চাকরি' : 'Expired Jobs',
            },
          ].map((pill) => {
            const active = viewMode === pill.id && selectedOrgId === null;
            return (
              <button
                key={pill.id}
                type="button"
                onClick={() => {
                  setSelectedOrgId(null);
                  setViewMode(pill.id);
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors cursor-pointer ${
                  active
                    ? 'bg-petro-600 text-white border-petro-700 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                }`}
              >
                {pill.label}
              </button>
            );
          })}
        </div>

        {/* Dropdown Filters: Organization, Deadline, Vacancy */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <select
            aria-label="Filter by Organization"
            value={selectedOrgId !== null ? String(selectedOrgId) : orgFilterId}
            onChange={(e) => {
              const val = e.target.value;
              setOrgFilterId(val);
              setSelectedOrgId(val === 'All' ? null : Number(val));
            }}
            className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 text-slate-700 dark:text-slate-200"
          >
            <option value="All">{bn ? 'সব সরকারি প্রতিষ্ঠান' : 'All Organizations'}</option>
            {orgs.map((o) => (
              <option key={o.organizationId} value={String(o.organizationId)}>
                {o.name} ({o.shortName}) — {o.openingCount}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by Deadline"
            value={deadlineFilter}
            onChange={(e) => setDeadlineFilter(e.target.value as DeadlineFilterOption)}
            className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 text-slate-700 dark:text-slate-200"
          >
            <option value="all">{bn ? 'সব সময়সীমা (Deadline)' : 'All Deadlines'}</option>
            <option value="closing_today">{bn ? 'আজই শেষ' : 'Closing Today'}</option>
            <option value="1_to_2_days">{bn ? '১-২ দিনের মধ্যে' : '1–2 Days Remaining'}</option>
            <option value="3_to_7_days">{bn ? '৩-৭ দিনের মধ্যে' : '3–7 Days Remaining'}</option>
            <option value="closing_soon">{bn ? 'শীঘ্রই শেষ (৭ দিন)' : 'Closing Soon (<= 7 Days)'}</option>
            <option value="more_than_7_days">{bn ? '৭+ দিন বাকি' : 'More than 7 Days'}</option>
            <option value="expired">{bn ? 'মেয়াদোত্তীর্ণ' : 'Expired'}</option>
          </select>

          <select
            aria-label="Filter by Vacancy"
            value={vacancyFilter}
            onChange={(e) => setVacancyFilter(e.target.value as VacancyFilter)}
            className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 text-slate-700 dark:text-slate-200"
          >
            <option value="all">{bn ? 'সব পদসংখ্যা (Vacancy)' : 'All Vacancies'}</option>
            <option value="1+">{bn ? '১+ পদ' : '1+ Vacancies'}</option>
            <option value="5+">{bn ? '৫+ পদ' : '5+ Vacancies'}</option>
            <option value="10+">{bn ? '১০+ পদ' : '10+ Vacancies'}</option>
            <option value="25+">{bn ? '২৫+ পদ' : '25+ Vacancies'}</option>
          </select>
        </div>
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center text-xs text-slate-400">
          {bn ? 'সরকারি প্রতিষ্ঠান ও বিজ্ঞপ্তি লোড হচ্ছে...' : 'Loading Government Organizations & Jobs...'}
        </div>
      ) : showJobsList ? (
        /* Selected Organization Jobs OR Flat Active/Closing/Expired Job Listing */
        <div className="space-y-4">
          {selectedOrg && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedOrgId(null);
                    setOrgFilterId('All');
                    setViewMode('organizations');
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 cursor-pointer self-start"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>{bn ? 'সব প্রতিষ্ঠানে ফিরুন' : 'Back to Organizations'}</span>
                </button>

                <div className="flex items-center gap-2 flex-wrap">
                  {selectedOrg.website && verifyJobUrl(selectedOrg.website).isSafeToOpen && (
                    <a
                      href={selectedOrg.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50"
                    >
                      <Globe className="w-3.5 h-3.5 text-petro-600" />
                      <span>{bn ? 'অফিশিয়াল ওয়েবসাইট' : 'Official Website'}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  <a
                    href={selectedOrg.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-petro-50 dark:bg-petro-950/50 text-petro-700 dark:text-petro-300 border border-petro-200 dark:border-petro-800"
                  >
                    <span>{bn ? 'Alljobs-এ দেখুন' : 'View on Alljobs'}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {selectedOrg.logoUrl && !failedLogos.has(selectedOrg.organizationId) ? (
                  <img
                    src={selectedOrg.logoUrl}
                    alt={selectedOrg.name}
                    onError={() =>
                      setFailedLogos((prev) => new Set(prev).add(selectedOrg.organizationId))
                    }
                    className="w-14 h-14 rounded-2xl object-contain border border-slate-200 dark:border-slate-700 bg-white p-1 shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-petro-600 to-navy-900 text-white font-black text-sm flex items-center justify-center shrink-0">
                    {getOrgInitials(selectedOrg.name, selectedOrg.shortName)}
                  </div>
                )}

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-petro-100 text-petro-800 dark:bg-petro-950/60 dark:text-petro-300">
                      {selectedOrg.shortName}
                    </span>
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                      {bn ? `খোলা পদ: ${selectedOrg.openingCount}` : `Openings: ${selectedOrg.openingCount}`}
                    </span>
                  </div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white mt-1">
                    {selectedOrg.name}
                  </h2>
                  {selectedOrg.nameBn && (
                    <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      {selectedOrg.nameBn}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
            <span>
              {bn
                ? `মোট ${filteredJobs.length}টি চাকরির বিজ্ঞপ্তি দেখানো হচ্ছে`
                : `Showing ${filteredJobs.length} job circular(s)`}
            </span>
            {orgDetailLoading && (
              <span className="text-petro-600 font-semibold">
                {bn ? 'প্রতিষ্ঠানের বিস্তারিত পদ আপডেট হচ্ছে...' : 'Refreshing organization openings...'}
              </span>
            )}
          </div>

          {filteredJobs.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center space-y-3">
              <Briefcase className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto" />
              <div className="text-sm font-bold text-slate-700 dark:text-slate-200">
                {bn ? 'কোনো সরকারি চাকরি পাওয়া যায়নি' : 'No matching government job circulars found'}
              </div>
              <button
                type="button"
                onClick={clearAllFilters}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-petro-600 hover:bg-petro-700 text-white cursor-pointer"
              >
                {bn ? 'ফিল্টার মুছুন' : 'Clear Filters'}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {paginatedJobs.map((job) => {
                const isExpired =
                  job.status === 'expired' ||
                  (job.deadlineVerified && typeof job.deadlineAt === 'number' && job.deadlineAt <= Date.now());
                const appUrlSafe = verifyJobUrl(job.applicationUrl);
                const jobCode = sanitizeCircularRefForDisplay(job.circularNumber || job.sourceJobId);

                return (
                  <article
                    key={job.id}
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs hover:border-emerald-300 transition-all flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                          <span
                            className={`font-semibold px-2.5 py-0.5 rounded-full border ${
                              isExpired
                                ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300'
                            }`}
                          >
                            {isExpired ? (bn ? 'মেয়াদোত্তীর্ণ' : 'Expired') : bn ? 'চলমান (Live)' : 'Live'}
                          </span>
                          {jobCode && (
                            <span className="font-medium px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {jobCode}
                            </span>
                          )}
                          {job.organizationShortName && (
                            <span className="font-semibold px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900">
                              {job.organizationShortName}
                            </span>
                          )}
                        </div>

                        <DeadlineCountdown
                          deadlineAt={job.deadlineAt}
                          deadlineVerified={job.deadlineVerified}
                          language={language}
                          compact
                        />
                      </div>

                      <div>
                        <h3 className="text-base font-semibold text-slate-900 dark:text-white leading-snug break-words">
                          {job.position || job.jobTitle}
                        </h3>
                        {job.titleBn && job.titleBn !== job.position && (
                          <div className="text-xs font-medium text-slate-600 dark:text-slate-400 mt-0.5 break-words">
                            {job.titleBn}
                          </div>
                        )}
                        <div className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mt-1 break-words">
                          {job.organization}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11.5px] text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>
                            {bn ? 'শূন্যপদ:' : 'Vacancy:'}{' '}
                            <strong>
                              {job.vacancies !== null && job.vacancies !== undefined
                                ? job.vacancies
                                : bn ? 'নির্দিষ্ট নয়' : 'Not specific'}
                            </strong>
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>
                            {bn ? 'আবেদন শুরু:' : 'Start Date:'}{' '}
                            <strong>
                              {job.applicationStartAt
                                ? formatDhakaDate(job.applicationStartAt)
                                : job.publishedAt
                                  ? formatDhakaDate(job.publishedAt)
                                  : bn ? 'উল্লেখ নেই' : 'Not specified'}
                            </strong>
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 sm:col-span-2">
                          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>
                            {bn ? 'শেষ তারিখ:' : 'Deadline:'}{' '}
                            <strong className={!job.deadlineVerified ? 'text-amber-700 dark:text-amber-400' : ''}>
                              {job.deadlineVerified && job.deadlineAt
                                ? formatDhakaDate(job.deadlineAt)
                                : bn ? 'শেষ তারিখ যাচাইকৃত নয়' : 'Deadline Not Verified'}
                            </strong>
                          </span>
                        </div>
                        {appUrlSafe.isSafeToOpen && job.applicationUrl && (
                          <div className="sm:col-span-2 flex items-center gap-1.5 text-[11px]">
                            <Globe className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <a
                              href={appUrlSafe.normalizedUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium text-emerald-700 dark:text-emerald-400 hover:underline inline-flex items-center gap-1 truncate"
                            >
                              <span>
                                {bn ? 'আবেদন পোর্টাল' : 'Apply Portal'} ({appUrlSafe.hostname})
                              </span>
                              <ExternalLink className="w-3 h-3 shrink-0" />
                            </a>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <BookmarkButton
                          isBookmarked={bookmarkedIds.has(job.id)}
                          onToggle={async () => {
                            const res = await toggleJobBookmarkAndSync(
                              job.id,
                              teletalkJobs,
                              appByJobId.get(job.id),
                              showToast,
                              bn
                            );
                            setBookmarkedIds(res.bookmarkedIds);
                            setApplications(res.applications);
                            onDataChanged?.();
                          }}
                          compact
                          language={language}
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            const apps = await markJobAppliedAndSync(
                              job,
                              appByJobId.get(job.id),
                              showToast,
                              bn
                            );
                            setApplications(apps);
                            onDataChanged?.();
                          }}
                          className={`inline-flex items-center gap-1 h-8 px-2.5 rounded-lg text-xs font-semibold border cursor-pointer transition-colors ${
                            appByJobId.get(job.id)?.status === 'Applied'
                              ? 'bg-emerald-600 text-white border-emerald-700'
                              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>
                            {appByJobId.get(job.id)?.status === 'Applied' ? 'Applied' : 'Mark Applied'}
                          </span>
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedJob(job)}
                          className="inline-flex items-center gap-1 h-8 px-3 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 cursor-pointer transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>{bn ? 'বিস্তারিত দেখুন' : 'View Details'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => openJobApplicationWithContext(job, showToast, bn, setMissingAppJob)}
                          className="inline-flex items-center gap-1 h-8 px-3.5 rounded-lg text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs cursor-pointer transition-colors"
                        >
                          <span>{bn ? 'সরাসরি আবেদন করুন' : 'Apply Now'}</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {filteredJobs.length > 0 && totalJobsPages > 1 && (
            <nav
              aria-label="Government jobs pagination"
              className="flex flex-wrap items-center justify-between gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs"
            >
              <span className="text-slate-500 dark:text-slate-400 font-semibold">
                {bn
                  ? `পৃষ্ঠা ${safeJobsPage} / ${totalJobsPages} (মোট ${filteredJobs.length}টি)`
                  : `Page ${safeJobsPage} of ${totalJobsPages} (${filteredJobs.length} openings)`}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={safeJobsPage <= 1}
                  onClick={() => setJobsPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-lg font-bold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                >
                  {bn ? 'পূর্ববর্তী' : 'Previous'}
                </button>
                <button
                  type="button"
                  disabled={safeJobsPage >= totalJobsPages}
                  onClick={() => setJobsPage((p) => Math.min(totalJobsPages, p + 1))}
                  className="px-3 py-1.5 rounded-lg font-bold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                >
                  {bn ? 'পরবর্তী' : 'Next'}
                </button>
              </div>
            </nav>
          )}
        </div>
      ) : (
        /* Government Organization Directory Grid (Alljobs Style Card Layout) */
        <div className="space-y-3">
          {filteredOrgs.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center space-y-3">
              <Building2 className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto" />
              <div className="text-sm font-bold text-slate-700 dark:text-slate-200">
                {bn ? 'কোনো সরকারি প্রতিষ্ঠান পাওয়া যায়নি' : 'No matching government organizations found'}
              </div>
              <button
                type="button"
                onClick={handleFetchLatest}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-petro-600 hover:bg-petro-700 text-white cursor-pointer"
              >
                {bn ? 'সর্বশেষ তালিকা আনুন' : 'Fetch Latest Organizations'}
              </button>
            </div>
          ) : (
            <div
              role="list"
              aria-label="Government organizations directory"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              {filteredOrgs.map((org) => {
                const showImg = org.logoUrl && !failedLogos.has(org.organizationId);
                return (
                  <div
                    key={org.organizationId}
                    role="listitem"
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-petro-400 dark:hover:border-petro-700 p-4 sm:p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between gap-4"
                  >
                    <div className="flex items-start gap-3.5">
                      {showImg ? (
                        <img
                          src={org.logoUrl}
                          alt={org.name}
                          onError={() =>
                            setFailedLogos((prev) => new Set(prev).add(org.organizationId))
                          }
                          className="w-14 h-14 rounded-xl object-contain border border-slate-200 dark:border-slate-700 bg-white p-1 shrink-0"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-petro-600 to-navy-900 text-white font-black text-xs flex items-center justify-center shrink-0">
                          {getOrgInitials(org.name, org.shortName)}
                        </div>
                      )}

                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-petro-50 text-petro-800 border border-petro-200 dark:bg-petro-950/60 dark:text-petro-300 dark:border-petro-800">
                            {org.shortName}
                          </span>
                          <span className="text-[11px] font-extrabold text-emerald-700 dark:text-emerald-400">
                            {bn ? `পদ: ${org.openingCount}` : `Openings: ${org.openingCount}`}
                          </span>
                        </div>

                        <h3 className="text-sm font-extrabold text-slate-800 dark:text-white leading-snug line-clamp-2">
                          {org.name}
                        </h3>
                        {org.nameBn && (
                          <div className="text-[11.5px] text-slate-500 dark:text-slate-400 line-clamp-1">
                            {org.nameBn}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                      {org.website && verifyJobUrl(org.website).isSafeToOpen ? (
                        <a
                          href={org.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] font-semibold text-slate-500 hover:text-petro-700 inline-flex items-center gap-1 truncate max-w-[140px]"
                        >
                          <Globe className="w-3 h-3 shrink-0" />
                          <span className="truncate">{bn ? 'ওয়েবসাইট' : 'Website'}</span>
                        </a>
                      ) : (
                        <span className="text-[11px] text-slate-400">ID: {org.organizationId}</span>
                      )}

                      <button
                        type="button"
                        onClick={() => handleSelectOrganization(org)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-petro-600 hover:bg-petro-700 text-white shadow-xs cursor-pointer shrink-0"
                      >
                        <span>{bn ? 'চাকরি দেখুন' : 'View Jobs'}</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Source Notes Footer */}
      {sourceOutcome && (
        <div className="text-[11px] text-slate-500 dark:text-slate-400 text-center">
          {sourceOutcome.accessNotes}
        </div>
      )}
      <MissingApplicationUrlModal
        job={missingAppJob}
        language={language}
        onClose={() => setMissingAppJob(null)}
      />
    </div>
  );
};
