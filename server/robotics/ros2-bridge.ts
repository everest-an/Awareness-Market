/**
 * ROS2 Bridge for Robotics Integration
 *
 * 复用 WebMCP 工具和 RMC 记忆系统，为机器人提供 AI 能力
 * 支持宇树（Unitree）和其他 ROS2 机器人
 */

import type { RobotCapabilities, RobotSession, ROS2Message } from './types';

export class ROS2Bridge {
  private sessions: Map<string, RobotSession> = new Map();
  private apiBaseUrl: string;

  constructor(apiBaseUrl: string) {
    this.apiBaseUrl = apiBaseUrl;
  }

  /**
   * 机器人认证（复用 WebMCP 认证）
   */
  async authenticateRobot(mcpToken: string, robotId: string): Promise<RobotSession> {
    // 复用 WebMCP 认证端点
    const response = await fetch(`${this.apiBaseUrl}/api/mcp/auth/verify`, {
      method: 'POST',
      headers: {
        'X-MCP-Token': mcpToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token: mcpToken }),
    });

    if (!response.ok) {
      throw new Error(`Robot authentication failed: ${response.statusText}`);
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

    this.sessions.set(robotId, session);
    console.log(`[ROS2Bridge] Robot ${robotId} authenticated successfully`);

    return session;
  }

  /**
   * 调用 WebMCP 工具（search_vectors, retrieve_memories_rmc, etc.）
   */
  async callTool(robotId: string, toolName: string, args: any): Promise<any> {
    const session = this.sessions.get(robotId);
    if (!session) {
      throw new Error(`Robot ${robotId} not authenticated`);
    }

    // 复用 WebMCP Tools（在 client/src/lib/webmcp/tools.ts 中定义）
    // 直接调用后端 API 端点
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
   * ROS2 消息转换为 AI 指令
   */
  async processROS2Message(robotId: string, message: ROS2Message): Promise<any> {
    const session = this.sessions.get(robotId);
    if (!session) {
      throw new Error(`Robot ${robotId} not authenticated`);
    }

    // 根据消息类型分发到不同的处理器
    switch (message.type) {
      case '/cmd_vel': // 运动控制
        return this.handleMotionCommand(robotId, message);

      case '/camera/image': // 视觉输入
        return this.handleVisionInput(robotId, message);

      case '/audio/input': // 语音输入
        return this.handleAudioInput(robotId, message);

      case '/task/request': // 任务请求（需要 AI 推理）
        return this.handleTaskRequest(robotId, message);

      default:
        console.warn(`[ROS2Bridge] Unknown message type: ${message.type}`);
        return { success: false, error: 'Unknown message type' };
    }
  }

  /**
   * 处理任务请求（使用 RMC 记忆检索）
   */
  private async handleTaskRequest(robotId: string, message: ROS2Message): Promise<any> {
    const { task, context } = message.data;

    // 1. 使用 RMC 检索相关记忆
    const memories = await this.callTool(robotId, 'retrieve_memories_rmc', {
      query: task,
      queryType: 'task',
      k: 5,
    });

    // 2. 搜索相关向量能力
    const vectors = await this.callTool(robotId, 'search_vectors', {
      query: task,
      limit: 3,
    });

    // 3. 返回 AI 推理结果
    return {
      success: true,
      task,
      memories: memories.results || [],
      suggestedVectors: vectors.vectors || [],
      recommendedAction: this.generateAction(task, memories, vectors),
    };
  }

  /**
   * 处理视觉输入
   */
  private async handleVisionInput(robotId: string, message: ROS2Message): Promise<any> {
    const { imageData, timestamp } = message.data;

    // 创建视觉记忆（复用 RMC）
    await this.callTool(robotId, 'create_memory', {
      content: `Visual observation at ${timestamp}`,
      memoryType: 'observation',
      metadata: {
        robotId,
        type: 'vision',
        timestamp,
        imageDataUrl: imageData, // Base64 encoded
      },
    });

    return { success: true, stored: true };
  }

  /**
   * 处理语音输入
   */
  private async handleAudioInput(robotId: string, message: ROS2Message): Promise<any> {
    const { audioText, timestamp } = message.data;

    // 创建对话记忆
    await this.callTool(robotId, 'create_memory', {
      content: audioText,
      memoryType: 'conversation',
      metadata: {
        robotId,
        type: 'audio',
        timestamp,
      },
    });

    return { success: true, text: audioText };
  }

  /**
   * 处理运动控制
   */
  private async handleMotionCommand(robotId: string, message: ROS2Message): Promise<any> {
    const { linear, angular } = message.data;

    // 记录运动轨迹（可选）
    console.log(`[ROS2Bridge] Robot ${robotId} moving: linear=${linear}, angular=${angular}`);

    return { success: true, executed: true };
  }

  /**
   * 生成推荐动作
   */
  private generateAction(task: string, memories: any, vectors: any): string {
    // 简单逻辑：基于记忆和向量推荐
    if (memories.results?.length > 0) {
      return `Based on previous experience: ${memories.results[0].content}`;
    }

    if (vectors.vectors?.length > 0) {
      return `Suggest using vector: ${vectors.vectors[0].title}`;
    }

    return 'No recommendation available. Request human assistance.';
  }

  /**
   * 心跳保持
   */
  async heartbeat(robotId: string): Promise<void> {
    const session = this.sessions.get(robotId);
    if (session) {
      session.lastHeartbeat = new Date();
    }
  }

  /**
   * 获取机器人状态
   */
  getRobotStatus(robotId: string): RobotSession | null {
    return this.sessions.get(robotId) || null;
  }

  /**
   * 断开连接
   */
  disconnect(robotId: string): void {
    this.sessions.delete(robotId);
    console.log(`[ROS2Bridge] Robot ${robotId} disconnected`);
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
}

// 单例实例
let bridgeInstance: ROS2Bridge | null = null;

export function getROS2Bridge(apiBaseUrl: string): ROS2Bridge {
  if (!bridgeInstance) {
    bridgeInstance = new ROS2Bridge(apiBaseUrl);
  }
  return bridgeInstance;
}
