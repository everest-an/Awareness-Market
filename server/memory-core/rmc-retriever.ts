/**
 * RMC Retriever (Relational Memory Core Retriever)
 *
 * 混合检索引擎：向量检索 + 图谱游走 + 推理路径发现
 * 为多 AI 协作提供关联推理能力
 */

import { PrismaClient } from '@prisma/client';
import type { RelationType } from './relation-builder';
import { embeddingService } from '../latentmas/embedding-service';

export interface MemoryNode {
  id: string;
  content: string;
  agentId: string;
  confidence: number;
  createdAt: Date;
  entities?: any;
  similarity?: number;      // 向量相似度
  depth?: number;           // 在图谱中的深度
}

export interface RelationEdge {
  source: string;
  target: string;
  type: string;
  strength: number;
  reason?: string;
}

export interface InferencePath {
  type: 'causal_chain' | 'contradiction_resolution' | 'multi_hop_support' | 'temporal_sequence';
  nodes: MemoryNode[];
  edges: RelationEdge[];
  description: string;
  confidence: number;       // 路径置信度
}

export interface GraphContext {
  memories: MemoryNode[];
  relations: RelationEdge[];
}

export interface RetrievalResult {
  directMatches: MemoryNode[];       // 向量检索的直接匹配
  relatedContext: GraphContext;      // 图谱扩展的相关上下文
  inferencePaths: InferencePath[];   // 发现的推理路径
  summary: string;                   // 检索结果总结
}

export interface RetrievalOptions {
  maxDepth?: number;                 // 图谱游走深度 (默认 2)
  relationTypes?: RelationType[];    // 关注的关系类型
  agentFilter?: string[];            // 只检索特定 AI 的记忆
  includeInferencePaths?: boolean;   // 是否计算推理路径 (默认 true)
  minConfidence?: number;            // 最小置信度阈值
}

export class RMCRetriever {
  constructor(private prisma: PrismaClient) {}

  /**
   * 混合检索：向量 + 图谱 + 推理
   */
  async retrieve(query: string, options?: RetrievalOptions): Promise<RetrievalResult> {
    const opts = this.normalizeOptions(options);

    console.log(`[RMCRetriever] Retrieving for query: "${query}"`);
    console.log(`[RMCRetriever] Options:`, opts);

    // Step 1: 向量检索（直觉层）
    const directMatches = await this.vectorSearch(query, opts);
    console.log(`[RMCRetriever] Found ${directMatches.length} direct matches`);

    // Step 2: 图谱扩展（推理层）
    const relatedContext = await this.expandGraph(directMatches, opts);
    console.log(`[RMCRetriever] Expanded graph: ${relatedContext.memories.length} memories, ${relatedContext.relations.length} relations`);

    // Step 3: 推理路径发现
    let inferencePaths: InferencePath[] = [];
    if (opts.includeInferencePaths) {
      inferencePaths = this.findInferencePaths(directMatches, relatedContext, opts);
      console.log(`[RMCRetriever] Found ${inferencePaths.length} inference paths`);
    }

    // Step 4: 生成总结
    const summary = this.generateSummary(directMatches, relatedContext, inferencePaths);

    return {
      directMatches,
      relatedContext,
      inferencePaths,
      summary,
    };
  }

  /**
   * 向量检索（基于 pgvector）
   */
  private async vectorSearch(
    query: string,
    options: Required<RetrievalOptions>
  ): Promise<MemoryNode[]> {
    const queryEmbedding = await this.generateEmbedding(query);
    // pgvector 需要字符串格式 '[1,2,3]'::vector
    const vectorStr = `[${queryEmbedding.join(',')}]`;

    let results: any[];

    if (options.agentFilter && options.agentFilter.length > 0) {
      results = await this.prisma.$queryRaw<any[]>`
        SELECT id, content, agent_id as "agentId", confidence, created_at as "createdAt", entities,
               1 - (embedding <=> ${vectorStr}::vector) as similarity
        FROM memory_entries
        WHERE is_latest = true
          AND confidence >= ${options.minConfidence}
          AND agent_id = ANY(${options.agentFilter})
        ORDER BY embedding <=> ${vectorStr}::vector
        LIMIT 5
      `;
    } else {
      results = await this.prisma.$queryRaw<any[]>`
        SELECT id, content, agent_id as "agentId", confidence, created_at as "createdAt", entities,
               1 - (embedding <=> ${vectorStr}::vector) as similarity
        FROM memory_entries
        WHERE is_latest = true
          AND confidence >= ${options.minConfidence}
        ORDER BY embedding <=> ${vectorStr}::vector
        LIMIT 5
      `;
    }

    return results.map((r) => ({
      id: r.id,
      content: r.content,
      agentId: r.agentId || 'unknown',
      confidence: r.confidence,
      createdAt: r.createdAt,
      entities: r.entities,
      similarity: r.similarity,
      depth: 0,
    }));
  }

  /**
   * 图谱扩展（BFS 游走）
   */
  private async expandGraph(
    startNodes: MemoryNode[],
    options: Required<RetrievalOptions>
  ): Promise<GraphContext> {
    const visited = new Set<string>();
    const memories = new Map<string, MemoryNode>();
    const relations: RelationEdge[] = [];

    // 初始化
    startNodes.forEach((node) => {
      memories.set(node.id, node);
      visited.add(node.id);
    });

    // BFS 队列
    const queue = startNodes.map((n) => ({ nodeId: n.id, depth: 0 }));

    while (queue.length > 0) {
      const { nodeId, depth } = queue.shift()!;

      if (depth >= options.maxDepth) continue;

      // 查找邻居（只关注特定关系类型）
      const neighbors = await this.getNeighbors(nodeId, options.relationTypes);

      for (const neighbor of neighbors) {
        // 记录边
        relations.push({
          source: nodeId,
          target: neighbor.memory.id,
          type: neighbor.relationType,
          strength: neighbor.strength,
          reason: neighbor.reason,
        });

        // 如果未访问过，加入队列
        if (!visited.has(neighbor.memory.id)) {
          visited.add(neighbor.memory.id);
          memories.set(neighbor.memory.id, {
            ...neighbor.memory,
            depth: depth + 1,
          });
          queue.push({ nodeId: neighbor.memory.id, depth: depth + 1 });
        }
      }
    }

    return {
      memories: Array.from(memories.values()),
      relations,
    };
  }

  /**
   * 获取邻居节点（通过关系连接的记忆）
   */
  private async getNeighbors(
    memoryId: string,
    relationTypes: RelationType[]
  ): Promise<
    Array<{
      memory: MemoryNode;
      relationType: string;
      strength: number;
      reason?: string;
    }>
  > {
    const relations = await this.prisma.memoryRelation.findMany({
      where: {
        sourceMemoryId: memoryId,
        relationType: {
          in: relationTypes,
        },
      },
      include: {
        targetMemory: {
          select: {
            id: true,
            content: true,
            agentId: true,
            confidence: true,
            createdAt: true,
          },
        },
      },
    });

    return relations.map((r) => ({
      memory: {
        id: r.targetMemory.id,
        content: r.targetMemory.content,
        agentId: r.targetMemory.agentId || 'unknown',
        confidence: r.targetMemory.confidence.toNumber(),
        createdAt: r.targetMemory.createdAt,
      },
      relationType: r.relationType,
      strength: r.strength.toNumber(),
      reason: r.reason || undefined,
    }));
  }

  /**
   * 推理路径发现
   */
  private findInferencePaths(
    startNodes: MemoryNode[],
    graph: GraphContext,
    options: Required<RetrievalOptions>
  ): InferencePath[] {
    const paths: InferencePath[] = [];

    // 类型 1: 因果链（A -> CAUSES -> B -> CAUSES -> C）
    const causalPaths = this.findCausalChains(startNodes, graph);
    paths.push(...causalPaths);

    // 类型 2: 矛盾解决（A CONTRADICTS B，需要决策）
    const contradictionPaths = this.findContradictions(startNodes, graph);
    paths.push(...contradictionPaths);

    // 类型 3: 多跳支持（A <- SUPPORTS <- B <- SUPPORTS <- C）
    const supportPaths = this.findSupportChains(startNodes, graph);
    paths.push(...supportPaths);

    // 按置信度排序
    return paths.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * 查找因果链
   */
  private findCausalChains(startNodes: MemoryNode[], graph: GraphContext): InferencePath[] {
    const paths: InferencePath[] = [];

    for (const start of startNodes) {
      const chains = this.dfs(
        start.id,
        graph,
        ['CAUSES', 'IMPACTS'],
        3  // 最多 3 跳
      );

      for (const chain of chains) {
        if (chain.length >= 2) {
          const nodes = chain.map((id) => graph.memories.find((m) => m.id === id)!).filter(Boolean);
          const edges = this.extractEdges(chain, graph);

          paths.push({
            type: 'causal_chain',
            nodes,
            edges,
            description: this.describeCausalChain(nodes),
            confidence: this.calculatePathConfidence(nodes, edges),
          });
        }
      }
    }

    return paths;
  }

  /**
   * 查找矛盾
   */
  private findContradictions(startNodes: MemoryNode[], graph: GraphContext): InferencePath[] {
    const paths: InferencePath[] = [];

    const contradictionEdges = graph.relations.filter((r) => r.type === 'CONTRADICTS');

    for (const edge of contradictionEdges) {
      const nodeA = graph.memories.find((m) => m.id === edge.source);
      const nodeB = graph.memories.find((m) => m.id === edge.target);

      if (nodeA && nodeB) {
        paths.push({
          type: 'contradiction_resolution',
          nodes: [nodeA, nodeB],
          edges: [edge],
          description: `Contradiction: "${nodeA.content.substring(0, 50)}..." vs "${nodeB.content.substring(0, 50)}..."`,
          confidence: edge.strength,
        });
      }
    }

    return paths;
  }

  /**
   * 查找支持链
   */
  private findSupportChains(startNodes: MemoryNode[], graph: GraphContext): InferencePath[] {
    const paths: InferencePath[] = [];

    for (const start of startNodes) {
      const chains = this.dfs(start.id, graph, ['SUPPORTS'], 2);

      for (const chain of chains) {
        if (chain.length >= 2) {
          const nodes = chain.map((id) => graph.memories.find((m) => m.id === id)!).filter(Boolean);
          const edges = this.extractEdges(chain, graph);

          paths.push({
            type: 'multi_hop_support',
            nodes,
            edges,
            description: `${nodes.length}-hop support chain`,
            confidence: this.calculatePathConfidence(nodes, edges),
          });
        }
      }
    }

    return paths;
  }

  /**
   * DFS 图谱遍历
   */
  private dfs(
    startId: string,
    graph: GraphContext,
    relationTypes: string[],
    maxDepth: number,
    visited: Set<string> = new Set(),
    currentPath: string[] = []
  ): string[][] {
    if (currentPath.length >= maxDepth || visited.has(startId)) {
      return [currentPath];
    }

    visited.add(startId);
    currentPath.push(startId);

    const outgoingEdges = graph.relations.filter(
      (r) => r.source === startId && relationTypes.includes(r.type)
    );

    if (outgoingEdges.length === 0) {
      return [currentPath];
    }

    const allPaths: string[][] = [];
    for (const edge of outgoingEdges) {
      const subPaths = this.dfs(
        edge.target,
        graph,
        relationTypes,
        maxDepth,
        new Set(visited),
        [...currentPath]
      );
      allPaths.push(...subPaths);
    }

    return allPaths;
  }

  /**
   * 提取路径中的边
   */
  private extractEdges(path: string[], graph: GraphContext): RelationEdge[] {
    const edges: RelationEdge[] = [];

    for (let i = 0; i < path.length - 1; i++) {
      const edge = graph.relations.find((r) => r.source === path[i] && r.target === path[i + 1]);
      if (edge) edges.push(edge);
    }

    return edges;
  }

  /**
   * 描述因果链
   */
  private describeCausalChain(nodes: MemoryNode[]): string {
    const concepts = nodes.map((n) => n.content.substring(0, 30));
    return `Causal Chain: ${concepts.join(' → ')}`;
  }

  /**
   * 计算路径置信度
   */
  private calculatePathConfidence(nodes: MemoryNode[], edges: RelationEdge[]): number {
    const avgNodeConfidence = nodes.reduce((sum, n) => sum + n.confidence, 0) / nodes.length;
    const avgEdgeStrength = edges.reduce((sum, e) => sum + e.strength, 0) / edges.length;

    return (avgNodeConfidence + avgEdgeStrength) / 2;
  }

  /**
   * 生成检索总结
   */
  private generateSummary(
    directMatches: MemoryNode[],
    relatedContext: GraphContext,
    inferencePaths: InferencePath[]
  ): string {
    let summary = `Retrieved ${directMatches.length} direct matches`;

    if (relatedContext.memories.length > directMatches.length) {
      summary += `, expanded to ${relatedContext.memories.length} memories via graph traversal`;
    }

    if (inferencePaths.length > 0) {
      summary += `, discovered ${inferencePaths.length} inference paths`;
    }

    return summary;
  }

  /**
   * 生成查询向量（调用 embedding service，无 API key 时自动降级到本地语义向量）
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    const result = await embeddingService.embed({ text, model: 'text-embedding-3-small' });
    return result.vector;
  }

  /**
   * 规范化选项
   */
  private normalizeOptions(options?: RetrievalOptions): Required<RetrievalOptions> {
    return {
      maxDepth: options?.maxDepth ?? 2,
      relationTypes: (options?.relationTypes ?? ['CAUSES', 'SUPPORTS', 'IMPACTS', 'CONTRADICTS']) as any,
      agentFilter: options?.agentFilter ?? [],
      includeInferencePaths: options?.includeInferencePaths ?? true,
      minConfidence: options?.minConfidence ?? 0.5,
    };
  }
}

/**
 * 工厂函数
 */
export function createRMCRetriever(prisma: PrismaClient): RMCRetriever {
  return new RMCRetriever(prisma);
}
