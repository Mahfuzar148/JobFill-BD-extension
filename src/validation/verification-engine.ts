// JobFill BD - Post-Fill Verification, Conflict Detection & Undo Manager
// Direct Execution & Verification Engine adhering to the simplified autofill architecture:
// Pre-fill validation, native reactive input setting (React/Vue/Angular/HTML),
// post-fill DOM verification, conflict protection, and non-destructive undo.

import { FieldStatus, DiagnosticFieldStatus, FieldCompletenessEntry } from '../types/field-status';
import { OptionMatcher } from '../intelligence/option-matcher';
import { ValueNormalizer } from '../intelligence/value-normalizer';
import { ControlHandlerRouter, SelectHandler } from '../handlers';

export interface FillPlanItem {
  id: string;
  element: HTMLElement;
  selector: string;
  canonicalId: string;
  fieldLabel: string;
  sectionContext?: string;
  proposedValue: string;
  originalValue: string;
  hasConflict: boolean;
  isApproved: boolean;
  status: FieldStatus | 'PENDING' | 'SUCCESS' | 'REVERTED' | 'FAILED' | 'SKIPPED';
  diagnosticStatus?: DiagnosticFieldStatus;
  statusReason?: string;
  verificationMessage?: string;
}

export interface FillExecutionReport {
  timestamp: string;
  totalApproved: number;
  successfullyFilled: number;
  alreadyCorrect: number;
  failedVerification: number;
  skippedConflicts: number;
  confirmationRequired: number;
  missingInfo: number;
  ambiguous: number;
  items: FillPlanItem[];
  completenessReport: FieldCompletenessEntry[];
}

export class VerificationEngine {
  // Snapshot history for Undo operations
  private static undoStack: Map<
    string,
    Array<{ element: HTMLElement; originalValue: string; appliedValue?: string }>
  > = new Map();

  // Framework-resilient native value setter (React, Vue, Angular, Svelte, Plain HTML)
  public static setNativeInputValue(
    el: HTMLInputElement | HTMLTextAreaElement,
    value: string
  ): void {
    const isInput = el.tagName.toLowerCase() === 'input';
    const prototype = isInput ? window.HTMLInputElement.prototype : window.HTMLTextAreaElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');

    if (descriptor && descriptor.set) {
      descriptor.set.call(el, value);
    } else {
      el.value = value;
    }

    // Dispatch bubbled synthetic events
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));

    try {
      if (typeof (window as any).$ === 'function') {
        (window as any).$(el).trigger('input').trigger('change');
      }
    } catch {
      // Safe ignore in isolated/test environments
    }
  }

  // Safely sets native select option by value, text, bilingual equivalence or fuzzy match
  public static setNativeSelectValue(
    select: HTMLSelectElement,
    targetValue: string
  ): boolean {
    const matched = OptionMatcher.matchOption(select, targetValue);
    if (matched) {
      select.value = matched.value;
      select.dispatchEvent(new Event('input', { bubbles: true }));
      select.dispatchEvent(new Event('change', { bubbles: true }));
      select.dispatchEvent(new Event('blur', { bubbles: true }));
      return true;
    }

    const options = Array.from(select.options);
    const norm = (targetValue || '').toLowerCase().trim();

    const fallback = options.find(
      (opt) =>
        opt.value.toLowerCase().trim() === norm ||
        opt.text.toLowerCase().trim() === norm ||
        (norm.length > 2 && (opt.text.toLowerCase().includes(norm) || opt.value.toLowerCase().includes(norm)))
    );

    if (fallback) {
      select.value = fallback.value;
      select.selectedIndex = fallback.index;

      select.dispatchEvent(new Event('input', { bubbles: true }));
      select.dispatchEvent(new Event('change', { bubbles: true }));
      select.dispatchEvent(new Event('blur', { bubbles: true }));

      return true;
    }

    // Number matching fallback for GPA scales e.g. "GPA (out of 5)" matches "5.00" or "GPA 5"
    if (norm.includes('5')) {
      const opt5 = options.find((o) => o.text.includes('5') || o.value.includes('5'));
      if (opt5) {
        select.value = opt5.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
    }
    if (norm.includes('4')) {
      const opt4 = options.find((o) => o.text.includes('4') || o.value.includes('4'));
      if (opt4) {
        select.value = opt4.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
    }

    return false;
  }

  // Executes a Fill Plan item with pre-fill check and post-fill verification
  public static async executeFillItem(item: FillPlanItem): Promise<boolean> {
    const el = item.element;

    // 1. Pre-fill checks
    if (!document.body.contains(el)) {
      item.status = 'Fill Failed';
      item.verificationMessage = 'Element is no longer connected to DOM.';
      return false;
    }

    if ((el as HTMLInputElement).disabled || (el as HTMLInputElement).readOnly) {
      item.status = 'Fill Failed';
      item.verificationMessage = 'Field is disabled or read-only.';
      return false;
    }

    // Await options for dependent select controls if empty or placeholder-only
    if (el instanceof HTMLSelectElement && el.options.length <= 1) {
      await SelectHandler.waitForOptions(el, el.options.length, 1200);
    }

    // 2. Controlled Execution via specialized Control Handler
    try {
      const handler = ControlHandlerRouter.getHandler(el);
      const fillResult = await handler.fill(el, item.proposedValue);

      if (fillResult.success) {
        item.status = 'Filled';
        item.diagnosticStatus = 'Successfully Filled';
        item.verificationMessage = fillResult.message;
        this.highlightSuccess(el);
        return true;
      } else {
        if (fillResult.status === 'Manual Selection Required') {
          item.status = 'User Confirmation Required';
          item.diagnosticStatus = 'User Confirmation Required';
        } else if (fillResult.status === 'Unsupported Control') {
          item.status = 'Unsupported Field';
          item.diagnosticStatus = 'Unsupported Control';
        } else {
          item.status = 'Fill Failed';
          item.diagnosticStatus = 'Fill Failed';
        }
        item.verificationMessage = fillResult.message;
        return false;
      }
    } catch (err: any) {
      item.status = 'Fill Failed';
      item.diagnosticStatus = 'Fill Failed';
      item.verificationMessage = `Fill error: ${err.message}`;
      return false;
    }
  }

  // Maps any plan item into one of the canonical 7 diagnostic reporting statuses
  public static toDiagnosticStatus(item: FillPlanItem): DiagnosticFieldStatus {
    if (item.status === 'Filled' || item.status === 'SUCCESS') return 'Successfully Filled';
    if (item.status === 'Already Correct') return 'Already Correct';
    if (item.status === 'Missing Profile Information') return 'Profile Information Missing';
    if (item.status === 'User Confirmation Required' || item.status === 'Existing Value Conflict') {
      return 'User Confirmation Required';
    }
    if (item.status === 'Fill Failed' || item.status === 'FAILED') return 'Fill Failed';
    if (item.status === 'Ambiguous Field') return 'Mapping Not Found';
    if (item.status === 'Unsupported Field') {
      const el = item.element as HTMLInputElement | undefined;
      const t = el ? (el.getAttribute?.('type') || el.tagName || '').toLowerCase() : '';
      if (['range', 'color'].includes(t)) {
        if (!item.proposedValue || item.diagnosticStatus === 'Profile Information Missing') {
          return 'Profile Information Missing';
        }
        return 'Mapping Not Found';
      }
      if (item.diagnosticStatus === 'Unsupported Control') return 'Unsupported Control';
      if ((item.statusReason || '').includes('Safety Policy')) return 'Unsupported Control';
      if (['file', 'image', 'submit', 'button'].includes(t)) return 'Unsupported Control';
      return 'Mapping Not Found';
    }
    if (item.status === 'Matched') return 'User Confirmation Required';
    const el = item.element as HTMLInputElement | undefined;
    const t = el ? (el.getAttribute?.('type') || el.tagName || '').toLowerCase() : '';
    if (['range', 'color'].includes(t) && item.diagnosticStatus === 'Unsupported Control') {
      return !item.proposedValue ? 'Profile Information Missing' : 'Mapping Not Found';
    }
    return item.diagnosticStatus || 'Mapping Not Found';
  }

  // Builds completeness report comparing every detected eligible field against its profile state
  public static buildCompletenessReport(items: FillPlanItem[]): FieldCompletenessEntry[] {
    return items.map((item) => {
      let insertedValue = '';
      if (item.element && document.body.contains(item.element)) {
        try {
          insertedValue = ControlHandlerRouter.getHandler(item.element).getCurrentValue(item.element);
        } catch {
          insertedValue = (item.element as HTMLInputElement).value || '';
        }
      }
      const diag = this.toDiagnosticStatus(item);
      return {
        fieldLabel: item.fieldLabel,
        selector: item.selector,
        canonicalId: item.canonicalId,
        status: diag,
        rawStatus: item.status,
        proposedValue: item.proposedValue,
        insertedValue,
        reason: item.verificationMessage || item.statusReason || diag,
      };
    });
  }

  private static getDependencyWeight(canonicalId: string): number {
    const id = (canonicalId || '').toLowerCase();
    if (id.includes('division')) return 10;
    if (id.includes('district')) return 20;
    if (id.includes('upazila') || id.includes('thana')) return 30;
    if (id.includes('examination') || id.includes('degree')) return 10;
    if (id.includes('board')) return 15;
    if (id.includes('group') || id.includes('subject')) return 20;
    if (id.includes('result') && !id.includes('gpa')) return 25;
    if (id.includes('scale')) return 26;
    if (id.includes('gpa') || id.includes('cgpa')) return 35;
    if (id.startsWith('identity.') && id.includes('yesno')) return 10;
    return 50;
  }

  // Executes the approved plan in a controlled queue
  public static async executePlan(
    sessionOrPlan: string | FillPlanItem[],
    items?: FillPlanItem[]
  ): Promise<FillExecutionReport> {
    const planItems = Array.isArray(sessionOrPlan) ? sessionOrPlan : (items || []);
    const sessionId = typeof sessionOrPlan === 'string' ? sessionOrPlan : 'default_autofill_session';

    const report: FillExecutionReport = {
      timestamp: new Date().toISOString(),
      totalApproved: planItems.filter((i) => i.isApproved).length,
      successfullyFilled: 0,
      alreadyCorrect: 0,
      failedVerification: 0,
      skippedConflicts: 0,
      confirmationRequired: 0,
      missingInfo: 0,
      ambiguous: 0,
      items: planItems,
      completenessReport: [],
    };

    const undoRecords: Array<{ element: HTMLElement; originalValue: string; appliedValue?: string }> = [];

    // Stable sort to execute parent dependencies before child dependent controls
    const executionQueue = [...planItems].sort(
      (a, b) => this.getDependencyWeight(a.canonicalId) - this.getDependencyWeight(b.canonicalId)
    );

    for (const item of executionQueue) {
      if (item.status === 'Filled') {
        continue;
      }
      if (item.status === 'Already Correct') {
        report.alreadyCorrect++;
        continue;
      }
      if (item.status === 'Missing Profile Information') {
        report.missingInfo++;
        continue;
      }
      if (item.status === 'Ambiguous Field') {
        report.ambiguous++;
        continue;
      }
      if (item.status === 'User Confirmation Required' && !item.isApproved) {
        report.confirmationRequired++;
        continue;
      }
      if (item.hasConflict && !item.isApproved) {
        report.skippedConflicts++;
        continue;
      }
      if (!item.isApproved) {
        item.status = 'SKIPPED';
        continue;
      }

      const handler = ControlHandlerRouter.getHandler(item.element);
      const snapshotOrig = item.originalValue ?? handler.getCurrentValue(item.element);

      // Snapshot dependent select option counts BEFORE changing parent (District -> Upazila, Examination -> Board & Group, Degree -> Subject)
      const dependentChildren: Array<{ select: HTMLSelectElement; initialCount: number }> = [];

      if (item.canonicalId.includes('district')) {
        const isPerm = item.canonicalId.includes('permanent');
        const selector = isPerm
          ? 'select[name*="perm" i][name*="upazila" i], select[id*="perm" i][id*="upazila" i], select[name*="per_upazila" i], select[name*="perm_thana" i], select[name="menu_two_list"], select[id="menu_two_list"], select[name*="menu_two_list" i]'
          : 'select[name*="present" i][name*="upazila" i], select[id*="present" i][id*="upazila" i], select[name*="p_upazila" i], select[name*="p_thana" i], select[name="menu_one_list"], select[id="menu_one_list"], select[name*="menu_one_list" i], select[name*="upazila" i], select[id*="upazila" i]';
        const sectionRoot =
          item.element.closest(isPerm ? '.permanent-address-box, fieldset, table, tr, div' : '.present-address-box, fieldset, table, tr, div') ||
          document;
        const cand = sectionRoot.querySelector<HTMLSelectElement>(selector) ||
          document.querySelector<HTMLSelectElement>(selector);
        if (cand && cand !== item.element) {
          dependentChildren.push({ select: cand, initialCount: cand.options.length });
        }
      } else if (item.canonicalId.includes('examination') || item.canonicalId.includes('degree')) {
        const isGrad = item.canonicalId.includes('graduation');
        const isHsc = item.canonicalId.includes('hsc');
        const isSsc = item.canonicalId.includes('ssc');

        const sectionRoot =
          item.element.closest('.edu-block, .edu-grid, table, fieldset, tr, tbody, .section') || document;

        if (isGrad) {
          const gradSub = sectionRoot.querySelector<HTMLSelectElement>(
            'select[name*="gra_subject" i], select[name*="grad_subject" i], select[id*="gra_subject" i], select[id*="grad_subject" i], select[name*="subject3" i]'
          );
          if (gradSub && gradSub !== item.element) {
            dependentChildren.push({ select: gradSub, initialCount: gradSub.options.length });
          }
        } else {
          // Identify both Board and Group/Subject dropdowns in the examination's section
          const boardSelector = isHsc
            ? 'select[name*="hsc_board" i], select[id*="hsc_board" i], select[name="board2"], select[id="board2"], select[name="ins2"], select[id="ins2"], select[name*="board" i], select[id*="board" i]'
            : isSsc
            ? 'select[name*="ssc_board" i], select[id*="ssc_board" i], select[name="board1"], select[id="board1"], select[name="ins1"], select[id="ins1"], select[name*="board" i], select[id*="board" i]'
            : 'select[name*="board" i], select[id*="board" i]';

          const groupSelector = isHsc
            ? 'select[name*="hsc_group" i], select[id*="hsc_group" i], select[name="group2"], select[id="group2"], select[name*="group" i], select[id*="group" i], select[name*="subject" i]'
            : isSsc
            ? 'select[name*="ssc_group" i], select[id*="ssc_group" i], select[name="group1"], select[id="group1"], select[name*="group" i], select[id*="group" i], select[name*="subject" i]'
            : 'select[name*="group" i], select[id*="group" i], select[name*="subject" i]';

          const candBoard = sectionRoot.querySelector<HTMLSelectElement>(boardSelector);
          if (candBoard && candBoard !== item.element && !dependentChildren.some((d) => d.select === candBoard)) {
            dependentChildren.push({ select: candBoard, initialCount: candBoard.options.length });
          }

          const candGroup = sectionRoot.querySelector<HTMLSelectElement>(groupSelector);
          if (candGroup && candGroup !== item.element && !dependentChildren.some((d) => d.select === candGroup)) {
            dependentChildren.push({ select: candGroup, initialCount: candGroup.options.length });
          }
        }
      }

      const success = await this.executeFillItem(item);
      if (success) {
        report.successfullyFilled++;
        const actualApplied = handler.getCurrentValue(item.element);
        undoRecords.push({
          element: item.element,
          originalValue: snapshotOrig,
          appliedValue: actualApplied,
        });

        // Wait up to 1200ms for each dependent child dropdown that started empty (<= 1 option) and is waiting for options
        for (const dep of dependentChildren) {
          if (dep.initialCount <= 1 && dep.select.options.length <= 1) {
            await SelectHandler.waitForOptions(dep.select, dep.initialCount, 1200);

            // Re-enable/re-approve child item if present in plan and currently unapproved due to previously missing options
            const childItem = planItems.find((p) => p.element === dep.select);
            if (
              childItem &&
              childItem.proposedValue &&
              (!childItem.isApproved || childItem.status === 'Unsupported Field' || childItem.status === 'Fill Failed')
            ) {
              childItem.status = 'Matched';
              childItem.isApproved = true;
              childItem.diagnosticStatus = 'Successfully Filled';
            }
          }
        }
      } else {
        report.failedVerification++;
      }
    }

    // Cross-verify Confirm Mobile Number against Primary Mobile Number in DOM
    const primaryMobileItem = planItems.find(
      (p) => p.canonicalId === 'contact.mobile' || p.canonicalId === 'candidate.mobile'
    );
    if (primaryMobileItem?.element && document.body.contains(primaryMobileItem.element)) {
      const primaryDomVal = ControlHandlerRouter.getHandler(primaryMobileItem.element).getCurrentValue(
        primaryMobileItem.element
      );
      const normPrimary = ValueNormalizer.normalizeMobileNumber(primaryDomVal);
      if (primaryMobileItem.status === 'Filled' || primaryMobileItem.status === 'Already Correct') {
        if (!normPrimary || normPrimary.length !== 11 || !normPrimary.startsWith('01') || !/^\d{11}$/.test(normPrimary)) {
          if (primaryMobileItem.status === 'Filled') {
            report.successfullyFilled = Math.max(0, report.successfullyFilled - 1);
          }
          primaryMobileItem.status = 'Fill Failed';
          primaryMobileItem.diagnosticStatus = 'Fill Failed';
          primaryMobileItem.verificationMessage = `Invalid Mobile Number ("${primaryDomVal}"). Expected complete 11-digit number starting with 01.`;
          report.failedVerification++;
        }
      }
    }

    const confirmMobileItems = planItems.filter(
      (p) =>
        (p.canonicalId === 'contact.confirmMobile' ||
          p.canonicalId === 'contact.alternateMobile' ||
          p.canonicalId === 'candidate.confirmMobile') &&
        (p.status === 'Filled' || p.status === 'Already Correct')
    );
    for (const confirmMobileItem of confirmMobileItems) {
      if (primaryMobileItem?.element && document.body.contains(primaryMobileItem.element)) {
        const primaryDomVal = ControlHandlerRouter.getHandler(primaryMobileItem.element).getCurrentValue(
          primaryMobileItem.element
        );
        const confirmDomVal = ControlHandlerRouter.getHandler(confirmMobileItem.element).getCurrentValue(
          confirmMobileItem.element
        );
        const normPrimary = ValueNormalizer.normalizeMobileNumber(primaryDomVal);
        const normConfirm = ValueNormalizer.normalizeMobileNumber(confirmDomVal);
        if (normPrimary && normConfirm !== normPrimary) {
          if (confirmMobileItem.status === 'Filled') {
            report.successfullyFilled = Math.max(0, report.successfullyFilled - 1);
            report.failedVerification++;
          }
          confirmMobileItem.status = 'Fill Failed';
          confirmMobileItem.diagnosticStatus = 'Fill Failed';
          confirmMobileItem.verificationMessage = `Confirm Mobile ("${confirmDomVal}") does not match primary Mobile ("${primaryDomVal}").`;
        } else if (normPrimary && normConfirm === normPrimary && normConfirm.length === 11) {
          confirmMobileItem.verificationMessage = `Verified matching primary Mobile Number (${normConfirm}).`;
        }
      }
    }

    const existingUndo = this.undoStack.get(sessionId) || [];
    this.undoStack.set(sessionId, [...existingUndo, ...undoRecords]);
    report.completenessReport = this.buildCompletenessReport(planItems);
    return report;
  }

  // Reverts the last fill session safely while preserving manual edits made after autofill
  public static undoLastFill(
    sessionId: string,
    preserveManualEdits: boolean = true
  ): { restoredCount: number; preservedCount: number } {
    const records = this.undoStack.get(sessionId) || [];
    let restoredCount = 0;
    let preservedCount = 0;

    for (const rec of records) {
      if (document.body.contains(rec.element)) {
        try {
          const handler = ControlHandlerRouter.getHandler(rec.element);
          if (preserveManualEdits && rec.appliedValue !== undefined) {
            const currentVal = handler.getCurrentValue(rec.element);
            if (currentVal.trim().toLowerCase() !== rec.appliedValue.trim().toLowerCase()) {
              // User changed this field manually after autofill -> preserve it
              preservedCount++;
              continue;
            }
          }

          if (
            (rec.element instanceof HTMLSelectElement || rec.element.tagName.toLowerCase() === 'select') &&
            (!rec.originalValue || rec.originalValue.trim() === '')
          ) {
            const sel = rec.element as HTMLSelectElement;
            sel.selectedIndex = 0;
            if (sel.options && sel.options.length > 0) {
              sel.options[0].selected = true;
            }
            sel.dispatchEvent(new Event('input', { bubbles: true }));
            sel.dispatchEvent(new Event('change', { bubbles: true }));
          } else {
            handler.fill(rec.element, rec.originalValue);
          }
          restoredCount++;
        } catch {
          // Ignore undo failures for disconnected elements
        }
      }
    }

    this.undoStack.delete(sessionId);
    return { restoredCount, preservedCount };
  }

  // Subtle visual green highlight for verified fields
  private static highlightSuccess(el: HTMLElement): void {
    const prevBg = el.style.backgroundColor;
    const prevOutline = el.style.outline;
    const prevTransition = el.style.transition;

    el.style.transition = 'all 0.3s ease';
    el.style.backgroundColor = '#dcfce7'; // light emerald
    el.style.outline = '2px solid #16a34a';

    setTimeout(() => {
      el.style.backgroundColor = prevBg;
      el.style.outline = prevOutline;
      el.style.transition = prevTransition;
    }, 2000);
  }
}
