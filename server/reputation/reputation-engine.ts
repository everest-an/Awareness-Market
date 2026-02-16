/**
 * Reputation Engine — Multi-dimensional agent reputation calculation
 *
 * Formula:
 *   overallReputation = writeQuality * 0.3
 *                     + decisionAccuracy * 0.3
 *                     + collaborationScore * 0.2
 *                     + domainExpertise * 0.2
 *
 * Each dimension is [0-100], updated incrementally by reputation hooks.
 */

import type { PrismaClient } from '@prisma/client';
import { createLogger } from '../utils/logger';

const logger = createLogger('ReputationEngine');

const WEIGHTS = {
  writeQuality: 0.3,
  decisionAccuracy: 0.3,
  collaborationScore: 0.2,
  domainExpertise: 0.2,
};

export class ReputationEngine {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get or create an agent's reputation record
   */
  async getOrCreate(agentId: string, orgId: number, departmentId?: number) {
    const existing = await this.prisma.agentReputation.findFirst({
      where: {
        agentId,
        organizationId: orgId,
        departmentId: departmentId ?? null,
      },
    });

    if (existing) return existing;

    return this.prisma.agentReputation.create({
      data: {
        agentId,
        organizationId: orgId,
        departmentId,
        writeQuality: 50,
        decisionAccuracy: 50,
        collaborationScore: 50,
        domainExpertise: 50,
        overallReputation: 50,
      },
    });
  }

  /**
   * Recalculate overall reputation from dimensions
   */
  calculateOverall(dimensions: {
    writeQuality: number;
    decisionAccuracy: number;
    collaborationScore: number;
    domainExpertise: number;
  }): number {
    const overall =
      dimensions.writeQuality * WEIGHTS.writeQuality +
      dimensions.decisionAccuracy * WEIGHTS.decisionAccuracy +
      dimensions.collaborationScore * WEIGHTS.collaborationScore +
      dimensions.domainExpertise * WEIGHTS.domainExpertise;

    return Math.max(0, Math.min(100, Math.round(overall * 100) / 100));
  }

  /**
   * Update write quality based on memory validation/conflict events
   *
   * Write quality = (validated / total) * 100, with exponential smoothing
   */
  async updateWriteQuality(agentId: string, orgId: number, event: 'validated' | 'conflicted', departmentId?: number) {
    const rep = await this.getOrCreate(agentId, orgId, departmentId);

    const totalWrites = rep.totalWrites + 1;
    const validatedWrites = rep.validatedWrites + (event === 'validated' ? 1 : 0);
    const conflictedWrites = rep.conflictedWrites + (event === 'conflicted' ? 1 : 0);

    // Exponential moving average: new = old * 0.9 + signal * 0.1
    const alpha = 0.1;
    const signal = event === 'validated' ? 80 : 20; // positive/negative signal
    const newWriteQuality = Number(rep.writeQuality) * (1 - alpha) + signal * alpha;

    const overall = this.calculateOverall({
      writeQuality: newWriteQuality,
      decisionAccuracy: Number(rep.decisionAccuracy),
      collaborationScore: Number(rep.collaborationScore),
      domainExpertise: Number(rep.domainExpertise),
    });

    await this.prisma.agentReputation.update({
      where: { id: rep.id },
      data: {
        writeQuality: Math.max(0, Math.min(100, newWriteQuality)),
        totalWrites,
        validatedWrites,
        conflictedWrites,
        overallReputation: overall,
        lastActiveAt: new Date(),
      },
    });

    logger.info('Write quality updated', { agentId, event, newWriteQuality: newWriteQuality.toFixed(1) });
  }

  /**
   * Update decision accuracy based on outcome verification
   */
  async updateDecisionAccuracy(agentId: string, orgId: number, correct: boolean, departmentId?: number) {
    const rep = await this.getOrCreate(agentId, orgId, departmentId);

    const totalDecisions = rep.totalDecisions + 1;
    const correctDecisions = rep.correctDecisions + (correct ? 1 : 0);

    const alpha = 0.1;
    const signal = correct ? 85 : 15;
    const newAccuracy = Number(rep.decisionAccuracy) * (1 - alpha) + signal * alpha;

    const overall = this.calculateOverall({
      writeQuality: Number(rep.writeQuality),
      decisionAccuracy: newAccuracy,
      collaborationScore: Number(rep.collaborationScore),
      domainExpertise: Number(rep.domainExpertise),
    });

    await this.prisma.agentReputation.update({
      where: { id: rep.id },
      data: {
        decisionAccuracy: Math.max(0, Math.min(100, newAccuracy)),
        totalDecisions,
        correctDecisions,
        overallReputation: overall,
        lastActiveAt: new Date(),
      },
    });

    logger.info('Decision accuracy updated', { agentId, correct, newAccuracy: newAccuracy.toFixed(1) });
  }

  /**
   * Update collaboration score based on cross-agent interactions
   */
  async updateCollaboration(agentId: string, orgId: number, success: boolean, departmentId?: number) {
    const rep = await this.getOrCreate(agentId, orgId, departmentId);

    const totalCollaborations = rep.totalCollaborations + 1;

    const alpha = 0.1;
    const signal = success ? 75 : 30;
    const newCollab = Number(rep.collaborationScore) * (1 - alpha) + signal * alpha;

    const overall = this.calculateOverall({
      writeQuality: Number(rep.writeQuality),
      decisionAccuracy: Number(rep.decisionAccuracy),
      collaborationScore: newCollab,
      domainExpertise: Number(rep.domainExpertise),
    });

    await this.prisma.agentReputation.update({
      where: { id: rep.id },
      data: {
        collaborationScore: Math.max(0, Math.min(100, newCollab)),
        totalCollaborations,
        overallReputation: overall,
        lastActiveAt: new Date(),
      },
    });
  }

  /**
   * Update domain expertise (based on memory promotion success in a domain)
   */
  async updateDomainExpertise(agentId: string, orgId: number, promoted: boolean, departmentId?: number) {
    const rep = await this.getOrCreate(agentId, orgId, departmentId);

    const alpha = 0.1;
    const signal = promoted ? 90 : 40;
    const newExpertise = Number(rep.domainExpertise) * (1 - alpha) + signal * alpha;

    const overall = this.calculateOverall({
      writeQuality: Number(rep.writeQuality),
      decisionAccuracy: Number(rep.decisionAccuracy),
      collaborationScore: Number(rep.collaborationScore),
      domainExpertise: newExpertise,
    });

    await this.prisma.agentReputation.update({
      where: { id: rep.id },
      data: {
        domainExpertise: Math.max(0, Math.min(100, newExpertise)),
        overallReputation: overall,
        lastActiveAt: new Date(),
      },
    });
  }

  /**
   * Apply time-based decay to inactive agents
   * Agents inactive for more than `inactiveDays` get reputation decayed
   */
  async decayInactive(orgId: number, inactiveDays: number = 30, decayRate: number = 0.02): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - inactiveDays);

    const inactive = await this.prisma.agentReputation.findMany({
      where: {
        organizationId: orgId,
        lastActiveAt: { lt: cutoff },
        overallReputation: { gt: 10 }, // Don't decay below 10
      },
    });

    let updated = 0;
    for (const rep of inactive) {
      const daysSinceActive = (Date.now() - rep.lastActiveAt.getTime()) / (1000 * 60 * 60 * 24);
      const decay = Math.exp(-decayRate * (daysSinceActive - inactiveDays));

      const newWrite = Math.max(10, Number(rep.writeQuality) * decay);
      const newAccuracy = Math.max(10, Number(rep.decisionAccuracy) * decay);
      const newCollab = Math.max(10, Number(rep.collaborationScore) * decay);
      const newExpertise = Math.max(10, Number(rep.domainExpertise) * decay);

      const overall = this.calculateOverall({
        writeQuality: newWrite,
        decisionAccuracy: newAccuracy,
        collaborationScore: newCollab,
        domainExpertise: newExpertise,
      });

      await this.prisma.agentReputation.update({
        where: { id: rep.id },
        data: {
          writeQuality: newWrite,
          decisionAccuracy: newAccuracy,
          collaborationScore: newCollab,
          domainExpertise: newExpertise,
          overallReputation: overall,
        },
      });
      updated++;
    }

    if (updated > 0) {
      logger.info('Reputation decay applied', { orgId, decayed: updated });
    }
    return updated;
  }

  /**
   * Get leaderboard of agents by overall reputation
   */
  async getLeaderboard(orgId: number, limit: number = 20) {
    return this.prisma.agentReputation.findMany({
      where: { organizationId: orgId },
      orderBy: { overallReputation: 'desc' },
      take: limit,
    });
  }

  /**
   * Get full reputation profile for an agent
   */
  async getProfile(agentId: string, orgId: number) {
    const reputations = await this.prisma.agentReputation.findMany({
      where: { agentId, organizationId: orgId },
    });

    // Overall across all departments
    const overall = reputations.find((r) => r.departmentId === null);
    const departments = reputations.filter((r) => r.departmentId !== null);

    return { overall, departments };
  }
}

export function createReputationEngine(prisma: PrismaClient) {
  return new ReputationEngine(prisma);
}
