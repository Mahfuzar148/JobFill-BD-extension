import { describe, it, expect, beforeEach } from 'vitest';
import { VaultManager } from '../../src/security/vault-manager';
import { KeyManager } from '../../src/security/key-manager';
import { SessionManager } from '../../src/security/session-manager';
import { PrivacyController } from '../../src/security/privacy-controller';

describe('Phase 4: Security Suite & Vault Lifecycle', () => {
  beforeEach(() => {
    localStorage.clear();
    KeyManager.clearKey();
  });

  it('sets master password, unlocks vault, and enforces lock on wrong password', async () => {
    await VaultManager.setPassword('MasterSecretPass123', 15);
    expect(VaultManager.isLocked()).toBe(false);

    // Lock vault
    VaultManager.lock();
    expect(VaultManager.isLocked()).toBe(true);

    // Attempt wrong password
    const wrongOk = await VaultManager.unlock('WrongPassword');
    expect(wrongOk).toBe(false);
    expect(VaultManager.isLocked()).toBe(true);

    // Correct password unlocks
    const correctOk = await VaultManager.unlock('MasterSecretPass123');
    expect(correctOk).toBe(true);
    expect(VaultManager.isLocked()).toBe(false);
  });

  it('masks sensitive personal credentials for user preview screens', () => {
    const maskedNid = PrivacyController.maskSensitiveValue('19901234567890123', 'nid');
    expect(maskedNid).toBe('1990*****123');

    const maskedPhone = PrivacyController.maskSensitiveValue('01711223344', 'mobile');
    expect(maskedPhone).toBe('017*****344');

    const maskedEmail = PrivacyController.maskSensitiveValue('applicant@example.com', 'email');
    expect(maskedEmail).toBe('ap***@example.com');
  });

  it('filters least privilege payload to include only approved items', () => {
    const items: any[] = [
      { id: '1', isApproved: true, proposedValue: 'Dhaka' },
      { id: '2', isApproved: false, proposedValue: 'Rajshahi' },
      { id: '3', isApproved: true, proposedValue: '   ' },
    ];
    const filtered = PrivacyController.prepareLeastPrivilegePayload(items);
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe('1');
  });
});
