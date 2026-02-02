import { prisma } from "./db-prisma";
import { generateCollaborativeRecommendations } from "./collaborative-filtering";
import { generateRecommendations as generateLLMRecommendations } from "./recommendation-engine";
import { createLogger } from "./utils/logger";

const logger = createLogger('ABTest');

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
    // Check if user already has an assignment
    const existing = await prisma.abTestAssignment.findFirst({
      where: {
        userId,
        experimentId,
      },
    });

    if (existing) {
      return existing.assignedAlgorithm as RecommendationAlgorithm;
    }

    // Get experiment details
    const experiment = await prisma.abTestExperiment.findUnique({
      where: { id: experimentId },
    });

    if (!experiment || experiment.status !== "running") {
      return "llm_based"; // Default if no active experiment
    }

    // Assign user to algorithm based on traffic split
    const random = Math.random();
    const assignedAlgorithm = random < parseFloat(experiment.trafficSplit.toString())
      ? experiment.algorithmA
      : experiment.algorithmB;

    // Save assignment
    await prisma.abTestAssignment.create({
      data: {
        experimentId,
        userId,
        assignedAlgorithm,
      },
    });

    return assignedAlgorithm as RecommendationAlgorithm;
  } catch (error) {
    logger.error(" Error getting assignment:", { error });
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
    // Get active experiment
    const activeExperiment = await prisma.abTestExperiment.findFirst({
      where: { status: "running" },
    });

    if (!activeExperiment) {
      // No active experiment, use default LLM-based
      const recommendations = await generateLLMRecommendations({ userId, limit });
      return recommendations.map((r) => ({ ...r, algorithm: "llm_based" as const }));
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

    return recommendations.map((r) => ({ ...r, algorithm }));
  } catch (error) {
    logger.error(" Error getting recommendations:", { error });
    return [];
  }
}

/**
 * Calculate A/B test metrics
 */
export async function calculateABTestMetrics(experimentId: number) {
  try {
    // Get all assignments for this experiment
    const assignments = await prisma.abTestAssignment.findMany({
      where: { experimentId },
    });

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
    logger.error(" Error calculating metrics:", { error });
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

  // Count interactions using raw SQL
  const metrics = await prisma.$queryRaw<Array<{
    totalViews: bigint;
    totalClicks: bigint;
    totalPurchases: bigint;
    avgDuration: number | null;
  }>>`
    SELECT
      SUM(CASE WHEN action_type = 'view' THEN 1 ELSE 0 END) as "totalViews",
      SUM(CASE WHEN action_type = 'click' THEN 1 ELSE 0 END) as "totalClicks",
      SUM(CASE WHEN action_type = 'purchase' THEN 1 ELSE 0 END) as "totalPurchases",
      AVG(duration) as "avgDuration"
    FROM user_behavior
    WHERE user_id = ANY(${userIds})
  `;

  const result = metrics[0];
  const totalViews = Number(result?.totalViews || 0);
  const totalClicks = Number(result?.totalClicks || 0);
  const totalPurchases = Number(result?.totalPurchases || 0);
  const avgDuration = Number(result?.avgDuration || 0);

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
    const result = await prisma.abTestExperiment.create({
      data: {
        name,
        description,
        algorithmA,
        algorithmB,
        trafficSplit: trafficSplit.toString(),
        status: "draft",
      },
    });

    return result.id;
  } catch (error) {
    logger.error(" Error creating experiment:", { error });
    return null;
  }
}

/**
 * Start an A/B test experiment
 */
export async function startABTestExperiment(experimentId: number) {
  try {
    await prisma.abTestExperiment.update({
      where: { id: experimentId },
      data: {
        status: "running",
        startDate: new Date(),
      },
    });

    return true;
  } catch (error) {
    logger.error(" Error starting experiment:", { error });
    return false;
  }
}

/**
 * Stop an A/B test experiment
 */
export async function stopABTestExperiment(experimentId: number) {
  try {
    await prisma.abTestExperiment.update({
      where: { id: experimentId },
      data: {
        status: "completed",
        endDate: new Date(),
      },
    });

    return true;
  } catch (error) {
    logger.error(" Error stopping experiment:", { error });
    return false;
  }
}
