// JobFill BD - Form Control Handlers Router
// Centralized dispatcher routing every form element to its specialized control handler.

import { ControlHandler } from './types';
import { TextInputHandler } from './text-input-handler';
import { TextareaHandler } from './textarea-handler';
import { SelectHandler } from './select-handler';
import { RadioHandler } from './radio-handler';
import { CheckboxHandler } from './checkbox-handler';
import { DateHandler } from './date-handler';
import { CustomDropdownHandler } from './custom-dropdown-handler';
import { MultiSelectHandler } from './multi-select-handler';
import { ToggleSwitchHandler } from './toggle-switch-handler';
import { FileInputHandler } from './file-input-handler';

export class ControlHandlerRouter {
  public static textInputHandler = new TextInputHandler();
  public static textareaHandler = new TextareaHandler();
  public static selectHandler = new SelectHandler();
  public static customDropdownHandler = new CustomDropdownHandler();
  public static radioHandler = new RadioHandler();
  public static checkboxHandler = new CheckboxHandler();
  public static dateHandler = new DateHandler();
  public static multiSelectHandler = new MultiSelectHandler();
  public static toggleSwitchHandler = new ToggleSwitchHandler();
  public static fileInputHandler = new FileInputHandler();

  public static getHandler(el: HTMLElement): ControlHandler {
    const tagName = (el.tagName || '').toLowerCase();
    const type = (el.getAttribute('type') || (tagName === 'select' ? 'select' : tagName === 'textarea' ? 'textarea' : 'text')).toLowerCase();

    // 1. File Inputs
    if (type === 'file' || this.fileInputHandler.canHandle(el)) {
      return this.fileInputHandler;
    }

    // 2. Toggle Switches (role="switch" or styled checkbox switches)
    if (this.toggleSwitchHandler.canHandle(el)) {
      return this.toggleSwitchHandler;
    }

    // 3. Multi-Select Dropdowns (native multiple select or ARIA multi-select listbox)
    if (this.multiSelectHandler.canHandle(el)) {
      return this.multiSelectHandler;
    }

    // 4. Checkboxes
    if (type === 'checkbox') {
      return this.checkboxHandler;
    }

    // 5. Radio buttons
    if (type === 'radio') {
      return this.radioHandler;
    }

    // 6. Native Single Select Dropdowns
    if (tagName === 'select') {
      return this.selectHandler;
    }

    // 7. Custom Dropdowns & ARIA Comboboxes
    if (this.customDropdownHandler.canHandle(el)) {
      return this.customDropdownHandler;
    }

    // 8. Textareas
    if (tagName === 'textarea') {
      return this.textareaHandler;
    }

    // 9. Date inputs (HTML5 date or custom text date pickers)
    if (this.dateHandler.canHandle(el)) {
      return this.dateHandler;
    }

    // 10. Default to standard text input handler (preserves existing reliable engine)
    return this.textInputHandler;
  }
}
