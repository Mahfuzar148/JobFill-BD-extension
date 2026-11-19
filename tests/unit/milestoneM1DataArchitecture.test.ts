// JobFill BD - Milestone M1 Data Architecture & Storage Schema Unit Tests
// Verifies 13 normalized data models, IndexedDB schema bump to v12, and 6 lifecycle storage repositories.

import { describe, it, expect, beforeEach } from 'vitest';
import { DB_VERSION, STORES } from '../../src/database/indexeddb';
import {
  CategoryLetter,
  JobCircular,
  JobCategory,
  JobSubcategory,
  JobGrade,
  Organization,
  JobEvent,
  ExamSchedule,
  AdmitCardNotice,
  SeatPlanNotice,
  JobResult,
  SourceRegistry,
  SourceVerification,
  NoticeHistory,
  isGovernmentSector,
  isNonGovernmentCategoryLetter,
  buildNotApplicableGrade,
  buildNotSpecifiedGrade,
} from '../../src/jobs/types';
import {
  ExamScheduleRepository,
  AdmitCardNoticeRepository,
  SeatPlanNoticeRepository,
  JobResultRepository,
  JobLifecycleEventRepository,
  NoticeHistoryRepository,
  getCompleteLifecycleForCircular,
} from '../../src/jobs/database';

describe('Milestone M1: Data Architecture & Storage Schema', () => {
  beforeEach(async () => {
    // Clear stores before each test to ensure test isolation
    await ExamScheduleRepository.clearAll();
    await AdmitCardNoticeRepository.clearAll();
    await SeatPlanNoticeRepository.clearAll();
    await JobResultRepository.clearAll();
    await JobLifecycleEventRepository.clearAll();
    await NoticeHistoryRepository.clearAll();
  });

  describe('Feature 1: 13 Normalized Data Models', () => {
    it('should correctly instantiate and validate a normalized JobCircular with all 20 verified fields', () => {
      const circular: JobCircular = {
        id: 'circ_bpsc_47th_001',
        sourceId: 'bpsc_gov_bd',
        sourceName: 'Bangladesh Public Service Commission',
        organization: 'Bangladesh Public Service Commission',
        organizationBn: 'বাংলাদেশ সরকারি কর্ম কমিশন',
        jobTitle: '47th BCS Examination 2026',
        titleBn: '৪৭তম বিসিএস পরীক্ষা ২০২৬',
        position: 'Assistant Commissioner / General Cadre',
        categoryLetter: 'A',
        categoryName: 'Government Jobs',
        subcategory: 'BCS / Cadre Recruitment',
        sector: 'Government',
        organizationType: 'Constitutional Commission',
        industry: 'Public Administration',
        designation: 'Assistant Commissioner',
        grade: {
          gradeNumber: 9,
          gradeLabel: 'Grade 9',
          gradeCategory: '9',
          gradeRange: 'Grade 1–9',
          gradeVerificationStatus: 'OFFICIAL_MATCH',
          gradeOriginalText: 'জাতীয় বেতন স্কেল ২০১৫ অনুযায়ী ৯ম গ্রেড',
          payScale: 'BDT 22,000 - 53,060',
          isGovernmentGrade: true,
        },
        vacancies: 3140,
        employmentType: 'Full Time',
        salary: 'BDT 22,000 - 53,060 (Grade 9)',
        qualification: 'Bachelor',
        experience: 'Not Required',
        ageLimit: '21 to 32 Years',
        gender: 'All',
        location: 'All Bangladesh',
        applicationStartDate: '2026-01-01',
        applicationDeadline: '2026-01-31',
        officialPdfUrl: 'https://bpsc.gov.bd/sites/default/files/47th_bcs_circular.pdf',
        officialAppLink: 'http://bpsc.teletalk.com.bd',
        sourceWebsiteUrl: 'https://bpsc.gov.bd',
        publishedDate: '2025-12-20',
        updatedDate: '2026-01-05',
        publishedAt: 1766188800000,
        applicationStartAt: 1767225600000,
        deadlineAt: 1769817600000,
        deadlineTimezone: 'Asia/Dhaka',
        deadlineVerified: true,
        circularUrl: 'https://bpsc.gov.bd/sites/default/files/47th_bcs_circular.pdf',
        applicationUrl: 'http://bpsc.teletalk.com.bd',
        description: 'Recruitment for 47th Bangladesh Civil Service Cadre Posts.',
        requirements: ['Bachelor degree from recognized university'],
        sourceVerification: 'official_verified',
        sourceLastCheckedAt: Date.now(),
        firstDiscoveredAt: Date.now(),
        lastUpdatedAt: Date.now(),
        status: 'active',
      };

      expect(circular.id).toBe('circ_bpsc_47th_001');
      expect(circular.categoryLetter).toBe('A');
      expect(circular.sector).toBe('Government');
      expect(circular.grade.gradeNumber).toBe(9);
      expect(circular.grade.isGovernmentGrade).toBe(true);
      expect(circular.vacancies).toBe(3140);
      expect(circular.gender).toBe('All');
    });

    it('should enforce grade invariants: private/NGO/international categories never receive government pay grades', () => {
      const privateLetters: CategoryLetter[] = ['D', 'O', 'P', 'Q'];
      for (const letter of privateLetters) {
        expect(isNonGovernmentCategoryLetter(letter)).toBe(true);
      }

      const govtLetters: CategoryLetter[] = ['A', 'B', 'C', 'I', 'J', 'K', 'L'];
      for (const letter of govtLetters) {
        expect(isNonGovernmentCategoryLetter(letter)).toBe(false);
      }

      const privateGrade = buildNotApplicableGrade('Private Salary-Based');
      expect(privateGrade.gradeNumber).toBeNull();
      expect(privateGrade.gradeVerificationStatus).toBe('NOT_APPLICABLE');
      expect(privateGrade.isGovernmentGrade).toBe(false);

      const govtDefaultGrade = buildNotSpecifiedGrade();
      expect(govtDefaultGrade.gradeNumber).toBeNull();
      expect(govtDefaultGrade.gradeVerificationStatus).toBe('NOT_SPECIFIED');
      expect(govtDefaultGrade.isGovernmentGrade).toBe(true);
    });

    it('should validate 18-Category and Subcategory data structures', () => {
      const subcategory: JobSubcategory = {
        id: 'sub_a_bcs',
        parentCategoryLetter: 'A',
        nameEn: 'BCS & Cadre Services',
        nameBn: 'বিসিএস ও ক্যাডার সার্ভিস',
        keywords: ['bcs', 'cadre', 'bpsc'],
      };

      const category: JobCategory = {
        letter: 'A',
        id: 'cat_a_govt',
        nameEn: 'Government Jobs',
        nameBn: 'সরকারি চাকরি',
        defaultSector: 'Government',
        subcategories: [subcategory],
      };

      expect(category.letter).toBe('A');
      expect(category.subcategories.length).toBe(1);
      expect(category.subcategories[0].parentCategoryLetter).toBe('A');
      expect(isGovernmentSector(category.defaultSector)).toBe(true);
    });

    it('should validate Organization, SourceRegistry, and SourceVerification models', () => {
      const org: Organization = {
        id: 'org_bpsc',
        nameEn: 'Bangladesh Public Service Commission',
        nameBn: 'বাংলাদেশ সরকারি কর্ম কমিশন',
        shortName: 'BPSC',
        sector: 'Government',
        organizationType: 'Constitutional Commission',
        officialDomain: 'bpsc.gov.bd',
        websiteUrl: 'https://bpsc.gov.bd',
        verified: true,
      };

      const sourceReg: SourceRegistry = {
        sourceId: 'bpsc_portal',
        sourceName: 'BPSC Official Portal',
        sector: 'Government',
        categoryLetters: ['A'],
        officialDomain: 'bpsc.gov.bd',
        recruitmentPageUrl: 'https://bpsc.gov.bd/site/view/psc_exam',
        verificationStatus: 'official_verified',
        rateLimit: { requestsPerMinute: 30, cooldownMs: 2000 },
        robotPolicy: { obeysRobotsTxt: true, userAgentAllowed: true, crawlDelaySeconds: 2 },
        enabled: true,
      };

      const audit: SourceVerification = {
        sourceId: 'bpsc_portal',
        verificationStatus: 'official_verified',
        verifiedBy: 'system_security_auditor',
        auditTimestamp: Date.now(),
        officialDomainMatch: true,
        termsReviewed: true,
        complianceNotes: 'Compliant with government open portal data guidelines.',
      };

      expect(org.verified).toBe(true);
      expect(sourceReg.rateLimit.requestsPerMinute).toBe(30);
      expect(audit.officialDomainMatch).toBe(true);
    });
  });

  describe('Feature 2: IndexedDB Schema Bump to Version 12', () => {
    it('should have DB_VERSION incremented to 12', () => {
      expect(DB_VERSION).toBe(12);
    });

    it('should have all 6 additive stores registered in STORES', () => {
      expect(STORES.EXAM_SCHEDULES).toBe('exam_schedules');
      expect(STORES.ADMIT_CARD_NOTICES).toBe('admit_card_notices');
      expect(STORES.SEAT_PLAN_NOTICES).toBe('seat_plan_notices');
      expect(STORES.JOB_RESULTS).toBe('job_results');
      expect(STORES.LIFECYCLE_EVENTS).toBe('lifecycle_events');
      expect(STORES.NOTICE_HISTORY).toBe('notice_history');
    });

    it('should preserve all original 23 object stores in STORES', () => {
      expect(STORES.PROFILES).toBe('profiles');
      expect(STORES.EDUCATION_RECORDS).toBe('education_records');
      expect(STORES.EXPERIENCE_RECORDS).toBe('experience_records');
      expect(STORES.VAULT_STORE).toBe('encrypted_vault');
      expect(STORES.CREDENTIALS).toBe('credential_vault');
      expect(STORES.CV_DOCUMENTS).toBe('cv_documents');
      expect(STORES.CALENDAR_EVENTS).toBe('calendar_events');
      expect(STORES.EXAM_ATTEMPTS).toBe('exam_attempts');
      expect(STORES.VOCABULARY_ITEMS).toBe('vocabulary_items');
      expect(STORES.STUDY_NOTES).toBe('study_notes');
      expect(STORES.DOCUMENTS).toBe('documents');
      expect(STORES.MAPPINGS).toBe('mappings');
      expect(STORES.HISTORY).toBe('history');
      expect(STORES.JOBS).toBe('jobs');
      expect(STORES.BOOKMARKS).toBe('bookmarks');
      expect(STORES.APPLICATIONS).toBe('applications');
      expect(STORES.JOB_VISITS).toBe('job_visits');
      expect(STORES.NOTIFICATIONS).toBe('notifications');
      expect(STORES.SEARCH_INDEX).toBe('search_index');
      expect(STORES.SYNC_HISTORY).toBe('sync_history');
      expect(STORES.GOVT_ORGS).toBe('govt_orgs');
      expect(STORES.SOURCE_HEALTH).toBe('source_health');
      expect(STORES.MIGRATION_LOGS).toBe('migration_logs');

      // Total of 29 stores in v12
      expect(Object.keys(STORES).length).toBe(29);
    });
  });

  describe('Feature 3: Storage Repositories & Fallbacks', () => {
    it('should store and query ExamSchedule records with stage and status filtering', async () => {
      const schedule1: ExamSchedule = {
        id: 'exam_preli_47',
        circularId: 'circ_bpsc_47',
        jobTitle: '47th BCS',
        organizationName: 'BPSC',
        stage: 'Preliminary',
        status: 'Announced',
        examDate: '2026-05-15',
        examTime: '10:00 AM - 12:00 PM',
        center: 'Dhaka, Rajshahi, Chattogram, Khulna, Barishal, Sylhet, Rangpur, Mymensingh',
        venue: 'Various Examination Halls',
        noticeUrl: 'https://bpsc.gov.bd/exam_notice_47.pdf',
        updatedAt: Date.now(),
      };

      const schedule2: ExamSchedule = {
        id: 'exam_written_47',
        circularId: 'circ_bpsc_47',
        jobTitle: '47th BCS',
        organizationName: 'BPSC',
        stage: 'Written',
        status: 'Not Announced',
        updatedAt: Date.now(),
      };

      await ExamScheduleRepository.save(schedule1);
      await ExamScheduleRepository.save(schedule2);

      const allForCircular = await ExamScheduleRepository.getByCircularId('circ_bpsc_47');
      expect(allForCircular.length).toBe(2);

      const upcoming = await ExamScheduleRepository.getUpcomingExams();
      expect(upcoming.length).toBe(1);
      expect(upcoming[0].id).toBe('exam_preli_47');

      const byId = await ExamScheduleRepository.getById('exam_preli_47');
      expect(byId?.stage).toBe('Preliminary');
    });

    it('should store and query AdmitCardNotice records', async () => {
      const notice: AdmitCardNotice = {
        id: 'admit_preli_47',
        circularId: 'circ_bpsc_47',
        jobTitle: '47th BCS',
        organizationName: 'BPSC',
        stage: 'Preliminary',
        status: 'Available',
        downloadStartDate: '2026-05-01',
        downloadDeadline: '2026-05-14',
        portalUrl: 'http://bpsc.teletalk.com.bd/admitcard',
        noticeUrl: 'https://bpsc.gov.bd/admit_notice.pdf',
        instructions: 'Bring two copies of color printed admit card.',
        updatedAt: Date.now(),
      };

      await AdmitCardNoticeRepository.save(notice);

      const available = await AdmitCardNoticeRepository.getAvailableNotices();
      expect(available.length).toBe(1);
      expect(available[0].circularId).toBe('circ_bpsc_47');
      expect(available[0].portalUrl).toBe('http://bpsc.teletalk.com.bd/admitcard');
    });

    it('should store and query SeatPlanNotice records', async () => {
      const seatPlan: SeatPlanNotice = {
        id: 'seat_preli_47',
        circularId: 'circ_bpsc_47',
        stage: 'Preliminary',
        status: 'Announced',
        examDate: '2026-05-15',
        venue: 'Dhaka College & Eden College centers',
        rollRanges: 'Roll 100001 to 145000',
        noticeUrl: 'https://bpsc.gov.bd/seat_plan_47.pdf',
        updatedAt: Date.now(),
      };

      await SeatPlanNoticeRepository.save(seatPlan);

      const announced = await SeatPlanNoticeRepository.getAnnouncedNotices();
      expect(announced.length).toBe(1);
      expect(announced[0].rollRanges).toContain('100001');
    });

    it('should store and query JobResult records across 9 stages and 5 statuses', async () => {
      const result: JobResult = {
        id: 'res_preli_47',
        circularId: 'circ_bpsc_47',
        stage: 'Preliminary',
        publicationStatus: 'Result Published',
        publishedDate: '2026-06-10',
        pdfUrl: 'https://bpsc.gov.bd/47th_preli_result.pdf',
        noticeUrl: 'https://bpsc.gov.bd/result_notice_47.pdf',
        selectedCandidateCount: 15200,
        meritListAvailable: false,
        summary: '15,200 candidates qualified for 47th BCS Written Examination.',
        updatedAt: Date.now(),
      };

      await JobResultRepository.save(result);

      const published = await JobResultRepository.getPublishedResults();
      expect(published.length).toBe(1);
      expect(published[0].selectedCandidateCount).toBe(15200);
      expect(published[0].stage).toBe('Preliminary');
    });

    it('should store and query JobLifecycleEvent records and determine complete lifecycle timeline', async () => {
      const event1: JobEvent = {
        id: 'ev_pub_47',
        circularId: 'circ_bpsc_47',
        eventType: 'PUBLICATION',
        title: 'Official Circular Published',
        eventDate: '2025-12-20',
        status: 'COMPLETED',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const event2: JobEvent = {
        id: 'ev_app_47',
        circularId: 'circ_bpsc_47',
        eventType: 'APPLICATION_WINDOW',
        title: 'Online Application Window Open',
        eventDate: '2026-01-01',
        status: 'COMPLETED',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await JobLifecycleEventRepository.saveMany([event1, event2]);

      const events = await JobLifecycleEventRepository.getByCircularId('circ_bpsc_47');
      expect(events.length).toBe(2);
      expect(events[0].eventType).toBe('PUBLICATION');

      // Now aggregate full timeline via getCompleteLifecycleForCircular
      const timeline = await getCompleteLifecycleForCircular('circ_bpsc_47', '47th BCS', 'BPSC');
      expect(timeline.circularId).toBe('circ_bpsc_47');
      expect(timeline.events.length).toBe(2);
      expect(timeline.currentStage).toBe('APPLICATION_WINDOW');
    });

    it('should store and query NoticeHistory corrigenda records', async () => {
      const historyItem: NoticeHistory = {
        id: 'nh_corr_01',
        circularId: 'circ_bpsc_47',
        noticeType: 'DEADLINE_EXTENSION',
        title: 'Corrigendum: Application Deadline Extended to Feb 10, 2026',
        noticeDate: '2026-01-25',
        noticeUrl: 'https://bpsc.gov.bd/corrigendum_01.pdf',
        description: 'Application deadline extended due to public holidays.',
        changesApplied: {
          applicationDeadline: {
            oldValue: '2026-01-31',
            newValue: '2026-02-10',
          },
        },
        publishedAt: 1769385600000,
      };

      await NoticeHistoryRepository.save(historyItem);

      const notices = await NoticeHistoryRepository.getByCircularId('circ_bpsc_47');
      expect(notices.length).toBe(1);
      expect(notices[0].noticeType).toBe('DEADLINE_EXTENSION');
      expect(notices[0].changesApplied?.applicationDeadline.newValue).toBe('2026-02-10');
    });
  });
});
