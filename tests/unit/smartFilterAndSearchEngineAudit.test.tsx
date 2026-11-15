import { describe, it, expect } from 'vitest';
import {
  NormalizedJobCircular,
  JobSearchFilters,
} from '../../src/jobs/types/job.types';
import {
  filterAndSortJobs,
  DEFAULT_JOB_FILTERS,
} from '../../src/jobs/dashboard/JobFilters';
import {
  matchesSearchCategory,
  matchesJobEducation,
  matchesJobLocation,
  matchesJobDeadline,
} from '../../src/jobs/services/search-engine';
import { JobGradeExtractor } from '../../src/jobs/services/grade-extractor';
import { JobTaxonomyRegistry } from '../../src/jobs/taxonomy/job-taxonomy';
import {
  computeSourceHealthSummary,
  formatSourceHealthHeadline,
} from '../../src/jobs/services/source-health-state';
import { JobSourceAdapter } from '../../src/jobs/types/source.types';

// ============================================================================
// REALISTIC CONTROLLED FIXTURES (JOB A, B, C, D, E)
// ============================================================================

const FIXTURE_JOB_A: NormalizedJobCircular = {
  id: 'JOB-A-GOVT-HEALTH-11',
  sourceId: 'dghs_health',
  sourceName: 'DGHS Health Services',
  jobTitle: 'Medical Officer (Biochemistry)',
  position: 'Biochemist / Medical Officer',
  organization: 'Directorate General of Health Services (DGHS)',
  organizationBn: 'স্বাস্থ্য অধিদপ্তর',
  category: 'Government',
  isGovernmentJob: true,
  gradeNumber: 11,
  gradeLabel: '11th Grade (১১তম গ্রেড)',
  gradeVerificationStatus: 'OFFICIAL_MATCH',
  qualification: 'Honours in Biochemistry',
  taxonomyCategoryId: 'medical_healthcare',
  taxonomyCategoryIds: ['medical_healthcare'],
  taxonomySubcategoryId: 'doctor',
  location: 'Rajshahi',
  employmentType: 'Full Time',
  workMode: 'On-Site',
  employerType: 'Directorate / Department',
  publishedAt: Date.now() - 3600000,
  deadlineAt: Date.now() + 864000000,
  deadlineVerified: true,
  deadlineTimezone: 'Asia/Dhaka',
  firstDiscoveredAt: Date.now() - 3600000,
  lastUpdatedAt: Date.now() - 3600000,
  status: 'active',
  description: 'Biochemistry officer opening in Rajshahi medical college.',
  requirements: ['Honours in Biochemistry'],
  applicationUrl: 'https://dghs.teletalk.com.bd',
  sourceVerification: 'official_verified',
  sourceLastCheckedAt: Date.now(),
};

const FIXTURE_JOB_B: NormalizedJobCircular = {
  id: 'JOB-B-GOVT-BANK-10',
  sourceId: 'bangladesh_bank',
  sourceName: 'Bangladesh Bank Portal',
  jobTitle: 'Assistant Director (General)',
  position: 'Assistant Director',
  organization: 'Bangladesh Bank',
  organizationBn: 'বাংলাদেশ ব্যাংক',
  category: 'Government',
  isGovernmentJob: true,
  gradeNumber: 10,
  gradeLabel: '10th Grade (১০ম গ্রেড)',
  gradeVerificationStatus: 'OFFICIAL_MATCH',
  qualification: 'Honours in Economics',
  taxonomyCategoryId: 'banking_finance',
  taxonomyCategoryIds: ['banking_finance', 'govt_public'],
  taxonomySubcategoryId: 'central_bank',
  location: 'Dhaka',
  employmentType: 'Full Time',
  workMode: 'On-Site',
  employerType: 'Central Bank',
  publishedAt: Date.now() - 7200000,
  deadlineAt: Date.now() + 500000000,
  deadlineVerified: true,
  deadlineTimezone: 'Asia/Dhaka',
  firstDiscoveredAt: Date.now() - 7200000,
  lastUpdatedAt: Date.now() - 7200000,
  status: 'active',
  description: 'Assistant director recruitment under bankers selection committee.',
  requirements: ['Honours in Economics'],
  applicationUrl: 'https://erecruitment.bb.org.bd',
  sourceVerification: 'official_verified',
  sourceLastCheckedAt: Date.now(),
};

const FIXTURE_JOB_C: NormalizedJobCircular = {
  id: 'JOB-C-PRIV-BANK-NOGRADE',
  sourceId: 'bdjobs',
  sourceName: 'Bdjobs.com',
  jobTitle: 'Management Trainee Officer (Finance)',
  position: 'Management Trainee',
  organization: 'BRAC Bank PLC',
  organizationBn: 'ব্র্যাক ব্যাংক পিএলসি',
  category: 'Private',
  isGovernmentJob: false,
  gradeNumber: null,
  gradeLabel: 'Private Salary-Based',
  gradeVerificationStatus: 'NOT_APPLICABLE',
  qualification: 'Honours in Finance & Banking',
  taxonomyCategoryId: 'banking_finance',
  taxonomyCategoryIds: ['banking_finance'],
  taxonomySubcategoryId: 'private_bank',
  location: 'Rajshahi',
  employmentType: 'Full Time',
  workMode: 'On-Site',
  employerType: 'Commercial Bank',
  publishedAt: Date.now() - 10000000,
  deadlineAt: Date.now() + 300000000,
  deadlineVerified: true,
  deadlineTimezone: 'Asia/Dhaka',
  firstDiscoveredAt: Date.now() - 10000000,
  lastUpdatedAt: Date.now() - 10000000,
  status: 'active',
  description: 'Private commercial bank management trainee post in Rajshahi branch.',
  requirements: ['Honours in Finance'],
  applicationUrl: 'https://bracbank.taleo.net',
  sourceVerification: 'discovery_only',
  sourceLastCheckedAt: Date.now(),
};

const FIXTURE_JOB_D: NormalizedJobCircular = {
  id: 'JOB-D-GOVT-HEALTH-16',
  sourceId: 'mohfw_health',
  sourceName: 'Ministry of Health',
  jobTitle: 'Specialist Medical Assistant',
  position: 'Medical Assistant',
  organization: 'Chittagong Medical College Hospital',
  organizationBn: 'চট্টগ্রাম মেডিকেল কলেজ হাসপাতাল',
  category: 'Government',
  isGovernmentJob: true,
  gradeNumber: 16,
  gradeLabel: '16th Grade (১৬তম গ্রেড)',
  gradeVerificationStatus: 'OFFICIAL_MATCH',
  qualification: 'MBBS with 1 year internship',
  taxonomyCategoryId: 'medical_healthcare',
  taxonomyCategoryIds: ['medical_healthcare'],
  taxonomySubcategoryId: 'doctor',
  location: 'Chattogram',
  employmentType: 'Contractual',
  workMode: 'On-Site',
  employerType: 'Directorate / Department',
  publishedAt: Date.now() - 5000000,
  deadlineAt: Date.now() + 400000000,
  deadlineVerified: true,
  deadlineTimezone: 'Asia/Dhaka',
  firstDiscoveredAt: Date.now() - 5000000,
  lastUpdatedAt: Date.now() - 5000000,
  status: 'active',
  description: 'Contractual medical assistant appointment in Chattogram.',
  requirements: ['MBBS'],
  applicationUrl: 'https://cmch.gov.bd/jobs',
  sourceVerification: 'official_verified',
  sourceLastCheckedAt: Date.now(),
};

const FIXTURE_JOB_E: NormalizedJobCircular = {
  id: 'JOB-E-NGO-REMOTE-MASTERS',
  sourceId: 'reliefweb',
  sourceName: 'ReliefWeb Global',
  jobTitle: 'Humanitarian Research Coordinator',
  position: 'Research Coordinator',
  organization: 'Oxfam International',
  organizationBn: 'অক্সফাম ইন্টারন্যাশনাল',
  category: 'NGO',
  isGovernmentJob: false,
  gradeNumber: null,
  gradeLabel: 'Non-Grade',
  gradeVerificationStatus: 'NOT_APPLICABLE',
  qualification: 'Masters in Development Studies',
  taxonomyCategoryId: 'ngo_development',
  taxonomyCategoryIds: ['ngo_development'],
  taxonomySubcategoryId: 'project_officer',
  location: 'Dhaka',
  employmentType: 'Full Time',
  workMode: 'Remote',
  employerType: 'NGO / INGO',
  publishedAt: Date.now() - 15000000,
  deadlineAt: Date.now() + 600000000,
  deadlineVerified: true,
  deadlineTimezone: 'Asia/Dhaka',
  firstDiscoveredAt: Date.now() - 15000000,
  lastUpdatedAt: Date.now() - 15000000,
  status: 'active',
  description: 'Remote humanitarian research post based in Dhaka office.',
  requirements: ['Masters in Development Studies'],
  applicationUrl: 'https://oxfam.org/careers',
  sourceVerification: 'discovery_only',
  sourceLastCheckedAt: Date.now(),
};

const ALL_FIXTURES = [
  FIXTURE_JOB_A,
  FIXTURE_JOB_B,
  FIXTURE_JOB_C,
  FIXTURE_JOB_D,
  FIXTURE_JOB_E,
];

// Helper to filter and return IDs
function getFilteredIds(filters: Partial<JobSearchFilters>): string[] {
  const merged: JobSearchFilters = {
    ...DEFAULT_JOB_FILTERS,
    ...filters,
  };
  const results = filterAndSortJobs(ALL_FIXTURES, merged, new Set());
  return results.map((j) => j.id);
}

// ============================================================================
// TEST SUITE: COMPLETE SMART JOB SEARCH & FILTER AUDIT VERIFICATION
// ============================================================================

describe('JOBFILL BD — Smart Job Search & Filter System Comprehensive Verification', () => {
  // --------------------------------------------------------------------------
  // Combinatorial Tests (Prompt Explicit Requirements)
  // --------------------------------------------------------------------------
  describe('Prompt Explicit Combinatorial Tests', () => {
    it('Government + Grade 11 + Honours must return ONLY Job A', () => {
      const ids = getFilteredIds({
        category: 'Government',
        selectedGrades: ['11'],
        education: 'Honours',
      });
      expect(ids).toEqual(['JOB-A-GOVT-HEALTH-11']);
    });

    it('Government + Grade 10 + Honours must return ONLY Job B', () => {
      const ids = getFilteredIds({
        category: 'Government',
        selectedGrades: ['10'],
        education: 'Honours',
      });
      expect(ids).toEqual(['JOB-B-GOVT-BANK-10']);
    });

    it('Private + Banking + Honours must return ONLY Job C', () => {
      const ids = getFilteredIds({
        category: 'Private',
        taxonomyCategory: 'banking_finance',
        education: 'Honours',
      });
      expect(ids).toEqual(['JOB-C-PRIV-BANK-NOGRADE']);
    });

    it('Government + Grade 16–20 must return ONLY Job D', () => {
      const ids = getFilteredIds({
        category: 'Government',
        selectedGrades: ['16th-20th'],
      });
      expect(ids).toEqual(['JOB-D-GOVT-HEALTH-16']);
    });

    it('NGO + Remote + Masters must return ONLY Job E', () => {
      const ids = getFilteredIds({
        category: 'NGO',
        workMode: 'Remote',
        education: 'Masters',
      });
      expect(ids).toEqual(['JOB-E-NGO-REMOTE-MASTERS']);
    });
  });

  // --------------------------------------------------------------------------
  // Independent Dimension Tests
  // --------------------------------------------------------------------------
  describe('Independent Filter Dimensions', () => {
    it('1. Government filter returns Job A, Job B, Job D (excluding private and NGO)', () => {
      const ids = getFilteredIds({ category: 'Government' });
      expect(ids).toContain('JOB-A-GOVT-HEALTH-11');
      expect(ids).toContain('JOB-B-GOVT-BANK-10');
      expect(ids).toContain('JOB-D-GOVT-HEALTH-16');
      expect(ids).not.toContain('JOB-C-PRIV-BANK-NOGRADE');
      expect(ids).not.toContain('JOB-E-NGO-REMOTE-MASTERS');
    });

    it('2. Private filter returns Job C only', () => {
      const ids = getFilteredIds({ category: 'Private' });
      expect(ids).toEqual(['JOB-C-PRIV-BANK-NOGRADE']);
    });

    it('3. Bank filter returns both Government Bank (Job B) and Private Bank (Job C)', () => {
      const ids = getFilteredIds({ category: 'Bank' });
      expect(ids).toContain('JOB-B-GOVT-BANK-10');
      expect(ids).toContain('JOB-C-PRIV-BANK-NOGRADE');
      expect(ids).not.toContain('JOB-A-GOVT-HEALTH-11');
      expect(ids).not.toContain('JOB-D-GOVT-HEALTH-16');
      expect(ids).not.toContain('JOB-E-NGO-REMOTE-MASTERS');
    });

    it('4. Education Honours filter returns Job A, Job B, Job C', () => {
      const ids = getFilteredIds({ education: 'Honours' });
      expect(ids).toContain('JOB-A-GOVT-HEALTH-11');
      expect(ids).toContain('JOB-B-GOVT-BANK-10');
      expect(ids).toContain('JOB-C-PRIV-BANK-NOGRADE');
      expect(ids).not.toContain('JOB-D-GOVT-HEALTH-16');
      expect(ids).not.toContain('JOB-E-NGO-REMOTE-MASTERS');
    });

    it('5. Education MBBS matches Job D correctly', () => {
      expect(matchesJobEducation(FIXTURE_JOB_D, 'Bachelor')).toBe(true);
      expect(matchesJobEducation(FIXTURE_JOB_D, 'Honours')).toBe(false);
    });

    it('6. Grade 11 filter returns ONLY Job A', () => {
      const ids = getFilteredIds({ selectedGrades: ['11'] });
      expect(ids).toEqual(['JOB-A-GOVT-HEALTH-11']);
    });

    it('7. Grade 1-9 filter returns empty set (none of the fixtures is grade 1-9)', () => {
      const ids = getFilteredIds({ selectedGrades: ['1st-9th'] });
      expect(ids).toEqual([]);
    });

    it('8. Grade 10-15 filter returns Job A (Grade 11) and Job B (Grade 10)', () => {
      const ids = getFilteredIds({ selectedGrades: ['10th-15th'] });
      expect(ids).toContain('JOB-A-GOVT-HEALTH-11');
      expect(ids).toContain('JOB-B-GOVT-BANK-10');
      expect(ids).not.toContain('JOB-C-PRIV-BANK-NOGRADE');
      expect(ids).not.toContain('JOB-D-GOVT-HEALTH-16');
    });

    it('9. Grade 16-20 filter returns Job D (Grade 16)', () => {
      const ids = getFilteredIds({ selectedGrades: ['16th-20th'] });
      expect(ids).toEqual(['JOB-D-GOVT-HEALTH-16']);
    });

    it('10. Non-Grade filter matches Job E and Private Salary-Based matches Job C', () => {
      const idsNonGrade = getFilteredIds({ selectedGrades: ['Non-Grade'] });
      expect(idsNonGrade).toContain('JOB-E-NGO-REMOTE-MASTERS');

      const idsPrivate = getFilteredIds({ selectedGrades: ['Private Salary-Based'] });
      expect(idsPrivate).toContain('JOB-C-PRIV-BANK-NOGRADE');
    });

    it('11. Grade filter NEVER matches private jobs even if a grade is queried', () => {
      expect(JobGradeExtractor.matchesGradeFilter(FIXTURE_JOB_C, ['10'])).toBe(false);
      expect(JobGradeExtractor.matchesGradeFilter(FIXTURE_JOB_C, ['11'])).toBe(false);
      expect(JobGradeExtractor.matchesGradeFilter(FIXTURE_JOB_C, ['1st-9th'])).toBe(false);
      expect(JobGradeExtractor.matchesGradeFilter(FIXTURE_JOB_C, ['10th-15th'])).toBe(false);
    });

    it('12. Location Rajshahi returns Job A and Job C', () => {
      const ids = getFilteredIds({ location: 'Rajshahi' });
      expect(ids).toContain('JOB-A-GOVT-HEALTH-11');
      expect(ids).toContain('JOB-C-PRIV-BANK-NOGRADE');
      expect(ids).not.toContain('JOB-B-GOVT-BANK-10');
      expect(ids).not.toContain('JOB-D-GOVT-HEALTH-16');
      expect(ids).not.toContain('JOB-E-NGO-REMOTE-MASTERS');
    });

    it('13. Work Mode Remote returns Job E only', () => {
      const ids = getFilteredIds({ workMode: 'Remote' });
      expect(ids).toEqual(['JOB-E-NGO-REMOTE-MASTERS']);
    });

    it('14. Work Mode On-Site returns Job A, B, C, D', () => {
      const ids = getFilteredIds({ workMode: 'On-Site' });
      expect(ids).toContain('JOB-A-GOVT-HEALTH-11');
      expect(ids).toContain('JOB-B-GOVT-BANK-10');
      expect(ids).toContain('JOB-C-PRIV-BANK-NOGRADE');
      expect(ids).toContain('JOB-D-GOVT-HEALTH-16');
      expect(ids).not.toContain('JOB-E-NGO-REMOTE-MASTERS');
    });

    it('15. Employer Type Central Bank returns Job B only', () => {
      const ids = getFilteredIds({ employerType: 'Central Bank' });
      expect(ids).toEqual(['JOB-B-GOVT-BANK-10']);
    });

    it('16. Employer Type Commercial Bank returns Job C only', () => {
      const ids = getFilteredIds({ employerType: 'Commercial Bank' });
      expect(ids).toEqual(['JOB-C-PRIV-BANK-NOGRADE']);
    });

    it('17. Employment Type Contractual returns Job D only', () => {
      const ids = getFilteredIds({ employmentType: 'Contractual' });
      expect(ids).toEqual(['JOB-D-GOVT-HEALTH-16']);
    });
  });

  // --------------------------------------------------------------------------
  // Multi-Select OR Logic within Dimensions & AND Logic Across Dimensions
  // --------------------------------------------------------------------------
  describe('Boolean Logic: OR within multi-select, AND across dimensions', () => {
    it('Multiple grades [10, 11] uses OR logic returning both Job A (11) and Job B (10)', () => {
      const ids = getFilteredIds({ selectedGrades: ['10', '11'] });
      expect(ids).toEqual(expect.arrayContaining(['JOB-A-GOVT-HEALTH-11', 'JOB-B-GOVT-BANK-10']));
      expect(ids.length).toBe(2);
    });

    it('Combining Government (AND) Grade 10 (AND) Honours returns ONLY Job B', () => {
      const ids = getFilteredIds({
        category: 'Government',
        selectedGrades: ['10'],
        education: 'Honours',
      });
      expect(ids).toEqual(['JOB-B-GOVT-BANK-10']);
    });

    it('Clear All resets all filters to default and returns all 5 fixtures', () => {
      const ids = getFilteredIds(DEFAULT_JOB_FILTERS);
      expect(ids.length).toBe(5);
    });
  });

  // --------------------------------------------------------------------------
  // Universal Taxonomy & Dynamic Count Verification
  // --------------------------------------------------------------------------
  describe('Taxonomy Architecture & Count Invariants', () => {
    it('Authoritative taxonomy count must be exactly 27 and derived dynamically', () => {
      const totalTaxonomy = JobTaxonomyRegistry.getAll().length;
      expect(totalTaxonomy).toBe(27);
    });

    it('Changing parent taxonomy category retrieves its valid matching subcategories', () => {
      const subsMedical = JobTaxonomyRegistry.getSubcategories('medical_healthcare');
      expect(subsMedical.length).toBeGreaterThan(0);
      const subIds = subsMedical.map((s) => s.id);
      expect(subIds).toContain('doctor');
      expect(subIds).toContain('nurse');

      const subsBanking = JobTaxonomyRegistry.getSubcategories('banking_finance');
      const bankingSubIds = subsBanking.map((s) => s.id);
      expect(bankingSubIds).toContain('central_bank');
      expect(bankingSubIds).toContain('private_bank');
      expect(bankingSubIds).toContain('public_bank');
      expect(bankingSubIds).not.toContain('doctor');
    });

    it('Multi-label secondary category matching works cleanly', () => {
      const ids = getFilteredIds({ taxonomyCategory: 'govt_public' });
      expect(ids).toContain('JOB-B-GOVT-BANK-10');
    });
  });

  // --------------------------------------------------------------------------
  // Canonical Source Health State Model Verification
  // --------------------------------------------------------------------------
  describe('Canonical Source Health State Model', () => {
    it('Partitions all sources into mutually exclusive states summing exactly to totalSources', () => {
      const mockAdapters: JobSourceAdapter[] = [
        { sourceId: 's1', sourceName: 'Source 1' } as any,
        { sourceId: 's2', sourceName: 'Source 2' } as any,
        { sourceId: 's3', sourceName: 'Source 3' } as any,
        { sourceId: 's4', sourceName: 'Source 4' } as any,
        { sourceId: 's5', sourceName: 'Source 5' } as any,
      ];

      const mockOutcomes = [
        { sourceId: 's1', status: 'SUCCESS', success: true },
        { sourceId: 's2', status: 'PARTIAL_SUCCESS', success: true },
        { sourceId: 's3', status: 'MANUAL_VERIFICATION_REQUIRED', blockedByCaptcha: true, success: false },
        { sourceId: 's4', status: 'TEMPORARILY_UNAVAILABLE', rateLimited: true, success: false },
      ];

      const summary = computeSourceHealthSummary(mockAdapters, mockOutcomes as any, Date.now());

      expect(summary.totalSources).toBe(5);
      expect(summary.successfulSources).toBe(1);
      expect(summary.partiallySuccessfulSources).toBe(1);
      expect(summary.manualVerificationSources).toBe(1);
      expect(summary.temporarilyUnavailableSources).toBe(1);
      expect(summary.notTestedSources).toBe(1);

      const partitionSum =
        summary.successfulSources +
        summary.partiallySuccessfulSources +
        summary.manualVerificationSources +
        summary.temporarilyUnavailableSources +
        summary.failedSources +
        summary.waitingSources +
        summary.notTestedSources;

      expect(partitionSum).toBe(summary.totalSources);
    });
  });
});
