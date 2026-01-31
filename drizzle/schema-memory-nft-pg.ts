/**
 * Memory NFT and Token Bound Account Schema
 */

import { pgTable, varchar, text, integer, bigint, timestamp, json, index } from "drizzle-orm/pg-core";

// ============================================================================
// Memory NFT Table
// ============================================================================

export const memoryNFTs = pgTable('memory_nfts', {
  id: varchar('id', { length: 255 }).primaryKey(),
  contractAddress: varchar('contract_address', { length: 42 }).notNull(),
  tokenId: varchar('token_id', { length: 78 }).notNull(),
  owner: varchar('owner', { length: 42 }).notNull(),
  tbaAddress: varchar('tba_address', { length: 42 }),
  
  // Metadata
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  memoryType: varchar('memory_type', { length: 50 }).notNull(), // 'kv-cache' | 'w-matrix' | 'reasoning-chain'
  
  // Quality metrics
  epsilon: varchar('epsilon', { length: 20 }), // Stored as string to preserve precision
  certification: varchar('certification', { length: 20 }), // 'platinum' | 'gold' | 'silver' | 'bronze'
  qualityGrade: varchar('quality_grade', { length: 20 }), // 'excellent' | 'good' | 'fair' | 'poor'
  
  // Asset references
  assetUrl: text('asset_url'), // S3 URL to memory data
  metadataUrl: text('metadata_url'), // IPFS URL to NFT metadata
  
  // Provenance (派生关系)
  parentNftId: varchar('parent_nft_id', { length: 255 }), // Parent memory NFT ID (null for original)
  derivationType: varchar('derivation_type', { length: 50 }), // 'fine-tune' | 'merge' | 'distill' | 'optimize'
  royaltyPercent: integer('royalty_percent').default(30), // Percentage of revenue shared with parent (default 30%)
  totalRoyaltiesPaid: varchar('total_royalties_paid', { length: 78 }).default('0'), // Total royalties paid to parent (in wei)
  
  // Marketplace
  price: varchar('price', { length: 78 }), // Price in wei
  downloads: integer('downloads').default(0).notNull(),
  
  // Timestamps
  mintedAt: timestamp('minted_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  contractTokenIdx: index('contract_token_idx').on(table.contractAddress, table.tokenId),
  ownerIdx: index('owner_idx').on(table.owner),
  tbaIdx: index('tba_idx').on(table.tbaAddress),
  memoryTypeIdx: index('memory_type_idx').on(table.memoryType),
}));

// ============================================================================
// Token Bound Account Table
// ============================================================================

export const tokenBoundAccounts = pgTable('token_bound_accounts', {
  id: integer('id').primaryKey().autoincrement(),
  address: varchar('address', { length: 42 }).notNull().unique(),
  
  // NFT info
  nftContract: varchar('nft_contract', { length: 42 }).notNull(),
  tokenId: varchar('token_id', { length: 78 }).notNull(),
  
  // Chain info
  chainId: integer('chain_id').notNull(),
  salt: integer('salt').notNull().default(0),
  
  // Deployment info
  implementationAddress: varchar('implementation_address', { length: 42 }).notNull(),
  deployed: integer('deployed').notNull().default(0), // 0 = not deployed, 1 = deployed
  deployTxHash: varchar('deploy_tx_hash', { length: 66 }),
  
  // Current state
  owner: varchar('owner', { length: 42 }).notNull(),
  balance: varchar('balance', { length: 78 }).default('0'), // ETH balance in wei
  
  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  deployedAt: timestamp('deployed_at'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  nftIdx: index('nft_idx').on(table.nftContract, table.tokenId),
  ownerIdx: index('owner_idx').on(table.owner),
  chainIdx: index('chain_idx').on(table.chainId),
}));

// ============================================================================
// TBA Transaction History
// ============================================================================

export const tbaTransactions = pgTable('tba_transactions', {
  id: integer('id').primaryKey().autoincrement(),
  tbaAddress: varchar('tba_address', { length: 42 }).notNull(),
  
  // Transaction details
  to: varchar('to', { length: 42 }).notNull(),
  value: varchar('value', { length: 78 }).notNull(), // Wei
  data: text('data'),
  
  // Execution status
  executed: integer('executed').notNull().default(0),
  txHash: varchar('tx_hash', { length: 66 }),
  blockNumber: bigint('block_number', { mode: 'number' }),
  gasUsed: varchar('gas_used', { length: 78 }),
  
  // Metadata
  description: text('description'),
  transactionType: varchar('transaction_type', { length: 50 }), // 'royalty', 'transfer', 'interact'
  
  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  executedAt: timestamp('executed_at'),
}, (table) => ({
  tbaIdx: index('tba_idx').on(table.tbaAddress),
  executedIdx: index('executed_idx').on(table.executed),
  typeIdx: index('type_idx').on(table.transactionType),
}));

// ============================================================================
// Memory Provenance (Family Tree)
// ============================================================================

export const memoryProvenance = pgTable('memory_provenance', {
  id: integer('id').primaryKey().autoincrement(),
  
  // Child memory (derived)
  childNftId: varchar('child_nft_id', { length: 255 }).notNull(),
  
  // Parent memory (source)
  parentNftId: varchar('parent_nft_id', { length: 255 }).notNull(),
  
  // Derivation details
  derivationType: varchar('derivation_type', { length: 50 }).notNull(), // 'fine-tune', 'merge', 'compress', 'extend'
  contributionPercent: integer('contribution_percent').notNull(), // 0-100
  
  // Royalty info
  royaltyPercent: integer('royalty_percent').notNull(), // Percentage of child's revenue
  totalRoyaltiesPaid: varchar('total_royalties_paid', { length: 78 }).default('0'), // Wei
  
  // Metadata
  metadata: json('metadata'), // Additional derivation details
  
  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  childIdx: index('child_idx').on(table.childNftId),
  parentIdx: index('parent_idx').on(table.parentNftId),
  derivationIdx: index('derivation_idx').on(table.derivationType),
}));

// ============================================================================
// Agent Credit Score
// ============================================================================

export const agentCreditScores = pgTable('agent_credit_scores', {
  id: integer('id').primaryKey().autoincrement(),
  
  // Agent identity
  agentAddress: varchar('agent_address', { length: 42 }).notNull().unique(),
  agentName: varchar('agent_name', { length: 255 }),
  
  // Credit metrics
  creditScore: integer('credit_score').notNull().default(500), // 300-850 (like FICO)
  creditGrade: varchar('credit_grade', { length: 1 }).notNull().default('C'), // S, A, B, C, D
  
  // Quality metrics
  avgEpsilon: varchar('avg_epsilon', { length: 20 }), // Average alignment loss
  totalMemoriesCreated: integer('total_memories_created').notNull().default(0),
  totalMemoriesSold: integer('total_memories_sold').notNull().default(0),
  totalRevenue: varchar('total_revenue', { length: 78 }).default('0'), // Wei
  
  // Quality coefficient (PID-controlled)
  qualityCoefficient: varchar('quality_coefficient', { length: 20 }).default('1.0'), // k parameter
  
  // Reputation
  positiveReviews: integer('positive_reviews').notNull().default(0),
  negativeReviews: integer('negative_reviews').notNull().default(0),
  
  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  lastActivityAt: timestamp('last_activity_at'),
}, (table) => ({
  addressIdx: index('address_idx').on(table.agentAddress),
  gradeIdx: index('grade_idx').on(table.creditGrade),
  scoreIdx: index('score_idx').on(table.creditScore),
}));

// ============================================================================
// Credit Score History
// ============================================================================

export const creditScoreHistory = pgTable('credit_score_history', {
  id: integer('id').primaryKey().autoincrement(),
  
  agentAddress: varchar('agent_address', { length: 42 }).notNull(),
  
  // Score change
  previousScore: integer('previous_score').notNull(),
  newScore: integer('new_score').notNull(),
  scoreDelta: integer('score_delta').notNull(),
  
  // Reason
  reason: varchar('reason', { length: 255 }).notNull(), // 'memory_sold', 'poor_quality', 'good_review'
  relatedNftId: varchar('related_nft_id', { length: 255 }),
  
  // Timestamp
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  agentIdx: index('agent_idx').on(table.agentAddress),
  createdIdx: index('created_idx').on(table.createdAt),
}));
