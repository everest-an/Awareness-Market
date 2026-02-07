/**
 * Streaming and Batch API endpoints for vector invocation
 * Supports Server-Sent Events (SSE) and batch operations
 */

import { Router, Request, Response } from "express";
import { prisma } from "./db-prisma";
import { validateApiKey } from "./api-key-manager";
import { createLogger } from "./utils/logger";
import { workflowManager } from "./workflow-manager";
import { runVector } from "./vector-runtime";

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

    // Verify vector exists and is active
    const vector = await prisma.latentVector.findFirst({
      where: {
        id: parseInt(vectorId as string),
        status: "active"
      }
    });

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

        await prisma.transaction.create({
          data: {
            buyerId: validation.userId,
            vectorId: vector.id,
            amount: vector.basePrice,
            platformFee: platformFee.toFixed(2),
            creatorEarnings: creatorEarnings.toFixed(2),
            status: "completed",
            transactionType: "one-time",
          }
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

    // Fetch all requested vectors
    const vectorIds = requests.map((r: BatchVectorRequest) => r.vectorId);
    const vectors = await prisma.latentVector.findMany({
      where: {
        id: { in: vectorIds },
        status: "active"
      }
    });

    const vectorMap = new Map(vectors.map(v => [v.id, v]));

    const session = workflowManager.createSession({
      userId: validation.userId,
      type: "vector_invocation",
      title: "Batch vector invocation",
      description: `Batch size: ${requests.length}`,
      tags: ["batch", "vector"],
    });

    // Process each request
    const results = await Promise.all(
      requests.map(async (request: BatchVectorRequest) => {
        const { vectorId, input } = request;
        const vector = vectorMap.get(vectorId);

        if (!vector) {
          const event = workflowManager.addEvent(session.id, {
            type: "tool_result",
            title: `Vector ${vectorId} not found`,
            input: { vectorId },
            output: { error: "Vector not found or inactive" },
          });
          workflowManager.updateEvent(session.id, event.id, {
            status: "failed",
            output: { error: "Vector not found or inactive" },
          });
          return {
            vectorId,
            success: false,
            error: "Vector not found or inactive"
          };
        }

        try {
          const event = workflowManager.addEvent(session.id, {
            type: "tool_call",
            title: `Invoke vector ${vectorId}`,
            input: { vectorId, input },
          });

          const runtimeResult = await runVector({
            vector,
            context: input,
          });

          const output = {
            vectorId,
            input,
            output: runtimeResult.text,
            model: runtimeResult.model,
            usage: runtimeResult.usage,
            latency_ms: runtimeResult.processingTimeMs,
          };

          workflowManager.updateEvent(session.id, event.id, {
            status: "completed",
            output,
            duration: runtimeResult.processingTimeMs,
            metadata: {
              model: runtimeResult.model,
              latency: runtimeResult.processingTimeMs,
            },
          });

          // Record transaction
          if (validation.userId) {
            const platformFeeRate = 0.20; // 20% platform fee
            const amount = parseFloat(vector.basePrice);
            const platformFee = amount * platformFeeRate;
            const creatorEarnings = amount - platformFee;

            await prisma.transaction.create({
              data: {
                buyerId: validation.userId,
                vectorId: vector.id,
                amount: vector.basePrice,
                platformFee: platformFee.toFixed(2),
                creatorEarnings: creatorEarnings.toFixed(2),
                status: "completed",
                transactionType: "one-time",
              }
            });
          }

          return {
            vectorId,
            success: true,
            result: output
          };
        } catch (error) {
          const event = workflowManager.addEvent(session.id, {
            type: "error",
            title: `Vector ${vectorId} failed`,
            input: { vectorId, input },
            output: { error: "Processing failed" },
          });
          workflowManager.updateEvent(session.id, event.id, {
            status: "failed",
            output: { error: "Processing failed" },
          });
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

    workflowManager.completeSession(session.id, failed > 0 ? "failed" : "completed");

    res.json({
      batchId: session.id,
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

      // Use in-memory WorkflowManager instead of missing DB model
    const { workflowManager } = await import("./workflow-manager");
    const session = workflowManager.getSession(batchId);
    if (!session) {
      res.status(404).json({ error: "Batch not found" });
      return;
    }
    const events = session.events || [];
    const total = events.length;
    const successful = events.filter(e => e.status === "completed").length;
    const failed = events.filter(e => e.status === "failed").length;
    const progress = total === 0 ? 0 : (successful + failed) / total;
    res.json({
      batchId,
      status: session.status,
      progress,
      results: {
        total,
        successful,
        failed
      },
      createdAt: session.startedAt,
      completedAt: session.completedAt || null,
    });
  } catch (error) {
    logger.error("[Batch Status] Error:", { error });
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
