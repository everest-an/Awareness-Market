/**
 * AI Agent Authentication System
 * 
 * Provides authentication for AI agents accessing the Awareness Market
 * Supports:
 * - API Key authentication
 * - Agent registration
 * - Agent-specific permissions
 * - Rate limiting for AI agents
 */

import { nanoid } from "nanoid";
import { getDb } from "./db";
import { users } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

export interface AIAgentCredentials {
  agentId: string;
  apiKey: string;
  agentName: string;
  agentType: "mcp" | "api" | "sdk";
  createdAt: Date;
}

export interface AIAgentProfile {
  id: number;
  agentId: string;
  agentName: string;
  agentType: string;
  email: string;
  role: string;
  createdAt: Date;
  lastAccessedAt?: Date;
}

/**
 * Generate API key for AI agent
 */
export function generateApiKey(): string {
  const prefix = "ak_"; // API Key prefix
  const randomPart = crypto.randomBytes(32).toString("hex");
  return `${prefix}${randomPart}`;
}

/**
 * Hash API key for storage
 */
export function hashApiKey(apiKey: string): string {
  return crypto.createHash("sha256").update(apiKey).digest("hex");
}

/**
 * Register AI agent
 * Creates a user account with role "agent" and generates API key
 */
export async function registerAIAgent(params: {
  agentName: string;
  agentType: "mcp" | "api" | "sdk";
  email?: string;
  description?: string;
}): Promise<{ success: boolean; credentials?: AIAgentCredentials; error?: string }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  try {
    // Generate unique agent ID
    const agentId = `agent_${nanoid(16)}`;
    
    // Generate API key
    const apiKey = generateApiKey();
    const apiKeyHash = hashApiKey(apiKey);
    
    // Generate email if not provided
    const agentEmail = params.email || `${agentId}@ai-agent.awareness.market`;
    
    // Check if email already exists
    const existing = await db.select().from(users).where(eq(users.email, agentEmail)).limit(1);
    if (existing.length > 0) {
      return { success: false, error: "Agent email already registered" };
    }
    
    // Create agent user account
    const result = await db.insert(users).values({
      email: agentEmail,
      name: params.agentName,
      role: "user", // AI agents are users with special permissions
      loginMethod: "api_key",
      bio: params.description || `AI Agent: ${params.agentType}`,
      openId: agentId,
      password: apiKeyHash, // Store hashed API key as password
      emailVerified: true, // AI agents don't need email verification
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    
    const user = result[0];
    
    return {
      success: true,
      credentials: {
        agentId,
        apiKey, // Return unhashed API key (only time it's visible)
        agentName: params.agentName,
        agentType: params.agentType,
        createdAt: user.createdAt,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Authenticate AI agent with API key
 */
export async function authenticateAIAgent(apiKey: string): Promise<{
  success: boolean;
  agent?: AIAgentProfile;
  error?: string;
}> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  try {
    // Hash the provided API key
    const apiKeyHash = hashApiKey(apiKey);
    
    // Find user with matching API key hash
    const result = await db
      .select()
      .from(users)
      .where(eq(users.password, apiKeyHash))
      .limit(1);
    
    if (result.length === 0) {
      return { success: false, error: "Invalid API key" };
    }
    
    const user = result[0];
    
    // Update last accessed time
    await db
      .update(users)
      .set({ lastSignedIn: new Date() })
      .where(eq(users.id, user.id));
    
    return {
      success: true,
      agent: {
        id: user.id,
        agentId: user.openId || "",
        agentName: user.name || "Unknown Agent",
        agentType: user.loginMethod || "api",
        email: user.email || "",
        role: user.role,
        createdAt: user.createdAt,
        lastAccessedAt: new Date(),
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Verify API key format
 */
export function isValidApiKeyFormat(apiKey: string): boolean {
  return apiKey.startsWith("ak_") && apiKey.length === 67; // "ak_" + 64 hex chars
}

/**
 * Get AI agent profile
 */
export async function getAIAgentProfile(agentId: string): Promise<AIAgentProfile | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  try {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.openId, agentId))
      .limit(1);
    
    if (result.length === 0) {
      return null;
    }
    
    const user = result[0];
    
    return {
      id: user.id,
      agentId: user.openId || "",
      agentName: user.name || "Unknown Agent",
      agentType: user.loginMethod || "api",
      email: user.email || "",
      role: user.role,
      createdAt: user.createdAt,
      lastAccessedAt: user.lastSignedIn || undefined,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Revoke API key (delete agent account)
 */
export async function revokeAIAgentAccess(agentId: string): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  try {
    await db.delete(users).where(eq(users.openId, agentId));
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * List all AI agents
 */
export async function listAIAgents(): Promise<AIAgentProfile[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  try {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.loginMethod, "api_key"));
    
    return result.map(user => ({
      id: user.id,
      agentId: user.openId || "",
      agentName: user.name || "Unknown Agent",
      agentType: user.loginMethod || "api",
      email: user.email || "",
      role: user.role,
      createdAt: user.createdAt,
      lastAccessedAt: user.lastSignedIn || undefined,
    }));
  } catch (error) {
    return [];
  }
}
