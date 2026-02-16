/**
 * Memory Pool Router — Pool-aware retrieval engine
 *
 * Implements 3-layer memory pool architecture:
 *   Private (agent-local) → Domain (department-shared) → Global (org-wide)
 *
 * Read order: Private first, then Domain, then Global
 * Token budget: limits total tokens returned across pools
 *
 * Reuses: rmc-retriever.ts (vector search), scoring-engine.ts (rerank)
 */

import type { PrismaClient } from '@prisma/client';
import { calculateFinalScore } from './scoring-engine';
import type { MemoryEntry as ScoringMemoryEntry } from './schema';

export type PoolType = 'private' | 'domain' | 'global';

export interface PoolRetrievalOptions {
  orgId: number;
  query: string;
  embedding?: number[];

  // Pool filtering
  pools?: PoolType[];          // Which pools to search (default: all 3)
  agentId?: string;            // Required for private pool
  departmentId?: number;       // Required for domain pool

  // Budget control
  maxTokens?: number;          // Total token budget across all pools (default: 4096)
  maxResults?: number;         // Max results per pool (default: 10)
  minScore?: number;           // Minimum score threshold (default: 0)
}

export interface PoolRetrievalResult {
  memories: PoolMemory[];
  poolBreakdown: {
    private: number;
    domain: number;
    global: number;
  };
  totalTokensUsed: number;
  truncated: boolean;
}

export interface PoolMemory {
  id: string;
  content: string;
  poolType: string;
  department: string | null;
  agentId: string | null;
  confidence: number;
  finalScore: number;
  memoryType: string;
  tokenEstimate: number;
  createdAt: Date;
}

/**
 * Estimate token count for a text string (~4 chars per token)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Convert Prisma MemoryEntry to scoring-compatible format
 */
function toScoringEntry(entry: any): ScoringMemoryEntry {
  return {
    id: entry.id,
    org_id: entry.orgId,
    namespace: entry.namespace,
    content_type: entry.contentType,
    content: entry.content,
    confidence: Number(entry.confidence),
    reputation: Number(entry.reputation),
    usage_count: entry.usageCount,
    validation_count: entry.validationCount,
    version: entry.version,
    is_latest: entry.isLatest,
    created_by: entry.createdBy,
    created_at: entry.createdAt,
    updated_at: entry.updatedAt,
    accessed_at: entry.accessedAt,
    decay_factor: Number(entry.decayFactor),
    decay_checkpoint: entry.decayCheckpoint,
  };
}

export class MemoryPoolRouter {
  constructor(private prisma: PrismaClient) {}

  /**
   * Retrieve memories across pools with priority ordering:
   * 1. Private pool (agent's own memories)
   * 2. Domain pool (department-shared)
   * 3. Global pool (org-wide promoted)
   */
  async retrieve(options: PoolRetrievalOptions): Promise<PoolRetrievalResult> {
    const {
      orgId,
      pools = ['private', 'domain', 'global'],
      agentId,
      departmentId,
      maxTokens = 4096,
      maxResults = 10,
      minScore = 0,
    } = options;

    const allMemories: PoolMemory[] = [];
    let tokensUsed = 0;
    let truncated = false;
    const breakdown = { private: 0, domain: 0, global: 0 };

    // Process pools in priority order
    for (const poolType of pools) {
      if (tokensUsed >= maxTokens) {
        truncated = true;
        break;
      }

      const remainingTokens = maxTokens - tokensUsed;
      const poolMemories = await this.queryPool(
        poolType,
        orgId,
        agentId,
        departmentId,
        maxResults,
        minScore
      );

      for (const mem of poolMemories) {
        const tokens = estimateTokens(mem.content);
        if (tokensUsed + tokens > maxTokens) {
          truncated = true;
          break;
        }

        allMemories.push(mem);
        tokensUsed += tokens;
        breakdown[poolType as keyof typeof breakdown]++;
      }
    }

    return {
      memories: allMemories,
      poolBreakdown: breakdown,
      totalTokensUsed: tokensUsed,
      truncated,
    };
  }

  /**
   * Query a specific pool
   */
  private async queryPool(
    poolType: PoolType,
    orgId: number,
    agentId?: string,
    departmentId?: number,
    limit: number = 10,
    minScore: number = 0,
  ): Promise<PoolMemory[]> {
    const where: any = {
      organizationId: orgId,
      poolType,
      isLatest: true,
    };

    // Pool-specific filters
    if (poolType === 'private') {
      if (!agentId) return []; // Can't query private without agentId
      where.agentId = agentId;
    } else if (poolType === 'domain') {
      if (departmentId) {
        where.department = departmentId.toString();
      }
    }
    // global: no additional filter needed

    const entries = await this.prisma.memoryEntry.findMany({
      where,
      include: { score: true },
      orderBy: { createdAt: 'desc' },
      take: limit * 2, // Fetch extra to filter by score
    });

    // Calculate scores and filter
    const scored: PoolMemory[] = entries
      .map((entry) => {
        const scoringEntry = toScoringEntry(entry);
        const finalScore = entry.score
          ? Number(entry.score.finalScore)
          : calculateFinalScore(scoringEntry);

        return {
          id: entry.id,
          content: entry.content,
          poolType: entry.poolType,
          department: entry.department,
          agentId: entry.agentId,
          confidence: Number(entry.confidence),
          finalScore,
          memoryType: entry.memoryType,
          tokenEstimate: estimateTokens(entry.content),
          createdAt: entry.createdAt,
        };
      })
      .filter((m) => m.finalScore >= minScore)
      .sort((a, b) => b.finalScore - a.finalScore)
      .slice(0, limit);

    return scored;
  }

  /**
   * Get pool stats for an organization
   */
  async getPoolStats(orgId: number) {
    const [privateCount, domainCount, globalCount] = await Promise.all([
      this.prisma.memoryEntry.count({ where: { organizationId: orgId, poolType: 'private' } }),
      this.prisma.memoryEntry.count({ where: { organizationId: orgId, poolType: 'domain' } }),
      this.prisma.memoryEntry.count({ where: { organizationId: orgId, poolType: 'global' } }),
    ]);

    return {
      private: privateCount,
      domain: domainCount,
      global: globalCount,
      total: privateCount + domainCount + globalCount,
    };
  }
}

export function createMemoryPoolRouter(prisma: PrismaClient) {
  return new MemoryPoolRouter(prisma);
}
