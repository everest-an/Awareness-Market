/**
 * Vector Similarity Utilities
 *
 * Provides efficient vector similarity calculations
 * for semantic search and memory matching
 */

/**
 * Calculate cosine similarity between two vectors
 *
 * Cosine similarity: cos(θ) = (A · B) / (||A|| × ||B||)
 * Returns value between -1 and 1, where:
 * - 1 = identical direction
 * - 0 = orthogonal
 * - -1 = opposite direction
 *
 * @param a First vector
 * @param b Second vector
 * @returns Cosine similarity score (0-1 range, negative values clamped to 0)
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length === 0 || b.length === 0) {
    return 0;
  }

  // Handle vectors of different lengths by taking the minimum
  const minLen = Math.min(a.length, b.length);
  const v1 = a.slice(0, minLen);
  const v2 = b.slice(0, minLen);

  // Calculate dot product: A · B
  let dotProduct = 0;
  for (let i = 0; i < minLen; i++) {
    dotProduct += v1[i] * v2[i];
  }

  // Calculate magnitudes: ||A|| and ||B||
  let magnitude1 = 0;
  let magnitude2 = 0;
  for (let i = 0; i < minLen; i++) {
    magnitude1 += v1[i] * v1[i];
    magnitude2 += v2[i] * v2[i];
  }

  magnitude1 = Math.sqrt(magnitude1);
  magnitude2 = Math.sqrt(magnitude2);

  // Avoid division by zero
  if (magnitude1 === 0 || magnitude2 === 0) {
    return 0;
  }

  // Calculate cosine similarity
  const similarity = dotProduct / (magnitude1 * magnitude2);

  // Clamp to [0, 1] range (negative similarities treated as 0)
  return Math.max(0, Math.min(1, similarity));
}

/**
 * Calculate Euclidean distance between two vectors
 * Lower distance = more similar
 *
 * @param a First vector
 * @param b Second vector
 * @returns Euclidean distance
 */
export function euclideanDistance(a: number[], b: number[]): number {
  if (!a || !b || a.length === 0 || b.length === 0) {
    return Infinity;
  }

  const minLen = Math.min(a.length, b.length);
  let sum = 0;

  for (let i = 0; i < minLen; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }

  return Math.sqrt(sum);
}

/**
 * Convert Euclidean distance to similarity score (0-1 range)
 * Uses exponential decay for smooth conversion
 *
 * @param distance Euclidean distance
 * @param scale Scale parameter (default: 1.0, smaller = faster decay)
 * @returns Similarity score (0-1)
 */
export function distanceToSimilarity(distance: number, scale: number = 1.0): number {
  if (distance === 0) return 1.0;
  if (!isFinite(distance)) return 0;

  // Exponential decay: similarity = e^(-distance/scale)
  return Math.exp(-distance / scale);
}

/**
 * Batch calculate cosine similarities between a query vector and multiple candidate vectors
 * Optimized for when you need to compare one vector against many
 *
 * @param query Query vector
 * @param candidates Array of candidate vectors
 * @returns Array of similarity scores in the same order as candidates
 */
export function batchCosineSimilarity(query: number[], candidates: number[][]): number[] {
  if (!query || query.length === 0 || !candidates || candidates.length === 0) {
    return [];
  }

  return candidates.map(candidate => cosineSimilarity(query, candidate));
}

/**
 * Find top K most similar vectors
 *
 * @param query Query vector
 * @param candidates Array of candidate vectors
 * @param k Number of top results to return
 * @param minSimilarity Minimum similarity threshold (default: 0)
 * @returns Array of {index, similarity} sorted by similarity (descending)
 */
export function topKSimilar(
  query: number[],
  candidates: number[][],
  k: number = 5,
  minSimilarity: number = 0
): Array<{ index: number; similarity: number }> {
  if (!query || query.length === 0 || !candidates || candidates.length === 0) {
    return [];
  }

  // Calculate all similarities
  const similarities = candidates.map((candidate, index) => ({
    index,
    similarity: cosineSimilarity(query, candidate),
  }));

  // Filter by minimum threshold and sort descending
  return similarities
    .filter(item => item.similarity >= minSimilarity)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, k);
}

/**
 * Normalize a vector to unit length (L2 normalization)
 * Useful for comparing vectors using dot product instead of cosine similarity
 *
 * @param vector Input vector
 * @returns Normalized vector
 */
export function normalizeVector(vector: number[]): number[] {
  if (!vector || vector.length === 0) {
    return [];
  }

  let magnitude = 0;
  for (const val of vector) {
    magnitude += val * val;
  }
  magnitude = Math.sqrt(magnitude);

  if (magnitude === 0) {
    return vector.slice(); // Return copy of original if all zeros
  }

  return vector.map(val => val / magnitude);
}

/**
 * Parse vector data from various formats
 * Handles JSON strings, arrays, and null/undefined
 *
 * @param vectorData Raw vector data (string, array, or null)
 * @returns Parsed number array or null if parsing fails
 */
export function parseVectorData(vectorData: string | number[] | null | undefined): number[] | null {
  if (!vectorData) {
    return null;
  }

  // Already an array
  if (Array.isArray(vectorData)) {
    return vectorData;
  }

  // Try parsing as JSON
  if (typeof vectorData === 'string') {
    try {
      const parsed = JSON.parse(vectorData);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      // Parsing failed, return null
    }
  }

  return null;
}
