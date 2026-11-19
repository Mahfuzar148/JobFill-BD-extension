// JobFill BD - Bdjobs Source Integration & Source Filter Test Suite
// Verifies:
// 1. Read-only Source Audit & Authorized Data Access (no unofficial scraping, zero-paid-token policy)
// 2. BdjobsSourceAdapter normalization into existing job schema
// 3. Category integration into Universal 27-Category Job Taxonomy (with unclassified fallback)
// 4. Strict deduplication (distinct JP_IDs never merged on title alone; attribution preserved)
// 5. Source Group Filtering ('bdjobs', 'government_portals', 'teletalk', 'bank_recruitment', 'ngo_ingo', 'private_company', 'international_jobs', 'All')
// 6. UI link rendering, safe new-tab opening, and external search URL builder
// 7. Source health state reporting (SUCCESS, PARTIAL, FAILED, BLOCKED, TEMPORARILY_UNAVAILABLE)
// 8. Release package integrity protection (Edge & Chrome ZIP SHA-256 hashes untouched)

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import {
  BdjobsAdapter,
  parseBdjobsStaticJson,
  buildBdjobsSearchUrl,
  inferBdjobsCategory,
  BDJOBS_GOVT_JSON_URL,
  BDJOBS_HOME_URL,
  BDJOBS_COVERAGE_DISCLOSURE,
  BDJOBS_DEADLINE_DISCLOSURE,
  BDJOBS_COMMUNITY_EVALUATION,
} from '../../src/jobs/sources/bdjobs/bdjobs.adapter';
import {
  JobSearchFilters,
  NormalizedJobCircular,
  JobSourceFilterGroup,
} from '../../src/jobs/types/job.types';
import {
  isJobMatchingSourceGroup,
  filterAndSortJobs,
  DEFAULT_JOB_FILTERS,
  SOURCE_FILTER_GROUPS,
} from '../../src/jobs/dashboard/JobFilters';
import { JobTaxonomyClassifier } from '../../src/jobs/services/taxonomy-classifier';
import { computeDuplicateMatchConfidence } from '../../src/jobs/services/job-deduplicator';
import { verifyJobUrl } from '../../src/jobs/services/source-verifier';
import * as jobFetcher from '../../src/jobs/services/job-fetcher';

const FAKE_NOW = 1773792000000; // Fixed deterministic timestamp

describe('JobFill BD — Bdjobs.com Job Source Integration Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // GROUP 1: Read-Only Source Audit & Authorized Data Access (Phase 1 & 2)
  // =========================================================================
  describe('1. Read-Only Source Audit & Compliance Policies', () => {
    it('should have BdjobsAdapter configured with compliant read-only public parameters', () => {
      expect(BdjobsAdapter.sourceId).toBe('bdjobs');
      expect(BdjobsAdapter.sourceName).toBe('Bdjobs');
      expect(BdjobsAdapter.sourceType).toBe('job_board');
      expect(BdjobsAdapter.officialDomain).toBe('bdjobs.com');
      expect(BdjobsAdapter.verificationLevel).toBe('official_partial');
      expect(BdjobsAdapter.compatibilityStatus).toBe('partially_supported');
      expect(BdjobsAdapter.directSourceUrl).toBe(BDJOBS_HOME_URL);
      expect(BdjobsAdapter.complianceNotes).toContain('robots.txt');
    });

    it('should document that third-party scrapers (Apify actors) are intentionally disabled', () => {
      expect(BDJOBS_COMMUNITY_EVALUATION.officialPublicApiAvailable).toBe(false);
      expect(BDJOBS_COMMUNITY_EVALUATION.officialRssAvailable).toBe(false);
      expect(BDJOBS_COMMUNITY_EVALUATION.evaluatedThirdPartyServices.length).toBeGreaterThanOrEqual(2);

      const apify1 = BDJOBS_COMMUNITY_EVALUATION.evaluatedThirdPartyServices.find(
        (s) => s.name === 'hipersoft/bdjobs-scraper'
      );
      expect(apify1).toBeDefined();
      expect(apify1?.activated).toBe(false);

      const apify2 = BDJOBS_COMMUNITY_EVALUATION.evaluatedThirdPartyServices.find(
        (s) => s.name === 'steadyscrape/bdjobs-jobs-scraper'
      );
      expect(apify2).toBeDefined();
      expect(apify2?.activated).toBe(false);
    });

    it('should expose honest coverage and deadline disclosure notes', () => {
      expect(BDJOBS_COVERAGE_DISCLOSURE).toContain('Limited public job highlights retrieved');
      expect(BDJOBS_DEADLINE_DISCLOSURE).toContain('never fabricated');
    });
  });

  // =========================================================================
  // GROUP 2: Source Adapter Normalization & Field Handling (Phase 3)
  // =========================================================================
  describe('2. BdjobsSourceAdapter Normalization & Parsing', () => {
    it('should parse valid Bdjobs JSON entries into RawSourceJobItems with detail URLs', () => {
      const mockJson = JSON.stringify([
        {
          JP_ID: 1058291,
          CompanyName: 'BRAC Bank Limited',
          CompanyNameBng: 'ব্র্যাক ব্যাংক লিমিটেড',
          JobTitle: 'Associate Operations Manager',
          JobTitleBng: 'অ্যাসোসিয়েট অপারেশনস ম্যানেজার',
          Category: 'Bank',
          Location: 'Dhaka',
          Salary: 'Negotiable',
          EduReq: 'Bachelor degree in Business/Finance',
          Experience: '3 to 5 year(s)',
          Vacancies: 2,
          Deadline: '2026-12-15',
          PublishDate: '2026-11-10',
          EmploymentType: 'Full Time',
        },
      ]);

      const rawItems = parseBdjobsStaticJson(mockJson);
      expect(rawItems.length).toBe(1);

      const item = rawItems[0];
      expect(item.externalId).toBe('bdjobs_1058291');
      expect(item.sourceJobId).toBe('1058291');
      expect(item.organization).toBe('BRAC Bank Limited');
      expect(item.organizationBn).toBe('ব্র্যাক ব্যাংক লিমিটেড');
      expect(item.jobTitle).toBe('Associate Operations Manager');
      expect(item.titleBn).toBe('অ্যাসোসিয়েট অপারেশনস ম্যানেজার');
      expect(item.category).toBe('Bank');
      expect(item.location).toBe('Dhaka');
      expect(item.salary).toBe('Negotiable');
      expect(item.qualification).toBe('Bachelor degree in Business/Finance');
      expect(item.experience).toBe('3 to 5 year(s)');
      expect(item.vacancies).toBe(2);
      expect(item.deadlineText).toBe('2026-12-15');
      expect(item.publishedDateText).toBe('2026-11-10');
      expect(item.circularUrl).toBe('https://jobs.bdjobs.com/jobdetails/?id=1058291');
      expect(item.sourceUrl).toBe('https://jobs.bdjobs.com/jobdetails/?id=1058291');
      expect(item.applicationUrl).toBe('https://jobs.bdjobs.com/jobdetails/?id=1058291');
    });

    it('should parse Bengali-only entries and preserve Bengali organization & title', () => {
      const mockJson = JSON.stringify([
        {
          JP_ID: '99281',
          CompanyNameBng: 'বাংলাদেশ পল্লী বিদ্যুতায়ন বোর্ড',
          JobTitleBng: 'সহকারী প্রকৌশলী (ইলেকট্রিক্যাল)',
          CatName: 'Engineering',
        },
      ]);

      const rawItems = parseBdjobsStaticJson(mockJson);
      expect(rawItems.length).toBe(1);
      expect(rawItems[0].organization).toBe('বাংলাদেশ পল্লী বিদ্যুতায়ন বোর্ড');
      expect(rawItems[0].jobTitle).toBe('সহকারী প্রকৌশলী (ইলেকট্রিক্যাল)');
      expect(rawItems[0].sourceJobId).toBe('99281');
      expect(rawItems[0].circularUrl).toBe('https://jobs.bdjobs.com/jobdetails/?id=99281');
    });

    it('should not fabricate missing optional values (deadline, salary, vacancies remain undefined)', () => {
      const mockJson = JSON.stringify([
        {
          JP_ID: 1058300,
          CompanyName: 'Square Pharmaceuticals Ltd.',
          JobTitle: 'Medical Promotion Officer',
        },
      ]);

      const rawItems = parseBdjobsStaticJson(mockJson);
      expect(rawItems.length).toBe(1);
      expect(rawItems[0].deadlineText).toBeUndefined();
      expect(rawItems[0].salary).toBeUndefined();
      expect(rawItems[0].vacancies).toBeUndefined();
      expect(rawItems[0].experience).toBeUndefined();
    });

    it('should safely discard corrupt, empty, or non-array JSON inputs without throwing', () => {
      expect(parseBdjobsStaticJson('INVALID_JSON')).toEqual([]);
      expect(parseBdjobsStaticJson('{"notAnArray": true}')).toEqual([]);
      expect(parseBdjobsStaticJson('[]')).toEqual([]);
      expect(parseBdjobsStaticJson(JSON.stringify([{ JP_ID: '' }]))).toEqual([]);
      expect(parseBdjobsStaticJson(JSON.stringify([{ JP_ID: '123', CompanyName: '' }]))).toEqual([]);
    });

    it('should normalize and validate parsed items into NormalizedJobCircular via parseJob', () => {
      const rawItems = parseBdjobsStaticJson(
        JSON.stringify([
          {
            JP_ID: 887123,
            CompanyName: 'Robi Axiata Limited',
            JobTitle: 'Senior Software Engineer (Backend)',
            Category: 'IT',
          },
        ])
      );
      expect(rawItems.length).toBe(1);

      const normalized = BdjobsAdapter.parseJob(rawItems[0], FAKE_NOW);
      expect(normalized.id.startsWith('bdjobs_')).toBe(true);
      expect(normalized.sourceJobId).toBe('887123');
      expect(normalized.sourceId).toBe('bdjobs');
      expect(normalized.sourceName).toBe('Bdjobs');
      expect(normalized.verificationState).toBeDefined();
      expect(normalized.circularUrl).toBe('https://jobs.bdjobs.com/jobdetails/?id=887123');
      expect(normalized.applicationUrl).toBe('https://jobs.bdjobs.com/jobdetails/?id=887123');

      const validation = BdjobsAdapter.validateJob(normalized);
      expect(validation.isValid).toBe(true);
    });
  });

  // =========================================================================
  // GROUP 3: Universal Job Taxonomy Integration (Phase 4)
  // =========================================================================
  describe('3. Category Integration into Universal 27-Category Taxonomy', () => {
    it('should classify IT / Software Engineer roles from Bdjobs into it_software', () => {
      const raw = parseBdjobsStaticJson(
        JSON.stringify([
          {
            JP_ID: 1101,
            CompanyName: 'Brain Station 23',
            JobTitle: 'Senior Full Stack Software Engineer (Node.js & React)',
            Category: 'IT / Technology',
          },
        ])
      )[0];

      const job = BdjobsAdapter.parseJob(raw, FAKE_NOW);
      expect(job.taxonomyCategoryId).toBe('it_software');
      expect(job.taxonomyCategoryIds).toContain('it_software');
      expect(job.taxonomyCategoryNameEn).toBe('IT & Software');
      expect(job.isUnclassified).toBeFalsy();
    });

    it('should classify Banking roles from Bdjobs into banking_finance', () => {
      const raw = parseBdjobsStaticJson(
        JSON.stringify([
          {
            JP_ID: 1102,
            CompanyName: 'Eastern Bank PLC',
            JobTitle: 'Probationary Officer (Cash Management)',
            Category: 'Bank',
          },
        ])
      )[0];

      const job = BdjobsAdapter.parseJob(raw, FAKE_NOW);
      expect(job.taxonomyCategoryId).toBe('banking_finance');
      expect(job.taxonomyCategoryIds).toContain('banking_finance');
      expect(job.isUnclassified).toBeFalsy();
    });

    it('should classify Medical / Doctor roles from Bdjobs into medical_healthcare', () => {
      const raw = parseBdjobsStaticJson(
        JSON.stringify([
          {
            JP_ID: 1103,
            CompanyName: 'Evercare Hospital Dhaka',
            JobTitle: 'Resident Medical Officer (MBBS)',
            Category: 'Healthcare',
          },
        ])
      )[0];

      const job = BdjobsAdapter.parseJob(raw, FAKE_NOW);
      expect(job.taxonomyCategoryId).toBe('medical_healthcare');
      expect(job.taxonomyCategoryIds).toContain('medical_healthcare');
    });

    it('should map unknown/unusual roles to other_unclassified without discarding the circular', () => {
      const raw = parseBdjobsStaticJson(
        JSON.stringify([
          {
            JP_ID: 1104,
            CompanyName: 'Generic Novel Enterprise Inc',
            JobTitle: 'Unknown Enigma Operator',
            JobDescription: 'Confidential duties.',
          },
        ])
      )[0];

      const job = BdjobsAdapter.parseJob(raw, FAKE_NOW);
      expect(job.taxonomyCategoryId).toBe('other_unclassified');
      expect(job.isUnclassified).toBe(true);

      // Must remain strictly valid and never discarded
      const validation = BdjobsAdapter.validateJob(job);
      expect(validation.isValid).toBe(true);
    });

    it('should infer general category from inferBdjobsCategory helper correctly', () => {
      expect(inferBdjobsCategory('Bank / Non-Bank Fin. Inst.')).toBe('Bank');
      expect(inferBdjobsCategory('IT & Telecommunication')).toBe('IT / Technology');
      expect(inferBdjobsCategory('Medical / Health')).toBe('Healthcare');
      expect(inferBdjobsCategory('Education & Training')).toBe('Education');
      expect(inferBdjobsCategory('NGO / Development')).toBe('NGO');
      expect(inferBdjobsCategory('Govt. Jobs')).toBe('Government');
      expect(inferBdjobsCategory('Commercial / Private')).toBe('Private');
    });
  });

  // =========================================================================
  // GROUP 4: Strict Deduplication & Source Attribution Preservation (Phase 5)
  // =========================================================================
  describe('4. Deduplication & Source Attribution Invariants', () => {
    it('should treat two Bdjobs jobs with distinct JP_IDs but identical titles as distinct vacancies (never merged)', () => {
      const rawA = parseBdjobsStaticJson(
        JSON.stringify([{ JP_ID: 7001, CompanyName: 'Grameenphone', JobTitle: 'Customer Care Executive' }])
      )[0];
      const rawB = parseBdjobsStaticJson(
        JSON.stringify([{ JP_ID: 7002, CompanyName: 'Grameenphone', JobTitle: 'Customer Care Executive' }])
      )[0];

      const jobA = BdjobsAdapter.parseJob(rawA, FAKE_NOW);
      const jobB = BdjobsAdapter.parseJob(rawB, FAKE_NOW);

      // Distinct sourceJobId must never be auto-merged (score < 85)
      const confidence = computeDuplicateMatchConfidence(jobA, jobB);
      expect(confidence).toBeLessThan(85);
      expect(jobA.id).not.toBe(jobB.id);
    });

    it('should recognize 100% duplicate match when sourceId and JP_ID match exactly', () => {
      const rawA = parseBdjobsStaticJson(
        JSON.stringify([{ JP_ID: 7001, CompanyName: 'Grameenphone', JobTitle: 'Customer Care Executive' }])
      )[0];
      const jobA = BdjobsAdapter.parseJob(rawA, FAKE_NOW);
      const jobA2 = BdjobsAdapter.parseJob(rawA, FAKE_NOW + 1000);

      const confidence = computeDuplicateMatchConfidence(jobA, jobA2);
      expect(confidence).toBe(100);
    });
  });

  // =========================================================================
  // GROUP 5: Source Group Filtering (The User's Specific Advice!)
  // =========================================================================
  describe('5. Source Group Filtering & Separation Invariants', () => {
    const mockBdjobsJob: NormalizedJobCircular = {
      id: 'bdjobs_101',
      sourceId: 'bdjobs',
      sourceName: 'Bdjobs',
      organization: 'Square Pharmaceuticals Ltd.',
      jobTitle: 'Production Officer',
      position: 'Production Officer',
      category: 'Private',
      taxonomyCategoryId: 'pharmaceutical_cosmetics',
      employmentType: 'Full Time',
      qualification: 'B.Pharm',
      location: 'Dhaka',
      publishedAt: FAKE_NOW,
      applicationStartAt: FAKE_NOW,
      deadlineAt: FAKE_NOW + 864000000,
      deadlineTimezone: 'Asia/Dhaka',
      deadlineVerified: true,
      applicationUrl: 'https://jobs.bdjobs.com/jobdetails/?id=101',
      circularUrl: 'https://jobs.bdjobs.com/jobdetails/?id=101',
      description: 'Production Officer at Square Pharmaceuticals',
      requirements: [],
      sourceVerification: 'official_partial',
      sourceLastCheckedAt: FAKE_NOW,
      firstDiscoveredAt: FAKE_NOW,
      lastUpdatedAt: FAKE_NOW,
      status: 'active',
    };

    const mockGovtJob: NormalizedJobCircular = {
      id: 'bpsc_201',
      sourceId: 'bpsc',
      sourceName: 'BPSC',
      organization: 'Bangladesh Public Service Commission',
      jobTitle: 'Assistant Commissioner',
      position: 'Assistant Commissioner',
      category: 'Government',
      taxonomyCategoryId: 'govt_public',
      employmentType: 'Full Time',
      qualification: 'Honours',
      location: 'All Bangladesh',
      publishedAt: FAKE_NOW,
      applicationStartAt: FAKE_NOW,
      deadlineAt: FAKE_NOW + 864000000,
      deadlineTimezone: 'Asia/Dhaka',
      deadlineVerified: true,
      applicationUrl: 'https://bpsc.teletalk.com.bd',
      circularUrl: 'https://bpsc.gov.bd/notice/201.pdf',
      description: 'BPSC recruitment',
      requirements: [],
      sourceVerification: 'official_verified',
      sourceLastCheckedAt: FAKE_NOW,
      firstDiscoveredAt: FAKE_NOW,
      lastUpdatedAt: FAKE_NOW,
      status: 'active',
    };

    const mockTeletalkJob: NormalizedJobCircular = {
      id: 'teletalk_301',
      sourceId: 'teletalk',
      sourceName: 'Teletalk Alljobs',
      organization: 'Ministry of Land',
      jobTitle: 'Surveyor',
      position: 'Surveyor',
      category: 'Government',
      taxonomyCategoryId: 'govt_public',
      employmentType: 'Full Time',
      qualification: 'Diploma',
      location: 'Dhaka',
      publishedAt: FAKE_NOW,
      applicationStartAt: FAKE_NOW,
      deadlineAt: FAKE_NOW + 864000000,
      deadlineTimezone: 'Asia/Dhaka',
      deadlineVerified: true,
      applicationUrl: 'https://minland.teletalk.com.bd',
      circularUrl: 'https://alljobs.teletalk.com.bd/minland',
      description: 'Ministry of Land circular',
      requirements: [],
      sourceVerification: 'official_verified',
      sourceLastCheckedAt: FAKE_NOW,
      firstDiscoveredAt: FAKE_NOW,
      lastUpdatedAt: FAKE_NOW,
      status: 'active',
    };

    const mockBankJob: NormalizedJobCircular = {
      id: 'bb_401',
      sourceId: 'bangladesh-bank',
      sourceName: 'Bangladesh Bank',
      organization: 'Bangladesh Bank',
      jobTitle: 'Assistant Director (General)',
      position: 'Assistant Director (General)',
      category: 'Bank',
      taxonomyCategoryId: 'banking_finance',
      employmentType: 'Full Time',
      qualification: 'Masters',
      location: 'Dhaka',
      publishedAt: FAKE_NOW,
      applicationStartAt: FAKE_NOW,
      deadlineAt: FAKE_NOW + 864000000,
      deadlineTimezone: 'Asia/Dhaka',
      deadlineVerified: true,
      applicationUrl: 'https://erecruitment.bb.org.bd',
      circularUrl: 'https://www.bb.org.bd',
      description: 'Central bank recruitment',
      requirements: [],
      sourceVerification: 'official_verified',
      sourceLastCheckedAt: FAKE_NOW,
      firstDiscoveredAt: FAKE_NOW,
      lastUpdatedAt: FAKE_NOW,
      status: 'active',
    };

    const mockNgoJob: NormalizedJobCircular = {
      id: 'reliefweb_501',
      sourceId: 'reliefweb',
      sourceName: 'ReliefWeb',
      organization: 'BRAC Humanitarian Programme',
      jobTitle: 'Project Officer - WASH',
      position: 'Project Officer - WASH',
      category: 'NGO',
      taxonomyCategoryId: 'ngo_development',
      employmentType: 'Contractual',
      qualification: 'Bachelor',
      location: 'Coxs Bazar',
      publishedAt: FAKE_NOW,
      applicationStartAt: FAKE_NOW,
      deadlineAt: FAKE_NOW + 864000000,
      deadlineTimezone: 'Asia/Dhaka',
      deadlineVerified: true,
      applicationUrl: 'https://reliefweb.int/job/501',
      circularUrl: 'https://reliefweb.int/job/501',
      description: 'BRAC WASH Project',
      requirements: [],
      sourceVerification: 'official_partial',
      sourceLastCheckedAt: FAKE_NOW,
      firstDiscoveredAt: FAKE_NOW,
      lastUpdatedAt: FAKE_NOW,
      status: 'active',
    };

    const allMockJobs = [mockBdjobsJob, mockGovtJob, mockTeletalkJob, mockBankJob, mockNgoJob];

    it('should expose all 8 designated source filter groups in SOURCE_FILTER_GROUPS', () => {
      const ids = SOURCE_FILTER_GROUPS.map((g) => g.id);
      expect(ids).toContain('All');
      expect(ids).toContain('government_portals');
      expect(ids).toContain('teletalk');
      expect(ids).toContain('bdjobs');
      expect(ids).toContain('bank_recruitment');
      expect(ids).toContain('ngo_ingo');
      expect(ids).toContain('private_company');
      expect(ids).toContain('international_jobs');
    });

    it('should correctly filter Bdjobs jobs exclusively when sourceGroup is bdjobs', () => {
      expect(isJobMatchingSourceGroup(mockBdjobsJob, 'bdjobs')).toBe(true);
      expect(isJobMatchingSourceGroup(mockGovtJob, 'bdjobs')).toBe(false);
      expect(isJobMatchingSourceGroup(mockTeletalkJob, 'bdjobs')).toBe(false);
      expect(isJobMatchingSourceGroup(mockBankJob, 'bdjobs')).toBe(false);

      const filtered = filterAndSortJobs(
        allMockJobs,
        { ...DEFAULT_JOB_FILTERS, sourceGroup: 'bdjobs' },
        new Set(),
        FAKE_NOW
      );
      expect(filtered.length).toBe(1);
      expect(filtered[0].id).toBe('bdjobs_101');
    });

    it('should keep Government Portals clean and not mix in Bdjobs jobs', () => {
      expect(isJobMatchingSourceGroup(mockGovtJob, 'government_portals')).toBe(true);
      expect(isJobMatchingSourceGroup(mockBdjobsJob, 'government_portals')).toBe(false);

      const filtered = filterAndSortJobs(
        allMockJobs,
        { ...DEFAULT_JOB_FILTERS, sourceGroup: 'government_portals' },
        new Set(),
        FAKE_NOW
      );
      expect(filtered.map((j) => j.id)).toContain('bpsc_201');
      expect(filtered.map((j) => j.id)).not.toContain('bdjobs_101');
    });

    it('should correctly filter Teletalk jobs exclusively', () => {
      expect(isJobMatchingSourceGroup(mockTeletalkJob, 'teletalk')).toBe(true);
      expect(isJobMatchingSourceGroup(mockGovtJob, 'teletalk')).toBe(false);
      expect(isJobMatchingSourceGroup(mockBdjobsJob, 'teletalk')).toBe(false);
    });

    it('should correctly filter Bank Recruitment jobs exclusively', () => {
      expect(isJobMatchingSourceGroup(mockBankJob, 'bank_recruitment')).toBe(true);
      expect(isJobMatchingSourceGroup(mockBdjobsJob, 'bank_recruitment')).toBe(false);
    });

    it('should correctly filter NGO / INGO jobs exclusively', () => {
      expect(isJobMatchingSourceGroup(mockNgoJob, 'ngo_ingo')).toBe(true);
      expect(isJobMatchingSourceGroup(mockGovtJob, 'ngo_ingo')).toBe(false);
    });

    it('should return all jobs when sourceGroup is All', () => {
      const filtered = filterAndSortJobs(
        allMockJobs,
        { ...DEFAULT_JOB_FILTERS, sourceGroup: 'All' },
        new Set(),
        FAKE_NOW
      );
      expect(filtered.length).toBe(5);
    });
  });

  // =========================================================================
  // GROUP 6: UI & External Search Link Generator (Phase 6 & 7)
  // =========================================================================
  describe('6. UI & Authorized User Browsing Link Generator', () => {
    it('should construct valid official search URLs on jobs.bdjobs.com for user queries', () => {
      const url = buildBdjobsSearchUrl('Software Engineer');
      expect(url).toBe('https://jobs.bdjobs.com/jobsearch.asp?txtsearch=Software+Engineer');

      const urlWithCat = buildBdjobsSearchUrl('Flutter', 'it_software');
      expect(urlWithCat).toContain('txtsearch=Flutter');
      expect(urlWithCat).toContain('qcat=it_software');
    });

    it('should fall back to bdjobs homepage when query is empty', () => {
      expect(buildBdjobsSearchUrl('')).toBe('https://www.bdjobs.com/');
      expect(buildBdjobsSearchUrl('   ')).toBe('https://www.bdjobs.com/');
    });

    it('should verify that Bdjobs circular detail URLs are safe to open in new tab', () => {
      const detailUrl = 'https://jobs.bdjobs.com/jobdetails/?id=1058291';
      const check = verifyJobUrl(detailUrl);
      expect(check.isValid).toBe(true);
      expect(check.isSafeToOpen).toBe(true);
      expect(check.normalizedUrl).toBe(detailUrl);
      expect(check.hasSuspiciousRedirect).toBe(false);
    });
  });

  // =========================================================================
  // GROUP 7: Source Health States (Phase 7)
  // =========================================================================
  describe('7. Source Health State Reporting', () => {
    it('should report PARTIAL_SUCCESS with honest counts when static highlights are fetched', async () => {
      const mockItems = [
        { JP_ID: 101, CompanyName: 'Square Pharma', JobTitle: 'Chemist' },
        { JP_ID: 102, CompanyName: 'Beximco', JobTitle: 'Executive' },
      ];

      vi.spyOn(jobFetcher, 'safePublicGet').mockResolvedValueOnce({
        ok: true,
        status: 200,
        body: JSON.stringify(mockItems),
        headers: {},
      });

      const outcome = await BdjobsAdapter.fetchJobs();
      expect(outcome.success).toBe(true);
      expect(outcome.status).toBe('PARTIAL_SUCCESS');
      expect(outcome.jobs.length).toBe(2);
      expect(outcome.connectionStatus).toBe('Partially Working');
    });

    it('should NOT report success when 0 jobs are retrieved from the feed', async () => {
      vi.spyOn(jobFetcher, 'safePublicGet').mockResolvedValueOnce({
        ok: true,
        status: 200,
        body: '[]',
        headers: {},
      });

      const outcome = await BdjobsAdapter.fetchJobs();
      expect(outcome.success).toBe(false);
      expect(outcome.jobs.length).toBe(0);
      expect(outcome.accessNotes).toContain('No job records');
    });

    it('should report MANUAL_VERIFICATION_REQUIRED when blocked by CAPTCHA / anti-bot challenge', async () => {
      vi.spyOn(jobFetcher, 'safePublicGet').mockResolvedValueOnce({
        ok: false,
        status: 403,
        body: '<html>Cloudflare challenge</html>',
        headers: {},
        blockedByCaptcha: true,
        blockedReason: 'Cloudflare Turnstile challenge detected',
      });

      const outcome = await BdjobsAdapter.fetchJobs();
      expect(outcome.success).toBe(false);
      expect(outcome.status).toBe('MANUAL_VERIFICATION_REQUIRED');
      expect(outcome.blockedByCaptcha).toBe(true);
    });

    it('should report TEMPORARILY_UNAVAILABLE on HTTP 429 rate limit', async () => {
      vi.spyOn(jobFetcher, 'safePublicGet').mockResolvedValueOnce({
        ok: false,
        status: 429,
        body: 'Too Many Requests',
        headers: {},
        blockedReason: 'HTTP 429: Too Many Requests',
      });

      const outcome = await BdjobsAdapter.fetchJobs();
      expect(outcome.success).toBe(false);
      expect(outcome.status).toBe('TEMPORARILY_UNAVAILABLE');
    });

    it('should report FAILED when static highlight feed returns malformed JSON', async () => {
      vi.spyOn(jobFetcher, 'safePublicGet').mockResolvedValueOnce({
        ok: true,
        status: 200,
        body: 'NOT_VALID_JSON{',
        headers: {},
      });

      const outcome = await BdjobsAdapter.fetchJobs();
      expect(outcome.success).toBe(false);
      expect(outcome.status).toBe('FAILED');
      expect(outcome.invalidResponse).toBe(true);
    });
  });

  // =========================================================================
  // GROUP 8: Production Release Package Integrity Baseline (Part 11 Protection)
  // =========================================================================
  describe('8. Production Release Package Integrity Protection', () => {
    it('should verify release/JobFill-BD-Edge.zip SHA-256 hash is untouched', () => {
      const edgeZipPath = path.resolve(__dirname, '../../release/JobFill-BD-Edge.zip');
      expect(fs.existsSync(edgeZipPath)).toBe(true);
      const buffer = fs.readFileSync(edgeZipPath);
      const hash = crypto.createHash('sha256').update(buffer).digest('hex').toUpperCase();
      expect(hash).toBe('DB08AA45F1C3ED99AD8ADEBF5B81EDFA94812E93A02557D2306EE171AAD52732');
    });

    it('should verify release/chrome/JobFill-BD-Chrome.zip SHA-256 hash is untouched', () => {
      const chromeZipPath = path.resolve(__dirname, '../../release/chrome/JobFill-BD-Chrome.zip');
      expect(fs.existsSync(chromeZipPath)).toBe(true);
      const buffer = fs.readFileSync(chromeZipPath);
      const hash = crypto.createHash('sha256').update(buffer).digest('hex').toUpperCase();
      expect(hash).toBe('23D002185F2640CB47803A086AB39076F2C2E923AC84405C3117391D65F89DB9');
    });
  });
});
