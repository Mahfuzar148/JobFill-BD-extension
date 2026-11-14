import { describe, it, expect, vi } from 'vitest';
import {
  JobTaxonomyRegistry,
  UNIVERSAL_JOB_TAXONOMY,
} from '../../src/jobs/taxonomy/job-taxonomy';
import { JobTaxonomyClassifier } from '../../src/jobs/services/taxonomy-classifier';
import {
  filterAndSortJobs,
  DEFAULT_JOB_FILTERS,
} from '../../src/jobs/dashboard/JobFilters';
import {
  FederatedSearchOrchestrator,
  FederatedSearchResultReport,
} from '../../src/jobs/services/federated-search-orchestrator';
import { JobSourceRegistry } from '../../src/jobs/sources/source-registry';
import { JobRepository } from '../../src/jobs/database/job-repository';
import { NormalizedJobCircular, JobSearchFilters } from '../../src/jobs/types/job.types';
import { JobSourceAdapter } from '../../src/jobs/types/source.types';

function createMockCircular(overrides: Partial<NormalizedJobCircular> = {}): NormalizedJobCircular {
  const base: NormalizedJobCircular = {
    id: `test-job-${Math.random().toString(36).slice(2, 9)}`,
    sourceId: 'bpsc',
    sourceName: 'BPSC',
    sourceType: 'GOVERNMENT',
    jobTitle: 'Assistant Director (৯ম গ্রেড)',
    position: 'Assistant Director',
    organization: 'Bangladesh Public Service Commission',
    organizationBn: 'বাংলাদেশ সরকারি কর্ম কমিশন',
    category: 'Government',
    employmentType: 'Full Time',
    location: 'Dhaka',
    publishedAt: Date.now() - 86400000,
    deadlineAt: Date.now() + 864000000,
    deadlineVerified: true,
    firstDiscoveredAt: Date.now() - 86400000,
    lastUpdatedAt: Date.now() - 86400000,
    status: 'active',
    provenance: {
      fieldSources: { jobTitle: 'source_feed', deadlineAt: 'regex_extracted' },
      lastVerifiedAt: Date.now(),
      verificationMethod: 'AUTOMATIC_ADAPTER',
    },
    ...overrides,
  };
  return JobTaxonomyClassifier.enrichJobWithTaxonomy(base);
}

describe('Universal Job Category Taxonomy (20 Main Categories A-T)', () => {
  it('should define all 20 standardized main categories from A to T', () => {
    const categories = JobTaxonomyRegistry.getAll();
    expect(categories.length).toBe(20);

    const codes = categories.map((c) => c.code || c.letter);
    expect(codes).toEqual([
      'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J',
      'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T'
    ]);

    // Check specific critical categories
    expect(JobTaxonomyRegistry.getById('gov_public')).toBeDefined();
    expect(JobTaxonomyRegistry.getById('bank_finance')).toBeDefined();
    expect(JobTaxonomyRegistry.getById('education_research')).toBeDefined();
    expect(JobTaxonomyRegistry.getById('medical_healthcare')).toBeDefined();
    expect(JobTaxonomyRegistry.getById('engineering')).toBeDefined();
    expect(JobTaxonomyRegistry.getById('it_digital')).toBeDefined();
    expect(JobTaxonomyRegistry.getById('other_unclassified')).toBeDefined();
  });

  it('should have bilingual titles and subcategories for each category', () => {
    const itCat = JobTaxonomyRegistry.getById('it_digital');
    expect(itCat).toBeDefined();
    expect(itCat!.labelEn).toContain('IT & Digital Technology');
    expect(itCat!.labelBn).toContain('তথ্যপ্রযুক্তি');
    expect(itCat!.subcategories.length).toBeGreaterThan(5);

    const subIds = itCat!.subcategories.map((s) => s.id);
    expect(subIds).toContain('software_dev');
    expect(subIds).toContain('cybersecurity');
    expect(subIds).toContain('cloud_devops');
  });

  it('should retrieve subcategories correctly with helper methods', () => {
    const subs = JobTaxonomyRegistry.getSubcategories('bank_finance');
    expect(subs.length).toBeGreaterThan(0);
    const centralBankSub = JobTaxonomyRegistry.getSubcategoryById('bank_finance', 'central_bank');
    expect(centralBankSub).toBeDefined();
    expect(centralBankSub?.labelEn).toContain('Central Bank');
    expect(centralBankSub?.labelBn).toContain('বাংলাদেশ ব্যাংক');
  });
});

describe('Deterministic Rules-Based Taxonomy Classifier', () => {
  it('should accurately classify a Bangladesh Bank circular into Banking & Finance', () => {
    const result = JobTaxonomyClassifier.classify({
      organization: 'Bangladesh Bank',
      position: 'Assistant Director (General)',
      jobTitle: 'Assistant Director (General) - 9th Grade',
    });

    expect(result.taxonomyCategoryId).toBe('bank_finance');
    expect(result.taxonomyCategoryNameEn).toContain('Banking & Finance');
    expect(result.taxonomySubcategoryId).toBe('central_bank');
    expect(result.employerType).toBe('Bank');
    expect(result.industry).toContain('Financial Services');
    expect(result.classificationConfidence).toBeGreaterThanOrEqual(75);
    expect(result.isUnclassified).toBe(false);
  });

  it('should accurately classify a BPSC Civil Service circular into Government & Public Sector', () => {
    const result = JobTaxonomyClassifier.classify({
      organization: 'Bangladesh Public Service Commission (BPSC)',
      organizationBn: 'বাংলাদেশ সরকারি কর্ম কমিশন',
      position: 'Assistant Commissioner (Administration) - 47th BCS',
      jobTitle: '৪৭তম বিসিএস প্রশাসন ক্যাডার',
    });

    expect(result.taxonomyCategoryId).toBe('gov_public');
    expect(result.taxonomySubcategoryId).toBe('bcs_civil');
    expect(result.employerType).toBe('Government');
    expect(result.workMode).toBe('On-Site');
    expect(result.isUnclassified).toBe(false);
  });

  it('should detect Remote work mode, experience level, and software development for tech jobs', () => {
    const result = JobTaxonomyClassifier.classify({
      organization: 'Vercel / Next.js Global Engineering',
      position: 'Senior Full Stack Software Engineer (100% Remote / WFH)',
      jobTitle: 'Senior Full Stack Software Engineer',
      description: 'We are hiring a Senior Software Engineer with 6+ years experience in TypeScript, React, and Go. Work from home / anywhere.',
    });

    expect(result.taxonomyCategoryId).toBe('it_digital');
    expect(result.taxonomySubcategoryId).toBe('software_dev');
    expect(result.workMode).toBe('Remote');
    expect(result.experienceLevel).toBe('5+ Years');
    expect(result.isUnclassified).toBe(false);
  });

  it('should accurately classify Nursing and Healthcare circulars', () => {
    const result = JobTaxonomyClassifier.classify({
      organization: 'Dhaka Medical College Hospital',
      organizationBn: 'ঢাকা মেডিকেল কলেজ হাসপাতাল',
      position: 'Senior Staff Nurse (১০ম গ্রেড)',
      jobTitle: 'সিনিয়র স্টাফ নার্স নিয়োগ বিজ্ঞপ্তি',
    });

    expect(result.taxonomyCategoryId).toBe('medical_healthcare');
    expect(result.taxonomySubcategoryId).toBe('nurse_midwife');
    expect(result.industry).toContain('Healthcare');
  });

  it('should safely fall back to other_unclassified without dropping unknown jobs', () => {
    const result = JobTaxonomyClassifier.classify({
      organization: 'XYZ Random Enigma Co.',
      position: 'Special Operative',
      jobTitle: 'Special Task Operative',
      description: 'Confidential assignments requiring versatile individuals.',
    });

    expect(result.taxonomyCategoryId).toBe('other_unclassified');
    expect(result.classificationConfidence).toBeLessThan(50);
    expect(result.isUnclassified).toBe(true);
  });
});

describe('Multi-Dimensional Filtering & Decoupling', () => {
  const jobGov = createMockCircular({
    id: 'job-gov-1',
    jobTitle: 'সহকারী সচিব (৯ম গ্রেড)',
    position: 'Assistant Secretary',
    organization: 'Ministry of Public Administration',
    category: 'Government',
    gradeNumber: 9,
    minGpa: 3.0,
    location: 'Dhaka',
  });

  const jobBank = createMockCircular({
    id: 'job-bank-1',
    jobTitle: 'Senior Officer',
    position: 'Senior Officer',
    organization: 'Sonali Bank PLC',
    category: 'Bank',
    location: 'Dhaka',
  });

  const jobRemoteDev = createMockCircular({
    id: 'job-dev-1',
    jobTitle: 'Remote Frontend Developer',
    position: 'Frontend Developer',
    organization: 'Tech Innovations Ltd',
    category: 'IT / Technology',
    location: 'All Bangladesh',
    description: 'Work from home remote position.',
  });

  const jobUnclassified = createMockCircular({
    id: 'job-unclass-1',
    jobTitle: 'Coordinator',
    position: 'Coordinator',
    organization: 'Unknown Trust Organization',
    category: 'Other',
    description: 'General miscellaneous tasks.',
  });

  const allJobs = [jobGov, jobBank, jobRemoteDev, jobUnclassified];

  it('should filter purely by taxonomy category while preserving unclassified jobs if includeUnclassified is true', () => {
    const filters: JobSearchFilters = {
      ...DEFAULT_JOB_FILTERS,
      taxonomyCategory: 'gov_public',
      includeUnclassified: true,
    };

    const results = filterAndSortJobs(allJobs, filters, new Set());
    const ids = results.map((j) => j.id);
    expect(ids).toContain('job-gov-1');
    expect(ids).toContain('job-unclass-1'); // Unclassified retained so no circular is dropped
    expect(ids).not.toContain('job-bank-1');
    expect(ids).not.toContain('job-dev-1');
  });

  it('should exclude unclassified jobs when includeUnclassified is explicitly false', () => {
    const filters: JobSearchFilters = {
      ...DEFAULT_JOB_FILTERS,
      taxonomyCategory: 'gov_public',
      includeUnclassified: false,
    };

    const results = filterAndSortJobs(allJobs, filters, new Set());
    const ids = results.map((j) => j.id);
    expect(ids).toContain('job-gov-1');
    expect(ids).not.toContain('job-unclass-1');
  });

  it('should filter cleanly by Work Mode orthogonal to Category', () => {
    const filters: JobSearchFilters = {
      ...DEFAULT_JOB_FILTERS,
      workMode: 'Remote',
    };

    const results = filterAndSortJobs(allJobs, filters, new Set());
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('job-dev-1');
    expect(results[0].workMode).toBe('Remote');
  });

  it('should combine Government Pay Grade, Category, and GPA eligibility filters', () => {
    const filters: JobSearchFilters = {
      ...DEFAULT_JOB_FILTERS,
      taxonomyCategory: 'gov_public',
      selectedGrades: ['9'],
      minGpa: 3.5, // Applicant has 3.5 GPA, job requires 3.0 -> eligible!
    };

    const results = filterAndSortJobs(allJobs, filters, new Set());
    const ids = results.map((j) => j.id);
    expect(ids).toContain('job-gov-1');
  });

  it('should disqualify when applicant GPA is lower than required minimum GPA', () => {
    const filters: JobSearchFilters = {
      ...DEFAULT_JOB_FILTERS,
      taxonomyCategory: 'gov_public',
      minGpa: 2.5, // Applicant has 2.5 GPA, but job requires 3.0 -> disqualified
    };

    const results = filterAndSortJobs(allJobs, filters, new Set());
    const ids = results.map((j) => j.id);
    expect(ids).not.toContain('job-gov-1');
  });
});

describe('Federated Online Search Orchestrator', () => {
  it('should build a bilingual search plan with category and subcategory expansions', () => {
    const plan = FederatedSearchOrchestrator.buildSearchPlan({
      ...DEFAULT_JOB_FILTERS,
      query: 'Assistant Director',
      taxonomyCategory: 'gov_public',
      taxonomySubcategory: 'bcs_civil',
    });

    expect(plan.primaryQuery.toLowerCase()).toBe('assistant director');
    expect(plan.targetCategoryNameEn).toBe('Government & Public Sector');
    expect(plan.targetCategoryNameBn).toBe('সরকারি ও স্বায়ত্তশাসিত চাকরি');
    expect(plan.expandedTerms).toContain('assistant director');
    expect(plan.expandedTerms.some((t) => t.includes('bcs') || t.includes('বিসিএস'))).toBe(true);
  });

  it('should execute live federated search and return a transparent coverage report', async () => {
    const mockAdapter: JobSourceAdapter = {
      sourceId: 'mock_test_source',
      sourceName: 'Mock Test Portal',
      sourceType: 'official_portal',
      officialDomain: 'mock.gov.bd',
      isOfficial: true,
      fetchJobs: vi.fn().mockResolvedValue({
        sourceId: 'mock_test_source',
        sourceName: 'Mock Test Portal',
        compatibilityStatus: 'supported',
        connectionStatus: 'Working',
        status: 'SUCCESS',
        success: true,
        jobs: [
          createMockCircular({ id: 'live-fetched-1', jobTitle: 'Senior Officer' }),
        ],
        checkedAt: Date.now(),
        accessNotes: 'Mocked for fast deterministic testing',
        directPortalUrl: 'https://mock.gov.bd',
      }),
    };

    const getAllSpy = vi.spyOn(JobSourceRegistry, 'getAll').mockReturnValue([mockAdapter]);
    const saveJobsSpy = vi.spyOn(JobRepository, 'saveJobs').mockResolvedValue({
      saved: [createMockCircular({ id: 'live-fetched-1' })],
      duplicatesMerged: 0,
      preservedUnchanged: 0,
      validationFailed: 0,
    });
    const indexSpy = vi.spyOn(JobRepository, 'ensureSearchIndexCurrent').mockResolvedValue(new Map());

    const report: FederatedSearchResultReport = await FederatedSearchOrchestrator.executeFederatedSearch({
      filters: {
        ...DEFAULT_JOB_FILTERS,
        query: 'Officer',
      },
    });

    expect(report.configuredSourcesCount).toBe(1);
    expect(report.attemptedSourcesCount).toBe(1);
    expect(report.successfulSourcesCount).toBe(1);
    expect(typeof report.pagesFetchedTotal).toBe('number');
    expect(report.sourceOutcomes.length).toBe(1);
    expect(report.sourceOutcomes[0].status).toBe('SUCCESS');

    getAllSpy.mockRestore();
    saveJobsSpy.mockRestore();
    indexSpy.mockRestore();
  });
});

describe('3 Search Modes Behavior', () => {
  const job1 = createMockCircular({ id: 'j1', jobTitle: 'Civil Engineer', organization: 'Public Works Department', category: 'Government' });
  const job2 = createMockCircular({ id: 'j2', jobTitle: 'Software Engineer', organization: 'Tech Soft Corp', category: 'IT / Technology' });
  const job3 = createMockCircular({ id: 'j3', jobTitle: 'Accountant', organization: 'Sonali Bank', category: 'Bank' });
  const jobs = [job1, job2, job3];
  const bookmarkedIds = new Set(['j2']);

  it('Mode 1: All Categories should search across all categories without restricting to bookmarks', () => {
    const filters: JobSearchFilters = {
      ...DEFAULT_JOB_FILTERS,
      searchMode: 'all_categories',
      bookmarkedOnly: false,
    };

    const results = filterAndSortJobs(jobs, filters, bookmarkedIds);
    expect(results.length).toBe(3);
  });

  it('Mode 2: Smart Filter Search should enforce specific category and attributes', () => {
    const filters: JobSearchFilters = {
      ...DEFAULT_JOB_FILTERS,
      searchMode: 'smart_filter',
      taxonomyCategory: 'it_digital',
      includeUnclassified: false,
    };

    const results = filterAndSortJobs(jobs, filters, bookmarkedIds);
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('j2');
  });

  it('Mode 3: Saved Jobs Offline should only show saved/bookmarked circulars', () => {
    const filters: JobSearchFilters = {
      ...DEFAULT_JOB_FILTERS,
      searchMode: 'saved_jobs',
      bookmarkedOnly: true,
    };

    const results = filterAndSortJobs(jobs, filters, bookmarkedIds);
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('j2');
  });
});
