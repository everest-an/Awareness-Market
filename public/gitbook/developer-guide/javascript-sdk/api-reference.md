# API Reference

Complete reference for all classes, methods, types, and interfaces in the Awareness JavaScript/TypeScript SDK.

## AwarenessClient

The main client for interacting with the Awareness Network API.

### Constructor

```typescript
new AwarenessClient(options?: AwarenessClientOptions)
```

#### AwarenessClientOptions

```typescript
interface AwarenessClientOptions {
  apiKey?: string;         // Falls back to AWARENESS_API_KEY env var
  baseUrl?: string;        // Default: "https://api.awareness.market/v1"
  timeout?: number;        // Request timeout in ms. Default: 30000
  maxRetries?: number;     // Auto-retry count. Default: 3
  fetch?: typeof fetch;    // Custom fetch implementation
}
```

### Properties

| Property | Type | Description |
|---|---|---|
| `vectors` | `VectorService` | Service for vector package operations. |
| `memories` | `MemoryService` | Service for KV-Cache memory operations. |
| `chains` | `ChainService` | Service for chain package operations. |
| `marketplace` | `MarketplaceService` | Service for purchasing and account operations. |
| `wmatrix` | `WMatrixService` | Service for W-Matrix alignment operations. |

### Methods

#### `healthCheck()`

```typescript
async healthCheck(): Promise<HealthStatus>
```

Check the API connection and server health.

**Returns:** `Promise<HealthStatus>`

```typescript
interface HealthStatus {
  status: string;
  latencyMs: number;
}
```

#### `destroy()`

```typescript
destroy(): void
```

Abort all in-flight requests and release resources.

---

## VectorService

Accessed via `client.vectors`.

### `search()`

```typescript
async search(params: VectorSearchParams): Promise<VectorPackage[]>
```

#### VectorSearchParams

```typescript
interface VectorSearchParams {
  query: string;               // Natural language search query
  model?: string;              // Filter by target model
  tags?: string[];             // Filter by tags (all must match)
  minRating?: number;          // Minimum rating (0.0 - 5.0)
  maxPrice?: number;           // Maximum price in USDC
  quantization?: string;       // Filter by quantization format
  sortBy?: 'relevance' | 'rating' | 'downloads' | 'price' | 'newest';
  limit?: number;              // Max results (1-100). Default: 20
  offset?: number;             // Pagination offset. Default: 0
}
```

**Returns:** `Promise<VectorPackage[]>`

### `download()`

```typescript
async download(downloadToken: string, options?: DownloadOptions): Promise<VectorPayload>
```

```typescript
interface DownloadOptions {
  outputDir?: string;   // Directory to save the file (Node.js only)
}
```

**Returns:** `Promise<VectorPayload>`

```typescript
interface VectorPayload {
  filename: string;
  sizeMb: number;
  format: string;
  data: Buffer;             // Raw file data (Node.js)
  save(path: string): Promise<void>;  // Save to disk (Node.js)
}
```

### `publish()`

```typescript
async publish(params: VectorPublishParams): Promise<Publication>
```

```typescript
interface VectorPublishParams {
  file: Buffer | ReadableStream;
  metadata: {
    name: string;
    description: string;
    modelCompatibility: string[];
    tags: string[];
    price: number;
    license: string;
  };
}
```

**Returns:** `Promise<Publication>`

### `batchLoad()`

```typescript
async batchLoad(params: BatchLoadParams): Promise<BatchResult[]>
```

```typescript
interface BatchLoadParams {
  packageIds: string[];
  maxConcurrency?: number;     // Default: 4
  outputDir?: string;          // Default: "./downloads/"
  onProgress?: (progress: BatchProgress) => void;
  onLoaded?: (result: BatchResult) => void;
}

interface BatchProgress {
  completed: number;
  total: number;
  currentPackageId: string;
}

interface BatchResult {
  packageId: string;
  success: boolean;
  filename?: string;
  sizeMb?: number;
  error?: string;
}
```

**Returns:** `Promise<BatchResult[]>`

---

## MemoryService

Accessed via `client.memories`.

### `search()`

```typescript
async search(params: MemorySearchParams): Promise<MemoryPackage[]>
```

```typescript
interface MemorySearchParams {
  query: string;
  model?: string;
  contextLength?: number;     // Minimum context length in tokens
  tags?: string[];
  minRating?: number;
  maxPrice?: number;
  sortBy?: 'relevance' | 'rating' | 'downloads' | 'price' | 'newest';
  limit?: number;
  offset?: number;
}
```

**Returns:** `Promise<MemoryPackage[]>`

### `download()`

```typescript
async download(downloadToken: string, options?: DownloadOptions): Promise<MemoryPayload>
```

```typescript
interface MemoryPayload {
  filename: string;
  sizeMb: number;
  tokenCount: number;
  layerRange: [number, number];
  data: Buffer;
  save(path: string): Promise<void>;
}
```

**Returns:** `Promise<MemoryPayload>`

### `publish()`

```typescript
async publish(params: MemoryPublishParams): Promise<Publication>
```

```typescript
interface MemoryPublishParams {
  file: Buffer | ReadableStream;
  metadata: {
    name: string;
    description: string;
    sourceModel: string;
    tokenCount: number;
    layerRange: [number, number];
    tags: string[];
    price: number;
    license: string;
  };
}
```

**Returns:** `Promise<Publication>`

---

## ChainService

Accessed via `client.chains`.

### `search()`

```typescript
async search(params: ChainSearchParams): Promise<ChainPackage[]>
```

```typescript
interface ChainSearchParams {
  query: string;
  category?: string;          // e.g., "reasoning", "coding", "creative"
  tags?: string[];
  minRating?: number;
  maxPrice?: number;
  sortBy?: 'relevance' | 'rating' | 'downloads' | 'price' | 'newest';
  limit?: number;
  offset?: number;
}
```

**Returns:** `Promise<ChainPackage[]>`

### `download()`

```typescript
async download(downloadToken: string, options?: DownloadOptions): Promise<ChainPayload>
```

```typescript
interface ChainPayload {
  filename: string;
  sizeMb: number;
  stepCount: number;
  data: Buffer;
  save(path: string): Promise<void>;
}
```

**Returns:** `Promise<ChainPayload>`

### `publish()`

```typescript
async publish(params: ChainPublishParams): Promise<Publication>
```

```typescript
interface ChainPublishParams {
  file: Buffer | ReadableStream;
  metadata: {
    name: string;
    description: string;
    steps: ChainStepDef[];
    tags: string[];
    price: number;
    license: string;
  };
}

interface ChainStepDef {
  name: string;
  model: string;
  parallel?: boolean;
}
```

**Returns:** `Promise<Publication>`

---

## MarketplaceService

Accessed via `client.marketplace`.

### `purchase()`

```typescript
async purchase(params: PurchaseParams): Promise<PurchaseReceipt>
```

```typescript
interface PurchaseParams {
  packageId: string;
  paymentMethod?: 'balance' | 'crypto';   // Default: 'balance'
}
```

**Returns:** `Promise<PurchaseReceipt>`

### `getBalance()`

```typescript
async getBalance(): Promise<Balance>
```

```typescript
interface Balance {
  available: number;
  pending: number;
  currency: string;
}
```

### `getTransactions()`

```typescript
async getTransactions(params?: TransactionParams): Promise<Transaction[]>
```

```typescript
interface TransactionParams {
  limit?: number;             // Default: 50
  offset?: number;            // Default: 0
  type?: 'purchase' | 'sale' | 'deposit' | 'withdrawal';
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  currency: string;
  description: string;
  createdAt: Date;
}
```

### `getPurchases()`

```typescript
async getPurchases(params?: PaginationParams): Promise<PurchaseRecord[]>
```

```typescript
interface PaginationParams {
  limit?: number;
  offset?: number;
}

interface PurchaseRecord {
  purchaseId: string;
  packageId: string;
  packageName: string;
  amount: number;
  downloadToken: string;
  purchasedAt: Date;
}
```

---

## WMatrixService

Accessed via `client.wmatrix`.

### `align()`

```typescript
async align(params: AlignParams): Promise<AlignmentResult>
```

```typescript
interface AlignParams {
  baseWeights: string | Buffer;
  vectorPackage: string | Buffer | VectorPayload;
  strength?: number;           // 0.0 - 2.0. Default: 1.0
  layers?: number[];           // Specific layers, or all if omitted
  outputPath?: string;
}
```

**Returns:** `Promise<AlignmentResult>`

```typescript
interface AlignmentResult {
  alignmentScore: number;
  layersModified: number;
  totalLayers: number;
  outputPath?: string;
  durationMs: number;
}
```

### `streamAlign()`

```typescript
streamAlign(params: StreamAlignParams): AsyncIterable<AlignmentChunk>
```

```typescript
interface StreamAlignParams {
  baseWeights: string;
  vectorPackageId: string;
  strength?: number;
  layers?: number[];
  outputPath?: string;
}

interface AlignmentChunk {
  layerIndex: number;
  totalLayers: number;
  deltaNorm: number;
  progressPct: number;
  isFinal: boolean;
  alignmentScore?: number;
  outputPath?: string;
}
```

**Usage:**

```typescript
for await (const chunk of client.wmatrix.streamAlign({ ... })) {
  console.log(`${chunk.progressPct}% complete`);
}
```

### `checkCompatibility()`

```typescript
async checkCompatibility(params: CompatibilityParams): Promise<CompatibilityResult>
```

```typescript
interface CompatibilityParams {
  packageId: string;
  targetModel: string;
  targetQuantization?: string;
}

interface CompatibilityResult {
  isCompatible: boolean;
  alignmentScore: number;
  reason?: string;
}
```

### `computeDelta()`

```typescript
async computeDelta(params: DeltaParams): Promise<DeltaResult>
```

```typescript
interface DeltaParams {
  weightsA: string;
  weightsB: string;
  outputPath?: string;
}

interface DeltaResult {
  deltaPath: string;
  deltaNorm: number;
  layerCount: number;
}
```

### `merge()`

```typescript
async merge(params: MergeParams): Promise<MergeResult>
```

```typescript
interface MergeParams {
  packages: (string | VectorPayload)[];
  weights?: number[];           // Relative weight per package
  outputPath?: string;
}

interface MergeResult {
  outputPath: string;
  alignmentScore: number;
  mergedCount: number;
}
```

---

## Shared Types

### VectorPackage

```typescript
interface VectorPackage {
  id: string;
  name: string;
  description: string;
  version: string;
  modelCompatibility: string[];
  tags: string[];
  rating: number;
  downloads: number;
  price: number;
  publisher: Publisher;
  createdAt: Date;
  updatedAt: Date;
}
```

### MemoryPackage

```typescript
interface MemoryPackage {
  id: string;
  name: string;
  description: string;
  sourceModel: string;
  tokenCount: number;
  layerRange: [number, number];
  tags: string[];
  rating: number;
  downloads: number;
  price: number;
  publisher: Publisher;
  createdAt: Date;
  updatedAt: Date;
}
```

### ChainPackage

```typescript
interface ChainPackage {
  id: string;
  name: string;
  description: string;
  stepCount: number;
  stepNames: string[];
  requiredModels: string[];
  category: string;
  tags: string[];
  rating: number;
  downloads: number;
  price: number;
  publisher: Publisher;
  createdAt: Date;
  updatedAt: Date;
}
```

### PurchaseReceipt

```typescript
interface PurchaseReceipt {
  purchaseId: string;
  packageId: string;
  downloadToken: string;
  amount: number;
  currency: string;
  expiresAt: Date;
}
```

### Publication

```typescript
interface Publication {
  packageId: string;
  reviewStatus: 'pending' | 'approved' | 'rejected';
  url: string;
  createdAt: Date;
}
```

### Publisher

```typescript
interface Publisher {
  id: string;
  name: string;
  verified: boolean;
}
```

---

## Exceptions

All errors extend `AwarenessAPIError`.

| Class | HTTP Status | Description |
|---|---|---|
| `AwarenessAPIError` | Any | Base error class. |
| `AuthenticationError` | 401 | Invalid or expired API key. |
| `AuthorizationError` | 403 | Insufficient permissions. |
| `PackageNotFoundError` | 404 | Package does not exist or has been delisted. |
| `ValidationError` | 422 | Invalid request parameters. |
| `InsufficientFundsError` | 402 | Account balance too low. |
| `RateLimitError` | 429 | Rate limit exceeded. |
| `ServerError` | 500+ | Server-side error. |

### Error Properties

```typescript
class AwarenessAPIError extends Error {
  statusCode: number;
  message: string;
  requestId: string;
}

class InsufficientFundsError extends AwarenessAPIError {
  required: number;
  available: number;
}

class RateLimitError extends AwarenessAPIError {
  retryAfter: number;   // Seconds until rate limit resets
}
```
