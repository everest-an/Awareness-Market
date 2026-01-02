/**
 * LatentMAS V2.0 - Memory Exchange Business Logic
 * Handles KV-cache trading, reasoning chain marketplace, and memory alignment
 */

import { getDb } from "../db";
import { eq, and, desc, sql } from "drizzle-orm";
import {
  memoryExchanges,
  reasoningChains,
  wMatrixVersions,
  users,
} from "../../drizzle/schema";
import { WMatrixService } from "./w-matrix-service";
import type {
  KVCache,
  AlignedKVCache,
  ModelType,
} from "./types";

/**
 * Publish a memory (KV-cache) for sale
 */
export async function publishMemory(params: {
  sellerId: number;
  memoryType: "kv_cache" | "reasoning_chain" | "long_term_memory";
  kvCacheData: KVCache;
  price: number;
  description?: string;
  storageUrl?: string; // S3 URL for persisted KV-cache data
}): Promise<{ id: number; success: boolean }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { sellerId, memoryType, kvCacheData, price, storageUrl } = params;

  // Validate KV-cache data
  if (!kvCacheData.sourceModel || !kvCacheData.keys || !kvCacheData.values) {
    throw new Error("Invalid KV-cache data: missing required fields");
  }

  // Get current W-Matrix version
  const wMatrixVersion = WMatrixService.getCurrentVersion();

  // Calculate quality score based on data completeness
  const qualityScore = calculateMemoryQuality(kvCacheData);

  const [result] = await db.insert(memoryExchanges).values({
    sellerId,
    buyerId: 0, // Will be set when purchased
    memoryType,
    kvCacheData: JSON.stringify(kvCacheData),
    wMatrixVersion,
    sourceModel: kvCacheData.sourceModel,
    targetModel: null,
    contextLength: kvCacheData.metadata.sequenceLength,
    tokenCount: kvCacheData.metadata.tokenCount,
    price: price.toString(),
    qualityScore: qualityScore.toString(),
    status: "pending",
  });

  return {
    id: result.insertId,
    success: true,
  };
}

/**
 * Purchase and align memory to target model
 */
export async function purchaseMemory(params: {
  memoryId: number;
  buyerId: number;
  targetModel: ModelType;
}): Promise<{
  alignedKVCache: AlignedKVCache;
  exchange: typeof memoryExchanges.$inferSelect;
}> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { memoryId, buyerId, targetModel } = params;

  const [exchange] = await db
    .select()
    .from(memoryExchanges)
    .where(eq(memoryExchanges.id, memoryId));

  if (!exchange) {
    throw new Error("Memory not found");
  }

  if (exchange.status !== "pending") {
    throw new Error("Memory is not available for purchase");
  }

  const kvCacheData: KVCache = JSON.parse(exchange.kvCacheData || "{}");

  const alignedKVCache = WMatrixService.alignKVCache(
    kvCacheData,
    targetModel,
    exchange.wMatrixVersion || undefined
  );

  await db
    .update(memoryExchanges)
    .set({
      buyerId,
      targetModel,
      status: "completed",
      alignmentQuality: JSON.stringify(alignedKVCache.alignmentQuality),
    })
    .where(eq(memoryExchanges.id, memoryId));

  const [updatedExchange] = await db
    .select()
    .from(memoryExchanges)
    .where(eq(memoryExchanges.id, memoryId));

  return {
    alignedKVCache,
    exchange: updatedExchange,
  };
}

/**
 * Browse available memories for purchase
 */
export async function browseMemories(params: {
  memoryType?: "kv_cache" | "reasoning_chain" | "long_term_memory";
  sourceModel?: ModelType;
  minQuality?: number;
  maxPrice?: number;
  limit?: number;
  offset?: number;
}): Promise<{
  memories: (typeof memoryExchanges.$inferSelect)[];
  total: number;
}> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { memoryType, sourceModel, minQuality, maxPrice, limit = 20, offset = 0 } = params;

  const conditions = [eq(memoryExchanges.status, "pending")];

  if (memoryType) {
    conditions.push(eq(memoryExchanges.memoryType, memoryType));
  }

  if (sourceModel) {
    conditions.push(eq(memoryExchanges.sourceModel, sourceModel));
  }

  const memories = await db
    .select()
    .from(memoryExchanges)
    .where(and(...conditions))
    .orderBy(desc(memoryExchanges.createdAt))
    .limit(limit)
    .offset(offset);

  const filteredMemories = memories.filter((m) => {
    if (minQuality && parseFloat(m.qualityScore || "0") < minQuality) return false;
    if (maxPrice && parseFloat(m.price) > maxPrice) return false;
    return true;
  });

  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(memoryExchanges)
    .where(and(...conditions));

  return {
    memories: filteredMemories,
    total: countResult?.count || 0,
  };
}

/**
 * Publish a reasoning chain
 */
export async function publishReasoningChain(params: {
  creatorId: number;
  chainName: string;
  description: string;
  category: string;
  inputExample: any;
  outputExample: any;
  kvCacheSnapshot: KVCache;
  pricePerUse: number;
  storageUrl?: string; // S3 URL for persisted KV-cache data
}): Promise<{ id: number; success: boolean }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const {
    creatorId,
    chainName,
    description,
    category,
    inputExample,
    outputExample,
    kvCacheSnapshot,
    pricePerUse,
    storageUrl,
  } = params;

  const stepCount = kvCacheSnapshot.keys.length || 1;
  const wMatrixVersion = WMatrixService.getCurrentVersion();

  const [result] = await db.insert(reasoningChains).values({
    creatorId,
    chainName,
    description,
    category,
    inputExample: JSON.stringify(inputExample),
    outputExample: JSON.stringify(outputExample),
    kvCacheSnapshot: JSON.stringify(kvCacheSnapshot),
    sourceModel: kvCacheSnapshot.sourceModel,
    wMatrixVersion,
    stepCount,
    pricePerUse: pricePerUse.toString(),
    status: "active",
  });

  return {
    id: result.insertId,
    success: true,
  };
}

/**
 * Use a reasoning chain (purchase and apply)
 */
export async function useReasoningChain(params: {
  chainId: number;
  userId: number;
  targetModel: ModelType;
}): Promise<{
  alignedKVCache: AlignedKVCache;
  chain: typeof reasoningChains.$inferSelect;
}> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { chainId, userId, targetModel } = params;

  const [chain] = await db
    .select()
    .from(reasoningChains)
    .where(eq(reasoningChains.id, chainId));

  if (!chain) {
    throw new Error("Reasoning chain not found");
  }

  if (chain.status !== "active") {
    throw new Error("Reasoning chain is not available");
  }

  const kvCacheSnapshot: KVCache = JSON.parse(chain.kvCacheSnapshot || "{}");

  const alignedKVCache = WMatrixService.alignKVCache(
    kvCacheSnapshot,
    targetModel,
    chain.wMatrixVersion || undefined
  );

  await db
    .update(reasoningChains)
    .set({
      usageCount: sql`${reasoningChains.usageCount} + 1`,
      totalRevenue: sql`${reasoningChains.totalRevenue} + ${chain.pricePerUse}`,
    })
    .where(eq(reasoningChains.id, chainId));

  await db.insert(memoryExchanges).values({
    sellerId: chain.creatorId,
    buyerId: userId,
    memoryType: "reasoning_chain",
    kvCacheData: chain.kvCacheSnapshot,
    wMatrixVersion: chain.wMatrixVersion,
    sourceModel: chain.sourceModel,
    targetModel,
    contextLength: kvCacheSnapshot.metadata?.sequenceLength || 0,
    tokenCount: kvCacheSnapshot.metadata?.tokenCount || 0,
    price: chain.pricePerUse,
    qualityScore: chain.avgQuality,
    alignmentQuality: JSON.stringify(alignedKVCache.alignmentQuality),
    status: "completed",
  });

  return {
    alignedKVCache,
    chain,
  };
}

/**
 * Browse reasoning chains marketplace
 */
export async function browseReasoningChains(params: {
  category?: string;
  sourceModel?: ModelType;
  minQuality?: number;
  maxPrice?: number;
  limit?: number;
  offset?: number;
}): Promise<{
  chains: (typeof reasoningChains.$inferSelect & { creatorName?: string })[];
  total: number;
}> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { category, sourceModel, minQuality, maxPrice, limit = 20, offset = 0 } = params;

  const conditions = [eq(reasoningChains.status, "active")];

  if (category) {
    conditions.push(eq(reasoningChains.category, category));
  }

  if (sourceModel) {
    conditions.push(eq(reasoningChains.sourceModel, sourceModel));
  }

  const chains = await db
    .select({
      chain: reasoningChains,
      creatorName: users.name,
    })
    .from(reasoningChains)
    .leftJoin(users, eq(reasoningChains.creatorId, users.id))
    .where(and(...conditions))
    .orderBy(desc(reasoningChains.usageCount))
    .limit(limit)
    .offset(offset);

  const formattedChains = chains
    .filter((c) => {
      if (minQuality && parseFloat(c.chain.avgQuality || "0") < minQuality) return false;
      if (maxPrice && parseFloat(c.chain.pricePerUse) > maxPrice) return false;
      return true;
    })
    .map((c) => ({
      ...c.chain,
      creatorName: c.creatorName || "Unknown",
    }));

  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(reasoningChains)
    .where(and(...conditions));

  return {
    chains: formattedChains,
    total: countResult?.count || 0,
  };
}

/**
 * Get W-Matrix versions from database
 */
export async function getWMatrixVersions(): Promise<(typeof wMatrixVersions.$inferSelect)[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db
    .select()
    .from(wMatrixVersions)
    .where(eq(wMatrixVersions.isActive, true))
    .orderBy(desc(wMatrixVersions.createdAt));
}

/**
 * Register a new W-Matrix version
 */
export async function registerWMatrixVersion(params: {
  version: string;
  sourceModel: string;
  targetModel: string;
  method: "orthogonal" | "learned" | "hybrid";
  unifiedDimension: number;
  qualityMetrics: object;
  transformationRules: object;
  description?: string;
}): Promise<{ id: number; success: boolean }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const [result] = await db.insert(wMatrixVersions).values({
    version: params.version,
    sourceModel: params.sourceModel,
    targetModel: params.targetModel,
    method: params.method,
    unifiedDimension: params.unifiedDimension,
    qualityMetrics: JSON.stringify(params.qualityMetrics),
    transformationRules: JSON.stringify(params.transformationRules),
    description: params.description,
    isActive: true,
  });

  return {
    id: result.insertId,
    success: true,
  };
}

/**
 * Calculate memory quality score
 */
function calculateMemoryQuality(kvCache: KVCache): number {
  let score = 0.5;

  if (kvCache.keys && kvCache.keys.length > 0) score += 0.1;
  if (kvCache.values && kvCache.values.length > 0) score += 0.1;
  if (kvCache.metadata?.contextDescription) score += 0.1;
  if (kvCache.attentionMask) score += 0.05;
  if (kvCache.positionEncodings) score += 0.05;

  const tokenCount = kvCache.metadata?.tokenCount || 0;
  if (tokenCount > 100) score += 0.05;
  if (tokenCount > 1000) score += 0.05;

  return Math.min(score, 1.0);
}

/**
 * Get user's memory exchange history
 */
export async function getUserMemoryHistory(params: {
  userId: number;
  role: "seller" | "buyer" | "both";
  limit?: number;
}): Promise<(typeof memoryExchanges.$inferSelect)[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { userId, role, limit = 50 } = params;

  let condition;
  if (role === "seller") {
    condition = eq(memoryExchanges.sellerId, userId);
  } else if (role === "buyer") {
    condition = eq(memoryExchanges.buyerId, userId);
  } else {
    condition = sql`${memoryExchanges.sellerId} = ${userId} OR ${memoryExchanges.buyerId} = ${userId}`;
  }

  return db
    .select()
    .from(memoryExchanges)
    .where(condition)
    .orderBy(desc(memoryExchanges.createdAt))
    .limit(limit);
}

/**
 * Get memory exchange statistics
 */
export async function getMemoryExchangeStats(): Promise<{
  totalExchanges: number;
  totalVolume: number;
  avgQuality: number;
  byType: Record<string, number>;
}> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const [stats] = await db
    .select({
      totalExchanges: sql<number>`count(*)`,
      totalVolume: sql<number>`COALESCE(SUM(CAST(price AS DECIMAL(10,2))), 0)`,
      avgQuality: sql<number>`COALESCE(AVG(CAST(quality_score AS DECIMAL(3,2))), 0)`,
    })
    .from(memoryExchanges)
    .where(eq(memoryExchanges.status, "completed"));

  const typeCounts = await db
    .select({
      memoryType: memoryExchanges.memoryType,
      count: sql<number>`count(*)`,
    })
    .from(memoryExchanges)
    .where(eq(memoryExchanges.status, "completed"))
    .groupBy(memoryExchanges.memoryType);

  const byType: Record<string, number> = {};
  typeCounts.forEach((tc) => {
    byType[tc.memoryType] = tc.count;
  });

  return {
    totalExchanges: stats?.totalExchanges || 0,
    totalVolume: stats?.totalVolume || 0,
    avgQuality: stats?.avgQuality || 0,
    byType,
  };
}
