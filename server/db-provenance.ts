/**
 * Memory Provenance Database Queries
 * 
 * Recursive queries to build memory derivation family trees
 */

import { getDb } from './db';
import { memoryNFTs } from '../drizzle/schema-memory-nft';
import { eq } from 'drizzle-orm';

// ============================================================================
// Types
// ============================================================================

export interface MemoryNode {
  id: string;
  title: string;
  creator: string;
  createdAt: string;
  epsilon: number;
  price: number;
  downloads: number;
  royaltyShare: number;
  children?: MemoryNode[];
}

interface MemoryNFTRecord {
  id: string;
  name: string;
  owner: string;
  mintedAt: Date;
  epsilon: string | null;
  price: string | null;
  downloads: number;
  parentNftId: string | null;
  royaltyPercent: number | null;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate royalty share percentage for a node
 * @param depth - Depth in the tree (0 = root)
 * @param baseRoyalty - Base royalty percentage (default 30%)
 */
function calculateRoyaltyShare(depth: number, baseRoyalty: number = 30): number {
  if (depth === 0) return 100; // Root gets 100%
  
  // Each level gets baseRoyalty% of parent's share
  // Level 1: 30%
  // Level 2: 30% * 70% = 21%
  // Level 3: 30% * 70% * 70% = 14.7%
  let share = 100;
  for (let i = 0; i < depth; i++) {
    share = share * (100 - baseRoyalty) / 100;
  }
  
  return Math.round(share);
}

/**
 * Convert database record to MemoryNode
 */
function recordToNode(record: MemoryNFTRecord, depth: number = 0): MemoryNode {
  return {
    id: record.id,
    title: record.name,
    creator: record.owner.substring(0, 10) + '...',
    createdAt: record.mintedAt.toISOString().split('T')[0],
    epsilon: record.epsilon ? parseFloat(record.epsilon) : 0,
    price: record.price ? parseFloat(record.price) : 0,
    downloads: record.downloads,
    royaltyShare: calculateRoyaltyShare(depth, record.royaltyPercent || 30),
  };
}

// ============================================================================
// Main Query Function
// ============================================================================

/**
 * Build family tree for a memory NFT
 * @param memoryId - Root memory NFT ID
 * @returns Hierarchical tree structure
 */
export async function buildFamilyTree(memoryId: string): Promise<MemoryNode | null> {
  // Track visited nodes to prevent infinite loops
  const visited = new Set<string>();
  
  /**
   * Recursive helper to build tree
   */
  async function buildNode(id: string, depth: number = 0): Promise<MemoryNode | null> {
    // Prevent infinite loops
    if (visited.has(id)) {
      console.warn(`Circular reference detected: ${id}`);
      return null;
    }
    visited.add(id);
    
    // Prevent excessive depth (max 10 levels)
    if (depth > 10) {
      console.warn(`Max depth exceeded for memory: ${id}`);
      return null;
    }
    
    // Fetch memory from database
    const db = await getDb();
    if (!db) return null;
    
    const records = await db
      .select()
      .from(memoryNFTs)
      .where(eq(memoryNFTs.id, id))
      .limit(1);
    
    if (records.length === 0) {
      return null;
    }
    
    const record = records[0] as unknown as MemoryNFTRecord;
    const node = recordToNode(record, depth);
    
    // Find all children (memories that have this as parent)
    const childRecords = await db
      .select()
      .from(memoryNFTs)
      .where(eq(memoryNFTs.parentNftId, id));
    
    // Recursively build children
    if (childRecords.length > 0) {
      const childPromises = childRecords.map(child => 
        buildNode((child as unknown as MemoryNFTRecord).id, depth + 1)
      );
      
      const children = await Promise.all(childPromises);
      node.children = children.filter((c): c is MemoryNode => c !== null);
    }
    
    return node;
  }
  
  return buildNode(memoryId);
}

/**
 * Get all ancestors of a memory (parent, grandparent, etc.)
 */
export async function getAncestors(memoryId: string): Promise<MemoryNode[]> {
  const ancestors: MemoryNode[] = [];
  let currentId: string | null = memoryId;
  let depth = 0;
  
  while (currentId && depth < 10) {
    const db = await getDb();
    if (!db) break;
    
    const records = await db
      .select()
      .from(memoryNFTs)
      .where(eq(memoryNFTs.id, currentId))
      .limit(1);
    
    if (records.length === 0) break;
    
    const record = records[0] as unknown as MemoryNFTRecord;
    ancestors.push(recordToNode(record, depth));
    
    currentId = record.parentNftId;
    depth++;
  }
  
  return ancestors;
}

/**
 * Get all descendants of a memory (children, grandchildren, etc.)
 */
export async function getDescendants(memoryId: string): Promise<MemoryNode[]> {
  const descendants: MemoryNode[] = [];
  const visited = new Set<string>();
  
  async function traverse(id: string, depth: number = 0) {
    if (visited.has(id) || depth > 10) return;
    visited.add(id);
    
    const db = await getDb();
    if (!db) return;
    
    const childRecords = await db
      .select()
      .from(memoryNFTs)
      .where(eq(memoryNFTs.parentNftId, id));
    
    for (const child of childRecords) {
      const record = child as unknown as MemoryNFTRecord;
      descendants.push(recordToNode(record, depth + 1));
      await traverse(record.id, depth + 1);
    }
  }
  
  await traverse(memoryId);
  return descendants;
}

/**
 * Calculate total royalties owed to a memory's ancestors
 * @param salePrice - Sale price of the memory
 * @param memoryId - Memory being sold
 * @returns Array of {ancestorId, amount} royalty payments
 */
export async function calculateRoyaltyDistribution(
  salePrice: number,
  memoryId: string
): Promise<Array<{ ancestorId: string; amount: number; percentage: number }>> {
  const ancestors = await getAncestors(memoryId);
  const distribution: Array<{ ancestorId: string; amount: number; percentage: number }> = [];
  
  // Skip first ancestor (self)
  for (let i = 1; i < ancestors.length; i++) {
    const ancestor = ancestors[i];
    const db = await getDb();
    if (!db) continue;
    
    const records = await db
      .select()
      .from(memoryNFTs)
      .where(eq(memoryNFTs.id, ancestor.id))
      .limit(1);
    
    if (records.length === 0) continue;
    
    const record = records[0] as unknown as MemoryNFTRecord;
    const royaltyPercent = record.royaltyPercent || 30;
    
    // Calculate amount based on depth
    // Level 1 (immediate parent): 30% of sale price
    // Level 2 (grandparent): 30% of parent's 30% = 9%
    let percentage = royaltyPercent;
    for (let j = 1; j < i; j++) {
      percentage = percentage * (100 - royaltyPercent) / 100;
    }
    
    const amount = salePrice * percentage / 100;
    
    distribution.push({
      ancestorId: ancestor.id,
      amount,
      percentage,
    });
  }
  
  return distribution;
}
