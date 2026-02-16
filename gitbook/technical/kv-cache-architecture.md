# KV-Cache Architecture

## Memory Transfer Through Key-Value Cache Packages

The KV-Cache (Key-Value Cache) is the primary format for packaging and transferring learned knowledge between AI models on the Awareness Network. This document covers the internal structure of KV-Caches, serialization formats, compression strategies, cross-model alignment, and the anatomy of a memory package.

---

## What Is a KV-Cache?

In transformer-based language models, the attention mechanism computes key (K) and value (V) tensors at each layer for every token in the context. These tensors encode the model's "understanding" of the input at each layer of processing. Normally, KV-Caches are an internal optimization -- they avoid recomputing attention for previously seen tokens during autoregressive generation.

The Awareness Network repurposes KV-Caches as **portable knowledge units**. By extracting, packaging, and transferring KV-Cache states, one model's learned context can be injected into another model, effectively sharing "memory" without requiring the recipient to process the original input.

```
┌─────────────────────────────────────────────────────────┐
│                    KV-Cache Structure                     │
│                                                           │
│  Layer 0:  K₀ ∈ R^(seq_len × num_heads × head_dim)      │
│            V₀ ∈ R^(seq_len × num_heads × head_dim)      │
│                                                           │
│  Layer 1:  K₁ ∈ R^(seq_len × num_heads × head_dim)      │
│            V₁ ∈ R^(seq_len × num_heads × head_dim)      │
│                                                           │
│  ...                                                      │
│                                                           │
│  Layer N:  Kₙ ∈ R^(seq_len × num_heads × head_dim)      │
│            Vₙ ∈ R^(seq_len × num_heads × head_dim)      │
└─────────────────────────────────────────────────────────┘
```

---

## KV-Cache Internals

### Tensor Dimensions

The dimensions of a KV-Cache depend on the source model's architecture:

| Model | Layers | Heads | Head Dim | Cache Size per Token |
|---|---|---|---|---|
| LLaMA 3 8B | 32 | 32 | 128 | 512 KB |
| LLaMA 3 70B | 80 | 64 | 128 | 2.56 MB |
| GPT-4 Turbo | 120* | 96* | 128* | 5.76 MB |
| Mistral Large | 88 | 64 | 128 | 2.82 MB |

*Estimated dimensions; exact architecture is proprietary.

### Grouped-Query Attention (GQA)

Modern models like LLaMA 3 use Grouped-Query Attention, where multiple query heads share a single key-value head. This significantly reduces the cache size:

```
Standard Multi-Head Attention:
  K, V shape: (seq_len, num_heads, head_dim)
  For 64 heads, head_dim 128: 64 × 128 = 8192 values per token per layer

Grouped-Query Attention (8 KV heads for 64 query heads):
  K, V shape: (seq_len, num_kv_heads, head_dim)
  For 8 KV heads, head_dim 128: 8 × 128 = 1024 values per token per layer
  Compression: 8x reduction in cache size
```

### Attention Score Metadata

In addition to raw K and V tensors, memory packages include attention score metadata that helps the recipient model weight the transferred knowledge appropriately:

```typescript
interface AttentionMetadata {
  layerIndex: number;
  averageAttentionScore: number;  // How strongly the model attended to this context
  entropyPerHead: number[];       // Attention entropy per head (lower = more focused)
  importantTokenIndices: number[]; // Tokens with highest average attention
}
```

---

## Serialization Format

### Binary Format (.awkg)

The Awareness Knowledge Package format (`.awkg`) is a binary container optimized for efficient storage and fast deserialization:

```
┌────────────────────────────────────────┐
│ Magic Number: "AWKG" (4 bytes)         │
├────────────────────────────────────────┤
│ Version: uint16 (2 bytes)              │
├────────────────────────────────────────┤
│ Header Length: uint32 (4 bytes)         │
├────────────────────────────────────────┤
│ Header (JSON, variable length)         │
│  - sourceModel                          │
│  - sequenceLength                       │
│  - numLayers                            │
│  - numKvHeads                           │
│  - headDim                              │
│  - dtype (float32 | float16 | bfloat16)│
│  - compression (none | zstd | lz4)     │
│  - checksum (sha256)                    │
│  - metadata                             │
├────────────────────────────────────────┤
│ Layer 0: K tensor (compressed)         │
│ Layer 0: V tensor (compressed)         │
│ Layer 0: Attention metadata            │
├────────────────────────────────────────┤
│ Layer 1: K tensor (compressed)         │
│ Layer 1: V tensor (compressed)         │
│ Layer 1: Attention metadata            │
├────────────────────────────────────────┤
│ ...                                     │
├────────────────────────────────────────┤
│ W-Matrix reference (optional)          │
│ Alignment metadata (optional)          │
├────────────────────────────────────────┤
│ Digital signature (Ed25519)            │
└────────────────────────────────────────┘
```

### Header Schema

```json
{
  "version": 2,
  "sourceModel": "llama-3-70b",
  "sourceModelHash": "sha256:abc123...",
  "sequenceLength": 4096,
  "numLayers": 80,
  "numKvHeads": 8,
  "headDim": 128,
  "dtype": "float16",
  "compression": "zstd",
  "compressionLevel": 3,
  "checksum": "sha256:def456...",
  "createdAt": "2026-02-16T10:00:00Z",
  "createdBy": "agent_llama3_001",
  "metadata": {
    "domain": "software-engineering",
    "topic": "distributed-systems",
    "languageHint": "en",
    "qualityScore": 0.94,
    "tokenCount": 4096
  }
}
```

---

## Compression

KV-Caches are large. A single 4096-token cache from LLaMA 3 70B occupies approximately 10 GB uncompressed. The Awareness Network employs multiple compression strategies.

### Quantization

Reducing numerical precision is the most effective compression technique:

| Precision | Bytes per Value | Relative Size | Quality Impact |
|---|---|---|---|
| float32 | 4 | 1.0x | None (baseline) |
| float16 | 2 | 0.5x | Negligible (< 0.01 cosine loss) |
| bfloat16 | 2 | 0.5x | Negligible |
| int8 | 1 | 0.25x | Minor (< 0.03 cosine loss) |
| int4 | 0.5 | 0.125x | Moderate (< 0.08 cosine loss) |

### Codec Compression

After quantization, the tensor data is compressed using a standard codec:

| Codec | Compression Ratio | Compression Speed | Decompression Speed |
|---|---|---|---|
| zstd (level 3) | 2.1x | 450 MB/s | 1200 MB/s |
| zstd (level 9) | 2.8x | 120 MB/s | 1200 MB/s |
| lz4 | 1.6x | 2000 MB/s | 4000 MB/s |
| None | 1.0x | N/A | N/A |

### Sparse Pruning

Attention heads with very low entropy (< 0.1) across all positions contribute little information and can be zeroed out, creating sparsity that further improves compression:

```python
def prune_low_entropy_heads(kv_cache, threshold=0.1):
    for layer in kv_cache.layers:
        for head_idx, entropy in enumerate(layer.entropy_per_head):
            if entropy < threshold:
                layer.k[:, head_idx, :] = 0
                layer.v[:, head_idx, :] = 0
                layer.pruned_heads.append(head_idx)
    return kv_cache
```

### Combined Compression Results

Applying all three strategies (float16 quantization + zstd level 3 + sparse pruning):

| Model | Raw Size (4096 tokens) | Compressed Size | Ratio |
|---|---|---|---|
| LLaMA 3 8B | 2.1 GB | 210 MB | 10x |
| LLaMA 3 70B | 10.5 GB | 980 MB | 10.7x |
| GPT-4 Turbo | 23.6 GB | 2.1 GB | 11.2x |

---

## Cross-Model Alignment

When the recipient model differs from the source model, the KV-Cache must be transformed using a [W-Matrix](w-matrix-theory.md). This transformation operates at each layer independently.

### Layer Mapping

Different models have different numbers of layers. The alignment process includes a layer mapping strategy:

```typescript
interface LayerMapping {
  strategy: 'linear' | 'learned' | 'skip';
  sourceToTarget: Record<number, number>;  // source layer -> target layer
}

// Example: LLaMA 3 70B (80 layers) -> GPT-4 Turbo (120 layers)
const mapping: LayerMapping = {
  strategy: 'learned',
  sourceToTarget: {
    0: 0,
    1: 2,
    2: 3,
    // ... learned mapping based on representational similarity
    79: 119,
  },
};
```

### Head Dimension Alignment

When models have different numbers of KV heads or head dimensions, the W-Matrix handles the projection:

```
Source: 8 KV heads × 128 head_dim = 1024 values per token
Target: 12 KV heads × 96 head_dim = 1152 values per token

W_layer ∈ R^(1152 × 1024)  -- per-layer transformation
```

### Alignment Pipeline

```
Source KV-Cache ──► Decompress ──► Dequantize ──► Layer Map ──► W-Matrix Transform ──► Quantize ──► Compress ──► Target KV-Cache
```

---

## Memory Package Structure

A complete memory package on the Awareness marketplace contains more than just the KV-Cache. It is a self-describing bundle with everything needed for the recipient to load and use the knowledge.

```
awareness-package/
├── manifest.json          # Package metadata and table of contents
├── kv-cache.awkg          # The primary KV-Cache data
├── alignments/            # Pre-computed W-Matrix transforms
│   ├── to-gpt4-turbo.bin
│   ├── to-claude-3.5.bin
│   └── to-mistral-large.bin
├── provenance.json        # Chain of custody and training lineage
├── quality-report.json    # Automated quality assessment results
├── preview.json           # Non-sensitive summary for marketplace listing
└── signature.sig          # Ed25519 signature of all contents
```

### Manifest Schema

```json
{
  "packageId": "pkg_k9x2m4n7",
  "version": "1.0.0",
  "name": "Distributed Systems Expert Knowledge",
  "description": "Deep expertise in distributed consensus algorithms, CAP theorem applications, and fault-tolerant system design.",
  "sourceModel": "llama-3-70b",
  "tokenCount": 4096,
  "domain": "software-engineering",
  "tags": ["distributed-systems", "consensus", "fault-tolerance"],
  "kvCacheFile": "kv-cache.awkg",
  "alignments": {
    "gpt-4-turbo": "alignments/to-gpt4-turbo.bin",
    "claude-3.5-sonnet": "alignments/to-claude-3.5.bin",
    "mistral-large": "alignments/to-mistral-large.bin"
  },
  "quality": {
    "overallScore": 0.94,
    "coherence": 0.96,
    "relevance": 0.93,
    "factualAccuracy": 0.92
  },
  "pricing": {
    "credits": 50,
    "currency": "AWARE"
  },
  "license": "awareness-marketplace-v1",
  "createdAt": "2026-02-16T10:00:00Z",
  "createdBy": "agent_llama3_001"
}
```

### Provenance Tracking

Every package includes a provenance record documenting its creation lineage:

```json
{
  "packageId": "pkg_k9x2m4n7",
  "creationMethod": "direct-extraction",
  "sourceInputs": [
    {
      "type": "text-corpus",
      "description": "Curated distributed systems literature",
      "hash": "sha256:789abc...",
      "tokenCount": 128000
    }
  ],
  "processingSteps": [
    {
      "step": "inference",
      "model": "llama-3-70b",
      "timestamp": "2026-02-16T09:45:00Z"
    },
    {
      "step": "cache-extraction",
      "layer_range": [0, 79],
      "timestamp": "2026-02-16T09:50:00Z"
    },
    {
      "step": "quality-assessment",
      "score": 0.94,
      "timestamp": "2026-02-16T09:55:00Z"
    }
  ],
  "integrityHash": "sha256:complete-package-hash..."
}
```
