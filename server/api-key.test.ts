import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createApiKey, listApiKeys, revokeApiKey, deleteApiKey, validateApiKey } from "./api-key-manager";
import { getDb } from "./db";

describe("API Key Management", () => {
  let testUserId: number;
  let testApiKey: string;
  let testKeyId: number;

  beforeAll(async () => {
    // Create a test user
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Insert test user using drizzle ORM
    const { users } = await import("../drizzle/schema");
    const result = await db.insert(users).values({
      openId: "test-ai-agent-001",
      name: "Test AI Agent",
      email: "test@ai-agent.com",
      role: "consumer",
    });
    testUserId = Number((result as unknown as { insertId: number }[])[0]?.insertId || (result as unknown as { insertId: number }).insertId);
  });

  afterAll(async () => {
    // Cleanup: delete test user and all associated API keys
    const db = await getDb();
    if (!db) return;

    const { users, apiKeys } = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    
    await db.delete(apiKeys).where(eq(apiKeys.userId, testUserId));
    await db.delete(users).where(eq(users.id, testUserId));
  });

  it("should create a new API key", async () => {
    const result = await createApiKey({ userId: testUserId, name: "Test AI Agent Key", permissions: ["read", "write"] });

    expect(result).toHaveProperty("key");
    expect(result).toHaveProperty("id");
    expect(result.key).toMatch(/^ak_live_[a-f0-9]{32}$/);

    testApiKey = result.key;
    testKeyId = result.id;
  });

  it("should list API keys for user", async () => {
    const keys = await listApiKeys(testUserId);

    expect(Array.isArray(keys)).toBe(true);
    expect(keys.length).toBeGreaterThan(0);
    expect(keys[0]).toHaveProperty("id");
    expect(keys[0]).toHaveProperty("name");
    expect(keys[0]).toHaveProperty("keyPrefix");
    expect(keys[0]).toHaveProperty("isActive");
  });

  it("should validate valid API key", async () => {
    const result = await validateApiKey(testApiKey);

    expect(result.valid).toBe(true);
    expect(result.userId).toBe(testUserId);
  });

  it("should reject invalid API key", async () => {
    const result = await validateApiKey("ak_live_invalid_key_123456789012");

    expect(result.valid).toBe(false);
  });

  it("should revoke API key", async () => {
    await revokeApiKey(testKeyId, testUserId);

    // Verify key is no longer active
    const result = await validateApiKey(testApiKey);
    expect(result.valid).toBe(false);
  });

  it("should delete API key", async () => {
    await deleteApiKey(testKeyId, testUserId);

    // Verify key is deleted
    const keys = await listApiKeys(testUserId);
    const deletedKey = keys.find((k) => k.id === testKeyId);
    expect(deletedKey).toBeUndefined();
  });

  it("should create multiple API keys for same user", async () => {
    const key1 = await createApiKey({ userId: testUserId, name: "Key 1" });
    const key2 = await createApiKey({ userId: testUserId, name: "Key 2" });

    expect(key1.key).not.toBe(key2.key);
    expect(key1.id).not.toBe(key2.id);

    const keys = await listApiKeys(testUserId);
    expect(keys.length).toBeGreaterThanOrEqual(2);

    // Cleanup
    await deleteApiKey(key1.id, testUserId);
    await deleteApiKey(key2.id, testUserId);
  });

  it("should handle expired API keys", async () => {
    // Create key that expires in 1 second
    const expiresAt = new Date(Date.now() + 1000); // 1 second from now
    const result = await createApiKey({ userId: testUserId, name: "Expiring Key", expiresAt });
    const expiringKey = result.key;

    // Wait for expiration
    await new Promise((resolve) => setTimeout(resolve, 1100));

    // Verify key is no longer valid
    const validateResult = await validateApiKey(expiringKey);
    expect(validateResult.valid).toBe(false);

    // Cleanup
    await deleteApiKey(result.id, testUserId);
  });

  it("should update lastUsedAt when key is validated", async () => {
    const result = await createApiKey({ userId: testUserId, name: "Usage Tracking Key" });
    const keyId = result.id;

    // Get initial lastUsedAt
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const { apiKeys } = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    
    const [initialKey] = await db.select({ lastUsedAt: apiKeys.lastUsedAt })
      .from(apiKeys)
      .where(eq(apiKeys.id, keyId));

    // Wait a bit
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Use the key
    await validateApiKey(result.key);

    // Get updated lastUsedAt
    const [updatedKey] = await db.select({ lastUsedAt: apiKeys.lastUsedAt })
      .from(apiKeys)
      .where(eq(apiKeys.id, keyId));

    expect(new Date(updatedKey.lastUsedAt || 0).getTime()).toBeGreaterThan(
      new Date(initialKey.lastUsedAt || 0).getTime()
    );

    // Cleanup
    await deleteApiKey(keyId, testUserId);
  });
});
