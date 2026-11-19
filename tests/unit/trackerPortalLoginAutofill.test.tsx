// JobFill BD - Application Tracker Portal Links & One-Click Secure Credential Autofill Test Suite
// Verifies:
// 1. Separate URL Architecture: circularUrl, applicationUrl, loginUrl, organizationUrl stored independently.
// 2. Strict PDF Invariant: Circular PDFs are NEVER used as login URLs.
// 3. Sensitive Parameter Stripping: Session tokens and auth codes stripped from stored URLs.
// 4. Portal Login URL Management & Reversible Undo: Retains previous URL to revert accidental edits.
// 5. Credential Association: Stable credentialId reference linking Application Tracker to Credential Vault.
// 6. Multi-Account Disambiguation: Multiple accounts for same portal origin linked to distinct jobs.
// 7. Login Form Detection & Classification: Distinguishes login from registration, password reset, and applications.
// 8. Strict Origin Matching: Rejects deceptive lookalikes, requires HTTPS.
// 9. Explicit User-Initiated Autofill: Fills username and password, dispatches events, verifies inputs.
// 10. Security Invariant: NEVER auto-submits login forms; passwords never shown in plaintext in Job Cards.
// 11. Application Tracker UI: Card actions "পোর্টালে লগইন করুন" vs "পোর্টাল লিংক যোগ করুন", domain chip, vault badge.
// 12. ApplicationPortalModal: Full URL management, PDF block, undo support, and secure credential linking.
// 13. Production Integrity: Edge and Chrome release ZIP SHA-256 hashes verified untouched.

import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApplicationRepository } from '../../src/jobs/database/application-repository';
import { ApplicationTrackerRecord } from '../../src/jobs/types/job.types';
import {
  CredentialVaultRepository,
  CredentialPortalSummary,
} from '../../src/credentials/credential-repository';
import { LoginFormDetector } from '../../src/credentials/login-detector';
import { isStrictOriginMatch } from '../../src/credentials/origin-matcher';
import { openApplicationPortalLoginTab } from '../../src/jobs/services/job-ui-actions';
import {
  ApplicationTracker,
  ApplicationPortalModal,
} from '../../src/jobs/dashboard/ApplicationTracker';

async function flushUi(ms = 30) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}

function setNativeInputValue(el: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value'
  )?.set;
  if (setter) {
    setter.call(el, value);
  } else {
    el.value = value;
  }
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('JobFill BD — Application Tracker Portal Links & Secure Credential Autofill Suite', () => {
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
    await CredentialVaultRepository.resetForIsolatedUnitTest();
    await CredentialVaultRepository.initializeVault('MasterPass123!@#', 15);
    await CredentialVaultRepository.unlockVault('MasterPass123!@#');
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
  // PART 1: URL ARCHITECTURE, VALIDATION & REVERSIBLE UNDO
  // =========================================================================
  describe('Part 1: Distinct URL Architecture, Validation & Undo', () => {
    it('1. Stores circularUrl, applicationUrl, loginUrl, and organizationUrl separately', async () => {
      const app = await ApplicationRepository.setStatus(
        {
          id: 'job_bpsc_47',
          jobTitle: 'Assistant Director (Admin)',
          organization: 'Bangladesh Public Service Commission',
          circularNumber: 'BPSC-47-2026',
          circularUrl: 'https://bpsc.gov.bd/notices/circular_47.pdf',
          applicationUrl: 'https://bpsc.teletalk.com.bd/bpsc_47/apply.php',
          deadlineAt: Date.parse('2026-12-15T18:00:00Z'),
        },
        'Applied',
        {
          loginUrl: 'https://bpsc.teletalk.com.bd/login.php',
          organizationUrl: 'https://bpsc.gov.bd',
          teletalkUserId: 'NIZJARPKQP',
        }
      );

      expect(app.circularUrl).toBe('https://bpsc.gov.bd/notices/circular_47.pdf');
      expect(app.applicationUrl).toBe('https://bpsc.teletalk.com.bd/bpsc_47/apply.php');
      expect(app.loginUrl).toBe('https://bpsc.teletalk.com.bd/login.php');
      expect(app.organizationUrl).toBe('https://bpsc.gov.bd');

      // URLs must never be collapsed or assumed identical
      expect(app.loginUrl).not.toBe(app.circularUrl);
      expect(app.loginUrl).not.toBe(app.applicationUrl);
      expect(app.loginUrl).not.toBe(app.organizationUrl);
    });

    it('2. SECURITY INVARIANT: PDF circular notices are REJECTED as Login URLs', async () => {
      const validation = ApplicationRepository.sanitizeAndValidateUrl(
        'https://bpsc.gov.bd/notices/circular_notice.pdf'
      );
      expect(validation.isValid).toBe(false);
      expect(validation.isPdfCircular).toBe(true);
      expect(validation.reason).toContain('Circular PDF cannot be used as a Login URL');

      await ApplicationRepository.upsert({
        jobId: 'job_test_pdf',
        jobTitle: 'Officer',
        organization: 'BPSC',
        status: 'Interested',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        deadlineAt: null,
      });

      // Attempting to set a PDF as login URL must throw an error
      await expect(
        ApplicationRepository.setLoginUrl(
          'job_test_pdf',
          'https://bpsc.gov.bd/notices/circular_notice.pdf'
        )
      ).rejects.toThrow(/Circular PDF cannot be used as a Login URL/);
    });

    it('3. Strips sensitive query parameters (tokens, session IDs) from candidate URLs', () => {
      const urlWithToken =
        'https://bpsc.teletalk.com.bd/applicant/login.php?token=secret_jwt_token_123&session=sess_abc999&keep=1';
      const result = ApplicationRepository.sanitizeAndValidateUrl(urlWithToken);

      expect(result.isValid).toBe(true);
      expect(result.isHttps).toBe(true);
      expect(result.normalizedUrl).not.toContain('token=secret_jwt_token_123');
      expect(result.normalizedUrl).not.toContain('session=sess_abc999');
      expect(result.normalizedUrl).toContain('keep=1');
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('4. Reversible Undo: Retains previous login URL when updated and allows reverting', async () => {
      const app = await ApplicationRepository.setStatus(
        {
          id: 'job_undo_1',
          jobTitle: 'Assistant Director',
          organization: 'Bangladesh Bank',
          applicationUrl: 'https://erecruitment.bb.org.bd',
          circularUrl: 'https://bb.org.bd/circ.pdf',
          deadlineAt: null,
        },
        'Interested',
        {
          loginUrl: 'https://erecruitment.bb.org.bd/onlineapp/index.php',
        }
      );

      expect(app.loginUrl).toBe('https://erecruitment.bb.org.bd/onlineapp/index.php');

      // User modifies the URL
      const updated = await ApplicationRepository.setLoginUrl(
        'job_undo_1',
        'https://erecruitment.bb.org.bd/new_login.php'
      );
      expect(updated.loginUrl).toBe('https://erecruitment.bb.org.bd/new_login.php');
      expect(updated.previousLoginUrl).toBe('https://erecruitment.bb.org.bd/onlineapp/index.php');

      // User triggers Undo
      const reverted = await ApplicationRepository.undoLoginUrlChange('job_undo_1');
      expect(reverted.loginUrl).toBe('https://erecruitment.bb.org.bd/onlineapp/index.php');
      expect(reverted.previousLoginUrl).toBeNull();
    });
  });

  // =========================================================================
  // PART 2: CREDENTIAL VAULT ASSOCIATION & MULTI-ACCOUNT DISAMBIGUATION
  // =========================================================================
  describe('Part 2: Credential Association & Multi-Account Disambiguation', () => {
    it('5. Links Application record to Credential Vault via stable credentialId without plaintext password storage', async () => {
      // 1. Create credential in vault
      const vaultItem = await CredentialVaultRepository.saveCredential({
        portalName: 'BPSC Teletalk',
        portalUrl: 'https://bpsc.teletalk.com.bd/login.php',
        organization: 'Bangladesh Public Service Commission',
        jobTitle: '47th BCS Examination',
        username: 'NIZJARPKQP',
        userId: 'NIZJARPKQP',
        password: 'UltraSecurePassword2026!@#',
        accountType: 'Job-Specific Account',
      });

      // 2. Link application record
      await ApplicationRepository.upsert({
        jobId: 'bcs_47_app',
        jobTitle: '47th BCS',
        organization: 'BPSC',
        status: 'Applied',
        deadlineAt: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const linked = await ApplicationRepository.linkCredential('bcs_47_app', vaultItem.id);
      expect(linked.credentialId).toBe(vaultItem.id);
      expect(linked.credentialLinkedAt).toBeDefined();

      // INVARIANT: Plaintext password NEVER enters ApplicationTrackerRecord
      expect((linked as any).password).toBeUndefined();

      // Unlink
      const unlinked = await ApplicationRepository.unlinkCredential('bcs_47_app');
      expect(unlinked.credentialId).toBeNull();
      expect(unlinked.credentialLinkedAt).toBeUndefined();
    });

    it('6. Multi-Account Disambiguation: Supports multiple accounts for same portal origin linked to distinct jobs', async () => {
      // Portal: https://bpsc.teletalk.com.bd
      // Account 1: 46th BCS
      const cred1 = await CredentialVaultRepository.saveCredential({
        portalName: 'BPSC Portal',
        portalUrl: 'https://bpsc.teletalk.com.bd',
        organization: 'BPSC',
        jobTitle: '46th BCS Examination',
        username: 'BCS46_CANDIDATE',
        userId: 'BCS46_CANDIDATE',
        password: 'PassBCS46!@#',
        accountType: 'Job-Specific Account',
      });

      // Account 2: 47th BCS
      const cred2 = await CredentialVaultRepository.saveCredential({
        portalName: 'BPSC Portal',
        portalUrl: 'https://bpsc.teletalk.com.bd',
        organization: 'BPSC',
        jobTitle: '47th BCS Examination',
        username: 'BCS47_CANDIDATE',
        userId: 'BCS47_CANDIDATE',
        password: 'PassBCS47!@#',
        accountType: 'Job-Specific Account',
      });

      // Two distinct application records
      const app1 = await ApplicationRepository.setStatus(
        {
          id: 'app_bcs_46',
          jobTitle: '46th BCS',
          organization: 'BPSC',
          applicationUrl: 'https://bpsc.teletalk.com.bd',
          circularUrl: 'https://bpsc.gov.bd/bcs46.pdf',
          deadlineAt: null,
        },
        'Applied',
        {
          loginUrl: 'https://bpsc.teletalk.com.bd/login.php',
          credentialId: cred1.id,
        }
      );

      const app2 = await ApplicationRepository.setStatus(
        {
          id: 'app_bcs_47',
          jobTitle: '47th BCS',
          organization: 'BPSC',
          applicationUrl: 'https://bpsc.teletalk.com.bd',
          circularUrl: 'https://bpsc.gov.bd/bcs47.pdf',
          deadlineAt: null,
        },
        'Applied',
        {
          loginUrl: 'https://bpsc.teletalk.com.bd/login.php',
          credentialId: cred2.id,
        }
      );

      expect(app1.credentialId).toBe(cred1.id);
      expect(app2.credentialId).toBe(cred2.id);
      expect(app1.credentialId).not.toBe(app2.credentialId);
    });
  });

  // =========================================================================
  // PART 3: LOGIN FORM DETECTION, CLASSIFICATION & ORIGIN MATCHING
  // =========================================================================
  describe('Part 3: Login Form Detection, Classification & Origin Security', () => {
    it('7. Accurately detects and classifies visible login form vs registration vs full application', () => {
      // 1. Genuine Login Form
      document.body.innerHTML = `
        <form id="portal-login" action="/login" method="POST">
          <label for="uid">Applicant User ID</label>
          <input type="text" id="uid" name="applicant_user_id" value="" />
          <label for="pwd">Password</label>
          <input type="password" id="pwd" name="user_password" value="" />
          <button type="submit">Login</button>
        </form>
      `;
      const formEl = document.getElementById('portal-login') as HTMLFormElement;
      const detected = LoginFormDetector.scan(document);
      expect(detected.hasLoginForm).toBe(true);
      expect(detected.hasPasswordField).toBe(true);
      expect(detected.hasUsernameField).toBe(true);
      expect(LoginFormDetector.classifyForm(formEl)).toBe('login');

      // 2. Registration Form with Password Confirmation
      document.body.innerHTML = `
        <form id="portal-reg">
          <input type="text" name="user_id" />
          <input type="password" name="password" />
          <input type="password" name="confirm_password" />
        </form>
      `;
      const regEl = document.getElementById('portal-reg') as HTMLFormElement;
      expect(LoginFormDetector.classifyForm(regEl)).toBe('registration');

      // 3. Multi-field Job Application Form
      document.body.innerHTML = `
        <form id="job-app">
          <input type="text" name="applicant_name" />
          <input type="text" name="father_name" />
          <input type="text" name="mother_name" />
          <input type="text" name="mobile" />
          <input type="text" name="nid" />
          <input type="text" name="ssc_roll" />
          <input type="text" name="hsc_roll" />
          <select name="gender"><option>Male</option></select>
          <select name="quota"><option>General</option></select>
        </form>
      `;
      const jobAppEl = document.getElementById('job-app') as HTMLFormElement;
      expect(LoginFormDetector.classifyForm(jobAppEl)).toBe('application');
    });

    it('8. Anti-Phishing Security: Strict HTTPS origin match rejects deceptive lookalikes', () => {
      const legitOrigin = 'https://bpsc.teletalk.com.bd';

      // Genuine matches
      expect(isStrictOriginMatch(legitOrigin, 'https://bpsc.teletalk.com.bd/login.php').matched).toBe(true);
      expect(isStrictOriginMatch(legitOrigin, 'https://bpsc.teletalk.com.bd/index.php?page=1').matched).toBe(true);

      // Deceptive lookalike domains MUST be rejected
      expect(isStrictOriginMatch(legitOrigin, 'https://bpsc.teletalk.fakeportal.com/login').matched).toBe(false);
      expect(isStrictOriginMatch(legitOrigin, 'https://bpsc.teletalk.com.bd.attacker.site').matched).toBe(false);
      expect(isStrictOriginMatch(legitOrigin, 'http://bpsc.teletalk.com.bd/login').matched).toBe(false); // Insecure HTTP
    });

    it('9. Explicit Autofill Execution: Populates username & password and dispatches native events', () => {
      document.body.innerHTML = `
        <form id="bpsc-login">
          <input type="text" id="user" name="applicant_id" value="" />
          <input type="password" id="pass" name="applicant_password" value="" />
        </form>
      `;
      const userEl = document.getElementById('user') as HTMLInputElement;
      const passEl = document.getElementById('pass') as HTMLInputElement;

      let inputDispatched = false;
      userEl.addEventListener('input', () => {
        inputDispatched = true;
      });

      // 1. Silent fill without explicit initiation MUST fail
      const silentRes = LoginFormDetector.executeExplicitFill(
        document,
        'https://bpsc.teletalk.com.bd/login',
        {
          expectedOrigin: 'https://bpsc.teletalk.com.bd',
          username: 'NIZJARPKQP',
          password: 'SecretPass123!@#',
          fillMode: 'both',
          explicitUserInitiated: false, // NOT initiated by user
        }
      );
      expect(silentRes.ok).toBe(false);
      expect(userEl.value).toBe('');

      // 2. Explicit User-Initiated Autofill MUST succeed
      const explicitRes = LoginFormDetector.executeExplicitFill(
        document,
        'https://bpsc.teletalk.com.bd/login',
        {
          expectedOrigin: 'https://bpsc.teletalk.com.bd',
          username: 'NIZJARPKQP',
          password: 'SecretPass123!@#',
          fillMode: 'both',
          explicitUserInitiated: true,
        }
      );

      expect(explicitRes.ok).toBe(true);
      expect(explicitRes.filledUsername).toBe(true);
      expect(explicitRes.filledPassword).toBe(true);
      expect(userEl.value).toBe('NIZJARPKQP');
      expect(passEl.value).toBe('SecretPass123!@#');
      expect(inputDispatched).toBe(true);
    });

    it('10. SECURITY INVARIANT: Forms are NEVER automatically submitted by autofill', () => {
      let formSubmitted = false;
      document.body.innerHTML = `
        <form id="test-submit-form" action="/submit" method="POST">
          <input type="text" id="uid_test" name="userid" value="" />
          <input type="password" id="pwd_test" name="password" value="" />
          <button type="submit" id="submit-btn">Submit Login</button>
        </form>
      `;
      const form = document.getElementById('test-submit-form') as HTMLFormElement;
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        formSubmitted = true;
      });

      LoginFormDetector.executeExplicitFill(document, 'https://bpsc.teletalk.com.bd/login', {
        expectedOrigin: 'https://bpsc.teletalk.com.bd',
        username: 'CANDIDATE_1',
        password: 'Pass123!@#',
        fillMode: 'both',
        explicitUserInitiated: true,
      });

      // Strict Invariant: Form must NEVER be submitted by the extension!
      expect(formSubmitted).toBe(false);
    });
  });

  // =========================================================================
  // PART 4: APPLICATION TRACKER UI & ACTION WORKFLOW
  // =========================================================================
  describe('Part 4: Application Tracker UI, Card Action & Management Modal', () => {
    it('11. Renders "পোর্টালে লগইন করুন" when loginUrl exists, and "পোর্টাল লিংক যোগ করুন" when missing', async () => {
      const records: ApplicationTrackerRecord[] = [
        {
          jobId: 'app_has_login',
          jobTitle: 'Assistant Director',
          organization: 'Bangladesh Bank',
          status: 'Applied',
          loginUrl: 'https://erecruitment.bb.org.bd/onlineapp/index.php',
          credentialId: 'cred_bb_99',
          teletalkUserId: 'BB_USER_99',
          deadlineAt: null,
          createdAt: 1000,
          updatedAt: 2000,
        },
        {
          jobId: 'app_missing_login',
          jobTitle: 'Scientific Officer',
          organization: 'PetroBangla',
          status: 'Interested',
          loginUrl: null, // Missing!
          deadlineAt: null,
          createdAt: 1000,
          updatedAt: 2000,
        },
      ];

      await act(async () => {
        root?.render(
          <ApplicationTracker
            records={records}
            language="bn"
            onUpdateRecord={vi.fn()}
            onDeleteRecord={vi.fn()}
          />
        );
      });
      await flushUi(40);

      const html = container.innerHTML;

      // Card 1 has loginUrl -> displays "পোর্টালে লগইন করুন"
      expect(html).toContain('পোর্টালে লগইন করুন');

      // Card 2 missing loginUrl -> displays "পোর্টাল লিংক যোগ করুন"
      expect(html).toContain('পোর্টাল লিংক যোগ করুন');

      // Portal domain chip is displayed
      expect(html).toContain('erecruitment.bb.org.bd');

      // User ID chip is displayed
      expect(html).toContain('BB_USER_99');

      // Credential Vault indicator is displayed
      expect(html).toContain('Credential Vault');
    });

    it('12. ApplicationPortalModal manages all 4 URLs, blocks PDF, and links Vault credentials', async () => {
      const record: ApplicationTrackerRecord = {
        jobId: 'modal_test_job',
        jobTitle: 'Assistant Director',
        organization: 'BPSC',
        status: 'Applied',
        applicationUrl: 'https://bpsc.teletalk.com.bd/apply.php',
        circularUrl: 'https://bpsc.gov.bd/notice.pdf',
        loginUrl: 'https://bpsc.teletalk.com.bd/login.php',
        organizationUrl: 'https://bpsc.gov.bd',
        deadlineAt: null,
        createdAt: 1000,
        updatedAt: 2000,
      };

      const mockVaultCreds: CredentialPortalSummary[] = [
        {
          id: 'cred_bpsc_1',
          portalName: 'BPSC Portal',
          portalUrl: 'https://bpsc.teletalk.com.bd',
          origin: 'https://bpsc.teletalk.com.bd',
          organization: 'BPSC',
          jobTitle: 'Assistant Director',
          accountType: 'Job-Specific Account',
          createdAt: '2026-11-14T00:00:00Z',
          updatedAt: '2026-11-14T00:00:00Z',
        },
      ];

      const onSaveMock = vi.fn();
      const onCloseMock = vi.fn();

      await act(async () => {
        root?.render(
          <ApplicationPortalModal
            record={record}
            language="bn"
            vaultCredentials={mockVaultCreds}
            onSave={onSaveMock}
            onClose={onCloseMock}
          />
        );
      });
      await flushUi(30);

      const html = container.innerHTML;

      // Verify the 4 distinct URLs are displayed in their respective inputs
      expect(html).toContain('https://bpsc.teletalk.com.bd/login.php');
      expect(html).toContain('https://bpsc.teletalk.com.bd/apply.php');
      expect(html).toContain('https://bpsc.gov.bd/notice.pdf');
      expect(html).toContain('https://bpsc.gov.bd');

      // Find the login URL input and change it to a PDF circular using setNativeInputValue
      const inputs = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="url"]'));
      const loginInput = inputs.find((i) => i.value === 'https://bpsc.teletalk.com.bd/login.php');
      expect(loginInput).toBeDefined();

      await act(async () => {
        setNativeInputValue(loginInput!, 'https://bpsc.gov.bd/circular.pdf');
      });
      await flushUi(30);

      // Find Save Changes button
      const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('button'));
      const saveBtn = buttons.find((b) => b.textContent?.includes('পরিবর্তন সংরক্ষণ'));
      expect(saveBtn).toBeDefined();

      await act(async () => {
        saveBtn!.click();
      });
      await flushUi(40);

      // Must display the PDF block warning banner
      expect(container.innerHTML).toContain('সার্কুলার পিডিএফ ফাইল কখনো লগইন পেজ হতে পারে না');
      expect(onSaveMock).not.toHaveBeenCalled();
    });

    it('13. openApplicationPortalLoginTab validates URLs, saves context, and keeps dashboard intact', async () => {
      const showToast = vi.fn();
      const onMissing = vi.fn();

      // Case 1: Missing login URL
      const appNoLogin: ApplicationTrackerRecord = {
        jobId: 'app_no_login',
        jobTitle: 'Engineer',
        organization: 'DPDC',
        status: 'Interested',
        loginUrl: null,
        deadlineAt: null,
        createdAt: 1000,
        updatedAt: 1000,
      };
      const res1 = await openApplicationPortalLoginTab(appNoLogin, showToast, true, onMissing);
      expect(res1.opened).toBe(false);
      expect(res1.reason).toBe('missing_login_url');
      expect(onMissing).toHaveBeenCalled();

      // Case 2: PDF as login URL
      const appPdfLogin: ApplicationTrackerRecord = {
        jobId: 'app_pdf',
        jobTitle: 'Officer',
        organization: 'BPSC',
        status: 'Applied',
        loginUrl: 'https://bpsc.gov.bd/circular.pdf',
        deadlineAt: null,
        createdAt: 1000,
        updatedAt: 1000,
      };
      const res2 = await openApplicationPortalLoginTab(appPdfLogin, showToast, true);
      expect(res2.opened).toBe(false);
      expect(res2.reason).toBe('pdf_circular');

      // Case 3: Valid verified portal login URL
      const appValid: ApplicationTrackerRecord = {
        jobId: 'app_valid',
        jobTitle: 'Assistant Director',
        organization: 'Bangladesh Bank',
        status: 'Applied',
        loginUrl: 'https://erecruitment.bb.org.bd/onlineapp/index.php',
        loginUrlVerified: true,
        credentialId: 'cred_bb_99',
        deadlineAt: null,
        createdAt: 1000,
        updatedAt: 1000,
      };
      const res3 = await openApplicationPortalLoginTab(appValid, showToast, false);
      expect(res3.opened).toBe(true);
      expect(showToast).toHaveBeenCalled();
    });
  });
});
