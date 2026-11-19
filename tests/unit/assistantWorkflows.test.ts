// JobFill BD - Smart Job Application Assistant Comprehensive Workflows Suite
// Tests:
// A. Automatic Job Circular Visit Tracking (deduplication, canonicalization, count increment, toggle, clear)
// B. Automatic Job Application Tracker (Application Started, Submission Pending, Submission Failed, Confirmed Applied)
// C. Secure Job Portal Credential Manager (classifyForm, generated credentials detection, trusted autofill origins)
// D. assistant-workflows helpers (detectJobCircularPage, detectApplicationConfirmation, isJobApplicationForm)

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JobVisitRepository } from '../../src/jobs/database/job-visit-repository';
import { ApplicationRepository } from '../../src/jobs/database/application-repository';
import { CredentialVaultRepository } from '../../src/credentials/credential-repository';
import { LoginFormDetector } from '../../src/credentials/login-detector';
import {
  detectJobCircularPage,
  detectApplicationConfirmation,
  isJobApplicationForm,
} from '../../src/content/assistant-workflows';

describe('Smart Job Application Assistant Workflows & Safety Suite', () => {
  beforeEach(async () => {
    localStorage.clear();
    await JobVisitRepository.clearAllVisits();
    await ApplicationRepository.clearAll();
    await CredentialVaultRepository.resetForIsolatedUnitTest();
    document.body.innerHTML = '';
  });

  afterEach(async () => {
    await JobVisitRepository.clearAllVisits();
    await ApplicationRepository.clearAll();
    await CredentialVaultRepository.resetForIsolatedUnitTest();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  // =========================================================================
  // WORKFLOW A: AUTOMATIC JOB CIRCULAR VISIT TRACKING
  // =========================================================================
  describe('Workflow A: Circular Visit Tracking & Deduplication', () => {
    it('1. Canonicalizes circular URLs by stripping tracking parameters, hashes and trailing slashes', () => {
      const rawUrl1 = 'https://alljobs.teletalk.com.bd/circular/bpsc-48?utm_source=facebook&utm_medium=cpc#details';
      const rawUrl2 = 'https://ALLJOBS.teletalk.com.bd/circular/bpsc-48/';
      const rawUrl3 = 'https://jobs.bdjobs.com/jobdetails.asp?id=123456&ref=alert&fbclid=XYZ123';

      expect(JobVisitRepository.canonicalizeJobUrl(rawUrl1)).toBe('https://alljobs.teletalk.com.bd/circular/bpsc-48');
      expect(JobVisitRepository.canonicalizeJobUrl(rawUrl2)).toBe('https://alljobs.teletalk.com.bd/circular/bpsc-48');
      expect(JobVisitRepository.canonicalizeJobUrl(rawUrl3)).toBe('https://jobs.bdjobs.com/jobdetails.asp?id=123456');
    });

    it('2. Records visits, deduplicates by canonical URL, increments visitCount and preserves firstVisitedAt', async () => {
      const record1 = await JobVisitRepository.recordVisit({
        jobId: 'job_48_bcs',
        sourceId: 'bpsc',
        organization: 'Bangladesh Public Service Commission',
        jobTitle: '48th BCS Examination',
        circularUrl: 'https://bpsc.teletalk.com.bd/circular/48?utm_source=feed',
        verificationStatus: 'official_verified',
      });

      expect(record1.visitCount).toBe(1);
      expect(record1.organization).toBe('Bangladesh Public Service Commission');
      expect(record1.canonicalUrl).toBe('https://bpsc.teletalk.com.bd/circular/48');

      const firstTime = record1.firstVisitedAt;

      // Simulate a return visit later
      const record2 = await JobVisitRepository.recordVisit({
        jobId: 'job_48_bcs',
        sourceId: 'bpsc',
        organization: 'Bangladesh Public Service Commission',
        jobTitle: '48th BCS Examination',
        circularUrl: 'https://bpsc.teletalk.com.bd/circular/48?ref=email#requirements',
        verificationStatus: 'official_verified',
      });

      expect(record2.visitId).toBe(record1.visitId);
      expect(record2.visitCount).toBe(2);
      expect(record2.firstVisitedAt).toBe(firstTime);
      expect(record2.lastVisitedAt).toBeGreaterThanOrEqual(firstTime);

      const allVisits = await JobVisitRepository.getAllVisits();
      expect(allVisits).toHaveLength(1);
    });

    it('3. Supports user setting toggle to enable or disable automatic visit tracking without modifying chrome.history', async () => {
      expect(await JobVisitRepository.isVisitTrackingEnabled()).toBe(true);

      await JobVisitRepository.setVisitTrackingEnabled(false);
      expect(await JobVisitRepository.isVisitTrackingEnabled()).toBe(false);

      // When tracking is disabled, recordVisit returns existing or empty record without saving
      const attempted = await JobVisitRepository.recordVisit({
        sourceId: 'bdjobs',
        organization: 'Grameenphone',
        jobTitle: 'Software Engineer',
        circularUrl: 'https://jobs.bdjobs.com/jobdetails.asp?id=9999',
      });

      expect(attempted).toBeNull();
      const visits = await JobVisitRepository.getAllVisits();
      expect(visits).toHaveLength(0);

      // Re-enable
      await JobVisitRepository.setVisitTrackingEnabled(true);
      expect(await JobVisitRepository.isVisitTrackingEnabled()).toBe(true);
    });

    it('4. Removes single visit record and clears all visit records cleanly', async () => {
      const v1 = await JobVisitRepository.recordVisit({
        sourceId: 'teletalk',
        organization: 'Petrobangla',
        jobTitle: 'Assistant Manager',
        circularUrl: 'https://petrobangla.teletalk.com.bd/circular',
      });
      const v2 = await JobVisitRepository.recordVisit({
        sourceId: 'bb',
        organization: 'Bangladesh Bank',
        jobTitle: 'Officer (Cash)',
        circularUrl: 'https://erecruitment.bb.org.bd/onlineapp/jobdetails.php?id=102',
      });

      expect(await JobVisitRepository.getAllVisits()).toHaveLength(2);

      await JobVisitRepository.removeVisit(v1.visitId);
      const remaining = await JobVisitRepository.getAllVisits();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].visitId).toBe(v2.visitId);

      await JobVisitRepository.clearAllVisits();
      expect(await JobVisitRepository.getAllVisits()).toHaveLength(0);
    });
  });

  // =========================================================================
  // WORKFLOW B: AUTOMATIC JOB APPLICATION TRACKER LIFECYCLE
  // =========================================================================
  describe('Workflow B: Application Tracker Extended Lifecycle', () => {
    it('1. Correctly transitions through Visited, Application Started, Submission Pending, and Applied', async () => {
      const jobMock = {
        id: 'job_test_001',
        jobTitle: 'Senior Officer (General)',
        organization: 'Sonali Bank PLC',
        applicationUrl: 'https://erecruitment.bb.org.bd/apply/101',
        circularUrl: 'https://bb.org.bd/circ_101.pdf',
        circularNumber: 'SB-2026-01',
        deadlineAt: Date.parse('2026-12-31T18:00:00Z'),
      };

      // Step 1: Visited
      const visited = await ApplicationRepository.setStatus(jobMock, 'Visited');
      expect(visited.status).toBe('Visited');

      // Step 2: Application Started (on clicking Apply Now)
      const started = await ApplicationRepository.setStatus(jobMock, 'Application Started', {
        circularId: 'SB-2026-01',
        applicationDate: '2026-11-14',
      });
      expect(started.status).toBe('Application Started');
      expect(started.circularId).toBe('SB-2026-01');

      // Step 3: Submission Pending Verification (on passive form submit observation)
      const pending = await ApplicationRepository.setStatus(jobMock, 'Submission Pending Verification');
      expect(pending.status).toBe('Submission Pending Verification');

      // Step 4: Submission Confirmed (receipt detected with Teletalk User ID)
      const confirmed = await ApplicationRepository.setStatus(jobMock, 'Applied', {
        teletalkUserId: 'SB99234',
        feePaymentStatus: 'unpaid',
      });
      expect(confirmed.status).toBe('Applied');
      expect(confirmed.teletalkUserId).toBe('SB99234');
      expect(confirmed.feePaymentStatus).toBe('unpaid');
    });

    it('2. Records Submission Failed without marking status as falsely Applied', async () => {
      const jobMock = {
        id: 'job_test_002',
        jobTitle: 'Assistant Programmer',
        organization: 'BPSC',
        applicationUrl: 'https://bpsc.teletalk.com.bd',
        circularUrl: 'https://bpsc.gov.bd/circ.pdf',
        deadlineAt: null,
      };

      const failed = await ApplicationRepository.setStatus(jobMock, 'Submission Failed', {
        notes: 'Network timeout during final submit step',
      });

      expect(failed.status).toBe('Submission Failed');
      expect(failed.notes).toBe('Network timeout during final submit step');
      expect(failed.status).not.toBe('Applied');
    });
  });

  // =========================================================================
  // WORKFLOW C & C2: CREDENTIAL MANAGER & DETECTION
  // =========================================================================
  describe('Workflow C: Credential Detection & Classification', () => {
    it('1. Classifies login vs registration vs application forms correctly', () => {
      // Login form
      const loginForm = document.createElement('form');
      loginForm.innerHTML = `
        <input type="text" name="username" placeholder="User ID / Email" />
        <input type="password" name="password" placeholder="Password" />
        <button type="submit">Sign In</button>
      `;
      expect(LoginFormDetector.classifyForm(loginForm)).toBe('login');

      // Registration form
      const regForm = document.createElement('form');
      regForm.innerHTML = `
        <input type="text" name="fullName" />
        <input type="email" name="email" />
        <input type="password" name="password" />
        <input type="password" name="confirm_password" />
        <button type="submit">Register Account</button>
      `;
      expect(LoginFormDetector.classifyForm(regForm)).toBe('registration');

      // Job application form
      const appForm = document.createElement('form');
      appForm.innerHTML = `
        <input type="text" name="applicant_name" />
        <input type="text" name="father_name" />
        <input type="text" name="mother_name" />
        <input type="text" name="nid" />
        <select name="district"><option>Dhaka</option></select>
        <button type="submit">Submit Application</button>
      `;
      expect(LoginFormDetector.classifyForm(appForm)).toBe('application');
    });

    it('2. Detects generated credentials on confirmation / applicant copy page', () => {
      document.body.innerHTML = `
        <div class="confirmation-box">
          <h2>Application Submitted Successfully</h2>
          <p>Please preserve your login credentials for admit card download:</p>
          <table>
            <tr><td>User ID:</td><td><strong>TL887712</strong></td></tr>
            <tr><td>Password:</td><td><strong>BdJob#Pass99</strong></td></tr>
          </table>
        </div>
      `;

      const detected = LoginFormDetector.detectGeneratedPortalCredentials(document);
      expect(detected.hasGeneratedCredentials).toBe(true);
      expect(detected.userId).toBe('TL887712');
      expect(detected.password).toBe('BdJob#Pass99');
    });

    it('3. Manages trusted autofill origins securely with exact HTTPS matching', async () => {
      expect(await CredentialVaultRepository.isOriginTrustedForAutofill('https://alljobs.teletalk.com.bd')).toBe(false);

      await CredentialVaultRepository.setTrustedAutofillOrigin('https://alljobs.teletalk.com.bd', true);
      expect(await CredentialVaultRepository.isOriginTrustedForAutofill('https://alljobs.teletalk.com.bd')).toBe(true);
      // HTTP or different subdomains are never falsely trusted
      expect(await CredentialVaultRepository.isOriginTrustedForAutofill('http://alljobs.teletalk.com.bd')).toBe(false);
      expect(await CredentialVaultRepository.isOriginTrustedForAutofill('https://fake-alljobs.com')).toBe(false);

      await CredentialVaultRepository.setTrustedAutofillOrigin('https://alljobs.teletalk.com.bd', false);
      expect(await CredentialVaultRepository.isOriginTrustedForAutofill('https://alljobs.teletalk.com.bd')).toBe(false);
    });
  });

  // =========================================================================
  // WORKFLOW D: ASSISTANT WORKFLOW CONTENT SCRIPT HELPERS
  // =========================================================================
  describe('Workflow D: Content Assistant Detectors', () => {
    it('1. detectJobCircularPage detects Teletalk, BDJobs, and Bangladesh Bank circulars', () => {
      // Mock window location
      delete (window as any).location;
      (window as any).location = {
        href: 'https://alljobs.teletalk.com.bd/circular/bpsc-non-cadre',
        hostname: 'alljobs.teletalk.com.bd',
        origin: 'https://alljobs.teletalk.com.bd',
      };

      document.body.innerHTML = `
        <div class="header">
          <h1>Non-Cadre Officers Recruitment Notice</h1>
          <h2>Bangladesh Public Service Commission</h2>
        </div>
      `;

      const detected = detectJobCircularPage(document);
      expect(detected).not.toBeNull();
      expect(detected?.sourceId).toBe('teletalk');
      expect(detected?.jobTitle).toContain('Recruitment');
    });

    it('2. detectJobCircularPage ignores non-job web pages', () => {
      delete (window as any).location;
      (window as any).location = {
        href: 'https://www.google.com/search?q=weather',
        hostname: 'www.google.com',
        origin: 'https://www.google.com',
      };
      document.body.innerHTML = '<h1>Google Search</h1>';

      const detected = detectJobCircularPage(document);
      expect(detected).toBeNull();
    });

    it('3. detectApplicationConfirmation recognizes Teletalk confirmation slip and extracts User ID', () => {
      document.body.innerHTML = `
        <div class="applicant-copy">
          <h1>Applicant Copy</h1>
          <p>Application successfully received.</p>
          <div class="field">User ID: BPSC109923</div>
        </div>
      `;

      const conf = detectApplicationConfirmation(document);
      expect(conf.isConfirmed).toBe(true);
      expect(conf.teletalkUserId).toBe('BPSC109923');
    });

    it('4. isJobApplicationForm distinguishes full application forms from trivial forms', () => {
      const form = document.createElement('form');
      form.innerHTML = `
        <input name="applicant_name" type="text" />
        <input name="father_name" type="text" />
        <input name="date_of_birth" type="text" />
        <select name="gender"><option>Male</option></select>
        <select name="district"><option>Dhaka</option></select>
      `;

      expect(isJobApplicationForm(form)).toBe(true);

      const simpleForm = document.createElement('form');
      simpleForm.innerHTML = `<input name="search" type="text" /><button>Search</button>`;
      expect(isJobApplicationForm(simpleForm)).toBe(false);
    });
  });
});
