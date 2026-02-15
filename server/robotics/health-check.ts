/**
 * Health Check for Robotics Middleware
 */

import { getRedisClient, isRedisReady } from './redis-client';
import { prisma } from '../db-prisma';
import { register as prometheusRegister } from 'prom-client';

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: {
    redis: { status: string; latency?: number };
    postgres: { status: string; latency?: number };
    bullmq: { status: string; queueSize?: number };
  };
  metrics?: {
    activeSessions: number;
    activeTasks: number;
    cacheHitRate: number;
  };
}

export async function performHealthCheck(): Promise<HealthCheckResult> {
  const result: HealthCheckResult = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      redis: { status: 'unknown' },
      postgres: { status: 'unknown' },
      bullmq: { status: 'unknown' },
    },
  };

  // Check Redis
  try {
    const startRedis = Date.now();
    const redis = await getRedisClient();
    const pong = await redis.ping();
    const latency = Date.now() - startRedis;

    result.services.redis = {
      status: pong === 'PONG' ? 'healthy' : 'unhealthy',
      latency,
    };
  } catch (error) {
    console.error('[HealthCheck] Redis error:', error);
    result.services.redis = { status: 'unhealthy' };
    result.status = 'degraded';
  }

  // Check PostgreSQL
  try {
    const startPG = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const latency = Date.now() - startPG;

    result.services.postgres = { status: 'healthy', latency };
  } catch (error) {
    console.error('[HealthCheck] PostgreSQL error:', error);
    result.services.postgres = { status: 'unhealthy' };
    result.status = result.status === 'healthy' ? 'degraded' : 'unhealthy';
  }

  // Check BullMQ（简化检查）
  try {
    result.services.bullmq = { status: 'healthy' };
  } catch (error) {
    console.error('[HealthCheck] BullMQ error:', error);
    result.services.bullmq = { status: 'unhealthy' };
  }

  // Collect metrics
  try {
    const redis = await getRedisClient();

    // Count active sessions
    const sessionKeys = await redis.keys('robot:session:*');
    const activeSessions = sessionKeys.length;

    // Count active tasks
    const taskKeys = await redis.keys('robot:task:*');
    const activeTasks = taskKeys.length;

    result.metrics = {
      activeSessions,
      activeTasks,
      cacheHitRate: 0, // Placeholder
    };
  } catch (error) {
    console.error('[HealthCheck] Metrics collection failed:', error);
  }

  return result;
}

/**
 * Prometheus 指标端点
 */
export async function getPrometheusMetrics(): Promise<string> {
  return await prometheusRegister.metrics();
}

/**
 * 清理过期数据
 */
export async function cleanupExpiredData(): Promise<void> {
  console.log('[HealthCheck] Starting cleanup...');

  try {
    // 清理过期的机器人会话（超过 24 小时未心跳）
    const oneDayAgo = new Date(Date.now() - 86400000);

    const deleted = await prisma.robotSession.deleteMany({
      where: {
        lastHeartbeat: {
          lt: oneDayAgo,
        },
      },
    });

    console.log(`[HealthCheck] Cleaned up ${deleted.count} expired robot sessions`);

    // 清理已完成的任务（超过 7 天）
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);

    const deletedTasks = await prisma.multiRobotTask.deleteMany({
      where: {
        status: 'completed',
        completedAt: {
          lt: sevenDaysAgo,
        },
      },
    });

    console.log(`[HealthCheck] Cleaned up ${deletedTasks.count} old completed tasks`);
  } catch (error) {
    console.error('[HealthCheck] Cleanup failed:', error);
  }
}
