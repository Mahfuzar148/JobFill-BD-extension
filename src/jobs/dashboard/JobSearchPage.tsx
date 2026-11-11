// JobFill BD - Dedicated Job Search Page
// Google-style clean search experience across locally indexed circulars and configured sources.
// Zero Google branding; never claims to index the entire web or invent missing job metadata.

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Search,
  RefreshCw,
  SlidersHorizontal,
  X,
  Bookmark,
  RotateCcw,
  Clock,
  WifiOff,
  AlertTriangle,
  Sparkles,
  PlusCircle,
} from 'lucide-react';
import { useApp } from '../../dashboard/context/AppContext';
import { CompactSourceHealthBar } from './CompactSourceHealthBar';
import { JobCard } from './JobCard';
import {
  NormalizedJobCircular,
  ApplicationTrackerRecord,
  SearchIndexEntry,
  SavedSearchRecord,
  SyncHistoryRecord,
  JobCategory,
  EducationRequirement,
  DeadlineFilterOption,
} from '../types/job.types';
import { JobRepository } from '../database/job-repository';
import { BookmarkRepository } from '../database/bookmark-repository';
import { ApplicationRepository } from '../database/application-repository';
import { JobSourceRegistry } from '../sources/source-registry';
import { JobCheckService } from '../background/job-check-service';
import { SourceProgressEvent } from '../services/job-fetcher';
import {
  SEARCH_ENGINE_CATEGORIES,
  JobSearchQueryState,
  SearchSortMode,
  searchAndRankJobs,
  getSearchSuggestions,
  registerDynamicOrgAliases,
} from '../services/search-engine';
import {
  computeSourceHealthSummary,
  computeSearchResultMetrics,
  formatSourceFailureAlertMessage,
  formatJobCategoryLabel,
} from '../services/source-health-state';
import { EDUCATION_LEVELS, JOB_LOCATIONS } from './JobFilters';
import { JobDetails } from './JobDetails';
import {
  AddJobCircularModal,
  ManualJobCircularPrefill,
  buildPrefillFromSourceHealthItem,
} from './AddJobCircularModal';
import { MissingApplicationUrlModal } from './MissingApplicationUrlModal';
import { NotificationScheduler } from '../notifications/notification-scheduler';
import { runOpenTabPortalSyncWithFeedback } from '../services/open-tab-portal-sync';
import {
  openJobApplicationWithContext,
  toggleJobBookmarkAndSync,
  markJobAppliedAndSync,
  verifyJobManualDeadline,
  shareJobCircular,
} from '../services/job-ui-actions';

interface JobSearchPageProps {
  initialSelectedJobId?: string | null;
  onDataChanged?: () => void;
}

const DEFAULT_SEARCH_STATE: JobSearchQueryState = {
  query: '',
  category: 'All',
  education: 'All',
  location: 'All',
  deadline: 'all',
  skillsOrExperience: '',
  sortBy: 'relevance',
  bookmarkedOnly: false,
};

export const JobSearchPage: React.FC<JobSearchPageProps> = ({
  initialSelectedJobId,
  onDataChanged,
}) => {
  const { language, showToast } = useApp();
  const bn = language === 'bn';

  const [jobs, setJobs] = useState<NormalizedJobCircular[]>([]);
  const [searchIndexMap, setSearchIndexMap] = useState<Map<string, SearchIndexEntry>>(new Map());
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [applications, setApplications] = useState<ApplicationTrackerRecord[]>([]);
  const [sourceOutcomes, setSourceOutcomes] = useState<any[]>([]);
  const [syncHistory, setSyncHistory] = useState<SyncHistoryRecord[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [savedSearches, setSavedSearches] = useState<SavedSearchRecord[]>([]);
  const [hiddenJobIds, setHiddenJobIds] = useState<string[]>([]);
  const [lastSuccessfulSyncAt, setLastSuccessfulSyncAt] = useState<number | null>(null);

  const [draftQuery, setDraftQuery] = useState('');
  const [searchState, setSearchState] = useState<JobSearchQueryState>(DEFAULT_SEARCH_STATE);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(true);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showSourcesDrawer, setShowSourcesDrawer] = useState(false);

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [hardSyncError, setHardSyncError] = useState<string | null>(null);
  const [lastRunNewJobsCount, setLastRunNewJobsCount] = useState<number | null>(null);
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== 'undefined' && navigator.onLine === false
  );
  const [sourceProgress, setSourceProgress] = useState<{
    completed: number;
    total: number;
    activeSourceName: string;
    statuses: Record<string, { name: string; phase: 'fetching' | 'completed' | 'failed'; count?: number; error?: string }>;
  } | null>(null);

  const [selectedJob, setSelectedJob] = useState<NormalizedJobCircular | null>(null);
  const [missingAppJob, setMissingAppJob] = useState<NormalizedJobCircular | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [manualPrefill, setManualPrefill] = useState<ManualJobCircularPrefill | null>(null);
  const lastInitialJobRef = useRef<string | null>(null);

  const loadAllState = useCallback(async () => {
    const [
      loadedJobs,
      govtOrgs,
      bmIds,
      apps,
      outcomes,
      history,
      recent,
      saved,
      hidden,
      schedState,
    ] = await Promise.all([
      JobRepository.getAllJobs(),
      JobRepository.getGovtOrganizations(),
      BookmarkRepository.getBookmarkedJobIds(),
      ApplicationRepository.getAll(),
      JobRepository.getSourceOutcomes(),
      JobRepository.getSyncHistory(10),
      JobRepository.getRecentSearches(),
      JobRepository.getSavedSearches(),
      JobRepository.getHiddenJobIds(),
      JobRepository.getSchedulerState(),
    ]);

    registerDynamicOrgAliases(govtOrgs);
    // Non-destructively upgrade/sync search index when new jobs or updated schema exist
    const effectiveIndex = await JobRepository.ensureSearchIndexCurrent(loadedJobs);

    setJobs(loadedJobs);
    setSearchIndexMap(effectiveIndex);
    setBookmarkedIds(bmIds);
    setApplications(apps);
    setSourceOutcomes(outcomes);
    setSyncHistory(history);
    setRecentSearches(recent);
    setSavedSearches(saved);
    setHiddenJobIds(hidden);
    setLastSuccessfulSyncAt(schedState.lastSuccessfulSyncAt ?? null);
  }, []);

  const handleFetchLatest = useCallback(async (targetSourceIds?: string[]) => {
    const isTargeted = Array.isArray(targetSourceIds) && targetSourceIds.length > 0;
    if (isTargeted && targetSourceIds!.length === 1) {
      const currentSummary = computeSourceHealthSummary(JobSourceRegistry.getAll(), sourceOutcomes);
      const targetItem = currentSummary.sources.find((s) => s.sourceId === targetSourceIds![0]);
      if (targetItem && !targetItem.retryAvailable) {
        showToast(bn ? targetItem.retryAvailabilityNoteBn : targetItem.retryAvailabilityNote);
        return;
      }
    }
    setSyncing(true);
    setHardSyncError(null);
    const total = isTargeted ? targetSourceIds!.length : JobSourceRegistry.getAll().length;
    setSourceProgress({
      completed: 0,
      total,
      activeSourceName: bn ? 'সূত্রসমূহ প্রস্তুত হচ্ছে...' : 'Preparing sources...',
      statuses: {},
    });

    try {
      const report = await JobCheckService.runFullCheck({
        sourceIds: isTargeted ? targetSourceIds : undefined,
        respectCooldowns: !isTargeted,
        onSourceProgress: (ev: SourceProgressEvent) => {
          setSourceProgress((prev) => {
            const nextStatuses = { ...(prev?.statuses || {}) };
            nextStatuses[ev.sourceId] = {
              name: ev.sourceName,
              phase: ev.phase,
              count: ev.outcome?.jobs.length,
              error: ev.outcome?.error,
            };
            return {
              completed: ev.completedCount,
              total: ev.totalCount,
              activeSourceName:
                ev.phase === 'fetching'
                  ? ev.sourceName
                  : prev?.activeSourceName || ev.sourceName,
              statuses: nextStatuses,
            };
          });
        },
      });

      setLastRunNewJobsCount(report.newJobsCount);
      await loadAllState();
      onDataChanged?.();

      showToast(
        bn
          ? `✅ লাইভ সার্চ সিঙ্ক সম্পন্ন: ${report.newJobsCount}টি নতুন বিজ্ঞপ্তি`
          : `✅ Live fetch complete: ${report.newJobsCount} new circular(s) added`
      );
    } catch (err: any) {
      const msg = err?.message || 'Live discovery failed';
      setHardSyncError(msg);
      showToast(`❌ ${msg}`);
    } finally {
      setSyncing(false);
    }
  }, [bn, loadAllState, onDataChanged, showToast, sourceOutcomes]);

  const handleFetchLatestRef = useRef(handleFetchLatest);
  handleFetchLatestRef.current = handleFetchLatest;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await loadAllState();
        const current = await JobRepository.getAllJobs();
        if (!cancelled && current.length === 0) {
          setLoading(false);
          await handleFetchLatestRef.current();
          return;
        }
      } catch (err: any) {
        if (!cancelled) {
          setHardSyncError(err?.message || 'Failed to load indexed jobs');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadAllState]);

  // Debounce live typing into searchState.query
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchState((prev) => (prev.query === draftQuery ? prev : { ...prev, query: draftQuery }));
    }, 180);
    return () => clearTimeout(timer);
  }, [draftQuery]);

  // Network listeners
  useEffect(() => {
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    if (initialSelectedJobId && initialSelectedJobId !== lastInitialJobRef.current) {
      const found = jobs.find((j) => j.id === initialSelectedJobId);
      if (found) {
        lastInitialJobRef.current = initialSelectedJobId;
        setSelectedJob(found);
      }
    }
  }, [initialSelectedJobId, jobs]);

  const hiddenSet = useMemo(() => new Set(hiddenJobIds), [hiddenJobIds]);
  const appByJobId = useMemo(() => {
    const map = new Map<string, ApplicationTrackerRecord>();
    for (const a of applications) map.set(a.jobId, a);
    return map;
  }, [applications]);

  const suggestions = useMemo(
    () => getSearchSuggestions(jobs, draftQuery, 7),
    [jobs, draftQuery]
  );

  const rankedResults = useMemo(
    () => searchAndRankJobs(jobs, searchState, bookmarkedIds, hiddenSet, searchIndexMap),
    [jobs, searchState, bookmarkedIds, hiddenSet, searchIndexMap]
  );

  const SEARCH_PAGE_SIZE = 20;
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(rankedResults.length / SEARCH_PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedResults = useMemo(() => {
    const start = (safeCurrentPage - 1) * SEARCH_PAGE_SIZE;
    return rankedResults.slice(start, start + SEARCH_PAGE_SIZE);
  }, [rankedResults, safeCurrentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchState, hiddenJobIds]);

  const activeFiltersList = useMemo(() => {
    const chips: Array<{ key: string; label: string; clear: () => void }> = [];
    if (searchState.query.trim()) {
      chips.push({
        key: 'query',
        label: `"${searchState.query.trim()}"`,
        clear: () => {
          setDraftQuery('');
          setSearchState((prev) => ({ ...prev, query: '' }));
        },
      });
    }
    if (searchState.category !== 'All') {
      chips.push({
        key: 'category',
        label: formatJobCategoryLabel(searchState.category, bn),
        clear: () => setSearchState((prev) => ({ ...prev, category: 'All' })),
      });
    }
    if (searchState.education !== 'All') {
      chips.push({
        key: 'education',
        label: searchState.education,
        clear: () => setSearchState((prev) => ({ ...prev, education: 'All' })),
      });
    }
    if (searchState.location !== 'All') {
      chips.push({
        key: 'location',
        label: searchState.location,
        clear: () => setSearchState((prev) => ({ ...prev, location: 'All' })),
      });
    }
    if (searchState.deadline !== 'all') {
      chips.push({
        key: 'deadline',
        label: `Deadline: ${searchState.deadline.replace(/_/g, ' ')}`,
        clear: () => setSearchState((prev) => ({ ...prev, deadline: 'all' })),
      });
    }
    if (searchState.skillsOrExperience.trim()) {
      chips.push({
        key: 'skills',
        label: `Skill/Exp: ${searchState.skillsOrExperience.trim()}`,
        clear: () => setSearchState((prev) => ({ ...prev, skillsOrExperience: '' })),
      });
    }
    if (searchState.bookmarkedOnly) {
      chips.push({
        key: 'bookmarked',
        label: bn ? 'শুধু বুকমার্ক' : 'Bookmarked Only',
        clear: () => setSearchState((prev) => ({ ...prev, bookmarkedOnly: false })),
      });
    }
    return chips;
  }, [searchState, bn]);

  const handleSubmitSearch = async (e?: React.FormEvent, explicitQuery?: string) => {
    e?.preventDefault();
    const nextQuery = (explicitQuery ?? draftQuery).trim();
    if (explicitQuery !== undefined) setDraftQuery(nextQuery);
    setSearchState((prev) => ({ ...prev, query: nextQuery }));
    setShowSuggestions(false);
    if (nextQuery) {
      setRecentSearches(await JobRepository.addRecentSearch(nextQuery));
    }
  };

  const handleClearFilters = () => {
    setDraftQuery('');
    setSearchState(DEFAULT_SEARCH_STATE);
    setShowSuggestions(false);
  };

  const handleSaveCurrentSearch = async () => {
    const labelParts = [
      searchState.query.trim(),
      searchState.category !== 'All' ? searchState.category : '',
      searchState.location !== 'All' ? searchState.location : '',
      searchState.education !== 'All' ? searchState.education : '',
    ].filter(Boolean);
    const label = labelParts.length > 0 ? labelParts.join(' • ') : bn ? 'সব চাকরি' : 'All Jobs';
    const updated = await JobRepository.saveSavedSearch({
      label,
      query: searchState.query.trim(),
      category: searchState.category,
      location: searchState.location,
      education: searchState.education,
    });
    setSavedSearches(updated);
    showToast(bn ? '⭐ সার্চ ফিল্টার সংরক্ষিত হয়েছে' : '⭐ Search saved for quick access');
  };

  const handleHideResult = async (jobId: string) => {
    setHiddenJobIds(await JobRepository.hideJobId(jobId));
    showToast(bn ? 'এই ফলাফলটি লুকানো হয়েছে' : 'Result hidden from search list');
  };

  const handleUnhideAll = async () => {
    setHiddenJobIds(await JobRepository.unhideAllJobs());
    showToast(bn ? 'সব লুকানো ফলাফল পুনরায় দেখানো হচ্ছে' : 'All hidden results restored');
  };

  const handleSaveManualCircular = async (job: NormalizedJobCircular) => {
    await JobRepository.saveJob(job);
    const updatedJobs = await JobRepository.getAllJobs();
    await JobRepository.rebuildSearchIndex(updatedJobs);
    await NotificationScheduler.runCycle();
    await loadAllState();
    onDataChanged?.();
    showToast(bn ? '✅ নতুন সার্কুলার সংরক্ষিত হয়েছে' : '✅ Job circular saved');
  };

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
            const res = await toggleJobBookmarkAndSync(jobId, jobs, appByJobId.get(jobId), showToast, bn);
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
            const target = jobs.find((j) => j.id === jobId);
            if (!target) return;
            const updated = await verifyJobManualDeadline(target, newDeadlineText, showToast, bn);
            if (updated) {
              await loadAllState();
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

  const allAdapters = JobSourceRegistry.getAll();
  const sourceHealth = computeSourceHealthSummary(
    allAdapters,
    sourceOutcomes,
    lastSuccessfulSyncAt
  );
  const searchMetrics = computeSearchResultMetrics({
    totalIndexedJobs: searchIndexMap.size > 0 ? searchIndexMap.size : jobs.length,
    totalStoredJobs: jobs.length,
    totalMatchingJobs: rankedResults.length,
    currentlyDisplayedJobs: paginatedResults.length,
    sourceHealth,
    latestSync: syncHistory[0] ?? null,
    lastRunNewJobsCount,
  });
  const activeSyncAlertMessage = hardSyncError || formatSourceFailureAlertMessage(sourceHealth, bn);
  const activeFilterCount = activeFiltersList.length;
  const sortLabels: Record<SearchSortMode, { en: string; bn: string }> = {
    relevance: { en: 'Best Match', bn: 'সর্বোচ্চ প্রাসঙ্গিক' },
    latest_published: { en: 'Latest Published', bn: 'সর্বশেষ প্রকাশিত' },
    deadline_soonest: { en: 'Deadline Soonest', bn: 'সময়সীমা কাছাকাছি' },
    organization_name: { en: 'Organization (A-Z)', bn: 'প্রতিষ্ঠান (A-Z)' },
  };
  const popularQueries = bn
    ? ['BPSC', 'ব্যাংক', 'সহকারী প্রকৌশলী', 'শিক্ষক', 'Remote']
    : ['BPSC', 'Bangladesh Bank', 'Assistant Engineer', 'Teacher', 'Remote'];

  return (
    <div className="space-y-4">
      {/* Focused Search Header & Filters */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              {bn ? 'স্মার্ট জব সার্চ' : 'Job Search'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {bn
                ? 'কনফিগারকৃত সরকারি, ব্যাংক, NGO ও রিমোট সোর্স এবং লোকাল ইনডেক্স থেকে সরাসরি বিজ্ঞপ্তি খুঁজুন।'
                : 'Search across locally indexed circulars and configured Bangladesh & international job portals.'}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={handleSaveCurrentSearch}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer transition-colors"
            >
              <PlusCircle className="w-3.5 h-3.5 text-emerald-600" />
              <span>{bn ? 'সার্চ সেভ করুন' : 'Save Search'}</span>
            </button>
          </div>
        </div>

        {/* Main Search Bar + Primary Actions */}
        <form onSubmit={(e) => handleSubmitSearch(e)} className="space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                aria-label={bn ? 'চাকরি খুঁজুন' : 'Search jobs'}
                value={draftQuery}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 160)}
                onChange={(e) => {
                  setDraftQuery(e.target.value);
                  setShowSuggestions(true);
                }}
                placeholder={
                  bn
                    ? 'পদবি, প্রতিষ্ঠান, যোগ্যতা বা এলাকা লিখুন (যেমন: BPSC, ব্যাংক, প্রকৌশলী, ঢাকা)...'
                    : 'Search job title, organization, qualification, location, or circular...'
                }
                className="w-full h-11 pl-10 pr-9 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/80 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15 focus:bg-white dark:focus:bg-slate-900 transition-all"
              />
              {draftQuery && (
                <button
                  type="button"
                  aria-label="Clear search query"
                  onClick={() => {
                    setDraftQuery('');
                    setSearchState((prev) => ({ ...prev, query: '' }));
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}

              {/* Search Suggestions Dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div
                  role="listbox"
                  aria-label="Search suggestions"
                  className="absolute left-0 right-0 top-full mt-1.5 z-30 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden py-1"
                >
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSubmitSearch(undefined, suggestion);
                      }}
                      className="w-full px-3.5 py-2 text-left text-xs text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 flex items-center gap-2 cursor-pointer"
                    >
                      <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{suggestion}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="submit"
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 h-11 px-5 rounded-xl text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs cursor-pointer transition-colors"
              >
                <Search className="w-4 h-4" />
                <span>{bn ? 'খুঁজুন' : 'Search'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleFetchLatest()}
                disabled={syncing}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 h-11 px-4 rounded-xl text-xs font-semibold border border-emerald-200 dark:border-emerald-800 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 disabled:opacity-50 cursor-pointer transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                <span className="whitespace-nowrap">
                  {syncing
                    ? bn ? 'সিঙ্ক হচ্ছে...' : 'Fetching...'
                    : bn ? 'সর্বশেষ আনুন' : 'Fetch Latest'}
                </span>
              </button>
            </div>
          </div>

          {/* Recent & Popular Suggestions + Saved Searches */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <div className="flex items-center flex-wrap gap-1.5 min-w-0">
              {recentSearches.length > 0 ? (
                <>
                  <span className="text-slate-500 font-medium">{bn ? 'সাম্প্রতিক:' : 'Recent:'}</span>
                  {recentSearches.slice(0, 4).map((term) => (
                    <button
                      key={term}
                      type="button"
                      onClick={() => handleSubmitSearch(undefined, term)}
                      className="px-2.5 py-0.5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium cursor-pointer"
                    >
                      {term}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={async () => setRecentSearches(await JobRepository.clearRecentSearches())}
                    className="text-slate-400 hover:text-rose-600 font-medium px-1 cursor-pointer"
                  >
                    {bn ? 'মুছুন' : 'Clear'}
                  </button>
                </>
              ) : (
                <>
                  <span className="text-slate-500 font-medium inline-flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-emerald-600" />
                    {bn ? 'জনপ্রিয়:' : 'Popular:'}
                  </span>
                  {popularQueries.map((term) => (
                    <button
                      key={term}
                      type="button"
                      onClick={() => handleSubmitSearch(undefined, term)}
                      className="px-2.5 py-0.5 rounded-full bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium cursor-pointer transition-colors"
                    >
                      {term}
                    </button>
                  ))}
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => setMobileFiltersOpen((v) => !v)}
              className="md:hidden inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>{bn ? 'ফিল্টার' : 'Filters'}</span>
              {activeFilterCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-emerald-600 text-white text-[10px]">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {savedSearches.length > 0 && (
            <div className="flex items-center flex-wrap gap-1.5 text-[11px]">
              <span className="text-slate-500 font-semibold inline-flex items-center gap-1">
                <Bookmark className="w-3 h-3 text-emerald-600" />
                {bn ? 'সংরক্ষিত সার্চ:' : 'Saved Searches:'}
              </span>
              {savedSearches.map((saved) => (
                <span
                  key={saved.id}
                  className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-medium"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setDraftQuery(saved.query);
                      setSearchState((prev) => ({
                        ...prev,
                        query: saved.query,
                        category: saved.category || 'All',
                        location: saved.location || 'All',
                        education: (saved.education as EducationRequirement | 'All') || 'All',
                      }));
                    }}
                    className="hover:underline cursor-pointer"
                  >
                    {saved.label}
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete saved search ${saved.label}`}
                    onClick={async () => setSavedSearches(await JobRepository.deleteSavedSearch(saved.id))}
                    className="p-0.5 rounded-full hover:bg-emerald-200/70 text-emerald-700 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Category Pills */}
          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            {SEARCH_ENGINE_CATEGORIES.map((cat) => {
              const selected = searchState.category === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() =>
                    setSearchState((prev) => ({ ...prev, category: cat as JobCategory | 'All' }))
                  }
                  className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
                    selected
                      ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {formatJobCategoryLabel(cat, bn)}
                </button>
              );
            })}
          </div>

          {/* Responsive Filters Row (Always visible md+, collapsible on mobile) */}
          {showAdvancedFilters && (
            <div
              className={`${
                mobileFiltersOpen ? 'grid' : 'hidden md:grid'
              } grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2 pt-3 border-t border-slate-100 dark:border-slate-800`}
            >
              <select
                aria-label="Filter by Education"
                value={searchState.education}
                onChange={(e) =>
                  setSearchState((prev) => ({
                    ...prev,
                    education: e.target.value as EducationRequirement | 'All',
                  }))
                }
                className="h-9 text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
              >
                <option value="All">{bn ? 'সব যোগ্যতা' : 'All Qualifications'}</option>
                {EDUCATION_LEVELS.map((ed) => (
                  <option key={ed} value={ed}>
                    {ed}
                  </option>
                ))}
              </select>

              <select
                aria-label="Filter by Location"
                value={searchState.location}
                onChange={(e) =>
                  setSearchState((prev) => ({ ...prev, location: e.target.value }))
                }
                className="h-9 text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
              >
                <option value="All">{bn ? 'সব এলাকা' : 'All Locations'}</option>
                {JOB_LOCATIONS.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>

              <select
                aria-label="Filter by Deadline"
                value={searchState.deadline}
                onChange={(e) =>
                  setSearchState((prev) => ({
                    ...prev,
                    deadline: e.target.value as DeadlineFilterOption,
                  }))
                }
                className="h-9 text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
              >
                <option value="all">{bn ? 'সব সময়সীমা' : 'All Deadlines'}</option>
                <option value="closing_today">{bn ? 'আজই শেষ' : 'Closing Today'}</option>
                <option value="1_to_2_days">{bn ? '১-২ দিনের মধ্যে' : '1-2 Days Left'}</option>
                <option value="3_to_7_days">{bn ? '৩-৭ দিনের মধ্যে' : '3-7 Days Left'}</option>
                <option value="closing_soon">{bn ? 'শীঘ্রই শেষ (৭ দিন)' : 'Closing Soon (<=7d)'}</option>
                <option value="more_than_7_days">{bn ? '৭+ দিন বাকি' : '>7 Days Remaining'}</option>
                <option value="expired">{bn ? 'মেয়াদোত্তীর্ণ' : 'Expired'}</option>
              </select>

              <input
                type="text"
                aria-label="Skills or Experience"
                value={searchState.skillsOrExperience}
                onChange={(e) =>
                  setSearchState((prev) => ({ ...prev, skillsOrExperience: e.target.value }))
                }
                placeholder={bn ? 'দক্ষতা / অভিজ্ঞতা (যেমন: React)' : 'Skills / Experience (e.g. 2 years)'}
                className="h-9 text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
              />

              <select
                aria-label="Sort Results"
                value={searchState.sortBy}
                onChange={(e) =>
                  setSearchState((prev) => ({ ...prev, sortBy: e.target.value as SearchSortMode }))
                }
                className="h-9 text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium"
              >
                <option value="relevance">{bn ? 'ক্রম: প্রাসঙ্গিক' : 'Sort: Best Match'}</option>
                <option value="latest_published">{bn ? 'ক্রম: সর্বশেষ' : 'Sort: Latest Published'}</option>
                <option value="deadline_soonest">{bn ? 'ক্রম: শেষ তারিখ' : 'Sort: Deadline Soonest'}</option>
                <option value="organization_name">{bn ? 'ক্রম: প্রতিষ্ঠান (A-Z)' : 'Sort: Organization (A-Z)'}</option>
              </select>

              <label className="h-9 flex items-center justify-center gap-2 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(searchState.bookmarkedOnly)}
                  onChange={(e) =>
                    setSearchState((prev) => ({ ...prev, bookmarkedOnly: e.target.checked }))
                  }
                  className="rounded text-emerald-600"
                />
                <span>{bn ? 'শুধু বুকমার্ক' : 'Bookmarked Only'}</span>
              </label>
            </div>
          )}
        </form>
      </section>

      {/* Compact Single-Line Live Source Health Bar (Full Table Collapsed by Default) */}
      <CompactSourceHealthBar
        adapters={allAdapters}
        outcomes={sourceOutcomes}
        healthSummary={sourceHealth}
        jobs={jobs}
        lastSuccessfulSyncAt={lastSuccessfulSyncAt}
        syncing={syncing}
        progress={
          sourceProgress
            ? {
                completed: sourceProgress.completed,
                total: sourceProgress.total,
                activeSourceName: sourceProgress.activeSourceName,
              }
            : null
        }
        syncHistory={syncHistory}
        expanded={showSourcesDrawer}
        onToggleExpanded={() => setShowSourcesDrawer((v) => !v)}
        onRetryFailed={(failedIds) => handleFetchLatest(failedIds)}
        onRetrySingleSource={(sourceId) => handleFetchLatest([sourceId])}
        onOpenManualAdd={(item) => {
          setManualPrefill(buildPrefillFromSourceHealthItem(item));
          setShowAddModal(true);
        }}
        onSyncFromOpenTab={(item) => {
          void runOpenTabPortalSyncWithFeedback({
            portalUrl: item.directPortalUrl,
            bn,
            showToast,
            onImported: async () => {
              await loadAllState();
              onDataChanged?.();
            },
          });
        }}
        onViewBankJobs={() => {
          setSearchState((prev) => ({ ...prev, category: 'Bank' }));
        }}
        bn={bn}
      />

      {/* Offline / Partial Failure Banners */}
      {isOffline && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200">
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              {bn
                ? 'ইন্টারনেট সংযোগ বিচ্ছিন্ন। সংরক্ষিত লোকাল সার্কুলারে সার্চ সচল আছে।'
                : 'You appear to be offline. Search continues to run locally against your previously cached circulars.'}
            </span>
          </div>
          <button
            type="button"
            onClick={() =>
              handleFetchLatest(
                sourceHealth.retryableSourceIds.length > 0
                  ? sourceHealth.retryableSourceIds
                  : undefined
              )
            }
            className="h-8 px-3 rounded-lg font-semibold bg-amber-600 hover:bg-amber-700 text-white cursor-pointer shrink-0"
          >
            {bn ? 'পুনরায় চেষ্টা' : 'Retry'}
          </button>
        </div>
      )}

      {activeSyncAlertMessage && !isOffline && (
        <div
          className={`rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs border ${
            sourceHealth.failedSources === 0 && sourceHealth.temporarilyUnavailableSources === 0 && sourceHealth.manualVerificationSources > 0
              ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200'
              : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle
              className={`w-4 h-4 shrink-0 ${
                sourceHealth.failedSources === 0 && sourceHealth.temporarilyUnavailableSources === 0 && sourceHealth.manualVerificationSources > 0
                  ? 'text-amber-600'
                  : 'text-rose-600'
              }`}
            />
            <span>{activeSyncAlertMessage}</span>
          </div>
          {sourceHealth.retryableSourceIds.length > 0 && (
            <button
              type="button"
              onClick={() => handleFetchLatest(sourceHealth.retryableSourceIds)}
              className="h-8 px-3 rounded-lg font-semibold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer shrink-0"
            >
              {bn ? 'আবার চেষ্টা' : 'Retry'}
            </button>
          )}
        </div>
      )}

      {/* Compact Search Results Header */}
      <div
        data-testid="search-metrics-bar"
        data-total-indexed={searchMetrics.totalIndexedJobs}
        data-total-matching={searchMetrics.totalMatchingJobs}
        data-currently-displayed={searchMetrics.currentlyDisplayedJobs}
        data-successfully-retrieved={searchMetrics.successfullyRetrievedJobs}
        data-newly-added={searchMetrics.newlyAddedJobs}
        className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs"
      >
        <div className="flex items-center flex-wrap gap-2">
          <span className="font-semibold text-slate-900 dark:text-white">
            {bn
              ? `ফলাফল: ${searchMetrics.totalMatchingJobs}টি চাকরি (মোট ইনডেক্সড: ${searchMetrics.totalIndexedJobs})`
              : `${searchMetrics.totalMatchingJobs} result${searchMetrics.totalMatchingJobs === 1 ? '' : 's'} (of ${searchMetrics.totalIndexedJobs} indexed)`}
          </span>

          <div className="inline-flex flex-wrap items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300">
            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              {bn ? 'মোট ইনডেক্সড:' : 'Indexed:'} <strong>{searchMetrics.totalIndexedJobs}</strong>
            </span>
            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              {bn ? 'মোট মিলেছে:' : 'Matching:'} <strong>{searchMetrics.totalMatchingJobs}</strong>
            </span>
            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              {bn ? 'বর্তমানে প্রদর্শিত:' : 'Displayed:'} <strong>{searchMetrics.currentlyDisplayedJobs}</strong>
            </span>
            <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300">
              {bn ? 'সূত্র থেকে প্রাপ্ত:' : 'Retrieved:'} <strong>{searchMetrics.successfullyRetrievedJobs}</strong>
            </span>
            <span className="px-2 py-0.5 rounded-md bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 text-sky-800 dark:text-sky-300">
              {bn ? 'নতুন যুক্ত:' : 'Newly Added:'} <strong>{searchMetrics.newlyAddedJobs}</strong>
            </span>
          </div>

          {activeFiltersList.map((chip) => (
            <span
              key={chip.key}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 font-medium text-[11px]"
            >
              <span>{chip.label}</span>
              <button
                type="button"
                onClick={chip.clear}
                className="hover:text-rose-600 cursor-pointer"
                aria-label={`Remove filter ${chip.label}`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}

          {activeFiltersList.length > 0 && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:underline cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>{bn ? 'সব ফিল্টার মুছুন' : 'Clear Filters'}</span>
            </button>
          )}

          {hiddenJobIds.length > 0 && (
            <button
              type="button"
              onClick={handleUnhideAll}
              className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:underline cursor-pointer"
            >
              {bn
                ? `${hiddenJobIds.length}টি লুকানো ফলাফল দেখান`
                : `Unhide ${hiddenJobIds.length} hidden result(s)`}
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
          <span>
            {bn ? 'সাজানো:' : 'Sorted by:'}{' '}
            <strong className="text-slate-700 dark:text-slate-200">
              {bn ? sortLabels[searchState.sortBy].bn : sortLabels[searchState.sortBy].en}
            </strong>
          </span>
          <span className="hidden sm:inline-flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-emerald-600" />
            <span>
              {lastSuccessfulSyncAt
                ? new Date(lastSuccessfulSyncAt).toLocaleString()
                : bn ? 'সিঙ্ক হয়নি' : 'Not synced'}
            </span>
          </span>
        </div>
      </div>

      {/* Results List / Loading Skeletons / Empty State */}
      {loading ? (
        <div className="space-y-3" aria-label="Loading search results">
          {[1, 2, 3].map((idx) => (
            <div
              key={idx}
              className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 animate-pulse space-y-3"
            >
              <div className="h-3 w-44 bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="h-5 w-3/4 bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded" />
            </div>
          ))}
        </div>
      ) : rankedResults.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-10 text-center space-y-3">
          <Search className="w-9 h-9 text-slate-300 dark:text-slate-700 mx-auto" />
          <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            {bn ? 'আপনার অনুসন্ধানের সাথে মিলে এমন কোনো বিজ্ঞপ্তি পাওয়া যায়নি' : 'No matching job circulars found'}
          </div>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {bn
              ? 'কীওয়ার্ড সহজ করুন, ফিল্টার পরিষ্কার করুন অথবা "সর্বশেষ আনুন" ক্লিক করে নতুন বিজ্ঞপ্তি সংগ্রহ করুন।'
              : 'Try broader keywords, clear active filters, or click "Fetch Latest" to check configured sources for new circulars.'}
          </p>
          <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
            {activeFiltersList.length > 0 && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="h-9 px-4 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer"
              >
                {bn ? 'ফিল্টার রিসেট করুন' : 'Clear Filters'}
              </button>
            )}
            <button
              type="button"
              onClick={() => handleFetchLatest()}
              className="h-9 px-4 rounded-lg text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer"
            >
              {bn ? 'নতুন বিজ্ঞপ্তি আনুন' : 'Fetch Latest Jobs'}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-3">
            {paginatedResults.map(({ job }) => {
              const appRecord = appByJobId.get(job.id);
              return (
                <JobCard
                  key={job.id}
                  job={job}
                  variant="search"
                  isBookmarked={bookmarkedIds.has(job.id)}
                  applicationStatus={appRecord?.status}
                  language={language}
                  onViewDetails={(j) => setSelectedJob(j)}
                  onApplyNow={(j) => openJobApplicationWithContext(j, showToast, bn, setMissingAppJob)}
                  onToggleBookmark={async (jobId) => {
                    const res = await toggleJobBookmarkAndSync(
                      jobId,
                      jobs,
                      appRecord,
                      showToast,
                      bn
                    );
                    setBookmarkedIds(res.bookmarkedIds);
                    setApplications(res.applications);
                    onDataChanged?.();
                  }}
                  onMarkApplied={async (j) => {
                    const apps = await markJobAppliedAndSync(j, appRecord, showToast, bn);
                    setApplications(apps);
                    onDataChanged?.();
                  }}
                  onShare={(j) => shareJobCircular(j, showToast, bn)}
                  onHideResult={(jobId) => handleHideResult(jobId)}
                />
              );
            })}
          </div>

          {totalPages > 1 && (
            <nav
              aria-label="Job search results pagination"
              className="flex flex-wrap items-center justify-between gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs"
            >
              <span className="text-slate-500 dark:text-slate-400 font-semibold">
                {bn
                  ? `পৃষ্ঠা ${safeCurrentPage} / ${totalPages} (মোট ${rankedResults.length}টি ফলাফল)`
                  : `Page ${safeCurrentPage} of ${totalPages} (${rankedResults.length} results)`}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={safeCurrentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-lg font-semibold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                >
                  {bn ? 'পূর্ববর্তী' : 'Previous'}
                </button>
                <button
                  type="button"
                  disabled={safeCurrentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3 py-1.5 rounded-lg font-semibold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                >
                  {bn ? 'পরবর্তী' : 'Next'}
                </button>
              </div>
            </nav>
          )}
        </div>
      )}
      {showAddModal && (
        <AddJobCircularModal
          language={language}
          prefill={manualPrefill}
          onClose={() => {
            setShowAddModal(false);
            setManualPrefill(null);
          }}
          onSave={handleSaveManualCircular}
        />
      )}
      <MissingApplicationUrlModal
        job={missingAppJob}
        language={language}
        onClose={() => setMissingAppJob(null)}
      />
    </div>
  );
};
