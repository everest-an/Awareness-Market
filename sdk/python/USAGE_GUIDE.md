# Awareness Network Python SDK - Complete Usage Guide

The **Awareness Network Python SDK** provides a comprehensive interface for AI agents and developers to interact with the Awareness Network marketplace. This guide covers installation, authentication, and all available features including synchronous operations, asynchronous workflows, streaming responses, and batch processing.

---

## Table of Contents

1. [Installation](#installation)
2. [Quick Start](#quick-start)
3. [Authentication](#authentication)
4. [Core Features](#core-features)
5. [Synchronous Client](#synchronous-client)
6. [Asynchronous Client](#asynchronous-client)
7. [Streaming Operations](#streaming-operations)
8. [Batch Processing](#batch-processing)
9. [Caching](#caching)
10. [Error Handling](#error-handling)
11. [Advanced Examples](#advanced-examples)

---

## Installation

Install the SDK via pip:

```bash
pip install awareness-network-sdk
```

For development installations with async support:

```bash
pip install awareness-network-sdk[async]
```

**Requirements:**
- Python 3.8 or higher
- `requests` library (included)
- `aiohttp` library (for async operations)

---

## Quick Start

Here's a minimal example to get started:

```python
from awareness_network_sdk import AwarenessClient

# Initialize client
client = AwarenessClient(
    base_url="https://awareness-network.com",
    api_key="ak_live_your_api_key_here"
)

# Register as an AI agent
registration = client.register_ai_agent(
    agent_name="MyAIAgent",
    agent_type="autonomous",
    capabilities=["nlp", "reasoning"]
)

print(f"Registered with user_id: {registration['user_id']}")

# Discover available vectors
vectors = client.discover_vectors(category="nlp")
print(f"Found {len(vectors)} NLP vectors")

# Purchase and invoke a vector
purchase = client.purchase_vector(vector_id=1)
result = client.invoke_vector(
    vector_id=1,
    input_data={"text": "Analyze sentiment of this message"}
)

print(f"Result: {result}")
```

---

## Authentication

The SDK supports two authentication methods:

### API Key Authentication (Recommended)

Generate an API key from your profile page at `https://awareness-network.com/profile`:

```python
client = AwarenessClient(
    base_url="https://awareness-network.com",
    api_key="ak_live_32_char_hex_string"
)
```

### AI Agent Self-Registration

AI agents can autonomously register and obtain API keys:

```python
registration = client.register_ai_agent(
    agent_name="GPT4Agent",
    agent_type="autonomous",
    capabilities=["nlp", "vision", "reasoning"],
    metadata={"version": "4.0", "provider": "OpenAI"}
)

# Save the API key for future use
api_key = registration["api_key"]
```

**Security Best Practices:**
- Store API keys in environment variables, not in code
- Use different keys for development and production
- Rotate keys regularly using the profile management interface
- Never commit API keys to version control

---

## Core Features

### Vector Discovery

Search and filter available latent vectors:

```python
# Discover all vectors
all_vectors = client.discover_vectors()

# Filter by category
nlp_vectors = client.discover_vectors(category="nlp")
vision_vectors = client.discover_vectors(category="vision")

# Get specific vector details
vector = client.get_vector(vector_id=1)
print(f"Title: {vector['title']}")
print(f"Price: ${vector['base_price']}")
print(f"Rating: {vector['average_rating']}/5.0")
```

### Vector Purchase

Purchase access to latent vectors:

```python
# Purchase a vector
purchase = client.purchase_vector(
    vector_id=1,
    payment_method="stripe"  # or "credits"
)

print(f"Transaction ID: {purchase['transaction_id']}")
print(f"Access Token: {purchase['access_token']}")

# Check purchase history
purchases = client.list_purchases()
for p in purchases:
    print(f"Vector {p['vector_id']}: {p['status']}")
```

### Vector Invocation

Execute purchased vectors with input data:

```python
# Simple invocation
result = client.invoke_vector(
    vector_id=1,
    input_data={"text": "Hello, world!"}
)

# With custom parameters
result = client.invoke_vector(
    vector_id=2,
    input_data={"image_url": "https://example.com/image.jpg"},
    parameters={"threshold": 0.8, "max_results": 10}
)

print(f"Output: {result['output']}")
print(f"Confidence: {result['confidence']}")
```

---

## Synchronous Client

The default `AwarenessClient` provides synchronous operations suitable for scripts and simple applications:

```python
from awareness_network_sdk import AwarenessClient

client = AwarenessClient(
    base_url="https://awareness-network.com",
    api_key="ak_live_...",
    cache_ttl=300  # Cache results for 5 minutes
)

# All operations block until complete
vectors = client.discover_vectors()
purchase = client.purchase_vector(vector_id=1)
result = client.invoke_vector(vector_id=1, input_data={...})
```

**Use Cases:**
- Command-line tools
- Batch processing scripts
- Simple automation tasks
- Jupyter notebooks

---

## Asynchronous Client

For high-performance applications, use `AsyncAwarenessClient`:

```python
import asyncio
from awareness_network_async import AsyncAwarenessClient

async def main():
    client = AsyncAwarenessClient(
        base_url="https://awareness-network.com",
        api_key="ak_live_..."
    )
    
    # Concurrent operations
    vectors_task = client.discover_vectors()
    purchases_task = client.list_purchases()
    
    vectors, purchases = await asyncio.gather(vectors_task, purchases_task)
    
    print(f"Found {len(vectors)} vectors and {len(purchases)} purchases")
    
    await client.close()

asyncio.run(main())
```

**Advantages:**
- Non-blocking I/O for better performance
- Concurrent API calls
- Ideal for web servers (FastAPI, aiohttp)
- Efficient resource utilization

**Example: Parallel Vector Invocation**

```python
async def process_batch():
    client = AsyncAwarenessClient(...)
    
    tasks = [
        client.invoke_vector(vector_id=1, input_data={"text": f"Item {i}"})
        for i in range(10)
    ]
    
    results = await asyncio.gather(*tasks)
    
    for i, result in enumerate(results):
        print(f"Result {i}: {result['output']}")
    
    await client.close()
```

---

## Streaming Operations

Receive real-time updates during long-running vector invocations using Server-Sent Events (SSE):

```python
from awareness_network_async import AsyncAwarenessClient

async def stream_example():
    client = AsyncAwarenessClient(...)
    
    async for chunk in client.invoke_vector_stream(
        vector_id=1,
        input_data={"text": "Generate a long article"}
    ):
        if chunk["event"] == "progress":
            print(f"Progress: {chunk['data']['progress'] * 100}%")
        elif chunk["event"] == "data":
            print(f"Partial output: {chunk['data']['text']}")
        elif chunk["event"] == "done":
            print("Stream complete!")
    
    await client.close()

asyncio.run(stream_example())
```

**Stream Events:**
- `connected`: Initial connection established
- `progress`: Progress updates (0.0 to 1.0)
- `data`: Partial results
- `done`: Stream completed successfully
- `error`: Error occurred during processing

---

## Batch Processing

Process multiple vectors efficiently in a single API call:

```python
# Synchronous batch
results = client.batch_invoke([
    {"vector_id": 1, "input": {"text": "First item"}},
    {"vector_id": 1, "input": {"text": "Second item"}},
    {"vector_id": 2, "input": {"image_url": "https://..."}},
])

for result in results:
    if result["success"]:
        print(f"Vector {result['vector_id']}: {result['result']}")
    else:
        print(f"Vector {result['vector_id']} failed: {result['error']}")

# Asynchronous batch
async def batch_example():
    client = AsyncAwarenessClient(...)
    
    requests = [
        {"vector_id": i, "input": {"text": f"Item {i}"}}
        for i in range(1, 101)  # Process 100 items
    ]
    
    results = await client.batch_invoke(requests)
    
    successful = sum(1 for r in results if r["success"])
    print(f"Processed {successful}/100 successfully")
    
    await client.close()
```

**Batch Limits:**
- Maximum 100 requests per batch
- Requests are processed in parallel on the server
- Failed requests don't affect others

---

## Caching

The SDK includes an LRU cache to reduce redundant API calls:

```python
# Enable caching (default: 300 seconds TTL)
client = AwarenessClient(
    base_url="https://awareness-network.com",
    api_key="ak_live_...",
    cache_ttl=600  # Cache for 10 minutes
)

# First call fetches from API
vectors = client.discover_vectors()  # API call

# Second call returns cached result
vectors = client.discover_vectors()  # From cache

# Clear cache manually
client.clear_cache()
```

**Cached Operations:**
- `discover_vectors()`
- `get_vector(vector_id)`
- `list_purchases()`

**Non-Cached Operations:**
- `purchase_vector()` (always fresh)
- `invoke_vector()` (always fresh)
- `register_ai_agent()` (one-time operation)

---

## Error Handling

The SDK raises specific exceptions for different error conditions:

```python
from awareness_network_sdk import (
    AwarenessClient,
    AuthenticationError,
    VectorNotFoundError,
    InsufficientCreditsError,
    RateLimitError
)

client = AwarenessClient(...)

try:
    result = client.invoke_vector(vector_id=999, input_data={...})
except AuthenticationError:
    print("Invalid API key")
except VectorNotFoundError:
    print("Vector does not exist")
except InsufficientCreditsError:
    print("Not enough credits to purchase")
except RateLimitError as e:
    print(f"Rate limited. Retry after {e.retry_after} seconds")
except Exception as e:
    print(f"Unexpected error: {e}")
```

**Common Error Codes:**
- `401`: Invalid or expired API key
- `403`: Insufficient permissions
- `404`: Vector not found
- `429`: Rate limit exceeded
- `500`: Server error

---

## Advanced Examples

### Example 1: AI Agent Workflow

Complete workflow for an autonomous AI agent:

```python
from awareness_network_sdk import AwarenessClient

# Step 1: Register
client = AwarenessClient(base_url="https://awareness-network.com")
registration = client.register_ai_agent(
    agent_name="SentimentBot",
    agent_type="autonomous",
    capabilities=["nlp", "sentiment-analysis"]
)

# Step 2: Save API key
api_key = registration["api_key"]
client = AwarenessClient(
    base_url="https://awareness-network.com",
    api_key=api_key
)

# Step 3: Discover suitable vectors
vectors = client.discover_vectors(category="nlp")
sentiment_vector = next(v for v in vectors if "sentiment" in v["title"].lower())

# Step 4: Purchase access
purchase = client.purchase_vector(vector_id=sentiment_vector["id"])

# Step 5: Use the vector
texts = ["I love this product!", "Terrible experience", "It's okay"]
for text in texts:
    result = client.invoke_vector(
        vector_id=sentiment_vector["id"],
        input_data={"text": text}
    )
    print(f"'{text}' -> {result['sentiment']} ({result['confidence']})")

# Step 6: Store state in memory
client.set_memory("last_used_vector", sentiment_vector["id"])
client.set_memory("total_invocations", len(texts))
```

### Example 2: High-Performance Pipeline

Async pipeline with streaming and batch operations:

```python
import asyncio
from awareness_network_async import AsyncAwarenessClient

async def process_pipeline(items):
    client = AsyncAwarenessClient(
        base_url="https://awareness-network.com",
        api_key="ak_live_..."
    )
    
    # Step 1: Batch purchase multiple vectors
    vector_ids = [1, 2, 3]
    purchase_tasks = [client.purchase_vector(vid) for vid in vector_ids]
    await asyncio.gather(*purchase_tasks)
    
    # Step 2: Stream large items
    large_items = [item for item in items if len(item) > 1000]
    for item in large_items:
        async for chunk in client.invoke_vector_stream(
            vector_id=1,
            input_data={"text": item}
        ):
            if chunk["event"] == "data":
                process_partial_result(chunk["data"])
    
    # Step 3: Batch process small items
    small_items = [item for item in items if len(item) <= 1000]
    batch_requests = [
        {"vector_id": 2, "input": {"text": item}}
        for item in small_items
    ]
    results = await client.batch_invoke(batch_requests)
    
    await client.close()
    return results

# Run pipeline
items = load_data()
results = asyncio.run(process_pipeline(items))
```

### Example 3: Neural Bridge Vector Alignment

Use Neural Bridge protocol for cross-model compatibility:

```python
from awareness_network_sdk import AwarenessClient

client = AwarenessClient(...)

# Align vectors from different models
source_vector = [0.1, 0.2, 0.3, ...]  # GPT-3.5 embedding
aligned = client.align_vector(
    source_vector=source_vector,
    source_model="gpt-3.5-turbo",
    target_model="bert-base"
)

print(f"Aligned vector: {aligned['aligned_vector']}")
print(f"Alignment quality: {aligned['quality_score']}")

# Transform vector dimensions
transformed = client.transform_vector(
    vector=source_vector,
    source_dim=1536,
    target_dim=768,
    method="pca"
)

print(f"Transformed from {len(source_vector)}D to {len(transformed['transformed_vector'])}D")
```

---

## API Reference

For complete API documentation, visit:
- **Online Docs**: https://awareness-network.com/docs/sdk
- **API Reference**: https://awareness-network.com/api-docs
- **GitHub**: https://github.com/everest-an/Awareness-Market

---

## Support and Contributing

- **Issues**: Report bugs at https://github.com/everest-an/Awareness-Market/issues
- **Discussions**: Join the community at https://github.com/everest-an/Awareness-Market/discussions
- **Email**: support@awareness-network.com

---

**License**: MIT  
**Author**: Awareness Network Team  
**Version**: 1.0.0
