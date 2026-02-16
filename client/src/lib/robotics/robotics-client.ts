/**
 * Robotics Client for Frontend
 *
 * 机器人中间件前端客户端
 * 调用 tRPC API 与后端通信
 */

import { trpc } from '../trpc';
import type { RobotInfo, RobotSession, MultiRobotTask, VRSession, RobotMemory } from '../../../../server/robotics/types';

// Cast trpc for robotics router not yet in AppRouter (legacy v1/v2)
const trpcClient = trpc as any;

export class RoboticsClient {
  /**
   * 健康检查
   */
  async healthCheck() {
    const result = await trpcClient.robotics.health.query();
    return result;
  }

  /**
   * 获取 Prometheus 指标
   */
  async getMetrics() {
    const result = await trpcClient.robotics.metrics.query();
    return result.metrics;
  }

  /**
   * 机器人认证
   */
  async authenticateRobot(mcpToken: string, robotId: string): Promise<RobotSession> {
    const result = await trpcClient.robotics.authenticateRobot.mutate({
      mcpToken,
      robotId,
    });

    if (!result.success) {
      throw new Error('Robot authentication failed');
    }

    return result.data;
  }

  /**
   * 注册机器人
   */
  async registerRobot(robotInfo: {
    robotId: string;
    name: string;
    type: 'quadruped' | 'humanoid' | 'wheeled' | 'arm' | 'other';
    manufacturer: 'unitree' | 'boston_dynamics' | 'other';
    model: string;
    capabilities: string[];
    status: 'online' | 'offline' | 'busy' | 'error';
    location?: { x: number; y: number; z: number };
    battery?: number;
  }): Promise<RobotInfo> {
    const result = await trpcClient.robotics.registerRobot.mutate(robotInfo);

    if (!result.success) {
      throw new Error('Robot registration failed');
    }

    return result.data;
  }

  /**
   * 获取机器人状态
   */
  async getRobotStatus(robotId: string): Promise<RobotInfo> {
    const result = await trpcClient.robotics.getRobotStatus.query({ robotId });

    if (!result.success) {
      throw new Error(`Robot ${robotId} not found`);
    }

    return result.data;
  }

  /**
   * 列出在线机器人
   */
  async listOnlineRobots(): Promise<RobotInfo[]> {
    const result = await trpcClient.robotics.listOnlineRobots.query();

    if (!result.success) {
      throw new Error('Failed to list online robots');
    }

    return result.data;
  }

  /**
   * 调用机器人工具
   */
  async callTool(robotId: string, toolName: string, args: any): Promise<any> {
    const result = await trpcClient.robotics.callTool.mutate({
      robotId,
      toolName,
      args,
    });

    if (!result.success) {
      throw new Error(`Tool ${toolName} failed`);
    }

    return result.data;
  }

  /**
   * 创建多机器人任务
   */
  async createTask(
    name: string,
    description: string,
    robotIds: string[],
    mcpToken: string
  ): Promise<MultiRobotTask> {
    const result = await trpcClient.robotics.createTask.mutate({
      name,
      description,
      robotIds,
      mcpToken,
    });

    if (!result.success) {
      throw new Error('Failed to create task');
    }

    return result.data;
  }

  /**
   * 执行任务
   */
  async executeTask(taskId: string): Promise<void> {
    const result = await trpcClient.robotics.executeTask.mutate({ taskId });

    if (!result.success) {
      throw new Error('Task execution failed');
    }
  }

  /**
   * 获取任务状态
   */
  async getTaskStatus(taskId: string): Promise<MultiRobotTask> {
    const result = await trpcClient.robotics.getTaskStatus.query({ taskId });

    if (!result.success) {
      throw new Error(`Task ${taskId} not found`);
    }

    return result.data;
  }

  /**
   * 列出任务
   */
  async listTasks(status?: 'pending' | 'in_progress' | 'completed' | 'failed'): Promise<MultiRobotTask[]> {
    const result = await trpcClient.robotics.listTasks.query({ status });

    if (!result.success) {
      throw new Error('Failed to list tasks');
    }

    return result.data;
  }

  /**
   * 取消任务
   */
  async cancelTask(taskId: string): Promise<void> {
    const result = await trpcClient.robotics.cancelTask.mutate({ taskId });

    if (!result.success) {
      throw new Error('Failed to cancel task');
    }
  }

  /**
   * 创建 VR 控制会话
   */
  async createVRSession(robotId: string, mcpToken: string): Promise<VRSession> {
    const result = await trpcClient.robotics.createVRSession.mutate({
      robotId,
      mcpToken,
    });

    if (!result.success) {
      throw new Error('Failed to create VR session');
    }

    return result.data;
  }

  /**
   * 终止 VR 会话
   */
  async terminateVRSession(sessionId: string): Promise<void> {
    const result = await trpcClient.robotics.terminateVRSession.mutate({ sessionId });

    if (!result.success) {
      throw new Error('Failed to terminate VR session');
    }
  }

  /**
   * 获取 VR 会话状态
   */
  async getVRSession(sessionId: string): Promise<VRSession> {
    const result = await trpcClient.robotics.getVRSession.query({ sessionId });

    if (!result.success) {
      throw new Error(`VR session ${sessionId} not found`);
    }

    return result.data;
  }

  /**
   * 列出活跃的 VR 会话
   */
  async listActiveSessions(): Promise<VRSession[]> {
    const result = await trpcClient.robotics.listActiveSessions.query();

    if (!result.success) {
      throw new Error('Failed to list active VR sessions');
    }

    return result.data;
  }

  /**
   * 记录机器人观察
   */
  async recordObservation(
    robotId: string,
    description: string,
    location: { x: number; y: number; z: number },
    confidence: number,
    mcpToken: string
  ): Promise<RobotMemory> {
    const result = await trpcClient.robotics.recordObservation.mutate({
      robotId,
      description,
      location,
      confidence,
      mcpToken,
    });

    if (!result.success) {
      throw new Error('Failed to record observation');
    }

    return result.data;
  }

  /**
   * 检索机器人记忆
   */
  async retrieveMemories(
    robotId: string,
    query: string,
    memoryType?: 'observation' | 'conversation' | 'task' | 'event',
    k: number = 5
  ): Promise<RobotMemory[]> {
    const result = await trpcClient.robotics.retrieveMemories.query({
      robotId,
      query,
      memoryType,
      k,
    });

    if (!result.success) {
      throw new Error('Failed to retrieve memories');
    }

    return result.data;
  }

  /**
   * 记录任务执行
   */
  async recordTask(
    robotId: string,
    taskName: string,
    taskResult: 'success' | 'failure',
    details: string,
    mcpToken: string
  ): Promise<RobotMemory> {
    const result = await trpcClient.robotics.recordTask.mutate({
      robotId,
      taskName,
      taskResult,
      details,
      mcpToken,
    });

    if (!result.success) {
      throw new Error('Failed to record task');
    }

    return result.data;
  }

  /**
   * 记录对话
   */
  async recordConversation(
    robotId: string,
    speaker: string,
    message: string,
    mcpToken: string
  ): Promise<RobotMemory> {
    const result = await trpcClient.robotics.recordConversation.mutate({
      robotId,
      speaker,
      message,
      mcpToken,
    });

    if (!result.success) {
      throw new Error('Failed to record conversation');
    }

    return result.data;
  }

  /**
   * 回忆相似场景
   */
  async recallSimilarScenarios(
    robotId: string,
    currentLocation: { x: number; y: number; z: number },
    currentDescription: string,
    mcpToken: string
  ): Promise<RobotMemory[]> {
    const result = await trpcClient.robotics.recallSimilarScenarios.query({
      robotId,
      currentLocation,
      currentDescription,
      mcpToken,
    });

    if (!result.success) {
      throw new Error('Failed to recall similar scenarios');
    }

    return result.data;
  }
}

// 导出单例
export const roboticsClient = new RoboticsClient();
