// JobFill BD - Layer 4: Advanced Dropdown Intelligence & Cascading Options Matcher
// Implements Part H of Master Engineering Specification:
// Bilingual option equivalence, fuzzy matching, and dependency-aware cascading dropdowns.

import { BILINGUAL_EQUIVALENTS, EXAMINATION_EQUIVALENTS } from '../engine/dropdownMatcher';
import { ValueNormalizer } from './value-normalizer';

function stripKey(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[\s\-_.\/():,;|]+/g, '')
    .trim();
}

export class OptionMatcher {
  // Finds best matching option value from select element
  public static matchOption(
    select: HTMLSelectElement,
    targetValue: string
  ): { value: string; text: string; confidence: number } | null {
    if (!targetValue) return null;

    const options = Array.from(select.options).filter((o) => !o.disabled && o.value !== '');
    const normTarget = ValueNormalizer.cleanText(targetValue);
    const keyTarget = stripKey(targetValue);
    const englishTarget = ValueNormalizer.toEnglishNumerals(normTarget);

    // 1. Exact value or text match
    for (const opt of options) {
      const normVal = ValueNormalizer.cleanText(opt.value);
      const normText = ValueNormalizer.cleanText(opt.text);
      if (
        normVal === normTarget ||
        normText === normTarget ||
        normVal === englishTarget ||
        normText === englishTarget
      ) {
        return { value: opt.value, text: opt.text, confidence: 100 };
      }
    }

    // 2. Strict stripped-key match
    for (const opt of options) {
      const valKey = stripKey(opt.value);
      const textKey = stripKey(opt.text);
      if (valKey === keyTarget || textKey === keyTarget) {
        return { value: opt.value, text: opt.text, confidence: 98 };
      }
    }

    // 3. Examination Equivalents (SSC, HSC, Dakhil, Alim, etc.)
    for (const [, aliases] of Object.entries(EXAMINATION_EQUIVALENTS)) {
      const targetMatchesGroup = aliases.some(
        (a) => stripKey(a) === keyTarget || ValueNormalizer.cleanText(a) === normTarget
      );
      if (targetMatchesGroup) {
        for (const opt of options) {
          const optValKey = stripKey(opt.value);
          const optTextKey = stripKey(opt.text);
          if (aliases.some((a) => stripKey(a) === optValKey || stripKey(a) === optTextKey)) {
            return { value: opt.value, text: opt.text, confidence: 95 };
          }
        }
      }
    }

    // 4. Bilingual dictionary equivalence (Districts, Upazilas, Boards, Results, Quotas, Genders)
    for (const [, aliases] of Object.entries(BILINGUAL_EQUIVALENTS)) {
      const targetMatchesGroup = aliases.some(
        (a) => ValueNormalizer.cleanText(a) === normTarget || stripKey(a) === keyTarget
      );
      if (targetMatchesGroup) {
        for (const opt of options) {
          const normVal = ValueNormalizer.cleanText(opt.value);
          const normText = ValueNormalizer.cleanText(opt.text);
          const valKey = stripKey(opt.value);
          const textKey = stripKey(opt.text);
          if (
            aliases.some(
              (a) =>
                ValueNormalizer.cleanText(a) === normVal ||
                ValueNormalizer.cleanText(a) === normText ||
                stripKey(a) === valKey ||
                stripKey(a) === textKey
            )
          ) {
            return { value: opt.value, text: opt.text, confidence: 95 };
          }
        }
      }
    }

    // 5. Numeric / Scale matching (GPA 5.00 vs 5, GPA 4.00 vs 4)
    if (normTarget.includes('5') || keyTarget === '500') {
      const opt5 = options.find((o) => o.text.includes('5') || o.value.includes('5'));
      if (opt5) return { value: opt5.value, text: opt5.text, confidence: 85 };
    }
    if (normTarget.includes('4') || keyTarget === '400') {
      const opt4 = options.find((o) => o.text.includes('4') || o.value.includes('4'));
      if (opt4) return { value: opt4.value, text: opt4.text, confidence: 85 };
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
          return { value: opt.value, text: opt.text, confidence: 80 };
        }
      }
    }

    return null;
  }

  // Cascading Dropdown Runner with Bounded MutationObserver + Polling Waiting
  public static async executeCascadingSequence(
    parentSelect: HTMLSelectElement,
    parentTargetValue: string,
    childSelect: HTMLSelectElement,
    childTargetValue: string,
    timeoutMs: number = 1500
  ): Promise<boolean> {
    const parentMatch = this.matchOption(parentSelect, parentTargetValue);
    if (!parentMatch) return false;

    // Record child options count before trigger
    const initialChildCount = childSelect.options.length;

    // Set parent with framework-compatible setter
    try {
      const prototype = window.HTMLSelectElement?.prototype;
      const descriptor = prototype ? Object.getOwnPropertyDescriptor(prototype, 'value') : null;
      if (descriptor && descriptor.set) {
        descriptor.set.call(parentSelect, parentMatch.value);
      } else {
        parentSelect.value = parentMatch.value;
      }
    } catch {
      parentSelect.value = parentMatch.value;
    }
    const optObj = Array.from(parentSelect.options).find((o) => o.value === parentMatch.value);
    if (optObj) {
      parentSelect.selectedIndex = optObj.index;
      optObj.selected = true;
    }

    parentSelect.dispatchEvent(new Event('input', { bubbles: true }));
    parentSelect.dispatchEvent(new Event('change', { bubbles: true }));
    parentSelect.dispatchEvent(new Event('blur', { bubbles: true }));

    try {
      if (typeof (window as any).$ === 'function') {
        (window as any).$(parentSelect).trigger('change');
      }
    } catch {
      // Safe ignore in isolated/test environments
    }

    // Wait for child to update using bounded promise with MutationObserver and polling interval
    await new Promise<void>((resolve) => {
      let resolved = false;
      const observer = new MutationObserver(() => {
        if (childSelect.options.length !== initialChildCount && childSelect.options.length > 1) {
          cleanup();
        }
      });

      observer.observe(childSelect, { childList: true, subtree: true });

      const poll = setInterval(() => {
        if (childSelect.options.length !== initialChildCount && childSelect.options.length > 1) {
          cleanup();
        }
      }, 40);

      const timer = setTimeout(() => {
        cleanup();
      }, timeoutMs);

      const cleanup = () => {
        if (!resolved) {
          resolved = true;
          observer.disconnect();
          clearInterval(poll);
          clearTimeout(timer);
          resolve();
        }
      };
    });

    // Match and set child option
    const childMatch = this.matchOption(childSelect, childTargetValue);
    if (childMatch) {
      try {
        const prototype = window.HTMLSelectElement?.prototype;
        const descriptor = prototype ? Object.getOwnPropertyDescriptor(prototype, 'value') : null;
        if (descriptor && descriptor.set) {
          descriptor.set.call(childSelect, childMatch.value);
        } else {
          childSelect.value = childMatch.value;
        }
      } catch {
        childSelect.value = childMatch.value;
      }
      const childOpt = Array.from(childSelect.options).find((o) => o.value === childMatch.value);
      if (childOpt) {
        childSelect.selectedIndex = childOpt.index;
        childOpt.selected = true;
      }

      childSelect.dispatchEvent(new Event('input', { bubbles: true }));
      childSelect.dispatchEvent(new Event('change', { bubbles: true }));
      childSelect.dispatchEvent(new Event('blur', { bubbles: true }));
      return true;
    }

    return false;
  }
}
