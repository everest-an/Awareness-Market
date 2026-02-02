/**
 * API Key Management System
 * Handles generation, validation, and lifecycle management of API keys
 */

import crypto from 'crypto';
import { prisma } from './db-prisma';

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
  const { key, keyHash, keyPrefix } = generateApiKey();

  const apiKey = await prisma.apiKey.create({
    data: {
      userId: params.userId,
      keyHash,
      keyPrefix,
      name: params.name || 'Default API Key',
      permissions: params.permissions ? JSON.stringify(params.permissions) : JSON.stringify(['*']), // '*' = all permissions
      expiresAt: params.expiresAt || null,
      isActive: true
    }
  });

  return { id: apiKey.id, key, keyPrefix };
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

  const keyHash = hashApiKey(key);

  const apiKey = await prisma.apiKey.findFirst({
    where: {
      keyHash,
      isActive: true
    }
  });

  if (!apiKey) {
    return { valid: false, error: 'API key not found or inactive' };
  }

  // Check expiration
  if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
    return { valid: false, error: 'API key expired' };
  }

  // Update last used timestamp
  await prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() }
  });

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
  const keys = await prisma.apiKey.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' }
  });

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
  const result = await prisma.apiKey.updateMany({
    where: {
      id: keyId,
      userId
    },
    data: { isActive: false }
  });

  return result.count > 0;
}

/**
 * Delete an API key permanently
 */
export async function deleteApiKey(keyId: number, userId: number): Promise<boolean> {
  const result = await prisma.apiKey.deleteMany({
    where: {
      id: keyId,
      userId
    }
  });

  return result.count > 0;
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
  // Get old key details
  const oldKey = await prisma.apiKey.findFirst({
    where: {
      id: oldKeyId,
      userId
    }
  });

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
