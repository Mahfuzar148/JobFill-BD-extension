// JobFill BD - Redesigned Professional Job Circular Card Component
// Clean scannable hierarchy, separate field-aware verification badges, zero technical ID clutter,
// consistent button alignment, and clear Bengali/English typography.

import React from 'react';
import {
  Building2,
  MapPin,
  GraduationCap,
  Calendar,
  ExternalLink,
  Eye,
  Users,
  Banknote,
  ShieldCheck,
  Briefcase,
  FileText,
  Globe,
  Lock,
  CheckCircle2,
  Share2,
  EyeOff,
  AlertTriangle,
  Award,
  Clock,
  BookmarkPlus,
} from 'lucide-react';
import { NormalizedJobCircular, ApplicationStatus } from '../types/job.types';
import { formatDhakaDate } from '../services/deadline-parser';
import { getDetailedVerificationBadges, verifyJobUrl } from '../services/source-verifier';
import { formatApplicationStatusLabel, formatJobCategoryLabel } from '../services/source-health-state';
import { classifyApplicationDestination, isCircularDocumentUrl } from '../services/application-link-detector';
import { DeadlineCountdown } from './DeadlineCountdown';
import { BookmarkButton } from './BookmarkButton';
import { GRADE_LABELS } from '../services/grade-extractor';
import { formatGradeWithPayScale, NATIONAL_PAY_SCALE_2015 } from '../services/pay-scale-metadata';
import { isNonGovernmentCategoryLetter, type ExamSchedule, type JobResult } from '../types/job-system.types';
import { getCanonicalCategoryByLetter, mapJobToCategoryLetter } from '../taxonomy/canonical-categories';

interface JobCardProps {
  job: NormalizedJobCircular;
  isBookmarked: boolean;
  applicationStatus?: ApplicationStatus;
  examSchedule?: ExamSchedule | null;
  latestResult?: JobResult | null;
  language?: 'bn' | 'en';
  variant?: 'hub' | 'search';
  onViewDetails: (job: NormalizedJobCircular) => void;
  onApplyNow: (job: NormalizedJobCircular) => void;
  onToggleBookmark: (jobId: string) => void;
  onMarkApplied?: (job: NormalizedJobCircular) => void;
  onShare?: (job: NormalizedJobCircular) => void;
  onHideResult?: (jobId: string) => void;
  isOrganizationFollowed?: boolean;
  onToggleFollowOrg?: (orgName: string) => void;
  isCompared?: boolean;
  onToggleCompare?: (jobId: string) => void;
}

export const JobCard: React.FC<JobCardProps> = ({
  job,
  isBookmarked,
  applicationStatus,
  examSchedule,
  latestResult,
  language = 'en',
  variant = 'hub',
  onViewDetails,
  onApplyNow,
  onToggleBookmark,
  onMarkApplied,
  onShare,
  onHideResult,
  isOrganizationFollowed = false,
  onToggleFollowOrg,
  isCompared = false,
  onToggleCompare,
}) => {
  const bn = language === 'bn';
  const catLetter = (job as any).categoryLetter || mapJobToCategoryLetter(job);
  const catDef = getCanonicalCategoryByLetter(catLetter);
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
  const circCheck = job.circularUrl ? verifyJobUrl(job.circularUrl) : { isSafeToOpen: false, normalizedUrl: '' };
  const orgCheck = job.organizationUrl ? verifyJobUrl(job.organizationUrl) : { isSafeToOpen: false, normalizedUrl: '' };
  const appCls = classifyApplicationDestination(job.applicationUrl);
  const isPdfCircular = Boolean(job.circularUrl && isCircularDocumentUrl(job.circularUrl));
  const altSourceCount = Math.max(0, (job.alternateSources?.length ?? 1) - 1);
  const isApplied = applicationStatus === 'Applied';

  const initials =
    job.organization
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join('') || 'JB';

  const primaryTitle = bn && job.titleBn ? job.titleBn : job.position || job.jobTitle;
  const secondaryTitle =
    job.titleBn && job.titleBn !== (job.position || job.jobTitle)
      ? bn
        ? job.position || job.jobTitle
        : job.titleBn
      : !job.titleBn && job.jobTitle !== job.position
        ? job.jobTitle
        : null;

  const Wrapper = variant === 'search' ? 'article' : 'div';
  const Heading = variant === 'search' ? 'h2' : 'h3';

  return (
    <Wrapper
      role={variant === 'search' ? undefined : 'listitem'}
      className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 p-4 shadow-xs hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-700 transition-all flex flex-col justify-between gap-3"
    >
      <div className="space-y-2.5">
        {/* Top Row: Field-Level Verification + Category + Source + Countdown */}
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex items-center flex-wrap gap-1.5">
            {verificationBadges.map((b) => (
              <span
                key={b.key}
                className={`inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-full border ${b.colorClass}`}
              >
                <ShieldCheck className="w-3 h-3 shrink-0" />
                <span>{bn ? b.labelBn : b.labelEn}</span>
              </span>
            ))}

            {/* Universal Category Badge (A through R) */}
            <span className="inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800">
              <Building2 className="w-2.5 h-2.5 shrink-0 text-indigo-600" />
              <span>{catLetter}. {bn ? catDef?.nameBn || catDef?.nameEn || job.category : catDef?.nameEn || job.category}</span>
            </span>

            <span className="text-[10.5px] font-medium px-2 py-0.5 rounded-full bg-slate-50 text-slate-600 border border-slate-200 dark:bg-slate-800/70 dark:text-slate-300 dark:border-slate-700">
              {job.sourceName}
              {altSourceCount > 0 ? ` (+${altSourceCount})` : ''}
            </span>

            {/* Verified Grade Pill vs Non-Government Private Salary-Based */}
            {isNonGovt ? (
              <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                <Briefcase className="w-2.5 h-2.5 text-slate-500 shrink-0" />
                <span>{bn ? 'বেসরকারি বেতন ভিত্তিক' : 'Private Salary-Based'}</span>
              </span>
            ) : (job.gradeNumber ?? (job as any).grade?.gradeNumber) ? (
              <span
                className="inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800"
                title={formatGradeWithPayScale(Number(job.gradeNumber ?? (job as any).grade?.gradeNumber))}
              >
                <Award className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                <span>
                  {bn
                    ? formatGradeWithPayScale(Number(job.gradeNumber ?? (job as any).grade?.gradeNumber))
                    : `Grade: ${job.gradeNumber ?? (job as any).grade?.gradeNumber}${NATIONAL_PAY_SCALE_2015[Number(job.gradeNumber ?? (job as any).grade?.gradeNumber)] ? ` (${NATIONAL_PAY_SCALE_2015[Number(job.gradeNumber ?? (job as any).grade?.gradeNumber)].payScale})` : ''}`}
                </span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10.5px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400">
                <span>{bn ? 'গ্রেড উল্লেখ নেই' : 'Grade Not Specified'}</span>
              </span>
            )}

            {/* Exam Status Badge */}
            {examSchedule && (examSchedule.status === 'Announced' || examSchedule.status === 'Rescheduled') && examSchedule.examDate ? (
              <span className="inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800">
                <Calendar className="w-2.5 h-2.5 text-blue-600 shrink-0" />
                <span>{bn ? `পরীক্ষার তারিখ: ${formatDhakaDate(typeof examSchedule.examDate === 'number' ? examSchedule.examDate : new Date(examSchedule.examDate).getTime(), examSchedule.examDate)}` : `Exam Date: ${formatDhakaDate(typeof examSchedule.examDate === 'number' ? examSchedule.examDate : new Date(examSchedule.examDate).getTime(), examSchedule.examDate)}`}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10.5px] font-medium px-2 py-0.5 rounded-full bg-slate-50 text-slate-600 border border-slate-200 dark:bg-slate-800/70 dark:text-slate-400 dark:border-slate-700">
                <Clock className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                <span>{bn ? 'তারিখ নির্ধারিত হয়নি' : 'Exam Date Not Announced'}</span>
              </span>
            )}

            {/* Result Status Pill */}
            {latestResult && (latestResult.publicationStatus === 'Result Published' || latestResult.publicationStatus === 'Revised Result Published') ? (
              <span className="inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                <span>{bn ? `${latestResult.stage} ফলাফল প্রকাশিত` : `${latestResult.stage} Result Published`}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10.5px] font-medium px-2 py-0.5 rounded-full bg-slate-50 text-slate-500 border border-slate-200 dark:bg-slate-800/70 dark:text-slate-400 dark:border-slate-700">
                <EyeOff className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                <span>{bn ? 'ফলাফল এখনও প্রকাশিত হয়নি' : 'Result Not Published'}</span>
              </span>
            )}

            {job.cadreStatus && job.cadreStatus !== 'Unspecified' && (
              <span className={`inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-0.5 rounded-full ${
                job.cadreStatus === 'Cadre'
                  ? 'bg-blue-50 text-blue-800 border border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800'
                  : 'bg-slate-100 text-slate-700 border border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
              }`}>
                <span>{bn ? (job.cadreStatus === 'Cadre' ? 'ক্যাডার' : 'নন-ক্যাডার') : job.cadreStatus}</span>
              </span>
            )}

            {job.gazettedStatus && job.gazettedStatus !== 'Unspecified' && (
              <span className={`inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-0.5 rounded-full ${
                job.gazettedStatus === 'Gazetted'
                  ? 'bg-indigo-50 text-indigo-800 border border-indigo-300 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800'
                  : 'bg-slate-100 text-slate-700 border border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
              }`}>
                <span>{bn ? (job.gazettedStatus === 'Gazetted' ? 'গেজেটেড' : 'নন-গেজেটেড') : job.gazettedStatus}</span>
              </span>
            )}

            {job.taxonomyCategoryNameEn && (
              <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800">
                <span>{bn ? job.taxonomyCategoryNameBn || job.taxonomyCategoryNameEn : job.taxonomyCategoryNameEn}</span>
                {job.taxonomySubcategoryNameEn && (
                  <span className="text-[9.5px] opacity-75">› {bn ? job.taxonomySubcategoryNameBn || job.taxonomySubcategoryNameEn : job.taxonomySubcategoryNameEn}</span>
                )}
              </span>
            )}

            {job.workMode && job.workMode !== 'Unspecified' && (
              <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-800 border border-cyan-200 dark:bg-cyan-950/50 dark:text-cyan-300 dark:border-cyan-800">
                <span>{job.workMode === 'Remote' ? (bn ? 'রিমোট' : 'Remote') : job.workMode === 'Hybrid' ? (bn ? 'হাইব্রিড' : 'Hybrid') : (bn ? 'অন-সাইট' : 'On-Site')}</span>
              </span>
            )}

            {job.employerType && job.employerType !== 'Other' && (
              <span className="inline-flex items-center gap-1 text-[10.5px] font-medium px-2 py-0.5 rounded-full bg-purple-50 text-purple-800 border border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800">
                <span>{job.employerType}</span>
              </span>
            )}

            {appCls.isLoginRequired && (
              <span className="inline-flex items-center gap-1 text-[10.5px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800">
                <Lock className="w-2.5 h-2.5 shrink-0" />
                <span>{bn ? 'লগইন প্রয়োজন' : 'Login Required'}</span>
              </span>
            )}

            {job.possibleDuplicateOfId && (
              <span className="inline-flex items-center gap-1 text-[10.5px] font-medium px-2 py-0.5 rounded-full bg-sky-50 text-sky-800 border border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800">
                <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                <span>{bn ? 'সম্ভাব্য অনুরূপ' : 'Possible Duplicate'}</span>
              </span>
            )}

            {job.secondarySourceUrl && (
              <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800" title={job.secondarySourceUrl}>
                <span>{bn ? 'উৎস: bdgovtjob.net (মাধ্যমিক)' : 'Source: bdgovtjob.net (Secondary)'}</span>
              </span>
            )}

            {job.hasConflict && (
              <span className="inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800">
                <AlertTriangle className="w-2.5 h-2.5 text-rose-600 shrink-0" />
                <span>{bn ? 'তথ্য অসঙ্গতি' : 'Conflict Detected'}</span>
              </span>
            )}
          </div>

          <div className="shrink-0 flex items-center gap-1.5">
            {applicationStatus && (
              <span
                className={`text-[10.5px] font-semibold px-2 py-0.5 rounded-full border ${
                  applicationStatus === 'Applied' || applicationStatus === 'Payment Completed'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                    : applicationStatus === 'Application Started'
                    ? 'bg-sky-50 text-sky-800 border-sky-300 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800'
                    : applicationStatus === 'Submission Pending Verification' || applicationStatus === 'Needs Manual Confirmation'
                    ? 'bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-800'
                    : applicationStatus === 'Submission Failed'
                    ? 'bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-800'
                    : applicationStatus === 'Visited'
                    ? 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800'
                    : 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800'
                }`}
              >
                {formatApplicationStatusLabel(applicationStatus, bn)}
              </span>
            )}
            <DeadlineCountdown
              deadlineAt={job.deadlineAt}
              deadlineVerified={job.deadlineVerified}
              language={language}
              compact
            />
          </div>
        </div>

        {/* Main Section: Title + Organization + Summary */}
        <div className="flex items-start gap-3">
          {job.organizationLogo ? (
            <img
              src={job.organizationLogo}
              alt={job.organization}
              className="w-9 h-9 rounded-lg object-contain border border-slate-200 dark:border-slate-700 bg-white shrink-0 mt-0.5"
            />
          ) : (
            <div
              aria-hidden="true"
              className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-emerald-700 dark:text-emerald-400 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5"
            >
              {initials}
            </div>
          )}

          <div className="min-w-0 flex-1 space-y-0.5">
            <Heading className="text-[15px] sm:text-base font-bold text-slate-900 dark:text-white leading-snug break-words">
              <button
                type="button"
                onClick={() => onViewDetails(job)}
                className="text-left hover:text-emerald-700 dark:hover:text-emerald-400 cursor-pointer transition-colors"
              >
                {primaryTitle}
              </button>
            </Heading>
            {secondaryTitle && (
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300 leading-snug break-words">
                {secondaryTitle}
              </p>
            )}
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 leading-snug break-words">
                {bn && job.organizationBn ? job.organizationBn : job.organization}
              </p>
              {onToggleFollowOrg && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFollowOrg(job.organization);
                  }}
                  className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                    isOrganizationFollowed
                      ? 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/70 dark:text-amber-200'
                      : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-100'
                  }`}
                  title={isOrganizationFollowed ? 'Unfollow organization' : 'Follow organization for circular alerts'}
                >
                  <BookmarkPlus className="w-2.5 h-2.5" />
                  <span>{isOrganizationFollowed ? (bn ? 'অনুসরণ করছেন' : 'Following') : (bn ? '+ অনুসরণ' : '+ Follow')}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {job.description && (
          <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed font-normal">
            {job.description}
          </p>
        )}

        {/* Information Row */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11.5px] text-slate-600 dark:text-slate-300">
          <span className="inline-flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>{job.location}</span>
          </span>

          <span className="inline-flex items-center gap-1">
            <GraduationCap className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>{job.qualification || 'Any Qualification'}</span>
          </span>

          <span className="inline-flex items-center gap-1">
            <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>{job.employmentType}</span>
          </span>

          {typeof job.vacancies === 'number' && job.vacancies > 0 && (
            <span className="inline-flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-200">
              <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>
                {job.vacancies} {bn ? 'টি পদ' : 'Vacancies'}
              </span>
            </span>
          )}

          {job.salary && (
            <span className="inline-flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-400">
              <Banknote className="w-3.5 h-3.5 shrink-0" />
              <span>{job.salary}</span>
            </span>
          )}

          <span className="inline-flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>
              {bn ? 'প্রকাশ: ' : 'Published: '}
              {job.publishedAt ? formatDhakaDate(job.publishedAt) : job.publishedDateText || (bn ? 'উল্লেখ নেই' : 'Not specified')}
            </span>
          </span>

          <span className="inline-flex items-center gap-1">
            <span>
              {bn ? 'শেষ তারিখ: ' : 'Deadline: '}
              <strong className={job.deadlineVerified ? 'font-semibold text-slate-800 dark:text-slate-100' : 'font-semibold text-amber-700 dark:text-amber-400'}>
                {job.deadlineVerified
                  ? formatDhakaDate(job.deadlineAt, job.deadlineText)
                  : bn ? 'শেষ তারিখ যাচাইকৃত নয়' : 'Deadline Not Verified'}
              </strong>
            </span>
          </span>
        </div>
      </div>

      {/* Bottom Action Row */}
      <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => onViewDetails(job)}
            className="inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100 transition-colors cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5 shrink-0" />
            <span>{bn ? 'বিস্তারিত দেখুন' : 'View Details'}</span>
          </button>

          {job.circularUrl && circCheck.isSafeToOpen && (
            <a
              href={circCheck.normalizedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors"
            >
              <FileText className="w-3.5 h-3.5 shrink-0 text-slate-500" />
              <span>
                {bn
                  ? isPdfCircular
                    ? 'অফিশিয়াল বিজ্ঞপ্তি (PDF)'
                    : job.sourceId === 'bdjobs' || job.sourceName.toLowerCase().includes('bdjobs')
                      ? 'Bdjobs সার্কুলার লিংক'
                      : 'অফিশিয়াল বিজ্ঞপ্তি'
                  : isPdfCircular
                    ? 'Official Circular (PDF)'
                    : job.sourceId === 'bdjobs' || job.sourceName.toLowerCase().includes('bdjobs')
                      ? 'Original Bdjobs Circular'
                      : 'Official Circular'}
              </span>
              <ExternalLink className="w-3 h-3 shrink-0" />
            </a>
          )}

          {job.organizationUrl && orgCheck.isSafeToOpen && orgCheck.normalizedUrl !== circCheck.normalizedUrl && (
            <a
              href={orgCheck.normalizedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 hover:bg-slate-100 text-slate-700 dark:text-slate-200 transition-colors"
            >
              <Globe className="w-3.5 h-3.5 shrink-0 text-sky-600" />
              <span>{bn ? 'প্রতিষ্ঠানের ওয়েবসাইট' : 'Website'}</span>
            </a>
          )}

          {job.secondarySourceUrl && verifyJobUrl(job.secondarySourceUrl).isSafeToOpen && (
            <a
              href={job.secondarySourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-medium border border-amber-200 dark:border-amber-800/70 bg-amber-50/60 dark:bg-amber-950/40 hover:bg-amber-100 text-amber-800 dark:text-amber-300 transition-colors"
              title={bn ? 'মূল সেকেন্ডারি আর্টিকেল লিংক' : 'Open discovery article on bdgovtjob.net'}
            >
              <FileText className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>{bn ? 'মূল আর্টিকেল' : 'Original Article'}</span>
              <ExternalLink className="w-3 h-3 shrink-0" />
            </a>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <BookmarkButton
            isBookmarked={isBookmarked}
            onToggle={() => onToggleBookmark(job.id)}
            compact
            language={language}
          />

          {onMarkApplied && (
            <button
              type="button"
              onClick={() => onMarkApplied(job)}
              className={`inline-flex items-center gap-1 h-8 px-2.5 rounded-lg text-xs font-semibold border cursor-pointer transition-colors ${
                isApplied
                  ? 'bg-emerald-600 text-white border-emerald-700'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>{isApplied ? (bn ? 'আবেদনকৃত' : 'Applied') : bn ? 'আবেদন সম্পন্ন' : 'Mark as Applied'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onViewDetails(job)}
            className="inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5 shrink-0 text-slate-500" />
            <span>{bn ? 'বিবরণ ও টাইমলাইন' : 'Details & Timeline'}</span>
          </button>

          <button
            type="button"
            onClick={() => onViewDetails(job)}
            className="inline-flex items-center justify-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-semibold border border-indigo-200 dark:border-indigo-800/70 bg-indigo-50/70 dark:bg-indigo-950/40 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 transition-colors cursor-pointer"
            title={bn ? 'প্রোফাইলের সাথে যোগ্যতা যাচাই করুন' : 'Check Eligibility against your profile'}
          >
            <Award className="w-3.5 h-3.5 shrink-0 text-indigo-600 dark:text-indigo-400" />
            <span>{bn ? 'যোগ্যতা যাচাই' : 'Check Eligibility'}</span>
          </button>

          {onToggleCompare && (
            <button
              type="button"
              onClick={() => onToggleCompare(job.id)}
              className={`inline-flex items-center justify-center gap-1 h-8 px-2.5 rounded-lg text-xs font-semibold border cursor-pointer transition-colors ${
                isCompared
                  ? 'bg-blue-600 text-white border-blue-700'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
              }`}
              title={bn ? 'তুলনা তালিকায় যোগ/বাদ দিন' : 'Toggle Job Comparison'}
            >
              <span>{isCompared ? (bn ? 'তুলনায় যুক্ত' : 'Compared') : (bn ? 'তুলনা করুন' : 'Compare')}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onApplyNow(job)}
            className="inline-flex items-center justify-center gap-1.5 h-8 px-3.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors cursor-pointer"
          >
            <span>{bn ? 'সরাসরি আবেদন করুন' : 'Apply Now'}</span>
            <ExternalLink className="w-3.5 h-3.5 shrink-0" />
          </button>

          {onShare && (
            <button
              type="button"
              onClick={() => onShare(job)}
              title={bn ? 'শেয়ার' : 'Share'}
              aria-label={`Share ${primaryTitle}`}
              className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>
          )}

          {onHideResult && (
            <button
              type="button"
              onClick={() => onHideResult(job.id)}
              title={bn ? 'এই ফলাফল লুকান' : 'Hide result'}
              aria-label={`Hide ${job.position || job.jobTitle}`}
              className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
            >
              <EyeOff className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </Wrapper>
  );
};
