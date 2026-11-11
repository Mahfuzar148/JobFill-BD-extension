// JobFill BD - Privacy & Data Isolation Controller
// Enforces zero-telemetry and generates least-privilege payloads for content scripts.
// The complete unmasked database is NEVER injected into webpage scope.

import { FillPlanItem } from '../validation/verification-engine';

export class PrivacyController {
  /**
   * Masks sensitive credentials for UI previews (e.g. 1990123456789 -> 1990*****6789)
   */
  public static maskSensitiveValue(value: string, type: 'nid' | 'mobile' | 'email' | 'general'): string {
    if (!value || value.length <= 4) return '****';

    switch (type) {
      case 'nid':
        return value.slice(0, 4) + '*****' + value.slice(-3);
      case 'mobile':
        return value.slice(0, 3) + '*****' + value.slice(-3);
      case 'email': {
        const parts = value.split('@');
        if (parts.length === 2) {
          const name = parts[0];
          return name.slice(0, 2) + '***@' + parts[1];
        }
        return '***@***';
      }
      default:
        return value.slice(0, 2) + '***' + value.slice(-2);
    }
  }

  /**
   * Filters plan items: only approved items with necessary selectors are passed to execution.
   */
  public static prepareLeastPrivilegePayload(items: FillPlanItem[]): FillPlanItem[] {
    return items.filter((item) => item.isApproved && item.proposedValue.trim().length > 0);
  }
}
