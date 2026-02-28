/**
 * Unit tests for crypto-utils.ts — AES-256-GCM private key encryption
 *
 * Tests are pure: no DB, no network, no ethers.js.
 * The only external dependency is Node's built-in `crypto` module.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  encryptPrivateKey,
  decryptPrivateKey,
  parseEncryptedPayload,
  type EncryptedPayload,
} from '../crypto-utils';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const MOCK_MASTER_KEY = 'a'.repeat(64); // 64-char hex → 32-byte equivalent
const MOCK_PRIVATE_KEY = '0x' + 'b'.repeat(64); // fake Ethereum private key

function withMasterKey(key: string, fn: () => void): void {
  const original = process.env.AGENT_WALLET_MASTER_KEY;
  process.env.AGENT_WALLET_MASTER_KEY = key;
  try {
    fn();
  } finally {
    process.env.AGENT_WALLET_MASTER_KEY = original;
  }
}

// ---------------------------------------------------------------------------
// encryptPrivateKey
// ---------------------------------------------------------------------------

describe('encryptPrivateKey', () => {
  it('returns an EncryptedPayload with all required fields', () => {
    withMasterKey(MOCK_MASTER_KEY, () => {
      const payload = encryptPrivateKey(MOCK_PRIVATE_KEY);
      expect(payload).toHaveProperty('ciphertext');
      expect(payload).toHaveProperty('iv');
      expect(payload).toHaveProperty('authTag');
      expect(payload).toHaveProperty('salt');
    });
  });

  it('stores all fields as hex strings', () => {
    withMasterKey(MOCK_MASTER_KEY, () => {
      const payload = encryptPrivateKey(MOCK_PRIVATE_KEY);
      const hexRe = /^[0-9a-f]+$/;
      expect(payload.ciphertext).toMatch(hexRe);
      expect(payload.iv).toMatch(hexRe);
      expect(payload.authTag).toMatch(hexRe);
      expect(payload.salt).toMatch(hexRe);
    });
  });

  it('produces different ciphertexts for the same plaintext (IND-CPA)', () => {
    withMasterKey(MOCK_MASTER_KEY, () => {
      const a = encryptPrivateKey(MOCK_PRIVATE_KEY);
      const b = encryptPrivateKey(MOCK_PRIVATE_KEY);
      // Different random IV + salt each time
      expect(a.ciphertext).not.toBe(b.ciphertext);
      expect(a.iv).not.toBe(b.iv);
      expect(a.salt).not.toBe(b.salt);
    });
  });

  it('throws if AGENT_WALLET_MASTER_KEY is not set', () => {
    const original = process.env.AGENT_WALLET_MASTER_KEY;
    delete process.env.AGENT_WALLET_MASTER_KEY;
    expect(() => encryptPrivateKey(MOCK_PRIVATE_KEY)).toThrow('AGENT_WALLET_MASTER_KEY');
    process.env.AGENT_WALLET_MASTER_KEY = original;
  });

  it('throws if AGENT_WALLET_MASTER_KEY is too short (< 32 chars)', () => {
    withMasterKey('short', () => {
      expect(() => encryptPrivateKey(MOCK_PRIVATE_KEY)).toThrow('AGENT_WALLET_MASTER_KEY');
    });
  });
});

// ---------------------------------------------------------------------------
// decryptPrivateKey
// ---------------------------------------------------------------------------

describe('decryptPrivateKey', () => {
  it('round-trips: decrypt(encrypt(x)) === x', () => {
    withMasterKey(MOCK_MASTER_KEY, () => {
      const payload = encryptPrivateKey(MOCK_PRIVATE_KEY);
      const recovered = decryptPrivateKey(payload);
      expect(recovered).toBe(MOCK_PRIVATE_KEY);
    });
  });

  it('throws on tampered ciphertext (authentication failure)', () => {
    withMasterKey(MOCK_MASTER_KEY, () => {
      const payload = encryptPrivateKey(MOCK_PRIVATE_KEY);
      const tampered: EncryptedPayload = {
        ...payload,
        ciphertext: payload.ciphertext.slice(0, -2) + '00',
      };
      expect(() => decryptPrivateKey(tampered)).toThrow();
    });
  });

  it('throws on tampered authTag (authentication failure)', () => {
    withMasterKey(MOCK_MASTER_KEY, () => {
      const payload = encryptPrivateKey(MOCK_PRIVATE_KEY);
      const tampered: EncryptedPayload = {
        ...payload,
        authTag: payload.authTag.slice(0, -2) + '00',
      };
      expect(() => decryptPrivateKey(tampered)).toThrow();
    });
  });

  it('throws when decrypting with a different master key', () => {
    let payload: EncryptedPayload;

    withMasterKey(MOCK_MASTER_KEY, () => {
      payload = encryptPrivateKey(MOCK_PRIVATE_KEY);
    });

    withMasterKey('z'.repeat(64), () => {
      expect(() => decryptPrivateKey(payload!)).toThrow();
    });
  });
});

// ---------------------------------------------------------------------------
// parseEncryptedPayload
// ---------------------------------------------------------------------------

describe('parseEncryptedPayload', () => {
  it('round-trips through JSON serialisation', () => {
    withMasterKey(MOCK_MASTER_KEY, () => {
      const original = encryptPrivateKey(MOCK_PRIVATE_KEY);
      const json = JSON.stringify(original);
      const parsed = parseEncryptedPayload(json);
      expect(parsed).toEqual(original);
    });
  });

  it('throws SyntaxError on invalid JSON', () => {
    expect(() => parseEncryptedPayload('not-json')).toThrow(SyntaxError);
  });
});
