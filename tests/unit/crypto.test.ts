import { describe, it, expect } from 'vitest';
import { encryptData, decryptData, hashPassword } from '../../src/utils/crypto';

describe('Web Crypto Engine', () => {
  const secretKey = 'SecurePetroPassword#2026!';
  const samplePayload = JSON.stringify({
    applicantName: 'MD. MAHFUZUR RAHMAN',
    nid: '19981234567890123',
    secretToken: 'GOVT_JOB_APPLICATION_KEY_BD',
  });

  it('generates consistent SHA-256 password hashes with salt', async () => {
    // 32-character hex salt for testing
    const testSalt = '0123456789abcdef0123456789abcdef';
    const hash1 = await hashPassword('TestPass', testSalt);
    const hash2 = await hashPassword('TestPass', testSalt);
    const hash3 = await hashPassword('OtherPass', testSalt);

    expect(hash1.hashHex).toBe(hash2.hashHex);
    expect(hash1.hashHex).not.toBe(hash3.hashHex);
  });

  it('encrypts and decrypts payload correctly using AES-256-GCM and PBKDF2', async () => {
    const encrypted = await encryptData(samplePayload, secretKey);

    expect(encrypted.ciphertextHex).toBeTruthy();
    expect(encrypted.ivHex).toBeTruthy();
    expect(encrypted.saltHex).toBeTruthy();
    expect(encrypted.iterations).toBe(100000);

    const decryptedStr = await decryptData(encrypted, secretKey);
    const decrypted = JSON.parse(decryptedStr);
    const original = JSON.parse(samplePayload);

    expect(decrypted.applicantName).toBe(original.applicantName);
    expect(decrypted.nid).toBe(original.nid);
    expect(decrypted.secretToken).toBe(original.secretToken);
  });

  it('fails decryption cleanly when given an incorrect password', async () => {
    const encrypted = await encryptData(samplePayload, secretKey);

    await expect(decryptData(encrypted, 'WrongPassword123')).rejects.toThrow();
  });
});
