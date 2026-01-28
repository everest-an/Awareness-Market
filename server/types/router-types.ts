/**
 * Type definitions for router handlers
 * Replaces 'any' types with proper TypeScript types
 */

import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";

// Request type from tRPC context
export type TrpcRequest = CreateExpressContextOptions["req"];

// Database mutation result types
export interface InsertResult {
  insertId: number | string;
  affectedRows?: number;
}

// Update types for partial record updates
export interface VectorUpdateData {
  title?: string;
  description?: string;
  basePrice?: string;
  status?: 'draft' | 'active' | 'inactive';
}

export interface ReviewUpdateData {
  rating?: number;
  comment?: string;
}

export interface UserPreferencesUpdateData {
  preferredCategories?: string; // JSON string
  priceRange?: string; // JSON string
}

export interface BlogPostData {
  title?: string;
  slug?: string;
  excerpt?: string;
  content?: string;
  coverImage?: string;
  tags?: string; // JSON string
  category?: string;
  status?: 'draft' | 'published' | 'archived';
  authorId?: number;
  publishedAt?: Date | null;
}

// Review types
export interface ReviewRecord {
  id: number;
  vectorId: number;
  userId: number;
  rating: number;
  comment?: string | null;
  isVerifiedPurchase: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Transaction types with proper discriminated union
export interface TransactionRecord {
  id: number;
  buyerId: number;
  vectorId: number;
  amount: string;
  platformFee: string;
  creatorEarnings: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  transactionType: 'one-time' | 'subscription';
  createdAt: Date;
  updatedAt: Date;
}

// KV-Cache data types
export type KVCacheArray = number[] | number[][] | number[][][];

export interface KVCacheKeys extends Array<KVCacheArray> {}
export interface KVCacheValues extends Array<KVCacheArray> {}
export interface AttentionMask extends Array<KVCacheArray> {}
export interface PositionEncodings extends Array<KVCacheArray> {}

// Rate limit configuration
export interface RateLimitConfig {
  requestsPerHour?: number;
  requestsPerDay?: number;
  requestsPerMonth?: number;
  burstLimit?: number;
  isEnabled?: boolean;
}

// Memory package types
export interface MemoryPackage {
  id: number | string;
  name?: string;
  price?: number;
  total_transactions?: number;
  average_rating?: number;
  [key: string]: unknown; // Allow additional properties
}

export interface MemoryPackagesResponse {
  packages?: MemoryPackage[];
  data?: MemoryPackage[];
  [key: string]: unknown; // Allow additional properties
}
