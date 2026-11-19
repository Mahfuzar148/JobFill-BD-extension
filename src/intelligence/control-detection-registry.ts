// JobFill BD - Centralized Universal Control Detection Registry
// Comprehensive detection for 16 native HTML elements and accessible custom controls
// (ARIA Combobox, Listbox, Switch, Radiogroup, Custom Selects, Multi-Selects).

import { safeEscape } from '../utils/dom';
import { ValueNormalizer } from './value-normalizer';

export type UniversalControlType =
  | 'text'
  | 'number'
  | 'email'
  | 'tel'
  | 'url'
  | 'date'
  | 'datetime-local'
  | 'month'
  | 'week'
  | 'time'
  | 'range'
  | 'color'
  | 'radio'
  | 'checkbox'
  | 'file'
  | 'search'
  | 'password'
  | 'textarea'
  | 'select'
  | 'multi-select'
  | 'contenteditable'
  | 'combobox'
  | 'listbox'
  | 'switch'
  | 'custom-dropdown'
  | 'datalist'
  | 'unknown';

export interface AssociatedOption {
  value: string;
  text: string;
  disabled: boolean;
  selected: boolean;
  parentOptgroup?: string;
}

export interface DetectedControlInfo {
  element: HTMLElement;
  controlType: UniversalControlType;
  tagName: string;
  inputType: string;
  name: string;
  id: string;
  label: string;
  placeholder: string;
  ariaRole: string;
  ariaAttributes: Record<string, string | null>;
  parentFieldset: HTMLFieldSetElement | null;
  parentSection: string;
  associatedOptions: AssociatedOption[];
  isDisabled: boolean;
  isReadOnly: boolean;
  isRequired: boolean;
  isMultiple: boolean;
  currentValue: string;
  selectedState: boolean | string | string[];
  isSecurityExcluded: boolean;
  securityExclusionReason?: string;
}

export class ControlDetectionRegistry {
  private static readonly NATIVE_INPUT_TYPES = new Set([
    'text',
    'number',
    'email',
    'tel',
    'url',
    'date',
    'datetime-local',
    'month',
    'week',
    'time',
    'range',
    'color',
    'radio',
    'checkbox',
    'file',
    'search',
    'password',
  ]);

  private static readonly SECURITY_EXCLUDED_TYPES = new Set([
    'password',
    'hidden',
    'submit',
    'reset',
    'button',
    'image',
  ]);

  // Inspects an element and returns its security exclusion status
  public static checkSecurityExclusion(el: HTMLElement): { excluded: boolean; reason?: string } {
    // Exclude extension internal UI
    if (el.closest('[id^="jobfill-"], [data-jobfill-ext], .jobfill-modal, .jobfill-floating-widget')) {
      return { excluded: true, reason: 'JobFill Extension internal element' };
    }

    const tagName = (el.tagName || '').toLowerCase();
    const type = (el.getAttribute('type') || (tagName === 'select' ? 'select' : tagName === 'textarea' ? 'textarea' : 'text')).toLowerCase();

    // Passwords, submit buttons, resets, hidden
    if (this.SECURITY_EXCLUDED_TYPES.has(type)) {
      return { excluded: true, reason: `Excluded security control type: ${type}` };
    }

    const name = (el.getAttribute('name') || '').toLowerCase();
    const id = (el.id || '').toLowerCase();
    const placeholder = (el.getAttribute('placeholder') || '').toLowerCase();
    const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
    const className = (el.className && typeof el.className === 'string' ? el.className : '').toLowerCase();
    const sig = `${name} ${id} ${placeholder} ${ariaLabel} ${className}`;

    // Exclude CAPTCHA, Verification Codes, OTPs, Payment PINs
    if (
      sig.includes('captcha') ||
      sig.includes('security_code') ||
      sig.includes('verification_code') ||
      sig.includes('otp') ||
      sig.includes('pin_code') ||
      sig.includes('cvv') ||
      sig.includes('mpin')
    ) {
      return { excluded: true, reason: 'Security challenge, CAPTCHA, OTP or PIN field' };
    }

    // Exclude search-only bars on portals
    if (type === 'search' || (sig.includes('search') && !sig.includes('research') && !sig.includes('jonmo'))) {
      if (tagName !== 'textarea' && !el.closest('form')) {
        return { excluded: true, reason: 'Search / filter input outside form context' };
      }
    }

    return { excluded: false };
  }

  // Detects the precise UniversalControlType of an element
  public static classifyControlType(el: HTMLElement): UniversalControlType {
    const tagName = (el.tagName || '').toLowerCase();
    const rawType = (el.getAttribute('type') || '').toLowerCase();
    const role = (el.getAttribute('role') || '').toLowerCase();
    const isContentEditable = el.isContentEditable || el.getAttribute('contenteditable') === 'true';

    if (isContentEditable) {
      return 'contenteditable';
    }

    if (role === 'switch') {
      return 'switch';
    }

    if (role === 'combobox') {
      return 'combobox';
    }

    if (role === 'listbox') {
      const isMulti = el.getAttribute('aria-multiselectable') === 'true';
      return isMulti ? 'multi-select' : 'listbox';
    }

    if (tagName === 'select') {
      return (el as HTMLSelectElement).multiple ? 'multi-select' : 'select';
    }

    if (tagName === 'textarea') {
      return 'textarea';
    }

    if (tagName === 'input') {
      if (rawType === 'checkbox') {
        if (role === 'switch' || el.classList.contains('switch') || el.classList.contains('toggle')) {
          return 'switch';
        }
        return 'checkbox';
      }
      if (rawType === 'radio' || role === 'radio') {
        return 'radio';
      }
      if (rawType === 'file') {
        return 'file';
      }
      if (rawType === 'number') {
        return 'number';
      }
      if (rawType === 'email') {
        return 'email';
      }
      if (rawType === 'tel') {
        return 'tel';
      }
      if (rawType === 'date') {
        return 'date';
      }
      if (rawType === 'datetime-local') {
        return 'datetime-local';
      }
      if (rawType === 'month') {
        return 'month';
      }
      if (rawType === 'time') {
        return 'time';
      }
      if (rawType === 'search') {
        return 'search';
      }
      if (rawType === 'url') {
        return 'url';
      }
      if (rawType === 'week') {
        return 'week';
      }
      if (rawType === 'range') {
        return 'range';
      }
      if (rawType === 'color') {
        return 'color';
      }
      if (rawType === 'password') {
        return 'password';
      }
      if (el.hasAttribute('list')) {
        return 'datalist';
      }
      return 'text';
    }

    // Custom dropdown indicators (e.g. div/span with aria-haspopup="listbox" or select2/choices widgets)
    if (
      el.getAttribute('aria-haspopup') === 'listbox' ||
      el.classList.contains('select2-selection') ||
      el.classList.contains('choices__inner') ||
      el.classList.contains('custom-select-trigger')
    ) {
      return 'custom-dropdown';
    }

    return 'unknown';
  }

  // Extracts all associated options from native select or custom listbox
  public static extractAssociatedOptions(el: HTMLElement): AssociatedOption[] {
    const options: AssociatedOption[] = [];
    const tagName = (el.tagName || '').toLowerCase();

    if (tagName === 'select') {
      const sel = el as HTMLSelectElement;
      for (const opt of Array.from(sel.options)) {
        const parent = opt.parentElement;
        const optgroupLabel = parent && parent.tagName.toLowerCase() === 'optgroup'
          ? (parent as HTMLOptGroupElement).label
          : undefined;
        options.push({
          value: opt.value,
          text: (opt.text || opt.textContent || '').trim(),
          disabled: opt.disabled,
          selected: opt.selected,
          parentOptgroup: optgroupLabel,
        });
      }
      return options;
    }

    // HTML5 Datalist options
    const listId = el.getAttribute('list');
    if (listId) {
      const datalistEl = document.getElementById(listId);
      if (datalistEl) {
        const optEls = datalistEl.querySelectorAll('option');
        for (const opt of Array.from(optEls)) {
          const val = opt.value || opt.getAttribute('value') || (opt.textContent || '').trim();
          const txt = (opt.textContent || opt.value || '').trim();
          options.push({
            value: val,
            text: txt,
            disabled: opt.disabled,
            selected: false,
          });
        }
        return options;
      }
    }

    // Custom ARIA listbox or combobox popup
    const listboxId = el.getAttribute('aria-controls') || el.getAttribute('aria-owns');
    let listboxEl: HTMLElement | null = null;
    if (listboxId) {
      listboxEl = document.getElementById(listboxId);
    }
    if (!listboxEl) {
      listboxEl = el.querySelector('[role="listbox"]') || el.parentElement?.querySelector('[role="listbox"]') || null;
    }

    if (listboxEl) {
      const optEls = listboxEl.querySelectorAll('[role="option"], li, .dropdown-item, .custom-option');
      for (const opt of Array.from(optEls)) {
        const htmlOpt = opt as HTMLElement;
        const value = htmlOpt.getAttribute('data-value') || htmlOpt.getAttribute('value') || (htmlOpt.textContent || '').trim();
        const text = (htmlOpt.textContent || '').trim();
        const isSelected =
          htmlOpt.getAttribute('aria-selected') === 'true' ||
          htmlOpt.classList.contains('selected') ||
          htmlOpt.classList.contains('active');
        const isDisabled =
          htmlOpt.getAttribute('aria-disabled') === 'true' ||
          htmlOpt.classList.contains('disabled');
        options.push({
          value,
          text,
          disabled: isDisabled,
          selected: isSelected,
        });
      }
    }

    return options;
  }

  // Extracts parent section context text by climbing the DOM tree
  public static extractParentSection(el: HTMLElement): string {
    const headingSelectors =
      'legend, .edu-header, .address-col-title, .card-title, .card-header, .section-title, .form-header-bar, .form-section-title, caption, h1, h2, h3, h4, h5, h6';

    let current: HTMLElement | null = el.parentElement;
    for (let depth = 0; depth < 8 && current && current !== document.body && current !== document.documentElement; depth++) {
      const prevSib = current.previousElementSibling;
      if (prevSib && prevSib.matches(headingSelectors)) {
        const txt = (prevSib.textContent || '').trim();
        if (txt) return ValueNormalizer.cleanText(txt);
      }
      const heading = current.querySelector(headingSelectors);
      if (heading) {
        const txt = (heading.textContent || '').trim();
        if (txt) return ValueNormalizer.cleanText(txt);
      }
      current = current.parentElement;
    }
    return '';
  }

  // Extracts label text for an element using label tags, aria, table cells, or siblings
  public static extractLabel(el: HTMLElement): string {
    if (el.id) {
      const lbl = document.querySelector(`label[for="${safeEscape(el.id)}"]`);
      if (lbl) return ValueNormalizer.cleanText(lbl.textContent || '');
    }
    const parentLabel = el.closest('label');
    if (parentLabel) return ValueNormalizer.cleanText(parentLabel.textContent || '');

    const ariaLabelledBy = el.getAttribute('aria-labelledby');
    if (ariaLabelledBy) {
      const target = document.getElementById(ariaLabelledBy);
      if (target) return ValueNormalizer.cleanText(target.textContent || '');
    }

    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel) return ValueNormalizer.cleanText(ariaLabel);

    // Table header / previous cell
    const td = el.closest('td');
    if (td) {
      let prevTd = td.previousElementSibling;
      while (prevTd && !/[a-zA-Z0-9\u0980-\u09FF]/.test(prevTd.textContent || '')) {
        prevTd = prevTd.previousElementSibling;
      }
      if (prevTd) return ValueNormalizer.cleanText(prevTd.textContent || '');
    }

    return '';
  }

  // Fully detects and inspects a single control
  public static detectControl(el: HTMLElement): DetectedControlInfo {
    const security = this.checkSecurityExclusion(el);
    const controlType = this.classifyControlType(el);
    const tagName = (el.tagName || '').toLowerCase();
    const inputType = (el.getAttribute('type') || (tagName === 'select' ? 'select' : tagName === 'textarea' ? 'textarea' : 'text')).toLowerCase();
    const name = el.getAttribute('name') || '';
    const id = el.id || '';
    const label = this.extractLabel(el);
    const placeholder = el.getAttribute('placeholder') || '';
    const ariaRole = el.getAttribute('role') || '';

    const ariaAttributes: Record<string, string | null> = {
      'aria-label': el.getAttribute('aria-label'),
      'aria-labelledby': el.getAttribute('aria-labelledby'),
      'aria-describedby': el.getAttribute('aria-describedby'),
      'aria-expanded': el.getAttribute('aria-expanded'),
      'aria-haspopup': el.getAttribute('aria-haspopup'),
      'aria-controls': el.getAttribute('aria-controls'),
      'aria-checked': el.getAttribute('aria-checked'),
      'aria-selected': el.getAttribute('aria-selected'),
      'aria-required': el.getAttribute('aria-required'),
      'aria-disabled': el.getAttribute('aria-disabled'),
      'aria-multiselectable': el.getAttribute('aria-multiselectable'),
    };

    const parentFieldset = el.closest('fieldset');
    const parentSection = this.extractParentSection(el);
    const associatedOptions = this.extractAssociatedOptions(el);

    const isDisabled =
      (el as HTMLInputElement).disabled ||
      el.hasAttribute('disabled') ||
      el.getAttribute('aria-disabled') === 'true';

    const isReadOnly =
      (el as HTMLInputElement).readOnly ||
      el.hasAttribute('readonly');

    const isRequired =
      el.hasAttribute('required') ||
      el.getAttribute('aria-required') === 'true';

    const isMultiple =
      (el instanceof HTMLSelectElement && el.multiple) ||
      el.getAttribute('aria-multiselectable') === 'true';

    let currentValue = '';
    let selectedState: boolean | string | string[] = '';

    if (el instanceof HTMLInputElement) {
      if (inputType === 'checkbox') {
        currentValue = el.checked ? 'true' : 'false';
        selectedState = el.checked;
      } else if (inputType === 'radio') {
        currentValue = el.checked ? el.value : '';
        selectedState = el.checked;
      } else if (inputType === 'file') {
        currentValue = el.files && el.files.length > 0 ? Array.from(el.files).map((f) => f.name).join(', ') : (el.value || '');
        selectedState = currentValue;
      } else {
        currentValue = el.value || '';
        selectedState = currentValue;
      }
    } else if (el instanceof HTMLSelectElement) {
      if (el.multiple) {
        const selValues = Array.from(el.selectedOptions).map((o) => o.value);
        currentValue = selValues.join(', ');
        selectedState = selValues;
      } else {
        currentValue = el.value || '';
        selectedState = currentValue;
      }
    } else if (el instanceof HTMLTextAreaElement) {
      currentValue = el.value || '';
      selectedState = currentValue;
    } else if (el.isContentEditable) {
      currentValue = el.textContent || '';
      selectedState = currentValue;
    } else if (controlType === 'switch') {
      const isAriaChecked = el.getAttribute('aria-checked') === 'true';
      currentValue = isAriaChecked ? 'true' : 'false';
      selectedState = isAriaChecked;
    } else if (controlType === 'combobox' || controlType === 'custom-dropdown') {
      currentValue = (el.textContent || '').trim();
      selectedState = currentValue;
    }

    return {
      element: el,
      controlType,
      tagName,
      inputType,
      name,
      id,
      label,
      placeholder,
      ariaRole,
      ariaAttributes,
      parentFieldset,
      parentSection,
      associatedOptions,
      isDisabled,
      isReadOnly,
      isRequired,
      isMultiple,
      currentValue,
      selectedState,
      isSecurityExcluded: security.excluded,
      securityExclusionReason: security.reason,
    };
  }

  // Scans all candidate form controls within a container
  public static scanAllControls(container: Document | HTMLElement = document): DetectedControlInfo[] {
    const selector = [
      'input',
      'select',
      'textarea',
      '[contenteditable="true"]',
      '[role="combobox"]',
      '[role="listbox"]',
      '[role="switch"]',
      '[role="radio"]',
      '[role="checkbox"]',
      '[aria-haspopup="listbox"]',
      '.custom-select-trigger',
      '.select2-selection',
    ].join(', ');

    const candidateElements = Array.from(container.querySelectorAll<HTMLElement>(selector));
    const results: DetectedControlInfo[] = [];

    for (const el of candidateElements) {
      const info = this.detectControl(el);
      results.push(info);
    }

    return results;
  }
}
