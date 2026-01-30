/**
 * Go 服务适配器
 *
 * 此文件提供了与 Go 微服务通信的函数。
 * 简化了 tRPC 路由中对 Go 服务的调用。
 */

import { createLogger } from '../utils/logger';

const logger = createLogger('GoService');

// Using native fetch API (Node.js 18+)

// ==========================================
// 类型定义
// ==========================================

export interface VectorStats {
  total: number;
  average_similarity: number;
  total_storage_size: number;
}

export interface VectorPackage {
  id: string;
  name: string;
  description: string;
  dimension: number;
  model_type: string;
  similarity_score?: number;
  created_at: string;
  updated_at: string;
}

export interface VectorSearchResult {
  success: boolean;
  packages: VectorPackage[];
  total: number;
  top_k: number;
}

export interface MemoryPackage {
  id: string;
  owner: string;
  type: string;
  name: string;
  description: string;
  price: number;
  total_transactions: number;
  average_rating: number;
  created_at: string;
  updated_at: string;
}

export interface MemoryBrowseResult {
  success: boolean;
  data: MemoryPackage[];
  total: number;
  page: number;
  page_size: number;
}

export interface ReasoningChain {
  id: string;
  owner: string;
  name: string;
  description: string;
  chain_steps: number;
  model_type: string;
  price: number;
  total_uses: number;
  average_rating: number;
  created_at: string;
  updated_at: string;
}

// ==========================================
// Vector Operations 适配器
// ==========================================

const VECTOR_SERVICE_URL = process.env.VECTOR_SERVICE_URL || 'http://localhost:8083';
const VECTOR_API_KEY = process.env.VECTOR_API_KEY || process.env.API_KEY_SECRET;

/**
 * 获取向量统计信息
 */
export async function getVectorStats(): Promise<VectorStats> {
  const response = await fetch(`${VECTOR_SERVICE_URL}/api/v1/vectors/stats`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': VECTOR_API_KEY || '',
    },
  });

  if (!response.ok) {
    throw new Error(`Vector stats error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as any;
  return data.data || data;
}

/**
 * 搜索向量包
 */
export async function searchVectorPackages(
  query?: string,
  topK: number = 20,
  offset: number = 0
): Promise<VectorSearchResult> {
  const response = await fetch(`${VECTOR_SERVICE_URL}/api/v1/vectors/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': VECTOR_API_KEY || '',
    },
    body: JSON.stringify({
      query,
      top_k: topK,
      offset,
    }),
  });

  if (!response.ok) {
    throw new Error(`Vector search error: ${response.status} ${response.statusText}`);
  }

  return await response.json() as VectorSearchResult;
}

/**
 * 获取向量包详情
 */
export async function getVectorPackage(vectorId: string): Promise<VectorPackage> {
  const response = await fetch(`${VECTOR_SERVICE_URL}/api/v1/vectors/${vectorId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': VECTOR_API_KEY || '',
    },
  });

  if (!response.ok) {
    throw new Error(`Get vector package error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as any;
  return data.data || data;
}

/**
 * 批量获取向量
 */
export async function getVectorBatch(vectorIds: string[]): Promise<VectorPackage[]> {
  const response = await fetch(`${VECTOR_SERVICE_URL}/api/v1/vectors/batch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': VECTOR_API_KEY || '',
    },
    body: JSON.stringify({ vector_ids: vectorIds }),
  });

  if (!response.ok) {
    throw new Error(`Batch vector error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as any;
  return data.data || data.vectors || [];
}

// ==========================================
// Memory Exchange 适配器
// ==========================================

const MEMORY_SERVICE_URL = process.env.MEMORY_SERVICE_URL || 'http://localhost:8080';
const MEMORY_API_KEY = process.env.MEMORY_API_KEY || process.env.API_KEY_SECRET;

/**
 * 浏览内存包
 */
export async function browseMemoryPackages(
  type: 'kv_cache' | 'attention' | 'all' = 'all',
  limit: number = 20,
  offset: number = 0
): Promise<MemoryBrowseResult> {
  const params = new URLSearchParams({
    type,
    limit: String(limit),
    offset: String(offset),
  });

  const response = await fetch(`${MEMORY_SERVICE_URL}/api/v1/memory/browse?${params}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${MEMORY_API_KEY || ''}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Memory browse error: ${response.status} ${response.statusText}`);
  }

  return await response.json() as MemoryBrowseResult;
}

/**
 * 发布内存包
 */
export async function publishMemoryPackage(
  userId: string,
  data: {
    name: string;
    description: string;
    type: 'kv_cache' | 'attention';
    price: number;
    model_type: string;
  }
): Promise<MemoryPackage> {
  const response = await fetch(`${MEMORY_SERVICE_URL}/api/v1/memory/publish`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${MEMORY_API_KEY || ''}`,
      'X-User-ID': userId,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`Memory publish error: ${response.status} ${response.statusText}`);
  }

  const result = await response.json() as any;
  return result.data || result;
}

/**
 * 购买内存包
 */
export async function purchaseMemoryPackage(
  userId: string,
  memoryId: string
): Promise<{ success: boolean; transaction_id: string }> {
  const response = await fetch(`${MEMORY_SERVICE_URL}/api/v1/memory/purchase`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${MEMORY_API_KEY || ''}`,
      'X-User-ID': userId,
    },
    body: JSON.stringify({ memory_id: memoryId }),
  });

  if (!response.ok) {
    throw new Error(`Memory purchase error: ${response.status} ${response.statusText}`);
  }

  return await response.json() as any;
}

// ==========================================
// Reasoning Chain 适配器
// ==========================================

/**
 * 浏览推理链
 */
export async function browseReasoningChains(
  modelType?: string,
  limit: number = 20,
  offset: number = 0
): Promise<{ success: boolean; data: ReasoningChain[]; total: number }> {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });

  if (modelType) {
    params.append('model_type', modelType);
  }

  const response = await fetch(`${MEMORY_SERVICE_URL}/api/v1/reasoning-chain/browse?${params}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${MEMORY_API_KEY || ''}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Reasoning chain browse error: ${response.status} ${response.statusText}`);
  }

  return await response.json() as any;
}

/**
 * 发布推理链
 */
export async function publishReasoningChain(
  userId: string,
  data: {
    name: string;
    description: string;
    chain_steps: unknown[];
    model_type: string;
    price: number;
  }
): Promise<ReasoningChain> {
  const response = await fetch(`${MEMORY_SERVICE_URL}/api/v1/reasoning-chain/publish`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${MEMORY_API_KEY || ''}`,
      'X-User-ID': userId,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(
      `Reasoning chain publish error: ${response.status} ${response.statusText}`
    );
  }

  const result = await response.json() as any;
  return result.data || result;
}

/**
 * 使用推理链
 */
export async function useReasoningChain(
  userId: string,
  chainId: string
): Promise<{ success: boolean; transaction_id: string }> {
  const response = await fetch(`${MEMORY_SERVICE_URL}/api/v1/reasoning-chain/use`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${MEMORY_API_KEY || ''}`,
      'X-User-ID': userId,
    },
    body: JSON.stringify({ chain_id: chainId }),
  });

  if (!response.ok) {
    throw new Error(`Reasoning chain use error: ${response.status} ${response.statusText}`);
  }

  return await response.json() as any;
}

// ==========================================
// W-Matrix Marketplace 适配器
// ==========================================

const WMATRIX_SERVICE_URL = process.env.WMATRIX_SERVICE_URL || 'http://localhost:8081';
const WMATRIX_API_KEY = process.env.WMATRIX_API_KEY || process.env.API_KEY_SECRET;

export interface WMatrixVersion {
  id: string;
  owner: string;
  name: string;
  description: string;
  model_type: string;
  version: string;
  alignment_score: number;
  price: number;
  created_at: string;
  updated_at: string;
}

/**
 * 获取 W-Matrix 版本列表
 */
export async function getWMatrixVersions(
  modelType?: string,
  limit: number = 20
): Promise<{ success: boolean; data: WMatrixVersion[]; total: number }> {
  const params = new URLSearchParams({ limit: String(limit) });

  if (modelType) {
    params.append('model_type', modelType);
  }

  const response = await fetch(`${WMATRIX_SERVICE_URL}/api/v1/w-matrix/versions?${params}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': WMATRIX_API_KEY || '',
    },
  });

  if (!response.ok) {
    throw new Error(`W-Matrix versions error: ${response.status} ${response.statusText}`);
  }

  return await response.json() as any;
}

/**
 * 获取 W-Matrix 特定版本
 */
export async function getWMatrixVersion(versionId: string): Promise<WMatrixVersion> {
  const response = await fetch(`${WMATRIX_SERVICE_URL}/api/v1/w-matrix/versions/${versionId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': WMATRIX_API_KEY || '',
    },
  });

  if (!response.ok) {
    throw new Error(`Get W-Matrix version error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as any;
  return data.data || data;
}

/**
 * 创建 W-Matrix 版本
 */
export async function createWMatrixVersion(
  userId: string,
  data: {
    name: string;
    description: string;
    model_type: string;
    version: string;
    alignment_config: unknown;
    price: number;
  }
): Promise<WMatrixVersion> {
  const response = await fetch(`${WMATRIX_SERVICE_URL}/api/v1/w-matrix/versions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': WMATRIX_API_KEY || '',
      'X-User-ID': userId,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(
      `Create W-Matrix version error: ${response.status} ${response.statusText}`
    );
  }

  const result = await response.json() as any;
  return result.data || result;
}

/**
 * 验证服务连接
 */
export async function verifyServiceConnections(): Promise<{
  vector: boolean;
  memory: boolean;
  wmatrix: boolean;
}> {
  const results = { vector: false, memory: false, wmatrix: false };

  try {
    const vectorRes = await fetch(`${VECTOR_SERVICE_URL}/health`);
    results.vector = vectorRes.ok;
  } catch (err) {
    logger.warn('Vector service connection failed:', { error: err });
  }

  try {
    const memoryRes = await fetch(`${MEMORY_SERVICE_URL}/health`);
    results.memory = memoryRes.ok;
  } catch (err) {
    logger.warn('Memory service connection failed:', { error: err });
  }

  try {
    const wmatrixRes = await fetch(`${WMATRIX_SERVICE_URL}/health`);
    results.wmatrix = wmatrixRes.ok;
  } catch (err) {
    logger.warn('W-Matrix service connection failed:', { error: err });
  }

  return results;
}
