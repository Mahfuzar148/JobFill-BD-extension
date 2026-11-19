// JobFill BD - Text Input Control Handler
// Preserves existing working text input autofill engine without modification or breaking changes.
// Supports native text, email, tel, number, search, url, and password-safe inputs.
// Handles React/Vue/Angular synthetic value trackers.

import { ControlHandler, ControlFillResult } from './types';
import { ValueNormalizer } from '../intelligence/value-normalizer';

export class TextInputHandler implements ControlHandler {
  public readonly controlType = 'text';

  public canHandle(el: HTMLElement): boolean {
    if (el.isContentEditable || el.getAttribute('contenteditable') === 'true' || el.getAttribute('contenteditable') === '') {
      return true;
    }
    if (!(el instanceof HTMLInputElement)) return false;
    const type = (el.type || 'text').toLowerCase();
    // Non-text input types handled by specialized handlers
    if (['radio', 'checkbox', 'date', 'month', 'week', 'time', 'datetime-local', 'select', 'textarea', 'file', 'submit', 'button', 'reset', 'hidden'].includes(type)) {
      return false;
    }
    return true;
  }

  public getCurrentValue(el: HTMLElement): string {
    if (el instanceof HTMLInputElement) {
      return (el.value || '').trim();
    }
    if (el.isContentEditable || el.getAttribute('contenteditable') === 'true' || el.getAttribute('contenteditable') === '') {
      return (el.textContent || (el as any).innerText || '').trim();
    }
    return '';
  }

  public isAlreadyCorrect(el: HTMLElement, proposedValue: string): boolean {
    const cur = this.getCurrentValue(el);
    const prop = (proposedValue || '').trim();
    if (!cur || !prop) return false;
    if (el instanceof HTMLInputElement && (el.hasAttribute('list') || el.list)) {
      const resolved = this.resolveDatalistValue(el, prop);
      if (cur.toLowerCase() === resolved.toLowerCase()) return true;
    }
    return cur.toLowerCase() === prop.toLowerCase();
  }

  // Resolves datalist suggestions against proposed values and aliases
  private resolveDatalistValue(el: HTMLInputElement, proposedValue: string): string {
    const listId = el.getAttribute('list');
    const datalist = el.list || (listId ? document.getElementById(listId) : null);
    if (!datalist) return proposedValue;

    const options = Array.from(datalist.querySelectorAll('option'));
    if (options.length === 0) return proposedValue;

    const prop = (proposedValue || '').trim();
    const cleanProp = ValueNormalizer.cleanText(prop);

    // 1. Direct match with option value or text (case-insensitive)
    for (const opt of options) {
      const optVal = (opt.value || opt.getAttribute('value') || '').trim();
      const optText = (opt.textContent || opt.label || '').trim();
      if (optVal.toLowerCase() === prop.toLowerCase() || optText.toLowerCase() === prop.toLowerCase()) {
        return optVal || optText;
      }
    }

    // 2. Normalized clean text match
    for (const opt of options) {
      const optVal = (opt.value || opt.getAttribute('value') || '').trim();
      const optText = (opt.textContent || opt.label || '').trim();
      const cleanVal = ValueNormalizer.cleanText(optVal);
      const cleanText = ValueNormalizer.cleanText(optText);
      if (cleanVal === cleanProp || cleanText === cleanProp) {
        return optVal || optText;
      }
    }

    // 3. Substring / Token inclusion match
    for (const opt of options) {
      const optVal = (opt.value || opt.getAttribute('value') || '').trim();
      const optText = (opt.textContent || opt.label || '').trim();
      const cleanVal = ValueNormalizer.cleanText(optVal);
      const cleanText = ValueNormalizer.cleanText(optText);
      if (
        (cleanVal && (cleanVal.includes(cleanProp) || cleanProp.includes(cleanVal))) ||
        (cleanText && (cleanText.includes(cleanProp) || cleanProp.includes(cleanText)))
      ) {
        return optVal || optText;
      }
    }

    return proposedValue;
  }

  public async fill(el: HTMLElement, proposedValue: string): Promise<ControlFillResult> {
    const isContentEditable = el.isContentEditable || el.getAttribute('contenteditable') === 'true' || el.getAttribute('contenteditable') === '';
    if (!(el instanceof HTMLInputElement) && !isContentEditable) {
      return {
        success: false,
        element: el,
        status: 'Fill Failed',
        message: 'Element is not an HTMLInputElement or contenteditable element.',
        appliedValue: proposedValue,
      };
    }

    let val = String(proposedValue || '');

    // Handle ContentEditable elements safely
    if (isContentEditable) {
      try {
        el.focus();
        el.textContent = val;
        try {
          el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: val }));
        } catch {
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('blur', { bubbles: true }));

        await new Promise((r) => setTimeout(r, 40));

        const isVerified = this.verify(el, val);
        if (isVerified) {
          return {
            success: true,
            element: el,
            status: 'Filled',
            message: 'Contenteditable element successfully populated and verified.',
            appliedValue: val,
          };
        } else {
          return {
            success: false,
            element: el,
            status: 'Fill Failed',
            message: 'Contenteditable element value reverted by host website.',
            appliedValue: this.getCurrentValue(el),
          };
        }
      } catch (err: any) {
        return {
          success: false,
          element: el,
          status: 'Fill Failed',
          message: `Contenteditable fill error: ${err.message}`,
          appliedValue: proposedValue,
        };
      }
    }

    const inputEl = el as HTMLInputElement;

    // Resolve Datalist options if linked datalist exists
    if (inputEl.hasAttribute('list') || inputEl.list) {
      val = this.resolveDatalistValue(inputEl, val);
    }

    const nameLower = (inputEl.name || '').toLowerCase();
    const idLower = (inputEl.id || '').toLowerCase();
    const placeholderLower = (inputEl.placeholder || '').toLowerCase();
    const isMobileField =
      inputEl.type === 'tel' ||
      nameLower.includes('mobile') ||
      idLower.includes('mobile') ||
      nameLower.includes('phone') ||
      idLower.includes('phone') ||
      placeholderLower.includes('01x');

    if (isMobileField) {
      // 1. Strictly normalize as Bangladeshi mobile string (preserve leading 0, convert Bengali digits)
      val = ValueNormalizer.normalizeMobileNumber(val);

      // 2. Reject incomplete or corrupted mobile numbers (like "2" or short fragments)
      if (!val || val.length !== 11 || !val.startsWith('01') || !/^\d{11}$/.test(val)) {
        return {
          success: false,
          element: inputEl,
          status: 'Fill Failed',
          message: `Validation Rejected: Mobile number must be a valid 11-digit string starting with 01. Incomplete or invalid value "${proposedValue}" rejected.`,
          appliedValue: inputEl.value,
        };
      }
    }

    // Safety: If input has explicit maxLength shorter than normalized value, reject silent truncation
    if (inputEl.maxLength > 0 && val.length > inputEl.maxLength) {
      return {
        success: false,
        element: inputEl,
        status: 'Fill Failed',
        message: `Validation Rejected: proposed value length (${val.length}) exceeds field maxLength (${inputEl.maxLength}). Silent truncation rejected.`,
        appliedValue: proposedValue,
      };
    }

    try {
      inputEl.focus();

      // Clear existing value first so input masks and framework state reset
      const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
      if (desc && desc.set) {
        desc.set.call(inputEl, '');
      } else {
        inputEl.value = '';
      }
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));

      // Set complete string value via prototype setter
      if (desc && desc.set) {
        desc.set.call(inputEl, val);
      } else {
        inputEl.value = val;
      }

      // React 16+ Value Tracker bypass
      const tracker = (inputEl as any)._valueTracker;
      if (tracker) {
        tracker.setValue('');
      }

      // Dispatch standard bubbling DOM events and modern InputEvent with text data
      try {
        inputEl.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: val }));
      } catch {
        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      }
      inputEl.dispatchEvent(new Event('change', { bubbles: true }));
      inputEl.dispatchEvent(new Event('blur', { bubbles: true }));

      // Host page jQuery compatibility (used widely across Teletalk portals)
      try {
        if (typeof (window as any).$ === 'function') {
          (window as any).$(inputEl).trigger('input').trigger('change').trigger('blur');
        }
      } catch {}

      // Microtask debounce for reactive framework state sync
      await new Promise((r) => setTimeout(r, 40));

      const isVerified = this.verify(inputEl, val);
      if (isVerified) {
        return {
          success: true,
          element: inputEl,
          status: 'Filled',
          message: 'Text input successfully populated and verified.',
          appliedValue: val,
        };
      } else {
        return {
          success: false,
          element: inputEl,
          status: 'Fill Failed',
          message: 'Text input value reverted by host website.',
          appliedValue: inputEl.value,
        };
      }
    } catch (err: any) {
      return {
        success: false,
        element: inputEl,
        status: 'Fill Failed',
        message: `Text input fill error: ${err.message}`,
        appliedValue: proposedValue,
      };
    }
  }

  public verify(el: HTMLElement, proposedValue: string): boolean {
    const isContentEditable = el.isContentEditable || el.getAttribute('contenteditable') === 'true' || el.getAttribute('contenteditable') === '';
    if (!(el instanceof HTMLInputElement) && !isContentEditable) return false;
    const cur = this.getCurrentValue(el);
    const prop = (proposedValue || '').trim();
    if (!prop) return true;

    if (isContentEditable) {
      return cur === prop || cur.toLowerCase() === prop.toLowerCase();
    }

    const inputEl = el as HTMLInputElement;

    if (inputEl.hasAttribute('list') || inputEl.list) {
      const matchedDatalistVal = this.resolveDatalistValue(inputEl, prop);
      if (cur === matchedDatalistVal || cur.toLowerCase() === matchedDatalistVal.toLowerCase()) {
        return true;
      }
    }

    const nameLower = (inputEl.name || '').toLowerCase();
    const idLower = (inputEl.id || '').toLowerCase();
    const placeholderLower = (inputEl.placeholder || '').toLowerCase();
    const isMobileField =
      inputEl.type === 'tel' ||
      nameLower.includes('mobile') ||
      idLower.includes('mobile') ||
      nameLower.includes('phone') ||
      idLower.includes('phone') ||
      placeholderLower.includes('01x');

    if (isMobileField) {
      // Mobile Number verification strictly requires the full 11-digit string matching identically
      const cleanCur = ValueNormalizer.normalizeMobileNumber(cur);
      const cleanProp = ValueNormalizer.normalizeMobileNumber(prop);
      return cleanCur.length === 11 && cleanCur === cleanProp;
    }

    return cur === prop || cur.toLowerCase() === prop.toLowerCase();
  }
}
