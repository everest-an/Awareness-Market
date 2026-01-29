# Awareness Market - P2 Enhanced API Documentation

## Overview

This document provides comprehensive documentation for the 27 new API endpoints introduced in Phase 2 (P2) of the Awareness Market platform. These endpoints enable:

- **Differential Privacy** (4 endpoints) - Privacy-preserving vector uploads
- **Zero-Knowledge Proofs** (9 endpoints) - Anonymous quality verification
- **Multi-Modal Vectors** (8 endpoints) - Cross-modal AI capabilities
- **GPU Acceleration** (6 endpoints) - High-performance vector operations

**Base URL**: `https://api.awareness.market/v2`
**Protocol**: tRPC over HTTP
**Authentication**: JWT Bearer Token (except where noted)

---

## Table of Contents

1. [Differential Privacy API](#differential-privacy-api)
2. [Zero-Knowledge Proof API](#zero-knowledge-proof-api)
3. [Multi-Modal API](#multi-modal-api)
4. [GPU Acceleration API](#gpu-acceleration-api)
5. [Error Handling](#error-handling)
6. [Rate Limiting](#rate-limiting)
7. [Code Examples](#code-examples)

---

## Differential Privacy API

### 1.1 Get Privacy Settings

**Endpoint**: `user.getPrivacySettings`
**Method**: Query
**Auth**: Required

Retrieve current differential privacy configuration.

**Request**:
```typescript
const settings = await trpc.user.getPrivacySettings.query();
```

**Response**:
```json
{
  "differentialPrivacyEnabled": true,
  "defaultEpsilon": 1.0,
  "defaultDelta": 1e-5,
  "monthlyBudget": 10.0,
  "budgetRemaining": 7.5,
  "autoRenewBudget": true,
  "nextResetDate": "2026-02-01T00:00:00.000Z"
}
```

**Fields**:
- `defaultEpsilon` (0.1-10): Privacy parameter, lower = more privacy
- `defaultDelta` (>0): Failure probability, typically 1e-5 to 1e-9
- `monthlyBudget`: Total ε available per month
- `budgetRemaining`: Current available budget
- `nextResetDate`: When budget resets (1st of next month)

---

### 1.2 Update Privacy Settings

**Endpoint**: `user.updatePrivacySettings`
**Method**: Mutation
**Auth**: Required

Configure differential privacy parameters.

**Request**:
```typescript
const result = await trpc.user.updatePrivacySettings.mutate({
  differentialPrivacyEnabled: true,
  defaultEpsilon: 0.5,
  defaultDelta: 1e-6,
  monthlyBudget: 15.0,
  autoRenewBudget: true,
});
```

**Validation**:
- `epsilon`: 0.1 ≤ ε ≤ 10
- `delta`: δ > 0
- `monthlyBudget`: 5 ≤ budget ≤ 50

**Response**:
```json
{
  "success": true,
  "settings": {
    "differentialPrivacyEnabled": true,
    "defaultEpsilon": 0.5,
    ...
  }
}
```

---

### 1.3 Get Privacy Budget History

**Endpoint**: `user.getPrivacyBudgetHistory`
**Method**: Query
**Auth**: Required

Retrieve history of privacy budget consumption.

**Request**:
```typescript
const history = await trpc.user.getPrivacyBudgetHistory.query({
  limit: 30, // Optional, default 30
});
```

**Response**:
```json
{
  "history": [
    {
      "date": "2026-01-29T10:30:00.000Z",
      "budgetUsed": 1.5,
      "budgetRemaining": 8.5
    },
    {
      "date": "2026-01-28T14:20:00.000Z",
      "budgetUsed": 1.0,
      "budgetRemaining": 10.0
    }
  ],
  "totalEntries": 12
}
```

**Use Cases**:
- Track privacy budget consumption over time
- Visualize usage patterns
- Plan future uploads

---

### 1.4 Simulate Privacy

**Endpoint**: `user.simulatePrivacy`
**Method**: Mutation
**Auth**: Required

Test how differential privacy affects a vector.

**Request**:
```typescript
const simulation = await trpc.user.simulatePrivacy.mutate({
  vector: [0.1, 0.2, 0.3, 0.4, 0.5],
  epsilon: 1.0,
  delta: 1e-5,
});
```

**Response**:
```json
{
  "originalVector": [0.1, 0.2, 0.3, 0.4, 0.5],
  "noisyVector": [0.095, 0.213, 0.287, 0.405, 0.492],
  "analysis": {
    "noiseScale": 0.0142,
    "meanNoise": 0.0001,
    "stdDevNoise": 0.0141
  },
  "interpretation": "Noise scale: 0.0142. Lower ε means more noise."
}
```

**Privacy Formula**:
```
σ = (Δf × √(2ln(1.25/δ))) / ε
```
where Δf = 1 (sensitivity)

---

## Zero-Knowledge Proof API

### 2.1 Generate Quality Proof

**Endpoint**: `zkp.generateQualityProof`
**Method**: Mutation
**Auth**: Required

Generate proof that vector quality ≥ threshold WITHOUT revealing the vector.

**Request**:
```typescript
const proof = await trpc.zkp.generateQualityProof.mutate({
  vector: [0.1, 0.2, ...], // Your vector
  qualityScore: 0.9,
  threshold: 0.8, // Optional, default 0.8
});
```

**Response**:
```json
{
  "success": true,
  "proof": {
    "commitment": "0xabc123...",
    "proof": {
      "pi_a": ["0x...", "0x..."],
      "pi_b": [["0x...", "0x..."], ["0x...", "0x..."]],
      "pi_c": ["0x...", "0x..."]
    },
    "publicSignals": {
      "qualityCommitment": "0xdef456...",
      "thresholdProof": "0x789abc...",
      "distributionProof": "0x012def..."
    },
    "metadata": {
      "vectorDimension": 768,
      "qualityThreshold": 0.8,
      "system": "mock",
      "timestamp": "2026-01-29T12:00:00.000Z",
      "expiresAt": "2026-01-29T13:00:00.000Z"
    }
  },
  "verification": {
    "canVerifyWithout": "revealing vector content",
    "proofSize": 1024,
    "expiresAt": "2026-01-29T13:00:00.000Z",
    "createdAt": "2026-01-29T12:00:00.000Z",
    "proofSystem": "mock"
  }
}
```

**Proof Systems**:
- `groth16`: Fast verification, compact proofs (128 bytes)
- `plonk`: Universal setup, medium size (512 bytes)
- `stark`: No trusted setup, larger proofs (2-10 KB)
- `mock`: Testing only

---

### 2.2 Verify Quality Proof

**Endpoint**: `zkp.verifyQualityProof`
**Method**: Mutation
**Auth**: Not required (public verification)

Verify a zero-knowledge quality proof.

**Request**:
```typescript
const verification = await trpc.zkp.verifyQualityProof.mutate({
  proof: { /* proof object from generateQualityProof */ },
});
```

**Response**:
```json
{
  "success": true,
  "verification": {
    "valid": true,
    "proofSystem": "mock",
    "verificationTime": "12.5ms",
    "errorMessage": null
  },
  "proofMetadata": {
    "vectorDimension": 768,
    "qualityThreshold": 0.8,
    ...
  }
}
```

**Error Cases**:
- Expired proof: `verification.valid = false`, `errorMessage: "Proof expired"`
- Invalid proof: `verification.valid = false`, `errorMessage: "Proof verification failed"`
- Tampered proof: `verification.valid = false`

---

### 2.3 Anonymous Purchase

**Endpoint**: `zkp.anonymousPurchase`
**Method**: Mutation
**Auth**: Required

Purchase package anonymously using zero-knowledge proofs.

**Request**:
```typescript
const purchase = await trpc.zkp.anonymousPurchase.mutate({
  packageId: 'pkg_abc123',
  qualityProof: { /* proof from generateQualityProof */ },
  blindedPayment: {
    amount: 14.99,
    blindingFactor: 'random_string_' + Math.random(),
    commitment: 'payment_commit_' + Date.now(),
  },
});
```

**Response**:
```json
{
  "success": true,
  "purchase": {
    "packageId": "pkg_abc123",
    "status": "completed",
    "anonymous": true,
    "price": 14.99,
    "platformFee": 2.998
  },
  "verification": {
    "qualityProofVerified": true,
    "paymentVerified": true,
    "anonymityGuarantee": "ZKP-based (mock implementation)"
  },
  "message": "Anonymous purchase completed successfully",
  "note": "Production implementation requires ring signatures and on-chain verification"
}
```

**Privacy Guarantees**:
1. **Quality Verified**: Seller knows vector meets threshold
2. **Vector Hidden**: Seller never sees actual vector
3. **Identity Protected**: ZKP-based anonymity (mock in current version)

**Platform Fee**: 20% of purchase price

---

### 2.4 Batch Verify Proofs

**Endpoint**: `zkp.batchVerifyProofs`
**Method**: Mutation
**Auth**: Not required

Efficiently verify multiple proofs at once.

**Request**:
```typescript
const results = await trpc.zkp.batchVerifyProofs.mutate({
  proofs: [proof1, proof2, proof3, ...], // Max 100 proofs
});
```

**Response**:
```json
{
  "success": true,
  "batchSize": 10,
  "results": [
    {
      "valid": true,
      "proofSystem": "mock",
      "verificationTime": 10.2,
      "errorMessage": null
    },
    ...
  ],
  "summary": {
    "total": 10,
    "valid": 8,
    "invalid": 2,
    "successRate": "80.0%"
  }
}
```

**Performance**: ~2-5x faster than individual verification

---

### 2.5 Get ZKP Statistics

**Endpoint**: `zkp.getZKPStats`
**Method**: Query
**Auth**: Not required

Retrieve ZKP system performance statistics.

**Request**:
```typescript
const stats = await trpc.zkp.getZKPStats.query();
```

**Response**:
```json
{
  "success": true,
  "stats": {
    "proofsGenerated": 1234,
    "proofsVerified": 1180,
    "successRate": "95.6%",
    "averageProofTime": "125.3ms",
    "averageVerifyTime": "12.7ms"
  },
  "circuit": {
    "system": "mock",
    "constraints": 10000,
    "wires": 15000,
    "publicInputs": 5,
    "privateInputs": 773
  },
  "info": {
    "status": "Ready",
    "description": "Zero-Knowledge Proof system for anonymous quality verification"
  }
}
```

---

### 2.6 Get Recommended Config

**Endpoint**: `zkp.getRecommendedConfig`
**Method**: Query
**Auth**: Not required

Get recommended ZKP configuration for your use case.

**Request**:
```typescript
const config = await trpc.zkp.getRecommendedConfig.query({
  useCase: 'marketplace', // or 'research', 'enterprise', 'medical'
  vectorDimension: 768,
});
```

**Response**:
```json
{
  "success": true,
  "recommended": {
    "system": "groth16",
    "description": "Fast verification for marketplace transactions"
  },
  "estimatedProofSize": "128 bytes (most compact)",
  "estimatedTime": {
    "proving": "50-200ms",
    "verifying": "5-20ms"
  }
}
```

**Use Case Recommendations**:
- `marketplace`: Groth16 (fast, compact)
- `research`: PLONK (universal setup)
- `enterprise`: Groth16 (high performance)
- `medical`: STARK (no trusted setup, maximum security)

---

## Multi-Modal API

### 3.1 Upload Multi-Modal Package

**Endpoint**: `multimodal.uploadMultimodalPackage`
**Method**: Mutation
**Auth**: Required

Upload package with multiple modalities (text, image, audio, video).

**Request**:
```typescript
const result = await trpc.multimodal.uploadMultimodalPackage.mutate({
  name: 'CLIP-like Model',
  description: 'Image-text alignment model',
  modalities: {
    text: {
      vector: [0.1, 0.2, ...], // 512-dim
      dimension: 512,
    },
    image: {
      vector: [0.3, 0.4, ...], // 512-dim
      dimension: 512,
    },
  },
  fusionMethod: 'hybrid', // early | late | hybrid | attention
  fusionWeights: {
    text: 0.5,
    image: 0.5,
  },
  price: 19.99,
  tags: ['vision', 'nlp', 'multimodal'],
});
```

**Fusion Methods**:
1. **Early Fusion**: Concatenate vectors before processing
   - Best for: Correlated modalities
   - Output dim: sum of input dims

2. **Late Fusion**: Process separately, then combine
   - Best for: Independent features
   - Output dim: same as input dims

3. **Hybrid Fusion**: Combine early + late with learned weights
   - Best for: Balanced approach (recommended)
   - Output dim: configurable

4. **Attention Fusion**: Cross-modal attention mechanism
   - Best for: Complex interactions
   - Output dim: same as input dims

**Validation**:
- Minimum 2 modalities required
- Fusion weights must sum to 1.0
- All vectors must be non-empty arrays

**Response**:
```json
{
  "success": true,
  "packageId": "pkg_multimodal_789",
  "modalities": ["text", "image"]
}
```

---

### 3.2 Cross-Modal Search

**Endpoint**: `multimodal.crossModalSearch`
**Method**: Query
**Auth**: Not required

Search with one modality, find in another (e.g., text → image).

**Request**:
```typescript
const results = await trpc.multimodal.crossModalSearch.query({
  queryVector: [0.1, 0.2, ...],
  queryModality: 'text',
  targetModality: 'image', // Optional, searches all if not specified
  limit: 10,
  minSimilarity: 0.7,
});
```

**Response**:
```json
{
  "results": [
    {
      "packageId": "pkg_123",
      "packageName": "Cat Image",
      "modality": "image",
      "similarity": 0.89,
      "dimension": 512,
      "description": "Image of a cat"
    },
    {
      "packageId": "pkg_456",
      "packageName": "Dog Image",
      "modality": "image",
      "similarity": 0.82,
      "dimension": 512
    }
  ],
  "stats": {
    "searchTime": "45.2ms",
    "resultCount": 2,
    "avgSimilarity": 0.855
  }
}
```

**Use Cases**:
- Text → Image: Find images matching text description
- Image → Text: Find text descriptions of images
- Audio → Video: Find videos matching audio
- Any → Any: Cross-modal semantic search

---

## GPU Acceleration API

### 4.1 Get GPU Status

**Endpoint**: `neuralBridge.getGPUStatus`
**Method**: Query
**Auth**: Not required

Retrieve GPU acceleration status and performance metrics.

**Request**:
```typescript
const status = await trpc.neuralBridge.getGPUStatus.query();
```

**Response**:
```json
{
  "backend": "cpu",
  "gpuAvailable": false,
  "gpuDevice": null,
  "memoryUsage": 0,
  "operationsCount": 42,
  "totalTime": 1250.5,
  "averageTime": 29.8
}
```

**With GPU Available**:
```json
{
  "backend": "gpu",
  "gpuAvailable": true,
  "gpuDevice": "NVIDIA GeForce RTX 3090",
  "memoryUsage": 2147483648,
  "operationsCount": 100,
  "totalTime": 500.2,
  "averageTime": 5.0
}
```

**Fields**:
- `backend`: Current compute backend (cpu/gpu/webgl)
- `gpuAvailable`: Whether GPU is available
- `gpuDevice`: GPU device name (if available)
- `memoryUsage`: GPU memory usage in bytes
- `averageTime`: Average operation time in ms

---

### 4.2 Batch Align Vectors

**Endpoint**: `neuralBridge.batchAlignVectors`
**Method**: Mutation
**Auth**: Required

Align batch of vectors using W-Matrix with GPU acceleration.

**Request**:
```typescript
const result = await trpc.neuralBridge.batchAlignVectors.mutate({
  vectors: [
    [0.1, 0.2, 0.3],
    [0.4, 0.5, 0.6],
  ],
  wMatrix: [
    [0.9, 0.1, 0.0],
    [0.1, 0.9, 0.0],
    [0.0, 0.1, 0.9],
  ],
});
```

**Response**:
```json
{
  "alignedVectors": [
    [0.11, 0.19, 0.03],
    [0.41, 0.49, 0.06]
  ],
  "computeTime": 45.2,
  "backend": "gpu",
  "batchSize": 2
}
```

**Performance**:
- CPU: ~100-500ms for 100 vectors (768-dim)
- GPU: ~5-25ms for 100 vectors (768-dim)
- **Speedup**: 10-50x faster with GPU

---

## Error Handling

### Error Response Format

```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Invalid epsilon value: must be between 0.1 and 10",
    "details": {
      "field": "epsilon",
      "value": 15.0,
      "expected": "0.1 ≤ ε ≤ 10"
    }
  }
}
```

### Common Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `BAD_REQUEST` | Invalid input parameters | 400 |
| `UNAUTHORIZED` | Missing or invalid authentication | 401 |
| `FORBIDDEN` | Insufficient permissions | 403 |
| `NOT_FOUND` | Resource not found | 404 |
| `INTERNAL_SERVER_ERROR` | Server error | 500 |

---

## Rate Limiting

### Limits

| Endpoint Type | Rate Limit | Window |
|---------------|------------|--------|
| Privacy | 100 req/min | Per user |
| ZKP Generation | 50 req/min | Per user |
| ZKP Verification | 200 req/min | Global |
| Multi-Modal Upload | 20 req/min | Per user |
| Cross-Modal Search | 100 req/min | Per user |
| GPU Operations | 200 req/min | Per user |

### Rate Limit Headers

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1643644800
```

---

## Code Examples

### Full Privacy-Protected Upload Flow

```typescript
// 1. Check privacy settings
const settings = await trpc.user.getPrivacySettings.query();
console.log(`Budget remaining: ${settings.budgetRemaining} ε`);

// 2. Simulate privacy (optional)
const simulation = await trpc.user.simulatePrivacy.mutate({
  vector: myVector,
  epsilon: 1.0,
  delta: 1e-5,
});
console.log(`Noise scale: ${simulation.analysis.noiseScale}`);

// 3. Upload with privacy
const package = await trpc.packages.createVectorPackage.mutate({
  name: 'My Vector',
  description: 'Description',
  vector: myVector,
  wMatrix: myWMatrix,
  price: 9.99,
  privacy: {
    epsilon: 1.0,
    delta: 1e-5,
  },
});
```

### Anonymous Purchase with ZKP

```typescript
// 1. Generate quality proof
const proof = await trpc.zkp.generateQualityProof.mutate({
  vector: myVector,
  qualityScore: 0.95,
  threshold: 0.8,
});

// 2. Complete anonymous purchase
const purchase = await trpc.zkp.anonymousPurchase.mutate({
  packageId: 'pkg_target',
  qualityProof: proof.proof,
  blindedPayment: {
    amount: 14.99,
    blindingFactor: Math.random().toString(36).substring(7),
    commitment: `commit_${Date.now()}`,
  },
});

console.log(`Purchase completed anonymously: ${purchase.success}`);
```

### Cross-Modal Search

```typescript
// Search for images using text query
const textEmbedding = [0.1, 0.2, ...]; // From text encoder

const results = await trpc.multimodal.crossModalSearch.query({
  queryVector: textEmbedding,
  queryModality: 'text',
  targetModality: 'image',
  limit: 10,
  minSimilarity: 0.75,
});

results.results.forEach(result => {
  console.log(`${result.packageName}: ${result.similarity.toFixed(3)} similarity`);
});
```

---

## Support & Resources

- **API Specification**: [OpenAPI/Swagger YAML](./P2_ENDPOINTS_API_SPEC.yaml)
- **Test Suite**: [Test Results](../../P3_TESTING_RESULTS.md)
- **GitHub Issues**: [Report bugs](https://github.com/awareness-market/issues)
- **Discord Community**: [Join discussion](https://discord.gg/awareness-market)

---

**Documentation Version**: 2.0.0
**Last Updated**: 2026-01-29
**API Status**: ✅ All endpoints operational
