// JobFill BD - Layer 4: Dynamic DOM Observer & Form State Manager
// Implements Part J of Master Engineering Specification:
// Monitors targeted form containers for dynamic section additions and cascading dropdowns
// with debounced incremental scanning, zero media interference, and clean disconnection.

import { recordExtensionDiagnostic } from '../security/diagnostics';

export type DomMutationCallback = (addedElements: HTMLElement[]) => void;

const IGNORED_OBSERVER_CONTAINERS =
  '#jobfill-floating-trigger, #jobfill-review-modal-backdrop, #jobfill-doc-modal-backdrop';

export class DynamicDomObserver {
  private static observer: MutationObserver | null = null;
  private static debounceTimer: any = null;
  private static navCleanup: (() => void) | null = null;
  private static seenElements = new WeakSet<HTMLElement>();

  private static isElementOrAncestorHidden(el: HTMLElement): boolean {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return true;
    if (
      el.hasAttribute('hidden') ||
      el.getAttribute('aria-hidden') === 'true' ||
      el.style.display === 'none' ||
      el.style.visibility === 'hidden' ||
      el.classList.contains('hidden') ||
      el.classList.contains('d-none') ||
      el.classList.contains('hide')
    ) {
      return true;
    }
    const hiddenAncestor = el.closest?.('[hidden], [aria-hidden="true"], .hidden, .d-none, .hide');
    return Boolean(hiddenAncestor);
  }

  public static isObserving(): boolean {
    return this.observer !== null;
  }

  public static startObserving(
    callback: DomMutationCallback,
    debounceMs: number = 400,
    targetRoot?: Element | null
  ): void {
    if (this.observer) return;

    const root = targetRoot || document.querySelector('form') || document.body;
    if (!root) return;

    this.observer = new MutationObserver((mutations) => {
      const addedInputs: HTMLElement[] = [];

      for (const m of mutations) {
        if (m.type === 'childList') {
          const targetEl = m.target as HTMLElement | null;
          if (targetEl?.closest?.(IGNORED_OBSERVER_CONTAINERS)) {
            continue;
          }

          for (const node of Array.from(m.addedNodes)) {
            if (node.nodeType !== Node.ELEMENT_NODE) continue;
            const el = node as HTMLElement;
            const tagName = el.tagName.toLowerCase();

            // Never inspect extension overlays or real-time audio/video elements
            if (
              tagName === 'video' ||
              tagName === 'audio' ||
              tagName === 'canvas' ||
              el.matches?.(IGNORED_OBSERVER_CONTAINERS)
            ) {
              continue;
            }

            if (tagName === 'input' || tagName === 'select' || tagName === 'textarea') {
              if (!this.isElementOrAncestorHidden(el) && !this.seenElements.has(el)) {
                this.seenElements.add(el);
                addedInputs.push(el);
              }
            } else if (el.firstElementChild) {
              const nested = el.querySelectorAll<HTMLElement>('input, select, textarea');
              nested.forEach((n) => {
                if (!this.isElementOrAncestorHidden(n) && !this.seenElements.has(n)) {
                  this.seenElements.add(n);
                  addedInputs.push(n);
                }
              });
            }
          }
        } else if (m.type === 'attributes') {
          const targetEl = m.target as HTMLElement | null;
          if (!targetEl || targetEl.nodeType !== Node.ELEMENT_NODE) continue;
          if (targetEl.closest?.(IGNORED_OBSERVER_CONTAINERS)) continue;

          if (!this.isElementOrAncestorHidden(targetEl)) {
            const tagName = targetEl.tagName.toLowerCase();
            if (tagName === 'input' || tagName === 'select' || tagName === 'textarea') {
              if (!this.seenElements.has(targetEl)) {
                this.seenElements.add(targetEl);
                addedInputs.push(targetEl);
              }
            } else if (targetEl.firstElementChild) {
              const nested = targetEl.querySelectorAll<HTMLElement>('input, select, textarea');
              nested.forEach((n) => {
                if (!this.isElementOrAncestorHidden(n) && !this.seenElements.has(n)) {
                  this.seenElements.add(n);
                  addedInputs.push(n);
                }
              });
            }
          }
        }
      }

      if (addedInputs.length > 0) {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
          callback(addedInputs);
        }, debounceMs);
      }
    });

    this.observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'hidden'],
    });
    recordExtensionDiagnostic('observer_started', {
      url: typeof window !== 'undefined' ? window.location?.href : null,
      source: 'DynamicDomObserver.startObserving',
    });
  }

  public static stopObserving(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
      recordExtensionDiagnostic('observer_stopped', {
        url: typeof window !== 'undefined' ? window.location?.href : null,
        source: 'DynamicDomObserver.stopObserving',
      });
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.navCleanup) {
      this.navCleanup();
      this.navCleanup = null;
    }
    this.seenElements = new WeakSet<HTMLElement>();
  }

  // Detects multi-step SPA transitions using passive browser history events (zero polling timers)
  public static monitorMultiStepChanges(onStepChange: (stepIdentifier: string) => void): () => void {
    if (this.navCleanup) {
      this.navCleanup();
      this.navCleanup = null;
    }

    let currentUrl = window.location.href;
    const handleNav = () => {
      if (window.location.href !== currentUrl) {
        currentUrl = window.location.href;
        onStepChange(currentUrl);
      }
    };

    window.addEventListener('popstate', handleNav);
    window.addEventListener('hashchange', handleNav);

    const cleanup = () => {
      window.removeEventListener('popstate', handleNav);
      window.removeEventListener('hashchange', handleNav);
      if (this.navCleanup === cleanup) {
        this.navCleanup = null;
      }
    };

    this.navCleanup = cleanup;
    return cleanup;
  }
}
