/**
 * Memory Scoring Engine
 *
 * Calculates dynamic memory scores based on:
 * - Quality signals (confidence, reputation)
 * - Usage patterns (usage_count, validation_count)
 * - Time-based decay (exponential decay function)
 *
 * Formula:
 *   base_score = (confidence * reputation * 0.5)
 *              + (log(usage_count + 1) * 0.3)
 *              + (validation_ratio * 0.2)
 *
 *   decay_multiplier = exp(-λ * time_elapsed)
 *
 *   final_score = base_score * decay_multiplier
 */

import { MemoryEntry, MemoryScore, SCORING_WEIGHTS, DECAY_FACTORS } from './schema';

/**
 * Calculate base score from quality signals and usage patterns
 */
export function calculateBaseScore(memory: MemoryEntry): number {
  const { confidence, reputation, usage_count, validation_count } = memory;

  // Component 1: Confidence * Reputation (normalized to [0-100])
  const confidenceReputationScore = (confidence * reputation) / 100;

  // Component 2: Log-scaled usage count (prevents outliers from dominating)
  const usageScore = Math.log(usage_count + 1) * 10; // Scale to ~[0-50] range

  // Component 3: Validation ratio
  const validationRatio = usage_count > 0 ? validation_count / usage_count : 0;
  const validationScore = validationRatio * 100;

  // Weighted combination
  const baseScore =
    confidenceReputationScore * SCORING_WEIGHTS.confidence_reputation +
    usageScore * SCORING_WEIGHTS.usage_log +
    validationScore * SCORING_WEIGHTS.validation;

  // Clamp to [0-100]
  return Math.max(0, Math.min(100, baseScore));
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
 * Re-rank memories based on context and scores
 *
 * This is useful for combining vector similarity search with quality scores.
 * The combined score considers both semantic relevance and memory quality.
 */
export interface QueryContext {
  // Semantic similarity from vector search
  similarity_weight?: number; // Default: 0.7

  // Memory quality score
  score_weight?: number; // Default: 0.3

  // Boost recent memories
  recency_boost?: boolean; // Default: false
  recency_days?: number; // Default: 30 (boost memories from last 30 days)
  recency_multiplier?: number; // Default: 1.2
}

export interface RankableMemory {
  memory: MemoryEntry;
  score: number;
  similarity?: number;
}

export function rerank(
  memories: RankableMemory[],
  context: QueryContext = {}
): RankableMemory[] {
  const {
    similarity_weight = 0.7,
    score_weight = 0.3,
    recency_boost = false,
    recency_days = 30,
    recency_multiplier = 1.2,
  } = context;

  // Calculate combined score for each memory
  const ranked = memories.map((item) => {
    const { memory, score, similarity = 0 } = item;

    // Base combined score
    let combinedScore = similarity * similarity_weight + score * score_weight;

    // Apply recency boost if enabled
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
