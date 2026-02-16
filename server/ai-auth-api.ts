/**
 * AI Authentication API
 * Provides endpoints for AI agents to self-register and manage API keys
 */

import express from "express";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "./db-prisma";
import { createLogger } from "./utils/logger";

const logger = createLogger('AI:AuthAPI');

// Type extension for authenticated requests
export interface AuthenticatedRequest extends express.Request {
  apiKeyUserId: number;
  apiKeyPermissions: string[];
}

const router = express.Router();

// Middleware to validate API key from header
async function validateApiKey(req: express.Request, res: express.Response, next: express.NextFunction) {
  const apiKey = req.headers["x-api-key"] as string;

  if (!apiKey) {
    return res.status(401).json({ error: "API key required" });
  }

  try {
    const keyHash = crypto.createHash("sha256").update(apiKey).digest("hex");
    const keyRecord = await prisma.apiKey.findFirst({
      where: {
        keyHash,
        isActive: true,
      },
    });

    if (!keyRecord) {
      return res.status(401).json({ error: "Invalid API key" });
    }

    // Check expiration
    if (keyRecord.expiresAt && new Date(keyRecord.expiresAt) < new Date()) {
      return res.status(401).json({ error: "API key expired" });
    }

    // Update last used timestamp
    await prisma.apiKey.update({
      where: { id: keyRecord.id },
      data: { lastUsedAt: new Date() },
    });

    // Attach user info to request
    (req as AuthenticatedRequest).apiKeyUserId = keyRecord.userId;
    (req as AuthenticatedRequest).apiKeyPermissions = keyRecord.permissions ? JSON.parse(keyRecord.permissions) : [];

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
      metadata: z.record(z.string(), z.unknown()).optional(),
    });

    const body = schema.parse(req.body);

    // Generate unique openId for AI agent
    const openId = `ai_${crypto.randomBytes(16).toString("hex")}`;

    // Create user account
    const user = await prisma.user.create({
      data: {
        openId,
        name: body.agentName,
        email: body.email || null,
        loginMethod: "api",
        role: "consumer", // AI agents start as consumers
      },
    });

    // Generate API key
    const rawApiKey = `ak_${crypto.randomBytes(32).toString("hex")}`;
    const keyHash = crypto.createHash("sha256").update(rawApiKey).digest("hex");
    const keyPrefix = rawApiKey.substring(0, 12);

    await prisma.apiKey.create({
      data: {
        userId: user.id,
        keyHash,
        keyPrefix,
        name: "Default Key",
        permissions: JSON.stringify(["read", "write", "purchase"]),
        isActive: true,
      },
    });

    // Store agent metadata in AI memory
    if (body.metadata) {
      await prisma.aiMemory.create({
        data: {
          userId: user.id,
          memoryKey: "agent_metadata",
          memoryData: JSON.stringify(body.metadata),
          version: 1,
        },
      });
    }

    return res.status(201).json({
      success: true,
      userId: user.id,
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
    const authReq = req as unknown as AuthenticatedRequest;
    const userId = authReq.apiKeyUserId;

    const keys = await prisma.apiKey.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        permissions: true,
        lastUsedAt: true,
        expiresAt: true,
        isActive: true,
        createdAt: true,
      },
    });

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
    const authReq = req as unknown as AuthenticatedRequest;
    const schema = z.object({
      name: z.string().min(1).max(255),
      permissions: z.array(z.string()).optional(),
      expiresInDays: z.number().positive().optional(),
    });

    const body = schema.parse(req.body);
    const userId = authReq.apiKeyUserId;

    // Generate new API key
    const rawApiKey = `ak_${crypto.randomBytes(32).toString("hex")}`;
    const keyHash = crypto.createHash("sha256").update(rawApiKey).digest("hex");
    const keyPrefix = rawApiKey.substring(0, 12);

    const expiresAt = body.expiresInDays
      ? new Date(Date.now() + body.expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    await prisma.apiKey.create({
      data: {
        userId,
        keyHash,
        keyPrefix,
        name: body.name,
        permissions: JSON.stringify(body.permissions || ["read"]),
        expiresAt,
        isActive: true,
      },
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
    const authReq = req as unknown as AuthenticatedRequest;
    const keyId = parseInt(req.params.keyId);
    const userId = authReq.apiKeyUserId;

    await prisma.apiKey.updateMany({
      where: {
        id: keyId,
        userId,
      },
      data: { isActive: false },
    });

    return res.json({ success: true, message: "API key revoked" });
  } catch (error) {
    logger.error(" Revoke key error:", { error });
    return res.status(500).json({ error: "Failed to revoke key" });
  }
});

export { router as aiAuthRouter, validateApiKey };
