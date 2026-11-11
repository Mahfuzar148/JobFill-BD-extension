// JobFill BD - Universal Field Extractor (18-Evidence Extraction)
// Scans, validates, and extracts detailed evidence descriptors from form elements.

import { LabelResolver } from './label-resolver';
import { FieldContext, FormSectionContext } from './field-context';

export interface ExtractedField {
  element: HTMLElement;
  tagName: string;
  inputType: string;
  name: string;
  id: string;
  placeholder: string;
  ariaLabel: string;
  associatedLabel: string;
  nearbyText: string;
  parentSection: FormSectionContext;
  fieldsetLegend: string;
  required: boolean;
  disabled: boolean;
  readOnly: boolean;
  currentValue: string;
  options: { value: string; text: string }[];
  visible: boolean;
  editable: boolean;
  formIndex: number;
}

export class FieldExtractor {
  /**
   * Scans a container (or document) and extracts all candidate fillable form controls.
   */
  public static extractFields(root: ParentNode = document): ExtractedField[] {
    const candidates = root.querySelectorAll<HTMLElement>(
      'input, select, textarea, [contenteditable="true"]'
    );

    const results: ExtractedField[] = [];
    let index = 0;

    candidates.forEach((el) => {
      if (this.isIgnoredElement(el)) return;

      const tagName = el.tagName.toLowerCase();
      const inputType = el instanceof HTMLInputElement ? (el.type || 'text').toLowerCase() : tagName;
      const name = el.getAttribute('name') || '';
      const id = el.getAttribute('id') || '';
      const placeholder = el.getAttribute('placeholder') || '';
      const ariaLabel = el.getAttribute('aria-label') || '';
      const associatedLabel = LabelResolver.resolveLabel(el);
      const parentSection = FieldContext.resolveContext(el);

      const fieldset = el.closest('fieldset');
      const fieldsetLegend = fieldset?.querySelector('legend')?.textContent?.trim() || '';

      const disabled = (el as any).disabled === true || el.getAttribute('aria-disabled') === 'true';
      const readOnly = (el as any).readOnly === true;
      const required = (el as any).required === true || el.getAttribute('aria-required') === 'true';
      const visible = this.isElementVisible(el);
      const editable = !disabled && !readOnly && visible;

      // Extract current value
      let currentValue = '';
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        currentValue = el.value || '';
      } else if (el instanceof HTMLSelectElement) {
        currentValue = el.value || '';
      }

      // Extract options if select
      const options: { value: string; text: string }[] = [];
      if (el instanceof HTMLSelectElement) {
        Array.from(el.options).forEach((opt) => {
          options.push({ value: opt.value, text: opt.text.trim() });
        });
      }

      // Extract nearby text (previous and next sibling text)
      const nearbyText = `${el.previousElementSibling?.textContent || ''} ${el.nextElementSibling?.textContent || ''}`.trim();

      results.push({
        element: el,
        tagName,
        inputType,
        name,
        id,
        placeholder,
        ariaLabel,
        associatedLabel,
        nearbyText,
        parentSection,
        fieldsetLegend,
        required,
        disabled,
        readOnly,
        currentValue,
        options,
        visible,
        editable,
        formIndex: index++,
      });
    });

    return results;
  }

  /**
   * Identifies non-fillable elements: CAPTCHA, OTP, Password, Submit, Hidden session tokens.
   */
  public static isIgnoredElement(el: HTMLElement): boolean {
    const tagName = el.tagName.toLowerCase();
    const type = (el.getAttribute('type') || '').toLowerCase();
    const name = (el.getAttribute('name') || '').toLowerCase();
    const id = (el.getAttribute('id') || '').toLowerCase();

    // Ignore button, submit, reset
    if (tagName === 'button' || type === 'submit' || type === 'reset' || type === 'button') {
      return true;
    }

    // Ignore password fields
    if (type === 'password') return true;

    // Ignore hidden inputs (inspect only, never fill)
    if (type === 'hidden') return true;

    // Ignore CAPTCHA and OTP
    if (
      name.includes('captcha') ||
      name.includes('val_code') ||
      name.includes('security_code') ||
      id.includes('captcha') ||
      name.includes('otp') ||
      name.includes('token')
    ) {
      return true;
    }

    // Ignore extension injected widgets
    if (el.closest('#jobfill-floating-trigger') || el.closest('#jobfill-review-modal-backdrop')) {
      return true;
    }

    return false;
  }

  private static isElementVisible(el: HTMLElement): boolean {
    if (el.style.display === 'none' || el.style.visibility === 'hidden' || el.hidden) {
      return false;
    }
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0 && !el.getClientRects().length) {
      // Element might be detached or collapsed
      return false;
    }
    return true;
  }
}
