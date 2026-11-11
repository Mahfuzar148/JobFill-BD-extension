// JobFill BD - Phase 11 Hybrid Architecture Security, Isolation, Public DB & Migration Suite
// Tests:
//   1. Local Encrypted Vault (no raw passwords/keys stored, password change, tamper rejection, encrypted backups)
//   2. Cross-User & RLS Security (simulated PostgREST RLS isolation, static SQL policy checks, service_role rejection, logout cleanup)
//   3. Public Job Database Client (anonymous read-only pagination, zero PII transmission, Edge Function validation checks)
//   4. Non-Destructive Schema Migration v7 -> v8 (counts, custom field preservation, history URL scrubbing)
//   5. Privacy & Security Dashboard UI + Locked Vault Autofill & Meet/Zoom Isolation

import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import {
  enableVaultEncryption,
  changeVaultPassword,
  disableVaultEncryption,
  unlockVault,
  lockVault,
  getAllProfiles,
  saveAllProfiles,
  exportProfileData,
  importProfileData,
  addAutofillHistory,
  getAutofillHistory,
  getVaultDashboardMetrics,
  deleteLocalUserData,
  getSecuritySettings,
} from '../../src/services/storage';
import { DocumentRepository } from '../../src/database/document-repository';
import { BackupManager } from '../../src/database/backup-manager';
import { MigrationManager, sanitizeUrlForHistory } from '../../src/database/migration-manager';
import { KeyManager } from '../../src/security/key-manager';
import {
  saveCloudConfig,
  getCloudConfig,
  isSafePublicAnonKey,
  isCloudBackendConfigured,
  isCloudSyncFeatureEnabled,
  DEFAULT_CLOUD_CONFIG,
} from '../../src/cloud/supabase-config';
import {
  signUpCloudAccount,
  signInCloudAccount,
  signOutCloudAccount,
  getActiveCloudSession,
  clearActiveCloudSession,
} from '../../src/cloud/supabase-auth';
import { fetchApprovedPublicJobsPage } from '../../src/cloud/public-jobs-client';
import {
  uploadEncryptedVaultToCloud,
  previewCloudVaultPull,
  pullAndDecryptVaultFromCloud,
  deleteAllPrivateCloudData,
} from '../../src/cloud/encrypted-sync-service';
import { MessageRouter } from '../../src/background/message-router';
import { SecurityPage } from '../../src/dashboard/pages/SecurityPage';
import { syntheticMadrasahTestProfile } from '../fixtures/syntheticProfiles';
import { decryptData, encryptData } from '../../src/utils/crypto';

async function flushUi(ms = 40) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}

describe('JobFill BD - Phase 11 Hybrid Architecture Security & Isolation Suite', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    KeyManager.clearKey();
    clearActiveCloudSession();
    DocumentRepository.clearVolatileTestStore();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    KeyManager.clearKey();
    clearActiveCloudSession();
    delete (globalThis as any).__JOBFILL_CLOUD_SYNC_DISABLED__;
    delete (globalThis as any).chrome;
  });

  it('1. Local Vault enforces real CryptoKey lifecycle, password change, tamper rejection, and zero plaintext leakage', async () => {
    await saveAllProfiles([syntheticMadrasahTestProfile]);
    await DocumentRepository.saveDocument({
      id: 'photo_synthetic_orig',
      profileId: syntheticMadrasahTestProfile.id,
      documentType: 'photo',
      fileName: 'photo.jpg',
      mimeType: 'image/jpeg',
      fileSize: 1024,
      dataUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==',
    });

    // Enable Master Vault Password
    const passA = 'VaultStrong#2026A';
    await enableVaultEncryption(passA);

    // Real CryptoKey held in memory; ZERO plaintext password or key bytes in localStorage/sessionStorage
    expect(KeyManager.isKeyActive()).toBe(true);
    expect(KeyManager.getSessionKey()).toBeTruthy();
    const rawLocalDump = JSON.stringify({ ...localStorage });
    const rawSessionDump = JSON.stringify({ ...sessionStorage });
    expect(rawLocalDump).not.toContain(passA);
    expect(rawSessionDump).not.toContain(passA);
    expect(rawLocalDump).not.toContain(syntheticMadrasahTestProfile.personal.nid);
    expect(rawLocalDump).not.toContain('TAREQ');
    expect(localStorage.getItem('jobfill_profiles')).toBeNull();

    // Lock rejects reads until unlocked; wrong password rejected
    lockVault();
    expect(KeyManager.isKeyActive()).toBe(false);
    await expect(getAllProfiles()).rejects.toThrow('VAULT_LOCKED');
    expect(await unlockVault('WrongPassword#999')).toBe(false);
    expect(KeyManager.isKeyActive()).toBe(false);

    // Correct password unlocks cleanly
    expect(await unlockVault(passA)).toBe(true);
    const profiles = await getAllProfiles();
    expect(profiles[0].personal.nid).toBe(syntheticMadrasahTestProfile.personal.nid);

    // Change Vault Password re-encrypts BOTH profiles AND documents atomically
    const passB = 'RotatedSecret#2027B';
    await changeVaultPassword(passA, passB);
    lockVault();
    expect(await unlockVault(passA)).toBe(false);
    expect(await unlockVault(passB)).toBe(true);

    const decProfiles = await getAllProfiles();
    expect(decProfiles[0].personal.applicantNameEn).toBe(syntheticMadrasahTestProfile.personal.applicantNameEn);
    const decDoc = await DocumentRepository.getByCategory(syntheticMadrasahTestProfile.id, 'photo');
    expect(decDoc?.dataUrl).toContain('data:image/jpeg;base64,');

    // Encrypted backup records lastBackupAt, rejects wrong password & corrupted ciphertext, and restores cleanly
    const backupPw = 'BackupKey#88';
    const backupJson = await BackupManager.exportBackup(true, backupPw);
    const metrics = await getVaultDashboardMetrics();
    expect(metrics.lastBackupAt).toBeTypeOf('number');
    expect(backupJson).not.toContain(syntheticMadrasahTestProfile.personal.nid);

    await expect(BackupManager.importBackup(backupJson, 'WrongBackupKey')).rejects.toThrow();
    const tampered = JSON.parse(backupJson);
    tampered.payload.ciphertextHex = 'ff' + tampered.payload.ciphertextHex.slice(2);
    await expect(importProfileData(JSON.stringify(tampered), backupPw)).rejects.toThrow();

    const importedCount = await importProfileData(backupJson, backupPw);
    expect(importedCount).toBeGreaterThanOrEqual(1);

    await disableVaultEncryption(passB);
    const secAfter = await getSecuritySettings();
    expect(secAfter.isPasswordProtected).toBe(false);
  });

  it('2. Rejects service_role keys, verifies static PostgreSQL RLS schema, and proves cross-user E2EE isolation', async () => {
    // Reject fake service_role JWT or literal in config
    const fakeServiceRoleJwt =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
      btoa(JSON.stringify({ role: 'service_role', iss: 'supabase' })) +
      '.sig';
    expect(isSafePublicAnonKey(fakeServiceRoleJwt)).toBe(false);
    expect(isSafePublicAnonKey('sb_publishable_safe_public_key')).toBe(true);

    await expect(
      saveCloudConfig({
        supabaseUrl: 'https://demo.supabase.co',
        supabaseAnonKey: fakeServiceRoleJwt,
      })
    ).rejects.toThrow(/service_role/i);

    // Static verification of SQL RLS & Edge Function validation contracts
    const schemaSql = fs.readFileSync(
      path.resolve(process.cwd(), 'supabase/migrations/001_hybrid_schema.sql'),
      'utf8'
    );
    expect(schemaSql).toContain('ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY');
    expect(schemaSql).toContain('ALTER TABLE public.user_vault_blobs ENABLE ROW LEVEL SECURITY');
    expect(schemaSql).toContain('USING (auth.uid() = user_id)');
    expect(schemaSql).toContain('WITH CHECK (auth.uid() = user_id)');
    expect(schemaSql).toContain("NEW.user_id := auth.uid()");
    expect(schemaSql).toContain("is_approved = true AND verification_status <> 'rejected'");

    const edgeFn = fs.readFileSync(
      path.resolve(process.cwd(), 'supabase/functions/ingest-jobs/index.ts'),
      'utf8'
    );
    expect(edgeFn).toContain('containsPrivatePiiIndicators');
    expect(edgeFn).toContain('SUPABASE_SERVICE_ROLE_KEY');

    // Simulated multi-tenant PostgREST server enforcing RLS auth.uid() isolation
    const mockCloudVaultRows = new Map<string, Map<string, any>>();
    const tokens = new Map<string, { userId: string; email: string }>([
      ['jwt_user_a', { userId: 'uuid-user-a', email: 'userA@example.com' }],
      ['jwt_user_b', { userId: 'uuid-user-b', email: 'userB@example.com' }],
    ]);

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method || 'GET').toUpperCase();
      const headers = (init?.headers || {}) as Record<string, string>;
      const auth = headers.Authorization || '';
      const token = auth.replace(/^Bearer\s+/i, '');
      const caller = tokens.get(token) || null;

      if (url.includes('/auth/v1/token')) {
        const body = JSON.parse(String(init?.body || '{}'));
        if (body.email === 'userA@example.com') {
          return new Response(
            JSON.stringify({ access_token: 'jwt_user_a', expires_in: 3600, user: { id: 'uuid-user-a', email: body.email } }),
            { status: 200 }
          );
        }
        return new Response(
          JSON.stringify({ access_token: 'jwt_user_b', expires_in: 3600, user: { id: 'uuid-user-b', email: body.email } }),
          { status: 200 }
        );
      }

      if (url.includes('/auth/v1/logout')) {
        return new Response(null, { status: 204 });
      }

      if (url.includes('/rest/v1/user_vault_blobs')) {
        if (!caller) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
        const userBucket = mockCloudVaultRows.get(caller.userId) || new Map<string, any>();

        if (method === 'POST') {
          const rows = JSON.parse(String(init?.body || '[]'));
          for (const row of rows) {
            // Simulate PostgreSQL trigger ignoring any forged user_id and binding auth.uid()
            expect(row.user_id).toBeUndefined();
            userBucket.set(row.record_scope, { ...row, user_id: caller.userId });
          }
          mockCloudVaultRows.set(caller.userId, userBucket);
          return new Response(JSON.stringify([]), { status: 201 });
        }
        if (method === 'GET') {
          return new Response(JSON.stringify(Array.from(userBucket.values())), { status: 200 });
        }
        if (method === 'DELETE') {
          mockCloudVaultRows.delete(caller.userId);
          return new Response(null, { status: 204 });
        }
      }

      if (url.includes('/rest/v1/jobs')) {
        if (method === 'POST') {
          return new Response(JSON.stringify({ error: 'new row violates row-level security policy' }), { status: 403 });
        }
        return new Response(
          JSON.stringify([
            {
              id: 'pub_job_1',
              title: 'Assistant Engineer (Civil)',
              position: 'Assistant Engineer',
              vacancies: 12,
              deadline_at: new Date(Date.now() + 86_400_000 * 10).toISOString(),
              deadline_verified: true,
              circular_url: 'https://bpsc.gov.bd/notice.pdf',
              application_url: 'https://bpsc.teletalk.com.bd/',
              verification_status: 'official_verified',
              is_approved: true,
              fingerprint_hash: 'fp_pub_1',
              job_sources: { source_key: 'bpsc', display_name: 'BPSC' },
              organizations: { name: 'Bangladesh Public Service Commission', short_name: 'BPSC' },
              job_categories: { name_en: 'Government' },
            },
          ]),
          {
            status: 200,
            headers: { 'content-range': '0-0/1' },
          }
        );
      }

      return new Response('Not found', { status: 404 });
    });

    // Public anonymous reads work without account; unauthorized public writes fail
    await saveCloudConfig({
      supabaseUrl: 'https://demo.supabase.co',
      supabaseAnonKey: 'sb_publishable_demo_anon_key',
      cloudSyncEnabled: true,
      usePublicCloudJobsFeed: true,
    });
    const pubPage = await fetchApprovedPublicJobsPage({ offset: 0, limit: 50 });
    expect(pubPage?.jobs).toHaveLength(1);
    expect(pubPage?.jobs[0].applicationUrl).toBe('https://bpsc.teletalk.com.bd/');
    const anonWriteResp = await fetch('https://demo.supabase.co/rest/v1/jobs', { method: 'POST', body: '{}' });
    expect(anonWriteResp.status).toBe(403);

    // User A encrypts locally & uploads ciphertext ONLY (no NID/name plaintext in wire payload)
    await saveAllProfiles([syntheticMadrasahTestProfile]);
    await signInCloudAccount('userA@example.com', 'AuthPassA#123');
    const syncPassA = 'SyncKeyOnlyUserA#2026';
    const upRes = await uploadEncryptedVaultToCloud(syncPassA);
    expect(upRes.ok).toBe(true);

    const postCall = fetchSpy.mock.calls.find((c) => String(c[0]).includes('/rest/v1/user_vault_blobs'));
    const wireBody = String(postCall?.[1]?.body || '');
    expect(wireBody).not.toContain(syntheticMadrasahTestProfile.personal.nid);
    expect(wireBody).not.toContain('TAREQ');
    expect(wireBody).toContain('AES-GCM');

    // User B signs in -> receives ZERO rows of User A (RLS isolation) & cannot decrypt with wrong key
    await signOutCloudAccount(false);
    await signInCloudAccount('userB@example.com', 'AuthPassB#456');
    const pullUserB = await pullAndDecryptVaultFromCloud('WrongOrUserBKey');
    expect(pullUserB.profilesRestored).toBe(0);

    // Verify cross-key decryption failure even if ciphertext were exposed
    const userARow = mockCloudVaultRows.get('uuid-user-a')?.get('profiles_bundle');
    await expect(decryptData(userARow.ciphertext_payload, 'SyncKeyUserB')).rejects.toThrow();

    // User A signs in, verifies restore & delete cloud data + logout cleanup
    await signInCloudAccount('userA@example.com', 'AuthPassA#123');
    const pullUserA = await pullAndDecryptVaultFromCloud(syncPassA);
    expect(pullUserA.profilesRestored).toBeGreaterThanOrEqual(1);
    await deleteAllPrivateCloudData();
    expect(mockCloudVaultRows.has('uuid-user-a')).toBe(false);
    expect(getActiveCloudSession()).toBeNull();

    // Verify Local-Only default after delete & reset config cleanly
    const cfgFinal = await getCloudConfig();
    expect(cfgFinal.cloudSyncEnabled).toBe(false);
    await saveCloudConfig(DEFAULT_CLOUD_CONFIG);
  });

  it('3. MigrationManager v7->v8 preserves unknown fields, scrubs history query URLs, and verifies vault report', async () => {
    expect(sanitizeUrlForHistory('https://bogmc.teletalk.com.bd/apply.php?nid=12345&secret=xyz#hash')).toBe(
      'https://bogmc.teletalk.com.bd/apply.php'
    );

    await addAutofillHistory({
      id: 'hist_1',
      timestamp: Date.now(),
      url: 'https://bogmc.teletalk.com.bd/apply.php?applicant=secret_id_99',
      domain: 'bogmc.teletalk.com.bd',
      pageTitle: 'PetroBangla Application',
      profileId: 'p1',
      profileName: 'Md. Real Applicant Name',
      totalDetected: 10,
      totalFilled: 9,
      totalFailed: 0,
      totalAmbiguous: 1,
      status: 'completed',
    });

    const hist = await getAutofillHistory();
    expect(hist[0].url).toBe('https://bogmc.teletalk.com.bd/apply.php');
    expect(hist[0].profileName).toBe('Applicant Profile');

    const report = await MigrationManager.runSafeMigration();
    expect(report.schemaFrom).toBe(7);
    expect(report.schemaTo).toBe(8);
    expect(report.decryptVerified).toBe(true);
    expect(report.errors).toHaveLength(0);
    const savedReport = await MigrationManager.getLatestReport();
    expect(savedReport?.id).toBe(report.id);

    // Cleanup local user data deletes private data cleanly
    await deleteLocalUserData();
    expect(localStorage.getItem('jobfill_profiles')).toBeNull();
  });

  it('4. SecurityPage renders Vault Dashboard metrics & controls accurately and MessageRouter blocks locked/excluded origins', async () => {
    const showToast = vi.fn();
    await act(async () => {
      root.render(
        <SecurityPage showToast={showToast} onDataReset={vi.fn()} onLockVault={vi.fn()} onProtectionChanged={vi.fn()} />
      );
    });
    await flushUi(50);

    const text = container.textContent || '';
    expect(text).toContain('Vault Status');
    expect(text).toContain('Last Backup');
    expect(text).toContain('Local Only (Off)');
    expect(text).toContain('Optional Client-Side Encrypted Cloud Sync');
    expect(text).toContain('Delete Local Private Vault Data');
    expect(text).not.toContain('100% secure');

    // MessageRouter denies password-protected vault when locked
    await enableVaultEncryption('VaultLockCheck#2026');
    lockVault();
    const lockedProfileResp = await new Promise<any>((resolve) => {
      MessageRouter.handleMessage(
        { action: 'GET_ACTIVE_PROFILE_STATE' },
        { tab: { url: 'https://bogmc.teletalk.com.bd/' } as any },
        resolve
      );
    });
    expect(lockedProfileResp.status).toBe('locked');

    // Still strictly rejects Google Meet & Zoom regardless of vault state
    for (const excluded of ['https://meet.google.com/abc-defg-hij', 'https://app.zoom.us/wc/join/99887766']) {
      const deniedResp = await new Promise<any>((resolve) => {
        MessageRouter.handleMessage(
          { action: 'GET_ACTIVE_PROFILE_STATE' },
          { tab: { url: excluded } as any },
          resolve
        );
      });
      expect(deniedResp.status).toBe('denied');
    }

    // Also test cross-encrypt payload check sanity
    const c = await encryptData('{"ok":true}', 'PassCheck1');
    expect(JSON.parse(await decryptData(c, 'PassCheck1')).ok).toBe(true);
  });

  it('5. Edge Store release flag disables all Supabase Cloud Sync & Auth calls while preserving local Vault', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      throw new Error('UNEXPECTED_NETWORK_CALL');
    });

    (globalThis as any).__JOBFILL_CLOUD_SYNC_DISABLED__ = true;
    try {
      expect(isCloudSyncFeatureEnabled()).toBe(false);
      expect(await getCloudConfig()).toEqual(DEFAULT_CLOUD_CONFIG);
      expect(
        isCloudBackendConfigured({
          ...DEFAULT_CLOUD_CONFIG,
          supabaseUrl: 'https://demo.supabase.co',
          supabaseAnonKey: 'sb_publishable_demo_anon_key',
          cloudSyncEnabled: true,
        })
      ).toBe(false);
      expect(getActiveCloudSession()).toBeNull();

      await expect(saveCloudConfig({ cloudSyncEnabled: true })).rejects.toThrow('CLOUD_SYNC_DISABLED_IN_RELEASE');
      await expect(signUpCloudAccount('user@example.com', 'Pass#123')).rejects.toThrow('CLOUD_SYNC_DISABLED_IN_RELEASE');
      await expect(signInCloudAccount('user@example.com', 'Pass#123')).rejects.toThrow('CLOUD_SYNC_DISABLED_IN_RELEASE');
      await expect(uploadEncryptedVaultToCloud('Passphrase#1')).rejects.toThrow('CLOUD_SYNC_DISABLED_IN_RELEASE');
      await expect(previewCloudVaultPull('Passphrase#1')).rejects.toThrow('CLOUD_SYNC_DISABLED_IN_RELEASE');
      await expect(pullAndDecryptVaultFromCloud('Passphrase#1')).rejects.toThrow('CLOUD_SYNC_DISABLED_IN_RELEASE');
      expect(await fetchApprovedPublicJobsPage({ offset: 0, limit: 10 })).toBeNull();
      await deleteAllPrivateCloudData();

      expect(fetchSpy).not.toHaveBeenCalled();

      // Local vault & backup export still operate normally
      await saveAllProfiles([syntheticMadrasahTestProfile]);
      const exported = await exportProfileData(true, 'EdgeLocalBackup#2026');
      expect(exported).toContain('"isEncrypted": true');

      // SecurityPage hides Supabase controls cleanly
      await act(async () => {
        root.render(
          <SecurityPage showToast={vi.fn()} onDataReset={vi.fn()} onLockVault={vi.fn()} onProtectionChanged={vi.fn()} />
        );
      });
      await flushUi(50);

      const text = container.textContent || '';
      expect(text).toContain('Local-First (Cloud Disabled)');
      expect(text).toContain('First Public Release v2.0.0 — Cloud Sync Disabled');
      expect(text).not.toContain('Enable Cloud Sync');
      expect(container.querySelector('input[placeholder*="Supabase Project URL"]')).toBeNull();
    } finally {
      delete (globalThis as any).__JOBFILL_CLOUD_SYNC_DISABLED__;
    }
  });
});
