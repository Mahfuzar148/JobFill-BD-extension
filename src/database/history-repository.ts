// JobFill BD - History Repository (IndexedDB + Storage Adapter)
// Stores and queries completed autofill session audits.

import { AutofillHistoryRecord } from '../types/profile';
import { IndexedDBManager, STORES } from './indexeddb';

const STORAGE_KEY_HISTORY = 'jobfill_autofill_history';

export class HistoryRepository {
  public static async getHistory(): Promise<AutofillHistoryRecord[]> {
    try {
      const records = await IndexedDBManager.executeTransaction<AutofillHistoryRecord[]>(
        STORES.HISTORY,
        'readonly',
        (store) =>
          new Promise((resolve, reject) => {
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
          })
      );
      if (records && records.length > 0) {
        return records.sort((a, b) => b.timestamp - a.timestamp);
      }
    } catch {
      // Fallback
    }

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return new Promise((resolve) => {
        chrome.storage.local.get([STORAGE_KEY_HISTORY], (res) => {
          resolve(res[STORAGE_KEY_HISTORY] || []);
        });
      });
    }

    const local = localStorage.getItem(STORAGE_KEY_HISTORY);
    return local ? JSON.parse(local) : [];
  }

  public static async addRecord(record: AutofillHistoryRecord): Promise<void> {
    try {
      await IndexedDBManager.executeTransaction(STORES.HISTORY, 'readwrite', (store) =>
        new Promise<void>((resolve, reject) => {
          const req = store.put(record);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        })
      );
    } catch {
      // Fallback
    }

    const current = await this.getHistory();
    const updated = [record, ...current.filter((r) => r.id !== record.id)].slice(0, 100);

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ [STORAGE_KEY_HISTORY]: updated });
    } else {
      localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(updated));
    }
  }

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
      // Fallback
    }

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.remove([STORAGE_KEY_HISTORY]);
    } else {
      localStorage.removeItem(STORAGE_KEY_HISTORY);
    }
  }
}
