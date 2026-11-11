// JobFill BD - Full System Audit Regression Test Suite (Phase 13)
// Covers all newly discovered bugs: corrupted backup rejection, multi-profile isolation,
// full purge clearing all stores, SmartAutoFillPage non-fake scan behavior,
// notification permission denied handling, and Vault Lock session isolation.

import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  importProfileData,
  exportProfileData,
  purgeAllData,
  saveActiveProfile,
  setActiveProfileId,
  getActiveProfile,
  enableVaultEncryption,
  lockVault,
  unlockVault,
} from '../../src/services/storage';
import { createEmptyProfile } from '../../src/types/defaults';
import { JobRepository } from '../../src/jobs/database/job-repository';
import { BookmarkRepository } from '../../src/jobs/database/bookmark-repository';
import { ApplicationRepository } from '../../src/jobs/database/application-repository';
import { JobNotificationRepository } from '../../src/jobs/database/notification-repository';
import { normalizeJobRecord } from '../../src/jobs/services/job-normalizer';
import { NotificationManager } from '../../src/jobs/notifications/notification-manager';
import { AppProvider } from '../../src/dashboard/context/AppContext';
import { SmartAutoFillPage } from '../../src/dashboard/pages/SmartAutoFillPage';
import { MessageRouter } from '../../src/background/message-router';

describe('JobFill BD - System Audit Regression Tests', () => {
  beforeEach(async () => {
    localStorage.clear();
    lockVault();
    await purgeAllData();
  });

  afterEach(() => {
    delete (globalThis as any).chrome;
  });

  it('rejects corrupted JSON and malformed profile arrays on backup import', async () => {
    await expect(importProfileData('{not valid json')).rejects.toThrow('Invalid JSON format');
    await expect(importProfileData(JSON.stringify({ appName: 'JobFill BD', profiles: [{ broken: true }] }))).rejects.toThrow(
      'Corrupted or invalid profile schema'
    );
    await expect(importProfileData(JSON.stringify({ profiles: [] }))).rejects.toThrow('No valid profiles found');

    // Valid encrypted export -> wrong password rejected -> right password succeeds
    const p = createEmptyProfile('Valid Backup User');
    p.id = 'prof_backup_valid';
    p.personal.applicantNameEn = 'BACKUP TESTER';
    await saveActiveProfile(p);
    const encJson = await exportProfileData(true, 'SecretPass99');
    await expect(importProfileData(encJson, 'WrongPass')).rejects.toThrow();
    const count = await importProfileData(encJson, 'SecretPass99');
    expect(count).toBeGreaterThan(0);
  });

  it('maintains strict multi-profile isolation and clears all Job Hub stores on purgeAllData', async () => {
    const p1 = createEmptyProfile('Applicant One');
    p1.id = 'iso_p1';
    p1.personal.applicantNameEn = 'APPLICANT ONE';
    p1.personal.nid = '1111222233';

    const p2 = createEmptyProfile('Applicant Two');
    p2.id = 'iso_p2';
    p2.personal.applicantNameEn = 'APPLICANT TWO';
    p2.personal.nid = '9999888877';

    await saveActiveProfile(p1);
    await saveActiveProfile(p2);

    await setActiveProfileId('iso_p1');
    expect((await getActiveProfile()).personal.nid).toBe('1111222233');

    await setActiveProfileId('iso_p2');
    expect((await getActiveProfile()).personal.nid).toBe('9999888877');

    // Add Job Hub items and verify purge clears everything
    const job = normalizeJobRecord(
      { externalId: 'purge_1', organization: 'Org', jobTitle: 'Officer', applicationUrl: 'https://bpsc.gov.bd/' },
      { sourceId: 'manual', sourceName: 'Manual', verificationLevel: 'user_submitted', defaultApplicationUrl: 'https://bpsc.gov.bd/' }
    );
    await JobRepository.saveJob(job);
    await BookmarkRepository.addBookmark(job.id);
    await ApplicationRepository.setStatus(job, 'Applied');
    await NotificationManager.dispatch({ type: 'new_job', title: 'Test', message: 'Body', jobId: job.id });

    await purgeAllData();

    expect(await JobRepository.getAllJobs()).toEqual([]);
    expect(await BookmarkRepository.getAll()).toEqual([]);
    expect(await ApplicationRepository.getAll()).toEqual([]);
    expect(await JobNotificationRepository.getAll()).toEqual([]);
  });

  it('GET_ACTIVE_PROFILE_STATE blocks locked vault access and unlocks cleanly when session unlocked', async () => {
    const p = createEmptyProfile('Vault Guarded');
    p.id = 'vault_p1';
    p.personal.applicantNameEn = 'VAULT PROTECTED USER';
    await saveActiveProfile(p);
    await setActiveProfileId('vault_p1');

    await enableVaultEncryption('AuditVault#2026');
    lockVault();

    const lockedResp = await new Promise<any>((resolve) => {
      MessageRouter.handleMessage(
        { action: 'GET_ACTIVE_PROFILE_STATE' },
        { tab: { url: 'https://bogmc.teletalk.com.bd/' } as any },
        resolve
      );
    });
    expect(lockedResp.status).toBe('locked');
    expect(lockedResp.activeProfile).toBeNull();

    expect(await unlockVault('AuditVault#2026')).toBe(true);
    const unlockedResp = await new Promise<any>((resolve) => {
      MessageRouter.handleMessage(
        { action: 'GET_ACTIVE_PROFILE_STATE' },
        { tab: { url: 'https://bogmc.teletalk.com.bd/' } as any },
        resolve
      );
    });
    expect(unlockedResp.status).toBe('ok');
    expect(unlockedResp.activeProfile.personal.applicantNameEn).toBe('VAULT PROTECTED USER');
  });

  it('NotificationManager handles Chrome notification permission denied without crashing and logs in-app', async () => {
    (globalThis as any).chrome = {
      runtime: {
        getURL: (p: string) => `chrome-extension://test/${p}`,
        lastError: { message: 'Notifications permission denied by user' },
      },
      notifications: {
        create: (_id: string, _opts: any, cb: (id: string) => void) => cb(''),
      },
    };

    const rec = await NotificationManager.dispatch({
      type: 'urgent_deadline',
      title: 'URGENT Test',
      message: 'Deadline closing soon',
      jobId: 'perm_test_1',
      isUrgent: true,
    });

    expect(rec.id).toBeTruthy();
    const stored = await JobNotificationRepository.getAll();
    expect(stored.length).toBe(1);
    expect(stored[0].title).toBe('URGENT Test');
  });

  it('SmartAutoFillPage does not render fake hardcoded fields when no active recruitment tab exists', async () => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.setItem('jobfill_language', 'en');
    const div = document.createElement('div');
    document.body.appendChild(div);
    const root: Root = createRoot(div);

    await act(async () => {
      root.render(
        <AppProvider>
          <SmartAutoFillPage />
        </AppProvider>
      );
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });

    const scanBtn = Array.from(div.querySelectorAll('button')).find((b) => b.textContent?.includes('Scan Open Tab'));
    expect(scanBtn).toBeDefined();

    await act(async () => {
      scanBtn!.click();
      await new Promise((r) => setTimeout(r, 30));
    });

    // Must honestly report no active recruitment tab instead of fake 10 fields
    expect(div.textContent).toContain('No active recruitment web tab found');
    expect(div.textContent).not.toContain('Fields Detected');

    await act(async () => {
      root.unmount();
    });
    div.remove();
  });
});
