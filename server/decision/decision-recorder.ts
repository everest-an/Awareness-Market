/**
 * Decision Recorder — Captures every AI agent decision with full memory context
 *
 * Intercepts agent query responses, snapshots the memory state at decision time.
 * Decisions are insert-only (immutable audit trail).
 *
 * ✅ P1 Security: Encrypts inputQuery and output fields to prevent data leakage
 * if the database is compromised. Uses AES-256-GCM encryption.
 *
 * Reuses: memory-pool-router.ts (for pool breakdown capture)
 */

import type { PrismaClient } from '@prisma/client';
import { createLogger } from '../utils/logger';
import { encryptField, decryptField, isEncryptionConfigured } from '../utils/encryption';

const logger = createLogger('DecisionRecorder');

export interface RecordDecisionInput {
  organizationId: number;
  agentId: string;
  departmentId?: number;
  inputQuery: string;
  output: string;
  confidence: number;

  // Memory context (captured at decision time)
  retrievedMemoryIds?: string[];
  memoryScoresSnapshot?: Record<string, {
    finalScore: number;
    poolType: string;
    content: string;
    confidence: number;
  }>;
  poolBreakdown?: { private: number; domain: number; global: number };
  totalTokensUsed?: number;

  // Metadata
  decisionType?: string;
  latencyMs?: number;
  modelUsed?: string;
}

export interface VerifyOutcomeInput {
  decisionId: string;
  outcomeCorrect: boolean;
  outcomeNotes?: string;
  verifiedBy: string;
}

export class DecisionRecorder {
  constructor(private prisma: PrismaClient) {}

  /**
   * Record a new decision with full memory context snapshot
   * ✅ P1 Security: Encrypts inputQuery and output before storage
   */
  async record(input: RecordDecisionInput): Promise<{ decisionId: string }> {
    // ✅ P1 Security: Encrypt sensitive fields if encryption is configured
    const shouldEncrypt = isEncryptionConfigured();
    const encryptedInputQuery = shouldEncrypt
      ? encryptField(input.inputQuery, 'inputQuery')
      : input.inputQuery;
    const encryptedOutput = shouldEncrypt
      ? encryptField(input.output, 'output')
      : input.output;

    if (shouldEncrypt) {
      logger.debug('Decision fields encrypted', {
        agentId: input.agentId,
        encryptionEnabled: true,
      });
    } else {
      logger.warn('Encryption not configured - storing decision data in plaintext', {
        agentId: input.agentId,
        hint: 'Set ENCRYPTION_KEY environment variable to enable encryption',
      });
    }

    const decision = await this.prisma.decision.create({
      data: {
        organizationId: input.organizationId,
        agentId: input.agentId,
        departmentId: input.departmentId,
        inputQuery: encryptedInputQuery || '',
        output: encryptedOutput || '',
        confidence: input.confidence,
        retrievedMemoryIds: input.retrievedMemoryIds || [],
        memoryScoresSnapshot: input.memoryScoresSnapshot || {},
        poolBreakdown: input.poolBreakdown || { private: 0, domain: 0, global: 0 },
        totalTokensUsed: input.totalTokensUsed || 0,
        decisionType: input.decisionType,
        latencyMs: input.latencyMs,
        modelUsed: input.modelUsed,
      },
    });

    logger.info('Decision recorded', {
      decisionId: decision.id,
      agentId: input.agentId,
      orgId: input.organizationId,
      memoriesUsed: input.retrievedMemoryIds?.length || 0,
      encrypted: shouldEncrypt,
    });

    return { decisionId: decision.id };
  }

  /**
   * Verify the outcome of a past decision
   * Updates AgentReputation through reputation hooks
   */
  async verifyOutcome(input: VerifyOutcomeInput): Promise<boolean> {
    const decision = await this.prisma.decision.findUnique({
      where: { id: input.decisionId },
    });

    if (!decision || decision.outcomeVerified) return false;

    await this.prisma.decision.update({
      where: { id: input.decisionId },
      data: {
        outcomeVerified: true,
        outcomeCorrect: input.outcomeCorrect,
        outcomeNotes: input.outcomeNotes,
        verifiedAt: new Date(),
        verifiedBy: input.verifiedBy,
      },
    });

    logger.info('Decision outcome verified', {
      decisionId: input.decisionId,
      correct: input.outcomeCorrect,
    });

    return true;
  }

  /**
   * Get a single decision by ID
   */
  async getById(decisionId: string) {
    return this.prisma.decision.findUnique({
      where: { id: decisionId },
    });
  }

  /**
   * List decisions for an organization with filters
   */
  async list(options: {
    orgId: number;
    agentId?: string;
    departmentId?: number;
    verified?: boolean;
    correct?: boolean;
    limit?: number;
    offset?: number;
  }) {
    const { orgId, agentId, departmentId, verified, correct, limit = 50, offset = 0 } = options;

    const where: any = { organizationId: orgId };
    if (agentId) where.agentId = agentId;
    if (departmentId) where.departmentId = departmentId;
    if (verified !== undefined) where.outcomeVerified = verified;
    if (correct !== undefined) where.outcomeCorrect = correct;

    const [decisions, total] = await Promise.all([
      this.prisma.decision.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.decision.count({ where }),
    ]);

    return { decisions, total };
  }

  /**
   * Get decision accuracy stats for an agent
   */
  async getAgentAccuracy(orgId: number, agentId: string) {
    const [total, verified, correct] = await Promise.all([
      this.prisma.decision.count({
        where: { organizationId: orgId, agentId },
      }),
      this.prisma.decision.count({
        where: { organizationId: orgId, agentId, outcomeVerified: true },
      }),
      this.prisma.decision.count({
        where: { organizationId: orgId, agentId, outcomeVerified: true, outcomeCorrect: true },
      }),
    ]);

    return {
      totalDecisions: total,
      verifiedDecisions: verified,
      correctDecisions: correct,
      accuracy: verified > 0 ? correct / verified : 0,
      verificationRate: total > 0 ? verified / total : 0,
    };
  }
}

export function createDecisionRecorder(prisma: PrismaClient) {
  return new DecisionRecorder(prisma);
}
