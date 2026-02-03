/**
 * AI Memory Sync API
 * Allows AI agents to store and retrieve their state/memory
 */

import express from "express";
import { z } from "zod";
import { prisma } from "./db-prisma";
import { createLogger } from "./utils/logger";

const logger = createLogger('AI:MemoryAPI');
import { validateApiKey, AuthenticatedRequest } from "./ai-auth-api";

const router = express.Router();

// All routes require API key authentication
router.use(validateApiKey);

/**
 * GET /api/ai/memory/:key
 * Retrieve memory by key
 */
router.get("/memory/:key", async (req, res) => {
  try {
    const memoryKey = req.params.key;
    const userId = (req as AuthenticatedRequest).apiKeyUserId;

    const memory = await prisma.aiMemory.findFirst({
      where: {
        userId,
        memoryKey,
      },
    });

    if (!memory) {
      return res.status(404).json({ error: "Memory not found" });
    }

    // Check if expired
    if (memory.expiresAt && new Date(memory.expiresAt) < new Date()) {
      return res.status(410).json({ error: "Memory expired" });
    }

    return res.json({
      key: memory.memoryKey,
      data: JSON.parse(memory.memoryData),
      version: memory.version,
      createdAt: memory.createdAt,
      updatedAt: memory.updatedAt,
      expiresAt: memory.expiresAt,
    });
  } catch (error) {
    logger.error(" Retrieve error:", { error });
    return res.status(500).json({ error: "Failed to retrieve memory" });
  }
});

/**
 * GET /api/ai/memory
 * List all memory keys for the agent
 */
router.get("/memory", async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).apiKeyUserId;

    const memories = await prisma.aiMemory.findMany({
      where: { userId },
      select: {
        memoryKey: true,
        version: true,
        createdAt: true,
        updatedAt: true,
        expiresAt: true,
      },
    });

    return res.json({
      memories: memories.map(m => ({
        key: m.memoryKey,
        version: m.version,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
        expiresAt: m.expiresAt,
      })),
    });
  } catch (error) {
    logger.error(" List error:", { error });
    return res.status(500).json({ error: "Failed to list memories" });
  }
});

/**
 * PUT /api/ai/memory/:key
 * Store or update memory
 */
router.put("/memory/:key", async (req, res) => {
  try {
    const schema = z.object({
      data: z.record(z.string(), z.unknown()),
      version: z.number().optional(),
      ttlDays: z.number().positive().optional(),
    });

    const body = schema.parse(req.body);
    const memoryKey = req.params.key;
    const userId = (req as AuthenticatedRequest).apiKeyUserId;

    // Check if memory exists
    const existing = await prisma.aiMemory.findFirst({
      where: {
        userId,
        memoryKey,
      },
    });

    const expiresAt = body.ttlDays
      ? new Date(Date.now() + body.ttlDays * 24 * 60 * 60 * 1000)
      : null;

    if (existing) {
      // Update existing memory
      // Check version for conflict resolution
      if (body.version && body.version < existing.version) {
        return res.status(409).json({
          error: "Version conflict",
          currentVersion: existing.version,
          message: "Your version is outdated. Fetch latest and retry.",
        });
      }

      await prisma.aiMemory.update({
        where: { id: existing.id },
        data: {
          memoryData: JSON.stringify(body.data),
          version: existing.version + 1,
          expiresAt,
          updatedAt: new Date(),
        },
      });

      return res.json({
        success: true,
        key: memoryKey,
        version: existing.version + 1,
        message: "Memory updated",
      });
    } else {
      // Create new memory
      await prisma.aiMemory.create({
        data: {
          userId,
          memoryKey,
          memoryData: JSON.stringify(body.data),
          version: 1,
          expiresAt,
        },
      });

      return res.status(201).json({
        success: true,
        key: memoryKey,
        version: 1,
        message: "Memory created",
      });
    }
  } catch (error) {
    logger.error(" Store error:", { error });
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request", details: error.issues });
    }
    return res.status(500).json({ error: "Failed to store memory" });
  }
});

/**
 * DELETE /api/ai/memory/:key
 * Delete memory by key
 */
router.delete("/memory/:key", async (req, res) => {
  try {
    const memoryKey = req.params.key;
    const userId = (req as AuthenticatedRequest).apiKeyUserId;

    await prisma.aiMemory.deleteMany({
      where: {
        userId,
        memoryKey,
      },
    });

    return res.json({ success: true, message: "Memory deleted" });
  } catch (error) {
    logger.error(" Delete error:", { error });
    return res.status(500).json({ error: "Failed to delete memory" });
  }
});

export { router as aiMemoryRouter };
