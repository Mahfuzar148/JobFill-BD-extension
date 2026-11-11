// JobFill BD - Profile, Education, Experience & Encrypted Vault Repository (IndexedDB v8)
// Stores encrypted vault bundles and encrypted normalized education & experience records
// locally inside Chrome IndexedDB. Never stores plaintext PII when Web Crypto IDB is active.

import { UserProfile } from '../types/profile';
import { createEmptyProfile, sampleDemoProfile } from '../types/defaults';
import { IndexedDBManager, STORES } from './indexeddb';
import {
  EncryptedPayload,
  NativeKeyEncryptedPayload,
  encryptWithCryptoKey,
  decryptWithCryptoKey,
  encryptDataWithKey,
  decryptDataWithKey,
  generateNonExtractableAesKey,
} from '../utils/crypto';
import { KeyManager } from '../security/key-manager';

const STORAGE_KEY_PROFILES = 'jobfill_profiles';
const PROFILE_VAULT_RECORD_ID = 'encrypted_profile_vault_v1';
const DEVICE_PROFILE_KEY_ID = 'device_profile_aes_key_v2';

export interface StoredEducationRecord {
  id: string;
  profileId: string;
  level: 'ssc' | 'hsc' | 'graduation' | 'masters' | 'additional';
  examination: string;
  boardOrUniversity: string;
  rollNumber?: string;
  passingYear?: string;
  gpa?: string;
  updatedAt: string;
}

export interface StoredExperienceRecord {
  id: string;
  profileId: string;
  organization: string;
  designation: string;
  fromDate: string;
  toDate: string;
  isCurrent: boolean;
  responsibilities?: string;
  updatedAt: string;
}

export interface EncryptedStructuredRow {
  id: string;
  profileId: string;
  level?: string;
  isEncrypted: true;
  nativeEncryptedPayload?: NativeKeyEncryptedPayload;
  encryptedPayload?: EncryptedPayload;
  updatedAt: string;
}

export interface StoredProfileVaultRecord {
  id: string;
  mode: 'master_password' | 'device_key';
  encryptedPayload?: EncryptedPayload;
  nativeEncryptedPayload?: NativeKeyEncryptedPayload;
  updatedAt: number;
}

function extractEducationRecords(profile: UserProfile): StoredEducationRecord[] {
  const nowIso = profile.updatedAt || new Date().toISOString();
  const records: StoredEducationRecord[] = [];
  if (profile.ssc?.examination || profile.ssc?.rollNumber || profile.ssc?.board) {
    records.push({
      id: `${profile.id}_ssc`,
      profileId: profile.id,
      level: 'ssc',
      examination: profile.ssc.examination,
      boardOrUniversity: profile.ssc.board,
      rollNumber: profile.ssc.rollNumber,
      passingYear: profile.ssc.passingYear,
      gpa: profile.ssc.gpa,
      updatedAt: nowIso,
    });
  }
  if (profile.hsc?.examination || profile.hsc?.rollNumber || profile.hsc?.board) {
    records.push({
      id: `${profile.id}_hsc`,
      profileId: profile.id,
      level: 'hsc',
      examination: profile.hsc.examination,
      boardOrUniversity: profile.hsc.board,
      rollNumber: profile.hsc.rollNumber,
      passingYear: profile.hsc.passingYear,
      gpa: profile.hsc.gpa,
      updatedAt: nowIso,
    });
  }
  if (profile.hasGraduation && (profile.graduation?.examination || profile.graduation?.universityInstitute)) {
    records.push({
      id: `${profile.id}_graduation`,
      profileId: profile.id,
      level: 'graduation',
      examination: profile.graduation.examination || profile.graduation.subjectDegree,
      boardOrUniversity: profile.graduation.universityInstitute,
      passingYear: profile.graduation.passingYear,
      gpa: profile.graduation.gpa,
      updatedAt: nowIso,
    });
  }
  if (profile.hasMasters && (profile.masters?.examination || profile.masters?.universityInstitute)) {
    records.push({
      id: `${profile.id}_masters`,
      profileId: profile.id,
      level: 'masters',
      examination: profile.masters.examination || profile.masters.subjectDegree,
      boardOrUniversity: profile.masters.universityInstitute,
      passingYear: profile.masters.passingYear,
      gpa: profile.masters.gpa,
      updatedAt: nowIso,
    });
  }
  (profile.additionalQualifications || []).forEach((q, idx) => {
    records.push({
      id: `${profile.id}_add_${q.id || idx}`,
      profileId: profile.id,
      level: 'additional',
      examination: q.title,
      boardOrUniversity: q.institution,
      passingYear: q.year,
      updatedAt: nowIso,
    });
  });
  return records;
}

function extractExperienceRecords(profile: UserProfile): StoredExperienceRecord[] {
  const nowIso = profile.updatedAt || new Date().toISOString();
  return (profile.jobExperiences || []).map((exp, idx) => ({
    id: `${profile.id}_exp_${exp.id || idx}`,
    profileId: profile.id,
    organization: exp.organization,
    designation: exp.designation,
    fromDate: exp.startDate,
    toDate: exp.endDate,
    isCurrent: Boolean(exp.currentlyWorking),
    responsibilities: exp.jobDescription,
    updatedAt: nowIso,
  }));
}

async function replaceStoreItems<T>(storeName: string, items: T[]): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  await IndexedDBManager.executeTransaction(storeName, 'readwrite', (store) =>
    new Promise<void>((resolve, reject) => {
      const clearReq = store.clear();
      clearReq.onerror = () => reject(clearReq.error);
      clearReq.onsuccess = () => {
        for (const item of items) {
          store.put(item);
        }
        resolve();
      };
    })
  );
}

async function readAllStoreItems<T>(storeName: string): Promise<T[]> {
  if (typeof indexedDB === 'undefined') return [];
  return IndexedDBManager.executeTransaction<T[]>(
    storeName,
    'readonly',
    (store) =>
      new Promise((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      })
  );
}

async function encryptStructuredRow<T extends { id: string; profileId: string; updatedAt: string; level?: string }>(
  row: T,
  deviceKey: CryptoKey | null
): Promise<EncryptedStructuredRow | null> {
  const sessionKey = KeyManager.getSessionKey();
  const sessionSalt = KeyManager.getSessionSaltHex();
  if (sessionKey && sessionSalt) {
    const encryptedPayload = await encryptDataWithKey(JSON.stringify(row), sessionKey, sessionSalt);
    return {
      id: row.id,
      profileId: row.profileId,
      level: row.level,
      isEncrypted: true,
      encryptedPayload,
      updatedAt: row.updatedAt,
    };
  }
  if (deviceKey) {
    const nativeEncryptedPayload = await encryptWithCryptoKey(JSON.stringify(row), deviceKey);
    return {
      id: row.id,
      profileId: row.profileId,
      level: row.level,
      isEncrypted: true,
      nativeEncryptedPayload,
      updatedAt: row.updatedAt,
    };
  }
  return null;
}

async function decryptStructuredRow<T>(
  raw: any,
  deviceKey: CryptoKey | null
): Promise<T | null> {
  if (!raw || typeof raw !== 'object') return null;
  if (!raw.isEncrypted) return raw as T;

  try {
    if (raw.nativeEncryptedPayload && deviceKey) {
      const json = await decryptWithCryptoKey(raw.nativeEncryptedPayload, deviceKey);
      return JSON.parse(json) as T;
    }
    const sessionKey = KeyManager.getSessionKey();
    if (raw.encryptedPayload && sessionKey) {
      const json = await decryptDataWithKey(raw.encryptedPayload, sessionKey);
      return JSON.parse(json) as T;
    }
  } catch {
    return null;
  }
  return null;
}

export class ProfileRepository {
  public static async getProfilesFromIndexedDbOnly(): Promise<UserProfile[]> {
    try {
      const rows = await readAllStoreItems<any>(STORES.PROFILES);
      return rows.filter((r) => r && !r.isEncrypted && r.personal && r.ssc);
    } catch {
      return [];
    }
  }

  public static async getRawStoreCounts(): Promise<{
    profilesCount: number;
    educationCount: number;
    experienceCount: number;
    encryptedEducationCount: number;
    encryptedExperienceCount: number;
  }> {
    const [profs, edus, exps] = await Promise.all([
      readAllStoreItems<any>(STORES.PROFILES).catch(() => []),
      readAllStoreItems<any>(STORES.EDUCATION_RECORDS).catch(() => []),
      readAllStoreItems<any>(STORES.EXPERIENCE_RECORDS).catch(() => []),
    ]);
    return {
      profilesCount: profs.length,
      educationCount: edus.length,
      experienceCount: exps.length,
      encryptedEducationCount: edus.filter((r) => Boolean(r?.isEncrypted)).length,
      encryptedExperienceCount: exps.filter((r) => Boolean(r?.isEncrypted)).length,
    };
  }

  public static async getEducationRecords(profileId?: string): Promise<StoredEducationRecord[]> {
    try {
      const rawAll = await readAllStoreItems<any>(STORES.EDUCATION_RECORDS);
      const filtered = profileId ? rawAll.filter((r) => r?.profileId === profileId) : rawAll;
      if (filtered.length === 0) return [];
      const deviceKey = await this.getOrCreateDeviceProfileCryptoKey(generateNonExtractableAesKey);
      const out: StoredEducationRecord[] = [];
      for (const row of filtered) {
        const dec = await decryptStructuredRow<StoredEducationRecord>(row, deviceKey);
        if (dec) out.push(dec);
      }
      return out;
    } catch {
      return [];
    }
  }

  public static async getExperienceRecords(profileId?: string): Promise<StoredExperienceRecord[]> {
    try {
      const rawAll = await readAllStoreItems<any>(STORES.EXPERIENCE_RECORDS);
      const filtered = profileId ? rawAll.filter((r) => r?.profileId === profileId) : rawAll;
      if (filtered.length === 0) return [];
      const deviceKey = await this.getOrCreateDeviceProfileCryptoKey(generateNonExtractableAesKey);
      const out: StoredExperienceRecord[] = [];
      for (const row of filtered) {
        const dec = await decryptStructuredRow<StoredExperienceRecord>(row, deviceKey);
        if (dec) out.push(dec);
      }
      return out;
    } catch {
      return [];
    }
  }

  public static async syncEncryptedNormalizedRecords(profiles: UserProfile[]): Promise<void> {
    if (typeof indexedDB === 'undefined') return;
    try {
      const deviceKey = await this.getOrCreateDeviceProfileCryptoKey(generateNonExtractableAesKey);
      const eduRows = profiles.flatMap(extractEducationRecords);
      const expRows = profiles.flatMap(extractExperienceRecords);

      const encEdu: EncryptedStructuredRow[] = [];
      for (const r of eduRows) {
        const encrypted = await encryptStructuredRow(r, deviceKey);
        if (encrypted) encEdu.push(encrypted);
      }

      const encExp: EncryptedStructuredRow[] = [];
      for (const r of expRows) {
        const encrypted = await encryptStructuredRow(r, deviceKey);
        if (encrypted) encExp.push(encrypted);
      }

      await replaceStoreItems(STORES.EDUCATION_RECORDS, encEdu);
      await replaceStoreItems(STORES.EXPERIENCE_RECORDS, encExp);
    } catch {
      // Safe fallback in restricted IDB contexts
    }
  }

  public static async syncAllProfilesToIndexedDb(
    profiles: UserProfile[],
    options: { includePlaintextProfileStore?: boolean } = {}
  ): Promise<void> {
    if (typeof indexedDB === 'undefined') return;
    try {
      await this.syncEncryptedNormalizedRecords(profiles);
      if (options.includePlaintextProfileStore === true) {
        await replaceStoreItems(STORES.PROFILES, profiles);
      } else {
        await replaceStoreItems(STORES.PROFILES, []);
      }
    } catch {
      // Safe fallback in environments where IDB is closed or restricted
    }
  }

  public static async clearPlaintextProfileStores(): Promise<void> {
    if (typeof indexedDB === 'undefined') return;
    try {
      await replaceStoreItems(STORES.PROFILES, []);
      const [edus, exps] = await Promise.all([
        readAllStoreItems<any>(STORES.EDUCATION_RECORDS),
        readAllStoreItems<any>(STORES.EXPERIENCE_RECORDS),
      ]);
      if (edus.some((r) => !r?.isEncrypted)) {
        await replaceStoreItems(STORES.EDUCATION_RECORDS, edus.filter((r) => Boolean(r?.isEncrypted)));
      }
      if (exps.some((r) => !r?.isEncrypted)) {
        await replaceStoreItems(STORES.EXPERIENCE_RECORDS, exps.filter((r) => Boolean(r?.isEncrypted)));
      }
    } catch {
      // Safe fallback
    }
  }

  public static async getEncryptedVaultRecord(): Promise<StoredProfileVaultRecord | null> {
    if (typeof indexedDB === 'undefined') return null;
    try {
      return await IndexedDBManager.executeTransaction<StoredProfileVaultRecord | null>(
        STORES.VAULT_STORE,
        'readonly',
        (store) =>
          new Promise((resolve, reject) => {
            const req = store.get(PROFILE_VAULT_RECORD_ID);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
          })
      );
    } catch {
      return null;
    }
  }

  public static async saveEncryptedVaultRecord(
    record: Omit<StoredProfileVaultRecord, 'id'>
  ): Promise<boolean> {
    if (typeof indexedDB === 'undefined') return false;
    try {
      await IndexedDBManager.executeTransaction(STORES.VAULT_STORE, 'readwrite', (store) =>
        new Promise<void>((resolve, reject) => {
          const req = store.put({ ...record, id: PROFILE_VAULT_RECORD_ID });
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        })
      );
      return true;
    } catch {
      return false;
    }
  }

  public static async getOrCreateDeviceProfileCryptoKey(
    generator: () => Promise<CryptoKey>
  ): Promise<CryptoKey | null> {
    if (typeof indexedDB === 'undefined') return null;
    try {
      const existing = await IndexedDBManager.executeTransaction<{ id: string; key?: CryptoKey } | null>(
        STORES.VAULT_STORE,
        'readonly',
        (store) =>
          new Promise((resolve, reject) => {
            const req = store.get(DEVICE_PROFILE_KEY_ID);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
          })
      );
      if (existing?.key) return existing.key;

      const generated = await generator();
      await IndexedDBManager.executeTransaction(STORES.VAULT_STORE, 'readwrite', (store) =>
        new Promise<void>((resolve, reject) => {
          const req = store.put({ id: DEVICE_PROFILE_KEY_ID, key: generated, updatedAt: Date.now() });
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        })
      );
      return generated;
    } catch {
      return null;
    }
  }

  public static async clearAllLocalProfileStores(): Promise<void> {
    if (typeof indexedDB === 'undefined') return;
    try {
      await replaceStoreItems(STORES.PROFILES, []);
      await replaceStoreItems(STORES.EDUCATION_RECORDS, []);
      await replaceStoreItems(STORES.EXPERIENCE_RECORDS, []);
      await replaceStoreItems(STORES.VAULT_STORE, []);
    } catch {
      // Ignore
    }
  }

  public static async getAllProfiles(): Promise<UserProfile[]> {
    const idbProfiles = await this.getProfilesFromIndexedDbOnly();
    if (idbProfiles.length > 0) return idbProfiles;

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return new Promise((resolve) => {
        chrome.storage.local.get([STORAGE_KEY_PROFILES], (res) => {
          const fallback = (typeof __JOBFILL_STORE_CLEAN__ !== 'undefined' && __JOBFILL_STORE_CLEAN__)
            ? [createEmptyProfile('My Job Profile')]
            : [sampleDemoProfile];
          resolve(res[STORAGE_KEY_PROFILES] || fallback);
        });
      });
    }

    const local = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY_PROFILES) : null;
    const fallback = (typeof __JOBFILL_STORE_CLEAN__ !== 'undefined' && __JOBFILL_STORE_CLEAN__)
      ? [createEmptyProfile('My Job Profile')]
      : [sampleDemoProfile];
    return local ? JSON.parse(local) : fallback;
  }

  public static async getProfileById(id: string): Promise<UserProfile | null> {
    const all = await this.getAllProfiles();
    return all.find((p) => p.id === id) || null;
  }

  public static async saveProfile(profile: UserProfile): Promise<void> {
    profile.updatedAt = new Date().toISOString();

    const all = await this.getAllProfiles();
    const idx = all.findIndex((p) => p.id === profile.id);
    if (idx >= 0) all[idx] = profile;
    else all.push(profile);

    await this.syncAllProfilesToIndexedDb(all, { includePlaintextProfileStore: false });

    if (typeof indexedDB === 'undefined') {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ [STORAGE_KEY_PROFILES]: all });
      } else if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(all));
      }
    }
  }

  public static async deleteProfile(id: string): Promise<void> {
    const all = await this.getAllProfiles();
    const filtered = all.filter((p) => p.id !== id);
    await this.syncAllProfilesToIndexedDb(filtered, { includePlaintextProfileStore: false });

    if (typeof indexedDB === 'undefined') {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ [STORAGE_KEY_PROFILES]: filtered });
      } else if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(filtered));
      }
    }
  }
}
