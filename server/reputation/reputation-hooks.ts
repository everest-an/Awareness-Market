/**
 * Reputation Hooks — Event-driven reputation updates
 *
 * Hooks into memory and decision lifecycle events:
 * - Memory validated → writeQuality up
 * - Memory conflicted → writeQuality down
 * - Decision outcome verified → decisionAccuracy up/down
 * - Memory promoted → domainExpertise up
 * - Cross-agent collaboration → collaborationScore up/down
 *
 * Designed to be called from tRPC endpoints and workers.
 */

import type { PrismaClient } from '@prisma/client';
import { createReputationEngine, type ReputationEngine } from './reputation-engine';
import { createLogger } from '../utils/logger';

const logger = createLogger('ReputationHooks');

export class ReputationHooks {
  private engine: ReputationEngine;

  constructor(private prisma: PrismaClient) {
    this.engine = createReputationEngine(prisma);
  }

  /**
   * Hook: Memory was validated by another agent
   * Increases the writer's writeQuality
   */
  async onMemoryValidated(memoryId: string) {
    const memory = await this.prisma.memoryEntry.findUnique({
      where: { id: memoryId },
      select: { agentId: true, organizationId: true, department: true },
    });

    if (!memory?.agentId || !memory.organizationId) return;

    const departmentId = memory.department ? parseInt(memory.department) : undefined;

    await this.engine.updateWriteQuality(
      memory.agentId,
      memory.organizationId,
      'validated',
      departmentId
    );

    // Also update org-level reputation (no department)
    if (departmentId) {
      await this.engine.updateWriteQuality(
        memory.agentId,
        memory.organizationId,
        'validated'
      );
    }
  }

  /**
   * Hook: Memory was flagged in a conflict
   * Decreases the writer's writeQuality
   */
  async onMemoryConflicted(memoryId: string) {
    const memory = await this.prisma.memoryEntry.findUnique({
      where: { id: memoryId },
      select: { agentId: true, organizationId: true, department: true },
    });

    if (!memory?.agentId || !memory.organizationId) return;

    const departmentId = memory.department ? parseInt(memory.department) : undefined;

    await this.engine.updateWriteQuality(
      memory.agentId,
      memory.organizationId,
      'conflicted',
      departmentId
    );

    if (departmentId) {
      await this.engine.updateWriteQuality(
        memory.agentId,
        memory.organizationId,
        'conflicted'
      );
    }
  }

  /**
   * Hook: Decision outcome was verified
   * Updates decisionAccuracy for the agent
   */
  async onDecisionVerified(decisionId: string) {
    const decision = await this.prisma.decision.findUnique({
      where: { id: decisionId },
      select: {
        agentId: true,
        organizationId: true,
        departmentId: true,
        outcomeCorrect: true,
      },
    });

    if (!decision || decision.outcomeCorrect === null) return;

    await this.engine.updateDecisionAccuracy(
      decision.agentId,
      decision.organizationId,
      decision.outcomeCorrect,
      decision.departmentId ?? undefined
    );

    // Also update org-level
    if (decision.departmentId) {
      await this.engine.updateDecisionAccuracy(
        decision.agentId,
        decision.organizationId,
        decision.outcomeCorrect
      );
    }
  }

  /**
   * Hook: Memory was promoted from domain → global
   * Increases the writer's domainExpertise
   */
  async onMemoryPromoted(memoryId: string) {
    const memory = await this.prisma.memoryEntry.findUnique({
      where: { id: memoryId },
      select: { agentId: true, organizationId: true, department: true },
    });

    if (!memory?.agentId || !memory.organizationId) return;

    const departmentId = memory.department ? parseInt(memory.department) : undefined;

    await this.engine.updateDomainExpertise(
      memory.agentId,
      memory.organizationId,
      true,
      departmentId
    );
  }

  /**
   * Hook: Cross-agent collaboration event
   */
  async onCollaboration(agentId: string, orgId: number, success: boolean = true, departmentId?: number) {
    await this.engine.updateCollaboration(agentId, orgId, success, departmentId);
  }
}

export function createReputationHooks(prisma: PrismaClient) {
  return new ReputationHooks(prisma);
}
