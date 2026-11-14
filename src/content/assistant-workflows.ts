// JobFill BD - Smart Job Application Assistant Workflows
// Powers:
// 1. Automatic Job Circular Visit Tracking (direct portal recognition)
// 2. Automatic Application Tracker (passive submit observation & confirmation receipt detection)
// 3. Smart Credential Manager (save login prompt & trusted origin autofill)
// 4. Non-intrusive UI dialogs with complete user control and explicit consent.

import { LoginFormDetector } from '../credentials/login-detector';
import { normalizeStrictOrigin, isStrictOriginMatch } from '../credentials/origin-matcher';
import { isExcludedSiteUrl } from '../security/site-policy';

export interface CircularPageDetectionResult {
  isCircular: boolean;
  organization: string;
  jobTitle: string;
  sourceId: string;
  circularUrl: string;
  deadlineAt?: number | null;
}

export interface ApplicationConfirmationResult {
  isConfirmed: boolean;
  isFailure: boolean;
  applicantId?: string;
  teletalkUserId?: string;
  successMessage?: string;
  failureMessage?: string;
}

/**
 * Checks if the current page URL and DOM structure represent a recognized job circular.
 */
export function detectJobCircularPage(
  doc: Document,
  rawUrl: string = typeof window !== 'undefined' ? window.location?.href : ''
): CircularPageDetectionResult | null {
  if (!rawUrl || isExcludedSiteUrl(rawUrl)) return null;

  try {
    const url = new URL(rawUrl);
    const host = url.hostname.toLowerCase();
    const path = url.pathname.toLowerCase();

    // Check supported recruitment portal patterns
    const isTeletalk = host.endsWith('teletalk.com.bd');
    const isBdjobs = host.includes('bdjobs.com');
    const isBangladeshBank = host.includes('bb.org.bd');
    const isBpscGov = host.includes('bpsc.gov.bd');

    if (!isTeletalk && !isBdjobs && !isBangladeshBank && !isBpscGov) {
      return null;
    }

    // Must not be an application form input page, login page, or payment page
    const rawPageText = doc.body ? (doc.body.innerText || doc.body.textContent || '') : '';
    const pageText = (rawPageText || '').toLowerCase();
    const hasApplicationForm = Boolean(
      doc.querySelector('input[type="file"]') ||
      doc.querySelector('#applicant_name') ||
      doc.querySelector('#father_name') ||
      doc.querySelector('#dob')
    );
    const isPureLoginPage = Boolean(
      (path.includes('login') || path.includes('signin')) &&
      doc.querySelector('input[type="password"]') &&
      !doc.querySelector('table')
    );

    if (isPureLoginPage) return null;

    // Detect Circular Page Indicators
    const hasCircularHeading =
      /নিয়োগ\s*বিজ্ঞপ্তি/i.test(pageText) ||
      /recruitment\s*notice/i.test(pageText) ||
      /job\s*circular/i.test(pageText) ||
      /advertisement/i.test(pageText) ||
      /circular/i.test(path) ||
      path.includes('jobdetails') ||
      path.includes('notice') ||
      (isTeletalk && (path === '' || path === '/' || path.includes('index') || path.includes('home')));

    if (!hasCircularHeading && !isBdjobs) {
      return null;
    }

    // Extract Organization & Title
    let organization = 'Government / Autonomous Organization';
    if (isBpscGov || host.startsWith('bpsc.')) {
      organization = 'Bangladesh Public Service Commission (BPSC)';
    } else if (isBangladeshBank) {
      organization = 'Bangladesh Bank';
    } else if (isTeletalk) {
      const sub = host.split('.')[0].toUpperCase();
      organization = `${sub} (Teletalk Portal)`;
    } else if (isBdjobs) {
      const orgEl = doc.querySelector('.company-name, .job-company, .org-title');
      if (orgEl && orgEl.textContent?.trim()) {
        organization = orgEl.textContent.trim().slice(0, 80);
      } else {
        organization = 'Private / Corporate Employer';
      }
    }

    let jobTitle = doc.title || 'Official Job Circular';
    const h1 = doc.querySelector('h1, h2, .job-title, .circular-title');
    if (h1 && h1.textContent?.trim()) {
      jobTitle = h1.textContent.trim().slice(0, 100);
    } else if (doc.title) {
      jobTitle = doc.title.split('-')[0].split('|')[0].trim().slice(0, 100);
    }

    const sourceId = isTeletalk ? 'teletalk' : isBdjobs ? 'bdjobs' : isBangladeshBank ? 'bangladesh_bank' : 'official_portal';

    return {
      isCircular: true,
      organization,
      jobTitle,
      sourceId,
      circularUrl: rawUrl,
    };
  } catch {
    return null;
  }
}

/**
 * Checks if the current page displays an official application submission receipt or confirmation.
 */
export function detectApplicationConfirmation(doc: Document): ApplicationConfirmationResult {
  const bodyText = (doc.body ? (doc.body.innerText || doc.body.textContent || '') : '') || '';

  // 1. Detect Failure Indicators First
  const hasFailureNotice =
    /Validation\s+Failed/i.test(bodyText) ||
    /Submission\s+Failed/i.test(bodyText) ||
    /Please\s+correct\s+the\s+following\s+errors/i.test(bodyText) ||
    /Captcha\s+Verification\s+Failed/i.test(bodyText);

  if (hasFailureNotice) {
    return {
      isConfirmed: false,
      isFailure: true,
      failureMessage: 'Website reported validation or submission errors.',
    };
  }

  // 2. Detect Teletalk User ID (e.g. User ID: ABC12345)
  const userIdMatch = bodyText.match(/User\s*ID\s*[:：\-]\s*([A-Za-z0-9_-]{4,24})/i);
  const teletalkUserId = userIdMatch ? userIdMatch[1].trim() : undefined;

  // 3. Detect Application / Applicant Reference ID
  const appIdMatch = bodyText.match(/(?:Applicant|Application|Tracking|Registration|Ref)\s*(?:ID|No|Number|Code)\s*[:：\-]\s*#?([A-Za-z0-9_-]{4,25})/i);
  const applicantId = appIdMatch ? appIdMatch[1].trim() : undefined;

  // 4. Detect Confirmation / Applicant Copy Keywords
  const hasSuccessKeywords =
    /Application\s+Submitted\s+Successfully/i.test(bodyText) ||
    /আবেদন\s*সফলভাবে\s*গৃহীত/i.test(bodyText) ||
    /Your\s+application\s+has\s+been\s+received/i.test(bodyText) ||
    /Your\s+application\s+has\s+been\s+submitted/i.test(bodyText) ||
    /Applicant(?:'s)?\s+Copy/i.test(bodyText) ||
    /Application\s+Preview/i.test(bodyText) ||
    /Payment\s+Instructions/i.test(bodyText);

  const isConfirmed = Boolean(hasSuccessKeywords || teletalkUserId || applicantId);

  return {
    isConfirmed,
    isFailure: false,
    applicantId,
    teletalkUserId,
    successMessage: isConfirmed ? 'Application Submission Confirmed' : undefined,
  };
}

/**
 * Determines whether a submitted form is a candidate job application form.
 */
export function isJobApplicationForm(form: HTMLFormElement): boolean {
  if (!form) return false;

  // Reject search boxes, quick filters, or comment forms
  if (form.getAttribute('role') === 'search') return false;
  const inputs = Array.from(form.querySelectorAll<HTMLInputElement>('input, select, textarea'));
  if (inputs.length <= 2) return false;

  const hasSearchOnly = inputs.every((el) => {
    const n = (el.name || el.id || '').toLowerCase();
    return n.includes('search') || n.includes('query') || n === 'q' || el.type === 'submit';
  });
  if (hasSearchOnly) return false;

  // Positive signals
  const hasFileInput = Boolean(form.querySelector('input[type="file"]'));
  const hasPersonalFields = Boolean(
    form.querySelector('[name*="name" i], [name*="father" i], [name*="mother" i], [name*="dob" i], [name*="nid" i], [name*="mobile" i]')
  );
  const isMultiInput = inputs.length >= 4;

  return hasFileInput || hasPersonalFields || isMultiInput;
}

/**
 * Injects a non-intrusive floating dialog asking the user to save or update login credentials.
 * User approval is strictly required before saving to the encrypted Credential Vault.
 * Supports multiple accounts per portal and account updates.
 */
export function showSaveCredentialDialog(
  candidate: {
    origin: string;
    portalName: string;
    portalUrl: string;
    username: string;
    password?: string;
    organization?: string;
    jobTitle?: string;
    accountType?: string;
  },
  onApprove: (saveMode: 'save' | 'update' | 'separate', targetAccountId?: string) => Promise<void>,
  onDismiss: () => void,
  existingAccounts: Array<{
    id: string;
    username: string;
    organization?: string;
    jobTitle?: string;
  }> = []
): void {
  const existing = document.getElementById('jobfill-cred-save-backdrop');
  if (existing) existing.remove();

  const backdrop = document.createElement('div');
  backdrop.id = 'jobfill-cred-save-backdrop';
  backdrop.setAttribute('data-jobfill-ext', 'true');
  backdrop.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 2147483646;
    background: #0f172a;
    color: #f8fafc;
    border: 1px solid #334155;
    border-radius: 16px;
    padding: 16px 18px;
    box-shadow: 0 16px 40px rgba(0,0,0,0.45);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    max-width: 360px;
    font-size: 12.5px;
    animation: jobfillSlideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  `;

  const maskedUsername = candidate.username
    ? candidate.username.length > 5
      ? `${candidate.username.slice(0, 3)}***`
      : `${candidate.username[0]}***`
    : 'User Account';

  const hasExisting = existingAccounts.length > 0;
  const matchOrg = candidate.organization || 'General Recruitment Portal';

  let existingSection = '';
  if (hasExisting) {
    existingSection = `
      <div style="background:#1e293b;border-radius:8px;padding:8px 10px;margin-bottom:10px;border:1px solid #475569;font-size:11.5px;">
        <span style="color:#fbbf24;font-weight:700;display:block;margin-bottom:3px;">ℹ️ Existing Account(s) on this Portal:</span>
        ${existingAccounts
          .slice(0, 3)
          .map(
            (a) =>
              `<div style="color:#cbd5e1;padding:2px 0;">• <strong>${escapeWorkflowHtml(
                a.organization || a.jobTitle || 'Account'
              )}</strong> (${escapeWorkflowHtml(a.username)})</div>`
          )
          .join('')}
      </div>
    `;
  }

  backdrop.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
      <div style="display:flex;align-items:center;gap:7px;font-weight:700;color:#38bdf8;font-size:13.5px;">
        <span>🔐</span>
        <span>Save Job Portal Login?</span>
      </div>
      <button id="jobfill-cred-close-btn" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:16px;">✕</button>
    </div>
    <p style="margin:0 0 10px;color:#cbd5e1;line-height:1.4;">
      Do you want JobFill BD to save credentials for <strong style="color:#fff;">${escapeWorkflowHtml(
        candidate.portalName
      )}</strong> to your encrypted Credential Vault?
    </p>
    ${existingSection}
    <div style="background:#1e293b;border-radius:8px;padding:8px 10px;margin-bottom:12px;font-size:12px;border:1px solid #334155;">
      <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
        <span style="color:#94a3b8;">Portal:</span>
        <span style="font-weight:600;color:#f8fafc;max-width:180px;text-overflow:ellipsis;overflow:hidden;white-space:nowrap;">${escapeWorkflowHtml(
          candidate.portalName
        )}</span>
      </div>
      ${
        candidate.organization
          ? `<div style="display:flex;justify-content:space-between;margin-bottom:4px;">
              <span style="color:#94a3b8;">Organization:</span>
              <span style="font-weight:600;color:#38bdf8;max-width:180px;text-overflow:ellipsis;overflow:hidden;white-space:nowrap;">${escapeWorkflowHtml(
                candidate.organization
              )}</span>
            </div>`
          : ''
      }
      <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
        <span style="color:#94a3b8;">Username / ID:</span>
        <span style="font-weight:600;color:#38bdf8;">${escapeWorkflowHtml(maskedUsername)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;">
        <span style="color:#94a3b8;">Password:</span>
        <span style="letter-spacing:2px;color:#94a3b8;">••••••••</span>
      </div>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;">
      <button id="jobfill-cred-cancel-btn" style="background:#334155;color:#e2e8f0;border:none;padding:7px 12px;border-radius:8px;font-weight:600;cursor:pointer;font-size:12px;">Not Now</button>
      ${
        hasExisting
          ? `<button id="jobfill-cred-separate-btn" style="background:linear-gradient(135deg,#0284c7,#0369a1);color:#fff;border:none;padding:7px 12px;border-radius:8px;font-weight:700;cursor:pointer;font-size:12px;box-shadow:0 4px 12px rgba(2,132,199,0.4);">Save as Separate Account</button>
             <button id="jobfill-cred-update-btn" style="background:#047857;color:#fff;border:none;padding:7px 12px;border-radius:8px;font-weight:700;cursor:pointer;font-size:12px;">Update Existing</button>`
          : `<button id="jobfill-cred-save-btn" style="background:linear-gradient(135deg,#0284c7,#0369a1);color:#fff;border:none;padding:7px 14px;border-radius:8px;font-weight:700;cursor:pointer;font-size:12px;box-shadow:0 4px 12px rgba(2,132,199,0.4);">Save to Vault</button>`
      }
    </div>
  `;

  document.body.appendChild(backdrop);

  const closeDialog = () => {
    backdrop.remove();
    onDismiss();
  };

  document.getElementById('jobfill-cred-close-btn')?.addEventListener('click', closeDialog);
  document.getElementById('jobfill-cred-cancel-btn')?.addEventListener('click', closeDialog);

  document.getElementById('jobfill-cred-save-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('jobfill-cred-save-btn') as HTMLButtonElement | null;
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Saving...';
    }
    try {
      await onApprove('save');
      backdrop.remove();
    } catch {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Save to Vault';
      }
    }
  });

  document.getElementById('jobfill-cred-separate-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('jobfill-cred-separate-btn') as HTMLButtonElement | null;
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Saving...';
    }
    try {
      await onApprove('separate');
      backdrop.remove();
    } catch {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Save as Separate Account';
      }
    }
  });

  document.getElementById('jobfill-cred-update-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('jobfill-cred-update-btn') as HTMLButtonElement | null;
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Updating...';
    }
    try {
      const targetId = existingAccounts[0]?.id;
      await onApprove('update', targetId);
      backdrop.remove();
    } catch {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Update Existing';
      }
    }
  });
}

/**
 * Injects an Account Chooser modal when multiple saved accounts match the current portal origin.
 * Allows the user to select the exact organization / job application account before autofilling.
 */
export function showAccountChooserDialog(
  portalName: string,
  accounts: Array<{
    id: string;
    username: string;
    userId?: string;
    applicantId?: string;
    organization?: string;
    jobTitle?: string;
    accountType?: string;
  }>,
  onSelectAccount: (accountId: string) => Promise<void>,
  onDismiss: () => void
): void {
  const existing = document.getElementById('jobfill-account-chooser-backdrop');
  if (existing) existing.remove();

  const backdrop = document.createElement('div');
  backdrop.id = 'jobfill-account-chooser-backdrop';
  backdrop.setAttribute('data-jobfill-ext', 'true');
  backdrop.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(15, 23, 42, 0.7);
    backdrop-filter: blur(3px);
    z-index: 2147483647;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    box-sizing: border-box;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  `;

  const modalBox = document.createElement('div');
  modalBox.style.cssText = `
    background: #0f172a;
    color: #f8fafc;
    border: 1px solid #334155;
    border-radius: 16px;
    width: 100%;
    max-width: 460px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 24px 60px rgba(0,0,0,0.55);
    overflow: hidden;
  `;

  const accountsHtml = accounts
    .map((acc, idx) => {
      const org = acc.organization || acc.jobTitle || 'Recruitment Account';
      const usr = acc.username || acc.userId || acc.applicantId || 'Saved User';
      const type = acc.accountType || 'Job Account';

      return `
        <div class="jobfill-chooser-item" data-acc-id="${acc.id}" style="
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 14px;
          background: #1e293b;
          border-radius: 10px;
          margin-bottom: 8px;
          border: 1px solid #334155;
          cursor: pointer;
          transition: all 0.2s;
        " onmouseover="this.style.borderColor='#0284c7';this.style.background='#1e293b/80';" onmouseout="this.style.borderColor='#334155';this.style.background='#1e293b';">
          <div style="flex:1;min-width:0;padding-right:10px;">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;">
              <span style="font-weight:700;color:#f8fafc;font-size:13px;max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                ${escapeWorkflowHtml(org)}
              </span>
              <span style="font-size:10px;padding:2px 6px;border-radius:6px;background:#0284c7/20;color:#38bdf8;border:1px solid #0284c7/30;">
                ${escapeWorkflowHtml(type)}
              </span>
            </div>
            <div style="font-size:11.5px;color:#94a3b8;">
              User ID / Name: <strong style="color:#e2e8f0;">${escapeWorkflowHtml(usr)}</strong>
            </div>
          </div>
          <button type="button" style="
            background: linear-gradient(135deg, #0284c7, #0369a1);
            color: #ffffff;
            border: none;
            padding: 6px 12px;
            border-radius: 8px;
            font-size: 11.5px;
            font-weight: 700;
            cursor: pointer;
            white-space: nowrap;
          ">Autofill</button>
        </div>
      `;
    })
    .join('');

  modalBox.innerHTML = `
    <div style="padding:16px 20px;border-bottom:1px solid #334155;display:flex;align-items:center;justify-content:space-between;">
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-size:18px;">🔑</span>
        <div>
          <h3 style="margin:0;font-size:15px;font-weight:700;color:#f8fafc;">
            Choose Account (${escapeWorkflowHtml(portalName)})
          </h3>
          <p style="margin:2px 0 0;font-size:11.5px;color:#94a3b8;">
            Multiple accounts found. Select which job login to autofill.
          </p>
        </div>
      </div>
      <button id="jobfill-chooser-close-btn" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:16px;">✕</button>
    </div>
    <div style="padding:16px 20px;overflow-y:auto;flex:1;">
      ${accountsHtml}
    </div>
    <div style="padding:12px 20px;border-top:1px solid #334155;display:flex;justify-content:flex-end;">
      <button id="jobfill-chooser-cancel-btn" style="background:#334155;color:#e2e8f0;border:none;padding:6px 14px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;">Cancel</button>
    </div>
  `;

  backdrop.appendChild(modalBox);
  document.body.appendChild(backdrop);

  const closeChooser = () => {
    backdrop.remove();
    onDismiss();
  };

  document.getElementById('jobfill-chooser-close-btn')?.addEventListener('click', closeChooser);
  document.getElementById('jobfill-chooser-cancel-btn')?.addEventListener('click', closeChooser);

  const items = modalBox.querySelectorAll('.jobfill-chooser-item');
  items.forEach((item) => {
    item.addEventListener('click', async () => {
      const accId = item.getAttribute('data-acc-id');
      if (accId) {
        backdrop.remove();
        await onSelectAccount(accId);
      }
    });
  });
}

function escapeWorkflowHtml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Injects a discreet suggestion pill next to visible login inputs.
 */
export function injectLoginAutofillPill(
  usernameInput: HTMLInputElement,
  portalName: string,
  onFillClick: () => void
): void {
  if (!usernameInput || document.getElementById('jobfill-login-pill')) return;

  const pill = document.createElement('div');
  pill.id = 'jobfill-login-pill';
  pill.setAttribute('data-jobfill-ext', 'true');
  pill.style.cssText = `
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: #0f172a;
    color: #38bdf8;
    border: 1px solid #0284c7;
    border-radius: 9999px;
    padding: 3px 10px;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0,0,0,0.25);
    margin-left: 6px;
    vertical-align: middle;
    z-index: 2147483640;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  `;
  pill.innerHTML = `<span>🔐</span><span>Autofill (${portalName})</span>`;

  pill.addEventListener('click', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    onFillClick();
  });

  const parent = usernameInput.parentElement;
  if (parent) {
    parent.appendChild(pill);
  }
}
