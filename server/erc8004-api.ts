/**
 * ERC-8004 API Routes
 * 
 * REST API endpoints for ERC-8004 Trustless Agents authentication
 */

import express from "express";
import { z } from "zod";
import * as erc8004 from "./auth-erc8004";
import { getErrorMessage } from "./utils/error-handling";

const router = express.Router();

/**
 * GET /api/erc8004/status
 * Get ERC-8004 configuration status
 */
router.get("/status", (req, res) => {
  const status = erc8004.getERC8004Status();
  res.json(status);
});

/**
 * POST /api/erc8004/nonce
 * Request authentication nonce for wallet signing
 */
router.post("/nonce", (req, res) => {
  try {
    const schema = z.object({
      walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid wallet address")
    });
    
    const { walletAddress } = schema.parse(req.body);
    const result = erc8004.generateAuthNonce(walletAddress);
    
    res.json({
      success: true,
      nonce: result.nonce,
      message: result.message,
      expiresAt: result.expiresAt
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request", details: error.issues });
    }
    res.status(500).json({ error: 'Failed to generate nonce' });
  }
});

/**
 * Authenticate with wallet signature
 */
router.post("/authenticate", async (req, res) => {
  try {
    const schema = z.object({
      walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
      signature: z.string(),
      agentId: z.string().optional()
    });
    
    const { walletAddress, signature, agentId } = schema.parse(req.body);
    const result = await erc8004.authenticateWithSignature(walletAddress, signature, agentId);
    
    if (result.success) {
      // Set JWT in cookie for browser clients
      res.cookie("erc8004_token", result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });
      
      res.json({
        success: true,
        token: result.token,
        agent: result.agent
      });
    } else {
      res.status(401).json({ success: false, error: result.error });
    }
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request", details: error.issues });
    }
    res.status(500).json({ error: 'Authentication failed' });
  }
});

/**
 * GET /api/erc8004/agent/:agentId
 * Get on-chain agent information
 */
router.get("/agent/:agentId", async (req, res) => {
  try {
    const { agentId } = req.params;
    const agent = await erc8004.getOnChainAgent(agentId);
    
    if (!agent.exists) {
      return res.status(404).json({ error: "Agent not found on-chain" });
    }
    
    res.json(agent);
  } catch (error: unknown) {
    res.status(500).json({ error: 'Failed to retrieve agent info' });
 * Check if agent has a verified capability
 */
router.get("/agent/:agentId/capability/:capability", async (req, res) => {
  try {
    const { agentId, capability } = req.params;
    const isVerified = await erc8004.checkCapability(agentId, capability);
    
    res.json({
      agentId,
      capability,
      isVerified
    });
  } catch (error: unknown) {
    res.status(500).json({ error: 'Failed to check capability' });
 * Prepare registration data for on-chain registration
 */
router.post("/register/prepare", (req, res) => {
  try {
    const schema = z.object({
      agentName: z.string().min(1).max(255),
      ownerAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
      agentType: z.enum(["ai", "mcp", "sdk", "autonomous"]).default("ai"),
      metadataUri: z.string().url().optional()
    });
    
    const { agentName, ownerAddress, agentType, metadataUri } = schema.parse(req.body);
    const data = erc8004.generateRegistrationData(agentName, ownerAddress, agentType, metadataUri || "");
    
    res.json({
      success: true,
      ...data,
      contractAddress: process.env.ERC8004_REGISTRY_ADDRESS || null,
      instructions: {
        direct: "Call registerAgent(agentId, metadataUri, agentType) on the registry contract",
        gasless: "Sign the message and call registerAgentWithSignature with the signature"
      }
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request", details: error.issues });
    }
    res.status(500).json({ error: 'Failed to prepare registration' });
 * List standard capability claims
 */
router.get("/capabilities", (req, res) => {
  res.json({
    capabilities: erc8004.CAPABILITY_CLAIMS,
    description: {
      MEMORY_READ: "Read AI memory/KV-cache data",
      MEMORY_WRITE: "Write/update AI memory data",
      VECTOR_INVOKE: "Invoke latent vectors",
      CHAIN_EXECUTE: "Execute reasoning chains",
      MARKETPLACE_TRADE: "Buy/sell on marketplace",
      AGENT_COLLABORATE: "Collaborate with other agents"
    }
  });
});

/**
 * POST /api/erc8004/verify
 * Verify an ERC-8004 JWT token
 */
router.post("/verify", (req, res) => {
  try {
    const token = req.body.token || req.cookies?.erc8004_token || req.headers.authorization?.replace("Bearer ", "");
    
    if (!token) {
      return res.status(401).json({ valid: false, error: "No token provided" });
    }
    
    const result = erc8004.verifyERC8004Token(token);
    res.json(result);
  } catch (error: unknown) {
    res.status(500).json({ valid: false, error: 'Token verification failed' });
  }
});

export { router as erc8004Router };
