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
      permissions: params.permissions ? JSON.stringify(params.permissions) : JSON.stringify(['read']), // Default: read-only (least privilege)
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
  const permissions = apiKey.permissions ? JSON.parse(apiKey.permissions) : ['read'];

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
    permissions: key.permissions ? JSON.parse(key.permissions) : ['read'],
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
export async function rotateApiKey(
  oldKeyId: number,
  userId: number,
  options?: {
    rotationType?: 'manual' | 'automatic' | 'forced';
    rotatedBy?: number;
    reason?: string;
  }
): Promise<{
  success: boolean;
  newKey?: string;
  newKeyPrefix?: string;
  newKeyId?: number;
  error?: string;
}> {
  // Get old key details
  const oldKey = await prisma.apiKey.findFirst({
    where: {
      id: oldKeyId,
      userId,
    },
  });

  if (!oldKey) {
    return { success: false, error: 'API key not found' };
  }

  // Create new key with same permissions and auto-rotation settings
  const permissions = oldKey.permissions ? JSON.parse(oldKey.permissions) : ['*'];

  // Calculate new expiration date based on rotation interval
  const newExpiresAt = oldKey.rotationIntervalDays
    ? new Date(Date.now() + oldKey.rotationIntervalDays * 24 * 60 * 60 * 1000)
    : oldKey.expiresAt;

  const { id: newKeyId, key: newKey, keyPrefix: newKeyPrefix } = await createApiKey({
    userId,
    name: oldKey.name, // Keep the same name
    permissions,
    expiresAt: newExpiresAt,
  });

  // Copy auto-rotation settings to new key
  await prisma.apiKey.update({
    where: { id: newKeyId },
    data: {
      autoRotationEnabled: oldKey.autoRotationEnabled,
      rotationIntervalDays: oldKey.rotationIntervalDays,
      rotatedFromId: oldKeyId,
    },
  });

  // Record rotation in history
  await prisma.apiKeyRotationHistory.create({
    data: {
      apiKeyId: newKeyId,
      oldKeyPrefix: oldKey.keyPrefix,
      newKeyPrefix,
      rotationType: options?.rotationType || 'manual',
      rotatedBy: options?.rotatedBy,
      rotationReason: options?.reason,
    },
  });

  // Revoke old key
  await revokeApiKey(oldKeyId, userId);

  return {
    success: true,
    newKey,
    newKeyPrefix,
    newKeyId,
  };
}

/**
 * Enable auto-rotation for an API key
 */
export async function enableAutoRotation(
  keyId: number,
  userId: number,
  rotationIntervalDays: number = 90
): Promise<{ success: boolean; error?: string }> {
  const key = await prisma.apiKey.findFirst({
    where: { id: keyId, userId },
  });

  if (!key) {
    return { success: false, error: 'API key not found' };
  }

  // Calculate expiration date if not set
  let expiresAt = key.expiresAt;
  if (!expiresAt) {
    expiresAt = new Date(Date.now() + rotationIntervalDays * 24 * 60 * 60 * 1000);
  }

  await prisma.apiKey.update({
    where: { id: keyId },
    data: {
      autoRotationEnabled: true,
      rotationIntervalDays,
      expiresAt,
    },
  });

  return { success: true };
}

/**
 * Disable auto-rotation for an API key
 */
export async function disableAutoRotation(
  keyId: number,
  userId: number
): Promise<{ success: boolean; error?: string }> {
  const result = await prisma.apiKey.updateMany({
    where: { id: keyId, userId },
    data: { autoRotationEnabled: false },
  });

  if (result.count === 0) {
    return { success: false, error: 'API key not found' };
  }

  return { success: true };
}

/**
 * Get rotation history for an API key
 */
export async function getRotationHistory(keyId: number, userId: number): Promise<
  Array<{
    id: number;
    oldKeyPrefix: string;
    newKeyPrefix: string;
    rotationType: string;
    rotationReason: string | null;
    createdAt: Date;
  }>
> {
  // Verify key belongs to user
  const key = await prisma.apiKey.findFirst({
    where: { id: keyId, userId },
  });

  if (!key) {
    return [];
  }

  const history = await prisma.apiKeyRotationHistory.findMany({
    where: { apiKeyId: keyId },
    orderBy: { createdAt: 'desc' },
  });

  return history.map((h) => ({
    id: h.id,
    oldKeyPrefix: h.oldKeyPrefix,
    newKeyPrefix: h.newKeyPrefix,
    rotationType: h.rotationType,
    rotationReason: h.rotationReason,
    createdAt: h.createdAt,
  }));
}
