import { getDb } from "./db";
import { abTestExperiments, abTestAssignments, userBehavior } from "../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";
import { generateCollaborativeRecommendations } from "./collaborative-filtering";
import { generateRecommendations as generateLLMRecommendations } from "./recommendation-engine";

/**
 * A/B Testing Framework for Recommendation Algorithms
 */

export type RecommendationAlgorithm = "llm_based" | "collaborative_filtering" | "hybrid";

/**
 * Get or create A/B test assignment for a user
 */
export async function getABTestAssignment(
  userId: number,
  experimentId: number
): Promise<RecommendationAlgorithm> {
  try {
    const db = await getDb();
    if (!db) return "llm_based"; // Default fallback

    // Check if user already has an assignment
    const [existing] = await db
      .select()
      .from(abTestAssignments)
      .where(
        and(
          eq(abTestAssignments.userId, userId),
          eq(abTestAssignments.experimentId, experimentId)
        )
      )
      .limit(1);

    if (existing) {
      return existing.assignedAlgorithm as RecommendationAlgorithm;
    }

    // Get experiment details
    const [experiment] = await db
      .select()
      .from(abTestExperiments)
      .where(eq(abTestExperiments.id, experimentId))
      .limit(1);

    if (!experiment || experiment.status !== "running") {
      return "llm_based"; // Default if no active experiment
    }

    // Assign user to algorithm based on traffic split
    const random = Math.random();
    const assignedAlgorithm = random < parseFloat(experiment.trafficSplit.toString())
      ? experiment.algorithmA
      : experiment.algorithmB;

    // Save assignment
    await db.insert(abTestAssignments).values({
      experimentId,
      userId,
      assignedAlgorithm,
    });

    return assignedAlgorithm as RecommendationAlgorithm;
  } catch (error) {
    console.error("[A/B Test] Error getting assignment:", error);
    return "llm_based"; // Default fallback
  }
}

/**
 * Get recommendations based on A/B test assignment
 */
export async function getRecommendationsWithABTest(
  userId: number,
  limit: number = 10
): Promise<Array<{ vectorId: number; score: number; reason: string; algorithm: string }>> {
  try {
    const db = await getDb();
    if (!db) return [];

    // Get active experiment
    const [activeExperiment] = await db
      .select()
      .from(abTestExperiments)
      .where(eq(abTestExperiments.status, "running"))
      .limit(1);

    if (!activeExperiment) {
      // No active experiment, use default LLM-based
      const recommendations = await generateLLMRecommendations({ userId, limit });
      return recommendations.map((r: any) => ({ ...r, algorithm: "llm_based" }));
    }

    // Get user's assignment
    const algorithm = await getABTestAssignment(userId, activeExperiment.id);

    let recommendations: Array<{ vectorId: number; score: number; reason: string }> = [];

    switch (algorithm) {
      case "collaborative_filtering":
        recommendations = await generateCollaborativeRecommendations(userId, limit);
        break;
      case "hybrid":
        // Combine both algorithms
        const llmRecs = await generateLLMRecommendations({ userId, limit: Math.ceil(limit / 2) });
        const cfRecs = await generateCollaborativeRecommendations(userId, Math.ceil(limit / 2));
        recommendations = [...llmRecs, ...cfRecs].slice(0, limit);
        break;
      case "llm_based":
      default:
        recommendations = await generateLLMRecommendations({ userId, limit });
        break;
    }

    return recommendations.map((r: any) => ({ ...r, algorithm }));
  } catch (error) {
    console.error("[A/B Test] Error getting recommendations:", error);
    return [];
  }
}

/**
 * Calculate A/B test metrics
 */
export async function calculateABTestMetrics(experimentId: number) {
  try {
    const db = await getDb();
    if (!db) return null;

    // Get all assignments for this experiment
    const assignments = await db
      .select()
      .from(abTestAssignments)
      .where(eq(abTestAssignments.experimentId, experimentId));

    const algorithmA = assignments.filter(a => a.assignedAlgorithm === "llm_based");
    const algorithmB = assignments.filter(a => a.assignedAlgorithm === "collaborative_filtering");

    // Calculate metrics for each algorithm
    const metricsA = await calculateAlgorithmMetrics(algorithmA.map(a => a.userId));
    const metricsB = await calculateAlgorithmMetrics(algorithmB.map(a => a.userId));

    return {
      experimentId,
      algorithmA: {
        name: "LLM-Based",
        users: algorithmA.length,
        ...metricsA,
      },
      algorithmB: {
        name: "Collaborative Filtering",
        users: algorithmB.length,
        ...metricsB,
      },
    };
  } catch (error) {
    console.error("[A/B Test] Error calculating metrics:", error);
    return null;
  }
}

/**
 * Calculate metrics for a group of users
 */
async function calculateAlgorithmMetrics(userIds: number[]) {
  if (userIds.length === 0) {
    return {
      clickThroughRate: 0,
      conversionRate: 0,
      avgEngagementTime: 0,
    };
  }

  const db = await getDb();
  if (!db) return { clickThroughRate: 0, conversionRate: 0, avgEngagementTime: 0 };

  // Count interactions
  const [metrics] = await db
    .select({
      totalViews: sql<number>`SUM(CASE WHEN ${userBehavior.actionType} = 'view' THEN 1 ELSE 0 END)`,
      totalClicks: sql<number>`SUM(CASE WHEN ${userBehavior.actionType} = 'click' THEN 1 ELSE 0 END)`,
      totalPurchases: sql<number>`SUM(CASE WHEN ${userBehavior.actionType} = 'purchase' THEN 1 ELSE 0 END)`,
      avgDuration: sql<number>`AVG(${userBehavior.duration})`,
    })
    .from(userBehavior)
    .where(sql`${userBehavior.userId} IN (${userIds.join(",")})`);

  const totalViews = Number(metrics?.totalViews || 0);
  const totalClicks = Number(metrics?.totalClicks || 0);
  const totalPurchases = Number(metrics?.totalPurchases || 0);
  const avgDuration = Number(metrics?.avgDuration || 0);

  return {
    clickThroughRate: totalViews > 0 ? (totalClicks / totalViews) * 100 : 0,
    conversionRate: totalClicks > 0 ? (totalPurchases / totalClicks) * 100 : 0,
    avgEngagementTime: avgDuration,
  };
}

/**
 * Create a new A/B test experiment
 */
export async function createABTestExperiment(
  name: string,
  description: string,
  algorithmA: string,
  algorithmB: string,
  trafficSplit: number = 0.5
) {
  try {
    const db = await getDb();
    if (!db) return null;

    const [result] = await db.insert(abTestExperiments).values({
      name,
      description,
      algorithmA,
      algorithmB,
      trafficSplit: trafficSplit.toString(),
      status: "draft",
    });

    return result.insertId;
  } catch (error) {
    console.error("[A/B Test] Error creating experiment:", error);
    return null;
  }
}

/**
 * Start an A/B test experiment
 */
export async function startABTestExperiment(experimentId: number) {
  try {
    const db = await getDb();
    if (!db) return false;

    await db
      .update(abTestExperiments)
      .set({
        status: "running",
        startDate: new Date(),
      })
      .where(eq(abTestExperiments.id, experimentId));

    return true;
  } catch (error) {
    console.error("[A/B Test] Error starting experiment:", error);
    return false;
  }
}

/**
 * Stop an A/B test experiment
 */
export async function stopABTestExperiment(experimentId: number) {
  try {
    const db = await getDb();
    if (!db) return false;

    await db
      .update(abTestExperiments)
      .set({
        status: "completed",
        endDate: new Date(),
      })
      .where(eq(abTestExperiments.id, experimentId));

    return true;
  } catch (error) {
    console.error("[A/B Test] Error stopping experiment:", error);
    return false;
  }
}
