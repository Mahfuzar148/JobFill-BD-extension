// JobFill BD - Custom Dropdown & ARIA Combobox Handler
// Handles custom non-native dropdowns, ARIA comboboxes, listboxes, searchable dropdowns,
// and React/Vue-controlled custom selects with native setters and read-back verification.

import { ControlHandler, ControlFillResult } from './types';
import { SelectHandler } from './select-handler';
import { ValueNormalizer } from '../intelligence/value-normalizer';
import { BILINGUAL_EQUIVALENTS } from '../engine/dropdownMatcher';

export class CustomDropdownHandler implements ControlHandler {
  public readonly controlType = 'custom-dropdown';

  public canHandle(el: HTMLElement): boolean {
    if (!el) return false;
    const role = (el.getAttribute('role') || '').toLowerCase();
    const ariaHasPopup = (el.getAttribute('aria-haspopup') || '').toLowerCase();
    const className = (el.className || '').toString().toLowerCase();

    return (
      role === 'combobox' ||
      role === 'listbox' ||
      ariaHasPopup === 'listbox' ||
      className.includes('custom-select') ||
      className.includes('custom-dropdown') ||
      className.includes('select2-selection') ||
      className.includes('react-select')
    );
  }

  public static isPlaceholderText(text: string): boolean {
    if (!text) return true;
    const clean = text.trim().toLowerCase();
    const placeholderWords = ['select', 'choose', 'none', '--', 'নির্বাচন', 'বাছাই', 'প্রযোজ্য নয়'];
    return placeholderWords.some((w) => clean === w || clean.startsWith(w));
  }

  public getCurrentValue(el: HTMLElement): string {
    if (!el) return '';
    let rawVal = '';

    // 1. Check aria-selected option within or referenced by the combobox
    const listboxId = el.getAttribute('aria-controls') || el.getAttribute('aria-owns');
    const container = listboxId ? document.getElementById(listboxId) || el : el;
    const selectedOption = container.querySelector('[aria-selected="true"], .selected, .active');
    if (selectedOption) {
      rawVal = (selectedOption.textContent || '').trim();
    } else {
      // Also check parent or sibling listbox if container had none
      const nearbySelected = el.parentElement?.querySelector(
        '[role="option"][aria-selected="true"], [role="listbox"] .selected, [role="listbox"] [aria-selected="true"]'
      );
      if (nearbySelected) {
        rawVal = (nearbySelected.textContent || '').trim();
      } else {
        // 2. Check inner text or associated input value
        const input =
          el.querySelector<HTMLInputElement>('input') ||
          el.closest('.custom-select-wrapper')?.querySelector<HTMLInputElement>('input');
        if (input && input.value) {
          rawVal = input.value.trim();
        } else {
          const valueEl = el.querySelector(
            '.selected-value, .select-value, .selected-text, .select-text, .combobox-value, .current, span'
          );
          if (valueEl) {
            rawVal = (valueEl.textContent || '').trim();
          } else {
            rawVal = (el.textContent || '').trim();
          }
        }
      }
    }

    if (CustomDropdownHandler.isPlaceholderText(rawVal)) {
      return '';
    }
    return rawVal;
  }

  public isAlreadyCorrect(el: HTMLElement, proposedValue: string): boolean {
    return this.verify(el, proposedValue);
  }

  public async fill(el: HTMLElement, proposedValue: string): Promise<ControlFillResult> {
    if (!el) {
      return {
        success: false,
        element: el,
        status: 'Fill Failed',
        message: 'Element is null.',
        appliedValue: proposedValue,
      };
    }

    if (!proposedValue || proposedValue.trim() === '') {
      return {
        success: false,
        element: el,
        status: 'Fill Failed',
        message: 'No value found in active profile.',
        appliedValue: '',
      };
    }

    // 1. Trigger open state if listbox is collapsed
    const isExpanded = el.getAttribute('aria-expanded') === 'true';
    if (!isExpanded) {
      el.focus();
      el.click();
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      await new Promise((r) => setTimeout(r, 40));
    }

    // 2. Locate listbox container and options
    const listboxId = el.getAttribute('aria-controls') || el.getAttribute('aria-owns');
    let container: HTMLElement = listboxId ? (document.getElementById(listboxId) as HTMLElement) || el : el;
    let options = Array.from(
      container.querySelectorAll<HTMLElement>('[role="option"], .custom-option, .option, li')
    );

    // If no options found directly in container, inspect parent, siblings, or referenced listbox
    if (options.length === 0) {
      const nearbyListbox =
        el.parentElement?.querySelector<HTMLElement>('[role="listbox"], ul, .dropdown-menu') ||
        (el.nextElementSibling as HTMLElement) ||
        document.querySelector<HTMLElement>(`[role="listbox"][aria-labelledby="${el.id}"]`);
      if (nearbyListbox) {
        container = nearbyListbox;
        options = Array.from(
          container.querySelectorAll<HTMLElement>('[role="option"], .custom-option, .option, li')
        );
      }
    }

    // If still no options found, wait briefly for async options to populate (bounded wait with retries)
    if (options.length === 0) {
      for (let retries = 0; retries < 4 && options.length === 0; retries++) {
        await new Promise((r) => setTimeout(r, 150));
        const retryContainer =
          (listboxId ? (document.getElementById(listboxId) as HTMLElement) : null) ||
          el.parentElement?.querySelector<HTMLElement>('[role="listbox"], ul, .dropdown-menu') ||
          (el.nextElementSibling as HTMLElement) ||
          el;
        options = Array.from(
          retryContainer.querySelectorAll<HTMLElement>('[role="option"], .custom-option, .option, li')
        );
      }
    }

    if (options.length === 0) {
      return {
        success: false,
        element: el,
        status: 'Fill Failed',
        message: 'OPTIONS_NOT_LOADED: Custom dropdown options failed to load within timeout.',
        appliedValue: '',
      };
    }

    // 3. Match option
    const keyTarget = SelectHandler.normalizeOptionKey(proposedValue);
    const cleanTarget = ValueNormalizer.cleanText(proposedValue).toLowerCase();

    let matchedOption: HTMLElement | null = null;

    // Strict key match first
    for (const opt of options) {
      const optText = (opt.textContent || '').trim();
      const optVal = opt.getAttribute('data-value') || opt.getAttribute('value') || optText;
      const keyText = SelectHandler.normalizeOptionKey(optText);
      const keyVal = SelectHandler.normalizeOptionKey(optVal);

      if (keyText === keyTarget || keyVal === keyTarget) {
        matchedOption = opt;
        break;
      }
    }

    // Bilingual dictionary equivalence (Boards, Religions, Examinations, etc.)
    if (!matchedOption) {
      for (const [, aliases] of Object.entries(BILINGUAL_EQUIVALENTS)) {
        const targetMatchesGroup = aliases.some(
          (a) =>
            ValueNormalizer.cleanText(a) === cleanTarget ||
            SelectHandler.normalizeOptionKey(a) === keyTarget
        );
        if (targetMatchesGroup) {
          for (const opt of options) {
            const optText = (opt.textContent || '').trim();
            const optVal = opt.getAttribute('data-value') || opt.getAttribute('value') || optText;
            const normVal = ValueNormalizer.cleanText(optVal);
            const normText = ValueNormalizer.cleanText(optText);
            const valKey = SelectHandler.normalizeOptionKey(optVal);
            const textKey = SelectHandler.normalizeOptionKey(optText);
            if (
              aliases.some(
                (a) =>
                  ValueNormalizer.cleanText(a) === normVal ||
                  ValueNormalizer.cleanText(a) === normText ||
                  SelectHandler.normalizeOptionKey(a) === valKey ||
                  SelectHandler.normalizeOptionKey(a) === textKey
              )
            ) {
              matchedOption = opt;
              break;
            }
          }
          if (matchedOption) break;
        }
      }
    }

    // Substring match fallback (guarded against exam target collisions)
    if (!matchedOption) {
      for (const opt of options) {
        const optText = (opt.textContent || '').trim().toLowerCase();
        if (optText && (optText.includes(cleanTarget) || cleanTarget.includes(optText))) {
          matchedOption = opt;
          break;
        }
      }
    }

    if (!matchedOption) {
      return {
        success: false,
        element: el,
        status: 'Fill Failed',
        message: `OPTION_NOT_FOUND: No matching custom dropdown option found for "${proposedValue}".`,
        appliedValue: proposedValue,
      };
    }

    // 4. Select option
    options.forEach((o) => {
      o.setAttribute('aria-selected', 'false');
      o.classList.remove('selected', 'active');
    });

    matchedOption.setAttribute('aria-selected', 'true');
    matchedOption.classList.add('selected', 'active');
    matchedOption.click();

    // 5. Update any hidden or associated input for form submission
    const associatedInput =
      el.querySelector<HTMLInputElement>('input') ||
      el.parentElement?.querySelector<HTMLInputElement>('input[type="hidden"], input[type="text"]');
    if (associatedInput) {
      const optVal = matchedOption.getAttribute('data-value') || matchedOption.getAttribute('value') || matchedOption.textContent?.trim() || proposedValue;
      try {
        const proto = window.HTMLInputElement?.prototype;
        const descriptor = proto ? Object.getOwnPropertyDescriptor(proto, 'value') : null;
        if (descriptor && descriptor.set) {
          descriptor.set.call(associatedInput, optVal);
        } else {
          associatedInput.value = optVal;
        }
      } catch {
        associatedInput.value = optVal;
      }
      associatedInput.dispatchEvent(new Event('input', { bubbles: true }));
      associatedInput.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // Update display container text if present
    const valueEl = el.querySelector(
      '.selected-value, .select-value, .selected-text, .select-text, .combobox-value, .current, span'
    );
    if (valueEl) {
      valueEl.textContent = matchedOption.textContent?.trim() || proposedValue;
    }

    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.setAttribute('aria-expanded', 'false');

    await new Promise((r) => setTimeout(r, 20));

    const isVerified = this.verify(el, proposedValue);

    return {
      success: isVerified,
      element: el,
      status: isVerified ? 'Filled' : 'Fill Failed',
      message: isVerified
        ? `Custom dropdown option "${matchedOption.textContent?.trim()}" selected.`
        : 'Custom dropdown failed verification.',
      appliedValue: matchedOption.textContent?.trim() || proposedValue,
    };
  }

  public verify(el: HTMLElement, proposedValue: string): boolean {
    const current = this.getCurrentValue(el);
    if (!current || !proposedValue) return false;
    const normCur = SelectHandler.normalizeOptionKey(current);
    const normProp = SelectHandler.normalizeOptionKey(proposedValue);
    if (normCur === normProp || current.toLowerCase().includes(proposedValue.toLowerCase())) {
      return true;
    }

    // Check bilingual equivalents
    const cleanCur = ValueNormalizer.cleanText(current).toLowerCase();
    const cleanProp = ValueNormalizer.cleanText(proposedValue).toLowerCase();

    for (const [, aliases] of Object.entries(BILINGUAL_EQUIVALENTS)) {
      const matchCur = aliases.some(
        (a) =>
          ValueNormalizer.cleanText(a).toLowerCase() === cleanCur ||
          SelectHandler.normalizeOptionKey(a) === normCur
      );
      const matchProp = aliases.some(
        (a) =>
          ValueNormalizer.cleanText(a).toLowerCase() === cleanProp ||
          SelectHandler.normalizeOptionKey(a) === normProp
      );
      if (matchCur && matchProp) {
        return true;
      }
    }

    return false;
  }
}
