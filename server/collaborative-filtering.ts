import { getDb } from "./db";
import { userBehavior, latentVectors, transactions } from "../drizzle/schema";
import { eq, and, inArray, sql, desc } from "drizzle-orm";
import { createLogger } from './utils/logger';

const logger = createLogger('CollaborativeFiltering');

/**
 * Collaborative Filtering Recommendation Engine
 * Uses user-item interaction matrix to find similar users and recommend items
 */

interface UserItemScore {
  userId: number;
  vectorId: number;
  score: number;
}

/**
 * Calculate similarity between two users based on their interactions
 */
function cosineSimilarity(userA: Map<number, number>, userB: Map<number, number>): number {
  const commonItems = Array.from(userA.keys()).filter(item => userB.has(item));
  
  if (commonItems.length === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  commonItems.forEach(item => {
    const scoreA = userA.get(item) || 0;
    const scoreB = userB.get(item) || 0;
    dotProduct += scoreA * scoreB;
  });

  userA.forEach(score => {
    normA += score * score;
  });

  userB.forEach(score => {
    normB += score * score;
  });

  if (normA === 0 || normB === 0) return 0;

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Get user-item interaction scores
 */
async function getUserItemMatrix(): Promise<Map<number, Map<number, number>>> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  // Fetch all user behaviors
  const behaviors = await db
    .select({
      userId: userBehavior.userId,
      vectorId: userBehavior.vectorId,
      actionType: userBehavior.actionType,
    })
    .from(userBehavior);

  // Build user-item matrix with weighted scores
  const matrix = new Map<number, Map<number, number>>();
  
  const actionWeights = {
    view: 1,
    click: 2,
    trial: 3,
    purchase: 5,
    review: 4,
  };

  behaviors.forEach(({ userId, vectorId, actionType }) => {
    if (!matrix.has(userId)) {
      matrix.set(userId, new Map());
    }
    
    const userScores = matrix.get(userId)!;
    const currentScore = userScores.get(vectorId) || 0;
    const weight = actionWeights[actionType] || 1;
    
    userScores.set(vectorId, currentScore + weight);
  });

  return matrix;
}

/**
 * Find similar users using collaborative filtering
 */
async function findSimilarUsers(targetUserId: number, topN: number = 10): Promise<Array<{ userId: number; similarity: number }>> {
  const matrix = await getUserItemMatrix();
  const targetUserScores = matrix.get(targetUserId);

  if (!targetUserScores || targetUserScores.size === 0) {
    return [];
  }

  const similarities: Array<{ userId: number; similarity: number }> = [];

  matrix.forEach((userScores, userId) => {
    if (userId === targetUserId) return;
    
    const similarity = cosineSimilarity(targetUserScores, userScores);
    if (similarity > 0) {
      similarities.push({ userId, similarity });
    }
  });

  return similarities
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topN);
}

/**
 * Generate recommendations using collaborative filtering
 */
export async function generateCollaborativeRecommendations(
  userId: number,
  limit: number = 10
): Promise<Array<{ vectorId: number; score: number; reason: string }>> {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");

    // Find similar users
    const similarUsers = await findSimilarUsers(userId, 20);

    if (similarUsers.length === 0) {
      return [];
    }

    // Get items that similar users interacted with
    const matrix = await getUserItemMatrix();
    const targetUserScores = matrix.get(userId) || new Map();
    const recommendations = new Map<number, { score: number; count: number }>();

    similarUsers.forEach(({ userId: similarUserId, similarity }) => {
      const similarUserScores = matrix.get(similarUserId);
      if (!similarUserScores) return;

      similarUserScores.forEach((score, vectorId) => {
        // Skip items the target user already interacted with
        if (targetUserScores.has(vectorId)) return;

        const current = recommendations.get(vectorId) || { score: 0, count: 0 };
        recommendations.set(vectorId, {
          score: current.score + (score * similarity),
          count: current.count + 1,
        });
      });
    });

    // Convert to array and sort by score
    const sortedRecommendations = Array.from(recommendations.entries())
      .map(([vectorId, { score, count }]) => ({
        vectorId,
        score: score / count, // Average weighted score
        reason: `Recommended by ${count} similar users`,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return sortedRecommendations;
  } catch (error) {
    logger.error("[Collaborative Filtering] Error generating recommendations:", error);
    return [];
  }
}

/**
 * Track user behavior for recommendation system
 */
export async function trackUserBehavior(
  userId: number,
  vectorId: number,
  actionType: "view" | "click" | "trial" | "purchase" | "review",
  duration?: number,
  metadata?: any
) {
  try {
    const db = await getDb();
    if (!db) return;

    await db.insert(userBehavior).values({
      userId,
      vectorId,
      actionType,
      duration,
      metadata: metadata ? JSON.stringify(metadata) : undefined,
    });
  } catch (error) {
    logger.error("[Collaborative Filtering] Error tracking behavior:", error);
  }
}
