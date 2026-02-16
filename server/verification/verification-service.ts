/**
 * Verification Service — Cross-department peer review workflow
 *
 * Handles:
 * - Creating verification requests for strategic claims
 * - Selecting best verifier by AgentReputation.domainExpertise
 * - Processing verification results and updating memory confidence
 *
 * Reuses: reputation-engine.ts (domain expertise for verifier selection)
 */

import type { PrismaClient } from '@prisma/client';
import { createLogger } from '../utils/logger';

const logger = createLogger('VerificationService');

export interface CreateVerificationInput {
  memoryId: string;
  organizationId: number;
  sourceDepartmentId?: number;
  targetDepartmentId?: number;
  priority?: number;
  expiresInHours?: number;
}

export interface VerificationResult {
  verdict: 'verified' | 'rejected' | 'needs_revision';
  confidence: number;
  notes: string;
}

export class VerificationService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a verification request for a memory
   */
  async createRequest(input: CreateVerificationInput) {
    const expiresAt = input.expiresInHours
      ? new Date(Date.now() + input.expiresInHours * 60 * 60 * 1000)
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Default: 7 days

    const request = await this.prisma.verificationRequest.create({
      data: {
        memoryId: input.memoryId,
        organizationId: input.organizationId,
        sourceDepartmentId: input.sourceDepartmentId,
        targetDepartmentId: input.targetDepartmentId,
        priority: input.priority || 0,
        expiresAt,
      },
    });

    logger.info('Verification request created', {
      requestId: request.id,
      memoryId: input.memoryId,
    });

    return request;
  }

  /**
   * Auto-create verification requests for strategic memories
   * Called when a memory is promoted or has high confidence
   */
  async autoCreateForStrategic(orgId: number): Promise<number> {
    // Find strategic memories without verification requests
    const unverified = await this.prisma.memoryEntry.findMany({
      where: {
        organizationId: orgId,
        memoryType: 'strategic',
        isLatest: true,
        poolType: { in: ['domain', 'global'] },
        verificationRequests: { none: {} },
      },
      take: 50,
    });

    let created = 0;
    for (const memory of unverified) {
      const deptId = memory.department ? parseInt(memory.department) : undefined;
      await this.createRequest({
        memoryId: memory.id,
        organizationId: orgId,
        sourceDepartmentId: deptId,
        priority: memory.poolType === 'global' ? 2 : 1,
      });
      created++;
    }

    return created;
  }

  /**
   * Select the best verifier for a request
   * Picks the agent with highest domain expertise in the target department
   */
  async assignVerifier(requestId: string): Promise<boolean> {
    const request = await this.prisma.verificationRequest.findUnique({
      where: { id: requestId },
      include: { memory: { select: { agentId: true, department: true } } },
    });

    if (!request || request.status !== 'pending') return false;

    // Find agents with reputation in the target department (or org-wide)
    const candidates = await this.prisma.agentReputation.findMany({
      where: {
        organizationId: request.organizationId,
        ...(request.targetDepartmentId
          ? { departmentId: request.targetDepartmentId }
          : {}),
        // Exclude the memory's own author
        NOT: { agentId: request.memory.agentId || '' },
      },
      orderBy: { domainExpertise: 'desc' },
      take: 5,
    });

    if (candidates.length === 0) return false;

    // Pick the top candidate
    const verifier = candidates[0];

    await this.prisma.verificationRequest.update({
      where: { id: requestId },
      data: {
        status: 'assigned',
        verifierAgentId: verifier.agentId,
        assignedAt: new Date(),
      },
    });

    logger.info('Verifier assigned', {
      requestId,
      verifierAgentId: verifier.agentId,
      expertise: Number(verifier.domainExpertise),
    });

    return true;
  }

  /**
   * Complete a verification request with result
   */
  async completeVerification(requestId: string, result: VerificationResult) {
    const request = await this.prisma.verificationRequest.findUnique({
      where: { id: requestId },
    });

    if (!request || request.status === 'verified' || request.status === 'rejected') return null;

    const status = result.verdict === 'verified' ? 'verified' as const : 'rejected' as const;

    // Calculate score impact
    const scoreImpact = result.verdict === 'verified'
      ? Math.min(10, result.confidence * 10)
      : Math.max(-10, -result.confidence * 10);

    const updated = await this.prisma.verificationRequest.update({
      where: { id: requestId },
      data: {
        status,
        verificationResult: result as any,
        scoreImpact,
        completedAt: new Date(),
      },
    });

    // Update memory confidence based on verification
    if (result.verdict === 'verified') {
      await this.prisma.memoryEntry.update({
        where: { id: request.memoryId },
        data: {
          confidence: { increment: 0.05 },
          validationCount: { increment: 1 },
        },
      });
    } else if (result.verdict === 'rejected') {
      await this.prisma.memoryEntry.update({
        where: { id: request.memoryId },
        data: {
          confidence: { decrement: 0.1 },
        },
      });
    }

    logger.info('Verification completed', {
      requestId,
      verdict: result.verdict,
      scoreImpact,
    });

    return updated;
  }

  /**
   * Get pending verification requests for an organization
   */
  async listRequests(orgId: number, options?: {
    status?: string;
    departmentId?: number;
    limit?: number;
    offset?: number;
  }) {
    const { status, departmentId, limit = 50, offset = 0 } = options || {};

    const where: any = { organizationId: orgId };
    if (status) where.status = status;
    if (departmentId) where.targetDepartmentId = departmentId;

    const [requests, total] = await Promise.all([
      this.prisma.verificationRequest.findMany({
        where,
        include: {
          memory: { select: { content: true, department: true, poolType: true, confidence: true } },
        },
        orderBy: [{ priority: 'desc' }, { requestedAt: 'desc' }],
        take: limit,
        skip: offset,
      }),
      this.prisma.verificationRequest.count({ where }),
    ]);

    return { requests, total };
  }

  /**
   * Expire old pending requests
   */
  async expireStale(): Promise<number> {
    const result = await this.prisma.verificationRequest.updateMany({
      where: {
        status: { in: ['pending', 'assigned'] },
        expiresAt: { lt: new Date() },
      },
      data: { status: 'expired' },
    });

    if (result.count > 0) {
      logger.info('Expired stale verification requests', { count: result.count });
    }

    return result.count;
  }
}

export function createVerificationService(prisma: PrismaClient) {
  return new VerificationService(prisma);
}
