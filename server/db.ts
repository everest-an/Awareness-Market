import { eq, and, desc, sql, gte, lte, like, or, inArray } from "drizzle-orm";
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
  apiCallLogs,
  notifications,
  userPreferences,
  browsingHistory,
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
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
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
    console.warn("[Database] Cannot upsert user: database not available");
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
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
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
    .select()
    .from(accessPermissions)
    .where(and(eq(accessPermissions.userId, userId), eq(accessPermissions.isActive, true)));
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
  
  return await db.select().from(reviews).where(eq(reviews.vectorId, vectorId)).orderBy(desc(reviews.createdAt));
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
    console.error("[Database] Failed to insert browsing history:", error);
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
    console.error("[Database] Failed to get browsing history:", error);
    return [];
  }
}
