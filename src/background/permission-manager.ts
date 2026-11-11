// JobFill BD - Permission Manager (Manifest V3)
// Enforces least-privilege security. Prefers user-initiated activeTab.
// Handles optional host permissions for government recruitment domains when required,
// while strictly blocking Google Meet, media streaming sites, and restricted browser URLs.

import { isExcludedSiteUrl } from '../security/site-policy';

export class PermissionManager {
  /**
   * Checks if activeTab or host permission is available for a given URL
   */
  public static async hasHostPermission(url: string): Promise<boolean> {
    if (isExcludedSiteUrl(url)) return false;
    if (typeof chrome === 'undefined' || !chrome.permissions) {
      return true; // Non-chrome test environment fallback
    }

    try {
      const u = new URL(url);
      const originPattern = `${u.protocol}//${u.hostname}/*`;
      return await chrome.permissions.contains({
        origins: [originPattern],
      });
    } catch {
      return false;
    }
  }

  /**
   * Requests optional host permission for a recruitment portal domain on explicit user action
   */
  public static async requestHostPermission(url: string): Promise<boolean> {
    if (isExcludedSiteUrl(url)) return false;
    if (typeof chrome === 'undefined' || !chrome.permissions) {
      return true;
    }

    try {
      const u = new URL(url);
      const originPattern = `${u.protocol}//${u.hostname}/*`;
      return await chrome.permissions.request({
        origins: [originPattern],
      });
    } catch (e) {
      console.warn('JobFill BD: Optional permission request declined or failed', e);
      return false;
    }
  }

  /**
   * Determines if a URL is restricted by Chrome security or excluded from extension injection
   */
  public static isRestrictedUrl(url: string): boolean {
    if (!url) return true;
    return isExcludedSiteUrl(url);
  }
}
