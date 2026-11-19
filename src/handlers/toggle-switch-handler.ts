// JobFill BD - Toggle Switch Control Handler
// Handles accessible on/off switches (role="switch", aria-checked, or checkbox-backed toggle switches).
// Enforces state idempotency: only clicks or toggles when the current boolean state differs from target state.
// Prevents toggle oscillation and reads back verified state.

import { ControlHandler, ControlFillResult } from './types';
import { ValueNormalizer } from '../intelligence/value-normalizer';

export class ToggleSwitchHandler implements ControlHandler {
  public readonly controlType = 'switch';

  public canHandle(el: HTMLElement): boolean {
    const role = (el.getAttribute('role') || '').toLowerCase();
    if (role === 'switch') return true;

    if (el instanceof HTMLInputElement && el.type.toLowerCase() === 'checkbox') {
      if (role === 'switch' || el.classList.contains('switch') || el.classList.contains('toggle')) {
        return true;
      }
    }

    if (el.hasAttribute('aria-checked') && (el.classList.contains('switch') || el.classList.contains('toggle') || el.classList.contains('custom-switch'))) {
      return true;
    }

    return false;
  }

  public isBooleanTrue(val: any): boolean {
    if (typeof val === 'boolean') return val;
    const str = String(val || '').toLowerCase().trim();
    return str === 'true' || str === '1' || str === 'yes' || str === 'on' || str === 'checked' || str === 'হ্যাঁ';
  }

  public getCurrentValue(el: HTMLElement): string {
    if (el instanceof HTMLInputElement && el.type.toLowerCase() === 'checkbox') {
      return el.checked ? 'true' : 'false';
    }
    const ariaChecked = el.getAttribute('aria-checked');
    if (ariaChecked !== null) {
      return ariaChecked === 'true' ? 'true' : 'false';
    }
    const dataState = el.getAttribute('data-state');
    if (dataState === 'checked' || dataState === 'on') return 'true';
    if (dataState === 'unchecked' || dataState === 'off') return 'false';

    return el.classList.contains('active') || el.classList.contains('checked') ? 'true' : 'false';
  }

  public isAlreadyCorrect(el: HTMLElement, proposedValue: string | boolean): boolean {
    const targetBool = this.isBooleanTrue(proposedValue);
    const currentBool = this.getCurrentValue(el) === 'true';
    return targetBool === currentBool;
  }

  public async fill(el: HTMLElement, proposedValue: string | boolean): Promise<ControlFillResult> {
    const targetBool = this.isBooleanTrue(proposedValue);
    const currentBool = this.getCurrentValue(el) === 'true';

    // Idempotent: do not toggle if already in desired state (prevents flipping)
    if (targetBool === currentBool) {
      return {
        success: true,
        element: el,
        status: 'Already Correct',
        message: `Toggle switch is already ${targetBool ? 'ON' : 'OFF'}.`,
        appliedValue: targetBool ? 'true' : 'false',
      };
    }

    try {
      // 1. If it's an HTMLInputElement checkbox backed switch
      if (el instanceof HTMLInputElement && el.type.toLowerCase() === 'checkbox') {
        const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'checked');
        if (desc && desc.set) {
          desc.set.call(el, targetBool);
        } else {
          el.checked = targetBool;
        }

        const tracker = (el as any)._valueTracker;
        if (tracker) {
          tracker.setValue(currentBool ? 'true' : 'false');
        }

        el.setAttribute('aria-checked', targetBool ? 'true' : 'false');
        el.dispatchEvent(new Event('click', { bubbles: true }));
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        // 2. Custom ARIA switch
        el.setAttribute('aria-checked', targetBool ? 'true' : 'false');
        if (targetBool) {
          el.classList.add('checked', 'active');
          el.classList.remove('unchecked');
          el.setAttribute('data-state', 'checked');
        } else {
          el.classList.remove('checked', 'active');
          el.classList.add('unchecked');
          el.setAttribute('data-state', 'unchecked');
        }

        el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }

      await new Promise((r) => setTimeout(r, 40));

      const finalState = this.getCurrentValue(el) === 'true';
      if (finalState === targetBool) {
        return {
          success: true,
          element: el,
          status: 'Filled',
          message: `Toggle switch set to ${targetBool ? 'ON' : 'OFF'}.`,
          appliedValue: targetBool ? 'true' : 'false',
        };
      }

      return {
        success: false,
        element: el,
        status: 'Fill Failed',
        message: `Toggle switch did not retain requested state ${targetBool ? 'ON' : 'OFF'}.`,
        appliedValue: this.getCurrentValue(el),
      };
    } catch (err: any) {
      return {
        success: false,
        element: el,
        status: 'Fill Failed',
        message: `Toggle switch interaction error: ${err.message}`,
        appliedValue: this.getCurrentValue(el),
      };
    }
  }

  public verify(el: HTMLElement, proposedValue: string | boolean): boolean {
    const targetBool = this.isBooleanTrue(proposedValue);
    const currentBool = this.getCurrentValue(el) === 'true';
    return targetBool === currentBool;
  }
}
