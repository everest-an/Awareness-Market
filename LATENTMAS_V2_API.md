# LatentMAS v2 API Documentation

## Overview

All LatentMAS v2 features are exposed through tRPC endpoints under the `latentmasV2` namespace. These endpoints provide type-safe, end-to-end API access to the 4 core v2 enhancements.

**Base Router**: `appRouter.latentmasV2`

---

## 1. KV-Cache Compression API

### `latentmasV2.kvCache.compress`
**Type**: Mutation  
**Auth**: Public

Compress KV-Cache using attention-based token selection.

**Input**:
```typescript
{
  keys: number[][];           // Key vectors
  values: number[][];         // Value vectors
  queries: number[][];        // Query vectors for attention calculation
  config?: {
    attentionThreshold?: number;  // Default: 0.90 (90%)
    minTokens?: number;           // Default: 10
    maxTokens?: number;           // Default: 2048
  };
}
```

**Output**:
```typescript
{
  success: boolean;
  compressed: CompressedKVCache;
  stats: {
    originalTokens: number;
    compressedTokens: number;
    compressionRatio: number;
    cumulativeAttention: number;
  };
}
```

**Frontend Usage**:
```typescript
const { mutate: compressKVCache } = trpc.latentmasV2.kvCache.compress.useMutation();

compressKVCache({
  keys: [[0.1, 0.2, ...], ...],
  values: [[0.3, 0.4, ...], ...],
  queries: [[0.5, 0.6, ...], ...],
  config: { attentionThreshold: 0.95 }
}, {
  onSuccess: (data) => {
    console.log(`Compressed from ${data.stats.originalTokens} to ${data.stats.compressedTokens} tokens`);
    console.log(`Bandwidth savings: ${(1 - data.stats.compressionRatio) * 100}%`);
  }
});
```

---

### `latentmasV2.kvCache.decompress`
**Type**: Mutation  
**Auth**: Public

Decompress KV-Cache back to original size with zero-padding.

**Input**:
```typescript
{
  compressed: CompressedKVCache;
  originalLength: number;
}
```

**Output**:
```typescript
{
  success: boolean;
  keys: number[][];
  values: number[][];
  stats: {
    originalLength: number;
    decompressedLength: number;
  };
}
```

---

### `latentmasV2.kvCache.estimateBandwidth`
**Type**: Query  
**Auth**: Public

Estimate bandwidth savings from compression.

**Input**:
```typescript
{
  compressed: CompressedKVCache;
  originalLength: number;
  vectorDimension: number;
}
```

**Output**:
```typescript
{
  success: boolean;
  bandwidth: {
    originalSize: number;      // Bytes
    compressedSize: number;    // Bytes
    savingsBytes: number;      // Bytes saved
    savingsPercent: number;    // Percentage saved
  };
}
```

---

## 2. Dynamic W-Matrix Alignment API

### `latentmasV2.wMatrix.create`
**Type**: Mutation  
**Auth**: Protected (requires login)

Create a new W-Matrix for cross-model vector alignment.

**Input**:
```typescript
{
  sourceModel: string;        // e.g., "gpt-3.5-turbo"
  targetModel: string;        // e.g., "gpt-4"
  sourceDim: number;          // e.g., 1536
  targetDim: number;          // e.g., 3072
  activation?: 'relu' | 'tanh' | 'sigmoid' | 'gelu';  // Default: 'gelu'
}
```

**Output**:
```typescript
{
  success: boolean;
  matrixId: string;           // Unique ID for this matrix
  metadata: {
    sourceModel: string;
    targetModel: string;
    sourceDim: number;
    targetDim: number;
    architecture: string;     // e.g., "1536 → 1920 → 2688 → 3072"
  };
}
```

**Frontend Usage**:
```typescript
const { mutate: createMatrix } = trpc.latentmasV2.wMatrix.create.useMutation();

createMatrix({
  sourceModel: "gpt-3.5-turbo",
  targetModel: "gpt-4",
  sourceDim: 1536,
  targetDim: 3072
}, {
  onSuccess: (data) => {
    console.log(`Matrix created: ${data.matrixId}`);
    console.log(`Architecture: ${data.metadata.architecture}`);
    // Store matrixId for future alignment operations
  }
});
```

---

### `latentmasV2.wMatrix.align`
**Type**: Mutation  
**Auth**: Public

Align a vector from source model to target model dimensions.

**Input**:
```typescript
{
  // Option 1: Use existing matrix
  matrixId?: string;
  vector: number[];
  
  // Option 2: Create temporary matrix
  sourceModel?: string;
  targetModel?: string;
  sourceDim?: number;
  targetDim?: number;
}
```

**Output**:
```typescript
{
  success: boolean;
  result: {
    alignedVector: number[];
    confidence: number;
    alignmentLoss: number;
    transformationPath: string[];
  };
}
```

**Frontend Usage**:
```typescript
const { mutate: alignVector } = trpc.latentmasV2.wMatrix.align.useMutation();

// Using existing matrix
alignVector({
  matrixId: "user123-1704268800000",
  vector: [0.1, 0.2, ..., 0.5]  // 1536-dim vector
}, {
  onSuccess: (data) => {
    console.log(`Aligned vector (${data.result.alignedVector.length}D)`);
    console.log(`Confidence: ${data.result.confidence}`);
  }
});

// Or create temporary matrix
alignVector({
  sourceModel: "gpt-3.5-turbo",
  targetModel: "gpt-4",
  sourceDim: 1536,
  targetDim: 3072,
  vector: [0.1, 0.2, ..., 0.5]
});
```

---

### `latentmasV2.wMatrix.serialize`
**Type**: Query  
**Auth**: Public

Serialize W-Matrix to JSON string for storage.

**Input**:
```typescript
{
  matrixId: string;
}
```

**Output**:
```typescript
{
  success: boolean;
  serialized: string;  // JSON string
}
```

---

### `latentmasV2.wMatrix.deserialize`
**Type**: Mutation  
**Auth**: Protected

Deserialize and load a W-Matrix from JSON string.

**Input**:
```typescript
{
  serialized: string;  // JSON string from serialize()
}
```

**Output**:
```typescript
{
  success: boolean;
  matrixId: string;
  metadata: {
    sourceModel: string;
    targetModel: string;
  };
}
```

---

## 3. Anti-Poisoning Verification API

### `latentmasV2.antiPoisoning.generateChallenge`
**Type**: Mutation  
**Auth**: Public

Generate a Proof-of-Latent-Fidelity (PoLF) challenge for vector verification.

**Input**:
```typescript
{
  config?: {
    fidelityThreshold?: number;    // Default: 0.85
    anomalyThreshold?: number;     // Default: 0.15
    challengeSize?: number;        // Default: 10
    timeoutMs?: number;            // Default: 300000 (5 min)
  };
}
```

**Output**:
```typescript
{
  success: boolean;
  challenge: {
    id: string;
    testPrompts: string[];         // Array of test prompts
    nonce: string;                 // Cryptographic nonce
    expiresAt: number;             // Unix timestamp
  };
}
```

**Frontend Usage**:
```typescript
const { mutate: generateChallenge } = trpc.latentmasV2.antiPoisoning.generateChallenge.useMutation();

generateChallenge({
  config: { challengeSize: 10 }
}, {
  onSuccess: (data) => {
    console.log(`Challenge ID: ${data.challenge.id}`);
    console.log(`Test prompts: ${data.challenge.testPrompts.length}`);
    // Seller generates vectors for each prompt
    // Then calls verify() with the results
  }
});
```

---

### `latentmasV2.antiPoisoning.verify`
**Type**: Mutation  
**Auth**: Public

Verify a challenge response to detect poisoned vectors.

**Input**:
```typescript
{
  challengeId: string;
  vectorOutputs: number[][];     // One vector per test prompt
  nonce: string;                 // From challenge
  config?: {
    fidelityThreshold?: number;
    anomalyThreshold?: number;
  };
}
```

**Output**:
```typescript
{
  success: boolean;
  result: {
    passed: boolean;
    fidelityScore: number;
    confidence: number;
    anomalies: string[];
    details: {
      patternMatches: number;
      totalPatterns: number;
      distributionScore: number;
      consistencyScore: number;
    };
  };
}
```

**Frontend Usage**:
```typescript
const { mutate: verify } = trpc.latentmasV2.antiPoisoning.verify.useMutation();

verify({
  challengeId: "abc123...",
  vectorOutputs: [
    [0.1, 0.2, ...],  // Vector for prompt 1
    [0.3, 0.4, ...],  // Vector for prompt 2
    // ... 10 vectors total
  ],
  nonce: "def456..."
}, {
  onSuccess: (data) => {
    if (data.result.passed) {
      console.log(`✓ Verification passed (fidelity: ${data.result.fidelityScore})`);
    } else {
      console.log(`✗ Verification failed: ${data.result.anomalies.join(', ')}`);
    }
  }
});
```

---

### `latentmasV2.antiPoisoning.getChallenge`
**Type**: Query  
**Auth**: Public

Get details of an active challenge.

**Input**:
```typescript
{
  challengeId: string;
}
```

**Output**:
```typescript
{
  success: boolean;
  challenge: {
    id: string;
    testPrompts: string[];
    expiresAt: number;
  };
}
```

---

## 4. Semantic Anchors API

### `latentmasV2.semanticAnchors.getAll`
**Type**: Query  
**Auth**: Public

Get all 1024 golden anchor prompts.

**Input**: None

**Output**:
```typescript
{
  success: boolean;
  anchors: SemanticAnchor[];     // 1024 anchors
  stats: {
    totalAnchors: number;
    categoryCounts: Record<string, number>;
    vectorsCached: number;
  };
}
```

**Frontend Usage**:
```typescript
const { data } = trpc.latentmasV2.semanticAnchors.getAll.useQuery();

if (data) {
  console.log(`Total anchors: ${data.stats.totalAnchors}`);
  console.log(`Categories: ${Object.keys(data.stats.categoryCounts).length}`);
}
```

---

### `latentmasV2.semanticAnchors.getByCategory`
**Type**: Query  
**Auth**: Public

Get anchors filtered by semantic category.

**Input**:
```typescript
{
  category: 'factual_knowledge' | 'logical_reasoning' | 'creative_expression' | 
            'ethical_judgment' | 'technical_explanation' | 'emotional_understanding' |
            'spatial_reasoning' | 'temporal_reasoning' | 'causal_reasoning' |
            'abstract_concepts' | 'social_interaction' | 'scientific_knowledge' |
            'mathematical_reasoning' | 'linguistic_patterns' | 'cultural_context' |
            'common_sense';
}
```

**Output**:
```typescript
{
  success: boolean;
  category: string;
  anchors: SemanticAnchor[];
  count: number;
}
```

---

### `latentmasV2.semanticAnchors.findNearest`
**Type**: Mutation  
**Auth**: Public

Find nearest anchor prompts to a given vector.

**Input**:
```typescript
{
  vector: number[];
  topK?: number;  // Default: 10
}
```

**Output**:
```typescript
{
  success: boolean;
  nearest: AnchorMatchResult[];  // Sorted by similarity
}

// AnchorMatchResult:
{
  anchorId: number;
  similarity: number;
  category: string;
  prompt: string;
}
```

**Frontend Usage**:
```typescript
const { mutate: findNearest } = trpc.latentmasV2.semanticAnchors.findNearest.useMutation();

findNearest({
  vector: [0.1, 0.2, ..., 0.5],
  topK: 5
}, {
  onSuccess: (data) => {
    console.log("Top 5 nearest anchors:");
    data.nearest.forEach((match, i) => {
      console.log(`${i+1}. ${match.category}: "${match.prompt}" (similarity: ${match.similarity.toFixed(4)})`);
    });
  }
});
```

---

### `latentmasV2.semanticAnchors.calibrate`
**Type**: Mutation  
**Auth**: Public

Calibrate vector alignment quality using semantic anchors.

**Input**:
```typescript
{
  vector: number[];
}
```

**Output**:
```typescript
{
  success: boolean;
  calibration: {
    anchors: AnchorMatchResult[];  // Top 20 nearest anchors
    calibrationScore: number;      // 0-1
    coverage: number;              // 0-1 (semantic space coverage)
    recommendations: string[];     // Improvement suggestions
  };
}
```

**Frontend Usage**:
```typescript
const { mutate: calibrate } = trpc.latentmasV2.semanticAnchors.calibrate.useMutation();

calibrate({
  vector: [0.1, 0.2, ..., 0.5]
}, {
  onSuccess: (data) => {
    console.log(`Calibration score: ${(data.calibration.calibrationScore * 100).toFixed(2)}%`);
    console.log(`Semantic coverage: ${(data.calibration.coverage * 100).toFixed(2)}%`);
    
    if (data.calibration.recommendations.length > 0) {
      console.log("Recommendations:");
      data.calibration.recommendations.forEach(r => console.log(`  - ${r}`));
    }
  }
});
```

---

### `latentmasV2.semanticAnchors.storeAnchorVector`
**Type**: Mutation  
**Auth**: Protected

Store a vector for a specific anchor (for similarity searches).

**Input**:
```typescript
{
  anchorId: number;  // 0-1023
  vector: number[];
}
```

**Output**:
```typescript
{
  success: boolean;
  anchorId: number;
}
```

---

### `latentmasV2.semanticAnchors.getCategories`
**Type**: Query  
**Auth**: Public

Get list of all semantic categories.

**Input**: None

**Output**:
```typescript
{
  success: boolean;
  categories: string[];  // 16 categories
}
```

---

### `latentmasV2.semanticAnchors.getStatistics`
**Type**: Query  
**Auth**: Public

Get statistics about the anchor database.

**Input**: None

**Output**:
```typescript
{
  success: boolean;
  stats: {
    totalAnchors: number;
    categoryCounts: Record<string, number>;
    vectorsCached: number;
  };
}
```

---

## Error Handling

All endpoints return errors in the standard tRPC format:

```typescript
try {
  const result = await trpc.latentmasV2.kvCache.compress.mutate({...});
} catch (error) {
  if (error instanceof TRPCError) {
    console.error(`Error: ${error.message}`);
    console.error(`Code: ${error.code}`);
  }
}
```

Common error codes:
- `INTERNAL_SERVER_ERROR`: Operation failed (check error message)
- `NOT_FOUND`: Resource not found (e.g., challenge expired)
- `FORBIDDEN`: Authentication required
- `BAD_REQUEST`: Invalid input parameters

---

## Type Safety

All API endpoints are fully type-safe. Import types from the router:

```typescript
import type { AppRouter } from '@/server/routers';
import { trpc } from '@/lib/trpc';

// TypeScript will infer all input/output types automatically
const { data, isLoading } = trpc.latentmasV2.semanticAnchors.getAll.useQuery();
//     ^? { success: boolean; anchors: SemanticAnchor[]; stats: {...} }
```

---

## Complete Example: Vector Verification Flow

```typescript
// 1. Generate challenge
const { mutate: generateChallenge } = trpc.latentmasV2.antiPoisoning.generateChallenge.useMutation();
const { mutate: verify } = trpc.latentmasV2.antiPoisoning.verify.useMutation();

generateChallenge({}, {
  onSuccess: async (challengeData) => {
    const { id, testPrompts, nonce } = challengeData.challenge;
    
    // 2. Generate vectors for each prompt (seller's responsibility)
    const vectorOutputs = await Promise.all(
      testPrompts.map(prompt => generateVectorForPrompt(prompt))
    );
    
    // 3. Verify
    verify({
      challengeId: id,
      vectorOutputs,
      nonce
    }, {
      onSuccess: (verifyData) => {
        if (verifyData.result.passed) {
          console.log("✓ Vector verified as authentic");
          // Proceed with purchase/download
        } else {
          console.log("✗ Vector failed verification");
          console.log("Anomalies:", verifyData.result.anomalies);
        }
      }
    });
  }
});
```

---

## Performance Considerations

1. **KV-Cache Compression**: Compression is CPU-intensive. For large caches (>2048 tokens), consider batching or worker threads.

2. **W-Matrix Alignment**: Matrix creation is one-time cost. Reuse matrices via `matrixId` for multiple alignments.

3. **Anti-Poisoning Verification**: Challenges expire after timeout (default 5 min). Complete verification promptly.

4. **Semantic Anchors**: Anchor vectors are cached in memory. Call `storeAnchorVector` once during initialization, then reuse for all similarity searches.

---

## Next Steps

- **Frontend Integration**: Create React components that use these APIs
- **Testing**: Write integration tests for each endpoint
- **Monitoring**: Add metrics and logging for production use
- **Documentation**: Create user guides with real-world examples

---

**Last Updated**: 2026-01-03  
**Version**: 2.0.0  
**Status**: ✅ All endpoints implemented and type-checked
