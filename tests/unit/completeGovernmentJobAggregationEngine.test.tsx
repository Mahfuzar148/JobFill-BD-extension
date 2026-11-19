// JobFill BD - Bangladesh Complete Government Job Circular Aggregation Engine Test Suite
// Exhaustively verifies:
// 1. Government Source Discovery Registry (30+ verified sources across 10 groups, health tracking, candidate registration)
// 2. Strict Notice Classification (Rejection of administrative transfers/promotions/tenders, detection of admit/exam/result updates, primary circulars)
// 3. Multi-Source Collection Orchestrator (Error isolation, multi-page scanning, deduplication, taxonomy enrichment)
// 4. Government Organization Discovery & Missing Circular Diagnostics (.gov.bd/.mil.bd/.edu.bd domain check, missing circular diagnostics)
// 5. Dashboard Government Jobs Overview Section (Live counters including active & expired circulars, 8 source category pills, navigation)
// 6. Release Package Hash Integrity (Edge & Chrome ZIPs untouched)

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import {
  GovernmentSourceRegistry,
} from '../../src/jobs/sources/government-registry/government-source-registry';
import {
  GovernmentNoticeClassifier,
} from '../../src/jobs/services/government-notice-classifier';
import {
  GovernmentCollectionOrchestrator,
  GovernmentNoticeItem,
} from '../../src/jobs/services/government-collection-orchestrator';
import {
  GovernmentOrganizationDiscoveryEngine,
} from '../../src/jobs/services/government-organization-discovery';
import {
  GovernmentJobsOverviewSection,
} from '../../src/dashboard/components/GovernmentJobsOverviewSection';
import { JobRepository } from '../../src/jobs/database/job-repository';
import { NormalizedJobCircular } from '../../src/jobs/types/job.types';
import {
  GovernmentSourceGroup,
  GovernmentOrganizationType,
} from '../../src/jobs/types/government.types';

// Mock IndexedDB and repositories
const mockJobsDb = new Map<string, NormalizedJobCircular>();

vi.mock('../../src/jobs/database/job-repository', () => ({
  JobRepository: {
    getAllJobs: vi.fn(async () => Array.from(mockJobsDb.values())),
    getJobById: vi.fn(async (id: string) => mockJobsDb.get(id) || null),
    saveJob: vi.fn(async (job: NormalizedJobCircular) => {
      mockJobsDb.set(job.id, job);
    }),
    saveJobs: vi.fn(async (jobs: NormalizedJobCircular[]) => {
      for (const j of jobs) mockJobsDb.set(j.id, j);
    }),
    upsertJob: vi.fn(async (job: NormalizedJobCircular) => {
      mockJobsDb.set(job.id, job);
    }),
    upsertJobs: vi.fn(async (jobs: NormalizedJobCircular[]) => {
      for (const j of jobs) mockJobsDb.set(j.id, j);
    }),
    deleteJob: vi.fn(async (id: string) => {
      mockJobsDb.delete(id);
    }),
    clearAll: vi.fn(async () => {
      mockJobsDb.clear();
    }),
    rebuildSearchIndex: vi.fn(async () => {}),
  },
}));

vi.mock('../../src/dashboard/context/AppContext', () => ({
  useApp: () => ({
    language: 'bn',
    userMode: 'job_seeker',
    setUserMode: vi.fn(),
    showToast: vi.fn(),
  }),
}));

async function flushUi(ms = 60) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}

describe('Complete Bangladesh Government Job Circular Aggregation Engine', () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    mockJobsDb.clear();
    vi.clearAllMocks();
    document.body.innerHTML = '';
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount();
      });
      root = null;
    }
    document.body.innerHTML = '';
    mockJobsDb.clear();
  });

  // =========================================================================
  // TEST GROUP 1: Government Source Discovery Registry
  // =========================================================================
  describe('1. Government Source Discovery Registry', () => {
    it('seeds at least 30 verified official Bangladesh government sources across 10 official groups', () => {
      const allSources = GovernmentSourceRegistry.getAllSources();
      expect(allSources.length).toBeGreaterThanOrEqual(30);

      const requiredGroups: GovernmentSourceGroup[] = [
        'central_aggregators',
        'public_service_commissions',
        'ministries_divisions',
        'directorates_departments',
        'defence_uniformed',
        'government_financial',
        'public_education',
        'public_healthcare',
        'public_corporations',
        'district_local_govt',
      ];

      for (const group of requiredGroups) {
        const sourcesInGroup = GovernmentSourceRegistry.getSourcesByGroup(group);
        expect(
          sourcesInGroup.length,
          `Group ${group} must have at least one verified government source`
        ).toBeGreaterThanOrEqual(1);
      }
    });

    it('contains major verified bodies like BPSC, Alljobs, MOPA, Bangladesh Bank, Army, and DC Offices', () => {
      const bpsc = GovernmentSourceRegistry.getSourceById('bpsc_main');
      expect(bpsc).toBeDefined();
      expect(bpsc?.organizationType).toBe('Constitutional Institution');
      expect(bpsc?.sourceGroup).toBe('public_service_commissions');
      expect(bpsc?.officialDomain).toContain('bpsc.gov.bd');

      const alljobs = GovernmentSourceRegistry.getSourceById('teletalk_alljobs_govt');
      expect(alljobs).toBeDefined();
      expect(alljobs?.sourceGroup).toBe('central_aggregators');
      expect(alljobs?.officialDomain).toContain('alljobs.teletalk.com.bd');

      const mopa = GovernmentSourceRegistry.getSourceById('mopa_govt');
      expect(mopa).toBeDefined();
      expect(mopa?.sourceGroup).toBe('ministries_divisions');
      expect(mopa?.officialDomain).toContain('mopa.gov.bd');

      const bb = GovernmentSourceRegistry.getSourceById('bangladesh_bank_erecruitment');
      expect(bb).toBeDefined();
      expect(bb?.sourceGroup).toBe('government_financial');
      expect(bb?.officialDomain).toContain('bb.org.bd');

      const army = GovernmentSourceRegistry.getSourceById('army_recruitment');
      expect(army).toBeDefined();
      expect(army?.sourceGroup).toBe('defence_uniformed');
      expect(army?.officialDomain).toContain('army.mil.bd');

      const dcDhaka = GovernmentSourceRegistry.getSourceById('dc_dhaka');
      expect(dcDhaka).toBeDefined();
      expect(dcDhaka?.sourceGroup).toBe('district_local_govt');
      expect(dcDhaka?.officialDomain).toContain('dhaka.gov.bd');
    });

    it('enables disabling, enabling, and updating source health status', () => {
      const sourceId = 'bpsc_main';
      GovernmentSourceRegistry.updateSourceHealth(sourceId, 'FAILED', 'HTTP 503 Gateway Timeout');
      let source = GovernmentSourceRegistry.getSourceById(sourceId);
      expect(source?.sourceHealth).toBe('FAILED');
      expect(source?.lastError).toBe('HTTP 503 Gateway Timeout');

      GovernmentSourceRegistry.disableSource(sourceId);
      source = GovernmentSourceRegistry.getSourceById(sourceId);
      expect(source?.verificationStatus).toBe('DISABLED');
      expect(source?.enabled).toBe(false);

      GovernmentSourceRegistry.enableSource(sourceId);
      source = GovernmentSourceRegistry.getSourceById(sourceId);
      expect(source?.verificationStatus).toBe('ACTIVE');
      expect(source?.enabled).toBe(true);
    });

    it('registers candidate sources with domain verification and auto-inference', () => {
      const candidate = GovernmentSourceRegistry.registerCandidateSource(
        'Ministry of Information and Broadcasting',
        'তথ্য ও সম্প্রচার মন্ত্রণালয়',
        'https://moi.gov.bd',
        'https://moi.gov.bd/site/view/notices'
      );

      expect(candidate.sourceId).toBe('govt_candidate_moi_gov_bd');
      expect(candidate.sourceGroup).toBe('ministries_divisions');
      expect(candidate.verificationStatus).toBe('OFFICIAL_DOMAIN_VERIFIED');
    });

    it('rejects candidate source registration for unofficial domains', () => {
      expect(() => {
        GovernmentSourceRegistry.registerCandidateSource(
          'Fake Govt Portal',
          'ভুয়া সরকারি সাইট',
          'https://bangladesh-jobs-fake.com',
          'https://bangladesh-jobs-fake.com/circulars'
        );
      }).toThrow(/Unofficial domain rejected/);
    });
  });

  // =========================================================================
  // TEST GROUP 2: Strict Notice Classification (Rule 1)
  // =========================================================================
  describe('2. Strict Notice Classification (Rule 1: Primary Circular vs Update vs Administrative Non-Job)', () => {
    it('Step 1: Strictly rejects administrative employee transfers (বদলি/পদায়ন) with isJobCardEligible: false', () => {
      const transferNotice1 = GovernmentNoticeClassifier.classifyNotice(
        'সহকারী সচিবগণের বদলিপূর্বক প্রেষণে পদায়ন সংক্রান্ত অফিস আদেশ',
        'জনপ্রশাসন মন্ত্রণালয় মাঠ প্রশাসন-১ শাখা স্মারক নং ০৫.০০.০০০০... অনুযায়ী নিম্নবর্ণিত কর্মকর্তাগণকে বদলি করা হলো।'
      );
      expect(transferNotice1.category).toBe('ADMINISTRATIVE_NON_JOB');
      expect(transferNotice1.isJobCardEligible).toBe(false);
      expect(transferNotice1.subtype).toBe('TRANSFER');

      const transferNotice2 = GovernmentNoticeClassifier.classifyNotice(
        'উপজেলা সহকারী কমিশনার (ভূমি) বদলি ও পদায়ন আদেশ'
      );
      expect(transferNotice2.category).toBe('ADMINISTRATIVE_NON_JOB');
      expect(transferNotice2.isJobCardEligible).toBe(false);
    });

    it('Step 1: Strictly rejects employee promotions (পদোন্নতি) with isJobCardEligible: false', () => {
      const promotionNotice = GovernmentNoticeClassifier.classifyNotice(
        'উপসচিব পদে পদোন্নতি প্রাপ্ত কর্মকর্তাদের তালিকা প্রকাশ'
      );
      expect(promotionNotice.category).toBe('ADMINISTRATIVE_NON_JOB');
      expect(promotionNotice.isJobCardEligible).toBe(false);
      expect(promotionNotice.subtype).toBe('PROMOTION');
    });

    it('Step 1: Strictly rejects retirement/PRL, routine office orders, and memos with isJobCardEligible: false', () => {
      const prlNotice = GovernmentNoticeClassifier.classifyNotice(
        'জনাব রফিকুল ইসলামের অবসরোত্তর ছুটি (পিআরএল) মঞ্জুর সংক্রান্ত'
      );
      expect(prlNotice.category).toBe('ADMINISTRATIVE_NON_JOB');
      expect(prlNotice.isJobCardEligible).toBe(false);
      expect(prlNotice.subtype).toBe('RETIREMENT');

      const officeOrder = GovernmentNoticeClassifier.classifyNotice(
        'প্রশাসনিক কাজের স্বার্থে দায়িত্ব বণ্টন সংক্রান্ত অফিস আদেশ',
        'স্মারক নং: ৪৬.০২.০০০০...'
      );
      expect(officeOrder.category).toBe('ADMINISTRATIVE_NON_JOB');
      expect(officeOrder.isJobCardEligible).toBe(false);
      expect(officeOrder.subtype).toBe('OFFICE_ORDER');
    });

    it('Step 1: Strictly rejects tenders, procurement, e-GP, and quotations with isJobCardEligible: false', () => {
      const tenderNotice = GovernmentNoticeClassifier.classifyNotice(
        'কম্পিউটার ও ল্যাব যন্ত্রপাতি ক্রয়ের জন্য ই-টেন্ডার দরপত্র আহ্বান (e-GP Tender Notice)',
        'প্যাকেজ নং: e-Tender/DPE/2026/G-01, ওপেন টেন্ডারিং মেথড (OTM)'
      );
      expect(tenderNotice.category).toBe('ADMINISTRATIVE_NON_JOB');
      expect(tenderNotice.isJobCardEligible).toBe(false);
      expect(tenderNotice.subtype).toBe('TENDER');
    });

    it('Step 2: Classifies Admit Card notices as RECRUITMENT_UPDATE with isJobCardEligible: false and extracts matching key', () => {
      const admitNotice = GovernmentNoticeClassifier.classifyNotice(
        '৪৬তম বিসিএস লিখিত পরীক্ষার প্রবেশপত্র ডাউনলোড সংক্রান্ত বিজ্ঞপ্তি',
        'বিজ্ঞপ্তি নং: বিপিএসসি/পরীক্ষা/২০২৬/৮৮। প্রার্থীরা bpsc.teletalk.com.bd থেকে এডমিট কার্ড ডাউনলোড করতে পারবেন।'
      );
      expect(admitNotice.category).toBe('RECRUITMENT_UPDATE');
      expect(admitNotice.isJobCardEligible).toBe(false);
      expect(admitNotice.subtype).toBe('ADMIT_CARD');
      expect(admitNotice.linkedJobCandidateKey).toBeDefined();
    });

    it('Step 2: Classifies written, MCQ, and viva exam schedules as RECRUITMENT_UPDATE', () => {
      const writtenExam = GovernmentNoticeClassifier.classifyNotice(
        '১০ম ও ১২তম গ্রেডের পদের লিখিত পরীক্ষার সময়সূচি ও আসন বিন্যাস প্রকাশ'
      );
      expect(writtenExam.category).toBe('RECRUITMENT_UPDATE');
      expect(writtenExam.isJobCardEligible).toBe(false);
      expect(writtenExam.subtype).toBe('EXAM_SCHEDULE_WRITTEN');

      const vivaExam = GovernmentNoticeClassifier.classifyNotice(
        'সহকারী প্রকৌশলী পদের মৌখিক পরীক্ষার সময়সূচি (Viva-Voce Schedule)'
      );
      expect(vivaExam.category).toBe('RECRUITMENT_UPDATE');
      expect(vivaExam.isJobCardEligible).toBe(false);
      expect(vivaExam.subtype).toBe('EXAM_SCHEDULE_VIVA');
    });

    it('Step 2: Classifies exam results, waiting lists, and joining letters as RECRUITMENT_UPDATE', () => {
      const resultNotice = GovernmentNoticeClassifier.classifyNotice(
        'প্রাথমিক সহকারী শিক্ষক নিয়োগ পরীক্ষা ২০২৩-এর চূড়ান্ত ফলাফল প্রকাশ'
      );
      expect(resultNotice.category).toBe('RECRUITMENT_UPDATE');
      expect(resultNotice.isJobCardEligible).toBe(false);
      expect(resultNotice.subtype).toBe('RESULT_FINAL');

      const waitingNotice = GovernmentNoticeClassifier.classifyNotice(
        'নিয়োগের জন্য অপেক্ষমান তালিকা (Waiting List) হইতে প্রার্থী মনোনয়ন'
      );
      expect(waitingNotice.category).toBe('RECRUITMENT_UPDATE');
      expect(waitingNotice.isJobCardEligible).toBe(false);
      expect(waitingNotice.subtype).toBe('WAITING_LIST');
    });

    it('Step 3: Classifies primary job vacancy circulars as PRIMARY_JOB_CIRCULAR with isJobCardEligible: true', () => {
      const jobCircular = GovernmentNoticeClassifier.classifyNotice(
        'বাংলাদেশ পেট্রোলিয়াম কর্পোরেশনে শূন্য পদে সরাসরি জনবল নিয়োগ বিজ্ঞপ্তি',
        'নবম গ্রেডের সহকারী মহাব্যবস্থাপক এবং দশম গ্রেডের হিসাবরক্ষণ কর্মকর্তা পদে দরখাস্ত আহ্বান করা যাচ্ছে।'
      );
      expect(jobCircular.category).toBe('PRIMARY_JOB_CIRCULAR');
      expect(jobCircular.isJobCardEligible).toBe(true);
      expect(jobCircular.subtype).toBe('NEW_CIRCULAR');
      expect(jobCircular.detectedGrade).toBe(9);
    });

    it('Step 3: Classifies revised circulars and deadline extensions as PRIMARY_JOB_CIRCULAR', () => {
      const extendedNotice = GovernmentNoticeClassifier.classifyNotice(
        'রেলওয়ে সহকারী স্টেশন মাস্টার পদে আবেদনের সময়সীমা বৃদ্ধি সংক্রান্ত সংশোধিত বিজ্ঞপ্তি'
      );
      expect(extendedNotice.category).toBe('PRIMARY_JOB_CIRCULAR');
      expect(extendedNotice.isJobCardEligible).toBe(true);
      expect(extendedNotice.subtype).toBe('DEADLINE_EXTENSION');
    });
  });

  // =========================================================================
  // TEST GROUP 3: Multi-Source Collection Orchestrator & Pagination
  // =========================================================================
  describe('3. Multi-Source Collection Orchestrator & Pagination', () => {
    it('executes collection with error isolation: failed source does NOT halt other sources', async () => {
      const mockFetchSource = vi.fn(async (sourceId: string, page: number): Promise<GovernmentNoticeItem[]> => {
        if (sourceId === 'failing_ministry') {
          throw new Error('503 Service Unavailable: Network Connection Timeout');
        }
        if (sourceId === 'working_ministry') {
          return [
            {
              rawTitle: 'উপসহকারী প্রকৌশলী পদে সরাসরি নিয়োগ বিজ্ঞপ্তি',
              rawDetails: '১০ম গ্রেড। বেতন স্কেল ১৬০০০-৩৮৬৪০ টাকা। আবেদনের শেষ তারিখ ৩০ মে ২০২৬।',
              noticeUrl: 'https://pwd.gov.bd/notice/101',
              pdfUrl: 'https://pwd.gov.bd/files/circular-101.pdf',
              publishedDateText: '2026-05-01',
              pageNumber: page,
            },
            {
              rawTitle: 'কর্মকর্তাদের রুটিন বদলি সংক্রান্ত অফিস আদেশ নং ৪৪',
              rawDetails: 'প্রশাসনিক প্রয়োজনে সহকারী প্রকৌশলীগনের কর্মস্থল পরিবর্তন করা হলো।',
              noticeUrl: 'https://pwd.gov.bd/notice/102',
              pageNumber: page,
            },
          ];
        }
        return [];
      });

      const testSources = [
        {
          sourceId: 'failing_ministry',
          sourceName: 'Failing Ministry Portal',
          sourceNameBn: 'ত্রুটিপূর্ণ মন্ত্রণালয় সাইট',
          organizationName: 'Failing Ministry',
          organizationNameBn: 'ত্রুটিপূর্ণ মন্ত্রণালয়',
          organizationType: 'Ministry' as GovernmentOrganizationType,
          sourceGroup: 'ministries_divisions' as GovernmentSourceGroup,
          officialDomain: 'fail.gov.bd',
          recruitmentPageUrl: 'https://fail.gov.bd/notices',
          noticePageUrl: 'https://fail.gov.bd/notices',
          sourceAccessMethod: 'HTML_NOTICE_BOARD' as const,
          paginationMethod: 'PAGE_NUMBER' as const,
          maxPagesToScan: 1,
          supportedCategories: ['govt_public'],
          termsReviewStatus: 'REVIEWED_PUBLIC' as const,
          sourceHealth: 'ACTIVE' as const,
          enabled: true,
          verificationStatus: 'ACTIVE' as const,
        },
        {
          sourceId: 'working_ministry',
          sourceName: 'Public Works Department',
          sourceNameBn: 'গণপূর্ত অধিদপ্তর',
          organizationName: 'PWD',
          organizationNameBn: 'গণপূর্ত অধিদপ্তর',
          organizationType: 'Directorate' as GovernmentOrganizationType,
          sourceGroup: 'directorates_departments' as GovernmentSourceGroup,
          officialDomain: 'pwd.gov.bd',
          recruitmentPageUrl: 'https://pwd.gov.bd/notices',
          noticePageUrl: 'https://pwd.gov.bd/notices',
          sourceAccessMethod: 'HTML_NOTICE_BOARD' as const,
          paginationMethod: 'PAGE_NUMBER' as const,
          maxPagesToScan: 2,
          supportedCategories: ['govt_public', 'engineering_architecture'],
          termsReviewStatus: 'REVIEWED_PUBLIC' as const,
          sourceHealth: 'ACTIVE' as const,
          enabled: true,
          verificationStatus: 'ACTIVE' as const,
        },
      ];

      const result = await GovernmentCollectionOrchestrator.executeGovernmentCollection(
        testSources,
        mockFetchSource,
        2
      );

      // Verify Error Isolation
      expect(result.sourcesAttempted).toBe(2);
      expect(result.sourcesSucceeded).toBe(1);
      expect(result.sourcesFailed).toBe(1);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0].sourceId).toBe('failing_ministry');
      expect(result.errors[0].errorMessage).toContain('503 Service Unavailable');

      // Verify Notice Rejection Pipeline
      expect(result.totalNoticesScanned).toBe(4);
      expect(result.administrativeNoticesRejected).toBeGreaterThanOrEqual(1);
      expect(result.primaryCircularsDiscovered).toBeGreaterThanOrEqual(1);
      expect(result.savedToDatabaseCount).toBeGreaterThanOrEqual(1);
    });

    it('enriches saved circular with Universal 27-Category taxonomy and official grade', async () => {
      const mockFetch = vi.fn(async (): Promise<GovernmentNoticeItem[]> => [
        {
          rawTitle: 'সহকারী প্রোগ্রামার (৯ম গ্রেড) পদে স্থায়ী নিয়োগ বিজ্ঞপ্তি',
          rawDetails: 'আইসিটি অধিদপ্তর। শিক্ষাগত যোগ্যতা: কম্পিউটার সায়েন্সে বিএসসি বা সমমান ডিগ্রি।',
          noticeUrl: 'https://doict.gov.bd/notice/99',
          pdfUrl: 'https://doict.gov.bd/files/circular-99.pdf',
          publishedDateText: '2026-05-10',
          pageNumber: 1,
        },
      ]);

      const testSource = {
        sourceId: 'doict_test',
        sourceName: 'Department of ICT',
        sourceNameBn: 'তথ্য ও যোগাযোগ প্রযুক্তি অধিদপ্তর',
        organizationName: 'Department of ICT',
        organizationNameBn: 'তথ্য ও যোগাযোগ প্রযুক্তি অধিদপ্তর',
        organizationType: 'Directorate' as GovernmentOrganizationType,
        sourceGroup: 'directorates_departments' as GovernmentSourceGroup,
        officialDomain: 'doict.gov.bd',
        recruitmentPageUrl: 'https://doict.gov.bd/notices',
        noticePageUrl: 'https://doict.gov.bd/notices',
        sourceAccessMethod: 'HTML_NOTICE_BOARD' as const,
        paginationMethod: 'PAGE_NUMBER' as const,
        maxPagesToScan: 1,
        supportedCategories: ['govt_public', 'it_software'],
        termsReviewStatus: 'REVIEWED_PUBLIC' as const,
        sourceHealth: 'ACTIVE' as const,
        enabled: true,
        verificationStatus: 'ACTIVE' as const,
      };

      const summary = await GovernmentCollectionOrchestrator.executeGovernmentCollection(
        [testSource],
        mockFetch,
        1
      );

      expect(summary.savedToDatabaseCount).toBe(1);
      const savedJobs = await JobRepository.getAllJobs();
      const savedJob = savedJobs.find((j) => j.organization.includes('Department of ICT'));
      expect(savedJob).toBeDefined();
      expect(savedJob?.gradeNumber).toBe(9);
      expect(savedJob?.category).toBe('Government');
      expect(
        savedJob?.taxonomyCategoryId === 'govt_public' ||
          savedJob?.taxonomyCategoryId === 'it_software'
      ).toBe(true);
      expect(savedJob?.taxonomyCategoryIds || []).toContain('it_software');
      expect(savedJob?.isGovernmentJob).toBe(true);
    });
  });

  // =========================================================================
  // TEST GROUP 4: Organization Discovery & Missing Circular Diagnostics
  // =========================================================================
  describe('4. Organization Discovery & Missing Circular Diagnostics', () => {
    it('accurately verifies official Bangladesh domains (.gov.bd, .mil.bd, .edu.bd)', () => {
      expect(GovernmentOrganizationDiscoveryEngine.isOfficialGovernmentDomain('https://bpsc.gov.bd').isOfficial).toBe(true);
      expect(GovernmentOrganizationDiscoveryEngine.isOfficialGovernmentDomain('https://army.mil.bd').isOfficial).toBe(true);
      expect(GovernmentOrganizationDiscoveryEngine.isOfficialGovernmentDomain('https://du.ac.bd').isOfficial).toBe(true);
      expect(GovernmentOrganizationDiscoveryEngine.isOfficialGovernmentDomain('https://buet.ac.bd').isOfficial).toBe(true);
      expect(GovernmentOrganizationDiscoveryEngine.isOfficialGovernmentDomain('https://alljobs.teletalk.com.bd').isOfficial).toBe(true);

      // Unofficial
      expect(GovernmentOrganizationDiscoveryEngine.isOfficialGovernmentDomain('https://bdjobs.com').isOfficial).toBe(false);
      expect(GovernmentOrganizationDiscoveryEngine.isOfficialGovernmentDomain('https://facebook.com').isOfficial).toBe(false);
      expect(GovernmentOrganizationDiscoveryEngine.isOfficialGovernmentDomain('https://fakegovtportal.com').isOfficial).toBe(false);
    });

    it('infers organization type and source group from domain and Bangla titles', () => {
      const meta = GovernmentOrganizationDiscoveryEngine.inferOrganizationMeta(
        'https://mopa.gov.bd',
        'Ministry of Public Administration',
        'জনপ্রশাসন মন্ত্রণালয়'
      );
      expect(meta.orgType).toBe('Ministry');
      expect(meta.sourceGroup).toBe('ministries_divisions');

      const policeMeta = GovernmentOrganizationDiscoveryEngine.inferOrganizationMeta(
        'https://police.gov.bd',
        'Bangladesh Police',
        'বাংলাদেশ পুলিশ'
      );
      expect(policeMeta.orgType).toBe('Law Enforcement Agency');
      expect(policeMeta.sourceGroup).toBe('defence_uniformed');

      const dcMeta = GovernmentOrganizationDiscoveryEngine.inferOrganizationMeta(
        'https://chattogram.gov.bd',
        'Office of the Deputy Commissioner, Chattogram',
        'জেলা প্রশাসকের কার্যালয়, চট্টগ্রাম'
      );
      expect(dcMeta.orgType).toBe('District Administration');
      expect(dcMeta.sourceGroup).toBe('district_local_govt');
    });

    it('diagnoses missing circular: gives evidence when notice is an administrative transfer', async () => {
      const diagnostic = await GovernmentOrganizationDiscoveryEngine.diagnoseMissingCircular(
        'https://mopa.gov.bd/notice/345',
        'উপসচিবগণের পদায়ন ও বদলি সংক্রান্ত অফিস আদেশ'
      );

      expect(diagnostic.isRecognizedGovernmentDomain).toBe(true);
      expect(diagnostic.primaryReason).toBe('REJECTED_AS_ADMINISTRATIVE_NOTICE');
      expect(diagnostic.explanation).toContain('প্রশাসনিক নোটিশ (বদলি, পদোন্নতি বা রুটিন মেমো)');
      expect(diagnostic.evidence.length).toBeGreaterThan(0);
    });

    it('diagnoses missing circular: flags unofficial domain', async () => {
      const diagnostic = await GovernmentOrganizationDiscoveryEngine.diagnoseMissingCircular(
        'https://jobcircularbangladesh24.com/post/999'
      );

      expect(diagnostic.isRecognizedGovernmentDomain).toBe(false);
      expect(diagnostic.primaryReason).toBe('UNOFFICIAL_DOMAIN');
      expect(diagnostic.recommendation).toContain('.gov.bd');
    });

    it('diagnoses missing circular: flags active filter mismatch when job is in DB', async () => {
      const mockSavedJob: NormalizedJobCircular = {
        id: 'govt_pwd_123',
        sourceId: 'bpsc',
        sourceName: 'BPSC',
        organization: 'Public Works Department',
        jobTitle: 'Assistant Engineer',
        position: 'Assistant Engineer',
        category: 'Government',
        employmentType: 'Full Time',
        qualification: 'Bachelor',
        location: 'Dhaka',
        publishedAt: Date.now() - 100000,
        applicationStartAt: Date.now() - 100000,
        deadlineAt: Date.now() + 500000,
        deadlineTimezone: 'Asia/Dhaka',
        deadlineVerified: true,
        circularUrl: 'https://pwd.gov.bd/circulars/123',
        applicationUrl: 'https://pwd.teletalk.com.bd',
        description: 'Government engineering job',
        requirements: ['B.Sc in Civil Engineering'],
        sourceVerification: 'official_verified',
        sourceLastCheckedAt: Date.now(),
        firstDiscoveredAt: Date.now(),
        lastUpdatedAt: Date.now(),
        status: 'active',
        gradeNumber: 9,
      };

      mockJobsDb.set(mockSavedJob.id, mockSavedJob);

      // User has grade 10 filter active, but job is grade 9
      const diagnostic = await GovernmentOrganizationDiscoveryEngine.diagnoseMissingCircular(
        'https://pwd.gov.bd/circulars/123',
        'Assistant Engineer',
        {
          selectedGrades: ['10', '11'],
        }
      );

      expect(diagnostic.primaryReason).toBe('ACTIVE_FILTER_MISMATCH');
      expect(diagnostic.explanation).toContain('ফিল্টারের কারণে লুকায়িত');
    });
  });

  // =========================================================================
  // TEST GROUP 5: Dedicated Dashboard Government Jobs Section (Rule 3 & 5)
  // =========================================================================
  describe('5. Dedicated Dashboard Government Jobs Section (Rule 3 & Rule 5)', () => {
    it('renders dedicated section with live counters including both active and expired circulars (Rule 5)', async () => {
      const now = Date.now();

      // Seed mock jobs: 1 active, 1 closing soon, 1 expired, 1 exam update
      const activeJob: NormalizedJobCircular = {
        id: 'govt_job_active',
        sourceId: 'bpsc',
        sourceName: 'BPSC',
        organization: 'Ministry of Finance',
        jobTitle: 'Administrative Officer',
        position: 'Administrative Officer',
        category: 'Government',
        employmentType: 'Full Time',
        qualification: 'Bachelor',
        location: 'Dhaka',
        publishedAt: now - 2 * 86400000,
        applicationStartAt: now - 2 * 86400000,
        deadlineAt: now + 20 * 86400000,
        deadlineTimezone: 'Asia/Dhaka',
        deadlineVerified: true,
        applicationUrl: 'https://mof.teletalk.com.bd',
        description: 'Finance post',
        requirements: [],
        sourceVerification: 'official_verified',
        sourceLastCheckedAt: now,
        firstDiscoveredAt: now - 2 * 86400000,
        lastUpdatedAt: now,
        status: 'active',
      };

      const closingSoonJob: NormalizedJobCircular = {
        ...activeJob,
        id: 'govt_job_closing',
        jobTitle: 'Accounts Officer',
        deadlineAt: now + 3 * 86400000, // 3 days remaining
        status: 'closing_soon',
      };

      const expiredJob: NormalizedJobCircular = {
        ...activeJob,
        id: 'govt_job_expired',
        jobTitle: 'Senior Officer 2025',
        deadlineAt: now - 10 * 86400000, // expired
        status: 'expired',
      };

      const examUpdateJob: NormalizedJobCircular = {
        ...activeJob,
        id: 'govt_exam_update',
        jobTitle: 'BCS Written Exam Schedule',
        noticeClassification: 'RECRUITMENT_UPDATE',
        subType: 'written_exam_schedule',
      };

      mockJobsDb.set(activeJob.id, activeJob);
      mockJobsDb.set(closingSoonJob.id, closingSoonJob);
      mockJobsDb.set(expiredJob.id, expiredJob);
      mockJobsDb.set(examUpdateJob.id, examUpdateJob);

      const onNavigateTab = vi.fn();

      await act(async () => {
        root?.render(
          <GovernmentJobsOverviewSection
            language="bn"
            onNavigateTab={onNavigateTab}
          />
        );
      });
      await flushUi(100);

      // Check section presence
      expect(container.textContent).toContain('সরকারি চাকরির সার্কুলার হাব');
      expect(container.textContent).toContain('সব সরকারি চাকরি');

      // Total Govt Jobs count MUST include expired circulars (Rule 5: total 4)
      expect(container.textContent).toContain('4');

      // Click "সব সরকারি চাকরি দেখুন" (Explore All Government Jobs button)
      const buttons = Array.from(container.querySelectorAll('button'));
      const exploreBtn = buttons.find((b) => b.textContent?.includes('সব সরকারি চাকরি দেখুন'));
      expect(exploreBtn).toBeDefined();

      await act(async () => {
        exploreBtn?.click();
      });

      expect(onNavigateTab).toHaveBeenCalledWith('circulars', {
        sourceGroup: 'government_portals',
        statusTab: 'all',
      });
    });

    it('renders 8 government source category pills with click navigation', async () => {
      const onNavigateTab = vi.fn();

      await act(async () => {
        root?.render(
          <GovernmentJobsOverviewSection
            language="bn"
            onNavigateTab={onNavigateTab}
          />
        );
      });
      await flushUi(80);

      // Verify category pills are rendered
      expect(container.textContent).toContain('মন্ত্রণালয় ও অধিদপ্তর');
      expect(container.textContent).toContain('বিসিএস ও কর্ম কমিশন');
      expect(container.textContent).toContain('প্রতিরক্ষা ও পুলিশ বাহিনী');
      expect(container.textContent).toContain('বাংলাদেশ ব্যাংক ও সরকারি ব্যাংক');
      expect(container.textContent).toContain('শিক্ষা ও বিশ্ববিদ্যালয়');
      expect(container.textContent).toContain('স্বাস্থ্য ও মেডিকেল কলেজ');
      expect(container.textContent).toContain('জেলা প্রশাসন ও স্থানীয় সরকার');

      // Click on Ministry category pill
      const buttons = Array.from(container.querySelectorAll('button'));
      const ministryPill = buttons.find((b) => b.textContent?.includes('মন্ত্রণালয় ও অধিদপ্তর'));
      expect(ministryPill).toBeDefined();

      await act(async () => {
        ministryPill?.click();
      });

      expect(onNavigateTab).toHaveBeenCalledWith('circulars', {
        sourceGroup: 'government_portals',
        governmentGroup: 'ministries_divisions',
      });
    });
  });

  // =========================================================================
  // TEST GROUP 6: Production Release Package Integrity
  // =========================================================================
  describe('6. Production Release Package Integrity', () => {
    it('verifies release/JobFill-BD-Edge.zip SHA-256 hash is strictly untouched', () => {
      const edgeZipPath = path.resolve(process.cwd(), 'release/JobFill-BD-Edge.zip');
      expect(fs.existsSync(edgeZipPath), 'Edge release package must exist').toBe(true);

      const buffer = fs.readFileSync(edgeZipPath);
      const sha256 = crypto.createHash('sha256').update(buffer).digest('hex').toUpperCase();

      expect(
        sha256,
        'CRITICAL SAFETY RULE: Edge production package hash must never be modified'
      ).toBe('DB08AA45F1C3ED99AD8ADEBF5B81EDFA94812E93A02557D2306EE171AAD52732');
    });

    it('verifies release/chrome/JobFill-BD-Chrome.zip SHA-256 hash is strictly untouched', () => {
      const chromeZipPath = path.resolve(process.cwd(), 'release/chrome/JobFill-BD-Chrome.zip');
      expect(fs.existsSync(chromeZipPath), 'Chrome release package must exist').toBe(true);

      const buffer = fs.readFileSync(chromeZipPath);
      const sha256 = crypto.createHash('sha256').update(buffer).digest('hex').toUpperCase();

      expect(
        sha256,
        'CRITICAL SAFETY RULE: Chrome production package hash must never be modified'
      ).toBe('23D002185F2640CB47803A086AB39076F2C2E923AC84405C3117391D65F89DB9');
    });
  });
});
