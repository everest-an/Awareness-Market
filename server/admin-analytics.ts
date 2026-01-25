import { getDb } from "./db";
import { apiUsageLogs, rateLimitConfig, apiKeys, users } from "../drizzle/schema";
import { eq, sql, desc, and, gte } from "drizzle-orm";

/**
 * Get API usage statistics for a specific time period
 */
export async function getApiUsageStats(days: number = 7) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Total requests
  const totalRequests = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(apiUsageLogs)
    .where(gte(apiUsageLogs.createdAt, startDate));

  // Requests by status code
  const requestsByStatus = await db
    .select({
      statusCode: apiUsageLogs.statusCode,
      count: sql<number>`COUNT(*)`,
    })
    .from(apiUsageLogs)
    .where(gte(apiUsageLogs.createdAt, startDate))
    .groupBy(apiUsageLogs.statusCode);

  // Requests by endpoint
  const requestsByEndpoint = await db
    .select({
      endpoint: apiUsageLogs.endpoint,
      count: sql<number>`COUNT(*)`,
      avgResponseTime: sql<number>`AVG(${apiUsageLogs.responseTimeMs})`,
    })
    .from(apiUsageLogs)
    .where(gte(apiUsageLogs.createdAt, startDate))
    .groupBy(apiUsageLogs.endpoint)
    .orderBy(desc(sql`COUNT(*)`))
    .limit(10);

  // Average response time
  const avgResponseTime = await db
    .select({ avg: sql<number>`AVG(${apiUsageLogs.responseTimeMs})` })
    .from(apiUsageLogs)
    .where(gte(apiUsageLogs.createdAt, startDate));

  // Error rate
  const errorCount = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(apiUsageLogs)
    .where(
      and(
        gte(apiUsageLogs.createdAt, startDate),
        sql`${apiUsageLogs.statusCode} >= 400`
      )
    );

  return {
    totalRequests: Number(totalRequests[0]?.count || 0),
    requestsByStatus: requestsByStatus.map((r) => ({
      statusCode: r.statusCode,
      count: Number(r.count),
    })),
    requestsByEndpoint: requestsByEndpoint.map((r) => ({
      endpoint: r.endpoint,
      count: Number(r.count),
      avgResponseTime: Number(r.avgResponseTime || 0),
    })),
    avgResponseTime: Number(avgResponseTime[0]?.avg || 0),
    errorCount: Number(errorCount[0]?.count || 0),
    errorRate: totalRequests[0]?.count
      ? (Number(errorCount[0]?.count || 0) / Number(totalRequests[0].count)) * 100
      : 0,
  };
}

/**
 * Get API usage timeline (requests per day)
 */
export async function getApiUsageTimeline(days: number = 30) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const timeline = await db
    .select({
      date: sql<string>`DATE(${apiUsageLogs.createdAt})`,
      requests: sql<number>`COUNT(*)`,
      errors: sql<number>`SUM(CASE WHEN ${apiUsageLogs.statusCode} >= 400 THEN 1 ELSE 0 END)`,
      avgResponseTime: sql<number>`AVG(${apiUsageLogs.responseTimeMs})`,
    })
    .from(apiUsageLogs)
    .where(gte(apiUsageLogs.createdAt, startDate))
    .groupBy(sql`DATE(${apiUsageLogs.createdAt})`)
    .orderBy(sql`DATE(${apiUsageLogs.createdAt})`);

  return timeline.map((t) => ({
    date: t.date,
    requests: Number(t.requests),
    errors: Number(t.errors),
    avgResponseTime: Number(t.avgResponseTime || 0),
  }));
}

/**
 * Get top API key users
 */
export async function getTopApiKeyUsers(limit: number = 10) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const topUsers = await db
    .select({
      userId: users.id,
      userName: users.name,
      userEmail: users.email,
      apiKeyCount: sql<number>`COUNT(DISTINCT ${apiKeys.id})`,
      totalRequests: sql<number>`COUNT(${apiUsageLogs.id})`,
      avgResponseTime: sql<number>`AVG(${apiUsageLogs.responseTimeMs})`,
    })
    .from(users)
    .leftJoin(apiKeys, eq(apiKeys.userId, users.id))
    .leftJoin(apiUsageLogs, eq(apiUsageLogs.apiKeyId, apiKeys.id))
    .groupBy(users.id, users.name, users.email)
    .orderBy(desc(sql`COUNT(${apiUsageLogs.id})`))
    .limit(limit);

  return topUsers.map((u) => ({
    userId: u.userId,
    userName: u.userName,
    userEmail: u.userEmail,
    apiKeyCount: Number(u.apiKeyCount),
    totalRequests: Number(u.totalRequests),
    avgResponseTime: Number(u.avgResponseTime || 0),
  }));
}

/**
 * Get all API keys with usage stats
 */
export async function getAllApiKeysWithStats() {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const keys = await db
    .select({
      keyId: apiKeys.id,
      keyPrefix: apiKeys.keyPrefix,
      keyName: apiKeys.name,
      userId: users.id,
      userName: users.name,
      userEmail: users.email,
      isActive: apiKeys.isActive,
      createdAt: apiKeys.createdAt,
      lastUsedAt: apiKeys.lastUsedAt,
      totalRequests: sql<number>`COUNT(${apiUsageLogs.id})`,
      requestsPerHour: rateLimitConfig.requestsPerHour,
      requestsPerDay: rateLimitConfig.requestsPerDay,
      rateLimitEnabled: rateLimitConfig.isEnabled,
    })
    .from(apiKeys)
    .leftJoin(users, eq(apiKeys.userId, users.id))
    .leftJoin(apiUsageLogs, eq(apiUsageLogs.apiKeyId, apiKeys.id))
    .leftJoin(rateLimitConfig, eq(rateLimitConfig.apiKeyId, apiKeys.id))
    .groupBy(
      apiKeys.id,
      apiKeys.keyPrefix,
      apiKeys.name,
      apiKeys.isActive,
      apiKeys.createdAt,
      apiKeys.lastUsedAt,
      users.id,
      users.name,
      users.email,
      rateLimitConfig.requestsPerHour,
      rateLimitConfig.requestsPerDay,
      rateLimitConfig.isEnabled
    )
    .orderBy(desc(apiKeys.createdAt));

  return keys.map((k) => ({
    keyId: k.keyId,
    keyPrefix: k.keyPrefix,
    keyName: k.keyName,
    userId: k.userId,
    userName: k.userName,
    userEmail: k.userEmail,
    isActive: k.isActive,
    createdAt: k.createdAt,
    lastUsedAt: k.lastUsedAt,
    totalRequests: Number(k.totalRequests),
    requestsPerHour: k.requestsPerHour,
    requestsPerDay: k.requestsPerDay,
    rateLimitEnabled: k.rateLimitEnabled,
  }));
}

/**
 * Get or create rate limit config for an API key
 */
export async function getRateLimitConfig(apiKeyId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const config = await db
    .select()
    .from(rateLimitConfig)
    .where(eq(rateLimitConfig.apiKeyId, apiKeyId))
    .limit(1);

  if (config.length > 0) {
    return config[0];
  }

  // Create default config
  const result = await db.insert(rateLimitConfig).values({
    apiKeyId,
    requestsPerHour: 1000,
    requestsPerDay: 10000,
    requestsPerMonth: 100000,
    burstLimit: 100,
    isEnabled: true,
  });

  return {
    id: Number((result as any)[0]?.insertId || (result as any).insertId || 0),
    apiKeyId,
    requestsPerHour: 1000,
    requestsPerDay: 10000,
    requestsPerMonth: 100000,
    burstLimit: 100,
    isEnabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Update rate limit config
 */
export async function updateRateLimitConfig(
  apiKeyId: number,
  config: {
    requestsPerHour?: number;
    requestsPerDay?: number;
    requestsPerMonth?: number;
    burstLimit?: number;
    isEnabled?: boolean;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  await db
    .update(rateLimitConfig)
    .set(config)
    .where(eq(rateLimitConfig.apiKeyId, apiKeyId));

  return true;
}

/**
 * Get system health metrics
 */
export async function getSystemHealthMetrics() {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  // Total users
  const totalUsers = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(users);

  // Total API keys
  const totalApiKeys = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(apiKeys);

  // Active API keys
  const activeApiKeys = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(apiKeys)
    .where(eq(apiKeys.isActive, true));

  // Requests in last hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentRequests = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(apiUsageLogs)
    .where(gte(apiUsageLogs.createdAt, oneHourAgo));

  // Recent errors
  const recentErrors = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(apiUsageLogs)
    .where(
      and(
        gte(apiUsageLogs.createdAt, oneHourAgo),
        sql`${apiUsageLogs.statusCode} >= 400`
      )
    );

  return {
    totalUsers: Number(totalUsers[0]?.count || 0),
    totalApiKeys: Number(totalApiKeys[0]?.count || 0),
    activeApiKeys: Number(activeApiKeys[0]?.count || 0),
    requestsLastHour: Number(recentRequests[0]?.count || 0),
    errorsLastHour: Number(recentErrors[0]?.count || 0),
  };
}
