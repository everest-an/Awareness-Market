/**
 * Encryption Utilities — P1 Security Enhancement
 *
 * Provides AES-256-GCM encryption for sensitive data at rest
 * Use cases:
 * - Decision audit logs (inputQuery, output fields)
 * - API keys and secrets
 * - Personal identifiable information (PII)
 *
 * Security features:
 * - AES-256-GCM (authenticated encryption)
 * - Random IV (initialization vector) per encryption
 * - HMAC verification for integrity
 * - Key rotation support
 */

import crypto from 'crypto';

// ============================================================================
// Configuration
// ============================================================================

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits
const KEY_LENGTH = 32; // 256 bits

/**
 * Get encryption key from environment
 * In production, this should be stored in a secure key management service (AWS KMS, HashiCorp Vault)
 */
function getEncryptionKey(keyId: string = 'default'): Buffer {
  const envKey = keyId === 'default'
    ? process.env.ENCRYPTION_KEY
    : process.env[`ENCRYPTION_KEY_${keyId.toUpperCase()}`];

  if (!envKey) {
    throw new Error(`Encryption key not found: ${keyId}. Set ENCRYPTION_KEY in environment.`);
  }

  // Ensure key is exactly 32 bytes
  const key = Buffer.from(envKey, 'hex');
  if (key.length !== KEY_LENGTH) {
    throw new Error(`Encryption key must be ${KEY_LENGTH} bytes (64 hex characters). Current: ${key.length}`);
  }

  return key;
}

// ============================================================================
// Core Encryption Functions
// ============================================================================

/**
 * Encrypt data using AES-256-GCM
 *
 * Output format: keyId:iv:authTag:encryptedData (all hex-encoded)
 * Example: default:a1b2c3d4e5f6...:f7e8d9c0b1a2...:3c4d5e6f7a8b...
 */
export function encrypt(plaintext: string, keyId: string = 'default'): string {
  if (!plaintext || typeof plaintext !== 'string') {
    return '';
  }

  try {
    const key = getEncryptionKey(keyId);

    // Generate random IV
    const iv = crypto.randomBytes(IV_LENGTH);

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    // Encrypt data
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Get authentication tag
    const authTag = cipher.getAuthTag();

    // Combine: keyId:iv:authTag:encryptedData
    return `${keyId}:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt data encrypted with encrypt()
 */
export function decrypt(ciphertext: string): string {
  if (!ciphertext || typeof ciphertext !== 'string') {
    return '';
  }

  try {
    // Parse encrypted string
    const parts = ciphertext.split(':');
    if (parts.length !== 4) {
      throw new Error('Invalid ciphertext format');
    }

    const [keyId, ivHex, authTagHex, encryptedData] = parts;

    const key = getEncryptionKey(keyId);
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    // Decrypt data
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
}

// ============================================================================
// Field-Level Encryption (for database columns)
// ============================================================================

/**
 * Encrypt a specific field value for storage in database
 * Returns null if input is null (preserves nullable fields)
 */
export function encryptField(value: string | null | undefined, fieldName?: string): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  try {
    return encrypt(value);
  } catch (error) {
    console.error(`Failed to encrypt field: ${fieldName}`, error);
    // For audit logs, it's better to fail than to store unencrypted data
    throw error;
  }
}

/**
 * Decrypt a specific field value from database
 * Returns null if input is null (preserves nullable fields)
 */
export function decryptField(value: string | null | undefined, fieldName?: string): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  try {
    return decrypt(value);
  } catch (error) {
    console.error(`Failed to decrypt field: ${fieldName}`, error);
    // Return encrypted value if decryption fails (backward compatibility)
    return value;
  }
}

// ============================================================================
// Object Encryption (for JSON fields)
// ============================================================================

/**
 * Encrypt an entire object (serialized as JSON)
 */
export function encryptObject<T>(obj: T): string {
  if (!obj) {
    return '';
  }

  const json = JSON.stringify(obj);
  return encrypt(json);
}

/**
 * Decrypt an object (deserialized from JSON)
 */
export function decryptObject<T>(ciphertext: string): T | null {
  if (!ciphertext) {
    return null;
  }

  try {
    const json = decrypt(ciphertext);
    return JSON.parse(json) as T;
  } catch (error) {
    console.error('Object decryption error:', error);
    return null;
  }
}

// ============================================================================
// Deterministic Encryption (for searchable fields)
// ============================================================================

/**
 * HMAC-based deterministic "encryption" (actually hashing)
 * Use for fields that need to be searchable but hidden
 * Example: email addresses that need to be looked up but not displayed
 *
 * WARNING: This is NOT true encryption - same input always produces same output
 * Do NOT use for truly sensitive data
 */
export function hashDeterministic(value: string, purpose: string = 'search'): string {
  if (!value) {
    return '';
  }

  const key = getEncryptionKey();
  const hmac = crypto.createHmac('sha256', key);
  hmac.update(`${purpose}:${value}`);
  return hmac.digest('hex');
}

/**
 * Verify a value against a deterministic hash
 */
export function verifyDeterministicHash(value: string, hash: string, purpose: string = 'search'): boolean {
  const computedHash = hashDeterministic(value, purpose);
  return crypto.timingSafeEqual(
    Buffer.from(computedHash, 'hex'),
    Buffer.from(hash, 'hex')
  );
}

// ============================================================================
// Key Management
// ============================================================================

/**
 * Generate a new encryption key (for initial setup)
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(KEY_LENGTH).toString('hex');
}

/**
 * Rotate encryption keys (re-encrypt data with new key)
 */
export async function rotateKey(
  oldKeyId: string,
  newKeyId: string,
  fetchRecords: () => Promise<Array<{ id: string; encryptedData: string }>>,
  updateRecord: (id: string, newEncryptedData: string) => Promise<void>
): Promise<{ success: number; failed: number }> {
  const records = await fetchRecords();
  let success = 0;
  let failed = 0;

  for (const record of records) {
    try {
      // Decrypt with old key
      const plaintext = decrypt(record.encryptedData);

      // Encrypt with new key
      const newCiphertext = encrypt(plaintext, newKeyId);

      // Update database
      await updateRecord(record.id, newCiphertext);

      success++;
    } catch (error) {
      console.error(`Failed to rotate key for record ${record.id}:`, error);
      failed++;
    }
  }

  return { success, failed };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if encryption is properly configured
 */
export function isEncryptionConfigured(): boolean {
  try {
    getEncryptionKey();
    return true;
  } catch {
    return false;
  }
}

/**
 * Verify encryption/decryption works correctly
 */
export function testEncryption(): boolean {
  try {
    const testData = 'Hello, World! 🔒';
    const encrypted = encrypt(testData);
    const decrypted = decrypt(encrypted);
    return decrypted === testData;
  } catch {
    return false;
  }
}

// ============================================================================
// Environment Setup Helper
// ============================================================================

/**
 * Generate .env template for encryption configuration
 */
export function generateEnvTemplate(): string {
  const key = generateEncryptionKey();

  return `
# Encryption Configuration (AES-256-GCM)
# IMPORTANT: Keep these keys secret! Store in secure key management (AWS KMS, Vault)

# Primary encryption key (32 bytes = 64 hex characters)
ENCRYPTION_KEY=${key}

# Optional: Key for different purposes (rotation, different data types)
# ENCRYPTION_KEY_AUDIT=${generateEncryptionKey()}
# ENCRYPTION_KEY_PII=${generateEncryptionKey()}

# To generate a new key:
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
`.trim();
}

// ============================================================================
// Export All
// ============================================================================

export default {
  encrypt,
  decrypt,
  encryptField,
  decryptField,
  encryptObject,
  decryptObject,
  hashDeterministic,
  verifyDeterministicHash,
  generateEncryptionKey,
  rotateKey,
  isEncryptionConfigured,
  testEncryption,
  generateEnvTemplate,
};
