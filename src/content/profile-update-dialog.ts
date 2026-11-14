// JobFill BD - In-Page Smart Profile Update Notification & Review Dialog
// Provides a non-intrusive alert pill and a comprehensive modal for reviewing
// detected form changes before saving them to the user's permanent profile.
// Features:
// - Checkboxes to select/deselect individual fields.
// - Categorized grouping (Personal, Address, Education, Experience).
// - Shows Old Value -> New Value with clear visual diff badges (New vs Changed).
// - Responsive, accessible, and supports Bengali & English localization.

import { DetectedProfileDiffItem } from '../services/profile-diff-engine';

export interface ProfileUpdateDialogOptions {
  diffs: DetectedProfileDiffItem[];
  lang?: 'bn' | 'en';
  onApprove: (selectedDiffs: DetectedProfileDiffItem[]) => Promise<void>;
  onDismiss: () => void;
  onUndoLast?: () => Promise<void>;
}

const PILL_ID = 'jobfill-profile-update-pill';
const MODAL_ID = 'jobfill-profile-update-modal';

/**
 * Injects or updates a discreet floating action pill when profile changes are detected.
 */
export function showProfileUpdatePill(
  diffCount: number,
  onReviewClick: () => void,
  onDismissClick: () => void,
  lang: 'bn' | 'en' = 'bn'
): void {
  let pill = document.getElementById(PILL_ID);
  if (!pill) {
    pill = document.createElement('div');
    pill.id = PILL_ID;
    pill.setAttribute('data-jobfill-ext', 'true');
    pill.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 2147483645;
      background: linear-gradient(135deg, #0f172a, #1e293b);
      color: #f8fafc;
      border: 1px solid #0284c7;
      border-radius: 9999px;
      padding: 8px 16px;
      display: flex;
      align-items: center;
      gap: 12px;
      box-shadow: 0 12px 32px rgba(2, 132, 199, 0.25), 0 4px 12px rgba(0,0,0,0.4);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
      cursor: pointer;
      animation: jobfillSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    `;
    document.body.appendChild(pill);
  }

  const bn = lang === 'bn';
  const textMsg = bn
    ? `✨ <strong>${diffCount}</strong> টি নতুন/পরিবর্তিত তথ্য পাওয়া গেছে`
    : `✨ Detected <strong>${diffCount}</strong> profile update${diffCount > 1 ? 's' : ''}`;
  const btnText = bn ? 'প্রোফাইল আপডেট করুন' : 'Review & Update';
  const dismissText = bn ? '✕' : '✕';

  pill.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;">
      <span style="font-size:16px;">📝</span>
      <span style="color:#e2e8f0;">${textMsg}</span>
    </div>
    <div style="display:flex;align-items:center;gap:6px;">
      <button id="jobfill-pill-review-btn" type="button" style="
        background: linear-gradient(135deg, #0284c7, #0369a1);
        color: #ffffff;
        border: none;
        padding: 6px 14px;
        border-radius: 9999px;
        font-weight: 700;
        font-size: 12px;
        cursor: pointer;
        box-shadow: 0 2px 6px rgba(2,132,199,0.3);
      ">${btnText}</button>
      <button id="jobfill-pill-dismiss-btn" type="button" title="${bn ? 'বাদ দিন' : 'Dismiss'}" style="
        background: none;
        border: none;
        color: #94a3b8;
        font-size: 14px;
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 9999px;
      ">${dismissText}</button>
    </div>
  `;

  document.getElementById('jobfill-pill-review-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    onReviewClick();
  });

  document.getElementById('jobfill-pill-dismiss-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    pill?.remove();
    onDismissClick();
  });
}

/**
 * Removes the floating pill if no diffs remain.
 */
export function removeProfileUpdatePill(): void {
  const pill = document.getElementById(PILL_ID);
  if (pill) pill.remove();
}

/**
 * Opens a modal allowing the user to inspect, select, and approve detected profile changes.
 */
export function showProfileUpdateReviewModal(options: ProfileUpdateDialogOptions): void {
  const existing = document.getElementById(MODAL_ID);
  if (existing) existing.remove();

  const bn = options.lang === 'bn';
  const diffs = options.diffs.map((d) => ({ ...d })); // Clone state

  const backdrop = document.createElement('div');
  backdrop.id = MODAL_ID;
  backdrop.setAttribute('data-jobfill-ext', 'true');
  backdrop.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(15, 23, 42, 0.75);
    backdrop-filter: blur(4px);
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
    max-width: 580px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 24px 60px rgba(0,0,0,0.55);
    overflow: hidden;
  `;

  // Render modal content
  const renderList = () => {
    return diffs
      .map((item, idx) => {
        const isNew = item.diffType === 'NEW';
        const badgeColor = isNew
          ? 'background:#064e3b;color:#34d399;border:1px solid #059669;'
          : 'background:#78350f;color:#fbbf24;border:1px solid #d97706;';
        const badgeText = isNew ? (bn ? 'নতুন তথ্য' : 'NEW') : bn ? 'পরিবর্তিত' : 'CHANGED';
        const label = bn ? item.fieldLabelBn || item.fieldLabel : item.fieldLabel;
        const destLabel = bn ? item.destinationLabelBn : item.destinationLabel;

        const oldDisplay = item.oldValue
          ? `<span style="text-decoration:line-through;color:#94a3b8;font-size:11.5px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(item.oldValue)}</span>`
          : `<span style="color:#64748b;font-style:italic;font-size:11px;">${bn ? '(খালি)' : '(empty)'}</span>`;

        const newDisplay = `<span style="font-weight:700;color:#38bdf8;font-size:12.5px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(item.newValue)}</span>`;

        return `
          <div style="display:flex;align-items:flex-start;gap:12px;padding:12px;background:#1e293b;border-radius:10px;margin-bottom:8px;border:1px solid ${item.selected ? '#0284c7' : '#334155'};transition:border-color 0.2s;">
            <input type="checkbox" id="diff-check-${idx}" data-idx="${idx}" ${item.selected ? 'checked' : ''} style="margin-top:4px;cursor:pointer;accent-color:#0284c7;width:16px;height:16px;" />
            <div style="flex:1;min-width:0;">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
                <label for="diff-check-${idx}" style="font-weight:600;font-size:13px;color:#f1f5f9;cursor:pointer;">${escapeHtml(label)}</label>
                <div style="display:flex;align-items:center;gap:6px;">
                  <span style="font-size:10px;padding:2px 6px;border-radius:6px;font-weight:700;${badgeColor}">${badgeText}</span>
                  <span style="font-size:10.5px;color:#94a3b8;background:#0f172a;padding:2px 6px;border-radius:6px;border:1px solid #334155;">${escapeHtml(destLabel)}</span>
                </div>
              </div>
              <div style="display:flex;align-items:center;gap:8px;font-size:12px;background:#0f172a;padding:6px 10px;border-radius:6px;border:1px solid #334155;">
                <span style="color:#64748b;font-size:11px;">${bn ? 'পূর্বে:' : 'Old:'}</span>
                ${oldDisplay}
                <span style="color:#64748b;">➔</span>
                <span style="color:#64748b;font-size:11px;">${bn ? 'নতুন:' : 'New:'}</span>
                ${newDisplay}
              </div>
            </div>
          </div>
        `;
      })
      .join('');
  };

  modalBox.innerHTML = `
    <!-- Header -->
    <div style="padding:16px 20px;border-bottom:1px solid #334155;display:flex;align-items:center;justify-content:space-between;">
      <div style="display:flex;align-items:center;gap:10px;">
        <span style="font-size:20px;">📝</span>
        <div>
          <h2 style="margin:0;font-size:16px;font-weight:700;color:#f8fafc;">
            ${bn ? 'প্রোফাইল তথ্য পর্যালোচনা ও আপডেট' : 'Review & Update Profile Information'}
          </h2>
          <p style="margin:2px 0 0;font-size:11.5px;color:#94a3b8;">
            ${bn ? 'এই ফর্মে দেওয়া নতুন বা পরিবর্তিত তথ্যসমূহ আপনার প্রোফাইলে সংরক্ষণ করুন।' : 'Select the detected changes you wish to save to your JobFill BD Profile.'}
          </p>
        </div>
      </div>
      <button id="jobfill-modal-close-btn" type="button" style="background:none;border:none;color:#94a3b8;font-size:18px;cursor:pointer;">✕</button>
    </div>

    <!-- Selection Bar -->
    <div style="padding:8px 20px;background:#1e293b/60;border-bottom:1px solid #334155;display:flex;align-items:center;justify-content:space-between;font-size:12px;">
      <div style="display:flex;gap:12px;">
        <button id="jobfill-select-all-btn" type="button" style="background:none;border:none;color:#38bdf8;font-weight:600;cursor:pointer;padding:0;">${bn ? 'সব নির্বাচন করুন' : 'Select All'}</button>
        <span style="color:#475569;">|</span>
        <button id="jobfill-deselect-all-btn" type="button" style="background:none;border:none;color:#94a3b8;font-weight:600;cursor:pointer;padding:0;">${bn ? 'সব বাতিল করুন' : 'Deselect All'}</button>
      </div>
      <span id="jobfill-selected-count" style="color:#94a3b8;">${bn ? 'নির্বাচিত: ' : 'Selected: '} <strong style="color:#38bdf8;">${diffs.filter((d) => d.selected).length}</strong></span>
    </div>

    <!-- Body / List -->
    <div id="jobfill-diffs-container" style="padding:16px 20px;overflow-y:auto;flex:1;">
      ${renderList()}
    </div>

    <!-- Footer -->
    <div style="padding:14px 20px;border-top:1px solid #334155;display:flex;align-items:center;justify-content:space-between;background:#0f172a;">
      <button id="jobfill-modal-cancel-btn" type="button" style="
        background:#334155;
        color:#e2e8f0;
        border:none;
        padding:8px 16px;
        border-radius:8px;
        font-weight:600;
        cursor:pointer;
        font-size:12.5px;
      ">${bn ? 'বাতিল' : 'Cancel'}</button>

      <button id="jobfill-modal-update-btn" type="button" style="
        background:linear-gradient(135deg, #0284c7, #0369a1);
        color:#ffffff;
        border:none;
        padding:8px 20px;
        border-radius:8px;
        font-weight:700;
        cursor:pointer;
        font-size:13px;
        box-shadow:0 4px 14px rgba(2,132,199,0.4);
      ">${bn ? 'নির্বাচিত তথ্য আপডেট করুন' : 'Update Selected Profile'}</button>
    </div>
  `;

  backdrop.appendChild(modalBox);
  document.body.appendChild(backdrop);

  // Update check status handlers
  const attachCheckListeners = () => {
    diffs.forEach((_, idx) => {
      const chk = document.getElementById(`diff-check-${idx}`) as HTMLInputElement | null;
      chk?.addEventListener('change', () => {
        diffs[idx].selected = chk.checked;
        const cntEl = document.getElementById('jobfill-selected-count');
        if (cntEl) {
          const count = diffs.filter((d) => d.selected).length;
          cntEl.innerHTML = `${bn ? 'নির্বাচিত: ' : 'Selected: '} <strong style="color:#38bdf8;">${count}</strong>`;
        }
      });
    });
  };
  attachCheckListeners();

  // Select all / Deselect all
  document.getElementById('jobfill-select-all-btn')?.addEventListener('click', () => {
    diffs.forEach((d, idx) => {
      d.selected = true;
      const chk = document.getElementById(`diff-check-${idx}`) as HTMLInputElement | null;
      if (chk) chk.checked = true;
    });
    const cntEl = document.getElementById('jobfill-selected-count');
    if (cntEl) {
      cntEl.innerHTML = `${bn ? 'নির্বাচিত: ' : 'Selected: '} <strong style="color:#38bdf8;">${diffs.length}</strong>`;
    }
  });

  document.getElementById('jobfill-deselect-all-btn')?.addEventListener('click', () => {
    diffs.forEach((d, idx) => {
      d.selected = false;
      const chk = document.getElementById(`diff-check-${idx}`) as HTMLInputElement | null;
      if (chk) chk.checked = false;
    });
    const cntEl = document.getElementById('jobfill-selected-count');
    if (cntEl) {
      cntEl.innerHTML = `${bn ? 'নির্বাচিত: ' : 'Selected: '} <strong style="color:#38bdf8;">0</strong>`;
    }
  });

  // Close / Cancel
  const closeModal = () => {
    backdrop.remove();
    options.onDismiss();
  };
  document.getElementById('jobfill-modal-close-btn')?.addEventListener('click', closeModal);
  document.getElementById('jobfill-modal-cancel-btn')?.addEventListener('click', closeModal);

  // Approve & Update
  document.getElementById('jobfill-modal-update-btn')?.addEventListener('click', async () => {
    const selected = diffs.filter((d) => d.selected);
    if (!selected.length) {
      alert(bn ? 'অনুগ্রহ করে অন্তত একটি তথ্য নির্বাচন করুন।' : 'Please select at least one field to update.');
      return;
    }

    const btn = document.getElementById('jobfill-modal-update-btn') as HTMLButtonElement | null;
    if (btn) {
      btn.disabled = true;
      btn.textContent = bn ? 'সংরক্ষণ করা হচ্ছে...' : 'Saving...';
    }

    try {
      await options.onApprove(selected);
      backdrop.remove();
      removeProfileUpdatePill();
    } catch (err: any) {
      if (btn) {
        btn.disabled = false;
        btn.textContent = bn ? 'নির্বাচিত তথ্য আপডেট করুন' : 'Update Selected Profile';
      }
      alert(bn ? `আপডেট ব্যর্থ হয়েছে: ${err?.message || 'Unknown error'}` : `Update failed: ${err?.message || 'Unknown error'}`);
    }
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
