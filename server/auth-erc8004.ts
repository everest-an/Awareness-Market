/**
 * ERC-8004 Trustless Agents Authentication
 * 
 * Integrates ERC-8004 standard for AI agent authentication:
 * - On-chain agent identity registration
 * - Reputation tracking
 * - Capability verification
 * - Wallet signature authentication
 * 
 * ## Flow
 * 1. Agent registers on-chain via registerAgent()
 * 2. Agent signs message with wallet to authenticate
 * 3. Server verifies signature and issues JWT
 * 4. Agent uses JWT for API calls
 * 
 * ## Environment Variables
 * - ERC8004_REGISTRY_ADDRESS: Deployed registry contract address
 * - AVALANCHE_RPC_URL / FUJI_RPC_URL: RPC endpoint for Avalanche C-Chain
 */

import { ethers } from "ethers";
import { prisma } from "./db-prisma";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { getErrorMessage } from "./utils/error-handling";
import { createLogger } from './utils/logger';

const logger = createLogger('ERC8004');

// MySQL result type
interface InsertResult {
  insertId: number;
}

// JWT payload type
interface JWTPayload {
  userId: number;
  walletAddress: string;
  agentId?: string;
  isOnChain: boolean;
  type: string;
  exp?: number;
  iat?: number;
}

// Contract ABI (minimal interface for auth)
const ERC8004_ABI = [
  "function agents(bytes32) view returns (address owner, string metadataUri, string agentType, uint256 registeredAt, bool isActive)",
  "function registerAgent(bytes32 agentId, string metadataUri, string agentType)",
  "function registerAgentWithSignature(bytes32 agentId, string metadataUri, string agentType, address owner, uint256 deadline, bytes signature)",
  "function getAgentMetadata(bytes32 agentId) view returns (string)",
  "function isAgentActive(bytes32 agentId) view returns (bool)",
  "function getReputation(bytes32 agentId) view returns (uint256 totalInteractions, uint256 successfulInteractions, uint256 successRate, int256 score)",
  "function isVerified(bytes32 agentId, bytes32 claim) view returns (bool)",
  "function generateAgentId(string agentName, address owner) pure returns (bytes32)",
  "function recordInteraction(bytes32 fromAgentId, bytes32 toAgentId, bool success, uint256 weight, string interactionType)",
  "event AgentRegistered(bytes32 indexed agentId, address indexed owner, string agentType, string metadataUri)"
];

// Configuration - JWT_SECRET MUST be set via environment variable
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("CRITICAL: JWT_SECRET environment variable is not set. Server cannot start without it.");
}
const JWT_EXPIRY = "7d";
const NONCE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

// Nonce storage for replay protection
const nonceStore = new Map<string, { nonce: string; expiresAt: number }>();

// Provider and contract instances
let provider: ethers.JsonRpcProvider | null = null;
let registryContract: ethers.Contract | null = null;

/**
 * Initialize provider and contract
 */
function getProvider(): ethers.JsonRpcProvider {
  if (!provider) {
    const rpcUrl = process.env.BLOCKCHAIN_RPC_URL || process.env.AVALANCHE_RPC_URL || process.env.FUJI_RPC_URL || "https://api.avax-test.network/ext/bc/C/rpc";
    provider = new ethers.JsonRpcProvider(rpcUrl);
  }
  return provider;
}

function getRegistryContract(): ethers.Contract | null {
  const registryAddress = process.env.ERC8004_REGISTRY_ADDRESS;
  if (!registryAddress) {
    logger.warn('Registry address not configured');
    return null;
  }

  if (!registryContract) {
    registryContract = new ethers.Contract(registryAddress, ERC8004_ABI, getProvider());
  }
  return registryContract;
}

/**
 * Generate authentication nonce for wallet signing
 */
export function generateAuthNonce(walletAddress: string): { nonce: string; message: string; expiresAt: number } {
  const nonce = crypto.randomBytes(32).toString("hex");
  const expiresAt = Date.now() + NONCE_EXPIRY_MS;
  const timestamp = Math.floor(Date.now() / 1000);
  
  // Store nonce
  nonceStore.set(walletAddress.toLowerCase(), { nonce, expiresAt });
  
  // Create EIP-191 compliant message
  const message = `Awareness Network Authentication

Wallet: ${walletAddress}
Nonce: ${nonce}
Timestamp: ${timestamp}

Sign this message to authenticate as an AI agent.
This signature will not trigger any blockchain transaction.`;

  return { nonce, message, expiresAt };
}

/**
 * Verify wallet signature and authenticate agent
 */
export async function authenticateWithSignature(
  walletAddress: string,
  signature: string,
  agentId?: string
): Promise<{
  success: boolean;
  token?: string;
  agent?: {
    id: number;
    agentId: string;
    walletAddress: string;
    isOnChain: boolean;
    reputation?: { score: number; successRate: number };
  };
  error?: string;
}> {
  try {
    const stored = nonceStore.get(walletAddress.toLowerCase());
    
    if (!stored) {
      return { success: false, error: "No authentication request found. Please request a new nonce." };
    }
    
    if (Date.now() > stored.expiresAt) {
      nonceStore.delete(walletAddress.toLowerCase());
      return { success: false, error: "Authentication request expired. Please request a new nonce." };
    }
    
    // Reconstruct message
    const timestamp = Math.floor(stored.expiresAt / 1000 - 300); // Approximate original timestamp
    const message = `Awareness Network Authentication

Wallet: ${walletAddress}
Nonce: ${stored.nonce}
Timestamp: ${timestamp}

Sign this message to authenticate as an AI agent.
This signature will not trigger any blockchain transaction.`;

    // Verify signature
    let recoveredAddress: string;
    try {
      recoveredAddress = ethers.verifyMessage(message, signature);
    } catch (e) {
      return { success: false, error: "Invalid signature format" };
    }
    
    if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      return { success: false, error: "Signature verification failed" };
    }
    
    // Clear used nonce
    nonceStore.delete(walletAddress.toLowerCase());
    
    // Check on-chain registration
    let isOnChain = false;
    let onChainAgentId: string | null = null;
    let reputation = { score: 0, successRate: 0 };
    
    const registry = getRegistryContract();
    if (registry && agentId) {
      try {
        const agentIdBytes = agentId.startsWith("0x") ? agentId : ethers.id(agentId);
        isOnChain = await registry.isAgentActive(agentIdBytes);
        
        if (isOnChain) {
          onChainAgentId = agentIdBytes;
          const rep = await registry.getReputation(agentIdBytes);
          reputation = {
            score: Number(rep.score),
            successRate: Number(rep.successRate)
          };
        }
      } catch (e) {
        logger.warn('Failed to check on-chain status', { error: e, walletAddress });
      }
    }

    // Find or create user in database
    // Look up by wallet address (stored in openId)
    let existingUser = await prisma.user.findFirst({
      where: { openId: walletAddress.toLowerCase() }
    });

    let userId: number;

    if (!existingUser) {
      // Create new agent user
      const newUser = await prisma.user.create({
        data: {
          openId: walletAddress.toLowerCase(),
          name: `Agent ${walletAddress.slice(0, 8)}`,
          email: `${walletAddress.toLowerCase()}@agent.awareness.market`,
          loginMethod: "erc8004",
          role: "user",
          emailVerified: true, // Wallet verification is sufficient
          bio: onChainAgentId ? `ERC-8004 Agent: ${onChainAgentId.slice(0, 16)}...` : "AI Agent",
        }
      });

      userId = newUser.id;

      // Generate API key for the agent
      const rawApiKey = `ak_${crypto.randomBytes(32).toString("hex")}`;
      const keyHash = crypto.createHash("sha256").update(rawApiKey).digest("hex");

      await prisma.apiKey.create({
        data: {
          userId,
          keyHash,
          keyPrefix: rawApiKey.substring(0, 12),
          name: "Default Agent Key",
          permissions: JSON.stringify(["read", "write", "purchase"]),
          isActive: true,
        }
      });

      logger.info('New agent registered', { walletAddress, agentId: onChainAgentId });
    } else {
      userId = existingUser.id;

      // Update last sign in
      await prisma.user.update({
        where: { id: userId },
        data: { lastSignedIn: new Date() }
      });
    }
    
    // Generate JWT
    const token = jwt.sign(
      {
        userId,
        walletAddress: walletAddress.toLowerCase(),
        agentId: onChainAgentId,
        isOnChain,
        type: "erc8004"
      },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: JWT_EXPIRY, algorithm: 'HS256' }
    );
    
    return {
      success: true,
      token,
      agent: {
        id: userId,
        agentId: onChainAgentId || walletAddress.toLowerCase(),
        walletAddress: walletAddress.toLowerCase(),
        isOnChain,
        reputation: isOnChain ? reputation : undefined
      }
    };
  } catch (error: unknown) {
    logger.error('Authentication failed', { error: getErrorMessage(error) });
    return { success: false, error: 'Authentication failed' };
  }
}

/**
 * Get agent info from on-chain registry
 */
export async function getOnChainAgent(agentId: string): Promise<{
  exists: boolean;
  owner?: string;
  metadataUri?: string;
  agentType?: string;
  isActive?: boolean;
  reputation?: { totalInteractions: number; successRate: number; score: number };
}> {
  const registry = getRegistryContract();
  if (!registry) {
    return { exists: false };
  }
  
  try {
    const agentIdBytes = agentId.startsWith("0x") ? agentId : ethers.id(agentId);
    const agent = await registry.agents(agentIdBytes);
    
    if (agent.owner === ethers.ZeroAddress) {
      return { exists: false };
    }
    
    const rep = await registry.getReputation(agentIdBytes);
    
    return {
      exists: true,
      owner: agent.owner,
      metadataUri: agent.metadataUri,
      agentType: agent.agentType,
      isActive: agent.isActive,
      reputation: {
        totalInteractions: Number(rep.totalInteractions),
        successRate: Number(rep.successRate),
        score: Number(rep.score)
      }
    };
  } catch (error) {
    logger.error('Failed to get agent', { error, agentId });
    return { exists: false };
  }
}

/**
 * Check if agent has a verified capability
 */
export async function checkCapability(agentId: string, capability: string): Promise<boolean> {
  const registry = getRegistryContract();
  if (!registry) return false;

  try {
    const agentIdBytes = agentId.startsWith("0x") ? agentId : ethers.id(agentId);
    const claimHash = ethers.id(capability);
    return await registry.isVerified(agentIdBytes, claimHash);
  } catch (error) {
    logger.error('Failed to check capability', { error, agentId, capability });
    return false;
  }
}

/**
 * Generate registration data for on-chain registration
 * Returns data that can be used to call registerAgent or registerAgentWithSignature
 */
export function generateRegistrationData(
  agentName: string,
  ownerAddress: string,
  agentType: string = "ai",
  metadataUri: string = ""
): {
  agentId: string;
  registrationData: {
    agentId: string;
    metadataUri: string;
    agentType: string;
  };
  signatureData?: {
    message: string;
    deadline: number;
  };
} {
  // Generate deterministic agent ID
  const agentId = ethers.solidityPackedKeccak256(
    ["string", "address"],
    [agentName, ownerAddress]
  );
  
  const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour
  
  // Message for gasless registration signature
  const message = ethers.solidityPackedKeccak256(
    ["bytes32", "string", "string", "address", "uint256"],
    [agentId, metadataUri, agentType, ownerAddress, deadline]
  );
  
  return {
    agentId,
    registrationData: {
      agentId,
      metadataUri: metadataUri || `https://awareness.market/api/agents/${agentId}/metadata`,
      agentType
    },
    signatureData: {
      message,
      deadline
    }
  };
}

/**
 * Verify JWT token from ERC-8004 authentication
 */
export function verifyERC8004Token(token: string): {
  valid: boolean;
  payload?: {
    userId: number;
    walletAddress: string;
    agentId: string | null;
    isOnChain: boolean;
  };
  error?: string;
} {
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret', { algorithms: ['HS256'] }) as unknown as JWTPayload;

    if (payload.type !== "erc8004") {
      return { valid: false, error: "Invalid token type" };
    }

    return {
      valid: true,
      payload: {
        userId: payload.userId,
        walletAddress: payload.walletAddress,
        agentId: payload.agentId || null,
        isOnChain: payload.isOnChain
      }
    };
  } catch (error: unknown) {
    return { valid: false, error: 'Token verification failed' };
  }
}

/**
 * Get ERC-8004 configuration status
 */
export function getERC8004Status(): {
  enabled: boolean;
  registryAddress: string | null;
  rpcUrl: string;
  chainId: number;
} {
  const registryAddress = process.env.ERC8004_REGISTRY_ADDRESS || null;
  const rpcUrl = process.env.BLOCKCHAIN_RPC_URL || process.env.AVALANCHE_RPC_URL || process.env.FUJI_RPC_URL || "https://api.avax-test.network/ext/bc/C/rpc";

  return {
    enabled: !!registryAddress,
    registryAddress,
    rpcUrl,
    chainId: 43113 // Avalanche Fuji Testnet
  };
}

// Standard capability claims
export const CAPABILITY_CLAIMS = {
  MEMORY_READ: "awareness:memory:read",
  MEMORY_WRITE: "awareness:memory:write",
  VECTOR_INVOKE: "awareness:vector:invoke",
  CHAIN_EXECUTE: "awareness:chain:execute",
  MARKETPLACE_TRADE: "awareness:marketplace:trade",
  AGENT_COLLABORATE: "awareness:agent:collaborate"
} as const;
