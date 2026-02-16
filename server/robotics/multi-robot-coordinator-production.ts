/**
 * Production-Ready Multi-Robot Coordinator
 *
 * 优化：
 * - BullMQ 异步任务队列
 * - Redis 持久化
 * - PostgreSQL 任务记录
 * - 并发处理
 * - 失败重试
 */

import type { MultiRobotTask, RobotAssignment, RobotInfo } from './types';
import { nanoid } from 'nanoid';
import { Queue, Worker, Job } from 'bullmq';
import { getRedisClient } from './redis-client';
import { prisma } from '../db-prisma';
import { Counter, Gauge } from 'prom-client';

// Prometheus 指标
const tasksCreatedCounter = new Counter({
  name: 'robot_tasks_created_total',
  help: 'Total multi-robot tasks created',
});

const tasksCompletedCounter = new Counter({
  name: 'robot_tasks_completed_total',
  help: 'Total multi-robot tasks completed',
  labelNames: ['status'],
});

const activeTasksGauge = new Gauge({
  name: 'robot_active_tasks',
  help: 'Number of active multi-robot tasks',
});

export class MultiRobotCoordinatorProduction {
  private taskQueue: Queue;
  private taskWorker: Worker;
  private apiBaseUrl: string;

  constructor(apiBaseUrl: string) {
    this.apiBaseUrl = apiBaseUrl;

    // 创建 BullMQ 队列
    this.taskQueue = new Queue('multi-robot-tasks', {
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
    });

    // 创建 Worker（独立处理）
    this.taskWorker = new Worker(
      'multi-robot-tasks',
      async (job: Job) => {
        return await this.processTask(job);
      },
      {
        connection: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
        },
        concurrency: 5, // 并发处理 5 个任务
        limiter: {
          max: 10, // 最多 10 个任务/秒
          duration: 1000,
        },
      }
    );

    this.taskWorker.on('completed', (job) => {
      console.log(`[MultiRobotCoordinator] Task ${job.id} completed`);
      tasksCompletedCounter.inc({ status: 'completed' });
      activeTasksGauge.dec();
    });

    this.taskWorker.on('failed', (job, err) => {
      console.error(`[MultiRobotCoordinator] Task ${job?.id} failed:`, err);
      tasksCompletedCounter.inc({ status: 'failed' });
      activeTasksGauge.dec();
    });

    console.log('[MultiRobotCoordinator] Production version initialized with BullMQ');
  }

  /**
   * 注册机器人（Redis + PostgreSQL）
   */
  async registerRobot(robotInfo: RobotInfo): Promise<void> {
    const redis = await getRedisClient();

    // 写入 Redis
    const cacheKey = `robot:info:${robotInfo.robotId}`;
    await redis.setEx(cacheKey, 3600, JSON.stringify(robotInfo)); // 1 小时过期

    // 写入数据库（异步）
    this.saveRobotToDatabase(robotInfo).catch((error) => {
      console.error('[MultiRobotCoordinator] Failed to save robot to database:', error);
    });

    console.log(`[MultiRobotCoordinator] Robot registered: ${robotInfo.robotId}`);
  }

  /**
   * 创建多机器人任务（异步队列）
   */
  async createTask(
    name: string,
    description: string,
    robotIds: string[],
    userId: number,
    mcpToken: string
  ): Promise<MultiRobotTask> {
    // 验证机器人是否在线
    const availableRobots = await this.getAvailableRobots(robotIds);

    if (availableRobots.length === 0) {
      throw new Error('No available robots for this task');
    }

    const taskId = `task_${nanoid()}`;

    const task: MultiRobotTask = {
      taskId,
      name,
      description,
      robotIds: availableRobots.map((r) => r.robotId),
      status: 'pending',
      assignments: [], // 将在 Worker 中分解
      createdAt: new Date(),
    };

    // 添加到队列（非阻塞）
    await this.taskQueue.add(
      'execute-task',
      {
        taskId,
        name,
        description,
        robotIds: availableRobots.map((r) => r.robotId),
        userId,
        mcpToken,
      },
      {
        attempts: 3, // 失败重试 3 次
        backoff: {
          type: 'exponential',
          delay: 2000, // 初始延迟 2 秒
        },
      }
    );

    // 保存到数据库
    await this.saveTaskToDatabase(task);

    tasksCreatedCounter.inc();
    activeTasksGauge.inc();

    console.log(`[MultiRobotCoordinator] Task ${taskId} created and queued`);

    return task;
  }

  /**
   * 处理任务（Worker 执行）
   */
  private async processTask(job: Job): Promise<any> {
    const { taskId, description, robotIds, mcpToken } = job.data;

    console.log(`[MultiRobotCoordinator] Processing task ${taskId}`);

    // 1. 任务分解（复用 Multi-Agent）
    const assignments = await this.decomposeTask(description, robotIds, mcpToken);

    // 2. 更新任务状态
    await this.updateTaskStatus(taskId, 'in_progress', assignments);

    // 3. 并行执行子任务
    const results = await Promise.allSettled(
      assignments.map((assignment) => this.executeSubtask(assignment))
    );

    // 4. 检查结果
    const allCompleted = results.every((r) => r.status === 'fulfilled');
    const anyFailed = results.some((r) => r.status === 'rejected');

    const finalStatus = allCompleted ? 'completed' : anyFailed ? 'failed' : 'in_progress';

    // 5. 更新最终状态
    await this.updateTaskStatus(taskId, finalStatus, assignments);

    return {
      taskId,
      status: finalStatus,
      results: results.map((r, i) => ({
        robotId: assignments[i].robotId,
        status: r.status,
        result: r.status === 'fulfilled' ? (r as any).value : (r as any).reason,
      })),
    };
  }

  /**
   * 任务分解（复用 Multi-Agent Sync）
   */
  private async decomposeTask(
    description: string,
    robotIds: string[],
    mcpToken: string
  ): Promise<RobotAssignment[]> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/trpc/agentCollaboration.syncDecision`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${mcpToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          json: {
            decisionId: `decompose_${Date.now()}`,
            participantAgentIds: robotIds,
            context: {
              task: description,
              robotCapabilities: await this.getRobotCapabilities(robotIds),
            },
            votingStrategy: 'consensus',
          },
        }),
      });

      if (!response.ok) {
        console.warn('[MultiRobotCoordinator] Multi-agent sync failed, using fallback');
        return this.fallbackDecomposition(description, robotIds);
      }

      const result = await response.json();
      return this.parseDecomposition(result, robotIds);
    } catch (error) {
      console.error('[MultiRobotCoordinator] Task decomposition error:', error);
      return this.fallbackDecomposition(description, robotIds);
    }
  }

  /**
   * 执行子任务
   */
  private async executeSubtask(assignment: RobotAssignment): Promise<any> {
    assignment.status = 'in_progress';

    console.log(`[MultiRobotCoordinator] Executing subtask for ${assignment.robotId}: ${assignment.subtask}`);

    // 模拟任务执行（实际环境中会通过 ROS2 发送指令）
    await new Promise((resolve) => setTimeout(resolve, 1000));

    assignment.status = 'completed';
    assignment.result = {
      success: true,
      completedAt: new Date(),
    };

    return assignment;
  }

  /**
   * 获取机器人能力
   */
  private async getRobotCapabilities(robotIds: string[]): Promise<any[]> {
    const redis = await getRedisClient();

    const capabilities = await Promise.all(
      robotIds.map(async (robotId) => {
        const cached = await redis.get(`robot:info:${robotId}`);
        if (cached) {
          const robot = JSON.parse(cached) as RobotInfo;
          return {
            robotId,
            capabilities: robot.capabilities,
          };
        }
        return { robotId, capabilities: [] };
      })
    );

    return capabilities;
  }

  /**
   * 获取可用机器人
   */
  private async getAvailableRobots(robotIds: string[]): Promise<RobotInfo[]> {
    const redis = await getRedisClient();

    const robots = await Promise.all(
      robotIds.map(async (robotId) => {
        const cached = await redis.get(`robot:info:${robotId}`);
        if (cached) {
          return JSON.parse(cached) as RobotInfo;
        }
        return null;
      })
    );

    return robots.filter((r): r is RobotInfo => r !== null && r.status === 'online');
  }

  /**
   * 解析 AI 分解结果
   */
  private parseDecomposition(aiResult: any, robotIds: string[]): RobotAssignment[] {
    const subtasks = aiResult.result?.subtasks || aiResult.data?.subtasks || [];

    return robotIds.map((robotId, index) => ({
      robotId,
      subtask: subtasks[index] || `Subtask ${index + 1} for ${robotId}`,
      status: 'pending',
    }));
  }

  /**
   * 备用分解策略
   */
  private fallbackDecomposition(description: string, robotIds: string[]): RobotAssignment[] {
    return robotIds.map((robotId, index) => ({
      robotId,
      subtask: `${description} - Part ${index + 1} of ${robotIds.length}`,
      status: 'pending',
    }));
  }

  /**
   * 更新任务状态
   */
  private async updateTaskStatus(
    taskId: string,
    status: MultiRobotTask['status'],
    assignments?: RobotAssignment[]
  ): Promise<void> {
    const redis = await getRedisClient();

    // 更新 Redis
    const cacheKey = `robot:task:${taskId}`;
    const cached = await redis.get(cacheKey);

    if (cached) {
      const task = JSON.parse(cached) as MultiRobotTask;
      task.status = status;
      if (assignments) task.assignments = assignments;
      if (status === 'completed' || status === 'failed') {
        task.completedAt = new Date();
      }

      await redis.setEx(cacheKey, 86400, JSON.stringify(task)); // 24 hours
    }

    // 更新数据库（异步）
    this.updateTaskInDatabase(taskId, status, assignments).catch((error) => {
      console.error('[MultiRobotCoordinator] Failed to update task in database:', error);
    });
  }

  /**
   * 获取任务状态
   */
  async getTask(taskId: string): Promise<MultiRobotTask | null> {
    const redis = await getRedisClient();
    const cached = await redis.get(`robot:task:${taskId}`);

    if (cached) {
      return JSON.parse(cached);
    }

    // Fallback to database
    try {
      const dbTask = await prisma.multiRobotTask.findUnique({
        where: { taskId },
      });

      if (dbTask) {
        await redis.setEx(`robot:task:${taskId}`, 86400, JSON.stringify(dbTask));
      }

      return dbTask as MultiRobotTask | null;
    } catch (error) {
      console.error('[MultiRobotCoordinator] Database query failed:', error);
      return null;
    }
  }

  /**
   * 列出任务
   */
  async listTasks(status?: MultiRobotTask['status']): Promise<MultiRobotTask[]> {
    try {
      const where = status ? { status } : {};

      const tasks = await prisma.multiRobotTask.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 100,
      });

      return tasks as unknown as MultiRobotTask[];
    } catch (error) {
      console.error('[MultiRobotCoordinator] Failed to list tasks:', error);
      return [];
    }
  }

  /**
   * 取消任务
   */
  async cancelTask(taskId: string): Promise<void> {
    const job = await this.taskQueue.getJob(taskId);

    if (job) {
      await job.remove();
    }

    await this.updateTaskStatus(taskId, 'failed');

    console.log(`[MultiRobotCoordinator] Task ${taskId} cancelled`);
  }

  /**
   * 保存机器人到数据库
   */
  private async saveRobotToDatabase(robotInfo: RobotInfo): Promise<void> {
    try {
      await prisma.robotRegistry.upsert({
        where: { robotId: robotInfo.robotId },
        create: {
          robotId: robotInfo.robotId,
          name: robotInfo.name,
          type: robotInfo.type,
          manufacturer: robotInfo.manufacturer,
          model: robotInfo.model,
          capabilities: robotInfo.capabilities as any,
          status: robotInfo.status,
          location: robotInfo.location as any,
          battery: robotInfo.battery,
          lastSeen: robotInfo.lastSeen,
        },
        update: {
          status: robotInfo.status,
          location: robotInfo.location as any,
          battery: robotInfo.battery,
          lastSeen: new Date(),
        },
      });
    } catch (error) {
      console.error('[MultiRobotCoordinator] Failed to save robot:', error);
    }
  }

  /**
   * 保存任务到数据库
   */
  private async saveTaskToDatabase(task: MultiRobotTask): Promise<void> {
    try {
      await prisma.multiRobotTask.create({
        data: {
          taskId: task.taskId,
          name: task.name,
          description: task.description,
          robotIds: task.robotIds as any,
          status: task.status,
          assignments: task.assignments as any,
          createdAt: task.createdAt,
        },
      });
    } catch (error) {
      console.error('[MultiRobotCoordinator] Failed to save task:', error);
    }
  }

  /**
   * 更新任务到数据库
   */
  private async updateTaskInDatabase(
    taskId: string,
    status: MultiRobotTask['status'],
    assignments?: RobotAssignment[]
  ): Promise<void> {
    try {
      const data: any = { status };
      if (assignments) data.assignments = assignments;
      if (status === 'completed' || status === 'failed') {
        data.completedAt = new Date();
      }

      await prisma.multiRobotTask.update({
        where: { taskId },
        data,
      });
    } catch (error) {
      console.error('[MultiRobotCoordinator] Failed to update task:', error);
    }
  }

  /**
   * 关闭（清理资源）
   */
  async close(): Promise<void> {
    await this.taskWorker.close();
    await this.taskQueue.close();
    console.log('[MultiRobotCoordinator] Closed');
  }
}

// 单例实例
let coordinatorInstance: MultiRobotCoordinatorProduction | null = null;

export function getMultiRobotCoordinatorProduction(apiBaseUrl: string): MultiRobotCoordinatorProduction {
  if (!coordinatorInstance) {
    coordinatorInstance = new MultiRobotCoordinatorProduction(apiBaseUrl);
  }
  return coordinatorInstance;
}
