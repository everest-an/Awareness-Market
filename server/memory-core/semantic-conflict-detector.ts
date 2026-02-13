/**
 * Semantic Conflict Detector (第2阶段: LLM-based Conflict Detection)
 *
 * Detects semantic contradictions between memories using LLM analysis.
 * Only processes "strategic pool" memories (high confidence + high usage) to reduce costs.
 *
 * Features:
 * - Batch processing (configurable batch size)
 * - Async execution (non-blocking)
 * - Strategic pool filtering (high-value memories only)
 * - Results stored in memory_conflicts table
 */

import { PrismaClient, MemoryEntry } from '@prisma/client';
import { invokeLLM } from '../llm-aws';

export interface SemanticConflictDetectorConfig {
  /**
   * Minimum confidence threshold for strategic pool (0-1)
   * Default: 0.8 (only high-confidence memories)
   */
  min_confidence?: number;

  /**
   * Minimum usage count for strategic pool
   * Default: 5 (memories that have been retrieved at least 5 times)
   */
  min_usageCount?: number;

  /**
   * Batch size for LLM processing
   * Default: 10 (process 10 memory pairs per batch)
   */
  batch_size?: number;

  /**
   * LLM model to use
   * Default: 'gpt-4o'
   */
  model?: string;

  /**
   * Maximum age in days (only check recent memories)
   * Default: 90 (memories created in last 90 days)
   */
  max_age_days?: number;
}

interface ConflictDetectionResult {
  has_conflict: boolean;
  confidence: number; // 0-1, how confident the LLM is about the conflict
  explanation: string;
  conflicting_claims?: string[];
}

export class SemanticConflictDetector {
  private config: Required<SemanticConflictDetectorConfig>;

  constructor(
    private prisma: PrismaClient,
    config: SemanticConflictDetectorConfig = {}
  ) {
    this.config = {
      min_confidence: config.min_confidence ?? 0.8,
      min_usageCount: config.min_usageCount ?? 5,
      batch_size: config.batch_size ?? 10,
      model: config.model ?? 'gpt-4o',
      max_age_days: config.max_age_days ?? 90,
    };
  }

  /**
   * Get strategic pool memories for an organization
   *
   * Strategic pool = high confidence + high usage + recent
   */
  private async getStrategicPool(orgId: string): Promise<MemoryEntry[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.max_age_days);

    const pool = await this.prisma.memoryEntry.findMany({
      where: {
        orgId,
        is_latest: true,
        confidence: {
          gte: this.config.min_confidence,
        },
        usageCount: {
          gte: this.config.min_usageCount,
        },
        createdAt: {
          gte: cutoffDate,
        },
      },
      include: {
        score: true,
      },
      orderBy: [
        { usageCount: 'desc' },
        { confidence: 'desc' },
      ],
    });

    return pool;
  }

  /**
   * Detect semantic conflicts using LLM for a single pair of memories
   */
  private async detectConflictPair(
    memory1: MemoryEntry,
    memory2: MemoryEntry
  ): Promise<ConflictDetectionResult> {
    const prompt = `You are a semantic conflict detector. Analyze these two memory entries and determine if they contradict each other.

Memory 1:
Content: ${memory1.content}
Namespace: ${memory1.namespace}
Created: ${memory1.createdAt.toISOString()}
Confidence: ${memory1.confidence}

Memory 2:
Content: ${memory2.content}
Namespace: ${memory2.namespace}
Created: ${memory2.createdAt.toISOString()}
Confidence: ${memory2.confidence}

Determine if these memories semantically contradict each other. A contradiction exists when:
1. They make opposing claims about the same fact or concept
2. One memory invalidates or negates the other
3. They provide mutually exclusive information

Do NOT flag as conflicts:
- Complementary information (adding details without contradicting)
- Context-dependent statements (both can be true in different contexts)
- Temporal updates (newer information superseding old is expected)

Respond in JSON format:
{
  "has_conflict": boolean,
  "confidence": number (0-1),
  "explanation": string,
  "conflicting_claims": [string] (optional, array of specific contradictory statements)
}`;

    try {
      const response = await invokeLLM({
        messages: [
          {
            role: 'system',
            content:
              'You are a precise semantic analyzer. Only flag clear contradictions, not complementary or contextual differences.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        model: this.config.model,
        temperature: 0.2, // Low temperature for consistent analysis
        max_tokens: 500,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'conflict_detection',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                has_conflict: { type: 'boolean' },
                confidence: { type: 'number' },
                explanation: { type: 'string' },
                conflicting_claims: {
                  type: 'array',
                  items: { type: 'string' },
                },
              },
              required: ['has_conflict', 'confidence', 'explanation'],
              additionalProperties: false,
            },
          },
        },
      });

      const result = JSON.parse(
        response.choices[0].message.content || '{}'
      ) as ConflictDetectionResult;

      return result;
    } catch (error: any) {
      console.error('[SemanticConflictDetector] LLM error:', error.message);
      // Return no conflict on error (fail safe)
      return {
        has_conflict: false,
        confidence: 0,
        explanation: `Error during analysis: ${error.message}`,
      };
    }
  }

  /**
   * Run semantic conflict detection for an organization
   *
   * This is an async batch process that:
   * 1. Gets strategic pool memories
   * 2. Compares pairs of memories within same namespace
   * 3. Uses LLM to detect semantic contradictions
   * 4. Stores detected conflicts in memory_conflicts table
   *
   * Usage:
   * ```typescript
   * const results = await detector.detectConflicts('org-123');
   * console.log('Checked:', results.pairs_checked);
   * console.log('Conflicts found:', results.conflicts_detected);
   * ```
   */
  async detectConflicts(orgId: string): Promise<{
    pairs_checked: number;
    conflicts_detected: number;
    conflicts_saved: number;
    strategic_pool_size: number;
    duration_ms: number;
  }> {
    const startTime = Date.now();

    // Get strategic pool
    const pool = await this.getStrategicPool(orgId);

    if (pool.length < 2) {
      return {
        pairs_checked: 0,
        conflicts_detected: 0,
        conflicts_saved: 0,
        strategic_pool_size: pool.length,
        duration_ms: Date.now() - startTime,
      };
    }

    // Group by namespace (only compare within same namespace)
    const namespaceGroups = new Map<string, MemoryEntry[]>();
    pool.forEach((memory) => {
      const namespace = memory.namespace;
      if (!namespaceGroups.has(namespace)) {
        namespaceGroups.set(namespace, []);
      }
      namespaceGroups.get(namespace)!.push(memory);
    });

    let pairsChecked = 0;
    let conflictsDetected = 0;
    let conflictsSaved = 0;

    // Process each namespace group
    for (const [namespace, memories] of namespaceGroups) {
      if (memories.length < 2) continue;

      // Generate all pairs
      const pairs: [MemoryEntry, MemoryEntry][] = [];
      for (let i = 0; i < memories.length; i++) {
        for (let j = i + 1; j < memories.length; j++) {
          pairs.push([memories[i], memories[j]]);
        }
      }

      // Process in batches
      for (let i = 0; i < pairs.length; i += this.config.batch_size) {
        const batch = pairs.slice(i, i + this.config.batch_size);

        // Process batch in parallel
        const results = await Promise.all(
          batch.map(([m1, m2]) => this.detectConflictPair(m1, m2))
        );

        // Save detected conflicts
        for (let j = 0; j < results.length; j++) {
          const result = results[j];
          const [m1, m2] = batch[j];

          pairsChecked++;

          if (result.has_conflict && result.confidence >= 0.7) {
            // Only save high-confidence conflicts
            conflictsDetected++;

            try {
              // Check if conflict already exists
              const existing = await this.prisma.memoryConflict.findFirst({
                where: {
                  OR: [
                    {
                      memoryId1: m1.id,
                      memoryId2: m2.id,
                    },
                    {
                      memoryId1: m2.id,
                      memoryId2: m1.id,
                    },
                  ],
                },
              });

              if (!existing) {
                await this.prisma.memoryConflict.create({
                  data: {
                    memoryId1: m1.id,
                    memoryId2: m2.id,
                    conflictType: 'semantic_contradiction',
                    status: 'pending',
                    detectedAt: new Date(),
                    // Store LLM explanation in metadata (if Prisma supports JSON)
                    // metadata: {
                    //   llm_confidence: result.confidence,
                    //   explanation: result.explanation,
                    //   conflicting_claims: result.conflicting_claims,
                    // },
                  },
                });

                conflictsSaved++;
              }
            } catch (error: any) {
              console.error('[SemanticConflictDetector] Error saving conflict:', error.message);
            }
          }
        }

        // Rate limiting: small delay between batches
        if (i + this.config.batch_size < pairs.length) {
          await new Promise((resolve) => setTimeout(resolve, 1000)); // 1s delay
        }
      }
    }

    return {
      pairs_checked: pairsChecked,
      conflicts_detected: conflictsDetected,
      conflicts_saved: conflictsSaved,
      strategic_pool_size: pool.length,
      duration_ms: Date.now() - startTime,
    };
  }

  /**
   * Schedule background conflict detection (for cron jobs)
   *
   * Usage:
   * ```typescript
   * // Run every 6 hours for all active orgs
   * await detector.scheduleDetection(['org-1', 'org-2', 'org-3']);
   * ```
   */
  async scheduleDetection(orgIds: string[]): Promise<void> {
    console.log(`[SemanticConflictDetector] Starting scheduled detection for ${orgIds.length} orgs`);

    for (const orgId of orgIds) {
      try {
        const results = await this.detectConflicts(orgId);
        console.log(
          `[SemanticConflictDetector] ${orgId}: Checked ${results.pairs_checked} pairs, found ${results.conflicts_detected} conflicts (${results.duration_ms}ms)`
        );
      } catch (error: any) {
        console.error(`[SemanticConflictDetector] Error for ${orgId}:`, error.message);
      }

      // Delay between orgs to avoid rate limits
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    console.log('[SemanticConflictDetector] Scheduled detection complete');
  }
}

/**
 * Factory function to create SemanticConflictDetector instance
 */
export function createSemanticConflictDetector(
  prisma: PrismaClient,
  config?: SemanticConflictDetectorConfig
): SemanticConflictDetector {
  return new SemanticConflictDetector(prisma, config);
}
