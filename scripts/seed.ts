#!/usr/bin/env tsx
/**
 * Unified Seed Script for Awareness Network
 *
 * Uses Prisma Client with PostgreSQL (Supabase)
 *
 * Usage:
 *   npm run seed              # Run all seeders
 *   npm run seed -- --vectors # Seed only vectors
 *   npm run seed -- --users   # Seed only users
 *   npm run seed -- --packages # Seed only packages
 *   npm run seed -- --agents  # Seed only agents
 *   npm run seed -- --clean   # Clear all data first
 */

import { PrismaClient, UserRole } from '@prisma/client';
import * as dotenv from 'dotenv';
import { nanoid } from 'nanoid';

dotenv.config();

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// ============================================================================
// Configuration
// ============================================================================

const args = process.argv.slice(2);
const shouldClean = args.includes('--clean');
const seedVectors = args.length === 0 || args.includes('--vectors');
const seedUsers = args.length === 0 || args.includes('--users');
const seedPackages = args.length === 0 || args.includes('--packages');
const seedAgents = args.length === 0 || args.includes('--agents');
const seedMemoryNFTs = args.length === 0 || args.includes('--memory-nfts');

// ============================================================================
// Sample Data
// ============================================================================

const SAMPLE_USERS = [
  { name: 'Alice Chen', email: 'alice@example.com', role: UserRole.creator },
  { name: 'Bob Smith', email: 'bob@example.com', role: UserRole.creator },
  { name: 'Carol Wang', email: 'carol@example.com', role: UserRole.consumer },
  { name: 'David Lee', email: 'david@example.com', role: UserRole.consumer },
  { name: 'AI Agent Alpha', email: 'agent-alpha@awareness.market', role: UserRole.creator },
];

const SAMPLE_VECTORS = [
  {
    title: 'Solidity Gas Optimization Patterns',
    description: 'Advanced techniques for reducing gas costs in smart contracts. Includes storage optimization, loop unrolling, and memory management patterns.',
    category: 'Smart Contracts',
    basePrice: '29.99',
    sourceModel: 'gpt-4',
  },
  {
    title: 'ZK-SNARK Circuit Design',
    description: 'Efficient circuit construction for zero-knowledge proofs. Covers R1CS constraints, witness generation, and proof optimization.',
    category: 'Cryptography',
    basePrice: '49.99',
    sourceModel: 'claude-3-opus',
  },
  {
    title: 'Transformer Attention Mechanism',
    description: 'Deep understanding of multi-head attention in neural networks. Includes self-attention, cross-attention, and efficient attention variants.',
    category: 'AI/ML',
    basePrice: '39.99',
    sourceModel: 'gpt-4-turbo',
  },
  {
    title: 'DeFi Arbitrage Strategies',
    description: 'Flash loan arbitrage and MEV extraction techniques. Covers sandwich attacks, liquidation bots, and cross-DEX arbitrage.',
    category: 'DeFi',
    basePrice: '79.99',
    sourceModel: 'deepseek-v3',
  },
  {
    title: 'Rust Systems Programming',
    description: 'Memory-safe systems programming patterns in Rust. Ownership, borrowing, lifetimes, and async programming.',
    category: 'Programming',
    basePrice: '34.99',
    sourceModel: 'claude-3.5-sonnet',
  },
];

const SAMPLE_VECTOR_PACKAGES = [
  {
    name: 'NLP Embedding Suite',
    description: 'High-quality text embeddings for semantic search and similarity matching. Trained on diverse multilingual corpus.',
    sourceModel: 'gpt-4',
    targetModel: 'claude-3-opus',
    category: 'nlp',
    price: '19.99',
    dimension: 1536,
  },
  {
    name: 'Code Understanding Vectors',
    description: 'Specialized embeddings for code comprehension. Supports 20+ programming languages with syntax-aware encoding.',
    sourceModel: 'deepseek-coder-33b',
    targetModel: 'gpt-4-turbo',
    category: 'code',
    price: '29.99',
    dimension: 2048,
  },
];

const SAMPLE_MEMORY_PACKAGES = [
  {
    name: 'GPT-4 Technical Discussion',
    description: 'KV-Cache from a deep technical discussion about distributed systems. Includes context about consensus algorithms and fault tolerance.',
    sourceModel: 'gpt-4',
    targetModel: 'claude-3-opus',
    tokenCount: 4096,
    compressionRatio: '0.75',
    contextDescription: 'Technical discussion about distributed systems architecture',
    price: '9.99',
  },
  {
    name: 'Claude Code Review Session',
    description: 'Memory from an extensive code review session. Contains patterns for identifying bugs and suggesting improvements.',
    sourceModel: 'claude-3-opus',
    targetModel: 'gpt-4-turbo',
    tokenCount: 8192,
    compressionRatio: '0.68',
    contextDescription: 'Code review session for a TypeScript backend project',
    price: '14.99',
  },
];

const SAMPLE_CHAIN_PACKAGES = [
  {
    name: 'Mathematical Proof Chain',
    description: 'Step-by-step reasoning chain for mathematical proofs. Demonstrates formal logic and proof techniques.',
    sourceModel: 'o1',
    targetModel: 'gpt-4-turbo',
    problemType: 'mathematical-proof',
    solutionQuality: '0.95',
    stepCount: 12,
    price: '24.99',
  },
  {
    name: 'System Design Reasoning',
    description: 'Reasoning chain for system design interviews. Covers scalability, reliability, and performance considerations.',
    sourceModel: 'claude-3-opus',
    targetModel: 'gpt-4',
    problemType: 'system-design',
    solutionQuality: '0.92',
    stepCount: 8,
    price: '19.99',
  },
];

// Memory NFT seed data for provenance tracking
const SAMPLE_MEMORY_NFTS = [
  // Genesis (root) memory - no parent
  {
    id: 'genesis-kv-cache-001',
    name: 'Genesis: GPT-4 Reasoning Patterns',
    description: 'Original KV-Cache capturing advanced reasoning patterns from GPT-4. Foundation for derivative memories.',
    memoryType: 'kv-cache',
    epsilon: '2.3',
    certification: 'platinum',
    qualityGrade: 'excellent',
    price: '99.99',
    downloads: 156,
    royaltyPercent: 30,
    parentNftId: null,
    derivationType: null,
  },
  // First-generation derivative
  {
    id: 'derived-kv-cache-001',
    name: 'Fine-tuned: Legal Reasoning',
    description: 'Derived from Genesis patterns, optimized for legal document analysis and contract review.',
    memoryType: 'kv-cache',
    epsilon: '2.8',
    certification: 'gold',
    qualityGrade: 'excellent',
    price: '79.99',
    downloads: 89,
    royaltyPercent: 30,
    parentNftId: 'genesis-kv-cache-001',
    derivationType: 'fine-tune',
  },
  // Second first-gen derivative (sibling)
  {
    id: 'derived-kv-cache-002',
    name: 'Merged: Medical + Reasoning',
    description: 'Merge of Genesis reasoning with medical knowledge base. Specialized for healthcare AI.',
    memoryType: 'kv-cache',
    epsilon: '3.1',
    certification: 'gold',
    qualityGrade: 'good',
    price: '89.99',
    downloads: 67,
    royaltyPercent: 25,
    parentNftId: 'genesis-kv-cache-001',
    derivationType: 'merge',
  },
  // Second-generation derivative (child of first derivative)
  {
    id: 'derived-kv-cache-003',
    name: 'Distilled: Contract Analysis',
    description: 'Distilled version of Legal Reasoning memory. Smaller footprint, optimized for contract-specific tasks.',
    memoryType: 'kv-cache',
    epsilon: '3.4',
    certification: 'silver',
    qualityGrade: 'good',
    price: '49.99',
    downloads: 234,
    royaltyPercent: 30,
    parentNftId: 'derived-kv-cache-001',
    derivationType: 'distill',
  },
  // Another genesis memory (different root)
  {
    id: 'genesis-w-matrix-001',
    name: 'Genesis: Cross-Model Alignment W-Matrix',
    description: 'Original W-Matrix for aligning representations between GPT-4 and Claude models.',
    memoryType: 'w-matrix',
    epsilon: '1.9',
    certification: 'platinum',
    qualityGrade: 'excellent',
    price: '149.99',
    downloads: 312,
    royaltyPercent: 35,
    parentNftId: null,
    derivationType: null,
  },
  // Derivative of W-matrix
  {
    id: 'derived-w-matrix-001',
    name: 'Optimized: Fast Alignment Matrix',
    description: 'Optimized version of cross-model alignment. 3x faster inference with minimal quality loss.',
    memoryType: 'w-matrix',
    epsilon: '2.5',
    certification: 'gold',
    qualityGrade: 'excellent',
    price: '119.99',
    downloads: 178,
    royaltyPercent: 30,
    parentNftId: 'genesis-w-matrix-001',
    derivationType: 'optimize',
  },
  // Reasoning chain memory
  {
    id: 'genesis-chain-001',
    name: 'Genesis: Mathematical Proof Chain',
    description: 'Complete reasoning chain for mathematical theorem proving. Includes step-by-step derivations.',
    memoryType: 'reasoning-chain',
    epsilon: '2.1',
    certification: 'platinum',
    qualityGrade: 'excellent',
    price: '79.99',
    downloads: 445,
    royaltyPercent: 30,
    parentNftId: null,
    derivationType: null,
  },
  // Third-generation derivative (deeper in the tree)
  {
    id: 'derived-kv-cache-004',
    name: 'Micro: Quick Contract Check',
    description: 'Ultra-compact derivative of Contract Analysis. For rapid preliminary contract screening.',
    memoryType: 'kv-cache',
    epsilon: '4.2',
    certification: 'bronze',
    qualityGrade: 'fair',
    price: '19.99',
    downloads: 567,
    royaltyPercent: 25,
    parentNftId: 'derived-kv-cache-003',
    derivationType: 'distill',
  },
];

// ============================================================================
// Seed Functions
// ============================================================================

async function seedUsersData(): Promise<number[]> {
  console.log('\n📦 Seeding users...');
  const userIds: number[] = [];

  for (const user of SAMPLE_USERS) {
    const existingUser = await prisma.user.findFirst({
      where: { email: user.email },
    });

    if (existingUser) {
      console.log(`  ⏭️  ${user.name} (already exists)`);
      userIds.push(existingUser.id);
      continue;
    }

    const newUser = await prisma.user.create({
      data: {
        openId: `seed_${nanoid(12)}`,
        name: user.name,
        email: user.email,
        loginMethod: 'email',
        role: user.role,
        lastSignedIn: new Date(),
      },
    });
    userIds.push(newUser.id);
    console.log(`  ✓ ${user.name} (${user.role})`);
  }

  console.log(`  Total: ${userIds.length} users`);
  return userIds;
}

async function seedVectorsData(creatorId: number) {
  console.log('\n📦 Seeding latent vectors...');

  for (const vector of SAMPLE_VECTORS) {
    const existingVector = await prisma.latentVector.findFirst({
      where: { title: vector.title },
    });

    if (existingVector) {
      console.log(`  ⏭️  ${vector.title} (already exists)`);
      continue;
    }

    await prisma.latentVector.create({
      data: {
        creatorId,
        title: vector.title,
        description: vector.description,
        category: vector.category,
        basePrice: parseFloat(vector.basePrice),
        vectorFileKey: `vectors/${nanoid(16)}.bin`,
        vectorFileUrl: `https://awareness-storage.s3.amazonaws.com/vectors/${nanoid(16)}.bin`,
        modelArchitecture: vector.sourceModel,
        vectorDimension: 8192,
        status: 'active',
      },
    });
    console.log(`  ✓ ${vector.title}`);
  }

  console.log(`  Total: ${SAMPLE_VECTORS.length} vectors`);
}

async function seedPackagesData(creatorId: number) {
  console.log('\n📦 Seeding vector packages...');
  for (const pkg of SAMPLE_VECTOR_PACKAGES) {
    const packageId = `vpkg_${nanoid(12)}`;

    const existingPkg = await prisma.vectorPackage.findFirst({
      where: { name: pkg.name },
    });

    if (existingPkg) {
      console.log(`  ⏭️  ${pkg.name} (already exists)`);
      continue;
    }

    await prisma.vectorPackage.create({
      data: {
        packageId,
        userId: creatorId,
        name: pkg.name,
        description: pkg.description,
        sourceModel: pkg.sourceModel,
        targetModel: pkg.targetModel,
        category: pkg.category,
        price: parseFloat(pkg.price),
        dimension: pkg.dimension,
        epsilon: 0.05,
        informationRetention: 0.95,
        packageUrl: `https://awareness-storage.s3.amazonaws.com/packages/${packageId}.vectorpkg`,
        vectorUrl: `https://awareness-storage.s3.amazonaws.com/packages/${packageId}/vector.json`,
        wMatrixUrl: `https://awareness-storage.s3.amazonaws.com/packages/${packageId}/w_matrix.json`,
        status: 'active',
      },
    });
    console.log(`  ✓ ${pkg.name}`);
  }

  console.log('\n📦 Seeding memory packages...');
  for (const pkg of SAMPLE_MEMORY_PACKAGES) {
    const packageId = `mpkg_${nanoid(12)}`;

    const existingPkg = await prisma.memoryPackage.findFirst({
      where: { name: pkg.name },
    });

    if (existingPkg) {
      console.log(`  ⏭️  ${pkg.name} (already exists)`);
      continue;
    }

    await prisma.memoryPackage.create({
      data: {
        packageId,
        userId: creatorId,
        name: pkg.name,
        description: pkg.description,
        sourceModel: pkg.sourceModel,
        targetModel: pkg.targetModel,
        tokenCount: pkg.tokenCount,
        compressionRatio: parseFloat(pkg.compressionRatio),
        contextDescription: pkg.contextDescription,
        price: parseFloat(pkg.price),
        epsilon: 0.05,
        informationRetention: 0.95,
        packageUrl: `https://awareness-storage.s3.amazonaws.com/packages/${packageId}.memorypkg`,
        kvCacheUrl: `https://awareness-storage.s3.amazonaws.com/packages/${packageId}/kv_cache.json`,
        wMatrixUrl: `https://awareness-storage.s3.amazonaws.com/packages/${packageId}/w_matrix.json`,
        status: 'active',
      },
    });
    console.log(`  ✓ ${pkg.name}`);
  }

  console.log('\n📦 Seeding chain packages...');
  for (const pkg of SAMPLE_CHAIN_PACKAGES) {
    const packageId = `cpkg_${nanoid(12)}`;

    const existingPkg = await prisma.chainPackage.findFirst({
      where: { name: pkg.name },
    });

    if (existingPkg) {
      console.log(`  ⏭️  ${pkg.name} (already exists)`);
      continue;
    }

    await prisma.chainPackage.create({
      data: {
        packageId,
        userId: creatorId,
        name: pkg.name,
        description: pkg.description,
        sourceModel: pkg.sourceModel,
        targetModel: pkg.targetModel,
        problemType: pkg.problemType,
        solutionQuality: parseFloat(pkg.solutionQuality),
        stepCount: pkg.stepCount,
        price: parseFloat(pkg.price),
        epsilon: 0.05,
        informationRetention: 0.95,
        packageUrl: `https://awareness-storage.s3.amazonaws.com/packages/${packageId}.chainpkg`,
        chainUrl: `https://awareness-storage.s3.amazonaws.com/packages/${packageId}/chain.json`,
        wMatrixUrl: `https://awareness-storage.s3.amazonaws.com/packages/${packageId}/w_matrix.json`,
        status: 'active',
      },
    });
    console.log(`  ✓ ${pkg.name}`);
  }

  const total = SAMPLE_VECTOR_PACKAGES.length + SAMPLE_MEMORY_PACKAGES.length + SAMPLE_CHAIN_PACKAGES.length;
  console.log(`  Total: ${total} packages`);
}

async function seedMemoryNFTsData(ownerId: string) {
  console.log('\n📦 Seeding Memory NFTs (Provenance)...');

  // Use raw SQL to handle case where Prisma client hasn't been regenerated
  for (const nft of SAMPLE_MEMORY_NFTS) {
    // Check if already exists
    const existing = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM memory_nfts WHERE id = ${nft.id} LIMIT 1
    `;

    if (existing.length > 0) {
      console.log(`  ⏭️  ${nft.name} (already exists)`);
      continue;
    }

    const tokenId = nanoid(10);
    const contractAddress = '0x1234567890abcdef1234567890abcdef12345678';
    const assetUrl = `https://awareness-storage.s3.amazonaws.com/memory-nfts/${nft.id}.json`;
    const metadataUrl = `ipfs://Qm${nanoid(44)}`;
    const now = new Date();

    await prisma.$executeRaw`
      INSERT INTO memory_nfts (
        id, contract_address, token_id, owner, name, description,
        memory_type, epsilon, certification, quality_grade,
        asset_url, metadata_url, parent_nft_id, derivation_type,
        royalty_percent, total_royalties_paid, price, downloads,
        minted_at, updated_at
      ) VALUES (
        ${nft.id}, ${contractAddress}, ${tokenId}, ${ownerId}, ${nft.name}, ${nft.description},
        ${nft.memoryType}, ${nft.epsilon}, ${nft.certification}, ${nft.qualityGrade},
        ${assetUrl}, ${metadataUrl}, ${nft.parentNftId}, ${nft.derivationType},
        ${nft.royaltyPercent}, '0', ${nft.price}, ${nft.downloads},
        ${now}, ${now}
      )
    `;

    const parentInfo = nft.parentNftId ? ` (parent: ${nft.parentNftId})` : ' (genesis)';
    console.log(`  ✓ ${nft.name}${parentInfo}`);
  }

  // Print family tree structure
  console.log('\n  📊 Memory Provenance Tree:');
  console.log('  ├── genesis-kv-cache-001 (GPT-4 Reasoning)');
  console.log('  │   ├── derived-kv-cache-001 (Legal Reasoning)');
  console.log('  │   │   └── derived-kv-cache-003 (Contract Analysis)');
  console.log('  │   │       └── derived-kv-cache-004 (Quick Contract Check)');
  console.log('  │   └── derived-kv-cache-002 (Medical + Reasoning)');
  console.log('  ├── genesis-w-matrix-001 (Cross-Model Alignment)');
  console.log('  │   └── derived-w-matrix-001 (Fast Alignment)');
  console.log('  └── genesis-chain-001 (Mathematical Proof Chain)');

  console.log(`\n  Total: ${SAMPLE_MEMORY_NFTS.length} Memory NFTs`);
}

async function cleanDatabase() {
  // 🛡️ PRODUCTION SAFETY CHECK
  const nodeEnv = process.env.NODE_ENV || 'development';
  const dbUrl = process.env.DATABASE_URL || '';

  // Prevent cleanup in production
  if (nodeEnv === 'production') {
    console.error('\n❌ SAFETY CHECK FAILED: Cannot clean database in production environment');
    console.error('   Set NODE_ENV to "development" or "test" to proceed');
    process.exit(1);
  }

  // Prevent cleanup of production-like database names
  const productionKeywords = ['prod', 'production', 'live', 'main'];
  const lowerDbUrl = dbUrl.toLowerCase();
  for (const keyword of productionKeywords) {
    if (lowerDbUrl.includes(keyword)) {
      console.error(`\n❌ SAFETY CHECK FAILED: Database URL contains "${keyword}"`);
      console.error('   This appears to be a production database');
      console.error('   Refusing to clean to prevent data loss');
      process.exit(1);
    }
  }

  // Warning message
  console.log('\n⚠️  WARNING: About to DELETE ALL DATA from the following tables:');
  const tables = [
    'MemoryNFT',
    'MemoryUsageLog',
    'PackagePurchase',
    'ChainPackage',
    'MemoryPackage',
    'VectorPackage',
    'Review',
    'ApiCallLog',
    'AccessPermission',
    'Transaction',
    'LatentVector',
    'User',
  ];
  tables.forEach(t => console.log(`   - ${t}`));
  console.log(`\n   Database: ${dbUrl.replace(/:[^:@]+@/, ':****@')}`);
  console.log(`   Environment: ${nodeEnv}\n`);

  // Give user 3 seconds to cancel (Ctrl+C)
  console.log('⏳ Starting cleanup in 3 seconds... (Press Ctrl+C to cancel)');
  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log('\n🧹 Cleaning database...');

  // Delete in order to respect foreign key constraints
  try {
    // Clear MemoryNFT first (has self-referential FK)
    await prisma.$executeRaw`DELETE FROM memory_nfts`;
    console.log('  ✓ Cleared MemoryNFT');
  } catch (e) { /* Table might be empty or not exist */ }

  try {
    // Use raw SQL since Prisma client may not have this model yet
    await prisma.$executeRaw`DELETE FROM memory_usage_log`;
    console.log('  ✓ Cleared MemoryUsageLog');
  } catch (e) { /* Table might be empty or not exist */ }

  try {
    await prisma.packagePurchase.deleteMany();
    console.log('  ✓ Cleared PackagePurchase');
  } catch (e) { /* Table might be empty or not exist */ }

  try {
    await prisma.chainPackage.deleteMany();
    console.log('  ✓ Cleared ChainPackage');
  } catch (e) { /* Table might be empty or not exist */ }

  try {
    await prisma.memoryPackage.deleteMany();
    console.log('  ✓ Cleared MemoryPackage');
  } catch (e) { /* Table might be empty or not exist */ }

  try {
    await prisma.vectorPackage.deleteMany();
    console.log('  ✓ Cleared VectorPackage');
  } catch (e) { /* Table might be empty or not exist */ }

  try {
    await prisma.review.deleteMany();
    console.log('  ✓ Cleared Review');
  } catch (e) { /* Table might be empty or not exist */ }

  try {
    await prisma.apiCallLog.deleteMany();
    console.log('  ✓ Cleared ApiCallLog');
  } catch (e) { /* Table might be empty or not exist */ }

  try {
    await prisma.accessPermission.deleteMany();
    console.log('  ✓ Cleared AccessPermission');
  } catch (e) { /* Table might be empty or not exist */ }

  try {
    await prisma.transaction.deleteMany();
    console.log('  ✓ Cleared Transaction');
  } catch (e) { /* Table might be empty or not exist */ }

  try {
    await prisma.latentVector.deleteMany();
    console.log('  ✓ Cleared LatentVector');
  } catch (e) { /* Table might be empty or not exist */ }

  try {
    // Delete workflow-related tables
    await prisma.workflowStep.deleteMany();
    console.log('  ✓ Cleared WorkflowStep');
  } catch (e) { /* Table might be empty or not exist */ }

  try {
    await prisma.onChainInteraction.deleteMany();
    console.log('  ✓ Cleared OnChainInteraction');
  } catch (e) { /* Table might be empty or not exist */ }

  try {
    await prisma.workflow.deleteMany();
    console.log('  ✓ Cleared Workflow');
  } catch (e) { /* Table might be empty or not exist */ }

  try {
    // Delete user-related tables
    await prisma.notification.deleteMany();
    console.log('  ✓ Cleared Notification');
  } catch (e) { /* Table might be empty or not exist */ }

  try {
    await prisma.userSubscription.deleteMany();
    console.log('  ✓ Cleared UserSubscription');
  } catch (e) { /* Table might be empty or not exist */ }

  try {
    await prisma.apiKey.deleteMany();
    console.log('  ✓ Cleared ApiKey');
  } catch (e) { /* Table might be empty or not exist */ }

  try {
    await prisma.mcpToken.deleteMany();
    console.log('  ✓ Cleared McpToken');
  } catch (e) { /* Table might be empty or not exist */ }

  try {
    await prisma.user.deleteMany();
    console.log('  ✓ Cleared User');
  } catch (e) { /* Table might be empty or not exist */ }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('🌱 Awareness Network - Database Seeder (Prisma/PostgreSQL)');
  console.log('============================================================');

  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is required');
    process.exit(1);
  }

  // 🛡️ ENVIRONMENT SAFETY CHECK
  const nodeEnv = process.env.NODE_ENV || 'development';
  const dbUrl = process.env.DATABASE_URL || '';
  console.log(`\n📍 Environment: ${nodeEnv}`);
  console.log(`📍 Database: ${dbUrl.replace(/:[^:@]+@/, ':****@')}`);

  if (shouldClean) {
    console.log('\n⚠️  DESTRUCTIVE MODE ENABLED: --clean flag detected');
    console.log('   This will DELETE ALL existing data before seeding');

    if (nodeEnv === 'production') {
      console.error('\n❌ BLOCKED: Cannot use --clean flag in production');
      process.exit(1);
    }
  }

  try {
    // Test database connection
    await prisma.$connect();
    console.log('\n✓ Database connection established');

    if (shouldClean) {
      await cleanDatabase();
    }

    let creatorId = 1;

    if (seedUsers) {
      const userIds = await seedUsersData();
      creatorId = userIds[0] || 1;
    } else {
      // Get an existing user to use as creator
      const existingUser = await prisma.user.findFirst({
        where: { role: UserRole.creator },
      });
      if (existingUser) {
        creatorId = existingUser.id;
      }
    }

    if (seedVectors) {
      await seedVectorsData(creatorId);
    }

    if (seedPackages) {
      await seedPackagesData(creatorId);
    }

    if (seedAgents) {
      console.log('\n📦 Seeding agents...');
      console.log('  ℹ️  Agents are registered in-memory via API');
      console.log('  ℹ️  Run the server and call POST /api/agents/register');
    }

    if (seedMemoryNFTs) {
      // Get a wallet address for the owner
      const ownerAddress = '0xABCDEF1234567890abcdef1234567890ABCDEF12';
      await seedMemoryNFTsData(ownerAddress);
    }

    console.log('\n✅ Seeding completed successfully!');
    console.log('\n📊 Summary:');
    if (seedUsers) console.log(`   - ${SAMPLE_USERS.length} users`);
    if (seedVectors) console.log(`   - ${SAMPLE_VECTORS.length} latent vectors`);
    if (seedPackages) {
      console.log(`   - ${SAMPLE_VECTOR_PACKAGES.length} vector packages`);
      console.log(`   - ${SAMPLE_MEMORY_PACKAGES.length} memory packages`);
      console.log(`   - ${SAMPLE_CHAIN_PACKAGES.length} chain packages`);
    }
    if (seedMemoryNFTs) console.log(`   - ${SAMPLE_MEMORY_NFTS.length} Memory NFTs (provenance tree)`);

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
