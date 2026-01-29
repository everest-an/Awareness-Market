# Vector Database Setup Guide

## Overview

Awareness Market uses **Qdrant** as the vector database for high-performance semantic search of latent vectors, KV-Caches, and reasoning chains.

## Installation

### 1. Install Qdrant Client

```bash
npm install @qdrant/js-client-rest
```

### 2. Start Qdrant Server

#### Option A: Docker (Recommended)

```bash
# Pull and run Qdrant
docker run -p 6333:6333 -p 6334:6334 \
  -v $(pwd)/qdrant_storage:/qdrant/storage:z \
  qdrant/qdrant
```

#### Option B: Docker Compose

Add to `docker-compose.yml`:

```yaml
services:
  qdrant:
    image: qdrant/qdrant:latest
    ports:
      - "6333:6333"  # REST API
      - "6334:6334"  # gRPC API
    volumes:
      - ./qdrant_storage:/qdrant/storage:z
    environment:
      - QDRANT_ALLOW_RECOVERY_MODE=true
```

Start:
```bash
docker-compose up -d qdrant
```

#### Option C: Qdrant Cloud (Production)

For production, use Qdrant Cloud:

1. Sign up at [cloud.qdrant.io](https://cloud.qdrant.io)
2. Create a cluster
3. Get your API key and URL
4. Set environment variables:

```bash
export QDRANT_URL="https://your-cluster.qdrant.io"
export QDRANT_API_KEY="your-api-key"
```

### 3. Configure Environment Variables

Add to `.env`:

```bash
# Local development
QDRANT_URL=http://localhost:6333

# Production (Qdrant Cloud)
QDRANT_URL=https://your-cluster.qdrant.io
QDRANT_API_KEY=your-api-key-here
```

### 4. Initialize Collections

Run the initialization script:

```bash
npm run db:init-vectors
```

Or manually in your server startup:

```typescript
import { initializeVectorDatabase } from './server/vector-database';

// In your server startup
await initializeVectorDatabase();
```

## Collections

The system creates three collections:

| Collection | Purpose | Dimension | Distance Metric |
|------------|---------|-----------|-----------------|
| `awareness_vectors` | Latent vectors (.vectorpkg) | 4096 | Cosine |
| `awareness_memories` | KV-Cache memories (.memorypkg) | 4096 | Cosine |
| `awareness_chains` | Reasoning chains (.chainpkg) | 4096 | Cosine |

## Usage Examples

### Index a Vector

```typescript
import { getVectorDatabaseService } from './server/vector-database';

const service = getVectorDatabaseService();

await service.indexVector('vectors', 'pkg-001', vector, {
  packageId: 'pkg-001',
  packageType: 'vector',
  modelName: 'llama-3-70b',
  dimension: 4096,
  createdAt: new Date().toISOString(),
  creatorId: 1,
  epsilon: 0.05,
  qualityScore: 0.95,
  tags: ['medical', 'diagnosis'],
  description: 'Medical diagnosis capability vector',
});
```

### Semantic Search

```typescript
// Search for similar vectors
const results = await service.searchSimilar('vectors', queryVector, {
  limit: 10,
  minScore: 0.8,
  filter: {
    must: [
      { key: 'tags', match: { any: ['medical'] } },
      { key: 'qualityScore', range: { gte: 0.9 } }
    ]
  }
});

// Results contain:
// - packageId: string
// - score: number (0-1, similarity)
// - metadata: VectorMetadata
```

### Batch Indexing

```typescript
const vectors = [
  { packageId: 'pkg-001', vector: vector1, metadata: metadata1 },
  { packageId: 'pkg-002', vector: vector2, metadata: metadata2 },
  // ... more vectors
];

await service.indexVectorsBatch('vectors', vectors);
```

### Metadata-Only Search

```typescript
// Search without vector similarity (faster)
const results = await service.searchByMetadata('vectors', {
  must: [
    { key: 'modelName', match: { value: 'llama-3-70b' } },
    { key: 'creatorId', match: { value: 123 } }
  ]
});
```

### Recommendations

```typescript
// Find vectors similar to pkg-001 and pkg-002, but NOT like pkg-003
const recommendations = await service.recommend(
  'vectors',
  ['pkg-001', 'pkg-002'],  // Positive examples
  ['pkg-003'],             // Negative examples
  { limit: 10 }
);
```

## Performance Optimization

### 1. Indexing Configuration

Qdrant automatically handles indexing, but you can optimize:

```typescript
// Use batch operations for bulk inserts
await service.indexVectorsBatch('vectors', largeBatch);
```

### 2. Search Optimization

```typescript
// Use metadata filters to reduce search space
const results = await service.searchSimilar('vectors', query, {
  limit: 10,
  filter: {
    must: [
      { key: 'modelName', match: { value: 'llama-3-70b' } }
    ]
  }
});
```

### 3. Memory Management

```typescript
// Don't fetch vectors unless needed
const results = await service.searchSimilar('vectors', query, {
  includeVector: false  // Only return metadata
});
```

## Monitoring

### Health Check

```typescript
const healthy = await service.healthCheck();
console.log('Qdrant is', healthy ? 'healthy' : 'unhealthy');
```

### Collection Stats

```typescript
const stats = await service.getCollectionStats('vectors');
console.log(`
  Total vectors: ${stats.totalVectors}
  Indexed: ${stats.indexedVectors}
  Dimension: ${stats.dimension}
`);
```

### Qdrant Dashboard

Access the Qdrant web UI at:
- Local: http://localhost:6333/dashboard
- Cloud: https://cloud.qdrant.io

## Troubleshooting

### Connection Errors

```bash
# Check if Qdrant is running
curl http://localhost:6333/health

# Check collections
curl http://localhost:6333/collections
```

### Dimension Mismatch

Ensure all vectors have the same dimension (4096 for Llama-3):

```typescript
if (vector.length !== 4096) {
  throw new Error(`Expected dimension 4096, got ${vector.length}`);
}
```

### Slow Search

1. Add metadata filters to narrow search space
2. Increase `minScore` threshold
3. Reduce `limit` parameter
4. Use Qdrant Cloud with more resources

## Migration from MySQL/PostgreSQL

To migrate existing vectors to Qdrant:

```typescript
import { getVectorDatabaseService } from './server/vector-database';
import { db } from './server/db';

const service = getVectorDatabaseService();

// Fetch all vectors from DB
const packages = await db.select().from(packagesTable);

// Batch index
const batchSize = 100;
for (let i = 0; i < packages.length; i += batchSize) {
  const batch = packages.slice(i, i + batchSize).map(pkg => ({
    packageId: pkg.id,
    vector: JSON.parse(pkg.vectorData),
    metadata: {
      packageId: pkg.id,
      packageType: pkg.type,
      modelName: pkg.modelName,
      dimension: pkg.dimension,
      createdAt: pkg.createdAt.toISOString(),
      creatorId: pkg.creatorId,
      epsilon: pkg.epsilon,
      qualityScore: pkg.qualityScore,
      tags: pkg.tags,
      description: pkg.description,
    }
  }));

  await service.indexVectorsBatch('vectors', batch);
  console.log(`Indexed ${i + batch.length}/${packages.length}`);
}
```

## Testing

Run the test suite:

```bash
# Start Qdrant first
docker run -p 6333:6333 qdrant/qdrant

# Run tests
npm test server/vector-database.test.ts
```

## Production Checklist

- [ ] Use Qdrant Cloud for production
- [ ] Set up monitoring and alerts
- [ ] Configure backup strategy
- [ ] Implement rate limiting on search endpoints
- [ ] Add authentication for Qdrant API
- [ ] Monitor query performance
- [ ] Set up replication for high availability

## Resources

- [Qdrant Documentation](https://qdrant.tech/documentation/)
- [Qdrant Cloud](https://cloud.qdrant.io)
- [Qdrant GitHub](https://github.com/qdrant/qdrant)
- [Performance Tuning Guide](https://qdrant.tech/documentation/guides/optimization/)
