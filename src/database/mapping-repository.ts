// JobFill BD - Adaptive Mapping Storage Repository
// Implements secure, privacy-preserving persistence of field mappings.
// Absolutely zero personal applicant data is ever stored in mapping memory.

import { LearnedMappingRecord, FieldFingerprint, computeFingerprintKey } from '../intelligence/mapping-memory';

const STORAGE_KEY = 'jobfill_adaptive_mapping_memory';

export class MappingRepository {
  private static cache: Map<string, LearnedMappingRecord> | null = null;

  // Loads learned mappings into memory cache
  public static async load(): Promise<Map<string, LearnedMappingRecord>> {
    if (this.cache) return this.cache;

    this.cache = new Map();

    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const result: any = await new Promise((resolve) => {
          chrome.storage.local.get([STORAGE_KEY], (res) => resolve(res || {}));
        });
        const records: LearnedMappingRecord[] = (result && result[STORAGE_KEY]) || [];
        for (const r of records) {
          this.cache.set(r.fingerprintHash, r);
        }
      } else if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const records: LearnedMappingRecord[] = JSON.parse(raw);
          for (const r of records) {
            this.cache.set(r.fingerprintHash, r);
          }
        }
      }
    } catch (e) {
      console.warn('JobFill BD: Failed to load adaptive mapping memory', e);
    }

    return this.cache;
  }

  // Finds a learned mapping for a given fingerprint
  public static async findMapping(fp: FieldFingerprint): Promise<LearnedMappingRecord | null> {
    const memory = await this.load();
    const key = computeFingerprintKey(fp);
    if (memory.has(key)) {
      return memory.get(key)!;
    }

    // Secondary fallback: wildcard domain check (if learned on one govt portal with identical name & section)
    const genericKey = `*::${fp.sectionContext}::${fp.tagName}:${fp.inputType}::${fp.normalizedName || fp.normalizedId}`;
    if (memory.has(genericKey)) {
      return memory.get(genericKey)!;
    }

    return null;
  }

  // Saves or updates a confirmed mapping
  public static async recordConfirmation(fp: FieldFingerprint, canonicalKey: string): Promise<void> {
    const memory = await this.load();
    const key = computeFingerprintKey(fp);

    const existing = memory.get(key);
    if (existing) {
      if (existing.canonicalKey === canonicalKey) {
        existing.confirmationCount += 1;
        existing.lastConfirmedAt = new Date().toISOString();
        existing.accuracyScore = Math.min(100, existing.accuracyScore + 5);
      } else {
        // User re-assigned field to another key -> override
        existing.canonicalKey = canonicalKey;
        existing.confirmationCount = 1;
        existing.lastConfirmedAt = new Date().toISOString();
        existing.accuracyScore = 90;
      }
    } else {
      memory.set(key, {
        fingerprintHash: key,
        domain: fp.domain,
        canonicalKey,
        confirmationCount: 1,
        lastConfirmedAt: new Date().toISOString(),
        accuracyScore: 95,
      });
    }

    await this.persist();
  }

  // Flushes cache to persistent storage
  private static async persist(): Promise<void> {
    if (!this.cache) return;
    const records = Array.from(this.cache.values());

    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({ [STORAGE_KEY]: records });
      } else if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
      }
    } catch (e) {
      console.warn('JobFill BD: Failed to persist adaptive mapping memory', e);
    }
  }

  // Removes a single learned mapping rule by fingerprintHash
  public static async deleteMapping(fingerprintHash: string): Promise<boolean> {
    const memory = await this.load();
    const removed = memory.delete(fingerprintHash);
    if (removed) {
      await this.persist();
    }
    return removed;
  }

  // Imports structural mapping records safely (ignores entries without fingerprintHash/canonicalKey)
  public static async importMappings(records: LearnedMappingRecord[]): Promise<number> {
    const memory = await this.load();
    let imported = 0;
    for (const r of records) {
      if (r && typeof r.fingerprintHash === 'string' && typeof r.canonicalKey === 'string' && r.canonicalKey.trim()) {
        memory.set(r.fingerprintHash, {
          fingerprintHash: r.fingerprintHash,
          domain: typeof r.domain === 'string' ? r.domain : '*',
          canonicalKey: r.canonicalKey.trim(),
          confirmationCount: Number(r.confirmationCount) || 1,
          lastConfirmedAt: typeof r.lastConfirmedAt === 'string' ? r.lastConfirmedAt : new Date().toISOString(),
          accuracyScore: Math.min(100, Math.max(0, Number(r.accuracyScore) || 90)),
        });
        imported += 1;
      }
    }
    if (imported > 0) {
      await this.persist();
    }
    return imported;
  }

  // Clears learned memory
  public static async clear(): Promise<void> {
    this.cache = new Map();
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.remove([STORAGE_KEY]);
    } else if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
}
