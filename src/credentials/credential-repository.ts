// JobFill BD - Local-Only Encrypted Job Portal Credential Vault Repository
// Security Guarantees:
// - Strictly local-only: NEVER included in Supabase Cloud Sync or remote API calls.
// - Encrypts sensitive fields (username, userId, applicantId, password, notes) with
//   AES-256-GCM + PBKDF2-SHA256 (210,000 iterations) and a unique 12-byte random IV per write.
// - Never persists the master password or raw encryption keys; clears session key on lock/expiry.

import { IndexedDBManager, STORES } from '../database/indexeddb';
import {
  EncryptedPayload,
  deriveMasterVaultCryptoKey,
  encryptDataWithKey,
  decryptDataWithKey,
  encryptData,
  decryptData,
  generateSaltHex,
} from '../utils/crypto';
import { normalizeStrictOrigin, isStrictOriginMatch } from './origin-matcher';

const CREDENTIAL_VAULT_META_KEY = 'jobfill_credential_vault_meta_v1';
const CREDENTIAL_LOCAL_FALLBACK_KEY = 'jobfill_credential_vault_items_v1';
const CREDENTIAL_PBKDF2_ITERATIONS = 210_000;
const VERIFIER_SENTINEL = 'JOBFILL_CREDENTIAL_VAULT_VERIFIER_OK';

export type CredentialAccountType =
  | 'General Portal Account'
  | 'Organization Account'
  | 'Job-Specific Account'
  | 'Recruitment Application Account'
  | 'Other';

export interface CredentialSecretPayload {
  username: string;
  userId: string;
  applicantId: string;
  password: string;
  notes: string;
  organization?: string;
  jobTitle?: string;
  jobCircularId?: string;
  accountType?: CredentialAccountType;
  linkedApplicationIds?: string[];
  verificationStatus?: 'verified' | 'unverified' | 'pending';
}

export interface StoredEncryptedCredentialRecord {
  id: string;
  portalName: string;
  portalUrl: string;
  origin: string;
  organization?: string;
  jobTitle?: string;
  jobCircularId?: string;
  accountType?: CredentialAccountType;
  verificationStatus?: 'verified' | 'unverified' | 'pending';
  lastUsedAt?: string;
  createdAt: string;
  updatedAt: string;
  encryptedPayload: EncryptedPayload;
}

export interface DecryptedCredentialEntry {
  id: string;
  portalName: string;
  portalUrl: string;
  origin: string;
  organization?: string;
  jobTitle?: string;
  jobCircularId?: string;
  accountType?: CredentialAccountType;
  linkedApplicationIds?: string[];
  verificationStatus?: 'verified' | 'unverified' | 'pending';
  lastUsedAt?: string;
  username: string;
  userId: string;
  applicantId: string;
  password: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface CredentialPortalSummary {
  id: string;
  portalName: string;
  portalUrl: string;
  origin: string;
  organization?: string;
  jobTitle?: string;
  accountType?: CredentialAccountType;
  verificationStatus?: 'verified' | 'unverified' | 'pending';
  lastUsedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CredentialVaultConfig {
  version: 1;
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  saltHex: string;
  verificationEnvelope: EncryptedPayload;
  autoLockMinutes: number;
  initializedAt: string;
  updatedAt: string;
}

export interface EncryptedCredentialBackupBundle {
  bundleType: 'jobfill_credential_vault_backup';
  schemaVersion: 1;
  createdAt: string;
  encryptedEnvelope: EncryptedPayload;
}

export interface CredentialVaultStatus {
  initialized: boolean;
  unlocked: boolean;
  autoLockMinutes: number;
  recordCount: number;
  expiresAt: number | null;
}

// Volatile memory session ONLY (cleared explicitly on lock or timeout)
let activeKey: CryptoKey | null = null;
let activeSaltHex: string | null = null;
let activeAutoLockMinutes = 10;
let activeExpiresAt: number | null = null;

async function readMeta(): Promise<CredentialVaultConfig | null> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    const res: any = await new Promise((resolve) => {
      chrome.storage.local.get([CREDENTIAL_VAULT_META_KEY], (r) => resolve(r || {}));
    });
    return res?.[CREDENTIAL_VAULT_META_KEY] || null;
  }
  const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(CREDENTIAL_VAULT_META_KEY) : null;
  return raw ? JSON.parse(raw) : null;
}

async function writeMeta(meta: CredentialVaultConfig): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    await chrome.storage.local.set({ [CREDENTIAL_VAULT_META_KEY]: meta });
    return;
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(CREDENTIAL_VAULT_META_KEY, JSON.stringify(meta));
  }
}

async function readAllEncryptedRecords(): Promise<StoredEncryptedCredentialRecord[]> {
  if (typeof indexedDB !== 'undefined') {
    try {
      return await IndexedDBManager.executeTransaction<StoredEncryptedCredentialRecord[]>(
        STORES.CREDENTIALS,
        'readonly',
        (store) =>
          new Promise((resolve, reject) => {
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
          })
      );
    } catch {
      // Fallback to localStorage envelope store when IndexedDB is unavailable in unit harnesses
    }
  }
  if (typeof localStorage !== 'undefined') {
    const raw = localStorage.getItem(CREDENTIAL_LOCAL_FALLBACK_KEY);
    return raw ? JSON.parse(raw) : [];
  }
  return [];
}

async function writeEncryptedRecord(record: StoredEncryptedCredentialRecord): Promise<void> {
  if (typeof indexedDB !== 'undefined') {
    try {
      await IndexedDBManager.executeTransaction<void>(
        STORES.CREDENTIALS,
        'readwrite',
        (store) =>
          new Promise((resolve, reject) => {
            const req = store.put(record);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
          })
      );
      return;
    } catch {
      // Fall through cleanly
    }
  }
  if (typeof localStorage !== 'undefined') {
    const list = await readAllEncryptedRecords();
    const idx = list.findIndex((r) => r.id === record.id);
    if (idx >= 0) list[idx] = record;
    else list.push(record);
    localStorage.setItem(CREDENTIAL_LOCAL_FALLBACK_KEY, JSON.stringify(list));
  }
}

async function removeEncryptedRecord(id: string): Promise<void> {
  if (typeof indexedDB !== 'undefined') {
    try {
      await IndexedDBManager.executeTransaction<void>(
        STORES.CREDENTIALS,
        'readwrite',
        (store) =>
          new Promise((resolve, reject) => {
            const req = store.delete(id);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
          })
      );
      return;
    } catch {
      // Fall through cleanly
    }
  }
  if (typeof localStorage !== 'undefined') {
    const list = await readAllEncryptedRecords();
    const filtered = list.filter((r) => r.id !== id);
    localStorage.setItem(CREDENTIAL_LOCAL_FALLBACK_KEY, JSON.stringify(filtered));
  }
}

function getValidatedActiveKey(): { key: CryptoKey; saltHex: string } {
  if (activeExpiresAt !== null && Date.now() >= activeExpiresAt) {
    CredentialVaultRepository.lockVault();
  }
  if (!activeKey || !activeSaltHex) {
    throw new Error('Credential Vault is locked.');
  }
  activeExpiresAt = Date.now() + Math.max(1, activeAutoLockMinutes) * 60_000;
  return { key: activeKey, saltHex: activeSaltHex };
}

export class CredentialVaultRepository {
  public static lockVault(): void {
    activeKey = null;
    activeSaltHex = null;
    activeExpiresAt = null;
  }

  public static isUnlocked(): boolean {
    if (activeExpiresAt !== null && Date.now() >= activeExpiresAt) {
      this.lockVault();
      return false;
    }
    return activeKey !== null;
  }

  public static touchSession(): void {
    if (this.isUnlocked()) {
      activeExpiresAt = Date.now() + Math.max(1, activeAutoLockMinutes) * 60_000;
    }
  }

  public static async getStatus(): Promise<CredentialVaultStatus> {
    const [meta, records] = await Promise.all([readMeta(), readAllEncryptedRecords()]);
    const unlocked = Boolean(meta) && this.isUnlocked();
    return {
      initialized: Boolean(meta),
      unlocked,
      autoLockMinutes: meta?.autoLockMinutes ?? activeAutoLockMinutes,
      recordCount: records.length,
      expiresAt: unlocked ? activeExpiresAt : null,
    };
  }

  public static async initializeVault(masterPassword: string, autoLockMinutes = 10): Promise<void> {
    if (!masterPassword || masterPassword.length < 8) {
      throw new Error('Master password must be at least 8 characters long.');
    }
    const existing = await readMeta();
    if (existing) {
      throw new Error('Credential Vault is already initialized. Unlock it first.');
    }

    const saltHex = generateSaltHex(16);
    const derivedKey = await deriveMasterVaultCryptoKey(
      masterPassword,
      saltHex,
      CREDENTIAL_PBKDF2_ITERATIONS
    );
    const verificationEnvelope = await encryptDataWithKey(
      JSON.stringify({ verifier: VERIFIER_SENTINEL, initializedAt: new Date().toISOString() }),
      derivedKey,
      saltHex,
      CREDENTIAL_PBKDF2_ITERATIONS
    );

    const nowIso = new Date().toISOString();
    const meta: CredentialVaultConfig = {
      version: 1,
      kdf: 'PBKDF2-SHA256',
      iterations: CREDENTIAL_PBKDF2_ITERATIONS,
      saltHex,
      verificationEnvelope,
      autoLockMinutes: Math.max(1, autoLockMinutes),
      initializedAt: nowIso,
      updatedAt: nowIso,
    };
    await writeMeta(meta);

    activeKey = derivedKey;
    activeSaltHex = saltHex;
    activeAutoLockMinutes = meta.autoLockMinutes;
    activeExpiresAt = Date.now() + meta.autoLockMinutes * 60_000;
  }

  public static async unlockVault(masterPassword: string): Promise<boolean> {
    const meta = await readMeta();
    if (!meta || !meta.saltHex || !meta.verificationEnvelope) {
      return false;
    }

    try {
      const candidateKey = await deriveMasterVaultCryptoKey(
        masterPassword,
        meta.saltHex,
        meta.iterations || CREDENTIAL_PBKDF2_ITERATIONS
      );
      const decrypted = await decryptDataWithKey(meta.verificationEnvelope, candidateKey);
      const parsed = JSON.parse(decrypted);
      if (parsed?.verifier !== VERIFIER_SENTINEL) {
        return false;
      }
      activeKey = candidateKey;
      activeSaltHex = meta.saltHex;
      activeAutoLockMinutes = meta.autoLockMinutes || 10;
      activeExpiresAt = Date.now() + activeAutoLockMinutes * 60_000;
      return true;
    } catch {
      this.lockVault();
      return false;
    }
  }

  public static async setAutoLockMinutes(minutes: number): Promise<void> {
    const meta = await readMeta();
    if (!meta) return;
    const safeMinutes = Math.max(1, Math.min(120, Math.round(minutes)));
    meta.autoLockMinutes = safeMinutes;
    meta.updatedAt = new Date().toISOString();
    await writeMeta(meta);
    activeAutoLockMinutes = safeMinutes;
    if (this.isUnlocked()) {
      activeExpiresAt = Date.now() + safeMinutes * 60_000;
    }
  }

  public static async listPortalSummaries(): Promise<CredentialPortalSummary[]> {
    const records = await readAllEncryptedRecords();
    return records
      .map((r) => ({
        id: r.id,
        portalName: r.portalName,
        portalUrl: r.portalUrl,
        origin: r.origin,
        organization: r.organization,
        jobTitle: r.jobTitle,
        accountType: r.accountType,
        verificationStatus: r.verificationStatus,
        lastUsedAt: r.lastUsedAt,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  public static async listDecryptedCredentials(): Promise<DecryptedCredentialEntry[]> {
    const { key } = getValidatedActiveKey();
    const records = await readAllEncryptedRecords();
    const out: DecryptedCredentialEntry[] = [];

    for (const r of records) {
      const jsonStr = await decryptDataWithKey(r.encryptedPayload, key);
      const secret = JSON.parse(jsonStr) as CredentialSecretPayload;
      out.push({
        id: r.id,
        portalName: r.portalName,
        portalUrl: r.portalUrl,
        origin: r.origin,
        organization: r.organization || secret.organization || '',
        jobTitle: r.jobTitle || secret.jobTitle || '',
        jobCircularId: r.jobCircularId || secret.jobCircularId,
        accountType: r.accountType || (secret.accountType as any) || 'General Portal Account',
        linkedApplicationIds: secret.linkedApplicationIds || [],
        verificationStatus: r.verificationStatus || secret.verificationStatus || 'unverified',
        lastUsedAt: r.lastUsedAt,
        username: secret.username || '',
        userId: secret.userId || '',
        applicantId: secret.applicantId || '',
        password: secret.password || '',
        notes: secret.notes || '',
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      });
    }

    return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  public static async saveCredential(input: {
    id?: string;
    portalName: string;
    portalUrl: string;
    organization?: string;
    jobTitle?: string;
    jobCircularId?: string;
    accountType?: CredentialAccountType;
    linkedApplicationIds?: string[];
    verificationStatus?: 'verified' | 'unverified' | 'pending';
    username: string;
    userId?: string;
    applicantId?: string;
    password: string;
    notes?: string;
  }): Promise<DecryptedCredentialEntry> {
    const { key, saltHex } = getValidatedActiveKey();
    const portalName = (input.portalName || '').trim();
    const portalUrl = (input.portalUrl || '').trim();
    const strictOrigin = normalizeStrictOrigin(portalUrl);

    if (!portalName) {
      throw new Error('Portal Name is required.');
    }
    if (!strictOrigin) {
      throw new Error('Portal Website must be a valid HTTPS URL (e.g. https://portal.example.com).');
    }
    if (!input.username.trim() && !(input.userId || '').trim() && !(input.applicantId || '').trim()) {
      throw new Error('Enter at least one Username, User ID, or Applicant ID.');
    }
    if (!input.password) {
      throw new Error('Password is required.');
    }

    const existingList = await readAllEncryptedRecords();
    const existing = input.id ? existingList.find((r) => r.id === input.id) : undefined;
    const nowIso = new Date().toISOString();
    const id = existing?.id || `cred_${Date.now().toString(36)}_${generateSaltHex(4)}`;
    const createdAt = existing?.createdAt || nowIso;

    const organization = (input.organization || existing?.organization || '').trim();
    const jobTitle = (input.jobTitle || existing?.jobTitle || '').trim();
    const jobCircularId = input.jobCircularId || existing?.jobCircularId;
    const accountType = input.accountType || existing?.accountType || 'General Portal Account';
    const linkedApplicationIds = input.linkedApplicationIds || [];
    const verificationStatus = input.verificationStatus || existing?.verificationStatus || 'unverified';
    const lastUsedAt = existing?.lastUsedAt;

    const secretPayload: CredentialSecretPayload = {
      username: input.username.trim(),
      userId: (input.userId || '').trim(),
      applicantId: (input.applicantId || '').trim(),
      password: input.password,
      notes: (input.notes || '').trim(),
      organization,
      jobTitle,
      jobCircularId,
      accountType,
      linkedApplicationIds,
      verificationStatus,
    };

    const meta = await readMeta();
    const encryptedPayload = await encryptDataWithKey(
      JSON.stringify(secretPayload),
      key,
      saltHex,
      meta?.iterations || CREDENTIAL_PBKDF2_ITERATIONS
    );

    const storedRecord: StoredEncryptedCredentialRecord = {
      id,
      portalName,
      portalUrl: portalUrl.includes('://') ? portalUrl : `https://${portalUrl}`,
      origin: strictOrigin,
      organization,
      jobTitle,
      jobCircularId,
      accountType,
      verificationStatus,
      lastUsedAt,
      createdAt,
      updatedAt: nowIso,
      encryptedPayload,
    };

    await writeEncryptedRecord(storedRecord);

    return {
      id,
      portalName,
      portalUrl: storedRecord.portalUrl,
      origin: strictOrigin,
      organization,
      jobTitle,
      jobCircularId,
      accountType,
      linkedApplicationIds,
      verificationStatus,
      lastUsedAt,
      ...secretPayload,
      createdAt,
      updatedAt: nowIso,
    };
  }

  public static async updateLastUsed(id: string): Promise<void> {
    const list = await readAllEncryptedRecords();
    const rec = list.find((r) => r.id === id);
    if (!rec) return;
    rec.lastUsedAt = new Date().toISOString();
    rec.updatedAt = new Date().toISOString();
    await writeEncryptedRecord(rec);
  }

  public static async linkApplication(credentialId: string, applicationId: string): Promise<void> {
    const { key, saltHex } = getValidatedActiveKey();
    const list = await readAllEncryptedRecords();
    const rec = list.find((r) => r.id === credentialId);
    if (!rec) return;

    const jsonStr = await decryptDataWithKey(rec.encryptedPayload, key);
    const secret = JSON.parse(jsonStr) as CredentialSecretPayload;
    const linked = new Set(secret.linkedApplicationIds || []);
    linked.add(applicationId);
    secret.linkedApplicationIds = Array.from(linked);

    const meta = await readMeta();
    rec.encryptedPayload = await encryptDataWithKey(
      JSON.stringify(secret),
      key,
      saltHex,
      meta?.iterations || CREDENTIAL_PBKDF2_ITERATIONS
    );
    rec.updatedAt = new Date().toISOString();
    await writeEncryptedRecord(rec);
  }

  public static async deleteCredential(id: string): Promise<void> {
    getValidatedActiveKey();
    await removeEncryptedRecord(id);
  }

  public static async findMatchingForPageUrl(
    pageUrl: string
  ): Promise<DecryptedCredentialEntry[]> {
    const all = await this.listDecryptedCredentials();
    return all.filter((entry) => isStrictOriginMatch(entry.origin, pageUrl).matched);
  }

  public static async exportEncryptedBackup(
    backupPassphrase: string,
    confirmed: boolean
  ): Promise<EncryptedCredentialBackupBundle> {
    if (!confirmed) {
      throw new Error('Explicit user confirmation is required before exporting credential backup.');
    }
    if (!backupPassphrase || backupPassphrase.length < 8) {
      throw new Error('Backup passphrase must be at least 8 characters long.');
    }
    const entries = await this.listDecryptedCredentials();
    const plaintext = JSON.stringify({
      exportedAt: new Date().toISOString(),
      entries,
    });
    const encryptedEnvelope = await encryptData(
      plaintext,
      backupPassphrase,
      CREDENTIAL_PBKDF2_ITERATIONS
    );
    return {
      bundleType: 'jobfill_credential_vault_backup',
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      encryptedEnvelope,
    };
  }

  public static async restoreEncryptedBackup(
    bundle: EncryptedCredentialBackupBundle,
    backupPassphrase: string
  ): Promise<number> {
    getValidatedActiveKey();
    if (!bundle || bundle.bundleType !== 'jobfill_credential_vault_backup' || !bundle.encryptedEnvelope) {
      throw new Error('Invalid credential backup format.');
    }
    const decryptedStr = await decryptData(bundle.encryptedEnvelope, backupPassphrase);
    const parsed = JSON.parse(decryptedStr);
    const entries = Array.isArray(parsed?.entries) ? parsed.entries : [];

    let restored = 0;
    for (const item of entries) {
      if (item && item.portalName && item.origin && item.password) {
        await this.saveCredential({
          portalName: item.portalName,
          portalUrl: item.portalUrl || item.origin,
          username: item.username || '',
          userId: item.userId || '',
          applicantId: item.applicantId || '',
          password: item.password,
          notes: item.notes || '',
        });
        restored += 1;
      }
    }
    return restored;
  }

  /**
   * Test/inspection helper ONLY for reading raw stored records to verify zero plaintext secrets exist.
   */
  public static async inspectRawEncryptedRecordsForAudit(): Promise<StoredEncryptedCredentialRecord[]> {
    return readAllEncryptedRecords();
  }

  public static async resetForIsolatedUnitTest(): Promise<void> {
    this.lockVault();
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      await chrome.storage.local.remove([CREDENTIAL_VAULT_META_KEY]);
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(CREDENTIAL_VAULT_META_KEY);
      localStorage.removeItem(CREDENTIAL_LOCAL_FALLBACK_KEY);
    }
    if (typeof indexedDB !== 'undefined') {
      try {
        await IndexedDBManager.executeTransaction<void>(
          STORES.CREDENTIALS,
          'readwrite',
          (store) =>
            new Promise((resolve, reject) => {
              const req = store.clear();
              req.onsuccess = () => resolve();
              req.onerror = () => reject(req.error);
            })
        );
      } catch {
        // ignore if IDB unavailable
      }
    }
  }

  public static async getTrustedAutofillOrigins(): Promise<Set<string>> {
    const key = 'jobfill_trusted_autofill_origins_v1';
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      const res = await new Promise<{ [key: string]: any }>((resolve) => {
        chrome.storage.local.get([key], (r) => resolve(r || {}));
      });
      const list = Array.isArray(res[key]) ? res[key] : [];
      return new Set<string>(list);
    }
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(key);
        const list = raw ? JSON.parse(raw) : [];
        return new Set<string>(Array.isArray(list) ? list : []);
      } catch {
        return new Set<string>();
      }
    }
    return new Set<string>();
  }

  public static async setTrustedAutofillOrigin(origin: string, trusted: boolean): Promise<void> {
    const norm = normalizeStrictOrigin(origin);
    if (!norm) return;
    const key = 'jobfill_trusted_autofill_origins_v1';
    const current = await this.getTrustedAutofillOrigins();
    if (trusted) {
      current.add(norm);
    } else {
      current.delete(norm);
    }
    const arr = Array.from(current);
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      await chrome.storage.local.set({ [key]: arr });
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(arr));
    }
  }

  public static async isOriginTrustedForAutofill(origin: string): Promise<boolean> {
    const norm = normalizeStrictOrigin(origin);
    if (!norm) return false;
    const set = await this.getTrustedAutofillOrigins();
    return set.has(norm);
  }

  public static async getCredentialSummaryById(id: string): Promise<CredentialPortalSummary | null> {
    const records = await readAllEncryptedRecords();
    const r = records.find((rec) => rec.id === id);
    if (!r) return null;
    return {
      id: r.id,
      portalName: r.portalName,
      portalUrl: r.portalUrl,
      origin: r.origin,
      organization: r.organization,
      jobTitle: r.jobTitle,
      accountType: r.accountType,
      verificationStatus: r.verificationStatus,
      lastUsedAt: r.lastUsedAt,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  public static async getDecryptedCredentialById(id: string): Promise<DecryptedCredentialEntry | null> {
    const { key } = getValidatedActiveKey();
    const records = await readAllEncryptedRecords();
    const r = records.find((rec) => rec.id === id);
    if (!r) return null;
    const jsonStr = await decryptDataWithKey(r.encryptedPayload, key);
    const secret = JSON.parse(jsonStr) as CredentialSecretPayload;
    return {
      id: r.id,
      portalName: r.portalName,
      portalUrl: r.portalUrl,
      origin: r.origin,
      organization: r.organization || secret.organization || '',
      jobTitle: r.jobTitle || secret.jobTitle || '',
      jobCircularId: r.jobCircularId || secret.jobCircularId,
      accountType: r.accountType || (secret.accountType as any) || 'General Portal Account',
      linkedApplicationIds: secret.linkedApplicationIds || [],
      verificationStatus: r.verificationStatus || secret.verificationStatus || 'unverified',
      lastUsedAt: r.lastUsedAt,
      username: secret.username || '',
      userId: secret.userId || '',
      applicantId: secret.applicantId || '',
      password: secret.password || '',
      notes: secret.notes || '',
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }
}

export const CredentialRepository = CredentialVaultRepository;
