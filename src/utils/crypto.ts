// JobFill BD - Web Crypto API Local Encryption Layer
// Uses PBKDF2 (100,000 iterations, SHA-256) + AES-256-GCM with 12-byte random IV.
// Never transmits keys or data externally.

const PBKDF2_ITERATIONS = 100000;
const KEY_LENGTH_BITS = 256;

export interface EncryptedPayload {
  version: '1.0';
  algorithm: 'AES-GCM';
  iterations: number;
  saltHex: string;
  ivHex: string;
  ciphertextHex: string;
}

export interface NativeKeyEncryptedPayload {
  version: '2.0';
  algorithm: 'AES-GCM';
  ivHex: string;
  ciphertextHex: string;
}

export async function generateNonExtractableAesKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: KEY_LENGTH_BITS,
    },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptWithCryptoKey(
  plaintext: string,
  key: CryptoKey
): Promise<NativeKeyEncryptedPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encodedPlaintext = new TextEncoder().encode(plaintext);
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as any },
    key,
    encodedPlaintext
  );
  return {
    version: '2.0',
    algorithm: 'AES-GCM',
    ivHex: bytesToHex(iv),
    ciphertextHex: bytesToHex(new Uint8Array(ciphertextBuffer)),
  };
}

export async function decryptWithCryptoKey(
  payload: NativeKeyEncryptedPayload,
  key: CryptoKey
): Promise<string> {
  if (!payload || payload.algorithm !== 'AES-GCM' || !payload.ivHex || !payload.ciphertextHex) {
    throw new Error('Invalid or corrupted encrypted payload.');
  }
  const iv = hexToBytes(payload.ivHex);
  const ciphertext = hexToBytes(payload.ciphertextHex);
  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as any },
    key,
    ciphertext as any
  );
  return new TextDecoder().decode(decryptedBuffer);
}

export function generateSaltHex(byteLength = 16): string {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(byteLength)));
}

export async function deriveMasterVaultCryptoKey(
  password: string,
  saltHex: string
): Promise<CryptoKey> {
  const salt = hexToBytes(saltHex);
  return deriveKey(password, salt);
}

export async function encryptDataWithKey(
  plaintext: string,
  key: CryptoKey,
  saltHex: string
): Promise<EncryptedPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encodedPlaintext = new TextEncoder().encode(plaintext);
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as any },
    key,
    encodedPlaintext
  );
  return {
    version: '1.0',
    algorithm: 'AES-GCM',
    iterations: PBKDF2_ITERATIONS,
    saltHex,
    ivHex: bytesToHex(iv),
    ciphertextHex: bytesToHex(new Uint8Array(ciphertextBuffer)),
  };
}

export async function decryptDataWithKey(
  payload: EncryptedPayload,
  key: CryptoKey
): Promise<string> {
  if (
    !payload ||
    payload.algorithm !== 'AES-GCM' ||
    typeof payload.ivHex !== 'string' ||
    payload.ivHex.length !== 24 ||
    typeof payload.ciphertextHex !== 'string' ||
    payload.ciphertextHex.length < 2
  ) {
    throw new Error('Corrupted or invalid encrypted vault payload.');
  }
  const iv = hexToBytes(payload.ivHex);
  const ciphertext = hexToBytes(payload.ciphertextHex);
  try {
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as any },
      key,
      ciphertext as any
    );
    return new TextDecoder().decode(decryptedBuffer);
  } catch {
    throw new Error('Incorrect key or corrupted encrypted payload.');
  }
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as any,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: KEY_LENGTH_BITS },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptData(plaintext: string, password: string): Promise<EncryptedPayload> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);

  const enc = new TextEncoder();
  const encodedPlaintext = enc.encode(plaintext);

  const ciphertextBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as any,
    },
    key,
    encodedPlaintext
  );

  return {
    version: '1.0',
    algorithm: 'AES-GCM',
    iterations: PBKDF2_ITERATIONS,
    saltHex: bytesToHex(salt),
    ivHex: bytesToHex(iv),
    ciphertextHex: bytesToHex(new Uint8Array(ciphertextBuffer)),
  };
}

export async function decryptData(payload: EncryptedPayload, password: string): Promise<string> {
  if (payload.algorithm !== 'AES-GCM') {
    throw new Error('Unsupported encryption algorithm: ' + payload.algorithm);
  }

  const salt = hexToBytes(payload.saltHex);
  const iv = hexToBytes(payload.ivHex);
  const ciphertext = hexToBytes(payload.ciphertextHex);

  const key = await deriveKey(password, salt);

  try {
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv as any,
      },
      key,
      ciphertext as any
    );

    const dec = new TextDecoder();
    return dec.decode(decryptedBuffer);
  } catch (err) {
    throw new Error('Incorrect password or corrupted encrypted payload.');
  }
}

export async function hashPassword(
  password: string,
  saltHex?: string
): Promise<{ hashHex: string; saltHex: string }> {
  const salt = saltHex ? hexToBytes(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const enc = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt as any,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    passwordKey,
    256
  );

  return {
    hashHex: bytesToHex(new Uint8Array(bits)),
    saltHex: bytesToHex(salt),
  };
}
