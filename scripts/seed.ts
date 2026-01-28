#!/usr/bin/env tsx
/**
 * Unified Seed Script for Awareness Network
 * 
 * Usage:
 *   npm run seed              # Run all seeders
 *   npm run seed -- --vectors # Seed only vectors
 *   npm run seed -- --users   # Seed only users
 *   npm run seed -- --packages # Seed only packages
 *   npm run seed -- --agents  # Seed only agents
 *   npm run seed -- --clean   # Clear all data first
 */

import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';
import { nanoid } from 'nanoid';
import * as schema from '../drizzle/schema';

dotenv.config();

// ============================================================================
// Configuration
// ============================================================================

const args = process.argv.slice(2);
const shouldClean = args.includes('--clean');
const seedVectors = args.length === 0 || args.includes('--vectors');
const seedUsers = args.length === 0 || args.includes('--users');
const seedPackages = args.length === 0 || args.includes('--packages');
const seedAgents = args.length === 0 || args.includes('--agents');

// ============================================================================
// Sample Data
// ============================================================================

const SAMPLE_USERS = [
  { name: 'Alice Chen', email: 'alice@example.com', role: 'creator' as const },
  { name: 'Bob Smith', email: 'bob@example.com', role: 'creator' as const },
  { name: 'Carol Wang', email: 'carol@example.com', role: 'consumer' as const },
  { name: 'David Lee', email: 'david@example.com', role: 'consumer' as const },
  { name: 'AI Agent Alpha', email: 'agent-alpha@awareness.market', role: 'creator' as const },
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

// ============================================================================
// Seed Functions
// ============================================================================

async function seedUsersData(db: any, connection: any) {
  console.log('\n📦 Seeding users...');
  const userIds: number[] = [];

  for (const user of SAMPLE_USERS) {
    const [result] = await connection.execute(
      `INSERT INTO users (openId, name, email, loginMethod, role, createdAt, updatedAt, lastSignedIn)
       VALUES (?, ?, ?, ?, ?, NOW(), NOW(), NOW())
       ON DUPLICATE KEY UPDATE name = VALUES(name)`,
      [
        `seed_${nanoid(12)}`,
        user.name,
        user.email,
        'email',
        user.role,
      ]
    );
    userIds.push((result as any).insertId || 1);
    console.log(`  ✓ ${user.name} (${user.role})`);
  }

  console.log(`  Total: ${userIds.length} users`);
  return userIds;
}

async function seedVectorsData(db: any, connection: any, creatorId: number) {
  console.log('\n📦 Seeding latent vectors...');

  for (const vector of SAMPLE_VECTORS) {
    await connection.execute(
      `INSERT INTO latent_vectors (
        creator_id, title, description, category, base_price, 
        vector_file_key, vector_file_url, source_model, w_matrix_standard,
        hidden_dim, memory_type, status, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      ON DUPLICATE KEY UPDATE title = VALUES(title)`,
      [
        creatorId,
        vector.title,
        vector.description,
        vector.category,
        vector.basePrice,
        `vectors/${nanoid(16)}.bin`,
        `https://awareness-storage.s3.amazonaws.com/vectors/${nanoid(16)}.bin`,
        vector.sourceModel,
        '8192',
        8192,
        'reasoning_chain',
        'active',
      ]
    );
    console.log(`  ✓ ${vector.title}`);
  }

  console.log(`  Total: ${SAMPLE_VECTORS.length} vectors`);
}

async function seedPackagesData(db: any, connection: any, creatorId: number) {
  console.log('\n📦 Seeding vector packages...');
  for (const pkg of SAMPLE_VECTOR_PACKAGES) {
    const packageId = `vpkg_${nanoid(12)}`;
    await connection.execute(
      `INSERT INTO vector_packages (
        package_id, user_id, name, description, source_model, target_model,
        category, price, dimension, epsilon, information_retention,
        package_url, vector_url, w_matrix_url, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      ON DUPLICATE KEY UPDATE name = VALUES(name)`,
      [
        packageId, creatorId, pkg.name, pkg.description, pkg.sourceModel, pkg.targetModel,
        pkg.category, pkg.price, pkg.dimension, '0.05', '0.95',
        `https://awareness-storage.s3.amazonaws.com/packages/${packageId}.vectorpkg`,
        `https://awareness-storage.s3.amazonaws.com/packages/${packageId}/vector.json`,
        `https://awareness-storage.s3.amazonaws.com/packages/${packageId}/w_matrix.json`,
      ]
    );
    console.log(`  ✓ ${pkg.name}`);
  }

  console.log('\n📦 Seeding memory packages...');
  for (const pkg of SAMPLE_MEMORY_PACKAGES) {
    const packageId = `mpkg_${nanoid(12)}`;
    await connection.execute(
      `INSERT INTO memory_packages (
        package_id, user_id, name, description, source_model, target_model,
        token_count, compression_ratio, context_description, price,
        epsilon, information_retention, package_url, kv_cache_url, w_matrix_url,
        createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      ON DUPLICATE KEY UPDATE name = VALUES(name)`,
      [
        packageId, creatorId, pkg.name, pkg.description, pkg.sourceModel, pkg.targetModel,
        pkg.tokenCount, pkg.compressionRatio, pkg.contextDescription, pkg.price,
        '0.05', '0.95',
        `https://awareness-storage.s3.amazonaws.com/packages/${packageId}.memorypkg`,
        `https://awareness-storage.s3.amazonaws.com/packages/${packageId}/kv_cache.json`,
        `https://awareness-storage.s3.amazonaws.com/packages/${packageId}/w_matrix.json`,
      ]
    );
    console.log(`  ✓ ${pkg.name}`);
  }

  console.log('\n📦 Seeding chain packages...');
  for (const pkg of SAMPLE_CHAIN_PACKAGES) {
    const packageId = `cpkg_${nanoid(12)}`;
    await connection.execute(
      `INSERT INTO chain_packages (
        package_id, user_id, name, description, source_model, target_model,
        problem_type, solution_quality, step_count, price,
        epsilon, information_retention, package_url, chain_url, w_matrix_url,
        createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      ON DUPLICATE KEY UPDATE name = VALUES(name)`,
      [
        packageId, creatorId, pkg.name, pkg.description, pkg.sourceModel, pkg.targetModel,
        pkg.problemType, pkg.solutionQuality, pkg.stepCount, pkg.price,
        '0.05', '0.95',
        `https://awareness-storage.s3.amazonaws.com/packages/${packageId}.chainpkg`,
        `https://awareness-storage.s3.amazonaws.com/packages/${packageId}/chain.json`,
        `https://awareness-storage.s3.amazonaws.com/packages/${packageId}/w_matrix.json`,
      ]
    );
    console.log(`  ✓ ${pkg.name}`);
  }

  const total = SAMPLE_VECTOR_PACKAGES.length + SAMPLE_MEMORY_PACKAGES.length + SAMPLE_CHAIN_PACKAGES.length;
  console.log(`  Total: ${total} packages`);
}

async function cleanDatabase(connection: any) {
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
    'package_downloads', 'package_purchases',
    'chain_packages', 'memory_packages', 'vector_packages',
    'reviews', 'api_call_logs', 'access_permissions', 'transactions',
    'latent_vectors', 'users'
  ];
  tables.forEach(t => console.log(`   - ${t}`));
  console.log(`\n   Database: ${dbUrl}`);
  console.log(`   Environment: ${nodeEnv}\n`);

  // Give user 3 seconds to cancel (Ctrl+C)
  console.log('⏳ Starting cleanup in 3 seconds... (Press Ctrl+C to cancel)');
  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log('\n🧹 Cleaning database...');
  for (const table of tables) {
    try {
      await connection.execute(`DELETE FROM ${table}`);
      console.log(`  ✓ Cleared ${table}`);
    } catch (e) {
      // Table might not exist
    }
  }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('🌱 Awareness Network - Database Seeder');
  console.log('=====================================');

  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is required');
    process.exit(1);
  }

  // 🛡️ ENVIRONMENT SAFETY CHECK
  const nodeEnv = process.env.NODE_ENV || 'development';
  console.log(`\n📍 Environment: ${nodeEnv}`);
  console.log(`📍 Database: ${process.env.DATABASE_URL}`);

  if (shouldClean) {
    console.log('\n⚠️  DESTRUCTIVE MODE ENABLED: --clean flag detected');
    console.log('   This will DELETE ALL existing data before seeding');

    if (nodeEnv === 'production') {
      console.error('\n❌ BLOCKED: Cannot use --clean flag in production');
      process.exit(1);
    }
  }

  const connection = await mysql.createConnection({
    uri: process.env.DATABASE_URL,
  });
  const db = drizzle(connection);

  try {
    if (shouldClean) {
      await cleanDatabase(connection);
    }

    let creatorId = 1;

    if (seedUsers) {
      const userIds = await seedUsersData(db, connection);
      creatorId = userIds[0] || 1;
    }

    if (seedVectors) {
      await seedVectorsData(db, connection, creatorId);
    }

    if (seedPackages) {
      await seedPackagesData(db, connection, creatorId);
    }

    if (seedAgents) {
      console.log('\n📦 Seeding agents...');
      console.log('  ℹ️  Agents are registered in-memory via API');
      console.log('  ℹ️  Run the server and call POST /api/agents/register');
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

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

main();
