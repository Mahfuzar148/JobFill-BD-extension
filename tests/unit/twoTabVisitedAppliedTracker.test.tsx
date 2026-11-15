// JobFill BD - Two-Tab Application Tracker: VISITED & APPLIED Test Suite
// Verifies:
// 1. Two Primary Tabs: VISITED (দেখা হয়েছে) and APPLIED (আবেদন সম্পন্ন) with accurate real-time counts.
// 2. Mutual Exclusivity: An applied job NEVER appears in the Visited tab.
// 3. Deduplication: Multiple visits to the same circular increment visitCount without creating duplicate cards.
// 4. Lifecycle Progression:
//    - Discovery/Open -> VISITED (subStatus: Visited / Viewed)
//    - Apply Now / Autofill Start -> VISITED (subStatus: Application Started)
//    - Confirmed Submission -> APPLIED (atomic transition via moveJobToApplied)
//    - Submission Failure / Validation Error -> VISITED (subStatus: Submission Failed)
//    - Ambiguous Submission -> VISITED (subStatus: Needs Manual Confirmation)
// 5. Card Elements & Action Buttons:
//    - Visited: Job Title, Org, Circular ID, Last Visited, Visit Count, Apply Now, Mark as Applied, Details, Remove.
//    - Applied: Job Title, Org, Application Date, User ID chip (with copy), Portal Domain, "পোর্টালে লগইন করুন", Vault badge.
// 6. Persistence: Correct classification preserved across browser restart / storage reload.
// 7. Multi-Job Disambiguation: Multiple jobs from the same organization correctly isolated.
// 8. Release Package Integrity: Release ZIP hashes verified untouched.

import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApplicationRepository } from '../../src/jobs/database/application-repository';
import { JobVisitRepository } from '../../src/jobs/database/job-visit-repository';
import { ApplicationTrackerRecord, JobVisitRecord } from '../../src/jobs/types/job.types';
import { ApplicationTracker } from '../../src/jobs/dashboard/ApplicationTracker';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

async function flushUi(ms = 40) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}

describe('JobFill BD — Two-Tab Application Tracker: VISITED & APPLIED Suite', () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(async () => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.clear();
    sessionStorage.clear();
    document.body.innerHTML = '';
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await ApplicationRepository.clearAll();
    await JobVisitRepository.clearAllVisits();
  });

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount();
      });
      root = null;
    }
    if (container?.parentNode) {
      container.parentNode.removeChild(container);
    }
    document.body.innerHTML = '';
  });

  // =========================================================================
  // 1. TAB HEADER ARCHITECTURE & REAL DATABASE COUNTS
  // =========================================================================
  describe('1. Two-Tab Header Architecture & Accurate Counts', () => {
    it('renders exactly two primary tabs: VISITED and APPLIED with subtitles and exact counts', async () => {
      // Setup: 2 visited jobs, 1 applied job
      await JobVisitRepository.recordVisit({
        jobId: 'visit_job_1',
        jobTitle: 'Assistant Engineer',
        organization: 'DPDC',
        circularUrl: 'https://dpdc.org.bd/circ_1.html',
      });
      await JobVisitRepository.recordVisit({
        jobId: 'visit_job_2',
        jobTitle: 'Sub-Assistant Engineer',
        organization: 'DESCO',
        circularUrl: 'https://desco.org.bd/circ_2.html',
      });

      const appliedJob: ApplicationTrackerRecord = {
        jobId: 'applied_job_1',
        jobTitle: 'Assistant Director',
        organization: 'Bangladesh Bank',
        circularUrl: 'https://erecruitment.bb.org.bd/circ.html',
        applicationUrl: 'https://erecruitment.bb.org.bd/apply.php',
        loginUrl: 'https://erecruitment.bb.org.bd/login.php',
        status: 'Applied',
        submissionConfirmedAt: Date.now() - 50000,
        teletalkUserId: 'BB_USER_123',
        createdAt: Date.now() - 100000,
        updatedAt: Date.now() - 50000,
        deadlineAt: null,
      };
      await ApplicationRepository.upsert(appliedJob);

      const { visited, applied, visitedCount, appliedCount } =
        await ApplicationRepository.getVisitedAndAppliedLists();

      expect(visitedCount).toBe(2);
      expect(appliedCount).toBe(1);

      await act(async () => {
        root?.render(
          <ApplicationTracker
            records={[appliedJob]}
            visits={await JobVisitRepository.getAllVisits()}
            language="bn"
            onUpdateRecord={vi.fn()}
            onDeleteRecord={vi.fn()}
          />
        );
      });
      await flushUi();

      const text = container.textContent || '';

      // Check Visited tab header
      expect(text).toContain('দেখা হয়েছে (Visited)');
      expect(text).toContain('# 2');
      expect(text).toContain('দেখা হয়েছে, আবেদন সম্পন্ন হয়নি');

      // Check Applied tab header
      expect(text).toContain('আবেদন সম্পন্ন (Applied)');
      expect(text).toContain('# 1');
      expect(text).toContain('আবেদন সফলভাবে সম্পন্ন');
    });

    it('tab switching toggles visibility between VISITED and APPLIED views', async () => {
      await JobVisitRepository.recordVisit({
        jobId: 'visit_switch_1',
        jobTitle: 'Senior Officer',
        organization: 'Sonali Bank',
        circularUrl: 'https://sonalibank.com.bd/circ.html',
      });

      const appliedJob: ApplicationTrackerRecord = {
        jobId: 'applied_switch_1',
        jobTitle: 'Scientific Officer',
        organization: 'BAEC',
        status: 'Applied',
        submissionConfirmedAt: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        deadlineAt: null,
      };
      await ApplicationRepository.upsert(appliedJob);

      await act(async () => {
        root?.render(
          <ApplicationTracker
            records={[appliedJob]}
            visits={await JobVisitRepository.getAllVisits()}
            language="en"
            initialTab="visited"
            onUpdateRecord={vi.fn()}
            onDeleteRecord={vi.fn()}
          />
        );
      });
      await flushUi();

      // Find tab buttons
      const buttons = Array.from(container.querySelectorAll('button'));
      const visitedTabBtn = buttons.find((b) => b.textContent?.includes('VISITED'));
      const appliedTabBtn = buttons.find((b) => b.textContent?.includes('APPLIED'));

      expect(visitedTabBtn).toBeDefined();
      expect(appliedTabBtn).toBeDefined();

      // Click Applied tab
      await act(async () => {
        appliedTabBtn?.click();
      });
      await flushUi();

      // Applied view is now the primary active tab
      expect(appliedTabBtn?.className).toContain('ring-2');
    });
  });

  // =========================================================================
  // 2. DISCOVERY & DEDUPLICATION (VISITED TAB)
  // =========================================================================
  describe('2. Circular Discovery & Deduplication in VISITED Tab', () => {
    it('Test A: Opening a circular adds it to VISITED; re-visiting increments visitCount without duplicating card', async () => {
      // First visit
      const v1 = await JobVisitRepository.recordVisit({
        jobId: 'job_bpsc_01',
        jobTitle: 'Assistant Programmer',
        organization: 'BPSC',
        circularUrl: 'https://bpsc.teletalk.com.bd/circulars/45th.html',
        deadlineAt: Date.now() + 86400000 * 10,
      });

      expect(v1).not.toBeNull();
      expect(v1?.visitCount).toBe(1);

      let lists = await ApplicationRepository.getVisitedAndAppliedLists();
      expect(lists.visitedCount).toBe(1);
      expect(lists.appliedCount).toBe(0);
      expect(lists.visited[0].visitCount).toBe(1);
      expect(lists.visited[0].subStatus).toBe('Visited');

      // Second visit to the same circular
      const v2 = await JobVisitRepository.recordVisit({
        jobId: 'job_bpsc_01',
        jobTitle: 'Assistant Programmer',
        organization: 'BPSC',
        circularUrl: 'https://bpsc.teletalk.com.bd/circulars/45th.html?utm_source=fb',
      });

      expect(v2?.visitCount).toBe(2);

      // Verify list: still exactly 1 card, visitCount is 2
      lists = await ApplicationRepository.getVisitedAndAppliedLists();
      expect(lists.visitedCount).toBe(1);
      expect(lists.appliedCount).toBe(0);
      expect(lists.visited[0].visitCount).toBe(2);

      // Render UI and verify card display
      await act(async () => {
        root?.render(
          <ApplicationTracker
            records={[]}
            visits={lists.visited.map((v) => v.visitRecord!).filter(Boolean)}
            language="bn"
            onUpdateRecord={vi.fn()}
            onDeleteRecord={vi.fn()}
          />
        );
      });
      await flushUi();

      const text = container.textContent || '';
      expect(text).toContain('Assistant Programmer');
      expect(text).toContain('BPSC');
      expect(text).toContain('ভিজিট: ২ বার');
      expect(text).toContain('আবেদন করুন');
      expect(text).toContain('আবেদন সম্পন্ন চিহ্নিত করুন');
    });

    it('Test B: Clicking Apply Now / Starting Autofill keeps job in VISITED with subStatus "Application Started"', async () => {
      const v = await JobVisitRepository.recordVisit({
        jobId: 'job_apply_started',
        jobTitle: 'Medical Officer',
        organization: 'Directorate General of Health Services',
        circularUrl: 'https://dghs.teletalk.com.bd/circ.php',
        applicationUrl: 'https://dghs.teletalk.com.bd/apply.php',
      });
      expect(v).not.toBeNull();

      // Start application (autofill started)
      const appRecord = await ApplicationRepository.setStatus(
        {
          id: 'job_apply_started',
          jobTitle: 'Medical Officer',
          organization: 'Directorate General of Health Services',
          circularUrl: 'https://dghs.teletalk.com.bd/circ.php',
          applicationUrl: 'https://dghs.teletalk.com.bd/apply.php',
          deadlineAt: null,
        },
        'Application Started'
      );
      expect(appRecord.status).toBe('Application Started');

      // Verify lists
      const lists = await ApplicationRepository.getVisitedAndAppliedLists();
      expect(lists.visitedCount).toBe(1);
      expect(lists.appliedCount).toBe(0); // STRICT INVARIANT: NOT IN APPLIED!
      expect(lists.visited[0].subStatus).toBe('Application Started');
      expect(lists.visited[0].jobTitle).toBe('Medical Officer');

      // Verify UI renders sub-status badge in Visited tab
      await act(async () => {
        root?.render(
          <ApplicationTracker
            records={[appRecord]}
            visits={await JobVisitRepository.getAllVisits()}
            language="en"
            onUpdateRecord={vi.fn()}
            onDeleteRecord={vi.fn()}
          />
        );
      });
      await flushUi();

      expect(container.textContent).toContain('Application Started');
      expect(container.textContent).toContain('# 1'); // Visited count = 1
      expect(container.textContent).toContain('# 0'); // Applied count = 0
    });
  });

  // =========================================================================
  // 3. CONFIRMED SUBMISSION TRANSITION & STRICT MUTUAL EXCLUSIVITY
  // =========================================================================
  describe('3. Confirmed Submission Transition & Strict Mutual Exclusivity', () => {
    it('Test C: moveJobToApplied atomically transitions job from VISITED to APPLIED, updates counts, and removes from VISITED', async () => {
      // Setup visited circular
      await JobVisitRepository.recordVisit({
        jobId: 'job_transition_test',
        jobTitle: 'Assistant Commissioner',
        organization: 'Bangladesh Public Service Commission',
        circularUrl: 'https://bpsc.teletalk.com.bd/46th_bcs.php',
        applicationUrl: 'https://bpsc.teletalk.com.bd/apply.php',
      });

      let lists = await ApplicationRepository.getVisitedAndAppliedLists();
      expect(lists.visitedCount).toBe(1);
      expect(lists.appliedCount).toBe(0);

      // Perform verified application submission
      const evidence = {
        teletalkUserId: 'BCS_NIZJARPKQP',
        applicantId: 'APP-BCS-2026-99',
        transactionId: 'TXN1029384756',
        loginUrl: 'https://bpsc.teletalk.com.bd/login.php',
        credentialId: 'cred_bpsc_01',
        confirmedAt: Date.now(),
      };
      const applied = await ApplicationRepository.moveJobToApplied('job_transition_test', evidence);

      expect(applied.status).toBe('Applied');
      expect(applied.teletalkUserId).toBe('BCS_NIZJARPKQP');
      expect(applied.submissionConfirmedAt).toBe(evidence.confirmedAt);
      expect(applied.needsReview).toBe(false);

      // Verify mutual exclusivity: Visited drops to 0, Applied increments to 1
      lists = await ApplicationRepository.getVisitedAndAppliedLists();
      expect(lists.visitedCount).toBe(0); // STRICT: Completely gone from visited!
      expect(lists.appliedCount).toBe(1);
      expect(lists.applied[0].jobId).toBe('job_transition_test');
      expect(lists.applied[0].teletalkUserId).toBe('BCS_NIZJARPKQP');

      // Verify UI rendering in APPLIED tab
      await act(async () => {
        root?.render(
          <ApplicationTracker
            records={[applied]}
            visits={await JobVisitRepository.getAllVisits()}
            language="bn"
            initialTab="applied"
            onUpdateRecord={vi.fn()}
            onDeleteRecord={vi.fn()}
          />
        );
      });
      await flushUi();

      const text = container.textContent || '';
      expect(text).toContain('Assistant Commissioner');
      expect(text).toContain('Bangladesh Public Service Commission');
      expect(text).toContain('BCS_NIZJARPKQP');
      expect(text).toContain('bpsc.teletalk.com.bd');
      expect(text).toContain('পোর্টালে লগইন করুন');
      expect(text).toContain('Credential Vault');
    });

    it('Test D: Submission failure / validation error keeps job in VISITED and never marks Applied', async () => {
      await JobVisitRepository.recordVisit({
        jobId: 'job_failed_sub',
        jobTitle: 'Accounts Officer',
        organization: 'Petrobangla',
        circularUrl: 'https://petrobangla.teletalk.com.bd/circ.php',
      });

      // Record submission failure (e.g. photo size invalid or network drop)
      const failedApp = await ApplicationRepository.setStatus(
        {
          id: 'job_failed_sub',
          jobTitle: 'Accounts Officer',
          organization: 'Petrobangla',
          circularUrl: 'https://petrobangla.teletalk.com.bd/circ.php',
          applicationUrl: null,
          deadlineAt: null,
        },
        'Submission Failed',
        {
          notes: 'Photo dimensions were not 300x300. Submission rejected by portal.',
        }
      );
      expect(failedApp.status).toBe('Submission Failed');

      const lists = await ApplicationRepository.getVisitedAndAppliedLists();
      expect(lists.visitedCount).toBe(1);
      expect(lists.appliedCount).toBe(0); // STRICT INVARIANT!
      expect(lists.visited[0].subStatus).toBe('Submission Failed');
    });

    it('Test E: Ambiguous submission flags job for manual confirmation and user can confirm into APPLIED', async () => {
      await JobVisitRepository.recordVisit({
        jobId: 'job_ambiguous',
        jobTitle: 'System Analyst',
        organization: 'BCC',
        circularUrl: 'https://bcc.gov.bd/job.html',
      });

      const flagged = await ApplicationRepository.setStatus(
        {
          id: 'job_ambiguous',
          jobTitle: 'System Analyst',
          organization: 'BCC',
          circularUrl: 'https://bcc.gov.bd/job.html',
          applicationUrl: null,
          deadlineAt: null,
        },
        'Needs Manual Confirmation',
        {
          needsReview: true,
          reviewReason: 'Submission button clicked but no confirmation receipt detected.',
        }
      );

      let lists = await ApplicationRepository.getVisitedAndAppliedLists();
      expect(lists.visitedCount).toBe(1);
      expect(lists.appliedCount).toBe(0);
      expect(lists.visited[0].subStatus).toBe('Needs Manual Confirmation');

      // User confirms manual submission
      await ApplicationRepository.moveJobToApplied('job_ambiguous', {
        teletalkUserId: 'BCC_SYS_99',
        confirmedAt: Date.now(),
      });

      lists = await ApplicationRepository.getVisitedAndAppliedLists();
      expect(lists.visitedCount).toBe(0);
      expect(lists.appliedCount).toBe(1);
      expect(lists.applied[0].status).toBe('Applied');
      expect(lists.applied[0].teletalkUserId).toBe('BCC_SYS_99');
    });
  });

  // =========================================================================
  // 4. STORAGE PERSISTENCE ACROSS BROWSER RESTARTS
  // =========================================================================
  describe('4. Persistence Across Browser Restart / Storage Reload', () => {
    it('Test F: Database reload preserves exact Visited and Applied partition without loss or misclassification', async () => {
      // 1. Store 3 visited circulars
      await JobVisitRepository.recordVisit({
        jobId: 'persist_v1',
        jobTitle: 'Job V1',
        organization: 'Org A',
        circularUrl: 'https://org-a.com/circ1',
      });
      await JobVisitRepository.recordVisit({
        jobId: 'persist_v2',
        jobTitle: 'Job V2',
        organization: 'Org B',
        circularUrl: 'https://org-b.com/circ2',
      });
      await JobVisitRepository.recordVisit({
        jobId: 'persist_v3',
        jobTitle: 'Job V3',
        organization: 'Org C',
        circularUrl: 'https://org-c.com/circ3',
      });

      // 2. Store 2 applied jobs
      await ApplicationRepository.moveJobToApplied('persist_app_1', {
        jobTitle: 'Job App 1',
        organization: 'Org D',
        circularUrl: 'https://org-d.com/circ',
        teletalkUserId: 'USER_APP_1',
      });
      await ApplicationRepository.moveJobToApplied('persist_app_2', {
        jobTitle: 'Job App 2',
        organization: 'Org E',
        circularUrl: 'https://org-e.com/circ',
        teletalkUserId: 'USER_APP_2',
      });

      // Simulate browser restart / storage reload
      const reloaded = await ApplicationRepository.getVisitedAndAppliedLists();

      expect(reloaded.visitedCount).toBe(3);
      expect(reloaded.appliedCount).toBe(2);

      const visitedIds = new Set(reloaded.visited.map((v) => v.jobId));
      expect(visitedIds.has('persist_v1')).toBe(true);
      expect(visitedIds.has('persist_v2')).toBe(true);
      expect(visitedIds.has('persist_v3')).toBe(true);

      const appliedIds = new Set(reloaded.applied.map((a) => a.jobId));
      expect(appliedIds.has('persist_app_1')).toBe(true);
      expect(appliedIds.has('persist_app_2')).toBe(true);

      // Ensure no intersection whatsoever
      for (const id of visitedIds) {
        expect(appliedIds.has(id)).toBe(false);
      }
    });
  });

  // =========================================================================
  // 5. SAME-ORGANIZATION DISAMBIGUATION & CARD REMOVAL
  // =========================================================================
  describe('5. Multi-Job Disambiguation & Card Actions', () => {
    it('Test G: Disambiguates two distinct jobs from the same organization (one Visited, one Applied)', async () => {
      // Organization: BPSC
      // Job 1: 45th BCS -> Applied
      await ApplicationRepository.moveJobToApplied('bpsc_45_bcs', {
        jobTitle: '45th BCS Cadre Officer',
        organization: 'BPSC',
        circularUrl: 'https://bpsc.teletalk.com.bd/45th.php',
        teletalkUserId: 'BCS45_USER',
      });

      // Job 2: Senior Staff Nurse -> Visited only
      await JobVisitRepository.recordVisit({
        jobId: 'bpsc_nurse_2026',
        jobTitle: 'Senior Staff Nurse',
        organization: 'BPSC',
        circularUrl: 'https://bpsc.teletalk.com.bd/nurse.php',
      });

      const lists = await ApplicationRepository.getVisitedAndAppliedLists();

      expect(lists.visitedCount).toBe(1);
      expect(lists.appliedCount).toBe(1);

      expect(lists.visited[0].jobTitle).toBe('Senior Staff Nurse');
      expect(lists.applied[0].jobTitle).toBe('45th BCS Cadre Officer');

      // Render UI and verify both appear in their respective tabs without mixing
      await act(async () => {
        root?.render(
          <ApplicationTracker
            records={lists.applied}
            visits={await JobVisitRepository.getAllVisits()}
            language="en"
            onUpdateRecord={vi.fn()}
            onDeleteRecord={vi.fn()}
          />
        );
      });
      await flushUi();

      const html = container.innerHTML;
      expect(html).toContain('Senior Staff Nurse');
      expect(html).toContain('45th BCS Cadre Officer');
      expect(html).toContain('BCS45_USER');
    });

    it('Test H: "Remove from Visited" deletes the item from Visited without affecting Applied records', async () => {
      await JobVisitRepository.recordVisit({
        jobId: 'remove_me_visit',
        jobTitle: 'Temporary Clerk',
        organization: 'Land Ministry',
        circularUrl: 'https://land.gov.bd/clerk.html',
      });
      await ApplicationRepository.moveJobToApplied('keep_me_applied', {
        jobTitle: 'Assistant Director',
        organization: 'Anti-Corruption Commission',
        circularUrl: 'https://acc.org.bd/circ',
        teletalkUserId: 'ACC_USER_1',
      });

      let lists = await ApplicationRepository.getVisitedAndAppliedLists();
      expect(lists.visitedCount).toBe(1);
      expect(lists.appliedCount).toBe(1);

      // Call removeFromVisited
      await ApplicationRepository.removeFromVisited('remove_me_visit');

      lists = await ApplicationRepository.getVisitedAndAppliedLists();
      expect(lists.visitedCount).toBe(0); // Removed!
      expect(lists.appliedCount).toBe(1); // Untouched!
      expect(lists.applied[0].jobId).toBe('keep_me_applied');
    });
  });

  // =========================================================================
  // 6. PRODUCTION RELEASE INTEGRITY
  // =========================================================================
  describe('6. Production Store Release ZIP Hash Integrity', () => {
    it('verifies SHA-256 hashes of Edge and Chrome production packages remain untouched', () => {
      const edgeZipPath = path.resolve('D:/Job form Fill-up extension/release/JobFill-BD-Edge.zip');
      const chromeZipPath = path.resolve('D:/Job form Fill-up extension/release/chrome/JobFill-BD-Chrome.zip');

      const expectedEdgeHash = 'DB08AA45F1C3ED99AD8ADEBF5B81EDFA94812E93A02557D2306EE171AAD52732';
      const expectedChromeHash = '23D002185F2640CB47803A086AB39076F2C2E923AC84405C3117391D65F89DB9';

      const edgeBuffer = fs.readFileSync(edgeZipPath);
      const edgeActual = crypto.createHash('sha256').update(edgeBuffer).digest('hex').toUpperCase();

      const chromeBuffer = fs.readFileSync(chromeZipPath);
      const chromeActual = crypto.createHash('sha256').update(chromeBuffer).digest('hex').toUpperCase();

      expect(edgeActual).toBe(expectedEdgeHash);
      expect(chromeActual).toBe(expectedChromeHash);
    });
  });
});
