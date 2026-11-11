// JobFill BD - Secure Key Manager
// Manages in-memory non-extractable CryptoKey vault sessions only.
// Never persists plaintext passwords or raw encryption keys to LocalStorage, IndexedDB, or chrome.storage.

export class KeyManager {
  private static activeKey: CryptoKey | null = null;
  private static activeSaltHex: string | null = null;
  private static sessionExpiresAt: number | null = null;

  public static setSessionKey(
    key: CryptoKey,
    saltHex?: string,
    autoLockMinutes = 15
  ): void {
    this.activeKey = key;
    this.activeSaltHex = saltHex || null;
    this.sessionExpiresAt = Date.now() + Math.max(1, autoLockMinutes) * 60 * 1000;
  }

  public static refreshSessionExpiry(autoLockMinutes = 15): void {
    if (!this.activeKey) return;
    this.sessionExpiresAt = Date.now() + Math.max(1, autoLockMinutes) * 60 * 1000;
  }

  public static getSessionExpiresAt(): number | null {
    return this.sessionExpiresAt;
  }

  public static getSessionKey(): CryptoKey | null {
    if (this.sessionExpiresAt !== null && Date.now() >= this.sessionExpiresAt) {
      this.clearKey();
      return null;
    }
    return this.activeKey;
  }

  public static getSessionSaltHex(): string | null {
    if (!this.getSessionKey()) return null;
    return this.activeSaltHex;
  }

  public static isKeyActive(): boolean {
    if (this.sessionExpiresAt !== null && Date.now() >= this.sessionExpiresAt) {
      this.clearKey();
      return false;
    }
    return this.activeKey !== null;
  }

  public static clearKey(): void {
    this.activeKey = null;
    this.activeSaltHex = null;
    this.sessionExpiresAt = null;
  }
}
