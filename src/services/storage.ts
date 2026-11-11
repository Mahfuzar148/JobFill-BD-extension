import { UserProfile, SecuritySettings, AutofillHistoryRecord, AppGeneralSettings } from '../types/profile';
import { createEmptyProfile, sampleDemoProfile } from '../types/defaults';
import {
  EncryptedPayload,
  encryptData,
  decryptData,
  hashPassword,
  generateNonExtractableAesKey,
  encryptWithCryptoKey,
  decryptWithCryptoKey,
  generateSaltHex,
  deriveMasterVaultCryptoKey,
  encryptDataWithKey,
  decryptDataWithKey,
} from '../utils/crypto';
import { KeyManager } from '../security/key-manager';
import { DocumentRepository } from '../database/document-repository';
import { ProfileRepository } from '../database/profile-repository';
import { IndexedDBManager, STORES } from '../database/indexeddb';
import { JobRepository } from '../jobs/database/job-repository';
import { BookmarkRepository } from '../jobs/database/bookmark-repository';
import { ApplicationRepository } from '../jobs/database/application-repository';
import { JobNotificationRepository } from '../jobs/database/notification-repository';

const STORAGE_KEY_PROFILES = 'jobfill_profiles';
const STORAGE_KEY_ACTIVE_ID = 'jobfill_active_profile_id';
const STORAGE_KEY_SECURITY = 'jobfill_security_settings';
const STORAGE_KEY_ENCRYPTED_VAULT = 'jobfill_encrypted_vault';
const STORAGE_KEY_HISTORY = 'jobfill_autofill_history';
const STORAGE_KEY_GENERAL_SETTINGS = 'jobfill_general_settings';

// Cross-environment storage helper (Chrome storage local with fallback to window.localStorage)
const STORAGE_TIMEOUT_MS = 2500;

function readLocalFallback<T>(keys: string[]): Record<string, T> {
  const result: Record<string, T> = {};
  if (typeof localStorage === 'undefined') return result;
  for (const k of keys) {
    const val = localStorage.getItem(k);
    if (val !== null) {
      try {
        result[k] = JSON.parse(val);
      } catch {
        // ignore
      }
    }
  }
  return result;
}

const storageAdapter = {
  async get<T>(keys: string[]): Promise<Record<string, T>> {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return new Promise((resolve) => {
        let settled = false;
        const timer = setTimeout(() => {
          if (!settled) {
            settled = true;
            resolve(readLocalFallback<T>(keys));
          }
        }, STORAGE_TIMEOUT_MS);

        try {
          chrome.storage.local.get(keys, (res) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            if (chrome.runtime?.lastError || !res) {
              resolve(readLocalFallback<T>(keys));
              return;
            }
            resolve(res as Record<string, T>);
          });
        } catch {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve(readLocalFallback<T>(keys));
          }
        }
      });
    }
    return readLocalFallback<T>(keys);
  },

  async set(items: Record<string, any>): Promise<void> {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return new Promise((resolve) => {
        let settled = false;
        const timer = setTimeout(() => {
          if (!settled) {
            settled = true;
            resolve();
          }
        }, STORAGE_TIMEOUT_MS);
        try {
          chrome.storage.local.set(items, () => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve();
          });
        } catch {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve();
          }
        }
      });
    }
    for (const [k, v] of Object.entries(items)) {
      localStorage.setItem(k, JSON.stringify(v));
    }
  },

  async remove(keys: string[]): Promise<void> {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return new Promise((resolve) => {
        try {
          chrome.storage.local.remove(keys, () => resolve());
        } catch {
          resolve();
        }
      });
    }
    for (const k of keys) localStorage.removeItem(k);
  },

  async clear(): Promise<void> {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return new Promise((resolve) => {
        try {
          chrome.storage.local.clear(() => resolve());
        } catch {
          resolve();
        }
      });
    }
    localStorage.clear();
  },
};

// In-memory unlocked session tracking (NO plaintext password stored in memory or chrome.storage)
let lastActivityTimestamp = Date.now();
let cachedAutoLockMinutes = 15;

export function setSessionPassword(_password: string | null, _autoLockMinutes = 15) {
  // Deprecated legacy signature preserved only for lock clearing compatibility
  if (!_password) {
    KeyManager.clearKey();
  }
}

export function isSessionUnlocked(): boolean {
  return KeyManager.isKeyActive();
}

export function recordActivity(autoLockMinutes?: number) {
  lastActivityTimestamp = Date.now();
  if (typeof autoLockMinutes === 'number' && autoLockMinutes >= 1) {
    cachedAutoLockMinutes = autoLockMinutes;
  }
  if (KeyManager.isKeyActive()) {
    KeyManager.refreshSessionExpiry(cachedAutoLockMinutes);
  }
}

export async function checkAutoLock(): Promise<boolean> {
  const security = await getSecuritySettings();
  cachedAutoLockMinutes = Math.max(1, security.autoLockMinutes || 15);
  if (!security.isPasswordProtected) return false;

  if (!KeyManager.isKeyActive()) {
    KeyManager.clearKey();
    return true;
  }

  const sessionExpiresAt = KeyManager.getSessionExpiresAt();
  const elapsedMinutes = (Date.now() - lastActivityTimestamp) / (1000 * 60);
  if (
    elapsedMinutes >= cachedAutoLockMinutes ||
    (sessionExpiresAt !== null && Date.now() >= sessionExpiresAt)
  ) {
    lockVault();
    return true; // Was locked
  }
  return false;
}

function validateDecryptedProfilesSchema(parsed: unknown): UserProfile[] {
  if (!Array.isArray(parsed)) {
    throw new Error('Corrupted vault profile list schema.');
  }
  const valid = parsed.filter(
    (p): p is UserProfile =>
      Boolean(
        p &&
          typeof p === 'object' &&
          typeof (p as any).id === 'string' &&
          (p as any).personal &&
          typeof (p as any).personal === 'object' &&
          (p as any).address &&
          typeof (p as any).address === 'object'
      )
  );
  if (valid.length !== parsed.length) {
    throw new Error('Invalid profile entry detected inside decrypted vault.');
  }
  return valid;
}

// Security Settings
export async function getSecuritySettings(): Promise<SecuritySettings> {
  const res = await storageAdapter.get<SecuritySettings>([STORAGE_KEY_SECURITY]);
  return (
    res[STORAGE_KEY_SECURITY] || {
      isPasswordProtected: false,
      autoLockMinutes: 15,
      activeProfileId: '',
    }
  );
}

export async function saveSecuritySettings(settings: SecuritySettings): Promise<void> {
  cachedAutoLockMinutes = Math.max(1, settings.autoLockMinutes || 15);
  await storageAdapter.set({ [STORAGE_KEY_SECURITY]: settings });
  if (settings.isPasswordProtected && KeyManager.isKeyActive()) {
    KeyManager.refreshSessionExpiry(cachedAutoLockMinutes);
  }
}

// Profiles CRUD
export async function getAllProfiles(): Promise<UserProfile[]> {
  const security = await getSecuritySettings();

  if (security.isPasswordProtected) {
    const activeKey = KeyManager.getSessionKey();
    if (!activeKey) {
      throw new Error('VAULT_LOCKED');
    }

    const idbVault = await ProfileRepository.getEncryptedVaultRecord();
    if (idbVault?.mode === 'master_password' && idbVault.encryptedPayload) {
      const jsonStr = await decryptDataWithKey(idbVault.encryptedPayload, activeKey);
      return validateDecryptedProfilesSchema(JSON.parse(jsonStr));
    }

    const res = await storageAdapter.get<EncryptedPayload>([STORAGE_KEY_ENCRYPTED_VAULT]);
    const vault = res[STORAGE_KEY_ENCRYPTED_VAULT];
    if (!vault) {
      throw new Error('VAULT_DATA_MISSING: Encrypted profile vault payload is missing. Restore an encrypted backup or reset local vault in Security.');
    }

    const jsonStr = await decryptDataWithKey(vault, activeKey);
    const decryptedProfiles = validateDecryptedProfilesSchema(JSON.parse(jsonStr));
    await ProfileRepository.saveEncryptedVaultRecord({
      mode: 'master_password',
      encryptedPayload: vault,
      updatedAt: Date.now(),
    });
    return decryptedProfiles;
  }

  let profiles: UserProfile[] | undefined;
  let needsIdbMigration = false;
  const hasNativeCryptoIdb =
    typeof indexedDB !== 'undefined' && typeof crypto?.subtle?.generateKey === 'function';

  const idbVault = await ProfileRepository.getEncryptedVaultRecord();
  if (idbVault?.mode === 'device_key' && idbVault.nativeEncryptedPayload) {
    try {
      const key = await ProfileRepository.getOrCreateDeviceProfileCryptoKey(generateNonExtractableAesKey);
      if (!key) {
        throw new Error('VAULT_CRYPTO_UNAVAILABLE');
      }
      const jsonStr = await decryptWithCryptoKey(idbVault.nativeEncryptedPayload, key);
      profiles = validateDecryptedProfilesSchema(JSON.parse(jsonStr));
    } catch {
      throw new Error('VAULT_DATA_CORRUPTED: Local encrypted vault could not be decrypted. Restore an encrypted backup in Security.');
    }
  }

  if (!idbVault && (!profiles || profiles.length === 0)) {
    const idbProfiles = await ProfileRepository.getProfilesFromIndexedDbOnly();
    if (idbProfiles.length > 0) {
      profiles = idbProfiles;
      needsIdbMigration = typeof indexedDB !== 'undefined';
    }
  }

  const res = await storageAdapter.get<any>([STORAGE_KEY_PROFILES]);
  if (!idbVault && (!profiles || profiles.length === 0) && Array.isArray(res[STORAGE_KEY_PROFILES]) && res[STORAGE_KEY_PROFILES].length > 0) {
    profiles = res[STORAGE_KEY_PROFILES];
    needsIdbMigration = typeof indexedDB !== 'undefined';
  }

  if (!profiles || profiles.length === 0) {
    const defaultProfiles =
      (typeof __JOBFILL_STORE_CLEAN__ !== 'undefined' && __JOBFILL_STORE_CLEAN__) || hasNativeCryptoIdb
        ? [createEmptyProfile('My Job Profile')]
        : [sampleDemoProfile];
    profiles = defaultProfiles;
    await saveAllProfiles(profiles);
    await setActiveProfileId(defaultProfiles[0].id);
  } else if (needsIdbMigration) {
    await saveAllProfiles(profiles);
  }
  return profiles;
}

export async function saveAllProfiles(profiles: UserProfile[]): Promise<void> {
  const security = await getSecuritySettings();
  const hasNativeCryptoIdb =
    typeof indexedDB !== 'undefined' && typeof crypto?.subtle?.generateKey === 'function';

  if (security.isPasswordProtected) {
    const activeKey = KeyManager.getSessionKey();
    const saltHex = KeyManager.getSessionSaltHex() || security.salt;
    if (!activeKey || !saltHex) throw new Error('VAULT_LOCKED');

    const jsonStr = JSON.stringify(profiles);
    const encrypted = await encryptDataWithKey(jsonStr, activeKey, saltHex);
    const savedIdb = await ProfileRepository.saveEncryptedVaultRecord({
      mode: 'master_password',
      encryptedPayload: encrypted,
      updatedAt: Date.now(),
    });
    await ProfileRepository.syncAllProfilesToIndexedDb(profiles, {
      includePlaintextProfileStore: false,
    });
    if (!savedIdb) {
      await storageAdapter.set({ [STORAGE_KEY_ENCRYPTED_VAULT]: encrypted });
    } else {
      await storageAdapter.remove([STORAGE_KEY_ENCRYPTED_VAULT]);
    }
    await storageAdapter.remove([STORAGE_KEY_PROFILES]);
  } else {
    // Encrypt profile vault locally in IndexedDB with non-extractable AES-GCM CryptoKey
    let storedInEncryptedDeviceVault = false;
    try {
      if (hasNativeCryptoIdb) {
        const key = await ProfileRepository.getOrCreateDeviceProfileCryptoKey(generateNonExtractableAesKey);
        if (key) {
          const nativePayload = await encryptWithCryptoKey(JSON.stringify(profiles), key);
          storedInEncryptedDeviceVault = await ProfileRepository.saveEncryptedVaultRecord({
            mode: 'device_key',
            nativeEncryptedPayload: nativePayload,
            updatedAt: Date.now(),
          });
        }
      }
    } catch {
      storedInEncryptedDeviceVault = false;
    }

    if (hasNativeCryptoIdb && !storedInEncryptedDeviceVault) {
      throw new Error('VAULT_STORAGE_ERROR: Unable to persist profiles in encrypted IndexedDB vault; refusing insecure plaintext fallback.');
    }

    await ProfileRepository.syncAllProfilesToIndexedDb(profiles, {
      includePlaintextProfileStore: !storedInEncryptedDeviceVault,
    });

    if (storedInEncryptedDeviceVault) {
      await storageAdapter.remove([STORAGE_KEY_PROFILES]);
    } else if (!hasNativeCryptoIdb) {
      await storageAdapter.set({ [STORAGE_KEY_PROFILES]: profiles });
    }
  }
}

export async function getActiveProfile(): Promise<UserProfile> {
  const profiles = await getAllProfiles();
  const res = await storageAdapter.get<string>([STORAGE_KEY_ACTIVE_ID]);
  const activeId = res[STORAGE_KEY_ACTIVE_ID];

  const found = profiles.find((p) => p.id === activeId);
  if (found) return found;

  if (profiles.length > 0) {
    await setActiveProfileId(profiles[0].id);
    return profiles[0];
  }

  const newDefault = createEmptyProfile('My Job Profile');
  await saveAllProfiles([newDefault]);
  await setActiveProfileId(newDefault.id);
  return newDefault;
}

export async function setActiveProfileId(id: string): Promise<void> {
  await storageAdapter.set({ [STORAGE_KEY_ACTIVE_ID]: id });
}

export async function saveActiveProfile(profile: UserProfile): Promise<void> {
  profile.updatedAt = new Date().toISOString();
  const profiles = await getAllProfiles();
  const idx = profiles.findIndex((p) => p.id === profile.id);
  if (idx >= 0) {
    profiles[idx] = profile;
  } else {
    profiles.push(profile);
  }
  await saveAllProfiles(profiles);
  await setActiveProfileId(profile.id);
  recordActivity();
}

export async function deleteProfile(id: string): Promise<void> {
  let profiles = await getAllProfiles();
  profiles = profiles.filter((p) => p.id !== id);
  if (profiles.length === 0) {
    profiles = [createEmptyProfile('Default Profile')];
  }
  await saveAllProfiles(profiles);
  await setActiveProfileId(profiles[0].id);
}

// Password Setup / Change / Removal
export async function enableVaultEncryption(password: string): Promise<void> {
  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }
  const profiles = await getAllProfiles();
  const saltHex = generateSaltHex();
  const { hashHex } = await hashPassword(password, saltHex);
  const newKey = await deriveMasterVaultCryptoKey(password, saltHex);

  await DocumentRepository.reencryptAllDocuments(null, password, saltHex);

  const security = await getSecuritySettings();
  security.isPasswordProtected = true;
  security.passwordHash = hashHex;
  security.salt = saltHex;
  security.lastUnlockedAt = Date.now();
  await saveSecuritySettings(security);
  KeyManager.setSessionKey(newKey, saltHex, security.autoLockMinutes || 15);
  lastActivityTimestamp = Date.now();

  await saveAllProfiles(profiles);

  if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
    try {
      chrome.runtime.sendMessage({ action: 'SYNC_VAULT_UNLOCK', payload: { password } }, () => void chrome.runtime?.lastError);
    } catch {
      // Ignore outside SW runtime
    }
  }
}

export async function changeVaultPassword(oldPassword: string, newPassword: string): Promise<void> {
  if (!newPassword || newPassword.length < 6) {
    throw new Error('New password must be at least 6 characters.');
  }
  const security = await getSecuritySettings();
  if (!security.isPasswordProtected || !security.passwordHash || !security.salt) {
    await enableVaultEncryption(newPassword);
    return;
  }

  const { hashHex } = await hashPassword(oldPassword, security.salt);
  if (hashHex !== security.passwordHash) {
    throw new Error('Incorrect current password');
  }

  // Decrypt using verified old password cleanly before switching keys
  const oldKey = await deriveMasterVaultCryptoKey(oldPassword, security.salt);
  KeyManager.setSessionKey(oldKey, security.salt, security.autoLockMinutes || 15);
  const profiles = await getAllProfiles();

  const newSaltHex = generateSaltHex();
  const { hashHex: newHashHex } = await hashPassword(newPassword, newSaltHex);
  const newKey = await deriveMasterVaultCryptoKey(newPassword, newSaltHex);

  await DocumentRepository.reencryptAllDocuments(oldPassword, newPassword, newSaltHex);

  security.isPasswordProtected = true;
  security.passwordHash = newHashHex;
  security.salt = newSaltHex;
  security.lastUnlockedAt = Date.now();
  await saveSecuritySettings(security);

  KeyManager.setSessionKey(newKey, newSaltHex, security.autoLockMinutes || 15);
  lastActivityTimestamp = Date.now();
  await saveAllProfiles(profiles);

  if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
    try {
      chrome.runtime.sendMessage({ action: 'SYNC_VAULT_UNLOCK', payload: { password: newPassword } }, () => void chrome.runtime?.lastError);
    } catch {
      // Ignore
    }
  }
}

export async function disableVaultEncryption(password: string): Promise<void> {
  const security = await getSecuritySettings();
  if (!security.passwordHash || !security.salt) return;

  const { hashHex } = await hashPassword(password, security.salt);
  if (hashHex !== security.passwordHash) {
    throw new Error('Incorrect password');
  }

  const verifiedKey = await deriveMasterVaultCryptoKey(password, security.salt);
  KeyManager.setSessionKey(verifiedKey, security.salt, security.autoLockMinutes || 15);
  const profiles = await getAllProfiles();
  await DocumentRepository.reencryptAllDocuments(password, null);

  security.isPasswordProtected = false;
  security.passwordHash = undefined;
  security.salt = undefined;
  await saveSecuritySettings(security);

  KeyManager.clearKey();
  await storageAdapter.remove([STORAGE_KEY_ENCRYPTED_VAULT]);
  await saveAllProfiles(profiles);
}

export async function unlockVault(password: string, skipSwBroadcast = false): Promise<boolean> {
  const security = await getSecuritySettings();
  if (!security.isPasswordProtected) return true;
  if (!security.salt || !security.passwordHash) return true;

  const { hashHex } = await hashPassword(password, security.salt);
  if (hashHex === security.passwordHash) {
    const derivedKey = await deriveMasterVaultCryptoKey(password, security.salt);
    KeyManager.setSessionKey(derivedKey, security.salt, security.autoLockMinutes || 15);
    lastActivityTimestamp = Date.now();
    // Validate vault payload can actually decrypt cleanly
    try {
      await getAllProfiles();
    } catch {
      KeyManager.clearKey();
      return false;
    }

    if (!skipSwBroadcast && typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      try {
        chrome.runtime.sendMessage({ action: 'SYNC_VAULT_UNLOCK', payload: { password } }, () => void chrome.runtime?.lastError);
      } catch {
        // Ignore outside SW
      }
    }
    return true;
  }
  return false;
}

export function lockVault(skipSwBroadcast = false): void {
  KeyManager.clearKey();
  if (!skipSwBroadcast && typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
    try {
      chrome.runtime.sendMessage({ action: 'SYNC_VAULT_LOCK' }, () => void chrome.runtime?.lastError);
    } catch {
      // Ignore outside SW
    }
  }
}

// Calculate Profile Completion Score (0 to 100%)
export function calculateProfileScore(p: UserProfile): {
  percentage: number;
  totalFields: number;
  filledFields: number;
  missingKeyFields: string[];
} {
  const checks: Array<{ name: string; filled: boolean; weight: number }> = [
    { name: "Applicant's Name (English)", filled: !!p.personal.applicantNameEn.trim(), weight: 3 },
    { name: "Applicant's Name (Bangla)", filled: !!p.personal.applicantNameBn.trim(), weight: 2 },
    { name: "Father's Name (English)", filled: !!p.personal.fatherNameEn.trim(), weight: 2 },
    { name: "Mother's Name (English)", filled: !!p.personal.motherNameEn.trim(), weight: 2 },
    { name: 'Date of Birth', filled: !!p.personal.dob, weight: 3 },
    { name: 'Gender', filled: !!p.personal.gender, weight: 2 },
    { name: 'National ID / Smart Card', filled: !!p.personal.nid.trim() || !!p.personal.birthReg.trim(), weight: 3 },
    { name: 'Birth Registration No.', filled: !!p.personal.birthReg.trim(), weight: 1 },
    { name: 'Quota Category (কোটা)', filled: !!p.personal.quota.trim(), weight: 1 },
    { name: 'Mobile Number', filled: !!p.personal.mobile.trim(), weight: 3 },
    { name: 'Email Address', filled: !!p.personal.email.trim(), weight: 2 },
    { name: 'Religion', filled: !!p.personal.religion, weight: 1 },
    { name: 'Marital Status', filled: !!p.personal.maritalStatus, weight: 1 },
    { name: 'Present Address: District', filled: !!p.address.present.district.trim(), weight: 2 },
    { name: 'Present Address: Upazila/Thana', filled: !!p.address.present.upazila.trim(), weight: 2 },
    { name: 'Present Address: Post Code', filled: !!p.address.present.postCode.trim(), weight: 1 },
    { name: 'Present Address: Village/House', filled: !!p.address.present.village.trim(), weight: 2 },
    { name: 'Permanent Address: District', filled: !!p.address.permanent.district.trim(), weight: 2 },
    { name: 'SSC: Examination & Board', filled: !!p.ssc.examination && !!p.ssc.board, weight: 2 },
    { name: 'SSC: Roll Number', filled: !!p.ssc.rollNumber.trim(), weight: 2 },
    { name: 'SSC: Result (GPA)', filled: !!p.ssc.gpa.trim(), weight: 2 },
    { name: 'SSC: Passing Year', filled: !!p.ssc.passingYear.trim(), weight: 1 },
    { name: 'HSC: Examination & Board', filled: !!p.hsc.examination && !!p.hsc.board, weight: 2 },
    { name: 'HSC: Roll Number', filled: !!p.hsc.rollNumber.trim(), weight: 2 },
    { name: 'HSC: Result (GPA)', filled: !!p.hsc.gpa.trim(), weight: 2 },
    { name: 'HSC: Passing Year', filled: !!p.hsc.passingYear.trim(), weight: 1 },
    { name: 'Graduation: Degree & University', filled: !!p.graduation.subjectDegree.trim() && !!p.graduation.universityInstitute.trim(), weight: 3 },
    { name: 'Graduation: Result (CGPA)', filled: !!p.graduation.gpa.trim() || p.graduation.appearedStatus, weight: 2 },
    { name: 'Graduation: Passing Year', filled: !!p.graduation.passingYear.trim(), weight: 1 },
  ];

  let totalWeight = 0;
  let earnedWeight = 0;
  const missing: string[] = [];

  for (const c of checks) {
    totalWeight += c.weight;
    if (c.filled) {
      earnedWeight += c.weight;
    } else {
      missing.push(c.name);
    }
  }

  const percentage = Math.round((earnedWeight / totalWeight) * 100);
  return {
    percentage,
    totalFields: checks.length,
    filledFields: checks.filter((c) => c.filled).length,
    missingKeyFields: missing,
  };
}

// Export Profile to JSON
export async function exportProfileData(encrypted = false, password?: string): Promise<string> {
  const profiles = await getAllProfiles();
  const exportPayload = {
    appName: 'JobFill BD',
    version: '2.0.0',
    exportedAt: new Date().toISOString(),
    profiles,
  };

  const jsonStr = JSON.stringify(exportPayload, null, 2);

  let output = jsonStr;
  if (encrypted && password) {
    const enc = await encryptData(jsonStr, password);
    output = JSON.stringify({ isEncrypted: true, payload: enc }, null, 2);
  }

  try {
    const sec = await getSecuritySettings();
    sec.lastBackupAt = Date.now();
    await saveSecuritySettings(sec);
  } catch {
    // Non-fatal metadata update
  }

  return output;
}

// Import Profile from JSON
export async function importProfileData(fileContent: string, password?: string): Promise<number> {
  let parsed: any;
  try {
    parsed = JSON.parse(fileContent);
  } catch {
    throw new Error('Invalid JSON format.');
  }

  let profilesToImport: UserProfile[] = [];

  if (parsed.isEncrypted && parsed.payload) {
    if (!password) throw new Error('PASSWORD_REQUIRED');
    const decrypted = await decryptData(parsed.payload, password);
    const inner = JSON.parse(decrypted);
    profilesToImport = inner.profiles || [];
  } else if (parsed.profiles && Array.isArray(parsed.profiles)) {
    profilesToImport = parsed.profiles;
  } else if (parsed.personal && parsed.ssc) {
    // Single profile exported directly
    profilesToImport = [parsed as UserProfile];
  } else {
    throw new Error('Unrecognized JobFill BD backup file format.');
  }

  if (profilesToImport.length === 0) {
    throw new Error('No valid profiles found in import file.');
  }

  const validProfiles = profilesToImport.filter(
    (p): p is UserProfile =>
      Boolean(
        p &&
          typeof p === 'object' &&
          typeof p.id === 'string' &&
          p.personal &&
          typeof p.personal === 'object' &&
          p.address &&
          typeof p.address === 'object' &&
          p.ssc &&
          typeof p.ssc === 'object'
      )
  );

  if (validProfiles.length !== profilesToImport.length || validProfiles.length === 0) {
    throw new Error('Corrupted or invalid profile schema in backup file.');
  }

  const existing = await getAllProfiles();
  let count = 0;

  for (const p of validProfiles) {
    // Generate fresh id if collision
    if (existing.some((e) => e.id === p.id)) {
      p.id = 'imported_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 4);
    }
    existing.push(p);
    count++;
  }

  await saveAllProfiles(existing);
  return count;
}

// Delete Local Private Vault & User Activity ONLY (preserves public cached job circulars)
export async function deleteLocalUserData(): Promise<void> {
  await DocumentRepository.clearAllDocuments();
  await ProfileRepository.clearAllLocalProfileStores();
  await BookmarkRepository.clearAll();
  await ApplicationRepository.clearAll();
  await JobNotificationRepository.clearAll();
  await clearAutofillHistory();
  await storageAdapter.remove([
    STORAGE_KEY_PROFILES,
    STORAGE_KEY_ACTIVE_ID,
    STORAGE_KEY_SECURITY,
    STORAGE_KEY_ENCRYPTED_VAULT,
    STORAGE_KEY_HISTORY,
  ]);
  lockVault();
}

export async function getVaultDashboardMetrics(): Promise<{
  isPasswordProtected: boolean;
  isLocked: boolean;
  encryptionAlgorithm: string;
  lastBackupAt: number | null;
  storageUsageBytes: number | null;
}> {
  const sec = await getSecuritySettings();
  const locked = sec.isPasswordProtected ? !KeyManager.isKeyActive() : false;
  let storageUsageBytes: number | null = null;
  try {
    if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
      const est = await navigator.storage.estimate();
      if (typeof est.usage === 'number') storageUsageBytes = est.usage;
    }
  } catch {
    storageUsageBytes = null;
  }
  return {
    isPasswordProtected: Boolean(sec.isPasswordProtected),
    isLocked: locked,
    encryptionAlgorithm: sec.isPasswordProtected
      ? 'AES-256-GCM (PBKDF2-SHA256, 100k)'
      : 'AES-256-GCM (Non-Extractable Device Key)',
    lastBackupAt: sec.lastBackupAt || null,
    storageUsageBytes,
  };
}

// Purge all profiles, documents, and Job Circular Hub records
export async function purgeAllData(): Promise<void> {
  await DocumentRepository.clearAllDocuments();
  await ProfileRepository.clearAllLocalProfileStores();
  await JobRepository.clearAll();
  await BookmarkRepository.clearAll();
  await ApplicationRepository.clearAll();
  await JobNotificationRepository.clearAll();
  await clearAutofillHistory();
  await storageAdapter.clear();
  lockVault();
}

// Default General Settings
export const DEFAULT_GENERAL_SETTINGS: AppGeneralSettings = {
  language: 'bn',
  theme: 'light',
  fillMode: 'review_first',
  overwriteProtection: 'warn',
  minimumConfidenceThreshold: 65,
  autoLockMinutes: 15,
  enableBengaliConversion: true,
  enableSoundEffects: false,
  highlightFilledFields: true,
};

// Application History Storage Methods (IndexedDB primary when available, storage fallback)
export async function getAutofillHistory(): Promise<AutofillHistoryRecord[]> {
  if (typeof indexedDB !== 'undefined') {
    try {
      const idbList = await IndexedDBManager.executeTransaction<AutofillHistoryRecord[]>(
        STORES.HISTORY,
        'readonly',
        (store) =>
          new Promise((resolve, reject) => {
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
          })
      );
      if (idbList.length > 0) {
        return [...idbList].sort((a, b) => b.timestamp - a.timestamp).slice(0, 100);
      }
    } catch {
      // Safe fallback below
    }
  }
  const res = await storageAdapter.get<AutofillHistoryRecord[]>([STORAGE_KEY_HISTORY]);
  return res[STORAGE_KEY_HISTORY] || [];
}

export async function addAutofillHistory(record: AutofillHistoryRecord): Promise<void> {
  const sanitizedUrl = (() => {
    try {
      const u = new URL(record.url);
      return `${u.origin}${u.pathname}`;
    } catch {
      return String(record.url || '').split('?')[0].split('#')[0];
    }
  })();
  const sanitizedRecord: AutofillHistoryRecord = {
    ...record,
    url: sanitizedUrl,
    profileName: 'Applicant Profile',
  };

  let savedToIdb = false;
  if (typeof indexedDB !== 'undefined') {
    try {
      await IndexedDBManager.executeTransaction(STORES.HISTORY, 'readwrite', (store) =>
        new Promise<void>((resolve, reject) => {
          const req = store.put(sanitizedRecord);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        })
      );
      savedToIdb = true;
    } catch {
      savedToIdb = false;
    }
  }
  if (!savedToIdb) {
    const history = await getAutofillHistory();
    const updated = [sanitizedRecord, ...history].slice(0, 100); // Keep last 100 sessions
    await storageAdapter.set({ [STORAGE_KEY_HISTORY]: updated });
  }
}

export async function clearAutofillHistory(): Promise<void> {
  if (typeof indexedDB !== 'undefined') {
    try {
      await IndexedDBManager.executeTransaction(STORES.HISTORY, 'readwrite', (store) =>
        new Promise<void>((resolve, reject) => {
          const req = store.clear();
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        })
      );
    } catch {
      // Ignore
    }
  }
  await storageAdapter.remove([STORAGE_KEY_HISTORY]);
}

// General Settings Methods
export async function getGeneralSettings(): Promise<AppGeneralSettings> {
  const res = await storageAdapter.get<AppGeneralSettings>([STORAGE_KEY_GENERAL_SETTINGS]);
  return { ...DEFAULT_GENERAL_SETTINGS, ...(res[STORAGE_KEY_GENERAL_SETTINGS] || {}) };
}

export async function saveGeneralSettings(settings: Partial<AppGeneralSettings>): Promise<void> {
  const current = await getGeneralSettings();
  const updated = { ...current, ...settings };
  await storageAdapter.set({ [STORAGE_KEY_GENERAL_SETTINGS]: updated });
}

const CANONICAL_FIELD_UPDATER: Record<string, (target: UserProfile, val: string) => void> = {
  'applicant.fullName.english': (t, v) => { t.personal.applicantNameEn = v; },
  'applicant.fullName.bangla': (t, v) => { t.personal.applicantNameBn = v; },
  'family.father.name.english': (t, v) => { t.personal.fatherNameEn = v; },
  'family.father.name.bangla': (t, v) => { t.personal.fatherNameBn = v; },
  'family.mother.name.english': (t, v) => { t.personal.motherNameEn = v; },
  'family.mother.name.bangla': (t, v) => { t.personal.motherNameBn = v; },
  'family.spouse.name.english': (t, v) => { t.personal.spouseNameEn = v; },
  'family.spouse.name.bangla': (t, v) => { t.personal.spouseNameBn = v; },
  'applicant.dateOfBirth': (t, v) => { t.personal.dob = v; },
  'applicant.nationality': (t, v) => { t.personal.nationality = v; },
  'applicant.religion': (t, v) => { t.personal.religion = v as any; },
  'applicant.gender': (t, v) => { t.personal.gender = v as any; },
  'applicant.maritalStatus': (t, v) => { t.personal.maritalStatus = v as any; },
  'applicant.quota': (t, v) => { t.personal.quota = v as any; },
  'applicant.departmentalStatus': (t, v) => { t.personal.departmentalStatus = v as any; },
  'identity.nationalId': (t, v) => { t.personal.nid = v; },
  'identity.nid': (t, v) => { t.personal.nid = v; },
  'identities.nationalId': (t, v) => { t.personal.nid = v; },
  'identity.birthRegistration': (t, v) => { t.personal.birthReg = v; },
  'identity.birthReg': (t, v) => { t.personal.birthReg = v; },
  'identity.passport': (t, v) => { t.personal.passport = v; },
  'contact.mobile': (t, v) => { t.personal.mobile = v; },
  'contact.confirmMobile': (t, v) => { t.personal.confirmMobile = v; },
  'contact.email': (t, v) => { t.personal.email = v; },
  'address.present.careOf': (t, v) => { t.address.present.careOf = v; },
  'address.present.village': (t, v) => { t.address.present.village = v; },
  'address.present.district': (t, v) => { t.address.present.district = v; },
  'address.present.upazila': (t, v) => { t.address.present.upazila = v; },
  'address.present.postOffice': (t, v) => { t.address.present.postOffice = v; },
  'address.present.postCode': (t, v) => { t.address.present.postCode = v; },
  'address.permanent.careOf': (t, v) => { t.address.permanent.careOf = v; },
  'address.permanent.village': (t, v) => { t.address.permanent.village = v; },
  'address.permanent.district': (t, v) => { t.address.permanent.district = v; },
  'address.permanent.upazila': (t, v) => { t.address.permanent.upazila = v; },
  'address.permanent.postOffice': (t, v) => { t.address.permanent.postOffice = v; },
  'address.permanent.postCode': (t, v) => { t.address.permanent.postCode = v; },
  'education.ssc.examination': (t, v) => { t.ssc.examination = v; },
  'education.ssc.board': (t, v) => { t.ssc.board = v; },
  'education.ssc.roll': (t, v) => { t.ssc.rollNumber = v; },
  'education.ssc.group': (t, v) => { t.ssc.groupSubject = v; },
  'education.ssc.result': (t, v) => { t.ssc.resultType = v as any; },
  'education.ssc.gpa': (t, v) => { t.ssc.gpa = v; },
  'education.ssc.passingYear': (t, v) => { t.ssc.passingYear = v; },
  'education.hsc.examination': (t, v) => { t.hsc.examination = v; },
  'education.hsc.board': (t, v) => { t.hsc.board = v; },
  'education.hsc.roll': (t, v) => { t.hsc.rollNumber = v; },
  'education.hsc.group': (t, v) => { t.hsc.groupSubject = v; },
  'education.hsc.result': (t, v) => { t.hsc.resultType = v as any; },
  'education.hsc.gpa': (t, v) => { t.hsc.gpa = v; },
  'education.hsc.passingYear': (t, v) => { t.hsc.passingYear = v; },
  'education.graduation.degree': (t, v) => { t.graduation.examination = v; },
  'education.graduation.examination': (t, v) => { t.graduation.examination = v; },
  'education.graduation.subject': (t, v) => { t.graduation.subjectDegree = v; },
  'education.graduation.institution': (t, v) => { t.graduation.universityInstitute = v; },
  'education.graduation.result': (t, v) => { t.graduation.resultType = v as any; },
  'education.graduation.gpa': (t, v) => { t.graduation.gpa = v; },
  'education.graduation.cgpa': (t, v) => { t.graduation.gpa = v; },
  'education.graduation.passingYear': (t, v) => { t.graduation.passingYear = v; },
  'circular.orgChoice1': (t, v) => { t.special.orgChoice1 = v; },
  'circular.orgChoice2': (t, v) => { t.special.orgChoice2 = v; },
};

export function applyCanonicalProfileFieldUpdate(
  target: UserProfile,
  canonicalKey: string,
  newValue: string
): boolean {
  const updater = CANONICAL_FIELD_UPDATER[canonicalKey];
  if (!updater) return false;
  updater(target, newValue);
  return true;
}

