/**
 * Memory Provenance System
 * 
 * Tracks the "family tree" of memories - how memories are derived,
 * merged, or extended from other memories. Implements automatic
 * royalty distribution to parent memories.
 * 
 * Key Features:
 * - Derivation tracking (fine-tune, merge, compress, extend)
 * - Contribution percentage calculation
 * - Automatic royalty distribution
 * - Family tree visualization
 * - Multi-generation royalty splits
 */

// ============================================================================
// Types
// ============================================================================

export type DerivationType = 'fine-tune' | 'merge' | 'compress' | 'extend' | 'transfer-learn';

export interface MemoryNode {
  nftId: string;
  name: string;
  owner: string;
  tbaAddress?: string;
  epsilon?: number;
  certification?: string;
  createdAt: Date;
}

export interface ProvenanceEdge {
  id: number;
  childNftId: string;
  parentNftId: string;
  derivationType: DerivationType;
  contributionPercent: number; // 0-100
  royaltyPercent: number; // Percentage of child's revenue
  totalRoyaltiesPaid: bigint; // Wei
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface FamilyTree {
  root: MemoryNode;
  children: FamilyTreeNode[];
  totalDescendants: number;
  totalRoyaltiesEarned: bigint;
}

export interface FamilyTreeNode {
  node: MemoryNode;
  edge: ProvenanceEdge;
  children: FamilyTreeNode[];
}

export interface RoyaltyDistribution {
  recipientNftId: string;
  recipientTBA: string;
  amount: bigint;
  percentage: number;
  generation: number; // 1 = direct parent, 2 = grandparent, etc.
}

// ============================================================================
// Provenance Tracker
// ============================================================================

export class ProvenanceTracker {
  private provenanceMap: Map<string, ProvenanceEdge[]>; // childNftId -> edges
  private reverseMap: Map<string, ProvenanceEdge[]>; // parentNftId -> edges
  
  constructor() {
    this.provenanceMap = new Map();
    this.reverseMap = new Map();
  }
  
  /**
   * Record a new derivation relationship
   */
  addDerivation(edge: Omit<ProvenanceEdge, 'id' | 'totalRoyaltiesPaid' | 'createdAt'>): ProvenanceEdge {
    const fullEdge: ProvenanceEdge = {
      ...edge,
      id: Date.now(), // In production, this would be DB auto-increment
      totalRoyaltiesPaid: 0n,
      createdAt: new Date(),
    };
    
    // Validate contribution percentage
    if (edge.contributionPercent < 0 || edge.contributionPercent > 100) {
      throw new Error('Contribution percentage must be between 0 and 100');
    }
    
    // Add to maps
    const childEdges = this.provenanceMap.get(edge.childNftId) || [];
    childEdges.push(fullEdge);
    this.provenanceMap.set(edge.childNftId, childEdges);
    
    const parentEdges = this.reverseMap.get(edge.parentNftId) || [];
    parentEdges.push(fullEdge);
    this.reverseMap.set(edge.parentNftId, parentEdges);
    
    return fullEdge;
  }
  
  /**
   * Get all parents of a memory
   */
  getParents(nftId: string): ProvenanceEdge[] {
    return this.provenanceMap.get(nftId) || [];
  }
  
  /**
   * Get all children of a memory
   */
  getChildren(nftId: string): ProvenanceEdge[] {
    return this.reverseMap.get(nftId) || [];
  }
  
  /**
   * Get full ancestry (all ancestors)
   */
  getAncestry(nftId: string): ProvenanceEdge[] {
    const ancestry: ProvenanceEdge[] = [];
    const visited = new Set<string>();
    
    const traverse = (currentId: string) => {
      if (visited.has(currentId)) return;
      visited.add(currentId);
      
      const parents = this.getParents(currentId);
      for (const edge of parents) {
        ancestry.push(edge);
        traverse(edge.parentNftId);
      }
    };
    
    traverse(nftId);
    return ancestry;
  }
  
  /**
   * Get full descendants (all children recursively)
   */
  getDescendants(nftId: string): ProvenanceEdge[] {
    const descendants: ProvenanceEdge[] = [];
    const visited = new Set<string>();
    
    const traverse = (currentId: string) => {
      if (visited.has(currentId)) return;
      visited.add(currentId);
      
      const children = this.getChildren(currentId);
      for (const edge of children) {
        descendants.push(edge);
        traverse(edge.childNftId);
      }
    };
    
    traverse(nftId);
    return descendants;
  }
  
  /**
   * Check if memory A is an ancestor of memory B
   */
  isAncestor(ancestorId: string, descendantId: string): boolean {
    const ancestry = this.getAncestry(descendantId);
    return ancestry.some(edge => edge.parentNftId === ancestorId);
  }
  
  /**
   * Calculate total contribution of a parent to a child (including indirect)
   */
  calculateTotalContribution(parentId: string, childId: string): number {
    const ancestry = this.getAncestry(childId);
    
    let totalContribution = 0;
    for (const edge of ancestry) {
      if (edge.parentNftId === parentId) {
        totalContribution += edge.contributionPercent;
      }
    }
    
    return Math.min(totalContribution, 100);
  }
}

// ============================================================================
// Royalty Calculator
// ============================================================================

export class RoyaltyCalculator {
  private tracker: ProvenanceTracker;
  
  constructor(tracker: ProvenanceTracker) {
    this.tracker = tracker;
  }
  
  /**
   * Calculate royalty distribution for a sale
   * 
   * @param childNftId - The memory being sold
   * @param saleAmount - Sale amount in wei
   * @param maxGenerations - Maximum generations to distribute royalties (default: 3)
   * @returns Array of royalty distributions
   */
  calculateRoyalties(
    childNftId: string,
    saleAmount: bigint,
    maxGenerations: number = 3
  ): RoyaltyDistribution[] {
    const distributions: RoyaltyDistribution[] = [];
    const visited = new Set<string>();
    
    const traverse = (currentId: string, remainingAmount: bigint, generation: number) => {
      if (generation > maxGenerations || remainingAmount === 0n) return;
      if (visited.has(currentId)) return;
      visited.add(currentId);
      
      const parents = this.tracker.getParents(currentId);
      
      for (const edge of parents) {
        // Calculate royalty amount
        const royaltyAmount = (remainingAmount * BigInt(edge.royaltyPercent)) / 100n;
        
        if (royaltyAmount > 0n) {
          distributions.push({
            recipientNftId: edge.parentNftId,
            recipientTBA: '', // Would be filled from database
            amount: royaltyAmount,
            percentage: edge.royaltyPercent,
            generation,
          });
          
          // Recursively distribute to grandparents with remaining amount
          const remaining = remainingAmount - royaltyAmount;
          traverse(edge.parentNftId, remaining, generation + 1);
        }
      }
    };
    
    traverse(childNftId, saleAmount, 1);
    
    return distributions;
  }
  
  /**
   * Calculate recommended royalty percentage based on contribution
   */
  static calculateRecommendedRoyalty(contributionPercent: number): number {
    // Tiered royalty structure
    if (contributionPercent >= 80) return 20; // 20% royalty for major contributions
    if (contributionPercent >= 50) return 15; // 15% for significant contributions
    if (contributionPercent >= 30) return 10; // 10% for moderate contributions
    if (contributionPercent >= 10) return 5;  // 5% for minor contributions
    return 2; // 2% minimum royalty
  }
  
  /**
   * Validate royalty distribution (total should not exceed 100%)
   */
  static validateRoyalties(edges: Pick<ProvenanceEdge, 'royaltyPercent'>[]): boolean {
    const totalRoyalty = edges.reduce((sum, edge) => sum + edge.royaltyPercent, 0);
    return totalRoyalty <= 100;
  }
}

// ============================================================================
// Family Tree Builder
// ============================================================================

export class FamilyTreeBuilder {
  private tracker: ProvenanceTracker;
  private memoryNodes: Map<string, MemoryNode>;
  
  constructor(tracker: ProvenanceTracker) {
    this.tracker = tracker;
    this.memoryNodes = new Map();
  }
  
  /**
   * Register a memory node
   */
  registerNode(node: MemoryNode): void {
    this.memoryNodes.set(node.nftId, node);
  }
  
  /**
   * Build family tree starting from a root memory
   */
  buildTree(rootNftId: string): FamilyTree {
    const rootNode = this.memoryNodes.get(rootNftId);
    if (!rootNode) {
      throw new Error(`Memory node ${rootNftId} not found`);
    }
    
    let totalDescendants = 0;
    let totalRoyalties = 0n;
    
    const buildNode = (nftId: string): FamilyTreeNode[] => {
      const children = this.tracker.getChildren(nftId);
      
      return children.map(edge => {
        const childNode = this.memoryNodes.get(edge.childNftId);
        if (!childNode) {
          throw new Error(`Memory node ${edge.childNftId} not found`);
        }
        
        totalDescendants++;
        totalRoyalties += edge.totalRoyaltiesPaid;
        
        return {
          node: childNode,
          edge,
          children: buildNode(edge.childNftId),
        };
      });
    };
    
    return {
      root: rootNode,
      children: buildNode(rootNftId),
      totalDescendants,
      totalRoyaltiesEarned: totalRoyalties,
    };
  }
  
  /**
   * Get lineage path from ancestor to descendant
   */
  getLineage(ancestorId: string, descendantId: string): MemoryNode[] {
    const path: MemoryNode[] = [];
    const visited = new Set<string>();
    
    const traverse = (currentId: string): boolean => {
      if (visited.has(currentId)) return false;
      visited.add(currentId);
      
      const node = this.memoryNodes.get(currentId);
      if (!node) return false;
      
      path.push(node);
      
      if (currentId === descendantId) return true;
      
      const children = this.tracker.getChildren(currentId);
      for (const edge of children) {
        if (traverse(edge.childNftId)) return true;
      }
      
      path.pop();
      return false;
    };
    
    traverse(ancestorId);
    return path;
  }
  
  /**
   * Export family tree as DOT format (for Graphviz visualization)
   */
  exportDOT(rootNftId: string): string {
    const tree = this.buildTree(rootNftId);
    const lines: string[] = ['digraph FamilyTree {'];
    lines.push('  rankdir=TB;');
    lines.push('  node [shape=box, style=rounded];');
    
    const traverse = (node: FamilyTreeNode) => {
      const childLabel = `${node.node.name}\\n${node.node.certification || 'N/A'}`;
      lines.push(`  "${node.edge.parentNftId}" -> "${node.node.nftId}" [label="${node.edge.derivationType}\\n${node.edge.contributionPercent}%"];`);
      lines.push(`  "${node.node.nftId}" [label="${childLabel}"];`);
      
      for (const child of node.children) {
        traverse(child);
      }
    };
    
    // Root node
    lines.push(`  "${tree.root.nftId}" [label="${tree.root.name}\\n${tree.root.certification || 'N/A'}"];`);
    
    // Traverse children
    for (const child of tree.children) {
      traverse(child);
    }
    
    lines.push('}');
    return lines.join('\n');
  }
}

// ============================================================================
// Provenance Validator
// ============================================================================

export class ProvenanceValidator {
  /**
   * Validate derivation claim
   * 
   * Checks if a claimed derivation is legitimate based on:
   * - Epsilon similarity
   * - Dimension compatibility
   * - Temporal consistency
   */
  static validateDerivation(
    parent: MemoryNode,
    child: MemoryNode,
    derivationType: DerivationType,
    contributionPercent: number
  ): { valid: boolean; reason?: string } {
    // Check temporal consistency
    if (child.createdAt < parent.createdAt) {
      return {
        valid: false,
        reason: 'Child memory cannot be created before parent',
      };
    }
    
    // Check contribution percentage
    if (contributionPercent < 0 || contributionPercent > 100) {
      return {
        valid: false,
        reason: 'Contribution percentage must be between 0 and 100',
      };
    }
    
    // Type-specific validation
    switch (derivationType) {
      case 'fine-tune':
        // Fine-tuning should maintain similar quality
        if (parent.epsilon && child.epsilon && child.epsilon > parent.epsilon * 2) {
          return {
            valid: false,
            reason: 'Fine-tuned memory has significantly worse quality than parent',
          };
        }
        break;
      
      case 'merge':
        // Merging requires high contribution from both parents
        if (contributionPercent < 30) {
          return {
            valid: false,
            reason: 'Merge derivation requires at least 30% contribution',
          };
        }
        break;
      
      case 'compress':
        // Compression should reduce size but maintain quality
        if (parent.epsilon && child.epsilon && child.epsilon > parent.epsilon * 1.5) {
          return {
            valid: false,
            reason: 'Compressed memory has significantly worse quality than parent',
          };
        }
        break;
    }
    
    return { valid: true };
  }
  
  /**
   * Detect circular dependencies
   */
  static detectCircularDependency(
    tracker: ProvenanceTracker,
    childNftId: string,
    parentNftId: string
  ): boolean {
    // Check if parent is already a descendant of child
    return tracker.isAncestor(childNftId, parentNftId);
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createProvenanceTracker(): ProvenanceTracker {
  return new ProvenanceTracker();
}

export function createRoyaltyCalculator(tracker: ProvenanceTracker): RoyaltyCalculator {
  return new RoyaltyCalculator(tracker);
}

export function createFamilyTreeBuilder(tracker: ProvenanceTracker): FamilyTreeBuilder {
  return new FamilyTreeBuilder(tracker);
}
