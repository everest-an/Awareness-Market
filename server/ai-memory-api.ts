/**
 * AI Memory Sync API
 * Allows AI agents to store and retrieve their state/memory
 */

import express from "express";
import { z } from "zod";
import { getDb } from "./db";
import { aiMemory } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { validateApiKey } from "./ai-auth-api";

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
    const userId = (req as any).apiKeyUserId;
    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: "Database unavailable" });
    }

    const [memory] = await db
      .select()
      .from(aiMemory)
      .where(and(
        eq(aiMemory.userId, userId),
        eq(aiMemory.memoryKey, memoryKey)
      ))
      .limit(1);

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
    console.error("[AI Memory] Retrieve error:", error);
    return res.status(500).json({ error: "Failed to retrieve memory" });
  }
});

/**
 * GET /api/ai/memory
 * List all memory keys for the agent
 */
router.get("/memory", async (req, res) => {
  try {
    const userId = (req as any).apiKeyUserId;
    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: "Database unavailable" });
    }

    const memories = await db
      .select({
        key: aiMemory.memoryKey,
        version: aiMemory.version,
        createdAt: aiMemory.createdAt,
        updatedAt: aiMemory.updatedAt,
        expiresAt: aiMemory.expiresAt,
      })
      .from(aiMemory)
      .where(eq(aiMemory.userId, userId));

    return res.json({ memories });
  } catch (error) {
    console.error("[AI Memory] List error:", error);
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
      data: z.record(z.string(), z.any()),
      version: z.number().optional(),
      ttlDays: z.number().positive().optional(),
    });

    const body = schema.parse(req.body);
    const memoryKey = req.params.key;
    const userId = (req as any).apiKeyUserId;
    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: "Database unavailable" });
    }

    // Check if memory exists
    const [existing] = await db
      .select()
      .from(aiMemory)
      .where(and(
        eq(aiMemory.userId, userId),
        eq(aiMemory.memoryKey, memoryKey)
      ))
      .limit(1);

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

      await db
        .update(aiMemory)
        .set({
          memoryData: JSON.stringify(body.data),
          version: existing.version + 1,
          expiresAt,
          updatedAt: new Date(),
        })
        .where(eq(aiMemory.id, existing.id));

      return res.json({
        success: true,
        key: memoryKey,
        version: existing.version + 1,
        message: "Memory updated",
      });
    } else {
      // Create new memory
      await db.insert(aiMemory).values({
        userId,
        memoryKey,
        memoryData: JSON.stringify(body.data),
        version: 1,
        expiresAt,
      });

      return res.status(201).json({
        success: true,
        key: memoryKey,
        version: 1,
        message: "Memory created",
      });
    }
  } catch (error) {
    console.error("[AI Memory] Store error:", error);
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
    const userId = (req as any).apiKeyUserId;
    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: "Database unavailable" });
    }

    await db
      .delete(aiMemory)
      .where(and(
        eq(aiMemory.userId, userId),
        eq(aiMemory.memoryKey, memoryKey)
      ));

    return res.json({ success: true, message: "Memory deleted" });
  } catch (error) {
    console.error("[AI Memory] Delete error:", error);
    return res.status(500).json({ error: "Failed to delete memory" });
  }
});

export { router as aiMemoryRouter };
