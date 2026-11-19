import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { CredentialVaultRepository } from '../../src/credentials/credential-repository';
import {
  normalizeStrictOrigin,
  isStrictOriginMatch,
} from '../../src/credentials/origin-matcher';
import { LoginFormDetector } from '../../src/credentials/login-detector';
import {
  generateStrongPassword,
  evaluatePasswordStrength,
} from '../../src/credentials/password-generator';
import { decryptData } from '../../src/utils/crypto';
import { MessageRouter } from '../../src/background/message-router';

describe('Phase 1 — Credential Vault Security & Functional Suite', () => {
  beforeEach(async () => {
    localStorage.clear();
    await CredentialVaultRepository.resetForIsolatedUnitTest();
  });

  afterEach(async () => {
    await CredentialVaultRepository.resetForIsolatedUnitTest();
    document.body.innerHTML = '';
  });

  it('1. Encrypts credentials with AES-256-GCM, stores zero plaintext secrets, and never reuses IVs', async () => {
    await CredentialVaultRepository.initializeVault('StrongMaster#2026!', 15);
    const saved1 = await CredentialVaultRepository.saveCredential({
      portalName: 'Teletalk Alljobs',
      portalUrl: 'https://alljobs.teletalk.com.bd/login',
      username: 'rahim.applicant',
      userId: 'TL-9901',
      applicantId: 'APP-771',
      password: 'SuperSecret!Portal#Password1',
      notes: 'Keep private',
    });

    const saved2 = await CredentialVaultRepository.saveCredential({
      portalName: 'Teletalk Alljobs Copy',
      portalUrl: 'https://alljobs.teletalk.com.bd/login',
      username: 'rahim.applicant',
      userId: 'TL-9901',
      applicantId: 'APP-771',
      password: 'SuperSecret!Portal#Password1',
      notes: 'Keep private',
    });

    const rawRecords = await CredentialVaultRepository.inspectRawEncryptedRecordsForAudit();
    expect(rawRecords).toHaveLength(2);
    const serialized = JSON.stringify(rawRecords);
    expect(serialized).not.toContain('SuperSecret!Portal#Password1');
    expect(serialized).not.toContain('rahim.applicant');
    expect(serialized).not.toContain('Keep private');

    // Every record has an independent random 12-byte IV
    expect(rawRecords[0].encryptedPayload.ivHex).toHaveLength(24);
    expect(rawRecords[1].encryptedPayload.ivHex).toHaveLength(24);
    expect(rawRecords[0].encryptedPayload.ivHex).not.toBe(rawRecords[1].encryptedPayload.ivHex);
    expect(saved1.origin).toBe('https://alljobs.teletalk.com.bd');
    expect(saved2.origin).toBe('https://alljobs.teletalk.com.bd');
  });

  it('2. Locks, rejects incorrect master password, and restores access cleanly after simulated restart', async () => {
    await CredentialVaultRepository.initializeVault('VaultPass@9988', 10);
    await CredentialVaultRepository.saveCredential({
      portalName: 'BPSC Teletalk',
      portalUrl: 'https://bpsc.teletalk.com.bd',
      username: 'bpsc_user',
      password: 'Bpsc#Secret#Pass77',
    });

    // Simulate lock / browser restart clearing memory key
    CredentialVaultRepository.lockVault();
    expect(CredentialVaultRepository.isUnlocked()).toBe(false);
    await expect(CredentialVaultRepository.listDecryptedCredentials()).rejects.toThrow(/locked/i);

    // Wrong password rejected cleanly
    const wrongOk = await CredentialVaultRepository.unlockVault('WrongPassword123!');
    expect(wrongOk).toBe(false);
    expect(CredentialVaultRepository.isUnlocked()).toBe(false);

    // Correct password unlocks and decrypts
    const rightOk = await CredentialVaultRepository.unlockVault('VaultPass@9988');
    expect(rightOk).toBe(true);
    const entries = await CredentialVaultRepository.listDecryptedCredentials();
    expect(entries).toHaveLength(1);
    expect(entries[0].password).toBe('Bpsc#Secret#Pass77');
    expect(entries[0].username).toBe('bpsc_user');
  });

  it('3. Rejects tampered ciphertext, invalid IV, and invalid salt cleanly', async () => {
    await CredentialVaultRepository.initializeVault('TamperGuard#2026', 10);
    await CredentialVaultRepository.saveCredential({
      portalName: 'BB Recruitment',
      portalUrl: 'https://erecruitment.bb.org.bd',
      username: 'bb_cand',
      password: 'Bank!Password!88',
    });

    const rawRecords = await CredentialVaultRepository.inspectRawEncryptedRecordsForAudit();
    const validEnv = rawRecords[0].encryptedPayload;

    // Tampered ciphertext hex
    const tamperedCipher = {
      ...validEnv,
      ciphertextHex:
        (validEnv.ciphertextHex.startsWith('a') ? 'b' : 'a') + validEnv.ciphertextHex.slice(1),
    };
    await expect(
      decryptData(tamperedCipher, 'TamperGuard#2026')
    ).rejects.toThrow();

    // Invalid IV length
    await expect(
      decryptData({ ...validEnv, ivHex: '001122' }, 'TamperGuard#2026')
    ).rejects.toThrow();

    // Invalid short/odd salt
    await expect(
      decryptData({ ...validEnv, saltHex: '123' }, 'TamperGuard#2026')
    ).rejects.toThrow();
  });

  it('4. Enforces strict HTTPS exact-origin matching and blocks HTTP and lookalike domains', () => {
    expect(normalizeStrictOrigin('http://example.com')).toBeNull();
    expect(normalizeStrictOrigin('javascript:alert(1)')).toBeNull();
    expect(normalizeStrictOrigin('https://user:pass@example.com')).toBeNull();
    expect(normalizeStrictOrigin('https://xn--exmple-cua.com')).toBeNull();
    expect(normalizeStrictOrigin('https://example.com/login?a=1')).toBe('https://example.com');

    expect(isStrictOriginMatch('https://example.com', 'https://example.com/login').matched).toBe(true);
    expect(isStrictOriginMatch('https://example.com', 'https://fake-example.com/login').matched).toBe(false);
    expect(isStrictOriginMatch('https://example.com', 'https://sub.example.com/login').matched).toBe(false);
    expect(isStrictOriginMatch('https://example.com', 'https://example.com.evil.com/login').matched).toBe(false);
    expect(isStrictOriginMatch('https://example.com', 'http://example.com/login').matched).toBe(false);
  });

  it('5. Blocks non-explicit autofill, HTTP autofill, origin mismatch, and hidden trap login inputs', () => {
    document.body.innerHTML = `
      <form id="loginForm">
        <input type="text" id="hidden_trap" name="username" style="display:none" />
        <input type="text" id="real_user" name="userid" />
        <input type="password" id="hidden_pw" style="left:-9999px;position:absolute;" />
        <input type="password" id="real_pw" name="password" />
      </form>
    `;

    // Scans only visible inputs (skips display:none & offscreen -9999px trap)
    const scan = LoginFormDetector.scan(document);
    expect(scan.hasLoginForm).toBe(true);
    expect(scan.usernameInputSelector).toBe('#real_user');
    expect(scan.passwordInputSelector).toBe('#real_pw');

    // Rejects non-explicit autofill
    const nonExplicit = LoginFormDetector.executeExplicitFill(
      document,
      'https://portal.gov.bd/login',
      {
        expectedOrigin: 'https://portal.gov.bd',
        username: 'cand1',
        password: 'pw',
        fillMode: 'both',
        explicitUserInitiated: false,
      }
    );
    expect(nonExplicit.ok).toBe(false);
    expect((document.getElementById('real_pw') as HTMLInputElement).value).toBe('');

    // Rejects mismatched or HTTP origin
    const badOrigin = LoginFormDetector.executeExplicitFill(
      document,
      'https://fake-portal.gov.bd/login',
      {
        expectedOrigin: 'https://portal.gov.bd',
        username: 'cand1',
        password: 'pw',
        fillMode: 'both',
        explicitUserInitiated: true,
      }
    );
    expect(badOrigin.ok).toBe(false);

    // Succeeds cleanly only on explicit action + exact HTTPS origin
    const okFill = LoginFormDetector.executeExplicitFill(
      document,
      'https://portal.gov.bd/apply',
      {
        expectedOrigin: 'https://portal.gov.bd',
        username: 'cand1',
        password: 'pw',
        fillMode: 'both',
        explicitUserInitiated: true,
      }
    );
    expect(okFill.ok).toBe(true);
    expect((document.getElementById('real_user') as HTMLInputElement).value).toBe('cand1');
    expect((document.getElementById('real_pw') as HTMLInputElement).value).toBe('pw');
  });

  it('6. Supports encrypted backup/restore (confirmation gated), deletion, and strong password generation', async () => {
    await CredentialVaultRepository.initializeVault('BackupMaster#1', 10);
    const created = await CredentialVaultRepository.saveCredential({
      portalName: 'DPE Portal',
      portalUrl: 'https://dpe.teletalk.com.bd',
      username: 'dpe_applicant',
      password: generateStrongPassword({ length: 18 }),
    });

    const strength = evaluatePasswordStrength(created.password);
    expect(strength.score).toBeGreaterThanOrEqual(3);
    expect(created.password).toHaveLength(18);

    // Rejects export without explicit user confirmation
    await expect(
      CredentialVaultRepository.exportEncryptedBackup('BackupPass#2026', false)
    ).rejects.toThrow();

    const bundle = await CredentialVaultRepository.exportEncryptedBackup('BackupPass#2026', true);
    expect(JSON.stringify(bundle)).not.toContain(created.password);

    // Delete credential and verify gone
    await CredentialVaultRepository.deleteCredential(created.id);
    expect(await CredentialVaultRepository.listDecryptedCredentials()).toHaveLength(0);

    // Wrong backup passphrase rejected cleanly
    await expect(
      CredentialVaultRepository.restoreEncryptedBackup(bundle, 'WrongBackupPass')
    ).rejects.toThrow();

    // Correct backup passphrase restores cleanly
    const restoredCount = await CredentialVaultRepository.restoreEncryptedBackup(bundle, 'BackupPass#2026');
    expect(restoredCount).toBe(1);
    const restored = await CredentialVaultRepository.listDecryptedCredentials();
    expect(restored[0].password).toBe(created.password);
  });

  it('7. Verifies Supabase Cloud Sync module never references or uploads Credential Vault storage', () => {
    const syncCode = fs.readFileSync(
      path.resolve(__dirname, '../../src/cloud/encrypted-sync-service.ts'),
      'utf8'
    );
    expect(syncCode).not.toContain('credential_vault');
    expect(syncCode).not.toContain('CredentialVaultRepository');
    expect(syncCode).not.toContain('jobfill_credential_vault');
  });

  it('8. Supports user-approved login capture (strictly HTTPS & explicit) and trusted IPC unlock/lock sync', async () => {
    document.body.innerHTML = `
      <form>
        <input id="login_user" name="username" type="text" value="applicant_capture_99" />
        <input id="login_pw" name="password" type="password" value="CapturedSecret#2026" />
      </form>
    `;

    // Rejects implicit capture without explicit user trigger & rejects HTTP
    expect(LoginFormDetector.readExplicitCaptureCandidate(document, 'https://bpsc.teletalk.com.bd', false).ok).toBe(false);
    expect(LoginFormDetector.readExplicitCaptureCandidate(document, 'http://bpsc.teletalk.com.bd', true).ok).toBe(false);

    const cap = LoginFormDetector.readExplicitCaptureCandidate(document, 'https://bpsc.teletalk.com.bd/apply', true);
    expect(cap.ok).toBe(true);
    expect(cap.origin).toBe('https://bpsc.teletalk.com.bd');
    expect(cap.username).toBe('applicant_capture_99');
    expect(cap.password).toBe('CapturedSecret#2026');

    await CredentialVaultRepository.initializeVault('SyncMaster#2026', 10);
    CredentialVaultRepository.lockVault();
    expect(CredentialVaultRepository.isUnlocked()).toBe(false);

    // Untrusted web page sender blocked from unlocking vault
    const deniedUnlock: any = await new Promise((resolve) => {
      MessageRouter.handleMessage(
        { action: 'CRED_VAULT_UNLOCK', payload: { masterPassword: 'SyncMaster#2026' } },
        { tab: { id: 42, url: 'https://evil-tab.example.com' } as any },
        resolve
      );
    });
    expect(deniedUnlock.status).toBe('denied');
    expect(CredentialVaultRepository.isUnlocked()).toBe(false);

    // Trusted extension Popup/Dashboard sender unlocks cleanly
    const okUnlock: any = await new Promise((resolve) => {
      MessageRouter.handleMessage(
        { action: 'CRED_VAULT_UNLOCK', payload: { masterPassword: 'SyncMaster#2026' } },
        { url: 'chrome-extension://test-ext-id/popup.html' } as any,
        resolve
      );
    });
    expect(okUnlock.status).toBe('ok');
    expect(CredentialVaultRepository.isUnlocked()).toBe(true);

    // Trusted lock sync clears session immediately
    const okLock: any = await new Promise((resolve) => {
      MessageRouter.handleMessage(
        { action: 'CRED_VAULT_LOCK' },
        { url: 'chrome-extension://test-ext-id/dashboard.html' } as any,
        resolve
      );
    });
    expect(okLock.status).toBe('ok');
    expect(CredentialVaultRepository.isUnlocked()).toBe(false);
  });
});
