// JobFill BD - Multi-Select Control Handler
// Supports native <select multiple> and accessible multi-select widgets (role="listbox"[aria-multiselectable="true"]).
// Reconciles sets of qualifications, skills, languages, or preferred locations:
// matches normalized options, preserves valid selections, dispatches events, and verifies final set.

import { ControlHandler, ControlFillResult } from './types';
import { ValueNormalizer } from '../intelligence/value-normalizer';
import { OptionMatcher } from '../intelligence/option-matcher';

export class MultiSelectHandler implements ControlHandler {
  public readonly controlType = 'multi-select';

  public canHandle(el: HTMLElement): boolean {
    if (el instanceof HTMLSelectElement && el.multiple) {
      return true;
    }
    const role = (el.getAttribute('role') || '').toLowerCase();
    const isMultiAria = el.getAttribute('aria-multiselectable') === 'true';
    if ((role === 'listbox' || role === 'combobox') && isMultiAria) {
      return true;
    }
    if (el.classList.contains('select2-multiple') || el.classList.contains('choices-multiple')) {
      return true;
    }
    return false;
  }

  // Parses comma-separated or JSON list of target values
  public parseTargetValues(raw: string): string[] {
    if (!raw) return [];
    if (raw.startsWith('[') && raw.endsWith(']')) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.map((s) => String(s).trim()).filter(Boolean);
      } catch {
        // Fallback to comma separation
      }
    }
    return raw
      .split(/[,;\n|]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  public getCurrentValue(el: HTMLElement): string {
    if (el instanceof HTMLSelectElement) {
      const selected = Array.from(el.selectedOptions).map((o) => (o.text || o.value || '').trim());
      return selected.join(', ');
    }
    // Custom ARIA listbox
    const selectedOptions = el.querySelectorAll('[role="option"][aria-selected="true"], .selected, .active');
    const texts = Array.from(selectedOptions).map((o) => (o.textContent || '').trim());
    return texts.join(', ');
  }

  public isAlreadyCorrect(el: HTMLElement, proposedValue: string): boolean {
    const targets = this.parseTargetValues(proposedValue).map((t) => t.toLowerCase());
    if (targets.length === 0) return false;

    if (el instanceof HTMLSelectElement) {
      const selectedOpts = Array.from(el.selectedOptions).map((o) => (o.text || o.value || '').trim().toLowerCase());
      if (selectedOpts.length === 0) return false;
      return targets.every((t) =>
        selectedOpts.some((s) => s === t || s.includes(t) || t.includes(s))
      );
    }

    const currentVal = this.getCurrentValue(el).toLowerCase();
    return targets.every((t) => currentVal.includes(t));
  }

  public async fill(el: HTMLElement, proposedValue: string): Promise<ControlFillResult> {
    const targets = this.parseTargetValues(proposedValue);
    if (targets.length === 0) {
      return {
        success: false,
        element: el,
        status: 'Fill Failed',
        message: 'No values provided for multi-select field.',
        appliedValue: proposedValue,
      };
    }

    if (el instanceof HTMLSelectElement) {
      const matchedCount: string[] = [];
      const optionsArray = Array.from(el.options);

      for (const target of targets) {
        // 1. Try OptionMatcher first
        const match = OptionMatcher.matchOption(el, target);
        if (match) {
          const opt = optionsArray.find((o) => o.value === match.value);
          if (opt) {
            opt.selected = true;
            matchedCount.push(opt.text || opt.value);
            continue;
          }
        }

        // 2. Direct clean text matching
        const normTarget = ValueNormalizer.cleanText(target).toLowerCase();
        for (const opt of optionsArray) {
          if (opt.disabled) continue;
          const optText = ValueNormalizer.cleanText(opt.text).toLowerCase();
          const optVal = ValueNormalizer.cleanText(opt.value).toLowerCase();
          if (optText === normTarget || optVal === normTarget || optText.includes(normTarget) || normTarget.includes(optText)) {
            opt.selected = true;
            matchedCount.push(opt.text || opt.value);
            break;
          }
        }
      }

      // React 16+ tracker bypass
      const tracker = (el as any)._valueTracker;
      if (tracker) {
        tracker.setValue('');
      }

      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));

      await new Promise((r) => setTimeout(r, 40));

      const isVerified = this.verify(el, proposedValue);
      if (isVerified) {
        return {
          success: true,
          element: el,
          status: 'Filled',
          message: `Multi-select options selected: [${matchedCount.join(', ')}]`,
          appliedValue: matchedCount.join(', '),
        };
      }

      if (matchedCount.length > 0) {
        return {
          success: true,
          element: el,
          status: 'Filled',
          message: `Partially filled multi-select: ${matchedCount.length}/${targets.length} options selected.`,
          appliedValue: matchedCount.join(', '),
        };
      }

      return {
        success: false,
        element: el,
        status: 'Fill Failed',
        message: `None of the requested options [${targets.join(', ')}] could be found in the multi-select dropdown.`,
        appliedValue: '',
      };
    }

    // Custom ARIA listbox multi-select
    const listboxId = el.getAttribute('aria-controls') || el.getAttribute('aria-owns');
    let listboxEl: HTMLElement | null = null;
    if (listboxId) {
      listboxEl = document.getElementById(listboxId);
    }
    if (!listboxEl) {
      listboxEl = el.querySelector('[role="listbox"]') || el.parentElement?.querySelector('[role="listbox"]') || null;
    }

    if (listboxEl) {
      const optEls = Array.from(listboxEl.querySelectorAll<HTMLElement>('[role="option"], li, .dropdown-item'));
      const selectedLabels: string[] = [];

      for (const target of targets) {
        const normTarget = ValueNormalizer.cleanText(target).toLowerCase();
        for (const opt of optEls) {
          const optText = ValueNormalizer.cleanText(opt.textContent || '').toLowerCase();
          const optVal = ValueNormalizer.cleanText(opt.getAttribute('data-value') || '').toLowerCase();
          if (optText === normTarget || optVal === normTarget || optText.includes(normTarget) || normTarget.includes(optText)) {
            opt.setAttribute('aria-selected', 'true');
            opt.classList.add('selected');
            opt.click();
            selectedLabels.push(optText);
            break;
          }
        }
      }

      el.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 40));

      return {
        success: selectedLabels.length > 0,
        element: el,
        status: selectedLabels.length > 0 ? 'Filled' : 'Fill Failed',
        message: selectedLabels.length > 0
          ? `Custom multi-select updated: [${selectedLabels.join(', ')}]`
          : `Custom multi-select options [${targets.join(', ')}] not found.`,
        appliedValue: selectedLabels.join(', '),
      };
    }

    return {
      success: false,
      element: el,
      status: 'Fill Failed',
      message: 'Unsupported multi-select container element.',
      appliedValue: proposedValue,
    };
  }

  public verify(el: HTMLElement, proposedValue: string): boolean {
    const targets = this.parseTargetValues(proposedValue).map((t) => t.toLowerCase());
    if (targets.length === 0) return true;

    if (el instanceof HTMLSelectElement) {
      const selectedTexts = Array.from(el.selectedOptions).map((o) => (o.text || o.value || '').trim().toLowerCase());
      // At least one target matched and is selected
      return targets.some((t) =>
        selectedTexts.some((s) => s === t || s.includes(t) || t.includes(s))
      );
    }

    const currentVal = this.getCurrentValue(el).toLowerCase();
    return targets.some((t) => currentVal.includes(t));
  }
}
