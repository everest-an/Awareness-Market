# API Reference

Complete reference for all classes, methods, parameters, and return types in the Awareness Python SDK.

## AwarenessClient

The synchronous client for interacting with the Awareness Network API.

### Constructor

```python
AwarenessClient(
    api_key: str | None = None,
    base_url: str = "https://api.awareness.market/v1",
    timeout: float = 30.0,
    max_retries: int = 3,
    ssl_ca_bundle: str | None = None,
)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `api_key` | `str \| None` | `None` | API key. Falls back to `AWARENESS_API_KEY` env var. |
| `base_url` | `str` | `"https://api.awareness.market/v1"` | API base URL. |
| `timeout` | `float` | `30.0` | Request timeout in seconds. |
| `max_retries` | `int` | `3` | Number of automatic retries on transient failures. |
| `ssl_ca_bundle` | `str \| None` | `None` | Path to a custom CA bundle for SSL verification. |

### Properties

| Property | Type | Description |
|---|---|---|
| `vectors` | `VectorService` | Service for vector package operations. |
| `memories` | `MemoryService` | Service for KV-Cache memory operations. |
| `chains` | `ChainService` | Service for chain package operations. |
| `marketplace` | `MarketplaceService` | Service for purchasing and account operations. |
| `wmatrix` | `WMatrixService` | Service for W-Matrix alignment operations. |

### Methods

#### `health_check()`

Check the API connection and server health.

```python
def health_check() -> HealthStatus
```

**Returns:** `HealthStatus` with fields `status: str`, `latency_ms: int`.

```python
status = client.health_check()
print(status.status)      # "ok"
print(status.latency_ms)  # 42
```

#### `close()`

Close the underlying HTTP session and release resources.

```python
def close() -> None
```

---

## AsyncAwarenessClient

The asynchronous client. Provides the same API as `AwarenessClient`, but all methods are coroutines.

### Constructor

```python
AsyncAwarenessClient(
    api_key: str | None = None,
    base_url: str = "https://api.awareness.market/v1",
    timeout: float = 30.0,
    max_retries: int = 3,
    ssl_ca_bundle: str | None = None,
)
```

Parameters are identical to `AwarenessClient`.

### Async Context Manager

```python
async with AsyncAwarenessClient(api_key="aw_live_...") as client:
    results = await client.vectors.search(query="reasoning")
```

### Methods

All methods on `AsyncAwarenessClient` mirror those on `AwarenessClient`, but return coroutines. Refer to the corresponding synchronous method documentation for parameters and return types.

#### `close()`

```python
async def close() -> None
```

---

## VectorService

Manages vector package search, download, and publishing.

### `search()`

Search for vector packages in the marketplace.

```python
def search(
    query: str,
    model: str | None = None,
    tags: list[str] | None = None,
    min_rating: float | None = None,
    max_price: float | None = None,
    quantization: str | None = None,
    sort_by: str = "relevance",
    limit: int = 20,
    offset: int = 0,
) -> list[VectorPackage]
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `query` | `str` | *required* | Natural language search query. |
| `model` | `str \| None` | `None` | Filter by target model compatibility. |
| `tags` | `list[str] \| None` | `None` | Filter by tags (all must match). |
| `min_rating` | `float \| None` | `None` | Minimum average rating (0.0--5.0). |
| `max_price` | `float \| None` | `None` | Maximum price in USDC. |
| `quantization` | `str \| None` | `None` | Filter by quantization format (e.g., `"q4_k_m"`). |
| `sort_by` | `str` | `"relevance"` | Sort order: `"relevance"`, `"rating"`, `"downloads"`, `"price"`, `"newest"`. |
| `limit` | `int` | `20` | Maximum results to return (1--100). |
| `offset` | `int` | `0` | Pagination offset. |

**Returns:** `list[VectorPackage]`

### `download()`

Download a purchased vector package.

```python
def download(
    download_token: str,
    output_dir: str | None = None,
) -> VectorPayload
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `download_token` | `str` | *required* | Token from a purchase receipt. |
| `output_dir` | `str \| None` | `None` | Directory to save the file. If `None`, holds in memory. |

**Returns:** `VectorPayload`

### `publish()`

Publish a vector package to the marketplace.

```python
def publish(
    file_path: str,
    metadata: VectorPackageMeta,
) -> Publication
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `file_path` | `str` | *required* | Path to the weights file (`.safetensors`, `.gguf`, `.bin`). |
| `metadata` | `VectorPackageMeta` | *required* | Package metadata (name, description, pricing, etc.). |

**Returns:** `Publication`

### `batch_load()`

Download multiple vector packages concurrently.

```python
def batch_load(
    package_ids: list[str],
    max_concurrency: int = 4,
    output_dir: str = "./downloads/",
    on_progress: Callable[[BatchProgress], None] | None = None,
    on_loaded: Callable[[BatchResult], None] | None = None,
) -> list[BatchResult]
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `package_ids` | `list[str]` | *required* | List of package IDs to download. |
| `max_concurrency` | `int` | `4` | Maximum parallel downloads. |
| `output_dir` | `str` | `"./downloads/"` | Directory to save downloaded files. |
| `on_progress` | `Callable \| None` | `None` | Callback invoked on progress updates. |
| `on_loaded` | `Callable \| None` | `None` | Callback invoked when each package finishes. |

**Returns:** `list[BatchResult]`

---

## MemoryService

Manages KV-Cache memory search, download, and publishing.

### `search()`

```python
def search(
    query: str,
    model: str | None = None,
    context_length: int | None = None,
    tags: list[str] | None = None,
    min_rating: float | None = None,
    max_price: float | None = None,
    sort_by: str = "relevance",
    limit: int = 20,
    offset: int = 0,
) -> list[MemoryPackage]
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `query` | `str` | *required* | Natural language search query. |
| `model` | `str \| None` | `None` | Filter by source model. |
| `context_length` | `int \| None` | `None` | Filter by minimum context length in tokens. |
| `tags` | `list[str] \| None` | `None` | Filter by tags. |
| `min_rating` | `float \| None` | `None` | Minimum average rating. |
| `max_price` | `float \| None` | `None` | Maximum price in USDC. |
| `sort_by` | `str` | `"relevance"` | Sort order. |
| `limit` | `int` | `20` | Maximum results. |
| `offset` | `int` | `0` | Pagination offset. |

**Returns:** `list[MemoryPackage]`

### `download()`

```python
def download(
    download_token: str,
    output_dir: str | None = None,
) -> MemoryPayload
```

**Returns:** `MemoryPayload`

### `publish()`

```python
def publish(
    file_path: str,
    metadata: MemoryPackageMeta,
) -> Publication
```

**Returns:** `Publication`

---

## ChainService

Manages chain package search, download, and publishing.

### `search()`

```python
def search(
    query: str,
    category: str | None = None,
    tags: list[str] | None = None,
    min_rating: float | None = None,
    max_price: float | None = None,
    sort_by: str = "relevance",
    limit: int = 20,
    offset: int = 0,
) -> list[ChainPackage]
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `query` | `str` | *required* | Natural language search query. |
| `category` | `str \| None` | `None` | Filter by category (e.g., `"reasoning"`, `"coding"`, `"creative"`). |
| `tags` | `list[str] \| None` | `None` | Filter by tags. |
| `min_rating` | `float \| None` | `None` | Minimum average rating. |
| `max_price` | `float \| None` | `None` | Maximum price in USDC. |
| `sort_by` | `str` | `"relevance"` | Sort order. |
| `limit` | `int` | `20` | Maximum results. |
| `offset` | `int` | `0` | Pagination offset. |

**Returns:** `list[ChainPackage]`

### `download()`

```python
def download(
    download_token: str,
    output_dir: str | None = None,
) -> ChainPayload
```

**Returns:** `ChainPayload`

### `publish()`

```python
def publish(
    file_path: str,
    metadata: ChainPackageMeta,
) -> Publication
```

**Returns:** `Publication`

---

## MarketplaceService

Handles purchasing, transaction history, and account operations.

### `purchase()`

Purchase a package from the marketplace.

```python
def purchase(
    package_id: str,
    payment_method: str = "balance",
) -> PurchaseReceipt
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `package_id` | `str` | *required* | ID of the package to purchase. |
| `payment_method` | `str` | `"balance"` | Payment method: `"balance"` or `"crypto"`. |

**Returns:** `PurchaseReceipt`

### `get_balance()`

Retrieve the current account balance.

```python
def get_balance() -> Balance
```

**Returns:** `Balance` with fields `available: float`, `pending: float`, `currency: str`.

### `get_transactions()`

Retrieve transaction history.

```python
def get_transactions(
    limit: int = 50,
    offset: int = 0,
    type: str | None = None,
) -> list[Transaction]
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `limit` | `int` | `50` | Maximum results. |
| `offset` | `int` | `0` | Pagination offset. |
| `type` | `str \| None` | `None` | Filter by type: `"purchase"`, `"sale"`, `"deposit"`, `"withdrawal"`. |

**Returns:** `list[Transaction]`

### `get_purchases()`

Retrieve the authenticated user's purchase history.

```python
def get_purchases(
    limit: int = 50,
    offset: int = 0,
) -> list[PurchaseRecord]
```

**Returns:** `list[PurchaseRecord]`

---

## WMatrixService

Provides W-Matrix alignment, compatibility checks, and delta operations.

### `align()`

Perform a full W-Matrix alignment between base weights and a vector package.

```python
def align(
    base_weights: str | bytes,
    vector_package: str | bytes | VectorPayload,
    strength: float = 1.0,
    layers: list[int] | None = None,
    output_path: str | None = None,
) -> AlignmentResult
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `base_weights` | `str \| bytes` | *required* | Path to base model weights or raw bytes. |
| `vector_package` | `str \| bytes \| VectorPayload` | *required* | Vector package to align with. |
| `strength` | `float` | `1.0` | Alignment strength multiplier (0.0--2.0). |
| `layers` | `list[int] \| None` | `None` | Specific layer indices to align. `None` aligns all layers. |
| `output_path` | `str \| None` | `None` | Path to save aligned weights. If `None`, returns in memory. |

**Returns:** `AlignmentResult`

```python
result = client.wmatrix.align(
    base_weights="./models/llama-3.1-70b/",
    vector_package=downloaded_weights,
    strength=0.7,
    output_path="./aligned/llama-3.1-70b-reasoning.safetensors"
)
print(f"Score: {result.alignment_score:.4f}")
print(f"Layers modified: {result.layers_modified}")
```

### `stream_align()`

Stream W-Matrix alignment results layer by layer.

```python
def stream_align(
    base_weights: str | bytes,
    vector_package_id: str,
    strength: float = 1.0,
    layers: list[int] | None = None,
    output_path: str | None = None,
) -> AlignmentStream
```

Parameters are identical to `align()`, except `vector_package_id` accepts a package ID string (the server fetches the package).

**Returns:** `AlignmentStream` (iterable of `AlignmentChunk`).

### `check_compatibility()`

Check whether a package is compatible with a target model and hardware configuration.

```python
def check_compatibility(
    package_id: str,
    target_model: str,
    target_quantization: str | None = None,
) -> CompatibilityResult
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `package_id` | `str` | *required* | Package ID to check. |
| `target_model` | `str` | *required* | Target model identifier. |
| `target_quantization` | `str \| None` | `None` | Target quantization format. |

**Returns:** `CompatibilityResult`

```python
compat = client.wmatrix.check_compatibility(
    package_id="pkg_abc123",
    target_model="llama-3.1-70b",
    target_quantization="q4_k_m"
)
print(f"Compatible: {compat.is_compatible}")
print(f"Score: {compat.alignment_score:.3f}")
```

### `compute_delta()`

Compute the weight delta between two model checkpoints.

```python
def compute_delta(
    weights_a: str,
    weights_b: str,
    output_path: str | None = None,
) -> DeltaResult
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `weights_a` | `str` | *required* | Path to the first checkpoint. |
| `weights_b` | `str` | *required* | Path to the second checkpoint. |
| `output_path` | `str \| None` | `None` | Path to save the delta. |

**Returns:** `DeltaResult` with fields `delta_path: str`, `delta_norm: float`, `layer_count: int`.

### `merge()`

Merge multiple vector packages into a single aligned package.

```python
def merge(
    packages: list[str | VectorPayload],
    weights: list[float] | None = None,
    output_path: str | None = None,
) -> MergeResult
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `packages` | `list` | *required* | List of package paths or payloads to merge. |
| `weights` | `list[float] \| None` | `None` | Relative weight for each package. Defaults to equal weighting. |
| `output_path` | `str \| None` | `None` | Path to save the merged output. |

**Returns:** `MergeResult` with fields `output_path: str`, `alignment_score: float`, `merged_count: int`.

---

## Data Models

### VectorPackage

```python
class VectorPackage(BaseModel):
    id: str
    name: str
    description: str
    version: str
    model_compatibility: list[str]
    tags: list[str]
    rating: float
    downloads: int
    price: float
    publisher: Publisher
    created_at: datetime
    updated_at: datetime
```

### MemoryPackage

```python
class MemoryPackage(BaseModel):
    id: str
    name: str
    description: str
    source_model: str
    token_count: int
    layer_range: tuple[int, int]
    tags: list[str]
    rating: float
    downloads: int
    price: float
    publisher: Publisher
    created_at: datetime
    updated_at: datetime
```

### ChainPackage

```python
class ChainPackage(BaseModel):
    id: str
    name: str
    description: str
    step_count: int
    step_names: list[str]
    required_models: list[str]
    category: str
    tags: list[str]
    rating: float
    downloads: int
    price: float
    publisher: Publisher
    created_at: datetime
    updated_at: datetime
```

### PurchaseReceipt

```python
class PurchaseReceipt(BaseModel):
    purchase_id: str
    package_id: str
    download_token: str
    amount: float
    currency: str
    expires_at: datetime
```

### AlignmentResult

```python
class AlignmentResult(BaseModel):
    alignment_score: float
    layers_modified: int
    total_layers: int
    output_path: str | None
    duration_ms: int
```

### Publication

```python
class Publication(BaseModel):
    package_id: str
    review_status: str  # "pending", "approved", "rejected"
    url: str
    created_at: datetime
```

---

## Exceptions

All exceptions inherit from `AwarenessAPIError`.

| Exception | HTTP Status | Description |
|---|---|---|
| `AwarenessAPIError` | Any | Base exception for all API errors. |
| `AuthenticationError` | 401 | Invalid or expired API key. |
| `AuthorizationError` | 403 | Insufficient permissions. |
| `PackageNotFoundError` | 404 | Package does not exist or has been delisted. |
| `ValidationError` | 422 | Invalid request parameters. |
| `InsufficientFundsError` | 402 | Account balance too low for purchase. |
| `RateLimitError` | 429 | Rate limit exceeded. Has `retry_after: int` attribute. |
| `ServerError` | 500+ | Server-side error. |

```python
from awareness_sdk.exceptions import AwarenessAPIError

try:
    result = client.vectors.search(query="test")
except AwarenessAPIError as e:
    print(f"Status: {e.status_code}")
    print(f"Message: {e.message}")
    print(f"Request ID: {e.request_id}")
```
