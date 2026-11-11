// JobFill BD - Checkbox Control Handler
// Handles boolean checkboxes: Same as Present Address, Currently Working, Conditional Section Toggles.
// Strictly enforces Safety Policy: NEVER auto-checks legal declarations, oath/certifying statements, or terms.

import { ControlHandler, ControlFillResult } from './types';
import { ValueNormalizer } from '../intelligence/value-normalizer';
import { safeEscape } from '../utils/dom';

export class CheckboxHandler implements ControlHandler {
  public readonly controlType = 'checkbox';

  public canHandle(el: HTMLElement): boolean {
    return el instanceof HTMLInputElement && el.type.toLowerCase() === 'checkbox';
  }

  // Identifies whether this checkbox represents an oath, legal declaration, or terms & conditions
  public isDeclarationOrTermsCheckbox(el: HTMLInputElement): boolean {
    const name = (el.name || '').toLowerCase();
    const id = (el.id || '').toLowerCase();
    const label = this.getCheckboxLabelText(el).toLowerCase();

    const declarationSignatures = [
      'declaration',
      'declare',
      'certify',
      'affirm',
      'terms',
      'condition',
      'agree',
      'accept',
      'disclaimer',
      'rules',
      'সত্যতা',
      'ঘোষণা',
      'অঙ্গীকার',
      'শর্তাবলী',
      'সম্মত',
      'প্রত্যয়ন',
    ];

    return declarationSignatures.some(
      (sig) => name.includes(sig) || id.includes(sig) || label.includes(sig)
    );
  }

  public getCheckboxLabelText(cb: HTMLInputElement): string {
    let text = '';
    if (cb.id) {
      const lbl = document.querySelector(`label[for="${safeEscape(cb.id)}"]`);
      if (lbl) text = lbl.textContent || '';
    }
    if (!text) {
      const parentLabel = cb.closest('label');
      if (parentLabel) text = parentLabel.textContent || '';
    }
    if (!text && cb.nextSibling) {
      text = cb.nextSibling.textContent || '';
    }
    if (!text && cb.parentElement) {
      text = cb.parentElement.textContent || '';
    }
    return ValueNormalizer.cleanText(text);
  }

  public isBooleanTrue(val: any): boolean {
    if (typeof val === 'boolean') return val;
    const str = String(val || '').toLowerCase().trim();
    return str === 'true' || str === '1' || str === 'yes' || str === 'on' || str === 'checked' || str === 'হ্যাঁ';
  }

  public getCurrentValue(el: HTMLElement): string {
    if (!(el instanceof HTMLInputElement)) return 'false';
    return el.checked ? 'true' : 'false';
  }

  public isAlreadyCorrect(el: HTMLElement, proposedValue: string): boolean {
    if (!(el instanceof HTMLInputElement)) return false;
    const expected = this.isBooleanTrue(proposedValue);
    return el.checked === expected;
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

    // STRICT SAFETY POLICY: Reject auto-checking legal declarations
    if (this.isDeclarationOrTermsCheckbox(el)) {
      return {
        success: false,
        element: el,
        status: 'Fill Failed',
        message: 'Safety Policy: Legal declarations and terms must be checked manually by the applicant.',
        appliedValue: el.checked ? 'true' : 'false',
      };
    }

    const shouldBeChecked = this.isBooleanTrue(proposedValue);

    try {
      if (el.checked !== shouldBeChecked) {
        const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'checked');
        if (desc && desc.set) {
          desc.set.call(el, shouldBeChecked);
        } else {
          el.checked = shouldBeChecked;
        }
      }

      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));

      await new Promise((r) => setTimeout(r, 40));

      const isVerified = el.checked === shouldBeChecked;
      if (isVerified) {
        return {
          success: true,
          element: el,
          status: 'Filled',
          message: `Checkbox successfully ${shouldBeChecked ? 'checked' : 'unchecked'}.`,
          appliedValue: shouldBeChecked ? 'true' : 'false',
        };
      } else {
        return {
          success: false,
          element: el,
          status: 'Fill Failed',
          message: 'Checkbox checked state was reverted by website.',
          appliedValue: el.checked ? 'true' : 'false',
        };
      }
    } catch (err: any) {
      return {
        success: false,
        element: el,
        status: 'Fill Failed',
        message: `Checkbox fill error: ${err.message}`,
        appliedValue: proposedValue,
      };
    }
  }

  public verify(el: HTMLElement, proposedValue: string): boolean {
    if (!(el instanceof HTMLInputElement)) return false;
    const expected = this.isBooleanTrue(proposedValue);
    return el.checked === expected;
  }
}
