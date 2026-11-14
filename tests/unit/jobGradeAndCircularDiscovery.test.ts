import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JobGradeExtractor, GRADE_LABELS } from '../../src/jobs/services/grade-extractor';
import { JobNormalizer } from '../../src/jobs/services/job-normalizer';
import { CircularDiagnosticEngine } from '../../src/jobs/services/circular-diagnostic';
import { filterAndSortJobs, DEFAULT_JOB_FILTERS } from '../../src/jobs/dashboard/JobFilters';
import { ArbeitnowAdapter, parseArbeitnowApiJson } from '../../src/jobs/sources/arbeitnow.adapter';
import { JobRepository } from '../../src/jobs/database/job-repository';
import {
  NormalizedJobCircular,
  RawJobData,
  JobSearchFilters,
} from '../../src/jobs/types/job.types';

describe('JobFill BD — Smart Grade Filter & Circular Discovery Engine Suite', () => {
  const sampleNow = 1731600000000; // Fixed timestamp for reproducible testing

  const createMockJob = (overrides: Partial<NormalizedJobCircular> = {}): NormalizedJobCircular => ({
    id: 'test-job-' + Math.random().toString(36).substring(2, 9),
    sourceId: 'teletalk',
    sourceName: 'Teletalk All Jobs',
    sourceVerification: 'official_verified',
    jobTitle: 'Assistant Commissioner (9th Grade)',
    position: 'Assistant Commissioner',
    organization: 'Ministry of Public Administration',
    category: 'government',
    qualification: 'Master degree',
    location: 'Dhaka',
    employmentType: 'Full Time',
    salary: '৳২২,০০০ - ৳৫৩,০৬০ (৯ম গ্রেড)',
    salaryMin: 22000,
    salaryMax: 53060,
    gradeNumber: 9,
    gradeLabel: '9th Grade (৯ম গ্রেড)',
    gradeOriginalText: '৯ম গ্রেড',
    gradeVerificationStatus: 'OFFICIAL_MATCH',
    minGpa: null,
    minCgpa: null,
    publishedAt: sampleNow - 86400000 * 2,
    publishedDateText: '2024-11-12',
    deadlineAt: sampleNow + 86400000 * 10,
    deadlineText: '2024-11-24',
    deadlineVerified: true,
    firstDiscoveredAt: sampleNow - 86400000 * 2,
    lastUpdatedAt: sampleNow,
    isArchived: false,
    status: 'active',
    circularUrl: 'http://mopa.teletalk.com.bd/circular.pdf',
    applicationUrl: 'http://mopa.teletalk.com.bd/apply.php',
    description: 'Recruitment for 9th Grade Cadre post under Ministry of Public Administration.',
    requirements: ['Master degree in any discipline'],
    ...overrides,
  });

  describe('Part 1: Government Pay Grade Extraction (1st to 20th Grade)', () => {
    it('1. Extracts grade accurately from Bengali numerals (৯ম গ্রেড, ১০ম গ্রেড, ১১তম গ্রেড, ২০তম গ্রেড)', () => {
      const g9 = JobGradeExtractor.extractJobGrade({
        title: 'সহকারী পরিচালক (৯ম গ্রেড)',
        category: 'government',
      });
      expect(g9.gradeNumber).toBe(9);
      expect(g9.gradeVerificationStatus).toBe('OFFICIAL_MATCH');
      expect(g9.gradeLabel).toContain('9th Grade');

      const g10 = JobGradeExtractor.extractJobGrade({
        title: 'উপ-সহকারী প্রকৌশলী (১০ম গ্রেড)',
        category: 'government',
      });
      expect(g10.gradeNumber).toBe(10);
      expect(g10.gradeVerificationStatus).toBe('OFFICIAL_MATCH');

      const g11 = JobGradeExtractor.extractJobGrade({
        title: 'অফিস সহকারী',
        description: 'বেতন স্কেল ১২,৫০০-৩০,২৩০ টাকা (১১তম গ্রেড)',
        category: 'government',
      });
      expect(g11.gradeNumber).toBe(11);
      expect(g11.gradeVerificationStatus).toBe('OFFICIAL_MATCH');

      const g20 = JobGradeExtractor.extractJobGrade({
        title: 'অফিস সহায়ক (২০তম গ্রেড)',
        category: 'government',
      });
      expect(g20.gradeNumber).toBe(20);
      expect(g20.gradeVerificationStatus).toBe('OFFICIAL_MATCH');
    });

    it('2. Extracts grade from Bengali word forms (নবম গ্রেড, দশম গ্রেড, প্রথম শ্রেণি, দ্বিতীয় শ্রেণী)', () => {
      const gNobom = JobGradeExtractor.extractJobGrade({
        title: 'সহকারী ব্যবস্থাপক (নবম গ্রেড)',
        category: 'government',
      });
      expect(gNobom.gradeNumber).toBe(9);

      const gDoshom = JobGradeExtractor.extractJobGrade({
        title: 'সহকারী রাজস্ব কর্মকর্তা (দশম গ্রেড)',
        category: 'government',
      });
      expect(gDoshom.gradeNumber).toBe(10);

      const gClass1 = JobGradeExtractor.extractJobGrade({
        title: 'প্রভাষক (প্রথম শ্রেণী গেজেটেড কর্মকর্তা)',
        category: 'government',
      });
      expect(gClass1.gradeNumber).toBe(9);

      const gClass2 = JobGradeExtractor.extractJobGrade({
        title: 'উপ-পরিদর্শক (দ্বিতীয় শ্রেণী নন-গেজেটেড)',
        category: 'government',
      });
      expect(gClass2.gradeNumber).toBe(10);
    });

    it('3. Extracts grade from English numerals and ordinals (9th Grade, Grade-9, Grade 10, 1st Grade, 20th Grade)', () => {
      const e9 = JobGradeExtractor.extractJobGrade({
        title: 'Assistant Director (Grade-9)',
        category: 'government',
      });
      expect(e9.gradeNumber).toBe(9);

      const e10 = JobGradeExtractor.extractJobGrade({
        title: 'Sub-Assistant Engineer (10th Grade)',
        category: 'government',
      });
      expect(e10.gradeNumber).toBe(10);

      const e1 = JobGradeExtractor.extractJobGrade({
        title: 'Senior Secretary (1st Grade)',
        category: 'government',
      });
      expect(e1.gradeNumber).toBe(1);

      const e20 = JobGradeExtractor.extractJobGrade({
        title: 'Office Support Staff (Grade 20)',
        category: 'government',
      });
      expect(e20.gradeNumber).toBe(20);
    });

    it('4. Detects Sub-Registrar / BCS Cadre and sets 9th Grade verified', () => {
      const subRegBn = JobGradeExtractor.extractJobGrade({
        title: 'সাব-রেজিস্ট্রার নিয়োগ বিজ্ঞপ্তি ২০২৪',
        organization: 'নিবন্ধন অধিদপ্তর, আইন মন্ত্রণালয়',
        category: 'government',
      });
      expect(subRegBn.gradeNumber).toBe(9);
      expect(subRegBn.gradeVerificationStatus).toBe('OFFICIAL_MATCH');
      expect(subRegBn.gradeLabel).toBe('9th Grade (৯ম গ্রেড)');

      const subRegEn = JobGradeExtractor.extractJobGrade({
        title: 'Sub-Registrar Recruitment Notice',
        organization: 'Law and Justice Division',
        category: 'government',
      });
      expect(subRegEn.gradeNumber).toBe(9);
      expect(subRegEn.gradeVerificationStatus).toBe('OFFICIAL_MATCH');
    });

    it('5. Strictly preserves invariant: Never assigns government pay grade to private jobs', () => {
      const privateJob = JobGradeExtractor.extractJobGrade({
        title: 'Senior Software Engineer (Salary Grade 9 equivalent: 50k)',
        category: 'private',
        salaryText: '50,000 BDT',
      });
      expect(privateJob.gradeNumber).toBeNull();
      expect(privateJob.gradeVerificationStatus).toBe('NOT_APPLICABLE');
      expect(privateJob.gradeLabel).toBe('Private Salary-Based');
    });

    it('6. Correctly identifies Contractual and Non-Grade positions', () => {
      const contractualJob = JobGradeExtractor.extractJobGrade({
        title: 'Project Coordinator (Contractual basis)',
        category: 'government',
      });
      expect(contractualJob.gradeNumber).toBeNull();
      expect(contractualJob.gradeVerificationStatus).toBe('NOT_APPLICABLE');
      expect(contractualJob.gradeLabel).toBe('Contractual');

      const nonGradeJob = JobGradeExtractor.extractJobGrade({
        title: 'Adviser (Non-grade position)',
        category: 'government',
      });
      expect(nonGradeJob.gradeNumber).toBeNull();
      expect(nonGradeJob.gradeVerificationStatus).toBe('NOT_APPLICABLE');
      expect(nonGradeJob.gradeLabel).toBe('Non-Grade');
    });

    it('7. When grade is missing from government circular, returns NOT_SPECIFIED and null gradeNumber', () => {
      const unspec = JobGradeExtractor.extractJobGrade({
        title: 'Administrative Officer',
        organization: 'Dhaka City Corporation',
        category: 'government',
        description: 'Details available on notice board.',
      });
      expect(unspec.gradeNumber).toBeNull();
      expect(unspec.gradeVerificationStatus).toBe('NOT_SPECIFIED');
      expect(unspec.gradeLabel).toBe('Grade Not Specified');
    });

    it('8. Supports range matching (1st-9th, 10th-15th, 16th-20th) and multi-grade selection in matchesGradeFilter', () => {
      const g9Job = createMockJob({ gradeNumber: 9 });
      const g12Job = createMockJob({ gradeNumber: 12 });
      const g19Job = createMockJob({ gradeNumber: 19 });
      const unspecJob = createMockJob({ gradeNumber: null, gradeVerificationStatus: 'NOT_SPECIFIED' });

      // Range: 1st-9th
      expect(JobGradeExtractor.matchesGradeFilter(g9Job, ['1st-9th'])).toBe(true);
      expect(JobGradeExtractor.matchesGradeFilter(g12Job, ['1st-9th'])).toBe(false);

      // Range: 10th-15th
      expect(JobGradeExtractor.matchesGradeFilter(g12Job, ['10th-15th'])).toBe(true);
      expect(JobGradeExtractor.matchesGradeFilter(g9Job, ['10th-15th'])).toBe(false);

      // Range: 16th-20th
      expect(JobGradeExtractor.matchesGradeFilter(g19Job, ['16th-20th'])).toBe(true);
      expect(JobGradeExtractor.matchesGradeFilter(g9Job, ['16th-20th'])).toBe(false);

      // Multi-select individual grades: 9 and 10
      expect(JobGradeExtractor.matchesGradeFilter(g9Job, ['9', '10'])).toBe(true);
      expect(JobGradeExtractor.matchesGradeFilter(g12Job, ['9', '10'])).toBe(false);

      // Special Category: Not Specified
      expect(JobGradeExtractor.matchesGradeFilter(unspecJob, ['Not Specified'])).toBe(true);
      expect(JobGradeExtractor.matchesGradeFilter(g9Job, ['Not Specified'])).toBe(false);
    });
  });

  describe('Part 2: Job Normalization with Grade, Salary Ranges & GPA', () => {
    it('Normalizes raw circular with grade, salary numbers, and minimum GPA correctly', () => {
      const raw: RawJobData = {
        title: 'সহকারী পরিচালক (৯ম গ্রেড)',
        organization: 'বাংলাদেশ সরকারি কর্ম কমিশন (BPSC)',
        sourceId: 'bpsc',
        sourceName: 'BPSC Official',
        sourceVerification: 'official_verified',
        url: 'http://bpsc.teletalk.com.bd/apply.php',
        category: 'government',
        location: 'Dhaka',
        salary: '৳২২,০০০ - ৳৫৩,০৬০',
        qualification: 'স্নাতকোত্তর বা ৪ বছর মেয়াদি স্নাতক (নূন্যতম সিজিপিএ ২.৭৫)',
        deadline: '2025-01-15',
        description: 'BPSC recruitment for 9th grade assistant director.',
      };

      const normalized = JobNormalizer.normalize(raw, sampleNow);

      expect(normalized.gradeNumber).toBe(9);
      expect(normalized.gradeLabel).toBe('9th Grade (৯ম গ্রেড)');
      expect(normalized.salaryMin).toBe(22000);
      expect(normalized.salaryMax).toBe(53060);
      expect(normalized.minGpa).toBe(2.75);
      expect(normalized.minCgpa).toBe(2.75);
      expect(normalized.sourceVerification).toBe('official_verified');
    });
  });

  describe('Part 3: Missing Job Circular Diagnostic Engine', () => {
    it('Diagnoses circular already in DB and visible under current filters -> IN_DATABASE_SHOWN', () => {
      const job = createMockJob({
        id: 'job-mopa-1',
        position: 'Assistant Commissioner',
        circularUrl: 'http://mopa.teletalk.com.bd/circular1.pdf',
      });
      const filters = { ...DEFAULT_JOB_FILTERS };

      const report = CircularDiagnosticEngine.diagnoseMissingCircular({
        inputQueryOrUrl: 'http://mopa.teletalk.com.bd/circular1.pdf',
        allJobs: [job],
        activeFilters: filters,
        now: sampleNow,
      });

      expect(report.diagnosisCode).toBe('IN_DATABASE_SHOWN');
      expect(report.matchingJob?.id).toBe('job-mopa-1');
      expect(report.actionType).toBe('view_now');
    });

    it('Diagnoses circular in DB but hidden by active filters (e.g. category Bank vs government) -> IN_DATABASE_HIDDEN_BY_FILTERS', () => {
      const job = createMockJob({
        id: 'job-mopa-2',
        position: 'Assistant Director',
        category: 'government',
      });
      const filters: JobSearchFilters = {
        ...DEFAULT_JOB_FILTERS,
        category: 'Bank', // Actively occluding government job
      };

      const report = CircularDiagnosticEngine.diagnoseMissingCircular({
        inputQueryOrUrl: 'Assistant Director',
        allJobs: [job],
        activeFilters: filters,
        now: sampleNow,
      });

      expect(report.diagnosisCode).toBe('IN_DATABASE_HIDDEN_BY_FILTERS');
      expect(report.matchingJob?.id).toBe('job-mopa-2');
      expect(report.actionType).toBe('clear_filters');
      expect(report.conflictingFilters).toContain('category');
    });

    it('Diagnoses circular in DB but expired -> IN_DATABASE_EXPIRED', () => {
      const expiredJob = createMockJob({
        id: 'job-expired-1',
        position: 'Officer General (Expired)',
        deadlineAt: sampleNow - 86400000 * 5,
        deadlineVerified: true,
        status: 'expired',
      });
      const filters = { ...DEFAULT_JOB_FILTERS, statFilter: 'total' };

      const report = CircularDiagnosticEngine.diagnoseMissingCircular({
        inputQueryOrUrl: 'Officer General',
        allJobs: [expiredJob],
        activeFilters: filters,
        now: sampleNow,
      });

      expect(report.diagnosisCode).toBe('IN_DATABASE_EXPIRED');
      expect(report.actionType).toBe('view_expired');
    });

    it('Diagnoses supported official source pending fetch -> SUPPORTED_SOURCE_PENDING_FETCH', () => {
      const report = CircularDiagnosticEngine.diagnoseMissingCircular({
        inputQueryOrUrl: 'http://dpe.teletalk.com.bd/circular.php',
        allJobs: [],
        activeFilters: DEFAULT_JOB_FILTERS,
        now: sampleNow,
      });

      expect(report.diagnosisCode).toBe('SUPPORTED_SOURCE_PENDING_FETCH');
      expect(report.actionType).toBe('fetch_latest');
    });

    it('Diagnoses unsupported or restricted third-party portal -> UNSUPPORTED_PORTAL', () => {
      const report = CircularDiagnosticEngine.diagnoseMissingCircular({
        inputQueryOrUrl: 'https://some-unsupported-random-site.com/job/1234',
        allJobs: [],
        activeFilters: DEFAULT_JOB_FILTERS,
        now: sampleNow,
      });

      expect(report.diagnosisCode).toBe('UNSUPPORTED_PORTAL');
      expect(report.actionType).toBe('add_manually');
    });
  });

  describe('Part 4: Arbeitnow Multi-Page Pagination Support', () => {
    it('Parses JSON response into RawSourceJobItems cleanly', () => {
      const parsedItems = parseArbeitnowApiJson(
        JSON.stringify({
          data: [
            {
              slug: 'job-1',
              title: 'Remote Engineer',
              company_name: 'Tech Co',
              remote: true,
              url: 'https://arbeitnow.com/job-1',
              location: 'Remote',
              created_at: 1731500000,
            },
            {
              slug: 'job-non-remote',
              title: 'Onsite Guard',
              company_name: 'Office Co',
              remote: false,
              url: 'https://arbeitnow.com/job-2',
            },
          ],
        }),
        25
      );

      expect(parsedItems).toHaveLength(1);
      expect(parsedItems[0].jobTitle).toBe('Remote Engineer (Remote - Arbeitnow)');
      expect(parsedItems[0].position).toBe('Remote Engineer');
    });
  });

  describe('Part 5: JobFilters Integration & Invariants', () => {
    it('1. Status tab "all" includes both active and expired circulars so user never loses sight of circulars', () => {
      const activeJob = createMockJob({
        id: 'active-1',
        deadlineAt: sampleNow + 86400000 * 5,
        status: 'active',
      });
      const expiredJob = createMockJob({
        id: 'expired-1',
        deadlineAt: sampleNow - 86400000 * 5,
        status: 'expired',
      });

      const filtersAll: JobSearchFilters = {
        ...DEFAULT_JOB_FILTERS,
        statusTab: 'all',
      };

      const result = filterAndSortJobs([activeJob, expiredJob], filtersAll, new Set(), sampleNow);
      expect(result).toHaveLength(2);
      expect(result.map((j) => j.id)).toContain('active-1');
      expect(result.map((j) => j.id)).toContain('expired-1');
    });

    it('2. Status tab "expired" displays only expired circulars', () => {
      const activeJob = createMockJob({
        id: 'active-1',
        deadlineAt: sampleNow + 86400000 * 5,
        status: 'active',
      });
      const expiredJob = createMockJob({
        id: 'expired-1',
        deadlineAt: sampleNow - 86400000 * 5,
        status: 'expired',
      });

      const filtersExpired: JobSearchFilters = {
        ...DEFAULT_JOB_FILTERS,
        statusTab: 'expired',
      };

      const result = filterAndSortJobs([activeJob, expiredJob], filtersExpired, new Set(), sampleNow);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('expired-1');
    });

    it('3. Academic GPA Filter checks applicant eligibility against job requirement', () => {
      const jobRequires3_0 = createMockJob({
        id: 'j1',
        minGpa: 3.0,
        minCgpa: 3.0,
      });
      const jobRequires2_5 = createMockJob({
        id: 'j2',
        minGpa: 2.5,
        minCgpa: 2.5,
      });
      const jobNoGpa = createMockJob({
        id: 'j3',
        minGpa: null,
        minCgpa: null,
      });

      // User with GPA 2.5: eligible for j2 (requires <= 2.5) and j3 (no GPA specified), but NOT j1 (requires 3.0)
      const userGpa2_5Filters: JobSearchFilters = {
        ...DEFAULT_JOB_FILTERS,
        minGpa: 2.5,
      };

      const results = filterAndSortJobs([jobRequires3_0, jobRequires2_5, jobNoGpa], userGpa2_5Filters, new Set(), sampleNow);
      expect(results.map((j) => j.id)).toEqual(['j2', 'j3']);
    });

    it('4. Salary Range Filter matches jobs within min and max boundaries', () => {
      const job22k = createMockJob({ id: 'j22k', salaryMin: 22000, salaryMax: 53060 });
      const job16k = createMockJob({ id: 'j16k', salaryMin: 16000, salaryMax: 38640 });
      const job50k = createMockJob({ id: 'j50k', salaryMin: 50000, salaryMax: 71200 });

      // Minimum salary 20,000 BDT
      const min20kFilters: JobSearchFilters = {
        ...DEFAULT_JOB_FILTERS,
        minSalary: 20000,
      };

      const results = filterAndSortJobs([job22k, job16k, job50k], min20kFilters, new Set(), sampleNow);
      expect(results.map((j) => j.id)).toContain('j22k');
      expect(results.map((j) => j.id)).toContain('j50k');
      expect(results.map((j) => j.id)).not.toContain('j16k');
    });
  });
});
