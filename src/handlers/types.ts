// JobFill BD - Form Control Handlers Type Definitions
// Unifies execution, verification, and conflict detection across all HTML form control types.

export interface ControlFillResult {
  success: boolean;
  element: HTMLElement;
  status: 'Filled' | 'Fill Failed' | 'Already Correct';
  message: string;
  appliedValue: string | boolean;
}

export interface ControlHandler {
  readonly controlType: string;
  canHandle(el: HTMLElement): boolean;
  getCurrentValue(el: HTMLElement): string;
  isAlreadyCorrect(el: HTMLElement, proposedValue: string): boolean;
  fill(el: HTMLElement, proposedValue: string): Promise<ControlFillResult>;
  verify(el: HTMLElement, proposedValue: string): boolean;
}
