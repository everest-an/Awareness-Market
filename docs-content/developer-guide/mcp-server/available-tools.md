# Available Tools

The Awareness MCP Server exposes six tools that AI agents can invoke to interact with the Awareness Network marketplace. Each tool has a typed parameter schema and returns structured JSON results.

---

## search\_vector\_packages

Search for vector packages (pre-trained weight vectors, LoRA adapters, model deltas) in the Awareness marketplace.

### Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `query` | `string` | Yes | Natural language search query. |
| `model` | `string` | No | Filter by target model compatibility (e.g., `"llama-3.1-70b"`). |
| `tags` | `string[]` | No | Filter by tags (all must match). |
| `min_rating` | `number` | No | Minimum average rating (0.0--5.0). |
| `max_price` | `number` | No | Maximum price in USDC. |
| `sort_by` | `string` | No | Sort order: `"relevance"`, `"rating"`, `"downloads"`, `"price"`, `"newest"`. Default: `"relevance"`. |
| `limit` | `number` | No | Maximum results to return (1--100). Default: `20`. |

### Response

Returns an array of vector package objects:

```json
[
  {
    "id": "pkg_vec_abc123",
    "name": "reasoning-boost-v2",
    "description": "Improves logical reasoning and chain-of-thought performance",
    "version": "2.1.0",
    "model_compatibility": ["llama-3.1-70b", "llama-3.1-70b-instruct"],
    "tags": ["reasoning", "logic", "chain-of-thought"],
    "rating": 4.7,
    "downloads": 12840,
    "price": 2.50,
    "publisher": { "name": "NeuroForge Labs", "verified": true }
  }
]
```

### Example Usage

When a user asks: *"Find me a code generation vector package for Llama 3.1 70B under $5"*

The agent calls:

```json
{
  "tool": "search_vector_packages",
  "arguments": {
    "query": "code generation",
    "model": "llama-3.1-70b",
    "max_price": 5.0,
    "sort_by": "rating"
  }
}
```

---

## search\_kv\_cache\_memories

Search for KV-Cache memory packages (serialized key-value cache snapshots for context injection and memory transfer).

### Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `query` | `string` | Yes | Natural language search query. |
| `model` | `string` | No | Filter by source model. |
| `context_length` | `number` | No | Minimum context length in tokens. |
| `tags` | `string[]` | No | Filter by tags. |
| `min_rating` | `number` | No | Minimum average rating. |
| `max_price` | `number` | No | Maximum price in USDC. |
| `sort_by` | `string` | No | Sort order. Default: `"relevance"`. |
| `limit` | `number` | No | Maximum results. Default: `20`. |

### Response

```json
[
  {
    "id": "pkg_mem_def456",
    "name": "medical-terminology-8k",
    "description": "KV-Cache trained on 100K medical documents, 8192 token context",
    "source_model": "llama-3.1-8b",
    "token_count": 8192,
    "layer_range": [0, 32],
    "tags": ["medical", "terminology", "healthcare"],
    "rating": 4.5,
    "downloads": 3210,
    "price": 1.00,
    "publisher": { "name": "MedAI Research", "verified": true }
  }
]
```

### Example Usage

When a user asks: *"I need a legal context memory for my 8B model"*

The agent calls:

```json
{
  "tool": "search_kv_cache_memories",
  "arguments": {
    "query": "legal context",
    "model": "llama-3.1-8b",
    "sort_by": "rating"
  }
}
```

---

## search\_chain\_packages

Search for chain packages (composable inference chains and multi-step reasoning workflows).

### Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `query` | `string` | Yes | Natural language search query. |
| `category` | `string` | No | Filter by category: `"reasoning"`, `"coding"`, `"creative"`, `"research"`, `"robotics"`. |
| `tags` | `string[]` | No | Filter by tags. |
| `min_rating` | `number` | No | Minimum average rating. |
| `max_price` | `number` | No | Maximum price in USDC. |
| `sort_by` | `string` | No | Sort order. Default: `"relevance"`. |
| `limit` | `number` | No | Maximum results. Default: `20`. |

### Response

```json
[
  {
    "id": "pkg_chain_ghi789",
    "name": "deep-research-v3",
    "description": "4-step research pipeline with source verification",
    "step_count": 4,
    "step_names": ["query-expansion", "parallel-search", "synthesis", "fact-check"],
    "required_models": ["llama-3.1-70b", "llama-3.1-8b"],
    "category": "research",
    "tags": ["research", "verification", "multi-step"],
    "rating": 4.8,
    "downloads": 5620,
    "price": 5.00,
    "publisher": { "name": "ChainWorks", "verified": true }
  }
]
```

### Example Usage

When a user asks: *"Show me reasoning chains that work with 70B models"*

The agent calls:

```json
{
  "tool": "search_chain_packages",
  "arguments": {
    "query": "reasoning",
    "category": "reasoning",
    "sort_by": "downloads"
  }
}
```

---

## purchase\_package

Purchase a package from the Awareness marketplace. Works with any product line (vectors, memories, chains).

### Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `package_id` | `string` | Yes | The ID of the package to purchase. |
| `payment_method` | `string` | No | Payment method: `"balance"` or `"crypto"`. Default: `"balance"`. |

### Response

```json
{
  "purchase_id": "pur_jkl012",
  "package_id": "pkg_vec_abc123",
  "download_token": "dtk_mno345pqr678",
  "amount": 2.50,
  "currency": "USDC",
  "expires_at": "2026-02-17T10:00:00Z"
}
```

### Example Usage

After the agent has found a suitable package and the user confirms the purchase:

```json
{
  "tool": "purchase_package",
  "arguments": {
    "package_id": "pkg_vec_abc123",
    "payment_method": "balance"
  }
}
```

{% hint style="warning" %}
If `autoConfirmPurchases` is `false` in `mcp.json` (the default), the MCP server will ask the agent to confirm the purchase with the user before proceeding. This prevents accidental charges.
{% endhint %}

---

## download\_package

Download a purchased package to a local directory.

### Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `download_token` | `string` | Yes | The download token from a purchase receipt. |
| `output_dir` | `string` | No | Directory to save the file. Defaults to the `downloadDir` setting in `mcp.json`. |

### Response

```json
{
  "filename": "reasoning-boost-v2.safetensors",
  "path": "/home/user/mcp-downloads/reasoning-boost-v2.safetensors",
  "size_mb": 142.7,
  "format": "safetensors",
  "checksum_sha256": "a1b2c3d4e5f6..."
}
```

### Example Usage

After a successful purchase:

```json
{
  "tool": "download_package",
  "arguments": {
    "download_token": "dtk_mno345pqr678",
    "output_dir": "/home/user/models/vectors/"
  }
}
```

---

## check\_model\_compatibility

Check whether a specific package is compatible with a target model and quantization configuration. This tool is useful for agents to pre-validate before recommending or purchasing a package.

### Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `package_id` | `string` | Yes | The ID of the package to check. |
| `target_model` | `string` | Yes | The target model identifier (e.g., `"llama-3.1-70b"`). |
| `target_quantization` | `string` | No | Target quantization format (e.g., `"q4_k_m"`, `"q8_0"`, `"f16"`). |

### Response

```json
{
  "is_compatible": true,
  "alignment_score": 0.942,
  "target_model": "llama-3.1-70b",
  "target_quantization": "q4_k_m",
  "notes": "Full compatibility. Alignment score exceeds 0.9 threshold."
}
```

If the package is not compatible:

```json
{
  "is_compatible": false,
  "alignment_score": 0.312,
  "target_model": "mistral-7b",
  "target_quantization": "q4_k_m",
  "reason": "Package was trained for llama-3.1-70b architecture. Architecture mismatch with mistral-7b."
}
```

### Example Usage

When an agent wants to verify compatibility before recommending a purchase:

```json
{
  "tool": "check_model_compatibility",
  "arguments": {
    "package_id": "pkg_vec_abc123",
    "target_model": "llama-3.1-70b",
    "target_quantization": "q4_k_m"
  }
}
```

---

## Tool Call Flow

A typical multi-step interaction between a user, AI agent, and the MCP server:

```
User:     "Find a reasoning boost for my Llama 3.1 70B and download it"
           |
Agent:    Calls search_vector_packages(query="reasoning boost", model="llama-3.1-70b")
           |
MCP:      Returns 8 results
           |
Agent:    Calls check_model_compatibility(package_id="pkg_vec_abc123",
              target_model="llama-3.1-70b")
           |
MCP:      Returns {is_compatible: true, alignment_score: 0.942}
           |
Agent:    "I found 'reasoning-boost-v2' with a 4.7 rating and 0.942 compatibility
           score. It costs $2.50. Shall I purchase it?"
           |
User:     "Yes, go ahead"
           |
Agent:    Calls purchase_package(package_id="pkg_vec_abc123")
           |
MCP:      Returns purchase receipt with download token
           |
Agent:    Calls download_package(download_token="dtk_mno345pqr678")
           |
MCP:      Returns {path: "/home/user/mcp-downloads/reasoning-boost-v2.safetensors"}
           |
Agent:    "Done! The file has been downloaded to
           /home/user/mcp-downloads/reasoning-boost-v2.safetensors (142.7 MB)"
```
