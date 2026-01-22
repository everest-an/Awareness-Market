/**
 * MCP (Model Context Protocol) Integration API
 * 
 * This module provides standardized endpoints for MCP-compatible AI clients
 * to discover, access, and invoke latent vectors from the marketplace.
 * 
 * MCP Protocol Specification:
 * - Discovery: List available vectors with metadata
 * - Authentication: Token-based access control
 * - Invocation: Execute vector inference with context
 * - Monitoring: Track usage and performance metrics
 */

import { Router } from "express";
import { z } from "zod";
import * as db from "./db";
import { runVector } from "./vector-runtime";
import { invokeLLM } from "./_core/llm";
import { validateApiKey } from "./ai-auth-api";

const mcpRouter = Router();

const extractTextFromResult = (result: any) => {
  const content = result?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === "string" ? part : part.text))
      .filter(Boolean)
      .join("\n");
  }
  return "";
};

/**
 * MCP Discovery Endpoint
 * GET /api/mcp/discover
 * 
 * Returns a list of available vectors with MCP-compatible metadata
 */
mcpRouter.get("/discover", async (req, res) => {
  try {
    const { category, minRating } = req.query;
    
    const vectors = await db.searchLatentVectors({
      category: category as string | undefined,
      minRating: minRating ? parseFloat(minRating as string) : undefined,
      sortBy: "rating",
      limit: 100,
    });

    const mcpVectors = vectors.map(v => {
      let performance: Record<string, unknown> = {};
      if (v.performanceMetrics) {
        try {
          performance = JSON.parse(v.performanceMetrics);
        } catch {
          performance = {};
        }
      }

      return {
        id: v.id,
        name: v.title,
        description: v.description,
        category: v.category,
        version: "1.0.0",
        capabilities: {
          input_types: ["text", "embedding"],
          output_types: ["embedding", "classification", "generation"],
          max_context_length: 8192,
        },
        performance,
        pricing: {
          model: v.pricingModel,
          base_price: parseFloat(v.basePrice),
          currency: "USD",
        },
        metadata: {
          creator_id: v.creatorId,
          created_at: v.createdAt,
          total_calls: v.totalCalls,
          average_rating: parseFloat(v.averageRating || "0"),
          review_count: v.reviewCount,
        },
      };
    });

    res.json({
      protocol: "MCP/1.0",
      vectors: mcpVectors,
      total: mcpVectors.length,
    });
  } catch (error) {
    console.error("[MCP] Discovery error:", error);
    res.status(500).json({ error: "Discovery failed" });
  }
});

/**
 * MCP Token Creation Endpoint
 * POST /api/mcp/tokens
 */
mcpRouter.post("/tokens", validateApiKey, async (req, res) => {
  try {
    const schema = z.object({
      name: z.string().min(1).max(255).default("MCP Sync Token"),
      permissions: z.array(z.string()).optional(),
      expiresInDays: z.number().positive().optional(),
    });

    const body = schema.parse(req.body);
    const userId = (req as any).apiKeyUserId as number;

    const created = await db.createMcpToken({
      userId,
      name: body.name,
      permissions: body.permissions,
      expiresInDays: body.expiresInDays,
    });

    res.status(201).json({
      success: true,
      token: created.token,
      tokenPrefix: created.tokenPrefix,
      expiresAt: created.expiresAt,
      message: "MCP token created successfully. Store it securely - it won't be shown again.",
    });
  } catch (error) {
    console.error("[MCP] Token create error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request", details: error.issues });
    }
    res.status(500).json({ error: "Failed to create MCP token" });
  }
});

/**
 * MCP Token List Endpoint
 * GET /api/mcp/tokens
 */
mcpRouter.get("/tokens", validateApiKey, async (req, res) => {
  try {
    const userId = (req as any).apiKeyUserId as number;
    const tokens = await db.listMcpTokens(userId);
    res.json({ tokens });
  } catch (error) {
    console.error("[MCP] Token list error:", error);
    res.status(500).json({ error: "Failed to list MCP tokens" });
  }
});

/**
 * MCP Token Revocation Endpoint
 * DELETE /api/mcp/tokens/:tokenId
 */
mcpRouter.delete("/tokens/:tokenId", validateApiKey, async (req, res) => {
  try {
    const tokenId = parseInt(req.params.tokenId);
    const userId = (req as any).apiKeyUserId as number;
    await db.revokeMcpToken({ userId, tokenId });
    res.json({ success: true, message: "MCP token revoked" });
  } catch (error) {
    console.error("[MCP] Token revoke error:", error);
    res.status(500).json({ error: "Failed to revoke MCP token" });
  }
});

/**
 * MCP Vector Details Endpoint
 * GET /api/mcp/vectors/:id
 */
mcpRouter.get("/vectors/:id", async (req, res) => {
  try {
    const vectorId = parseInt(req.params.id);
    const vector = await db.getLatentVectorById(vectorId);

    if (!vector || vector.status !== "active") {
      return res.status(404).json({ error: "Vector not found" });
    }

    let performance: Record<string, unknown> = {};
    if (vector.performanceMetrics) {
      try {
        performance = JSON.parse(vector.performanceMetrics);
      } catch {
        performance = {};
      }
    }

    res.json({
      protocol: "MCP/1.0",
      vector: {
        id: vector.id,
        name: vector.title,
        description: vector.description,
        category: vector.category,
        model_architecture: vector.modelArchitecture,
        vector_dimension: vector.vectorDimension,
        performance_metrics: performance,
        pricing: {
          model: vector.pricingModel,
          base_price: parseFloat(vector.basePrice),
        },
        access_requirements: {
          authentication: "token",
          rate_limits: {
            calls_per_minute: 60,
            calls_per_day: 10000,
          },
        },
      },
    });
  } catch (error) {
    console.error("[MCP] Vector details error:", error);
    res.status(500).json({ error: "Failed to fetch vector details" });
  }
});

/**
 * MCP Invoke Endpoint
 * POST /api/mcp/invoke
 * 
 * Executes a vector with provided context
 * Requires: Authorization header with access token
 */
mcpRouter.post("/invoke", async (req, res) => {
  try {
    const startTime = Date.now();
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid authorization header" });
    }

    const accessToken = authHeader.substring(7);
    const { vector_id, context } = req.body;

    if (!vector_id || !context) {
      return res.status(400).json({ error: "Missing required fields: vector_id, context" });
    }

    const permission = await db.getAccessPermissionByToken(accessToken);
    if (!permission || !permission.isActive) {
      return res.status(403).json({ error: "Invalid or expired access token" });
    }

    if (permission.vectorId !== vector_id) {
      return res.status(403).json({ error: "Access token not valid for this vector" });
    }

    if (permission.expiresAt && new Date(permission.expiresAt) < new Date()) {
      return res.status(403).json({ error: "Access token expired" });
    }

    if (permission.callsRemaining !== null && permission.callsRemaining <= 0) {
      return res.status(429).json({ error: "Call limit exceeded" });
    }

    const vector = await db.getLatentVectorById(vector_id);
    if (!vector) {
      return res.status(404).json({ error: "Vector not found" });
    }

    if (vector.status !== "active") {
      return res.status(404).json({ error: "Vector not available" });
    }

    const runtimeResult = await runVector({ vector, context });

    const result = {
      protocol: "MCP/1.0",
      vector_id,
      result: {
        output_type: "text",
        text: runtimeResult.text,
        metadata: {
          processing_time_ms: runtimeResult.processingTimeMs,
          model_version: runtimeResult.model,
        },
      },
      usage: {
        calls_remaining: permission.callsRemaining !== null ? permission.callsRemaining - 1 : null,
      },
      llm_usage: runtimeResult.usage,
    };

    await db.logApiCall({
      userId: permission.userId,
      vectorId: vector_id,
      permissionId: permission.id,
      responseTime: Date.now() - startTime,
      success: true,
    });

    if (permission.callsRemaining !== null) {
      await db.decrementCallsRemaining(permission.id);
    }

    res.json(result);
  } catch (error) {
    console.error("[MCP] Invoke error:", error);
    res.status(500).json({ error: "Invocation failed" });
  }
});

/**
 * MCP Multi-Agent Sync Endpoint
 * POST /api/mcp/sync
 */
mcpRouter.post("/sync", async (req, res) => {
  try {
    const startTime = Date.now();
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader && authHeader.startsWith("Bearer ") ? authHeader.substring(7) : null;
    const mcpTokenHeader = req.headers["x-mcp-token"] as string | undefined;

    const { vector_id, agents, shared_context, memory_key, memory_ttl_days } = req.body || {};

    if (!Array.isArray(agents) || agents.length === 0) {
      return res.status(400).json({ error: "Missing required fields: agents" });
    }

    let permission: any = null;
    let vector: any = null;
    let syncUserId: number | null = null;

    if (vector_id) {
      if (!bearerToken || bearerToken.startsWith("mcp_")) {
        return res.status(401).json({ error: "Access token required for vector sync" });
      }

      permission = await db.getAccessPermissionByToken(bearerToken);
      if (!permission || !permission.isActive) {
        return res.status(403).json({ error: "Invalid or expired access token" });
      }

      if (permission.vectorId !== vector_id) {
        return res.status(403).json({ error: "Access token not valid for this vector" });
      }

      if (permission.expiresAt && new Date(permission.expiresAt) < new Date()) {
        return res.status(403).json({ error: "Access token expired" });
      }

      if (permission.callsRemaining !== null && permission.callsRemaining < agents.length) {
        return res.status(429).json({ error: "Call limit exceeded" });
      }

      vector = await db.getLatentVectorById(vector_id);
      if (!vector || vector.status !== "active") {
        return res.status(404).json({ error: "Vector not available" });
      }

      syncUserId = permission.userId;
    } else {
      const mcpToken = mcpTokenHeader || (bearerToken && bearerToken.startsWith("mcp_") ? bearerToken : null);
      if (!mcpToken) {
        return res.status(401).json({ error: "Missing MCP token for collaboration sync" });
      }

      const mcpRecord = await db.getMcpTokenByToken(mcpToken);
      if (!mcpRecord) {
        return res.status(403).json({ error: "Invalid or expired MCP token" });
      }

      syncUserId = mcpRecord.userId;
    }

    let mergedSharedContext: unknown = shared_context ?? null;
    if (memory_key && syncUserId) {
      const existing = await db.getAIMemoryByKey({ userId: syncUserId, memoryKey: memory_key });
      if (existing && existing.memoryData) {
        try {
          const existingData = JSON.parse(existing.memoryData);
          const existingContext = existingData?.shared_context ?? existingData?.context ?? null;
          if (existingContext && shared_context && typeof existingContext === "object" && typeof shared_context === "object") {
            mergedSharedContext = { ...existingContext, ...shared_context } as Record<string, unknown>;
          } else {
            mergedSharedContext = shared_context ?? existingContext;
          }
        } catch {
          mergedSharedContext = shared_context ?? null;
        }
      }
    }

    const results = await Promise.all(
      agents.map(async (agent: any) => {
        const sharedMessage = mergedSharedContext
          ? { role: "user", content: `Shared context: ${JSON.stringify(mergedSharedContext)}` }
          : null;

        const agentMessages = Array.isArray(agent?.messages)
          ? [sharedMessage, ...agent.messages].filter(Boolean)
          : sharedMessage
            ? [sharedMessage]
            : [];

        if (agent?.output || agent?.text || agent?.result) {
          const text = agent.output || agent.text || agent.result;
          return {
            agent_id: agent?.id ?? null,
            output_type: "text",
            text,
            metadata: agent?.metadata ?? {},
            llm_usage: null,
          };
        }

        const agentContext = agentMessages.length > 0
          ? { messages: agentMessages }
          : mergedSharedContext ?? "";

        if (vector) {
          const runtimeResult = await runVector({ vector, context: agentContext });
          return {
            agent_id: agent?.id ?? null,
            output_type: "text",
            text: runtimeResult.text,
            metadata: {
              processing_time_ms: runtimeResult.processingTimeMs,
              model_version: runtimeResult.model,
            },
            llm_usage: runtimeResult.usage,
          };
        }

        const llmResult = await invokeLLM({
          messages: agentMessages.length > 0
            ? agentMessages
            : [{ role: "user", content: JSON.stringify(agentContext) }],
        });

        const responseText = extractTextFromResult(llmResult);
        return {
          agent_id: agent?.id ?? null,
          output_type: "text",
          text: responseText,
          metadata: {
            model_version: llmResult.model || "sync-llm",
          },
          llm_usage: llmResult.usage,
        };
      })
    );

    let consensusSummary: string | null = null;
    let mergedContext: Record<string, unknown> | null = null;
    let actionItems: string[] = [];
    try {
      const consensusResult = await invokeLLM({
        messages: [
          {
            role: "system",
            content: "You are a coordinator that merges multiple AI agent outputs into a single consensus. Provide a concise summary, merged context, and action items. Respond in JSON.",
          },
          {
            role: "user",
            content: JSON.stringify({
              shared_context: mergedSharedContext,
              agent_results: results,
            }),
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "mcp_consensus",
            schema: {
              type: "object",
              properties: {
                consensus_summary: { type: "string" },
                merged_context: { type: "object" },
                action_items: { type: "array", items: { type: "string" } },
              },
              required: ["consensus_summary", "merged_context"],
            },
          },
        },
      });

      const text = extractTextFromResult(consensusResult);
      if (text) {
        const parsed = JSON.parse(text);
        consensusSummary = parsed.consensus_summary ?? null;
        mergedContext = parsed.merged_context ?? null;
        actionItems = Array.isArray(parsed.action_items) ? parsed.action_items : [];
      }
    } catch (error) {
      console.warn("[MCP] Consensus generation failed", error);
    }

    if (permission && vector_id) {
      await db.logApiCall({
        userId: permission.userId,
        vectorId: vector_id,
        permissionId: permission.id,
        responseTime: Date.now() - startTime,
        success: true,
      });

      if (permission.callsRemaining !== null) {
        for (let i = 0; i < agents.length; i += 1) {
          await db.decrementCallsRemaining(permission.id);
        }
      }
    }

    let memoryInfo: { key: string; version: number; expiresAt: Date | null } | null = null;
    if (memory_key && syncUserId) {
      const memoryPayload = {
        vector_id,
        shared_context: mergedSharedContext,
        agent_results: results,
        consensus_summary: consensusSummary,
        merged_context: mergedContext,
        action_items: actionItems,
        updated_at: new Date().toISOString(),
      } as Record<string, unknown>;

      const stored = await db.upsertAIMemory({
        userId: syncUserId,
        memoryKey: memory_key,
        data: memoryPayload,
        ttlDays: typeof memory_ttl_days === "number" ? memory_ttl_days : undefined,
      });

      if (stored) {
        memoryInfo = {
          key: stored.key,
          version: stored.version,
          expiresAt: stored.expiresAt ?? null,
        };
      }
    }

    res.json({
      protocol: "MCP/1.0",
      vector_id: vector_id ?? null,
      results,
      consensus: consensusSummary,
      merged_context: mergedContext,
      action_items: actionItems,
      shared_context: mergedSharedContext,
      memory: memoryInfo,
      usage: {
        calls_remaining:
          permission?.callsRemaining !== null
            ? permission.callsRemaining - agents.length
            : null,
      },
    });
  } catch (error) {
    console.error("[MCP] Sync error:", error);
    res.status(500).json({ error: "Sync failed" });
  }
});

/**
 * MCP Health Check
 * GET /api/mcp/health
 */
mcpRouter.get("/health", (req, res) => {
  res.json({
    protocol: "MCP/1.0",
    status: "healthy",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
});

export default mcpRouter;
