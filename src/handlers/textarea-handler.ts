// JobFill BD - Textarea Control Handler
// Handles multi-line textareas (e.g. Job Description, Responsibilities, Addresses).
// Enforces maxLength constraints, preserves formatting, and triggers framework change notifications.

import { ControlHandler, ControlFillResult } from './types';

export class TextareaHandler implements ControlHandler {
  public readonly controlType = 'textarea';

  public canHandle(el: HTMLElement): boolean {
    return el instanceof HTMLTextAreaElement || el.tagName.toLowerCase() === 'textarea';
  }

  public getCurrentValue(el: HTMLElement): string {
    if (el instanceof HTMLTextAreaElement || el.tagName.toLowerCase() === 'textarea') {
      return ((el as HTMLTextAreaElement).value || '').trim();
    }
    return '';
  }

  public isAlreadyCorrect(el: HTMLElement, proposedValue: string): boolean {
    const cur = this.getCurrentValue(el);
    const prop = (proposedValue || '').trim();
    if (!cur || !prop) return false;
    return cur.toLowerCase() === prop.toLowerCase();
  }

  public async fill(el: HTMLElement, proposedValue: string): Promise<ControlFillResult> {
    const textarea = el as HTMLTextAreaElement;
    if (!textarea || typeof textarea.value === 'undefined') {
      return {
        success: false,
        element: el,
        status: 'Fill Failed',
        message: 'Element is not an HTMLTextAreaElement.',
        appliedValue: proposedValue,
      };
    }

    let val = String(proposedValue || '');
    const maxLen = parseInt(textarea.getAttribute('maxlength') || '0', 10);
    if (maxLen > 0 && val.length > maxLen) {
      val = val.substring(0, maxLen);
    }

    try {
      const desc = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
      if (desc && desc.set) {
        desc.set.call(textarea, val);
      } else {
        textarea.value = val;
      }

      // React 16+ Value Tracker bypass
      const tracker = (textarea as any)._valueTracker;
      if (tracker) {
        tracker.setValue('');
      }

      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.dispatchEvent(new Event('change', { bubbles: true }));
      textarea.dispatchEvent(new Event('blur', { bubbles: true }));

      await new Promise((r) => setTimeout(r, 40));

      const isVerified = this.verify(textarea, val);
      if (isVerified) {
        return {
          success: true,
          element: textarea,
          status: 'Filled',
          message: 'Textarea successfully populated and verified.',
          appliedValue: val,
        };
      } else {
        return {
          success: false,
          element: textarea,
          status: 'Fill Failed',
          message: 'Textarea value reverted by website.',
          appliedValue: textarea.value,
        };
      }
    } catch (err: any) {
      return {
        success: false,
        element: textarea,
        status: 'Fill Failed',
        message: `Textarea fill error: ${err.message}`,
        appliedValue: proposedValue,
      };
    }
  }

  public verify(el: HTMLElement, proposedValue: string): boolean {
    const textarea = el as HTMLTextAreaElement;
    const cur = (textarea.value || '').trim();
    const prop = (proposedValue || '').trim();
    if (!prop) return true;
    return cur === prop || cur.startsWith(prop.substring(0, 10));
  }
}
