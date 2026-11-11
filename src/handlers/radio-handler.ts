// JobFill BD - Radio Button Group Control Handler
// Identifies radio groups by name and context (Gender, Marital Status, Departmental Status, Quotas).
// Resolves bilingual text/labels (Male/Female, Yes/No), activates matched radios, and dispatches events.

import { ControlHandler, ControlFillResult } from './types';
import { BILINGUAL_EQUIVALENTS } from '../engine/dropdownMatcher';
import { ValueNormalizer } from '../intelligence/value-normalizer';
import { safeEscape } from '../utils/dom';

export class RadioHandler implements ControlHandler {
  public readonly controlType = 'radio';

  public canHandle(el: HTMLElement): boolean {
    return el instanceof HTMLInputElement && el.type.toLowerCase() === 'radio';
  }

  // Returns all radio buttons belonging to the same named group
  public getRadioGroup(el: HTMLInputElement): HTMLInputElement[] {
    const name = el.name;
    if (!name) return [el];

    if (el.form) {
      return Array.from(el.form.elements).filter(
        (item): item is HTMLInputElement => item instanceof HTMLInputElement && item.type.toLowerCase() === 'radio' && item.name === name
      );
    }

    // Fallback: search enclosing container or document
    const root = el.closest('fieldset, form, table, .section') || document;
    return Array.from(root.querySelectorAll<HTMLInputElement>(`input[type="radio"][name="${safeEscape(name)}"]`));
  }

  // Extracts visible label text associated with a specific radio button
  public getRadioLabelText(radio: HTMLInputElement): string {
    let labelText = '';

    // 1. Label with for="radio_id"
    if (radio.id) {
      const lbl = document.querySelector(`label[for="${safeEscape(radio.id)}"]`);
      if (lbl) labelText = lbl.textContent || '';
    }

    // 2. Enclosing <label>
    if (!labelText) {
      const parentLabel = radio.closest('label');
      if (parentLabel) labelText = parentLabel.textContent || '';
    }

    // 3. Next adjacent sibling text or element
    if (!labelText && radio.nextSibling) {
      labelText = radio.nextSibling.textContent || '';
    }

    // 4. Fallback to parent TD or container text
    if (!labelText && radio.parentElement) {
      labelText = radio.parentElement.textContent || '';
    }

    return ValueNormalizer.cleanText(labelText);
  }

  // Gets the value/label of the currently checked radio in the group (or '' if none checked)
  public getCurrentValue(el: HTMLElement): string {
    if (!(el instanceof HTMLInputElement)) return '';
    const group = this.getRadioGroup(el);
    const checkedRadio = group.find((r) => r.checked);
    if (!checkedRadio) return '';

    const label = this.getRadioLabelText(checkedRadio);
    return label || checkedRadio.value;
  }

  public isAlreadyCorrect(el: HTMLElement, proposedValue: string): boolean {
    if (!(el instanceof HTMLInputElement)) return false;
    const group = this.getRadioGroup(el);
    const checkedRadio = group.find((r) => r.checked);
    if (!checkedRadio) return false;

    const matched = this.findMatchingRadio(group, proposedValue);
    if (!matched) return false;

    return checkedRadio === matched;
  }

  // Finds the specific radio button in the group that matches the target value
  public findMatchingRadio(group: HTMLInputElement[], targetValue: string): HTMLInputElement | null {
    if (!targetValue) return null;

    const normTarget = ValueNormalizer.cleanText(targetValue);
    const englishTarget = ValueNormalizer.toEnglishNumerals(normTarget);

    for (const radio of group) {
      const val = ValueNormalizer.cleanText(radio.value);
      const label = this.getRadioLabelText(radio);

      // 1. Exact value or label match
      if (val === normTarget || label === normTarget || val === englishTarget || label === englishTarget) {
        return radio;
      }

      // 2. Bilingual dictionary equivalence
      for (const [, aliases] of Object.entries(BILINGUAL_EQUIVALENTS)) {
        const targetMatchesGroup = aliases.some((a) => ValueNormalizer.cleanText(a) === normTarget);
        if (targetMatchesGroup) {
          if (aliases.some((a) => ValueNormalizer.cleanText(a) === val || ValueNormalizer.cleanText(a) === label)) {
            return radio;
          }
        }
      }

      // 3. Substring match (with gender safety guard)
      if (
        (normTarget === 'male' && (val === 'female' || label.toLowerCase().includes('female'))) ||
        (normTarget === 'female' && (val === 'm' || (val === 'male' && !val.includes('female')) || (label.toLowerCase().startsWith('male') && !label.toLowerCase().includes('female'))))
      ) {
        continue;
      }

      if (
        (val && (val.includes(normTarget) || normTarget.includes(val))) ||
        (label && (label.includes(normTarget) || normTarget.includes(label)))
      ) {
        return radio;
      }
    }

    return null;
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

    const group = this.getRadioGroup(el);
    const matchedRadio = this.findMatchingRadio(group, proposedValue);

    if (!matchedRadio) {
      return {
        success: false,
        element: el,
        status: 'Fill Failed',
        message: `No matching radio option found for "${proposedValue}" in group [name="${el.name}"].`,
        appliedValue: proposedValue,
      };
    }

    try {
      // Uncheck other radios in group
      for (const r of group) {
        if (r !== matchedRadio) {
          r.checked = false;
        }
      }

      // Native prototype descriptor setter for React / controlled frameworks
      const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'checked');
      if (desc && desc.set) {
        desc.set.call(matchedRadio, true);
      } else {
        matchedRadio.checked = true;
      }

      // Dispatch standard user interaction events
      matchedRadio.dispatchEvent(new Event('input', { bubbles: true }));
      matchedRadio.dispatchEvent(new Event('change', { bubbles: true }));

      await new Promise((r) => setTimeout(r, 40));

      const isVerified = matchedRadio.checked;
      if (isVerified) {
        const label = this.getRadioLabelText(matchedRadio);
        return {
          success: true,
          element: matchedRadio,
          status: 'Filled',
          message: `Radio option "${label || matchedRadio.value}" successfully selected.`,
          appliedValue: label || matchedRadio.value,
        };
      } else {
        return {
          success: false,
          element: matchedRadio,
          status: 'Fill Failed',
          message: 'Radio checked state was reverted by website.',
          appliedValue: matchedRadio.checked ? 'true' : 'false',
        };
      }
    } catch (err: any) {
      return {
        success: false,
        element: matchedRadio,
        status: 'Fill Failed',
        message: `Radio fill error: ${err.message}`,
        appliedValue: proposedValue,
      };
    }
  }

  public verify(el: HTMLElement, proposedValue: string): boolean {
    if (!(el instanceof HTMLInputElement)) return false;
    const group = this.getRadioGroup(el);
    const matched = this.findMatchingRadio(group, proposedValue);
    return !!matched && matched.checked;
  }
}
