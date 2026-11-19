// JobFill BD - Advanced Job Search, Government Grade Filter, GPA & Pure Filtering Engine

import React, { useState } from 'react';
import {
  Search,
  SlidersHorizontal,
  RotateCcw,
  Layers,
  ChevronDown,
  ChevronUp,
  X,
  HelpCircle,
  Award,
  DollarSign,
  GraduationCap,
  Briefcase,
  Globe,
  Building2,
  ExternalLink,
  Clock,
  FileText,
  CheckCircle2,
  Shield,
} from 'lucide-react';
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
  GovernmentJobGrade,
  EmployerType,
  WorkMode,
  ExperienceLevel,
  JobSourceFilterGroup,
} from '../types/job.types';
import { JobTaxonomyRegistry } from '../taxonomy/job-taxonomy';
import { DAY_MS, isTimestampInCurrentDhakaWeek } from '../services/deadline-parser';
import { buildBdjobsSearchUrl } from '../sources/bdjobs/bdjobs.adapter';
import { CANONICAL_18_CATEGORIES, mapJobToCategoryLetter } from '../taxonomy/canonical-categories';
import type { CategoryLetter, ExamSchedule, JobResult } from '../types/job-system.types';

declare module '../types/job.types' {
  interface JobSearchFilters {
    categoryLetter?: CategoryLetter | 'All';
    examStatus?: 'all' | 'announced' | 'not_announced' | 'postponed' | 'completed';
    resultStatus?: 'all' | 'result_published' | 'result_pending';
  }
}
import {
  matchesSearchCategory,
  matchesJobEducation,
  matchesJobLocation,
  matchesJobDeadline,
  getOrganizationSearchAliases,
  normalizeSearchText,
} from '../services/search-engine';
import { JobGradeExtractor, GRADE_LABELS } from '../services/grade-extractor';
import {
  ACADEMIC_DISCIPLINES,
  getSubjectById,
  ALL_CANONICAL_SUBJECTS,
} from '../taxonomy/subject-taxonomy';

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

export const ALL_GOVT_GRADES: GovernmentJobGrade[] = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
];

export const SPECIAL_GRADE_CATEGORIES = [
  { id: 'Not Specified', labelEn: 'Grade Not Specified', labelBn: 'গ্রেড উল্লেখ নেই' },
  { id: 'Non-Grade', labelEn: 'Non-Grade', labelBn: 'নন-গ্রেড' },
  { id: 'Contractual', labelEn: 'Contractual', labelBn: 'চুক্তিভিত্তিক' },
  { id: 'Private Salary-Based', labelEn: 'Private Salary-Based', labelBn: 'বেসরকারি বেতনভিত্তিক' },
  { id: 'Needs Verification', labelEn: 'Needs Verification', labelBn: 'যাচাই প্রয়োজন' },
];

export const EMPLOYER_TYPES: EmployerType[] = [
  'Government Ministry',
  'Directorate / Department',
  'Autonomous Organization',
  'Public University',
  'Central Bank',
  'Commercial Bank',
  'Specialized Bank',
  'NBFI',
  'NGO / INGO',
  'Multinational',
  'Private Enterprise',
  'Other',
];

export const WORK_MODES: WorkMode[] = [
  'On-Site',
  'Remote',
  'Hybrid',
];

export const EXPERIENCE_LEVELS: ExperienceLevel[] = [
  'Fresh Graduate / Entry-Level',
  'Mid-Level (1-4 years)',
  'Senior Level (5+ years)',
  'Leadership / Executive',
  'Not Specified',
];

export interface SourceFilterGroupDefinition {
  id: JobSourceFilterGroup;
  labelEn: string;
  labelBn: string;
  shortLabelBn: string;
  badgeColorClass: string;
}

export const SOURCE_FILTER_GROUPS: SourceFilterGroupDefinition[] = [
  {
    id: 'All',
    labelEn: 'All Sources',
    labelBn: 'সব সোর্স',
    shortLabelBn: 'সব সোর্স',
    badgeColorClass: 'border-slate-300 bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
  },
  {
    id: 'government_portals',
    labelEn: 'Government Portals',
    labelBn: 'সরকারি পোর্টাল ও মন্ত্রণালয়',
    shortLabelBn: 'সরকারি পোর্টাল',
    badgeColorClass: 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
  },
  {
    id: 'teletalk',
    labelEn: 'Teletalk Portals',
    labelBn: 'টেলিটক পোর্টাল',
    shortLabelBn: 'টেলিটক',
    badgeColorClass: 'border-teal-300 bg-teal-50 text-teal-800 dark:bg-teal-950/50 dark:text-teal-300 dark:border-teal-800',
  },
  {
    id: 'bdjobs',
    labelEn: 'Bdjobs.com',
    labelBn: 'বিডিজবস (Bdjobs.com)',
    shortLabelBn: 'বিডিজবস',
    badgeColorClass: 'border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
  },
  {
    id: 'bank_recruitment',
    labelEn: 'Bank Recruitment',
    labelBn: 'ব্যাংক নিয়োগ ও বাংলাদেশ ব্যাংক',
    shortLabelBn: 'ব্যাংক নিয়োগ',
    badgeColorClass: 'border-sky-300 bg-sky-50 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800',
  },
  {
    id: 'ngo_ingo',
    labelEn: 'NGO / INGO',
    labelBn: 'এনজিও ও উন্নয়ন সংস্থা',
    shortLabelBn: 'এনজিও / INGO',
    badgeColorClass: 'border-cyan-300 bg-cyan-50 text-cyan-800 dark:bg-cyan-950/50 dark:text-cyan-300 dark:border-cyan-800',
  },
  {
    id: 'private_company',
    labelEn: 'Private Company Websites',
    labelBn: 'বেসরকারি কোম্পানি ও টেক',
    shortLabelBn: 'বেসরকারি কোম্পানি',
    badgeColorClass: 'border-purple-300 bg-purple-50 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800',
  },
  {
    id: 'international_jobs',
    labelEn: 'International Jobs',
    labelBn: 'আন্তর্জাতিক ও গ্লোবাল',
    shortLabelBn: 'আন্তর্জাতিক',
    badgeColorClass: 'border-indigo-300 bg-indigo-50 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800',
  },
  {
    id: 'bdgovtjob',
    labelEn: 'BD Govt Job (bdgovtjob.net)',
    labelBn: 'বিডি গভর্নমেন্ট জব (bdgovtjob.net)',
    shortLabelBn: 'বিডি গভর্নমেন্ট জব',
    badgeColorClass: 'border-orange-300 bg-orange-50 text-orange-800 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-800',
  },
];

export function isJobMatchingSourceGroup(
  job: NormalizedJobCircular,
  group?: JobSourceFilterGroup
): boolean {
  if (!group || group === 'All') return true;
  const sId = (job.sourceId || '').toLowerCase();
  const sName = (job.sourceName || '').toLowerCase();
  const cat = job.category;
  const taxCat = job.taxonomyCategoryId;

  switch (group) {
    case 'bdjobs':
      return sId.includes('bdjobs') || sName.includes('bdjobs');
    case 'teletalk':
      return sId.includes('teletalk') || sName.includes('teletalk');
    case 'bank_recruitment':
      return (
        sId.includes('bangladesh-bank') ||
        sId.includes('bangladesh_bank') ||
        cat === 'Bank' ||
        taxCat === 'banking_finance'
      );
    case 'ngo_ingo':
      return (
        sId === 'reliefweb' ||
        cat === 'NGO' ||
        taxCat === 'ngo_development' ||
        job.employerType === 'NGO / INGO'
      );
    case 'private_company':
      return (
        ['remotive', 'remoteok', 'himalayas', 'arbeitnow'].includes(sId) ||
        cat === 'Private' ||
        job.employerType === 'Private Enterprise' ||
        job.employerType === 'Multinational'
      );
    case 'international_jobs':
      return (
        ['reliefweb', 'himalayas', 'remoteok', 'remotive'].includes(sId) ||
        cat === 'International Jobs' ||
        job.location === 'Remote' ||
        job.workMode === 'Remote'
      );
    case 'government_portals':
      return (
        ['bpsc', 'national-portal', 'dpe', 'ntrca'].includes(sId) ||
        sId.startsWith('govt_') ||
        sId.includes('alljobs') ||
        sId.includes('bpsc') ||
        job.isGovernmentJob === true ||
        Boolean(job.governmentGroup) ||
        (cat === 'Government' && !sId.includes('bdjobs')) ||
        (taxCat === 'govt_public' && !sId.includes('bdjobs')) ||
        job.employerType === 'Government Ministry' ||
        job.employerType === 'Directorate / Department' ||
        job.employerType === 'Autonomous Organization' ||
        job.employerType === 'Public University' ||
        (typeof job.circularUrl === 'string' && (job.circularUrl.includes('.gov.bd') || job.circularUrl.includes('.mil.bd'))) ||
        (typeof job.applicationUrl === 'string' && (job.applicationUrl.includes('.gov.bd') || job.applicationUrl.includes('.mil.bd') || job.applicationUrl.includes('teletalk.com.bd')))
      );
    case 'bdgovtjob':
      return sId.includes('bdgovtjob') || sName.includes('bdgovtjob');
    default:
      return true;
  }
}

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
  selectedGrades: [],
  minGpa: null,
  minSalary: null,
  maxSalary: null,
  taxonomyCategory: 'All',
  taxonomySubcategory: 'All',
  industry: 'All',
  employerType: 'All',
  workMode: 'All',
  experienceLevel: 'All',
  searchMode: 'smart_filter',
  includeUnclassified: true,
  sourceGroup: 'All',
  governmentGroup: 'All',
  categoryLetter: 'All',
  examStatus: 'all',
  resultStatus: 'all',
  academicDiscipline: 'All',
  academicSubject: 'All',
  eligibilityStatus: 'All',
  maxAgeLimit: null,
  sourceVerificationLevel: 'All',
};

export const defaultJobSearchFilters = DEFAULT_JOB_FILTERS;

export function isJobMatchingStatFilter(
  job: NormalizedJobCircular,
  statFilter: DashboardStatFilter | undefined,
  bookmarkedIds: Set<string>,
  applicationsByJobId?: Map<string, ApplicationTrackerRecord>,
  now: number = Date.now()
): boolean {
  switch (statFilter || 'total') {
    case 'new_this_week':
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
    // 1. Dashboard Stat Filter
    if (!isJobMatchingStatFilter(job, filters.statFilter, bookmarkedIds, applicationsByJobId, now)) {
      return false;
    }

    // 2. Status Tab Filter (All, Active, Expired, Newly Discovered, Closing Soon)
    if (filters.statusTab && filters.statusTab !== 'all') {
      const isExpired =
        job.status === 'expired' ||
        (job.deadlineVerified && typeof job.deadlineAt === 'number' && job.deadlineAt <= now);

      if (filters.statusTab === 'active' && isExpired) return false;
      if (filters.statusTab === 'expired' && !isExpired) return false;
      if (filters.statusTab === 'closing_soon') {
        const isClosingSoon =
          job.deadlineVerified &&
          typeof job.deadlineAt === 'number' &&
          job.deadlineAt > now &&
          job.deadlineAt - now <= 7 * DAY_MS;
        if (!isClosingSoon) return false;
      }
      if (filters.statusTab === 'newly_discovered') {
        if (now - job.firstDiscoveredAt > 7 * DAY_MS) return false;
      }
      if (filters.statusTab === 'bookmarked' && !bookmarkedIds.has(job.id)) return false;
      if (filters.statusTab === 'applied') {
        const status = applicationsByJobId?.get(job.id)?.status;
        if (status !== 'Applied' && status !== 'Ready to Apply') return false;
      }
    }

    // 3. Bookmarked only checkbox
    if (filters.bookmarkedOnly && !bookmarkedIds.has(job.id)) return false;

    // 4. Text Query matching (English & Bengali aliases + Grades)
    if (q) {
      const gradeAlias = job.gradeNumber
        ? `grade ${job.gradeNumber} grade-${job.gradeNumber} ${job.gradeNumber}th ${job.gradeNumber}ম গ্রেড-${job.gradeNumber}`
        : '';
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
        job.gradeLabel || '',
        gradeAlias,
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

    // 5. Category, Employment, Education, Location, Deadline dropdowns
    if (filters.category !== 'All' && !matchesSearchCategory(job, filters.category)) return false;
    if (filters.employmentType !== 'All' && job.employmentType !== filters.employmentType) return false;
    if (!matchesJobEducation(job, filters.education)) return false;
    if (!matchesJobLocation(job, filters.location)) return false;
    if (!matchesJobDeadline(job, filters.deadline, now)) return false;

    // 6. Universal Job Taxonomy Category and Subcategory (Multi-Label Aware)
    if (filters.taxonomyCategory && filters.taxonomyCategory !== 'All') {
      const targetCat = JobTaxonomyRegistry.resolveCategoryId(filters.taxonomyCategory);
      const matchCat =
        job.taxonomyCategoryId === targetCat ||
        Boolean(
          job.taxonomyCategoryIds &&
            job.taxonomyCategoryIds.map((id) => JobTaxonomyRegistry.resolveCategoryId(id)).includes(targetCat)
        ) ||
        (targetCat === 'other_unclassified' && Boolean(job.isUnclassified));
      const allowUnclassified = Boolean(filters.includeUnclassified && job.isUnclassified);
      if (!matchCat && !allowUnclassified) return false;
    }
    if (filters.taxonomySubcategory && filters.taxonomySubcategory !== 'All') {
      const matchSub = job.taxonomySubcategoryId?.toLowerCase() === filters.taxonomySubcategory.toLowerCase();
      const allowUnclassified = Boolean(filters.includeUnclassified && job.isUnclassified);
      if (!matchSub && !allowUnclassified) return false;
    }

    // 7. Employer Type Filter
    if (filters.employerType && filters.employerType !== 'All') {
      if (job.employerType !== filters.employerType) return false;
    }

    // 8. Work Mode Filter (Remote, Hybrid, On-Site)
    if (filters.workMode && filters.workMode !== 'All') {
      if (job.workMode !== filters.workMode) return false;
    }

    // 9. Experience Level Filter
    if (filters.experienceLevel && filters.experienceLevel !== 'All') {
      if (job.experienceLevel !== filters.experienceLevel) return false;
    }

    // 10. Government Job Grade Filter (multi-select)
    // Disabled for private sector, NGO, and international categories (private jobs do not use civil service pay grades)
    const isPrivateCategory = filters.category === 'Private' || filters.category === 'NGO' || filters.category === 'International Jobs';
    if (!isPrivateCategory && filters.selectedGrades && filters.selectedGrades.length > 0 && !filters.selectedGrades.includes('All')) {
      if (!JobGradeExtractor.matchesGradeFilter(job, filters.selectedGrades)) {
        return false;
      }
    }

    // 11. Academic Minimum GPA / CGPA Filter (Applicant Eligibility)
    if (typeof filters.minGpa === 'number' && filters.minGpa > 0) {
      if (typeof job.minGpa === 'number' && job.minGpa > filters.minGpa) {
        return false;
      }
      if (typeof job.minCgpa === 'number' && job.minCgpa > filters.minGpa) {
        return false;
      }
    }

    // 8. Salary Range Filter
    if (typeof filters.minSalary === 'number' && filters.minSalary > 0) {
      const minSal = job.salaryMin ?? job.salaryMax;
      if (minSal !== null && minSal !== undefined && minSal < filters.minSalary) {
        return false;
      }
    }
    if (typeof filters.maxSalary === 'number' && filters.maxSalary > 0) {
      const minSal = job.salaryMin ?? job.salaryMax;
      if (minSal !== null && minSal !== undefined && minSal > filters.maxSalary) {
        return false;
      }
    }

    // 12. Source Group Filter (Government, Teletalk, Bdjobs, Bank, NGO, Private, International)
    if (filters.sourceGroup && filters.sourceGroup !== 'All') {
      if (!isJobMatchingSourceGroup(job, filters.sourceGroup)) {
        return false;
      }
    }

    // 13. Specific Government Group Filter (Central, Ministries, Defence, Bank, etc.)
    if (filters.governmentGroup && filters.governmentGroup !== 'All') {
      if (job.governmentGroup && job.governmentGroup !== filters.governmentGroup) {
        return false;
      }
    }

    // 14. Universal 18-Category Letter Filter (A through R)
    if (filters.categoryLetter && filters.categoryLetter !== 'All') {
      const jobCatLetter = (job as any).categoryLetter || mapJobToCategoryLetter(job);
      if (jobCatLetter !== filters.categoryLetter) {
        return false;
      }
    }

    // 15. Exam Lifecycle Status Filter
    if (filters.examStatus && filters.examStatus !== 'all') {
      const schedules: ExamSchedule[] = (job as any).examSchedules || [];
      if (filters.examStatus === 'announced') {
        const hasAnnounced = schedules.some((s) => s.status === 'Announced' || s.status === 'Rescheduled');
        if (!hasAnnounced) return false;
      } else if (filters.examStatus === 'not_announced') {
        const hasAnnounced = schedules.some((s) => s.status === 'Announced' || s.status === 'Rescheduled' || s.status === 'Completed');
        if (hasAnnounced) return false;
      } else if (filters.examStatus === 'postponed') {
        const hasPostponed = schedules.some((s) => s.status === 'Postponed');
        if (!hasPostponed) return false;
      } else if (filters.examStatus === 'completed') {
        const hasCompleted = schedules.some((s) => s.status === 'Completed');
        if (!hasCompleted) return false;
      }
    }

    // 16. Result Lifecycle Status Filter
    if (filters.resultStatus && filters.resultStatus !== 'all') {
      const results: JobResult[] = (job as any).results || [];
      if (filters.resultStatus === 'result_published') {
        const hasPublished = results.some((r) => r.publicationStatus === 'Result Published' || r.publicationStatus === 'Revised Result Published' || r.publicationStatus === 'Partially Published');
        if (!hasPublished) return false;
      } else if (filters.resultStatus === 'result_pending') {
        const hasPublished = results.some((r) => r.publicationStatus === 'Result Published' || r.publicationStatus === 'Revised Result Published' || r.publicationStatus === 'Partially Published');
        if (hasPublished) return false;
      }
    }

    // 17. Academic Discipline & Subject Filter
    if (filters.academicDiscipline && filters.academicDiscipline !== 'All') {
      const disc = ACADEMIC_DISCIPLINES.find((d) => d.id === filters.academicDiscipline);
      if (disc) {
        const textToMatch = `${job.jobTitle || ''} ${job.position || ''} ${job.qualification || ''} ${(job.requirements || []).join(' ')} ${job.description || ''}`;
        const matchesAnySubjectInDiscipline = disc.subjects.some((subj) =>
          subj.aliases.some((rx) => rx.test(textToMatch))
        );
        if (!matchesAnySubjectInDiscipline) return false;
      }
    }

    if (filters.academicSubject && filters.academicSubject !== 'All') {
      const targetSubj = getSubjectById(filters.academicSubject);
      if (targetSubj) {
        const textToMatch = `${job.jobTitle || ''} ${job.position || ''} ${job.qualification || ''} ${(job.requirements || []).join(' ')} ${job.description || ''}`;
        const matchesTarget = targetSubj.aliases.some((rx) => rx.test(textToMatch));
        if (!matchesTarget) return false;
      }
    }

    // 18. Eligibility Status Filter (All, Eligible, Review, Not Eligible)
    if (filters.eligibilityStatus && filters.eligibilityStatus !== 'All') {
      const verdict = (job as any).eligibilityVerdict || (job as any).eligibilityStatus;
      if (filters.eligibilityStatus === 'Eligible') {
        if (verdict !== 'ELIGIBLE' && verdict !== 'Eligible') return false;
      } else if (filters.eligibilityStatus === 'Review') {
        if (verdict !== 'MANUAL_REVIEW_REQUIRED' && verdict !== 'Needs Verification' && verdict !== 'Review') return false;
      } else if (filters.eligibilityStatus === 'Not Eligible') {
        if (verdict !== 'NOT_ELIGIBLE' && verdict !== 'Not Eligible') return false;
      }
    }

    // 19. Max Age Limit Filter (e.g. 30, 32, 35, 40)
    if (filters.maxAgeLimit) {
      const ageStr = `${job.ageRequirement || ''} ${(job.requirements || []).join(' ')} ${job.description || ''}`;
      const match = ageStr.match(/\b(?:1[6-9]|2[0-9])\s*(?:-|to|থেকে)\s*(2[5-9]|3[0-9]|4[0-5])\b/i) ||
                    ageStr.match(/(?:max(?:imum)?\s*age|up to|অনূর্ধ্ব|সর্বোচ্চ\s*বয়স)\s*[:\-]?\s*(2[5-9]|3[0-9]|4[0-5])/i);
      if (match) {
        const parsedMaxAge = parseInt(match[1], 10);
        if (parsedMaxAge > filters.maxAgeLimit) return false;
      }
    }

    // 20. Source Verification Level Filter (Official vs Secondary)
    if (filters.sourceVerificationLevel && filters.sourceVerificationLevel !== 'All') {
      const isOfficial = job.sourceVerification === 'official_verified' ||
                         (job.sourceId || '').toLowerCase().includes('bpsc') ||
                         (job.sourceId || '').toLowerCase().includes('teletalk') ||
                         (job.sourceId || '').toLowerCase().includes('bangladesh-bank') ||
                         (job.sourceId || '').toLowerCase().includes('petrobangla');
      if (filters.sourceVerificationLevel === 'Official' && !isOfficial) return false;
      if (filters.sourceVerificationLevel === 'Secondary' && isOfficial) return false;
    }

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
  onOpenDiagnostic?: () => void;
  totalMatchingCount?: number;
  onSearchOnline?: () => void;
  isSearchingOnline?: boolean;
}

export const JobFilters: React.FC<JobFiltersProps> = ({
  filters,
  onChange,
  language = 'en',
  onOpenDiagnostic,
  totalMatchingCount,
  onSearchOnline,
  isSearchingOnline = false,
}) => {
  const bn = language === 'bn';
  const [showGradePanel, setShowGradePanel] = useState(false);
  const [showAdvancedPanel, setShowAdvancedPanel] = useState(false);

  const safeFilters = filters || DEFAULT_JOB_FILTERS;

  const update = <K extends keyof JobSearchFilters>(key: K, val: JobSearchFilters[K]) => {
    onChange({ ...safeFilters, [key]: val });
  };

  const selectedGrades = safeFilters.selectedGrades || [];
  const activeGradeCount = selectedGrades.filter((g) => g !== 'All').length;

  const toggleGradeSelection = (gradeId: string) => {
    let next: string[];
    if (selectedGrades.includes(gradeId)) {
      next = selectedGrades.filter((g) => g !== gradeId);
    } else {
      next = [...selectedGrades.filter((g) => g !== 'All'), gradeId];
    }
    update('selectedGrades', next);
  };

  const selectGradeRange = (start: number, end: number) => {
    const rangeItems: string[] = [];
    for (let i = start; i <= end; i++) {
      rangeItems.push(String(i));
    }
    const set = new Set([...selectedGrades, ...rangeItems]);
    update('selectedGrades', Array.from(set));
  };

  const clearAllGrades = () => {
    update('selectedGrades', []);
  };

  const isPrivateSelected =
    filters.category === 'Private' ||
    filters.employerType === 'Private Enterprise' ||
    filters.employerType === 'Multinational';

  // Determine active filter chips
  const activeChips: Array<{ id: string; label: string; onRemove: () => void }> = [];

  if (filters.taxonomyCategory && filters.taxonomyCategory !== 'All') {
    const cat = JobTaxonomyRegistry.getById(filters.taxonomyCategory);
    activeChips.push({
      id: 'taxonomyCategory',
      label: `${bn ? 'পেশা' : 'Category'}: ${cat ? (bn ? cat.labelBn : cat.labelEn) : filters.taxonomyCategory}`,
      onRemove: () => onChange({ ...filters, taxonomyCategory: 'All', taxonomySubcategory: 'All' }),
    });
  }
  if (filters.taxonomySubcategory && filters.taxonomySubcategory !== 'All' && filters.taxonomyCategory) {
    const sub = JobTaxonomyRegistry.getSubcategoryById(filters.taxonomyCategory, filters.taxonomySubcategory);
    activeChips.push({
      id: 'taxonomySubcategory',
      label: `${bn ? 'উপ-পেশা' : 'Sub'}: ${sub ? (bn ? sub.labelBn : sub.labelEn) : filters.taxonomySubcategory}`,
      onRemove: () => update('taxonomySubcategory', 'All'),
    });
  }
  if (filters.employerType && filters.employerType !== 'All') {
    activeChips.push({
      id: 'employerType',
      label: `${bn ? 'নিয়োগকারী' : 'Employer'}: ${filters.employerType}`,
      onRemove: () => update('employerType', 'All'),
    });
  }
  if (filters.workMode && filters.workMode !== 'All') {
    activeChips.push({
      id: 'workMode',
      label: `${bn ? 'মোড' : 'Mode'}: ${filters.workMode}`,
      onRemove: () => update('workMode', 'All'),
    });
  }
  if (filters.experienceLevel && filters.experienceLevel !== 'All') {
    activeChips.push({
      id: 'experienceLevel',
      label: `${bn ? 'অভিজ্ঞতা' : 'Exp'}: ${filters.experienceLevel}`,
      onRemove: () => update('experienceLevel', 'All'),
    });
  }
  if (filters.category !== 'All') {
    activeChips.push({
      id: 'category',
      label: `${bn ? 'ক্যাটাগরি' : 'Category'}: ${filters.category}`,
      onRemove: () => update('category', 'All'),
    });
  }
  if (filters.education !== 'All') {
    activeChips.push({
      id: 'education',
      label: `${bn ? 'যোগ্যতা' : 'Education'}: ${filters.education}`,
      onRemove: () => update('education', 'All'),
    });
  }
  if (filters.location !== 'All') {
    activeChips.push({
      id: 'location',
      label: `${bn ? 'স্থান' : 'Location'}: ${filters.location}`,
      onRemove: () => update('location', 'All'),
    });
  }
  if (filters.deadline !== 'all') {
    activeChips.push({
      id: 'deadline',
      label: `${bn ? 'সময়সীমা' : 'Deadline'}: ${filters.deadline}`,
      onRemove: () => update('deadline', 'all'),
    });
  }
  if (selectedGrades.length > 0) {
    activeChips.push({
      id: 'grades',
      label: `${bn ? 'গ্রেড' : 'Grades'} (${selectedGrades.length})`,
      onRemove: clearAllGrades,
    });
  }
  if (typeof filters.minGpa === 'number' && filters.minGpa > 0) {
    activeChips.push({
      id: 'minGpa',
      label: `GPA ≥ ${filters.minGpa}`,
      onRemove: () => update('minGpa', null),
    });
  }
  if (typeof filters.minSalary === 'number' && filters.minSalary > 0) {
    activeChips.push({
      id: 'minSalary',
      label: `≥ ৳${filters.minSalary.toLocaleString()}`,
      onRemove: () => update('minSalary', null),
    });
  }
  if (filters.sourceGroup && filters.sourceGroup !== 'All') {
    const srcDef = SOURCE_FILTER_GROUPS.find((s) => s.id === filters.sourceGroup);
    activeChips.push({
      id: 'sourceGroup',
      label: `${bn ? 'সোর্স' : 'Source'}: ${srcDef ? (bn ? srcDef.shortLabelBn : srcDef.labelEn) : filters.sourceGroup}`,
      onRemove: () => update('sourceGroup', 'All'),
    });
  }
  if (filters.categoryLetter && filters.categoryLetter !== 'All') {
    activeChips.push({
      id: 'categoryLetter',
      label: `${bn ? 'ক্যাটাগরি' : 'Category'}: ${filters.categoryLetter}`,
      onRemove: () => update('categoryLetter', 'All'),
    });
  }
  if (filters.examStatus && filters.examStatus !== 'all') {
    activeChips.push({
      id: 'examStatus',
      label: `${bn ? 'পরীক্ষা' : 'Exam'}: ${filters.examStatus}`,
      onRemove: () => update('examStatus', 'all'),
    });
  }
  if (filters.resultStatus && filters.resultStatus !== 'all') {
    activeChips.push({
      id: 'resultStatus',
      label: `${bn ? 'ফলাফল' : 'Result'}: ${filters.resultStatus}`,
      onRemove: () => update('resultStatus', 'all'),
    });
  }
  if (filters.eligibilityStatus && filters.eligibilityStatus !== 'All') {
    activeChips.push({
      id: 'eligibilityStatus',
      label: `${bn ? 'যোগ্যতা' : 'Eligibility'}: ${filters.eligibilityStatus}`,
      onRemove: () => update('eligibilityStatus', 'All'),
    });
  }
  if (filters.maxAgeLimit) {
    activeChips.push({
      id: 'maxAgeLimit',
      label: `Age ≤ ${filters.maxAgeLimit} yrs`,
      onRemove: () => update('maxAgeLimit', null),
    });
  }
  if (filters.sourceVerificationLevel && filters.sourceVerificationLevel !== 'All') {
    activeChips.push({
      id: 'sourceVerificationLevel',
      label: `${bn ? 'উৎস' : 'Source'}: ${filters.sourceVerificationLevel}`,
      onRemove: () => update('sourceVerificationLevel', 'All'),
    });
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs space-y-3">
      {/* Search + Sort + Diagnostic Row */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            value={filters.query}
            onChange={(e) => update('query', e.target.value)}
            placeholder={
              bn
                ? 'প্রতিষ্ঠান, পদ, ৯ম গ্রেড, বিসিএস, যোগ্যতা বা জেলা দিয়ে খুঁজুন...'
                : 'Search organization, 9th Grade, job title, position, qualification, location...'
            }
            className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:border-petro-600"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {onSearchOnline && (
            <button
              type="button"
              onClick={onSearchOnline}
              disabled={isSearchingOnline}
              title={bn ? 'সব সোর্স থেকে নতুন চাকরির লাইভ অনলাইন সার্চ চালান' : 'Run live federated search across all configured portals'}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-emerald-600 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer transition-colors shadow-xs disabled:opacity-50"
            >
              <Search className={`w-3.5 h-3.5 ${isSearchingOnline ? 'animate-spin' : ''}`} />
              <span>{isSearchingOnline ? (bn ? 'সার্চ হচ্ছে...' : 'Searching...') : (bn ? 'লাইভ অনলাইন সার্চ' : 'Search Online')}</span>
            </button>
          )}

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

          {onOpenDiagnostic && (
            <button
              type="button"
              onClick={onOpenDiagnostic}
              title={bn ? 'কোনো বিজ্ঞপ্তি খুঁজে পাচ্ছেন না? ডায়াগনস্টিক দেখুন' : 'Missing a Job Circular? Run Diagnostic'}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 cursor-pointer transition-colors"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>{bn ? 'সার্কুলার মিসিং?' : 'Missing Circular?'}</span>
            </button>
          )}

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

      {/* Horizontal Job Source Filter Segmented Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 no-scrollbar">
        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 shrink-0 flex items-center gap-1 mr-0.5">
          <Building2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>{bn ? 'সোর্স ফিল্টার:' : 'Job Source:'}</span>
        </span>
        {SOURCE_FILTER_GROUPS.map((sg) => {
          const isSelected = (filters.sourceGroup || 'All') === sg.id;
          return (
            <button
              key={sg.id}
              type="button"
              onClick={() => update('sourceGroup', sg.id)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 cursor-pointer transition-all border ${
                isSelected
                  ? `${sg.badgeColorClass} shadow-xs ring-1 ring-offset-1 ring-emerald-500`
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
              title={bn ? sg.labelBn : sg.labelEn}
            >
              <span>{bn ? sg.shortLabelBn : sg.labelEn}</span>
            </button>
          );
        })}

        {/* External Search on Bdjobs Shortcut */}
        <a
          href={buildBdjobsSearchUrl(filters.query, filters.taxonomyCategory)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold shrink-0 border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors ml-auto cursor-pointer"
          title={bn ? 'বিডিজবস ডট কম পোর্টালে সরাসরি খুঁজুন (নতুন ট্যাব)' : 'Search official Bdjobs.com in a new tab'}
        >
          <ExternalLink className="w-3 h-3 text-amber-600" />
          <span>{bn ? 'বিডিজবসে সরাসরি খুঁজুন' : 'Search Bdjobs.com'}</span>
        </a>
      </div>

      {/* BD Govt Job Sub-Category Filter */}
      {filters.sourceGroup === 'bdgovtjob' && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 no-scrollbar bg-orange-50/50 dark:bg-orange-950/20 px-2.5 py-1.5 rounded-lg border border-orange-200 dark:border-orange-800/50">
          <span className="text-[11px] font-bold text-orange-700 dark:text-orange-300 shrink-0 flex items-center gap-1">
            <span>{bn ? 'বিডি গভর্নমেন্ট জব ক্যাটাগরি:' : 'BD Govt Job Category:'}</span>
          </span>
          {[
            { id: 'All', labelEn: 'All Jobs', labelBn: 'সব ক্যাটাগরি' },
            { id: 'Government', labelEn: 'Government', labelBn: 'সরকারি চাকরি' },
            { id: 'BPSC', labelEn: 'BPSC', labelBn: 'বিপিএসসি' },
            { id: 'Bank', labelEn: 'Bank', labelBn: 'ব্যাংক চাকরি' },
            { id: 'Private', labelEn: 'Private', labelBn: 'প্রাইভেট চাকরি' },
            { id: 'NGO', labelEn: 'NGO', labelBn: 'এনজিও চাকরি' },
            { id: 'Teaching', labelEn: 'Education', labelBn: 'শিক্ষা প্রতিষ্ঠান' },
            { id: 'University', labelEn: 'University', labelBn: 'বিশ্ববিদ্যালয়' },
            { id: 'Defence / Security', labelEn: 'Defence', labelBn: 'ডিফেন্স' },
          ].map((cat) => {
            const isSelected = (filters.category || 'All') === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => update('category', cat.id as any)}
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold shrink-0 cursor-pointer transition-all border ${
                  isSelected
                    ? 'border-orange-400 bg-orange-500 text-white shadow-xs'
                    : 'border-orange-200 dark:border-orange-800 bg-white dark:bg-slate-800 text-orange-900 dark:text-orange-200 hover:bg-orange-100 dark:hover:bg-slate-700'
                }`}
              >
                <span>{bn ? cat.labelBn : cat.labelEn}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Main Standard Filter Dropdowns */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {/* Universal Dynamic Category Selector */}
        <select
          value={filters.taxonomyCategory || 'All'}
          onChange={(e) => {
            const nextCat = e.target.value;
            onChange({
              ...filters,
              taxonomyCategory: nextCat,
              taxonomySubcategory: 'All',
            });
          }}
          aria-label="Universal Job Category"
          className="text-xs bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg px-2.5 py-2 text-emerald-900 dark:text-emerald-200 font-semibold"
        >
          <option value="All">
            {bn
              ? `সব পেশা (${JobTaxonomyRegistry.getAll().length}টি সার্বজনীন ক্যাটাগরি)`
              : `All ${JobTaxonomyRegistry.getAll().length} Categories`}
          </option>
          {JobTaxonomyRegistry.getAll().map((c) => (
            <option key={c.id} value={c.id}>
              {c.code}. {bn ? c.labelBn : c.labelEn}
            </option>
          ))}
        </select>

        {/* Dynamic Subcategory Selector or Standard Category */}
        {filters.taxonomyCategory && filters.taxonomyCategory !== 'All' ? (
          <select
            value={filters.taxonomySubcategory || 'All'}
            onChange={(e) => update('taxonomySubcategory', e.target.value)}
            aria-label="Job Subcategory"
            className="text-xs bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700 rounded-lg px-2.5 py-2 text-emerald-900 dark:text-emerald-200 font-medium"
          >
            <option value="All">{bn ? 'সব সাব-ক্যাটাগরি' : 'All Subcategories'}</option>
            {JobTaxonomyRegistry.getSubcategories(filters.taxonomyCategory).map((sub) => (
              <option key={sub.id} value={sub.id}>
                {bn ? sub.labelBn : sub.labelEn}
              </option>
            ))}
          </select>
        ) : (
          <select
            value={filters.category}
            onChange={(e) => update('category', e.target.value as any)}
            aria-label="Job Category"
            className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 text-slate-700 dark:text-slate-200"
          >
            <option value="All">{bn ? 'সব সাধারণ বিভাগ' : 'All Standard Categories'}</option>
            {JOB_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        )}

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

      {/* Filter Expansion Bar: Government Job Grade & Advanced GPA / Salary */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            disabled={isPrivateSelected}
            onClick={() => !isPrivateSelected && setShowGradePanel(!showGradePanel)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              isPrivateSelected
                ? 'opacity-40 cursor-not-allowed bg-slate-100 dark:bg-slate-800 text-slate-400'
                : showGradePanel || activeGradeCount > 0
                  ? 'bg-petro-50 dark:bg-petro-950/60 text-petro-700 dark:text-petro-300 border border-petro-200 dark:border-petro-800'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
            }`}
            title={
              isPrivateSelected
                ? (bn ? 'সরকারি চাকরির বেতন গ্রেড বেসরকারি চাকরির ক্ষেত্রে প্রযোজ্য নয়' : 'Government pay grades do not apply to private sector jobs')
                : undefined
            }
          >
            <Award className="w-3.5 h-3.5 text-petro-600" />
            <span>{bn ? 'সরকারি বেতন গ্রেড ফিল্টার' : 'Job Grade Filter (1st-20th)'}</span>
            {activeGradeCount > 0 && (
              <span className="bg-petro-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                {activeGradeCount}
              </span>
            )}
            {showGradePanel ? <ChevronUp className="w-3.5 h-3.5 ml-0.5" /> : <ChevronDown className="w-3.5 h-3.5 ml-0.5" />}
          </button>

          <button
            type="button"
            onClick={() => setShowAdvancedPanel(!showAdvancedPanel)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              showAdvancedPanel || filters.minGpa || filters.minSalary
                ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600" />
            <span>{bn ? 'জিপিএ ও বেতন ফিল্টার' : 'GPA & Salary Filters'}</span>
            {showAdvancedPanel ? <ChevronUp className="w-3.5 h-3.5 ml-0.5" /> : <ChevronDown className="w-3.5 h-3.5 ml-0.5" />}
          </button>
        </div>

        {typeof totalMatchingCount === 'number' && (
          <span className="text-[11px] text-slate-500 font-semibold">
            {bn ? `${totalMatchingCount}টি সার্কুলার পাওয়া গেছে` : `${totalMatchingCount} circulars matched`}
          </span>
        )}
      </div>

      {/* Government Job Grade Selection Panel */}
      {showGradePanel && (
        <div className="bg-slate-50/80 dark:bg-slate-800/40 border border-petro-100 dark:border-petro-950 rounded-xl p-3.5 space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-slate-200 dark:border-slate-700">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Award className="w-4 h-4 text-petro-600" />
              <span>{bn ? 'বাংলাদেশ সরকারি চাকরির বেতন গ্রেড (১ম হতে ২০তম গ্রেড)' : 'Government Pay Grades (1st to 20th Grade)'}</span>
            </span>

            {/* Quick Range Selection Buttons */}
            <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
              <button
                type="button"
                onClick={() => selectGradeRange(1, 9)}
                className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-petro-50 font-semibold cursor-pointer"
              >
                {bn ? '১ম–৯ম গ্রেড' : '1st–9th Grade'}
              </button>
              <button
                type="button"
                onClick={() => selectGradeRange(10, 15)}
                className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-petro-50 font-semibold cursor-pointer"
              >
                {bn ? '১০ম–১৫তম গ্রেড' : '10th–15th Grade'}
              </button>
              <button
                type="button"
                onClick={() => selectGradeRange(16, 20)}
                className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-petro-50 font-semibold cursor-pointer"
              >
                {bn ? '১৬তম–২০তম গ্রেড' : '16th–20th Grade'}
              </button>
              {activeGradeCount > 0 && (
                <button
                  type="button"
                  onClick={clearAllGrades}
                  className="px-2 py-0.5 rounded-md text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 font-bold cursor-pointer"
                >
                  {bn ? 'গ্রেড মুছুন' : 'Clear Grades'}
                </button>
              )}
            </div>
          </div>

          {/* 1st through 20th Grade Chip Grid */}
          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-10 gap-1.5">
            {ALL_GOVT_GRADES.map((g) => {
              const gStr = String(g);
              const isSelected = selectedGrades.includes(gStr);
              const meta = GRADE_LABELS[g];
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => toggleGradeSelection(gStr)}
                  className={`px-2 py-1.5 rounded-lg text-xs font-bold text-center transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-petro-600 text-white shadow-xs border border-petro-700'
                      : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-petro-400'
                  }`}
                >
                  <div>{meta.en}</div>
                  <div className="text-[10px] font-normal opacity-90">{meta.bn}</div>
                </button>
              );
            })}
          </div>

          {/* Other Categories Row */}
          <div className="pt-2 flex items-center gap-1.5 flex-wrap border-t border-slate-200 dark:border-slate-700">
            <span className="text-[11px] font-semibold text-slate-500 mr-1">
              {bn ? 'অন্যান্য ধরন:' : 'Other Categories:'}
            </span>
            {SPECIAL_GRADE_CATEGORIES.map((cat) => {
              const isSelected = selectedGrades.includes(cat.id);
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => toggleGradeSelection(cat.id)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-slate-800 dark:bg-white text-white dark:text-slate-900 border border-slate-900'
                      : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
                  }`}
                >
                  {bn ? cat.labelBn : cat.labelEn}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Advanced Taxonomy, Work Mode, Employer, GPA & Salary Filter Panel */}
      {showAdvancedPanel && (
        <div className="bg-slate-50/80 dark:bg-slate-800/40 border border-indigo-100 dark:border-indigo-950 rounded-xl p-3.5 space-y-3 animate-fadeIn">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1 mb-1.5">
                <GraduationCap className="w-3.5 h-3.5 text-indigo-600" />
                <span>{bn ? 'আমার জিপিএ / সিজিপিএ (যোগ্যতা যাচাই)' : 'My GPA / CGPA (Eligibility)'}</span>
              </label>
              <select
                value={filters.minGpa ? String(filters.minGpa) : ''}
                onChange={(e) => update('minGpa', e.target.value ? parseFloat(e.target.value) : null)}
                className="w-full text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 text-slate-700 dark:text-slate-200"
              >
                <option value="">{bn ? 'যে কোনো জিপিএ (Any GPA/CGPA)' : 'Any GPA / CGPA'}</option>
                <option value="2.0">{bn ? 'আমার জিপিএ ২.০০ (GPA 2.00)' : 'My GPA 2.00'}</option>
                <option value="2.5">{bn ? 'আমার জিপিএ ২.৫০ (GPA 2.50)' : 'My GPA 2.50'}</option>
                <option value="3.0">{bn ? 'আমার জিপিএ ৩.০০ (GPA 3.00)' : 'My GPA 3.00'}</option>
                <option value="3.5">{bn ? 'আমার জিপিএ ৩.৫০ (GPA 3.50)' : 'My GPA 3.50'}</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1 mb-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                <span>{bn ? 'নূন্যতম বেতন (Minimum Monthly Salary)' : 'Minimum Monthly Salary'}</span>
              </label>
              <select
                value={filters.minSalary ? String(filters.minSalary) : ''}
                onChange={(e) => update('minSalary', e.target.value ? parseInt(e.target.value, 10) : null)}
                className="w-full text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 text-slate-700 dark:text-slate-200"
              >
                <option value="">{bn ? 'যে কোনো বেতন (Any Salary)' : 'Any Salary'}</option>
                <option value="15000">৳১৫,০০০+ (15,000+ BDT)</option>
                <option value="22000">৳২২,০০০+ (9th Grade equivalent / 22,000+ BDT)</option>
                <option value="35000">৳৩৫,০০০+ (35,000+ BDT)</option>
                <option value="50000">৳৫০,০০০+ (50,000+ BDT)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1 mb-1.5">
                <Building2 className="w-3.5 h-3.5 text-purple-600" />
                <span>{bn ? 'নিয়োগকর্তার ধরন (Employer Type)' : 'Employer Type'}</span>
              </label>
              <select
                value={filters.employerType || 'All'}
                onChange={(e) => update('employerType', e.target.value as any)}
                className="w-full text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 text-slate-700 dark:text-slate-200"
              >
                <option value="All">{bn ? 'সব ধরনের প্রতিষ্ঠান' : 'All Employer Types'}</option>
                {EMPLOYER_TYPES.map((et) => (
                  <option key={et} value={et}>{et}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1 mb-1.5">
                <Globe className="w-3.5 h-3.5 text-cyan-600" />
                <span>{bn ? 'কাজের মোড (Work Mode)' : 'Work Mode'}</span>
              </label>
              <select
                value={filters.workMode || 'All'}
                onChange={(e) => update('workMode', e.target.value as any)}
                className="w-full text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 text-slate-700 dark:text-slate-200"
              >
                <option value="All">{bn ? 'সব মোড (On-Site/Remote/Hybrid)' : 'All Work Modes'}</option>
                {WORK_MODES.map((wm) => (
                  <option key={wm} value={wm}>{wm}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1 mb-1.5">
                <Briefcase className="w-3.5 h-3.5 text-petro-600" />
                <span>{bn ? 'অভিজ্ঞতার পর্যায় (Experience Level)' : 'Experience Level'}</span>
              </label>
              <select
                value={filters.experienceLevel || 'All'}
                onChange={(e) => update('experienceLevel', e.target.value as any)}
                className="w-full text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 text-slate-700 dark:text-slate-200"
              >
                <option value="All">{bn ? 'সব অভিজ্ঞতার পর্যায়' : 'All Experience Levels'}</option>
                {EXPERIENCE_LEVELS.map((el) => (
                  <option key={el} value={el}>{el}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1 mb-1.5">
                <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                <span>{bn ? 'সার্বজনীন ক্যাটাগরি (A-R)' : 'Universal Category (A–R)'}</span>
              </label>
              <select
                value={filters.categoryLetter || 'All'}
                onChange={(e) => update('categoryLetter', e.target.value as any)}
                aria-label="Universal Category Letter"
                className="w-full text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 text-slate-700 dark:text-slate-200"
              >
                <option value="All">{bn ? 'সব ক্যাটাগরি (A-R)' : 'All 18 Categories (A–R)'}</option>
                {CANONICAL_18_CATEGORIES.map((c) => (
                  <option key={c.letter} value={c.letter}>
                    {c.letter}. {bn ? c.nameBn : c.nameEn}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1 mb-1.5">
                <GraduationCap className="w-3.5 h-3.5 text-blue-600" />
                <span>{bn ? 'শিক্ষাগত অনুষদ / ডিসিপ্লিন' : 'Academic Discipline'}</span>
              </label>
              <select
                value={filters.academicDiscipline || 'All'}
                onChange={(e) => {
                  update('academicDiscipline', e.target.value);
                  update('academicSubject', 'All');
                }}
                className="w-full text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 text-slate-700 dark:text-slate-200"
              >
                <option value="All">{bn ? 'সব অনুষদ (All Disciplines)' : 'All Disciplines'}</option>
                {ACADEMIC_DISCIPLINES.map((d) => (
                  <option key={d.id} value={d.id}>
                    {bn ? d.nameBn : d.nameEn}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1 mb-1.5">
                <FileText className="w-3.5 h-3.5 text-emerald-600" />
                <span>{bn ? 'স্নাতক / অনার্সের নির্দিষ্ট বিষয়' : 'Specific Subject'}</span>
              </label>
              <select
                value={filters.academicSubject || 'All'}
                onChange={(e) => update('academicSubject', e.target.value)}
                className="w-full text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 text-slate-700 dark:text-slate-200"
              >
                <option value="All">{bn ? 'সব বিষয় (All Subjects)' : 'All Subjects'}</option>
                {(filters.academicDiscipline && filters.academicDiscipline !== 'All'
                  ? ACADEMIC_DISCIPLINES.find((d) => d.id === filters.academicDiscipline)?.subjects || []
                  : ALL_CANONICAL_SUBJECTS
                ).map((s) => (
                  <option key={s.id} value={s.id}>
                    {bn ? s.nameBn : s.nameEn}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1 mb-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                <span>{bn ? 'পরীক্ষার স্ট্যাটাস' : 'Exam Schedule Status'}</span>
              </label>
              <select
                value={filters.examStatus || 'all'}
                onChange={(e) => update('examStatus', e.target.value as any)}
                aria-label="Exam Schedule Status"
                className="w-full text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 text-slate-700 dark:text-slate-200"
              >
                <option value="all">{bn ? 'সব পরীক্ষার স্ট্যাটাস' : 'All Exam Status'}</option>
                <option value="announced">{bn ? 'তারিখ ঘোষিত (Announced)' : 'Announced'}</option>
                <option value="not_announced">{bn ? 'তারিখ নির্ধারিত হয়নি (Not Announced)' : 'Not Announced'}</option>
                <option value="postponed">{bn ? 'স্থগিত (Postponed)' : 'Postponed'}</option>
                <option value="completed">{bn ? 'সম্পন্ন (Completed)' : 'Completed'}</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1 mb-1.5">
                <Award className="w-3.5 h-3.5 text-emerald-600" />
                <span>{bn ? 'ফলাফল স্ট্যাটাস' : 'Job Result Status'}</span>
              </label>
              <select
                value={filters.resultStatus || 'all'}
                onChange={(e) => update('resultStatus', e.target.value as any)}
                aria-label="Job Result Status"
                className="w-full text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 text-slate-700 dark:text-slate-200"
              >
                <option value="all">{bn ? 'সব ফলাফল স্ট্যাটাস' : 'All Result Status'}</option>
                <option value="result_published">{bn ? 'ফলাফল প্রকাশিত (Published)' : 'Result Published'}</option>
                <option value="result_pending">{bn ? 'ফলাফল অপেক্ষমাণ (Pending)' : 'Result Pending'}</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1 mb-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>{bn ? 'যোগ্যতার স্থিতি (Eligibility)' : 'Eligibility Status'}</span>
              </label>
              <select
                aria-label="Eligibility Status"
                value={filters.eligibilityStatus || 'All'}
                onChange={(e) => update('eligibilityStatus', e.target.value as any)}
                className="w-full text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 text-slate-700 dark:text-slate-200"
              >
                <option value="All">{bn ? 'সব সার্কুলার (All)' : 'All Circulars'}</option>
                <option value="Eligible">{bn ? 'শুধু যোগ্য চাকরি (Eligible Only)' : 'Eligible Only'}</option>
                <option value="Review">{bn ? 'যাচাই প্রয়োজন (Review Required)' : 'Review Required'}</option>
                <option value="Not Eligible">{bn ? 'অযোগ্য চাকরি (Not Eligible)' : 'Not Eligible'}</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1 mb-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>{bn ? 'সর্বোচ্চ বয়সসীমা (Max Age)' : 'Max Age Limit'}</span>
              </label>
              <select
                aria-label="Filter by Age Limit"
                value={filters.maxAgeLimit ? String(filters.maxAgeLimit) : ''}
                onChange={(e) => update('maxAgeLimit', e.target.value ? parseInt(e.target.value, 10) : null)}
                className="w-full text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 text-slate-700 dark:text-slate-200"
              >
                <option value="">{bn ? 'সব বয়সসীমা (Any Age)' : 'Any Age Limit'}</option>
                <option value="30">{bn ? 'অনূর্ধ্ব ৩০ বছর (Max 30 Yrs)' : 'Up to 30 Years'}</option>
                <option value="32">{bn ? 'অনূর্ধ্ব ৩২ বছর (Max 32 Yrs - Quota/BPSC)' : 'Up to 32 Years (Quota/BPSC)'}</option>
                <option value="35">{bn ? 'অনূর্ধ্ব ৩৫ বছর (Max 35 Yrs)' : 'Up to 35 Years'}</option>
                <option value="40">{bn ? 'অনূর্ধ্ব ৪০ বছর (Max 40 Yrs)' : 'Up to 40 Years'}</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1 mb-1.5">
                <Shield className="w-3.5 h-3.5 text-teal-600" />
                <span>{bn ? 'উৎস ভেরিফিকেশন (Source)' : 'Source Verification'}</span>
              </label>
              <select
                aria-label="Filter by Verification Status"
                value={filters.sourceVerificationLevel || 'All'}
                onChange={(e) => update('sourceVerificationLevel', e.target.value as any)}
                className="w-full text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 text-slate-700 dark:text-slate-200"
              >
                <option value="All">{bn ? 'সব সোর্স (All Sources)' : 'All Verification Levels'}</option>
                <option value="Official">{bn ? 'অফিশিয়াল ভেরিফাইড (Govt/Teletalk/Bank)' : 'Official Verified Only'}</option>
                <option value="Secondary">{bn ? 'সেকেন্ডারি / এগ্রিগেটেড' : 'Secondary Aggregated'}</option>
              </select>
            </div>

            <div className="flex items-center pt-5">
              <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={filters.includeUnclassified ?? true}
                  onChange={(e) => update('includeUnclassified', e.target.checked)}
                  className="rounded text-petro-600 focus:ring-petro-500"
                />
                <span>{bn ? 'অনির্দিষ্ট ক্যাটাগরিও অন্তর্ভুক্ত রাখুন' : 'Include Unclassified Jobs'}</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Active Filter Chips Row */}
      {activeChips.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-100 dark:border-slate-800/80">
          <span className="text-[11px] font-bold text-slate-500 mr-1">
            {bn ? 'সক্রিয় ফিল্টার:' : 'Active Filters:'}
          </span>
          {activeChips.map((chip) => (
            <span
              key={chip.id}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-petro-50 dark:bg-petro-950/60 text-petro-700 dark:text-petro-300 border border-petro-200 dark:border-petro-800"
            >
              <span>{chip.label}</span>
              <button
                type="button"
                onClick={chip.onRemove}
                title={bn ? 'ফিল্টারটি মুছুন' : 'Remove filter'}
                className="hover:text-petro-900 dark:hover:text-white cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={() => onChange(DEFAULT_JOB_FILTERS)}
            className="text-[11px] font-bold text-rose-600 hover:underline ml-1 cursor-pointer"
          >
            {bn ? 'সব ফিল্টার মুছুন' : 'Clear All'}
          </button>
        </div>
      )}

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
          <span>{bn ? 'রিয়েল-টাইম লোকাল ফিল্টারিং' : 'Real-time local filtering'}</span>
        </span>
      </div>
    </div>
  );
};
