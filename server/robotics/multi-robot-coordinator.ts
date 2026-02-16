/**
 * Multi-Robot Coordinator
 *
 * 复用 agentCollaboration 的 multi_agent_sync 功能
 * 实现多机器人协同任务分配和执行
 */

import type { MultiRobotTask, RobotAssignment, RobotInfo } from './types';
import { nanoid } from 'nanoid';

export class MultiRobotCoordinator {
  private tasks: Map<string, MultiRobotTask> = new Map();
  private robots: Map<string, RobotInfo> = new Map();
  private apiBaseUrl: string;

  constructor(apiBaseUrl: string) {
    this.apiBaseUrl = apiBaseUrl;
  }

  /**
   * 注册机器人
   */
  registerRobot(robotInfo: RobotInfo): void {
    this.robots.set(robotInfo.robotId, robotInfo);
    console.log(`[MultiRobotCoordinator] Robot registered: ${robotInfo.robotId} (${robotInfo.model})`);
  }

  /**
   * 更新机器人状态
   */
  updateRobotStatus(robotId: string, updates: Partial<RobotInfo>): void {
    const robot = this.robots.get(robotId);
    if (robot) {
      Object.assign(robot, updates);
      robot.lastSeen = new Date();
    }
  }

  /**
   * 创建多机器人任务
   */
  async createTask(
    name: string,
    description: string,
    robotIds: string[],
    userId: number,
    mcpToken: string
  ): Promise<MultiRobotTask> {
    // 验证机器人是否在线
    const availableRobots = robotIds.filter((id) => {
      const robot = this.robots.get(id);
      return robot && robot.status === 'online';
    });

    if (availableRobots.length === 0) {
      throw new Error('No available robots for this task');
    }

    const taskId = `task_${nanoid()}`;

    // 使用 multi_agent_sync 进行任务分解
    const taskDecomposition = await this.decomposeTask(description, availableRobots, mcpToken);

    const task: MultiRobotTask = {
      taskId,
      name,
      description,
      robotIds: availableRobots,
      status: 'pending',
      assignments: taskDecomposition,
      createdAt: new Date(),
    };

    this.tasks.set(taskId, task);

    console.log(`[MultiRobotCoordinator] Task created: ${taskId} with ${availableRobots.length} robots`);

    return task;
  }

  /**
   * 任务分解（复用 multi_agent_sync）
   */
  private async decomposeTask(
    description: string,
    robotIds: string[],
    mcpToken: string
  ): Promise<RobotAssignment[]> {
    try {
      // 调用 agentCollaboration.syncDecision
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
              robotCapabilities: robotIds.map((id) => ({
                robotId: id,
                capabilities: this.robots.get(id)?.capabilities || [],
              })),
            },
            votingStrategy: 'consensus',
          },
        }),
      });

      if (!response.ok) {
        console.warn('[MultiRobotCoordinator] multi_agent_sync failed, using fallback');
        return this.fallbackDecomposition(description, robotIds);
      }

      const result = await response.json();

      // 解析 AI 分解结果
      return this.parseDecomposition(result, robotIds);
    } catch (error) {
      console.error('[MultiRobotCoordinator] Error in task decomposition:', error);
      return this.fallbackDecomposition(description, robotIds);
    }
  }

  /**
   * 解析 AI 分解结果
   */
  private parseDecomposition(aiResult: any, robotIds: string[]): RobotAssignment[] {
    // 从 AI 结果中提取子任务
    const subtasks = aiResult.result?.subtasks || aiResult.data?.subtasks || [];

    return robotIds.map((robotId, index) => ({
      robotId,
      subtask: subtasks[index] || `Subtask ${index + 1} for ${robotId}`,
      status: 'pending',
    }));
  }

  /**
   * 备用分解策略（简单平均分配）
   */
  private fallbackDecomposition(description: string, robotIds: string[]): RobotAssignment[] {
    return robotIds.map((robotId, index) => ({
      robotId,
      subtask: `${description} - Part ${index + 1} of ${robotIds.length}`,
      status: 'pending',
    }));
  }

  /**
   * 执行任务
   */
  async executeTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    task.status = 'in_progress';

    console.log(`[MultiRobotCoordinator] Executing task ${taskId}`);

    // 并行分配子任务给各个机器人
    const promises = task.assignments.map((assignment) =>
      this.assignSubtask(assignment).catch((error) => {
        console.error(`[MultiRobotCoordinator] Subtask failed for ${assignment.robotId}:`, error);
        assignment.status = 'failed';
      })
    );

    await Promise.all(promises);

    // 检查整体任务状态
    const allCompleted = task.assignments.every((a) => a.status === 'completed');
    const anyFailed = task.assignments.some((a) => a.status === 'failed');

    if (allCompleted) {
      task.status = 'completed';
      task.completedAt = new Date();
      console.log(`[MultiRobotCoordinator] Task ${taskId} completed successfully`);
    } else if (anyFailed) {
      task.status = 'failed';
      console.log(`[MultiRobotCoordinator] Task ${taskId} failed`);
    }
  }

  /**
   * 分配子任务给机器人
   */
  private async assignSubtask(assignment: RobotAssignment): Promise<void> {
    assignment.status = 'in_progress';

    // 模拟任务执行（实际环境中会通过 ROS2 发送指令）
    console.log(`[MultiRobotCoordinator] Assigning to ${assignment.robotId}: ${assignment.subtask}`);

    // 这里可以调用 ROS2 Bridge 发送具体指令
    // await ros2Bridge.processROS2Message(assignment.robotId, { ... });

    // 模拟延迟
    await new Promise((resolve) => setTimeout(resolve, 2000));

    assignment.status = 'completed';
    assignment.result = {
      success: true,
      completedAt: new Date(),
    };
  }

  /**
   * 获取任务状态
   */
  getTask(taskId: string): MultiRobotTask | null {
    return this.tasks.get(taskId) || null;
  }

  /**
   * 获取机器人状态
   */
  getRobot(robotId: string): RobotInfo | null {
    return this.robots.get(robotId) || null;
  }

  /**
   * 列出所有在线机器人
   */
  listOnlineRobots(): RobotInfo[] {
    return Array.from(this.robots.values()).filter((r) => r.status === 'online');
  }

  /**
   * 列出所有任务
   */
  listTasks(status?: MultiRobotTask['status']): MultiRobotTask[] {
    const allTasks = Array.from(this.tasks.values());
    if (status) {
      return allTasks.filter((t) => t.status === status);
    }
    return allTasks;
  }

  /**
   * 取消任务
   */
  async cancelTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (task && task.status === 'in_progress') {
      task.status = 'failed';
      task.assignments.forEach((a) => {
        if (a.status === 'in_progress') {
          a.status = 'failed';
        }
      });

      console.log(`[MultiRobotCoordinator] Task ${taskId} cancelled`);
    }
  }
}

// 单例实例
let coordinatorInstance: MultiRobotCoordinator | null = null;

export function getMultiRobotCoordinator(apiBaseUrl: string): MultiRobotCoordinator {
  if (!coordinatorInstance) {
    coordinatorInstance = new MultiRobotCoordinator(apiBaseUrl);
  }
  return coordinatorInstance;
}
