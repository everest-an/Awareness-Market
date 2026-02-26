/**
 * Backfill Script: Generate embeddings for existing packages
 *
 * This script:
 * 1. Fetches all packages without embeddings
 * 2. Generates embeddings using Infinity Server (nomic-embed-text-v1.5)
 * 3. Updates the database with vector data
 * 4. Shows progress and handles errors
 *
 * Usage:
 *   npm run backfill-embeddings
 *   npm run backfill-embeddings -- --type=vector
 *   npm run backfill-embeddings -- --batch-size=50
 */

import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import pLimit from 'p-limit';

const prisma = new PrismaClient();

// ============================================================================
// Configuration
// ============================================================================

const INFINITY_BASE_URL = process.env.INFINITY_EMBEDDING_URL || 'http://localhost:7997';
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '32', 10);
const CONCURRENCY = parseInt(process.env.CONCURRENCY || '3', 10);

// Model configurations for different package types
const MODELS = {
  vector: {
    model: 'nomic-ai/nomic-embed-text-v1.5',
    dimension: 512, // Matryoshka: 512 for general purpose
  },
  memory: {
    model: 'nomic-ai/nomic-embed-text-v1.5',
    dimension: 256, // Smaller for storage efficiency
  },
  chain: {
    model: 'nomic-ai/nomic-embed-text-v1.5',
    dimension: 768, // Full dimension for complex reasoning
  },
};

// ============================================================================
// Embedding Service
// ============================================================================

interface EmbeddingRequest {
  model: string;
  input: string | string[];
  dimensions?: number;
}

interface EmbeddingResponse {
  data: Array<{
    embedding: number[];
    index: number;
  }>;
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

class InfinityEmbeddingService {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/health`, { timeout: 5000 });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  async embed(texts: string[], options: { model: string; dimension: number }): Promise<number[][]> {
    const request: EmbeddingRequest = {
      model: options.model,
      input: texts,
      dimensions: options.dimension,
    };

    try {
      const response = await axios.post<EmbeddingResponse>(
        `${this.baseUrl}/embeddings`,
        request,
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 60000, // 60s timeout for large batches
        }
      );

      return response.data.data
        .sort((a, b) => a.index - b.index)
        .map(item => item.embedding);
    } catch (error: any) {
      console.error('Embedding error:', error.response?.data || error.message);
      throw new Error(`Failed to generate embeddings: ${error.message}`);
    }
  }
}

// ============================================================================
// Package Processing
// ============================================================================

interface VectorPackage {
  id: number;
  packageId: string;
  name: string;
  description: string;
}

interface MemoryPackage {
  id: number;
  packageId: string;
  name: string;
  description: string;
  contextDescription: string;
}

interface ChainPackage {
  id: number;
  packageId: string;
  name: string;
  description: string;
  problemType: string;
}

class EmbeddingBackfiller {
  private embeddingService: InfinityEmbeddingService;
  private limit = pLimit(CONCURRENCY);

  constructor(embeddingService: InfinityEmbeddingService) {
    this.embeddingService = embeddingService;
  }

  // Vector Packages
  async backfillVectorPackages(): Promise<void> {
    console.log('\n📦 Backfilling Vector Packages...');

    const packages = await prisma.$queryRaw<VectorPackage[]>`
      SELECT id, package_id as "packageId", name, description
      FROM vector_packages
      WHERE embedding IS NULL AND status = 'active'
      ORDER BY created_at DESC
    `;

    console.log(`Found ${packages.length} packages without embeddings`);

    if (packages.length === 0) {
      console.log('✅ All vector packages have embeddings');
      return;
    }

    const config = MODELS.vector;
    let processed = 0;
    let errors = 0;

    // Process in batches
    for (let i = 0; i < packages.length; i += BATCH_SIZE) {
      const batch = packages.slice(i, i + BATCH_SIZE);
      const texts = batch.map(pkg => `${pkg.name}\n\n${pkg.description}`);

      try {
        const embeddings = await this.embeddingService.embed(texts, config);

        // Update database
        await Promise.all(
          batch.map((pkg, idx) =>
            this.limit(async () => {
              try {
                await prisma.$executeRaw`
                  UPDATE vector_packages
                  SET embedding = ${JSON.stringify(embeddings[idx])}::vector(512)
                  WHERE id = ${pkg.id}
                `;
                processed++;
                if (processed % 10 === 0) {
                  console.log(`  Progress: ${processed}/${packages.length} (${Math.round((processed / packages.length) * 100)}%)`);
                }
              } catch (error: any) {
                errors++;
                console.error(`  ❌ Failed to update package ${pkg.packageId}:`, error.message);
              }
            })
          )
        );
      } catch (error: any) {
        errors += batch.length;
        console.error(`  ❌ Failed to generate embeddings for batch ${i}-${i + batch.length}:`, error.message);
      }
    }

    console.log(`\n✅ Vector Packages complete: ${processed} succeeded, ${errors} failed`);
  }

  // Memory Packages
  async backfillMemoryPackages(): Promise<void> {
    console.log('\n🧠 Backfilling Memory Packages...');

    const packages = await prisma.$queryRaw<MemoryPackage[]>`
      SELECT id, package_id as "packageId", name, description, context_description as "contextDescription"
      FROM memory_packages
      WHERE embedding IS NULL AND status = 'active'
      ORDER BY created_at DESC
    `;

    console.log(`Found ${packages.length} packages without embeddings`);

    if (packages.length === 0) {
      console.log('✅ All memory packages have embeddings');
      return;
    }

    const config = MODELS.memory;
    let processed = 0;
    let errors = 0;

    for (let i = 0; i < packages.length; i += BATCH_SIZE) {
      const batch = packages.slice(i, i + BATCH_SIZE);
      const texts = batch.map(pkg => `${pkg.name}\n\n${pkg.description}\n\nContext: ${pkg.contextDescription}`);

      try {
        const embeddings = await this.embeddingService.embed(texts, config);

        await Promise.all(
          batch.map((pkg, idx) =>
            this.limit(async () => {
              try {
                await prisma.$executeRaw`
                  UPDATE memory_packages
                  SET embedding = ${JSON.stringify(embeddings[idx])}::vector(256)
                  WHERE id = ${pkg.id}
                `;
                processed++;
                if (processed % 10 === 0) {
                  console.log(`  Progress: ${processed}/${packages.length} (${Math.round((processed / packages.length) * 100)}%)`);
                }
              } catch (error: any) {
                errors++;
                console.error(`  ❌ Failed to update package ${pkg.packageId}:`, error.message);
              }
            })
          )
        );
      } catch (error: any) {
        errors += batch.length;
        console.error(`  ❌ Failed to generate embeddings for batch:`, error.message);
      }
    }

    console.log(`\n✅ Memory Packages complete: ${processed} succeeded, ${errors} failed`);
  }

  // Chain Packages
  async backfillChainPackages(): Promise<void> {
    console.log('\n⛓️  Backfilling Chain Packages...');

    const packages = await prisma.$queryRaw<ChainPackage[]>`
      SELECT id, package_id as "packageId", name, description, problem_type as "problemType"
      FROM chain_packages
      WHERE embedding IS NULL AND status = 'active'
      ORDER BY created_at DESC
    `;

    console.log(`Found ${packages.length} packages without embeddings`);

    if (packages.length === 0) {
      console.log('✅ All chain packages have embeddings');
      return;
    }

    const config = MODELS.chain;
    let processed = 0;
    let errors = 0;

    for (let i = 0; i < packages.length; i += BATCH_SIZE) {
      const batch = packages.slice(i, i + BATCH_SIZE);
      const texts = batch.map(pkg => `${pkg.name}\n\n${pkg.description}\n\nProblem Type: ${pkg.problemType}`);

      try {
        const embeddings = await this.embeddingService.embed(texts, config);

        await Promise.all(
          batch.map((pkg, idx) =>
            this.limit(async () => {
              try {
                await prisma.$executeRaw`
                  UPDATE chain_packages
                  SET embedding = ${JSON.stringify(embeddings[idx])}::vector(768)
                  WHERE id = ${pkg.id}
                `;
                processed++;
                if (processed % 10 === 0) {
                  console.log(`  Progress: ${processed}/${packages.length} (${Math.round((processed / packages.length) * 100)}%)`);
                }
              } catch (error: any) {
                errors++;
                console.error(`  ❌ Failed to update package ${pkg.packageId}:`, error.message);
              }
            })
          )
        );
      } catch (error: any) {
        errors += batch.length;
        console.error(`  ❌ Failed to generate embeddings for batch:`, error.message);
      }
    }

    console.log(`\n✅ Chain Packages complete: ${processed} succeeded, ${errors} failed`);
  }
}

// ============================================================================
// Main Execution
// ============================================================================

async function main() {
  console.log('🚀 Embedding Backfill Script');
  console.log('============================\n');

  const embeddingService = new InfinityEmbeddingService(INFINITY_BASE_URL);
  const backfiller = new EmbeddingBackfiller(embeddingService);

  // Health check
  console.log('🏥 Checking Infinity Server...');
  const isHealthy = await embeddingService.healthCheck();

  if (!isHealthy) {
    console.error('❌ Infinity Server is not responding at', INFINITY_BASE_URL);
    console.error('Please ensure the server is running:');
    console.error('  bash scripts/deploy-infinity-embedding.sh');
    process.exit(1);
  }

  console.log('✅ Infinity Server is healthy\n');
  console.log(`Configuration:`);
  console.log(`  - Batch size: ${BATCH_SIZE}`);
  console.log(`  - Concurrency: ${CONCURRENCY}`);
  console.log(`  - Vector dimension: ${MODELS.vector.dimension}`);
  console.log(`  - Memory dimension: ${MODELS.memory.dimension}`);
  console.log(`  - Chain dimension: ${MODELS.chain.dimension}\n`);

  const startTime = Date.now();

  // Check command line args
  const packageType = process.argv.find(arg => arg.startsWith('--type='))?.split('=')[1];

  try {
    if (!packageType || packageType === 'vector') {
      await backfiller.backfillVectorPackages();
    }

    if (!packageType || packageType === 'memory') {
      await backfiller.backfillMemoryPackages();
    }

    if (!packageType || packageType === 'chain') {
      await backfiller.backfillChainPackages();
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n🎉 Backfill complete in ${duration}s`);
  } catch (error: any) {
    console.error('\n❌ Backfill failed:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
