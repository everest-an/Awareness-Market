# JavaScript / TypeScript SDK

The Awareness JavaScript SDK (`@awareness/sdk`) provides a fully typed client for interacting with the Awareness Network marketplace, W-Matrix alignment engine, and all three product lines from Node.js and browser environments.

## Key Features

- **TypeScript First** -- Written in TypeScript with complete type definitions. Works seamlessly in both TypeScript and JavaScript projects.
- **Isomorphic** -- Runs in Node.js (18+) and modern browsers. Uses `fetch` under the hood with environment-appropriate polyfills.
- **Promise-Based** -- All methods return Promises. Compatible with `async/await` and traditional `.then()` chains.
- **Streaming** -- Stream W-Matrix alignment results via async iterables and ReadableStream.
- **Tree-Shakeable** -- ESM-first with named exports. Bundlers eliminate unused code automatically.
- **Marketplace Operations** -- Search, purchase, download, and publish across Vector Packages, KV-Cache Memories, and Chain Packages.

## Product Lines

| Product Line | Description | Primary Use Case |
|---|---|---|
| **Vector Packages** | Pre-trained weight vectors and LoRA adapters | Model fine-tuning and specialization |
| **KV-Cache Memories** | Serialized key-value cache snapshots | Context injection and memory transfer |
| **Chain Packages** | Composable inference chains and workflows | Multi-step reasoning pipelines |

## Quick Example

```typescript
import { AwarenessClient } from '@awareness/sdk';

const client = new AwarenessClient({
  apiKey: 'aw_live_...',
});

// Search for vector packages
const results = await client.vectors.search({
  query: 'reasoning-boost',
  model: 'llama-3.1-70b',
});

// Purchase and download
const receipt = await client.marketplace.purchase({
  packageId: results[0].id,
});

const weights = await client.vectors.download(receipt.downloadToken);
console.log(`Downloaded: ${weights.filename} (${weights.sizeMb} MB)`);
```

## Architecture

```
Your Application (Node.js / Browser)
          |
          v
+---------------------+
|  AwarenessClient    |
+---------------------+
  |        |        |
  v        v        v
Vectors  Memories  Chains    <-- Service modules
  |        |        |
  v        v        v
Marketplace  WMatrix          <-- Shared services
          |
          v
+---------------------+
|  REST API (tRPC)    |
+---------------------+
```

## Next Steps

- [Installation](installation.md) -- Install the SDK in your project.
- [Quick Start](quick-start.md) -- Build your first integration.
- [API Reference](api-reference.md) -- Complete reference for all classes and methods.
