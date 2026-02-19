import { describe, it, expect, beforeAll } from "vitest";
import { invokeVector, verifyVectorAccess, getInvocationHistory } from "./vector-invocation";
import { getDb } from "./db";
import { users, latentVectors, transactions, accessPermissions } from "../drizzle/schema";
import { eq } from "drizzle-orm";

const isCI = process.env.CI === "true";
const suite = isCI ? describe.skip : describe;

suite("Vector Invocation System", () => {
  let testUserId: number;
  let testVectorId: number;
  let testPermissionId: number;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Create test user
    const userResult = await db.insert(users).values({
      openId: `test-invoke-${Date.now()}`,
      name: "Test Invoker",
      email: `test-invoke-${Date.now()}@test.com`,
      role: "user",
    });
    testUserId = (userResult as any).insertId;

    // Create test vector
    const vectorResult = await db.insert(latentVectors).values({
      creatorId: testUserId,
      title: "Test Invocation Vector",
      description: "A test vector for invocation testing",
      category: "test",
      vectorFileKey: "test/invocation-vector.bin",
      vectorFileUrl: "https://example.com/test.bin",
      modelArchitecture: "gpt-4",
      vectorDimension: 1536,
      basePrice: "10.00",
      pricingModel: "per-call",
      status: "active",
    });
    testVectorId = (vectorResult as any).insertId;

    // Create test transaction
    const txResult = await db.insert(transactions).values({
      buyerId: testUserId,
      vectorId: testVectorId,
      amount: "10.00",
      platformFee: "2.00",
      creatorEarnings: "8.00",
      status: "completed",
    });
    const txId = (txResult as any).insertId;

    // Create access permission
    const permResult = await db.insert(accessPermissions).values({
      userId: testUserId,
      vectorId: testVectorId,
      transactionId: txId,
      accessToken: `test-token-${Date.now()}`,
      callsRemaining: 100,
      isActive: true,
    });
    testPermissionId = (permResult as any).insertId;
  });

  it("should verify vector access for authorized user", async () => {
    const result = await verifyVectorAccess(testUserId, testVectorId);
    
    expect(result.hasAccess).toBe(true);
    expect(result.permission).toBeDefined();
    expect(result.permission?.userId).toBe(testUserId);
    expect(result.permission?.vectorId).toBe(testVectorId);
  });

  it("should deny access for unauthorized user", async () => {
    const result = await verifyVectorAccess(999999, testVectorId);
    
    expect(result.hasAccess).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it("should invoke vector successfully", async () => {
    const result = await invokeVector(testUserId, {
      vectorId: testVectorId,
      inputData: "Test input for invocation",
    });

    expect(result.success).toBe(true);
    expect(result.executionTime).toBeGreaterThan(0);
    expect(result.cost).toBeGreaterThan(0);
  });

  it("should record invocation history", async () => {
    // Invoke vector first
    await invokeVector(testUserId, {
      vectorId: testVectorId,
      inputData: "Test history input",
    });

    // Get history
    const history = await getInvocationHistory(testUserId, { limit: 10 });
    
    expect(history.length).toBeGreaterThan(0);
    expect(history[0].userId).toBe(testUserId);
    expect(history[0].vectorId).toBe(testVectorId);
  });

  it("should fail invocation for inactive vector", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Deactivate vector
    await db
      .update(latentVectors)
      .set({ status: "inactive" })
      .where(eq(latentVectors.id, testVectorId));

    // Try to invoke
    await expect(
      invokeVector(testUserId, {
        vectorId: testVectorId,
        inputData: "Test input",
      })
    ).rejects.toThrow();

    // Reactivate for other tests
    await db
      .update(latentVectors)
      .set({ status: "active" })
      .where(eq(latentVectors.id, testVectorId));
  });

  it("should fail invocation when calls remaining is 0", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Set calls remaining to 0
    await db
      .update(accessPermissions)
      .set({ callsRemaining: 0 })
      .where(eq(accessPermissions.id, testPermissionId));

    // Try to invoke
    const result = await verifyVectorAccess(testUserId, testVectorId);
    expect(result.hasAccess).toBe(false);
    expect(result.reason).toContain("No calls remaining");

    // Restore calls
    await db
      .update(accessPermissions)
      .set({ callsRemaining: 100 })
      .where(eq(accessPermissions.id, testPermissionId));
  });
});
