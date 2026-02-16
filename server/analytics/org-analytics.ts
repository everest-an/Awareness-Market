/**
 * Organization Analytics — Org-level aggregation for executive dashboard
 *
 * Provides:
 * - Memory health metrics (quality distribution, decay trends)
 * - Agent performance rankings
 * - Department productivity
 * - Cross-department collaboration frequency
 */

import type { PrismaClient } from '@prisma/client';
import { createLogger } from '../utils/logger';

const logger = createLogger('OrgAnalytics');

export class OrgAnalytics {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get comprehensive org overview stats
   */
  async getOverview(orgId: number) {
    const [
      memoryCount,
      agentCount,
      departmentCount,
      decisionCount,
      conflictCount,
      verificationCount,
      evidenceCount,
    ] = await Promise.all([
      this.prisma.memoryEntry.count({ where: { organizationId: orgId } }),
      this.prisma.agentAssignment.count({ where: { organizationId: orgId, isActive: true } }),
      this.prisma.department.count({ where: { organizationId: orgId } }),
      this.prisma.decision.count({ where: { organizationId: orgId } }),
      this.prisma.memoryConflict.count({
        where: { memory1: { organizationId: orgId } },
      }),
      this.prisma.verificationRequest.count({ where: { organizationId: orgId } }),
      this.prisma.evidence.count({ where: { organizationId: orgId } }),
    ]);

    return {
      memoryCount,
      agentCount,
      departmentCount,
      decisionCount,
      conflictCount,
      verificationCount,
      evidenceCount,
    };
  }

  /**
   * Memory health: quality tier distribution
   */
  async getMemoryHealth(orgId: number) {
    const memories = await this.prisma.memoryEntry.findMany({
      where: { organizationId: orgId, isLatest: true },
      include: { score: true },
      take: 5000,
    });

    const tiers = { platinum: 0, gold: 0, silver: 0, bronze: 0 };
    const poolDist = { private: 0, domain: 0, global: 0 };
    let totalScore = 0;
    let scoredCount = 0;

    for (const m of memories) {
      const score = m.score ? Number(m.score.finalScore) : 0;
      totalScore += score;
      scoredCount++;

      if (score >= 80) tiers.platinum++;
      else if (score >= 60) tiers.gold++;
      else if (score >= 40) tiers.silver++;
      else tiers.bronze++;

      poolDist[m.poolType as keyof typeof poolDist]++;
    }

    return {
      total: memories.length,
      avgScore: scoredCount > 0 ? Math.round((totalScore / scoredCount) * 10) / 10 : 0,
      tierDistribution: tiers,
      poolDistribution: poolDist,
    };
  }

  /**
   * Agent leaderboard with performance metrics
   */
  async getAgentLeaderboard(orgId: number, limit: number = 20) {
    const reputations = await this.prisma.agentReputation.findMany({
      where: { organizationId: orgId, departmentId: null },
      orderBy: { overallReputation: 'desc' },
      take: limit,
    });

    return reputations.map((r) => ({
      agentId: r.agentId,
      overallReputation: Number(r.overallReputation),
      writeQuality: Number(r.writeQuality),
      decisionAccuracy: Number(r.decisionAccuracy),
      collaborationScore: Number(r.collaborationScore),
      domainExpertise: Number(r.domainExpertise),
      totalWrites: r.totalWrites,
      totalDecisions: r.totalDecisions,
      lastActive: r.lastActiveAt,
    }));
  }

  /**
   * Department productivity metrics
   */
  async getDepartmentStats(orgId: number) {
    const departments = await this.prisma.department.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true, slug: true },
    });

    const stats = await Promise.all(
      departments.map(async (dept) => {
        const deptIdStr = dept.id.toString();
        const [memoryCount, agentCount, decisionCount] = await Promise.all([
          this.prisma.memoryEntry.count({
            where: { organizationId: orgId, department: deptIdStr },
          }),
          this.prisma.agentAssignment.count({
            where: { organizationId: orgId, departmentId: dept.id, isActive: true },
          }),
          this.prisma.decision.count({
            where: { organizationId: orgId, departmentId: dept.id },
          }),
        ]);

        return {
          id: dept.id,
          name: dept.name,
          slug: dept.slug,
          memoryCount,
          agentCount,
          decisionCount,
        };
      })
    );

    return stats;
  }

  /**
   * Decision accuracy trend over time (last N days)
   */
  async getDecisionTrend(orgId: number, days: number = 30) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const decisions = await this.prisma.decision.findMany({
      where: {
        organizationId: orgId,
        createdAt: { gte: cutoff },
        outcomeVerified: true,
      },
      select: {
        createdAt: true,
        outcomeCorrect: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Group by day
    const dailyStats = new Map<string, { total: number; correct: number }>();

    for (const d of decisions) {
      const day = d.createdAt.toISOString().split('T')[0];
      const existing = dailyStats.get(day) || { total: 0, correct: 0 };
      existing.total++;
      if (d.outcomeCorrect) existing.correct++;
      dailyStats.set(day, existing);
    }

    return Array.from(dailyStats.entries()).map(([date, stats]) => ({
      date,
      total: stats.total,
      correct: stats.correct,
      accuracy: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
    }));
  }

  /**
   * Memory creation activity over time
   */
  async getMemoryActivity(orgId: number, days: number = 30) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const memories = await this.prisma.memoryEntry.findMany({
      where: {
        organizationId: orgId,
        createdAt: { gte: cutoff },
      },
      select: { createdAt: true, poolType: true },
      orderBy: { createdAt: 'asc' },
    });

    const dailyStats = new Map<string, { total: number; private: number; domain: number; global: number }>();

    for (const m of memories) {
      const day = m.createdAt.toISOString().split('T')[0];
      const existing = dailyStats.get(day) || { total: 0, private: 0, domain: 0, global: 0 };
      existing.total++;
      existing[m.poolType as keyof typeof existing]++;
      dailyStats.set(day, existing);
    }

    return Array.from(dailyStats.entries()).map(([date, stats]) => ({
      date,
      ...stats,
    }));
  }
}

export function createOrgAnalytics(prisma: PrismaClient) {
  return new OrgAnalytics(prisma);
}
