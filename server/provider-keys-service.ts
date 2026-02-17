/**
 * Provider Keys Service — BYOK (Bring Your Own Key)
 *
 * Stores per-user LLM provider API keys encrypted with AES-256-GCM.
 * Keys are NEVER stored in plaintext — only an encrypted blob and a masked
 * display string are persisted.
 *
 * Encryption format: "<iv_hex>:<authTag_hex>:<ciphertext_hex>"
 *
 * Supported providers:
 *   openai     → https://api.openai.com
 *   anthropic  → https://api.anthropic.com
 *   gemini     → https://generativelanguage.googleapis.com
 *   forge      → custom Forge/Manus proxy
 *   custom     → user-specified base URL
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { prisma } from './db-prisma';
import { createLogger } from './utils/logger';

const logger = createLogger('ProviderKeys');

// Derive 32-byte encryption key from environment secret
function getEncryptionKey(): Buffer {
  const secret = process.env.PROVIDER_KEY_SECRET
    || process.env.SESSION_SECRET
    || 'default-insecure-key-change-in-production';

  // Use first 32 bytes of secret (pad or truncate)
  const buf = Buffer.alloc(32, 0);
  Buffer.from(secret).copy(buf, 0, 0, 32);
  return buf;
}

export function encryptKey(plaintext: string): string {
  const encKey = getEncryptionKey();
  const iv = randomBytes(12); // 96-bit IV for GCM
  const cipher = createCipheriv('aes-256-gcm', encKey, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptKey(encrypted: string): string {
  const [ivHex, authTagHex, ciphertextHex] = encrypted.split(':');
  if (!ivHex || !authTagHex || !ciphertextHex) {
    throw new Error('Invalid encrypted key format');
  }

  const encKey = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');

  const decipher = createDecipheriv('aes-256-gcm', encKey, iv);
  decipher.setAuthTag(authTag);

  return decipher.update(ciphertext).toString('utf8') + decipher.final('utf8');
}

/** Create a masked display string: show first 4 + last 4 chars, rest as dots */
export function maskKey(plaintext: string): string {
  if (plaintext.length <= 10) return '••••••••';
  const prefix = plaintext.substring(0, 6);
  const suffix = plaintext.substring(plaintext.length - 4);
  return `${prefix}...${suffix}`;
}

// ─── CRUD operations ──────────────────────────────────────────────────────────

export interface ProviderKeyInput {
  userId: number;
  provider: string;
  label?: string;
  plainKey: string;
  baseUrl?: string;
}

export interface ProviderKeySummary {
  id: number;
  provider: string;
  label: string | null;
  keyMask: string;
  baseUrl: string | null;
  isActive: boolean;
  lastUsedAt: Date | null;
  createdAt: Date;
}

/** Upsert a provider key for a user (one key per provider). */
export async function upsertProviderKey(input: ProviderKeyInput): Promise<ProviderKeySummary> {
  const encryptedKey = encryptKey(input.plainKey);
  const keyMask = maskKey(input.plainKey);

  const existing = await prisma.providerKey.findFirst({
    where: { userId: input.userId, provider: input.provider },
  });

  let record;
  if (existing) {
    record = await prisma.providerKey.update({
      where: { id: existing.id },
      data: {
        encryptedKey,
        keyMask,
        label: input.label ?? existing.label,
        baseUrl: input.baseUrl !== undefined ? input.baseUrl : existing.baseUrl,
        isActive: true,
        updatedAt: new Date(),
      },
    });
    logger.info('Provider key updated', { userId: input.userId, provider: input.provider });
  } else {
    record = await prisma.providerKey.create({
      data: {
        userId: input.userId,
        provider: input.provider,
        label: input.label ?? null,
        encryptedKey,
        keyMask,
        baseUrl: input.baseUrl ?? null,
        isActive: true,
      },
    });
    logger.info('Provider key created', { userId: input.userId, provider: input.provider });
  }

  return toSummary(record);
}

/** List all provider keys for a user (masked — no plaintext). */
export async function listProviderKeys(userId: number): Promise<ProviderKeySummary[]> {
  const records = await prisma.providerKey.findMany({
    where: { userId, isActive: true },
    orderBy: { provider: 'asc' },
  });
  return records.map(toSummary);
}

/** Delete (deactivate) a provider key by id. */
export async function deleteProviderKey(id: number, userId: number): Promise<void> {
  const record = await prisma.providerKey.findFirst({ where: { id, userId } });
  if (!record) throw new Error(`Provider key ${id} not found`);

  await prisma.providerKey.update({
    where: { id },
    data: { isActive: false },
  });
  logger.info('Provider key deactivated', { id, userId });
}

/** Resolve the active API key for a given provider + user.
 *  Returns `null` if the user has no key saved for that provider.
 *  Also returns the baseUrl override if configured.
 */
export async function resolveProviderKey(
  userId: number,
  provider: string,
): Promise<{ apiKey: string; baseUrl: string | null } | null> {
  const record = await prisma.providerKey.findFirst({
    where: { userId, provider, isActive: true },
  });

  if (!record) return null;

  // Touch lastUsedAt
  await prisma.providerKey.update({
    where: { id: record.id },
    data: { lastUsedAt: new Date() },
  }).catch(() => { /* non-critical */ });

  return {
    apiKey: decryptKey(record.encryptedKey),
    baseUrl: record.baseUrl,
  };
}

function toSummary(r: any): ProviderKeySummary {
  return {
    id: r.id,
    provider: r.provider,
    label: r.label,
    keyMask: r.keyMask,
    baseUrl: r.baseUrl,
    isActive: r.isActive,
    lastUsedAt: r.lastUsedAt,
    createdAt: r.createdAt,
  };
}
