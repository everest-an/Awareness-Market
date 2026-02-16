/**
 * Robot Memory Manager
 *
 * 复用 RMC (Relational Memory Core) 为机器人提供长期记忆
 * - 场景记忆：记住环境和物体
 * - 任务记忆：记住执行过的任务
 * - 交互记忆：记住与人和其他机器人的互动
 */

import type { RobotMemory } from './types';

export class RobotMemoryManager {
  private apiBaseUrl: string;

  constructor(apiBaseUrl: string) {
    this.apiBaseUrl = apiBaseUrl;
  }

  /**
   * 创建机器人记忆（复用 RMC memory.create）
   */
  async createMemory(
    robotId: string,
    content: string,
    memoryType: RobotMemory['memoryType'],
    metadata: RobotMemory['metadata'],
    mcpToken: string
  ): Promise<RobotMemory> {
    // 调用 RMC API
    const response = await fetch(`${this.apiBaseUrl}/api/trpc/memory.create`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mcpToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        json: {
          content,
          memoryType,
          metadata: {
            ...metadata,
            robotId,
            timestamp: metadata.timestamp || new Date(),
          },
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create memory: ${response.statusText}`);
    }

    const result = await response.json();

    const memory: RobotMemory = {
      memoryId: result.result?.data?.memoryId || `mem_${Date.now()}`,
      robotId,
      content,
      memoryType,
      metadata: {
        ...metadata,
        timestamp: metadata.timestamp || new Date(),
      },
      createdAt: new Date(),
    };

    console.log(`[RobotMemory] Memory created for robot ${robotId}: ${memory.memoryId}`);

    return memory;
  }

  /**
   * 检索相关记忆（复用 RMC retrieve_memories_rmc）
   */
  async retrieveMemories(
    robotId: string,
    query: string,
    memoryType?: RobotMemory['memoryType'],
    k: number = 5,
    mcpToken?: string
  ): Promise<RobotMemory[]> {
    // 调用 RMC 混合检索
    const response = await fetch(`${this.apiBaseUrl}/api/trpc/memory.retrieveRMC`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mcpToken || ''}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        json: {
          query,
          queryType: memoryType || 'semantic',
          k,
          filters: {
            robotId,
          },
        },
      }),
    });

    if (!response.ok) {
      console.warn('[RobotMemory] RMC retrieval failed, returning empty results');
      return [];
    }

    const result = await response.json();
    const memories = result.result?.data?.results || [];

    return memories.map((m: any) => ({
      memoryId: m.memoryId || m.id,
      robotId: m.metadata?.robotId || robotId,
      content: m.content,
      memoryType: m.memoryType || 'observation',
      metadata: m.metadata || {},
      createdAt: new Date(m.createdAt),
    }));
  }

  /**
   * 获取记忆图谱（复用 RMC memory.getMemoryGraph）
   */
  async getMemoryGraph(
    robotId: string,
    memoryId: string,
    mcpToken: string
  ): Promise<any> {
    const response = await fetch(`${this.apiBaseUrl}/api/trpc/memory.getMemoryGraph`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mcpToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        json: {
          memoryId,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to get memory graph: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * 场景记忆：机器人记住它看到的环境
   */
  async recordObservation(
    robotId: string,
    description: string,
    location: { x: number; y: number; z: number },
    confidence: number,
    mcpToken: string
  ): Promise<RobotMemory> {
    return await this.createMemory(
      robotId,
      `Observed: ${description} at location (${location.x}, ${location.y}, ${location.z})`,
      'observation',
      {
        location,
        timestamp: new Date(),
        confidence,
        entities: this.extractEntities(description),
      },
      mcpToken
    );
  }

  /**
   * 任务记忆：机器人记住执行过的任务
   */
  async recordTask(
    robotId: string,
    taskName: string,
    taskResult: 'success' | 'failure',
    details: string,
    mcpToken: string
  ): Promise<RobotMemory> {
    return await this.createMemory(
      robotId,
      `Task "${taskName}": ${taskResult}. ${details}`,
      'task',
      {
        timestamp: new Date(),
      } as any,
      mcpToken
    );
  }

  /**
   * 对话记忆：机器人记住与人或其他机器人的对话
   */
  async recordConversation(
    robotId: string,
    speaker: string,
    message: string,
    mcpToken: string
  ): Promise<RobotMemory> {
    return await this.createMemory(
      robotId,
      `${speaker}: ${message}`,
      'conversation',
      {
        timestamp: new Date(),
        entities: [speaker],
      },
      mcpToken
    );
  }

  /**
   * 事件记忆：机器人记住重要事件
   */
  async recordEvent(
    robotId: string,
    eventType: string,
    description: string,
    metadata: any,
    mcpToken: string
  ): Promise<RobotMemory> {
    return await this.createMemory(
      robotId,
      `Event [${eventType}]: ${description}`,
      'event',
      {
        timestamp: new Date(),
        ...metadata,
      },
      mcpToken
    );
  }

  /**
   * 回忆相似场景（基于位置和描述）
   */
  async recallSimilarScenarios(
    robotId: string,
    currentLocation: { x: number; y: number; z: number },
    currentDescription: string,
    mcpToken: string
  ): Promise<RobotMemory[]> {
    const query = `Similar to: ${currentDescription} near (${currentLocation.x}, ${currentLocation.y})`;

    return await this.retrieveMemories(robotId, query, 'observation', 5, mcpToken);
  }

  /**
   * 回忆与人的互动
   */
  async recallInteractionsWithPerson(
    robotId: string,
    personName: string,
    mcpToken: string
  ): Promise<RobotMemory[]> {
    return await this.retrieveMemories(robotId, personName, 'conversation', 10, mcpToken);
  }

  /**
   * 提取实体（简单版，生产环境应使用 RMC Entity Extractor）
   */
  private extractEntities(text: string): string[] {
    // 简单的关键词提取
    const commonWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'at', 'in', 'on']);
    const words = text.toLowerCase().split(/\W+/).filter((w) => w.length > 2 && !commonWords.has(w));

    return Array.from(new Set(words)).slice(0, 5);
  }

  /**
   * 总结机器人的记忆统计
   */
  async getMemoryStats(robotId: string, mcpToken: string): Promise<any> {
    // 可以扩展为调用 RMC 的统计 API
    return {
      robotId,
      totalMemories: 0, // 需要从数据库查询
      memoryTypes: {
        observation: 0,
        conversation: 0,
        task: 0,
        event: 0,
      },
      recentMemories: [],
    };
  }
}

// 单例实例
let memoryManagerInstance: RobotMemoryManager | null = null;

export function getRobotMemoryManager(apiBaseUrl: string): RobotMemoryManager {
  if (!memoryManagerInstance) {
    memoryManagerInstance = new RobotMemoryManager(apiBaseUrl);
  }
  return memoryManagerInstance;
}
