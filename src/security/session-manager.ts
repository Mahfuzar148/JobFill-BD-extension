// JobFill BD - Vault Session Lifecycle Manager
// Enforces auto-lock timeouts (e.g. 15 minutes of inactivity).
// Handles MV3 service worker suspensions safely.

import { KeyManager } from './key-manager';

export class SessionManager {
  private static lastActivityTimestamp = Date.now();
  private static autoLockMinutes = 15;

  public static recordActivity(): void {
    this.lastActivityTimestamp = Date.now();
  }

  public static setAutoLockMinutes(minutes: number): void {
    this.autoLockMinutes = Math.max(1, minutes);
  }

  public static getAutoLockMinutes(): number {
    return this.autoLockMinutes;
  }

  public static isSessionExpired(): boolean {
    if (!KeyManager.isKeyActive()) return true;
    const elapsedMinutes = (Date.now() - this.lastActivityTimestamp) / (1000 * 60);
    return elapsedMinutes >= this.autoLockMinutes;
  }

  public static lockSession(): void {
    KeyManager.clearKey();
  }
}
