// JobFill BD - Text Input Control Handler
// Preserves existing working text input autofill engine without modification or breaking changes.
// Supports native text, email, tel, number, search, url, and password-safe inputs.
// Handles React/Vue/Angular synthetic value trackers.

import { ControlHandler, ControlFillResult } from './types';

export class TextInputHandler implements ControlHandler {
  public readonly controlType = 'text';

  public canHandle(el: HTMLElement): boolean {
    if (!(el instanceof HTMLInputElement)) return false;
    const type = (el.type || 'text').toLowerCase();
    // Non-text input types handled by specialized handlers
    if (['radio', 'checkbox', 'date', 'select', 'textarea', 'file', 'submit', 'button', 'reset', 'hidden'].includes(type)) {
      return false;
    }
    return true;
  }

  public getCurrentValue(el: HTMLElement): string {
    if (el instanceof HTMLInputElement) {
      return (el.value || '').trim();
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
    if (!(el instanceof HTMLInputElement)) {
      return {
        success: false,
        element: el,
        status: 'Fill Failed',
        message: 'Element is not an HTMLInputElement.',
        appliedValue: proposedValue,
      };
    }

    const val = String(proposedValue || '');

    try {
      // 1. Prototype setter for React/Vue/Angular controlled inputs
      const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
      if (desc && desc.set) {
        desc.set.call(el, val);
      } else {
        el.value = val;
      }

      // 2. React 16+ Value Tracker bypass
      const tracker = (el as any)._valueTracker;
      if (tracker) {
        tracker.setValue('');
      }

      // 3. Dispatch standard bubbling DOM events
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new Event('blur', { bubbles: true }));

      // 4. Microtask debounce for reactive framework state sync
      await new Promise((r) => setTimeout(r, 40));

      const isVerified = this.verify(el, val);
      if (isVerified) {
        return {
          success: true,
          element: el,
          status: 'Filled',
          message: 'Text input successfully populated and verified.',
          appliedValue: val,
        };
      } else {
        return {
          success: false,
          element: el,
          status: 'Fill Failed',
          message: 'Text input value reverted by host website.',
          appliedValue: el.value,
        };
      }
    } catch (err: any) {
      return {
        success: false,
        element: el,
        status: 'Fill Failed',
        message: `Text input fill error: ${err.message}`,
        appliedValue: proposedValue,
      };
    }
  }

  public verify(el: HTMLElement, proposedValue: string): boolean {
    if (!(el instanceof HTMLInputElement)) return false;
    const cur = (el.value || '').trim();
    const prop = (proposedValue || '').trim();
    if (!prop) return true;
    return cur === prop || cur.startsWith(prop.substring(0, 5));
  }
}
