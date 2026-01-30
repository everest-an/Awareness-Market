import { eq, and, desc, sql, gte, lte, like, or, inArray, type SQL } from "drizzle-orm";
import crypto from "crypto";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  latentVectors,
  transactions,
  accessPermissions,
  reviews,
  subscriptionPlans,
  userSubscriptions,
  apiKeys,
  apiCallLogs,
  aiMemory,
  notifications,
  userPreferences,
  browsingHistory,
  vectorPackages,
  memoryPackages,
  packagePurchases,
  type LatentVector,
  type Transaction,
  type AccessPermission,
  type Review,
  type SubscriptionPlan,
  type UserSubscription,
  type Notification,
  type BrowsingHistory,
  type InsertBrowsingHistory,
  type UserPreference,
  type VectorPackage,
  type InsertVectorPackage,
  type MemoryPackage,
  type InsertMemoryPackage,
} from "../drizzle/schema";
import { mcpTokens } from "../drizzle/schema-mcp-tokens";
import { ENV } from './_core/env';
import { createLogger } from './utils/logger';

const logger = createLogger('Database:Operations');

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      logger.warn('Failed to connect', { error });
      _db = null;
    }
  }
  return _db;
}

// ===== User Management =====

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    logger.warn('Cannot upsert user: database not available');
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod", "bio", "avatar"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    logger.error('Failed to upsert user', { error, openId: user.openId });
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    logger.warn('Cannot get user: database not available', { openId });
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateUserRole(userId: number, role: "user" | "admin" | "creator" | "consumer") {
  const db = await getDb();
  if (!db) return false;
  
  await db.update(users).set({ role }).where(eq(users.id, userId));
  return true;
}

export async function updateUserProfile(userId: number, updates: {
  name?: string | null;
  email?: string | null;
  bio?: string | null;
  avatar?: string | null;
}) {
  const db = await getDb();
  if (!db) return undefined;

  await db.update(users).set({
    ...(updates.name !== undefined ? { name: updates.name } : {}),
    ...(updates.email !== undefined ? { email: updates.email } : {}),
    ...(updates.bio !== undefined ? { bio: updates.bio } : {}),
    ...(updates.avatar !== undefined ? { avatar: updates.avatar } : {}),
  }).where(eq(users.id, userId));

  return await getUserById(userId);
}

// ===== Latent Vectors Management =====

export async function createLatentVector(vector: typeof latentVectors.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(latentVectors).values(vector);
  return result;
}

export async function getLatentVectorById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(latentVectors).where(eq(latentVectors.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getLatentVectorsByCreator(creatorId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(latentVectors).where(eq(latentVectors.creatorId, creatorId)).orderBy(desc(latentVectors.createdAt));
}

export async function searchLatentVectors(params: {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  searchTerm?: string;
  sortBy?: "newest" | "oldest" | "price_low" | "price_high" | "rating" | "popular";
  status?: "active" | "inactive";
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  
  if (params.category) {
    conditions.push(eq(latentVectors.category, params.category));
  }
  
  if (params.minPrice !== undefined) {
    conditions.push(gte(latentVectors.basePrice, params.minPrice.toString()));
  }
  
  if (params.maxPrice !== undefined) {
    conditions.push(lte(latentVectors.basePrice, params.maxPrice.toString()));
  }
  
  if (params.minRating !== undefined) {
    conditions.push(gte(latentVectors.averageRating, params.minRating.toString()));
  }
  
  if (params.searchTerm) {
    conditions.push(
      or(
        like(latentVectors.title, `%${params.searchTerm}%`),
        like(latentVectors.description, `%${params.searchTerm}%`)
      )
    );
  }
  
  if (params.status) {
    conditions.push(eq(latentVectors.status, params.status));
  } else {
    conditions.push(eq(latentVectors.status, "active"));
  }
  
  let query = db.select().from(latentVectors);
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }
  
  // Apply sorting
  const sortBy = params.sortBy || "newest";
  switch (sortBy) {
    case "newest":
      query = query.orderBy(desc(latentVectors.createdAt)) as any;
      break;
    case "oldest":
      query = query.orderBy(latentVectors.createdAt) as any;
      break;
    case "price_low":
      query = query.orderBy(latentVectors.basePrice) as any;
      break;
    case "price_high":
      query = query.orderBy(desc(latentVectors.basePrice)) as any;
      break;
    case "rating":
      query = query.orderBy(desc(latentVectors.averageRating)) as any;
      break;
    case "popular":
      query = query.orderBy(desc(latentVectors.totalCalls)) as any;
      break;
  }
  
  if (params.limit) {
    query = query.limit(params.limit) as any;
  }
  
  if (params.offset) {
    query = query.offset(params.offset) as any;
  }
  
  return await query;
}

export async function getAllCategories() {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db
    .selectDistinct({ category: latentVectors.category })
    .from(latentVectors)
    .where(eq(latentVectors.status, "active"));
  
  return result.map(r => r.category);
}

export async function updateLatentVector(id: number, updates: Partial<typeof latentVectors.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(latentVectors).set(updates).where(eq(latentVectors.id, id));
  return true;
}

export async function incrementVectorStats(vectorId: number, revenue: number) {
  const db = await getDb();
  if (!db) return;
  
  await db.update(latentVectors)
    .set({
      totalCalls: sql`${latentVectors.totalCalls} + 1`,
      totalRevenue: sql`${latentVectors.totalRevenue} + ${revenue}`,
    })
    .where(eq(latentVectors.id, vectorId));
}

// ===== Transactions =====

export async function createTransaction(transaction: typeof transactions.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(transactions).values(transaction);
  return result;
}

export async function getTransactionById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(transactions).where(eq(transactions.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserTransactions(userId: number, role: "buyer" | "creator") {
  const db = await getDb();
  if (!db) return [];
  
  if (role === "buyer") {
    return await db.select().from(transactions).where(eq(transactions.buyerId, userId)).orderBy(desc(transactions.createdAt));
  } else {
    // Get transactions for vectors created by this user
    return await db
      .select()
      .from(transactions)
      .innerJoin(latentVectors, eq(transactions.vectorId, latentVectors.id))
      .where(eq(latentVectors.creatorId, userId))
      .orderBy(desc(transactions.createdAt));
  }
}

export async function updateTransactionStatus(id: number, status: "pending" | "completed" | "failed" | "refunded") {
  const db = await getDb();
  if (!db) return false;
  
  await db.update(transactions).set({ status }).where(eq(transactions.id, id));
  return true;
}

export async function updateTransactionPaymentInfo(params: {
  id: number;
  status?: "pending" | "completed" | "failed" | "refunded";
  stripePaymentIntentId?: string | null;
}) {
  const db = await getDb();
  if (!db) return false;

  const updates: Record<string, unknown> = {};
  if (params.status) updates.status = params.status;
  if (params.stripePaymentIntentId !== undefined) {
    updates.stripePaymentIntentId = params.stripePaymentIntentId;
  }

  if (Object.keys(updates).length === 0) return false;

  await db.update(transactions).set(updates).where(eq(transactions.id, params.id));
  return true;
}

// ===== API Keys =====

export async function getUserApiKeys(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      keyPrefix: apiKeys.keyPrefix,
      permissions: apiKeys.permissions,
      lastUsedAt: apiKeys.lastUsedAt,
      expiresAt: apiKeys.expiresAt,
      isActive: apiKeys.isActive,
      createdAt: apiKeys.createdAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.userId, userId));
}

export async function createApiKey(params: {
  userId: number;
  name: string;
  keyHash: string;
  keyPrefix: string;
  permissions?: string | null;
  expiresAt?: Date | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(apiKeys).values({
    userId: params.userId,
    name: params.name,
    keyHash: params.keyHash,
    keyPrefix: params.keyPrefix,
    permissions: params.permissions ?? null,
    expiresAt: params.expiresAt ?? null,
    isActive: true,
  });

  return result;
}

export async function revokeApiKey(params: { userId: number; keyId: number }) {
  const db = await getDb();
  if (!db) return false;

  await db
    .update(apiKeys)
    .set({ isActive: false })
    .where(and(eq(apiKeys.id, params.keyId), eq(apiKeys.userId, params.userId)));

  return true;
}

// ===== MCP Tokens =====

const hashToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

export async function createMcpToken(params: {
  userId: number;
  name: string;
  permissions?: string[];
  expiresInDays?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const rawToken = `mcp_${crypto.randomBytes(32).toString("hex")}`;
  const tokenHash = hashToken(rawToken);
  const tokenPrefix = rawToken.substring(0, 12);
  const expiresAt = params.expiresInDays
    ? new Date(Date.now() + params.expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  await db.insert(mcpTokens).values({
    userId: params.userId,
    tokenHash,
    tokenPrefix,
    name: params.name,
    permissions: JSON.stringify(params.permissions || ["sync", "memory"]),
    expiresAt,
    isActive: true,
  });

  return {
    token: rawToken,
    tokenPrefix,
    expiresAt,
  };
}

export async function listMcpTokens(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select({
      id: mcpTokens.id,
      name: mcpTokens.name,
      tokenPrefix: mcpTokens.tokenPrefix,
      permissions: mcpTokens.permissions,
      lastUsedAt: mcpTokens.lastUsedAt,
      expiresAt: mcpTokens.expiresAt,
      isActive: mcpTokens.isActive,
      createdAt: mcpTokens.createdAt,
    })
    .from(mcpTokens)
    .where(eq(mcpTokens.userId, userId));
}

export async function revokeMcpToken(params: { userId: number; tokenId: number }) {
  const db = await getDb();
  if (!db) return false;

  await db
    .update(mcpTokens)
    .set({ isActive: false })
    .where(and(eq(mcpTokens.id, params.tokenId), eq(mcpTokens.userId, params.userId)));

  return true;
}

export async function getMcpTokenByToken(token: string) {
  const db = await getDb();
  if (!db) return undefined;

  const tokenHash = hashToken(token);
  const result = await db
    .select()
    .from(mcpTokens)
    .where(and(eq(mcpTokens.tokenHash, tokenHash), eq(mcpTokens.isActive, true)))
    .limit(1);

  if (result.length === 0) return undefined;

  const record = result[0];
  if (record.expiresAt && new Date(record.expiresAt) < new Date()) {
    return undefined;
  }

  await db.update(mcpTokens).set({ lastUsedAt: new Date() }).where(eq(mcpTokens.id, record.id));

  return record;
}

// ===== Access Permissions =====

export async function createAccessPermission(permission: typeof accessPermissions.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(accessPermissions).values(permission);
  return result;
}

export async function getAccessPermissionByToken(token: string) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(accessPermissions).where(eq(accessPermissions.accessToken, token)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserAccessPermissions(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select({
      id: accessPermissions.id,
      userId: accessPermissions.userId,
      vectorId: accessPermissions.vectorId,
      transactionId: accessPermissions.transactionId,
      accessToken: accessPermissions.accessToken,
      expiresAt: accessPermissions.expiresAt,
      callsRemaining: accessPermissions.callsRemaining,
      isActive: accessPermissions.isActive,
      createdAt: accessPermissions.createdAt,
      updatedAt: accessPermissions.updatedAt,
      vectorTitle: latentVectors.title,
    })
    .from(accessPermissions)
    .leftJoin(latentVectors, eq(accessPermissions.vectorId, latentVectors.id))
    .where(and(eq(accessPermissions.userId, userId), eq(accessPermissions.isActive, true)));
}

export async function getAccessPermissionById(permissionId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select({
      id: accessPermissions.id,
      userId: accessPermissions.userId,
      vectorId: accessPermissions.vectorId,
      transactionId: accessPermissions.transactionId,
      accessToken: accessPermissions.accessToken,
      expiresAt: accessPermissions.expiresAt,
      callsRemaining: accessPermissions.callsRemaining,
      isActive: accessPermissions.isActive,
      createdAt: accessPermissions.createdAt,
      updatedAt: accessPermissions.updatedAt,
    })
    .from(accessPermissions)
    .where(eq(accessPermissions.id, permissionId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function renewAccessPermission(params: {
  permissionId: number;
  extendDays?: number;
}) {
  const db = await getDb();
  if (!db) return undefined;

  const permission = await getAccessPermissionById(params.permissionId);
  if (!permission) return undefined;

  const newToken = crypto.randomBytes(24).toString("hex");
  const updates: Record<string, unknown> = {
    accessToken: newToken,
    isActive: true,
  };

  if (permission.expiresAt) {
    const extendDays = params.extendDays ?? 30;
    updates.expiresAt = new Date(permission.expiresAt.getTime() + extendDays * 24 * 60 * 60 * 1000);
  }

  await db.update(accessPermissions).set(updates).where(eq(accessPermissions.id, params.permissionId));

  return {
    accessToken: newToken,
    expiresAt: (updates.expiresAt as Date | undefined) ?? permission.expiresAt,
  };
}

export async function decrementCallsRemaining(permissionId: number) {
  const db = await getDb();
  if (!db) return;
  
  await db.update(accessPermissions)
    .set({
      callsRemaining: sql`${accessPermissions.callsRemaining} - 1`,
    })
    .where(eq(accessPermissions.id, permissionId));
}

// ===== AI Memory =====

export async function getAIMemoryByKey(params: { userId: number; memoryKey: string }) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(aiMemory)
    .where(and(eq(aiMemory.userId, params.userId), eq(aiMemory.memoryKey, params.memoryKey)))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function upsertAIMemory(params: {
  userId: number;
  memoryKey: string;
  data: Record<string, unknown>;
  ttlDays?: number;
}) {
  const db = await getDb();
  if (!db) return undefined;

  const existing = await getAIMemoryByKey({ userId: params.userId, memoryKey: params.memoryKey });
  const expiresAt = params.ttlDays
    ? new Date(Date.now() + params.ttlDays * 24 * 60 * 60 * 1000)
    : null;

  if (existing) {
    await db
      .update(aiMemory)
      .set({
        memoryData: JSON.stringify(params.data),
        version: existing.version + 1,
        expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(aiMemory.id, existing.id));

    return {
      key: params.memoryKey,
      version: existing.version + 1,
      expiresAt,
    };
  }

  await db.insert(aiMemory).values({
    userId: params.userId,
    memoryKey: params.memoryKey,
    memoryData: JSON.stringify(params.data),
    version: 1,
    expiresAt,
  });

  return {
    key: params.memoryKey,
    version: 1,
    expiresAt,
  };
}

// ===== Reviews =====

export async function createReview(review: typeof reviews.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(reviews).values(review);
  
  // Update vector's average rating
  const allReviews = await db.select().from(reviews).where(eq(reviews.vectorId, review.vectorId));
  const avgRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
  
  await db.update(latentVectors)
    .set({
      averageRating: avgRating.toFixed(2),
      reviewCount: allReviews.length,
    })
    .where(eq(latentVectors.id, review.vectorId));
  
  return result;
}

export async function getVectorReviews(vectorId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select({
      id: reviews.id,
      vectorId: reviews.vectorId,
      userId: reviews.userId,
      rating: reviews.rating,
      comment: reviews.comment,
      isVerifiedPurchase: reviews.isVerifiedPurchase,
      createdAt: reviews.createdAt,
      reviewerName: users.name,
      reviewerAvatar: users.avatar,
    })
    .from(reviews)
    .leftJoin(users, eq(reviews.userId, users.id))
    .where(eq(reviews.vectorId, vectorId))
    .orderBy(desc(reviews.createdAt));
}

// ===== Subscriptions =====

export async function getSubscriptionPlans() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.isActive, true));
}

export async function getUserSubscription(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db
    .select()
    .from(userSubscriptions)
    .where(and(eq(userSubscriptions.userId, userId), eq(userSubscriptions.status, "active")))
    .limit(1);
  
  return result.length > 0 ? result[0] : undefined;
}

export async function createUserSubscription(subscription: typeof userSubscriptions.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(userSubscriptions).values(subscription);
  return result;
}

export async function updateUserSubscription(id: number, updates: Partial<typeof userSubscriptions.$inferInsert>) {
  const db = await getDb();
  if (!db) return false;
  
  await db.update(userSubscriptions).set(updates).where(eq(userSubscriptions.id, id));
  return true;
}

// ===== API Call Logs =====

export async function logApiCall(log: typeof apiCallLogs.$inferInsert) {
  const db = await getDb();
  if (!db) return;
  
  await db.insert(apiCallLogs).values(log);
}

export async function getVectorCallStats(vectorId: number, days: number = 30) {
  const db = await getDb();
  if (!db) return [];
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return await db
    .select()
    .from(apiCallLogs)
    .where(and(eq(apiCallLogs.vectorId, vectorId), gte(apiCallLogs.createdAt, startDate)))
    .orderBy(desc(apiCallLogs.createdAt));
}

export async function getCreatorRevenueTrend(userId: number, days: number = 30) {
  const db = await getDb();
  if (!db) return [];

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days + 1);

  const rows = await db.execute(sql`
    SELECT DATE(t.createdAt) as date,
           SUM(t.creator_earnings) as revenue
    FROM transactions t
    INNER JOIN latent_vectors v ON t.vector_id = v.id
    WHERE v.creator_id = ${userId}
      AND t.status = 'completed'
      AND t.createdAt >= ${startDate}
    GROUP BY DATE(t.createdAt)
    ORDER BY DATE(t.createdAt)
  `);

  return (rows as unknown) as Array<{ date: string; revenue: number | string }>;
}

export async function getCreatorCallTrend(userId: number, days: number = 30) {
  const db = await getDb();
  if (!db) return [];

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days + 1);

  const rows = await db.execute(sql`
    SELECT DATE(a.createdAt) as date,
           COUNT(*) as calls
    FROM api_call_logs a
    INNER JOIN latent_vectors v ON a.vector_id = v.id
    WHERE v.creator_id = ${userId}
      AND a.createdAt >= ${startDate}
    GROUP BY DATE(a.createdAt)
    ORDER BY DATE(a.createdAt)
  `);

  return (rows as unknown) as Array<{ date: string; calls: number | string }>;
}

export async function getConsumerUsageStats(userId: number, days: number = 30) {
  const db = await getDb();
  if (!db) return { totalCalls: 0, avgResponseTime: 0, successRate: 0 };

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days + 1);

  const rows = await db.execute(sql`
    SELECT COUNT(*) as totalCalls,
           AVG(response_time) as avgResponseTime,
           AVG(success) as successRate
    FROM api_call_logs
    WHERE user_id = ${userId}
      AND createdAt >= ${startDate}
  `);

  const row = (rows as any[])[0] || {};
  return {
    totalCalls: Number(row.totalCalls || 0),
    avgResponseTime: Number(row.avgResponseTime || 0),
    successRate: Number(row.successRate || 0),
  };
}

export async function getConsumerAverageRating(userId: number) {
  const db = await getDb();
  if (!db) return 0;

  const rows = await db.execute(sql`
    SELECT AVG(rating) as avgRating
    FROM reviews
    WHERE user_id = ${userId}
  `);

  const row = (rows as any[])[0] || {};
  return Number(row.avgRating || 0);
}

// ===== Notifications =====

export async function createNotification(notification: typeof notifications.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(notifications).values(notification);
  return result;
}

export async function getUserNotifications(userId: number, unreadOnly: boolean = false) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [eq(notifications.userId, userId)];
  if (unreadOnly) {
    conditions.push(eq(notifications.isRead, false));
  }
  
  return await db
    .select()
    .from(notifications)
    .where(and(...conditions))
    .orderBy(desc(notifications.createdAt));
}

export async function markNotificationAsRead(id: number) {
  const db = await getDb();
  if (!db) return false;
  
  await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id));
  return true;
}

// ===== User Preferences =====

export async function getUserPreferences(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function upsertUserPreferences(userId: number, prefs: Partial<typeof userPreferences.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existing = await getUserPreferences(userId);
  
  if (existing) {
    await db.update(userPreferences).set(prefs).where(eq(userPreferences.userId, userId));
  } else {
    await db.insert(userPreferences).values({ userId, ...prefs });
  }
  
  return true;
}

// ===== Browsing History =====

export async function insertBrowsingHistory(history: InsertBrowsingHistory) {
  const db = await getDb();
  if (!db) return;
  
  try {
    await db.insert(browsingHistory).values(history);
  } catch (error) {
    logger.error('Failed to insert browsing history', { error, userId: history.userId });
  }
}

export async function getBrowsingHistory(userId: number, since?: Date) {
  const db = await getDb();
  if (!db) return [];
  
  try {
    const conditions = [eq(browsingHistory.userId, userId)];
    if (since) {
      conditions.push(gte(browsingHistory.createdAt, since));
    }

    const result = await db
      .select()
      .from(browsingHistory)
      .where(and(...conditions))
      .orderBy(desc(browsingHistory.createdAt))
      .limit(100);

    return result;
  } catch (error) {
    logger.error('Failed to get browsing history', { error, userId });
    return [];
  }
}

// ===== Vector Packages (LatentMAS Marketplace) =====

export async function createVectorPackage(packageData: InsertVectorPackage) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  try {
    const result = await db.insert(vectorPackages).values(packageData);
    return result;
  } catch (error) {
    logger.error('Failed to create vector package', { error, name: packageData.name });
    throw error;
  }
}

export async function getVectorPackageById(id: number): Promise<VectorPackage | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db
      .select()
      .from(vectorPackages)
      .where(eq(vectorPackages.id, id))
      .limit(1);

    return result[0] || null;
  } catch (error) {
    logger.error('Failed to get vector package by ID', { error, id });
    return null;
  }
}

export async function getVectorPackageByPackageId(packageId: string): Promise<VectorPackage | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db
      .select()
      .from(vectorPackages)
      .where(eq(vectorPackages.packageId, packageId))
      .limit(1);

    return result[0] || null;
  } catch (error) {
    logger.error('Failed to get vector package by packageId', { error, packageId });
    return null;
  }
}

export async function browseVectorPackages(filters: {
  sourceModel?: string;
  targetModel?: string;
  maxEpsilon?: number;
  category?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<VectorPackage[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    const conditions: SQL[] = [];

    // Only show active packages by default
    conditions.push(eq(vectorPackages.status, filters.status || 'active'));

    if (filters.sourceModel) {
      conditions.push(eq(vectorPackages.sourceModel, filters.sourceModel));
    }
    if (filters.targetModel) {
      conditions.push(eq(vectorPackages.targetModel, filters.targetModel));
    }
    if (filters.maxEpsilon !== undefined) {
      conditions.push(lte(vectorPackages.epsilon, filters.maxEpsilon.toString()));
    }
    if (filters.category) {
      conditions.push(eq(vectorPackages.category, filters.category as any));
    }

    const result = await db
      .select()
      .from(vectorPackages)
      .where(and(...conditions))
      .orderBy(desc(vectorPackages.createdAt))
      .limit(filters.limit || 20)
      .offset(filters.offset || 0);

    return result;
  } catch (error) {
    logger.error('Failed to browse vector packages', { error, filters });
    return [];
  }
}

export async function updateVectorPackageStats(id: number, updates: {
  downloads?: number;
  rating?: string;
  reviewCount?: number;
}) {
  const db = await getDb();
  if (!db) return false;

  try {
    await db
      .update(vectorPackages)
      .set(updates)
      .where(eq(vectorPackages.id, id));

    return true;
  } catch (error) {
    logger.error('Failed to update vector package stats', { error, id, updates });
    return false;
  }
}

export async function incrementVectorPackageDownloads(id: number) {
  const db = await getDb();
  if (!db) return false;

  try {
    await db
      .update(vectorPackages)
      .set({ downloads: sql`${vectorPackages.downloads} + 1` })
      .where(eq(vectorPackages.id, id));

    return true;
  } catch (error) {
    logger.error('Failed to increment downloads', { error, id });
    return false;
  }
}

// ===== Memory Packages (LatentMAS Marketplace) =====

export async function createMemoryPackage(packageData: InsertMemoryPackage) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  try {
    const result = await db.insert(memoryPackages).values(packageData);
    return result;
  } catch (error) {
    logger.error('Failed to create memory package', { error, name: packageData.name });
    throw error;
  }
}

export async function getMemoryPackageById(id: number): Promise<MemoryPackage | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db
      .select()
      .from(memoryPackages)
      .where(eq(memoryPackages.id, id))
      .limit(1);

    return result[0] || null;
  } catch (error) {
    logger.error('Failed to get memory package', { error, id });
    return null;
  }
}

export async function browseMemoryPackages(filters: {
  sourceModel?: string;
  targetModel?: string;
  memoryType?: string;
  maxEpsilon?: number;
  minTokenCount?: number;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<MemoryPackage[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    const conditions: SQL[] = [];

    // Only show active packages by default
    conditions.push(eq(memoryPackages.status, filters.status || 'active'));

    if (filters.sourceModel) {
      conditions.push(eq(memoryPackages.sourceModel, filters.sourceModel));
    }
    if (filters.targetModel) {
      conditions.push(eq(memoryPackages.targetModel, filters.targetModel));
    }
    if (filters.memoryType) {
      conditions.push(eq(memoryPackages.memoryType, filters.memoryType as any));
    }
    if (filters.maxEpsilon !== undefined) {
      conditions.push(lte(memoryPackages.epsilon, filters.maxEpsilon.toString()));
    }
    if (filters.minTokenCount !== undefined) {
      conditions.push(gte(memoryPackages.tokenCount, filters.minTokenCount));
    }

    const result = await db
      .select()
      .from(memoryPackages)
      .where(and(...conditions))
      .orderBy(desc(memoryPackages.createdAt))
      .limit(filters.limit || 20)
      .offset(filters.offset || 0);

    return result;
  } catch (error) {
    logger.error('Failed to browse memory packages', { error, filters });
    return [];
  }
}

export async function getVectorPackagesStatistics() {
  const db = await getDb();
  if (!db) {
    return {
      totalPackages: 0,
      totalDownloads: 0,
      averageEpsilon: 0,
      averageRating: 0,
    };
  }

  try {
    const result = await db
      .select({
        totalPackages: sql<number>`COUNT(*)`,
        totalDownloads: sql<number>`SUM(${vectorPackages.downloads})`,
        averageEpsilon: sql<number>`AVG(${vectorPackages.epsilon})`,
        averageRating: sql<number>`AVG(${vectorPackages.rating})`,
      })
      .from(vectorPackages)
      .where(eq(vectorPackages.status, 'active'));

    return result[0] || {
      totalPackages: 0,
      totalDownloads: 0,
      averageEpsilon: 0,
      averageRating: 0,
    };
  } catch (error) {
    logger.error('Failed to get vector packages statistics', { error });
    return {
      totalPackages: 0,
      totalDownloads: 0,
      averageEpsilon: 0,
      averageRating: 0,
    };
  }
}

// ============================================================================
// Package Purchase Functions
// ============================================================================

export async function createPackagePurchase(data: {
  userId: number;
  packageId: number;
  amount: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  try {
    // Get package details to determine seller
    const pkg = await getVectorPackageById(data.packageId);
    if (!pkg) throw new Error('Package not found');

    const price = parseFloat(data.amount);
    const platformFeeRate = 0.15;
    const platformFee = price * platformFeeRate;
    const sellerEarnings = price - platformFee;

    const result = await db.insert(packagePurchases).values({
      packageType: 'vector',
      packageId: pkg.packageId,
      buyerId: data.userId,
      sellerId: pkg.userId,
      price: data.amount,
      platformFee: platformFee.toFixed(2),
      sellerEarnings: sellerEarnings.toFixed(2),
      status: data.status,
    });

    return Number((result as any).insertId);
  } catch (error) {
    logger.error('Failed to create package purchase', { error, data });
    throw error;
  }
}

export async function getUserPackagePurchaseByPackageId(
  userId: number,
  packageId: string
): Promise<any | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db
      .select()
      .from(packagePurchases)
      .where(
        and(
          eq(packagePurchases.buyerId, userId),
          eq(packagePurchases.packageId, packageId)
        )
      )
      .limit(1);

    return result[0] || null;
  } catch (error) {
    logger.error('Failed to get package purchase', { error, userId, packageId });
    return null;
  }
}

export async function updatePackagePurchaseStatus(data: {
  userId: number;
  packageId: number;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  completedAt?: Date;
}): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  try {
    // Get package ID string
    const pkg = await getVectorPackageById(data.packageId);
    if (!pkg) throw new Error('Package not found');

    await db
      .update(packagePurchases)
      .set({ 
        status: data.status,
        // @ts-ignore - timestamp update
        purchasedAt: data.completedAt || new Date()
      })
      .where(
        and(
          eq(packagePurchases.buyerId, data.userId),
          eq(packagePurchases.packageId, pkg.packageId)
        )
      );

    logger.info('Package purchase status updated', {
      userId: data.userId,
      packageId: data.packageId,
      status: data.status
    });
  } catch (error) {
    logger.error('Failed to update package purchase status', { error, data });
    throw error;
  }
}

export async function incrementPackageDownloads(packageId: number): Promise<void> {
  // Reuse existing function
  await incrementVectorPackageDownloads(packageId);
}
