// JobFill BD - Native Select / Dropdown Control Handler
// Handles native <select> elements, bilingual Bangla-English matching,
// Examination equivalence (SSC <-> S.S.C, HSC <-> H.S.C, Dakhil, O-Level, Vocational),
// GPA scale translation, dependent cascading dropdowns, and dedicated select debug reporting.

import { ControlHandler, ControlFillResult } from './types';
import { OptionMatcher } from '../intelligence/option-matcher';
import { BILINGUAL_EQUIVALENTS, EXAMINATION_EQUIVALENTS } from '../engine/dropdownMatcher';
import { ValueNormalizer } from '../intelligence/value-normalizer';

export interface SelectDebugReportItem {
  section: string;
  field: string;
  savedValue: string;
  availableOptions: Array<{ value: string; text: string }>;
  selectedOption: string | null;
  result:
    | 'Successfully Selected'
    | 'No matching option'
    | 'Profile value missing'
    | 'Unsupported custom dropdown'
    | 'Website rejected selection'
    | 'Dependent options not loaded';
  details?: string;
}

export class SelectHandler implements ControlHandler {
  public readonly controlType = 'select';

  // Global debug report registry for Examination and other critical dropdowns
  public static readonly debugReports: SelectDebugReportItem[] = [];

  public static clearDebugReports(): void {
    SelectHandler.debugReports.length = 0;
  }

  public static getDebugReports(): SelectDebugReportItem[] {
    return [...SelectHandler.debugReports];
  }

  public canHandle(el: HTMLElement): boolean {
    return el instanceof HTMLSelectElement || el.tagName.toLowerCase() === 'select';
  }

  // Normalizes options by stripping dots, dashes, slashes, whitespace, and parentheses
  public static normalizeOptionKey(s: string): string {
    return (s || '')
      .toLowerCase()
      .replace(/&/g, 'and')
      .replace(/[\s\-_.\/():,;|]+/g, '')
      .trim();
  }

  // Detects if all non-placeholder options are strictly boolean Yes/No equivalents
  public static isYesNoSelect(select: HTMLSelectElement): boolean {
    if (!select || !select.options) return false;
    const handler = new SelectHandler();
    const validOpts = Array.from(select.options).filter(
      (o) => !o.disabled && !handler.isPlaceholderOption(o, o.index)
    );
    if (validOpts.length < 2 || validOpts.length > 3) return false;

    const yesTokens = new Set(['yes', 'y', '1', 'true', 'হ্যাঁ', 'আছে', 'have']);
    const noTokens = new Set(['no', 'n', '0', '2', 'false', 'না', 'নেই', 'none']);

    let sawYes = false;
    let sawNo = false;
    for (const o of validOpts) {
      const t = (o.text || '').trim().toLowerCase();
      const v = (o.value || '').trim().toLowerCase();
      const isYes = yesTokens.has(t) || yesTokens.has(v);
      const isNo = noTokens.has(t) || noTokens.has(v);
      if (!isYes && !isNo) return false;
      if (isYes) sawYes = true;
      if (isNo) sawNo = true;
    }
    return sawYes && sawNo;
  }

  // Detects if the currently selected option is merely a default placeholder (e.g. "Select", "0", "")
  public isPlaceholderOption(opt: HTMLOptionElement | undefined, index: number): boolean {
    if (!opt) return true;
    if (index === 0 && (!opt.value || opt.value === '0' || opt.value === '-1')) return true;

    const val = (opt.value || '').trim().toLowerCase();
    const text = (opt.text || '').trim().toLowerCase();

    const placeholderWords = ['select', 'choose', 'none', '--', 'নির্বাচন', 'বাছাই', 'প্রযোজ্য নয়'];
    const isValPlaceholder = val === '' || val === '0' || val === '-1' || placeholderWords.some((w) => val === w);
    const isTextPlaceholder = placeholderWords.some((w) => text.startsWith(w) || text === w);

    return isValPlaceholder && isTextPlaceholder;
  }

  public getCurrentValue(el: HTMLElement): string {
    const select = el as HTMLSelectElement;
    if (!select || !select.options) return '';

    const selectedOpt = select.selectedOptions ? select.selectedOptions[0] : select.options[select.selectedIndex];
    if (!selectedOpt || this.isPlaceholderOption(selectedOpt, select.selectedIndex)) {
      return '';
    }

    return (selectedOpt.text || selectedOpt.value || '').trim();
  }

  public isAlreadyCorrect(el: HTMLElement, proposedValue: string): boolean {
    const select = el as HTMLSelectElement;
    if (!select || !select.options || select.selectedIndex < 0) return false;

    const currentOpt = select.selectedOptions ? select.selectedOptions[0] : select.options[select.selectedIndex];
    if (this.isPlaceholderOption(currentOpt, select.selectedIndex)) {
      return false; // Not filled yet
    }

    const matched = this.findMatchingOption(select, proposedValue);
    if (!matched) return false;

    return select.selectedIndex === matched.index || select.value === matched.value;
  }

  public findMatchingOption(
    select: HTMLSelectElement,
    targetValue: string
  ): HTMLOptionElement | null {
    if (!targetValue) return null;

    const options = Array.from(select.options).filter((o) => !o.disabled && !this.isPlaceholderOption(o, o.index));
    const rawTarget = targetValue.trim();
    const normTarget = ValueNormalizer.cleanText(targetValue);
    const keyTarget = SelectHandler.normalizeOptionKey(targetValue);
    const englishTarget = ValueNormalizer.toEnglishNumerals(normTarget);

    // 1. Exact case-insensitive value or text match
    for (const opt of options) {
      const valTrim = opt.value.trim();
      const textTrim = opt.text.trim();
      if (
        valTrim.toLowerCase() === rawTarget.toLowerCase() ||
        textTrim.toLowerCase() === rawTarget.toLowerCase()
      ) {
        return opt;
      }
    }

    // 2. Strict stripped-punctuation key match (e.g. "SSC" matches "S.S.C", "HSC" matches "H.S.C")
    for (const opt of options) {
      const valKey = SelectHandler.normalizeOptionKey(opt.value);
      const textKey = SelectHandler.normalizeOptionKey(opt.text);
      if (valKey === keyTarget || textKey === keyTarget) {
        return opt;
      }
    }

    // 3. Strict Examination Equivalents matching
    // (Ensures SSC matches S.S.C, but NOT S.S.C Vocational or Dakhil or O-Level)
    for (const [, aliases] of Object.entries(EXAMINATION_EQUIVALENTS)) {
      const targetMatchesGroup = aliases.some(
        (a) => SelectHandler.normalizeOptionKey(a) === keyTarget || ValueNormalizer.cleanText(a) === normTarget
      );
      if (targetMatchesGroup) {
        for (const opt of options) {
          const optValKey = SelectHandler.normalizeOptionKey(opt.value);
          const optTextKey = SelectHandler.normalizeOptionKey(opt.text);
          if (
            aliases.some(
              (a) =>
                SelectHandler.normalizeOptionKey(a) === optValKey ||
                SelectHandler.normalizeOptionKey(a) === optTextKey
            )
          ) {
            return opt;
          }
        }
      }
    }

    // 4. Bilingual dictionary equivalence (Boards, Religions, Genders, Quotas, etc.)
    for (const [, aliases] of Object.entries(BILINGUAL_EQUIVALENTS)) {
      const targetMatchesGroup = aliases.some(
        (a) =>
          ValueNormalizer.cleanText(a) === normTarget ||
          SelectHandler.normalizeOptionKey(a) === keyTarget
      );
      if (targetMatchesGroup) {
        for (const opt of options) {
          const normVal = ValueNormalizer.cleanText(opt.value);
          const normText = ValueNormalizer.cleanText(opt.text);
          const valKey = SelectHandler.normalizeOptionKey(opt.value);
          const textKey = SelectHandler.normalizeOptionKey(opt.text);
          if (
            aliases.some(
              (a) =>
                ValueNormalizer.cleanText(a) === normVal ||
                ValueNormalizer.cleanText(a) === normText ||
                SelectHandler.normalizeOptionKey(a) === valKey ||
                SelectHandler.normalizeOptionKey(a) === textKey
            )
          ) {
            return opt;
          }
        }
      }
    }

    // 5. GPA / Numeric scales (e.g. "GPA 5" or "5.00" matches "GPA (out of 5)")
    if (normTarget.includes('5') || normTarget === '5.00' || keyTarget === '500') {
      const opt5 = options.find((o) => o.text.includes('5') || o.value.includes('5'));
      if (opt5) return opt5;
    }
    if (normTarget.includes('4') || normTarget === '4.00' || keyTarget === '400') {
      const opt4 = options.find((o) => o.text.includes('4') || o.value.includes('4'));
      if (opt4) return opt4;
    }

    // 6. Substring inclusion match (guarded against cross-examination mis-matches)
    const isExamTarget = ['ssc', 'hsc', 'dakhil', 'alim'].includes(keyTarget);
    if (!isExamTarget) {
      for (const opt of options) {
        const normVal = ValueNormalizer.cleanText(opt.value);
        const normText = ValueNormalizer.cleanText(opt.text);
        if (
          (normVal && (normVal.includes(normTarget) || normTarget.includes(normVal))) ||
          (normText && (normText.includes(normTarget) || normTarget.includes(normText)))
        ) {
          return opt;
        }
      }
    }

    return null;
  }

  // Extracts contextual section name for debugging
  private inferSectionName(select: HTMLSelectElement): string {
    const nameId = `${select.name} ${select.id}`.toLowerCase();
    if (nameId.includes('ssc')) return 'SSC';
    if (nameId.includes('hsc')) return 'HSC';
    if (nameId.includes('grad') || nameId.includes('gra')) return 'Graduation';
    if (nameId.includes('mast') || nameId.includes('mas')) return 'Masters';

    const sectionEl = select.closest('.edu-block, fieldset, table, .section');
    if (sectionEl) {
      const heading = sectionEl.querySelector('.edu-header, legend, h1, h2, h3, h4, h5, .section-title');
      if (heading) {
        const txt = (heading.textContent || '').toUpperCase();
        if (txt.includes('SSC')) return 'SSC';
        if (txt.includes('HSC')) return 'HSC';
        if (txt.includes('GRADUATION')) return 'Graduation';
        if (txt.includes('MASTERS')) return 'Masters';
      }
    }
    return 'General';
  }

  public async fill(
    el: HTMLElement,
    proposedValue: string,
    sectionHint?: string
  ): Promise<ControlFillResult> {
    const select = el as HTMLSelectElement;
    if (!select || !select.options) {
      return {
        success: false,
        element: el,
        status: 'Fill Failed',
        message: 'Element is not an HTMLSelectElement.',
        appliedValue: proposedValue,
      };
    }

    const sectionName = sectionHint || this.inferSectionName(select);
    const fieldName = (select.labels?.[0]?.textContent || select.name || select.id || 'Dropdown').trim();
    const availableOpts = Array.from(select.options).map((o) => ({ value: o.value, text: o.text }));

    if (!proposedValue || proposedValue.trim() === '') {
      SelectHandler.debugReports.push({
        section: sectionName,
        field: fieldName,
        savedValue: '',
        availableOptions: availableOpts,
        selectedOption: null,
        result: 'Profile value missing',
        details: 'No examination or select value saved in the active user profile.',
      });
      return {
        success: false,
        element: select,
        status: 'Fill Failed',
        message: 'No value found in active profile.',
        appliedValue: '',
      };
    }

    const matchedOpt = this.findMatchingOption(select, proposedValue);
    if (!matchedOpt) {
      SelectHandler.debugReports.push({
        section: sectionName,
        field: fieldName,
        savedValue: proposedValue,
        availableOptions: availableOpts,
        selectedOption: null,
        result: 'No matching option',
        details: `Available options: ${availableOpts.map((o) => o.text).join(', ')}`,
      });

      return {
        success: false,
        element: select,
        status: 'Fill Failed',
        message: `No matching option found for "${proposedValue}" among ${select.options.length} options.`,
        appliedValue: proposedValue,
      };
    }

    try {
      select.value = matchedOpt.value;
      select.selectedIndex = matchedOpt.index;
      matchedOpt.selected = true;

      // Dispatch standard DOM events to trigger any cascading listeners
      select.dispatchEvent(new Event('input', { bubbles: true }));
      select.dispatchEvent(new Event('change', { bubbles: true }));
      select.dispatchEvent(new Event('blur', { bubbles: true }));

      // Host page jQuery compatibility (used widely across Teletalk portals)
      try {
        if (typeof (window as any).$ === 'function') {
          (window as any).$(select).trigger('change');
        }
      } catch {
        // Safe ignore in isolated/test environments
      }

      // Short tick wait for reactive framework sync / cascading listeners
      await new Promise((r) => setTimeout(r, 8));

      const isVerified = this.verify(select, proposedValue);
      if (isVerified) {
        SelectHandler.debugReports.push({
          section: sectionName,
          field: fieldName,
          savedValue: proposedValue,
          availableOptions: availableOpts,
          selectedOption: matchedOpt.text,
          result: 'Successfully Selected',
          details: `Selected option index ${matchedOpt.index} (value: "${matchedOpt.value}", text: "${matchedOpt.text}").`,
        });

        return {
          success: true,
          element: select,
          status: 'Filled',
          message: `Option "${matchedOpt.text}" successfully selected.`,
          appliedValue: matchedOpt.text || matchedOpt.value,
        };
      } else {
        SelectHandler.debugReports.push({
          section: sectionName,
          field: fieldName,
          savedValue: proposedValue,
          availableOptions: availableOpts,
          selectedOption: select.value,
          result: 'Website rejected selection',
          details: `Selection reverted by host page scripts. Expected: "${matchedOpt.text}", got: "${select.value}".`,
        });

        return {
          success: false,
          element: select,
          status: 'Fill Failed',
          message: 'Selected dropdown option reverted by host website.',
          appliedValue: select.value,
        };
      }
    } catch (err: any) {
      SelectHandler.debugReports.push({
        section: sectionName,
        field: fieldName,
        savedValue: proposedValue,
        availableOptions: availableOpts,
        selectedOption: null,
        result: 'Unsupported custom dropdown',
        details: `Exception: ${err.message}`,
      });

      return {
        success: false,
        element: select,
        status: 'Fill Failed',
        message: `Select fill error: ${err.message}`,
        appliedValue: proposedValue,
      };
    }
  }

  public verify(el: HTMLElement, proposedValue: string): boolean {
    const select = el as HTMLSelectElement;
    if (!select || !select.options) return false;

    const matched = this.findMatchingOption(select, proposedValue);
    if (!matched) return false;

    return select.selectedIndex === matched.index || select.value === matched.value;
  }

  // Observable wait for dependent dropdown options to populate
  public static async waitForOptions(
    select: HTMLSelectElement,
    initialCount: number,
    timeoutMs: number = 800
  ): Promise<boolean> {
    if (select.options.length > initialCount && select.options.length > 1) {
      return true;
    }

    return new Promise<boolean>((resolve) => {
      let done = false;
      const obs = new MutationObserver(() => {
        if (select.options.length !== initialCount && select.options.length > 1) {
          cleanup(true);
        }
      });
      obs.observe(select, { childList: true, subtree: true });

      // Polling fallback for frameworks that mutate select options directly without childList mutations
      const interval = setInterval(() => {
        if (select.options.length !== initialCount && select.options.length > 1) {
          cleanup(true);
        }
      }, 50);

      const timer = setTimeout(() => cleanup(false), timeoutMs);

      const cleanup = (res: boolean) => {
        if (!done) {
          done = true;
          obs.disconnect();
          clearInterval(interval);
          clearTimeout(timer);
          resolve(res);
        }
      };
    });
  }

  // Cascading dependent dropdown runner
  public static async fillCascadingPair(
    parentSelect: HTMLSelectElement,
    parentVal: string,
    childSelect: HTMLSelectElement,
    childVal: string,
    timeoutMs: number = 1000
  ): Promise<boolean> {
    const handler = new SelectHandler();
    const parentRes = await handler.fill(parentSelect, parentVal);
    if (!parentRes.success) return false;

    // Observable wait for child dropdown options to load
    await SelectHandler.waitForOptions(childSelect, childSelect.options.length, timeoutMs);

    const childRes = await handler.fill(childSelect, childVal);
    return childRes.success;
  }
}
