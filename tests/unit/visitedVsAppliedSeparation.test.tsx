// JobFill BD - Visited vs Applied Separation, Evidence-Based Confirmation & Repair Test Suite
// Verifies:
// 1. Visited History (STORES.JOB_VISITS) is strictly decoupled from Application Tracker (STORES.APPLICATIONS).
// 2. Opening/viewing circular logs in JobVisitRepository only; does not create ApplicationTrackerRecord.
// 3. Repeated visits update visitCount without creating duplicate records.
// 4. "Apply Now" initiates Application Started (never Applied).
// 5. Form Autofill logs in HistoryRepository without marking Applied.
// 6. Submitting form moves status to Submission Pending Verification.
// 7. detectApplicationConfirmation rejects circular pages, Payment Instructions, and Application Preview.
// 8. Strict confirmation slip transitions status to Applied with verified evidence.
// 9. Ambiguous receipts flag Needs Manual Confirmation for user review.
// 10. Hub "Applied" tab and count strictly filter by status === 'Applied'.
// 11. Repair utility detects misclassified records without evidence and preserves verified applications.
// 12. Manual review workflow in ApplicationTracker confirms or converts records cleanly.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { JobVisitRepository } from '../../src/jobs/database/job-visit-repository';
import { ApplicationRepository } from '../../src/jobs/database/application-repository';
import { HistoryRepository } from '../../src/database/history-repository';
import { JobRepository } from '../../src/jobs/database/job-repository';
import { BookmarkRepository } from '../../src/jobs/database/bookmark-repository';
import {
  detectJobCircularPage,
  detectApplicationConfirmation,
  isJobApplicationForm,
} from '../../src/content/assistant-workflows';
import { MessageRouter } from '../../src/background/message-router';
import { openJobApplicationWithContext, markJobAppliedAndSync } from '../../src/jobs/services/job-ui-actions';
import { NormalizedJobCircular } from '../../src/jobs/types/job.types';
import { JobCircularPage } from '../../src/jobs/dashboard/JobCircularPage';
import { ApplicationTracker } from '../../src/jobs/dashboard/ApplicationTracker';
import { AppProvider } from '../../src/dashboard/context/AppContext';

describe('JobFill BD - Visited vs Applied Separation & Evidence-Based Tracking Suite', () => {
  const sampleCircular: NormalizedJobCircular = {
    id: 'circ_bpsc_assistant_director_2026',
    jobTitle: 'Assistant Director (General)',
    organization: 'Bangladesh Public Service Commission',
    sourceId: 'bpsc',
    sourceName: 'BPSC',
    sourceVerification: 'official_verified',
    category: 'Government',
    position: 'Assistant Director',
    applicationUrl: 'https://bpsc.teletalk.com.bd/apply/ad-2026',
    circularUrl: 'https://bpsc.gov.bd/circulars/ad-2026.pdf',
    circularNumber: 'BPSC-AD-01',
    deadlineAt: Date.parse('2026-11-30T18:00:00+06:00'),
    deadlineText: '30 November 2026',
    deadlineVerified: true,
    publishedAt: Date.parse('2026-11-01T09:00:00+06:00'),
    location: 'Dhaka',
    employmentType: 'Full-time',
    qualification: 'Graduation',
    isUnclassified: false,
    extractedAt: Date.now(),
    lastUpdatedAt: Date.now(),
  };

  beforeEach(async () => {
    localStorage.clear();
    await JobVisitRepository.clearAllVisits();
    await ApplicationRepository.clearAll();
    await HistoryRepository.clearHistory();
    document.body.innerHTML = '';
  });

  afterEach(async () => {
    await JobVisitRepository.clearAllVisits();
    await ApplicationRepository.clearAll();
    await HistoryRepository.clearHistory();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. VISITED HISTORY ISOLATION & DEDUPLICATION
  // =========================================================================
  describe('1. Visited History Isolation & Deduplication', () => {
    it('records circular views in JobVisitRepository ONLY and never creates an ApplicationTrackerRecord', async () => {
      const visit = await JobVisitRepository.recordVisit({
        jobId: sampleCircular.id,
        sourceId: sampleCircular.sourceId,
        organization: sampleCircular.organization,
        jobTitle: sampleCircular.jobTitle,
        circularUrl: sampleCircular.circularUrl!,
        deadlineAt: sampleCircular.deadlineAt,
        verificationStatus: 'verified',
      });

      expect(visit).not.toBeNull();
      expect(visit?.jobId).toBe(sampleCircular.id);
      expect(visit?.visitCount).toBe(1);

      // Verify STORES.JOB_VISITS has the record
      const allVisits = await JobVisitRepository.getAllVisits();
      expect(allVisits).toHaveLength(1);
      expect(allVisits[0].jobId).toBe(sampleCircular.id);

      // Verify STORES.APPLICATIONS is completely empty
      const allApps = await ApplicationRepository.getAll();
      expect(allApps).toHaveLength(0);
    });

    it('deduplicates return visits, increments visitCount, updates lastVisitedAt, and preserves firstVisitedAt', async () => {
      const v1 = await JobVisitRepository.recordVisit({
        jobId: sampleCircular.id,
        sourceId: sampleCircular.sourceId,
        organization: sampleCircular.organization,
        jobTitle: sampleCircular.jobTitle,
        circularUrl: 'https://bpsc.gov.bd/circulars/ad-2026.pdf?utm_source=fb',
        verificationStatus: 'verified',
      });

      const initialTime = v1!.firstVisitedAt;

      // Simulate viewing again later with different tracking query params
      const v2 = await JobVisitRepository.recordVisit({
        jobId: sampleCircular.id,
        sourceId: sampleCircular.sourceId,
        organization: sampleCircular.organization,
        jobTitle: sampleCircular.jobTitle,
        circularUrl: 'https://bpsc.gov.bd/circulars/ad-2026.pdf?ref=notification#page1',
        verificationStatus: 'verified',
      });

      expect(v2?.visitId).toBe(v1?.visitId);
      expect(v2?.visitCount).toBe(2);
      expect(v2?.firstVisitedAt).toBe(initialTime);

      const allVisits = await JobVisitRepository.getAllVisits();
      expect(allVisits).toHaveLength(1);
    });
  });

  // =========================================================================
  // 2. APPLICATION LIFECYCLE & STRICT PROGRESSION
  // =========================================================================
  describe('2. Application Lifecycle Progression', () => {
    it('clicking Apply Now records status as "Application Started" (NEVER "Applied")', async () => {
      const toast = vi.fn();
      const openResult = await openJobApplicationWithContext(sampleCircular, toast, false, undefined, {
        trackStarted: true,
      });

      expect(openResult.opened).toBe(true);

      const app = await ApplicationRepository.getByJobId(sampleCircular.id);
      expect(app).not.toBeNull();
      expect(app?.status).toBe('Application Started');
      expect(app?.status).not.toBe('Applied');
    });

    it('form autofill saves to HistoryRepository without marking application as Applied', async () => {
      // 1. Create draft application
      await ApplicationRepository.setStatus(sampleCircular, 'Application Started');

      // 2. Record autofill session
      await HistoryRepository.addRecord({
        sessionId: 'session_autofill_001',
        timestamp: Date.now(),
        profileId: 'prof_test',
        profileName: 'Applicant Profile',
        targetDomain: 'bpsc.teletalk.com.bd',
        targetUrl: 'https://bpsc.teletalk.com.bd/apply/ad-2026',
        portalType: 'teletalk',
        formType: 'job_application',
        totalFieldsDetected: 24,
        filledCount: 22,
        failedCount: 0,
        skippedCount: 2,
        durationMs: 420,
        success: true,
      });

      // Verify history has session
      const history = await HistoryRepository.getHistory();
      expect(history).toHaveLength(1);

      // Verify application status is still "Application Started" (NOT "Applied")
      const app = await ApplicationRepository.getByJobId(sampleCircular.id);
      expect(app?.status).toBe('Application Started');
    });

    it('passive submit observer sets status to "Submission Pending Verification"', async () => {
      await ApplicationRepository.setStatus(sampleCircular, 'Application Started');

      // Dispatch submit attempt
      await new Promise<void>((resolve) => {
        MessageRouter.handleMessage(
          {
            action: 'RECORD_APPLICATION_SUBMIT_ATTEMPT',
            payload: {
              jobId: sampleCircular.id,
              jobTitle: sampleCircular.jobTitle,
              organization: sampleCircular.organization,
              applicationUrl: sampleCircular.applicationUrl,
            },
          },
          {} as any,
          () => resolve()
        );
      });

      const app = await ApplicationRepository.getByJobId(sampleCircular.id);
      expect(app?.status).toBe('Submission Pending Verification');
      expect(app?.status).not.toBe('Applied');
      expect(app?.submissionAttemptedAt).toBeTypeOf('number');
    });
  });

  // =========================================================================
  // 3. EVIDENCE-BASED CONFIRMATION DETECTION
  // =========================================================================
  describe('3. Evidence-Based Submission Confirmation Detector', () => {
    it('disqualifies circular pages containing Payment Instructions or Application Preview keywords', () => {
      document.body.innerHTML = `
        <div class="circular-container">
          <h1>Bangladesh Public Service Commission (BPSC)</h1>
          <h2>Official Job Circular - 2026</h2>
          <p>Payment Instructions: Complete payment of Tk. 500 via Teletalk Pre-paid SIM within 72 hours.</p>
          <p>Application Preview is available on the website.</p>
          <div class="field">User ID: BPSC998811</div>
        </div>
      `;

      const conf = detectApplicationConfirmation(document);
      expect(conf.isConfirmed).toBe(false);
    });

    it('disqualifies active unfilled application forms with input fields', () => {
      document.body.innerHTML = `
        <form id="appForm">
          <h2>Job Application Form</h2>
          <input name="applicant_name" value="" />
          <input name="father_name" value="" />
          <input name="mother_name" value="" />
          <input name="mobile" value="" />
          <button type="submit">Submit Application</button>
        </form>
      `;

      const conf = detectApplicationConfirmation(document);
      expect(conf.isConfirmed).toBe(false);
    });

    it('confirms submission on official Applicant Copy slip with extracted User ID', () => {
      document.body.innerHTML = `
        <div class="applicant-copy-slip">
          <h1>Applicant's Copy</h1>
          <p>Application Submitted Successfully</p>
          <div>User ID: BPSC2026AD99</div>
          <div>Fee Payment Status: Unpaid</div>
        </div>
      `;

      const conf = detectApplicationConfirmation(document);
      expect(conf.isConfirmed).toBe(true);
      expect(conf.teletalkUserId).toBe('BPSC2026AD99');
      expect(conf.isFailure).toBe(false);
    });

    it('confirms submission on Bengali success confirmation receipt', () => {
      document.body.innerHTML = `
        <div class="receipt">
          <h2>আবেদন সফলভাবে গৃহীত হয়েছে</h2>
          <p>আপনার রেজিস্ট্রেশন নম্বর: REG-88371</p>
        </div>
      `;

      const conf = detectApplicationConfirmation(document);
      expect(conf.isConfirmed).toBe(true);
      expect(conf.applicantId).toBe('REG-88371');
    });

    it('marks ambiguous pages (ID present without success keywords or Applicant Copy) as Needs Manual Confirmation', () => {
      document.body.innerHTML = `
        <div class="portal-info">
          <h3>Help Desk & Instructions</h3>
          <p>Ref ID: BPSC-REF-4421</p>
        </div>
      `;

      const conf = detectApplicationConfirmation(document);
      expect(conf.isConfirmed).toBe(false);
      expect(conf.isAmbiguous).toBe(true);
      expect(conf.needsManualConfirmation).toBe(true);
      expect(conf.applicantId).toBe('BPSC-REF-4421');
    });
  });

  // =========================================================================
  // 4. MESSAGE ROUTER IPC CONFIRMATION & AMBIGUOUS FLAGGING
  // =========================================================================
  describe('4. MessageRouter Submission Confirmation & Flagging', () => {
    it('CONFIRM_APPLICATION_SUBMISSION transitions pending application to Applied with confirmed evidence', async () => {
      await ApplicationRepository.setStatus(sampleCircular, 'Submission Pending Verification');

      await new Promise<void>((resolve) => {
        MessageRouter.handleMessage(
          {
            action: 'CONFIRM_APPLICATION_SUBMISSION',
            payload: {
              jobId: sampleCircular.id,
              teletalkUserId: 'BPSC2026AD99',
              confirmedAt: 1731600000000,
            },
          },
          {} as any,
          () => resolve()
        );
      });

      const confirmed = await ApplicationRepository.getByJobId(sampleCircular.id);
      expect(confirmed?.status).toBe('Applied');
      expect(confirmed?.teletalkUserId).toBe('BPSC2026AD99');
      expect(confirmed?.submissionConfirmedAt).toBe(1731600000000);
      expect(confirmed?.needsReview).toBe(false);
    });

    it('FLAG_APPLICATION_NEEDS_CONFIRMATION sets status to Needs Manual Confirmation with review flag', async () => {
      await ApplicationRepository.setStatus(sampleCircular, 'Submission Pending Verification');

      await new Promise<void>((resolve) => {
        MessageRouter.handleMessage(
          {
            action: 'FLAG_APPLICATION_NEEDS_CONFIRMATION',
            payload: {
              jobId: sampleCircular.id,
              applicantId: 'REF-AMBIGUOUS-99',
            },
          },
          {} as any,
          () => resolve()
        );
      });

      const app = await ApplicationRepository.getByJobId(sampleCircular.id);
      expect(app?.status).toBe('Needs Manual Confirmation');
      expect(app?.needsReview).toBe(true);
      expect(app?.applicantId).toBe('REF-AMBIGUOUS-99');
    });
  });

  // =========================================================================
  // 5. INDEPENDENT COEXISTENCE IN BOTH STORES
  // =========================================================================
  describe('5. Independent Coexistence in Visited and Applied Stores', () => {
    it('allows a job to be tracked in Visited History and Applied Tracker independently without collisions', async () => {
      // 1. Visit circular multiple times
      await JobVisitRepository.recordVisit({
        jobId: sampleCircular.id,
        sourceId: sampleCircular.sourceId,
        organization: sampleCircular.organization,
        jobTitle: sampleCircular.jobTitle,
        circularUrl: sampleCircular.circularUrl!,
      });
      await JobVisitRepository.recordVisit({
        jobId: sampleCircular.id,
        sourceId: sampleCircular.sourceId,
        organization: sampleCircular.organization,
        jobTitle: sampleCircular.jobTitle,
        circularUrl: sampleCircular.circularUrl!,
      });

      // 2. Apply to the job
      await ApplicationRepository.setStatus(sampleCircular, 'Applied', {
        teletalkUserId: 'BPSC-APP-1234',
        submissionConfirmedAt: Date.now(),
      });

      // Check Visited History
      const visits = await JobVisitRepository.getAllVisits();
      expect(visits).toHaveLength(1);
      expect(visits[0].jobId).toBe(sampleCircular.id);
      expect(visits[0].visitCount).toBe(2);

      // Check Application Tracker
      const apps = await ApplicationRepository.getAll();
      expect(apps).toHaveLength(1);
      expect(apps[0].jobId).toBe(sampleCircular.id);
      expect(apps[0].status).toBe('Applied');

      // Clearing Visited History does NOT delete the Application Record
      await JobVisitRepository.clearAllVisits();
      expect(await JobVisitRepository.getAllVisits()).toHaveLength(0);
      expect(await ApplicationRepository.getAll()).toHaveLength(1);
    });
  });

  // =========================================================================
  // 6. HISTORICAL RECORD REPAIR & AUDIT
  // =========================================================================
  describe('6. Historical Record Repair & Audit Utility', () => {
    it('identifies unverified Applied records and reclassifies them to Needs Manual Confirmation without deleting data', async () => {
      // Create a genuine applied record (with confirmation timestamp & User ID)
      await ApplicationRepository.setStatus(
        {
          id: 'job_genuine_applied',
          jobTitle: 'Senior Officer',
          organization: 'Bangladesh Bank',
          applicationUrl: 'https://erecruitment.bb.org.bd',
          circularUrl: 'https://bb.org.bd/circ.pdf',
          deadlineAt: null,
        },
        'Applied',
        {
          teletalkUserId: 'BB-SO-9923',
          submissionConfirmedAt: 1731500000000,
        }
      );

      // Create a misclassified record (simulating old bug where status was set to Applied without any evidence)
      await ApplicationRepository.upsert({
        jobId: 'job_misclassified_001',
        jobTitle: 'Assistant Engineer',
        organization: 'DPDC',
        circularUrl: 'https://dpdc.org.bd/circ.pdf',
        applicationUrl: 'https://dpdc.teletalk.com.bd',
        deadlineAt: null,
        status: 'Applied', // Marked applied by old bug!
        createdAt: 1731400000000,
        updatedAt: 1731400000000,
        // Zero confirmation evidence: no submissionConfirmedAt, no teletalkUserId, no applicantId, no transactionId, no notes
      });

      // Run repair utility
      const repairResult = await ApplicationRepository.repairMisclassifiedRecords();
      expect(repairResult.scanned).toBe(2);
      expect(repairResult.repaired).toBe(1);
      expect(repairResult.unmodified).toBe(1);

      // Verify genuine record is completely untouched
      const genuine = await ApplicationRepository.getByJobId('job_genuine_applied');
      expect(genuine?.status).toBe('Applied');
      expect(genuine?.teletalkUserId).toBe('BB-SO-9923');
      expect(genuine?.needsReview).toBeFalsy();

      // Verify misclassified record was safely moved to Needs Manual Confirmation with review flag
      const repaired = await ApplicationRepository.getByJobId('job_misclassified_001');
      expect(repaired?.status).toBe('Needs Manual Confirmation');
      expect(repaired?.needsReview).toBe(true);
      expect(repaired?.reviewReason).toContain('Auto-detected');

      // Verify visit was synced to JobVisitRepository so user can see it in Visited
      const visit = await JobVisitRepository.getByJobId('job_misclassified_001');
      expect(visit).not.toBeNull();
      expect(visit?.jobTitle).toBe('Assistant Engineer');
    });

    it('explicit user markJobAppliedAndSync records verified submission evidence', async () => {
      const toast = vi.fn();
      await markJobAppliedAndSync(sampleCircular, undefined, toast, false);

      const app = await ApplicationRepository.getByJobId(sampleCircular.id);
      expect(app?.status).toBe('Applied');
      expect(app?.submissionConfirmedAt).toBeTypeOf('number');
      expect(app?.needsReview).toBe(false);

      // Repair utility should recognize this explicit evidence and NOT flag it
      const audit = await ApplicationRepository.repairMisclassifiedRecords();
      expect(audit.repaired).toBe(0);
    });
  });

  // =========================================================================
  // 7. HUB APPLIED TAB & COUNT SEPARATION (UI INTEGRATION)
  // =========================================================================
  describe('7. JobCircularHub Applied Tab & Count Strict Separation', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
      container = document.createElement('div');
      document.body.appendChild(container);
      root = createRoot(container);
    });

    afterEach(async () => {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    });

    it('applied tab count strictly counts status === "Applied" and displays only genuine applied jobs', async () => {
      // Create 3 separate jobs with distinct positions & URLs to prevent deduplication
      const jobApplied: NormalizedJobCircular = {
        ...sampleCircular,
        id: 'job_real_applied',
        position: 'Assistant Director Confirmed',
        jobTitle: 'Assistant Director (Confirmed Applied)',
        circularUrl: 'https://bpsc.gov.bd/circ_ad.pdf',
        applicationUrl: 'https://bpsc.teletalk.com.bd/apply/ad',
      };
      const jobStarted: NormalizedJobCircular = {
        ...sampleCircular,
        id: 'job_app_started',
        position: 'Senior Officer Started',
        jobTitle: 'Officer (Application Started Only)',
        circularUrl: 'https://bb.org.bd/circ_so.pdf',
        applicationUrl: 'https://erecruitment.bb.org.bd/apply/so',
      };
      const jobBookmarked: NormalizedJobCircular = {
        ...sampleCircular,
        id: 'job_bm_only',
        position: 'Assistant Engineer Bookmarked',
        jobTitle: 'Assistant Engineer (Bookmarked Only)',
        circularUrl: 'https://dpdc.org.bd/circ_ae.pdf',
        applicationUrl: 'https://dpdc.teletalk.com.bd/apply/ae',
      };

      await JobRepository.saveJobs([jobApplied, jobStarted, jobBookmarked]);

      // Job 1 is Applied
      await ApplicationRepository.setStatus(jobApplied, 'Applied', {
        submissionConfirmedAt: Date.now(),
        teletalkUserId: 'AD9988',
      });

      // Job 2 is Application Started (NOT Applied!)
      await ApplicationRepository.setStatus(jobStarted, 'Application Started');

      // Job 3 is Bookmarked (NOT Applied!)
      await BookmarkRepository.addBookmark(jobBookmarked.id);
      await ApplicationRepository.setStatus(jobBookmarked, 'Bookmarked');

      // Also record a visit in Visited History
      await JobVisitRepository.recordVisit({
        jobId: jobStarted.id,
        organization: jobStarted.organization,
        jobTitle: jobStarted.jobTitle,
        circularUrl: jobStarted.circularUrl!,
      });

      // Render Hub
      await act(async () => {
        root.render(
          <AppProvider>
            <JobCircularPage />
          </AppProvider>
        );
      });
      await act(async () => {
        await new Promise((r) => setTimeout(r, 80));
      });

      // Find the "Applied" / "আবেদিত" tab button
      const appliedTabBtn = Array.from(container.querySelectorAll('button[role="tab"]')).find((b) =>
        b.textContent?.includes('Applied') || b.textContent?.includes('আবেদিত')
      ) as HTMLButtonElement | undefined;

      expect(appliedTabBtn).toBeDefined();
      // Applied tab count badge must be exactly 1 (NOT 3!)
      expect(appliedTabBtn?.textContent).toContain('1');

      // Click the Applied tab
      await act(async () => {
        appliedTabBtn?.click();
      });
      await act(async () => {
        await new Promise((r) => setTimeout(r, 60));
      });

      // Check rendered job cards in Applied tab
      const renderedCardHeadings = Array.from(container.querySelectorAll('h3 button')).map((el) =>
        el.textContent?.trim()
      );

      // Only the genuinely applied job should be visible in Applied tab
      expect(renderedCardHeadings).toContain('Assistant Director Confirmed');
      expect(renderedCardHeadings).not.toContain('Senior Officer Started');
      expect(renderedCardHeadings).not.toContain('Assistant Engineer Bookmarked');
    });
  });

  // =========================================================================
  // 8. APPLICATION TRACKER REVIEW BANNER & ACTIONS (UI INTEGRATION)
  // =========================================================================
  describe('8. ApplicationTracker Review Workflow & Card Actions', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
      container = document.createElement('div');
      document.body.appendChild(container);
      root = createRoot(container);
    });

    afterEach(async () => {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    });

    it('renders review banner for misclassified records and confirms them via "Confirm All as Applied"', async () => {
      const onUpdate = vi.fn().mockResolvedValue(undefined);
      const onDelete = vi.fn().mockResolvedValue(undefined);

      const unverifiedRecord = {
        jobId: 'job_needs_review_1',
        jobTitle: 'Assistant Programmer',
        organization: 'BPSC',
        circularId: 'BPSC-2026',
        deadlineAt: null,
        status: 'Needs Manual Confirmation' as const,
        needsReview: true,
        reviewReason: 'Auto-detected: Marked as Applied without verified submission evidence.',
        createdAt: Date.now() - 100000,
        updatedAt: Date.now() - 100000,
      };

      await act(async () => {
        root.render(
          <ApplicationTracker
            records={[unverifiedRecord]}
            language="en"
            onUpdateRecord={onUpdate}
            onDeleteRecord={onDelete}
          />
        );
      });
      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      // Review banner should be rendered
      expect(container.textContent).toContain('1 application(s) need confirmation');
      expect(container.textContent).toContain('Confirm All as Applied');

      // Click Confirm All as Applied
      const confirmAllBtn = Array.from(container.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Confirm All as Applied')
      );
      expect(confirmAllBtn).toBeDefined();

      await act(async () => {
        confirmAllBtn?.click();
      });
      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      expect(onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId: 'job_needs_review_1',
          status: 'Applied',
          needsReview: false,
        })
      );
    });
  });
});
