import { Router, Request, Response } from "express";
import { prisma } from "./db-prisma";
const prismaAny = prisma as any;
import { runVector } from "./vector-runtime";
import { createLogger } from "./utils/logger";

const logger = createLogger('Trial');

type LatentVector = {
  id: number;
  title: string;
  description: string | null;
  category: string;
  vectorFileUrl: string | null;
  vectorFileKey: string | null;
  freeTrialCalls: number;
};

// Type extension for authenticated request
interface AuthenticatedRequest extends Request {
  user?: { id: number };
}

const router = Router();

/**
 * Check remaining trial calls for a vector
 */
router.get("/remaining/:vectorId", async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const vectorId = parseInt(req.params.vectorId);

    // Get vector's free trial limit
    const vector = await prisma.latentVector.findUnique({
      where: { id: vectorId },
      select: { freeTrialCalls: true }
    });

    if (!vector) {
      return res.status(404).json({ error: "Vector not found" });
    }

    // Count user's trial usage
    const usedCalls = await prismaAny.trialUsage.count({
      where: {
        userId,
        vectorId
      }
    });
    const remainingCalls = Math.max(0, vector.freeTrialCalls - usedCalls);

    res.json({
      vectorId,
      totalTrialCalls: vector.freeTrialCalls,
      usedCalls,
      remainingCalls,
      canTry: remainingCalls > 0,
    });
  } catch (error) {
    logger.error("[Trial API] Error checking remaining calls:", { error });
    res.status(500).json({ error: "Failed to check trial status" });
  }
});

/**
 * Execute a trial call
 */
router.post("/execute", async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { vectorId, input } = req.body;

    if (!vectorId || !input) {
      return res.status(400).json({ error: "Vector ID and input required" });
    }

    // Check remaining trials
    const vector = await prisma.latentVector.findUnique({
      where: { id: vectorId },
      select: {
        freeTrialCalls: true,
        title: true,
        vectorFileUrl: true,
        vectorFileKey: true,
      }
    });

    if (!vector) {
      return res.status(404).json({ error: "Vector not found" });
    }

    const usedCalls = await prismaAny.trialUsage.count({
      where: {
        userId,
        vectorId
      }
    });
    if (usedCalls >= vector.freeTrialCalls) {
      return res.status(403).json({ 
        error: "Trial limit exceeded",
        message: "You have used all your free trial calls for this vector. Please purchase to continue.",
      });
    }

    const runtimeResult = await runVector({
      vector: {
        ...vector,
        id: vectorId,
        description: vector.title,
        category: "trial",
      } as any,
      context: input,
    });

    // Record trial usage
    await prismaAny.trialUsage.create({
      data: {
        userId,
        vectorId,
        usedCalls: 1,
        inputData: JSON.stringify(input),
        outputData: JSON.stringify({
          output: runtimeResult.text,
          model: runtimeResult.model,
          usage: runtimeResult.usage,
          processingTimeMs: runtimeResult.processingTimeMs,
        }),
        success: true,
      }
    });

    res.json({
      success: true,
      output: {
        text: runtimeResult.text,
        model: runtimeResult.model,
        usage: runtimeResult.usage,
        processingTimeMs: runtimeResult.processingTimeMs,
      },
      remainingCalls: vector.freeTrialCalls - usedCalls - 1,
    });
  } catch (error) {
    logger.error("[Trial API] Error executing trial:", { error });
    res.status(500).json({ error: "Failed to execute trial" });
  }
});

/**
 * Get trial history for a user
 */
router.get("/history", async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const history = await prisma.$queryRaw<Array<{
      id: number;
      vectorId: number;
      vectorTitle: string | null;
      inputData: string | null;
      outputData: string | null;
      success: boolean;
      errorMessage: string | null;
      createdAt: Date;
    }>>`
      SELECT
        tu.id,
        tu.vector_id as "vectorId",
        lv.title as "vectorTitle",
        tu.input_data as "inputData",
        tu.output_data as "outputData",
        tu.success,
        tu.error_message as "errorMessage",
        tu.created_at as "createdAt"
      FROM trial_usage tu
      LEFT JOIN latent_vectors lv ON tu.vector_id = lv.id
      WHERE tu.user_id = ${userId}
      ORDER BY tu.created_at DESC
      LIMIT 50
    `;

    res.json(history);
  } catch (error) {
    logger.error("[Trial API] Error fetching history:", { error });
    res.status(500).json({ error: "Failed to fetch trial history" });
  }
});

export default router;
