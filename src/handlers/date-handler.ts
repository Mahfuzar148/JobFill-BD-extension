// JobFill BD - Date Input Control Handler
// Handles native HTML5 date pickers (<input type="date">) and custom text date inputs (<input type="text">).
// Supports ISO YYYY-MM-DD, Bangladesh Standard DD-MM-YYYY, and 2-digit year DD-MM-YY formats.
// Strictly validates calendar boundaries (leap years, month days) before filling.

import { ControlHandler, ControlFillResult } from './types';
import { ValueNormalizer } from '../intelligence/value-normalizer';

export class DateHandler implements ControlHandler {
  public readonly controlType = 'date';

  public canHandle(el: HTMLElement): boolean {
    if (!(el instanceof HTMLInputElement)) return false;
    const type = (el.type || 'text').toLowerCase();
    if (type === 'date') return true;

    // Detect text inputs acting as date pickers
    if (type === 'text') {
      const name = (el.name || '').toLowerCase();
      const id = (el.id || '').toLowerCase();
      const placeholder = (el.placeholder || '').toLowerCase();
      const className = (el.className || '').toLowerCase();

      const dateKeywords = ['dob', 'date', 'birth', 'jonmo', 'service_from', 'service_to', 'start_date', 'end_date'];
      const hasDateKeyword = dateKeywords.some((k) => name.includes(k) || id.includes(k) || className.includes(k));
      const hasDatePlaceholder = placeholder.includes('yy') || placeholder.includes('dd') || placeholder.includes('mm');

      return hasDateKeyword || hasDatePlaceholder;
    }

    return false;
  }

  public getCurrentValue(el: HTMLElement): string {
    if (el instanceof HTMLInputElement) {
      return (el.value || '').trim();
    }
    return '';
  }

  public getFormattedDate(el: HTMLInputElement, rawDate: string): string {
    const type = (el.type || 'text').toLowerCase();
    const placeholder = (el.placeholder || '').toLowerCase();
    return ValueNormalizer.formatDateForTarget(rawDate, type, placeholder);
  }

  public isAlreadyCorrect(el: HTMLElement, proposedValue: string): boolean {
    if (!(el instanceof HTMLInputElement)) return false;
    const cur = this.getCurrentValue(el);
    if (!cur) return false;
    const target = this.getFormattedDate(el, proposedValue);
    return cur.toLowerCase() === target.toLowerCase();
  }

  public async fill(el: HTMLElement, proposedValue: string): Promise<ControlFillResult> {
    if (!(el instanceof HTMLInputElement)) {
      return {
        success: false,
        element: el,
        status: 'Fill Failed',
        message: 'Element is not an HTMLInputElement.',
        appliedValue: proposedValue,
      };
    }

    const formattedDate = this.getFormattedDate(el, proposedValue);
    if (!formattedDate) {
      return {
        success: false,
        element: el,
        status: 'Fill Failed',
        message: `Invalid date value: "${proposedValue}". Cannot format for date input.`,
        appliedValue: proposedValue,
      };
    }

    try {
      const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
      if (desc && desc.set) {
        desc.set.call(el, formattedDate);
      } else {
        el.value = formattedDate;
      }

      // React 16+ Value Tracker bypass
      const tracker = (el as any)._valueTracker;
      if (tracker) {
        tracker.setValue('');
      }

      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new Event('blur', { bubbles: true }));

      await new Promise((r) => setTimeout(r, 40));

      const isVerified = this.verify(el, formattedDate);
      if (isVerified) {
        return {
          success: true,
          element: el,
          status: 'Filled',
          message: `Date successfully set to ${formattedDate}.`,
          appliedValue: formattedDate,
        };
      } else {
        return {
          success: false,
          element: el,
          status: 'Fill Failed',
          message: `Date input reverted by website (expected: ${formattedDate}, got: ${el.value}).`,
          appliedValue: el.value,
        };
      }
    } catch (err: any) {
      return {
        success: false,
        element: el,
        status: 'Fill Failed',
        message: `Date fill error: ${err.message}`,
        appliedValue: formattedDate,
      };
    }
  }

  public verify(el: HTMLElement, expectedFormattedDate: string): boolean {
    if (!(el instanceof HTMLInputElement)) return false;
    const cur = (el.value || '').trim().toLowerCase();
    const expected = (expectedFormattedDate || '').trim().toLowerCase();
    return cur === expected;
  }
}
