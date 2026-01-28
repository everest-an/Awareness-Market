import { Router, Request, Response } from "express";
import { getDb } from "./db";
import { runVector } from "./vector-runtime";
import { trialUsage, latentVectors } from "../drizzle/schema";
import { eq, and, count, sql } from "drizzle-orm";
import { createLogger } from "./utils/logger";

const logger = createLogger('Trial');

const router = Router();

/**
 * Check remaining trial calls for a vector
 */
router.get("/remaining/:vectorId", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const vectorId = parseInt(req.params.vectorId);
    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: "Database unavailable" });
    }

    // Get vector's free trial limit
    const [vector] = await db
      .select({ freeTrialCalls: latentVectors.freeTrialCalls })
      .from(latentVectors)
      .where(eq(latentVectors.id, vectorId))
      .limit(1);

    if (!vector) {
      return res.status(404).json({ error: "Vector not found" });
    }

    // Count user's trial usage
    const [usage] = await db
      .select({ count: count() })
      .from(trialUsage)
      .where(
        and(
          eq(trialUsage.userId, userId),
          eq(trialUsage.vectorId, vectorId)
        )
      );

    const usedCalls = usage?.count || 0;
    const remainingCalls = Math.max(0, vector.freeTrialCalls - usedCalls);

    res.json({
      vectorId,
      totalTrialCalls: vector.freeTrialCalls,
      usedCalls,
      remainingCalls,
      canTry: remainingCalls > 0,
    });
  } catch (error) {
    logger.error("[Trial API] Error checking remaining calls:", error);
    res.status(500).json({ error: "Failed to check trial status" });
  }
});

/**
 * Execute a trial call
 */
router.post("/execute", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { vectorId, input } = req.body;

    if (!vectorId || !input) {
      return res.status(400).json({ error: "Vector ID and input required" });
    }

    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: "Database unavailable" });
    }

    // Check remaining trials
    const [vector] = await db
      .select({ 
        freeTrialCalls: latentVectors.freeTrialCalls,
        title: latentVectors.title,
        vectorFileUrl: latentVectors.vectorFileUrl,
        vectorFileKey: latentVectors.vectorFileKey,
      })
      .from(latentVectors)
      .where(eq(latentVectors.id, vectorId))
      .limit(1);

    if (!vector) {
      return res.status(404).json({ error: "Vector not found" });
    }

    const [usage] = await db
      .select({ count: count() })
      .from(trialUsage)
      .where(
        and(
          eq(trialUsage.userId, userId),
          eq(trialUsage.vectorId, vectorId)
        )
      );

    const usedCalls = usage?.count || 0;
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
      },
      context: input,
    });

    // Record trial usage
    await db.insert(trialUsage).values({
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
    logger.error("[Trial API] Error executing trial:", error);
    res.status(500).json({ error: "Failed to execute trial" });
  }
});

/**
 * Get trial history for a user
 */
router.get("/history", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: "Database unavailable" });
    }

    const history = await db
      .select({
        id: trialUsage.id,
        vectorId: trialUsage.vectorId,
        vectorTitle: latentVectors.title,
        inputData: trialUsage.inputData,
        outputData: trialUsage.outputData,
        success: trialUsage.success,
        errorMessage: trialUsage.errorMessage,
        createdAt: trialUsage.createdAt,
      })
      .from(trialUsage)
      .leftJoin(latentVectors, eq(trialUsage.vectorId, latentVectors.id))
      .where(eq(trialUsage.userId, userId))
      .orderBy(sql`${trialUsage.createdAt} DESC`)
      .limit(50);

    res.json(history);
  } catch (error) {
    logger.error("[Trial API] Error fetching history:", error);
    res.status(500).json({ error: "Failed to fetch trial history" });
  }
});

export default router;
