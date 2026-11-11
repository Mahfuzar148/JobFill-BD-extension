// JobFill BD - Encrypted Local Document Repository (IndexedDB + AES-256-GCM)
// Stores Applicant Photograph, Signature, NID, Birth Certificate, Educational Certificates, and Other Documents.
// Guarantees local AES-256-GCM encryption at rest and strictly preserves original uploaded files.

import { IndexedDBManager, STORES } from './indexeddb';
import {
  encryptData,
  decryptData,
  EncryptedPayload,
  NativeKeyEncryptedPayload,
  generateNonExtractableAesKey,
  encryptWithCryptoKey,
  decryptWithCryptoKey,
  deriveMasterVaultCryptoKey,
  encryptDataWithKey,
  decryptDataWithKey,
} from '../security/encryption';
import { KeyManager } from '../security/key-manager';
import { VaultManager } from '../security/vault-manager';
import { DocumentCategory, DocumentMetadata } from '../types/profile';

export interface StoredDocumentItem {
  id: string;
  documentId: string;
  profileId: string;
  type: DocumentCategory;
  documentType: DocumentCategory;
  title: string;
  fileName: string;
  fileSize: number; // exact bytes
  fileSizeKb: number;
  mimeType: string;
  width: number;
  height: number;
  createdAt: string;
  isProcessedVariant?: boolean;
  parentDocumentId?: string;
  isEncrypted?: boolean;
  encryptedPayload?: EncryptedPayload;
  nativeEncryptedPayload?: NativeKeyEncryptedPayload;
  // Kept optional ONLY for decoupled in-memory return after decryption; stripped before persisting to IDB
  dataUrl?: string;
}

export interface DecryptedDocumentResult {
  metadata: DocumentMetadata;
  dataUrl: string;
}

const LOCAL_KEY_STORAGE = 'jobfill_doc_storage_key_v1';
const DEVICE_CRYPTO_KEY_ID = 'device_doc_aes_key_v2';
const FALLBACK_DOC_STORE_KEY = 'jobfill_fallback_encrypted_docs_v1';
let volatileLocalKey: string | null = null;
let cachedDeviceCryptoKey: CryptoKey | null = null;
const memoryDocStore = new Map<string, StoredDocumentItem>();

// Helper to normalize legacy document category names
export function normalizeDocumentCategory(category: DocumentCategory): DocumentCategory {
  if (category === 'nid_doc') return 'nid';
  if (
    category === 'ssc_cert' ||
    category === 'hsc_cert' ||
    category === 'grad_cert' ||
    category === 'masters_cert'
  ) {
    return 'educational_certificate';
  }
  return category;
}

async function resolveNonExtractableDeviceCryptoKey(): Promise<CryptoKey | null> {
  if (cachedDeviceCryptoKey) return cachedDeviceCryptoKey;
  if (
    typeof indexedDB === 'undefined' ||
    typeof crypto === 'undefined' ||
    !crypto.subtle ||
    typeof crypto.subtle.generateKey !== 'function'
  ) {
    return null;
  }

  try {
    const existing = await IndexedDBManager.executeTransaction<{ id: string; key?: CryptoKey } | null>(
      STORES.VAULT_STORE,
      'readonly',
      (store) =>
        new Promise((resolve, reject) => {
          const req = store.get(DEVICE_CRYPTO_KEY_ID);
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => reject(req.error);
        })
    );
    if (existing?.key) {
      cachedDeviceCryptoKey = existing.key;
      return existing.key;
    }

    const generated = await generateNonExtractableAesKey();
    await IndexedDBManager.executeTransaction(STORES.VAULT_STORE, 'readwrite', (store) =>
      new Promise<void>((resolve, reject) => {
        const req = store.put({ id: DEVICE_CRYPTO_KEY_ID, key: generated, updatedAt: Date.now() });
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      })
    );
    cachedDeviceCryptoKey = generated;
    return generated;
  } catch {
    return null;
  }
}

async function resolveLegacyDeviceLocalSecret(): Promise<string> {
  // Legacy fallback ONLY for existing encrypted blobs or Node test environments without IDB structured-clone CryptoKey
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    const existing = await new Promise<string | null>((resolve) => {
      chrome.storage.local.get([LOCAL_KEY_STORAGE], (res) => {
        resolve(typeof res[LOCAL_KEY_STORAGE] === 'string' ? res[LOCAL_KEY_STORAGE] : null);
      });
    });
    if (existing) return existing;
  }

  if (typeof localStorage !== 'undefined') {
    const localSecret = localStorage.getItem(LOCAL_KEY_STORAGE);
    if (localSecret) return localSecret;
  }

  if (!volatileLocalKey) {
    const randomBytes = crypto.getRandomValues(new Uint8Array(32));
    volatileLocalKey = Array.from(randomBytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    if (typeof localStorage !== 'undefined' && typeof indexedDB === 'undefined') {
      try {
        localStorage.setItem(LOCAL_KEY_STORAGE, volatileLocalKey);
      } catch {
        // Ignore quota limits
      }
    }
  }
  return volatileLocalKey;
}

async function resolveUnlockedVaultSession(): Promise<{ key: CryptoKey; saltHex: string }> {
  const settings = await VaultManager.getSettings();
  const key = KeyManager.getSessionKey();
  const saltHex = KeyManager.getSessionSaltHex() || settings.salt || '';
  if (!key || !saltHex) {
    throw new Error('VAULT_LOCKED: Unlock vault password before accessing encrypted documents.');
  }
  return { key, saltHex };
}

function saveToFallbackStore(record: StoredDocumentItem): void {
  memoryDocStore.set(record.id, record);
  if (typeof localStorage !== 'undefined') {
    try {
      const existingRaw = localStorage.getItem(FALLBACK_DOC_STORE_KEY);
      const mapObj: Record<string, StoredDocumentItem> = existingRaw ? JSON.parse(existingRaw) : {};
      mapObj[record.id] = record;
      localStorage.setItem(FALLBACK_DOC_STORE_KEY, JSON.stringify(mapObj));
    } catch {
      // Fallback safely in memory only if localStorage quota is small
    }
  }
}

function getAllFromFallbackStore(): StoredDocumentItem[] {
  const results = new Map<string, StoredDocumentItem>(memoryDocStore);
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(FALLBACK_DOC_STORE_KEY);
      if (raw) {
        const parsed: Record<string, StoredDocumentItem> = JSON.parse(raw);
        for (const [k, v] of Object.entries(parsed)) {
          if (!results.has(k)) results.set(k, v);
        }
      }
    } catch {
      // Safe fallback
    }
  }
  return Array.from(results.values());
}

function removeFromFallbackStore(id: string): void {
  memoryDocStore.delete(id);
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(FALLBACK_DOC_STORE_KEY);
      if (raw) {
        const parsed: Record<string, StoredDocumentItem> = JSON.parse(raw);
        delete parsed[id];
        localStorage.setItem(FALLBACK_DOC_STORE_KEY, JSON.stringify(parsed));
      }
    } catch {
      // Ignore
    }
  }
}

export class DocumentRepository {
  /**
   * Saves a document securely with AES-256-GCM encryption at rest.
   * Never stores plaintext dataUrl to IndexedDB when encryption succeeds.
   */
  public static async saveDocument(
    doc: Partial<StoredDocumentItem> & {
      profileId: string;
      fileName: string;
      mimeType: string;
      dataUrl: string;
    }
  ): Promise<DocumentMetadata> {
    const docId = doc.documentId || doc.id || `doc_${doc.profileId}_${doc.documentType || doc.type || 'other'}_${Date.now()}`;
    const docType = doc.documentType || doc.type || 'other';
    const fileSize = doc.fileSize ?? Math.max(1, Math.round((doc.fileSizeKb ?? 0) * 1024));
    const fileSizeKb = doc.fileSizeKb ?? Number((fileSize / 1024).toFixed(2));
    const width = doc.width ?? 0;
    const height = doc.height ?? 0;
    const createdAt = doc.createdAt || new Date().toISOString();

    const settings = await VaultManager.getSettings();
    let encryptedPayload: EncryptedPayload | undefined;
    let nativeEncryptedPayload: NativeKeyEncryptedPayload | undefined;

    if (settings.isPasswordProtected) {
      const { key, saltHex } = await resolveUnlockedVaultSession();
      encryptedPayload = await encryptDataWithKey(doc.dataUrl, key, saltHex);
    } else {
      const deviceKey = await resolveNonExtractableDeviceCryptoKey();
      if (deviceKey) {
        nativeEncryptedPayload = await encryptWithCryptoKey(doc.dataUrl, deviceKey);
      } else if (typeof indexedDB !== 'undefined' && typeof crypto?.subtle?.generateKey === 'function') {
        throw new Error('VAULT_CRYPTO_UNAVAILABLE: Encrypted IndexedDB key store unavailable for document encryption.');
      } else {
        const fallbackSecret = await resolveLegacyDeviceLocalSecret();
        encryptedPayload = await encryptData(doc.dataUrl, fallbackSecret);
      }
    }

    const recordToPersist: StoredDocumentItem = {
      id: docId,
      documentId: docId,
      profileId: doc.profileId,
      type: docType,
      documentType: docType,
      title: doc.title || doc.fileName,
      fileName: doc.fileName,
      fileSize,
      fileSizeKb,
      mimeType: doc.mimeType,
      width,
      height,
      createdAt,
      isProcessedVariant: Boolean(doc.isProcessedVariant),
      parentDocumentId: doc.parentDocumentId,
      isEncrypted: true,
      encryptedPayload,
      nativeEncryptedPayload,
      // Explicitly omit plaintext dataUrl at rest
    };

    try {
      await IndexedDBManager.executeTransaction(STORES.DOCUMENTS, 'readwrite', (store) =>
        new Promise<void>((resolve, reject) => {
          const req = store.put(recordToPersist);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        })
      );
    } catch (idbErr) {
      if (typeof indexedDB !== 'undefined') {
        throw idbErr;
      }
      saveToFallbackStore(recordToPersist);
    }

    // Also update fallback mirror only when IndexedDB is unavailable in unit-test JSDOM
    if (typeof indexedDB === 'undefined') {
      saveToFallbackStore(recordToPersist);
    }

    return {
      documentId: docId,
      documentType: docType,
      profileId: doc.profileId,
      title: recordToPersist.title,
      fileName: recordToPersist.fileName,
      mimeType: recordToPersist.mimeType,
      fileSize,
      width,
      height,
      createdAt,
      isProcessedVariant: recordToPersist.isProcessedVariant,
      parentDocumentId: recordToPersist.parentDocumentId,
    };
  }

  /**
   * Saves a separate processed copy (resized/reformatted) without modifying or overwriting the original document.
   */
  public static async saveProcessedVariant(
    parentOriginalId: string,
    doc: {
      profileId: string;
      documentType: DocumentCategory;
      title?: string;
      fileName: string;
      mimeType: string;
      fileSize: number;
      width: number;
      height: number;
      dataUrl: string;
    }
  ): Promise<DocumentMetadata> {
    const variantId = `${parentOriginalId}_processed`;
    return this.saveDocument({
      ...doc,
      id: variantId,
      documentId: variantId,
      isProcessedVariant: true,
      parentDocumentId: parentOriginalId,
    });
  }

  /**
   * Retrieves raw stored record (encrypted at rest) by ID.
   */
  public static async getRawRecordById(id: string): Promise<StoredDocumentItem | null> {
    try {
      const found = await IndexedDBManager.executeTransaction<StoredDocumentItem | null>(
        STORES.DOCUMENTS,
        'readonly',
        (store) =>
          new Promise<StoredDocumentItem | null>((resolve, reject) => {
            const req = store.get(id);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
          })
      );
      if (found) return found;
    } catch {
      // Fallback
    }

    return getAllFromFallbackStore().find((d) => d.id === id || d.documentId === id) || null;
  }

  /**
   * Decrypts and returns a document by ID for authorized preview or approved transfer.
   */
  public static async getDocumentById(id: string): Promise<(StoredDocumentItem & { dataUrl: string }) | null> {
    const record = await this.getRawRecordById(id);
    if (!record) return null;

    let decryptedDataUrl = record.dataUrl || '';
    if (record.isEncrypted) {
      const settings = await VaultManager.getSettings();
      if (settings.isPasswordProtected) {
        const { key } = await resolveUnlockedVaultSession();
        if (record.encryptedPayload) {
          decryptedDataUrl = await decryptDataWithKey(record.encryptedPayload, key);
        } else if (record.nativeEncryptedPayload) {
          const deviceKey = await resolveNonExtractableDeviceCryptoKey();
          if (deviceKey) {
            decryptedDataUrl = await decryptWithCryptoKey(record.nativeEncryptedPayload, deviceKey);
          }
        }
      } else if (record.nativeEncryptedPayload) {
        const deviceKey = await resolveNonExtractableDeviceCryptoKey();
        if (!deviceKey) {
          throw new Error('DEVICE_CRYPTO_KEY_UNAVAILABLE');
        }
        decryptedDataUrl = await decryptWithCryptoKey(record.nativeEncryptedPayload, deviceKey);
      } else if (record.encryptedPayload) {
        const fallbackSecret = await resolveLegacyDeviceLocalSecret();
        decryptedDataUrl = await decryptData(record.encryptedPayload, fallbackSecret);
      }
    }

    return {
      ...record,
      dataUrl: decryptedDataUrl,
    };
  }

  /**
   * Lists metadata only (without decrypting payloads) for all documents of a profile.
   */
  public static async getDocumentMetadataByProfile(profileId: string): Promise<DocumentMetadata[]> {
    let records: StoredDocumentItem[] = [];
    try {
      records = await IndexedDBManager.executeTransaction<StoredDocumentItem[]>(
        STORES.DOCUMENTS,
        'readonly',
        (store) =>
          new Promise<StoredDocumentItem[]>((resolve, reject) => {
            const idx = store.index('profileId');
            const req = idx.getAll(profileId);
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
          })
      );
    } catch {
      records = getAllFromFallbackStore().filter((d) => d.profileId === profileId);
    }

    if (records.length === 0) {
      records = getAllFromFallbackStore().filter((d) => d.profileId === profileId);
    }

    return records.map((r) => ({
      documentId: r.documentId || r.id,
      documentType: r.documentType || r.type,
      profileId: r.profileId,
      title: r.title,
      fileName: r.fileName,
      mimeType: r.mimeType,
      fileSize: r.fileSize ?? Math.round((r.fileSizeKb || 0) * 1024),
      width: r.width || 0,
      height: r.height || 0,
      createdAt: r.createdAt,
      isProcessedVariant: r.isProcessedVariant,
      parentDocumentId: r.parentDocumentId,
    }));
  }

  /**
   * Backward compatible getter resolving decrypted records for a profile.
   */
  public static async getDocumentsByProfile(profileId: string): Promise<(StoredDocumentItem & { dataUrl: string })[]> {
    const metas = await this.getDocumentMetadataByProfile(profileId);
    const out: (StoredDocumentItem & { dataUrl: string })[] = [];
    for (const meta of metas) {
      const full = await this.getDocumentById(meta.documentId);
      if (full) out.push(full);
    }
    return out;
  }

  /**
   * Retrieves the active original document (and optional processed variant) for a category like 'photo' or 'signature'.
   */
  public static async getByCategory(
    profileId: string,
    category: DocumentCategory,
    preferProcessed: boolean = false
  ): Promise<DecryptedDocumentResult | null> {
    const normalizedTarget = normalizeDocumentCategory(category);
    const allMetas = await this.getDocumentMetadataByProfile(profileId);
    const matching = allMetas.filter((m) => normalizeDocumentCategory(m.documentType) === normalizedTarget);
    if (matching.length === 0) return null;

    const originals = matching.filter((m) => !m.isProcessedVariant);
    const processed = matching.filter((m) => m.isProcessedVariant);

    const chosenMeta =
      preferProcessed && processed.length > 0
        ? processed[processed.length - 1]
        : originals.length > 0
          ? originals[originals.length - 1]
          : matching[matching.length - 1];

    const decrypted = await this.getDocumentById(chosenMeta.documentId);
    if (!decrypted || !decrypted.dataUrl) return null;

    return {
      metadata: chosenMeta,
      dataUrl: decrypted.dataUrl,
    };
  }

  public static async deleteDocument(id: string): Promise<void> {
    try {
      await IndexedDBManager.executeTransaction(STORES.DOCUMENTS, 'readwrite', (store) =>
        new Promise<void>((resolve, reject) => {
          const req = store.delete(id);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        })
      );
    } catch {
      // Safe fallback
    }
    removeFromFallbackStore(id);
  }

  private static async getAllRawRecords(): Promise<StoredDocumentItem[]> {
    const byId = new Map<string, StoredDocumentItem>();
    try {
      const idbRecords = await IndexedDBManager.executeTransaction<StoredDocumentItem[]>(
        STORES.DOCUMENTS,
        'readonly',
        (store) =>
          new Promise<StoredDocumentItem[]>((resolve, reject) => {
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
          })
      );
      for (const r of idbRecords) {
        byId.set(r.id, r);
      }
    } catch {
      // Safe fallback
    }
    for (const r of getAllFromFallbackStore()) {
      if (!byId.has(r.id)) byId.set(r.id, r);
    }
    return Array.from(byId.values());
  }

  private static async putRawRecord(record: StoredDocumentItem): Promise<void> {
    try {
      await IndexedDBManager.executeTransaction(STORES.DOCUMENTS, 'readwrite', (store) =>
        new Promise<void>((resolve, reject) => {
          const req = store.put(record);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        })
      );
    } catch {
      saveToFallbackStore(record);
    }
    if (typeof indexedDB === 'undefined') {
      saveToFallbackStore(record);
    }
  }

  /**
   * Re-encrypts all persisted documents when enabling, changing, or disabling the Master Vault password.
   */
  public static async reencryptAllDocuments(
    oldMasterPassword: string | null,
    newMasterPassword: string | null,
    targetSaltHex?: string
  ): Promise<number> {
    const legacySecret = await resolveLegacyDeviceLocalSecret();
    const deviceKey = await resolveNonExtractableDeviceCryptoKey();
    const activeSessionKey = KeyManager.getSessionKey();
    const sourceCandidates = [oldMasterPassword, legacySecret].filter(
      (s): s is string => typeof s === 'string' && s.length > 0
    );

    const newSaltHex = newMasterPassword ? targetSaltHex || '' : '';
    const newDerivedKey =
      newMasterPassword && newSaltHex
        ? await deriveMasterVaultCryptoKey(newMasterPassword, newSaltHex)
        : null;

    const records = await this.getAllRawRecords();
    let migrated = 0;

    for (const rec of records) {
      let plaintext = rec.dataUrl || '';
      if (rec.isEncrypted) {
        if (rec.nativeEncryptedPayload && deviceKey) {
          try {
            plaintext = await decryptWithCryptoKey(rec.nativeEncryptedPayload, deviceKey);
          } catch {
            // Try encryptedPayload fallback below if available
          }
        }
        if (!plaintext && rec.encryptedPayload && activeSessionKey) {
          try {
            plaintext = await decryptDataWithKey(rec.encryptedPayload, activeSessionKey);
          } catch {
            // Fall through to password candidates
          }
        }
        if (!plaintext && rec.encryptedPayload) {
          for (const candidate of sourceCandidates) {
            try {
              const decrypted = await decryptData(rec.encryptedPayload, candidate);
              if (decrypted) {
                plaintext = decrypted;
                break;
              }
            } catch {
              // Try next candidate secret
            }
          }
        }
      }

      if (!plaintext) continue;
      let updated: StoredDocumentItem;
      if (newMasterPassword) {
        const newPayload =
          newDerivedKey && newSaltHex
            ? await encryptDataWithKey(plaintext, newDerivedKey, newSaltHex)
            : await encryptData(plaintext, newMasterPassword);
        updated = {
          ...rec,
          isEncrypted: true,
          encryptedPayload: newPayload,
        };
        delete updated.nativeEncryptedPayload;
      } else if (deviceKey) {
        const newNativePayload = await encryptWithCryptoKey(plaintext, deviceKey);
        updated = {
          ...rec,
          isEncrypted: true,
          nativeEncryptedPayload: newNativePayload,
        };
        delete updated.encryptedPayload;
      } else {
        const newPayload = await encryptData(plaintext, legacySecret);
        updated = {
          ...rec,
          isEncrypted: true,
          encryptedPayload: newPayload,
        };
        delete updated.nativeEncryptedPayload;
      }
      delete updated.dataUrl;
      await this.putRawRecord(updated);
      migrated++;
    }

    return migrated;
  }

  public static async clearAllDocuments(): Promise<void> {
    try {
      await IndexedDBManager.executeTransaction(STORES.DOCUMENTS, 'readwrite', (store) =>
        new Promise<void>((resolve, reject) => {
          const req = store.clear();
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        })
      );
    } catch {
      // Safe fallback
    }
    this.clearVolatileTestStore();
  }

  /**
   * Safely migrates original saved documents (e.g. Photo, Signature) from legacy/prior
   * active profiles into `targetProfileId` for categories that have no document yet.
   * Never overwrites existing files and respects Vault Lock.
   */
  public static async migrateMissingDocumentsToProfile(
    targetProfileId: string,
    preferredSourceProfileIds: string[] = []
  ): Promise<number> {
    if (!targetProfileId) return 0;

    const settings = await VaultManager.getSettings();
    if (settings.isPasswordProtected && !KeyManager.isKeyActive()) {
      return 0;
    }

    const records = await this.getAllRawRecords();
    const targetTypes = new Set<string>();
    for (const r of records) {
      if (r.profileId === targetProfileId) {
        const cat = normalizeDocumentCategory(r.documentType || r.type);
        targetTypes.add(cat);
      }
    }

    const candidates = records.filter(
      (r) => r.profileId !== targetProfileId && !r.isProcessedVariant
    );
    if (candidates.length === 0) return 0;

    // Prioritize preferred source profile IDs cleanly
    const prefRank = new Map<string, number>();
    preferredSourceProfileIds.forEach((id, i) => prefRank.set(id, i));
    candidates.sort((a, b) => {
      const ra = prefRank.has(a.profileId) ? prefRank.get(a.profileId)! : 9999;
      const rb = prefRank.has(b.profileId) ? prefRank.get(b.profileId)! : 9999;
      return ra - rb;
    });

    let migrated = 0;
    for (const src of candidates) {
      const cat = normalizeDocumentCategory(src.documentType || src.type);
      if (targetTypes.has(cat)) continue;

      const prefix = cat === 'signature' ? 'sig' : cat;
      const clonedId = `${prefix}_${targetProfileId}_original`;
      const cloned: StoredDocumentItem = {
        ...src,
        id: clonedId,
        documentId: clonedId,
        profileId: targetProfileId,
      };

      await this.putRawRecord(cloned);
      targetTypes.add(cat);
      migrated++;
    }

    return migrated;
  }

  public static clearVolatileTestStore(): void {
    cachedDeviceCryptoKey = null;
    volatileLocalKey = null;
    memoryDocStore.clear();
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(FALLBACK_DOC_STORE_KEY);
    }
  }
}
