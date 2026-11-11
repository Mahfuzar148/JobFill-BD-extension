// JobFill BD - Vault Manager
// Delegates cleanly to canonical vault settings and non-extractable PBKDF2 CryptoKey sessions.
// Never stores plaintext passwords or dummy keys.

import { hashPassword, deriveMasterVaultCryptoKey, generateSaltHex } from '../utils/crypto';
import { KeyManager } from './key-manager';
import { SessionManager } from './session-manager';
import { SecuritySettings } from '../types/profile';

const STORAGE_KEY_SECURITY = 'jobfill_security_settings';

export class VaultManager {
  public static async getSettings(): Promise<SecuritySettings> {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return new Promise((resolve) => {
        chrome.storage.local.get([STORAGE_KEY_SECURITY], (res) => {
          resolve(
            res[STORAGE_KEY_SECURITY] || {
              isPasswordProtected: false,
              autoLockMinutes: 15,
              activeProfileId: '',
            }
          );
        });
      });
    }

    const local = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY_SECURITY) : null;
    return local
      ? JSON.parse(local)
      : {
          isPasswordProtected: false,
          autoLockMinutes: 15,
          activeProfileId: '',
        };
  }

  public static async setPassword(password: string, autoLockMins = 15): Promise<void> {
    const saltHex = generateSaltHex();
    const { hashHex } = await hashPassword(password, saltHex);
    const derivedKey = await deriveMasterVaultCryptoKey(password, saltHex);

    const existing = await this.getSettings();
    const settings: SecuritySettings = {
      ...existing,
      isPasswordProtected: true,
      passwordHash: hashHex,
      salt: saltHex,
      autoLockMinutes: autoLockMins,
      activeProfileId: existing.activeProfileId || '',
    };

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set({ [STORAGE_KEY_SECURITY]: settings });
    } else if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_SECURITY, JSON.stringify(settings));
    }

    KeyManager.setSessionKey(derivedKey, saltHex, autoLockMins);
    SessionManager.setAutoLockMinutes(autoLockMins);
    SessionManager.recordActivity();
  }

  public static async unlock(password: string): Promise<boolean> {
    const settings = await this.getSettings();
    if (!settings.isPasswordProtected) return true;
    if (!settings.salt || !settings.passwordHash) return false;

    const { hashHex } = await hashPassword(password, settings.salt);
    if (hashHex === settings.passwordHash) {
      const derivedKey = await deriveMasterVaultCryptoKey(password, settings.salt);
      KeyManager.setSessionKey(derivedKey, settings.salt, settings.autoLockMinutes || 15);
      SessionManager.recordActivity();
      return true;
    }
    return false;
  }

  public static isLocked(): boolean {
    return !KeyManager.isKeyActive() || SessionManager.isSessionExpired();
  }

  public static lock(): void {
    SessionManager.lockSession();
  }
}
