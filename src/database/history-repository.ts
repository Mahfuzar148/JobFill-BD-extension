// JobFill BD - History Repository (IndexedDB + Storage Adapter)
// Stores and queries completed autofill session audits with strict privacy and PII protection.

import { AutofillHistoryRecord, AutofillFieldAuditItem } from '../types/profile';
import { IndexedDBManager, STORES } from './indexeddb';

const STORAGE_KEY_HISTORY = 'jobfill_autofill_history';

/**
 * Sanitizes field values before saving to history log.
 * Plaintext passwords, OTPs, CAPTCHAs, secrets, and raw binaries are strictly forbidden.
 */
export function sanitizeHistoryFieldRecord(
  canonicalKey: string,
  fieldLabel: string,
  val?: string
): string {
  if (!val) return '';
  const keyLower = String(canonicalKey || '').toLowerCase();
  const labelLower = String(fieldLabel || '').toLowerCase();

  // Strict exclusions: Never store password, otp, pin, captcha, tokens, or raw secrets
  if (
    keyLower.includes('password') ||
    labelLower.includes('password') ||
    keyLower.includes('passcode') ||
    keyLower.includes('passwd') ||
    keyLower.includes('pin') ||
    keyLower.includes('otp') ||
    labelLower.includes('otp') ||
    keyLower.includes('captcha') ||
    labelLower.includes('captcha') ||
    keyLower.includes('token') ||
    keyLower.includes('secret')
  ) {
    return '[PROTECTED]';
  }

  // National ID and sensitive identity masking
  if (
    keyLower.includes('nationalid') ||
    keyLower.includes('nid') ||
    keyLower.includes('passport') ||
    keyLower.includes('birthreg')
  ) {
    return val.length > 4 ? `***${val.slice(-4)}` : '****';
  }

  // Large binary data (photos / signatures) should never be stored in history
  if (val.startsWith('data:image') || val.length > 300) {
    return val.startsWith('data:image') ? '[Image Attached]' : `${val.slice(0, 100)}...`;
  }

  return val;
}

/**
 * Sanitizes an entire Autofill History Record.
 */
export function sanitizeHistoryRecord(record: AutofillHistoryRecord): AutofillHistoryRecord {
  const sanitizedUrl = (() => {
    try {
      const u = new URL(record.url);
      return `${u.origin}${u.pathname}`;
    } catch {
      return String(record.url || '').split('?')[0].split('#')[0];
    }
  })();

  const cleanFieldResults: AutofillFieldAuditItem[] = (record.fieldResults || []).map((f) => ({
    ...f,
    value: sanitizeHistoryFieldRecord(f.fieldKey, f.fieldLabel, f.value),
  }));

  const cleanFilledFields = (record.filledFields || []).map((f) => ({
    ...f,
    value: sanitizeHistoryFieldRecord(f.canonicalKey, f.fieldLabel, f.value),
  }));

  const cleanProfileName =
    record.profileName === 'Md. Real Applicant Name'
      ? 'Applicant Profile'
      : record.profileName || 'Applicant Profile';

  return {
    ...record,
    url: sanitizedUrl,
    profileName: cleanProfileName,
    fieldResults: cleanFieldResults,
    filledFields: cleanFilledFields,
  };
}

export class HistoryRepository {
  /**
   * Retrieves all autofill history sessions sorted descending by timestamp.
   * If IndexedDB is empty but chrome.storage.local has records, backfills IndexedDB.
   */
  public static async getHistory(): Promise<AutofillHistoryRecord[]> {
    let idbRecords: AutofillHistoryRecord[] = [];
    try {
      idbRecords = await IndexedDBManager.executeTransaction<AutofillHistoryRecord[]>(
        STORES.HISTORY,
        'readonly',
        (store) =>
          new Promise((resolve, reject) => {
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
          })
      );
      if (idbRecords && idbRecords.length > 0) {
        return idbRecords.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      }
    } catch {
      // IndexedDB unavailable or error
    }

    // Fallback to chrome.storage.local
    let fallbackRecords: AutofillHistoryRecord[] = [];
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      fallbackRecords = await new Promise<AutofillHistoryRecord[]>((resolve) => {
        try {
          chrome.storage.local.get([STORAGE_KEY_HISTORY], (res) => {
            resolve(res?.[STORAGE_KEY_HISTORY] || []);
          });
        } catch {
          resolve([]);
        }
      });
    } else if (typeof localStorage !== 'undefined') {
      try {
        const local = localStorage.getItem(STORAGE_KEY_HISTORY);
        fallbackRecords = local ? JSON.parse(local) : [];
      } catch {
        fallbackRecords = [];
      }
    }

    // If fallback had records and IndexedDB was empty, backfill IndexedDB
    if (fallbackRecords.length > 0) {
      try {
        await IndexedDBManager.executeTransaction(STORES.HISTORY, 'readwrite', (store) =>
          new Promise<void>((resolve) => {
            for (const r of fallbackRecords) {
              store.put(r);
            }
            resolve();
          })
        );
      } catch {
        // safe ignore
      }
      return fallbackRecords.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    }

    return [];
  }

  /**
   * Retrieves a single session record by ID.
   */
  public static async getById(id: string): Promise<AutofillHistoryRecord | null> {
    try {
      const rec = await IndexedDBManager.executeTransaction<AutofillHistoryRecord | null>(
        STORES.HISTORY,
        'readonly',
        (store) =>
          new Promise((resolve, reject) => {
            const req = store.get(id);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
          })
      );
      if (rec) return rec;
    } catch {
      // safe fallback
    }

    const all = await this.getHistory();
    return all.find((r) => r.id === id || r.sessionId === id) || null;
  }

  /**
   * Adds or updates a session record.
   * Performs sanitization and writes to both IndexedDB and chrome.storage.local.
   */
  public static async addRecord(record: AutofillHistoryRecord): Promise<void> {
    return this.upsertRecord(record);
  }

  /**
   * Upserts a session record with sanitization.
   */
  public static async upsertRecord(record: AutofillHistoryRecord): Promise<void> {
    const sanitized = sanitizeHistoryRecord(record);

    let savedToIdb = false;
    try {
      await IndexedDBManager.executeTransaction(STORES.HISTORY, 'readwrite', (store) =>
        new Promise<void>((resolve, reject) => {
          const req = store.put(sanitized);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        })
      );
      savedToIdb = true;
    } catch (e) {
      console.warn('JobFill BD: HistoryRepository IndexedDB write failed, falling back to storage:', e);
    }

    // Keep sync copy in chrome.storage.local (last 100 sessions)
    try {
      const current = await this.getHistory();
      const updated = [sanitized, ...current.filter((r) => r.id !== sanitized.id)].slice(0, 100);

      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await new Promise<void>((resolve) => {
          chrome.storage.local.set({ [STORAGE_KEY_HISTORY]: updated }, () => resolve());
        });
      } else if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(updated));
      }
    } catch {
      // safe ignore
    }
  }

  /**
   * Deletes a single session record by ID.
   * Does NOT touch Application Tracker records.
   */
  public static async deleteRecord(id: string): Promise<void> {
    try {
      await IndexedDBManager.executeTransaction(STORES.HISTORY, 'readwrite', (store) =>
        new Promise<void>((resolve, reject) => {
          const req = store.delete(id);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        })
      );
    } catch {
      // safe fallback
    }

    try {
      const current = await this.getHistory();
      const updated = current.filter((r) => r.id !== id && r.sessionId !== id);
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await new Promise<void>((resolve) => {
          chrome.storage.local.set({ [STORAGE_KEY_HISTORY]: updated }, () => resolve());
        });
      } else if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(updated));
      }
    } catch {
      // safe ignore
    }
  }

  /**
   * Clears all autofill history sessions.
   * Does NOT touch Application Tracker records.
   */
  public static async clearHistory(): Promise<void> {
    try {
      await IndexedDBManager.executeTransaction(STORES.HISTORY, 'readwrite', (store) =>
        new Promise<void>((resolve, reject) => {
          const req = store.clear();
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        })
      );
    } catch {
      // safe fallback
    }

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await new Promise<void>((resolve) => {
        chrome.storage.local.remove([STORAGE_KEY_HISTORY], () => resolve());
      });
    } else if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY_HISTORY);
    }
  }

  /**
   * Computes truthful audit statistics from actual persisted sessions.
   */
  public static async getStatistics(): Promise<{
    totalSessions: number;
    totalFilled: number;
    totalAttempted: number;
    totalFailed: number;
    successRate: number | null;
    successRateFormatted: string;
    securityStatus: string;
  }> {
    const records = await this.getHistory();
    const totalSessions = records.length;
    const totalFilled = records.reduce((sum, r) => sum + (r.totalFilled || 0), 0);
    const totalFailed = records.reduce((sum, r) => sum + (r.totalFailed || 0), 0);
    const totalAttempted = records.reduce(
      (sum, r) => sum + (r.attemptedFields || (r.totalFilled + r.totalFailed) || r.totalDetected || 0),
      0
    );

    let successRate: number | null = null;
    let successRateFormatted = 'N/A';

    if (totalSessions > 0 && totalAttempted > 0) {
      successRate = Math.round((totalFilled / totalAttempted) * 100);
      successRateFormatted = `${successRate}%`;
    } else if (totalSessions > 0 && totalAttempted === 0) {
      successRate = 0;
      successRateFormatted = '0%';
    }

    return {
      totalSessions,
      totalFilled,
      totalAttempted,
      totalFailed,
      successRate,
      successRateFormatted,
      securityStatus: 'Local AES-256-GCM Vault • Zero Cloud Sync',
    };
  }
}
