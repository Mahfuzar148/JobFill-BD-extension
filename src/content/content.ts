// JobFill BD - In-Page Content Script Assistant
// Simplified Profile-First Autofill Architecture
// FIELD NAME + SECTION CONTEXT -> MATCH PROFILE FIELD -> GET SAVED VALUE -> FILL WEBSITE FIELD -> VERIFY RESULT

import { UserProfile, DocumentCategory } from '../types/profile';
import { FieldCompletenessEntry } from '../types/field-status';
import { createEmptyProfile } from '../types/defaults';
import { PageScanner, PageScanResult, toCanonicalProfile } from './page-scanner';
import { resolveCanonicalValue } from '../shared/types/canonical-schema';
import { UniversalPageScanner } from './scanner/page-scanner';
import { FormDetector } from './scanner/form-detector';
import { FormDetector as ApplicationFormDetector } from './form-detector';
import { resolveSiteAdapter } from '../adapters/adapter-registry';
import { VerificationEngine, FillPlanItem } from '../validation/verification-engine';
import { MappingRepository } from '../database/mapping-repository';
import { DocumentRepository } from '../database/document-repository';
import { extractElementFingerprint } from '../intelligence/mapping-memory';
import { DynamicDomObserver } from './dom-observer';
import { addAutofillHistory, applyCanonicalProfileFieldUpdate } from '../services/storage';
import {
  isExcludedSiteUrl,
  assessHttpSensitiveAutofillRisk,
} from '../security/site-policy';
import { recordExtensionDiagnostic } from '../security/diagnostics';
import { detectAccessRestrictionWithReason } from '../jobs/services/captcha-detector';
import {
  DocumentFieldDetector,
  DocumentUploadCoordinator,
  DocumentApprovalItem,
  DecryptedDocumentSource,
  DocumentUploadExecutionResult,
  DocumentUploader,
  inferDocumentMimeType,
} from '../documents';

export type AutofillMode = 'profile_first' | 'strict_review';

let currentProfile: UserProfile = createEmptyProfile('Vault Locked');
let isVaultLocked: boolean = false;
let currentScanResult: PageScanResult | null = null;
let lastCompletenessReport: FieldCompletenessEntry[] = [];
let currentDocPlan: DocumentApprovalItem[] = [];
let activeSessionId: string = 'session_' + Date.now();
let activeFilterTab: 'attention' | 'all' = 'attention';
let activeAutofillMode: AutofillMode = 'profile_first';
let allowReplaceExisting: boolean = false;
let lastScannedTime: string = '';
let toastHideTimer: any = null;

function maskSensitiveHistoryValue(canonicalKey: string, val: string): string {
  if (!val) return '';
  const k = canonicalKey.toLowerCase();
  if (k.includes('nationalid') || k.includes('nid') || k.includes('passport') || k.includes('birthreg')) {
    return val.length > 4 ? `***${val.slice(-4)}` : '****';
  }
  return val;
}

function isExtensionRuntime(): boolean {
  return typeof chrome !== 'undefined' && Boolean(chrome.runtime && chrome.runtime.id);
}

let assistantUiReady: boolean = false;
let isToolbarDismissed: boolean = false;
let unloadCleanupRegistered: boolean = false;

const SESSION_TOOLBAR_FALLBACK_KEY = 'jobfill_toolbar_dismissed_tab_v1';

async function syncTabToolbarDismissedState(): Promise<boolean> {
  if (typeof window !== 'undefined' && isExcludedSiteUrl(window.location?.href)) {
    return false;
  }

  if (isExtensionRuntime() && typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
    return new Promise<boolean>((resolve) => {
      try {
        chrome.runtime.sendMessage({ action: 'GET_TAB_TOOLBAR_STATE' }, (res) => {
          if (!chrome.runtime?.lastError && res && res.status === 'ok') {
            resolve(Boolean(res.dismissed));
          } else {
            resolve(false);
          }
        });
      } catch {
        resolve(false);
      }
    });
  }

  try {
    return typeof sessionStorage !== 'undefined' && sessionStorage.getItem(SESSION_TOOLBAR_FALLBACK_KEY) === '1';
  } catch {
    return false;
  }
}

async function persistTabToolbarDismissedState(dismissed: boolean): Promise<void> {
  isToolbarDismissed = dismissed;

  if (isExtensionRuntime() && typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
    await new Promise<void>((resolve) => {
      try {
        chrome.runtime.sendMessage(
          { action: 'SET_TAB_TOOLBAR_DISMISSED', payload: { dismissed } },
          () => {
            void chrome.runtime?.lastError;
            resolve();
          }
        );
      } catch {
        resolve();
      }
    });
    return;
  }

  try {
    if (typeof sessionStorage !== 'undefined') {
      if (dismissed) {
        sessionStorage.setItem(SESSION_TOOLBAR_FALLBACK_KEY, '1');
      } else {
        sessionStorage.removeItem(SESSION_TOOLBAR_FALLBACK_KEY);
      }
    }
  } catch {
    // Ignore restricted sessionStorage access
  }
}

function startTargetedFormObserver(): void {
  const observeTarget =
    document.querySelector('form') ||
    document.querySelector('input[type="file"]')?.closest('div, section, main') ||
    document.body;

  DynamicDomObserver.startObserving(
    (_addedElements) => {
      if (isToolbarDismissed) return;
      const modal = document.getElementById('jobfill-review-modal-backdrop');
      if (!modal || !modal.classList.contains('open')) {
        refreshDocsWidgetVisibility();
      }
    },
    1000,
    observeTarget
  );

  if (!unloadCleanupRegistered && typeof window !== 'undefined') {
    unloadCleanupRegistered = true;
    window.addEventListener(
      'pagehide',
      () => {
        DynamicDomObserver.stopObserving();
      },
      { once: true }
    );
  }
}

async function dismissFloatingToolbar(): Promise<void> {
  isToolbarDismissed = true;
  const existing = document.getElementById('jobfill-floating-trigger');
  if (existing) {
    existing.remove();
  }
  DynamicDomObserver.stopObserving();
  await persistTabToolbarDismissedState(true);
}

function hasSupportedApplicationFormOnPage(doc: Document = document): boolean {
  const detectedForms = ApplicationFormDetector.detectApplicationForms(doc);
  if (detectedForms.some((f) => f.isGovernmentApplication)) return true;
  if (DocumentFieldDetector.scanDocumentFields(doc).length > 0) return true;
  return false;
}

async function ensureAssistantUiInitialized(
  forceUi: boolean = false,
  bypassToolbarDismissed: boolean = false
): Promise<boolean> {
  if (typeof window !== 'undefined' && isExcludedSiteUrl(window.location?.href)) {
    return false;
  }

  if (bypassToolbarDismissed) {
    isToolbarDismissed = false;
  } else {
    isToolbarDismissed = await syncTabToolbarDismissedState();
  }

  if (assistantUiReady) {
    if (!isToolbarDismissed && bypassToolbarDismissed) {
      injectFloatingWidget();
      refreshDocsWidgetVisibility();
      startTargetedFormObserver();
    }
    return true;
  }

  if (!forceUi && !hasSupportedApplicationFormOnPage(document)) {
    return false;
  }

  assistantUiReady = true;
  recordExtensionDiagnostic('script_injection_allowed', {
    url: typeof window !== 'undefined' ? window.location?.href : null,
    source: 'content.ensureAssistantUiInitialized',
  });
  await loadProfile();
  await loadSettings();
  createReviewModal();
  createDocumentApprovalModal();

  if (!isToolbarDismissed) {
    injectFloatingWidget();
    refreshDocsWidgetVisibility();
    startTargetedFormObserver();
  }

  return true;
}

// Initialize on page load (idempotent guard against duplicate injection)
async function initAssistant() {
  if (typeof window !== 'undefined' && isExcludedSiteUrl(window.location?.href)) {
    return;
  }

  if ((window as any).__jobfillAssistantInitialized) return;
  (window as any).__jobfillAssistantInitialized = true;

  // If a static test-page <script src="../content.js"> rendered a non-extension widget in Main World,
  // let the privileged Isolated World Chrome Extension replace it cleanly.
  if (isExtensionRuntime()) {
    document
      .querySelectorAll('#jobfill-floating-trigger, #jobfill-review-modal-backdrop, #jobfill-doc-modal-backdrop')
      .forEach((el) => {
        if (!el.hasAttribute('data-jobfill-ext')) {
          el.remove();
        }
      });
  } else {
    // If real extension already owns the DOM, standalone test script must stand down
    const extOwned = document.querySelector('#jobfill-floating-trigger[data-jobfill-ext="true"]');
    if (extOwned) return;
  }

  await ensureAssistantUiInitialized(false);
}

// Load active profile from trusted MV3 Service Worker or fallback local cache
async function loadProfile(): Promise<void> {
  if (
    typeof window !== 'undefined' &&
    isExcludedSiteUrl(window.location?.href)
  ) {
    return;
  }

  if (
    isExtensionRuntime() &&
    typeof chrome !== 'undefined' &&
    chrome.runtime?.sendMessage
  ) {
    const swLoaded = await new Promise<boolean>((resolve) => {
      try {
        chrome.runtime.sendMessage({ action: 'GET_ACTIVE_PROFILE_STATE' }, (stateRes) => {
          if (!chrome.runtime.lastError && stateRes) {
            if (stateRes.status === 'ok' && stateRes.activeProfile) {
              isVaultLocked = false;
              currentProfile = stateRes.activeProfile;
              resolve(true);
              return;
            }
            if (stateRes.status === 'locked') {
              isVaultLocked = true;
              currentProfile = createEmptyProfile('Vault Locked');
              resolve(true);
              return;
            }
          }
          resolve(false);
        });
      } catch {
        resolve(false);
      }
    });
    if (swLoaded) return;
  }

  return new Promise((resolve) => {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(
          [
            'jobfill_profiles',
            'jobfill_active_profile_id',
            'jobfill_real_profile_seeded_v1',
            'jobfill_security_settings',
          ],
          (res) => {
            const sec = res.jobfill_security_settings;
            if (sec?.isPasswordProtected) {
              isVaultLocked = true;
              currentProfile = createEmptyProfile('Vault Locked');
              resolve();
              return;
            }

            isVaultLocked = false;
            const profiles: UserProfile[] = res.jobfill_profiles || [];
            const activeId = res.jobfill_active_profile_id;
            const found = profiles.find((p) => p.id === activeId);
            if (found) {
              currentProfile = found;
            } else if (profiles.length > 0) {
              currentProfile = profiles[0];
            } else {
              currentProfile = createEmptyProfile('No Profile Loaded');
            }
            resolve();
          }
        );
      } else {
        resolve();
      }
    } catch (e) {
      console.warn('JobFill BD: Using local memory profile', e);
      resolve();
    }
  });
}

// Load settings (Autofill Mode & Replace Existing Values)
async function loadSettings(): Promise<void> {
  return new Promise((resolve) => {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['jobfill_autofill_mode', 'jobfill_allow_replace_existing'], (res) => {
          if (res.jobfill_autofill_mode) activeAutofillMode = res.jobfill_autofill_mode;
          if (res.jobfill_allow_replace_existing !== undefined) allowReplaceExisting = res.jobfill_allow_replace_existing;
          resolve();
        });
      } else {
        resolve();
      }
    } catch {
      resolve();
    }
  });
}

// Save field update back into trusted local IndexedDB/Vault storage via Background Service Worker
async function updateProfileValue(canonicalKey: string, newValue: string): Promise<boolean> {
  if (typeof window !== 'undefined' && isExcludedSiteUrl(window.location?.href)) {
    return false;
  }

  if (
    isExtensionRuntime() &&
    typeof chrome !== 'undefined' &&
    chrome.runtime?.sendMessage
  ) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(
          { action: 'UPDATE_ACTIVE_PROFILE_FIELD', payload: { canonicalKey, newValue } },
          (res) => {
            if (!chrome.runtime.lastError && res?.status === 'ok' && res.activeProfile) {
              currentProfile = res.activeProfile;
              resolve(true);
            } else {
              resolve(false);
            }
          }
        );
      } catch {
        resolve(false);
      }
    });
  }

  return applyCanonicalProfileFieldUpdate(currentProfile, canonicalKey, newValue);
}

interface TwoPassExecutionSummary {
  scan: PageScanResult;
  totalFilled: number;
  totalFailed: number;
  alreadyCorrect: number;
  missingInfo: number;
  ambiguous: number;
  conflicts: number;
  confirmationRequired: number;
  completenessReport: FieldCompletenessEntry[];
  allItems: FillPlanItem[];
}

const approvedInsecureHttpOrigins = new Set<string>();

async function confirmInsecureHttpSensitiveFillIfNeeded(items: FillPlanItem[]): Promise<boolean> {
  const canonicalIds = items.map((i) => i.canonicalId || '').filter(Boolean);
  const risk = assessHttpSensitiveAutofillRisk(window.location.href, canonicalIds);
  if (!risk.requiresExplicitWarning) return true;

  const origin = window.location.origin || window.location.hostname || 'http-site';
  if (approvedInsecureHttpOrigins.has(origin)) return true;

  // In automated headless/DOM tests without an interactive toolbar/confirm button, render clean warning modal
  return new Promise<boolean>((resolve) => {
    const existing = document.getElementById('jobfill-http-warning-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'jobfill-http-warning-overlay';
    overlay.setAttribute('role', 'alertdialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:2147483647;background:rgba(15,23,42,0.65);display:flex;align-items:center;justify-content:center;padding:16px;font-family:system-ui,-apple-system,sans-serif;';
    overlay.innerHTML = `
      <div style="background:#fff;color:#0f172a;border:2px solid #f59e0b;border-radius:14px;max-width:420px;width:100%;padding:18px 20px;box-shadow:0 20px 50px rgba(0,0,0,0.3);">
        <div style="display:flex;align-items:center;gap:8px;font-weight:800;font-size:14px;color:#b45309;margin-bottom:8px;">
          <span>⚠️</span>
          <span>Unencrypted HTTP Connection Warning</span>
        </div>
        <p style="margin:0 0 12px;font-size:12.5px;line-height:1.5;color:#334155;">
          ${risk.warningMessage}<br/><br/>
          সংযোগটি HTTPS নয় (HTTP)। সংবেদনশীল তথ্য (NID, জন্ম নিবন্ধন, মোবাইল বা জন্ম তারিখ) পূরণ করার আগে পোর্টাল ঠিকানা যাচাই করুন।
        </p>
        <div style="display:flex;justify-content:flex-end;gap:8px;">
          <button type="button" id="jobfill-http-warn-cancel" style="padding:7px 12px;border-radius:8px;border:1px solid #cbd5e1;background:#f8fafc;color:#334155;font-size:12px;font-weight:600;cursor:pointer;">Cancel</button>
          <button type="button" id="jobfill-http-warn-proceed" style="padding:7px 14px;border-radius:8px;border:none;background:#d97706;color:#fff;font-size:12px;font-weight:700;cursor:pointer;">Continue Autofill</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const cleanup = (accepted: boolean) => {
      overlay.remove();
      if (accepted) approvedInsecureHttpOrigins.add(origin);
      resolve(accepted);
    };
    overlay.querySelector('#jobfill-http-warn-cancel')?.addEventListener('click', () => cleanup(false));
    overlay.querySelector('#jobfill-http-warn-proceed')?.addEventListener('click', () => cleanup(true));
  });
}

async function executeTwoPassAutofill(): Promise<TwoPassExecutionSummary | null> {
  await loadProfile();
  await loadSettings();
  currentScanResult = await UniversalPageScanner.scanPage(currentProfile, document);

  if (!currentScanResult || currentScanResult.planItems.length === 0) {
    lastCompletenessReport = [];
    return null;
  }

  const trackedByElement = new Map<HTMLElement, FillPlanItem>();
  for (const item of currentScanResult.planItems) {
    trackedByElement.set(item.element, item);
  }

  // Profile-First Mode: approve matched items; strictly withhold User Confirmation Required (e.g. Quota)
  const pass1Items = currentScanResult.planItems.filter((item) => {
    if (!item.proposedValue) return false;
    if (item.status === 'Already Correct') return false;
    if (item.status === 'User Confirmation Required') return false;
    if (item.hasConflict && !allowReplaceExisting) return false;
    return item.status === 'Matched' || item.isApproved;
  });

  if (pass1Items.length > 0) {
    const httpConfirmed = await confirmInsecureHttpSensitiveFillIfNeeded(pass1Items);
    if (!httpConfirmed) {
      return null;
    }
  }

  activeSessionId = 'session_' + Date.now();
  let totalFilled = 0;
  let totalFailed = 0;

  if (pass1Items.length > 0) {
    const report1 = await VerificationEngine.executePlan(activeSessionId, pass1Items);
    totalFilled += report1.successfullyFilled;
    totalFailed += report1.failedVerification;
    for (const executed of report1.items) {
      trackedByElement.set(executed.element, executed);
    }

    // Apply post-fill adapter rules (e.g. Same as Present Address, Choice fields, CurrentlyWorking)
    try {
      const adapter = resolveSiteAdapter(window.location.href, document);
      if (adapter.postFill) {
        adapter.postFill(document, currentProfile);
      }
    } catch (e) {
      console.warn('Post fill hook error:', e);
    }

    // Pass 2: Follow-up check for newly revealed / unlocked fields (e.g. ssc_gpa, nid_no, birth_reg_no, dependent upazila/group)
    await new Promise((r) => setTimeout(r, 120));
    try {
      const pass2Scan = await UniversalPageScanner.scanPage(currentProfile, document);
      for (const item of pass2Scan.planItems) {
        const prev = trackedByElement.get(item.element);
        if (!prev || (prev.status !== 'Filled' && prev.status !== 'Fill Failed')) {
          trackedByElement.set(item.element, item);
        }
      }

      const pass2Items = pass2Scan.planItems.filter((item) => {
        if (!item.proposedValue) return false;
        if (item.status === 'Already Correct') return false;
        if (item.status === 'User Confirmation Required') return false;
        if (item.hasConflict && !allowReplaceExisting) return false;
        const alreadyFilledInPass1 = pass1Items.some((p1) => p1.element === item.element && p1.status === 'Filled');
        if (alreadyFilledInPass1) return false;
        return item.status === 'Matched' || item.isApproved;
      });

      if (pass2Items.length > 0) {
        const report2 = await VerificationEngine.executePlan(activeSessionId, pass2Items);
        totalFilled += report2.successfullyFilled;
        totalFailed += report2.failedVerification;
        for (const executed of report2.items) {
          trackedByElement.set(executed.element, executed);
        }

        const adapter = resolveSiteAdapter(window.location.href, document);
        if (adapter.postFill) {
          adapter.postFill(document, currentProfile);
        }
      }
    } catch (e) {
      console.warn('JobFill BD Pass 2 fill check error:', e);
    }
  }

  const mergedItems = Array.from(trackedByElement.values());
  const completenessReport = VerificationEngine.buildCompletenessReport(mergedItems);
  lastCompletenessReport = completenessReport;

  const alreadyCorrect = completenessReport.filter((c) => c.status === 'Already Correct').length;
  const missingInfo = completenessReport.filter((c) => c.status === 'Profile Information Missing').length;
  const confirmationRequired = completenessReport.filter((c) => c.status === 'User Confirmation Required').length;
  const ambiguous = mergedItems.filter((i) => i.status === 'Ambiguous Field').length;
  const conflicts = mergedItems.filter((i) => i.status === 'Existing Value Conflict').length;

  return {
    scan: currentScanResult,
    totalFilled,
    totalFailed,
    alreadyCorrect,
    missingInfo,
    ambiguous,
    conflicts,
    confirmationRequired,
    completenessReport,
    allItems: mergedItems,
  };
}

async function recordAutofillHistoryEntry(summary: TwoPassExecutionSummary): Promise<void> {
  try {
    const cleanUrl = window.location.href.split('?')[0].split('#')[0];
    await addAutofillHistory({
      id: activeSessionId,
      timestamp: Date.now(),
      url: cleanUrl,
      domain: window.location.hostname || 'Local Document',
      pageTitle: document.title || 'Job Application Form',
      profileId: currentProfile.id,
      profileName: 'Applicant Profile',
      totalDetected: summary.scan.totalVisibleInputs,
      totalFilled: summary.totalFilled,
      totalFailed: summary.totalFailed,
      totalAmbiguous: summary.ambiguous || 0,
      status: summary.totalFailed === 0 ? 'completed' : 'partial',
      filledFields: summary.allItems
        .filter((i) => i.status === 'Filled')
        .map((item) => ({
          fieldLabel: item.fieldLabel,
          canonicalKey: item.canonicalId,
          value: maskSensitiveHistoryValue(item.canonicalId, item.proposedValue),
          confidence: item.status,
        })),
    });
  } catch (e) {
    console.warn('JobFill BD: Could not save quick fill history', e);
  }
}

// 1-Click Instant Auto-Fill (Auto Fill Now)
async function executeQuickFill() {
  const quickBtn = document.getElementById('jobfill-quick-fill-btn') as HTMLButtonElement | null;
  if (quickBtn) {
    quickBtn.disabled = true;
    quickBtn.innerHTML = '<span>⏳</span><span>Filling...</span>';
  }

  await loadProfile();
  if (isVaultLocked) {
    if (quickBtn) {
      quickBtn.disabled = false;
      quickBtn.innerHTML = '<span>⚡</span><span>Auto Fill Now</span>';
    }
    showToast('🔒 ভল্ট লক করা আছে! প্রোফাইল ব্যবহার করতে ড্যাশবোর্ডে মাস্টার পাসওয়ার্ড দিয়ে আনলক করুন।');
    return;
  }

  showToast('🔍 ফর্ম স্ক্যান ও প্রোফাইল-ফার্স্ট তথ্য পূরণ হচ্ছে...');
  const summary = await executeTwoPassAutofill();

  if (quickBtn) {
    quickBtn.disabled = false;
    quickBtn.innerHTML = '<span>⚡</span><span>Auto Fill Now</span>';
  }

  if (!summary) {
    showToast('⚠️ কোনো আবেদন ফর্ম ফিল্ড শনাক্ত করা যায়নি।');
    return;
  }

  const detectedDocs = DocumentFieldDetector.scanDocumentFields(document);
  const attentionPending = summary.confirmationRequired + summary.missingInfo + summary.totalFailed;

  if (summary.totalFilled === 0 && summary.alreadyCorrect > 0 && attentionPending === 0) {
    showToast(`ℹ️ ফর্মের ${summary.alreadyCorrect}টি ফিল্ড আগেই সঠিক তথ্য দিয়ে পূরণ করা রয়েছে।`);
  } else if (summary.totalFilled === 0 && attentionPending > 0) {
    showToast(`⚠️ ${attentionPending}টি ফিল্ডে আপনার নিশ্চিতকরণ বা তথ্য প্রয়োজন — [Review] দেখুন।`);
  } else if (detectedDocs.length > 0 && attentionPending > 0) {
    showToast(
      `✅ ${summary.totalFilled}টি ফিল্ড পূরণ হয়েছে! ⚠️ ${attentionPending}টি ফিল্ডের জন্য Review এবং ছবির জন্য [📷 Photo & Sig] দেখুন।`
    );
  } else if (detectedDocs.length > 0) {
    showToast(`✅ ${summary.totalFilled}টি ফিল্ড পূরণ হয়েছে! 📷 ছবি ও স্বাক্ষর আপলোড অনুমোদনের জন্য [📷 Photo & Sig] ক্লিক করুন।`);
  } else if (attentionPending > 0) {
    showToast(`✅ ${summary.totalFilled}টি ফিল্ড পূরণ হয়েছে! ⚠️ ${attentionPending}টি ফিল্ড (যেমন Quota/Missing Info) নিশ্চিত করতে [Review] দেখুন।`);
  } else {
    showToast(`✅ ${summary.totalFilled}টি ফিল্ড সফলভাবে স্বয়ংক্রিয় পূরণ ও যাচাই হয়েছে!`);
  }

  // Record to Application History
  await recordAutofillHistoryEntry(summary);

  // Auto-open the Smart Photo & Signature Approval Modal when empty file upload fields are detected
  const pendingDocFields = detectedDocs.filter(
    (df) => df.documentType !== 'unknown' && (!df.element.files || df.element.files.length === 0)
  );
  if (pendingDocFields.length > 0) {
    await openDocumentApprovalModal();
  }
}

function refreshDocsWidgetVisibility() {
  const docsBtn = document.getElementById('jobfill-docs-btn');
  if (!docsBtn) return;
  const detectedDocs = DocumentFieldDetector.scanDocumentFields(document);
  docsBtn.style.display = detectedDocs.length > 0 ? 'flex' : 'none';
}

// Inject Floating Trigger Button in bottom-right corner
function injectFloatingWidget() {
  if (isToolbarDismissed) return;
  if (typeof window !== 'undefined' && isExcludedSiteUrl(window.location?.href)) return;
  if (document.getElementById('jobfill-floating-trigger')) return;

  const container = document.createElement('div');
  container.id = 'jobfill-floating-trigger';
  if (isExtensionRuntime()) container.setAttribute('data-jobfill-ext', 'true');

  container.innerHTML = `
    <div class="jobfill-toolbar-bar" style="display:flex;align-items:center;gap:8px;background:rgba(15,23,42,0.9);backdrop-filter:blur(8px);padding:6px 8px;border-radius:9999px;box-shadow:0 12px 30px rgba(0,0,0,0.35);border:1px solid rgba(255,255,255,0.18);z-index:2147483645;">
      <button type="button" class="jobfill-btn-trigger" id="jobfill-quick-fill-btn" title="JobFill BD: ১-ক্লিকে প্রোফাইল অনুযায়ী ফর্ম পূরণ" style="background:linear-gradient(135deg,#16a34a,#15803d);padding:8px 14px;border:none;box-shadow:0 4px 12px rgba(22,163,74,0.4);cursor:pointer;display:flex;align-items:center;gap:6px;border-radius:9999px;color:#ffffff;font-size:12.5px;font-weight:700;">
        <span style="font-size:15px;">⚡</span>
        <span>Auto Fill Now</span>
      </button>
      <button type="button" class="jobfill-btn-trigger" id="jobfill-docs-btn" title="JobFill BD: ছবি ও স্বাক্ষর আপলোড অনুমোদন" style="background:#0284c7;color:#ffffff;padding:8px 12px;border:1px solid #0ea5e9;cursor:pointer;display:none;align-items:center;gap:6px;border-radius:9999px;font-size:12px;font-weight:700;">
        <span style="font-size:14px;">📷</span>
        <span>Photo &amp; Sig</span>
      </button>
      <button type="button" class="jobfill-btn-trigger" id="jobfill-trigger-btn" title="JobFill BD: ফিল্ড রিভিউ ও কাস্টমাইজেশন" style="background:#1e293b;color:#f8fafc;padding:8px 12px;border:1px solid #334155;cursor:pointer;display:flex;align-items:center;gap:6px;border-radius:9999px;font-size:12px;font-weight:600;">
        <span style="font-size:14px;">📋</span>
        <span>Review</span>
      </button>
      <button type="button" class="jobfill-btn-trigger" id="jobfill-search-btn" title="JobFill BD: স্মার্ট জব সার্চ" style="background:#0369a1;color:#ffffff;padding:8px 11px;border:1px solid #0ea5e9;cursor:pointer;display:flex;align-items:center;gap:5px;border-radius:9999px;font-size:12px;font-weight:600;">
        <span style="font-size:13px;">🔎</span>
        <span>Job Search</span>
      </button>
      <button type="button" class="jobfill-btn-trigger" id="jobfill-circulars-btn" title="JobFill BD: জব সার্কুলার ও ডেডলাইন" style="background:#0f766e;color:#ffffff;padding:8px 11px;border:1px solid #14b8a6;cursor:pointer;display:flex;align-items:center;gap:5px;border-radius:9999px;font-size:12px;font-weight:600;">
        <span style="font-size:13px;">📢</span>
        <span>Job Circulars</span>
      </button>
      <span class="jobfill-toolbar-divider" aria-hidden="true"></span>
      <button type="button" class="jobfill-close-btn" id="jobfill-close-toolbar-btn" title="Hide JobFill Toolbar" aria-label="Hide JobFill Toolbar">&times;</button>
    </div>
  `;

  document.body.appendChild(container);

  document.getElementById('jobfill-quick-fill-btn')?.addEventListener('click', async () => {
    await executeQuickFill();
  });

  document.getElementById('jobfill-docs-btn')?.addEventListener('click', () => {
    openDocumentApprovalModal();
  });

  document.getElementById('jobfill-trigger-btn')?.addEventListener('click', () => {
    openReviewModal();
  });

  document.getElementById('jobfill-search-btn')?.addEventListener('click', () => {
    if (isExtensionRuntime() && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ action: 'openJobSearch' }).catch(() => {});
    } else {
      window.open('../dashboard.html?tab=search', '_blank');
    }
  });

  document.getElementById('jobfill-circulars-btn')?.addEventListener('click', () => {
    if (isExtensionRuntime() && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ action: 'openJobCirculars' }).catch(() => {});
    } else {
      window.open('../dashboard.html?tab=circulars', '_blank');
    }
  });

  document.getElementById('jobfill-close-toolbar-btn')?.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    void dismissFloatingToolbar();
  });
}

// Create Review & Approval Modal in DOM
function createReviewModal() {
  if (document.getElementById('jobfill-review-modal-backdrop')) return;

  const backdrop = document.createElement('div');
  backdrop.id = 'jobfill-review-modal-backdrop';
  if (isExtensionRuntime()) backdrop.setAttribute('data-jobfill-ext', 'true');

  backdrop.innerHTML = `
    <div id="jobfill-review-modal-container">
      <div class="jobfill-modal-header">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:22px;">📋</span>
          <div>
            <div style="display:flex;align-items:center;gap:8px;">
              <h2 style="margin:0;font-size:15.5px;font-weight:700;">JobFill BD — Review & Field Mapping</h2>
              <span id="jobfill-mode-badge" style="background:#dcfce7;color:#166534;font-size:10px;font-weight:700;padding:2px 7px;border-radius:9999px;border:1px solid #bbf7d0;">
                Profile-First Mode
              </span>
            </div>
            <p style="margin:2px 0 0;font-size:11px;opacity:0.9;" id="jobfill-modal-subtitle">
              Active Profile: ${currentProfile.personal.applicantNameEn || currentProfile.profileName}
              <span id="jobfill-last-scanned" style="margin-left:10px;opacity:0.8;"></span>
            </p>
          </div>
        </div>
        <button id="jobfill-close-modal-btn" style="background:none;border:none;color:#fff;font-size:20px;cursor:pointer;padding:4px 8px;border-radius:6px;" title="Cancel / Close">✕</button>
      </div>

      <div class="jobfill-modal-body">
        ${
          assessHttpSensitiveAutofillRisk(window.location.href, []).isInsecureHttp
            ? `<div style="background:#fffbeb;border:1px solid #f59e0b;color:#92400e;border-radius:8px;padding:8px 10px;margin-bottom:8px;font-size:11.5px;display:flex;gap:8px;align-items:flex-start;">
                <span>⚠️</span>
                <span><strong>Unencrypted HTTP Page:</strong> Verify this site address before filling National ID, Birth Reg, Passport, or Phone details.</span>
              </div>`
            : ''
        }
        <div class="jobfill-safety-banner">
          <span style="font-size:16px;">🛡️</span>
          <div>
            <strong>নিরাপত্তা নিশ্চয়তা (Safety Guarantee):</strong> JobFill BD কোনো অবস্থাতেই Final Submit বা Pay Now বাটনে ক্লিক করবে না। তথ্য যাচাই করে আপনি নিজে সাবমিট করবেন।
          </div>
        </div>

        <!-- Metric Badges & Quick Action Controls -->
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:12px;">
          <div id="jobfill-stats-bar" style="display:flex;flex-wrap:wrap;gap:6px;font-size:11px;font-weight:600;">
            <span style="color:#15803d;background:#dcfce7;padding:3px 8px;border-radius:6px;" id="stat-ready">Ready to Fill: 0</span>
            <span style="color:#0284c7;background:#e0f2fe;padding:3px 8px;border-radius:6px;" id="stat-already">Already Correct: 0</span>
            <span style="color:#b45309;background:#fef3c7;padding:3px 8px;border-radius:6px;" id="stat-missing">Missing Info: 0</span>
            <span style="color:#92400e;background:#ffedd5;padding:3px 8px;border-radius:6px;" id="stat-confirm">Confirm Req: 0</span>
            <span style="color:#dc2626;background:#fee2e2;padding:3px 8px;border-radius:6px;" id="stat-conflicts">Conflicts: 0</span>
            <span style="color:#7c3aed;background:#ede9fe;padding:3px 8px;border-radius:6px;" id="stat-ambiguous">Ambiguous: 0</span>
          </div>

          <div style="display:flex;align-items:center;gap:6px;">
            <span id="jobfill-selected-counter" style="font-size:11.5px;font-weight:700;color:#0f172a;margin-right:4px;">
              Selected: 0
            </span>
            <button id="jobfill-select-all-btn" style="background:#e0f2fe;color:#0369a1;border:1px solid #bae6fd;padding:3px 10px;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;">
              ☑ Select All
            </button>
            <button id="jobfill-deselect-all-btn" style="background:#f1f5f9;color:#475569;border:1px solid #cbd5e1;padding:3px 10px;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;">
              ☐ Deselect All
            </button>
          </div>
        </div>

        <!-- Filter Tabs -->
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:12px;border-bottom:1px solid #e2e8f0;padding-bottom:6px;">
          <div style="display:flex;gap:8px;">
            <button id="tab-attention" style="background:#fef2f2;color:#991b1b;border:1px solid #fecaca;padding:5px 12px;border-radius:6px;font-size:11.5px;font-weight:700;cursor:pointer;">
              ⚠️ Needs Attention (<span id="count-attention">0</span>)
            </button>
            <button id="tab-all" style="background:#f8fafc;color:#475569;border:1px solid #cbd5e1;padding:5px 12px;border-radius:6px;font-size:11.5px;font-weight:600;cursor:pointer;">
              📋 All Fields (<span id="count-all">0</span>)
            </button>
          </div>

          <!-- Replace Existing Values Setting Toggle -->
          <label style="font-size:11px;color:#475569;display:flex;align-items:center;gap:4px;cursor:pointer;">
            <input type="checkbox" id="jobfill-chk-allow-replace" ${allowReplaceExisting ? 'checked' : ''} style="cursor:pointer;" />
            <span>Allow replacing existing values</span>
          </label>
        </div>

        <div id="jobfill-missing-alert" style="display:none;margin-bottom:12px;background:#fef2f2;border:1px solid #fecaca;padding:8px 12px;border-radius:6px;font-size:11.5px;color:#991b1b;"></div>
        <div id="jobfill-completeness-banner" style="display:none;margin-bottom:12px;background:#fffbeb;border:1px solid #fde68a;padding:8px 12px;border-radius:6px;font-size:11.5px;color:#92400e;"></div>

        <div id="jobfill-fields-list">
          <div style="text-align:center;padding:30px 0;color:#64748b;">
            Scanning active application form fields...
          </div>
        </div>
      </div>

      <div class="jobfill-modal-footer">
        <div style="display:flex;gap:8px;">
          <button id="jobfill-cancel-btn" style="background:#f1f5f9;color:#334155;border:1px solid #cbd5e1;padding:8px 14px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;">
            Cancel
          </button>
          <button id="jobfill-undo-btn" style="background:#fff1f2;color:#be123c;border:1px solid #fecdd3;padding:8px 12px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;">
            ↩️ Undo Fill
          </button>
        </div>

        <div style="display:flex;gap:8px;">
          <button id="jobfill-rescan-btn" style="background:#f8fafc;color:#475569;border:1px solid #cbd5e1;padding:8px 14px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px;">
            <span>🔄</span>
            <span id="jobfill-rescan-label">Re-scan</span>
          </button>
          <button id="jobfill-fill-btn" style="background:linear-gradient(135deg,#16a34a,#15803d);color:#ffffff;border:none;padding:8px 18px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;box-shadow:0 4px 10px rgba(22,163,74,0.3);display:flex;align-items:center;gap:6px;">
            <span>⚡</span>
            <span>Fill Selected Fields (<span id="fill-selected-count">0</span>)</span>
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);

  // Close & Cancel buttons
  document.getElementById('jobfill-close-modal-btn')?.addEventListener('click', closeReviewModal);
  document.getElementById('jobfill-cancel-btn')?.addEventListener('click', closeReviewModal);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeReviewModal();
  });

  // Re-scan button with loading indicator and timestamp
  document.getElementById('jobfill-rescan-btn')?.addEventListener('click', async () => {
    const rescanLabel = document.getElementById('jobfill-rescan-label');
    if (rescanLabel) rescanLabel.textContent = 'Scanning...';
    await runScan();
    if (rescanLabel) rescanLabel.textContent = 'Re-scan';
    showToast(`✅ ফ্রেশ ফর্ম স্ক্যান সম্পন্ন হয়েছে (${lastScannedTime})`);
  });

  // Allow replacing existing setting
  document.getElementById('jobfill-chk-allow-replace')?.addEventListener('change', (e) => {
    allowReplaceExisting = (e.target as HTMLInputElement).checked;
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ jobfill_allow_replace_existing: allowReplaceExisting });
    }
  });

  // Filter Tabs
  document.getElementById('tab-attention')?.addEventListener('click', () => {
    activeFilterTab = 'attention';
    updateTabStyles();
    renderFieldsList();
  });
  document.getElementById('tab-all')?.addEventListener('click', () => {
    activeFilterTab = 'all';
    updateTabStyles();
    renderFieldsList();
  });

  // Select All button
  document.getElementById('jobfill-select-all-btn')?.addEventListener('click', () => {
    if (!currentScanResult) return;
    currentScanResult.planItems.forEach((m, idx) => {
      if (m.proposedValue) {
        m.isApproved = true;
        const chk = document.getElementById(`jobfill-chk-${idx}`) as HTMLInputElement | null;
        if (chk) chk.checked = true;
      }
    });
    updateSelectedCounter();
  });

  // Deselect All button
  document.getElementById('jobfill-deselect-all-btn')?.addEventListener('click', () => {
    if (!currentScanResult) return;
    currentScanResult.planItems.forEach((m, idx) => {
      m.isApproved = false;
      const chk = document.getElementById(`jobfill-chk-${idx}`) as HTMLInputElement | null;
      if (chk) chk.checked = false;
    });
    updateSelectedCounter();
  });

  // Undo button
  document.getElementById('jobfill-undo-btn')?.addEventListener('click', () => {
    const { restoredCount, preservedCount } = VerificationEngine.undoLastFill(activeSessionId);
    showToast(
      preservedCount > 0
        ? `↩️ ${restoredCount}টি ফিল্ড আগের অবস্থায় ফিরেছে (${preservedCount}টি ম্যানুয়াল পরিবর্তন সংরক্ষিত)।`
        : `↩️ ${restoredCount}টি ফিল্ড আগের অবস্থায় ফিরিয়ে আনা হয়েছে।`
    );
    runScan();
  });

  // Open full dashboard in a new tab
  document.getElementById('jobfill-open-dashboard-btn')?.addEventListener('click', () => {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ action: 'openDashboard' });
    } else {
      window.open('dashboard.html', '_blank');
    }
  });

  // Fill approved fields
  document.getElementById('jobfill-fill-btn')?.addEventListener('click', async () => {
    if (!currentScanResult) return;
    const fillBtn = document.getElementById('jobfill-fill-btn') as HTMLButtonElement;
    if (fillBtn) fillBtn.disabled = true;

    if (!activeSessionId) {
      activeSessionId = 'session_' + Date.now();
    }
    const approvedItems = currentScanResult.planItems.filter((item) => item.isApproved && item.proposedValue);

    if (approvedItems.length === 0) {
      alert('দয়া করে অন্তত একটি ফিল্ড সিলেক্ট করুন।');
      if (fillBtn) fillBtn.disabled = false;
      return;
    }

    const httpApproved = await confirmInsecureHttpSensitiveFillIfNeeded(approvedItems);
    if (!httpApproved) {
      if (fillBtn) fillBtn.disabled = false;
      showToast('⚠️ অনিরাপদ HTTP পেজে সংবেদনশীল তথ্য পূরণ বাতিল করা হয়েছে।');
      return;
    }

    const report = await VerificationEngine.executePlan(activeSessionId, approvedItems);
    if (lastCompletenessReport.length > 0) {
      const updatedMap = new Map(report.completenessReport.map((c) => [c.selector, c]));
      lastCompletenessReport = lastCompletenessReport.map((entry) => updatedMap.get(entry.selector) || entry);
    }

    // Apply post-fill adapter rules (e.g. Same as Present Address, Choice fields, CurrentlyWorking)
    try {
      const adapter = resolveSiteAdapter(window.location.href, document);
      if (adapter.postFill) {
        adapter.postFill(document, currentProfile);
      }
    } catch (e) {
      console.warn('Post fill hook error:', e);
    }

    if (fillBtn) fillBtn.disabled = false;
    closeReviewModal();

    showToast(`✅ ${report.successfullyFilled}টি ফিল্ড সফলভাবে পূরণ ও যাচাই করা হয়েছে!`);

    // Record to Application History
    try {
      await addAutofillHistory({
        id: activeSessionId,
        timestamp: Date.now(),
        url: window.location.href,
        domain: window.location.hostname || 'Local Document',
        pageTitle: document.title || 'Job Application Form',
        profileId: currentProfile.id,
        profileName: currentProfile.personal.applicantNameEn || currentProfile.profileName,
        totalDetected: currentScanResult.totalVisibleInputs,
        totalFilled: report.successfullyFilled,
        totalFailed: report.failedVerification,
        totalAmbiguous: currentScanResult.ambiguousCount || 0,
        status: report.failedVerification === 0 ? 'completed' : 'partial',
        filledFields: approvedItems.map((item) => ({
          fieldLabel: item.fieldLabel,
          canonicalKey: item.canonicalId,
          value: maskSensitiveHistoryValue(item.canonicalId, item.proposedValue),
          confidence: item.status,
        })),
      });
    } catch (e) {
      console.warn('JobFill BD: Could not save autofill history', e);
    }

    // Train Adaptive Mapping Memory for confirmed items
    for (const item of approvedItems) {
      if (item.element) {
        try {
          const fp = extractElementFingerprint(item.element, item.fieldLabel);
          MappingRepository.recordConfirmation(fp, item.canonicalId);
        } catch (e) {
          console.warn('JobFill BD: Could not record adaptive mapping confirmation', e);
        }
      }
    }
  });
}

function updateTabStyles() {
  const tabAttention = document.getElementById('tab-attention');
  const tabAll = document.getElementById('tab-all');
  if (tabAttention && tabAll) {
    if (activeFilterTab === 'attention') {
      tabAttention.style.background = '#fef2f2';
      tabAttention.style.color = '#991b1b';
      tabAttention.style.fontWeight = '700';
      tabAll.style.background = '#f8fafc';
      tabAll.style.color = '#475569';
      tabAll.style.fontWeight = '500';
    } else {
      tabAll.style.background = '#e0f2fe';
      tabAll.style.color = '#0369a1';
      tabAll.style.fontWeight = '700';
      tabAttention.style.background = '#f8fafc';
      tabAttention.style.color = '#475569';
      tabAttention.style.fontWeight = '500';
    }
  }
}

function updateSelectedCounter() {
  if (!currentScanResult) return;
  const approvedCount = currentScanResult.planItems.filter((i) => i.isApproved && i.proposedValue).length;
  const selectedEl = document.getElementById('jobfill-selected-counter');
  const fillBtnCount = document.getElementById('fill-selected-count');
  if (selectedEl) selectedEl.textContent = `Selected: ${approvedCount}`;
  if (fillBtnCount) fillBtnCount.textContent = String(approvedCount);
}

function closeDocumentApprovalModal() {
  const docBackdrop = document.getElementById('jobfill-doc-modal-backdrop');
  if (docBackdrop) docBackdrop.style.display = 'none';
}

function openReviewModal() {
  closeDocumentApprovalModal();
  const modal = document.getElementById('jobfill-review-modal-backdrop');
  if (!modal) return;
  modal.classList.add('open');
  runScan();
}

function closeReviewModal() {
  const modal = document.getElementById('jobfill-review-modal-backdrop');
  if (modal) modal.classList.remove('open');
}

// Executes scan and renders review items
async function runScan() {
  await loadProfile();
  await loadSettings();
  const subtitleEl = document.getElementById('jobfill-modal-subtitle');
  if (subtitleEl) {
    subtitleEl.innerHTML = isVaultLocked
      ? `🔒 Vault Locked — Unlock Dashboard to access profile <span id="jobfill-last-scanned" style="margin-left:10px;opacity:0.8;"></span>`
      : `Active Profile: ${escapeHtml(currentProfile.personal.applicantNameEn || currentProfile.profileName)} <span id="jobfill-last-scanned" style="margin-left:10px;opacity:0.8;"></span>`;
  }
  currentScanResult = await UniversalPageScanner.scanPage(currentProfile, document);

  lastScannedTime = new Date().toLocaleTimeString();
  const lastScannedEl = document.getElementById('jobfill-last-scanned');
  if (lastScannedEl) lastScannedEl.textContent = `Last scanned: ${lastScannedTime}`;

  // Update statistics
  const readyEl = document.getElementById('stat-ready');
  const alreadyEl = document.getElementById('stat-already');
  const missEl = document.getElementById('stat-missing');
  const confirmEl = document.getElementById('stat-confirm');
  const confEl = document.getElementById('stat-conflicts');
  const ambigEl = document.getElementById('stat-ambiguous');

  const confirmCount = currentScanResult.confirmationRequiredCount || 0;
  if (readyEl) readyEl.textContent = `Ready to Fill: ${currentScanResult.readyToFillCount}`;
  if (alreadyEl) alreadyEl.textContent = `Already Correct: ${currentScanResult.alreadyCorrectCount}`;
  if (missEl) missEl.textContent = `Missing Info: ${currentScanResult.missingInfoCount}`;
  if (confirmEl) confirmEl.textContent = `Confirm Req: ${confirmCount}`;
  if (confEl) confEl.textContent = `Conflicts: ${currentScanResult.conflictsCount}`;
  if (ambigEl) ambigEl.textContent = `Ambiguous: ${currentScanResult.ambiguousCount}`;

  const attentionCount =
    confirmCount +
    currentScanResult.missingInfoCount +
    currentScanResult.ambiguousCount +
    currentScanResult.conflictsCount +
    currentScanResult.unsupportedCount +
    currentScanResult.failedCount;

  const countAttentionEl = document.getElementById('count-attention');
  const countAllEl = document.getElementById('count-all');
  if (countAttentionEl) countAttentionEl.textContent = String(attentionCount);
  if (countAllEl) countAllEl.textContent = String(currentScanResult.planItems.length);

  // If 0 attention items, default to all fields tab so user sees all matched items
  if (attentionCount === 0) {
    activeFilterTab = 'all';
  }
  updateTabStyles();

  // Completeness & Missing-Field Diagnostic Banner
  const compBanner = document.getElementById('jobfill-completeness-banner');
  if (compBanner) {
    const diagItems = (lastCompletenessReport.length > 0
      ? lastCompletenessReport
      : VerificationEngine.buildCompletenessReport(currentScanResult.planItems)
    ).filter((d) => d.status !== 'Successfully Filled' && d.status !== 'Already Correct');
    if (diagItems.length > 0) {
      compBanner.style.display = 'block';
      compBanner.innerHTML = `
        <strong>📋 ফিল্ড ডায়াগনস্টিকস ও অসম্পূর্ণতা রিপোর্ট (${diagItems.length}টি ফিল্ডে নজরের প্রয়োজন):</strong>
        <ul style="margin:4px 0 0 16px;padding:0;list-style:disc;font-size:11px;">
          ${diagItems
            .slice(0, 8)
            .map(
              (d) =>
                `<li><strong>${escapeHtml(d.fieldLabel)}</strong>: ${escapeHtml(d.status)}${d.proposedValue ? ` — Saved: "${escapeHtml(d.proposedValue)}"` : ''}</li>`
            )
            .join('')}
        </ul>
      `;
    } else {
      compBanner.style.display = 'none';
    }
  }

  // Missing Info Alert
  const missingAlert = document.getElementById('jobfill-missing-alert');
  if (missingAlert) {
    if (currentScanResult.missingProfileFields.length > 0) {
      missingAlert.style.display = 'block';
      missingAlert.innerHTML = `
        <strong>⚠️ প্রোফাইলে অনুপস্থিত তথ্য (Missing Profile Info):</strong>
        <div style="margin-top:4px;">${currentScanResult.missingProfileFields.join(', ')} — নিচে ফিল্ডে লিখে [💾 Save to Profile] করতে পারেন।</div>
      `;
    } else {
      missingAlert.style.display = 'none';
    }
  }

  renderFieldsList();
}

const TEACHABLE_CANONICAL_OPTIONS: Array<{ id: string; label: string }> = [
  { id: 'applicant.fullName.english', label: "Applicant's Name (English)" },
  { id: 'applicant.fullName.bangla', label: 'আবেদনকারীর নাম (বাংলা)' },
  { id: 'family.father.name.english', label: "Father's Name (English)" },
  { id: 'family.father.name.bangla', label: 'পিতার নাম (বাংলা)' },
  { id: 'family.mother.name.english', label: "Mother's Name (English)" },
  { id: 'family.mother.name.bangla', label: 'মাতার নাম (বাংলা)' },
  { id: 'applicant.dateOfBirth', label: 'Date of Birth' },
  { id: 'applicant.gender', label: 'Gender' },
  { id: 'applicant.religion', label: 'Religion' },
  { id: 'applicant.nationality', label: 'Nationality' },
  { id: 'applicant.maritalStatus', label: 'Marital Status' },
  { id: 'identity.nationalId', label: 'National ID (NID)' },
  { id: 'identity.birthRegistration', label: 'Birth Registration No' },
  { id: 'identity.passport', label: 'Passport No' },
  { id: 'contact.mobile', label: 'Mobile Number' },
  { id: 'contact.email', label: 'Email Address' },
  { id: 'applicant.quota', label: 'Quota' },
  { id: 'applicant.departmentalStatus', label: 'Departmental Candidate' },
  { id: 'address.present.village', label: 'Present Village/Road/House' },
  { id: 'address.present.district', label: 'Present District' },
  { id: 'address.present.upazila', label: 'Present Upazila/Thana' },
  { id: 'address.present.postOffice', label: 'Present Post Office' },
  { id: 'address.present.postCode', label: 'Present Post Code' },
  { id: 'address.permanent.village', label: 'Permanent Village/Road/House' },
  { id: 'address.permanent.district', label: 'Permanent District' },
  { id: 'address.permanent.upazila', label: 'Permanent Upazila/Thana' },
  { id: 'education.ssc.board', label: 'SSC Board' },
  { id: 'education.ssc.roll', label: 'SSC Roll' },
  { id: 'education.ssc.gpa', label: 'SSC GPA' },
  { id: 'education.ssc.passingYear', label: 'SSC Passing Year' },
  { id: 'education.hsc.board', label: 'HSC Board' },
  { id: 'education.hsc.roll', label: 'HSC Roll' },
  { id: 'education.hsc.gpa', label: 'HSC GPA' },
  { id: 'education.hsc.passingYear', label: 'HSC Passing Year' },
  { id: 'education.graduation.degree', label: 'Graduation Degree' },
  { id: 'education.graduation.subject', label: 'Graduation Subject' },
  { id: 'education.graduation.institution', label: 'Graduation University/College' },
  { id: 'education.graduation.gpa', label: 'Graduation CGPA/Result' },
  { id: 'education.graduation.passingYear', label: 'Graduation Passing Year' },
];

function isFieldTeachable(canonicalId: string, status: string): boolean {
  return (
    !canonicalId ||
    canonicalId === 'unknown' ||
    status === 'Unsupported Field' ||
    status === 'Ambiguous Field' ||
    status === 'Missing Profile Information'
  );
}

function buildTeachOptionsHtml(selectedKey: string): string {
  const opts = TEACHABLE_CANONICAL_OPTIONS.map(
    (opt) =>
      `<option value="${escapeHtml(opt.id)}" ${opt.id === selectedKey ? 'selected' : ''}>${escapeHtml(opt.label)}</option>`
  ).join('');
  return `<option value="">-- Map to Profile Field --</option>${opts}`;
}

function renderFieldsList() {
  const listContainer = document.getElementById('jobfill-fields-list');
  if (!listContainer || !currentScanResult) return;

  if (currentScanResult.planItems.length === 0) {
    listContainer.innerHTML = `
      <div style="text-align:center;padding:30px 20px;color:#64748b;">
        <span style="font-size:32px;display:block;margin-bottom:8px;">⚠️</span>
        <strong>এই পেজে কোনো সক্রিয় ফর্ম ফিল্ড শনাক্ত করা যায়নি।</strong><br/>
        <span style="font-size:12px;">দয়া করে নিশ্চিত করুন যে আপনি আবেদন ফর্ম পেজে আছেন অথবা টেস্ট পেজ ওপেন করুন।</span>
      </div>
    `;
    updateSelectedCounter();
    return;
  }

  const attentionStatuses = [
    'User Confirmation Required',
    'Ambiguous Field',
    'Missing Profile Information',
    'Existing Value Conflict',
    'Unsupported Field',
    'Fill Failed',
  ];

  let displayItems = currentScanResult.planItems;
  if (activeFilterTab === 'attention') {
    displayItems = currentScanResult.planItems.filter((i) => attentionStatuses.includes(i.status));
  }

  if (displayItems.length === 0) {
    if (activeFilterTab === 'attention') {
      listContainer.innerHTML = `
        <div style="text-align:center;padding:26px 16px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;color:#166534;">
          <span style="font-size:28px;display:block;margin-bottom:6px;">🎉</span>
          <strong style="font-size:13px;">সব ফিল্ড প্রোফাইল অনুযায়ী নিখুঁতভাবে ম্যাচ হয়েছে!</strong>
          <p style="font-size:11.5px;margin:4px 0 10px;color:#15803d;">কোনো কনফ্লিক্ট বা অস্পষ্ট ফিল্ড নেই। সরাসরি [ ⚡ Fill Selected Fields ] বাটনে ক্লিক করুন।</p>
          <button id="jobfill-btn-switch-all" style="background:#16a34a;color:#ffffff;border:none;padding:5px 12px;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;">
            📋 সব ${currentScanResult.planItems.length}টি ফিল্ড দেখুন
          </button>
        </div>
      `;
      document.getElementById('jobfill-btn-switch-all')?.addEventListener('click', () => {
        activeFilterTab = 'all';
        updateTabStyles();
        renderFieldsList();
      });
      updateSelectedCounter();
      return;
    }
  }

  let html = '';
  displayItems.forEach((m) => {
    const idx = currentScanResult!.planItems.indexOf(m);

    // Status Badge Styling based on the 8 clear statuses
    let badgeStyle = 'background:#f1f5f9;color:#475569;';
    if (m.status === 'Matched') badgeStyle = 'background:#dcfce7;color:#15803d;';
    else if (m.status === 'Already Correct') badgeStyle = 'background:#e0f2fe;color:#0369a1;';
    else if (m.status === 'User Confirmation Required') badgeStyle = 'background:#ffedd5;color:#9a3412;border:1px solid #fdba74;';
    else if (m.status === 'Missing Profile Information') badgeStyle = 'background:#fef3c7;color:#b45309;';
    else if (m.status === 'Existing Value Conflict') badgeStyle = 'background:#fee2e2;color:#b91c1c;';
    else if (m.status === 'Ambiguous Field') badgeStyle = 'background:#ede9fe;color:#7c3aed;';
    else if (m.status === 'Unsupported Field') badgeStyle = 'background:#e2e8f0;color:#334155;';
    else if (m.status === 'Fill Failed') badgeStyle = 'background:#fee2e2;color:#991b1b;';
    else if (m.status === 'Filled') badgeStyle = 'background:#dcfce7;color:#166534;';

    const diagTag =
      m.diagnosticStatus && m.diagnosticStatus !== (m.status as any)
        ? ` (${escapeHtml(m.diagnosticStatus)})`
        : '';

    html += `
      <div class="jobfill-field-card" id="card-${idx}" style="display:flex;gap:10px;padding:9px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;margin-bottom:6px;align-items:flex-start;">
        <input type="checkbox" id="jobfill-chk-${idx}" ${m.isApproved ? 'checked' : ''} style="width:16px;height:16px;margin-top:2px;accent-color:#16a34a;cursor:pointer;" />
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;flex-wrap:wrap;">
            <span style="font-size:12px;font-weight:700;color:#1e293b;">${escapeHtml(m.fieldLabel)}</span>
            <span style="font-size:10px;font-weight:700;padding:1px 6px;border-radius:4px;${badgeStyle}">${m.status}${diagTag}</span>
          </div>

          <div style="display:flex;align-items:center;gap:6px;font-size:11.5px;flex-wrap:wrap;">
            <span style="color:#64748b;white-space:nowrap;">Value:</span>
            <input type="text" id="jobfill-val-${idx}" value="${escapeHtml(m.proposedValue)}" placeholder="${m.status === 'Missing Profile Information' ? 'Enter value...' : ''}" style="flex:1;min-width:140px;border:1px solid #cbd5e1;border-radius:4px;padding:3px 6px;font-size:11.5px;color:#0f172a;" />
            
            <button id="jobfill-save-app-${idx}" title="Use this edited value for this application only" style="background:#f1f5f9;color:#334155;border:1px solid #cbd5e1;padding:2px 8px;border-radius:4px;font-size:10.5px;font-weight:600;cursor:pointer;white-space:nowrap;">
              📝 Use Once
            </button>
            <button id="jobfill-save-profile-${idx}" title="Save to profile database for future applications" style="background:#fef3c7;color:#92400e;border:1px solid #fde68a;padding:2px 8px;border-radius:4px;font-size:10.5px;font-weight:700;cursor:pointer;white-space:nowrap;">
              💾 Save to Profile
            </button>
          </div>

          ${
            m.hasConflict
              ? `<div style="font-size:10.5px;color:#b91c1c;margin-top:2px;">⚠️ Currently on website: "<strong>${escapeHtml(m.originalValue)}</strong>". Check box above to approve overwrite.</div>`
              : ''
          }
          ${
            m.statusReason && m.status !== 'Matched' && !m.hasConflict
              ? `<div style="font-size:10.5px;color:#64748b;margin-top:2px;">${escapeHtml(m.statusReason)}</div>`
              : ''
          }
          ${
            isFieldTeachable(m.canonicalId, m.status)
              ? `<div class="jobfill-teach-box">
                   <span style="font-size:10.5px;font-weight:700;color:#475569;">Teach Field:</span>
                   <select id="jobfill-teach-select-${idx}" style="flex:1;min-width:150px;border:1px solid #cbd5e1;border-radius:4px;padding:2px 6px;font-size:11px;background:#ffffff;color:#0f172a;">
                     ${buildTeachOptionsHtml(m.canonicalId)}
                   </select>
                   <button type="button" id="jobfill-teach-btn-${idx}" style="background:#ede9fe;color:#5b21b6;border:1px solid #c4b5fd;padding:2px 8px;border-radius:4px;font-size:10.5px;font-weight:700;cursor:pointer;white-space:nowrap;">
                     🧠 Teach &amp; Save Rule
                   </button>
                 </div>`
              : ''
          }
        </div>
      </div>
    `;
  });

  listContainer.innerHTML = html;

  // Bind checkboxes & inputs with fully controlled interactive state
  displayItems.forEach((m) => {
    const idx = currentScanResult!.planItems.indexOf(m);
    const chk = document.getElementById(`jobfill-chk-${idx}`) as HTMLInputElement | null;
    const valInput = document.getElementById(`jobfill-val-${idx}`) as HTMLInputElement | null;
    const saveAppBtn = document.getElementById(`jobfill-save-app-${idx}`) as HTMLButtonElement | null;
    const saveProfileBtn = document.getElementById(`jobfill-save-profile-${idx}`) as HTMLButtonElement | null;
    const teachSelect = document.getElementById(`jobfill-teach-select-${idx}`) as HTMLSelectElement | null;
    const teachBtn = document.getElementById(`jobfill-teach-btn-${idx}`) as HTMLButtonElement | null;

    if (teachBtn && teachSelect) {
      teachBtn.addEventListener('click', async () => {
        const chosenKey = teachSelect.value.trim();
        if (!chosenKey) {
          showToast('⚠️ প্রোফাইল ফিল্ড নির্বাচন করুন।');
          return;
        }
        m.canonicalId = chosenKey;
        if (m.element) {
          const fp = extractElementFingerprint(m.element, m.fieldLabel);
          await MappingRepository.recordConfirmation(fp, chosenKey);
        }
        const resolvedVal = resolveCanonicalValue(toCanonicalProfile(currentProfile), chosenKey) || '';
        if (resolvedVal.trim() !== '') {
          m.proposedValue = resolvedVal;
          m.isApproved = true;
          m.status = 'Matched';
          if (valInput) valInput.value = resolvedVal;
          if (chk) chk.checked = true;
          updateSelectedCounter();
        }
        teachBtn.textContent = '✅ Learned';
        showToast(`🧠 "${chosenKey}" ম্যাপিং সেভ হয়েছে — ভবিষ্যতে স্বয়ংক্রিয়ভাবে ম্যাচ করবে!`);
      });
    }

    if (chk) {
      chk.addEventListener('change', () => {
        m.isApproved = chk.checked;
        updateSelectedCounter();
      });
    }

    if (valInput) {
      valInput.addEventListener('input', () => {
        m.proposedValue = valInput.value;
        if (valInput.value.trim() !== '') {
          m.isApproved = true;
          if (chk) chk.checked = true;
          updateSelectedCounter();
        }
      });
    }

    // Option A: Use for this application only
    if (saveAppBtn && valInput) {
      saveAppBtn.addEventListener('click', () => {
        m.proposedValue = valInput.value.trim();
        m.isApproved = true;
        if (chk) chk.checked = true;
        updateSelectedCounter();
        showToast(`📝 ফিল্ড মান আপডেট করা হয়েছে (শুধুমাত্র এই আবেদনের জন্য)`);
      });
    }

    // Option B: Update saved JobFill BD profile in database
    if (saveProfileBtn && valInput) {
      saveProfileBtn.addEventListener('click', async () => {
        const val = valInput.value.trim();
        if (!val) {
          alert('দয়া করে আগে ভ্যালু লিখুন।');
          return;
        }
        saveProfileBtn.disabled = true;
        saveProfileBtn.textContent = 'Saving...';
        const savedOk = await updateProfileValue(m.canonicalId, val);
        saveProfileBtn.disabled = false;
        if (!savedOk) {
          saveProfileBtn.textContent = '💾 Save to Profile';
          showToast('⚠️ প্রোফাইলে সংরক্ষণ করা যায়নি (ভল্ট লক করা বা অজানা ফিল্ড)। ড্যাশবোর্ড থেকে সেভ করুন।');
          return;
        }
        saveProfileBtn.textContent = '✅ Saved';
        m.proposedValue = val;
        m.isApproved = true;
        if (chk) chk.checked = true;
        updateSelectedCounter();
        showToast(`✅ "${m.canonicalId}" প্রোফাইল ডেটাবেজে সফলভাবে সংরক্ষিত হয়েছে!`);
      });
    }
  });

  updateSelectedCounter();
}

function escapeHtml(s: string): string {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showToast(msg: string) {
  let toast = document.getElementById('jobfill-inpage-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'jobfill-inpage-toast';
    toast.style.cssText = `
      position: fixed;
      top: 24px;
      right: 24px;
      background: #0f172a;
      color: #ffffff;
      padding: 10px 18px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      box-shadow: 0 10px 25px rgba(0,0,0,0.2);
      z-index: 2147483647;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      gap: 8px;
    `;
    document.body.appendChild(toast);
  }

  toast.textContent = msg;
  toast.style.opacity = '1';
  toast.style.transform = 'translateY(0)';

  if (toastHideTimer) clearTimeout(toastHideTimer);
  toastHideTimer = setTimeout(() => {
    if (toast) {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
    }
  }, 3200);
}

// ============================================================
// SMART PHOTO & SIGNATURE APPROVAL & VERIFIED UPLOAD MODAL
// ============================================================

async function fetchDocumentForActiveProfile(docType: DocumentCategory): Promise<DecryptedDocumentSource | null> {
  // 1. Prefer secure extension messaging to Background Service Worker (Extension Origin Vault)
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
    const response: any = await new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(
          {
            action: 'GET_PROFILE_DOCUMENT_PREVIEWS',
            payload: {
              profileId: currentProfile.id,
              requestedTypes: [docType],
              url: window.location.href,
            },
          },
          (res) => {
            if (chrome.runtime.lastError) {
              resolve({ status: 'runtime_error', error: chrome.runtime.lastError.message });
              return;
            }
            resolve(res);
          }
        );
      } catch (err: any) {
        resolve({ status: 'runtime_error', error: err?.message });
      }
    });

    if (response?.status === 'error') {
      const errMsg = String(response.error || '');
      if (/VAULT_LOCKED|denied|Unauthorized/i.test(errMsg)) {
        throw new Error(errMsg);
      }
    }

    if (response && response.status === 'ok') {
      return response.documents?.[docType] || null;
    }

    if (isExtensionRuntime() && response?.status !== 'runtime_error') {
      return null;
    }
  }

  try {
    return await DocumentRepository.getByCategory(currentProfile.id, docType, false);
  } catch (err: any) {
    if (String(err?.message || '').includes('VAULT_LOCKED')) {
      throw err;
    }
    return null;
  }
}

async function readLocalDocumentFile(file: File): Promise<{
  fileName: string;
  mimeType: string;
  fileSize: number;
  width: number;
  height: number;
  dataUrl: string;
}> {
  const mimeType = inferDocumentMimeType(file.name, file.type);
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read selected file.'));
    reader.readAsDataURL(file);
  });

  const dims = mimeType.startsWith('image/')
    ? await new Promise<{ width: number; height: number }>((resolve) => {
        const img = new Image();
        img.onload = () =>
          resolve({ width: img.naturalWidth || img.width || 0, height: img.naturalHeight || img.height || 0 });
        img.onerror = () => resolve({ width: 0, height: 0 });
        img.src = dataUrl;
      })
    : { width: 0, height: 0 };

  return {
    fileName: file.name,
    mimeType,
    fileSize: file.size,
    width: dims.width,
    height: dims.height,
    dataUrl,
  };
}

async function saveDocumentToActiveProfile(docType: DocumentCategory, file: File): Promise<boolean> {
  const payload = await readLocalDocumentFile(file);

  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage && isExtensionRuntime()) {
    const response: any = await new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(
          {
            action: 'SAVE_PROFILE_DOCUMENT',
            payload: {
              profileId: currentProfile.id,
              documentType: docType,
              url: window.location.href,
              ...payload,
            },
          },
          (res) => {
            if (chrome.runtime.lastError) {
              resolve({ status: 'error', error: chrome.runtime.lastError.message });
              return;
            }
            resolve(res);
          }
        );
      } catch (err: any) {
        resolve({ status: 'error', error: err?.message });
      }
    });

    if (response?.status !== 'ok') {
      throw new Error(response?.error || 'Could not save document to JobFill Vault.');
    }
    return true;
  }

  const prefix = docType === 'photo' ? 'photo' : docType === 'signature' ? 'sig' : docType;
  const docId =
    docType === 'photo' || docType === 'signature'
      ? `${prefix}_${currentProfile.id}_original`
      : `${prefix}_${currentProfile.id}_${Date.now()}`;
  await DocumentRepository.saveDocument({
    id: docId,
    documentId: docId,
    profileId: currentProfile.id,
    type: docType,
    documentType: docType,
    fileName: payload.fileName,
    mimeType: payload.mimeType,
    fileSize: payload.fileSize,
    width: payload.width,
    height: payload.height,
    dataUrl: payload.dataUrl,
  });
  return true;
}

function createDocumentApprovalModal() {
  if (document.getElementById('jobfill-doc-modal-backdrop')) return;

  const backdrop = document.createElement('div');
  backdrop.id = 'jobfill-doc-modal-backdrop';
  if (isExtensionRuntime()) backdrop.setAttribute('data-jobfill-ext', 'true');
  backdrop.style.display = 'none';

  backdrop.innerHTML = `
    <div id="jobfill-doc-modal-container">
      <div class="jobfill-doc-modal-header">
        <div style="display:flex;align-items:center;gap:10px;min-width:0;">
          <span style="font-size:22px;flex-shrink:0;">📷</span>
          <div style="min-width:0;">
            <h2 style="margin:0;font-size:15.5px;font-weight:700;color:#fff;">JobFill BD — Smart Document &amp; Photo Approval</h2>
            <p style="margin:2px 0 0;font-size:11px;opacity:0.92;color:#e0f2fe;">পর্যালোচনা ও অনুমোদন ছাড়া কোনো ছবি, স্বাক্ষর বা ডকুমেন্ট আপলোড করা হবে না</p>
          </div>
        </div>
        <button id="jobfill-doc-close-btn" type="button" style="background:none;border:none;color:#fff;font-size:19px;cursor:pointer;padding:4px 8px;flex-shrink:0;">✕</button>
      </div>

      <div id="jobfill-doc-modal-body" class="jobfill-doc-modal-body">
        <div style="text-align:center;padding:28px 0;color:#64748b;">ডকুমেন্ট ফিল্ড ও প্রোফাইল যাচাই করা হচ্ছে...</div>
      </div>

      <div id="jobfill-doc-modal-footer" class="jobfill-doc-modal-footer">
        <button id="jobfill-doc-skip-btn" type="button" class="jobfill-doc-btn" style="background:#f1f5f9;color:#334155;border:1px solid #cbd5e1;padding:8px 16px;border-radius:8px;font-size:12px;">
          ⏭️ Skip Upload
        </button>
        <button id="jobfill-doc-upload-btn" type="button" class="jobfill-doc-btn" style="background:linear-gradient(135deg,#0284c7,#0369a1);color:#fff;border:none;padding:9px 18px;border-radius:8px;font-size:12.5px;font-weight:700;box-shadow:0 4px 10px rgba(2,132,199,0.3);">
          <span>📤</span>
          <span>Upload Approved Documents</span>
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);

  const closeDocModal = () => {
    backdrop.style.display = 'none';
  };

  document.getElementById('jobfill-doc-close-btn')?.addEventListener('click', closeDocModal);
  document.getElementById('jobfill-doc-skip-btn')?.addEventListener('click', () => {
    closeDocModal();
    showToast('⏭️ ডকুমেন্ট আপলোড স্কিপ করা হয়েছে।');
  });
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeDocModal();
  });

  document.getElementById('jobfill-doc-upload-btn')?.addEventListener('click', async () => {
    await executeApprovedDocumentUpload();
  });
}

async function openDocumentApprovalModal() {
  closeReviewModal();
  const backdrop = document.getElementById('jobfill-doc-modal-backdrop');
  if (!backdrop) createDocumentApprovalModal();

  const modalEl = document.getElementById('jobfill-doc-modal-backdrop');
  if (!modalEl) return;
  modalEl.style.display = 'flex';

  const uploadBtn = document.getElementById('jobfill-doc-upload-btn') as HTMLButtonElement | null;
  if (uploadBtn) uploadBtn.disabled = true;

  const bodyEl = document.getElementById('jobfill-doc-modal-body');
  if (bodyEl) {
    bodyEl.innerHTML = `<div style="text-align:center;padding:28px 0;color:#475569;font-size:13px;">🔍 ওয়েবসাইটের শর্ত ও এনক্রিপ্টেড প্রোফাইল ডকুমেন্ট যাচাই হচ্ছে...</div>`;
  }

  try {
    await loadProfile();
    lastDocResults = [];
    currentDocPlan = await DocumentUploadCoordinator.buildApprovalPlan(document, fetchDocumentForActiveProfile);
    renderDocumentApprovalList();
  } finally {
    const refreshedBtn = document.getElementById('jobfill-doc-upload-btn') as HTMLButtonElement | null;
    if (refreshedBtn) {
      refreshedBtn.disabled = currentDocPlan.length === 0;
    }
  }
}

function formatRequirementSummary(item: DocumentApprovalItem): string {
  const req = item.websiteRequirements;
  const parts: string[] = [];
  if (req.acceptedExtensions.length > 0) parts.push(`Format: ${req.acceptedExtensions.join('/').toUpperCase()}`);
  if (req.requiredWidth && req.requiredHeight) parts.push(`Size: ${req.requiredWidth}×${req.requiredHeight} px`);
  if (req.maxSizeBytes) parts.push(`Max: ${Math.round(req.maxSizeBytes / 1024)} KB`);

  if (parts.length === 0) {
    return '⚠️ Website requirements not specified — please inspect form rules manually before approving.';
  }
  return parts.join(' • ');
}

let lastDocResults: DocumentUploadExecutionResult[] = [];

function getFileExtensionBadge(fileName: string, mimeType: string): string {
  const fromName = (fileName.split('.').pop() || '').trim().toUpperCase();
  if (fromName && fromName.length <= 5) return fromName;
  if (mimeType === 'application/pdf') return 'PDF';
  if (mimeType.includes('wordprocessingml') || mimeType === 'application/msword') return 'DOC';
  return 'FILE';
}

function renderDocumentApprovalList(results?: DocumentUploadExecutionResult[]) {
  if (results) lastDocResults = results;
  const activeResults = results || lastDocResults;
  const bodyEl = document.getElementById('jobfill-doc-modal-body');
  if (!bodyEl) return;

  if (currentDocPlan.length === 0) {
    bodyEl.innerHTML = `
      <div style="text-align:center;padding:24px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;color:#475569;">
        <div style="font-size:28px;margin-bottom:6px;">📂</div>
        <strong>এই পেজে কোনো ছবি বা স্বাক্ষর আপলোড ফিল্ড পাওয়া যায়নি।</strong>
      </div>
    `;
    return;
  }

  let html = `
    <div class="jobfill-doc-safety-banner">
      <span style="flex-shrink:0;">🛡️</span>
      <span><strong>নিরাপত্তা নিশ্চিতকরণ:</strong> আপনার মূল ছবি/স্বাক্ষর/ডকুমেন্ট এনক্রিপ্টেড অবস্থায় নিরাপদ থাকে এবং কেবল আপনার অনুমোদিত ফাইলগুলো এই আবেদন ফর্মের ফাইল ইনপুটে যুক্ত করা হবে।</span>
    </div>
  `;

  currentDocPlan.forEach((item, idx) => {
    const res = activeResults.find((r) => r.selector === item.field.selector);
    const activeCopy =
      item.useProcessedCopy && item.processedCopy
        ? item.processedCopy
        : item.savedOriginal
          ? {
              fileName: item.savedOriginal.metadata.fileName,
              width: item.savedOriginal.metadata.width,
              height: item.savedOriginal.metadata.height,
              fileSize: item.savedOriginal.metadata.fileSize,
              mimeType: item.savedOriginal.metadata.mimeType,
              dataUrl: item.savedOriginal.dataUrl,
              isProcessedCopy: false,
            }
          : null;

    const activeValidation = item.useProcessedCopy ? item.processedValidation : item.validation;
    let statusBadgeStyle = 'background:#e0f2fe;color:#0369a1;';
    let statusLabel: string = item.status;

    if (res) {
      statusLabel = res.status;
      if (res.status === 'Uploaded') statusBadgeStyle = 'background:#dcfce7;color:#15803d;';
      else if (res.status === 'Validation Failed' || res.status === 'Upload Failed')
        statusBadgeStyle = 'background:#fee2e2;color:#b91c1c;';
      else if (res.status === 'Manual Upload Required') statusBadgeStyle = 'background:#fef3c7;color:#b45309;';
      else statusBadgeStyle = 'background:#f1f5f9;color:#475569;';
    } else if (item.status === 'Validation Failed' || item.status === 'Missing Document') {
      statusBadgeStyle = 'background:#fee2e2;color:#b91c1c;';
    } else if (item.status === 'Manual Upload Required') {
      statusBadgeStyle = 'background:#fef3c7;color:#b45309;';
    }

    const dimsLabel =
      activeCopy && activeCopy.width > 0 && activeCopy.height > 0
        ? `${activeCopy.width}×${activeCopy.height} px • `
        : '';
    const isImageCopy = Boolean(activeCopy && activeCopy.mimeType.startsWith('image/'));
    const directAccept =
      item.field.accept ||
      item.websiteRequirements.acceptedMimeTypes.join(',') ||
      'image/jpeg,image/png,application/pdf,.doc,.docx';

    html += `
      <div class="jobfill-doc-card">
        <input type="checkbox" id="jobfill-doc-chk-${idx}" ${item.isApproved ? 'checked' : ''} ${
          !activeCopy ? 'disabled' : ''
        } style="width:17px;height:17px;margin-top:3px;accent-color:#0284c7;cursor:pointer;flex-shrink:0;" />

        <div class="jobfill-doc-preview">
          ${
            activeCopy
              ? isImageCopy
                ? `<img src="${activeCopy.dataUrl}" alt="${escapeHtml(item.title)}" style="max-width:100%;max-height:100%;object-fit:contain;" />`
                : `<div class="jobfill-doc-file-badge"><span style="font-size:22px;">📄</span><span>${escapeHtml(
                    getFileExtensionBadge(activeCopy.fileName, activeCopy.mimeType)
                  )}</span></div>`
              : `<span style="font-size:10px;color:#94a3b8;text-align:center;">No File</span>`
          }
        </div>

        <div class="jobfill-doc-meta">
          <div class="jobfill-doc-title-row">
            <strong style="color:#0f172a;font-size:12.5px;">${escapeHtml(item.title)} (${escapeHtml(item.documentType)})</strong>
            <span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:999px;${statusBadgeStyle}">${escapeHtml(statusLabel)}</span>
          </div>

          <div class="jobfill-doc-row" style="color:#475569;">
            <strong>Website Rules:</strong> ${escapeHtml(formatRequirementSummary(item))}
          </div>

          ${
            activeCopy
              ? `<div class="jobfill-doc-row" style="color:#0f172a;">
                   <strong>Selected File:</strong> ${escapeHtml(activeCopy.fileName)}
                   (${dimsLabel}${(activeCopy.fileSize / 1024).toFixed(1)} KB)
                   ${activeCopy.isProcessedCopy ? '<span style="color:#0284c7;font-weight:700;">[Processed Copy — Original Preserved]</span>' : ''}
                 </div>`
              : ''
          }

          ${
            activeValidation && !activeValidation.isValid
              ? `<div class="jobfill-doc-row" style="color:#b91c1c;font-size:10.5px;">⚠️ ${escapeHtml(activeValidation.errors.join(' '))}</div>`
              : ''
          }

          ${
            res
              ? `<div class="jobfill-doc-row" style="color:${res.status === 'Uploaded' ? '#15803d' : '#b91c1c'};font-weight:600;">
                   ${escapeHtml(res.message)}
                 </div>`
              : `<div class="jobfill-doc-row" style="font-size:10.5px;color:#64748b;">${escapeHtml(item.statusMessage)}</div>`
          }

          <div class="jobfill-doc-actions">
            ${
              item.documentType !== 'unknown'
                ? `<input type="file" id="jobfill-doc-pick-input-${idx}" accept="${escapeHtml(directAccept)}" style="display:none;" />
                   <button type="button" id="jobfill-doc-pick-btn-${idx}" class="jobfill-doc-btn" style="${
                     !activeCopy
                       ? 'background:#0284c7;color:#ffffff;border:1px solid #0369a1;padding:4px 10px;font-size:11px;font-weight:700;'
                       : 'background:#f8fafc;color:#334155;border:1px solid #cbd5e1;padding:3px 8px;font-size:10.5px;'
                   }">
                     ${!activeCopy ? '📁 Select &amp; Save to Profile' : '🔄 Change File'}
                   </button>`
                : ''
            }
            <input type="file" id="jobfill-doc-direct-input-${idx}" accept="${escapeHtml(directAccept)}" style="display:none;" />
            ${
              !res || res.status !== 'Uploaded'
                ? `<button type="button" id="jobfill-doc-direct-btn-${idx}" class="jobfill-doc-btn" style="background:#f0fdf4;color:#15803d;border:1px solid #86efac;padding:4px 10px;font-size:11px;font-weight:700;">
                     📎 Attach File Directly
                   </button>`
                : ''
            }
            ${
              !activeCopy
                ? `<button type="button" id="jobfill-doc-dash-${idx}" class="jobfill-doc-btn" style="background:#f1f5f9;color:#0f172a;border:1px solid #cbd5e1;padding:4px 10px;font-size:11px;">
                     ⚙️ Open Dashboard Documents
                   </button>`
                : ''
            }
            ${
              res && res.requiresManualFallback
                ? `<button type="button" id="jobfill-doc-manual-${idx}" class="jobfill-doc-btn" style="background:#fef3c7;color:#92400e;border:1px solid #fcd34d;padding:3px 9px;font-size:11px;font-weight:700;">
                     📂 Select File Manually
                   </button>
                   ${
                     activeCopy
                       ? `<button type="button" id="jobfill-doc-dl-${idx}" class="jobfill-doc-btn" style="background:#f1f5f9;color:#334155;border:1px solid #cbd5e1;padding:3px 9px;font-size:11px;">
                            💾 Download Prepared Copy
                          </button>`
                       : ''
                   }`
                : ''
            }
          </div>
        </div>
      </div>
    `;
  });

  bodyEl.innerHTML = html;

  currentDocPlan.forEach((item, idx) => {
    const chk = document.getElementById(`jobfill-doc-chk-${idx}`) as HTMLInputElement | null;
    chk?.addEventListener('change', () => {
      item.isApproved = chk.checked;
    });

    const pickBtn = document.getElementById(`jobfill-doc-pick-btn-${idx}`) as HTMLButtonElement | null;
    const pickInput = document.getElementById(`jobfill-doc-pick-input-${idx}`) as HTMLInputElement | null;
    pickBtn?.addEventListener('click', () => pickInput?.click());
    pickInput?.addEventListener('change', async () => {
      const file = pickInput.files?.[0];
      if (!file || item.documentType === 'unknown') return;
      const uploadBtn = document.getElementById('jobfill-doc-upload-btn') as HTMLButtonElement | null;
      if (pickBtn) {
        pickBtn.disabled = true;
        pickBtn.textContent = '⏳ Saving & Validating...';
      }
      if (uploadBtn) uploadBtn.disabled = true;
      try {
        await saveDocumentToActiveProfile(item.documentType, file);
        lastDocResults = [];
        currentDocPlan = await DocumentUploadCoordinator.buildApprovalPlan(document, fetchDocumentForActiveProfile);
        renderDocumentApprovalList();
        showToast(`✅ ${file.name} আপনার প্রোফাইলে সংরক্ষিত ও যাচাই হয়েছে — এখন [Upload Approved Documents] ক্লিক করুন।`);
      } catch (err: any) {
        showToast(`⚠️ সংরক্ষণ ব্যর্থ: ${err?.message || 'Vault unlock প্রয়োজন হতে পারে।'}`);
        renderDocumentApprovalList();
      } finally {
        const refreshedUploadBtn = document.getElementById('jobfill-doc-upload-btn') as HTMLButtonElement | null;
        if (refreshedUploadBtn) refreshedUploadBtn.disabled = false;
      }
    });

    const directBtn = document.getElementById(`jobfill-doc-direct-btn-${idx}`) as HTMLButtonElement | null;
    const directInput = document.getElementById(`jobfill-doc-direct-input-${idx}`) as HTMLInputElement | null;
    directBtn?.addEventListener('click', () => directInput?.click());
    directInput?.addEventListener('change', async () => {
      const file = directInput.files?.[0];
      if (!file) return;
      try {
        const payload = await readLocalDocumentFile(file);
        const directDocId = `direct_${Date.now()}_${idx}`;
        const directDocType: DocumentCategory = item.documentType === 'unknown' ? 'other' : item.documentType;
        const attachResult = await DocumentUploader.attachApprovedDocument(item.field, {
          documentId: directDocId,
          documentType: directDocType,
          selector: item.field.selector,
          fileName: payload.fileName,
          mimeType: payload.mimeType,
          fileSize: payload.fileSize,
          width: payload.width,
          height: payload.height,
          dataUrl: payload.dataUrl,
        });
        item.savedOriginal = {
          metadata: {
            documentId: directDocId,
            documentType: directDocType,
            profileId: currentProfile.id,
            title: item.title,
            fileName: payload.fileName,
            mimeType: payload.mimeType,
            fileSize: payload.fileSize,
            width: payload.width,
            height: payload.height,
            createdAt: new Date().toISOString(),
          },
          dataUrl: payload.dataUrl,
        };
        item.useProcessedCopy = false;
        item.isApproved = true;
        item.status = attachResult.status;
        item.statusMessage = attachResult.message;
        const filtered = lastDocResults.filter((r) => r.selector !== item.field.selector);
        filtered.push(attachResult);
        renderDocumentApprovalList(filtered);
        if (attachResult.status === 'Uploaded') {
          showToast(`✅ ${payload.fileName} ফর্ম ফিল্ডে যুক্ত হয়েছে!`);
        } else {
          showToast(`⚠️ ${attachResult.message}`);
        }
      } catch (err: any) {
        showToast(`⚠️ ফাইল যুক্ত করা যায়নি: ${err?.message || 'Error reading file'}`);
      }
    });

    const dashBtn = document.getElementById(`jobfill-doc-dash-${idx}`);
    dashBtn?.addEventListener('click', () => {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage && isExtensionRuntime()) {
        chrome.runtime.sendMessage({ action: 'openDashboard' });
      } else {
        window.open('dashboard.html', '_blank');
      }
    });

    const manualBtn = document.getElementById(`jobfill-doc-manual-${idx}`);
    manualBtn?.addEventListener('click', () => {
      item.field.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      item.field.element.click();
    });

    const dlBtn = document.getElementById(`jobfill-doc-dl-${idx}`);
    dlBtn?.addEventListener('click', () => {
      const copy =
        item.useProcessedCopy && item.processedCopy
          ? { url: item.processedCopy.dataUrl, name: item.processedCopy.fileName }
          : item.savedOriginal
            ? { url: item.savedOriginal.dataUrl, name: item.savedOriginal.metadata.fileName }
            : null;
      if (copy) {
        const a = document.createElement('a');
        a.href = copy.url;
        a.download = copy.name;
        a.click();
      }
    });
  });
}

async function executeApprovedDocumentUpload() {
  const uploadBtn = document.getElementById('jobfill-doc-upload-btn') as HTMLButtonElement | null;
  if (uploadBtn) {
    uploadBtn.disabled = true;
    uploadBtn.innerHTML = '<span>⏳</span><span>Uploading &amp; Verifying...</span>';
  }

  const results = await DocumentUploadCoordinator.executeApprovedUploads(currentDocPlan);
  renderDocumentApprovalList(results);

  if (uploadBtn) {
    uploadBtn.disabled = false;
    uploadBtn.innerHTML = '<span>📤</span><span>Upload Approved Documents</span>';
  }

  const uploadedCount = results.filter((r) => r.status === 'Uploaded').length;
  const manualCount = results.filter((r) => r.status === 'Manual Upload Required' || r.status === 'Validation Failed').length;

  if (uploadedCount > 0 && manualCount === 0) {
    showToast(`✅ ${uploadedCount}টি ডকুমেন্ট সফলভাবে ফর্মে যুক্ত ও যাচাই হয়েছে!`);
  } else if (manualCount > 0) {
    showToast(`⚠️ ${uploadedCount}টি যুক্ত হয়েছে, ${manualCount}টি ফিল্ডে ম্যানুয়াল যাচাই প্রয়োজন।`);
  }
}

// Listen for messages from background/popup (guarded against excluded sites and duplicate injection)
if (
  typeof window !== 'undefined' &&
  !isExcludedSiteUrl(window.location?.href) &&
  typeof chrome !== 'undefined' &&
  chrome.runtime &&
  chrome.runtime.onMessage &&
  !(window as any).__jobfillMsgListenerRegistered
) {
  (window as any).__jobfillMsgListenerRegistered = true;
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    (async () => {
      try {
        if (isExcludedSiteUrl(window.location?.href)) {
          sendResponse({ status: 'excluded' });
          return;
        }
        if (message.action === 'VAULT_LOCKED') {
          isVaultLocked = true;
          currentProfile = createEmptyProfile('Vault Locked');
          currentScanResult = null;
          currentDocPlan = [];
          closeReviewModal();
          closeDocumentApprovalModal();
          sendResponse({ status: 'ok', locked: true });
          return;
        }
        if (message.action === 'SHOW_FLOATING_TOOLBAR') {
          await persistTabToolbarDismissedState(false);
          await ensureAssistantUiInitialized(true, true);
          sendResponse({
            status: 'ok',
            toolbarDismissed: isToolbarDismissed,
            toolbarVisible: Boolean(document.getElementById('jobfill-floating-trigger')),
          });
          return;
        }
        if (message.action === 'HIDE_FLOATING_TOOLBAR') {
          await dismissFloatingToolbar();
          sendResponse({
            status: 'ok',
            toolbarDismissed: true,
            toolbarVisible: false,
          });
          return;
        }
        if (message.action === 'DETECT_FORM' || message.action === 'checkTabStatus') {
          await loadProfile();
          await loadSettings();
          const scan = await UniversalPageScanner.scanPage(currentProfile, document);
          const formInfo = FormDetector.analyze(document);
          const docFields = DocumentFieldDetector.scanDocumentFields(document);
          const hasForm = formInfo.hasJobForm || scan.planItems.length > 0 || docFields.length > 0;
          if (hasForm) {
            await ensureAssistantUiInitialized(true);
          } else {
            isToolbarDismissed = await syncTabToolbarDismissedState();
          }
          sendResponse({
            status: 'ok',
            isVaultLocked,
            toolbarDismissed: isToolbarDismissed,
            toolbarVisible: Boolean(document.getElementById('jobfill-floating-trigger')),
            hasJobForm: hasForm,
            organization: scan.organization,
            platform: scan.platform,
            pageTitle: document.title || 'Government Job Form',
            totalDetected: scan.totalFieldsCount,
            matchedCount: scan.matchedCount,
            readyToFillCount: scan.readyToFillCount,
            alreadyCorrectCount: scan.alreadyCorrectCount,
            missingInfoCount: scan.missingInfoCount,
            ambiguousCount: scan.ambiguousCount,
            conflictsCount: scan.conflictsCount,
            confirmationRequiredCount: scan.confirmationRequiredCount || 0,
            documentFieldCount: docFields.length,
            documentFieldsSummary: docFields.map((df) => ({
              id: df.id,
              documentType: df.documentType,
              label: df.label,
              selector: df.selector,
            })),
            autofillMode: activeAutofillMode,
            totalMatchable: scan.readyToFillCount,
            needsReview:
              (scan.confirmationRequiredCount || 0) +
              scan.missingInfoCount +
              scan.ambiguousCount +
              scan.conflictsCount,
            activeProfileName: currentProfile.personal.applicantNameEn || currentProfile.profileName,
            planSummary: scan.planItems.map((p) => ({
              label: p.fieldLabel,
              value: p.proposedValue,
              status: p.status,
              approved: p.isApproved,
              hasConflict: p.hasConflict,
            })),
          });
        } else if (message.action === 'DETECT_DOCUMENT_FIELDS') {
          const docFields = DocumentFieldDetector.scanDocumentFields(document);
          sendResponse({
            status: 'ok',
            fields: docFields.map((df) => ({
              id: df.id,
              selector: df.selector,
              documentType: df.documentType,
              label: df.label,
              requirements: df.requirements,
              isAmbiguous: df.isAmbiguous,
            })),
          });
        } else if (message.action === 'OPEN_DOCUMENT_APPROVAL') {
          await ensureAssistantUiInitialized(true);
          await openDocumentApprovalModal();
          sendResponse({ status: 'opened' });
        } else if (message.action === 'AUTO_FILL_NOW' || message.action === 'EXECUTE_AUTO_FILL') {
          await ensureAssistantUiInitialized(true);
          await loadProfile();
          if (isVaultLocked) {
            showToast('🔒 ভল্ট লক করা আছে! প্রোফাইল ব্যবহার করতে ড্যাশবোর্ড থেকে আনলক করুন।');
            sendResponse({ status: 'error', error: 'VAULT_LOCKED: Unlock JobFill BD Dashboard first.' });
            return;
          }
          showToast('🔍 ফর্ম স্ক্যান ও তথ্য পূরণ হচ্ছে...');
          const summary = await executeTwoPassAutofill();
          const detectedDocs = DocumentFieldDetector.scanDocumentFields(document);

          if (!summary) {
            showToast('⚠️ কোনো আবেদন ফর্ম ফিল্ড শনাক্ত করা যায়নি।');
            sendResponse({
              status: 'ok',
              documentFieldCount: detectedDocs.length,
              report: {
                successfullyFilled: 0,
                alreadyCorrect: 0,
                missingInfo: 0,
                ambiguous: 0,
                conflicts: 0,
                confirmationRequired: 0,
                failed: 0,
                completenessReport: [],
              },
            });
          } else {
            await recordAutofillHistoryEntry(summary);
            const attentionPending = summary.confirmationRequired + summary.missingInfo + summary.totalFailed;
            if (detectedDocs.length > 0 && attentionPending > 0) {
              showToast(`✅ ${summary.totalFilled}টি ফিল্ড পূরণ হয়েছে! ⚠️ ${attentionPending}টি ফিল্ড নিশ্চিত করতে [Review] এবং ছবি আপলোডের জন্য [📷 Photo & Sig] দেখুন।`);
            } else if (detectedDocs.length > 0) {
              showToast(`✅ ${summary.totalFilled}টি ফিল্ড পূরণ হয়েছে! 📷 ছবি ও স্বাক্ষর অনুমোদন করে আপলোড করুন।`);
            } else if (attentionPending > 0) {
              showToast(`✅ ${summary.totalFilled}টি ফিল্ড পূরণ হয়েছে! ⚠️ ${attentionPending}টি ফিল্ড নিশ্চিত করতে [Review] দেখুন।`);
            } else {
              showToast(`✅ ${summary.totalFilled}টি ফিল্ড সফলভাবে স্বয়ংক্রিয় পূরণ হয়েছে!`);
            }

            sendResponse({
              status: 'ok',
              documentFieldCount: detectedDocs.length,
              report: {
                successfullyFilled: summary.totalFilled,
                alreadyCorrect: summary.alreadyCorrect,
                missingInfo: summary.missingInfo,
                ambiguous: summary.ambiguous,
                conflicts: summary.conflicts,
                confirmationRequired: summary.confirmationRequired,
                failed: summary.totalFailed,
                completenessReport: summary.completenessReport,
              },
            });
          }
        } else if (message.action === 'UNDO_LAST_FILL') {
          const { restoredCount, preservedCount } = VerificationEngine.undoLastFill(activeSessionId);
          showToast(
            preservedCount > 0
              ? `↩️ ${restoredCount}টি ফিল্ড আগের অবস্থায় ফিরেছে (${preservedCount}টি ম্যানুয়াল পরিবর্তন সংরক্ষিত)।`
              : `↩️ ${restoredCount}টি ফিল্ড আগের অবস্থায় ফিরিয়ে আনা হয়েছে।`
          );
          sendResponse({ status: 'ok', restoredCount, preservedCount });
        } else if (message.action === 'OPEN_REVIEW_MODAL' || message.action === 'scanAndFill') {
          await ensureAssistantUiInitialized(true);
          openReviewModal();
          sendResponse({ status: 'opened' });
        } else if (message.action === 'EXTRACT_OPEN_PORTAL_NOTICES') {
          const host = (window.location?.hostname || '').toLowerCase();
          if (host !== 'bb.org.bd' && !host.endsWith('.bb.org.bd')) {
            sendResponse({ status: 'unsupported_origin', url: window.location?.href });
            return;
          }
          const rawHtml = document.documentElement?.outerHTML || '';
          const check = detectAccessRestrictionWithReason(rawHtml, 200);
          if (check.blockedByCaptcha || check.blockedReason) {
            sendResponse({
              status: 'captcha_present',
              reason: check.blockedReason,
              url: window.location?.href,
            });
            return;
          }
          sendResponse({
            status: 'ok',
            url: window.location?.href,
            html: document.body?.innerHTML || rawHtml,
          });
        } else {
          sendResponse({ status: 'unknown_action' });
        }
      } catch (err: any) {
        console.error('JobFill BD content script error:', err);
        sendResponse({ status: 'error', error: err.message });
      }
    })();
    return true; // Keep message channel open for async response
  });
}

// Start assistant only on non-excluded pages
if (typeof window === 'undefined' || !isExcludedSiteUrl(window.location?.href)) {
  void initAssistant();
} else if (typeof window !== 'undefined') {
  recordExtensionDiagnostic('excluded_site_detected', {
    url: window.location?.href,
    source: 'content.bootstrap',
  });
  recordExtensionDiagnostic('script_injection_blocked', {
    url: window.location?.href,
    source: 'content.bootstrap',
  });
}
