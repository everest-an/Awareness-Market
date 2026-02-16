/**
 * Memory Schema Types (Awareness Memory Schema Standard - AMSS v1.0)
 *
 * Universal type definitions for AI memory management.
 * These types align with the database schema defined in Prisma.
 */

/**
 * Content types supported by the memory system
 */
export type ContentType = 'text' | 'code' | 'data' | 'image' | 'audio' | 'composite';

/**
 * Core memory entry interface
 */
export interface MemoryEntry {
  // Identity
  id: string; // UUID
  org_id: string;
  namespace: string;

  // Content
  content_type: ContentType;
  content: string;
  embedding?: number[]; // 1536-dimensional vector (OpenAI text-embedding-3-small)
  metadata?: Record<string, any>;

  // Quality Signals
  confidence: number; // [0-1]
  reputation: number; // [0-100]
  usage_count: number;
  validation_count: number;

  // Versioning
  version: number;
  parent_id?: string | null;
  is_latest: boolean;

  // Lifecycle
  created_by: string;
  created_at: Date;
  updated_at: Date;
  accessed_at: Date;
  expires_at?: Date | null;

  // Decay
  decay_factor: number; // λ in e^(-λt)
  decay_checkpoint: Date;
}

/**
 * Memory score interface (pre-computed for performance)
 */
export interface MemoryScore {
  memory_id: string;
  base_score: number;
  decay_multiplier: number;
  final_score: number;
  last_calculated: Date;
}

/**
 * Memory policy interface (Phase B - Governance)
 */
export interface MemoryPolicy {
  id: string;
  org_id: string;
  namespace: string;
  policy_type: 'retention' | 'access' | 'conflict_resolution';
  rules: Record<string, any>;
  created_at: Date;
}

/**
 * Memory access log interface (Phase B - Audit trail)
 */
export interface MemoryAccessLog {
  id: string;
  memory_id: string;
  accessed_by: string;
  access_type: 'read' | 'write' | 'delete';
  accessed_at: Date;
}

/**
 * Query parameters for memory search
 */
export interface MemoryQueryParams {
  org_id: string;
  namespaces: string[]; // Array of namespaces to search
  query: string; // Natural language query
  limit?: number; // Max results (default: 10)
  min_confidence?: number; // Minimum confidence threshold (default: 0)
  min_score?: number; // Minimum final score threshold (default: 0)
  content_types?: ContentType[]; // Filter by content types
  created_after?: Date; // Filter by creation date
  created_before?: Date;
}

/**
 * Query result with score
 */
export interface MemoryQueryResult {
  memory: MemoryEntry;
  score: number;
  similarity?: number; // Cosine similarity to query
}

/**
 * Input for creating a new memory entry
 */
/**
 * v3 memory type classification (affects decay rate)
 */
export type MemoryType = 'episodic' | 'semantic' | 'strategic' | 'procedural';

/**
 * v3 memory pool layer
 */
export type PoolType = 'private' | 'domain' | 'global';

export interface CreateMemoryInput {
  org_id: string;
  namespace: string;
  content_type: ContentType;
  content: string;
  metadata?: Record<string, any>;
  confidence: number;
  created_by: string;
  expires_at?: Date;
  decay_factor?: number; // Optional, defaults based on content_type or memoryType

  // v3 additions
  memoryType?: MemoryType; // Overrides decay_factor with per-type lambda
  poolType?: PoolType; // Which pool layer (default: domain)
  departmentId?: number; // Organization department
  agentId?: string; // Creating agent
  evidence?: Array<{
    evidenceType: string;
    sourceUrl?: string;
    sourceDoi?: string;
    claimType?: string;
    assumptions?: string[];
    unit?: string;
    dimension?: string;
  }>;
  dependencies?: Array<{
    dependsOnMemoryId: string;
    dependencyType: 'assumes' | 'builds_on' | 'requires';
  }>;
}

/**
 * Input for updating a memory entry (creates new version)
 */
export interface UpdateMemoryInput {
  content?: string;
  metadata?: Record<string, any>;
  confidence?: number;
}

/**
 * Version tree node for memory versioning
 */
export interface MemoryVersionNode {
  memory: MemoryEntry;
  children: MemoryVersionNode[];
}

/**
 * Decay parameters by content type
 */
export const DECAY_FACTORS: Record<ContentType, number> = {
  text: 0.01, // ~70 days half-life
  code: 0.05, // ~14 days half-life
  data: 0.1, // ~7 days half-life
  image: 0.02, // ~35 days half-life
  audio: 0.02, // ~35 days half-life
  composite: 0.03, // ~23 days half-life
};

/**
 * Scoring weights (第1阶段: User-specified formula)
 *
 * Formula: score = (similarity*0.4 + log(usage+1)*0.2 + validation*0.2 + reputation*0.2) * time_decay
 *
 * Key: "similarity 只是 40%" - similarity is only 40%
 */
export const SCORING_WEIGHTS = {
  similarity: 0.4, // Similarity from vector search
  usage_log: 0.2, // log(usage_count + 1)
  validation: 0.2, // validation_count ratio
  reputation: 0.2, // reputation / 100
} as const;

/**
 * Namespace validation regex
 * Format: <org_id>/<scope>/<entity> (e.g., org-123/engineering/agent-x)
 */
export const NAMESPACE_REGEX = /^[a-z0-9-]+\/[a-z0-9-]+(\/[a-z0-9-]+)*$/;

/**
 * Validate namespace format
 */
export function validateNamespace(namespace: string): boolean {
  return NAMESPACE_REGEX.test(namespace);
}

/**
 * Extract org_id from namespace
 */
export function extractOrgIdFromNamespace(namespace: string): string | null {
  const parts = namespace.split('/');
  return parts.length > 0 ? parts[0] : null;
}

/**
 * Check if two namespaces overlap (one is parent of the other)
 */
export function namespacesOverlap(ns1: string, ns2: string): boolean {
  return ns1.startsWith(ns2 + '/') || ns2.startsWith(ns1 + '/') || ns1 === ns2;
}
