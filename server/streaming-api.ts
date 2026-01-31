/**
 * Streaming and Batch API endpoints for vector invocation
 * Supports Server-Sent Events (SSE) and batch operations
 */

import { Router, Request, Response } from "express";
import { getDb } from "./db";
import { latentVectors, transactions } from "../drizzle/schema";
import { eq, and, inArray } from "drizzle-orm";
import { validateApiKey } from "./api-key-manager";
import { createLogger } from "./utils/logger";

const logger = createLogger('Streaming');

interface BatchVectorRequest {
  vectorId: number;
  input: unknown;
}

const router = Router();

/**
 * SSE streaming endpoint for real-time vector invocation
 * GET /api/vectors/invoke/stream?vectorId=123&input=...
 */
router.get("/invoke/stream", async (req: Request, res: Response) => {
  try {
    // Validate API key
    const apiKey = req.headers.authorization?.replace("Bearer ", "");
    if (!apiKey) {
      res.status(401).json({ error: "Missing API key" });
      return;
    }

    const validation = await validateApiKey(apiKey);
    if (!validation.valid || !validation.userId) {
      res.status(403).json({ error: "Invalid or expired API key" });
      return;
    }

    const { vectorId, input } = req.query;
    
    if (!vectorId || !input) {
      res.status(400).json({ error: "Missing vectorId or input" });
      return;
    }

    const db = await getDb();
    if (!db) {
      res.status(500).json({ error: "Database connection failed" });
      return;
    }

    // Verify vector exists and is active
    const [vector] = await db
      .select()
      .from(latentVectors)
      .where(
        and(
          eq(latentVectors.id, parseInt(vectorId as string)),
          eq(latentVectors.status, "active")
        )
      )
      .limit(1);

    if (!vector) {
      res.status(404).json({ error: "Vector not found or inactive" });
      return;
    }

    // Set up SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering

    // Send initial connection event
    res.write(`event: connected\n`);
    res.write(`data: ${JSON.stringify({ vectorId, status: "processing" })}\n\n`);

    // Simulate streaming response (replace with actual vector invocation)
    const chunks = [
      { progress: 0.2, message: "Loading vector model..." },
      { progress: 0.4, message: "Processing input..." },
      { progress: 0.6, message: "Computing embeddings..." },
      { progress: 0.8, message: "Generating output..." },
      { progress: 1.0, message: "Complete", result: { output: `Processed: ${input}`, confidence: 0.95 } }
    ];

    for (const chunk of chunks) {
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate processing time
      
      res.write(`event: progress\n`);
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      
      if (chunk.progress === 1.0 && validation.userId) {
        // Record transaction
        const platformFeeRate = 0.20; // 20% platform fee
        const amount = parseFloat(vector.basePrice);
        const platformFee = amount * platformFeeRate;
        const creatorEarnings = amount - platformFee;
        
        await db.insert(transactions).values({
          buyerId: validation.userId,
          vectorId: vector.id,
          amount: vector.basePrice,
          platformFee: platformFee.toFixed(2),
          creatorEarnings: creatorEarnings.toFixed(2),
          status: "completed",
          transactionType: "one-time",
        });
      }
    }

    // Send completion event
    res.write(`event: done\n`);
    res.write(`data: ${JSON.stringify({ status: "completed" })}\n\n`);
    res.end();

  } catch (error) {
    logger.error("[Streaming API] Error:", { error });
    res.write(`event: error\n`);
    res.write(`data: ${JSON.stringify({ error: "Internal server error" })}\n\n`);
    res.end();
  }
});

/**
 * Batch invocation endpoint for multiple vectors
 * POST /api/vectors/batch-invoke
 * Body: { requests: [{ vectorId, input }, ...] }
 */
router.post("/batch-invoke", async (req: Request, res: Response) => {
  try {
    // Validate API key
    const apiKey = req.headers.authorization?.replace("Bearer ", "");
    if (!apiKey) {
      res.status(401).json({ error: "Missing API key" });
      return;
    }

    const validation = await validateApiKey(apiKey);
    if (!validation.valid || !validation.userId) {
      res.status(403).json({ error: "Invalid or expired API key" });
      return;
    }

    const { requests } = req.body;

    if (!Array.isArray(requests) || requests.length === 0) {
      res.status(400).json({ error: "Invalid requests array" });
      return;
    }

    if (requests.length > 100) {
      res.status(400).json({ error: "Maximum 100 requests per batch" });
      return;
    }

    const db = await getDb();
    if (!db) {
      res.status(500).json({ error: "Database connection failed" });
      return;
    }

    // Fetch all requested vectors
    const vectorIds = requests.map((r: BatchVectorRequest) => r.vectorId);
    const vectors = await db
      .select()
      .from(latentVectors)
      .where(
        and(
          inArray(latentVectors.id, vectorIds),
          eq(latentVectors.status, "active")
        )
      );

    const vectorMap = new Map(vectors.map(v => [v.id, v]));

    // Process each request
    const results = await Promise.all(
      requests.map(async (request: BatchVectorRequest) => {
        const { vectorId, input } = request;
        const vector = vectorMap.get(vectorId);

        if (!vector) {
          return {
            vectorId,
            success: false,
            error: "Vector not found or inactive"
          };
        }

        try {
          // Simulate vector invocation (replace with actual logic)
          const output = {
            vectorId,
            input,
            output: `Batch processed: ${input}`,
            confidence: 0.92,
            latency_ms: Math.floor(Math.random() * 100) + 50
          };

          // Record transaction
          if (validation.userId) {
            const platformFeeRate = 0.20; // 20% platform fee
            const amount = parseFloat(vector.basePrice);
            const platformFee = amount * platformFeeRate;
            const creatorEarnings = amount - platformFee;
            
            await db.insert(transactions).values({
              buyerId: validation.userId,
              vectorId: vector.id,
              amount: vector.basePrice,
              platformFee: platformFee.toFixed(2),
              creatorEarnings: creatorEarnings.toFixed(2),
              status: "completed",
              transactionType: "one-time",
            });
          }

          return {
            vectorId,
            success: true,
            result: output
          };
        } catch (error) {
          return {
            vectorId,
            success: false,
            error: "Processing failed"
          };
        }
      })
    );

    // Calculate summary
    const successful = results.filter(r => r.success).length;
    const failed = results.length - successful;

    res.json({
      summary: {
        total: results.length,
        successful,
        failed
      },
      results
    });

  } catch (error) {
    logger.error("[Batch API] Error:", { error });
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Get batch invocation status
 * GET /api/vectors/batch-invoke/:batchId
 */
router.get("/batch-invoke/:batchId", async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;
    
    // In production, store batch status in database
    // For now, return mock status
    res.json({
      batchId,
      status: "completed",
      progress: 1.0,
      results: {
        total: 10,
        successful: 9,
        failed: 1
      },
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString()
    });
  } catch (error) {
    logger.error("[Batch Status] Error:", { error });
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
