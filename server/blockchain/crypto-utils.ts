/**
 * Crypto Utilities — Private Key Encryption / Decryption
 *
 * Implements AES-256-GCM authenticated encryption for agent custody wallet
 * private keys. Each key is encrypted with a unique per-key salt so that
 * compromise of any single encrypted blob cannot be used to attack others.
 *
 * Algorithm: AES-256-GCM (authenticated, nonce-based)
 * KDF:       PBKDF2-SHA256 (100 000 iterations, 32-byte output)
 * Storage:   { ciphertext, iv, authTag, salt } — all hex-encoded
 *
 * WHY PBKDF2 here instead of scrypt/argon2: PBKDF2 is available in Node's
 * built-in `crypto` module with no native addon needed, which keeps the
 * deployment footprint small on EC2 and CI environments.
 */

import crypto from 'crypto';

// ============================================================================
// Types
// ============================================================================

/** Serializable envelope for an AES-256-GCM encrypted payload */
export interface EncryptedPayload {
  /** AES-GCM ciphertext — hex */
  ciphertext: string;
  /** 12-byte nonce (IV) — hex */
  iv: string;
  /** 16-byte GCM authentication tag — hex */
  authTag: string;
  /** 16-byte per-key PBKDF2 salt — hex */
  salt: string;
}

// ============================================================================
// Constants
// ============================================================================

const ALGORITHM = 'aes-256-gcm' as const;
const KEY_DERIVATION_ITERATIONS = 100_000;
const DERIVED_KEY_LENGTH_BYTES = 32;
const IV_LENGTH_BYTES = 12;
const SALT_LENGTH_BYTES = 16;

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Read the master encryption key from the environment.
 * Throws at call-time (not module load time) so tests can set env vars before first use.
 *
 * @throws Error if AGENT_WALLET_MASTER_KEY is unset or shorter than 32 chars
 */
function getMasterKey(): string {
  const key = process.env.AGENT_WALLET_MASTER_KEY;
  if (!key || key.length < 32) {
    throw new Error(
      'AGENT_WALLET_MASTER_KEY must be set (minimum 32 characters). ' +
        "Generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }
  return key;
}

/**
 * Derive a 256-bit encryption key from the master key and a per-payload salt
 * using PBKDF2-SHA256.
 *
 * @param masterKey - Raw master key string (from env)
 * @param salt      - 16-byte random salt unique to this payload
 * @returns 32-byte derived key buffer
 */
function deriveEncryptionKey(masterKey: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(
    masterKey,
    salt,
    KEY_DERIVATION_ITERATIONS,
    DERIVED_KEY_LENGTH_BYTES,
    'sha256'
  );
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Encrypt a private key string using AES-256-GCM.
 *
 * Each call generates a fresh random IV and salt, so two encryptions of the
 * same plaintext produce different ciphertexts (IND-CPA secure).
 *
 * @param plaintext - The wallet private key to encrypt (hex string)
 * @returns An `EncryptedPayload` safe to persist in the database
 */
export function encryptPrivateKey(plaintext: string): EncryptedPayload {
  const masterKey = getMasterKey();
  const salt = crypto.randomBytes(SALT_LENGTH_BYTES);
  const iv = crypto.randomBytes(IV_LENGTH_BYTES);
  const derivedKey = deriveEncryptionKey(masterKey, salt);

  const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv);
  const ciphertext = cipher.update(plaintext, 'utf8', 'hex') + cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return {
    ciphertext,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    salt: salt.toString('hex'),
  };
}

/**
 * Decrypt an `EncryptedPayload` produced by `encryptPrivateKey`.
 *
 * GCM authentication tag verification happens automatically — if the
 * ciphertext or tag has been tampered with, this throws before returning
 * any plaintext (fail-closed, not fail-open).
 *
 * @param payload - The encrypted envelope stored in the database
 * @returns The original plaintext private key string
 * @throws Error if authentication tag validation fails (tamper detection)
 */
export function decryptPrivateKey(payload: EncryptedPayload): string {
  const masterKey = getMasterKey();
  const salt = Buffer.from(payload.salt, 'hex');
  const iv = Buffer.from(payload.iv, 'hex');
  const derivedKey = deriveEncryptionKey(masterKey, salt);

  const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv);
  decipher.setAuthTag(Buffer.from(payload.authTag, 'hex'));

  // GCM auth tag is verified during `final()` — throws on tamper
  return decipher.update(payload.ciphertext, 'hex', 'utf8') + decipher.final('utf8');
}

/**
 * Parse an `EncryptedPayload` from its JSON-serialised database form.
 *
 * @param json - JSON string as stored in `AgentWallet.encryptedKey`
 * @returns Parsed `EncryptedPayload`
 * @throws SyntaxError if `json` is not valid JSON
 */
export function parseEncryptedPayload(json: string): EncryptedPayload {
  return JSON.parse(json) as EncryptedPayload;
}
