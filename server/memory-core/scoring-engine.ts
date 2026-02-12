/**
 * Memory Scoring Engine (第1阶段: Basic Scoring + Usage Tracking)
 *
 * User-specified formula (不讲概念，直接讲可落地实现方案):
 *
 *   final_ranking_score = (
 *     similarity * 0.4 +
 *     log(usage_count + 1) * 0.2 +
 *     validation_ratio * 0.2 +
 *     (reputation / 100) * 0.2
 *   ) * time_decay
 *
 * Key points:
 * - similarity 只是 40% (similarity is only 40%)
 * - 使用次数影响排序 (usage count affects ranking)
 * - 老旧内容自动降权 (old content auto-downranked)
 *
 * Implementation:
 *   quality_score = log(usage+1)*0.2 + validation_ratio*0.2 + reputation*0.2
 *   time_decay = exp(-λ * days_since_created)
 *   base_score = quality_score * time_decay (stored in DB)
 *   final_score = similarity*0.4 + base_score (calculated during query)
 */

import { MemoryEntry, MemoryScore, SCORING_WEIGHTS, DECAY_FACTORS } from './schema';

/**
 * Calculate quality score (第1阶段: Basic Scoring)
 *
 * Formula (user spec):
 *   quality_score = log(usage_count + 1) * 0.2
 *                 + validation_ratio * 0.2
 *                 + (reputation / 100) * 0.2
 *
 * This is the 60% component (non-similarity part).
 * Scaled to [0-100] for storage.
 */
export function calculateBaseScore(memory: MemoryEntry): number {
  const { reputation, usage_count, validation_count } = memory;

  // Component 1: Log-scaled usage (prevents outliers from dominating)
  // Normalize: log(usage+1) / 10 gives ~0-1 range for reasonable usage counts
  // Then multiply by 20 to get 0-20 contribution
  const usageComponent = (Math.log(usage_count + 1) / 10) * 20;

  // Component 2: Validation ratio (0-1) * 20 = 0-20 contribution
  const validationRatio = usage_count > 0 ? validation_count / usage_count : 0;
  const validationComponent = validationRatio * 20;

  // Component 3: Reputation normalized to 0-1, then * 20 = 0-20 contribution
  const reputationComponent = (reputation / 100) * 20;

  // Total quality score: max 60 (representing 60% of final score)
  const qualityScore = usageComponent + validationComponent + reputationComponent;

  // Clamp to [0-60] (the 60% non-similarity component)
  return Math.max(0, Math.min(60, qualityScore));
}

/**
 * Calculate time-based decay multiplier
 *
 * Uses exponential decay: exp(-λ * t)
 * where:
 *   λ = decay_factor (varies by content_type)
 *   t = time elapsed since decay_checkpoint (in days)
 */
export function calculateDecayMultiplier(memory: MemoryEntry): number {
  const now = new Date();
  const checkpoint = new Date(memory.decay_checkpoint);

  // Time elapsed in days
  const elapsedMs = now.getTime() - checkpoint.getTime();
  const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24);

  // Exponential decay: e^(-λt)
  const lambda = memory.decay_factor;
  const decayMultiplier = Math.exp(-lambda * elapsedDays);

  // Clamp to [0-1]
  return Math.max(0, Math.min(1, decayMultiplier));
}

/**
 * Calculate final score (base_score * decay_multiplier)
 */
export function calculateFinalScore(memory: MemoryEntry): number {
  const baseScore = calculateBaseScore(memory);
  const decayMultiplier = calculateDecayMultiplier(memory);
  return baseScore * decayMultiplier;
}

/**
 * Calculate full memory score object
 */
export function calculateMemoryScore(memory: MemoryEntry): Omit<MemoryScore, 'memory_id'> {
  const baseScore = calculateBaseScore(memory);
  const decayMultiplier = calculateDecayMultiplier(memory);
  const finalScore = baseScore * decayMultiplier;

  return {
    base_score: Math.round(baseScore * 100) / 100, // Round to 2 decimals
    decay_multiplier: Math.round(decayMultiplier * 10000) / 10000, // Round to 4 decimals
    final_score: Math.round(finalScore * 100) / 100,
    last_calculated: new Date(),
  };
}

/**
 * Re-rank memories based on user-specified formula (第1阶段)
 *
 * User spec: "similarity 只是 40%" (similarity is only 40%)
 *
 * Formula:
 *   final_score = (similarity * 0.4 + quality_score) * time_decay
 *
 * Where:
 *   - similarity: 0-1 from pgvector cosine similarity
 *   - quality_score: 0-60 from log(usage+1)*20 + validation*20 + reputation*20
 *   - time_decay: exp(-λ * days)
 *
 * Combined: similarity*40 + quality*60 (max 100 before decay)
 */
export interface QueryContext {
  // Semantic similarity from vector search (user spec: 40%)
  similarity_weight?: number; // Default: 0.4

  // Memory quality score (user spec: 60%)
  score_weight?: number; // Default: 0.6

  // Boost recent memories (optional, not in user spec)
  recency_boost?: boolean; // Default: false
  recency_days?: number; // Default: 30
  recency_multiplier?: number; // Default: 1.2
}

export interface RankableMemory {
  memory: MemoryEntry;
  score: number; // quality score from DB (0-60 range)
  similarity?: number; // cosine similarity from vector search (0-1 range)
}

export function rerank(
  memories: RankableMemory[],
  context: QueryContext = {}
): RankableMemory[] {
  const {
    similarity_weight = 0.4, // User spec: similarity is only 40%
    score_weight = 0.6, // User spec: quality is 60%
    recency_boost = false,
    recency_days = 30,
    recency_multiplier = 1.2,
  } = context;

  // Calculate combined score for each memory (user formula)
  const ranked = memories.map((item) => {
    const { memory, score, similarity = 0 } = item;

    // User formula: similarity*40 + quality_score (already 0-60)
    // similarity: 0-1 → scale to 0-40 range
    // score: 0-60 (quality score from DB)
    let combinedScore = (similarity * 40 * similarity_weight / 0.4) + (score * score_weight / 0.6);

    // When using default weights (0.4, 0.6), this simplifies to:
    // combinedScore = similarity * 40 + score

    // Apply recency boost if enabled (not in user spec, but useful)
    if (recency_boost) {
      const now = new Date();
      const createdAt = new Date(memory.created_at);
      const ageInDays = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

      if (ageInDays <= recency_days) {
        combinedScore *= recency_multiplier;
      }
    }

    return {
      ...item,
      score: combinedScore,
    };
  });

  // Sort by combined score (descending)
  ranked.sort((a, b) => b.score - a.score);

  return ranked;
}

/**
 * Batch calculate scores for multiple memories
 * More efficient than calculating one by one
 */
export function batchCalculateScores(memories: MemoryEntry[]): Map<string, MemoryScore> {
  const scores = new Map<string, MemoryScore>();

  for (const memory of memories) {
    const score = calculateMemoryScore(memory);
    scores.set(memory.id, {
      memory_id: memory.id,
      ...score,
    });
  }

  return scores;
}

/**
 * Get optimal decay factor for a content type
 */
export function getDecayFactor(contentType: string): number {
  return DECAY_FACTORS[contentType as keyof typeof DECAY_FACTORS] || DECAY_FACTORS.text;
}

/**
 * Calculate half-life (in days) from decay factor
 * Half-life = ln(2) / λ
 */
export function calculateHalfLife(decayFactor: number): number {
  return Math.log(2) / decayFactor;
}

/**
 * Estimate decay multiplier after N days
 */
export function estimateDecay(decayFactor: number, days: number): number {
  return Math.exp(-decayFactor * days);
}

/**
 * Example usage and testing
 */
export function exampleScoring() {
  const exampleMemory: MemoryEntry = {
    id: 'test-123',
    org_id: 'org-123',
    namespace: 'engineering',
    content_type: 'text',
    content: 'We use JWT tokens for authentication',
    confidence: 0.9,
    reputation: 75,
    usage_count: 15,
    validation_count: 12,
    version: 1,
    is_latest: true,
    created_by: 'user-alice',
    created_at: new Date('2025-12-01'),
    updated_at: new Date('2025-12-01'),
    accessed_at: new Date(),
    decay_factor: 0.01,
    decay_checkpoint: new Date('2025-12-01'),
  };

  const score = calculateMemoryScore(exampleMemory);

  console.log('[ScoringEngine] Example scoring:');
  console.log('  Memory:', exampleMemory.content);
  console.log('  Base Score:', score.base_score);
  console.log('  Decay Multiplier:', score.decay_multiplier);
  console.log('  Final Score:', score.final_score);
  console.log('  Half-life:', calculateHalfLife(exampleMemory.decay_factor), 'days');
}
