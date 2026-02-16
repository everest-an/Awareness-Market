import { prisma } from "./db-prisma";
const prismaAny = prisma as any;

/**
 * Get API usage statistics for a specific time period
 */
export async function getApiUsageStats(days: number = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Total requests
  const totalRequests = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*) as count FROM api_usage_logs WHERE created_at >= ${startDate}
  `;

  // Requests by status code
  const requestsByStatus = await prisma.$queryRaw<Array<{ status_code: number; count: bigint }>>`
    SELECT status_code, COUNT(*) as count
    FROM api_usage_logs
    WHERE created_at >= ${startDate}
    GROUP BY status_code
  `;

  // Requests by endpoint
  const requestsByEndpoint = await prisma.$queryRaw<Array<{ endpoint: string; count: bigint; avg_response_time: number }>>`
    SELECT endpoint, COUNT(*) as count, AVG(response_time_ms) as avg_response_time
    FROM api_usage_logs
    WHERE created_at >= ${startDate}
    GROUP BY endpoint
    ORDER BY count DESC
    LIMIT 10
  `;

  // Average response time
  const avgResponseTime = await prisma.$queryRaw<[{ avg: number }]>`
    SELECT AVG(response_time_ms) as avg FROM api_usage_logs WHERE created_at >= ${startDate}
  `;

  // Error rate
  const errorCount = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*) as count FROM api_usage_logs
    WHERE created_at >= ${startDate} AND status_code >= 400
  `;

  const total = Number(totalRequests[0]?.count || 0);
  const errors = Number(errorCount[0]?.count || 0);

  return {
    totalRequests: total,
    requestsByStatus: requestsByStatus.map((r) => ({
      statusCode: r.status_code,
      count: Number(r.count),
    })),
    requestsByEndpoint: requestsByEndpoint.map((r) => ({
      endpoint: r.endpoint,
      count: Number(r.count),
      avgResponseTime: Number(r.avg_response_time || 0),
    })),
    avgResponseTime: Number(avgResponseTime[0]?.avg || 0),
    errorCount: errors,
    errorRate: total ? (errors / total) * 100 : 0,
  };
}

/**
 * Get API usage timeline (requests per day)
 */
export async function getApiUsageTimeline(days: number = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const timeline = await prisma.$queryRaw<Array<{
    date: string;
    requests: bigint;
    errors: bigint;
    avg_response_time: number;
  }>>`
    SELECT
      DATE(created_at) as date,
      COUNT(*) as requests,
      SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as errors,
      AVG(response_time_ms) as avg_response_time
    FROM api_usage_logs
    WHERE created_at >= ${startDate}
    GROUP BY DATE(created_at)
    ORDER BY DATE(created_at)
  `;

  return timeline.map((t) => ({
    date: t.date,
    requests: Number(t.requests),
    errors: Number(t.errors),
    avgResponseTime: Number(t.avg_response_time || 0),
  }));
}

/**
 * Get top API key users
 */
export async function getTopApiKeyUsers(limit: number = 10) {
  const topUsers = await prisma.$queryRaw<Array<{
    user_id: number;
    user_name: string | null;
    user_email: string | null;
    api_key_count: bigint;
    total_requests: bigint;
    avg_response_time: number;
  }>>`
    SELECT
      u.id as user_id,
      u.name as user_name,
      u.email as user_email,
      COUNT(DISTINCT ak.id) as api_key_count,
      COUNT(aul.id) as total_requests,
      AVG(aul.response_time_ms) as avg_response_time
    FROM users u
    LEFT JOIN api_keys ak ON ak.user_id = u.id
    LEFT JOIN api_usage_logs aul ON aul.api_key_id = ak.id
    GROUP BY u.id, u.name, u.email
    ORDER BY total_requests DESC
    LIMIT ${limit}
  `;

  return topUsers.map((u) => ({
    userId: u.user_id,
    userName: u.user_name,
    userEmail: u.user_email,
    apiKeyCount: Number(u.api_key_count),
    totalRequests: Number(u.total_requests),
    avgResponseTime: Number(u.avg_response_time || 0),
  }));
}

/**
 * Get all API keys with usage stats
 */
export async function getAllApiKeysWithStats() {
  const keys = await prisma.$queryRaw<Array<{
    key_id: number;
    key_prefix: string;
    key_name: string | null;
    user_id: number | null;
    user_name: string | null;
    user_email: string | null;
    is_active: boolean;
    created_at: Date;
    last_used_at: Date | null;
    total_requests: bigint;
    requests_per_hour: number | null;
    requests_per_day: number | null;
    rate_limit_enabled: boolean | null;
  }>>`
    SELECT
      ak.id as key_id,
      ak.key_prefix,
      ak.name as key_name,
      u.id as user_id,
      u.name as user_name,
      u.email as user_email,
      ak.is_active,
      ak.created_at,
      ak.last_used_at,
      COUNT(aul.id) as total_requests,
      rlc.requests_per_hour,
      rlc.requests_per_day,
      rlc.is_enabled as rate_limit_enabled
    FROM api_keys ak
    LEFT JOIN users u ON ak.user_id = u.id
    LEFT JOIN api_usage_logs aul ON aul.api_key_id = ak.id
    LEFT JOIN rate_limit_config rlc ON rlc.api_key_id = ak.id
    GROUP BY ak.id, ak.key_prefix, ak.name, ak.is_active, ak.created_at, ak.last_used_at,
             u.id, u.name, u.email, rlc.requests_per_hour, rlc.requests_per_day, rlc.is_enabled
    ORDER BY ak.created_at DESC
  `;

  return keys.map((k) => ({
    keyId: k.key_id,
    keyPrefix: k.key_prefix,
    keyName: k.key_name,
    userId: k.user_id,
    userName: k.user_name,
    userEmail: k.user_email,
    isActive: k.is_active,
    createdAt: k.created_at,
    lastUsedAt: k.last_used_at,
    totalRequests: Number(k.total_requests),
    requestsPerHour: k.requests_per_hour,
    requestsPerDay: k.requests_per_day,
    rateLimitEnabled: k.rate_limit_enabled,
  }));
}

/**
 * Get or create rate limit config for an API key
 */
export async function getRateLimitConfig(apiKeyId: number) {
  const config = await prismaAny.rateLimitConfig.findFirst({
    where: { apiKeyId }
  });

  if (config) {
    return config;
  }

  // Create default config
  const newConfig = await prismaAny.rateLimitConfig.create({
    data: {
      apiKeyId,
      requestsPerHour: 1000,
      requestsPerDay: 10000,
      requestsPerMonth: 100000,
      burstLimit: 100,
      isEnabled: true,
    }
  });

  return newConfig;
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
  await prismaAny.rateLimitConfig.updateMany({
    where: { apiKeyId },
    data: config
  });

  return true;
}

/**
 * Get system health metrics
 */
export async function getSystemHealthMetrics() {
  // Total users
  const totalUsers = await prisma.user.count();

  // Total API keys
  const totalApiKeys = await prisma.apiKey.count();

  // Active API keys
  const activeApiKeys = await prisma.apiKey.count({
    where: { isActive: true }
  });

  // Requests in last hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const recentRequests = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*) as count FROM api_usage_logs WHERE created_at >= ${oneHourAgo}
  `;

  // Recent errors
  const recentErrors = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*) as count FROM api_usage_logs
    WHERE created_at >= ${oneHourAgo} AND status_code >= 400
  `;

  return {
    totalUsers,
    totalApiKeys,
    activeApiKeys,
    requestsLastHour: Number(recentRequests[0]?.count || 0),
    errorsLastHour: Number(recentErrors[0]?.count || 0),
  };
}
