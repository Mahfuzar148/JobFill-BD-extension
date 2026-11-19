// JobFill BD - Job Circular Detail Modal / View
// Shows full circular metadata, verified deadline status, official links,
// and connects seamlessly with JobFill BD's existing Autofill Assistant on Apply Now.

import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Building2,
  ExternalLink,
  CheckCircle2,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Calendar,
  MapPin,
  GraduationCap,
  Banknote,
  FileText,
  Sparkles,
  Clock,
  Eye,
  Globe,
  Search,
  Lock,
  AlertTriangle,
  Calculator,
  Award,
  Briefcase,
  HelpCircle,
  Download,
  EyeOff,
} from 'lucide-react';
import { NormalizedJobCircular, ApplicationStatus } from '../types/job.types';
import { formatDhakaDate, parseDeadlineDate } from '../services/deadline-parser';
import { getCompleteLifecycleForCircular } from '../database/job-lifecycle-repository';
import {
  isNonGovernmentCategoryLetter,
  type JobLifecycleTimeline,
  type ExamSchedule,
  type JobResult,
  type AdmitCardNotice,
  type SeatPlanNotice,
} from '../types/job-system.types';
import { mapJobToCategoryLetter } from '../taxonomy/canonical-categories';
import {
  calculateAgeOnCutoffDate,
  evaluateProfileEligibility,
  formatIsoCalendarDate,
  parseFlexibleDateString,
} from '../services/eligibility-helper';
import { getActiveProfile } from '../../services/storage';
import type { UserProfile } from '../../types/profile';
import {
  getDetailedVerificationBadges,
  sanitizeCircularRefForDisplay,
  verifyJobUrl,
} from '../services/source-verifier';
import {
  assessCircularScamSignals,
  classifyOfficialSourceTier,
} from '../services/scam-awareness';
import { formatJobCategoryLabel } from '../services/source-health-state';
import {
  buildApplicationSearchUrl,
  classifyApplicationDestination,
  isCircularDocumentUrl,
} from '../services/application-link-detector';
import { openSafeExternalTab } from '../services/job-ui-actions';
import {
  resolveSafeCircularTarget,
  resolveSafeOrganizationTarget,
} from './MissingApplicationUrlModal';
import { DeadlineCountdown } from './DeadlineCountdown';
import { BookmarkButton } from './BookmarkButton';
import { JobVisitRepository } from '../database/job-visit-repository';

interface JobDetailsProps {
  job: NormalizedJobCircular;
  isBookmarked: boolean;
  applicationStatus?: ApplicationStatus;
  applicantDob?: string;
  language?: 'bn' | 'en';
  onBack: () => void;
  onApplyNow: (job: NormalizedJobCircular) => void;
  onToggleBookmark: (jobId: string) => void;
  onMarkApplied: (job: NormalizedJobCircular) => void;
  onUpdateDeadline?: (jobId: string, newDeadlineText: string) => Promise<void>;
  onShare: (job: NormalizedJobCircular) => void;
}

export const JobDetails: React.FC<JobDetailsProps> = ({
  job,
  isBookmarked,
  applicationStatus,
  applicantDob,
  language = 'en',
  onBack,
  onApplyNow,
  onToggleBookmark,
  onMarkApplied,
  onUpdateDeadline,
  onShare,
}) => {
  const bn = language === 'bn';
  const catLetter = (job as any).categoryLetter || mapJobToCategoryLetter(job);
  const orgOrTitleLower = `${job.organization || ''} ${job.jobTitle || ''} ${job.position || ''}`.toLowerCase();
  const isPrivateEntityText =
    orgOrTitleLower.includes('private') ||
    orgOrTitleLower.includes('বেসরকারি') ||
    orgOrTitleLower.includes('think tank');

  const isNonGovt =
    isNonGovernmentCategoryLetter(catLetter) ||
    catLetter === 'D' ||
    catLetter === 'E' ||
    catLetter === 'O' ||
    catLetter === 'P' ||
    catLetter === 'Q' ||
    ((catLetter === 'N' || catLetter === 'R') &&
      ((job as any).sector !== 'Government' &&
        (job as any).sector !== 'Autonomous' &&
        (job as any).sector !== 'Semi-Government' &&
        job.category !== 'Government' ||
        isPrivateEntityText ||
        (job as any).isGovernmentJob === false)) ||
    (job as any).isGovernmentJob === false ||
    (job as any).sector === 'Private' ||
    (job as any).sector === 'NGO' ||
    (job as any).sector === 'International' ||
    job.category === 'Private' ||
    job.category === 'NGO' ||
    job.category === 'International Jobs' ||
    job.gradeVerificationStatus === 'NOT_APPLICABLE' ||
    (job as any).grade?.gradeVerificationStatus === 'NOT_APPLICABLE';

  const verificationBadges = getDetailedVerificationBadges(job);
  const cleanMemo = sanitizeCircularRefForDisplay(job.circularNumber);
  const appCls = classifyApplicationDestination(job.applicationUrl);
  const hasDirectApply = appCls.isApplicationUrl;
  const urlCheck = verifyJobUrl(job.applicationUrl);
  const circularCheck = job.circularUrl ? verifyJobUrl(job.circularUrl) : { isSafeToOpen: false, normalizedUrl: '', warnings: [] };
  const sourceCheck = job.sourceUrl ? verifyJobUrl(job.sourceUrl) : { isSafeToOpen: false, normalizedUrl: '', warnings: [] };
  const circularTarget = resolveSafeCircularTarget(job);
  const organizationTarget = resolveSafeOrganizationTarget(job);
  const searchTarget = buildApplicationSearchUrl(job);
  const isPdfCircular = Boolean(
    job.circularUrl && isCircularDocumentUrl(job.circularUrl) && circularCheck.isSafeToOpen
  );
  const [deadlineInput, setDeadlineInput] = useState(job.deadlineText || '');
  const [updatingDeadline, setUpdatingDeadline] = useState(false);
  const [deadlineError, setDeadlineError] = useState('');
  const [showPdfPreview, setShowPdfPreview] = useState(false);

  const initialParsedCutoff =
    parseFlexibleDateString(job.deadlineAt) ||
    parseFlexibleDateString(job.deadlineText) ||
    parseFlexibleDateString(Date.now());
  const [dobInput, setDobInput] = useState(() => {
    const parsed = parseFlexibleDateString(applicantDob);
    return parsed ? formatIsoCalendarDate(parsed) : '';
  });
  const [cutoffInput, setCutoffInput] = useState(() =>
    initialParsedCutoff ? formatIsoCalendarDate(initialParsedCutoff) : new Date().toISOString().slice(0, 10)
  );
  const [loadedProfile, setLoadedProfile] = useState<UserProfile | null>(null);
  const [timeline, setTimeline] = useState<JobLifecycleTimeline | null>(null);
  const [timelineLoading, setTimelineLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setTimelineLoading(true);
    getCompleteLifecycleForCircular(job.id, job.position || job.jobTitle, job.organization)
      .then((data) => {
        if (mounted) {
          setTimeline(data);
          setTimelineLoading(false);
        }
      })
      .catch((err) => {
        console.warn('JobFill BD [JobDetails]: failed to load lifecycle timeline', err);
        if (mounted) setTimelineLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [job.id, job.position, job.jobTitle, job.organization]);

  useEffect(() => {
    let mounted = true;
    getActiveProfile()
      .then((profile) => {
        if (!mounted || !profile) return;
        setLoadedProfile(profile);
        if (!applicantDob) {
          const parsed = parseFlexibleDateString(profile.personal?.dob);
          if (parsed) setDobInput(formatIsoCalendarDate(parsed));
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [applicantDob]);

  useEffect(() => {
    if (!job?.id) return;
    JobVisitRepository.recordVisit({
      jobId: job.id,
      sourceId: job.sourceId || 'job_hub',
      organization: job.organization,
      jobTitle: job.jobTitle,
      circularUrl: job.circularUrl || job.applicationUrl || '',
      deadlineAt: job.deadlineAt,
      verificationStatus: job.sourceVerification === 'official_verified' ? 'verified' : 'internal',
    }).catch((err) => console.warn('JobFill BD: Could not record job visit:', err));
  }, [job?.id]);

  const ageCheck = calculateAgeOnCutoffDate(dobInput, cutoffInput);
  const fullEligibility = loadedProfile ? evaluateProfileEligibility(loadedProfile, job) : null;

  const handleSaveManualDeadline = async () => {
    if (!onUpdateDeadline) return;
    const parsed = parseDeadlineDate(deadlineInput);
    if (!parsed.isVerified) {
      setDeadlineError(bn ? 'সঠিক তারিখ লিখুন (যেমন: 2026-11-25 বা 25/11/2026)' : 'Enter a valid date (e.g. 2026-11-25 or 25/11/2026)');
      return;
    }
    setDeadlineError('');
    setUpdatingDeadline(true);
    try {
      await onUpdateDeadline(job.id, deadlineInput);
    } finally {
      setUpdatingDeadline(false);
    }
  };

  const now = Date.now();
  const stages = [
    {
      id: 'circular_published',
      labelEn: 'Circular Published',
      labelBn: 'বিজ্ঞপ্তি প্রকাশ',
      status: 'COMPLETED' as const,
      date: job.publishedDateText || (job.publishedAt ? formatDhakaDate(job.publishedAt) : null),
      details: job.circularNumber || job.sourceName,
    },
    {
      id: 'app_started',
      labelEn: 'Application Started',
      labelBn: 'আবেদন শুরু',
      status: job.applicationStartAt && now < job.applicationStartAt ? ('UPCOMING' as const) : ('COMPLETED' as const),
      date: job.applicationStartText || (job.applicationStartAt ? formatDhakaDate(job.applicationStartAt) : null),
      details: job.applicationUrl ? 'Online Portal' : undefined,
    },
    {
      id: 'app_deadline',
      labelEn: 'Application Deadline',
      labelBn: 'আবেদনের শেষ তারিখ',
      status: job.deadlineAt && now > job.deadlineAt ? ('COMPLETED' as const) : ('ACTIVE' as const),
      date: job.deadlineText || (job.deadlineAt ? formatDhakaDate(job.deadlineAt) : null),
      details: job.deadlineTimezone || 'Asia/Dhaka',
    },
    {
      id: 'admit_card',
      labelEn: 'Admit Card Published',
      labelBn: 'প্রবেশপত্র প্রকাশ',
      status: timeline?.admitCardNotices?.some((a) => a.status === 'Available')
        ? ('ACTIVE' as const)
        : timeline?.admitCardNotices?.some((a) => a.status === 'Downloaded' || a.status === 'Expired')
          ? ('COMPLETED' as const)
          : ('PENDING' as const),
      date: timeline?.admitCardNotices?.[0]?.downloadStartDate || null,
      details: timeline?.admitCardNotices?.[0]?.jobTitle || undefined,
    },
    {
      id: 'seat_plan',
      labelEn: 'Seat Plan Published',
      labelBn: 'আসন বিন্যাস প্রকাশ',
      status: timeline?.seatPlanNotices?.some((s) => s.status === 'Announced')
        ? ('ACTIVE' as const)
        : ('PENDING' as const),
      date: timeline?.seatPlanNotices?.[0]?.examDate || null,
      details: timeline?.seatPlanNotices?.[0]?.venue || undefined,
    },
    {
      id: 'exam_announced',
      labelEn: 'Exam Date Announced',
      labelBn: 'পরীক্ষার তারিখ ঘোষণা',
      status: timeline?.examSchedules?.some((e) => e.status === 'Completed')
        ? ('COMPLETED' as const)
        : timeline?.examSchedules?.some((e) => e.status === 'Announced' || e.status === 'Rescheduled')
          ? ('UPCOMING' as const)
          : ('PENDING' as const),
      date: timeline?.examSchedules?.[0]?.examDate
        ? (typeof timeline.examSchedules[0].examDate === 'number'
            ? formatDhakaDate(timeline.examSchedules[0].examDate)
            : formatDhakaDate(new Date(timeline.examSchedules[0].examDate).getTime(), timeline.examSchedules[0].examDate))
        : null,
      details: timeline?.examSchedules?.[0]?.stage ? `${timeline.examSchedules[0].stage} Exam` : undefined,
    },
    {
      id: 'exam_completed',
      labelEn: 'Examination Completed',
      labelBn: 'পরীক্ষা সম্পন্ন',
      status: timeline?.examSchedules?.some((e) => e.status === 'Completed') || (timeline?.results && timeline.results.length > 0)
        ? ('COMPLETED' as const)
        : ('PENDING' as const),
      date: null,
      details: undefined,
    },
    {
      id: 'preli_result',
      labelEn: 'Preliminary Result',
      labelBn: 'প্রিলিমিনারি ফলাফল',
      status: timeline?.results?.some(
        (r) =>
          r.stage === 'Preliminary' &&
          (r.publicationStatus === 'Result Published' || r.publicationStatus === 'Revised Result Published')
      )
        ? ('COMPLETED' as const)
        : ('PENDING' as const),
      date: timeline?.results?.find((r) => r.stage === 'Preliminary')?.publishedDate || null,
      details: timeline?.results?.find((r) => r.stage === 'Preliminary')?.selectedCandidateCount
        ? `${timeline.results.find((r) => r.stage === 'Preliminary')?.selectedCandidateCount} selected`
        : undefined,
    },
    {
      id: 'written_result',
      labelEn: 'Written Result',
      labelBn: 'লিখিত পরীক্ষার ফলাফল',
      status: timeline?.results?.some(
        (r) =>
          r.stage === 'Written' &&
          (r.publicationStatus === 'Result Published' || r.publicationStatus === 'Revised Result Published')
      )
        ? ('COMPLETED' as const)
        : ('PENDING' as const),
      date: timeline?.results?.find((r) => r.stage === 'Written')?.publishedDate || null,
      details: timeline?.results?.find((r) => r.stage === 'Written')?.selectedCandidateCount
        ? `${timeline.results.find((r) => r.stage === 'Written')?.selectedCandidateCount} selected`
        : undefined,
    },
    {
      id: 'viva_result',
      labelEn: 'Viva Result',
      labelBn: 'মৌখিক পরীক্ষার ফলাফল',
      status: timeline?.results?.some(
        (r) =>
          r.stage === 'Viva' &&
          (r.publicationStatus === 'Result Published' || r.publicationStatus === 'Revised Result Published')
      )
        ? ('COMPLETED' as const)
        : ('PENDING' as const),
      date: timeline?.results?.find((r) => r.stage === 'Viva')?.publishedDate || null,
      details: undefined,
    },
    {
      id: 'final_selection',
      labelEn: 'Final Selection / Merit List',
      labelBn: 'চূড়ান্ত সুপারিশ / মেধা তালিকা',
      status: timeline?.results?.some(
        (r) =>
          (r.stage === 'Final' || r.stage === 'Merit List') &&
          (r.publicationStatus === 'Result Published' || r.publicationStatus === 'Revised Result Published')
      )
        ? ('COMPLETED' as const)
        : ('PENDING' as const),
      date: timeline?.results?.find((r) => r.stage === 'Final' || r.stage === 'Merit List')?.publishedDate || null,
      details: timeline?.results?.find((r) => r.stage === 'Final' || r.stage === 'Merit List')?.selectedCandidateCount
        ? `${timeline.results.find((r) => r.stage === 'Final' || r.stage === 'Merit List')?.selectedCandidateCount} recommended`
        : undefined,
    },
  ];

  return (
    <div className="space-y-5">
      {/* Top Back Bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-petro-700 dark:hover:text-petro-400 bg-white dark:bg-slate-900 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{bn ? 'সব সার্কুলারে ফিরুন' : 'Back to Job Circulars'}</span>
        </button>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => onShare(job)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>{bn ? 'শেয়ার' : 'Share'}</span>
          </button>

          <BookmarkButton
            isBookmarked={isBookmarked}
            onToggle={() => onToggleBookmark(job.id)}
            language={language}
          />

          <button
            type="button"
            onClick={() => onMarkApplied(job)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
              applicationStatus === 'Applied'
                ? 'bg-emerald-600 text-white border-emerald-700'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>
              {applicationStatus === 'Applied'
                ? bn ? 'আবেদন সম্পন্ন' : 'Marked as Applied'
                : bn ? 'আবেদন সম্পন্ন চিহ্নিত করুন' : 'Mark as Applied'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onApplyNow(job)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 cursor-pointer"
          >
            <span>{bn ? 'সরাসরি আবেদন করুন' : 'Apply Now'}</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              {verificationBadges.map((b) => (
                <span
                  key={b.key}
                  className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${b.colorClass}`}
                >
                  <ShieldCheck className="w-3 h-3" />
                  {bn ? b.labelBn : b.labelEn}
                </span>
              ))}
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                {formatJobCategoryLabel(job.category, bn)}
              </span>
              <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-slate-50 text-slate-600 border border-slate-200 dark:bg-slate-800/70 dark:text-slate-300 dark:border-slate-700">
                {job.sourceName}
              </span>
              {isNonGovt ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                  <Briefcase className="w-3 h-3 text-slate-500" />
                  <span>{bn ? 'বেসরকারি বেতন ভিত্তিক' : 'Private Salary-Based'}</span>
                </span>
              ) : job.gradeNumber ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700">
                  <Award className="w-3 h-3 text-amber-600" />
                  {job.gradeLabel || `Grade ${job.gradeNumber}`}
                </span>
              ) : job.category === 'Government' ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
                  <Award className="w-3 h-3 text-slate-400" />
                  {bn ? 'গ্রেড উল্লেখ নেই' : 'Grade Not Specified'}
                </span>
              ) : null}
              {cleanMemo && (
                <span className="text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded">
                  {cleanMemo}
                </span>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white leading-snug break-words">
              {job.position || job.jobTitle}
            </h1>
            {job.titleBn && job.titleBn !== (job.position || job.jobTitle) && (
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200 leading-snug break-words">{job.titleBn}</p>
            )}
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
              <Building2 className="w-4 h-4 shrink-0" />
              <span className="break-words">{job.organization}</span>
              {job.organizationBn && job.organizationBn !== job.organization && (
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">({job.organizationBn})</span>
              )}
            </div>
            {job.jobTitle !== job.position && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {job.jobTitle}
              </p>
            )}
          </div>

          <div className="flex flex-col items-start md:items-end gap-2 shrink-0">
            <DeadlineCountdown
              deadlineAt={job.deadlineAt}
              deadlineVerified={job.deadlineVerified}
              language={language}
            />
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {bn ? 'টাইমজোন: Asia/Dhaka' : 'Timezone: Asia/Dhaka (BST)'}
            </span>
          </div>
        </div>

        {/* Possible Duplicate Advisory (Medium Confidence Match — Preserved Separately) */}
        {job.possibleDuplicateOfId && (
          <div className="bg-sky-50/80 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 rounded-xl px-4 py-2.5 flex items-center gap-2 text-xs text-sky-900 dark:text-sky-200">
            <AlertTriangle className="w-4 h-4 text-sky-600 shrink-0" />
            <span>
              {bn
                ? `সম্ভাব্য অনুরূপ বিজ্ঞপ্তি শনাক্ত হয়েছে (~${job.duplicateConfidence ?? 70}% মিল); কোনো তথ্য না হারিয়ে উভয় রেকর্ড আলাদা রাখা হয়েছে।`
                : `Potential duplicate circular detected (~${job.duplicateConfidence ?? 70}% confidence); both records were safely kept separate to avoid data loss.`}
            </span>
          </div>
        )}

        {/* URL Security Warning if any */}
        {hasDirectApply && urlCheck.warnings.length > 0 && (
          <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl p-3.5 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold">{bn ? 'URL নিরাপত্তা সতর্কতা:' : 'URL Security Notice:'}</div>
              <ul className="list-disc list-inside mt-0.5">
                {urlCheck.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Missing Direct Application URL Honest Notice */}
        {!hasDirectApply && (
          <div className="bg-amber-50/90 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4 space-y-2.5 text-xs">
            <div className="flex items-start gap-2.5 text-amber-900 dark:text-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">সরাসরি অনলাইন আবেদন লিংক পাওয়া যায়নি।</div>
                <p className="text-[11.5px] opacity-90 mt-0.5">
                  {bn
                    ? 'এই বিজ্ঞপ্তিতে সরাসরি অনলাইন আবেদন ফর্মের লিংক নেই। বিজ্ঞপ্তির PDF স্বয়ংক্রিয়ভাবে আবেদন লিংক হিসেবে খোলা হবে না।'
                    : 'Direct online application link is unavailable for this circular. PDF circulars are never opened as fake application forms.'}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-0.5">
              {circularTarget && (
                <button
                  type="button"
                  onClick={() => openSafeExternalTab(circularTarget)}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:bg-slate-50 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{bn ? 'অফিশিয়াল বিজ্ঞপ্তি দেখুন' : 'অফিশিয়াল বিজ্ঞপ্তি দেখুন (Official Circular)'}</span>
                </button>
              )}
              {organizationTarget && (
                <button
                  type="button"
                  onClick={() => openSafeExternalTab(organizationTarget)}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:bg-slate-50 cursor-pointer"
                >
                  <Globe className="w-3.5 h-3.5 text-sky-600" />
                  <span>{bn ? 'প্রতিষ্ঠানের ওয়েবসাইট দেখুন' : 'প্রতিষ্ঠানের ওয়েবসাইট দেখুন (Org Website)'}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => openSafeExternalTab(searchTarget)}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white cursor-pointer"
              >
                <Search className="w-3.5 h-3.5" />
                <span>{bn ? 'আবেদন লিংক খুঁজুন' : 'আবেদন লিংক খুঁজুন (Find Application Link)'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Login Required Portal Hint */}
        {hasDirectApply && appCls.isLoginRequired && (
          <div className="bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-xl px-4 py-2.5 flex items-center gap-2 text-xs text-indigo-900 dark:text-indigo-200">
            <Lock className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>
              {bn
                ? 'লগইন পোর্টাল: আবেদন ফর্ম পেতে অফিশিয়াল পোর্টালে লগইন করতে হবে; পেজ খুললে JobFill BD অটো-ফিল প্রস্তুত থাকবে।'
                : 'Applicant Login Portal: Signing in opens the application form; JobFill BD Autofill stays ready without auto-submitting.'}
            </span>
          </div>
        )}

        {/* Autofill Integration Callout */}
        <div className="bg-petro-50 dark:bg-petro-950/30 border border-petro-200 dark:border-petro-800 rounded-xl p-4 flex items-start gap-3 text-xs text-petro-900 dark:text-petro-200">
          <Sparkles className="w-5 h-5 text-petro-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold">
              {bn ? 'JobFill BD অটো-ফিল ইন্টিগ্রেশন প্রস্তুত' : 'Integrated with JobFill BD Smart Autofill'}
            </div>
            <p className="text-petro-800/90 dark:text-petro-300/90 mt-0.5 leading-relaxed">
              {bn
                ? '"Apply Now" ক্লিক করলে অফিশিয়াল আবেদন পেজ খুলবে। JobFill BD স্বয়ংক্রিয়ভাবে ফর্ম স্ক্যান করবে এবং "Auto Fill Now" দিয়ে আপনার সেভ করা প্রোফাইল ও ছবি/স্বাক্ষর দিয়ে ফর্ম পূরণ করতে পারবেন। কোনো অবস্থাতেই স্বয়ংক্রিয় সাবমিট করা হবে না।'
                : 'Clicking "Apply Now" opens the official application page while keeping the original URL. JobFill BD’s existing form detector scans the page so you can click "Auto Fill Now" using your saved profile and documents. Applications are never auto-submitted.'}
            </p>
          </div>
        </div>

        {/* Key Metadata Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
            <div className="text-slate-400 font-semibold mb-0.5 flex items-center gap-1"><GraduationCap className="w-3.5 h-3.5" /> {bn ? 'শিক্ষাগত যোগ্যতা' : 'Educational Qualification'}</div>
            <div className="font-bold text-slate-800 dark:text-slate-100">
              {job.qualification || 'Any Qualification'}
              {job.minGpa ? ` (Min GPA: ${job.minGpa})` : job.minCgpa ? ` (Min CGPA: ${job.minCgpa})` : ''}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
            <div className="text-slate-400 font-semibold mb-0.5 flex items-center gap-1">
              <Award className="w-3.5 h-3.5 text-amber-600" />
              {bn ? 'সরকারি বেতন গ্রেড' : 'Govt Pay Grade'}
            </div>
            <div className="font-bold text-slate-800 dark:text-slate-100">
              {isNonGovt ? (
                <span className="text-slate-500 font-medium">
                  {bn ? 'প্রযোজ্য নয় (বেসরকারি)' : 'Not Applicable (Private)'}
                </span>
              ) : job.gradeNumber ? (
                <span className="text-amber-700 dark:text-amber-400">
                  {job.gradeLabel || `Grade ${job.gradeNumber}`}
                </span>
              ) : (
                <span className="text-slate-500 font-medium">
                  {bn ? 'গ্রেড উল্লেখ নেই' : 'Grade Not Specified'}
                </span>
              )}
            </div>
            {!isNonGovt && job.gradeOriginalText && (
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                {bn ? 'চিহ্নিত: ' : 'From: '}
                <span className="font-semibold text-slate-700 dark:text-slate-300">"{job.gradeOriginalText}"</span>
              </div>
            )}
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
            <div className="text-slate-400 font-semibold mb-0.5 flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {bn ? 'কর্মস্থল / স্থান' : 'Location'}</div>
            <div className="font-bold text-slate-800 dark:text-slate-100">{job.location}</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
            <div className="text-slate-400 font-semibold mb-0.5 flex items-center gap-1"><Banknote className="w-3.5 h-3.5" /> {bn ? 'বেতন ও পদসংখ্যা' : 'Salary & Vacancies'}</div>
            <div className="font-bold text-slate-800 dark:text-slate-100">
              {job.salary || (bn ? 'অফিশিয়াল বিজ্ঞপ্তি দেখুন' : 'Per Official Circular')}
              {job.vacancies ? ` • ${job.vacancies} Posts` : ''}
            </div>
            {(job.salaryMin || job.salaryMax) && (
              <div className="text-[10.5px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
                {job.salaryMin ? `৳${job.salaryMin.toLocaleString()}` : ''}
                {job.salaryMin && job.salaryMax ? ' - ' : ''}
                {job.salaryMax ? `৳${job.salaryMax.toLocaleString()}` : ''}
              </div>
            )}
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
            <div className="text-slate-400 font-semibold mb-0.5 flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {bn ? 'প্রকাশ ও আবেদন শুরু' : 'Published & Start Date'}</div>
            <div className="font-bold text-slate-800 dark:text-slate-100">
              {job.publishedAt ? formatDhakaDate(job.publishedAt) : job.publishedDateText || (bn ? 'উল্লেখ নেই' : 'Not specified')}
              {job.applicationStartAt
                ? ` • ${bn ? 'শুরু:' : 'Start:'} ${formatDhakaDate(job.applicationStartAt)}`
                : job.applicationStartText
                  ? ` • ${bn ? 'শুরু:' : 'Start:'} ${job.applicationStartText}`
                  : ''}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
            <div className="text-slate-400 font-semibold mb-0.5 flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {bn ? 'আবেদনের শেষ সময়' : 'Application Deadline'}</div>
            <div className={`font-bold ${job.deadlineVerified ? 'text-slate-800 dark:text-slate-100' : 'text-amber-600 dark:text-amber-400'}`}>
              {job.deadlineVerified
                ? `${formatDhakaDate(job.deadlineAt)} (${job.deadlineText || 'Asia/Dhaka'})`
                : bn ? 'শেষ তারিখ যাচাইকৃত নয়' : 'Deadline Not Verified'}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 sm:col-span-2">
            <div className="text-slate-400 font-semibold mb-0.5">{bn ? 'অভিজ্ঞতা / বয়স / ফি' : 'Experience / Age / Fee'}</div>
            <div className="font-bold text-slate-800 dark:text-slate-100">
              {[job.experience, job.ageRequirement, job.applicationFee].filter(Boolean).join(' • ') || (bn ? 'বিজ্ঞপ্তিতে উল্লিখিত' : 'See official circular')}
            </div>
          </div>
        </div>

        {/* Universal Job Taxonomy, Industry, Employer Type & Work Mode */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
            <div className="text-slate-400 font-semibold mb-0.5 flex items-center gap-1">
              <Briefcase className="w-3.5 h-3.5 text-petro-600" />
              <span>{bn ? 'সার্বজনীন পেশাগত ক্যাটাগরি' : 'Universal Job Taxonomy'}</span>
            </div>
            <div className="font-bold text-slate-800 dark:text-slate-100">
              {bn ? job.taxonomyCategoryNameBn || job.taxonomyCategoryNameEn || job.category : job.taxonomyCategoryNameEn || job.category}
              {job.taxonomySubcategoryNameEn && (
                <span className="text-slate-500 font-normal">
                  {' › '}{bn ? job.taxonomySubcategoryNameBn || job.taxonomySubcategoryNameEn : job.taxonomySubcategoryNameEn}
                </span>
              )}
            </div>
            {job.isUnclassified ? (
              <span className="text-[10px] text-amber-600 font-medium">({bn ? 'অনির্দিষ্ট / যাচাই প্রয়োজন' : 'Unclassified'})</span>
            ) : job.classificationConfidence ? (
              <span className="text-[10px] text-slate-400">({bn ? 'নিশ্চয়তা' : 'Confidence'}: {job.classificationConfidence}%)</span>
            ) : null}
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
            <div className="text-slate-400 font-semibold mb-0.5 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-indigo-600" />
              <span>{bn ? 'নিয়োগকর্তার ধরন ও শিল্প' : 'Employer Type & Industry'}</span>
            </div>
            <div className="font-bold text-slate-800 dark:text-slate-100">
              {job.employerType || (bn ? 'উল্লিখিত নেই' : 'Not specified')}
              {job.industry && job.industry !== 'General' && (
                <span className="text-slate-500 font-normal"> • {job.industry}</span>
              )}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
            <div className="text-slate-400 font-semibold mb-0.5 flex items-center gap-1">
              <Globe className="w-3.5 h-3.5 text-cyan-600" />
              <span>{bn ? 'কাজের মোড ও অভিজ্ঞতা' : 'Work Mode & Experience'}</span>
            </div>
            <div className="font-bold text-slate-800 dark:text-slate-100">
              {job.workMode || 'On-Site'} • {job.employmentType || 'Full Time'}
              {job.experienceLevel && job.experienceLevel !== 'Not Specified' && (
                <span className="text-slate-500 font-normal"> ({job.experienceLevel})</span>
              )}
            </div>
          </div>
        </div>

        {/* 11-Stage Interactive Lifecycle Timeline Visualizer (Milestone M2) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4.5 space-y-3.5 shadow-xs">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-petro-600 shrink-0" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                {bn ? '১১-ধাপ চাকরির পূর্ণাঙ্গ লাইফসাইকেল টাইমলাইন' : '11-Stage Complete Circular Lifecycle Timeline'}
              </h3>
            </div>
            <span className="text-[10.5px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {bn ? 'অফিশিয়াল নোটিশ ট্র্যাকিং' : 'Official Notice Tracking'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 pt-1">
            {stages.map((stage, idx) => {
              const isCompleted = stage.status === 'COMPLETED';
              const isActive = stage.status === 'ACTIVE';
              const isUpcoming = stage.status === 'UPCOMING';

              return (
                <div
                  key={stage.id}
                  className={`p-3 rounded-xl border text-xs transition-all ${
                    isCompleted
                      ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                      : isActive
                        ? 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-300 dark:border-blue-700 text-blue-900 dark:text-blue-100 ring-1 ring-blue-400'
                        : isUpcoming
                          ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                          : 'bg-slate-50/80 dark:bg-slate-850 border-slate-200/80 dark:border-slate-800 text-slate-500 dark:text-slate-400 opacity-80'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded-md bg-white/70 dark:bg-slate-800/80">
                      #{idx + 1}
                    </span>
                    <span
                      className={`text-[9.5px] font-bold uppercase px-1.5 py-0.5 rounded-full ${
                        isCompleted
                          ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300'
                          : isActive
                            ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300 animate-pulse'
                            : isUpcoming
                              ? 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300'
                              : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                      }`}
                    >
                      {isCompleted ? (bn ? 'সম্পন্ন' : 'Completed') : isActive ? (bn ? 'চলমান' : 'Active') : isUpcoming ? (bn ? 'আসন্ন' : 'Announced') : (bn ? 'অপেক্ষমাণ' : 'Pending')}
                    </span>
                  </div>
                  <div className="font-bold text-slate-800 dark:text-slate-100 leading-snug">
                    {bn ? stage.labelBn : stage.labelEn}
                  </div>
                  {stage.date && (
                    <div className="text-[10.5px] mt-1 font-medium opacity-90">
                      📅 {stage.date}
                    </div>
                  )}
                  {stage.details && (
                    <div className="text-[10px] mt-0.5 text-slate-500 dark:text-slate-400 truncate">
                      {stage.details}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Dedicated Exam Schedule & Details Section */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4.5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                {bn ? 'পরীক্ষার সময়সূচি ও কেন্দ্র বিবরণ' : 'Exam Schedule & Venue Details'}
              </h3>
            </div>
            {timeline?.examSchedules && timeline.examSchedules.length > 0 && (
              <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800">
                {timeline.examSchedules.length} {bn ? 'টি পরীক্ষা ঘোষিত' : 'Exams Scheduled'}
              </span>
            )}
          </div>

          {timeline?.examSchedules && timeline.examSchedules.length > 0 ? (
            <div className="space-y-2.5">
              {timeline.examSchedules.map((schedule) => (
                <div
                  key={schedule.id}
                  className="p-3.5 rounded-xl border border-blue-100 dark:border-blue-900/60 bg-blue-50/30 dark:bg-blue-950/20 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="font-bold text-sm text-slate-900 dark:text-white">
                      {schedule.jobTitle || `${schedule.stage} Exam`}
                    </span>
                    <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300">
                      {schedule.stage}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-slate-700 dark:text-slate-300 pt-1">
                    <div>
                      <span className="text-slate-400 font-semibold">{bn ? 'তারিখ ও সময়:' : 'Date & Time:'}</span>{' '}
                      <span className="font-bold text-slate-800 dark:text-slate-100">
                        {schedule.examDate
                          ? (typeof schedule.examDate === 'number'
                              ? formatDhakaDate(schedule.examDate)
                              : formatDhakaDate(new Date(schedule.examDate).getTime(), schedule.examDate))
                          : (bn ? 'তারিখ নির্ধারিত হয়নি' : 'Exam Date Not Announced')}{' '}
                        {schedule.examTime ? `(${schedule.examTime})` : ''}
                      </span>
                    </div>
                    {schedule.center && (
                      <div>
                        <span className="text-slate-400 font-semibold">{bn ? 'কেন্দ্র:' : 'Center:'}</span>{' '}
                        <span>{schedule.center}</span>
                      </div>
                    )}
                    {schedule.venue && (
                      <div>
                        <span className="text-slate-400 font-semibold">{bn ? 'স্থান/ভেন্যু:' : 'Venue:'}</span>{' '}
                        <span>{schedule.venue}</span>
                      </div>
                    )}
                  </div>

                  {schedule.instructions && (
                    <div className="text-[11px] text-slate-600 dark:text-slate-400 bg-white/70 dark:bg-slate-850 p-2 rounded-lg">
                      <strong>{bn ? 'নির্দেশনা:' : 'Instructions:'}</strong> {schedule.instructions}
                    </div>
                  )}

                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    {schedule.seatPlanUrl && (
                      <button
                        type="button"
                        onClick={() => openSafeExternalTab(schedule.seatPlanUrl!)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5 text-blue-600" />
                        <span>{bn ? 'আসন বিন্যাস দেখুন' : 'View Seat Plan'}</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}

                    {schedule.admitCardUrl && (
                      <button
                        type="button"
                        onClick={() => openSafeExternalTab(schedule.admitCardUrl!)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>{bn ? 'প্রবেশপত্র ডাউনলোড' : 'Download Admit Card'}</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-3.5 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400 shrink-0" />
              <div>
                <span className="font-bold text-slate-700 dark:text-slate-200">
                  {bn ? 'তারিখ নির্ধারিত হয়নি' : 'Exam Date Not Announced'}
                </span>
                <p className="text-[11px] mt-0.5">
                  {bn
                    ? 'কর্তৃপক্ষ কর্তৃক এখনও কোনো অফিসিয়াল পরীক্ষার তারিখ ঘোষণা করা হয়নি। তারিখ ঘোষিত হলে স্বয়ংক্রিয়ভাবে আপডেট হবে।'
                    : 'The recruiting authority has not officially announced exam dates yet. Dates will appear automatically upon official notice.'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Dedicated Results Section */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4.5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-emerald-600 shrink-0" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                {bn ? 'পরীক্ষার ফলাফল ও মেধা তালিকা' : 'Job Results & Merit Lists'}
              </h3>
            </div>
            {timeline?.results && timeline.results.length > 0 && (
              <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
                {timeline.results.length} {bn ? 'টি ফলাফল প্রকাশিত' : 'Results Published'}
              </span>
            )}
          </div>

          {timeline?.results && timeline.results.length > 0 ? (
            <div className="space-y-2.5">
              {timeline.results.map((result) => (
                <div
                  key={result.id}
                  className="p-3.5 rounded-xl border border-emerald-100 dark:border-emerald-900/60 bg-emerald-50/30 dark:bg-emerald-950/20 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="font-bold text-sm text-slate-900 dark:text-white">
                      {result.jobTitle || `${result.stage} Result`}
                    </span>
                    <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
                      {result.stage}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-slate-700 dark:text-slate-300 pt-1">
                    <div>
                      <span className="text-slate-400 font-semibold">{bn ? 'প্রকাশের তারিখ:' : 'Published Date:'}</span>{' '}
                      <span className="font-bold text-slate-800 dark:text-slate-100">
                        {result.publishedDate
                          ? (typeof result.publishedDate === 'number'
                              ? formatDhakaDate(result.publishedDate)
                              : formatDhakaDate(new Date(result.publishedDate).getTime(), result.publishedDate))
                          : (bn ? 'সম্প্রতি প্রকাশিত' : 'Recently Published')}
                      </span>
                    </div>
                    {(result.selectedCandidateCount ?? (result as any).selectedCandidatesCount) !== undefined && (result.selectedCandidateCount ?? (result as any).selectedCandidatesCount) !== null && (
                      <div>
                        <span className="text-slate-400 font-semibold">{bn ? 'উত্তীর্ণ প্রার্থী সংখ্যা:' : 'Selected Candidates:'}</span>{' '}
                        <span className="font-bold text-emerald-700 dark:text-emerald-400">
                          {(result.selectedCandidateCount ?? (result as any).selectedCandidatesCount).toLocaleString()} {bn ? 'জন' : 'Candidates'}
                        </span>
                      </div>
                    )}
                    <div>
                      <span className="text-slate-400 font-semibold">{bn ? 'স্ট্যাটাস:' : 'Status:'}</span>{' '}
                      <span className="font-semibold">{result.publicationStatus}</span>
                    </div>
                  </div>

                  {result.summary && (
                    <div className="text-[11px] text-slate-600 dark:text-slate-400 bg-white/70 dark:bg-slate-850 p-2 rounded-lg">
                      {result.summary}
                    </div>
                  )}

                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    {result.pdfUrl && (
                      <button
                        type="button"
                        onClick={() => openSafeExternalTab(result.pdfUrl!)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>{bn ? 'ফলাফল নোটিশ (PDF)' : 'Official Result Notice (PDF)'}</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                    {result.noticeUrl && result.noticeUrl !== result.pdfUrl && (
                      <button
                        type="button"
                        onClick={() => openSafeExternalTab(result.noticeUrl!)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                        <span>{bn ? 'অফিশিয়াল পোর্টাল নোটিশ' : 'Portal Notice'}</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-3.5 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <EyeOff className="w-4 h-4 text-slate-400 shrink-0" />
              <div>
                <span className="font-bold text-slate-700 dark:text-slate-200">
                  {bn ? 'ফলাফল এখনও প্রকাশিত হয়নি' : 'Result Not Published'}
                </span>
                <p className="text-[11px] mt-0.5">
                  {bn
                    ? 'এই বিজ্ঞপ্তির জন্য এখনও কোনো ফলাফল বা মেধা তালিকা প্রকাশিত হয়নি।'
                    : 'No results or merit lists have been published yet for this circular.'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Local Offline Age-on-Circular-Cutoff Calculator */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3 text-xs">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              <Calculator className="w-4 h-4 text-petro-600" />
              <span>
                {bn
                  ? 'বয়স ও যোগ্যতা ক্যালকুলেটর (১০০% অফলাইন)'
                  : 'Circular Age & Eligibility Calculator (100% Local)'}
              </span>
            </div>
            {ageCheck.isValid && (
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                  ageCheck.status === 'eligible'
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
                    : ageCheck.status === 'eligible_32_standard'
                      ? 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800'
                      : 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800'
                }`}
              >
                {ageCheck.status === 'eligible'
                  ? bn ? 'যোগ্য (<= ৩০ বছর)' : 'Eligible (<= 30 yrs)'
                  : ageCheck.status === 'eligible_32_standard'
                    ? bn ? 'যোগ্য (৩২ বছর সীমা / কোটা)' : 'Eligible (32-Yr Govt Limit)'
                    : ageCheck.status === 'underage'
                      ? bn ? 'ন্যূনতম ১৮ বছরের কম' : 'Under Minimum (18 yrs)'
                      : bn ? '৩২ বছরের ঊর্ধ্বে' : 'Exceeds 32 yrs'}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-end">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                {bn ? 'জন্ম তারিখ (ভল্ট থেকে)' : 'Applicant DOB (from Vault)'}
              </label>
              <input
                type="date"
                value={dobInput}
                onChange={(e) => setDobInput(e.target.value)}
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                {bn ? 'বিজ্ঞপ্তির কাট-অফ তারিখ' : 'Circular Age Cutoff Date'}
              </label>
              <input
                type="date"
                value={cutoffInput}
                onChange={(e) => setCutoffInput(e.target.value)}
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
              />
            </div>
            <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold text-slate-800 dark:text-slate-100">
              {ageCheck.isValid
                ? bn
                  ? ageCheck.formattedBn
                  : ageCheck.formattedEn
                : bn
                  ? 'ভল্ট থেকে DOB অথবা জন্ম তারিখ দিন'
                  : 'Set DOB in Profile or pick above'}
            </div>
          </div>

          {fullEligibility && (
            <div className="pt-2.5 border-t border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="font-bold text-slate-700 dark:text-slate-200">
                  {bn ? 'সার্বিক প্রোফাইল যোগ্যতা:' : 'Profile Eligibility Summary:'}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold border ${
                    fullEligibility.overallStatus === 'ELIGIBLE'
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                      : fullEligibility.overallStatus === 'NOT_ELIGIBLE'
                        ? 'bg-rose-100 text-rose-800 border-rose-200'
                        : fullEligibility.overallStatus === 'INSUFFICIENT_PROFILE_DATA'
                          ? 'bg-indigo-100 text-indigo-800 border-indigo-200'
                          : 'bg-amber-100 text-amber-800 border-amber-200'
                  }`}
                >
                  {fullEligibility.overallStatus === 'ELIGIBLE'
                    ? bn ? 'যোগ্য (Eligible)' : 'ELIGIBLE'
                    : fullEligibility.overallStatus === 'NOT_ELIGIBLE'
                      ? bn ? 'যোগ্য নন (Not Eligible)' : 'NOT ELIGIBLE'
                      : fullEligibility.overallStatus === 'INSUFFICIENT_PROFILE_DATA'
                        ? bn ? 'তথ্য অসম্পূর্ণ (Insufficient Data)' : 'INSUFFICIENT DATA'
                        : bn ? 'ম্যানুয়াল যাচাই প্রয়োজন' : 'MANUAL REVIEW REQUIRED'}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {fullEligibility.criteria.map((cr) => (
                  <span
                    key={cr.key}
                    title={bn ? cr.reasonBn : cr.reasonEn}
                    className={`px-2 py-0.5 rounded text-[10.5px] font-semibold border ${
                      cr.status === 'Matched'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : cr.status === 'Failed'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {bn ? cr.labelBn : cr.labelEn}: {cr.status}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Manual Deadline Verification Helper when PDF/Source has unverified deadline */}
        {!job.deadlineVerified && onUpdateDeadline && (
          <div className="p-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 space-y-2">
            <div className="text-xs font-bold text-amber-900 dark:text-amber-300">
              {bn
                ? '⚠️ এই বিজ্ঞপ্তির শেষ তারিখ স্বয়ংক্রিয়ভাবে যাচাই করা যায়নি (PDF বা ডিসকভারি লিংক)। অফিসিয়াল বিজ্ঞপ্তি দেখে তারিখ যোগ করলে স্মার্ট রিমাইন্ডার চালু হবে:'
                : '⚠️ Deadline could not be verified automatically from this source. Once you verify the official date, enter it below to activate deadline reminders:'}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={deadlineInput}
                onChange={(e) => setDeadlineInput(e.target.value)}
                className="text-xs border border-amber-300 dark:border-amber-700 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
              />
              <button
                type="button"
                disabled={updatingDeadline || !deadlineInput}
                onClick={handleSaveManualDeadline}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50 cursor-pointer"
              >
                {updatingDeadline ? 'Saving...' : bn ? 'যাচাইকৃত তারিখ সংরক্ষণ' : 'Save Verified Deadline'}
              </button>
              {deadlineError && <span className="text-xs text-rose-600 font-semibold">{deadlineError}</span>}
            </div>
          </div>
        )}

        {/* Official Source Provenance & Job Scam Awareness */}
        {(() => {
          const provenance = classifyOfficialSourceTier(job);
          const scamReport = assessCircularScamSignals(job);
          return (
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-petro-600" />
                  <span>Source Verification Tier: {provenance.tier}</span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold border ${
                    scamReport.warningLevel === 'High Attention'
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : scamReport.warningLevel === 'Moderate'
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}
                >
                  Scam Signals: {scamReport.warningLevel}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 flex flex-wrap gap-3">
                <span>Method: {provenance.verificationMethod}</span>
                <span>Last Checked: {new Date(provenance.lastCheckedDate).toLocaleDateString('en-GB')}</span>
                {provenance.verificationTimestamp && (
                  <span>Verified At: {new Date(provenance.verificationTimestamp).toLocaleDateString('en-GB')}</span>
                )}
              </div>
              {scamReport.reasons.length > 0 && (
                <ul className="list-disc list-inside text-[11px] text-amber-800 dark:text-amber-300 space-y-0.5">
                  {scamReport.reasons.map((r) => (
                    <li key={r.code}>
                      <strong>{r.title}:</strong> {r.evidence}
                    </li>
                  ))}
                </ul>
              )}
              <div className="text-[10.5px] text-slate-400">{scamReport.cautionNotice}</div>
            </div>
          );
        })()}

        {/* Secondary Source & Official Verification Card */}
        {job.secondarySourceUrl && (
          <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 text-xs space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>{bn ? 'মাধ্যমিক উৎস ও অফিশিয়াল ভেরিফিকেশন' : 'Secondary Discovery Source & Official Verification'}</span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
                {job.verificationStatus || 'SECONDARY_SOURCE_ONLY'}
              </span>
            </div>
            <div className="text-[11px] text-amber-800 dark:text-amber-300 space-y-1">
              <p>
                {bn
                  ? 'এই বিজ্ঞপ্তিটি মাধ্যমিক উৎস (bdgovtjob.net) থেকে সংগৃহীত। এটি সরকারি কর্তৃপক্ষের নিজস্ব অফিশিয়াল উৎস নয়। আবেদন করার পূর্বে অফিশিয়াল ওয়েবসাইট ও টেলিটক পোর্টালে তথ্য যাচাই করা হয়েছে।'
                  : 'This circular was discovered from secondary aggregator bdgovtjob.net, not the official authority itself. Official endpoints and documents have been cross-checked.'}
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {job.secondarySourceUrl && (
                  <a
                    href={job.secondarySourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-white dark:bg-slate-900 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800"
                  >
                    <span>{bn ? 'মূল আর্টিকেল (bdgovtjob.net)' : 'Original Article (bdgovtjob.net)'}</span>
                    <ExternalLink className="w-3 h-3 text-amber-500" />
                  </a>
                )}
                {job.officialSourceUrl && (
                  <a
                    href={job.officialSourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-white dark:bg-slate-900 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700"
                  >
                    <span>{bn ? 'অফিশিয়াল ওয়েবসাইট' : 'Official Portal'}</span>
                    <ExternalLink className="w-3 h-3 text-emerald-600" />
                  </a>
                )}
                {job.applicationUrl && (
                  <a
                    href={job.applicationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-emerald-600 text-white"
                  >
                    <span>{bn ? 'টেলিটক আবেদন লিংক' : 'Official Apply Link'}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Conflict Detection Warning Banner */}
        {job.hasConflict && job.conflictNotes && job.conflictNotes.length > 0 && (
          <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-xs space-y-1.5">
            <div className="font-bold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>{bn ? 'সতর্কতা: তথ্যের অসঙ্গতি শনাক্ত হয়েছে' : 'Warning: Conflicting Information Detected'}</span>
            </div>
            <ul className="list-disc list-inside text-[11px] text-rose-700 dark:text-rose-300 space-y-0.5">
              {job.conflictNotes.map((note, idx) => (
                <li key={idx}>{note}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Description & Procedure */}
        <div className="space-y-4 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-1.5 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-petro-600" />
              <span>{bn ? 'চাকরির বিবরণ' : 'Job Description'}</span>
            </h3>
            <p className="whitespace-pre-line bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800">
              {job.description}
            </p>
          </div>

          {Array.isArray(job.requirements) && job.requirements.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-1.5">{bn ? 'যোগ্যতা ও শর্তাবলি' : 'Requirements'}</h3>
              <ul className="list-disc list-inside space-y-1 bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800">
                {job.requirements.map((req, idx) => (
                  <li key={idx}>{req}</li>
                ))}
              </ul>
            </div>
          )}

          {job.applicationProcedure && (
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-1.5">{bn ? 'আবেদন প্রক্রিয়া' : 'Application Procedure'}</h3>
              <p className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800">
                {job.applicationProcedure}
              </p>
            </div>
          )}

          {job.requiredDocuments && job.requiredDocuments.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-1.5">{bn ? 'প্রয়োজনীয় কাগজপত্র' : 'Required Documents'}</h3>
              <ul className="list-disc list-inside space-y-1">
                {job.requiredDocuments.map((doc, idx) => (
                  <li key={idx}>{doc}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Official Links Footer & Inline PDF Viewer */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
          <div className="flex flex-wrap gap-2.5 text-xs">
            {job.circularUrl && circularCheck.isSafeToOpen && (
              <a
                href={circularCheck.normalizedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold"
              >
                <FileText className="w-3.5 h-3.5 text-emerald-600" />
                <span>
                  {bn
                    ? isPdfCircular ? 'অফিশিয়াল বিজ্ঞপ্তি (PDF)' : 'অফিশিয়াল বিজ্ঞপ্তি দেখুন'
                    : isPdfCircular ? 'Official Circular (PDF)' : 'View Official Circular'}
                </span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}

            {organizationTarget && (
              <a
                href={organizationTarget}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold"
              >
                <Globe className="w-3.5 h-3.5 text-sky-600" />
                <span>{bn ? 'প্রতিষ্ঠানের ওয়েবসাইট দেখুন' : 'Organization Website'}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}

            {isPdfCircular && (
              <button
                type="button"
                onClick={() => setShowPdfPreview((prev) => !prev)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-800 cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>
                  {showPdfPreview
                    ? bn ? 'PDF প্রিভিউ লুকান' : 'Hide PDF Preview'
                    : bn ? 'PDF বিজ্ঞপ্তি প্রিভিউ দেখুন' : 'Preview PDF Circular'}
                </span>
              </button>
            )}

            {job.sourceUrl && sourceCheck.isSafeToOpen && sourceCheck.normalizedUrl !== circularCheck.normalizedUrl && (
              <a
                href={sourceCheck.normalizedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 font-semibold border border-slate-200 dark:border-slate-700"
              >
                <span>{bn ? 'মূল সোর্স পেজ' : `Source Page (${job.sourceName})`}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}

            {hasDirectApply && (
              <a
                href={urlCheck.normalizedUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  e.preventDefault();
                  onApplyNow(job);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800"
              >
                <span>{bn ? 'সরাসরি আবেদন করুন' : 'Open Official Application URL'}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>

          {isPdfCircular && showPdfPreview && job.circularUrl && (
            <div className="space-y-2 pt-2">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                {bn
                  ? 'কিছু সরকারি পোর্টাল নিরাপত্তা হেডার (X-Frame-Options) এর কারণে এমবেডেড প্রিভিউ ব্লক করতে পারে; লোড না হলে উপরের Official Circular লিংকে খুলুন।'
                  : 'Note: Some government portals block inline frames via X-Frame-Options. If the preview appears blank, open the Official Circular / PDF Link in a new tab.'}
              </div>
              <iframe
                src={job.circularUrl}
                title="Official Job Circular PDF"
                className="w-full h-[520px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white"
              />
            </div>
          )}

          {/* Preserved Alternate Source Links from Deduplication */}
          {job.alternateSources && job.alternateSources.length > 1 && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                {bn ? 'একাধিক সোর্স লিংক (সংযুক্ত রেকর্ড)' : 'All Matched Source Links'}
              </div>
              <div className="flex flex-wrap gap-2">
                {job.alternateSources.map((alt, idx) => {
                  const safeHref =
                    alt.circularUrl && verifyJobUrl(alt.circularUrl).isSafeToOpen
                      ? alt.circularUrl
                      : alt.applicationUrl && verifyJobUrl(alt.applicationUrl).isSafeToOpen
                        ? alt.applicationUrl
                        : null;
                  if (!safeHref) return null;
                  return (
                    <a
                      key={`${alt.sourceId}_${idx}`}
                      href={safeHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
                    >
                      <span>{alt.sourceName}</span>
                      <ExternalLink className="w-3 h-3 text-slate-400" />
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {/* Preserved Verification History */}
          {job.verificationHistory && job.verificationHistory.length > 0 && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                {bn ? 'যাচাইয়ের ইতিহাস' : 'Verification History'}
              </div>
              <div className="space-y-1 text-[11px] text-slate-600 dark:text-slate-300">
                {job.verificationHistory.map((entry, idx) => (
                  <div
                    key={`${entry.timestamp}_${idx}`}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2"
                  >
                    <div className="space-y-0.5">
                      <div className="font-medium">
                        {entry.action === 'independently_verified'
                          ? bn ? 'স্বতন্ত্রভাবে যাচাইকৃত' : 'Independently Verified'
                          : entry.action || (bn ? 'ম্যানুয়াল এন্ট্রি (অফিশিয়াল যাচাই বাকি)' : 'Manually Added — Official Source Pending Verification')}
                        {entry.note ? ` — ${entry.note}` : ''}
                      </div>
                      {entry.sourceUrl && verifyJobUrl(entry.sourceUrl).isSafeToOpen && (
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 break-all">
                          {bn ? 'মূল সূত্র:' : 'Recorded Source URL:'} {entry.sourceUrl}
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0">
                      {new Date(entry.timestamp).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Collapsible Technical Details (Hidden by Default) */}
          <details className="pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
            <summary className="cursor-pointer select-none font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
              {bn ? 'টেকনিক্যাল তথ্য দেখুন' : 'Technical Details'}
            </summary>
            <div className="mt-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5 font-mono text-[11px] text-slate-600 dark:text-slate-300 break-all">
              <div><strong className="font-sans">Record ID:</strong> {job.id}</div>
              <div><strong className="font-sans">Source ID:</strong> {job.sourceId}</div>
              {job.sourceJobId && <div><strong className="font-sans">External Source ID:</strong> {job.sourceJobId}</div>}
              {job.circularNumber && <div><strong className="font-sans">Circular Reference:</strong> {job.circularNumber}</div>}
              {job.fingerprintHash && <div><strong className="font-sans">Fingerprint:</strong> {job.fingerprintHash}</div>}
              {job.circularUrl && <div><strong className="font-sans">Circular URL:</strong> {job.circularUrl}</div>}
              {job.organizationUrl && <div><strong className="font-sans">Organization Website:</strong> {job.organizationUrl}</div>}
              <div><strong className="font-sans">Application URL:</strong> {job.applicationUrl || 'null (None Verified)'}</div>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
};
