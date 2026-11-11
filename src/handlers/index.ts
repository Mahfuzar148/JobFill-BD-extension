// JobFill BD - Form Control Handlers Registry & Router
// Routes every DOM element to its specialized control handler.

import { ControlHandler } from './types';
import { TextInputHandler } from './text-input-handler';
import { TextareaHandler } from './textarea-handler';
import { SelectHandler } from './select-handler';
import { RadioHandler } from './radio-handler';
import { CheckboxHandler } from './checkbox-handler';
import { DateHandler } from './date-handler';

export * from './types';
export * from './text-input-handler';
export * from './textarea-handler';
export * from './select-handler';
export * from './radio-handler';
export * from './checkbox-handler';
export * from './date-handler';

export class ControlHandlerRouter {
  private static textInputHandler = new TextInputHandler();
  private static textareaHandler = new TextareaHandler();
  private static selectHandler = new SelectHandler();
  private static radioHandler = new RadioHandler();
  private static checkboxHandler = new CheckboxHandler();
  private static dateHandler = new DateHandler();

  public static getHandler(el: HTMLElement): ControlHandler {
    const tagName = (el.tagName || '').toLowerCase();
    const type = (el.getAttribute('type') || (tagName === 'select' ? 'select' : tagName === 'textarea' ? 'textarea' : 'text')).toLowerCase();

    // 1. Checkboxes
    if (type === 'checkbox') {
      return this.checkboxHandler;
    }

    // 2. Radio buttons
    if (type === 'radio') {
      return this.radioHandler;
    }

    // 3. Dropdowns
    if (tagName === 'select') {
      return this.selectHandler;
    }

    // 4. Textareas
    if (tagName === 'textarea') {
      return this.textareaHandler;
    }

    // 5. Date inputs (HTML5 date or custom text date pickers)
    if (this.dateHandler.canHandle(el)) {
      return this.dateHandler;
    }

    // 6. Default to standard text input handler (preserves existing reliable engine)
    return this.textInputHandler;
  }
}
