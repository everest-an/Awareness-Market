import { getDb } from "./db";
import { apiUsageLogs, apiKeys } from "../drizzle/schema";
import { eq, and, gte, sql, desc } from "drizzle-orm";

export interface UsageStats {
  totalRequests: number;
  successRate: number;
  avgResponseTime: number;
  requestsToday: number;
  requestsThisWeek: number;
  requestsThisMonth: number;
}

export interface EndpointStat {
  endpoint: string;
  method: string;
  count: number;
  avgResponseTime: number;
  errorRate: number;
}

export interface DailyUsage {
  date: string;
  requests: number;
  errors: number;
}

export interface ApiKeyUsage {
  apiKeyId: number;
  keyName: string;
  requests: number;
  lastUsed: Date | null;
}

/**
 * Get overall usage statistics for a user
 */
export async function getUserUsageStats(userId: string): Promise<UsageStats> {
  const database = await getDb();
  if (!database) {
    // Return empty data if database is not available
    return {
      totalRequests: 0,
      successRate: 100,
      avgResponseTime: 0,
      requestsToday: 0,
      requestsThisWeek: 0,
      requestsThisMonth: 0,
    };
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Get user's API keys
  const userKeys = await database
    .select({ id: apiKeys.id })
    .from(apiKeys)
    .where(eq(apiKeys.userId, parseInt(userId)));

  const keyIds = userKeys.map(k => k.id);

  if (keyIds.length === 0) {
    return {
      totalRequests: 0,
      successRate: 100,
      avgResponseTime: 0,
      requestsToday: 0,
      requestsThisWeek: 0,
      requestsThisMonth: 0,
    };
  }

  // Total requests
  const totalResult = await database
    .select({ count: sql<number>`count(*)` })
    .from(apiUsageLogs)
    .where(sql`${apiUsageLogs.apiKeyId} IN (${sql.join(keyIds.map(id => sql`${id}`), sql`, `)})`);

  const totalRequests = Number(totalResult[0]?.count || 0);

  // Success rate
  const successResult = await database
    .select({ count: sql<number>`count(*)` })
    .from(apiUsageLogs)
    .where(
      and(
        sql`${apiUsageLogs.apiKeyId} IN (${sql.join(keyIds.map(id => sql`${id}`), sql`, `)})`,
        eq(apiUsageLogs.statusCode, 200)
      )
    );

  const successCount = Number(successResult[0]?.count || 0);
  const successRate = totalRequests > 0 ? (successCount / totalRequests) * 100 : 100;

  // Average response time
  const avgTimeResult = await database
    .select({ avg: sql<number>`avg(${apiUsageLogs.responseTimeMs})` })
    .from(apiUsageLogs)
    .where(sql`${apiUsageLogs.apiKeyId} IN (${sql.join(keyIds.map(id => sql`${id}`), sql`, `)})`);

  const avgResponseTime = Math.round(Number(avgTimeResult[0]?.avg || 0));

  // Requests today
  const todayResult = await database
    .select({ count: sql<number>`count(*)` })
    .from(apiUsageLogs)
    .where(
      and(
        sql`${apiUsageLogs.apiKeyId} IN (${sql.join(keyIds.map(id => sql`${id}`), sql`, `)})`,
        gte(apiUsageLogs.createdAt, today)
      )
    );

  const requestsToday = Number(todayResult[0]?.count || 0);

  // Requests this week
  const weekResult = await database
    .select({ count: sql<number>`count(*)` })
    .from(apiUsageLogs)
    .where(
      and(
        sql`${apiUsageLogs.apiKeyId} IN (${sql.join(keyIds.map(id => sql`${id}`), sql`, `)})`,
        gte(apiUsageLogs.createdAt, weekAgo)
      )
    );

  const requestsThisWeek = Number(weekResult[0]?.count || 0);

  // Requests this month
  const monthResult = await database
    .select({ count: sql<number>`count(*)` })
    .from(apiUsageLogs)
    .where(
      and(
        sql`${apiUsageLogs.apiKeyId} IN (${sql.join(keyIds.map(id => sql`${id}`), sql`, `)})`,
        gte(apiUsageLogs.createdAt, monthAgo)
      )
    );

  const requestsThisMonth = Number(monthResult[0]?.count || 0);

  return {
    totalRequests,
    successRate: Math.round(successRate * 10) / 10,
    avgResponseTime,
    requestsToday,
    requestsThisWeek,
    requestsThisMonth,
  };
}

/**
 * Get popular endpoints for a user
 */
export async function getPopularEndpoints(userId: string, limit: number = 10): Promise<EndpointStat[]> {
  const database = await getDb();
  if (!database) {
    // Return empty data if database is not available
    return [];
  }

  // Get user's API keys
  const userKeys = await database
    .select({ id: apiKeys.id })
    .from(apiKeys)
    .where(eq(apiKeys.userId, parseInt(userId)));

  const keyIds = userKeys.map(k => k.id);

  if (keyIds.length === 0) {
    return [];
  }

  const results = await database
    .select({
      endpoint: apiUsageLogs.endpoint,
      method: apiUsageLogs.method,
      count: sql<number>`count(*)`,
      avgResponseTime: sql<number>`avg(${apiUsageLogs.responseTimeMs})`,
      errorRate: sql<number>`(sum(case when ${apiUsageLogs.statusCode} >= 400 then 1 else 0 end) * 100.0 / count(*))`,
    })
    .from(apiUsageLogs)
    .where(sql`${apiUsageLogs.apiKeyId} IN (${sql.join(keyIds.map(id => sql`${id}`), sql`, `)})`)
    .groupBy(apiUsageLogs.endpoint, apiUsageLogs.method)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);

  return results.map(r => ({
    endpoint: r.endpoint,
    method: r.method,
    count: Number(r.count),
    avgResponseTime: Math.round(Number(r.avgResponseTime)),
    errorRate: Math.round(Number(r.errorRate) * 10) / 10,
  }));
}

/**
 * Get daily usage over the past N days
 */
export async function getDailyUsage(userId: string, days: number = 30): Promise<DailyUsage[]> {
  const database = await getDb();
  if (!database) {
    // Return empty data if database is not available
    return [];
  }

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Get user's API keys
  const userKeys = await database
    .select({ id: apiKeys.id })
    .from(apiKeys)
    .where(eq(apiKeys.userId, parseInt(userId)));

  const keyIds = userKeys.map(k => k.id);

  if (keyIds.length === 0) {
    return [];
  }

  const results = await database
    .select({
      date: sql<string>`DATE(${apiUsageLogs.createdAt})`,
      requests: sql<number>`count(*)`,
      errors: sql<number>`sum(case when ${apiUsageLogs.statusCode} >= 400 then 1 else 0 end)`,
    })
    .from(apiUsageLogs)
    .where(
      and(
        sql`${apiUsageLogs.apiKeyId} IN (${sql.join(keyIds.map(id => sql`${id}`), sql`, `)})`,
        gte(apiUsageLogs.createdAt, startDate)
      )
    )
    .groupBy(sql`DATE(${apiUsageLogs.createdAt})`)
    .orderBy(sql`DATE(${apiUsageLogs.createdAt})`);

  return results.map(r => ({
    date: r.date,
    requests: Number(r.requests),
    errors: Number(r.errors),
  }));
}

/**
 * Get API key usage breakdown
 */
export async function getApiKeyUsage(userId: string): Promise<ApiKeyUsage[]> {
  const database = await getDb();
  if (!database) {
    // Return empty data if database is not available
    return [];
  }

  // Get user's API keys with usage stats
  const userKeys = await database
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      lastUsed: apiKeys.lastUsedAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.userId, parseInt(userId)));

  const usagePromises = userKeys.map(async (key) => {
    const result = await database
      .select({ count: sql<number>`count(*)` })
      .from(apiUsageLogs)
      .where(eq(apiUsageLogs.apiKeyId, key.id));

    return {
      apiKeyId: key.id,
      keyName: key.name,
      requests: Number(result[0]?.count || 0),
      lastUsed: key.lastUsed,
    };
  });

  return Promise.all(usagePromises);
}
