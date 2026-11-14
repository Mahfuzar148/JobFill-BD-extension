import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  HistoryRepository,
  sanitizeHistoryFieldRecord,
  sanitizeHistoryRecord,
} from '../../src/database/history-repository';
import {
  getAutofillHistory,
  addAutofillHistory,
  deleteAutofillHistoryItem,
  clearAutofillHistory,
} from '../../src/services/storage';
import { AutofillHistoryRecord, AutofillFieldAuditItem } from '../../src/types/profile';
import { ApplicationRepository } from '../../src/jobs/database/application-repository';
import { MessageRouter } from '../../src/background/message-router';

describe('Application Autofill History & Tracking Pipeline', () => {
  beforeEach(async () => {
    localStorage.clear();
    await HistoryRepository.clearHistory();
    await ApplicationRepository.clearAll();
  });

  describe('1. Field Sanitization & Privacy Shield', () => {
    it('strictly redacts plaintext passwords, OTPs, PINs, and CAPTCHAs', () => {
      expect(sanitizeHistoryFieldRecord('auth.password', 'Password', 'SecretPass123!')).toBe('[PROTECTED]');
      expect(sanitizeHistoryFieldRecord('login.userPassword', 'User Password', 'admin123')).toBe('[PROTECTED]');
      expect(sanitizeHistoryFieldRecord('verification.otpCode', 'OTP Code', '492810')).toBe('[PROTECTED]');
      expect(sanitizeHistoryFieldRecord('security.pin', 'ATM PIN', '1234')).toBe('[PROTECTED]');
      expect(sanitizeHistoryFieldRecord('form.captchaInput', 'Security Captcha', 'k7x9p')).toBe('[PROTECTED]');
      expect(sanitizeHistoryFieldRecord('api.token', 'Session Token', 'eyJhbGciOi...')).toBe('[PROTECTED]');
    });

    it('masks National ID and Passport numbers to protect citizen privacy', () => {
      expect(sanitizeHistoryFieldRecord('personal.nidNumber', 'National ID', '19951234567890123')).toBe('***0123');
      expect(sanitizeHistoryFieldRecord('personal.passportNo', 'Passport No', 'EG0987654')).toBe('***7654');
      expect(sanitizeHistoryFieldRecord('personal.nid', 'NID', '1234')).toBe('****');
    });

    it('prevents raw image base64 binaries from bloating history records', () => {
      const dataUri = 'data:image/jpeg;base64,' + 'A'.repeat(500);
      expect(sanitizeHistoryFieldRecord('documents.photo', 'Applicant Photo', dataUri)).toBe('[Image Attached]');
    });

    it('preserves non-sensitive public form values', () => {
      expect(sanitizeHistoryFieldRecord('personal.fullName', 'Applicant Name', 'MAHFUZUR RAHMAN')).toBe('MAHFUZUR RAHMAN');
      expect(sanitizeHistoryFieldRecord('address.district', 'District', 'Dhaka')).toBe('Dhaka');
      expect(sanitizeHistoryFieldRecord('education.sscBoard', 'SSC Board', 'Rajshahi')).toBe('Rajshahi');
    });
  });

  describe('2. Truthful Statistics & Empty-State Accuracy', () => {
    it('returns N/A (not 100%) when zero sessions exist', async () => {
      const stats = await HistoryRepository.getStatistics();
      expect(stats.totalSessions).toBe(0);
      expect(stats.totalFilled).toBe(0);
      expect(stats.totalAttempted).toBe(0);
      expect(stats.successRate).toBeNull();
      expect(stats.successRateFormatted).toBe('N/A');
      expect(stats.securityStatus).toContain('AES-256-GCM');
    });

    it('calculates accurate success rate from real attempted and filled fields', async () => {
      // 12 attempted, 10 filled, 2 failed
      const testRecord: AutofillHistoryRecord = {
        id: 'session_audit_test_1',
        sessionId: 'session_audit_test_1',
        timestamp: Date.now(),
        startedAt: Date.now() - 5000,
        completedAt: Date.now(),
        url: 'https://teletalk.com.bd/apply',
        domain: 'teletalk.com.bd',
        pageTitle: 'Assistant Director Circular Form',
        profileId: 'prof_1',
        profileName: 'Mahfuzur Rahman',
        totalDetected: 15,
        attemptedFields: 12,
        totalFilled: 10,
        totalFailed: 2,
        totalAmbiguous: 1,
        skippedFields: 2,
        alreadyCorrectFields: 1,
        status: 'partial',
        fieldResults: [
          {
            fieldKey: 'personal.name',
            fieldLabel: 'Name',
            fillStatus: 'FILLED',
            value: 'Mahfuzur Rahman',
          },
          {
            fieldKey: 'personal.fatherName',
            fieldLabel: 'Father Name',
            fillStatus: 'FILLED',
            value: 'Abdur Rahman',
          },
          {
            fieldKey: 'personal.sscRoll',
            fieldLabel: 'SSC Roll',
            fillStatus: 'FAILED',
            failureReason: 'DOM verification mismatch',
          },
        ],
      };

      await HistoryRepository.upsertRecord(testRecord);

      const stats = await HistoryRepository.getStatistics();
      expect(stats.totalSessions).toBe(1);
      expect(stats.totalFilled).toBe(10);
      expect(stats.totalAttempted).toBe(12);
      expect(stats.totalFailed).toBe(2);
      // 10 / 12 = 83.33% -> 83%
      expect(stats.successRate).toBe(83);
      expect(stats.successRateFormatted).toBe('83%');
    });

    it('displays 0% when sessions exist but 0 fields were filled', async () => {
      const failedRecord: AutofillHistoryRecord = {
        id: 'session_failed_1',
        timestamp: Date.now(),
        url: 'https://bpsc.gov.bd/form',
        domain: 'bpsc.gov.bd',
        pageTitle: 'BCS Online Form',
        profileId: 'prof_1',
        profileName: 'Mahfuzur Rahman',
        totalDetected: 10,
        attemptedFields: 10,
        totalFilled: 0,
        totalFailed: 10,
        totalAmbiguous: 0,
        status: 'failed',
      };

      await HistoryRepository.upsertRecord(failedRecord);

      const stats = await HistoryRepository.getStatistics();
      expect(stats.totalSessions).toBe(1);
      expect(stats.totalFilled).toBe(0);
      expect(stats.successRate).toBe(0);
      expect(stats.successRateFormatted).toBe('0%');
    });
  });

  describe('3. Lifecycle Events: Start, Complete, Revert & Persistence', () => {
    it('creates an in-progress session record before field fill commences', async () => {
      const sessionId = 'session_life_' + Date.now();
      const startRecord: AutofillHistoryRecord = {
        id: sessionId,
        sessionId,
        timestamp: Date.now(),
        startedAt: Date.now(),
        url: 'https://petrobangla.org.bd/apply',
        domain: 'petrobangla.org.bd',
        pageTitle: 'Petrobangla Recruitment',
        profileId: 'p_101',
        profileName: 'Job Seeker',
        totalDetected: 24,
        totalFilled: 0,
        totalFailed: 0,
        totalAmbiguous: 0,
        status: 'in_progress',
      };

      await HistoryRepository.upsertRecord(startRecord);

      const saved = await HistoryRepository.getById(sessionId);
      expect(saved).not.toBeNull();
      expect(saved?.status).toBe('in_progress');
      expect(saved?.totalFilled).toBe(0);
    });

    it('updates the same session upon completion without creating duplicate entries', async () => {
      const sessionId = 'session_stable_999';

      // 1. Start event
      await HistoryRepository.upsertRecord({
        id: sessionId,
        sessionId,
        timestamp: 1000,
        startedAt: 1000,
        url: 'https://railway.gov.bd/apply',
        domain: 'railway.gov.bd',
        pageTitle: 'Bangladesh Railway Portal',
        profileId: 'p_101',
        profileName: 'Applicant Profile',
        totalDetected: 20,
        totalFilled: 0,
        totalFailed: 0,
        totalAmbiguous: 0,
        status: 'in_progress',
      });

      // 2. Complete event
      await HistoryRepository.upsertRecord({
        id: sessionId,
        sessionId,
        timestamp: 1500,
        startedAt: 1000,
        completedAt: 1500,
        url: 'https://railway.gov.bd/apply',
        domain: 'railway.gov.bd',
        pageTitle: 'Bangladesh Railway Portal',
        profileId: 'p_101',
        profileName: 'Applicant Profile',
        totalDetected: 20,
        attemptedFields: 18,
        totalFilled: 18,
        totalFailed: 0,
        totalAmbiguous: 0,
        status: 'completed',
      });

      const history = await HistoryRepository.getHistory();
      expect(history.length).toBe(1);
      expect(history[0].id).toBe(sessionId);
      expect(history[0].status).toBe('completed');
      expect(history[0].totalFilled).toBe(18);
    });

    it('records reverted status when user triggers undo', async () => {
      const sessionId = 'session_undo_test';
      await HistoryRepository.upsertRecord({
        id: sessionId,
        sessionId,
        timestamp: Date.now(),
        url: 'https://dghs.gov.bd/form',
        domain: 'dghs.gov.bd',
        pageTitle: 'Health Ministry Job Form',
        profileId: 'p_1',
        profileName: 'Candidate',
        totalDetected: 15,
        totalFilled: 14,
        totalFailed: 1,
        totalAmbiguous: 0,
        status: 'partial',
      });

      // User clicks Undo
      const existing = await HistoryRepository.getById(sessionId);
      expect(existing).not.toBeNull();
      await HistoryRepository.upsertRecord({
        ...existing!,
        status: 'reverted',
      });

      const reverted = await HistoryRepository.getById(sessionId);
      expect(reverted?.status).toBe('reverted');
    });
  });

  describe('4. Background Message Router Handling', () => {
    it('processes RECORD_AUTOFILL_SESSION_START via MessageRouter', async () => {
      let responseData: any = null;
      const sendResponse = (res: any) => {
        responseData = res;
      };

      const handled = MessageRouter.handleMessage(
        {
          action: 'RECORD_AUTOFILL_SESSION_START',
          payload: {
            id: 'msg_session_101',
            url: 'https://customs.gov.bd/apply',
            pageTitle: 'Customs Officer Application',
            profileId: 'prof_customs',
            profileName: 'Customs Candidate',
            totalDetected: 30,
            totalAmbiguous: 1,
          },
        },
        { tab: { id: 123, url: 'https://customs.gov.bd/apply' } } as any,
        sendResponse
      );

      expect(handled).toBe(true);
      await new Promise((r) => setTimeout(r, 50));
      expect(responseData).toEqual({ status: 'ok', sessionId: 'msg_session_101' });

      const inDb = await HistoryRepository.getById('msg_session_101');
      expect(inDb).not.toBeNull();
      expect(inDb?.domain).toBe('customs.gov.bd');
      expect(inDb?.status).toBe('in_progress');
    });

    it('processes RECORD_AUTOFILL_SESSION_COMPLETE via MessageRouter', async () => {
      let responseData: any = null;
      const sendResponse = (res: any) => {
        responseData = res;
      };

      MessageRouter.handleMessage(
        {
          action: 'RECORD_AUTOFILL_SESSION_COMPLETE',
          payload: {
            id: 'msg_session_101',
            totalDetected: 30,
            totalFilled: 28,
            totalFailed: 2,
            attemptedFields: 30,
            fieldResults: [
              {
                fieldKey: 'personal.name',
                fieldLabel: 'Applicant Name',
                fillStatus: 'FILLED',
                value: 'Candidate Name',
              },
            ],
          },
        },
        { tab: { id: 123, url: 'https://customs.gov.bd/apply' } } as any,
        sendResponse
      );

      await new Promise((r) => setTimeout(r, 50));
      expect(responseData?.status).toBe('ok');
      expect(responseData?.record?.status).toBe('partial');
      expect(responseData?.record?.totalFilled).toBe(28);
    });

    it('deletes history item via DELETE_AUTOFILL_HISTORY_ITEM', async () => {
      await HistoryRepository.upsertRecord({
        id: 'del_me_1',
        timestamp: Date.now(),
        url: 'https://test.com',
        domain: 'test.com',
        pageTitle: 'Test',
        profileId: 'p1',
        profileName: 'Test',
        totalDetected: 5,
        totalFilled: 5,
        totalFailed: 0,
        totalAmbiguous: 0,
        status: 'completed',
      });

      let responseData: any = null;
      MessageRouter.handleMessage(
        {
          action: 'DELETE_AUTOFILL_HISTORY_ITEM',
          payload: { id: 'del_me_1' },
        },
        {} as any,
        (res) => {
          responseData = res;
        }
      );

      await new Promise((r) => setTimeout(r, 50));
      expect(responseData).toEqual({ status: 'ok' });
      const item = await HistoryRepository.getById('del_me_1');
      expect(item).toBeNull();
    });
  });

  describe('5. Logical Separation from Application Tracker', () => {
    it('deleting an Autofill History item does NOT delete or alter Application Tracker records', async () => {
      // Create Application Tracker record
      await ApplicationRepository.upsert({
        jobId: 'job_bcs_47',
        jobTitle: '47th BCS Examination',
        organization: 'Bangladesh Public Service Commission',
        status: 'Interested',
        applicationUrl: 'https://bpsc.teletalk.com.bd',
        circularUrl: 'https://bpsc.gov.bd/circular/47',
        deadlineAt: Date.now() + 86400000,
        updatedAt: Date.now(),
      });

      // Create matching history item
      const historyId = 'hist_bcs_47';
      await HistoryRepository.upsertRecord({
        id: historyId,
        jobId: 'job_bcs_47',
        timestamp: Date.now(),
        url: 'https://bpsc.teletalk.com.bd',
        domain: 'bpsc.teletalk.com.bd',
        pageTitle: '47th BCS Form',
        profileId: 'p1',
        profileName: 'Applicant',
        totalDetected: 20,
        totalFilled: 20,
        totalFailed: 0,
        totalAmbiguous: 0,
        status: 'completed',
      });

      // Delete history item
      await deleteAutofillHistoryItem(historyId);

      // Verify history is deleted
      const historyList = await getAutofillHistory();
      expect(historyList.find((h) => h.id === historyId)).toBeUndefined();

      // Verify Application Tracker record remains completely intact
      const trackerRecord = await ApplicationRepository.getByJobId('job_bcs_47');
      expect(trackerRecord).not.toBeNull();
      expect(trackerRecord?.jobTitle).toBe('47th BCS Examination');
      expect(trackerRecord?.status).toBe('Interested');
    });

    it('clearing all Autofill History does NOT erase Application Tracker records', async () => {
      await ApplicationRepository.upsert({
        jobId: 'job_petro_01',
        jobTitle: 'Assistant Engineer',
        organization: 'Petrobangla',
        status: 'Application Started',
        applicationUrl: 'https://petrobangla.teletalk.com.bd',
        circularUrl: '',
        deadlineAt: null,
        updatedAt: Date.now(),
      });

      await HistoryRepository.upsertRecord({
        id: 'hist_petro_01',
        timestamp: Date.now(),
        url: 'https://petrobangla.teletalk.com.bd',
        domain: 'petrobangla.teletalk.com.bd',
        pageTitle: 'Petrobangla Form',
        profileId: 'p1',
        profileName: 'Engineer',
        totalDetected: 15,
        totalFilled: 15,
        totalFailed: 0,
        totalAmbiguous: 0,
        status: 'completed',
      });

      await clearAutofillHistory();

      // History is empty
      const history = await getAutofillHistory();
      expect(history).toEqual([]);

      // Tracker record still exists
      const trackerRecord = await ApplicationRepository.getByJobId('job_petro_01');
      expect(trackerRecord).not.toBeNull();
      expect(trackerRecord?.jobTitle).toBe('Assistant Engineer');
    });

    it('never auto-marks an application as Applied without confirmed submission evidence', async () => {
      // Simulate autofill completion with job reference
      let responseData: any = null;
      MessageRouter.handleMessage(
        {
          action: 'RECORD_AUTOFILL_SESSION_COMPLETE',
          payload: {
            id: 'session_tracker_link_1',
            jobId: 'job_bank_ad',
            jobTitle: 'Assistant Director (General)',
            organization: 'Bangladesh Bank',
            url: 'https://erecruitment.bb.org.bd',
            totalDetected: 25,
            totalFilled: 25,
            totalFailed: 0,
            status: 'completed',
          },
        },
        { tab: { id: 456, url: 'https://erecruitment.bb.org.bd' } } as any,
        (res) => {
          responseData = res;
        }
      );

      await new Promise((r) => setTimeout(r, 50));
      expect(responseData?.status).toBe('ok');

      // Check tracker: status must be "Application Started", NOT "Applied"
      const app = await ApplicationRepository.getByJobId('job_bank_ad');
      expect(app).not.toBeNull();
      expect(app?.status).toBe('Application Started');
      expect(app?.status).not.toBe('Applied');

      // Now simulate submission attempt (form submit clicked)
      MessageRouter.handleMessage(
        {
          action: 'RECORD_APPLICATION_SUBMIT_ATTEMPT',
          payload: {
            jobId: 'job_bank_ad',
            jobTitle: 'Assistant Director (General)',
            organization: 'Bangladesh Bank',
            applicationUrl: 'https://erecruitment.bb.org.bd',
          },
        },
        {} as any,
        () => {}
      );
      await new Promise((r) => setTimeout(r, 50));

      const pendingApp = await ApplicationRepository.getByJobId('job_bank_ad');
      expect(pendingApp?.status).toBe('Submission Pending Verification');

      // Only with confirmed submission evidence does status become Applied
      MessageRouter.handleMessage(
        {
          action: 'CONFIRM_APPLICATION_SUBMISSION',
          payload: {
            jobId: 'job_bank_ad',
            applicantId: 'BB-AD-2026-98765',
          },
        },
        {} as any,
        () => {}
      );
      await new Promise((r) => setTimeout(r, 50));

      const confirmedApp = await ApplicationRepository.getByJobId('job_bank_ad');
      expect(confirmedApp?.status).toBe('Applied');
      expect(confirmedApp?.applicantId).toBe('BB-AD-2026-98765');
    });
  });
});
