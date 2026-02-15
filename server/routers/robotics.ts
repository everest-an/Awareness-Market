/**
 * Robotics tRPC Router
 *
 * 机器人中间件 API 端点
 * 复用 WebMCP、RMC、Multi-Agent 功能
 */

import { router, publicProcedure, protectedProcedure } from '../_core/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
// Production imports
import { getROS2BridgeProduction } from '../robotics/ros2-bridge-production';
import { getMultiRobotCoordinatorProduction } from '../robotics/multi-robot-coordinator-production';
import { getRobotMemoryManager } from '../robotics/robot-memory';
import { performHealthCheck, getPrometheusMetrics } from '../robotics/health-check';

// Legacy imports (fallback)
import { getROS2Bridge } from '../robotics/ros2-bridge';
import { getVRController } from '../robotics/vr-controller';
import { getMultiRobotCoordinator } from '../robotics/multi-robot-coordinator';

const API_BASE_URL = process.env.API_URL || 'http://localhost:5000';
const USE_PRODUCTION = process.env.NODE_ENV === 'production' || process.env.ROBOTICS_USE_PRODUCTION === 'true';

// 根据环境选择实现
const getBridge = USE_PRODUCTION ? getROS2BridgeProduction : getROS2Bridge;
const getCoordinator = USE_PRODUCTION ? getMultiRobotCoordinatorProduction : getMultiRobotCoordinator;

export const roboticsRouter = router({
  /**
   * 健康检查
   */
  health: publicProcedure.query(async () => {
    const healthCheck = await performHealthCheck();
    return healthCheck;
  }),

  /**
   * Prometheus 指标
   */
  metrics: publicProcedure.query(async () => {
    const metrics = await getPrometheusMetrics();
    return { metrics };
  }),

  /**
   * 机器人认证（复用 WebMCP）- 生产级
   */
  authenticateRobot: publicProcedure
    .input(z.object({
      mcpToken: z.string(),
      robotId: z.string(),
    }))
    .mutation(async ({ input }) => {
      const bridge = getBridge(API_BASE_URL);

      try {
        const session = await bridge.authenticateRobot(input.mcpToken, input.robotId);
        return { success: true, data: session };
      } catch (error: any) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: error.message || 'Robot authentication failed',
        });
      }
    }),

  /**
   * 注册机器人
   */
  registerRobot: publicProcedure
    .input(z.object({
      robotId: z.string(),
      name: z.string(),
      type: z.enum(['quadruped', 'humanoid', 'wheeled', 'arm', 'other']),
      manufacturer: z.enum(['unitree', 'boston_dynamics', 'other']),
      model: z.string(),
      capabilities: z.array(z.string()),
      status: z.enum(['online', 'offline', 'busy', 'error']),
      location: z.object({
        x: z.number(),
        y: z.number(),
        z: z.number(),
      }).optional(),
      battery: z.number().min(0).max(100).optional(),
    }))
    .mutation(async ({ input }) => {
      const coordinator = getCoordinator(API_BASE_URL);

      const robotInfo = {
        ...input,
        lastSeen: new Date(),
      };

      coordinator.registerRobot(robotInfo);

      return { success: true, data: robotInfo };
    }),

  /**
   * 获取机器人状态
   */
  getRobotStatus: publicProcedure
    .input(z.object({
      robotId: z.string(),
    }))
    .query(async ({ input }) => {
      const coordinator = getCoordinator(API_BASE_URL);

      const robot = coordinator.getRobot(input.robotId);

      if (!robot) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Robot ${input.robotId} not found`,
        });
      }

      return { success: true, data: robot };
    }),

  /**
   * 列出在线机器人
   */
  listOnlineRobots: publicProcedure.query(async () => {
    const coordinator = getMultiRobotCoordinator(API_BASE_URL);

    const robots = coordinator.listOnlineRobots();

    return { success: true, data: robots };
  }),

  /**
   * 调用机器人工具（复用 WebMCP Tools）
   */
  callTool: protectedProcedure
    .input(z.object({
      robotId: z.string(),
      toolName: z.string(),
      args: z.any(),
    }))
    .mutation(async ({ input }) => {
      const bridge = getBridge(API_BASE_URL);

      try {
        const result = await bridge.callTool(input.robotId, input.toolName, input.args);
        return { success: true, data: result };
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || `Tool ${input.toolName} failed`,
        });
      }
    }),

  /**
   * 创建多机器人任务（复用 Multi-Agent）
   */
  createTask: protectedProcedure
    .input(z.object({
      name: z.string(),
      description: z.string(),
      robotIds: z.array(z.string()),
      mcpToken: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const coordinator = getCoordinator(API_BASE_URL);

      try {
        const task = await coordinator.createTask(
          input.name,
          input.description,
          input.robotIds,
          ctx.user.id,
          input.mcpToken
        );

        return { success: true, data: task };
      } catch (error: any) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message || 'Failed to create task',
        });
      }
    }),

  /**
   * 执行任务
   */
  executeTask: protectedProcedure
    .input(z.object({
      taskId: z.string(),
    }))
    .mutation(async ({ input }) => {
      const coordinator = getCoordinator(API_BASE_URL);

      try {
        await coordinator.executeTask(input.taskId);
        return { success: true };
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Task execution failed',
        });
      }
    }),

  /**
   * 获取任务状态
   */
  getTaskStatus: publicProcedure
    .input(z.object({
      taskId: z.string(),
    }))
    .query(async ({ input }) => {
      const coordinator = getCoordinator(API_BASE_URL);

      const task = coordinator.getTask(input.taskId);

      if (!task) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Task ${input.taskId} not found`,
        });
      }

      return { success: true, data: task };
    }),

  /**
   * 列出任务
   */
  listTasks: publicProcedure
    .input(z.object({
      status: z.enum(['pending', 'in_progress', 'completed', 'failed']).optional(),
    }))
    .query(async ({ input }) => {
      const coordinator = getCoordinator(API_BASE_URL);

      const tasks = coordinator.listTasks(input.status);

      return { success: true, data: tasks };
    }),

  /**
   * 取消任务
   */
  cancelTask: protectedProcedure
    .input(z.object({
      taskId: z.string(),
    }))
    .mutation(async ({ input }) => {
      const coordinator = getCoordinator(API_BASE_URL);

      await coordinator.cancelTask(input.taskId);

      return { success: true };
    }),

  /**
   * 创建 VR 控制会话
   */
  createVRSession: protectedProcedure
    .input(z.object({
      robotId: z.string(),
      mcpToken: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const vrController = getVRController();
      const bridge = getBridge(API_BASE_URL);

      // 验证机器人会话
      const robotSession = await bridge.authenticateRobot(input.mcpToken, input.robotId);

      try {
        const vrSession = await vrController.createVRSession(ctx.user.id, input.robotId, robotSession);
        return { success: true, data: vrSession };
      } catch (error: any) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message || 'Failed to create VR session',
        });
      }
    }),

  /**
   * 终止 VR 会话
   */
  terminateVRSession: protectedProcedure
    .input(z.object({
      sessionId: z.string(),
    }))
    .mutation(async ({ input }) => {
      const vrController = getVRController();

      await vrController.terminateSession(input.sessionId);

      return { success: true };
    }),

  /**
   * 获取 VR 会话状态
   */
  getVRSession: publicProcedure
    .input(z.object({
      sessionId: z.string(),
    }))
    .query(async ({ input }) => {
      const vrController = getVRController();

      const session = vrController.getVRSession(input.sessionId);

      if (!session) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `VR session ${input.sessionId} not found`,
        });
      }

      return { success: true, data: session };
    }),

  /**
   * 列出活跃的 VR 会话
   */
  listActiveSessions: publicProcedure.query(async () => {
    const vrController = getVRController();

    const sessions = vrController.listActiveSessions();

    return { success: true, data: sessions };
  }),

  /**
   * 记录机器人观察（复用 RMC）
   */
  recordObservation: protectedProcedure
    .input(z.object({
      robotId: z.string(),
      description: z.string(),
      location: z.object({
        x: z.number(),
        y: z.number(),
        z: z.number(),
      }),
      confidence: z.number().min(0).max(1),
      mcpToken: z.string(),
    }))
    .mutation(async ({ input }) => {
      const memoryManager = getRobotMemoryManager(API_BASE_URL);

      try {
        const memory = await memoryManager.recordObservation(
          input.robotId,
          input.description,
          input.location,
          input.confidence,
          input.mcpToken
        );

        return { success: true, data: memory };
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Failed to record observation',
        });
      }
    }),

  /**
   * 检索机器人记忆（复用 RMC）
   */
  retrieveMemories: publicProcedure
    .input(z.object({
      robotId: z.string(),
      query: z.string(),
      memoryType: z.enum(['observation', 'conversation', 'task', 'event']).optional(),
      k: z.number().min(1).max(50).default(5),
    }))
    .query(async ({ input }) => {
      const memoryManager = getRobotMemoryManager(API_BASE_URL);

      const memories = await memoryManager.retrieveMemories(
        input.robotId,
        input.query,
        input.memoryType,
        input.k
      );

      return { success: true, data: memories };
    }),

  /**
   * 记录任务执行（复用 RMC）
   */
  recordTask: protectedProcedure
    .input(z.object({
      robotId: z.string(),
      taskName: z.string(),
      taskResult: z.enum(['success', 'failure']),
      details: z.string(),
      mcpToken: z.string(),
    }))
    .mutation(async ({ input }) => {
      const memoryManager = getRobotMemoryManager(API_BASE_URL);

      const memory = await memoryManager.recordTask(
        input.robotId,
        input.taskName,
        input.taskResult,
        input.details,
        input.mcpToken
      );

      return { success: true, data: memory };
    }),

  /**
   * 记录对话（复用 RMC）
   */
  recordConversation: protectedProcedure
    .input(z.object({
      robotId: z.string(),
      speaker: z.string(),
      message: z.string(),
      mcpToken: z.string(),
    }))
    .mutation(async ({ input }) => {
      const memoryManager = getRobotMemoryManager(API_BASE_URL);

      const memory = await memoryManager.recordConversation(
        input.robotId,
        input.speaker,
        input.message,
        input.mcpToken
      );

      return { success: true, data: memory };
    }),

  /**
   * 回忆相似场景（复用 RMC）
   */
  recallSimilarScenarios: publicProcedure
    .input(z.object({
      robotId: z.string(),
      currentLocation: z.object({
        x: z.number(),
        y: z.number(),
        z: z.number(),
      }),
      currentDescription: z.string(),
      mcpToken: z.string(),
    }))
    .query(async ({ input }) => {
      const memoryManager = getRobotMemoryManager(API_BASE_URL);

      const memories = await memoryManager.recallSimilarScenarios(
        input.robotId,
        input.currentLocation,
        input.currentDescription,
        input.mcpToken
      );

      return { success: true, data: memories };
    }),
});

export type RoboticsRouter = typeof roboticsRouter;
