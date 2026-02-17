# Quick Start

This guide covers the core workflows for the JavaScript/TypeScript SDK: initializing the client, searching all three product lines, purchasing, and downloading packages.

## Initialize the Client

```typescript
import { AwarenessClient } from '@awareness/sdk';

const client = new AwarenessClient({
  apiKey: 'aw_live_your_api_key_here',
  // Optional overrides:
  // baseUrl: 'https://api.awareness.market/v1',
  // timeout: 30_000,
  // maxRetries: 3,
});
```

{% hint style="info" %}
If the `AWARENESS_API_KEY` environment variable is set, you can omit the `apiKey` option:
```typescript
const client = new AwarenessClient();
```
{% endhint %}

## Search for Packages

### Vector Packages

Search for pre-trained weight vectors and LoRA adapters:

```typescript
const vectorResults = await client.vectors.search({
  query: 'code-generation',
  model: 'llama-3.1-70b',
  minRating: 4.0,
  limit: 10,
});

for (const pkg of vectorResults) {
  console.log(`${pkg.name} (v${pkg.version})`);
  console.log(`  Compatibility: ${pkg.modelCompatibility.join(', ')}`);
  console.log(`  Rating: ${pkg.rating}/5 (${pkg.downloads} downloads)`);
  console.log(`  Price: ${pkg.price} USDC`);
}
```

### KV-Cache Memories

Search for serialized key-value cache snapshots:

```typescript
const memoryResults = await client.memories.search({
  query: 'medical-terminology',
  model: 'llama-3.1-8b',
  contextLength: 8192,
  limit: 5,
});

for (const mem of memoryResults) {
  console.log(`${mem.name} -- Tokens: ${mem.tokenCount}`);
  console.log(`  Source model: ${mem.sourceModel}`);
  console.log(`  Layers: ${mem.layerRange[0]}-${mem.layerRange[1]}`);
  console.log(`  Price: ${mem.price} USDC`);
}
```

### Chain Packages

Search for composable inference chains and workflows:

```typescript
const chainResults = await client.chains.search({
  query: 'research-assistant',
  category: 'reasoning',
  limit: 5,
});

for (const chain of chainResults) {
  console.log(`${chain.name} -- Steps: ${chain.stepCount}`);
  console.log(`  Pipeline: ${chain.stepNames.join(' -> ')}`);
  console.log(`  Models: ${chain.requiredModels.join(', ')}`);
  console.log(`  Price: ${chain.price} USDC`);
}
```

## Purchase a Package

Purchasing works the same way across all product lines:

```typescript
const receipt = await client.marketplace.purchase({
  packageId: vectorResults[0].id,
  paymentMethod: 'balance', // or 'crypto'
});

console.log(`Purchase ID: ${receipt.purchaseId}`);
console.log(`Download token: ${receipt.downloadToken}`);
console.log(`Expires at: ${receipt.expiresAt.toISOString()}`);
```

## Download a Package

Use the download token to retrieve package contents:

```typescript
// Download vector weights
const weights = await client.vectors.download(receipt.downloadToken);
console.log(`File: ${weights.filename} (${weights.sizeMb.toFixed(1)} MB)`);
console.log(`Format: ${weights.format}`);

// Save to disk (Node.js)
await weights.save('./downloads/reasoning-boost.safetensors');
```

```typescript
// Download a KV-Cache memory
const memory = await client.memories.download(memoryReceipt.downloadToken);
await memory.save('./downloads/medical-memory.awkv');
```

```typescript
// Download a chain package
const chain = await client.chains.download(chainReceipt.downloadToken);
await chain.save('./downloads/research-chain.awchain');
```

## Check Model Compatibility

Before purchasing, verify compatibility with your target environment:

```typescript
const compat = await client.wmatrix.checkCompatibility({
  packageId: 'pkg_abc123',
  targetModel: 'llama-3.1-70b',
  targetQuantization: 'q4_k_m',
});

console.log(`Compatible: ${compat.isCompatible}`);
console.log(`Alignment score: ${compat.alignmentScore.toFixed(3)}`);

if (!compat.isCompatible) {
  console.log(`Reason: ${compat.reason}`);
}
```

## Publish a Package

Share your own packages on the marketplace:

```typescript
import { readFile } from 'node:fs/promises';

const publication = await client.vectors.publish({
  file: await readFile('./my-vectors/reasoning-boost.safetensors'),
  metadata: {
    name: 'my-reasoning-boost',
    description: 'Fine-tuned reasoning improvement for Llama 3.1 70B',
    modelCompatibility: ['llama-3.1-70b', 'llama-3.1-70b-instruct'],
    tags: ['reasoning', 'logic', 'math'],
    price: 2.5,
    license: 'awareness-open-1.0',
  },
});

console.log(`Published! Package ID: ${publication.packageId}`);
console.log(`Review status: ${publication.reviewStatus}`);
console.log(`URL: ${publication.url}`);
```

## Streaming Alignment

Stream W-Matrix alignment results as they are computed:

```typescript
const stream = client.wmatrix.streamAlign({
  baseWeights: './models/llama-3.1-70b/',
  vectorPackageId: 'pkg_abc123',
  strength: 0.7,
});

for await (const chunk of stream) {
  console.log(
    `[${chunk.progressPct.toFixed(1)}%] ` +
    `Layer ${chunk.layerIndex}/${chunk.totalLayers} ` +
    `delta_norm=${chunk.deltaNorm.toFixed(4)}`
  );

  if (chunk.isFinal) {
    console.log(`\nAlignment complete. Score: ${chunk.alignmentScore!.toFixed(4)}`);
  }
}
```

## Error Handling

The SDK throws typed errors for all failure conditions:

```typescript
import {
  AuthenticationError,
  InsufficientFundsError,
  PackageNotFoundError,
  RateLimitError,
  AwarenessAPIError,
} from '@awareness/sdk';

try {
  const receipt = await client.marketplace.purchase({
    packageId: 'pkg_xyz',
  });
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.error('Invalid or expired API key.');
  } else if (error instanceof InsufficientFundsError) {
    console.error(`Balance too low. Required: ${error.required}, Available: ${error.available}`);
  } else if (error instanceof PackageNotFoundError) {
    console.error('Package not found or delisted.');
  } else if (error instanceof RateLimitError) {
    console.error(`Rate limited. Retry after ${error.retryAfter} seconds.`);
  } else if (error instanceof AwarenessAPIError) {
    console.error(`API error ${error.statusCode}: ${error.message}`);
  }
}
```

## Concurrent Operations

Run multiple independent requests in parallel with `Promise.all`:

```typescript
const [vectors, memories, chains] = await Promise.all([
  client.vectors.search({ query: 'reasoning', model: 'llama-3.1-70b' }),
  client.memories.search({ query: 'medical', model: 'llama-3.1-8b' }),
  client.chains.search({ query: 'research-pipeline' }),
]);

console.log(`Vectors: ${vectors.length} results`);
console.log(`Memories: ${memories.length} results`);
console.log(`Chains: ${chains.length} results`);
```

## Next Steps

- [API Reference](api-reference.md) -- Complete reference for all classes, methods, and types.
