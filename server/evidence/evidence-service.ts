/**
 * Evidence Service — Citation and evidence management for memories
 *
 * Handles:
 * - Evidence CRUD (attach citations/references to memories)
 * - DOI resolution
 * - Evidence quality scoring
 */

import type { PrismaClient } from '@prisma/client';
import { createLogger } from '../utils/logger';

const logger = createLogger('EvidenceService');

export interface CreateEvidenceInput {
  memoryId: string;
  organizationId: number;
  evidenceType: 'arxiv' | 'doi' | 'internal_data' | 'experimental' | 'computational' | 'url';
  sourceUrl?: string;
  sourceDoi?: string;
  title?: string;
  description?: string;
  claimType?: string;
  assumptions?: string[];
  unit?: string;
  dimension?: string;
  confidence?: number;
  peerReviewed?: boolean;
  createdBy: string;
}

export class EvidenceService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Attach evidence to a memory
   */
  async create(input: CreateEvidenceInput) {
    const evidence = await this.prisma.evidence.create({
      data: {
        memoryId: input.memoryId,
        organizationId: input.organizationId,
        evidenceType: input.evidenceType,
        sourceUrl: input.sourceUrl,
        sourceDoi: input.sourceDoi,
        title: input.title,
        description: input.description,
        claimType: input.claimType,
        assumptions: input.assumptions || [],
        unit: input.unit,
        dimension: input.dimension,
        confidence: input.confidence || 0.5,
        peerReviewed: input.peerReviewed || false,
        createdBy: input.createdBy,
      },
    });

    // Boost memory confidence when peer-reviewed evidence is attached
    if (input.peerReviewed) {
      await this.prisma.memoryEntry.update({
        where: { id: input.memoryId },
        data: { confidence: { increment: 0.05 } },
      });
    }

    logger.info('Evidence created', {
      evidenceId: evidence.id,
      memoryId: input.memoryId,
      type: input.evidenceType,
    });

    return evidence;
  }

  /**
   * Get all evidence for a memory
   */
  async getForMemory(memoryId: string) {
    return this.prisma.evidence.findMany({
      where: { memoryId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get all evidence for an organization
   */
  async listForOrg(orgId: number, options?: {
    evidenceType?: string;
    limit?: number;
    offset?: number;
  }) {
    const { evidenceType, limit = 50, offset = 0 } = options || {};

    const where: any = { organizationId: orgId };
    if (evidenceType) where.evidenceType = evidenceType;

    const [items, total] = await Promise.all([
      this.prisma.evidence.findMany({
        where,
        include: {
          memory: { select: { content: true, department: true, poolType: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.evidence.count({ where }),
    ]);

    return { items, total };
  }

  /**
   * Delete evidence
   */
  async delete(evidenceId: string) {
    await this.prisma.evidence.delete({ where: { id: evidenceId } });
  }

  /**
   * Get evidence stats for an organization
   */
  async getStats(orgId: number) {
    const [total, peerReviewed, byType] = await Promise.all([
      this.prisma.evidence.count({ where: { organizationId: orgId } }),
      this.prisma.evidence.count({ where: { organizationId: orgId, peerReviewed: true } }),
      this.prisma.evidence.groupBy({
        by: ['evidenceType'],
        where: { organizationId: orgId },
        _count: true,
      }),
    ]);

    const typeBreakdown: Record<string, number> = {};
    for (const entry of byType) {
      typeBreakdown[entry.evidenceType] = entry._count;
    }

    return { total, peerReviewed, typeBreakdown };
  }
}

export function createEvidenceService(prisma: PrismaClient) {
  return new EvidenceService(prisma);
}
