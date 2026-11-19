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
  Award,
  Layers,
  Download,
  Building2,
  Calendar,
  FileText,
  Save,
  Filter,
  Sparkles,
  Check,
  BookmarkPlus,
} from 'lucide-react';
import { useApp } from '../../dashboard/context/AppContext';
import { ProfileRepository } from '../../database/profile-repository';
import type { UserProfile } from '../../types/profile';
import {
  NATIONAL_PAY_SCALE_2015,
  getAscendingPayGrades,
  formatGradeWithPayScale,
} from '../services/pay-scale-metadata';
import { ACADEMIC_DISCIPLINES, getSubjectById } from '../taxonomy/subject-taxonomy';
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
import {
  ExamScheduleRepository,
  AdmitCardNoticeRepository,
  SeatPlanNoticeRepository,
  JobResultRepository,
  seedDefaultLifecycleStores,
} from '../database';
import type {
  ExamSchedule,
  AdmitCardNotice,
  SeatPlanNotice,
  JobResult,
} from '../types/job-system.types';
import { isNonGovernmentCategoryLetter } from '../types/job-system.types';
import { CANONICAL_18_CATEGORIES, mapJobToCategoryLetter } from '../taxonomy/canonical-categories';
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
import { evaluateProfileEligibility } from '../services/eligibility-helper';

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
  const [hubTab, setHubTab] = useState<
    | 'all'
    | 'government'
    | 'private'
    | 'categories'
    | 'grades'
    | 'eligible'
    | 'upcoming_openings'
    | 'deadline_tomorrow'
    | 'upcoming_exams'
    | 'admit_cards'
    | 'seat_plans'
    | 'results'
    | 'recent_updates'
    | 'recommended'
    | 'visited'
    | 'bookmarked'
    | 'closing_soon'
    | 'applied'
  >('all');
  const [comparedJobIds, setComparedJobIds] = useState<Set<string>>(new Set());
  const [followedOrgs, setFollowedOrgs] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('jobfill_followed_organizations');
      return stored ? new Set(JSON.parse(stored)) : new Set(['BPSC', 'Bangladesh Bank']);
    } catch {
      return new Set(['BPSC', 'Bangladesh Bank']);
    }
  });
  const [visitedRecords, setVisitedRecords] = useState<JobVisitRecord[]>([]);
  const [trackVisitsEnabled, setTrackVisitsEnabled] = useState(true);
  const [examSchedules, setExamSchedules] = useState<ExamSchedule[]>([]);
  const [admitCards, setAdmitCards] = useState<AdmitCardNotice[]>([]);
  const [seatPlans, setSeatPlans] = useState<SeatPlanNotice[]>([]);
  const [jobResults, setJobResults] = useState<JobResult[]>([]);

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
  const [pageSize, setPageSize] = useState<number>(24);
  const [candidateProfile, setCandidateProfile] = useState<UserProfile | null>(null);
  const [savedPresets, setSavedPresets] = useState<{ id: string; name: string; filters: JobSearchFilters }[]>(() => {
    try {
      const stored = localStorage.getItem('jobfill_saved_filter_presets');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [showSavePresetModal, setShowSavePresetModal] = useState(false);
  const [presetNameInput, setPresetNameInput] = useState('');
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
      seedDefaultLifecycleStores().catch(() => {});
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      try {
        const [
          allJobs,
          bmIds,
          apps,
          prefs,
          outcomes,
          schedState,
          visits,
          visitsEnabled,
          schedules,
          admits,
          seats,
          results,
        ] = await Promise.race([
          Promise.all([
            JobRepository.getAllJobs(),
            BookmarkRepository.getBookmarkedJobIds(),
            ApplicationRepository.getAll(),
            JobRepository.getPreferences(),
            JobRepository.getSourceOutcomes(),
            JobRepository.getSchedulerState(),
            JobVisitRepository.getAllVisits(),
            JobVisitRepository.isVisitTrackingEnabled(),
            ExamScheduleRepository.getAll(),
            AdmitCardNoticeRepository.getAll(),
            SeatPlanNoticeRepository.getAll(),
            JobResultRepository.getAll(),
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
        setExamSchedules(schedules || []);
        setAdmitCards(admits || []);
        setSeatPlans(seats || []);
        setJobResults(results || []);
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

  const examScheduleByJobId = useMemo(() => {
    const map = new Map<string, ExamSchedule>();
    for (const e of examSchedules) {
      if (!map.has(e.circularId) || e.status === 'Announced') {
        map.set(e.circularId, e);
      }
    }
    return map;
  }, [examSchedules]);

  const latestResultByJobId = useMemo(() => {
    const map = new Map<string, JobResult>();
    for (const r of jobResults) {
      map.set(r.circularId, r);
    }
    return map;
  }, [jobResults]);

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

  const m2Metrics = useMemo(() => {
    const nowMs = Date.now();
    const SEVEN_DAYS_MS = 7 * DAY_MS;

    let totalCirculars = jobs.length;
    let governmentJobs = 0;
    let privateAndBankJobs = 0;
    let applicationOpen = 0;
    let closingSoon = 0;

    for (const j of jobs) {
      const catLetter = (j as any).categoryLetter || mapJobToCategoryLetter(j);
      const isNonGov =
        isNonGovernmentCategoryLetter(catLetter) ||
        j.category === 'Private' ||
        j.category === 'NGO' ||
        (j as any).sector === 'Private' ||
        (j as any).sector === 'NGO' ||
        (j as any).sector === 'International';

      if (isNonGov) {
        privateAndBankJobs++;
      } else {
        governmentJobs++;
      }

      if (j.deadlineAt && j.deadlineVerified) {
        if (j.deadlineAt >= nowMs) {
          applicationOpen++;
          if (j.deadlineAt - nowMs <= SEVEN_DAYS_MS) {
            closingSoon++;
          }
        }
      } else if (j.status === 'active') {
        applicationOpen++;
      }
    }

    const upcomingExamsSet = new Set(
      examSchedules.filter((e) => e.status === 'Announced' || e.status === 'Rescheduled').map((e) => e.circularId)
    );

    const admitCardsSet = new Set(
      admitCards.filter((a) => a.status === 'Available').map((a) => a.circularId)
    );

    const resultsSet = new Set(
      jobResults
        .filter(
          (r) =>
            r.publicationStatus === 'Result Published' ||
            r.publicationStatus === 'Revised Result Published' ||
            r.publicationStatus === 'Partially Published'
        )
        .map((r) => r.circularId)
    );

    return {
      totalCirculars,
      governmentJobs,
      privateAndBankJobs,
      applicationOpen,
      closingSoon: closingSoon || summary.closingSoon,
      upcomingExams: upcomingExamsSet.size,
      admitCardsAvailable: admitCardsSet.size,
      publishedResults: resultsSet.size,
    };
  }, [jobs, examSchedules, admitCards, jobResults, summary.closingSoon]);

  const eligibleCount = useMemo(() => {
    if (!candidateProfile) return 0;
    let count = 0;
    for (const j of jobs) {
      try {
        const rep = evaluateProfileEligibility(candidateProfile, j);
        if (rep.overallStatus === 'ELIGIBLE') count++;
      } catch {}
    }
    return count;
  }, [jobs, candidateProfile]);

  const deadlineTomorrowCount = useMemo(() => {
    const now = Date.now();
    return jobs.filter((j) => {
      if (!j.deadlineVerified || typeof j.deadlineAt !== 'number') return false;
      const diff = j.deadlineAt - now;
      return diff > 0 && diff <= 48 * 3600 * 1000;
    }).length;
  }, [jobs]);

  const upcomingOpeningsCount = useMemo(() => {
    const now = Date.now();
    return jobs.filter((j) => typeof j.applicationStartAt === 'number' && j.applicationStartAt > now).length;
  }, [jobs]);

  const enrichedJobs = useMemo(() => {
    return jobs.map((job) => {
      let verdict: string | undefined = undefined;
      if (candidateProfile) {
        try {
          const rep = evaluateProfileEligibility(candidateProfile, job);
          verdict = rep.overallStatus;
        } catch {}
      }
      return {
        ...job,
        eligibilityVerdict: verdict,
        examSchedules: examSchedules.filter((e) => e.circularId === job.id),
        results: jobResults.filter((r) => r.circularId === job.id),
      };
    });
  }, [jobs, candidateProfile, examSchedules, jobResults]);

  const displayedJobs = useMemo(() => {
    let list = filterAndSortJobs(enrichedJobs, filters, bookmarkedIds, Date.now(), appByJobId);
    if (applyMyPrefsFilter || hubTab === 'recommended') {
      list = list.filter((j) => jobMatchesPreferences(j, preferences));
    }
    if (hubTab === 'bookmarked') {
      list = list.filter((j) => bookmarkedIds.has(j.id));
    }
    if (hubTab === 'eligible') {
      list = list.filter((j) => (j as any).eligibilityVerdict === 'ELIGIBLE');
    }
    if (hubTab === 'deadline_tomorrow') {
      const now = Date.now();
      list = list.filter((j) => {
        if (!j.deadlineVerified || typeof j.deadlineAt !== 'number') return false;
        const diff = j.deadlineAt - now;
        return diff > 0 && diff <= 48 * 3600 * 1000;
      });
    }
    if (hubTab === 'upcoming_openings') {
      const now = Date.now();
      list = list.filter((j) => typeof j.applicationStartAt === 'number' && j.applicationStartAt > now);
    }
    if (hubTab === 'closing_soon') {
      const now = Date.now();
      list = list.filter((j) => isJobMatchingStatFilter(j, 'closing_soon', bookmarkedIds, appByJobId, now));
    }
    if (hubTab === 'applied') {
      list = list.filter((j) => appByJobId.get(j.id)?.status === 'Applied');
    }
    if (hubTab === 'government') {
      list = list.filter((j) => {
        const catLetter = (j as any).categoryLetter || mapJobToCategoryLetter(j);
        return ['A', 'B', 'K', 'L'].includes(catLetter) || j.category === 'Government' || j.isGovernmentJob;
      });
    }
    if (hubTab === 'private') {
      list = list.filter((j) => {
        const catLetter = (j as any).categoryLetter || mapJobToCategoryLetter(j);
        return ['D', 'N', 'O', 'P', 'Q'].includes(catLetter) || j.category === 'Private' || j.category === 'Bank';
      });
    }
    if (hubTab === 'grades') {
      list = list.filter((j) => j.gradeNumber !== null && j.gradeNumber !== undefined && j.gradeNumber >= 1 && j.gradeNumber <= 20);
    }
    if (hubTab === 'upcoming_exams') {
      const examJobIds = new Set(examSchedules.filter((e) => e.status === 'Announced' || e.status === 'Rescheduled').map((e) => e.circularId));
      list = list.filter((j) => examJobIds.has(j.id));
    }
    if (hubTab === 'admit_cards') {
      const admitJobIds = new Set(admitCards.filter((a) => a.status === 'Available').map((a) => a.circularId));
      list = list.filter((j) => admitJobIds.has(j.id));
    }
    if (hubTab === 'seat_plans') {
      const seatJobIds = new Set(seatPlans.filter((s) => s.status === 'Announced').map((s) => s.circularId));
      list = list.filter((j) => seatJobIds.has(j.id));
    }
    if (hubTab === 'results') {
      const resultJobIds = new Set(jobResults.filter((r) => r.publicationStatus === 'Result Published' || r.publicationStatus === 'Revised Result Published' || r.publicationStatus === 'Partially Published').map((r) => r.circularId));
      list = list.filter((j) => resultJobIds.has(j.id));
    }
    if (hubTab === 'recent_updates') {
      list = list.filter((j) => Boolean(j.lastUpdatedAt || (j as any).updatedDate));
    }
    return list;
  }, [enrichedJobs, filters, bookmarkedIds, applyMyPrefsFilter, hubTab, preferences, appByJobId, examSchedules, admitCards, seatPlans, jobResults]);

  useEffect(() => {
    ProfileRepository.getAllProfiles().then((profs) => {
      if (profs && profs.length > 0) {
        setCandidateProfile(profs[0]);
      }
    }).catch(() => {});
  }, []);

  const totalPages = Math.max(1, Math.ceil(displayedJobs.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedJobs = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return displayedJobs.slice(start, start + pageSize);
  }, [displayedJobs, safeCurrentPage, pageSize]);

  const gradeJobCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    for (let g = 4; g <= 20; g++) counts[g] = 0;
    for (const j of jobs) {
      if (j.gradeNumber && j.gradeNumber >= 4 && j.gradeNumber <= 20) {
        counts[j.gradeNumber] = (counts[j.gradeNumber] || 0) + 1;
      }
    }
    return counts;
  }, [jobs]);

  const profileReadiness = useMemo(() => {
    if (!candidateProfile) return 0;
    let score = 0;
    // 1. Personal Information (10%)
    if (candidateProfile.personal?.applicantNameEn && candidateProfile.personal?.fatherNameEn) score += 10;
    // 2. Date of Birth (15%)
    if (candidateProfile.personal?.dob) score += 15;
    // 3. Address (10%)
    if (candidateProfile.address?.permanent?.district) score += 10;
    // 4. Contact / Mobile (10%)
    if (candidateProfile.personal?.mobile) score += 10;
    // 5. Secondary / Higher Secondary Education (15%)
    if (candidateProfile.ssc?.examination || candidateProfile.hsc?.examination) score += 15;
    // 6. Higher Education & Subject (15%)
    if (
      candidateProfile.graduation?.subjectDegree ||
      candidateProfile.graduation?.examination ||
      (candidateProfile.educationDegrees && candidateProfile.educationDegrees.length > 0)
    ) {
      score += 15;
    }
    // 7. Identity & Documents / NID (15%)
    const docs = (candidateProfile as any).documents || [];
    if (candidateProfile.personal?.nid || (Array.isArray(docs) && docs.length > 0)) {
      score += 15;
    }
    // 8. Photo & Signature (10%)
    const hasPhoto = Boolean(
      (candidateProfile as any).photo?.dataUrl ||
      (candidateProfile as any).photoUrl ||
      (Array.isArray(docs) && docs.some((d: any) => d.category === 'photo'))
    );
    const hasSig = Boolean(
      (candidateProfile as any).signature?.dataUrl ||
      (candidateProfile as any).signatureUrl ||
      (Array.isArray(docs) && docs.some((d: any) => d.category === 'signature'))
    );
    if (hasPhoto || hasSig) score += 10;

    return Math.min(100, score);
  }, [candidateProfile]);

  const handleToggleFollowOrg = useCallback((orgName: string) => {
    if (!orgName) return;
    setFollowedOrgs((prev) => {
      const next = new Set(prev);
      if (next.has(orgName)) {
        next.delete(orgName);
      } else {
        next.add(orgName);
      }
      try {
        localStorage.setItem('jobfill_followed_organizations', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  }, []);

  const handleToggleCompareJob = useCallback((jobId: string) => {
    setComparedJobIds((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  }, []);

  const handleSaveFilterPreset = (name: string) => {
    if (!name.trim()) return;
    const newPreset = {
      id: 'preset_' + Date.now().toString(36),
      name: name.trim(),
      filters: { ...filters },
    };
    const updated = [...savedPresets, newPreset];
    setSavedPresets(updated);
    try {
      localStorage.setItem('jobfill_saved_filter_presets', JSON.stringify(updated));
    } catch {}
    setShowSavePresetModal(false);
    setPresetNameInput('');
    if (showToast) {
      showToast(bn ? 'ফিল্টার প্রিসেট সংরক্ষিত হয়েছে' : 'Filter preset saved successfully');
    }
  };

  const handleDeleteFilterPreset = (presetId: string) => {
    const updated = savedPresets.filter((p) => p.id !== presetId);
    setSavedPresets(updated);
    try {
      localStorage.setItem('jobfill_saved_filter_presets', JSON.stringify(updated));
    } catch {}
  };

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

      {/* 10 Navigation Tabs (Milestone M2) + User Tracking Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto" role="tablist">
        {[
          { id: 'all', label: bn ? 'সব সার্কুলার' : 'All Jobs', count: jobs.length, icon: Briefcase },
          { id: 'government', label: bn ? 'সরকারি চাকরি' : 'Government Jobs', count: m2Metrics.governmentJobs, icon: Award },
          { id: 'private', label: bn ? 'বেসরকারি ও ব্যাংক' : 'Private & Bank', count: m2Metrics.privateAndBankJobs, icon: Building2 },
          { id: 'categories', label: bn ? 'ক্যাটাগরি (A-R)' : 'Categories (A–R)', count: CANONICAL_18_CATEGORIES.length, icon: Layers },
          { id: 'grades', label: bn ? 'পে গ্রেড (১-২০)' : 'Govt Grades', count: null, icon: Award },
          { id: 'upcoming_exams', label: bn ? 'আসন্ন পরীক্ষা' : 'Upcoming Exams', count: m2Metrics.upcomingExams, icon: Calendar },
          { id: 'admit_cards', label: bn ? 'প্রবেশপত্র' : 'Admit Cards', count: m2Metrics.admitCardsAvailable, icon: Download },
          { id: 'seat_plans', label: bn ? 'আসন বিন্যাস' : 'Seat Plans', count: seatPlans.length, icon: FileText },
          { id: 'results', label: bn ? 'ফলাফল ও মেধা তালিকা' : 'Published Results', count: m2Metrics.publishedResults, icon: Award },
          { id: 'recent_updates', label: bn ? 'সাম্প্রতিক আপডেট' : 'Recent Updates', count: null, icon: Clock },
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
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
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

      {/* Categories A-R Quick Chips when categories tab is selected */}
      {hubTab === 'categories' && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 no-scrollbar bg-slate-50 dark:bg-slate-850 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
          <span className="text-xs font-bold text-slate-600 dark:text-slate-300 shrink-0 mr-1">
            {bn ? 'ক্যাটাগরি বাছুন:' : 'Select Category:'}
          </span>
          <button
            type="button"
            onClick={() => setFilters((prev) => ({ ...prev, categoryLetter: 'All' }))}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer shrink-0 ${
              !filters.categoryLetter || filters.categoryLetter === 'All'
                ? 'bg-petro-600 text-white border-petro-600'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
            }`}
          >
            {bn ? 'সব (A-R)' : 'All (A–R)'}
          </button>
          {CANONICAL_18_CATEGORIES.map((cat) => {
            const isCatActive = filters.categoryLetter === cat.letter;
            return (
              <button
                key={cat.letter}
                type="button"
                onClick={() => setFilters((prev) => ({ ...prev, categoryLetter: cat.letter }))}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer shrink-0 ${
                  isCatActive
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className="font-bold">{cat.letter}.</span>
                <span>{bn ? cat.nameBn : cat.nameEn}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* 8 Primary Summary Metric Cards (Milestone M2) & Status Trackers in role="group" */}
      <div className="space-y-2.5" role="group" aria-label={bn ? 'ড্যাশবোর্ড পরিসংখ্যান ফিল্টার' : 'Dashboard statistics filters'}>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
          {[
            {
              id: 'total' as DashboardStatFilter,
              label: bn ? 'মোট সার্কুলার' : 'Total Job Circulars',
              value: summary.total,
              color: 'text-slate-800 dark:text-white',
              bg: 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800',
              activeBg: 'ring-2 ring-petro-600 border-petro-600 bg-petro-50/40 dark:bg-petro-950/30',
              onClick: () => handleStatCardClick('total'),
            },
            {
              id: 'govt_jobs',
              label: bn ? 'সরকারি চাকরি (১-২০)' : 'Government Jobs (Grade 1–20)',
              value: m2Metrics.governmentJobs,
              color: 'text-amber-600 dark:text-amber-400',
              bg: 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800',
              activeBg: 'ring-2 ring-amber-500 border-amber-600 bg-amber-50/50',
              onClick: () => setHubTab('government'),
            },
            {
              id: 'private_bank',
              label: bn ? 'বেসরকারি ও ব্যাংক' : 'Private & Bank Jobs',
              value: m2Metrics.privateAndBankJobs,
              color: 'text-blue-600 dark:text-blue-400',
              bg: 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800',
              activeBg: 'ring-2 ring-blue-500 border-blue-600 bg-blue-50/50',
              onClick: () => setHubTab('private'),
            },
            {
              id: 'application_open',
              label: bn ? 'আবেদন উন্মুক্ত' : 'Application Open',
              value: m2Metrics.applicationOpen,
              color: 'text-emerald-600 dark:text-emerald-400',
              bg: 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800',
              activeBg: 'ring-2 ring-emerald-500 border-emerald-600 bg-emerald-50/50',
              onClick: () => handleStatCardClick('total'),
            },
            {
              id: 'closing_soon' as DashboardStatFilter,
              label: bn ? 'শীঘ্রই শেষ' : 'Closing Soon',
              value: summary.closingSoon,
              color: 'text-amber-600 dark:text-amber-400',
              bg: 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900',
              activeBg: 'ring-2 ring-amber-500 border-amber-600 bg-amber-100/70 dark:bg-amber-950/60',
              onClick: () => handleStatCardClick('closing_soon'),
            },
            {
              id: 'upcoming_exams',
              label: bn ? 'আসন্ন পরীক্ষা' : 'Upcoming Exams Announced',
              value: m2Metrics.upcomingExams,
              color: 'text-cyan-600 dark:text-cyan-400',
              bg: 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800',
              activeBg: 'ring-2 ring-cyan-500 border-cyan-600 bg-cyan-50/50',
              onClick: () => setHubTab('upcoming_exams'),
            },
            {
              id: 'admit_cards',
              label: bn ? 'প্রবেশপত্র উপলব্ধ' : 'Admit Cards Available',
              value: m2Metrics.admitCardsAvailable,
              color: 'text-indigo-600 dark:text-indigo-400',
              bg: 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800',
              activeBg: 'ring-2 ring-indigo-500 border-indigo-600 bg-indigo-50/50',
              onClick: () => setHubTab('admit_cards'),
            },
            {
              id: 'results',
              label: bn ? 'প্রকাশিত ফলাফল' : 'Published Results',
              value: m2Metrics.publishedResults,
              color: 'text-purple-600 dark:text-purple-400',
              bg: 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800',
              activeBg: 'ring-2 ring-purple-500 border-purple-600 bg-purple-50/50',
              onClick: () => setHubTab('results'),
            },
          ].map((card) => {
            const isSelected = activeStat === card.id || hubTab === card.id;
            return (
              <button
                key={card.id}
                type="button"
                aria-pressed={isSelected}
                aria-label={`${card.label}: ${card.value}`}
                onClick={card.onClick}
                className={`text-left p-2.5 rounded-2xl border shadow-xs hover:border-petro-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-petro-500 transition-all cursor-pointer ${
                  isSelected ? card.activeBg : card.bg
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <div className={`text-lg font-bold ${card.color}`}>{card.value}</div>
                </div>
                <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5 leading-tight line-clamp-2">
                  {card.label}
                </div>
              </button>
            );
          })}
        </div>

        {/* Status Tracker Quick Filters (Preserving Backward Compatibility) */}
        <div className="flex items-center gap-2 overflow-x-auto pt-1 pb-0.5">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 shrink-0">
            {bn ? 'স্ট্যাটাস ফিল্টার:' : 'Status Trackers:'}
          </span>
          {[
            {
              id: 'eligible',
              label: bn ? 'আমার যোগ্য চাকরি' : 'Eligible Jobs',
              value: eligibleCount,
              color: 'text-emerald-600 dark:text-emerald-400',
              bg: 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800',
              activeBg: 'ring-2 ring-emerald-600 border-emerald-600 bg-emerald-100/70 dark:bg-emerald-950/50',
              onClick: () => {
                setHubTab('eligible');
                setFilters((prev) => ({ ...prev, statFilter: 'total' }));
                setCurrentPage(1);
              },
            },
            {
              id: 'deadline_tomorrow',
              label: bn ? 'আগামীকাল শেষ' : 'Deadline Tomorrow',
              value: deadlineTomorrowCount,
              color: 'text-rose-600 dark:text-rose-400',
              bg: 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800',
              activeBg: 'ring-2 ring-rose-500 border-rose-600 bg-rose-100/70 dark:bg-rose-950/50',
              onClick: () => {
                setHubTab('deadline_tomorrow');
                setFilters((prev) => ({ ...prev, statFilter: 'total' }));
                setCurrentPage(1);
              },
            },
            {
              id: 'upcoming_openings',
              label: bn ? 'আবেদন শুরু হবে' : 'Upcoming Openings',
              value: upcomingOpeningsCount,
              color: 'text-cyan-600 dark:text-cyan-400',
              bg: 'bg-cyan-50/50 dark:bg-cyan-950/20 border-cyan-200 dark:border-cyan-800',
              activeBg: 'ring-2 ring-cyan-500 border-cyan-600 bg-cyan-100/70 dark:bg-cyan-950/50',
              onClick: () => {
                setHubTab('upcoming_openings');
                setFilters((prev) => ({ ...prev, statFilter: 'total' }));
                setCurrentPage(1);
              },
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
            const isSelected = activeStat === card.id || hubTab === card.id;
            return (
              <button
                key={card.id}
                type="button"
                aria-pressed={isSelected}
                aria-label={`${card.label}: ${card.value}`}
                onClick={(card as any).onClick || (() => handleStatCardClick(card.id as any))}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  isSelected ? card.activeBg : card.bg
                }`}
              >
                <span className={`font-bold ${card.color}`}>{card.value}</span>
                <span className="text-slate-600 dark:text-slate-300">{card.label}</span>
              </button>
            );
          })}
        </div>
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

          {/* Profile Readiness & Smart Eligibility Indicator */}
          {candidateProfile && (
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="relative w-8 h-8 flex items-center justify-center rounded-full bg-emerald-600 text-white font-extrabold text-[11px] shadow-xs">
                  {profileReadiness}%
                </div>
                <div>
                  <div className="font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>
                      {bn
                        ? `প্রোফাইল সম্পূর্ণতা: ${profileReadiness}%`
                        : `Profile Readiness: ${profileReadiness}%`}
                    </span>
                  </div>
                  <div className="text-[11px] text-emerald-700 dark:text-emerald-300">
                    {profileReadiness >= 90
                      ? bn
                        ? 'আপনার প্রোফাইল সম্পূর্ণ! স্মার্ট যোগ্যতা ফিল্টারিং নির্ভুলভাবে কাজ করছে।'
                        : 'Profile complete! Smart eligibility matching is fully accurate.'
                      : bn
                        ? 'অনার্স/মাস্টার্সের বিষয় ও জেলা যোগ করলে যোগ্য চাকরির স্মার্ট ফিল্টারিং শতভাগ সক্রিয় হবে।'
                        : 'Complete degree subject and district to unlock 100% smart eligibility filtering.'}
                  </div>
                </div>
              </div>
              {profileReadiness < 90 && onNavigateSettings && (
                <button
                  type="button"
                  onClick={onNavigateSettings}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs cursor-pointer"
                >
                  {bn ? 'প্রোফাইল আপডেট করুন' : 'Complete Profile'}
                </button>
              )}
            </div>
          )}

          {/* Grade 4–20 Explorer Sub-bar (NPS 2015 Ascending Order) */}
          <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Award className="w-4 h-4 text-amber-600" />
                <span>
                  {bn
                    ? 'জাতীয় বেতন স্কেল ২০১৫ অনুযায়ী গ্রেড ৪ হতে ২০ পর্যন্ত এক্সপ্লোরার'
                    : 'National Pay Scale 2015: Grade 4 to 20 Explorer'}
                </span>
              </span>
              {filters.selectedGrades && filters.selectedGrades.length > 0 && (
                <button
                  type="button"
                  onClick={() => setFilters((prev) => ({ ...prev, selectedGrades: [] }))}
                  className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer"
                >
                  {bn ? 'গ্রেড ফিল্টার মুছুন' : 'Clear Grade Filter'}
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5">
              {getAscendingPayGrades().map((meta) => {
                const gStr = String(meta.gradeNumber);
                const isSelected = (filters.selectedGrades || []).includes(gStr);
                const count = gradeJobCounts[meta.gradeNumber] || 0;
                return (
                  <button
                    key={meta.gradeNumber}
                    type="button"
                    onClick={() => {
                      setFilters((prev) => {
                        const current = prev.selectedGrades || [];
                        const next = current.includes(gStr)
                          ? current.filter((x) => x !== gStr)
                          : [...current, gStr];
                        return { ...prev, selectedGrades: next };
                      });
                    }}
                    className={`shrink-0 px-2.5 py-1.5 rounded-xl border text-center transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-amber-400 text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    <div className="text-[11px] font-bold leading-tight">{meta.banglaLabel}</div>
                    <div className="text-[9px] opacity-80 whitespace-nowrap">{meta.payScale}</div>
                    <div className={`text-[9.5px] font-bold mt-0.5 ${isSelected ? 'text-amber-100' : 'text-amber-600 dark:text-amber-400'}`}>
                      {count} {bn ? 'বিজ্ঞপ্তি' : 'jobs'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Filter Chips Bar & Save Filter Presets */}
          <div className="space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2 text-xs px-1">
              <div className="flex items-center flex-wrap gap-2">
                <span className="text-slate-500 dark:text-slate-400 font-semibold">
                  {bn
                    ? `মোট ${displayedJobs.length}টি বিজ্ঞপ্তি প্রদর্শিত হচ্ছে`
                    : `Showing ${displayedJobs.length} of ${jobs.length} circular(s)`}
                </span>

                {/* Save Filter Button */}
                <button
                  type="button"
                  onClick={() => setShowSavePresetModal(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-bold text-[11px] hover:bg-indigo-100 cursor-pointer"
                >
                  <Save className="w-3 h-3" />
                  <span>{bn ? 'ফিল্টার সংরক্ষণ' : 'Save Filter'}</span>
                </button>

                {/* Clear All Filters Button */}
                {(filters.query ||
                  filters.category !== 'All' ||
                  filters.education !== 'All' ||
                  filters.location !== 'All' ||
                  (filters.selectedGrades && filters.selectedGrades.length > 0) ||
                  (filters.academicDiscipline && filters.academicDiscipline !== 'All') ||
                  (filters.academicSubject && filters.academicSubject !== 'All') ||
                  filters.minSalary ||
                  filters.minGpa ||
                  filters.deadline !== 'all') && (
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer"
                  >
                    {bn ? 'সব ফিল্টার মুছুন' : 'Clear Filter'}
                  </button>
                )}
              </div>

              {/* Saved Filter Presets List */}
              {savedPresets.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] text-slate-400 font-medium">
                    {bn ? 'সংরক্ষিত প্রিসেট:' : 'Saved Presets:'}
                  </span>
                  {savedPresets.map((preset) => (
                    <span
                      key={preset.id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-[10.5px] font-semibold text-slate-700 dark:text-slate-300"
                    >
                      <button
                        type="button"
                        onClick={() => setFilters(preset.filters)}
                        className="hover:text-petro-600 cursor-pointer"
                      >
                        {preset.name}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteFilterPreset(preset.id)}
                        className="hover:text-rose-600 cursor-pointer"
                        title="Delete preset"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Removable Active Filter Chips */}
            <div className="flex items-center flex-wrap gap-1.5">
              {filters.query && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-[11px] font-semibold">
                  <span>অনুসন্ধান: "{filters.query}"</span>
                  <button type="button" onClick={() => setFilters((p) => ({ ...p, query: '' }))} className="hover:text-rose-600 cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {(filters.selectedGrades || []).map((g) => (
                <span key={g} className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200 border border-amber-300 dark:border-amber-800 text-[11px] font-bold">
                  <span>{formatGradeWithPayScale(Number(g))}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setFilters((p) => ({
                        ...p,
                        selectedGrades: (p.selectedGrades || []).filter((x) => x !== g),
                      }))
                    }
                    className="hover:text-rose-600 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}

              {filters.academicDiscipline && filters.academicDiscipline !== 'All' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-200 border border-blue-300 dark:border-blue-800 text-[11px] font-bold">
                  <span>
                    {ACADEMIC_DISCIPLINES.find((d) => d.id === filters.academicDiscipline)?.[bn ? 'nameBn' : 'nameEn'] || filters.academicDiscipline}
                  </span>
                  <button type="button" onClick={() => setFilters((p) => ({ ...p, academicDiscipline: 'All', academicSubject: 'All' }))} className="hover:text-rose-600 cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {filters.academicSubject && filters.academicSubject !== 'All' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800 text-[11px] font-bold">
                  <span>
                    {getSubjectById(filters.academicSubject)?.[bn ? 'nameBn' : 'nameEn'] || filters.academicSubject}
                  </span>
                  <button type="button" onClick={() => setFilters((p) => ({ ...p, academicSubject: 'All' }))} className="hover:text-rose-600 cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {filters.category && filters.category !== 'All' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-800 dark:bg-purple-950/60 dark:text-purple-200 border border-purple-300 dark:border-purple-800 text-[11px] font-semibold">
                  <span>{filters.category}</span>
                  <button type="button" onClick={() => setFilters((p) => ({ ...p, category: 'All' }))} className="hover:text-rose-600 cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {filters.education && filters.education !== 'All' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-cyan-50 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-200 border border-cyan-300 dark:border-cyan-800 text-[11px] font-semibold">
                  <span>{filters.education}</span>
                  <button type="button" onClick={() => setFilters((p) => ({ ...p, education: 'All' }))} className="hover:text-rose-600 cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {filters.location && filters.location !== 'All' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-200 border border-indigo-300 dark:border-indigo-800 text-[11px] font-semibold">
                  <span>{filters.location}</span>
                  <button type="button" onClick={() => setFilters((p) => ({ ...p, location: 'All' }))} className="hover:text-rose-600 cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 flex-wrap pt-1">
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
                examSchedule={examScheduleByJobId.get(job.id)}
                latestResult={latestResultByJobId.get(job.id)}
                language={language}
                onViewDetails={(j) => setSelectedJob(j)}
                onApplyNow={handleApplyNow}
                onToggleBookmark={handleToggleBookmark}
                isOrganizationFollowed={followedOrgs.has(job.organization)}
                onToggleFollowOrg={handleToggleFollowOrg}
                isCompared={comparedJobIds.has(job.id)}
                onToggleCompare={handleToggleCompareJob}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <nav
              aria-label="Job circulars pagination"
              className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-xs"
            >
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-slate-500 dark:text-slate-400 font-semibold">
                  {bn
                    ? `পৃষ্ঠা ${safeCurrentPage} / ${totalPages} (মোট ${displayedJobs.length}টি)`
                    : `Page ${safeCurrentPage} of ${totalPages} (${displayedJobs.length} total)`}
                </span>

                {/* Items Per Page Selector */}
                <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                  <span className="text-[11px] font-medium">{bn ? 'প্রতি পৃষ্ঠায়:' : 'Per page:'}</span>
                  {[24, 48, 96].map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => {
                        setPageSize(size);
                        setCurrentPage(1);
                      }}
                      className={`px-2 py-0.5 rounded-md font-bold text-[11px] cursor-pointer transition-colors ${
                        pageSize === size
                          ? 'bg-petro-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={safeCurrentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-lg font-bold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                >
                  {bn ? 'পূর্ববর্তী' : 'Previous'}
                </button>

                {/* Direct Page Numbers */}
                {Array.from({ length: Math.min(5, totalPages) }, (_, idx) => {
                  let pNum = idx + 1;
                  if (totalPages > 5 && safeCurrentPage > 3) {
                    pNum = safeCurrentPage - 2 + idx;
                    if (pNum > totalPages) pNum = totalPages - (4 - idx);
                  }
                  return (
                    <button
                      key={pNum}
                      type="button"
                      onClick={() => setCurrentPage(pNum)}
                      className={`w-7 h-7 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                        safeCurrentPage === pNum
                          ? 'bg-petro-600 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      {pNum}
                    </button>
                  );
                })}

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

      {showSavePresetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Save className="w-4 h-4 text-petro-600" />
                <span>{bn ? 'ফিল্টার প্রিসেট সংরক্ষণ' : 'Save Filter Preset'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowSavePresetModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {bn
                ? 'বর্তমান সক্রিয় ফিল্টার সেটিংটি নাম দিয়ে সংরক্ষণ করুন, যাতে পরে এক ক্লিকে প্রয়োগ করতে পারেন।'
                : 'Save your current filter configuration to restore it anytime in one click.'}
            </p>
            <input
              type="text"
              value={presetNameInput}
              onChange={(e) => setPresetNameInput(e.target.value)}
              placeholder={bn ? 'প্রিসেটের নাম দিন (উদাঃ ৯ম গ্রেড সিএসই)' : 'Preset Name (e.g. 9th Grade CSE)'}
              className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowSavePresetModal(false)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                {bn ? 'বাতিল' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => handleSaveFilterPreset(presetNameInput || (bn ? 'আমার ফিল্টার' : 'My Preset'))}
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-petro-600 hover:bg-petro-700 text-white shadow-xs cursor-pointer"
              >
                {bn ? 'সংরক্ষণ করুন' : 'Save'}
              </button>
            </div>
          </div>
        </div>
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
