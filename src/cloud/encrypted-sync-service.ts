// JobFill BD - Optional Client-Side E2EE Private Vault Sync Service
// Disabled by default (Local Only). Requires explicit Cloud Sync opt-in + authenticated JWT
// + separate user Vault/Sync passphrase that is NEVER sent to the server.
// Only AES-256-GCM ciphertext envelopes leave the browser.

import { EncryptedPayload, encryptData, decryptData } from '../utils/crypto';
import { getAllProfiles, saveAllProfiles } from '../services/storage';
import { BookmarkRepository } from '../jobs/database/bookmark-repository';
import { ApplicationRepository } from '../jobs/database/application-repository';
import { getCloudConfig, saveCloudConfig, isCloudBackendConfigured, isCloudSyncFeatureEnabled } from './supabase-config';
import { getActiveCloudSession, signOutCloudAccount } from './supabase-auth';
import { UserProfile } from '../types/profile';

export type VaultSyncScope = 'profiles_bundle' | 'activity_bundle';
export type CloudSyncMergeStrategy = 'merge' | 'replace';

export interface CloudSyncUploadResult {
  ok: boolean;
  scopesUploaded: VaultSyncScope[];
  syncedAt: number;
}

export interface CloudSyncPullResult {
  ok: boolean;
  profilesRestored: number;
  conflictsResolved?: number;
  strategyUsed?: CloudSyncMergeStrategy;
  syncedAt: number;
}

export interface CloudSyncPreviewResult {
  ok: boolean;
  localProfilesCount: number;
  remoteProfilesCount: number;
  conflictingProfileIds: string[];
  remoteProfiles: UserProfile[];
  remoteBookmarks: Array<{ jobId: string; note?: string }>;
  remoteApplications: any[];
  hasLocalConflicts: boolean;
}

function isPlaceholderProfile(p: UserProfile): boolean {
  return (
    !p?.personal?.applicantNameEn?.trim() &&
    !p?.personal?.nid?.trim() &&
    !p?.personal?.mobile?.trim() &&
    !p?.personal?.email?.trim()
  );
}

export function mergeCloudProfilesWithLocal(
  localProfiles: UserProfile[],
  remoteProfiles: UserProfile[],
  strategy: CloudSyncMergeStrategy = 'merge'
): { merged: UserProfile[]; conflictIds: string[] } {
  if (strategy === 'replace') {
    const conflictIds = localProfiles
      .filter((lp) => !isPlaceholderProfile(lp))
      .map((lp) => lp.id);
    return { merged: remoteProfiles, conflictIds };
  }

  const substantiveLocal = localProfiles.filter((lp) => !isPlaceholderProfile(lp));
  const byId = new Map<string, UserProfile>();
  for (const lp of substantiveLocal) {
    byId.set(lp.id, lp);
  }

  const conflictIds: string[] = [];
  for (const rp of remoteProfiles) {
    const existing = byId.get(rp.id);
    if (!existing) {
      byId.set(rp.id, rp);
      continue;
    }
    const localTs = Date.parse(existing.updatedAt || '') || 0;
    const remoteTs = Date.parse(rp.updatedAt || '') || 0;
    if (localTs !== remoteTs) {
      conflictIds.push(rp.id);
    }
    // Prefer newest timestamp on merge conflict; on equal timestamp keep remote backup revision
    byId.set(rp.id, remoteTs >= localTs ? rp : existing);
  }

  return { merged: Array.from(byId.values()), conflictIds };
}

function assertValidCiphertextEnvelope(payload: unknown): asserts payload is EncryptedPayload {
  const p = payload as EncryptedPayload;
  if (
    !p ||
    p.algorithm !== 'AES-GCM' ||
    typeof p.saltHex !== 'string' ||
    typeof p.ivHex !== 'string' ||
    typeof p.ciphertextHex !== 'string'
  ) {
    throw new Error('SECURITY_VIOLATION: Refused to upload non-encrypted cloud sync payload.');
  }
}

export async function uploadEncryptedVaultToCloud(syncPassphrase: string): Promise<CloudSyncUploadResult> {
  if ((typeof __JOBFILL_CLOUD_SYNC_DISABLED__ !== 'undefined' && __JOBFILL_CLOUD_SYNC_DISABLED__) || !isCloudSyncFeatureEnabled()) {
    throw new Error('CLOUD_SYNC_DISABLED_IN_RELEASE: Optional Supabase Cloud Sync is disabled in this Microsoft Edge Store release.');
  }
  const cfg = await getCloudConfig();
  if (!cfg.cloudSyncEnabled) {
    throw new Error('Cloud Sync is disabled (Local Only mode active).');
  }
  if (!isCloudBackendConfigured(cfg)) {
    throw new Error('Supabase URL and public anon key are required.');
  }
  const session = getActiveCloudSession();
  if (!session) {
    throw new Error('AUTH_REQUIRED: Sign in to your cloud sync account before syncing.');
  }
  if (!syncPassphrase || syncPassphrase.length < 6) {
    throw new Error('Sync passphrase (minimum 6 characters) is required for client-side E2EE.');
  }

  const profiles = await getAllProfiles();
  const bookmarks = await BookmarkRepository.getAll();
  const applications = await ApplicationRepository.getAll();

  const profilesCipher = await encryptData(
    JSON.stringify({ schemaVersion: 1, exportedAt: Date.now(), profiles }),
    syncPassphrase
  );
  const activityCipher = await encryptData(
    JSON.stringify({ schemaVersion: 1, exportedAt: Date.now(), bookmarks, applications }),
    syncPassphrase
  );

  assertValidCiphertextEnvelope(profilesCipher);
  assertValidCiphertextEnvelope(activityCipher);

  // Note: Omit client user_id so PostgreSQL DEFAULT auth.uid() + trigger owns identity exclusively
  const rows = [
    {
      record_scope: 'profiles_bundle' as const,
      ciphertext_payload: profilesCipher,
      schema_version: 1,
      client_updated_at: new Date().toISOString(),
    },
    {
      record_scope: 'activity_bundle' as const,
      ciphertext_payload: activityCipher,
      schema_version: 1,
      client_updated_at: new Date().toISOString(),
    },
  ];

  const resp = await fetch(`${cfg.supabaseUrl}/rest/v1/user_vault_blobs?on_conflict=user_id,record_scope`, {
    method: 'POST',
    headers: {
      apikey: cfg.supabaseAnonKey,
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(rows),
  });

  if (!resp.ok) {
    const errBody = await resp.text().catch(() => '');
    throw new Error(`Cloud sync upload failed (HTTP ${resp.status}): ${errBody.slice(0, 120)}`);
  }

  const now = Date.now();
  await saveCloudConfig({ lastSyncedAt: now });
  return { ok: true, scopesUploaded: ['profiles_bundle', 'activity_bundle'], syncedAt: now };
}

async function fetchAndDecryptCloudBundles(syncPassphrase: string): Promise<{
  remoteProfiles: UserProfile[];
  remoteBookmarks: Array<{ jobId: string; note?: string }>;
  remoteApplications: any[];
}> {
  if ((typeof __JOBFILL_CLOUD_SYNC_DISABLED__ !== 'undefined' && __JOBFILL_CLOUD_SYNC_DISABLED__) || !isCloudSyncFeatureEnabled()) {
    throw new Error('CLOUD_SYNC_DISABLED_IN_RELEASE: Optional Supabase Cloud Sync is disabled in this Microsoft Edge Store release.');
  }
  const cfg = await getCloudConfig();
  if (!cfg.cloudSyncEnabled) {
    throw new Error('Cloud Sync is disabled.');
  }
  const session = getActiveCloudSession();
  if (!session) {
    throw new Error('AUTH_REQUIRED: Sign in to restore encrypted cloud data.');
  }
  if (!syncPassphrase) {
    throw new Error('Sync passphrase is required to decrypt your cloud vault locally.');
  }

  const resp = await fetch(`${cfg.supabaseUrl}/rest/v1/user_vault_blobs?select=record_scope,ciphertext_payload,updated_at`, {
    method: 'GET',
    headers: {
      apikey: cfg.supabaseAnonKey,
      Authorization: `Bearer ${session.accessToken}`,
    },
  });

  if (!resp.ok) {
    throw new Error(`Cloud vault fetch failed (HTTP ${resp.status})`);
  }

  const blobs = await resp.json();
  let remoteProfiles: UserProfile[] = [];
  let remoteBookmarks: Array<{ jobId: string; note?: string }> = [];
  let remoteApplications: any[] = [];

  if (Array.isArray(blobs)) {
    const profilesRow = blobs.find((b) => b.record_scope === 'profiles_bundle');
    if (profilesRow?.ciphertext_payload) {
      const decryptedJson = await decryptData(profilesRow.ciphertext_payload, syncPassphrase);
      const parsed = JSON.parse(decryptedJson);
      remoteProfiles = Array.isArray(parsed?.profiles) ? parsed.profiles : [];
    }

    const activityRow = blobs.find((b) => b.record_scope === 'activity_bundle');
    if (activityRow?.ciphertext_payload) {
      const decryptedAct = await decryptData(activityRow.ciphertext_payload, syncPassphrase);
      const parsedAct = JSON.parse(decryptedAct);
      if (Array.isArray(parsedAct?.bookmarks)) {
        remoteBookmarks = parsedAct.bookmarks;
      }
      if (Array.isArray(parsedAct?.applications)) {
        remoteApplications = parsedAct.applications;
      }
    }
  }

  return { remoteProfiles, remoteBookmarks, remoteApplications };
}

export async function previewCloudVaultPull(syncPassphrase: string): Promise<CloudSyncPreviewResult> {
  if ((typeof __JOBFILL_CLOUD_SYNC_DISABLED__ !== 'undefined' && __JOBFILL_CLOUD_SYNC_DISABLED__) || !isCloudSyncFeatureEnabled()) {
    throw new Error('CLOUD_SYNC_DISABLED_IN_RELEASE: Optional Supabase Cloud Sync is disabled in this Microsoft Edge Store release.');
  }
  const [{ remoteProfiles, remoteBookmarks, remoteApplications }, localProfiles] = await Promise.all([
    fetchAndDecryptCloudBundles(syncPassphrase),
    getAllProfiles().catch(() => [] as UserProfile[]),
  ]);
  const substantiveLocal = localProfiles.filter((lp) => !isPlaceholderProfile(lp));
  const { conflictIds } = mergeCloudProfilesWithLocal(substantiveLocal, remoteProfiles, 'merge');
  return {
    ok: true,
    localProfilesCount: substantiveLocal.length,
    remoteProfilesCount: remoteProfiles.length,
    conflictingProfileIds: conflictIds,
    remoteProfiles,
    remoteBookmarks,
    remoteApplications,
    hasLocalConflicts: substantiveLocal.length > 0 && remoteProfiles.length > 0,
  };
}

export async function pullAndDecryptVaultFromCloud(
  syncPassphrase: string,
  options?: { strategy?: CloudSyncMergeStrategy }
): Promise<CloudSyncPullResult> {
  if ((typeof __JOBFILL_CLOUD_SYNC_DISABLED__ !== 'undefined' && __JOBFILL_CLOUD_SYNC_DISABLED__) || !isCloudSyncFeatureEnabled()) {
    throw new Error('CLOUD_SYNC_DISABLED_IN_RELEASE: Optional Supabase Cloud Sync is disabled in this Microsoft Edge Store release.');
  }
  const strategy: CloudSyncMergeStrategy = options?.strategy || 'merge';
  const { remoteProfiles, remoteBookmarks, remoteApplications } = await fetchAndDecryptCloudBundles(syncPassphrase);
  let profilesRestored = 0;
  let conflictsResolved = 0;

  if (remoteProfiles.length > 0) {
    const localProfiles = await getAllProfiles().catch(() => [] as UserProfile[]);
    const { merged, conflictIds } = mergeCloudProfilesWithLocal(localProfiles, remoteProfiles, strategy);
    conflictsResolved = conflictIds.length;
    if (merged.length > 0) {
      await saveAllProfiles(merged);
      profilesRestored = merged.length;
    }
  }

  for (const bm of remoteBookmarks) {
    if (bm?.jobId) await BookmarkRepository.addBookmark(bm.jobId, bm.note);
  }
  for (const app of remoteApplications) {
    if (app?.jobId) await ApplicationRepository.upsert(app);
  }

  const now = Date.now();
  await saveCloudConfig({ lastSyncedAt: now });
  return { ok: true, profilesRestored, conflictsResolved, strategyUsed: strategy, syncedAt: now };
}

export async function deleteAllPrivateCloudData(): Promise<void> {
  if ((typeof __JOBFILL_CLOUD_SYNC_DISABLED__ !== 'undefined' && __JOBFILL_CLOUD_SYNC_DISABLED__) || !isCloudSyncFeatureEnabled()) {
    await signOutCloudAccount(false);
    return;
  }
  const cfg = await getCloudConfig();
  const session = getActiveCloudSession();
  if (!session || !isCloudBackendConfigured(cfg)) {
    await saveCloudConfig({ cloudSyncEnabled: false, lastSyncedAt: null });
    return;
  }

  const resp = await fetch(`${cfg.supabaseUrl}/rest/v1/user_vault_blobs`, {
    method: 'DELETE',
    headers: {
      apikey: cfg.supabaseAnonKey,
      Authorization: `Bearer ${session.accessToken}`,
    },
  });
  if (!resp.ok) {
    throw new Error(`Failed to delete cloud vault records (HTTP ${resp.status})`);
  }

  // Also purge per-user sync device metadata rows cleanly
  try {
    const devResp = await fetch(`${cfg.supabaseUrl}/rest/v1/user_sync_devices`, {
      method: 'DELETE',
      headers: {
        apikey: cfg.supabaseAnonKey,
        Authorization: `Bearer ${session.accessToken}`,
      },
    });
    if (!devResp.ok && devResp.status !== 404) {
      console.warn(`JobFill BD: user_sync_devices cleanup returned HTTP ${devResp.status}`);
    }
  } catch {
    // Non-fatal if device table is absent
  }

  await saveCloudConfig({ cloudSyncEnabled: false, lastSyncedAt: null });
  await signOutCloudAccount(false);
}
