// JobFill BD - Dependency-Aware Cascading Dropdown Engine
// Coordinates multi-level dependent select chains:
// District -> Upazila, Degree -> Subject, Examination -> Board.
// Handles change dispatch, bounded asynchronous option loading,
// MutationObserver teardown, option matching, and read-back verification.

import { OptionMatcher } from '../intelligence/option-matcher';
import { VerificationEngine } from '../validation/verification-engine';

export type CascadingEngineStatus =
  | 'FILLED_VERIFIED'
  | 'OPTION_NOT_FOUND'
  | 'DEPENDENCY_TIMEOUT'
  | 'MANUAL_SELECTION_REQUIRED';

export interface CascadingResult {
  success: boolean;
  status: CascadingEngineStatus;
  parentSelected: boolean;
  childSelected: boolean;
  parentVerifiedValue: string;
  childVerifiedValue: string;
  errorMessage?: string;
}

export class CascadingDropdownEngine {
  /**
   * Bounded wait for a child select to populate its options via AJAX or DOM mutation
   */
  public static async waitForChildOptions(
    childSelect: HTMLSelectElement,
    initialCount: number = 1,
    maxWaitMs: number = 3000
  ): Promise<boolean> {
    if (childSelect.options.length > initialCount) {
      return true;
    }

    return new Promise<boolean>((resolve) => {
      let isResolved = false;
      let observer: MutationObserver | null = null;
      let timeoutId: any = null;

      const cleanup = () => {
        if (observer) {
          observer.disconnect();
          observer = null;
        }
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
      };

      // 1. Observer for child option additions
      observer = new MutationObserver(() => {
        if (childSelect.options.length > initialCount && !isResolved) {
          isResolved = true;
          cleanup();
          resolve(true);
        }
      });

      observer.observe(childSelect, { childList: true, subtree: true });

      // 2. Poll as backup for libraries that replace innerHTML without triggering childList directly
      const intervalId = setInterval(() => {
        if (childSelect.options.length > initialCount && !isResolved) {
          isResolved = true;
          clearInterval(intervalId);
          cleanup();
          resolve(true);
        }
      }, 50);

      // 3. Bounded timeout
      timeoutId = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          clearInterval(intervalId);
          cleanup();
          resolve(childSelect.options.length > initialCount);
        }
      }, maxWaitMs);
    });
  }

  /**
   * Coordinates parent and child selection sequentially with full lifecycle verification
   */
  public static async handleCascadingPair(
    parentSelect: HTMLSelectElement,
    childSelect: HTMLSelectElement,
    parentTargetValue: string,
    childTargetValue: string,
    options: { maxWaitMs?: number } = {}
  ): Promise<CascadingResult> {
    const maxWaitMs = options.maxWaitMs || 3000;

    // Step 1: Select Parent if not already holding target value
    if (parentSelect.value !== parentTargetValue) {
      const parentMatched = VerificationEngine.setNativeSelectValue(parentSelect, parentTargetValue);
      if (!parentMatched) {
        return {
          success: false,
          status: 'OPTION_NOT_FOUND',
          parentSelected: false,
          childSelected: false,
          parentVerifiedValue: parentSelect.value,
          childVerifiedValue: childSelect.value,
          errorMessage: `Parent option "${parentTargetValue}" could not be found or matched.`,
        };
      }
    }

    // Step 3: Wait for Child Options to Load
    const initialChildCount = childSelect.options.length <= 1 ? childSelect.options.length : 0;
    const optionsLoaded = await this.waitForChildOptions(childSelect, initialChildCount, maxWaitMs);

    if (!optionsLoaded && childSelect.options.length <= 1) {
      return {
        success: false,
        status: 'DEPENDENCY_TIMEOUT',
        parentSelected: true,
        childSelected: false,
        parentVerifiedValue: parentSelect.value,
        childVerifiedValue: childSelect.value,
        errorMessage: 'Child select options timed out while loading dependent values.',
      };
    }

    // Step 4: Inspect New Options and Match Child
    const matchedOpt = OptionMatcher.matchOption(childSelect, childTargetValue);
    if (!matchedOpt) {
      // Check fallback
      const normChild = (childTargetValue || '').toLowerCase().trim();
      const fallback = Array.from(childSelect.options).find(
        (o) =>
          o.value.toLowerCase().trim() === normChild ||
          o.text.toLowerCase().trim() === normChild ||
          (normChild.length > 2 && (o.text.toLowerCase().includes(normChild) || o.value.toLowerCase().includes(normChild)))
      );

      if (!fallback) {
        return {
          success: false,
          status: 'OPTION_NOT_FOUND',
          parentSelected: true,
          childSelected: false,
          parentVerifiedValue: parentSelect.value,
          childVerifiedValue: childSelect.value,
          errorMessage: `Child option "${childTargetValue}" not found among loaded options.`,
        };
      }

      childSelect.value = fallback.value;
      childSelect.selectedIndex = fallback.index;
    } else {
      childSelect.value = matchedOpt.value;
    }

    // Step 5: Dispatch Child Events
    childSelect.dispatchEvent(new Event('input', { bubbles: true }));
    childSelect.dispatchEvent(new Event('change', { bubbles: true }));
    childSelect.dispatchEvent(new Event('blur', { bubbles: true }));

    // Step 6: Read-Back Verification
    const childVerified = childSelect.value.length > 0;

    return {
      success: childVerified,
      status: childVerified ? 'FILLED_VERIFIED' : 'OPTION_NOT_FOUND',
      parentSelected: true,
      childSelected: childVerified,
      parentVerifiedValue: parentSelect.value,
      childVerifiedValue: childSelect.value,
      errorMessage: childVerified ? undefined : 'Child value verification failed after selection.',
    };
  }
}
