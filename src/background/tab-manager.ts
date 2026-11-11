// JobFill BD - Tab Manager (Manifest V3)
// Handles opening and focusing extension dashboard and finding active recruitment portals.

export class TabManager {
  /**
   * Opens the full SaaS dashboard in a new tab, or focuses an existing dashboard tab.
   * Optionally navigates to a specific tab (e.g. 'circulars', 'notifications') and jobId.
   */
  public static async openOrFocusDashboard(tab?: string, jobId?: string): Promise<void> {
    const queryParts: string[] = [];
    if (tab) queryParts.push(`tab=${encodeURIComponent(tab)}`);
    if (jobId) queryParts.push(`jobId=${encodeURIComponent(jobId)}`);
    const queryString = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';

    if (typeof chrome === 'undefined' || !chrome.tabs) {
      if (typeof window !== 'undefined') window.open(`dashboard.html${queryString}`, '_blank');
      return;
    }

    const baseDashboardUrl = chrome.runtime.getURL('dashboard.html');
    const targetUrl = `${baseDashboardUrl}${queryString}`;
    let existingTabs: chrome.tabs.Tab[] = [];
    if (typeof (chrome.runtime as any).getContexts === 'function') {
      try {
        const contexts = await (chrome.runtime as any).getContexts({ contextTypes: ['TAB'] });
        const matched = contexts?.find(
          (ctx: any) =>
            typeof ctx.documentUrl === 'string' &&
            ctx.documentUrl.startsWith(baseDashboardUrl) &&
            typeof ctx.tabId === 'number'
        );
        if (typeof matched?.tabId === 'number') {
          existingTabs = [await chrome.tabs.get(matched.tabId)];
        }
      } catch {
        // Fallback to chrome.tabs.query below
      }
    }
    if (existingTabs.length === 0) {
      existingTabs = await chrome.tabs.query({ url: `${baseDashboardUrl}*` });
    }

    if (existingTabs.length > 0 && existingTabs[0].id) {
      await chrome.tabs.update(existingTabs[0].id, { active: true });
      if (existingTabs[0].windowId) {
        await chrome.windows.update(existingTabs[0].windowId, { focused: true });
      }
      if (tab) {
        try {
          await chrome.tabs.sendMessage(existingTabs[0].id, {
            action: 'NAVIGATE_DASHBOARD_TAB',
            payload: { tab, jobId },
          });
        } catch {
          // If dashboard page listener wasn't ready, navigate via URL
          await chrome.tabs.update(existingTabs[0].id, { url: targetUrl });
        }
      }
    } else {
      await chrome.tabs.create({ url: targetUrl });
    }
  }

  /**
   * Retrieves the currently active user tab
   */
  public static async getActiveTab(): Promise<chrome.tabs.Tab | null> {
    if (typeof chrome === 'undefined' || !chrome.tabs) return null;
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs.length > 0 ? tabs[0] : null;
  }

  /**
   * Sends a message to the content script in the active tab
   */
  public static async sendMessageToActiveTab(message: any): Promise<any> {
    const tab = await this.getActiveTab();
    if (!tab || !tab.id) {
      throw new Error('NO_ACTIVE_TAB');
    }
    return chrome.tabs.sendMessage(tab.id, message);
  }
}
