/**
 * AI Authentication API
 * Provides endpoints for AI agents to self-register and manage API keys
 */

import express from "express";
import { z } from "zod";
import crypto from "crypto";
import { getDb } from "./db";
import { apiKeys, users, aiMemory } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { createLogger } from "./utils/logger";

const logger = createLogger('AI:AuthAPI');

const router = express.Router();

// Middleware to validate API key from header
async function validateApiKey(req: express.Request, res: express.Response, next: express.NextFunction) {
  const apiKey = req.headers["x-api-key"] as string;
  
  if (!apiKey) {
    return res.status(401).json({ error: "API key required" });
  }

  const db = await getDb();
  if (!db) {
    return res.status(500).json({ error: "Database unavailable" });
  }

  try {
    const keyHash = crypto.createHash("sha256").update(apiKey).digest("hex");
    const [keyRecord] = await db
      .select()
      .from(apiKeys)
      .where(and(
        eq(apiKeys.keyHash, keyHash),
        eq(apiKeys.isActive, true)
      ))
      .limit(1);

    if (!keyRecord) {
      return res.status(401).json({ error: "Invalid API key" });
    }

    // Check expiration
    if (keyRecord.expiresAt && new Date(keyRecord.expiresAt) < new Date()) {
      return res.status(401).json({ error: "API key expired" });
    }

    // Update last used timestamp
    await db
      .update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, keyRecord.id));

    // Attach user info to request
    (req as any).apiKeyUserId = keyRecord.userId;
    (req as any).apiKeyPermissions = keyRecord.permissions ? JSON.parse(keyRecord.permissions) : [];
    
    next();
  } catch (error) {
    logger.error(" API key validation error:", { error });
    return res.status(500).json({ error: "Authentication failed" });
  }
}

/**
 * POST /api/ai/register
 * AI agent self-registration endpoint
 */
router.post("/register", async (req, res) => {
  try {
    const schema = z.object({
      agentName: z.string().min(1).max(255),
      agentType: z.string().optional(), // e.g., "GPT-4", "Claude", "Custom"
      email: z.string().email().optional(),
      metadata: z.record(z.string(), z.any()).optional(),
    });

    const body = schema.parse(req.body);
    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: "Database unavailable" });
    }

    // Generate unique openId for AI agent
    const openId = `ai_${crypto.randomBytes(16).toString("hex")}`;

    // Create user account
    const insertResult = await db.insert(users).values({     openId,
      name: body.agentName,
      email: body.email || null,
      loginMethod: "api",
      role: "consumer", // AI agents start as consumers
    });

    const userId = Number((insertResult as any).insertId);

    // Generate API key
    const rawApiKey = `ak_${crypto.randomBytes(32).toString("hex")}`;
    const keyHash = crypto.createHash("sha256").update(rawApiKey).digest("hex");
    const keyPrefix = rawApiKey.substring(0, 12);

    await db.insert(apiKeys).values({
      userId,
      keyHash,
      keyPrefix,
      name: "Default Key",
      permissions: JSON.stringify(["read", "write", "purchase"]),
      isActive: true,
    });

    // Store agent metadata in AI memory
    if (body.metadata) {
      await db.insert(aiMemory).values({
        userId,
        memoryKey: "agent_metadata",
        memoryData: JSON.stringify(body.metadata),
        version: 1,
      });
    }

    return res.status(201).json({
      success: true,
      userId,
      openId,
      apiKey: rawApiKey, // Only returned once during registration
      message: "AI agent registered successfully. Store your API key securely - it won't be shown again.",
    });
  } catch (error) {
    logger.error(" Registration error:", { error });
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request", details: error.issues });
    }
    return res.status(500).json({ error: "Registration failed" });
  }
});

/**
 * GET /api/ai/keys
 * List API keys for authenticated agent
 */
router.get("/keys", validateApiKey, async (req, res) => {
  try {
    const userId = (req as any).apiKeyUserId;
    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: "Database unavailable" });
    }

    const keys = await db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        keyPrefix: apiKeys.keyPrefix,
        permissions: apiKeys.permissions,
        lastUsedAt: apiKeys.lastUsedAt,
        expiresAt: apiKeys.expiresAt,
        isActive: apiKeys.isActive,
        createdAt: apiKeys.createdAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.userId, userId));

    return res.json({ keys });
  } catch (error) {
    logger.error(" List keys error:", { error });
    return res.status(500).json({ error: "Failed to list keys" });
  }
});

/**
 * POST /api/ai/keys
 * Create new API key for authenticated agent
 */
router.post("/keys", validateApiKey, async (req, res) => {
  try {
    const schema = z.object({
      name: z.string().min(1).max(255),
      permissions: z.array(z.string()).optional(),
      expiresInDays: z.number().positive().optional(),
    });

    const body = schema.parse(req.body);
    const userId = (req as any).apiKeyUserId;
    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: "Database unavailable" });
    }

    // Generate new API key
    const rawApiKey = `ak_${crypto.randomBytes(32).toString("hex")}`;
    const keyHash = crypto.createHash("sha256").update(rawApiKey).digest("hex");
    const keyPrefix = rawApiKey.substring(0, 12);

    const expiresAt = body.expiresInDays
      ? new Date(Date.now() + body.expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    await db.insert(apiKeys).values({
      userId,
      keyHash,
      keyPrefix,
      name: body.name,
      permissions: JSON.stringify(body.permissions || ["read"]),
      expiresAt,
      isActive: true,
    });

    return res.status(201).json({
      success: true,
      apiKey: rawApiKey,
      message: "API key created successfully. Store it securely - it won't be shown again.",
    });
  } catch (error) {
    logger.error(" Create key error:", { error });
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request", details: error.issues });
    }
    return res.status(500).json({ error: "Failed to create key" });
  }
});

/**
 * DELETE /api/ai/keys/:keyId
 * Revoke an API key
 */
router.delete("/keys/:keyId", validateApiKey, async (req, res) => {
  try {
    const keyId = parseInt(req.params.keyId);
    const userId = (req as any).apiKeyUserId;
    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: "Database unavailable" });
    }

    await db
      .update(apiKeys)
      .set({ isActive: false })
      .where(and(
        eq(apiKeys.id, keyId),
        eq(apiKeys.userId, userId)
      ));

    return res.json({ success: true, message: "API key revoked" });
  } catch (error) {
    logger.error(" Revoke key error:", { error });
    return res.status(500).json({ error: "Failed to revoke key" });
  }
});

export { router as aiAuthRouter, validateApiKey };
