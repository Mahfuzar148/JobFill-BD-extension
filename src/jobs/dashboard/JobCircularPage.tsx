// JobFill BD - Main Job Circular Hub Dashboard Page
// Complete Bangladesh Job Circular discovery, filtering, bookmarking,
// official source status inspection, and autofill-linked Apply Now workflow.

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Briefcase,
  RefreshCw,
  Plus,
  Bell,
  Clock,
  Bookmark,
  AlertTriangle,
  ExternalLink,
  CheckCircle2,
  SlidersHorizontal,
  Shield,
  WifiOff,
  X,
  History,
  Trash2,
  Eye,
} from 'lucide-react';
import { useApp } from '../../dashboard/context/AppContext';
import { CompactSourceHealthBar, LiveSourceProgressSnapshot } from './CompactSourceHealthBar';
import { CaptchaExtractionPanel, ExtractionLifecycleState } from './CaptchaExtractionPanel';
import {
  computeSourceHealthSummary,
  formatSourceFailureAlertMessage,
} from '../services/source-health-state';
import {
  NormalizedJobCircular,
  JobSearchFilters,
  ApplicationTrackerRecord,
  JobPreferences,
  DEFAULT_JOB_PREFERENCES,
  DashboardStatFilter,
  SourceVerificationStatus,
} from '../types/job.types';
import { JobRepository } from '../database/job-repository';
import { BookmarkRepository } from '../database/bookmark-repository';
import { ApplicationRepository } from '../database/application-repository';
import { JobVisitRepository } from '../database/job-visit-repository';
import { JobVisitRecord } from '../types/job.types';
import { JobSourceRegistry } from '../sources/source-registry';
import { OFFICIAL_PORTAL_DIRECTORY } from '../sources/official-website.adapter';
import { DAY_MS, isTimestampInCurrentDhakaWeek } from '../services/deadline-parser';
import { validateJobCircular } from '../services/job-validator';
import { NotificationScheduler } from '../notifications/notification-scheduler';
import { jobMatchesPreferences } from '../notifications/daily-digest';
import {
  openJobApplicationWithContext,
  toggleJobBookmarkAndSync,
  markJobAppliedAndSync,
  verifyJobManualDeadline,
  shareJobCircular,
} from '../services/job-ui-actions';
import {
  JobFilters,
  DEFAULT_JOB_FILTERS,
  filterAndSortJobs,
  isJobMatchingStatFilter,
} from './JobFilters';
import { SourceProgressEvent } from '../services/job-fetcher';

const VERIFICATION_PRIORITY: Record<SourceVerificationStatus, number> = {
  official_verified: 5,
  official_partial: 4,
  user_submitted: 3,
  discovery_only: 2,
  unverified: 1,
};

function dedupeAndValidateJobs(rawJobs: NormalizedJobCircular[], now: number): NormalizedJobCircular[] {
  const byFingerprint = new Map<string, NormalizedJobCircular>();
  const orderedIds = new Map<string, NormalizedJobCircular>();

  for (const job of rawJobs) {
    if (!job || typeof job !== 'object') continue;
    if (!validateJobCircular(job, now).isValid) continue;

    const existingById = orderedIds.get(job.id);
    if (existingById) {
      if (job.lastUpdatedAt >= existingById.lastUpdatedAt) {
        orderedIds.set(job.id, job);
      }
      continue;
    }

    const fp =
      job.fingerprintHash ||
      `${job.organization.toLowerCase().trim()}|${job.position.toLowerCase().trim()}|${job.circularNumber || ''}`;
    const existingFp = byFingerprint.get(fp);
    if (existingFp) {
      const rankNew = VERIFICATION_PRIORITY[job.sourceVerification] ?? 0;
      const rankOld = VERIFICATION_PRIORITY[existingFp.sourceVerification] ?? 0;
      if (rankNew > rankOld || (rankNew === rankOld && job.lastUpdatedAt > existingFp.lastUpdatedAt)) {
        orderedIds.delete(existingFp.id);
        orderedIds.set(job.id, job);
        byFingerprint.set(fp, job);
      }
      continue;
    }

    byFingerprint.set(fp, job);
    orderedIds.set(job.id, job);
  }

  return Array.from(orderedIds.values());
}
import { JobCard } from './JobCard';
import { JobDetails } from './JobDetails';
import {
  AddJobCircularModal,
  ManualJobCircularPrefill,
  buildPrefillFromSourceHealthItem,
} from './AddJobCircularModal';
import { runOpenTabPortalSyncWithFeedback } from '../services/open-tab-portal-sync';
import { MissingApplicationUrlModal } from './MissingApplicationUrlModal';
import { MissingCircularDiagnosticModal } from './MissingCircularDiagnosticModal';
import { JobCheckService } from '../background/job-check-service';

import { Globe as PortalGlobeIcon, X as PortalModalCloseIcon } from 'lucide-react';
import { OfficialJobPortalsDirectory } from './OfficialJobPortalsPage';

interface JobCircularPageProps {
  initialSelectedJobId?: string | null;
  initialFilters?: Partial<JobSearchFilters>;
  onNavigateNotifications?: () => void;
  onNavigateTracker?: () => void;
  onNavigateSettings?: () => void;
  onNavigatePortals?: () => void;
  onDataChanged?: () => void;
}

type HubLoadState =
  | 'initial_loading'
  | 'loaded'
  | 'empty'
  | 'partial_failure'
  | 'fetch_failure'
  | 'offline';

const INITIAL_LOAD_TIMEOUT_MS = 8000;
const SOURCE_SYNC_TIMEOUT_MS = 25000;
const CIRCULARS_PAGE_SIZE = 24;

export const JobCircularPage: React.FC<JobCircularPageProps> = ({
  initialSelectedJobId,
  initialFilters,
  onNavigateNotifications,
  onNavigateTracker,
  onNavigateSettings,
  onNavigatePortals,
  onDataChanged,
}) => {
  const { language, showToast } = useApp();
  const bn = language === 'bn';

  const [jobs, setJobs] = useState<NormalizedJobCircular[]>([]);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [applications, setApplications] = useState<ApplicationTrackerRecord[]>([]);
  const [preferences, setPreferences] = useState<JobPreferences>(DEFAULT_JOB_PREFERENCES);
  const [sourceOutcomes, setSourceOutcomes] = useState<any[]>([]);
  const [filters, setFilters] = useState<JobSearchFilters>(() => ({
    ...DEFAULT_JOB_FILTERS,
    ...(initialFilters || {}),
  }));

  useEffect(() => {
    if (initialFilters) {
      setFilters((prev) => ({
        ...prev,
        ...initialFilters,
      }));
    }
  }, [initialFilters]);
  const [applyMyPrefsFilter, setApplyMyPrefsFilter] = useState(false);
  const [hubTab, setHubTab] = useState<'all' | 'recommended' | 'visited' | 'bookmarked' | 'closing_soon' | 'applied'>('all');
  const [visitedRecords, setVisitedRecords] = useState<JobVisitRecord[]>([]);
  const [trackVisitsEnabled, setTrackVisitsEnabled] = useState(true);

  const [selectedJob, setSelectedJob] = useState<NormalizedJobCircular | null>(null);
  const [missingAppJob, setMissingAppJob] = useState<NormalizedJobCircular | null>(null);
  const lastAppliedInitialJobId = useRef<string | null>(null);
  const autoSyncAttemptedRef = useRef(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [manualPrefill, setManualPrefill] = useState<ManualJobCircularPrefill | null>(null);
  const [showSourcesPanel, setShowSourcesPanel] = useState(false);
  const [showPortalsModal, setShowPortalsModal] = useState(false);
  const [showDiagnosticModal, setShowDiagnosticModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [liveProgress, setLiveProgress] = useState<LiveSourceProgressSnapshot | null>(null);
  const [loadState, setLoadState] = useState<HubLoadState>('initial_loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastSuccessfulSyncAt, setLastSuccessfulSyncAt] = useState<number | null>(null);
  const [dismissExtractionPanel, setDismissExtractionPanel] = useState(false);
  const sourcesPanelRef = useRef<HTMLDivElement | null>(null);

  const computeHubState = useCallback(
    (loadedJobs: NormalizedJobCircular[], outcomes: any[], explicitError?: string | null): HubLoadState => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false && loadedJobs.length === 0) {
        return 'offline';
      }
      if (explicitError && loadedJobs.length === 0) {
        return 'fetch_failure';
      }
      if (outcomes.length > 0) {
        const health = computeSourceHealthSummary(JobSourceRegistry.getAll(), outcomes);
        const totalUnavailable = health.failedSources + health.temporarilyUnavailableSources;
        if (health.attemptedSources > 0 && totalUnavailable === health.attemptedSources && loadedJobs.length === 0) {
          return 'fetch_failure';
        }
        if (totalUnavailable > 0 || health.manualVerificationSources > 0) {
          return 'partial_failure';
        }
      }
      return loadedJobs.length > 0 ? 'loaded' : 'empty';
    },
    []
  );

  const runSourceSyncPipeline = useCallback(
    async (targetSourceIds?: string[]): Promise<any> => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        throw new Error(
          bn
            ? 'অফলাইন: ইন্টারনেট সংযোগ না থাকায় নতুন বিজ্ঞপ্তি আনা সম্ভব হয়নি।'
            : 'Offline: Connect to the internet and retry fetching circulars.'
        );
      }

      const isTargetedRetry = Array.isArray(targetSourceIds) && targetSourceIds.length > 0;
      const handleProgress = (ev: SourceProgressEvent) => {
        setLiveProgress({
          completed: ev.completedCount,
          total: ev.totalCount,
          activeSourceName: ev.sourceName,
        });
      };

      setLiveProgress({
        completed: 0,
        total: isTargetedRetry ? targetSourceIds!.length : JobSourceRegistry.getAll().length,
        activeSourceName: isTargetedRetry
          ? bn
            ? `${targetSourceIds!.length}টি সূত্র পুনরায় চেষ্টা...`
            : `Retrying ${targetSourceIds!.length} source(s)`
          : bn
            ? 'সূত্রসমূহ যাচাই হচ্ছে...'
            : 'Checking configured sources',
      });

      let report: any = null;
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        try {
          report = await new Promise((resolve, reject) => {
            let settled = false;
            const timer = setTimeout(() => {
              if (!settled) {
                settled = true;
                reject(new Error('Background worker sync timed out; falling back cleanly.'));
              }
            }, SOURCE_SYNC_TIMEOUT_MS);

            chrome.runtime.sendMessage(
              {
                action: 'CHECK_JOB_SOURCES_NOW',
                payload: isTargetedRetry
                  ? { sourceIds: targetSourceIds, respectCooldowns: false }
                  : { respectCooldowns: true },
              },
              (res) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                if (chrome.runtime.lastError) {
                  reject(new Error(chrome.runtime.lastError.message));
                } else if (res?.status === 'error') {
                  reject(new Error(res.error || 'Background sync failed'));
                } else {
                  resolve(res);
                }
              }
            );
          });
        } catch (msgErr: any) {
          console.warn('JobFill BD [JobCircularPage]: SW message fallback:', msgErr?.message || 'worker unreachable');
          report = await Promise.race([
            JobCheckService.runFullCheck({
              sourceIds: isTargetedRetry ? targetSourceIds : undefined,
              respectCooldowns: !isTargetedRetry,
              onSourceProgress: handleProgress,
            }),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('Source fetch request timed out')), SOURCE_SYNC_TIMEOUT_MS)
            ),
          ]);
        }
      } else {
        report = await Promise.race([
          JobCheckService.runFullCheck({
            sourceIds: isTargetedRetry ? targetSourceIds : undefined,
            respectCooldowns: !isTargetedRetry,
            onSourceProgress: handleProgress,
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Source fetch request timed out')), SOURCE_SYNC_TIMEOUT_MS)
          ),
        ]);
      }
      return report;
    },
    [bn]
  );

  const loadAll = useCallback(
    async (allowAutoSync: boolean = true) => {
      setLoading(true);
      setErrorMessage(null);
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      try {
        const [allJobs, bmIds, apps, prefs, outcomes, schedState, visits, visitsEnabled] = await Promise.race([
          Promise.all([
            JobRepository.getAllJobs(),
            BookmarkRepository.getBookmarkedJobIds(),
            ApplicationRepository.getAll(),
            JobRepository.getPreferences(),
            JobRepository.getSourceOutcomes(),
            JobRepository.getSchedulerState(),
            JobVisitRepository.getAllVisits(),
            JobVisitRepository.isVisitTrackingEnabled(),
          ]),
          new Promise<never>((_, reject) => {
            timeoutId = setTimeout(
              () => reject(new Error(bn ? 'লোডিং সময়সীমা অতিক্রম করেছে। আবার চেষ্টা করুন।' : 'Loading job circulars timed out. Please retry.')),
              INITIAL_LOAD_TIMEOUT_MS
            );
          }),
        ]);

        const now = Date.now();
        const cleanedJobs = dedupeAndValidateJobs(allJobs, now);
        console.info(
          `JobFill BD [JobCircularPage]: loaded storedJobs=${cleanedJobs.length} bookmarks=${bmIds.size} outcomes=${outcomes.length}`
        );

        const syncTs = schedState?.lastSuccessfulSyncAt ?? schedState?.lastDailyCheckAt ?? null;
        setJobs(cleanedJobs);
        setBookmarkedIds(bmIds);
        setApplications(apps);
        setPreferences(prefs);
        setSourceOutcomes(outcomes);
        setLastSuccessfulSyncAt(syncTs);
        setVisitedRecords(visits || []);
        setTrackVisitsEnabled(visitsEnabled !== false);
        setLoadState(computeHubState(cleanedJobs, outcomes));

        // Auto-repair any historical misclassified records in background without blocking UI
        ApplicationRepository.repairMisclassifiedRecords()
          .then((repairRes) => {
            if (repairRes.repaired > 0) {
              ApplicationRepository.getAll().then(setApplications);
              JobVisitRepository.getAllVisits().then(setVisitedRecords);
            }
          })
          .catch(() => {});

        // Only auto-sync on first empty open; background chrome.alarms & manual Sync handle ongoing checks
        const isExtensionContext = typeof chrome !== 'undefined' && Boolean(chrome.runtime?.id);
        const isFirstEmptyOpen = cleanedJobs.length === 0 && outcomes.length === 0;
        if (allowAutoSync && isExtensionContext && isFirstEmptyOpen && !autoSyncAttemptedRef.current) {
          autoSyncAttemptedRef.current = true;
          if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            if (cleanedJobs.length === 0) setLoadState('offline');
            return;
          }
          // Always release initial spinner after local storage read so manual entry & filters stay instant
          setLoading(false);
          setSyncing(true);
          try {
            await runSourceSyncPipeline();
            const [freshJobs, freshBmIds, freshApps, freshPrefs, freshOutcomes, freshSched] = await Promise.all([
              JobRepository.getAllJobs(),
              BookmarkRepository.getBookmarkedJobIds(),
              ApplicationRepository.getAll(),
              JobRepository.getPreferences(),
              JobRepository.getSourceOutcomes(),
              JobRepository.getSchedulerState(),
            ]);
            const cleanedFresh = dedupeAndValidateJobs(freshJobs, Date.now());
            setJobs(cleanedFresh);
            setBookmarkedIds(freshBmIds);
            setApplications(freshApps);
            setPreferences(freshPrefs);
            setSourceOutcomes(freshOutcomes);
            setLastSuccessfulSyncAt(freshSched?.lastSuccessfulSyncAt ?? freshSched?.lastDailyCheckAt ?? Date.now());
            setLoadState(computeHubState(cleanedFresh, freshOutcomes));
            onDataChanged?.();
          } catch (syncErr: any) {
            console.warn('JobFill BD [JobCircularPage]: auto-sync on open failed:', syncErr?.message || 'Sync error');
            setErrorMessage(syncErr?.message || 'Source fetch failed');
            if (cleanedJobs.length === 0) {
              setLoadState(typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'fetch_failure');
            }
          } finally {
            setSyncing(false);
            setLiveProgress(null);
          }
        }
      } catch (err: any) {
        const errMsg = err?.message || (bn ? 'ডেটা লোড করতে সমস্যা হয়েছে।' : 'Failed to load job circulars.');
        console.warn('JobFill BD [JobCircularPage]: loadAll error:', errMsg);
        setErrorMessage(errMsg);
        setLoadState(typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'fetch_failure');
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
        setLoading(false);
      }
    },
    [bn, computeHubState, onDataChanged, runSourceSyncPipeline]
  );

  const initialMountRef = useRef(false);
  useEffect(() => {
    if (!initialMountRef.current) {
      initialMountRef.current = true;
      loadAll(true);
    }
  }, [loadAll]);

  useEffect(() => {
    const handleOnline = () => {
      if (loadState === 'offline') {
        loadAll(true);
      }
    };
    const handleOffline = () => {
      if (jobs.length === 0) {
        setLoadState('offline');
      }
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [jobs.length, loadAll, loadState]);

  useEffect(() => {
    if (initialSelectedJobId && initialSelectedJobId !== lastAppliedInitialJobId.current) {
      const match = jobs.find((j) => j.id === initialSelectedJobId);
      if (match) {
        lastAppliedInitialJobId.current = initialSelectedJobId;
        setSelectedJob(match);
      }
    }
  }, [initialSelectedJobId, jobs]);

  const appByJobId = useMemo(() => {
    const map = new Map<string, ApplicationTrackerRecord>();
    for (const a of applications) map.set(a.jobId, a);
    return map;
  }, [applications]);

  const summary = useMemo(() => {
    const now = Date.now();
    return {
      total: jobs.length,
      newThisWeek: jobs.filter((j) => isTimestampInCurrentDhakaWeek(j.publishedAt, now)).length,
      closingSoon: jobs.filter((j) => isJobMatchingStatFilter(j, 'closing_soon', bookmarkedIds, appByJobId, now)).length,
      expired: jobs.filter((j) => isJobMatchingStatFilter(j, 'expired', bookmarkedIds, appByJobId, now)).length,
      bookmarked: jobs.filter((j) => isJobMatchingStatFilter(j, 'bookmarked', bookmarkedIds, appByJobId, now)).length,
      inProgress: jobs.filter((j) => isJobMatchingStatFilter(j, 'in_progress', bookmarkedIds, appByJobId, now)).length,
    };
  }, [jobs, bookmarkedIds, appByJobId]);

  const displayedJobs = useMemo(() => {
    let list = filterAndSortJobs(jobs, filters, bookmarkedIds, Date.now(), appByJobId);
    if (applyMyPrefsFilter || hubTab === 'recommended') {
      list = list.filter((j) => jobMatchesPreferences(j, preferences));
    }
    if (hubTab === 'bookmarked') {
      list = list.filter((j) => bookmarkedIds.has(j.id));
    }
    if (hubTab === 'closing_soon') {
      const now = Date.now();
      list = list.filter((j) => isJobMatchingStatFilter(j, 'closing_soon', bookmarkedIds, appByJobId, now));
    }
    if (hubTab === 'applied') {
      list = list.filter((j) => appByJobId.get(j.id)?.status === 'Applied');
    }
    return list;
  }, [jobs, filters, bookmarkedIds, applyMyPrefsFilter, hubTab, preferences, appByJobId]);

  const totalPages = Math.max(1, Math.ceil(displayedJobs.length / CIRCULARS_PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedJobs = useMemo(() => {
    const start = (safeCurrentPage - 1) * CIRCULARS_PAGE_SIZE;
    return displayedJobs.slice(start, start + CIRCULARS_PAGE_SIZE);
  }, [displayedJobs, safeCurrentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filters, applyMyPrefsFilter, hubTab]);

  const activeStat: DashboardStatFilter = filters.statFilter || 'total';

  const handleStatCardClick = (cardId: DashboardStatFilter) => {
    if (cardId === 'total') {
      setFilters({ ...DEFAULT_JOB_FILTERS, statFilter: 'total' });
      setApplyMyPrefsFilter(false);
      return;
    }

    setFilters((prev) => {
      const currentlySelected = (prev.statFilter || 'total') === cardId;
      if (currentlySelected) {
        return {
          ...prev,
          statFilter: 'total',
          deadline: 'all',
          bookmarkedOnly: false,
          sortBy:
            prev.sortBy === 'recently_expired' || prev.sortBy === 'deadline_soonest'
              ? 'latest_published'
              : prev.sortBy,
        };
      }

      return {
        ...prev,
        statFilter: cardId,
        deadline: 'all',
        bookmarkedOnly: cardId === 'bookmarked' ? true : false,
        sortBy:
          cardId === 'closing_soon'
            ? 'deadline_soonest'
            : cardId === 'expired'
              ? 'recently_expired'
              : cardId === 'new_this_week'
                ? 'latest_published'
                : prev.sortBy === 'recently_expired'
                  ? 'latest_published'
                  : prev.sortBy,
      };
    });
  };

  const clearAllFilters = () => {
    setFilters({ ...DEFAULT_JOB_FILTERS, statFilter: 'total' });
    setApplyMyPrefsFilter(false);
  };

  const handleSyncSources = async (targetSourceIds?: string[]) => {
    setSyncing(true);
    setDismissExtractionPanel(false);
    setErrorMessage(null);
    const isTargeted = Array.isArray(targetSourceIds) && targetSourceIds.length > 0;
    try {
      const report = await runSourceSyncPipeline(targetSourceIds);
      await loadAll(false);
      onDataChanged?.();
      const outcomes = report?.sourceOutcomes || [];
      const inspectedOutcomes = isTargeted
        ? outcomes.filter((o: any) => targetSourceIds!.includes(o.sourceId))
        : outcomes;
      const failedSources = inspectedOutcomes.filter(
        (o: any) => !o?.success || o?.compatibilityStatus === 'unavailable'
      ).length;
      if (outcomes.length > 0 && failedSources === outcomes.length && jobs.length === 0) {
        setErrorMessage(bn ? 'সব সূত্র থেকে সংযোগ ব্যর্থ হয়েছে।' : 'All configured job sources failed to respond.');
      }

      if (isTargeted) {
        if (failedSources > 0) {
          showToast(
            bn
              ? `⚠️ ${targetSourceIds!.length}টির মধ্যে ${failedSources}টি সূত্র এখনো ব্যর্থ; নতুন ${report?.newJobsCount ?? 0}টি বিজ্ঞপ্তি যুক্ত হয়েছে`
              : `⚠️ Retried ${targetSourceIds!.length} source(s): ${failedSources} still unavailable; ${report?.newJobsCount ?? 0} new circular(s) added`
          );
        } else {
          showToast(
            bn
              ? `✅ ব্যর্থ সূত্রসমূহ সফলভাবে পুনঃসংযোগ হয়েছে (${report?.newJobsCount ?? 0}টি নতুন বিজ্ঞপ্তি)`
              : `✅ Retried ${targetSourceIds!.length} source(s) successfully (${report?.newJobsCount ?? 0} new circular(s) added)`
          );
        }
      } else {
        showToast(
          bn
            ? `✅ সিঙ্ক সম্পন্ন: ${report?.newJobsCount ?? 0}টি নতুন বিজ্ঞপ্তি যুক্ত হয়েছে`
            : `✅ Sync complete: ${report?.newJobsCount ?? 0} new circular(s) added`
        );
      }
    } catch (err: any) {
      const errMsg = err?.message || 'Failed to sync job sources';
      setErrorMessage(errMsg);
      setLoadState(
        typeof navigator !== 'undefined' && navigator.onLine === false
          ? 'offline'
          : jobs.length > 0
            ? 'partial_failure'
            : 'fetch_failure'
      );
      showToast(`❌ Sync error: ${errMsg}`);
    } finally {
      setSyncing(false);
      setLiveProgress(null);
    }
  };

  const handleRetryFailedSources = async () => {
    const summaryHealth = computeSourceHealthSummary(JobSourceRegistry.getAll(), sourceOutcomes);
    const failedOrPartialIds = summaryHealth.retryableSourceIds;
    if (failedOrPartialIds.length === 0) {
      showToast(
        bn
          ? 'ℹ️ পুনঃচেষ্টার মতো কোনো উৎস এখন বিরতির বাইরে নেই।'
          : 'ℹ️ No sources are currently eligible for automatic retry.'
      );
      return;
    }
    await handleSyncSources(failedOrPartialIds);
  };

  const handleRetrySingleSource = async (sourceId: string) => {
    const summaryHealth = computeSourceHealthSummary(JobSourceRegistry.getAll(), sourceOutcomes);
    const targetItem = summaryHealth.sources.find((s) => s.sourceId === sourceId);
    if (targetItem && !targetItem.retryAvailable) {
      showToast(bn ? targetItem.retryAvailabilityNoteBn : targetItem.retryAvailabilityNote);
      return;
    }
    await handleSyncSources([sourceId]);
  };

  const handleToggleBookmark = async (jobId: string) => {
    const res = await toggleJobBookmarkAndSync(jobId, jobs, appByJobId.get(jobId), showToast, bn);
    setBookmarkedIds(res.bookmarkedIds);
    setApplications(res.applications);
    onDataChanged?.();
  };

  const handleApplyNow = async (job: NormalizedJobCircular) => {
    await openJobApplicationWithContext(job, showToast, bn, setMissingAppJob, { trackStarted: true });
    const apps = await ApplicationRepository.getAll();
    setApplications(apps);
    onDataChanged?.();
  };

  const handleMarkApplied = async (job: NormalizedJobCircular) => {
    const apps = await markJobAppliedAndSync(job, appByJobId.get(job.id), showToast, bn);
    setApplications(apps);
    onDataChanged?.();
  };

  const handleUpdateDeadline = async (jobId: string, newDeadlineText: string) => {
    const target = jobs.find((j) => j.id === jobId);
    if (!target) return;
    const updated = await verifyJobManualDeadline(target, newDeadlineText, showToast, bn);
    if (!updated) return;
    await loadAll();
    setSelectedJob(updated);
    onDataChanged?.();
  };

  const handleSaveManualCircular = async (job: NormalizedJobCircular) => {
    await JobRepository.saveJob(job);
    const updatedJobs = await JobRepository.getAllJobs();
    await JobRepository.rebuildSearchIndex(updatedJobs);
    await NotificationScheduler.runCycle();
    setCurrentPage(1);
    await loadAll(false);
    onDataChanged?.();
    showToast(bn ? '✅ নতুন সার্কুলার সংরক্ষিত হয়েছে' : '✅ Job circular saved');
  };

  const handleRemoveVisit = async (visitId: string) => {
    await JobVisitRepository.removeVisit(visitId);
    setVisitedRecords((prev) => prev.filter((v) => v.visitId !== visitId));
    showToast(bn ? 'ভিজিট রেকর্ড মুছে ফেলা হয়েছে' : 'Visit record removed');
  };

  const handleClearAllVisits = async () => {
    if (window.confirm(bn ? 'আপনি কি সমস্ত ভিজিট হিস্ট্রি মুছে ফেলতে চান?' : 'Are you sure you want to clear all visited circular history?')) {
      await JobVisitRepository.clearAllVisits();
      setVisitedRecords([]);
      showToast(bn ? 'ভিজিট হিস্ট্রি মুছে ফেলা হয়েছে' : 'All visited history cleared');
    }
  };

  const handleToggleVisitTracking = async (enabled: boolean) => {
    setTrackVisitsEnabled(enabled);
    await JobVisitRepository.setVisitTrackingEnabled(enabled);
    showToast(
      enabled
        ? (bn ? 'সার্কুলার ভিজিট ট্র্যাকিং সক্রিয়' : 'Circular visit tracking enabled')
        : (bn ? 'সার্কুলার ভিজিট ট্র্যাকিং নিষ্ক্রিয়' : 'Circular visit tracking disabled')
    );
  };

  const handleShare = async (job: NormalizedJobCircular) => {
    await shareJobCircular(job, showToast, bn);
  };

  const adapters = useMemo(() => JobSourceRegistry.getAll(), []);
  const sourceHealth = useMemo(
    () => computeSourceHealthSummary(adapters, sourceOutcomes, lastSuccessfulSyncAt),
    [adapters, sourceOutcomes, lastSuccessfulSyncAt]
  );
  const partialFailureText = useMemo(
    () => formatSourceFailureAlertMessage(sourceHealth, bn),
    [sourceHealth, bn]
  );

  const captchaBlockedSource = useMemo(() => {
    return sourceHealth.sources.find((s) => s.blockedByCaptcha) || null;
  }, [sourceHealth.sources]);

  const rateLimitedSource = useMemo(() => {
    return sourceHealth.sources.find((s) => s.rateLimited || s.httpStatus === 429) || null;
  }, [sourceHealth.sources]);

  const extractionLifecycleState: ExtractionLifecycleState = useMemo(() => {
    if (captchaBlockedSource) return 'captcha_required';
    if (rateLimitedSource) return 'rate_limited';
    if (syncing) {
      if (liveProgress?.activeSourceName?.includes('যাচাই') || liveProgress?.activeSourceName?.includes('Validat')) {
        return 'validating';
      }
      return 'extracting';
    }
    if (loadState === 'fetch_failure') return 'failed';
    return 'completed';
  }, [captchaBlockedSource, rateLimitedSource, syncing, liveProgress, loadState]);

  const handleResumeExtraction = async () => {
    if (!captchaBlockedSource) return;
    showToast(bn ? '🔄 পোর্টাল পুনঃযাচাই করা হচ্ছে...' : '🔄 Re-checking portal challenge status...');
    await handleSyncSources([captchaBlockedSource.sourceId]);
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
          onApplyNow={handleApplyNow}
          onToggleBookmark={handleToggleBookmark}
          onMarkApplied={handleMarkApplied}
          onUpdateDeadline={handleUpdateDeadline}
          onShare={handleShare}
        />
        <MissingApplicationUrlModal
          job={missingAppJob}
          language={language}
          onClose={() => setMissingAppJob(null)}
        />
      </>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-petro-600" />
            <span>{bn ? 'জব সার্কুলার হাব (Job Circulars)' : 'Bangladesh Job Circular Hub'}</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {bn
              ? 'সরকারি, ব্যাংক, বেসরকারি, NGO ও বিশ্ববিদ্যালয়ের চাকরির বিজ্ঞপ্তি খুঁজুন, ট্র্যাক করুন এবং ১-ক্লিকে আবেদন করুন'
              : 'Discover, search, filter, track deadlines, and apply with JobFill BD Smart Autofill'}
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 flex items-center gap-1.5">
            <span>
              {bn ? 'সর্বশেষ সফল সিঙ্ক:' : 'Last Successful Sync:'}{' '}
              <strong className="text-slate-600 dark:text-slate-300">
                {lastSuccessfulSyncAt ? new Date(lastSuccessfulSyncAt).toLocaleString() : bn ? 'এখনো হয়নি' : 'Never'}
              </strong>
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            data-testid="hub-official-portals-btn"
            onClick={() => (onNavigatePortals ? onNavigatePortals() : setShowPortalsModal(true))}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 cursor-pointer transition-colors"
          >
            <PortalGlobeIcon className="w-3.5 h-3.5" />
            <span>🌐 Official Job Portals</span>
          </button>

          <button
            type="button"
            onClick={() => setShowSourcesPanel((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer"
          >
            <Shield className="w-3.5 h-3.5 text-petro-600" />
            <span>{bn ? 'অফিশিয়াল সূত্র' : 'Sources Status'}</span>
          </button>

          {onNavigateNotifications && (
            <button
              type="button"
              onClick={onNavigateNotifications}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer"
            >
              <Bell className="w-3.5 h-3.5 text-amber-500" />
              <span>{bn ? 'নোটিফিকেশন' : 'Alerts'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => handleSyncSources()}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border border-petro-200 dark:border-petro-800 bg-petro-50 dark:bg-petro-950/40 text-petro-700 dark:text-petro-300 hover:bg-petro-100 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? (bn ? 'চেক হচ্ছে...' : 'Checking...') : bn ? 'আপডেট চেক করুন' : 'Fetch Latest'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setManualPrefill(null);
              setShowAddModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-petro-600 hover:bg-petro-700 text-white shadow-sm shadow-petro-600/25 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{bn ? 'সার্কুলার যোগ করুন' : 'Add Job Circular'}</span>
          </button>
        </div>
      </div>

      {/* 6 Hub Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto" role="tablist">
        {[
          { id: 'all', label: bn ? 'সব সার্কুলার' : 'All Jobs', count: jobs.length, icon: Briefcase },
          { id: 'recommended', label: bn ? 'পছন্দের চাকরি' : 'Recommended', count: null, icon: CheckCircle2 },
          { id: 'visited', label: bn ? 'সম্প্রতি দেখা' : 'Visited History', count: visitedRecords.length, icon: History },
          { id: 'bookmarked', label: bn ? 'বুকমার্ক' : 'Bookmarked', count: bookmarkedIds.size, icon: Bookmark },
          { id: 'closing_soon', label: bn ? 'শীঘ্রই শেষ' : 'Closing Soon', count: summary.closingSoon, icon: Clock },
          { id: 'applied', label: bn ? 'আবেদিত' : 'Applied', count: applications.filter((a) => a.status === 'Applied').length, icon: CheckCircle2 },
        ].map((tab) => {
          const isActive = hubTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => {
                setHubTab(tab.id as any);
                if (tab.id === 'visited') {
                  JobVisitRepository.getAllVisits().then(setVisitedRecords);
                }
              }}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-petro-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              {tab.count !== null && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Top 6 Interactive Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3" role="group" aria-label={bn ? 'ড্যাশবোর্ড পরিসংখ্যান ফিল্টার' : 'Dashboard statistics filters'}>
        {[
          {
            id: 'total' as DashboardStatFilter,
            label: bn ? 'মোট সার্কুলার' : 'Total Job Circulars',
            value: summary.total,
            color: 'text-slate-800 dark:text-white',
            bg: 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800',
            activeBg: 'ring-2 ring-petro-600 border-petro-600 bg-petro-50/40 dark:bg-petro-950/30',
          },
          {
            id: 'new_this_week' as DashboardStatFilter,
            label: bn ? 'এই সপ্তাহে নতুন' : 'New This Week',
            value: summary.newThisWeek,
            color: 'text-petro-600 dark:text-petro-400',
            bg: 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800',
            activeBg: 'ring-2 ring-petro-600 border-petro-600 bg-petro-50/60 dark:bg-petro-950/40',
          },
          {
            id: 'closing_soon' as DashboardStatFilter,
            label: bn ? 'শীঘ্রই শেষ' : 'Closing Soon',
            value: summary.closingSoon,
            color: 'text-amber-600 dark:text-amber-400',
            bg: 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900',
            activeBg: 'ring-2 ring-amber-500 border-amber-600 bg-amber-100/70 dark:bg-amber-950/60',
          },
          {
            id: 'expired' as DashboardStatFilter,
            label: bn ? 'সময় শেষ' : 'Deadline Passed',
            value: summary.expired,
            color: 'text-rose-600 dark:text-rose-400',
            bg: 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800',
            activeBg: 'ring-2 ring-rose-500 border-rose-600 bg-rose-50/70 dark:bg-rose-950/40',
          },
          {
            id: 'bookmarked' as DashboardStatFilter,
            label: bn ? 'বুকমার্ক করা' : 'Bookmarked Jobs',
            value: summary.bookmarked,
            color: 'text-purple-600 dark:text-purple-400',
            bg: 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800',
            activeBg: 'ring-2 ring-purple-500 border-purple-600 bg-purple-50/70 dark:bg-purple-950/40',
          },
          {
            id: 'in_progress' as DashboardStatFilter,
            label: bn ? 'আবেদন চলমান' : 'Application In Progress',
            value: summary.inProgress,
            color: 'text-indigo-600 dark:text-indigo-400',
            bg: 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800',
            activeBg: 'ring-2 ring-indigo-500 border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40',
          },
        ].map((card) => {
          const isSelected = activeStat === card.id;
          return (
            <button
              key={card.id}
              type="button"
              aria-pressed={isSelected}
              aria-label={`${card.label}: ${card.value}`}
              onClick={() => handleStatCardClick(card.id)}
              className={`text-left p-3.5 rounded-2xl border shadow-xs hover:border-petro-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-petro-500 transition-all cursor-pointer ${
                isSelected ? card.activeBg : card.bg
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <div className={`text-xl font-bold ${card.color}`}>{card.value}</div>
                {isSelected && card.id !== 'total' && (
                  <span className="text-[9.5px] font-semibold uppercase px-1.5 py-0.5 rounded-full bg-white/80 dark:bg-slate-900/80 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                    {bn ? 'সক্রিয়' : 'Active'}
                  </span>
                )}
              </div>
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5 leading-tight">
                {card.label}
              </div>
            </button>
          );
        })}
      </div>

      {/* Compact Single-Line Live Source Health Bar (Full Table Collapsed by Default) */}
      <CompactSourceHealthBar
        adapters={adapters}
        outcomes={sourceOutcomes}
        healthSummary={sourceHealth}
        jobs={jobs}
        lastSuccessfulSyncAt={lastSuccessfulSyncAt}
        syncing={syncing}
        progress={liveProgress}
        expanded={showSourcesPanel}
        onToggleExpanded={() => setShowSourcesPanel((v) => !v)}
        onRetryFailed={(failedIds) => handleSyncSources(failedIds)}
        onRetrySingleSource={(sourceId) => {
          void handleRetrySingleSource(sourceId);
        }}
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
              await loadAll(false);
              onDataChanged?.();
            },
          });
        }}
        onViewBankJobs={() => {
          setFilters({ ...DEFAULT_JOB_FILTERS, category: 'Bank', statFilter: 'total' });
          setCurrentPage(1);
        }}
        panelHeading={bn ? 'চাকরির উৎস ও সংযোগ স্বাস্থ্য (Sources Health)' : 'Official Sources & Health Status'}
        panelRef={sourcesPanelRef}
        bn={bn}
        footerContent={
          <div>
            <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
              {bn ? 'অতিরিক্ত সরকারি/বিশ্ববিদ্যালয় পোর্টাল লিংক:' : 'Direct Official Portal Links (Ministries, Autonomous & Universities):'}
            </div>
            <div className="flex flex-wrap gap-2">
              {OFFICIAL_PORTAL_DIRECTORY.map((p) => (
                <a
                  key={p.url}
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium inline-flex items-center gap-1"
                >
                  <span>{p.name}</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              ))}
            </div>
          </div>
        }
      />

      {/* CAPTCHA-Aware Extraction Lifecycle Panel */}
      {!dismissExtractionPanel && (syncing || captchaBlockedSource || rateLimitedSource) && (
        <CaptchaExtractionPanel
          state={extractionLifecycleState}
          activeSourceName={
            liveProgress?.activeSourceName ||
            captchaBlockedSource?.sourceName ||
            rateLimitedSource?.sourceName
          }
          retrievedCount={jobs.length}
          savedCount={jobs.length}
          errorMessage={errorMessage || captchaBlockedSource?.error}
          retryAfterMs={
            rateLimitedSource?.retryCooldownUntil
              ? Math.max(0, rateLimitedSource.retryCooldownUntil - Date.now())
              : null
          }
          portalUrl={captchaBlockedSource?.openPortalUrl || captchaBlockedSource?.directPortalUrl}
          canResume={true}
          onResume={handleResumeExtraction}
          onOpenPortal={() => {
            const url = captchaBlockedSource?.openPortalUrl || captchaBlockedSource?.directPortalUrl;
            if (url) window.open(url, '_blank', 'noopener,noreferrer');
          }}
          onOpenManualAdd={() => {
            if (captchaBlockedSource) {
              setManualPrefill(buildPrefillFromSourceHealthItem(captchaBlockedSource));
            }
            setShowAddModal(true);
          }}
          onDismiss={() => setDismissExtractionPanel(true)}
          bn={bn}
        />
      )}

      {/* Offline / Fetch Failure / Partial Failure Status Banners */}
      {!loading && loadState === 'offline' && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
            <WifiOff className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">{bn ? 'আপনি বর্তমানে অফলাইনে আছেন' : 'Offline Mode Detected'}</div>
              <div className="text-[11px] opacity-90">
                {errorMessage ||
                  (bn
                    ? 'ইন্টারনেট সংযোগ না থাকায় নতুন বিজ্ঞপ্তি আনা যায়নি। সংযোগ চালু হলে আবার চেষ্টা করুন।'
                    : 'No internet connection available. Cached circulars remain visible; reconnect and click Retry to fetch updates.')}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleSyncSources()}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white shrink-0 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            <span>{bn ? 'আবার চেষ্টা করুন' : 'Retry'}</span>
          </button>
        </div>
      )}

      {!loading && loadState === 'partial_failure' && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-start gap-2 text-amber-900 dark:text-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              {bn
                ? `আংশিক উৎস সতর্কতা: ${partialFailureText || 'কিছু সরকারি/চাকরির পোর্টাল থেকে তথ্য আনা যায়নি, তবে অন্যান্য সূত্রের বিজ্ঞপ্তি দেখানো হচ্ছে।'}`
                : `Partial Source Failure: ${partialFailureText || 'One or more job portals could not be reached right now. Available circulars from working sources are shown below.'}`}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={() => {
                setShowSourcesPanel(true);
                setTimeout(() => sourcesPanelRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' }), 20);
              }}
              className="h-8 px-3 rounded-lg text-[11px] font-semibold border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40 cursor-pointer"
            >
              {bn ? 'উৎসের অবস্থা দেখুন' : 'Sources Status'}
            </button>
            {sourceHealth.retryableSourceIds.length > 0 && (
              <button
                type="button"
                onClick={handleRetryFailedSources}
                disabled={syncing}
                className="h-8 px-3 rounded-lg text-[11px] font-semibold bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50 cursor-pointer"
              >
                {syncing ? (bn ? 'চেষ্টা চলছে...' : 'Retrying...') : bn ? 'পুনরায় চেষ্টা' : 'Retry Failed Sources'}
              </button>
            )}
          </div>
        </div>
      )}

      {hubTab === 'visited' ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-petro-600" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {bn ? 'সম্প্রতি দেখা জব সার্কুলার হিস্ট্রি' : 'Recently Visited Job Circulars'}
              </h3>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                ({visitedRecords.length} {bn ? 'টি রেকর্ড' : 'records'})
              </span>
            </div>

            <div className="flex items-center gap-4 flex-wrap">
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={trackVisitsEnabled}
                  onChange={(e) => handleToggleVisitTracking(e.target.checked)}
                  className="rounded text-petro-600 focus:ring-petro-500"
                />
                <span>{bn ? 'স্বয়ংক্রিয় ভিজিট ট্র্যাকিং চালু' : 'Track Circular Visits Automatically'}</span>
              </label>

              {visitedRecords.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAllVisits}
                  className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{bn ? 'সব হিস্ট্রি মুছুন' : 'Clear All History'}</span>
                </button>
              )}
            </div>
          </div>

          {visitedRecords.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center space-y-3">
              <History className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto" />
              <h4 className="text-sm font-bold text-slate-800 dark:text-white">
                {bn ? 'এখনও কোনো সার্কুলার ভিজিট রেকর্ড নেই' : 'No Visited Job Circulars Yet'}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                {bn
                  ? 'আপনি যখন বিভিন্ন চাকরির বিবরণী দেখবেন অথবা Teletalk, BDJobs বা সরকারি জব পোর্টালে সার্কুলার ব্রাউজ করবেন, সেগুলি এখানে স্বয়ংক্রিয়ভাবে সংরক্ষিত হবে।'
                  : 'Circulars you view in JobDetails or browse on supported official portals (Teletalk, BDJobs, Bangladesh Bank) will be automatically logged here.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {visitedRecords.map((record) => {
                const matchingJob = jobs.find(
                  (j) =>
                    (record.jobId && j.id === record.jobId) ||
                    j.applicationUrl === record.canonicalUrl ||
                    j.circularUrl === record.canonicalUrl
                );
                const title = record.jobTitle || matchingJob?.position || 'Job Circular';
                const org = record.organization || matchingJob?.organization || 'Official Portal';
                const sourceBadge = record.sourceId || matchingJob?.sourceId || 'Direct Portal';
                const visitTimeStr = new Date(record.lastVisitedAt).toLocaleString();

                return (
                  <div
                    key={record.visitId}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-col justify-between gap-3 hover:border-petro-300 dark:hover:border-petro-700 transition-colors"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-petro-600 dark:text-petro-400 px-2 py-0.5 rounded-md bg-petro-50 dark:bg-petro-950/50">
                          {sourceBadge}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                          {bn ? `${record.visitCount} বার দেখা হয়েছে` : `Visited ${record.visitCount} time(s)`}
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-2">
                        {title}
                      </h4>

                      <div className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                        {org}
                      </div>

                      <div className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1 pt-1">
                        <Clock className="w-3 h-3" />
                        <span>{bn ? `সর্বশেষ দর্শন: ${visitTimeStr}` : `Last viewed: ${visitTimeStr}`}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                      <div className="flex items-center gap-1.5">
                        {matchingJob ? (
                          <button
                            type="button"
                            onClick={() => setSelectedJob(matchingJob)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-petro-50 dark:bg-petro-950/40 text-petro-700 dark:text-petro-300 hover:bg-petro-100 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>{bn ? 'বিবরণ দেখুন' : 'View Details'}</span>
                          </button>
                        ) : (
                          <a
                            href={record.canonicalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 cursor-pointer"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>{bn ? 'পোর্টাল খুলুন' : 'Open Link'}</span>
                          </a>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveVisit(record.visitId)}
                        title={bn ? 'হিস্ট্রি থেকে সরান' : 'Remove from visited history'}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Search & Filters */}
          <JobFilters
            filters={filters}
            onChange={setFilters}
            language={language}
            onOpenDiagnostic={() => setShowDiagnosticModal(true)}
          />

      {/* Active Filter Indicator + Clear Filter Bar + Preference Toggle */}
      <div className="flex items-center justify-between flex-wrap gap-2 text-xs px-1">
        <div className="flex items-center flex-wrap gap-2">
          <div className="text-slate-500 dark:text-slate-400 font-medium">
            {bn ? `মোট ${displayedJobs.length}টি বিজ্ঞপ্তি প্রদর্শিত হচ্ছে` : `Showing ${displayedJobs.length} of ${jobs.length} circular(s)`}
          </div>

          {activeStat !== 'total' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-petro-100 dark:bg-petro-950/60 text-petro-800 dark:text-petro-200 font-bold text-[11px]">
              <span>
                {activeStat === 'new_this_week'
                  ? bn ? 'ফিল্টার: এই সপ্তাহে নতুন' : 'Filter: New This Week'
                  : activeStat === 'closing_soon'
                    ? bn ? 'ফিল্টার: শীঘ্রই শেষ' : 'Filter: Closing Soon'
                    : activeStat === 'expired'
                      ? bn ? 'ফিল্টার: সময় শেষ' : 'Filter: Expired'
                      : activeStat === 'bookmarked'
                        ? bn ? 'ফিল্টার: বুকমার্ক করা' : 'Filter: Bookmarked'
                        : bn ? 'ফিল্টার: আবেদন চলমান' : 'Filter: Applications In Progress'}
              </span>
              <button
                type="button"
                aria-label="Clear card filter"
                onClick={() => handleStatCardClick(activeStat)}
                className="hover:text-rose-600 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {(activeStat !== 'total' ||
            filters.query.trim() ||
            filters.category !== 'All' ||
            filters.education !== 'All' ||
            filters.employmentType !== 'All' ||
            filters.deadline !== 'all' ||
            filters.location !== 'All' ||
            filters.bookmarkedOnly ||
            applyMyPrefsFilter) && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer"
            >
              {bn ? 'সব ফিল্টার মুছুন' : 'Clear Filter'}
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {onNavigateTracker && (
            <button
              type="button"
              onClick={onNavigateTracker}
              className="text-indigo-600 dark:text-indigo-400 hover:underline font-bold cursor-pointer"
            >
              {bn ? 'আবেদন ট্র্যাকার' : 'Open Tracker'}
            </button>
          )}
          <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-600 dark:text-slate-300 font-semibold">
            <input
              type="checkbox"
              checked={applyMyPrefsFilter}
              onChange={(e) => setApplyMyPrefsFilter(e.target.checked)}
              className="rounded text-petro-600"
            />
            <span>{bn ? 'আমার পছন্দের ফিল্টার প্রয়োগ করুন' : 'Filter by My Job Preferences'}</span>
          </label>
          {onNavigateSettings && (
            <button
              type="button"
              onClick={onNavigateSettings}
              className="inline-flex items-center gap-1 text-petro-600 hover:underline font-bold cursor-pointer"
            >
              <SlidersHorizontal className="w-3 h-3" />
              <span>{bn ? 'পছন্দ নির্ধারণ' : 'Edit Preferences'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Circular Grid */}
      {loading || (syncing && displayedJobs.length === 0) ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center text-xs text-slate-400 space-y-2">
          <div>
            {syncing
              ? bn
                ? 'অফিশিয়াল সূত্র থেকে জব সার্কুলার আনা হচ্ছে...'
                : 'Fetching live job circulars from official sources...'
              : bn
                ? 'জব সার্কুলার লোড হচ্ছে...'
                : 'Loading job circulars...'}
          </div>
        </div>
      ) : loadState === 'fetch_failure' && displayedJobs.length === 0 ? (
        <div className="bg-rose-50 dark:bg-rose-950/30 rounded-2xl border border-rose-200 dark:border-rose-900 p-10 text-center space-y-3">
          <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto" />
          <h3 className="text-sm font-bold text-rose-900 dark:text-rose-200">
            {bn ? 'জব সার্কুলার লোড করতে ব্যর্থ হয়েছে' : 'Failed to Load Job Circulars'}
          </h3>
          <p className="text-xs text-rose-700 dark:text-rose-300 max-w-md mx-auto">
            {errorMessage ||
              (bn
                ? 'উৎস সার্ভার বা লোকাল স্টোরেজ থেকে তথ্য আনা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।'
                : 'Could not retrieve circulars from sources or local storage. Please retry or check Sources Status.')}
          </p>
          <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
            <button
              type="button"
              onClick={() => handleSyncSources()}
              disabled={syncing}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              <span>{bn ? 'আবার চেষ্টা করুন' : 'Retry'}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowSourcesPanel(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 cursor-pointer"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>{bn ? 'উৎসের অবস্থা দেখুন' : 'View Sources Status'}</span>
            </button>
          </div>
        </div>
      ) : displayedJobs.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center space-y-3">
          <Briefcase className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-white">
            {jobs.length === 0
              ? bn ? 'এখনও কোনো জব সার্কুলার সংরক্ষিত নেই' : 'No Job Circulars Saved Yet'
              : hubTab === 'applied'
              ? bn ? 'আপনি এখনও কোনো চাকরিতে আবেদন সম্পন্ন করেননি' : 'No applications submitted yet'
              : hubTab === 'bookmarked'
              ? bn ? 'কোনো সার্কুলার বুকমার্ক করা নেই' : 'No bookmarked circulars'
              : bn ? 'আপনার ফিল্টার অনুযায়ী কোনো চাকরি পাওয়া যায়নি' : 'No circulars match your current filters'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            {jobs.length === 0
              ? bn
                ? '"আপডেট চেক করুন" ক্লিক করে অফিশিয়াল পোর্টাল (BPSC, বাংলাদেশ ব্যাংক, Bdjobs) থেকে রিয়েল বিজ্ঞপ্তি আনুন অথবা নিজে সার্কুলার যুক্ত করুন।'
                : 'Click "Fetch Latest" to collect live circulars from verified public sources (BPSC, Bangladesh Bank, Bdjobs, Discovery RSS) or add a circular manually.'
              : hubTab === 'applied'
              ? bn
                ? 'যেসব চাকরির আবেদন সম্পন্ন হয়েছে অথবা আপনি ম্যানুয়ালি "আবেদন সম্পন্ন" হিসেবে চিহ্নিত করেছেন, সেগুলো এখানে থাকবে।'
                : 'Jobs where submission was confirmed or that you marked as applied will appear here.'
              : bn
                ? 'ফিল্টার রিসেট করে আবার চেষ্টা করুন।'
                : 'Try clearing or adjusting your search filters.'}
          </p>
          <div className="flex items-center justify-center gap-2 pt-2 flex-wrap">
            {jobs.length > 0 && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border border-petro-300 dark:border-petro-700 text-petro-700 dark:text-petro-300 cursor-pointer"
              >
                <span>{bn ? 'সব ফিল্টার মুছুন' : 'Clear Filter'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => handleSyncSources()}
              disabled={syncing}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-petro-600 hover:bg-petro-700 text-white cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              <span>{bn ? 'অফিশিয়াল সূত্র থেকে আনুন' : 'Fetch Latest Circulars'}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{bn ? 'ম্যানুয়ালি যুক্ত করুন' : 'Add Job Circular'}</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div
            role="list"
            aria-label={bn ? 'চাকরির বিজ্ঞপ্তির তালিকা' : 'Job circulars list'}
            className="grid grid-cols-1 lg:grid-cols-2 gap-4"
          >
            {paginatedJobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                isBookmarked={bookmarkedIds.has(job.id)}
                applicationStatus={appByJobId.get(job.id)?.status}
                language={language}
                onViewDetails={(j) => setSelectedJob(j)}
                onApplyNow={handleApplyNow}
                onToggleBookmark={handleToggleBookmark}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <nav
              aria-label="Job circulars pagination"
              className="flex flex-wrap items-center justify-between gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs"
            >
              <span className="text-slate-500 dark:text-slate-400 font-semibold">
                {bn
                  ? `পৃষ্ঠা ${safeCurrentPage} / ${totalPages} (মোট ${displayedJobs.length}টি)`
                  : `Page ${safeCurrentPage} of ${totalPages} (${displayedJobs.length} total)`}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={safeCurrentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-lg font-bold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                >
                  {bn ? 'পূর্ববর্তী' : 'Previous'}
                </button>
                <button
                  type="button"
                  disabled={safeCurrentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3 py-1.5 rounded-lg font-bold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                >
                  {bn ? 'পরবর্তী' : 'Next'}
                </button>
              </div>
            </nav>
          )}
        </div>
      )}
    </>
  )}

      {/* Honest Data & Source Disclaimer */}
      <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 text-[11px] text-slate-500 dark:text-slate-400 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
        <span>
          {bn
            ? 'বিজ্ঞপ্তি সংগ্রহ নীতি: প্রতিটি পোর্টালের কারিগরি ও অ্যাক্সেস সীমাবদ্ধতার কারণে সব ওয়েবসাইট স্বয়ংক্রিয়ভাবে স্ক্যান নাও হতে পারে। যাচাইকৃত তারিখ ছাড়া কোনো ভুয়া কাউন্টডাউন দেখানো হয় না।'
            : 'Source Transparency: Website layout restrictions and client-side SPAs (such as Teletalk All Jobs) limit automatic extraction. Discovery RSS items are never marked officially verified, and missing deadlines always show "Deadline Not Verified".'}
        </span>
      </div>

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

      {showPortalsModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Official Job Portals"
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-5xl w-full max-h-[88vh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span aria-hidden="true">🌐</span>
                <h2 className="text-base font-black text-slate-900 dark:text-white">
                  {bn ? 'অফিশিয়াল জব পোর্টালসমূহ' : 'Official Job Portals'}
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close Official Job Portals"
                onClick={() => setShowPortalsModal(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <PortalModalCloseIcon className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto">
              <OfficialJobPortalsDirectory compact />
            </div>
          </div>
        </div>
      )}

      <MissingApplicationUrlModal
        job={missingAppJob}
        language={language}
        onClose={() => setMissingAppJob(null)}
      />

      <MissingCircularDiagnosticModal
        isOpen={showDiagnosticModal}
        onClose={() => setShowDiagnosticModal(false)}
        allJobs={jobs}
        activeFilters={filters}
        language={language}
        onClearFiltersAndView={(job) => {
          setShowDiagnosticModal(false);
          setFilters(DEFAULT_JOB_FILTERS);
          setSelectedJob(job);
        }}
        onSwitchTabExpired={(job) => {
          setShowDiagnosticModal(false);
          setFilters({ ...DEFAULT_JOB_FILTERS, statFilter: 'expired' });
          setSelectedJob(job);
        }}
        onFetchLatest={async () => {
          setShowDiagnosticModal(false);
          await handleSyncSources();
        }}
        onOpenAddManualModal={(prefillUrl) => {
          setShowDiagnosticModal(false);
          if (prefillUrl) {
            setManualPrefill({
              organization: '',
              importUrl: prefillUrl,
              category: 'Government',
              notes: `Prefill from Diagnostic: ${prefillUrl}`,
            });
          }
          setShowAddModal(true);
        }}
      />
    </div>
  );
};
