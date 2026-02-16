# Async and Streaming

The Awareness Python SDK provides an asynchronous client and streaming interfaces for high-throughput and real-time workloads.

{% hint style="info" %}
Async and streaming features require optional dependencies. Install them with:
```bash
pip install awareness-sdk[async,streaming]
# or install everything:
pip install awareness-sdk[all]
```
{% endhint %}

## Async Client

`AsyncAwarenessClient` provides the same API surface as the synchronous `AwarenessClient`, but all methods are coroutines that can be awaited.

### Basic Usage

```python
import asyncio
from awareness_sdk import AsyncAwarenessClient

async def main():
    client = AsyncAwarenessClient(api_key="aw_live_...")

    # Search is now awaitable
    results = await client.vectors.search(
        query="code-generation",
        model="llama-3.1-70b",
        limit=5
    )

    for pkg in results:
        print(f"{pkg.name}: {pkg.rating}/5")

    # Always close the client when done to release connections
    await client.close()

asyncio.run(main())
```

### Context Manager

Use the async context manager to ensure the client session is properly closed:

```python
import asyncio
from awareness_sdk import AsyncAwarenessClient

async def main():
    async with AsyncAwarenessClient(api_key="aw_live_...") as client:
        results = await client.vectors.search(
            query="reasoning",
            model="llama-3.1-70b"
        )
        print(f"Found {len(results)} packages")

asyncio.run(main())
```

### Concurrent Operations

Run multiple independent API calls concurrently with `asyncio.gather`:

```python
import asyncio
from awareness_sdk import AsyncAwarenessClient

async def main():
    async with AsyncAwarenessClient(api_key="aw_live_...") as client:
        # Run three searches in parallel
        vector_results, memory_results, chain_results = await asyncio.gather(
            client.vectors.search(query="reasoning", model="llama-3.1-70b"),
            client.memories.search(query="medical", model="llama-3.1-8b"),
            client.chains.search(query="research-pipeline"),
        )

        print(f"Vectors: {len(vector_results)} results")
        print(f"Memories: {len(memory_results)} results")
        print(f"Chains:  {len(chain_results)} results")

asyncio.run(main())
```

### Async Purchase and Download

```python
import asyncio
from awareness_sdk import AsyncAwarenessClient

async def purchase_and_download(client, package_id):
    """Purchase a package and download it asynchronously."""
    receipt = await client.marketplace.purchase(package_id=package_id)
    weights = await client.vectors.download(receipt.download_token)
    await weights.save_async("./downloads/" + weights.filename)
    return weights

async def main():
    async with AsyncAwarenessClient(api_key="aw_live_...") as client:
        results = await client.vectors.search(
            query="code-generation",
            model="llama-3.1-70b",
            limit=3
        )

        # Purchase and download the top 3 results concurrently
        tasks = [
            purchase_and_download(client, pkg.id)
            for pkg in results
        ]
        downloaded = await asyncio.gather(*tasks)

        for w in downloaded:
            print(f"Downloaded: {w.filename} ({w.size_mb:.1f} MB)")

asyncio.run(main())
```

## Streaming Alignment

The `stream_align()` method streams W-Matrix alignment results as they are computed, enabling real-time progress updates and incremental processing of large alignment jobs.

### How Streaming Works

Instead of waiting for the entire alignment to complete, `stream_align()` yields `AlignmentChunk` objects as each layer or segment is processed on the server. This is useful for:

- Displaying progress bars in CLI or web interfaces
- Processing aligned layers incrementally to reduce peak memory usage
- Cancelling long-running alignment jobs early if intermediate results are unsatisfactory

### Basic Streaming Example

```python
from awareness_sdk import AwarenessClient

client = AwarenessClient(api_key="aw_live_...")

# Start a streaming alignment
stream = client.wmatrix.stream_align(
    base_weights="./models/llama-3.1-70b/",
    vector_package_id="pkg_abc123",
    strength=0.7
)

for chunk in stream:
    print(
        f"Layer {chunk.layer_index}/{chunk.total_layers} "
        f"-- delta_norm: {chunk.delta_norm:.4f} "
        f"-- progress: {chunk.progress_pct:.1f}%"
    )

    if chunk.is_final:
        print(f"\nAlignment complete. Output saved to: {chunk.output_path}")
        print(f"Total alignment score: {chunk.alignment_score:.4f}")
```

### Async Streaming

Streaming also works with the async client using `async for`:

```python
import asyncio
from awareness_sdk import AsyncAwarenessClient

async def stream_alignment():
    async with AsyncAwarenessClient(api_key="aw_live_...") as client:
        stream = client.wmatrix.stream_align(
            base_weights="./models/llama-3.1-70b/",
            vector_package_id="pkg_abc123",
            strength=0.7
        )

        async for chunk in stream:
            print(
                f"[{chunk.progress_pct:5.1f}%] "
                f"Layer {chunk.layer_index}/{chunk.total_layers}"
            )

            if chunk.is_final:
                print(f"Done. Score: {chunk.alignment_score:.4f}")

asyncio.run(stream_alignment())
```

### Streaming with Early Cancellation

You can cancel a streaming alignment if intermediate results indicate a problem:

```python
from awareness_sdk import AwarenessClient

client = AwarenessClient(api_key="aw_live_...")

stream = client.wmatrix.stream_align(
    base_weights="./models/llama-3.1-70b/",
    vector_package_id="pkg_abc123",
    strength=0.7
)

for chunk in stream:
    print(f"Layer {chunk.layer_index}: delta_norm={chunk.delta_norm:.4f}")

    # Cancel if delta norms are too high (indicating poor alignment)
    if chunk.delta_norm > 2.0:
        print("Delta norm too high -- cancelling alignment.")
        stream.cancel()
        break
```

### AlignmentChunk Fields

Each `AlignmentChunk` yielded by `stream_align()` contains:

| Field | Type | Description |
|---|---|---|
| `layer_index` | `int` | Current layer being processed |
| `total_layers` | `int` | Total number of layers in the model |
| `delta_norm` | `float` | L2 norm of the weight delta for this layer |
| `progress_pct` | `float` | Percentage of alignment completed (0--100) |
| `is_final` | `bool` | `True` for the last chunk in the stream |
| `alignment_score` | `float \| None` | Overall alignment score (only on final chunk) |
| `output_path` | `str \| None` | Path to the output file (only on final chunk) |

## Batch Loading

The `batch_load()` method downloads and loads multiple packages concurrently, with configurable parallelism and progress tracking.

### Basic Batch Load

```python
from awareness_sdk import AwarenessClient

client = AwarenessClient(api_key="aw_live_...")

# Provide a list of package IDs to load
package_ids = [
    "pkg_reasoning_001",
    "pkg_code_gen_042",
    "pkg_math_boost_017",
    "pkg_creative_writing_003",
]

results = client.vectors.batch_load(
    package_ids=package_ids,
    max_concurrency=4,         # Download up to 4 packages in parallel
    output_dir="./downloads/", # Save all packages to this directory
    on_progress=lambda p: print(f"Progress: {p.completed}/{p.total}")
)

for result in results:
    if result.success:
        print(f"Loaded: {result.filename} ({result.size_mb:.1f} MB)")
    else:
        print(f"Failed: {result.package_id} -- {result.error}")
```

### Async Batch Load

```python
import asyncio
from awareness_sdk import AsyncAwarenessClient

async def main():
    async with AsyncAwarenessClient(api_key="aw_live_...") as client:
        package_ids = [
            "pkg_reasoning_001",
            "pkg_code_gen_042",
            "pkg_math_boost_017",
        ]

        results = await client.vectors.batch_load(
            package_ids=package_ids,
            max_concurrency=8,
            output_dir="./downloads/"
        )

        succeeded = [r for r in results if r.success]
        failed = [r for r in results if not r.success]

        print(f"Downloaded {len(succeeded)}/{len(results)} packages")
        for f in failed:
            print(f"  Failed: {f.package_id}: {f.error}")

asyncio.run(main())
```

### Batch Load with Custom Processing

Use the `on_loaded` callback to process each package as it finishes downloading, without waiting for the entire batch:

```python
from awareness_sdk import AwarenessClient

client = AwarenessClient(api_key="aw_live_...")

def process_package(result):
    """Called as each package finishes downloading."""
    if result.success:
        print(f"Processing {result.filename}...")
        # Apply alignment, merge weights, etc.
    else:
        print(f"Skipping {result.package_id}: {result.error}")

client.vectors.batch_load(
    package_ids=["pkg_001", "pkg_002", "pkg_003"],
    max_concurrency=4,
    output_dir="./downloads/",
    on_loaded=process_package
)
```

## Integration with Web Frameworks

### FastAPI Example

```python
from fastapi import FastAPI
from awareness_sdk import AsyncAwarenessClient

app = FastAPI()
client = AsyncAwarenessClient(api_key="aw_live_...")

@app.on_event("shutdown")
async def shutdown():
    await client.close()

@app.get("/search/vectors")
async def search_vectors(query: str, model: str = "llama-3.1-70b"):
    results = await client.vectors.search(query=query, model=model, limit=10)
    return [
        {
            "id": pkg.id,
            "name": pkg.name,
            "rating": pkg.rating,
            "price": pkg.price,
        }
        for pkg in results
    ]
```

### Django with async views

```python
from django.http import JsonResponse
from awareness_sdk import AsyncAwarenessClient

client = AsyncAwarenessClient(api_key="aw_live_...")

async def search_memories(request):
    query = request.GET.get("q", "")
    model = request.GET.get("model", "llama-3.1-8b")

    results = await client.memories.search(query=query, model=model, limit=10)

    return JsonResponse({
        "results": [
            {"id": m.id, "name": m.name, "token_count": m.token_count}
            for m in results
        ]
    })
```

## Next Steps

- [API Reference](api-reference.md) -- Full documentation of all classes, methods, and parameters.
