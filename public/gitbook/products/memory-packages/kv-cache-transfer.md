# KV-Cache Transfer

## Overview

KV-Cache transfer is the core mechanism behind Memory Packages. It enables the extraction, serialization, and restoration of a model's complete attention state -- the key-value pairs that encode everything the model has "seen" and "understood" during inference. This page provides a technical explanation of how the process works.

---

## What the KV-Cache Contains

In transformer-based language models, the KV-Cache (Key-Value Cache) stores the **attention keys and values** computed for every token that has been processed. These key-value pairs are the mechanism by which the model maintains context: each new token attends to the cached keys and values of all previous tokens to determine relevance and generate coherent output.

### Structure of the KV-Cache

```
KV-Cache Structure (per layer):

Layer l:
  ├── Keys:   K_l ∈ R^(n_heads × seq_len × head_dim)
  └── Values: V_l ∈ R^(n_heads × seq_len × head_dim)

Total KV-Cache:
  For L layers, H heads, sequence length S, head dimension D:
  Total size = 2 × L × H × S × D × sizeof(dtype)
```

### What Is Encoded

The KV-Cache captures:

| Content | How It Is Encoded |
|---|---|
| **Token semantics** | Key vectors encode the semantic identity of each token in context |
| **Positional relationships** | Positional encodings baked into key/value pairs |
| **Contextual understanding** | Value vectors encode context-dependent representations |
| **Attention patterns** | The key-value structure determines how future tokens attend to past context |
| **Multi-turn state** | Accumulated across conversation turns or document sections |
| **Reasoning intermediates** | Intermediate conclusions encoded in attention state across layers |

### Example: KV-Cache Dimensions

| Model | Layers | Heads | Head Dim | Context (tokens) | KV-Cache Size (FP16) |
|---|---|---|---|---|---|
| LLaMA 3.1 70B | 80 | 64 | 128 | 8,192 | 10.0 GB |
| LLaMA 3.1 70B | 80 | 64 | 128 | 128,000 | 156.3 GB |
| GPT-4 (est.) | 120 | 96 | 128 | 8,192 | 22.5 GB |
| Claude 3 Opus (est.) | 80 | 64 | 128 | 200,000 | 390.6 GB |
| Mistral Large | 80 | 64 | 128 | 32,768 | 40.0 GB |

---

## Extraction Process

Extracting the KV-Cache from a running model involves capturing the attention state at a specific point during inference.

### Step-by-Step Extraction

```
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│  1. Hook into │     │  2. Capture   │     │  3. Validate  │
│  inference    │────>│  KV-Cache     │────>│  completeness │
│  pipeline     │     │  state        │     │               │
└───────────────┘     └───────────────┘     └───────────────┘
                                                    │
┌───────────────┐     ┌───────────────┐             │
│  5. Package   │<────│  4. Serialize │<────────────┘
│  with         │     │  and compress │
│  metadata     │     │               │
└───────────────┘     └───────────────┘
```

1. **Hook into inference pipeline** -- Register extraction hooks on each transformer layer's attention module
2. **Capture KV-Cache state** -- At the desired point, snapshot all key and value tensors across all layers
3. **Validate completeness** -- Verify that all layers and heads have been captured with correct dimensions
4. **Serialize and compress** -- Convert tensors to a portable format and apply compression
5. **Package with metadata** -- Bundle with source model info, token count, and quality metrics

```python
from awareness_sdk import MemoryExtractor

extractor = MemoryExtractor(
    model="llama-3.1-70b",
    endpoint="http://localhost:8080"
)

# Configure extraction
extractor.configure(
    capture_point="latest",         # Capture current state
    layers="all",                   # All transformer layers
    include_position_ids=True,      # Include positional encoding data
    dtype="fp16",                   # Extraction precision
    validate=True                   # Run completeness validation
)

# Execute extraction
memory_state = extractor.extract()

print(f"Layers captured: {memory_state.num_layers}")
print(f"Sequence length: {memory_state.seq_length:,} tokens")
print(f"Total heads: {memory_state.num_heads}")
print(f"Raw size: {memory_state.raw_size_gb:.2f} GB")
print(f"Capture timestamp: {memory_state.timestamp}")
```

### Extraction Hooks

The extraction system uses model-specific hooks to access internal state without modifying the model's behavior:

```python
# Under the hood: how extraction hooks work
class KVCacheHook:
    def __init__(self, layer_idx):
        self.layer_idx = layer_idx
        self.keys = None
        self.values = None

    def __call__(self, module, input, output):
        # Capture the key-value tensors from the attention layer
        attention_output, (self.keys, self.values) = output
        return output

# Hooks are registered on each attention layer
for idx, layer in enumerate(model.transformer.layers):
    hook = KVCacheHook(idx)
    layer.self_attention.register_forward_hook(hook)
```

---

## Serialization Format

Memory Packages use the **AWM (Awareness Memory)** format, a purpose-built serialization format optimized for KV-Cache data.

### AWM File Structure

```
AWM File Layout:
├── Header (256 bytes)
│   ├── Magic number: "AWM\x01"
│   ├── Version: uint16
│   ├── Source model ID: string(64)
│   ├── Sequence length: uint64
│   ├── Num layers: uint32
│   ├── Num heads: uint32
│   ├── Head dimension: uint32
│   ├── Data type: uint8 (fp32=0, fp16=1, bf16=2, int8=3)
│   ├── Compression: uint8 (none=0, zstd=1, lz4=2)
│   └── Checksum: SHA-256
│
├── Metadata Block (variable)
│   ├── Prompt history (summarized)
│   ├── Token count
│   ├── Capture timestamp
│   ├── Quality metrics
│   └── W-Matrix profile reference
│
├── KV-Cache Data Blocks
│   ├── Layer 0: Keys [compressed] | Values [compressed]
│   ├── Layer 1: Keys [compressed] | Values [compressed]
│   ├── ...
│   └── Layer N: Keys [compressed] | Values [compressed]
│
└── Footer
    ├── Block index (for random access)
    └── Integrity checksum
```

### Serialization Code

```python
from awareness_sdk import MemorySerializer

serializer = MemorySerializer()

# Serialize the extracted memory state
serializer.serialize(
    memory_state=memory_state,
    output_path="./memory-package.awm",
    compression="zstd",
    compression_level=3,             # Balance speed and ratio (1-19)
    dtype="fp16",                    # Storage precision
    include_prompt_summary=True,     # Include context summary
    chunk_size_mb=256                # Per-layer chunk size for streaming
)

print(f"Serialized to: ./memory-package.awm")
print(f"File size: {serializer.output_size_gb:.2f} GB")
print(f"Compression ratio: {serializer.compression_ratio:.2f}x")
```

---

## Size Optimization

Raw KV-Cache data can be extremely large, especially for long-context models. The Awareness Network employs several strategies to reduce package size while preserving information quality.

### Optimization Strategies

| Strategy | Size Reduction | Retention Impact | Description |
|---|---|---|---|
| **FP16 quantization** | ~50% | < 0.1% loss | Reduce from FP32 to FP16 precision |
| **BF16 quantization** | ~50% | < 0.1% loss | Brain floating point, better for some models |
| **INT8 quantization** | ~75% | 1--3% loss | Aggressive quantization with calibration |
| **Zstandard compression** | 40--60% | 0% loss | Lossless compression on serialized data |
| **LZ4 compression** | 30--40% | 0% loss | Faster compression, lower ratio |
| **Attention pruning** | 20--40% | 2--5% loss | Remove low-attention key-value pairs |
| **Layer subsampling** | 30--50% | 5--10% loss | Skip less critical middle layers |

### Attention Pruning

Not all key-value pairs contribute equally to the model's understanding. Attention pruning removes entries that receive minimal attention across heads, significantly reducing size with controlled quality impact.

```python
from awareness_sdk import MemoryOptimizer

optimizer = MemoryOptimizer()

# Apply size optimizations
optimized = optimizer.optimize(
    memory_state=memory_state,
    strategies=[
        {"type": "quantize", "dtype": "fp16"},
        {"type": "attention_prune", "threshold": 0.01},  # Prune < 1% attention
        {"type": "compress", "algorithm": "zstd", "level": 5}
    ],
    target_size_gb=5.0,              # Target output size
    min_retention=0.93               # Minimum acceptable retention
)

print(f"Original size: {memory_state.raw_size_gb:.2f} GB")
print(f"Optimized size: {optimized.size_gb:.2f} GB")
print(f"Reduction: {optimized.reduction_ratio:.1%}")
print(f"Estimated retention: {optimized.estimated_retention:.1%}")
```

### Size Comparison Example

For a LLaMA 3.1 70B model with 128K token context:

```
Raw FP32:                  312.5 GB
FP16 quantization:         156.3 GB  (50% reduction)
+ Attention pruning:       109.4 GB  (30% further reduction)
+ Zstd compression:         54.7 GB  (50% further reduction)
────────────────────────────────────
Total reduction:            82.5%
Estimated retention:        93.2%
```

---

## Loading into Target Model

The final stage restores the serialized KV-Cache into a target model, enabling it to resume from the captured reasoning state.

### Loading Process

```
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│  1. Validate  │     │  2. Decompress│     │  3. W-Matrix  │
│  package      │────>│  and          │────>│  alignment    │
│  integrity    │     │  deserialize  │     │  (if needed)  │
└───────────────┘     └───────────────┘     └───────────────┘
                                                    │
┌───────────────┐     ┌───────────────┐             │
│  5. Verify    │<────│  4. Inject    │<────────────┘
│  retention    │     │  into model   │
│               │     │  KV-Cache     │
└───────────────┘     └───────────────┘
```

1. **Validate package integrity** -- Check checksums and format compatibility
2. **Decompress and deserialize** -- Restore tensor data from the AWM format
3. **W-Matrix alignment** -- If target model differs from source, align the KV-Cache
4. **Inject into model KV-Cache** -- Replace or merge with the target model's current cache
5. **Verify retention** -- Run verification prompts to confirm state was loaded correctly

```python
from awareness_sdk import MemoryPackage, ModelTarget

# Load the memory package
memory = MemoryPackage.load("./memory-package.awm")

# Configure target model
target = ModelTarget(
    model="claude-3.5-sonnet",
    endpoint="http://localhost:8080"
)

# Load memory into target model
result = memory.load_into(
    target=target,
    mode="replace",                  # Replace current KV-Cache
    verify=True,                     # Run retention verification
    verification_samples=50,         # Number of verification prompts
    fallback_on_failure="rollback"   # Rollback if retention too low
)

print(f"Load status: {result.status}")
print(f"Layers loaded: {result.layers_loaded}/{result.total_layers}")
print(f"Measured retention: {result.measured_retention:.1%}")
print(f"Coherence score: {result.coherence_score:.3f}")
print(f"Load time: {result.load_time_seconds:.1f}s")
```

### Loading Modes

| Mode | Description | Use Case |
|---|---|---|
| `replace` | Fully replace the target's KV-Cache | Clean state transfer |
| `merge` | Blend with existing KV-Cache | Combining multiple memory states |
| `append` | Add to end of existing context | Extending an active session |
| `selective` | Load only specific layers | Targeted state injection |

---

## Error Handling and Recovery

### Common Issues

| Issue | Cause | Resolution |
|---|---|---|
| Checksum mismatch | Corrupted download | Re-download the package |
| Dimension mismatch | Wrong target model | Verify model compatibility |
| Out of memory | KV-Cache exceeds available GPU memory | Use quantization or attention pruning |
| Low retention | Large architectural gap | Try multi-hop alignment |
| Coherence failure | Critical state information lost | Increase optimization retention threshold |

### Rollback Support

```python
# Automatic rollback on failure
result = memory.load_into(
    target=target,
    verify=True,
    min_retention=0.90,
    fallback_on_failure="rollback"   # Automatically restore previous state
)

if result.status == "rolled_back":
    print(f"Load failed: retention {result.measured_retention:.1%} below threshold")
    print(f"Previous model state restored successfully")
```

---

## Next Steps

- [Cross-Model Compatibility](cross-model-compatibility.md) -- How W-Matrix alignment works for Memory Packages
- [Quality and Retention](quality-and-retention.md) -- Detailed quality metrics
- [Memory Packages Overview](README.md) -- Return to product overview
