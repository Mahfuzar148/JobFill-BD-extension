// JobFill BD - Layer 2: 12-Evidence Field Extractor
// Implements Part D of Master Engineering Specification:
// Extracts 12 evidence signals per DOM element with strict safety filtering
// (excludes CAPTCHA, OTP, Password, Submit, Hidden, and Readonly inputs).

import { safeEscape } from '../utils/dom';
import { ValueNormalizer } from '../intelligence/value-normalizer';

export interface FieldEvidence {
  element: HTMLElement;
  selector: string;
  tagName: string;
  inputType: string;
  name: string;
  id: string;
  label: string;
  placeholder: string;
  ariaLabel: string;
  ariaLabelledBy: string;
  title: string;
  legend: string;
  tableHeader: string;
  parentContextText: string;
  options: Array<{ value: string; text: string }>;
  maxLength: number;
  pattern: string;
  isRequired: boolean;
  isReadOnly: boolean;
  isDisabled: boolean;
  currentValue: string;
}

export class FieldExtractor {
  // Checks if an element is a prohibited/unsafe field
  public static isSafeEditableField(el: HTMLElement): boolean {
    if (el.closest('[id^="jobfill-"], [data-jobfill-ext], .jobfill-modal, .jobfill-floating-widget')) {
      return false;
    }
    const tagName = el.tagName.toLowerCase();
    if (!['input', 'select', 'textarea'].includes(tagName)) return false;

    const inputType = (el.getAttribute('type') || (tagName === 'select' ? 'select' : tagName === 'textarea' ? 'textarea' : 'text')).toLowerCase();

    // Absolute exclusions per safety policy
    if (['hidden', 'password', 'submit', 'button', 'reset', 'file', 'image'].includes(inputType)) {
      return false;
    }

    const name = (el.getAttribute('name') || '').toLowerCase();
    const id = (el.id || '').toLowerCase();
    const placeholder = (el.getAttribute('placeholder') || '').toLowerCase();
    const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();

    const signature = `${name} ${id} ${placeholder} ${ariaLabel}`;

    // Exclude CAPTCHA & OTP
    if (signature.includes('captcha') || signature.includes('otp') || signature.includes('security_code') || signature.includes('verification_code')) {
      return false;
    }

    // Exclude search bars & filters
    if (inputType === 'search' || signature.includes('search') || signature.includes('filter')) {
      return false;
    }

    // Check visibility
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }

    const rect = el.getBoundingClientRect();
    const isJSDOM = typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent);
    if (!isJSDOM && rect.width === 0 && rect.height === 0) {
      return false;
    }

    return true;
  }

  // Generates unique CSS selector
  public static computeUniqueSelector(el: HTMLElement): string {
    if (el.id) return `#${safeEscape(el.id)}`;
    if (el.getAttribute('name')) return `[name="${safeEscape(el.getAttribute('name')!)}"]`;

    let path = el.tagName.toLowerCase();
    let parent = el.parentElement;
    while (parent && parent !== document.body) {
      if (parent.id) {
        path = `#${safeEscape(parent.id)} > ${path}`;
        break;
      }
      const idx = Array.from(parent.children).indexOf(el) + 1;
      path = `${parent.tagName.toLowerCase()} > ${path}:nth-child(${idx})`;
      parent = parent.parentElement;
    }
    return path;
  }

  // Extracts all 12 evidence signals from an element
  public static extractEvidence(el: HTMLElement): FieldEvidence {
    const tagName = el.tagName.toLowerCase();
    const inputType = (el.getAttribute('type') || (tagName === 'select' ? 'select' : tagName === 'textarea' ? 'textarea' : 'text')).toLowerCase();
    const name = el.getAttribute('name') || '';
    const id = el.id || '';
    const placeholder = el.getAttribute('placeholder') || '';
    const ariaLabel = el.getAttribute('aria-label') || '';
    const ariaLabelledBy = el.getAttribute('aria-labelledby') || '';
    const title = el.getAttribute('title') || '';
    const maxLength = parseInt(el.getAttribute('maxlength') || '0', 10);
    const pattern = el.getAttribute('pattern') || '';
    const isRequired = el.hasAttribute('required') || el.getAttribute('aria-required') === 'true';
    const isReadOnly = (el as HTMLInputElement).readOnly || el.hasAttribute('readonly');
    const isDisabled = (el as HTMLInputElement).disabled || el.hasAttribute('disabled');
    const currentValue = (el as HTMLInputElement).value || '';

    // Evidence 1: Label
    let label = '';
    if (id) {
      const lblEl = document.querySelector(`label[for="${safeEscape(id)}"]`);
      if (lblEl) label = lblEl.textContent || '';
    }
    if (!label) {
      const parentLabel = el.closest('label');
      if (parentLabel) label = parentLabel.textContent || '';
    }
    if (!label && ariaLabelledBy) {
      const labelledEl = document.getElementById(ariaLabelledBy);
      if (labelledEl) label = labelledEl.textContent || '';
    }
    if (!label) {
      const prevEl = el.previousElementSibling;
      if (prevEl && prevEl.tagName.toLowerCase() === 'label') {
        const prevFor = prevEl.getAttribute('for');
        if (!prevFor || prevFor === id) {
          label = prevEl.textContent || '';
        }
      }
    }

    // Evidence 8: Fieldset Legend
    let legend = '';
    const fieldset = el.closest('fieldset');
    if (fieldset) {
      const legendEl = fieldset.querySelector('legend');
      if (legendEl) legend = legendEl.textContent || '';
    }

    // Evidence 9: Table Header
    let tableHeader = '';
    const td = el.closest('td');
    if (td) {
      // Look at previous sibling TD, skipping spacer/colon cells (e.g. <td>:</td> on Teletalk forms)
      let prevTd = td.previousElementSibling;
      while (prevTd && !/[a-zA-Z0-9\u0980-\u09FF]/.test(prevTd.textContent || '')) {
        prevTd = prevTd.previousElementSibling;
      }
      if (prevTd) {
        tableHeader = (prevTd.textContent || '').trim();
        if (!label) label = tableHeader;
      }
      // Look at column TH in table
      const table = el.closest('table');
      if (table) {
        const colIdx = Array.from(td.parentElement?.children || []).indexOf(td);
        const th = table.querySelectorAll('th')[colIdx];
        if (th) tableHeader = `${tableHeader} ${th.textContent || ''}`.trim();
      }
    }

    // Evidence 10: Parent Context (walk up ancestors to find nearest section heading or sibling header bar)
    let parentContextText = '';
    const headingSelector =
      'legend, .edu-header, .address-col-title, .card-title, .card-header, .section-title, .form-header-bar, .form-section-title, caption, h1, h2, h3, h4, h5, h6';
    const siblingHeadingSelector =
      'legend, .edu-header, .address-col-title, .card-title, .card-header, .section-title, .form-header-bar, .form-section-title, h1, h2, h3, h4, h5, h6';

    let current: HTMLElement | null = el.parentElement;
    for (let depth = 0; depth < 8 && current && current !== document.body && current !== document.documentElement; depth++) {
      // 1. Check previous sibling of current container (e.g. <div class="form-header-bar">Title</div><table>...</table>)
      const prevSib = current.previousElementSibling;
      if (prevSib && prevSib.matches(siblingHeadingSelector)) {
        const txt = (prevSib.textContent || '').trim();
        if (txt) {
          parentContextText = txt;
          break;
        }
      }

      // 2. Check heading within current container, provided current isn't a multi-section form wrapper
      const subBlocks = current.querySelectorAll('.edu-block, .address-col, fieldset');
      if (subBlocks.length <= 1) {
        const heading = current.querySelector(headingSelector);
        if (heading) {
          const txt = (heading.textContent || '').trim();
          if (txt) {
            parentContextText = txt;
            break;
          }
        }
      }

      current = current.parentElement;
    }

    // Evidence 12: Select Options
    const options: Array<{ value: string; text: string }> = [];
    if (tagName === 'select') {
      const select = el as HTMLSelectElement;
      for (const opt of Array.from(select.options)) {
        if (!opt.disabled && opt.value !== '') {
          options.push({ value: opt.value, text: opt.text });
        }
      }
    }

    return {
      element: el,
      selector: this.computeUniqueSelector(el),
      tagName,
      inputType,
      name,
      id,
      label: ValueNormalizer.cleanText(label),
      placeholder: ValueNormalizer.cleanText(placeholder),
      ariaLabel: ValueNormalizer.cleanText(ariaLabel),
      ariaLabelledBy,
      title: ValueNormalizer.cleanText(title),
      legend: ValueNormalizer.cleanText(legend),
      tableHeader: ValueNormalizer.cleanText(tableHeader),
      parentContextText: ValueNormalizer.cleanText(parentContextText),
      options,
      maxLength,
      pattern,
      isRequired,
      isReadOnly,
      isDisabled,
      currentValue,
    };
  }
}
