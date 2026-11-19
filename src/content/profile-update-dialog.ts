// JobFill BD - In-Page Smart Profile Update Notification & Categorized Review Modal
// Features:
// - Discreet, non-intrusive floating alert pill with distinct counters for new vs modified fields.
// - Categorized review modal with tabs (All, Personal, Family, Address, Education, Experience, Custom, Tracker).
// - Allows user to edit the proposed new values before committing to profile.
// - Allows user to select/deselect individual fields or entire categories.
// - For custom fields: indicates that the field will be permanently learned and reused in future forms.
// - Strict localization in Bengali and English.

import { DetectedProfileDiffItem, ProfileDestination } from '../services/profile-diff-engine';

export interface ProfileUpdateDialogOptions {
  diffs: DetectedProfileDiffItem[];
  lang?: 'bn' | 'en';
  onApprove: (selectedDiffs: DetectedProfileDiffItem[]) => Promise<void>;
  onDismiss: () => void;
  onUndoLast?: () => Promise<void>;
}

export interface PillOptions {
  newCount?: number;
  changeCount?: number;
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
  lang: 'bn' | 'en' = 'bn',
  options?: PillOptions
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
  let textMsg = '';
  if (options && options.newCount !== undefined && options.changeCount !== undefined) {
    if (options.newCount > 0 && options.changeCount > 0) {
      textMsg = bn
        ? `✨ <strong>${options.newCount}</strong> টি নতুন ও <strong>${options.changeCount}</strong> টি পরিবর্তিত তথ্য পাওয়া গেছে`
        : `✨ Detected <strong>${options.newCount}</strong> new and <strong>${options.changeCount}</strong> modified field(s)`;
    } else if (options.newCount > 0) {
      textMsg = bn
        ? `✨ <strong>${options.newCount}</strong> টি নতুন তথ্য পাওয়া গেছে`
        : `✨ Detected <strong>${options.newCount}</strong> new field(s)`;
    } else {
      textMsg = bn
        ? `✨ <strong>${options.changeCount}</strong> টি পরিবর্তিত তথ্য পাওয়া গেছে`
        : `✨ Detected <strong>${options.changeCount}</strong> updated field(s)`;
    }
  } else {
    textMsg = bn
      ? `✨ <strong>${diffCount}</strong> টি নতুন/পরিবর্তিত তথ্য পাওয়া গেছে`
      : `✨ Detected <strong>${diffCount}</strong> profile update${diffCount > 1 ? 's' : ''}`;
  }

  const btnText = bn ? 'প্রোফাইল আপডেট করুন' : 'Review & Update';
  const dismissText = '✕';

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
 * Opens a rich categorized modal allowing the user to inspect, edit, and approve detected changes.
 */
export function showProfileUpdateReviewModal(options: ProfileUpdateDialogOptions): void {
  const existing = document.getElementById(MODAL_ID);
  if (existing) existing.remove();

  const bn = options.lang === 'bn';
  const diffs = options.diffs.map((d) => ({ ...d })); // Clone local state
  let currentCategoryFilter: 'all' | ProfileDestination = 'all';

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
    max-width: 640px;
    max-height: 88vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 24px 60px rgba(0,0,0,0.55);
    overflow: hidden;
  `;

  // Categories available in the current diff set
  const categoriesPresent = Array.from(new Set(diffs.map((d) => d.destination)));

  const getCategoryLabel = (cat: 'all' | ProfileDestination): string => {
    switch (cat) {
      case 'all':
        return bn ? 'সকল তথ্য' : 'All';
      case 'personal':
        return bn ? 'ব্যক্তিগত' : 'Personal';
      case 'family':
        return bn ? 'পারিবারিক' : 'Family';
      case 'address':
        return bn ? 'ঠিকানা' : 'Address';
      case 'education':
        return bn ? 'শিক্ষাগত' : 'Education';
      case 'experience':
        return bn ? 'অভিজ্ঞতা' : 'Experience';
      case 'skills':
        return bn ? 'দক্ষতা' : 'Skills';
      case 'custom':
        return bn ? 'কাস্টম তথ্য' : 'Custom';
      case 'tracker':
        return bn ? 'আবেদন ট্র্যাকার' : 'Tracker';
      case 'vault':
        return bn ? 'ভল্ট' : 'Vault';
      default:
        return cat;
    }
  };

  const renderTabs = () => {
    const tabs: Array<'all' | ProfileDestination> = ['all', ...categoriesPresent];
    return tabs
      .map((cat) => {
        const count = cat === 'all' ? diffs.length : diffs.filter((d) => d.destination === cat).length;
        const isActive = currentCategoryFilter === cat;
        const activeStyle = isActive
          ? 'background:#0284c7;color:#ffffff;font-weight:700;'
          : 'background:#1e293b;color:#94a3b8;font-weight:500;';
        return `
          <button type="button" class="jobfill-cat-tab" data-cat="${cat}" style="
            border:none;
            padding:6px 12px;
            border-radius:20px;
            font-size:12px;
            cursor:pointer;
            white-space:nowrap;
            display:flex;
            align-items:center;
            gap:6px;
            ${activeStyle}
          ">
            <span>${getCategoryLabel(cat)}</span>
            <span style="background:rgba(0,0,0,0.25);border-radius:10px;padding:1px 6px;font-size:11px;">${count}</span>
          </button>
        `;
      })
      .join('');
  };

  const renderList = () => {
    const filtered = diffs.filter(
      (item) => currentCategoryFilter === 'all' || item.destination === currentCategoryFilter
    );

    if (filtered.length === 0) {
      return `
        <div style="text-align:center;padding:36px 20px;color:#94a3b8;font-size:13px;">
          ${bn ? 'এই ক্যাটাগরিতে কোনো পরিবর্তন পাওয়া যায়নি।' : 'No profile changes found in this category.'}
        </div>
      `;
    }

    return filtered
      .map((item) => {
        const originalIndex = diffs.indexOf(item);
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

        const isCustomNotice = item.isCustomField
          ? `<div style="font-size:11px;color:#38bdf8;margin-top:6px;display:flex;align-items:center;gap:4px;">
               <span>💡</span>
               <span>${bn ? 'এই তথ্যটি স্থায়ীভাবে প্রোফাইলে সংরক্ষিত হবে এবং ভবিষ্যতে স্বয়ংক্রিয়ভাবে ফর্ম পূরণে ব্যবহৃত হবে।' : 'This custom field will be saved and automatically reused in future job forms.'}</span>
             </div>`
          : '';

        return `
          <div style="display:flex;align-items:flex-start;gap:12px;padding:12px;background:#1e293b;border-radius:10px;margin-bottom:8px;border:1px solid ${item.selected ? '#0284c7' : '#334155'};transition:border-color 0.2s;">
            <input type="checkbox" id="diff-check-${originalIndex}" data-idx="${originalIndex}" ${item.selected ? 'checked' : ''} style="margin-top:4px;cursor:pointer;accent-color:#0284c7;width:16px;height:16px;" />
            <div style="flex:1;min-width:0;">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
                <label for="diff-check-${originalIndex}" style="font-weight:600;font-size:13px;color:#f1f5f9;cursor:pointer;">${escapeHtml(label)}</label>
                <div style="display:flex;align-items:center;gap:6px;">
                  <span style="font-size:10px;padding:2px 6px;border-radius:6px;font-weight:700;${badgeColor}">${badgeText}</span>
                  <span style="font-size:10.5px;color:#94a3b8;background:#0f172a;padding:2px 6px;border-radius:6px;border:1px solid #334155;">${escapeHtml(destLabel)}</span>
                </div>
              </div>
              <div style="display:flex;flex-direction:column;gap:6px;font-size:12px;background:#0f172a;padding:8px 10px;border-radius:6px;border:1px solid #334155;">
                <div style="display:flex;align-items:center;gap:8px;">
                  <span style="color:#64748b;font-size:11px;min-width:35px;">${bn ? 'পূর্বে:' : 'Old:'}</span>
                  ${oldDisplay}
                </div>
                <div style="display:flex;align-items:center;gap:8px;">
                  <span style="color:#38bdf8;font-size:11px;min-width:35px;font-weight:600;">${bn ? 'নতুন:' : 'New:'}</span>
                  <input type="text" id="diff-val-input-${originalIndex}" data-idx="${originalIndex}" value="${escapeHtml(item.newValue)}" style="
                    flex:1;
                    background:#1e293b;
                    color:#38bdf8;
                    border:1px solid #475569;
                    border-radius:4px;
                    padding:4px 8px;
                    font-size:12px;
                    font-weight:600;
                  " />
                </div>
              </div>
              ${isCustomNotice}
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
        <span style="font-size:22px;">📝</span>
        <div>
          <h2 style="margin:0;font-size:16px;font-weight:700;color:#f8fafc;">
            ${bn ? 'প্রোফাইল তথ্য পর্যালোচনা ও আপডেট' : 'Review & Update Profile Information'}
          </h2>
          <p style="margin:2px 0 0;font-size:11.5px;color:#94a3b8;">
            ${bn ? 'এই ফর্মে দেওয়া নতুন বা পরিবর্তিত তথ্যসমূহ যাচাই করে আপনার প্রোফাইলে সংরক্ষণ করুন।' : 'Review and select detected changes to save into your permanent JobFill BD Profile.'}
          </p>
        </div>
      </div>
      <button id="jobfill-modal-close-btn" type="button" style="background:none;border:none;color:#94a3b8;font-size:18px;cursor:pointer;">✕</button>
    </div>

    <!-- Category Filter Tabs -->
    <div id="jobfill-tabs-bar" style="padding:8px 20px;background:#090d16;border-bottom:1px solid #334155;display:flex;gap:8px;overflow-x:auto;">
      ${renderTabs()}
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

  // Wire up change listener for list inputs
  const attachBodyListeners = () => {
    diffs.forEach((_, idx) => {
      const chk = document.getElementById(`diff-check-${idx}`) as HTMLInputElement | null;
      chk?.addEventListener('change', () => {
        diffs[idx].selected = chk.checked;
        updateSelectedCounter();
      });

      const valInput = document.getElementById(`diff-val-input-${idx}`) as HTMLInputElement | null;
      valInput?.addEventListener('input', () => {
        diffs[idx].newValue = valInput.value.trim();
      });
    });
  };

  const updateSelectedCounter = () => {
    const cntEl = document.getElementById('jobfill-selected-count');
    if (cntEl) {
      const count = diffs.filter((d) => d.selected).length;
      cntEl.innerHTML = `${bn ? 'নির্বাচিত: ' : 'Selected: '} <strong style="color:#38bdf8;">${count}</strong>`;
    }
  };

  const refreshList = () => {
    const container = document.getElementById('jobfill-diffs-container');
    if (container) {
      container.innerHTML = renderList();
      attachBodyListeners();
    }
    const tabsBar = document.getElementById('jobfill-tabs-bar');
    if (tabsBar) {
      tabsBar.innerHTML = renderTabs();
      attachTabListeners();
    }
  };

  const attachTabListeners = () => {
    const tabBtns = modalBox.querySelectorAll<HTMLButtonElement>('.jobfill-cat-tab');
    tabBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const cat = btn.getAttribute('data-cat') as 'all' | ProfileDestination;
        currentCategoryFilter = cat;
        refreshList();
      });
    });
  };

  attachBodyListeners();
  attachTabListeners();

  // Select all / Deselect all
  document.getElementById('jobfill-select-all-btn')?.addEventListener('click', () => {
    diffs.forEach((d, idx) => {
      if (currentCategoryFilter === 'all' || d.destination === currentCategoryFilter) {
        d.selected = true;
        const chk = document.getElementById(`diff-check-${idx}`) as HTMLInputElement | null;
        if (chk) chk.checked = true;
      }
    });
    updateSelectedCounter();
  });

  document.getElementById('jobfill-deselect-all-btn')?.addEventListener('click', () => {
    diffs.forEach((d, idx) => {
      if (currentCategoryFilter === 'all' || d.destination === currentCategoryFilter) {
        d.selected = false;
        const chk = document.getElementById(`diff-check-${idx}`) as HTMLInputElement | null;
        if (chk) chk.checked = false;
      }
    });
    updateSelectedCounter();
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
