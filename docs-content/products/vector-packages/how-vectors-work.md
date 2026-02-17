# How Vectors Work

## Technical Overview

Vector Packages enable capability transfer between AI models through a three-stage pipeline: **extraction**, **alignment**, and **injection**. This page provides a technical explanation of each stage, the quality metrics involved, and how information retention is measured throughout the process.

---

## Architecture Diagram

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Source Model   │     │   W-Matrix       │     │  Target Model   │
│                  │     │   Alignment      │     │                 │
│  ┌────────────┐  │     │  ┌────────────┐  │     │  ┌───────────┐ │
│  │ Base       │  │     │  │ Dimensional│  │     │  │ Base      │ │
│  │ Weights    │──┼──┐  │  │ Mapping    │  │  ┌──┼──│ Weights   │ │
│  └────────────┘  │  │  │  └────────────┘  │  │  │  └───────────┘ │
│  ┌────────────┐  │  │  │  ┌────────────┐  │  │  │  ┌───────────┐ │
│  │ Specialized│  │  ├──┼─>│ Transform  │──┼──┤  │  │ Enhanced  │ │
│  │ Weights    │──┼──┘  │  │ Engine     │  │  └──┼─>│ Weights   │ │
│  └────────────┘  │     │  └────────────┘  │     │  └───────────┘ │
└─────────────────┘     └──────────────────┘     └─────────────────┘
     EXTRACTION              ALIGNMENT              INJECTION
```

---

## Stage 1: Vector Extraction

Vector extraction isolates the learned capability weights from a source model. The process identifies the **weight deltas** -- the difference between the model's base state and its specialized state -- that encode a particular skill or knowledge domain.

### Extraction Process

1. **Baseline capture** -- Record the base model's weight state before specialization
2. **Delta computation** -- Calculate the difference between specialized and base weights
3. **Significance filtering** -- Remove weight changes below a significance threshold to reduce noise
4. **Layer attribution** -- Map each delta to its originating layer and attention head
5. **Compression** -- Apply lossless compression to the filtered deltas

```python
from awareness_sdk import VectorExtractor

extractor = VectorExtractor(
    source_model="gpt-4",
    base_checkpoint="gpt-4-base-20240601",
    specialized_checkpoint="gpt-4-medical-v3"
)

# Configure extraction parameters
extractor.configure(
    significance_threshold=0.001,   # Minimum weight delta to include
    layer_selection="all",          # Extract from all layers
    compression="zstd",             # Compression algorithm
    include_attention_heads=True    # Include attention head mappings
)

# Run extraction
vector = extractor.extract()
print(f"Extracted {vector.num_parameters:,} parameters")
print(f"Compression ratio: {vector.compression_ratio:.2f}x")
print(f"Package size: {vector.size_mb:.1f} MB")
```

### Extraction Parameters

| Parameter | Description | Default |
|---|---|---|
| `significance_threshold` | Minimum absolute delta value to retain | `0.001` |
| `layer_selection` | Which layers to extract from (`all`, `attention`, `ffn`, or list) | `all` |
| `compression` | Compression algorithm (`zstd`, `lz4`, `none`) | `zstd` |
| `include_attention_heads` | Whether to preserve attention head structure | `True` |
| `normalize` | Normalize deltas relative to layer magnitude | `True` |
| `quantization` | Weight quantization level (`fp32`, `fp16`, `int8`) | `fp16` |

### What Gets Extracted

The extraction process captures weight deltas across several component types:

| Component | Contains | Typical Size (% of total) |
|---|---|---|
| Attention weights | Query, key, value projection deltas | 35--45% |
| Feed-forward layers | MLP weight deltas | 30--40% |
| Layer normalization | Normalization parameter shifts | 5--10% |
| Embedding adjustments | Token embedding modifications | 10--15% |
| Positional encodings | Position-aware pattern changes | 2--5% |

---

## Stage 2: W-Matrix Alignment

Once a vector is extracted, it must be **aligned** to the target model's architecture before injection. The W-Matrix alignment process maps weight deltas from the source model's dimensional space into the target model's dimensional space.

This is the most computationally intensive step and is critical to preserving information fidelity. For a comprehensive treatment, see [W-Matrix Alignment](w-matrix-alignment.md).

### Alignment Overview

```
Source Vector (d_source dimensions)
        │
        ▼
┌───────────────────┐
│  W-Matrix         │
│  (d_source × d_target)  │
│                   │
│  Learned mapping  │
│  between model    │
│  representation   │
│  spaces           │
└───────────────────┘
        │
        ▼
Aligned Vector (d_target dimensions)
```

### Key Alignment Operations

1. **Dimensional mapping** -- Project source dimensions onto target dimensions using the pre-computed W-Matrix
2. **Attention head remapping** -- Redistribute attention patterns across different head counts
3. **Layer depth normalization** -- Adjust for different numbers of transformer layers
4. **Activation function compensation** -- Account for differences in activation functions (GeLU, SiLU, ReLU)
5. **Scale calibration** -- Normalize weight magnitudes for the target model's parameter scale

```python
from awareness_sdk import WMatrixAligner

aligner = WMatrixAligner(
    source_architecture="gpt-4",
    target_architecture="llama-3.1-70b"
)

# Load pre-computed W-Matrix (or compute on-demand)
aligner.load_matrix("gpt4-to-llama3-70b.wmatrix")

# Align the extracted vector
aligned_vector = aligner.align(
    vector=extracted_vector,
    quality_target=0.85,        # Target 85% retention
    optimization_passes=3       # Number of refinement iterations
)

print(f"Alignment quality: {aligned_vector.quality_score:.3f}")
print(f"Estimated retention: {aligned_vector.estimated_retention:.1%}")
```

---

## Stage 3: Injection into Target Model

The aligned vector is injected into the target model by applying the transformed weight deltas to the corresponding layers and components.

### Injection Process

1. **Checkpoint backup** -- Create a rollback point of the target model's current weights
2. **Layer-wise application** -- Apply aligned deltas to each target layer sequentially
3. **Gradient stabilization** -- Run a brief stabilization pass to smooth discontinuities
4. **Verification inference** -- Execute benchmark prompts to measure capability acquisition
5. **Retention scoring** -- Compare target model outputs against source model benchmarks

```python
from awareness_sdk import VectorInjector

injector = VectorInjector(
    target_model="llama-3.1-70b",
    endpoint="http://localhost:8080"
)

# Configure injection
injector.configure(
    learning_rate_scale=0.1,       # Scale factor for delta application
    stabilization_steps=100,       # Gradient stabilization iterations
    rollback_on_failure=True,      # Auto-rollback if quality drops
    quality_threshold=0.75         # Minimum acceptable retention
)

# Inject the aligned vector
result = injector.inject(aligned_vector)

print(f"Injection status: {result.status}")
print(f"Layers modified: {result.layers_modified}")
print(f"Measured retention: {result.measured_retention:.1%}")
print(f"Quality grade: {result.quality_grade}")
```

### Injection Modes

| Mode | Description | Use Case |
|---|---|---|
| `full` | Apply all deltas at full magnitude | Maximum capability transfer |
| `scaled` | Apply deltas with a scaling factor (0.0--1.0) | Gradual capability blending |
| `selective` | Apply only to specified layers | Targeted enhancement |
| `additive` | Add to existing specializations without overwriting | Stacking multiple vectors |

---

## Quality Metrics

The Awareness Network measures vector quality across multiple dimensions throughout the extraction-alignment-injection pipeline.

### Core Metrics

| Metric | Definition | Measurement Method |
|---|---|---|
| **Information Retention** | Percentage of source capability preserved in transfer | Benchmark comparison (source vs. target outputs) |
| **Behavioral Fidelity** | Similarity of decision patterns between source and target | Decision tree analysis on standardized test cases |
| **Output Coherence** | Quality and consistency of target model outputs post-injection | Automated coherence scoring using reference model |
| **Capability Delta** | Measurable improvement in target model's task performance | Pre/post benchmark scoring |
| **Interference Score** | Degree to which injection degrades existing capabilities | Regression testing on pre-existing benchmarks |

### Quality Grades

```
Grade A  (Retention >= 90%):  Exceptional transfer, near-source quality
Grade B  (Retention 80-89%):  High-quality transfer, minor degradation
Grade C  (Retention 70-79%):  Acceptable transfer, noticeable differences
Grade D  (Retention 60-69%):  Partial transfer, significant gaps
Grade F  (Retention < 60%):   Failed transfer, not recommended
```

---

## Information Retention Measurement

Retention is the primary quality indicator for vector transfers. It is measured through a standardized evaluation protocol:

### Measurement Protocol

1. **Benchmark suite selection** -- Choose domain-appropriate benchmarks matching the vector's capability
2. **Source baseline** -- Run benchmarks on the source model to establish ground truth
3. **Pre-injection baseline** -- Run benchmarks on the target model before injection
4. **Post-injection evaluation** -- Run benchmarks on the target model after injection
5. **Retention calculation** -- Compute retention as the ratio of capability gain to theoretical maximum

```
Retention = (Post_Score - Pre_Score) / (Source_Score - Pre_Score) * 100%
```

### Example Measurement

```python
from awareness_sdk import RetentionBenchmark

benchmark = RetentionBenchmark(
    domain="medical_reasoning",
    test_suite="medqa-2024",
    num_samples=500
)

# Measure source model performance
source_score = benchmark.evaluate(source_model)       # e.g., 0.92

# Measure target model before injection
pre_score = benchmark.evaluate(target_model)           # e.g., 0.45

# Measure target model after injection
post_score = benchmark.evaluate(target_model_injected) # e.g., 0.85

# Calculate retention
retention = (post_score - pre_score) / (source_score - pre_score)
print(f"Information retention: {retention:.1%}")       # 85.1%
```

---

## Performance Considerations

### Extraction Time

| Model Size | Extraction Time | Vector Size (compressed) |
|---|---|---|
| 7B parameters | 5--15 minutes | 50--200 MB |
| 13B parameters | 15--30 minutes | 100--400 MB |
| 70B parameters | 1--3 hours | 500 MB -- 2 GB |
| 175B+ parameters | 3--8 hours | 1--5 GB |

### Alignment Computation

W-Matrix alignment is typically pre-computed for popular model pairs. On-demand alignment for unsupported pairs requires:

- **CPU**: 2--8 hours depending on model sizes
- **GPU (A100)**: 10--60 minutes
- **GPU (H100)**: 5--30 minutes

### Injection Latency

Injection is the fastest stage, typically completing in seconds to minutes depending on model size and injection mode.

---

## Next Steps

- [W-Matrix Alignment](w-matrix-alignment.md) -- Deep dive into the alignment process
- [Buying and Selling](buying-and-selling.md) -- How to acquire and publish vectors
- [Quality and Retention](../memory-packages/quality-and-retention.md) -- Broader quality framework
