/**
 * Tests for Vector Database Service
 *
 * NOTE: These tests require Qdrant to be running.
 * Install: npm install @qdrant/js-client-rest
 * Start Qdrant: docker run -p 6333:6333 qdrant/qdrant
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  VectorDatabaseService,
  getVectorDatabaseService,
  type VectorMetadata,
} from './vector-database';

// ============================================================================
// Test Helpers
// ============================================================================

function generateRandomVector(dimension: number): number[] {
  return Array.from({ length: dimension }, () => Math.random());
}

function generateTestMetadata(packageId: string): VectorMetadata {
  return {
    packageId,
    packageType: 'vector',
    modelName: 'llama-3-70b',
    dimension: 4096,
    createdAt: new Date().toISOString(),
    creatorId: 1,
    epsilon: 0.05,
    qualityScore: 0.9,
    tags: ['medical', 'diagnosis'],
    description: `Test vector ${packageId}`,
  };
}

// ============================================================================
// Initialization Tests
// ============================================================================

describe('VectorDatabaseService - Initialization', () => {
  let service: VectorDatabaseService;

  beforeAll(async () => {
    service = new VectorDatabaseService();
    await service.initializeCollections();
  });

  afterAll(async () => {
    await service.close();
  });

  test('should initialize successfully', () => {
    expect(service).toBeDefined();
  });

  test('should pass health check', async () => {
    const healthy = await service.healthCheck();
    expect(healthy).toBe(true);
  });

  test('should get collection stats', async () => {
    const stats = await service.getCollectionStats('vectors');
    expect(stats).toBeDefined();
    expect(stats.dimension).toBe(4096);
    expect(typeof stats.totalVectors).toBe('number');
  });
});

// ============================================================================
// Vector Indexing Tests
// ============================================================================

describe('VectorDatabaseService - Indexing', () => {
  let service: VectorDatabaseService;

  beforeAll(async () => {
    service = new VectorDatabaseService();
    await service.initializeCollections();
  });

  afterAll(async () => {
    await service.close();
  });

  beforeEach(async () => {
    // Clean up test data
    try {
      await service.deleteByFilter('vectors', {
        must: [{ key: 'packageId', match: { value: 'test-' } }],
      });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  test('should index a single vector', async () => {
    const packageId = 'test-001';
    const vector = generateRandomVector(4096);
    const metadata = generateTestMetadata(packageId);

    await service.indexVector('vectors', packageId, vector, metadata);

    const result = await service.getVector('vectors', packageId);
    expect(result).toBeDefined();
    expect(result?.packageId).toBe(packageId);
    expect(result?.metadata.packageType).toBe('vector');
  });

  test('should reject vector with wrong dimension', async () => {
    const packageId = 'test-002';
    const vector = generateRandomVector(1024); // Wrong dimension
    const metadata = generateTestMetadata(packageId);

    await expect(
      service.indexVector('vectors', packageId, vector, metadata)
    ).rejects.toThrow('dimension mismatch');
  });

  test('should index multiple vectors in batch', async () => {
    const vectors = Array.from({ length: 10 }, (_, i) => ({
      packageId: `test-batch-${i}`,
      vector: generateRandomVector(4096),
      metadata: generateTestMetadata(`test-batch-${i}`),
    }));

    await service.indexVectorsBatch('vectors', vectors);

    // Verify first and last
    const first = await service.getVector('vectors', 'test-batch-0');
    const last = await service.getVector('vectors', 'test-batch-9');

    expect(first).toBeDefined();
    expect(last).toBeDefined();
  });

  test('should update existing vector (upsert)', async () => {
    const packageId = 'test-003';
    const vector1 = generateRandomVector(4096);
    const metadata1 = generateTestMetadata(packageId);

    // Initial insert
    await service.indexVector('vectors', packageId, vector1, metadata1);

    // Update with new vector
    const vector2 = generateRandomVector(4096);
    const metadata2 = { ...metadata1, qualityScore: 0.95 };

    await service.indexVector('vectors', packageId, vector2, metadata2);

    // Verify update
    const result = await service.getVector('vectors', packageId);
    expect(result?.metadata.qualityScore).toBe(0.95);
  });
});

// ============================================================================
// Vector Search Tests
// ============================================================================

describe('VectorDatabaseService - Search', () => {
  let service: VectorDatabaseService;
  const testVectors: Array<{ id: string; vector: number[] }> = [];

  beforeAll(async () => {
    service = new VectorDatabaseService();
    await service.initializeCollections();

    // Insert test vectors
    for (let i = 0; i < 20; i++) {
      const packageId = `search-test-${i}`;
      const vector = generateRandomVector(4096);
      const metadata = generateTestMetadata(packageId);
      metadata.tags = i < 10 ? ['medical'] : ['finance'];
      metadata.qualityScore = 0.8 + (i % 10) * 0.02;

      await service.indexVector('vectors', packageId, vector, metadata);
      testVectors.push({ id: packageId, vector });
    }
  });

  afterAll(async () => {
    // Cleanup
    for (const { id } of testVectors) {
      try {
        await service.deleteVector('vectors', id);
      } catch (error) {
        // Ignore
      }
    }
    await service.close();
  });

  test('should search for similar vectors', async () => {
    const queryVector = testVectors[0].vector;

    const results = await service.searchSimilar('vectors', queryVector, {
      limit: 5,
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(5);
    expect(results[0].packageId).toBe('search-test-0'); // Should find itself
    expect(results[0].score).toBeGreaterThan(0.99); // Near perfect match
  });

  test('should filter search results by metadata', async () => {
    const queryVector = generateRandomVector(4096);

    const results = await service.searchSimilar('vectors', queryVector, {
      limit: 10,
      filter: {
        must: [{ key: 'tags', match: { any: ['medical'] } }],
      },
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results.every(r => r.metadata.tags?.includes('medical'))).toBe(true);
  });

  test('should respect minimum score threshold', async () => {
    const queryVector = generateRandomVector(4096);

    const results = await service.searchSimilar('vectors', queryVector, {
      limit: 10,
      minScore: 0.8,
    });

    expect(results.every(r => r.score >= 0.8)).toBe(true);
  });

  test('should search by metadata only', async () => {
    const results = await service.searchByMetadata('vectors', {
      must: [
        { key: 'packageType', match: { value: 'vector' } },
        { key: 'qualityScore', range: { gte: 0.9 } },
      ],
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results.every(r => r.metadata.qualityScore! >= 0.9)).toBe(true);
  });

  test('should paginate search results', async () => {
    const queryVector = generateRandomVector(4096);

    const page1 = await service.searchSimilar('vectors', queryVector, {
      limit: 5,
      offset: 0,
    });

    const page2 = await service.searchSimilar('vectors', queryVector, {
      limit: 5,
      offset: 5,
    });

    expect(page1.length).toBe(5);
    expect(page2.length).toBeGreaterThan(0);
    expect(page1[0].packageId).not.toBe(page2[0].packageId);
  });

  test('should include vector in search results when requested', async () => {
    const queryVector = testVectors[0].vector;

    const results = await service.searchSimilar('vectors', queryVector, {
      limit: 1,
      includeVector: true,
    });

    expect(results[0].vector).toBeDefined();
    expect(results[0].vector).toHaveLength(4096);
  });
});

// ============================================================================
// Recommendation Tests
// ============================================================================

describe('VectorDatabaseService - Recommendations', () => {
  let service: VectorDatabaseService;
  const testVectors: string[] = [];

  beforeAll(async () => {
    service = new VectorDatabaseService();
    await service.initializeCollections();

    // Insert test vectors
    for (let i = 0; i < 10; i++) {
      const packageId = `rec-test-${i}`;
      const vector = generateRandomVector(4096);
      const metadata = generateTestMetadata(packageId);

      await service.indexVector('vectors', packageId, vector, metadata);
      testVectors.push(packageId);
    }
  });

  afterAll(async () => {
    for (const id of testVectors) {
      try {
        await service.deleteVector('vectors', id);
      } catch (error) {
        // Ignore
      }
    }
    await service.close();
  });

  test('should recommend similar vectors based on positive examples', async () => {
    const positiveIds = ['rec-test-0', 'rec-test-1'];

    const results = await service.recommend('vectors', positiveIds, [], {
      limit: 5,
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(5);
    // Positive examples should not be in results
    expect(results.every(r => !positiveIds.includes(r.packageId))).toBe(true);
  });

  test('should recommend vectors excluding negative examples', async () => {
    const positiveIds = ['rec-test-0'];
    const negativeIds = ['rec-test-1', 'rec-test-2'];

    const results = await service.recommend('vectors', positiveIds, negativeIds, {
      limit: 5,
    });

    expect(results.length).toBeGreaterThan(0);
    // Should not include positive or negative examples
    expect(
      results.every(
        r => !positiveIds.includes(r.packageId) && !negativeIds.includes(r.packageId)
      )
    ).toBe(true);
  });
});

// ============================================================================
// Metadata Update Tests
// ============================================================================

describe('VectorDatabaseService - Metadata Updates', () => {
  let service: VectorDatabaseService;

  beforeAll(async () => {
    service = new VectorDatabaseService();
    await service.initializeCollections();
  });

  afterAll(async () => {
    await service.close();
  });

  test('should update vector metadata without changing vector', async () => {
    const packageId = 'meta-test-001';
    const vector = generateRandomVector(4096);
    const metadata = generateTestMetadata(packageId);
    metadata.qualityScore = 0.8;

    // Initial insert
    await service.indexVector('vectors', packageId, vector, metadata);

    // Update metadata
    await service.updateMetadata('vectors', packageId, {
      qualityScore: 0.95,
      tags: ['updated', 'test'],
    });

    // Verify update
    const result = await service.getVector('vectors', packageId);
    expect(result?.metadata.qualityScore).toBe(0.95);
    expect(result?.metadata.tags).toContain('updated');
  });
});

// ============================================================================
// Deletion Tests
// ============================================================================

describe('VectorDatabaseService - Deletion', () => {
  let service: VectorDatabaseService;

  beforeAll(async () => {
    service = new VectorDatabaseService();
    await service.initializeCollections();
  });

  afterAll(async () => {
    await service.close();
  });

  test('should delete a single vector', async () => {
    const packageId = 'delete-test-001';
    const vector = generateRandomVector(4096);
    const metadata = generateTestMetadata(packageId);

    // Insert
    await service.indexVector('vectors', packageId, vector, metadata);

    // Verify exists
    let result = await service.getVector('vectors', packageId);
    expect(result).toBeDefined();

    // Delete
    await service.deleteVector('vectors', packageId);

    // Verify deleted
    result = await service.getVector('vectors', packageId);
    expect(result).toBeNull();
  });

  test('should delete multiple vectors by filter', async () => {
    // Insert test vectors
    for (let i = 0; i < 5; i++) {
      const packageId = `delete-batch-${i}`;
      const vector = generateRandomVector(4096);
      const metadata = generateTestMetadata(packageId);
      metadata.tags = ['delete-me'];

      await service.indexVector('vectors', packageId, vector, metadata);
    }

    // Delete by filter
    await service.deleteByFilter('vectors', {
      must: [{ key: 'tags', match: { any: ['delete-me'] } }],
    });

    // Verify deleted
    const results = await service.searchByMetadata('vectors', {
      must: [{ key: 'tags', match: { any: ['delete-me'] } }],
    });

    expect(results.length).toBe(0);
  });
});

// ============================================================================
// Singleton Tests
// ============================================================================

describe('VectorDatabaseService - Singleton', () => {
  test('should return same instance', () => {
    const service1 = getVectorDatabaseService();
    const service2 = getVectorDatabaseService();

    expect(service1).toBe(service2);
  });
});
