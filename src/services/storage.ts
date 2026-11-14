import { UserProfile, SecuritySettings, AutofillHistoryRecord, AppGeneralSettings, CustomProfileField, JobExperience } from '../types/profile';
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
import { HistoryRepository } from '../database/history-repository';
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
export function normalizeLoadedProfile(raw: any): UserProfile {
  const base = createEmptyProfile(raw?.profileName || 'My Job Profile');
  const rawAddr = raw?.address || {};
  return {
    ...base,
    ...(raw || {}),
    id: raw?.id || base.id,
    profileName: raw?.profileName || base.profileName,
    createdAt: raw?.createdAt || base.createdAt,
    updatedAt: raw?.updatedAt || base.updatedAt,
    personal: { ...base.personal, ...(raw?.personal || {}) },
    address: {
      ...base.address,
      ...rawAddr,
      present: { ...base.address.present, ...(rawAddr.present || {}) },
      permanent: { ...base.address.permanent, ...(rawAddr.permanent || {}) },
    },
    ssc: { ...base.ssc, ...(raw?.ssc || {}) },
    hsc: { ...base.hsc, ...(raw?.hsc || {}) },
    graduation: { ...base.graduation, ...(raw?.graduation || {}) },
    masters: { ...base.masters, ...(raw?.masters || {}) },
    additionalQualifications: Array.isArray(raw?.additionalQualifications) ? raw.additionalQualifications : [],
    jobExperiences: Array.isArray(raw?.jobExperiences) ? raw.jobExperiences : [],
    special: { ...base.special, ...(raw?.special || {}) },
    references: Array.isArray(raw?.references) ? raw.references : base.references,
    documents: Array.isArray(raw?.documents) ? raw.documents : [],
    careerProfile: {
      ...(base.careerProfile || {}),
      ...(raw?.careerProfile || {}),
      skills: Array.isArray(raw?.careerProfile?.skills) ? raw.careerProfile.skills : [],
      languages: Array.isArray(raw?.careerProfile?.languages) ? raw.careerProfile.languages : [],
      projects: Array.isArray(raw?.careerProfile?.projects) ? raw.careerProfile.projects : [],
      achievements: Array.isArray(raw?.careerProfile?.achievements) ? raw.careerProfile.achievements : [],
      careerInterests: Array.isArray(raw?.careerProfile?.careerInterests) ? raw.careerProfile.careerInterests : [],
      preferredJobCategories: Array.isArray(raw?.careerProfile?.preferredJobCategories)
        ? raw.careerProfile.preferredJobCategories
        : [],
      preferredLocations: Array.isArray(raw?.careerProfile?.preferredLocations)
        ? raw.careerProfile.preferredLocations
        : [],
      internshipPreference: Boolean(raw?.careerProfile?.internshipPreference),
      careerGoals: Array.isArray(raw?.careerProfile?.careerGoals) ? raw.careerProfile.careerGoals : [],
    },
  };
}

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
  } else {
    profiles = profiles.map(normalizeLoadedProfile);
    if (needsIdbMigration) {
      await saveAllProfiles(profiles);
    }
  }
  return profiles.map(normalizeLoadedProfile);
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
export function calculateProfileScore(rawProfile: UserProfile): {
  percentage: number;
  totalFields: number;
  filledFields: number;
  missingKeyFields: string[];
} {
  const p = normalizeLoadedProfile(rawProfile);
  const s = (v?: string | null) => String(v || '').trim();
  const checks: Array<{ name: string; filled: boolean; weight: number }> = [
    { name: "Applicant's Name (English)", filled: !!s(p.personal.applicantNameEn), weight: 3 },
    { name: "Applicant's Name (Bangla)", filled: !!s(p.personal.applicantNameBn), weight: 2 },
    { name: "Father's Name (English)", filled: !!s(p.personal.fatherNameEn), weight: 2 },
    { name: "Mother's Name (English)", filled: !!s(p.personal.motherNameEn), weight: 2 },
    { name: 'Date of Birth', filled: !!s(p.personal.dob), weight: 3 },
    { name: 'Gender', filled: !!s(p.personal.gender), weight: 2 },
    { name: 'National ID / Smart Card', filled: !!s(p.personal.nid) || !!s(p.personal.birthReg), weight: 3 },
    { name: 'Birth Registration No.', filled: !!s(p.personal.birthReg), weight: 1 },
    { name: 'Quota Category (কোটা)', filled: !!s(p.personal.quota), weight: 1 },
    { name: 'Mobile Number', filled: !!s(p.personal.mobile), weight: 3 },
    { name: 'Email Address', filled: !!s(p.personal.email), weight: 2 },
    { name: 'Religion', filled: !!s(p.personal.religion), weight: 1 },
    { name: 'Marital Status', filled: !!s(p.personal.maritalStatus), weight: 1 },
    { name: 'Present Address: District', filled: !!s(p.address.present.district), weight: 2 },
    { name: 'Present Address: Upazila/Thana', filled: !!s(p.address.present.upazila), weight: 2 },
    { name: 'Present Address: Post Code', filled: !!s(p.address.present.postCode), weight: 1 },
    { name: 'Present Address: Village/House', filled: !!s(p.address.present.village), weight: 2 },
    { name: 'Permanent Address: District', filled: !!s(p.address.permanent.district), weight: 2 },
    { name: 'SSC: Examination & Board', filled: !!s(p.ssc.examination) && !!s(p.ssc.board), weight: 2 },
    { name: 'SSC: Roll Number', filled: !!s(p.ssc.rollNumber), weight: 2 },
    { name: 'SSC: Result (GPA)', filled: !!s(p.ssc.gpa), weight: 2 },
    { name: 'SSC: Passing Year', filled: !!s(p.ssc.passingYear), weight: 1 },
    { name: 'HSC: Examination & Board', filled: !!s(p.hsc.examination) && !!s(p.hsc.board), weight: 2 },
    { name: 'HSC: Roll Number', filled: !!s(p.hsc.rollNumber), weight: 2 },
    { name: 'HSC: Result (GPA)', filled: !!s(p.hsc.gpa), weight: 2 },
    { name: 'HSC: Passing Year', filled: !!s(p.hsc.passingYear), weight: 1 },
    { name: 'Graduation: Degree & University', filled: !!s(p.graduation.subjectDegree) && !!s(p.graduation.universityInstitute), weight: 3 },
    { name: 'Graduation: Result (CGPA)', filled: !!s(p.graduation.gpa) || !!p.graduation.appearedStatus, weight: 2 },
    { name: 'Graduation: Passing Year', filled: !!s(p.graduation.passingYear), weight: 1 },
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
  autoSaveSafeProfileChanges: false,
};

// Application History Storage Methods (IndexedDB primary when available, storage fallback)
export async function getAutofillHistory(): Promise<AutofillHistoryRecord[]> {
  return HistoryRepository.getHistory();
}

export async function addAutofillHistory(record: AutofillHistoryRecord): Promise<void> {
  return HistoryRepository.upsertRecord(record);
}

export async function deleteAutofillHistoryItem(id: string): Promise<void> {
  return HistoryRepository.deleteRecord(id);
}

export async function clearAutofillHistory(): Promise<void> {
  return HistoryRepository.clearHistory();
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

export async function getAutoSaveSafeFieldsSetting(): Promise<boolean> {
  const settings = await getGeneralSettings();
  return Boolean(settings.autoSaveSafeProfileChanges);
}

export async function setAutoSaveSafeFieldsSetting(enabled: boolean): Promise<void> {
  await saveGeneralSettings({ autoSaveSafeProfileChanges: enabled });
}

function ensureMasters(t: UserProfile): void {
  if (!t.masters) {
    t.masters = {
      examination: 'M.Sc',
      subjectDegree: '',
      universityInstitute: '',
      college: '',
      studentId: '',
      registrationNumber: '',
      rollNumber: '',
      session: '',
      resultType: 'CGPA (out of 4)',
      gpa: '',
      gpaScale: '4.00',
      passingYear: '',
      courseDuration: '1.5 Years',
      appearedStatus: false,
      examStartDate: '',
      examEndDate: '',
    };
  }
}

function ensureGraduation(t: UserProfile): void {
  t.hasGraduation = true;
  if (!t.graduation) {
    t.graduation = {
      examination: 'B.Sc Engineering',
      subjectDegree: '',
      universityInstitute: '',
      college: '',
      studentId: '',
      registrationNumber: '',
      rollNumber: '',
      session: '',
      resultType: 'CGPA (out of 4)',
      gpa: '',
      gpaScale: '4.00',
      passingYear: '',
      courseDuration: '4 Years',
      appearedStatus: false,
      examStartDate: '',
      examEndDate: '',
    };
  }
}

function ensureExperienceRecord(t: UserProfile, index: number = 0): JobExperience {
  t.hasJobExperience = true;
  if (!t.jobExperiences) {
    t.jobExperiences = [];
  }
  while (t.jobExperiences.length <= index) {
    t.jobExperiences.push({
      id: `exp_${Date.now()}_${t.jobExperiences.length}`,
      employedOn: 'Government',
      organization: '',
      designation: '',
      address: '',
      startDate: '',
      endDate: '',
      currentlyWorking: false,
      salary: '',
      jobDescription: '',
    });
  }
  return t.jobExperiences[index];
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
  'address.present.division': (t, v) => { t.address.present.division = v; },
  'address.present.district': (t, v) => { t.address.present.district = v; },
  'address.present.upazila': (t, v) => { t.address.present.upazila = v; },
  'address.present.postOffice': (t, v) => { t.address.present.postOffice = v; },
  'address.present.postCode': (t, v) => { t.address.present.postCode = v; },
  'address.permanent.careOf': (t, v) => { t.address.permanent.careOf = v; },
  'address.permanent.village': (t, v) => { t.address.permanent.village = v; },
  'address.permanent.division': (t, v) => { t.address.permanent.division = v; },
  'address.permanent.district': (t, v) => { t.address.permanent.district = v; },
  'address.permanent.upazila': (t, v) => { t.address.permanent.upazila = v; },
  'address.permanent.postOffice': (t, v) => { t.address.permanent.postOffice = v; },
  'address.permanent.postCode': (t, v) => { t.address.permanent.postCode = v; },
  'education.ssc.examination': (t, v) => { t.ssc.examination = v; },
  'education.ssc.board': (t, v) => { t.ssc.board = v; },
  'education.ssc.roll': (t, v) => { t.ssc.rollNumber = v; },
  'education.ssc.registration': (t, v) => { t.ssc.registrationNumber = v; },
  'education.ssc.group': (t, v) => { t.ssc.groupSubject = v; },
  'education.ssc.result': (t, v) => { t.ssc.resultType = v as any; },
  'education.ssc.gpa': (t, v) => { t.ssc.gpa = v; },
  'education.ssc.passingYear': (t, v) => { t.ssc.passingYear = v; },
  'education.hsc.examination': (t, v) => { t.hsc.examination = v; },
  'education.hsc.board': (t, v) => { t.hsc.board = v; },
  'education.hsc.roll': (t, v) => { t.hsc.rollNumber = v; },
  'education.hsc.registration': (t, v) => { t.hsc.registrationNumber = v; },
  'education.hsc.group': (t, v) => { t.hsc.groupSubject = v; },
  'education.hsc.result': (t, v) => { t.hsc.resultType = v as any; },
  'education.hsc.gpa': (t, v) => { t.hsc.gpa = v; },
  'education.hsc.passingYear': (t, v) => { t.hsc.passingYear = v; },
  'education.graduation.degree': (t, v) => { ensureGraduation(t); t.graduation.examination = v; },
  'education.graduation.examination': (t, v) => { ensureGraduation(t); t.graduation.examination = v; },
  'education.graduation.subject': (t, v) => { ensureGraduation(t); t.graduation.subjectDegree = v; },
  'education.graduation.institution': (t, v) => { ensureGraduation(t); t.graduation.universityInstitute = v; },
  'education.graduation.result': (t, v) => { ensureGraduation(t); t.graduation.resultType = v as any; },
  'education.graduation.gpa': (t, v) => { ensureGraduation(t); t.graduation.gpa = v; },
  'education.graduation.cgpa': (t, v) => { ensureGraduation(t); t.graduation.gpa = v; },
  'education.graduation.passingYear': (t, v) => { ensureGraduation(t); t.graduation.passingYear = v; },
  'education.masters.degree': (t, v) => { ensureMasters(t); t.masters.examination = v; t.hasMasters = true; },
  'education.masters.examination': (t, v) => { ensureMasters(t); t.masters.examination = v; t.hasMasters = true; },
  'education.masters.subject': (t, v) => { ensureMasters(t); t.masters.subjectDegree = v; t.hasMasters = true; },
  'education.masters.institution': (t, v) => { ensureMasters(t); t.masters.universityInstitute = v; t.hasMasters = true; },
  'education.masters.result': (t, v) => { ensureMasters(t); t.masters.resultType = v as any; t.hasMasters = true; },
  'education.masters.gpa': (t, v) => { ensureMasters(t); t.masters.gpa = v; t.hasMasters = true; },
  'education.masters.cgpa': (t, v) => { ensureMasters(t); t.masters.gpa = v; t.hasMasters = true; },
  'education.masters.passingYear': (t, v) => { ensureMasters(t); t.masters.passingYear = v; t.hasMasters = true; },
  'experience.organization': (t, v) => {
    t.hasJobExperience = true;
    if (!t.jobExperiences || t.jobExperiences.length === 0) {
      ensureExperienceRecord(t, 0).organization = v;
      return;
    }
    const existing = t.jobExperiences.find((e) => e.organization.toLowerCase() === v.toLowerCase());
    if (existing) {
      existing.organization = v;
    } else if (t.jobExperiences[0].organization && t.jobExperiences[0].organization.trim() !== '') {
      const newExp = ensureExperienceRecord(t, t.jobExperiences.length);
      newExp.organization = v;
    } else {
      t.jobExperiences[0].organization = v;
    }
  },
  'experience.designation': (t, v) => {
    t.hasJobExperience = true;
    if (!t.jobExperiences || t.jobExperiences.length === 0) {
      ensureExperienceRecord(t, 0).designation = v;
    } else {
      t.jobExperiences[t.jobExperiences.length - 1].designation = v;
    }
  },
  'experience.startDate': (t, v) => {
    if (t.jobExperiences && t.jobExperiences.length > 0) {
      t.jobExperiences[t.jobExperiences.length - 1].startDate = v;
    }
  },
  'experience.endDate': (t, v) => {
    if (t.jobExperiences && t.jobExperiences.length > 0) {
      t.jobExperiences[t.jobExperiences.length - 1].endDate = v;
    }
  },
  'circular.orgChoice1': (t, v) => { t.special.orgChoice1 = v; },
  'circular.orgChoice2': (t, v) => { t.special.orgChoice2 = v; },
  'special.bloodGroup': (t, v) => { t.special.bloodGroup = v; },
  'special.heightCm': (t, v) => { t.special.heightCm = v; },
  'special.weightKg': (t, v) => { t.special.weightKg = v; },
  'special.chestCm': (t, v) => { t.special.chestCm = v; },
  'special.examCentre': (t, v) => { t.special.examCentre = v; },
  'special.questionVersion': (t, v) => { t.special.questionVersion = v as any; },
  'special.cadrePreference': (t, v) => { t.special.cadrePreference = v; },
  'special.nonCadrePreference': (t, v) => { t.special.nonCadrePreference = v; },
  'special.freedomFighterCertNo': (t, v) => { t.special.freedomFighterCertNo = v; },
};

export function applyCanonicalProfileFieldUpdate(
  target: UserProfile,
  canonicalKey: string,
  newValue: string,
  customFieldMeta?: Partial<CustomProfileField>
): boolean {
  const updater = CANONICAL_FIELD_UPDATER[canonicalKey];
  if (updater) {
    updater(target, newValue);
    return true;
  }

  // Support indexed experience keys like experience.0.organization, experience.1.designation, etc.
  const expMatch = canonicalKey.match(/^experience\.(\d+)\.(organization|designation|startDate|endDate|address|employedOn|currentlyWorking)$/);
  if (expMatch) {
    const idx = parseInt(expMatch[1], 10);
    const field = expMatch[2];
    const rec = ensureExperienceRecord(target, idx);
    if (field === 'currentlyWorking') {
      rec.currentlyWorking = newValue === 'true' || newValue === '1' || newValue.toLowerCase() === 'yes';
    } else {
      (rec as any)[field] = newValue;
    }
    return true;
  }

  // Handle custom dynamic fields: custom_* or custom.* or any dynamic user-learned field
  if (canonicalKey.startsWith('custom_') || canonicalKey.startsWith('custom.')) {
    if (!target.customFields) {
      target.customFields = [];
    }
    const cleanKey = canonicalKey.replace(/^custom\./, 'custom_');
    const existingIndex = target.customFields.findIndex(
      (f) => f.fieldKey === canonicalKey || f.fieldKey === cleanKey
    );

    const now = Date.now();
    if (existingIndex >= 0) {
      target.customFields[existingIndex].value = newValue;
      target.customFields[existingIndex].updatedAt = now;
      if (customFieldMeta?.labelEn) target.customFields[existingIndex].labelEn = customFieldMeta.labelEn;
      if (customFieldMeta?.labelBn) target.customFields[existingIndex].labelBn = customFieldMeta.labelBn;
      if (customFieldMeta?.category) target.customFields[existingIndex].category = customFieldMeta.category;
      if (customFieldMeta?.dataType) target.customFields[existingIndex].dataType = customFieldMeta.dataType;
      if (customFieldMeta?.reuseInAutofill !== undefined) {
        target.customFields[existingIndex].reuseInAutofill = customFieldMeta.reuseInAutofill;
      }
    } else {
      const rawName = cleanKey.replace(/^custom_/, '').replace(/_/g, ' ');
      const labelEn = customFieldMeta?.labelEn || rawName.charAt(0).toUpperCase() + rawName.slice(1);
      const labelBn = customFieldMeta?.labelBn || labelEn;
      const newCustomField: CustomProfileField = {
        id: customFieldMeta?.id || `cf_${now}_${Math.random().toString(36).substring(2, 7)}`,
        fieldKey: cleanKey,
        labelEn,
        labelBn,
        value: newValue,
        category: customFieldMeta?.category || 'other',
        dataType: customFieldMeta?.dataType || 'text',
        description: customFieldMeta?.description,
        reuseInAutofill: customFieldMeta?.reuseInAutofill !== false,
        createdAt: now,
        updatedAt: now,
      };
      target.customFields.push(newCustomField);
    }
    return true;
  }

  return false;
}

