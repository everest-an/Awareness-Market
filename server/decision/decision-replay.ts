/**
 * Decision Replay — Reconstruct historical memory state for a given decision
 *
 * Allows replaying a past decision to understand:
 * - What memories were available at decision time
 * - What scores those memories had
 * - Whether the decision would change with current memory state
 *
 * ✅ P1 Security: Decrypts inputQuery and output fields on replay
 *
 * Uses immutable decision snapshots + current memory state comparison
 */

import type { PrismaClient } from '@prisma/client';
import { calculateFinalScore } from '../memory-core/scoring-engine';
import type { MemoryEntry as ScoringMemoryEntry } from '../memory-core/schema';
import { decryptField } from '../utils/encryption';

export interface ReplayResult {
  decisionId: string;
  decision: {
    inputQuery: string;
    output: string;
    confidence: number;
    agentId: string;
    createdAt: Date;
    modelUsed: string | null;
  };

  // Historical state (from snapshot)
  historicalMemories: {
    id: string;
    content: string;
    poolType: string;
    finalScoreAtDecision: number;
    confidence: number;
  }[];

  // Current state (live query)
  currentMemories: {
    id: string;
    content: string;
    poolType: string;
    currentFinalScore: number;
    confidence: number;
    stillExists: boolean;
    scoreChange: number; // difference from decision time
  }[];

  // Analysis
  analysis: {
    memoriesStillAvailable: number;
    memoriesRemoved: number;
    memoriesAdded: number;
    avgScoreChange: number;
    contextDriftScore: number; // 0-1, how much the memory context has changed
  };
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

export class DecisionReplay {
  constructor(private prisma: PrismaClient) {}

  /**
   * Replay a decision — compare historical vs current memory state
   */
  async replay(decisionId: string): Promise<ReplayResult | null> {
    const decision = await this.prisma.decision.findUnique({
      where: { id: decisionId },
    });

    if (!decision) return null;

    // 1. Reconstruct historical memories from snapshot
    const snapshot = (decision.memoryScoresSnapshot || {}) as Record<string, any>;
    const historicalMemories = Object.entries(snapshot).map(([id, data]) => ({
      id,
      content: data.content || '',
      poolType: data.poolType || 'domain',
      finalScoreAtDecision: data.finalScore || 0,
      confidence: data.confidence || 0,
    }));

    // 2. Fetch current state of those memories
    const memoryIds = decision.retrievedMemoryIds || [];
    const currentEntries = memoryIds.length > 0
      ? await this.prisma.memoryEntry.findMany({
          where: { id: { in: memoryIds } },
          include: { score: true },
        })
      : [];

    const currentMap = new Map(currentEntries.map((e) => [e.id, e]));

    // 3. Compare
    const currentMemories = historicalMemories.map((hm) => {
      const current = currentMap.get(hm.id);
      if (!current) {
        return {
          id: hm.id,
          content: hm.content,
          poolType: hm.poolType,
          currentFinalScore: 0,
          confidence: 0,
          stillExists: false,
          scoreChange: -hm.finalScoreAtDecision,
        };
      }

      const currentScore = current.score
        ? Number(current.score.finalScore)
        : calculateFinalScore(toScoringEntry(current));

      return {
        id: hm.id,
        content: current.content,
        poolType: current.poolType,
        currentFinalScore: currentScore,
        confidence: Number(current.confidence),
        stillExists: true,
        scoreChange: currentScore - hm.finalScoreAtDecision,
      };
    });

    // 4. Analysis
    const stillAvailable = currentMemories.filter((m) => m.stillExists).length;
    const removed = currentMemories.filter((m) => !m.stillExists).length;
    const scoreChanges = currentMemories.filter((m) => m.stillExists).map((m) => m.scoreChange);
    const avgScoreChange = scoreChanges.length > 0
      ? scoreChanges.reduce((a, b) => a + b, 0) / scoreChanges.length
      : 0;

    // Context drift: ratio of removed memories + magnitude of score changes
    const driftFromRemoval = historicalMemories.length > 0 ? removed / historicalMemories.length : 0;
    const driftFromScores = scoreChanges.length > 0
      ? Math.min(1, scoreChanges.reduce((a, b) => a + Math.abs(b), 0) / (scoreChanges.length * 20))
      : 0;
    const contextDriftScore = Math.min(1, driftFromRemoval * 0.6 + driftFromScores * 0.4);

    // ✅ P1 Security: Decrypt sensitive fields before returning
    const decryptedInputQuery = decryptField(decision.inputQuery, 'inputQuery') || decision.inputQuery;
    const decryptedOutput = decryptField(decision.output, 'output') || decision.output;

    return {
      decisionId,
      decision: {
        inputQuery: decryptedInputQuery,
        output: decryptedOutput,
        confidence: Number(decision.confidence),
        agentId: decision.agentId,
        createdAt: decision.createdAt,
        modelUsed: decision.modelUsed,
      },
      historicalMemories,
      currentMemories,
      analysis: {
        memoriesStillAvailable: stillAvailable,
        memoriesRemoved: removed,
        memoriesAdded: 0, // Would require re-running the query
        avgScoreChange: Math.round(avgScoreChange * 100) / 100,
        contextDriftScore: Math.round(contextDriftScore * 100) / 100,
      },
    };
  }

  /**
   * Get timeline of decisions for an agent (for trend analysis)
   */
  async getTimeline(orgId: number, agentId: string, days: number = 30) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const decisions = await this.prisma.decision.findMany({
      where: {
        organizationId: orgId,
        agentId,
        createdAt: { gte: cutoff },
      },
      select: {
        id: true,
        confidence: true,
        outcomeVerified: true,
        outcomeCorrect: true,
        createdAt: true,
        decisionType: true,
        totalTokensUsed: true,
        latencyMs: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return decisions.map((d) => ({
      id: d.id,
      confidence: Number(d.confidence),
      verified: d.outcomeVerified,
      correct: d.outcomeCorrect,
      date: d.createdAt,
      type: d.decisionType,
      tokens: d.totalTokensUsed,
      latencyMs: d.latencyMs,
    }));
  }
}

export function createDecisionReplay(prisma: PrismaClient) {
  return new DecisionReplay(prisma);
}
