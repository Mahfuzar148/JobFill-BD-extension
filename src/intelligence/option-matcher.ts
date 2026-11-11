// JobFill BD - Layer 4: Advanced Dropdown Intelligence & Cascading Options Matcher
// Implements Part H of Master Engineering Specification:
// Bilingual option equivalence, fuzzy matching, and dependency-aware cascading dropdowns.

import { BILINGUAL_EQUIVALENTS } from '../engine/dropdownMatcher';
import { ValueNormalizer } from './value-normalizer';

export class OptionMatcher {
  // Finds best matching option value from select element
  public static matchOption(
    select: HTMLSelectElement,
    targetValue: string
  ): { value: string; text: string; confidence: number } | null {
    if (!targetValue) return null;

    const options = Array.from(select.options).filter((o) => !o.disabled && o.value !== '');
    const normTarget = ValueNormalizer.cleanText(targetValue);
    const englishTarget = ValueNormalizer.toEnglishNumerals(normTarget);

    // 1. Exact value or text match
    for (const opt of options) {
      const normVal = ValueNormalizer.cleanText(opt.value);
      const normText = ValueNormalizer.cleanText(opt.text);
      if (normVal === normTarget || normText === normTarget || normVal === englishTarget || normText === englishTarget) {
        return { value: opt.value, text: opt.text, confidence: 100 };
      }
    }

    // 2. Bilingual dictionary equivalence
    for (const [, aliases] of Object.entries(BILINGUAL_EQUIVALENTS)) {
      const targetMatchesGroup = aliases.some((a) => ValueNormalizer.cleanText(a) === normTarget);
      if (targetMatchesGroup) {
        for (const opt of options) {
          const normVal = ValueNormalizer.cleanText(opt.value);
          const normText = ValueNormalizer.cleanText(opt.text);
          if (aliases.some((a) => ValueNormalizer.cleanText(a) === normVal || ValueNormalizer.cleanText(a) === normText)) {
            return { value: opt.value, text: opt.text, confidence: 95 };
          }
        }
      }
    }

    // 3. Substring inclusion match
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

    return null;
  }

  // Cascading Dropdown Runner with Bounded MutationObserver Waiting
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

    // Set parent
    parentSelect.value = parentMatch.value;
    parentSelect.dispatchEvent(new Event('change', { bubbles: true }));

    // Wait for child to update using bounded promise with MutationObserver
    await new Promise<void>((resolve) => {
      let resolved = false;
      const observer = new MutationObserver(() => {
        if (childSelect.options.length !== initialChildCount) {
          cleanup();
        }
      });

      observer.observe(childSelect, { childList: true });

      const timer = setTimeout(() => {
        cleanup();
      }, timeoutMs);

      const cleanup = () => {
        if (!resolved) {
          resolved = true;
          observer.disconnect();
          clearTimeout(timer);
          resolve();
        }
      };
    });

    // Match and set child option
    const childMatch = this.matchOption(childSelect, childTargetValue);
    if (childMatch) {
      childSelect.value = childMatch.value;
      childSelect.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }

    return false;
  }
}
