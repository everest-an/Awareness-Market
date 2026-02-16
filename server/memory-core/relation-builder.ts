/**
 * Relation Builder
 *
 * 模拟 RMC 的 Attention(Memory, Memory)
 * 自动发现并建立记忆之间的关系
 */

import { PrismaClient } from '@prisma/client';
import { OpenAI } from 'openai';
import type { Entity } from './entity-extractor';

export enum RelationType {
  CAUSES = 'CAUSES',                    // 因果关系: A 导致 B
  CONTRADICTS = 'CONTRADICTS',          // 矛盾关系: A 与 B 冲突
  SUPPORTS = 'SUPPORTS',                // 支持关系: A 支持 B
  TEMPORAL_BEFORE = 'TEMPORAL_BEFORE',  // 时序: A 发生在 B 之前
  TEMPORAL_AFTER = 'TEMPORAL_AFTER',    // 时序: A 发生在 B 之后
  DERIVED_FROM = 'DERIVED_FROM',        // 派生: A 派生自 B
  PART_OF = 'PART_OF',                  // 部分-整体: A 是 B 的一部分
  SIMILAR_TO = 'SIMILAR_TO',            // 相似: A 与 B 相似
  IMPACTS = 'IMPACTS',                  // 影响: A 影响 B
}

export interface RelationInferenceResult {
  type: RelationType | 'NONE';
  strength: number;      // 0-1
  reason: string;        // 推理原因
  confidence: number;    // 推理置信度
}

export interface CandidateMemory {
  id: string;
  content: string;
  entities?: any;
  createdAt: Date;
  agentId: string;
  similarity?: number;   // 向量相似度
}

export class RelationBuilder {
  private openai: OpenAI | null;
  private enabled: boolean;

  constructor(private prisma: PrismaClient) {
    this.enabled = !!process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'sk-dummy';

    if (this.enabled) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    } else {
      this.openai = null;
      console.warn('[RelationBuilder] OpenAI API key not configured, using rule-based relations');
    }
  }

  /**
   * 为新记忆构建关系
   * （异步调用，不阻塞主流程）
   */
  async buildRelations(memoryId: string): Promise<number> {
    console.log(`[RelationBuilder] Building relations for memory ${memoryId}`);

    try {
      // Step 1: 获取新记忆
      const newMemory = await this.getMemory(memoryId);
      if (!newMemory) {
        console.error('[RelationBuilder] Memory not found:', memoryId);
        return 0;
      }

      // Step 2: 找候选记忆（两种策略）
      const candidates = await this.findCandidates(newMemory);
      console.log(`[RelationBuilder] Found ${candidates.length} candidate memories`);

      // Step 3: 对每个候选推理关系
      let relationsCreated = 0;

      for (const candidate of candidates) {
        const relation = await this.inferRelation(newMemory, candidate);

        if (relation.type !== 'NONE' && relation.confidence >= 0.6) {
          // Step 4: 存入数据库
          await this.saveRelation({
            sourceMemoryId: memoryId,
            targetMemoryId: candidate.id,
            relationType: relation.type,
            strength: relation.strength,
            reason: relation.reason,
            inferredBy: this.enabled ? 'llm' : 'rule',
          });

          relationsCreated++;
        }
      }

      console.log(`[RelationBuilder] Created ${relationsCreated} relations for memory ${memoryId}`);
      return relationsCreated;
    } catch (error) {
      console.error('[RelationBuilder] Error building relations:', error);
      return 0;
    }
  }

  /**
   * 找候选记忆
   * 策略 1: 向量相似度（Top-K）
   * 策略 2: 实体共现（相同实体的记忆）
   */
  private async findCandidates(
    memory: CandidateMemory & { embedding?: number[] }
  ): Promise<CandidateMemory[]> {
    const candidates = new Map<string, CandidateMemory>();

    // 策略 1: 向量相似度检索（Top-5）
    if (memory.embedding) {
      try {
        const vectorResults = await this.prisma.$queryRaw<any[]>`
          SELECT id, content, entities, created_at as "createdAt", agent_id as "agentId",
                 1 - (embedding <=> ${memory.embedding}::vector) as similarity
          FROM memory_entries
          WHERE id != ${memory.id}
            AND is_latest = true
          ORDER BY embedding <=> ${memory.embedding}::vector
          LIMIT 5
        `;

        vectorResults.forEach((r) => candidates.set(r.id, r));
      } catch (error) {
        console.warn('[RelationBuilder] Vector search failed:', error);
      }
    }

    // 策略 2: 实体共现（相同实体的记忆）
    if (memory.entities && Array.isArray(memory.entities) && memory.entities.length > 0) {
      const entityNames = memory.entities.map((e: Entity) => e.name);

      const entityResults = await this.prisma.memoryEntry.findMany({
        where: {
          id: { not: memory.id },
          isLatest: true,
        },
        select: {
          id: true,
          content: true,
          createdAt: true,
          agentId: true,
        },
        take: 5,
      });

      entityResults.forEach((r) =>
        candidates.set(r.id, {
          ...r,
          agentId: r.agentId || 'unknown',
        })
      );
    }

    // 策略 3: 时序邻近（最近的记忆）
    const recentResults = await this.prisma.memoryEntry.findMany({
      where: {
        id: { not: memory.id },
        isLatest: true,
        createdAt: {
          gte: new Date(memory.createdAt.getTime() - 24 * 60 * 60 * 1000), // 24 小时内
        },
      },
      select: {
        id: true,
        content: true,
        createdAt: true,
        agentId: true,
      },
      take: 3,
      orderBy: { createdAt: 'desc' },
    });

    recentResults.forEach((r) =>
      candidates.set(r.id, {
        ...r,
        agentId: r.agentId || 'unknown',
      })
    );

    return Array.from(candidates.values());
  }

  /**
   * 推理两个记忆之间的关系
   */
  private async inferRelation(
    memoryA: CandidateMemory,
    memoryB: CandidateMemory
  ): Promise<RelationInferenceResult> {
    if (!this.enabled || !this.openai) {
      return this.inferRelationWithRules(memoryA, memoryB);
    }

    try {
      return await this.inferRelationWithLLM(memoryA, memoryB);
    } catch (error) {
      console.error('[RelationBuilder] LLM inference failed, using rules:', error);
      return this.inferRelationWithRules(memoryA, memoryB);
    }
  }

  /**
   * 使用 LLM 推理关系（准确）
   */
  private async inferRelationWithLLM(
    memoryA: CandidateMemory,
    memoryB: CandidateMemory
  ): Promise<RelationInferenceResult> {
    const prompt = `分析以下两段记忆的关系。

记忆 A (来自 ${memoryA.agentId}，时间: ${memoryA.createdAt.toISOString()}):
"""
${memoryA.content}
"""

记忆 B (来自 ${memoryB.agentId}，时间: ${memoryB.createdAt.toISOString()}):
"""
${memoryB.content}
"""

请判断它们的关系类型：
- CAUSES: A 导致 B（因果关系）
- CONTRADICTS: A 与 B 矛盾（冲突关系）
- SUPPORTS: A 支持 B（增强关系）
- TEMPORAL_BEFORE: A 发生在 B 之前（时序关系）
- IMPACTS: A 影响 B（影响关系）
- SIMILAR_TO: A 与 B 相似（相似关系）
- NONE: 无明显关系

输出严格的 JSON 格式（不要 markdown 代码块）：
{
  "type": "CAUSES",
  "strength": 0.85,
  "reason": "技术突破导致成本降低",
  "confidence": 0.9
}

其中：
- type: 关系类型
- strength: 关系强度 (0-1)，1 表示强因果/强矛盾
- reason: 简短解释（一句话）
- confidence: 推理置信度 (0-1)`;

    const response = await this.openai!.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert in reasoning and knowledge graph construction. Output only valid JSON.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 200,
    });

    const content = response.choices[0].message.content || '{}';
    const jsonText = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const result = JSON.parse(jsonText);

    return {
      type: result.type || 'NONE',
      strength: result.strength || 0.5,
      reason: result.reason || 'No specific reason provided',
      confidence: result.confidence || 0.5,
    };
  }

  /**
   * 使用规则推理关系（快速 fallback）
   */
  private inferRelationWithRules(
    memoryA: CandidateMemory,
    memoryB: CandidateMemory
  ): RelationInferenceResult {
    // 规则 1: 时序关系
    if (memoryA.createdAt < memoryB.createdAt) {
      return {
        type: RelationType.TEMPORAL_BEFORE,
        strength: 0.8,
        reason: 'A occurred before B',
        confidence: 0.9,
      };
    }

    // 规则 2: 向量相似度 > 0.8 -> 相似关系
    if (memoryA.similarity && memoryA.similarity > 0.8) {
      return {
        type: RelationType.SIMILAR_TO,
        strength: memoryA.similarity,
        reason: 'High vector similarity',
        confidence: 0.7,
      };
    }

    // 规则 3: 实体重叠 > 50% -> 部分关系
    const entitiesA = new Set((memoryA.entities || []).map((e: Entity) => e.name));
    const entitiesB = new Set((memoryB.entities || []).map((e: Entity) => e.name));
    const overlap = [...entitiesA].filter((e) => entitiesB.has(e)).length;
    const overlapRatio = overlap / Math.max(entitiesA.size, entitiesB.size);

    if (overlapRatio > 0.5) {
      return {
        type: RelationType.PART_OF,
        strength: overlapRatio,
        reason: 'Shared entities',
        confidence: 0.6,
      };
    }

    // 默认：无关系
    return {
      type: 'NONE',
      strength: 0,
      reason: 'No clear relation detected',
      confidence: 0.5,
    };
  }

  /**
   * 保存关系到数据库
   */
  private async saveRelation(relation: {
    sourceMemoryId: string;
    targetMemoryId: string;
    relationType: string;
    strength: number;
    reason: string;
    inferredBy: string;
  }) {
    await this.prisma.memoryRelation.create({
      data: {
        sourceMemoryId: relation.sourceMemoryId,
        targetMemoryId: relation.targetMemoryId,
        relationType: relation.relationType,
        strength: relation.strength,
        reason: relation.reason,
        inferredBy: relation.inferredBy,
      },
    });
  }

  /**
   * 获取记忆详情
   */
  private async getMemory(memoryId: string): Promise<(CandidateMemory & { embedding?: number[] }) | null> {
    const memory = await this.prisma.memoryEntry.findUnique({
      where: { id: memoryId },
      select: {
        id: true,
        content: true,
        createdAt: true,
        agentId: true,
      },
    });

    if (!memory) return null;

    return {
      ...memory,
      agentId: memory.agentId || 'unknown',
    };
  }
}

/**
 * 工厂函数
 */
export function createRelationBuilder(prisma: PrismaClient): RelationBuilder {
  return new RelationBuilder(prisma);
}
