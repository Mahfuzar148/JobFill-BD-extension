// JobFill BD - Synthetic Event Dispatcher
// Triggers native DOM events that reactive frameworks (React, Vue, Angular) observe.

export class EventDispatcher {
  /**
   * Dispatches input and change events in standard browser sequence
   */
  public static dispatchInputSequence(element: HTMLElement): void {
    // 1. Focus
    element.dispatchEvent(new FocusEvent('focus', { bubbles: true }));

    // 2. Input
    element.dispatchEvent(new Event('input', { bubbles: true }));

    // 3. Change
    element.dispatchEvent(new Event('change', { bubbles: true }));

    // 4. Blur
    element.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
  }

  /**
   * Dispatches change event specifically for select dropdowns
   */
  public static dispatchDropdownChange(selectElement: HTMLSelectElement): void {
    selectElement.dispatchEvent(new Event('change', { bubbles: true }));
    selectElement.dispatchEvent(new Event('input', { bubbles: true }));
  }

  /**
   * Dispatches click and change events for checkboxes
   */
  public static dispatchCheckboxToggle(checkbox: HTMLInputElement): void {
    checkbox.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
  }
}
