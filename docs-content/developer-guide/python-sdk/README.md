# Python SDK

The Awareness Python SDK provides a comprehensive interface for interacting with the Awareness Network marketplace, W-Matrix alignment engine, and all three product lines: Vector Packages, KV-Cache Memories, and Chain Packages.

## Key Features

- **Synchronous and Asynchronous Clients** -- Use `AwarenessClient` for synchronous workflows or `AsyncAwarenessClient` for high-throughput async applications.
- **Streaming Support** -- Stream W-Matrix alignment results in real time with `stream_align()`, enabling progressive UI updates and large-scale alignment jobs.
- **Batch Operations** -- Load and process multiple packages concurrently with `batch_load()`, optimized for pipeline workloads.
- **W-Matrix Alignment** -- First-class support for the W-Matrix alignment protocol, including compatibility checks, delta computation, and merge operations.
- **Marketplace Operations** -- Search, purchase, download, and publish across all three product lines from a single unified client.
- **Type Safety** -- Full type annotations throughout the SDK, with Pydantic models for all request and response types.

## Product Lines

The SDK provides access to all three Awareness marketplace product lines:

| Product Line | Description | Primary Use Case |
|---|---|---|
| **Vector Packages** | Pre-trained weight vectors and LoRA adapters | Model fine-tuning and specialization |
| **KV-Cache Memories** | Serialized key-value cache snapshots | Context injection and memory transfer |
| **Chain Packages** | Composable inference chains and workflows | Multi-step reasoning pipelines |

## Architecture

```
Your Application
       |
       v
+------------------+
| AwarenessClient  |  <-- Synchronous client
|   or             |
| AsyncAwareness   |  <-- Asynchronous client
|   Client         |
+------------------+
       |
       v
+------------------+
| WMatrixService   |  <-- Alignment engine
+------------------+
       |
       v
+------------------+
| REST API (tRPC)  |  <-- Awareness Network backend
+------------------+
```

## Quick Example

```python
from awareness_sdk import AwarenessClient

client = AwarenessClient(api_key="aw_live_...")

# Search for vector packages
results = client.vectors.search("reasoning-boost", model="llama-3.1-70b")

# Purchase and download
package = client.marketplace.purchase(results[0].id)
weights = client.vectors.download(package.download_token)

# Apply W-Matrix alignment
aligned = client.wmatrix.align(
    base_weights=my_model_weights,
    vector_package=weights,
    strength=0.7
)
```

## Next Steps

- [Installation](installation.md) -- Get the SDK installed in your environment.
- [Quick Start](quick-start.md) -- Walk through your first integration end to end.
- [Async and Streaming](async-and-streaming.md) -- Scale up with async clients and streaming alignment.
- [API Reference](api-reference.md) -- Complete reference for every class and method.
