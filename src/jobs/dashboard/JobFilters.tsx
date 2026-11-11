// JobFill BD - Job Search, Filter, & Sort Controls + Pure Filtering Engine

import React from 'react';
import { Search, SlidersHorizontal, RotateCcw } from 'lucide-react';
import {
  JobSearchFilters,
  JobCategory,
  EducationRequirement,
  JobEmploymentType,
  DeadlineFilterOption,
  JobLocation,
  JobSortOption,
  NormalizedJobCircular,
  DashboardStatFilter,
  ApplicationTrackerRecord,
} from '../types/job.types';
import { DAY_MS, isTimestampInCurrentDhakaWeek } from '../services/deadline-parser';
import {
  matchesSearchCategory,
  matchesJobEducation,
  matchesJobLocation,
  matchesJobDeadline,
  getOrganizationSearchAliases,
  normalizeSearchText,
} from '../services/search-engine';

export const JOB_CATEGORIES: JobCategory[] = [
  'Government',
  'Private',
  'Bank',
  'NGO',
  'University',
  'Autonomous Organization',
  'Defence / Security',
  'Teaching',
  'IT / Technology',
  'Healthcare',
  'Other',
];

export const EDUCATION_LEVELS: EducationRequirement[] = [
  'SSC',
  'HSC',
  'Diploma',
  'Bachelor',
  'Honours',
  'Masters',
  'PhD',
  'Any Qualification',
];

export const EMPLOYMENT_TYPES: JobEmploymentType[] = [
  'Full Time',
  'Part Time',
  'Contractual',
  'Internship',
  'Temporary',
];

export const JOB_LOCATIONS: JobLocation[] = [
  'All Bangladesh',
  'Dhaka',
  'Rajshahi',
  'Chattogram',
  'Khulna',
  'Rangpur',
  'Barishal',
  'Sylhet',
  'Mymensingh',
  'Other',
];

export const DEFAULT_JOB_FILTERS: JobSearchFilters = {
  query: '',
  category: 'All',
  education: 'All',
  employmentType: 'All',
  deadline: 'all',
  location: 'All',
  sortBy: 'latest_published',
  bookmarkedOnly: false,
  statFilter: 'total',
};

export function isJobMatchingStatFilter(
  job: NormalizedJobCircular,
  statFilter: DashboardStatFilter | undefined,
  bookmarkedIds: Set<string>,
  applicationsByJobId?: Map<string, ApplicationTrackerRecord>,
  now: number = Date.now()
): boolean {
  switch (statFilter || 'total') {
    case 'new_this_week':
      // Strictly use verified publishedAt within current Asia/Dhaka calendar week
      return isTimestampInCurrentDhakaWeek(job.publishedAt, now);
    case 'closing_soon':
      return Boolean(
        job.deadlineVerified &&
          typeof job.deadlineAt === 'number' &&
          job.deadlineAt > now &&
          job.deadlineAt - now <= 7 * DAY_MS
      );
    case 'expired':
      return Boolean(
        job.deadlineVerified &&
          typeof job.deadlineAt === 'number' &&
          job.deadlineAt <= now
      );
    case 'bookmarked':
      return bookmarkedIds.has(job.id);
    case 'in_progress': {
      const status = applicationsByJobId?.get(job.id)?.status;
      return status === 'Ready to Apply' || status === 'Applied';
    }
    case 'total':
    default:
      return true;
  }
}

export function filterAndSortJobs(
  jobs: NormalizedJobCircular[],
  filters: JobSearchFilters,
  bookmarkedIds: Set<string>,
  now: number = Date.now(),
  applicationsByJobId?: Map<string, ApplicationTrackerRecord>
): NormalizedJobCircular[] {
  const q = filters.query.trim().toLowerCase();

  const filtered = jobs.filter((job) => {
    if (!isJobMatchingStatFilter(job, filters.statFilter, bookmarkedIds, applicationsByJobId, now)) {
      return false;
    }

    if (filters.bookmarkedOnly && !bookmarkedIds.has(job.id)) return false;

    if (q) {
      const rawFields = [
        job.organization,
        job.organizationBn || '',
        job.organizationShortName || '',
        ...getOrganizationSearchAliases(job),
        job.sourceName,
        job.sourceId.replace(/[_-]+/g, ' '),
        job.jobTitle,
        job.titleBn || '',
        job.position,
        job.circularNumber || '',
        String(job.qualification || ''),
        String(job.location || ''),
        job.category,
      ].join(' ');
      const rawLower = rawFields.toLowerCase();
      if (!rawLower.includes(q)) {
        const normQ = normalizeSearchText(q);
        if (!normQ || !normalizeSearchText(rawFields).includes(normQ)) {
          return false;
        }
      }
    }

    if (filters.category !== 'All' && !matchesSearchCategory(job, filters.category)) return false;
    if (filters.employmentType !== 'All' && job.employmentType !== filters.employmentType) return false;
    if (!matchesJobEducation(job, filters.education)) return false;
    if (!matchesJobLocation(job, filters.location)) return false;
    if (!matchesJobDeadline(job, filters.deadline, now)) return false;

    return true;
  });

  filtered.sort((a, b) => {
    switch (filters.sortBy) {
      case 'deadline_soonest': {
        const da = a.deadlineVerified && a.deadlineAt && a.deadlineAt > now ? a.deadlineAt : Number.MAX_SAFE_INTEGER;
        const db = b.deadlineVerified && b.deadlineAt && b.deadlineAt > now ? b.deadlineAt : Number.MAX_SAFE_INTEGER;
        return da - db;
      }
      case 'recently_expired': {
        const ea = a.deadlineVerified && a.deadlineAt ? a.deadlineAt : 0;
        const eb = b.deadlineVerified && b.deadlineAt ? b.deadlineAt : 0;
        return eb - ea;
      }
      case 'organization_name':
        return a.organization.localeCompare(b.organization);
      case 'recently_updated':
        return b.lastUpdatedAt - a.lastUpdatedAt;
      case 'latest_published':
      default: {
        const pa = a.publishedAt ?? a.firstDiscoveredAt;
        const pb = b.publishedAt ?? b.firstDiscoveredAt;
        return pb - pa;
      }
    }
  });

  return filtered;
}

interface JobFiltersProps {
  filters: JobSearchFilters;
  onChange: (updated: JobSearchFilters) => void;
  language?: 'bn' | 'en';
}

export const JobFilters: React.FC<JobFiltersProps> = ({ filters, onChange, language = 'en' }) => {
  const bn = language === 'bn';

  const update = <K extends keyof JobSearchFilters>(key: K, val: JobSearchFilters[K]) => {
    onChange({ ...filters, [key]: val });
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs space-y-3">
      {/* Search + Sort Row */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            value={filters.query}
            onChange={(e) => update('query', e.target.value)}
            placeholder={
              bn
                ? 'প্রতিষ্ঠান, পদ, সার্কুলার নং, যোগ্যতা বা জেলা দিয়ে খুঁজুন...'
                : 'Search organization, job title, position, circular no, qualification, location...'
            }
            className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:border-petro-600"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filters.sortBy}
            onChange={(e) => update('sortBy', e.target.value as JobSortOption)}
            aria-label="Sort jobs"
            className="text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            <option value="latest_published">{bn ? 'সর্বশেষ প্রকাশিত' : 'Latest Published'}</option>
            <option value="deadline_soonest">{bn ? 'নিকটতম শেষ তারিখ' : 'Deadline Soonest'}</option>
            <option value="recently_expired">{bn ? 'সাম্প্রতিক মেয়াদোত্তীর্ণ' : 'Recently Expired'}</option>
            <option value="organization_name">{bn ? 'প্রতিষ্ঠানের নাম' : 'Organization Name'}</option>
            <option value="recently_updated">{bn ? 'সাম্প্রতিক আপডেট' : 'Most Recently Updated'}</option>
          </select>

          <button
            type="button"
            onClick={() => onChange(DEFAULT_JOB_FILTERS)}
            title={bn ? 'ফিল্টার রিসেট' : 'Reset Filters'}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{bn ? 'রিসেট' : 'Reset'}</span>
          </button>
        </div>
      </div>

      {/* Filter Dropdowns */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        <select
          value={filters.category}
          onChange={(e) => update('category', e.target.value as any)}
          aria-label="Job Category"
          className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 text-slate-700 dark:text-slate-200"
        >
          <option value="All">{bn ? 'সব ক্যাটাগরি' : 'All Categories'}</option>
          {JOB_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <select
          value={filters.education}
          onChange={(e) => update('education', e.target.value as any)}
          aria-label="Education Requirement"
          className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 text-slate-700 dark:text-slate-200"
        >
          <option value="All">{bn ? 'সব শিক্ষাগত যোগ্যতা' : 'All Education'}</option>
          {EDUCATION_LEVELS.map((ed) => (
            <option key={ed} value={ed}>{ed}</option>
          ))}
        </select>

        <select
          value={filters.employmentType}
          onChange={(e) => update('employmentType', e.target.value as any)}
          aria-label="Employment Type"
          className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 text-slate-700 dark:text-slate-200"
        >
          <option value="All">{bn ? 'সব চাকরির ধরন' : 'All Types'}</option>
          {EMPLOYMENT_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        <select
          value={filters.deadline}
          onChange={(e) => update('deadline', e.target.value as DeadlineFilterOption)}
          aria-label="Deadline Filter"
          className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 text-slate-700 dark:text-slate-200"
        >
          <option value="all">{bn ? 'সব সময়সীমা' : 'All Deadlines'}</option>
          <option value="closing_soon">{bn ? 'শীঘ্রই শেষ (৭ দিনের মধ্যে)' : 'Closing Soon (≤ 7 days)'}</option>
          <option value="more_than_7_days">{bn ? '৭ দিনের বেশি' : 'More than 7 days'}</option>
          <option value="3_to_7_days">{bn ? '৩–৭ দিন বাকি' : '3–7 days'}</option>
          <option value="1_to_2_days">{bn ? '১–২ দিন বাকি' : '1–2 days'}</option>
          <option value="closing_today">{bn ? 'আজ শেষ' : 'Closing Today'}</option>
          <option value="expired">{bn ? 'মেয়াদোত্তীর্ণ' : 'Expired'}</option>
        </select>

        <select
          value={filters.location}
          onChange={(e) => update('location', e.target.value as any)}
          aria-label="Location Filter"
          className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 text-slate-700 dark:text-slate-200 col-span-2 sm:col-span-1"
        >
          <option value="All">{bn ? 'সব স্থান' : 'All Locations'}</option>
          {JOB_LOCATIONS.map((loc) => (
            <option key={loc} value={loc}>{loc}</option>
          ))}
        </select>
      </div>

      {/* Bookmarked Only toggle */}
      <div className="flex items-center justify-between pt-1 text-xs">
        <label className="inline-flex items-center gap-2 cursor-pointer font-semibold text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            checked={Boolean(filters.bookmarkedOnly)}
            onChange={(e) => update('bookmarkedOnly', e.target.checked)}
            className="rounded text-petro-600 focus:ring-petro-500"
          />
          <span>{bn ? 'শুধু সংরক্ষিত (Bookmarked) চাকরি দেখান' : 'Show Bookmarked Jobs Only'}</span>
        </label>
        <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
          <SlidersHorizontal className="w-3 h-3" />
          <span>{bn ? 'রিয়েল-টাইম ফিল্টারিং' : 'Real-time local filtering'}</span>
        </span>
      </div>
    </div>
  );
};
