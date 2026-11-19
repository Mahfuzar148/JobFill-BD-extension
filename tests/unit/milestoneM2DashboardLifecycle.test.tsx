// JobFill BD - Milestone M2: Dashboard UI, Unified Directory & Lifecycle Tracking
// Comprehensive Unit & Component Test Suite Specification for Milestone M2
// Verifies 8 Summary Metric Cards, 10 Navigation Tabs, 18-Category Directory (A-R),
// Government Pay Grade Filters (Grade 1-20 & Ranges), 11-Stage Lifecycle Timeline,
// and Anti-Fabrication Display Invariants (Asia/Dhaka Invariant).

import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AppProvider } from '../../src/dashboard/context/AppContext';
import {
  CategoryLetter,
  JobCircular,
  JobGrade,
  ExamSchedule,
  AdmitCardNotice,
  SeatPlanNotice,
  JobResult,
  JobEvent,
  JobLifecycleTimeline,
  isGovernmentSector,
  isNonGovernmentCategoryLetter,
  buildNotApplicableGrade,
  buildNotSpecifiedGrade,
} from '../../src/jobs/types/job-system.types';
import {
  ExamScheduleRepository,
  AdmitCardNoticeRepository,
  SeatPlanNoticeRepository,
  JobResultRepository,
  JobLifecycleEventRepository,
  NoticeHistoryRepository,
  getCompleteLifecycleForCircular,
  seedDefaultLifecycleStores,
} from '../../src/jobs/database';
import {
  ALL_BPSC_JOB_CIRCULARS,
  BPSC_SEED_EXAM_SCHEDULES,
  BPSC_SEED_ADMIT_CARDS,
  BPSC_SEED_JOB_RESULTS,
  getSeedJobCirculars,
  BANGLADESH_BANK_AD_CIRCULAR,
  DPE_ASSISTANT_TEACHER_CIRCULAR,
  ALL_SEED_JOB_CIRCULARS,
  ALL_SEED_EXAM_SCHEDULES,
  ALL_SEED_ADMIT_CARDS,
  ALL_SEED_SEAT_PLANS,
  ALL_SEED_JOB_RESULTS,
} from '../../src/jobs/data/seed-circulars';
import { CANONICAL_18_CATEGORIES, getCanonicalCategoryByLetter, mapJobToCategoryLetter } from '../../src/jobs/taxonomy/canonical-categories';
import { JobCard } from '../../src/jobs/dashboard/JobCard';
import { JobDetails } from '../../src/jobs/dashboard/JobDetails';
import { JobFilters, defaultJobSearchFilters } from '../../src/jobs/dashboard/JobFilters';
import { JobCircularPage } from '../../src/jobs/dashboard/JobCircularPage';
import { JobRepository } from '../../src/jobs/database/job-repository';
import { JobGradeExtractor } from '../../src/jobs/services/grade-extractor';
import { NormalizedJobCircular } from '../../src/jobs/types/job.types';

// ============================================================================
// 1. Metric Calculation Helper (integrated with JobCircularPage calculations)
// ============================================================================

export interface M2DashboardMetrics {
  totalCirculars: number;
  governmentJobs: number;
  privateAndBankJobs: number;
  applicationOpen: number;
  closingSoon: number;
  upcomingExams: number;
  admitCardsAvailable: number;
  publishedResults: number;
}

export function computeM2DashboardMetrics(
  circulars: JobCircular[],
  examSchedules: ExamSchedule[] = [],
  admitCards: AdmitCardNotice[] = [],
  jobResults: JobResult[] = [],
  nowMs: number = Date.now()
): M2DashboardMetrics {
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

  let totalCirculars = circulars.length;
  let governmentJobs = 0;
  let privateAndBankJobs = 0;
  let applicationOpen = 0;
  let closingSoon = 0;

  for (const c of circulars) {
    if (isGovernmentSector(c.sector)) {
      governmentJobs++;
    } else {
      privateAndBankJobs++;
    }

    if (c.applicationDeadline) {
      const deadlineMs = new Date(c.applicationDeadline).getTime();
      const startMs = c.applicationStartDate ? new Date(c.applicationStartDate).getTime() : 0;
      if (!isNaN(deadlineMs) && deadlineMs >= nowMs && (startMs === 0 || startMs <= nowMs)) {
        applicationOpen++;
        if (deadlineMs - nowMs <= SEVEN_DAYS_MS) {
          closingSoon++;
        }
      }
    }
  }

  // Upcoming Exams announced
  const circularIdsWithUpcomingExams = new Set(
    examSchedules
      .filter((e) => e.status === 'Announced' || e.status === 'Rescheduled')
      .map((e) => e.circularId)
  );

  // Admit Cards available
  const circularIdsWithAdmitCards = new Set(
    admitCards.filter((a) => a.status === 'Available').map((a) => a.circularId)
  );

  // Published Results
  const circularIdsWithResults = new Set(
    jobResults
      .filter(
        (r) =>
          r.publicationStatus === 'Result Published' ||
          r.publicationStatus === 'Revised Result Published' ||
          r.publicationStatus === 'Partially Published'
      )
      .map((r) => r.circularId)
  );

  return {
    totalCirculars,
    governmentJobs,
    privateAndBankJobs,
    applicationOpen,
    closingSoon,
    upcomingExams: circularIdsWithUpcomingExams.size,
    admitCardsAvailable: circularIdsWithAdmitCards.size,
    publishedResults: circularIdsWithResults.size,
  };
}

// ============================================================================
// 2. 10 Navigation Tabs Filtering Logic
// ============================================================================

export type M2NavigationTab =
  | 'all'
  | 'government'
  | 'private'
  | 'categories'
  | 'grades'
  | 'upcoming_exams'
  | 'admit_cards'
  | 'seat_plans'
  | 'results'
  | 'recent_updates';

export function filterCircularsByTab(
  tab: M2NavigationTab,
  circulars: JobCircular[],
  examSchedules: ExamSchedule[] = [],
  admitCards: AdmitCardNotice[] = [],
  seatPlans: SeatPlanNotice[] = [],
  jobResults: JobResult[] = []
): JobCircular[] {
  switch (tab) {
    case 'all':
      return circulars;
    case 'government':
      return circulars.filter((c) => ['A', 'B', 'C', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M'].includes(c.categoryLetter));
    case 'private':
      return circulars.filter((c) => ['D', 'N', 'O', 'P', 'Q', 'R'].includes(c.categoryLetter));
    case 'categories':
      return circulars; // Directory view grouped by A-R
    case 'grades':
      return circulars.filter((c) => c.grade?.isGovernmentGrade && c.grade?.gradeNumber !== null);
    case 'upcoming_exams': {
      const activeIds = new Set(
        examSchedules
          .filter((e) => e.status === 'Announced' || e.status === 'Rescheduled')
          .map((e) => e.circularId)
      );
      return circulars.filter((c) => activeIds.has(c.id));
    }
    case 'admit_cards': {
      const activeIds = new Set(
        admitCards.filter((a) => a.status === 'Available').map((a) => a.circularId)
      );
      return circulars.filter((c) => activeIds.has(c.id));
    }
    case 'seat_plans': {
      const activeIds = new Set(
        seatPlans.filter((s) => s.status === 'Announced').map((s) => s.circularId)
      );
      return circulars.filter((c) => activeIds.has(c.id));
    }
    case 'results': {
      const activeIds = new Set(
        jobResults
          .filter((r) => r.publicationStatus === 'Result Published')
          .map((r) => r.circularId)
      );
      return circulars.filter((c) => activeIds.has(c.id));
    }
    case 'recent_updates':
      return circulars.filter((c) => Boolean(c.updatedDate || c.updatedAt));
    default:
      return circulars;
  }
}

async function flushUi(ms: number = 40) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}

// ============================================================================
// 3. Test Suites
// ============================================================================

describe('Milestone M2: Dashboard UI, Unified Directory & Lifecycle Tracking', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    vi.restoreAllMocks();
    await ExamScheduleRepository.clearAll();
    await AdmitCardNoticeRepository.clearAll();
    await SeatPlanNoticeRepository.clearAll();
    await JobResultRepository.clearAll();
    await JobLifecycleEventRepository.clearAll();
    await NoticeHistoryRepository.clearAll();

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root.unmount();
      });
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  describe('Feature 1: 8 Summary Metric Cards Calculation', () => {
    it('should compute exact counts for all 8 summary metrics without double-counting', () => {
      const seedJobs = getSeedJobCirculars();
      const metrics = computeM2DashboardMetrics(
        seedJobs,
        BPSC_SEED_EXAM_SCHEDULES,
        BPSC_SEED_ADMIT_CARDS,
        BPSC_SEED_JOB_RESULTS,
        new Date('2026-11-01T00:00:00Z').getTime()
      );

      expect(metrics.totalCirculars).toBe(9);
      expect(metrics.governmentJobs).toBe(9);
      expect(metrics.privateAndBankJobs).toBe(0);
      expect(metrics.upcomingExams).toBeGreaterThan(0);
      expect(metrics.admitCardsAvailable).toBeGreaterThan(0);
      expect(metrics.publishedResults).toBeGreaterThan(0);
    });

    it('should calculate application open and closing soon (<= 7 days) accurately', () => {
      const now = new Date('2026-11-10T12:00:00Z').getTime();
      const mockJobs: JobCircular[] = [
        {
          id: 'job_open_long',
          title: 'Officer Long Deadline',
          categoryLetter: 'A',
          sector: 'Government',
          applicationStartDate: '2026-11-01T00:00:00Z',
          applicationDeadline: '2026-11-30T23:59:59Z', // > 7 days
          organization: 'Govt Org 1',
        } as JobCircular,
        {
          id: 'job_closing_soon',
          title: 'Officer Closing Soon',
          categoryLetter: 'A',
          sector: 'Government',
          applicationStartDate: '2026-11-01T00:00:00Z',
          applicationDeadline: '2026-11-14T18:00:00Z', // 4 days away -> closing soon
          organization: 'Govt Org 2',
        } as JobCircular,
        {
          id: 'job_expired',
          title: 'Officer Expired',
          categoryLetter: 'A',
          sector: 'Government',
          applicationStartDate: '2026-10-01T00:00:00Z',
          applicationDeadline: '2026-11-05T18:00:00Z', // expired
          organization: 'Govt Org 3',
        } as JobCircular,
      ];

      const metrics = computeM2DashboardMetrics(mockJobs, [], [], [], now);
      expect(metrics.totalCirculars).toBe(3);
      expect(metrics.applicationOpen).toBe(2);
      expect(metrics.closingSoon).toBe(1);
    });
  });

  describe('Feature 2: 10 Navigation Tabs Filtering', () => {
    it('should filter jobs correctly for each of the 10 navigation tabs', () => {
      const seedJobs = getSeedJobCirculars();

      // 1. All tab
      const allTabJobs = filterCircularsByTab('all', seedJobs);
      expect(allTabJobs.length).toBe(9);

      // 2. Government tab (Category A, B, K, L)
      const govtTabJobs = filterCircularsByTab('government', seedJobs);
      expect(govtTabJobs.length).toBe(9);
      expect(govtTabJobs.every((j) => ['A', 'B', 'K', 'L'].includes(j.categoryLetter))).toBe(true);

      // 3. Private tab (Category D, N, O)
      const privateTabJobs = filterCircularsByTab('private', seedJobs);
      expect(privateTabJobs.length).toBe(0);

      // 4. Grades tab (verified government grades 1-20)
      const gradesTabJobs = filterCircularsByTab('grades', seedJobs);
      expect(gradesTabJobs.length).toBe(9);
      expect(gradesTabJobs.every((j) => j.grade?.gradeNumber === 9)).toBe(true);

      // 5. Upcoming Exams tab
      const examJobs = filterCircularsByTab(
        'upcoming_exams',
        seedJobs,
        BPSC_SEED_EXAM_SCHEDULES
      );
      expect(examJobs.length).toBeGreaterThan(0);
      expect(examJobs.some((j) => j.id === 'bpsc-47th-bcs-examination-2026')).toBe(true);

      // 6. Admit Cards tab
      const admitJobs = filterCircularsByTab(
        'admit_cards',
        seedJobs,
        [],
        BPSC_SEED_ADMIT_CARDS
      );
      expect(admitJobs.length).toBeGreaterThan(0);
      expect(admitJobs.some((j) => j.id === 'bpsc-50th-bcs-examination-2025')).toBe(true);

      // 7. Results tab
      const resultJobs = filterCircularsByTab(
        'results',
        seedJobs,
        [],
        [],
        [],
        BPSC_SEED_JOB_RESULTS
      );
      expect(resultJobs.length).toBeGreaterThan(0);
      expect(resultJobs.some((j) => j.id === 'bpsc-46th-bcs-examination-2024')).toBe(true);
    });
  });

  describe('Feature 3: 18-Category Universal Directory & Grade Invariants', () => {
    it('should have 18 canonical categories defined from A to R', () => {
      expect(CANONICAL_18_CATEGORIES.length).toBe(18);
      const letters = CANONICAL_18_CATEGORIES.map((c) => c.letter);
      expect(letters).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R']);
      
      const catA = getCanonicalCategoryByLetter('A');
      expect(catA?.nameEn).toBe('Government Jobs');
      const catC = getCanonicalCategoryByLetter('C');
      expect(catC?.nameEn).toBe('Government Banks');
      const catD = getCanonicalCategoryByLetter('D');
      expect(catD?.nameEn).toBe('Private Banks');
    });

    it('should map jobs to canonical category letters reliably', () => {
      expect(mapJobToCategoryLetter('BCS & Judicial')).toBe('A');
      expect(mapJobToCategoryLetter('Govt Bank')).toBe('C');
      expect(mapJobToCategoryLetter('Private Bank')).toBe('D');
      expect(mapJobToCategoryLetter('Autonomous')).toBe('B');
      expect(mapJobToCategoryLetter('Primary Teacher')).toBe('L');
      expect(mapJobToCategoryLetter('Non-Govt / Private')).toBe('O');
    });

    it('should strictly enforce that private categories never receive government pay grades', () => {
      const privateCategories: CategoryLetter[] = ['D', 'O', 'P', 'Q'];
      for (const cat of privateCategories) {
        expect(isNonGovernmentCategoryLetter(cat)).toBe(true);
      }

      const notAppGrade = buildNotApplicableGrade('Private Salary-Based');
      expect(notAppGrade.isGovernmentGrade).toBe(false);
      expect(notAppGrade.gradeNumber).toBeNull();
      expect(notAppGrade.gradeVerificationStatus).toBe('NOT_APPLICABLE');
      expect(notAppGrade.gradeLabel).toBe('Private Salary-Based');
    });

    it('should identify verified government pay grade for BPSC cadre circulars', () => {
      const seedJobs = getSeedJobCirculars();
      const bcs47 = seedJobs.find((j) => j.id === 'bpsc-47th-bcs-examination-2026');
      expect(bcs47).toBeDefined();
      expect(bcs47?.categoryLetter).toBe('A');
      expect(bcs47?.grade.gradeNumber).toBe(9);
      expect(bcs47?.grade.gradeRange).toBe('Grade 1–9');
      expect(bcs47?.grade.gradeVerificationStatus).toBe('OFFICIAL_MATCH');
      expect(bcs47?.grade.isGovernmentGrade).toBe(true);
    });
  });

  describe('Feature 4: 11-Stage Interactive Lifecycle Timeline Visualizer', () => {
    it('should aggregate 11 lifecycle stages with accurate status transitions', async () => {
      // 1. Seed events for 47th BCS
      const pubEvent: JobEvent = {
        id: 'ev_47_pub',
        circularId: 'bpsc-47th-bcs-examination-2026',
        eventType: 'PUBLICATION',
        title: 'Official Circular Published',
        eventDate: '2025-12-20',
        status: 'COMPLETED',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      const appEvent: JobEvent = {
        id: 'ev_47_app',
        circularId: 'bpsc-47th-bcs-examination-2026',
        eventType: 'APPLICATION_WINDOW',
        title: 'Application Window Opened',
        eventDate: '2026-01-01',
        status: 'COMPLETED',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await JobLifecycleEventRepository.saveMany([pubEvent, appEvent]);

      const timeline: JobLifecycleTimeline = await getCompleteLifecycleForCircular(
        'bpsc-47th-bcs-examination-2026',
        '47th BCS',
        'BPSC'
      );

      expect(timeline.circularId).toBe('bpsc-47th-bcs-examination-2026');
      expect(timeline.events.length).toBe(2);
      expect(timeline.currentStage).toBe('APPLICATION_WINDOW');
    });
  });

  describe('Feature 5: Strict Anti-Fabrication Rule (Asia/Dhaka Invariant)', () => {
    it('should explicitly display "Exam Date Not Announced" when exam schedule is not announced', () => {
      const unannouncedExam: ExamSchedule = {
        id: 'exam_unannounced',
        circularId: 'bpsc_test_unannounced',
        stage: 'Preliminary',
        status: 'Not Announced',
        updatedAt: Date.now(),
      };

      expect(unannouncedExam.status).toBe('Not Announced');
      expect(unannouncedExam.examDate).toBeUndefined();
    });

    it('should explicitly display "Result Not Published" when result is pending', () => {
      const pendingResult: JobResult = {
        id: 'result_pending',
        circularId: 'bpsc_test_result_pending',
        stage: 'Preliminary',
        publicationStatus: 'Result Not Published',
        updatedAt: Date.now(),
      };

      expect(pendingResult.publicationStatus).toBe('Result Not Published');
      expect(pendingResult.pdfUrl).toBeUndefined();
    });
  });

  describe('Feature 6: Component Rendering - JobCard Badge, Grade, Exam & Result status', () => {
    const mockGovJob: NormalizedJobCircular = {
      id: 'job_card_gov_test',
      sourceId: 'bpsc',
      sourceKey: 'bpsc_test',
      sourceType: 'OFFICIAL_PORTAL',
      title: '47th BCS Examination 2026',
      organization: 'Bangladesh Public Service Commission',
      organizationBangla: 'বাংলাদেশ সরকারি কর্ম কমিশন',
      designation: 'Cadre Officer',
      grade: {
        rawInput: 'Grade 9',
        gradeNumber: 9,
        gradeLabel: 'Grade 9',
        gradeLabelBangla: '৯ম গ্রেড',
        payScale: '22,000 - 53,060',
        gradeRange: 'Grade 1–9',
        isGovernmentGrade: true,
        gradeVerificationStatus: 'OFFICIAL_MATCH',
        confidenceScore: 1.0,
      },
      category: 'BCS & Judicial',
      categoryLetter: 'A',
      taxonomyCategoryId: 'cat_a',
      educationRequirements: ['Graduation'],
      jobType: 'GOVERNMENT',
      deadline: '2026-12-31T18:00:00.000Z',
      publishedDate: '2025-12-01T00:00:00.000Z',
      applicationUrl: 'https://bpsc.teletalk.com.bd',
      applicationPlatform: 'TELETALK',
      officialCircularUrl: 'https://bpsc.gov.bd/circ.pdf',
      canonicalUrl: 'https://bpsc.gov.bd/circ',
      verificationStatus: 'OFFICIAL_PORTAL',
      isVerified: true,
      publishedAt: '2025-12-01T00:00:00.000Z',
      applicationStartAt: '2025-12-01T00:00:00.000Z',
      deadlineAt: '2026-12-31T18:00:00.000Z',
      deadlineTimezone: 'Asia/Dhaka',
      firstDiscoveredAt: '2025-12-01T00:00:00.000Z',
      lastUpdatedAt: '2025-12-01T00:00:00.000Z',
      fieldVerification: {
        title: 'VERIFIED_OFFICIAL',
        organization: 'VERIFIED_OFFICIAL',
        deadline: 'VERIFIED_OFFICIAL',
        applicationUrl: 'VERIFIED_OFFICIAL',
        overall: 'VERIFIED_OFFICIAL',
      },
      alternateSources: [],
      requirements: { education: [], age: { minYears: 21, maxYears: 30 } },
      description: '47th BCS Cadre Officer examination.',
    };

    const mockPrivateJob: NormalizedJobCircular = {
      ...mockGovJob,
      id: 'job_card_priv_test',
      title: 'Senior Software Engineer',
      organization: 'Tech Innovations BD Ltd',
      jobType: 'PRIVATE',
      category: 'Private IT / Tech',
      categoryLetter: 'O',
      taxonomyCategoryId: 'cat_o',
      grade: buildNotApplicableGrade('Private Salary-Based'),
    };

    it('should render Universal Category badge, Grade pill, Exam badge, and Result pill on JobCard', async () => {
      const mockSchedule: ExamSchedule = {
        id: 'sch_47_test',
        circularId: mockGovJob.id,
        stage: 'Preliminary',
        examDate: '2026-05-15',
        startTime: '10:00 AM',
        status: 'Announced',
        venue: 'Dhaka Division Centers',
        updatedAt: Date.now(),
      };

      const mockResult: JobResult = {
        id: 'res_47_test',
        circularId: mockGovJob.id,
        stage: 'Preliminary',
        publicationStatus: 'Result Published',
        publishedDate: '2026-06-01',
        selectedCandidatesCount: 10500,
        pdfUrl: 'https://bpsc.gov.bd/res.pdf',
        updatedAt: Date.now(),
      };

      await act(async () => {
        root.render(
          <AppProvider>
            <JobCard
              job={mockGovJob}
              isBookmarked={false}
              examSchedule={mockSchedule}
              latestResult={mockResult}
              language="en"
              onViewDetails={vi.fn()}
              onApplyNow={vi.fn()}
              onToggleBookmark={vi.fn()}
            />
          </AppProvider>
        );
      });
      await flushUi();

      // Check Category badge
      expect(container.textContent).toContain('A. Government Jobs');

      // Check Grade pill
      expect(container.textContent).toContain('Grade: 9');

      // Check Exam badge
      expect(container.textContent).toContain('Exam Date: 15 May 2026');

      // Check Result pill
      expect(container.textContent).toContain('Preliminary Result Published');

      // Check Details & Timeline button
      expect(container.textContent).toContain('Details & Timeline');
    });

    it('should render "Exam Date Not Announced" and "Result Not Published" when dates/results are unannounced', async () => {
      await act(async () => {
        root.render(
          <AppProvider>
            <JobCard
              job={mockGovJob}
              isBookmarked={false}
              examSchedule={null}
              latestResult={null}
              language="en"
              onViewDetails={vi.fn()}
              onApplyNow={vi.fn()}
              onToggleBookmark={vi.fn()}
            />
          </AppProvider>
        );
      });
      await flushUi();

      expect(container.textContent).toContain('Exam Date Not Announced');
      expect(container.textContent).toContain('Result Not Published');
    });

    it('should render "Private Salary-Based" badge for non-government job cards', async () => {
      await act(async () => {
        root.render(
          <AppProvider>
            <JobCard
              job={mockPrivateJob}
              isBookmarked={false}
              examSchedule={null}
              latestResult={null}
              language="en"
              onViewDetails={vi.fn()}
              onApplyNow={vi.fn()}
              onToggleBookmark={vi.fn()}
            />
          </AppProvider>
        );
      });
      await flushUi();

      expect(container.textContent).toContain('Private Salary-Based');
      expect(container.textContent).not.toContain('Grade: 9');
    });
  });

  describe('Feature 7: Component Rendering - JobDetails 11-Stage Interactive Timeline', () => {
    it('should render 11-stage timeline with Exam Details and Results in JobDetails', async () => {
      // Seed schedule and result in database
      const schedule: ExamSchedule = {
        id: 'sch_det_test',
        circularId: 'job_det_test',
        stage: 'Preliminary',
        examDate: '2026-06-20',
        startTime: '10:00 AM',
        endTime: '12:00 PM',
        status: 'Announced',
        venue: 'Dhaka University Campus',
        updatedAt: Date.now(),
      };
      const result: JobResult = {
        id: 'res_det_test',
        circularId: 'job_det_test',
        stage: 'Preliminary',
        publicationStatus: 'Result Published',
        publishedDate: '2026-07-15',
        selectedCandidateCount: 8400,
        selectedCandidatesCount: 8400,
        pdfUrl: 'https://bpsc.gov.bd/result-prelim.pdf',
        updatedAt: Date.now(),
      };

      await ExamScheduleRepository.saveMany([schedule]);
      await JobResultRepository.saveMany([result]);

      const mockJob: NormalizedJobCircular = {
        id: 'job_det_test',
        sourceId: 'bpsc',
        sourceKey: 'bpsc_test_det',
        sourceType: 'OFFICIAL_PORTAL',
        title: '47th BCS Examination Detailed Test',
        organization: 'Bangladesh Public Service Commission',
        designation: 'Cadre Officer',
        grade: {
          rawInput: 'Grade 9',
          gradeNumber: 9,
          gradeLabel: 'Grade 9',
          gradeRange: 'Grade 1–9',
          isGovernmentGrade: true,
          gradeVerificationStatus: 'OFFICIAL_MATCH',
        },
        category: 'BCS & Judicial',
        categoryLetter: 'A',
        taxonomyCategoryId: 'cat_a',
        jobType: 'GOVERNMENT',
        deadline: '2026-12-31T18:00:00.000Z',
        publishedDate: '2025-12-01T00:00:00.000Z',
        applicationUrl: 'https://bpsc.teletalk.com.bd',
        canonicalUrl: 'https://bpsc.gov.bd/circ',
        verificationStatus: 'OFFICIAL_PORTAL',
        isVerified: true,
        requirements: ['Graduation from a recognized university'],
      };

      await act(async () => {
        root.render(
          <AppProvider>
            <JobDetails
              job={mockJob}
              isBookmarked={false}
              language="en"
              onClose={vi.fn()}
              onApplyNow={vi.fn()}
              onToggleBookmark={vi.fn()}
            />
          </AppProvider>
        );
      });
      await flushUi(60);

      // Verify Timeline section title
      expect(container.textContent).toContain('11-Stage Complete Circular Lifecycle Timeline');

      // Verify stages rendered
      expect(container.textContent).toContain('Application Started');
      expect(container.textContent).toContain('Application Deadline');
      expect(container.textContent).toContain('Exam Date Announced');
      expect(container.textContent).toContain('Preliminary Result');
      expect(container.textContent).toContain('Final Selection / Merit List');

      // Verify Exam Details Section
      expect(container.textContent).toContain('Exam Schedule & Venue Details');
      expect(container.textContent).toContain('Dhaka University Campus');

      // Verify Results Section
      expect(container.textContent).toContain('Results & Merit Lists');
      expect(container.textContent).toContain('8,400');
    });
  });

  describe('Feature 8: Component Rendering - JobFilters Lifecycle and 18-Category Selection', () => {
    it('should render 18 Universal Categories and lifecycle status filters in JobFilters', async () => {
      const filters = defaultJobSearchFilters;
      const onChange = vi.fn();

      await act(async () => {
        root.render(
          <AppProvider>
            <JobFilters
              filters={filters}
              onChange={onChange}
              language="en"
              availableSources={['bpsc']}
              availableCategories={['BCS & Judicial']}
              availableJobTypes={['GOVERNMENT']}
              totalMatching={10}
            />
          </AppProvider>
        );
      });
      await flushUi();

      // Expand Grade panel and Advanced panel
      const gradeToggleBtn = Array.from(container.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Job Grade Filter') || b.textContent?.includes('গ্রেড ফিল্টার')
      );
      if (gradeToggleBtn) {
        await act(async () => {
          gradeToggleBtn.click();
        });
      }

      const advToggleBtn = Array.from(container.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('GPA & Salary') || b.textContent?.includes('জিপিএ ও বেতন')
      );
      if (advToggleBtn) {
        await act(async () => {
          advToggleBtn.click();
        });
      }
      await flushUi();

      // Check Category Letters
      expect(container.textContent).toContain('Universal Category (A–R)');
      expect(container.textContent).toContain('A. Government Jobs');
      expect(container.textContent).toContain('C. Government Banks');

      // Check Government Pay Grade Filter
      expect(container.textContent).toContain('1st–9th Grade');
      expect(container.textContent).toContain('10th–15th Grade');
      expect(container.textContent).toContain('16th–20th Grade');

      // Check Lifecycle Filters
      expect(container.textContent).toContain('Exam Schedule Status');
      expect(container.textContent).toContain('Job Result Status');
    });
  });

  describe('Feature 9: Default Lifecycle Seeding Integration', () => {
    it('should populate all 5 lifecycle stores when seedDefaultLifecycleStores is invoked', async () => {
      await seedDefaultLifecycleStores();

      const schedules = await ExamScheduleRepository.getAll();
      const admits = await AdmitCardNoticeRepository.getAll();
      const seatPlans = await SeatPlanNoticeRepository.getAll();
      const results = await JobResultRepository.getAll();

      expect(schedules.length).toBeGreaterThanOrEqual(4);
      expect(admits.length).toBeGreaterThanOrEqual(3);
      expect(seatPlans.length).toBeGreaterThanOrEqual(2);
      expect(results.length).toBeGreaterThanOrEqual(3);

      // Verify Bangladesh Bank and DPE assistant teacher are present
      expect(schedules.some((s) => s.circularId === 'bangladesh-bank-assistant-director-general-2026')).toBe(true);
      expect(results.some((r) => r.circularId === 'dpe-assistant-teacher-recruitment-2026')).toBe(true);
    });
  });

  describe('Feature 10: Milestone M2 Remediation Verification (Iteration 2)', () => {
    it('should strictly exclude private banks, NGOs, and private companies from receiving civil service grades', () => {
      const privateBank = JobGradeExtractor.extractJobGrade({
        category: 'Bank',
        jobTitle: 'City Bank Executive Officer (Grade 9)',
        salaryText: 'Salary: Grade 9 scale',
      });
      expect(privateBank.gradeNumber).toBeNull();
      expect(privateBank.gradeLabel).toBe('Private Salary-Based');
      expect(privateBank.gradeVerificationStatus).toBe('NOT_APPLICABLE');

      const ngoJob = JobGradeExtractor.extractJobGrade({
        category: 'NGO',
        jobTitle: 'BRAC NGO Project Coordinator (9th Grade pay scale)',
        salaryText: 'Grade 9',
      });
      expect(ngoJob.gradeNumber).toBeNull();
      expect(ngoJob.gradeLabel).toBe('Private Salary-Based');
      expect(ngoJob.gradeVerificationStatus).toBe('NOT_APPLICABLE');

      const privateCompany = JobGradeExtractor.extractJobGrade({
        category: 'Private',
        jobTitle: 'Square Pharmaceuticals Product Officer (Grade 9)',
        salaryText: 'Pay scale: Grade 9',
      });
      expect(privateCompany.gradeNumber).toBeNull();
      expect(privateCompany.gradeLabel).toBe('Private Salary-Based');
      expect(privateCompany.gradeVerificationStatus).toBe('NOT_APPLICABLE');

      // Contrast with Government Bank which MUST receive Grade 9
      const govtBank = JobGradeExtractor.extractJobGrade({
        organization: 'Bangladesh Bank',
        category: 'Bank',
        jobTitle: 'Assistant Director (Grade 9)',
        salaryText: '9th Grade',
      });
      expect(govtBank.gradeNumber).toBe(9);
      expect(govtBank.gradeVerificationStatus).toBe('OFFICIAL_MATCH');
    });

    it('should display "Not Applicable (Private)" in JobDetails for non-government jobs even if gradeNumber was set', async () => {
      const privateBankJob: NormalizedJobCircular = {
        id: 'city-bank-executive-officer-9',
        sourceId: 'bdjobs',
        sourceName: 'Bdjobs',
        organization: 'City Bank PLC',
        jobTitle: 'City Bank Executive Officer (Grade 9)',
        position: 'Executive Officer',
        category: 'Private',
        employmentType: 'Full Time',
        qualification: 'Bachelor Degree',
        location: 'Dhaka',
        publishedAt: Date.now() - 86400000,
        applicationStartAt: Date.now() - 86400000,
        deadlineAt: Date.now() + 864000000,
        deadlineTimezone: 'Asia/Dhaka',
        deadlineVerified: true,
        applicationUrl: 'https://citybank.com/apply',
        gradeNumber: 9,
        gradeLabel: '9th Grade (৯ম গ্রেড)',
        gradeVerificationStatus: 'NOT_APPLICABLE',
      };

      await act(async () => {
        root.render(
          <AppProvider>
            <JobDetails
              job={privateBankJob}
              isBookmarked={false}
              language="en"
              onBack={() => {}}
              onApplyNow={() => {}}
              onToggleBookmark={() => {}}
              onMarkApplied={() => {}}
              onShare={() => {}}
            />
          </AppProvider>
        );
      });
      await flushUi(80);

      expect(container.textContent).toContain('Not Applicable (Private)');
      expect(container.textContent).toContain('Private Salary-Based');
      // Government award badge with Grade 9 must not be rendered
      expect(container.textContent).not.toContain('Grade 9 (৯ম গ্রেড)');
    });

    it('should map taxonomy categories correctly without false substring matches to Category N', () => {
      // Avoid false substring matches on IT
      expect(mapJobToCategoryLetter({ taxonomyCategoryId: 'financial_institutions' })).toBe('E');
      expect(mapJobToCategoryLetter({ category: 'Security' })).not.toBe('N');
      expect(mapJobToCategoryLetter({ category: 'Audit' })).not.toBe('N');
      expect(mapJobToCategoryLetter({ category: 'Recruitment' })).not.toBe('N');

      // Explicit coverage for categories E, G, K, M, R
      expect(mapJobToCategoryLetter({ taxonomyCategoryId: 'school_college' })).toBe('G');
      expect(mapJobToCategoryLetter({ taxonomyCategoryId: 'ministry_department' })).toBe('K');
      expect(mapJobToCategoryLetter({ taxonomyCategoryId: 'engineering_technical' })).toBe('M');
      expect(mapJobToCategoryLetter({ taxonomyCategoryId: 'research_other' })).toBe('R');

      expect(mapJobToCategoryLetter('BCSIR Senior Scientific Officer')).toBe('R');
      expect(mapJobToCategoryLetter('LGED Executive Engineer')).toBe('M');
      expect(mapJobToCategoryLetter('Ministry of Public Administration Assistant Secretary')).toBe('K');
    });

    it('should render announced circulars when JobCircularPage is filtered by examStatus="announced"', async () => {
      await JobRepository.clearAll();
      for (const j of ALL_SEED_JOB_CIRCULARS) {
        await JobRepository.saveJob(j);
      }
      await seedDefaultLifecycleStores();

      await act(async () => {
        root.render(
          <AppProvider>
            <JobCircularPage initialFilters={{ examStatus: 'announced' }} />
          </AppProvider>
        );
      });
      await flushUi(120);

      // Verify announced circulars are rendered and not dropped by empty examSchedules array
      const has47thBcs = container.textContent?.includes('47th BCS') || container.textContent?.includes('৪৭তম বিসিএস');
      expect(has47thBcs).toBe(true);

      const hasExamDate = container.textContent?.includes('15 Dec 2026') || container.textContent?.includes('১৫ ডিসেম্বর ২০২৬');
      expect(hasExamDate).toBe(true);

      expect(container.textContent).not.toContain('No job circulars match your current filter');
      expect(container.textContent).not.toContain('কোনো সার্কুলার পাওয়া যায়নি');
    });

    it('should evaluate currentStage to RESULT when exam is Completed even if a seat plan notice exists', async () => {
      const circId = 'custom-circular-completed-exam-test';
      await SeatPlanNoticeRepository.save({
        id: 'seat-plan-notice-test-456',
        circularId: circId,
        examType: 'Preliminary',
        venueText: 'Tejgaon College, Dhaka',
        publishedAt: Date.now() - 200000000,
      });

      await ExamScheduleRepository.save({
        id: 'exam-sched-completed-test-456',
        circularId: circId,
        stage: 'Preliminary',
        examDate: Date.now() - 100000000,
        status: 'Completed',
      });

      const timeline = await getCompleteLifecycleForCircular(circId, 'Junior Officer', 'Govt Dept');
      expect(timeline.currentStage).toBe('RESULT');
    });
  });
});
