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
} from 'lucide-react';
import { NormalizedJobCircular, ApplicationStatus } from '../types/job.types';
import { formatDhakaDate } from '../services/deadline-parser';
import { getDetailedVerificationBadges, verifyJobUrl } from '../services/source-verifier';
import { formatApplicationStatusLabel, formatJobCategoryLabel } from '../services/source-health-state';
import { classifyApplicationDestination, isCircularDocumentUrl } from '../services/application-link-detector';
import { DeadlineCountdown } from './DeadlineCountdown';
import { BookmarkButton } from './BookmarkButton';

interface JobCardProps {
  job: NormalizedJobCircular;
  isBookmarked: boolean;
  applicationStatus?: ApplicationStatus;
  language?: 'bn' | 'en';
  variant?: 'hub' | 'search';
  onViewDetails: (job: NormalizedJobCircular) => void;
  onApplyNow: (job: NormalizedJobCircular) => void;
  onToggleBookmark: (jobId: string) => void;
  onMarkApplied?: (job: NormalizedJobCircular) => void;
  onShare?: (job: NormalizedJobCircular) => void;
  onHideResult?: (jobId: string) => void;
}

export const JobCard: React.FC<JobCardProps> = ({
  job,
  isBookmarked,
  applicationStatus,
  language = 'en',
  variant = 'hub',
  onViewDetails,
  onApplyNow,
  onToggleBookmark,
  onMarkApplied,
  onShare,
  onHideResult,
}) => {
  const bn = language === 'bn';
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

            <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
              <Building2 className="w-2.5 h-2.5 shrink-0 text-emerald-600" />
              <span>{formatJobCategoryLabel(job.category, bn)}</span>
            </span>

            <span className="text-[10.5px] font-medium px-2 py-0.5 rounded-full bg-slate-50 text-slate-600 border border-slate-200 dark:bg-slate-800/70 dark:text-slate-300 dark:border-slate-700">
              {job.sourceName}
              {altSourceCount > 0 ? ` (+${altSourceCount})` : ''}
            </span>

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
          </div>

          <div className="shrink-0 flex items-center gap-1.5">
            {applicationStatus && (
              <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800">
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
            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 leading-snug break-words">
              {bn && job.organizationBn ? job.organizationBn : job.organization}
            </p>
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
                  ? isPdfCircular ? 'অফিশিয়াল বিজ্ঞপ্তি (PDF)' : 'অফিশিয়াল বিজ্ঞপ্তি'
                  : isPdfCircular ? 'Official Circular (PDF)' : 'Official Circular'}
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
