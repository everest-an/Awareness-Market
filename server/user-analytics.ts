import { prisma } from "./db-prisma";

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
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Get user's API keys
  const userKeys = await prisma.apiKey.findMany({
    where: { userId: parseInt(userId) },
    select: { id: true },
  });

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
  const totalRequests = await prisma.apiUsageLog.count({
    where: { apiKeyId: { in: keyIds } },
  });

  // Success count
  const successCount = await prisma.apiUsageLog.count({
    where: {
      apiKeyId: { in: keyIds },
      statusCode: 200,
    },
  });

  const successRate = totalRequests > 0 ? (successCount / totalRequests) * 100 : 100;

  // Average response time
  const avgTimeResult = await prisma.apiUsageLog.aggregate({
    where: { apiKeyId: { in: keyIds } },
    _avg: { responseTimeMs: true },
  });

  const avgResponseTime = Math.round(avgTimeResult._avg.responseTimeMs || 0);

  // Requests today
  const requestsToday = await prisma.apiUsageLog.count({
    where: {
      apiKeyId: { in: keyIds },
      createdAt: { gte: today },
    },
  });

  // Requests this week
  const requestsThisWeek = await prisma.apiUsageLog.count({
    where: {
      apiKeyId: { in: keyIds },
      createdAt: { gte: weekAgo },
    },
  });

  // Requests this month
  const requestsThisMonth = await prisma.apiUsageLog.count({
    where: {
      apiKeyId: { in: keyIds },
      createdAt: { gte: monthAgo },
    },
  });

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
  // Get user's API keys
  const userKeys = await prisma.apiKey.findMany({
    where: { userId: parseInt(userId) },
    select: { id: true },
  });

  const keyIds = userKeys.map(k => k.id);

  if (keyIds.length === 0) {
    return [];
  }

  // Use raw SQL for complex aggregation
  const results = await prisma.$queryRaw<Array<{
    endpoint: string;
    method: string;
    count: bigint;
    avgResponseTime: number | null;
    errorRate: number | null;
  }>>`
    SELECT
      endpoint,
      method,
      COUNT(*) as count,
      AVG(response_time_ms) as "avgResponseTime",
      (SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) * 100.0 / COUNT(*)) as "errorRate"
    FROM api_usage_logs
    WHERE api_key_id = ANY(${keyIds})
    GROUP BY endpoint, method
    ORDER BY COUNT(*) DESC
    LIMIT ${limit}
  `;

  return results.map(r => ({
    endpoint: r.endpoint,
    method: r.method,
    count: Number(r.count),
    avgResponseTime: Math.round(Number(r.avgResponseTime || 0)),
    errorRate: Math.round(Number(r.errorRate || 0) * 10) / 10,
  }));
}

/**
 * Get daily usage over the past N days
 */
export async function getDailyUsage(userId: string, days: number = 30): Promise<DailyUsage[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Get user's API keys
  const userKeys = await prisma.apiKey.findMany({
    where: { userId: parseInt(userId) },
    select: { id: true },
  });

  const keyIds = userKeys.map(k => k.id);

  if (keyIds.length === 0) {
    return [];
  }

  // Use raw SQL for date aggregation
  const results = await prisma.$queryRaw<Array<{
    date: Date;
    requests: bigint;
    errors: bigint;
  }>>`
    SELECT
      DATE(created_at) as date,
      COUNT(*) as requests,
      SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as errors
    FROM api_usage_logs
    WHERE api_key_id = ANY(${keyIds}) AND created_at >= ${startDate}
    GROUP BY DATE(created_at)
    ORDER BY DATE(created_at)
  `;

  return results.map(r => ({
    date: r.date.toISOString().split('T')[0],
    requests: Number(r.requests),
    errors: Number(r.errors),
  }));
}

/**
 * Get API key usage breakdown
 */
export async function getApiKeyUsage(userId: string): Promise<ApiKeyUsage[]> {
  // Get user's API keys with usage stats
  const userKeys = await prisma.apiKey.findMany({
    where: { userId: parseInt(userId) },
    select: {
      id: true,
      name: true,
      lastUsedAt: true,
    },
  });

  const usagePromises = userKeys.map(async (key) => {
    const count = await prisma.apiUsageLog.count({
      where: { apiKeyId: key.id },
    });

    return {
      apiKeyId: key.id,
      keyName: key.name || 'Unnamed Key',
      requests: count,
      lastUsed: key.lastUsedAt,
    };
  });

  return Promise.all(usagePromises);
}
