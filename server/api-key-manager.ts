/**
 * API Key Management System
 * Handles generation, validation, and lifecycle management of API keys
 */

import crypto from 'crypto';
import { getDb } from './db.js';
import { apiKeys } from '../drizzle/schema.ts';
import { eq, and } from 'drizzle-orm';

// MySQL result types
interface InsertResult {
  insertId: number;
}

interface UpdateDeleteResult {
  affectedRows: number;
}

/**
 * Generate a secure API key with prefix and checksum
 * Format: ak_live_32_random_hex_chars
 */
export function generateApiKey(): { key: string; keyHash: string; keyPrefix: string } {
  const prefix = 'ak_live_';
  const randomBytes = crypto.randomBytes(16).toString('hex'); // 32 chars
  const key = `${prefix}${randomBytes}`;
  
  // Hash the key for storage (never store plain keys)
  const keyHash = crypto.createHash('sha256').update(key).digest('hex');
  
  // Store first 12 chars as prefix for identification
  const keyPrefix = key.substring(0, 12);
  
  return { key, keyHash, keyPrefix };
}

/**
 * Hash an API key for comparison
 */
export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Create a new API key for a user
 */
export async function createApiKey(params: {
  userId: number;
  name?: string;
  permissions?: string[];
  expiresAt?: Date | null;
}): Promise<{ id: number; key: string; keyPrefix: string }> {
  const db = await getDb();
  if (!db) {
    throw new Error('Database connection failed');
  }

  const { key, keyHash, keyPrefix } = generateApiKey();
  
  const [result] = await db.insert(apiKeys).values({
    userId: params.userId,
    keyHash,
    keyPrefix,
    name: params.name || 'Default API Key',
    permissions: params.permissions ? JSON.stringify(params.permissions) : JSON.stringify(['*']), // '*' = all permissions
    expiresAt: params.expiresAt || null,
    isActive: true
  });

  const id = (result as unknown as InsertResult).insertId;

  return { id, key, keyPrefix };
}

/**
 * Validate an API key and return associated user info
 */
export async function validateApiKey(key: string): Promise<{
  valid: boolean;
  userId?: number;
  keyId?: number;
  permissions?: string[];
  error?: string;
}> {
  if (!key || !key.startsWith('ak_live_')) {
    return { valid: false, error: 'Invalid API key format' };
  }

  const db = await getDb();
  if (!db) {
    return { valid: false, error: 'Database connection failed' };
  }

  const keyHash = hashApiKey(key);

  const [apiKey] = await db
    .select()
    .from(apiKeys)
    .where(
      and(
        eq(apiKeys.keyHash, keyHash),
        eq(apiKeys.isActive, true)
      )
    )
    .limit(1);

  if (!apiKey) {
    return { valid: false, error: 'API key not found or inactive' };
  }

  // Check expiration
  if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
    return { valid: false, error: 'API key expired' };
  }

  // Update last used timestamp
  await db
    .update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, apiKey.id));

  // Parse scopes
  const permissions = apiKey.permissions ? JSON.parse(apiKey.permissions) : ['*'];

  return {
    valid: true,
    userId: apiKey.userId,
    keyId: apiKey.id,
    permissions
  };
}

/**
 * Check if an API key has a specific permission
 */
export function hasPermission(permissions: string[], requiredPermission: string): boolean {
  // '*' grants all permissions
  if (permissions.includes('*')) {
    return true;
  }

  // Check exact match
  if (permissions.includes(requiredPermission)) {
    return true;
  }

  // Check wildcard patterns (e.g., "vectors:*" matches "vectors:read")
  const requiredParts = requiredPermission.split(':');
  for (const scope of permissions) {
    const scopeParts = scope.split(':');
    if (scopeParts[0] === requiredParts[0] && scopeParts[1] === '*') {
      return true;
    }
  }

  return false;
}

/**
 * List all API keys for a user (without revealing the actual keys)
 */
export async function listApiKeys(userId: number): Promise<Array<{
  id: number;
  name: string;
  keyPrefix: string;
  permissions: string[];
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  isActive: boolean;
  createdAt: Date;
}>> {
  const db = await getDb();
  if (!db) {
    throw new Error('Database connection failed');
  }

  const keys = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.userId, userId))
    .orderBy(apiKeys.createdAt);

  return keys.map(key => ({
    id: key.id,
    name: key.name || 'Unnamed Key',
    keyPrefix: key.keyPrefix,
    permissions: key.permissions ? JSON.parse(key.permissions) : ['*'],
    lastUsedAt: key.lastUsedAt,
    expiresAt: key.expiresAt,
    isActive: key.isActive,
    createdAt: key.createdAt
  }));
}

/**
 * Revoke (deactivate) an API key
 */
export async function revokeApiKey(keyId: number, userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    throw new Error('Database connection failed');
  }

  const [result] = await db
    .update(apiKeys)
    .set({ isActive: false })
    .where(
      and(
        eq(apiKeys.id, keyId),
        eq(apiKeys.userId, userId)
      )
    );

  return (result as unknown as UpdateDeleteResult).affectedRows > 0;
}

/**
 * Delete an API key permanently
 */
export async function deleteApiKey(keyId: number, userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    throw new Error('Database connection failed');
  }

  const [result] = await db
    .delete(apiKeys)
    .where(
      and(
        eq(apiKeys.id, keyId),
        eq(apiKeys.userId, userId)
      )
    );

  return (result as unknown as UpdateDeleteResult).affectedRows > 0;
}

/**
 * Rotate an API key (create new key, revoke old one)
 */
export async function rotateApiKey(oldKeyId: number, userId: number): Promise<{
  success: boolean;
  newKey?: string;
  newKeyPrefix?: string;
  error?: string;
}> {
  const db = await getDb();
  if (!db) {
    return { success: false, error: 'Database connection failed' };
  }

  // Get old key details
  const [oldKey] = await db
    .select()
    .from(apiKeys)
    .where(
      and(
        eq(apiKeys.id, oldKeyId),
        eq(apiKeys.userId, userId)
      )
    )
    .limit(1);

  if (!oldKey) {
    return { success: false, error: 'API key not found' };
  }

  // Create new key with same permissions
  const permissions = oldKey.permissions ? JSON.parse(oldKey.permissions) : ['*'];
  const { key: newKey, keyPrefix: newKeyPrefix } = await createApiKey({
    userId,
    name: `${oldKey.name} (Rotated)`,
    permissions,
    expiresAt: oldKey.expiresAt
  });

  // Revoke old key
  await revokeApiKey(oldKeyId, userId);

  return {
    success: true,
    newKey,
    newKeyPrefix
  };
}
