/**
 * Production-Ready ROS2 Bridge
 *
 * 优化：
 * - Redis 缓存和会话存储
 * - 速率限制
 * - Prometheus 监控
 * - 错误重试
 * - 健康检查
 */

import type { RobotCapabilities, RobotSession, ROS2Message } from './types';
import { getRedisClient } from './redis-client';
import { prisma } from '../db-prisma';
import { Counter, Histogram, Gauge } from 'prom-client';

// Prometheus 指标
const robotAuthCounter = new Counter({
  name: 'robot_authentications_total',
  help: 'Total robot authentications',
  labelNames: ['status', 'robot_id'],
});

const toolCallCounter = new Counter({
  name: 'robot_tool_calls_total',
  help: 'Total robot tool calls',
  labelNames: ['tool_name', 'status'],
});

const toolCallDuration = new Histogram({
  name: 'robot_tool_call_duration_ms',
  help: 'Robot tool call duration in milliseconds',
  labelNames: ['tool_name'],
  buckets: [10, 50, 100, 200, 500, 1000, 2000, 5000],
});

const cacheHitCounter = new Counter({
  name: 'robot_cache_hits_total',
  help: 'Total cache hits',
  labelNames: ['cache_type'],
});

const activeSessions = new Gauge({
  name: 'robot_active_sessions',
  help: 'Number of active robot sessions',
});

export class ROS2BridgeProduction {
  private apiBaseUrl: string;
  private readonly SESSION_TTL = 86400; // 24 hours
  private readonly CACHE_TTL = 300; // 5 minutes
  private readonly RATE_LIMIT_WINDOW = 60; // 1 minute
  private readonly RATE_LIMIT_MAX = 100; // 100 requests/min

  constructor(apiBaseUrl: string) {
    this.apiBaseUrl = apiBaseUrl;
  }

  /**
   * 认证机器人（带 Redis 缓存）
   */
  async authenticateRobot(mcpToken: string, robotId: string): Promise<RobotSession> {
    const startTime = Date.now();

    try {
      const redis = await getRedisClient();

      // 1. 检查 Redis 缓存
      const cacheKey = `robot:session:${robotId}`;
      const cached = await redis.get(cacheKey);

      if (cached) {
        console.log(`[ROS2Bridge] Cache hit for robot ${robotId}`);
        cacheHitCounter.inc({ cache_type: 'session' });
        robotAuthCounter.inc({ status: 'cache_hit', robot_id: robotId });

        const session = JSON.parse(cached);
        activeSessions.inc();
        return session;
      }

      // 2. 调用 WebMCP 认证
      const response = await fetch(`${this.apiBaseUrl}/api/mcp/auth/verify`, {
        method: 'POST',
        headers: {
          'X-MCP-Token': mcpToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: mcpToken }),
      });

      if (!response.ok) {
        robotAuthCounter.inc({ status: 'failed', robot_id: robotId });
        throw new Error(`Authentication failed: ${response.statusText}`);
      }

      const authData = await response.json();

      const session: RobotSession = {
        robotId,
        sessionId: authData.sessionId,
        userId: authData.userId,
        capabilities: this.parseCapabilities(authData.capabilities),
        authenticatedAt: new Date(),
        lastHeartbeat: new Date(),
      };

      // 3. 写入 Redis（24 小时过期）
      await redis.setEx(cacheKey, this.SESSION_TTL, JSON.stringify(session));

      // 4. 写入数据库（异步，不阻塞）
      this.saveSessionToDatabase(session).catch((error) => {
        console.error('[ROS2Bridge] Failed to save session to database:', error);
      });

      robotAuthCounter.inc({ status: 'success', robot_id: robotId });
      activeSessions.inc();

      console.log(`[ROS2Bridge] Robot ${robotId} authenticated in ${Date.now() - startTime}ms`);

      return session;
    } catch (error: any) {
      robotAuthCounter.inc({ status: 'error', robot_id: robotId });
      throw error;
    }
  }

  /**
   * 调用 WebMCP 工具（带缓存和速率限制）
   */
  async callTool(robotId: string, toolName: string, args: any): Promise<any> {
    const startTime = Date.now();

    try {
      // 1. 速率限制检查
      await this.checkRateLimit(robotId, toolName);

      // 2. 检查缓存（只针对查询类工具）
      const isCacheable = ['search_vectors', 'retrieve_memories_rmc', 'get_memory_graph'].includes(toolName);

      if (isCacheable) {
        const cached = await this.getCachedToolResult(robotId, toolName, args);
        if (cached) {
          cacheHitCounter.inc({ cache_type: 'tool_result' });
          toolCallCounter.inc({ tool_name: toolName, status: 'cache_hit' });
          toolCallDuration.observe({ tool_name: toolName }, Date.now() - startTime);
          return cached;
        }
      }

      // 3. 执行工具调用
      const result = await this.executeToolCall(robotId, toolName, args);

      // 4. 缓存结果（查询类工具）
      if (isCacheable) {
        await this.cacheToolResult(robotId, toolName, args, result);
      }

      toolCallCounter.inc({ tool_name: toolName, status: 'success' });
      toolCallDuration.observe({ tool_name: toolName }, Date.now() - startTime);

      return result;
    } catch (error: any) {
      toolCallCounter.inc({ tool_name: toolName, status: 'error' });
      throw error;
    }
  }

  /**
   * 速率限制检查
   */
  private async checkRateLimit(robotId: string, toolName: string): Promise<void> {
    const redis = await getRedisClient();
    const rateLimitKey = `rate:${robotId}:${toolName}`;

    const count = await redis.incr(rateLimitKey);

    if (count === 1) {
      await redis.expire(rateLimitKey, this.RATE_LIMIT_WINDOW);
    }

    if (count > this.RATE_LIMIT_MAX) {
      throw new Error(`Rate limit exceeded: ${this.RATE_LIMIT_MAX} requests/${this.RATE_LIMIT_WINDOW}s`);
    }
  }

  /**
   * 获取缓存的工具结果
   */
  private async getCachedToolResult(robotId: string, toolName: string, args: any): Promise<any | null> {
    const redis = await getRedisClient();
    const cacheKey = `tool:${robotId}:${toolName}:${JSON.stringify(args)}`;

    const cached = await redis.get(cacheKey);
    return cached ? JSON.parse(cached) : null;
  }

  /**
   * 缓存工具结果
   */
  private async cacheToolResult(robotId: string, toolName: string, args: any, result: any): Promise<void> {
    const redis = await getRedisClient();
    const cacheKey = `tool:${robotId}:${toolName}:${JSON.stringify(args)}`;

    await redis.setEx(cacheKey, this.CACHE_TTL, JSON.stringify(result));
  }

  /**
   * 执行工具调用
   */
  private async executeToolCall(robotId: string, toolName: string, args: any): Promise<any> {
    const session = await this.getSession(robotId);
    if (!session) {
      throw new Error(`Robot ${robotId} not authenticated`);
    }

    let endpoint: string;
    let method: 'GET' | 'POST' = 'POST';

    switch (toolName) {
      case 'search_vectors':
        endpoint = '/api/mcp/discover';
        method = 'GET';
        break;

      case 'retrieve_memories_rmc':
        endpoint = '/api/trpc/memory.retrieveRMC';
        break;

      case 'create_memory':
        endpoint = '/api/trpc/memory.create';
        break;

      case 'get_memory_graph':
        endpoint = '/api/trpc/memory.getMemoryGraph';
        break;

      case 'multi_agent_sync':
        endpoint = '/api/trpc/agentCollaboration.syncDecision';
        break;

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }

    const response = await fetch(`${this.apiBaseUrl}${endpoint}`, {
      method,
      headers: {
        'Authorization': `Bearer ${session.sessionId}`,
        'Content-Type': 'application/json',
      },
      body: method === 'POST' ? JSON.stringify(args) : undefined,
    });

    if (!response.ok) {
      throw new Error(`Tool ${toolName} failed: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * 获取机器人会话
   */
  private async getSession(robotId: string): Promise<RobotSession | null> {
    const redis = await getRedisClient();
    const cacheKey = `robot:session:${robotId}`;

    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Fallback to database
    try {
      const dbSession = await prisma.robotSession.findUnique({
        where: { robotId },
      });

      if (dbSession) {
        // 恢复到 Redis
        await redis.setEx(cacheKey, this.SESSION_TTL, JSON.stringify(dbSession));
      }

      return dbSession as RobotSession | null;
    } catch (error) {
      console.error('[ROS2Bridge] Database query failed:', error);
      return null;
    }
  }

  /**
   * 保存会话到数据库（异步）
   */
  private async saveSessionToDatabase(session: RobotSession): Promise<void> {
    try {
      await prisma.robotSession.upsert({
        where: { robotId: session.robotId },
        create: {
          robotId: session.robotId,
          sessionId: session.sessionId,
          userId: session.userId,
          capabilities: session.capabilities as any,
          authenticatedAt: session.authenticatedAt,
          lastHeartbeat: session.lastHeartbeat,
        },
        update: {
          sessionId: session.sessionId,
          lastHeartbeat: new Date(),
        },
      });
    } catch (error) {
      console.error('[ROS2Bridge] Failed to save session:', error);
      // 不抛出错误，避免影响主流程
    }
  }

  /**
   * 心跳更新
   */
  async heartbeat(robotId: string): Promise<void> {
    const redis = await getRedisClient();
    const session = await this.getSession(robotId);

    if (session) {
      session.lastHeartbeat = new Date();
      await redis.setEx(`robot:session:${robotId}`, this.SESSION_TTL, JSON.stringify(session));
    }
  }

  /**
   * 断开连接
   */
  async disconnect(robotId: string): Promise<void> {
    const redis = await getRedisClient();
    await redis.del(`robot:session:${robotId}`);

    // 清理速率限制缓存
    const keys = await redis.keys(`rate:${robotId}:*`);
    if (keys.length > 0) {
      await redis.del(keys);
    }

    activeSessions.dec();

    console.log(`[ROS2Bridge] Robot ${robotId} disconnected`);
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<{ status: string; redis: boolean; postgres: boolean }> {
    let redisStatus = false;
    let postgresStatus = false;

    try {
      const redis = await getRedisClient();
      redisStatus = (await redis.ping()) === 'PONG';
    } catch (error) {
      console.error('[ROS2Bridge] Redis health check failed:', error);
    }

    try {
      await prisma.$queryRaw`SELECT 1`;
      postgresStatus = true;
    } catch (error) {
      console.error('[ROS2Bridge] PostgreSQL health check failed:', error);
    }

    return {
      status: redisStatus && postgresStatus ? 'healthy' : 'degraded',
      redis: redisStatus,
      postgres: postgresStatus,
    };
  }

  /**
   * 解析能力列表
   */
  private parseCapabilities(permissions: string[]): RobotCapabilities {
    return {
      canMove: permissions.includes('write') || permissions.includes('admin'),
      canSense: permissions.includes('read') || permissions.includes('admin'),
      canLearn: permissions.includes('write_with_confirmation') || permissions.includes('admin'),
      canCollaborate: permissions.includes('admin'),
    };
  }

  /**
   * 处理 ROS2 消息（保持与原版兼容）
   */
  async processROS2Message(robotId: string, message: ROS2Message): Promise<any> {
    switch (message.type) {
      case '/cmd_vel':
        return this.handleMotionCommand(robotId, message);
      case '/camera/image':
        return this.handleVisionInput(robotId, message);
      case '/audio/input':
        return this.handleAudioInput(robotId, message);
      case '/task/request':
        return this.handleTaskRequest(robotId, message);
      default:
        console.warn(`[ROS2Bridge] Unknown message type: ${message.type}`);
        return { success: false, error: 'Unknown message type' };
    }
  }

  private async handleMotionCommand(robotId: string, message: ROS2Message): Promise<any> {
    console.log(`[ROS2Bridge] Motion command for ${robotId}`);
    return { success: true, executed: true };
  }

  private async handleVisionInput(robotId: string, message: ROS2Message): Promise<any> {
    const { imageData, timestamp } = message.data;

    await this.callTool(robotId, 'create_memory', {
      content: `Visual observation at ${timestamp}`,
      memoryType: 'observation',
      metadata: { robotId, type: 'vision', timestamp, imageDataUrl: imageData },
    });

    return { success: true, stored: true };
  }

  private async handleAudioInput(robotId: string, message: ROS2Message): Promise<any> {
    const { audioText, timestamp } = message.data;

    await this.callTool(robotId, 'create_memory', {
      content: audioText,
      memoryType: 'conversation',
      metadata: { robotId, type: 'audio', timestamp },
    });

    return { success: true, text: audioText };
  }

  private async handleTaskRequest(robotId: string, message: ROS2Message): Promise<any> {
    const { task } = message.data;

    const memories = await this.callTool(robotId, 'retrieve_memories_rmc', {
      query: task,
      queryType: 'task',
      k: 5,
    });

    const vectors = await this.callTool(robotId, 'search_vectors', {
      query: task,
      limit: 3,
    });

    return {
      success: true,
      task,
      memories: memories.results || [],
      suggestedVectors: vectors.vectors || [],
    };
  }
}

// 单例实例
let bridgeInstance: ROS2BridgeProduction | null = null;

export function getROS2BridgeProduction(apiBaseUrl: string): ROS2BridgeProduction {
  if (!bridgeInstance) {
    bridgeInstance = new ROS2BridgeProduction(apiBaseUrl);
  }
  return bridgeInstance;
}
