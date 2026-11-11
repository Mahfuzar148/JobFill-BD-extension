// JobFill BD - Controlled Field Filler (Phase 8 & 16)
// Safely populates input elements, dropdowns, and checkboxes using native prototype setters.

import { EventDispatcher } from './event-dispatcher';
import { OptionMatcher } from '../intelligence/option-matcher';

export interface FillOperationResult {
  success: boolean;
  actualValue: string;
  reverted: boolean;
  message?: string;
}

export class FieldFiller {
  /**
   * Safely populates a text input or textarea using native property descriptor setters
   */
  public static fillTextInput(
    el: HTMLInputElement | HTMLTextAreaElement,
    value: string
  ): FillOperationResult {
    const isInput = el.tagName.toLowerCase() === 'input';
    const prototype = isInput
      ? window.HTMLInputElement.prototype
      : window.HTMLTextAreaElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');

    const originalVal = el.value;

    if (descriptor && descriptor.set) {
      descriptor.set.call(el, value);
    } else {
      el.value = value;
    }

    EventDispatcher.dispatchInputSequence(el);

    // Verify resulting value
    const finalVal = el.value;
    const success = finalVal === value;
    const reverted = !success && finalVal === originalVal;

    return {
      success,
      actualValue: finalVal,
      reverted,
      message: success ? 'Populated successfully' : 'Page reverted or rejected value',
    };
  }

  /**
   * Selects an option inside a native HTML <select> dropdown
   */
  public static fillDropdown(
    select: HTMLSelectElement,
    targetValue: string
  ): FillOperationResult {
    const match = OptionMatcher.matchOption(select, targetValue);

    if (match) {
      select.value = match.value;
      EventDispatcher.dispatchDropdownChange(select);
      return {
        success: true,
        actualValue: select.value,
        reverted: false,
      };
    }

    return {
      success: false,
      actualValue: select.value,
      reverted: false,
      message: `Option "${targetValue}" not found in dropdown`,
    };
  }

  /**
   * Checks or unchecks a checkbox input
   */
  public static fillCheckbox(
    checkbox: HTMLInputElement,
    shouldCheck: boolean
  ): FillOperationResult {
    if (checkbox.checked !== shouldCheck) {
      checkbox.checked = shouldCheck;
      EventDispatcher.dispatchCheckboxToggle(checkbox);
    }

    return {
      success: checkbox.checked === shouldCheck,
      actualValue: String(checkbox.checked),
      reverted: false,
    };
  }
}
