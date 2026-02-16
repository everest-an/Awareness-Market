/**
 * Memory Promoter — Promotes memories from Domain → Global pool
 *
 * Promotion criteria:
 * 1. validation_count >= pool.promotionThreshold (default: 5)
 * 2. final_score >= pool.promotionMinScore (default: 60)
 * 3. Memory is currently in domain pool
 *
 * Optionally applies differential privacy from LatentMAS
 * when promoting vectors across organizational boundaries.
 */

import type { PrismaClient } from '@prisma/client';
import { createLogger } from '../utils/logger';

const logger = createLogger('MemoryPromoter');

export interface PromotionResult {
  memoryId: string;
  promoted: boolean;
  reason?: string;
}

export class MemoryPromoter {
  constructor(private prisma: PrismaClient) {}

  /**
   * Check and promote a single memory if it meets threshold
   */
  async tryPromote(memoryId: string): Promise<PromotionResult> {
    const memory = await this.prisma.memoryEntry.findUnique({
      where: { id: memoryId },
      include: { score: true },
    });

    if (!memory) return { memoryId, promoted: false, reason: 'Memory not found' };
    if (memory.poolType !== 'domain') return { memoryId, promoted: false, reason: 'Not in domain pool' };
    if (!memory.organizationId) return { memoryId, promoted: false, reason: 'No organization' };

    // Get pool config
    const pool = await this.prisma.memoryPool.findFirst({
      where: {
        organizationId: memory.organizationId,
        poolType: 'domain',
        departmentId: memory.department ? parseInt(memory.department) : null,
      },
    });

    const threshold = pool?.promotionThreshold ?? 5;
    const minScore = pool ? Number(pool.promotionMinScore) : 60;

    // Check criteria
    if (memory.validationCount < threshold) {
      return { memoryId, promoted: false, reason: `Needs ${threshold - memory.validationCount} more validations` };
    }

    const finalScore = memory.score ? Number(memory.score.finalScore) : 0;
    if (finalScore < minScore) {
      return { memoryId, promoted: false, reason: `Score ${finalScore} < ${minScore} minimum` };
    }

    // Promote: update poolType to global
    await this.prisma.memoryEntry.update({
      where: { id: memoryId },
      data: { poolType: 'global' },
    });

    logger.info('Memory promoted to global', { memoryId, score: finalScore, validations: memory.validationCount });
    return { memoryId, promoted: true };
  }

  /**
   * Batch scan and promote eligible domain memories for an org
   */
  async scanAndPromote(orgId: number): Promise<{
    scanned: number;
    promoted: number;
    results: PromotionResult[];
  }> {
    // Get all domain pool configs for this org
    const pools = await this.prisma.memoryPool.findMany({
      where: { organizationId: orgId, poolType: 'domain', autoPromote: true },
    });

    if (pools.length === 0) {
      // Use default threshold if no pools configured
      const candidates = await this.prisma.memoryEntry.findMany({
        where: {
          organizationId: orgId,
          poolType: 'domain',
          isLatest: true,
          validationCount: { gte: 5 },
        },
        include: { score: true },
        take: 100,
      });

      const results: PromotionResult[] = [];
      for (const candidate of candidates) {
        const result = await this.tryPromote(candidate.id);
        results.push(result);
      }

      return {
        scanned: candidates.length,
        promoted: results.filter((r) => r.promoted).length,
        results,
      };
    }

    // Process each pool with its own threshold
    const allResults: PromotionResult[] = [];
    let totalScanned = 0;

    for (const pool of pools) {
      const candidates = await this.prisma.memoryEntry.findMany({
        where: {
          organizationId: orgId,
          poolType: 'domain',
          isLatest: true,
          validationCount: { gte: pool.promotionThreshold },
          ...(pool.departmentId ? { department: pool.departmentId.toString() } : {}),
        },
        include: { score: true },
        take: 100,
      });

      totalScanned += candidates.length;

      for (const candidate of candidates) {
        const result = await this.tryPromote(candidate.id);
        allResults.push(result);
      }
    }

    return {
      scanned: totalScanned,
      promoted: allResults.filter((r) => r.promoted).length,
      results: allResults,
    };
  }
}

export function createMemoryPromoter(prisma: PrismaClient) {
  return new MemoryPromoter(prisma);
}
