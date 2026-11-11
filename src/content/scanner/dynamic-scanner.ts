// JobFill BD - Dynamic Scanner with Debounced MutationObserver
// Watches for dynamically loaded sections, cascade changes, and multi-step pages.

export class DynamicScanner {
  private static observer: MutationObserver | null = null;
  private static debounceTimer: any = null;

  public static startObserving(
    onChange: (mutations: MutationRecord[]) => void,
    delayMs = 500,
    targetRoot?: Element | null
  ): void {
    this.stopObserving();
    const root = targetRoot || document.querySelector('form') || document.body;
    if (!root) return;

    this.observer = new MutationObserver((mutations) => {
      // Filter out changes from JobFill assistant UI and media/canvas nodes
      const relevant = mutations.filter((m) => {
        const target = m.target as HTMLElement | null;
        if (!target) return false;
        const tag = target.tagName?.toLowerCase();
        if (tag === 'video' || tag === 'audio' || tag === 'canvas') {
          return false;
        }
        if (target.id?.includes('jobfill') || target.closest?.('#jobfill-floating-trigger')) {
          return false;
        }
        return true;
      });

      if (relevant.length === 0) return;

      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => {
        onChange(relevant);
      }, delayMs);
    });

    this.observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['disabled', 'style', 'class'],
    });
  }

  public static stopObserving(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }
}
