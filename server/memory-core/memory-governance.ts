/**
 * Memory Governance Service
 *
 * Enforces the three MemoryPolicy types stored in the `memory_policies` table:
 *
 *  - retention          : auto-expire memories that exceed age/count limits
 *  - access             : allow/deny read+write per agent / namespace
 *  - conflict_resolution: pick the winning memory when a conflict is detected
 *
 * Integration points:
 *  - router.ts create()                  → checkAccess('write')
 *  - workers/decay-worker.ts             → enforceAllRetentionPolicies()
 *  - workers/conflict-arbitration-worker → resolveConflictByPolicy()
 */

import { prisma } from '../db-prisma';
import { createLogger } from '../utils/logger';

const logger = createLogger('MemoryGovernance');

// ─── Rule Shapes ─────────────────────────────────────────────────────────────

export interface RetentionRules {
  /** Memories older than this (seconds) are expired */
  maxAgeSeconds?: number;
  /** Max live memories per namespace; oldest trimmed on breach */
  maxCount?: number;
  /** If false, breaches are only logged (default: true — enforce) */
  expireOnBreach?: boolean;
}

export interface AccessRules {
  /** Whitelist of agentId / openId allowed to read+write */
  allowedAgents?: string[];
  /** Whitelist of role strings (e.g. 'admin', 'member') — future use */
  allowedRoles?: string[];
  /** Block all writes; reads still allowed */
  readOnly?: boolean;
  /** Block all access (read + write) */
  denyAll?: boolean;
}

export type ConflictStrategy =
  | 'latest-wins'       // newer createdAt wins
  | 'confidence-wins'   // higher confidence score wins
  | 'score-wins'        // higher MemoryScore.finalScore wins (default)
  | 'queue-arbitration' // enqueue to BullMQ LLM arbitration worker
  | 'manual-review';    // leave as pending for human review

export interface ConflictResolutionRules {
  strategy: ConflictStrategy;
  /**
   * For 'confidence-wins': minimum absolute difference required to auto-resolve.
   * If the gap is smaller, falls back to 'queue-arbitration'.
   * Default: 0 (always auto-resolve on any difference).
   */
  minConfidenceDelta?: number;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class MemoryGovernanceService {
  /** 1-minute in-memory policy cache */
  private readonly cache = new Map<string, { rules: unknown; cachedAt: number }>();
  private readonly CACHE_TTL_MS = 60_000;

  private cacheKey(orgId: string, namespace: string, policyType: string): string {
    return `${orgId}::${namespace}::${policyType}`;
  }

  /**
   * Load a policy's JSON rules for a given org + namespace + type.
   * Returns `null` when no policy has been configured (= default behaviour applies).
   */
  async getPolicy<T>(
    orgId: string,
    namespace: string,
    policyType: string,
  ): Promise<T | null> {
    const key = this.cacheKey(orgId, namespace, policyType);
    const cached = this.cache.get(key);

    if (cached && Date.now() - cached.cachedAt < this.CACHE_TTL_MS) {
      return cached.rules as T | null;
    }

    const policy = await prisma.memoryPolicy.findFirst({
      where: { orgId, namespace, policyType },
      orderBy: { createdAt: 'desc' },
    });

    const rules = (policy?.rules ?? null) as T | null;
    this.cache.set(key, { rules, cachedAt: Date.now() });
    return rules;
  }

  /** Invalidate cached policies — call after a policy is created / updated / deleted */
  invalidate(orgId: string, namespace?: string): void {
    if (!namespace) {
      for (const key of this.cache.keys()) {
        if (key.startsWith(`${orgId}::`)) this.cache.delete(key);
      }
    } else {
      for (const type of ['retention', 'access', 'conflict_resolution']) {
        this.cache.delete(this.cacheKey(orgId, namespace, type));
      }
    }
  }

  // ─── Retention ─────────────────────────────────────────────────────────────

  /**
   * Enforce the retention policy for a single org+namespace combination.
   *
   * 1. Expire memories older than `maxAgeSeconds`.
   * 2. Trim excess memories (oldest first) when `maxCount` is exceeded.
   *
   * Returns counts of expired and trimmed entries.
   */
  async enforceRetention(
    orgId: string,
    namespace: string,
  ): Promise<{ expired: number; trimmed: number }> {
    const rules = await this.getPolicy<RetentionRules>(orgId, namespace, 'retention');
    if (!rules) return { expired: 0, trimmed: 0 };

    const shouldEnforce = rules.expireOnBreach !== false; // default true
    let expired = 0;
    let trimmed = 0;

    // 1. maxAgeSeconds
    if (rules.maxAgeSeconds && shouldEnforce) {
      const cutoff = new Date(Date.now() - rules.maxAgeSeconds * 1000);
      const result = await prisma.memoryEntry.updateMany({
        where: { orgId, namespace, isLatest: true, createdAt: { lt: cutoff } },
        data: { isLatest: false, expiresAt: new Date() },
      });
      expired = result.count;
      if (expired > 0) {
        logger.info('Retention policy: expired old memories', {
          orgId,
          namespace,
          expired,
          maxAgeSeconds: rules.maxAgeSeconds,
        });
      }
    }

    // 2. maxCount
    if (rules.maxCount && shouldEnforce) {
      const liveCount = await prisma.memoryEntry.count({
        where: { orgId, namespace, isLatest: true },
      });

      if (liveCount > rules.maxCount) {
        const excess = liveCount - rules.maxCount;
        const toTrim = await prisma.memoryEntry.findMany({
          where: { orgId, namespace, isLatest: true },
          orderBy: { createdAt: 'asc' },
          take: excess,
          select: { id: true },
        });

        if (toTrim.length > 0) {
          await prisma.memoryEntry.updateMany({
            where: { id: { in: toTrim.map((m) => m.id) } },
            data: { isLatest: false, expiresAt: new Date() },
          });
          trimmed = toTrim.length;
          logger.info('Retention policy: trimmed excess memories', {
            orgId,
            namespace,
            trimmed,
            maxCount: rules.maxCount,
          });
        }
      }
    }

    return { expired, trimmed };
  }

  /**
   * Enforce all configured retention policies.
   * Called by the decay-worker after each run — iterates over every row in
   * `memory_policies` where `policyType = 'retention'`.
   */
  async enforceAllRetentionPolicies(): Promise<{
    policiesProcessed: number;
    totalExpired: number;
    totalTrimmed: number;
  }> {
    const policies = await prisma.memoryPolicy.findMany({
      where: { policyType: 'retention' },
      select: { orgId: true, namespace: true },
    });

    let totalExpired = 0;
    let totalTrimmed = 0;

    for (const { orgId, namespace } of policies) {
      // Invalidate cache so we always re-read fresh rules
      this.invalidate(orgId, namespace);
      const result = await this.enforceRetention(orgId, namespace);
      totalExpired += result.expired;
      totalTrimmed += result.trimmed;
    }

    logger.info('All retention policies enforced', {
      policiesProcessed: policies.length,
      totalExpired,
      totalTrimmed,
    });

    return { policiesProcessed: policies.length, totalExpired, totalTrimmed };
  }

  // ─── Access ────────────────────────────────────────────────────────────────

  /**
   * Check whether an agent may perform `operation` on a namespace.
   *
   * Returns `{ allowed: true }` when no access policy is configured (open by default).
   *
   * @param orgId      - organisation id (string form, e.g. "org-123")
   * @param namespace  - memory namespace (e.g. "org-123/global/products")
   * @param agentId    - the requesting agent's identifier (openId or internal id), or null
   * @param operation  - 'read' | 'write'
   */
  async checkAccess(
    orgId: string,
    namespace: string,
    agentId: string | null,
    operation: 'read' | 'write',
  ): Promise<{ allowed: boolean; reason?: string }> {
    const rules = await this.getPolicy<AccessRules>(orgId, namespace, 'access');

    // No policy configured → open access
    if (!rules) return { allowed: true };

    // Hard block
    if (rules.denyAll) {
      return { allowed: false, reason: 'Access denied by policy (denyAll=true)' };
    }

    // Write guard
    if (operation === 'write' && rules.readOnly) {
      return { allowed: false, reason: 'Namespace is read-only per access policy' };
    }

    // Agent allowlist (if specified, only listed agents may access)
    if (rules.allowedAgents && rules.allowedAgents.length > 0) {
      if (!agentId || !rules.allowedAgents.includes(agentId)) {
        return {
          allowed: false,
          reason: `Agent "${agentId ?? '(anonymous)'}" is not in the allowedAgents list for namespace "${namespace}"`,
        };
      }
    }

    return { allowed: true };
  }

  // ─── Conflict Resolution ───────────────────────────────────────────────────

  /**
   * Apply the conflict_resolution policy for a specific conflict.
   *
   * Resolution strategies:
   *  - latest-wins        : newer memory (createdAt) wins
   *  - confidence-wins    : higher confidence wins; optionally requires minConfidenceDelta
   *  - score-wins         : higher MemoryScore.finalScore wins (default)
   *  - queue-arbitration  : enqueue to BullMQ LLM worker
   *  - manual-review      : leave as pending (human review)
   *
   * Falls back to 'score-wins' when no policy is configured.
   *
   * Returns the action taken and, for auto-resolved conflicts, the winning memory id.
   */
  async resolveConflictByPolicy(
    conflictId: string,
    orgId: string,
    namespace: string,
  ): Promise<{ action: 'resolved' | 'queued' | 'pending'; winnerId?: string; strategy: string }> {
    const rules = await this.getPolicy<ConflictResolutionRules>(
      orgId,
      namespace,
      'conflict_resolution',
    );
    const strategy: ConflictStrategy = rules?.strategy ?? 'score-wins';

    // Manual review — leave as-is
    if (strategy === 'manual-review') {
      logger.info('Conflict left for manual review (policy)', { conflictId, orgId, namespace });
      return { action: 'pending', strategy };
    }

    // BullMQ LLM arbitration
    if (strategy === 'queue-arbitration') {
      try {
        const { arbitrationQueue } = await import('../workers/conflict-arbitration-worker');
        await arbitrationQueue.add('arbitrate', { conflictId }, { priority: 1 });
        logger.info('Conflict enqueued for LLM arbitration (policy)', { conflictId });
      } catch {
        logger.warn('BullMQ unavailable — conflict remains pending', { conflictId });
      }
      return { action: 'queued', strategy };
    }

    // Data-driven strategies: fetch the conflict record
    const conflict = await prisma.memoryConflict.findUnique({
      where: { id: conflictId },
      include: {
        memory1: { include: { score: true } },
        memory2: { include: { score: true } },
      },
    });

    if (!conflict) {
      throw new Error(`Conflict ${conflictId} not found`);
    }

    let winnerId: string;

    switch (strategy) {
      case 'latest-wins':
        winnerId =
          conflict.memory1.createdAt >= conflict.memory2.createdAt
            ? conflict.memoryId1
            : conflict.memoryId2;
        break;

      case 'confidence-wins': {
        const c1 = Number(conflict.memory1.confidence);
        const c2 = Number(conflict.memory2.confidence);
        const delta = Math.abs(c1 - c2);
        const minDelta = rules?.minConfidenceDelta ?? 0;

        if (delta < minDelta) {
          // Gap too small → fall back to queue-arbitration
          logger.info('Confidence delta below threshold, queueing for arbitration', {
            conflictId,
            delta,
            minDelta,
          });
          try {
            const { arbitrationQueue } = await import('../workers/conflict-arbitration-worker');
            await arbitrationQueue.add('arbitrate', { conflictId }, { priority: 2 });
          } catch { /* BullMQ unavailable */ }
          return { action: 'queued', strategy };
        }

        winnerId = c1 >= c2 ? conflict.memoryId1 : conflict.memoryId2;
        break;
      }

      case 'score-wins':
      default: {
        const s1 = conflict.memory1.score
          ? Number((conflict.memory1.score as any).finalScore)
          : Number(conflict.memory1.confidence);
        const s2 = conflict.memory2.score
          ? Number((conflict.memory2.score as any).finalScore)
          : Number(conflict.memory2.confidence);
        winnerId = s1 >= s2 ? conflict.memoryId1 : conflict.memoryId2;
        break;
      }
    }

    // Persist resolution
    await prisma.memoryConflict.update({
      where: { id: conflictId },
      data: {
        status: 'resolved',
        resolutionMemoryId: winnerId,
        resolvedAt: new Date(),
        resolvedBy: `policy:${strategy}`,
        explanation: `Auto-resolved by MemoryPolicy strategy "${strategy}"`,
      },
    });

    logger.info('Conflict resolved by policy', { conflictId, strategy, winnerId, orgId, namespace });
    return { action: 'resolved', winnerId, strategy };
  }
}

/** Singleton instance — import this in workers and routers */
export const memoryGovernance = new MemoryGovernanceService();
