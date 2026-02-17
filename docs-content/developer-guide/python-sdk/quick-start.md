# Quick Start

This guide walks through the core SDK workflows: initializing a client, searching across all three product lines, purchasing, downloading, and publishing packages.

## Initialize the Client

```python
from awareness_sdk import AwarenessClient

client = AwarenessClient(
    api_key="aw_live_your_api_key_here",
    # Optional: override the default API base URL
    # base_url="https://api.awareness.market/v1"
)
```

{% hint style="info" %}
You can also set the `AWARENESS_API_KEY` environment variable instead of passing the key directly. The client reads it automatically when no `api_key` argument is provided.
{% endhint %}

## Search for Packages

The SDK exposes dedicated service objects for each of the three product lines.

### Vector Packages

Vector packages contain pre-trained weight vectors, LoRA adapters, and model deltas for fine-tuning and specialization.

```python
# Search for vector packages compatible with a specific model
results = client.vectors.search(
    query="code-generation",
    model="llama-3.1-70b",
    min_rating=4.0,
    limit=10
)

for pkg in results:
    print(f"{pkg.name} (v{pkg.version}) -- {pkg.description}")
    print(f"  Compatibility: {pkg.model_compatibility}")
    print(f"  Rating: {pkg.rating}/5 ({pkg.downloads} downloads)")
    print(f"  Price: {pkg.price} USDC")
    print()
```

### KV-Cache Memories

KV-Cache memories are serialized key-value cache snapshots that enable context injection, persona transfer, and memory sharing between model instances.

```python
# Search for KV-Cache memory packages
results = client.memories.search(
    query="medical-terminology",
    model="llama-3.1-8b",
    context_length=8192,
    limit=5
)

for mem in results:
    print(f"{mem.name} -- Context tokens: {mem.token_count}")
    print(f"  Source model: {mem.source_model}")
    print(f"  Cache layers: {mem.layer_range}")
    print(f"  Price: {mem.price} USDC")
    print()
```

### Chain Packages

Chain packages define composable inference chains and multi-step reasoning workflows that can be executed across distributed nodes.

```python
# Search for chain packages
results = client.chains.search(
    query="research-assistant",
    category="reasoning",
    limit=5
)

for chain in results:
    print(f"{chain.name} -- Steps: {chain.step_count}")
    print(f"  Pipeline: {' -> '.join(chain.step_names)}")
    print(f"  Required models: {chain.required_models}")
    print(f"  Price: {chain.price} USDC")
    print()
```

## Purchase a Package

Purchasing works the same way across all product lines. You pass the package ID to the marketplace service and receive a purchase receipt with a download token.

```python
# Purchase a vector package
receipt = client.marketplace.purchase(
    package_id=results[0].id,
    payment_method="balance"  # or "crypto" for on-chain payment
)

print(f"Purchase ID: {receipt.purchase_id}")
print(f"Download token: {receipt.download_token}")
print(f"Expires at: {receipt.expires_at}")
```

## Download a Package

Use the download token from the purchase receipt to retrieve the package contents.

```python
# Download vector weights
weights = client.vectors.download(receipt.download_token)
print(f"Downloaded: {weights.filename} ({weights.size_mb:.1f} MB)")
print(f"Format: {weights.format}")  # e.g., "safetensors", "gguf"

# Save to disk
weights.save("./downloads/reasoning-boost.safetensors")
```

```python
# Download a KV-Cache memory
memory = client.memories.download(receipt.download_token)
print(f"Layers: {memory.layer_range}")
print(f"Token count: {memory.token_count}")

# Save to disk
memory.save("./downloads/medical-memory.awkv")
```

```python
# Download a chain package
chain = client.chains.download(receipt.download_token)
print(f"Steps: {chain.step_count}")

# Save to disk
chain.save("./downloads/research-chain.awchain")
```

## Publish a Package

Share your own trained vectors, cached memories, or inference chains on the marketplace.

### Publish a Vector Package

```python
from awareness_sdk.models import VectorPackageMeta

meta = VectorPackageMeta(
    name="my-reasoning-boost",
    description="Fine-tuned reasoning improvement for Llama 3.1 70B",
    model_compatibility=["llama-3.1-70b", "llama-3.1-70b-instruct"],
    tags=["reasoning", "logic", "math"],
    price=2.50,           # USDC
    license="awareness-open-1.0"
)

publication = client.vectors.publish(
    file_path="./my-vectors/reasoning-boost.safetensors",
    metadata=meta
)

print(f"Published! Package ID: {publication.package_id}")
print(f"Review status: {publication.review_status}")
print(f"Marketplace URL: {publication.url}")
```

### Publish a KV-Cache Memory

```python
from awareness_sdk.models import MemoryPackageMeta

meta = MemoryPackageMeta(
    name="legal-corpus-context",
    description="KV-Cache snapshot trained on 50K legal documents",
    source_model="llama-3.1-8b",
    token_count=4096,
    layer_range=(0, 32),
    tags=["legal", "context", "documents"],
    price=1.00,
    license="awareness-open-1.0"
)

publication = client.memories.publish(
    file_path="./my-caches/legal-context.awkv",
    metadata=meta
)

print(f"Published! Package ID: {publication.package_id}")
```

### Publish a Chain Package

```python
from awareness_sdk.models import ChainPackageMeta, ChainStep

meta = ChainPackageMeta(
    name="deep-research-chain",
    description="Multi-step research pipeline with source verification",
    steps=[
        ChainStep(name="query-expansion", model="llama-3.1-70b"),
        ChainStep(name="parallel-search", model="llama-3.1-8b", parallel=True),
        ChainStep(name="synthesis", model="llama-3.1-70b"),
        ChainStep(name="fact-check", model="llama-3.1-70b"),
    ],
    tags=["research", "reasoning", "multi-step"],
    price=5.00,
    license="awareness-open-1.0"
)

publication = client.chains.publish(
    file_path="./my-chains/research-chain.awchain",
    metadata=meta
)

print(f"Published! Package ID: {publication.package_id}")
```

## Check Model Compatibility

Before purchasing, verify that a package is compatible with your target model and hardware:

```python
compat = client.wmatrix.check_compatibility(
    package_id="pkg_abc123",
    target_model="llama-3.1-70b",
    target_quantization="q4_k_m"
)

print(f"Compatible: {compat.is_compatible}")
print(f"Alignment score: {compat.alignment_score:.3f}")
if not compat.is_compatible:
    print(f"Reason: {compat.reason}")
```

## Error Handling

The SDK raises typed exceptions for all error conditions:

```python
from awareness_sdk.exceptions import (
    AuthenticationError,
    InsufficientFundsError,
    PackageNotFoundError,
    RateLimitError,
    AwarenessAPIError,
)

try:
    receipt = client.marketplace.purchase(package_id="pkg_xyz")
except AuthenticationError:
    print("Invalid or expired API key.")
except InsufficientFundsError as e:
    print(f"Balance too low. Required: {e.required}, Available: {e.available}")
except PackageNotFoundError:
    print("Package does not exist or has been delisted.")
except RateLimitError as e:
    print(f"Rate limited. Retry after {e.retry_after} seconds.")
except AwarenessAPIError as e:
    print(f"API error {e.status_code}: {e.message}")
```

## Next Steps

- [Async and Streaming](async-and-streaming.md) -- Use the async client for high-throughput workflows and stream alignment results in real time.
- [API Reference](api-reference.md) -- Detailed reference for every class and method in the SDK.
