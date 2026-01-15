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
import * as db from "./db";
import { storageGet } from "./storage";

const mcpRouter = Router();

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

    const mcpVectors = vectors.map(v => ({
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
      performance: v.performanceMetrics ? JSON.parse(v.performanceMetrics) : {},
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
    }));

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
 * MCP Vector Details Endpoint
 * GET /api/mcp/vectors/:id
 * 
 * Returns detailed information about a specific vector
 */
mcpRouter.get("/vectors/:id", async (req, res) => {
  try {
    const vectorId = parseInt(req.params.id);
    const vector = await db.getLatentVectorById(vectorId);

    if (!vector || vector.status !== "active") {
      return res.status(404).json({ error: "Vector not found" });
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
        performance_metrics: vector.performanceMetrics ? JSON.parse(vector.performanceMetrics) : {},
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
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid authorization header" });
    }

    const accessToken = authHeader.substring(7);
    const { vector_id, context, parameters } = req.body;

    if (!vector_id || !context) {
      return res.status(400).json({ error: "Missing required fields: vector_id, context" });
    }

    // Verify access token
    const permission = await db.getAccessPermissionByToken(accessToken);
    if (!permission || !permission.isActive) {
      return res.status(403).json({ error: "Invalid or expired access token" });
    }

    if (permission.vectorId !== vector_id) {
      return res.status(403).json({ error: "Access token not valid for this vector" });
    }

    // Check expiration and calls remaining
    if (permission.expiresAt && new Date(permission.expiresAt) < new Date()) {
      return res.status(403).json({ error: "Access token expired" });
    }

    if (permission.callsRemaining !== null && permission.callsRemaining <= 0) {
      return res.status(429).json({ error: "Call limit exceeded" });
    }

    // Get vector file URL
    const vector = await db.getLatentVectorById(vector_id);
    if (!vector) {
      return res.status(404).json({ error: "Vector not found" });
    }

    const startTime = Date.now();

    // In a real implementation, this would:
    // 1. Download the vector from S3
    // 2. Load it into a model runtime
    // 3. Execute inference with the provided context
    // 4. Return the results
    //
    // For now, we return a mock response
    const mockResult = {
      protocol: "MCP/1.0",
      vector_id,
      result: {
        embedding: Array(vector.vectorDimension || 768).fill(0).map(() => Math.random()),
        confidence: 0.95,
        metadata: {
          processing_time_ms: Date.now() - startTime,
          model_version: "1.0.0",
        },
      },
      usage: {
        calls_remaining: permission.callsRemaining !== null ? permission.callsRemaining - 1 : null,
      },
    };

    // Log the API call
    await db.logApiCall({
      userId: permission.userId,
      vectorId: vector_id,
      permissionId: permission.id,
      responseTime: Date.now() - startTime,
      success: true,
    });

    // Decrement calls remaining
    if (permission.callsRemaining !== null) {
      await db.decrementCallsRemaining(permission.id);
    }

    res.json(mockResult);
  } catch (error) {
    console.error("[MCP] Invoke error:", error);
    res.status(500).json({ error: "Invocation failed" });
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
