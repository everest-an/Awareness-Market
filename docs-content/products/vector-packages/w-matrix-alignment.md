# W-Matrix Alignment

## Overview

The **W-Matrix** (Weight-space Mapping Matrix) is the core technology that enables cross-architecture capability transfer in the Awareness Network. It provides a learned mapping between the internal representation spaces of different AI model architectures, allowing Vector Packages and Memory Packages to be translated from one model's "language" into another's.

Without the W-Matrix, capability transfer would be limited to models sharing identical architectures. With it, a vector extracted from GPT-4 can be meaningfully injected into LLaMA, Claude, Mistral, or any other supported model.

---

## What Is the W-Matrix?

The W-Matrix is a transformation matrix `W` of dimensions `(d_source x d_target)` that maps vectors from the source model's representation space into the target model's representation space while preserving as much semantic meaning as possible.

```
V_target = W * V_source

Where:
  V_source  = Capability vector in source model space (d_source dimensions)
  W         = Alignment matrix (d_source x d_target)
  V_target  = Aligned vector in target model space (d_target dimensions)
```

### Conceptual Analogy

Think of the W-Matrix as a translator between two languages. Each AI model "thinks" in its own internal language -- its learned representation space. The W-Matrix translates concepts from one model's language into another's, preserving meaning even when the grammars (architectures) differ significantly.

### W-Matrix Components

| Component | Purpose |
|---|---|
| **Dimensional projection** | Maps between different hidden dimension sizes |
| **Attention head mapping** | Redistributes attention patterns across different head counts |
| **Layer correspondence** | Identifies functionally equivalent layers across architectures |
| **Activation compensation** | Adjusts for different activation functions |
| **Scale normalization** | Corrects for parameter magnitude differences |

---

## How the W-Matrix Maps Between Architectures

### Architecture Differences

Different model architectures vary across several key dimensions that the W-Matrix must reconcile:

| Dimension | GPT-4 | Claude 3 Opus | LLaMA 3.1 70B | Mistral Large |
|---|---|---|---|---|
| Hidden size | 12,288* | 8,192* | 8,192 | 8,192 |
| Attention heads | 96* | 64* | 64 | 64 |
| Layers | 120* | 80* | 80 | 80 |
| Activation | GeLU | SiLU | SiLU | SiLU |
| Positional encoding | Learned | RoPE | RoPE | RoPE + Sliding |
| Vocabulary size | 100,277 | ~65,000* | 128,256 | 32,768 |

*Estimated values for proprietary models.

### Mapping Process

The W-Matrix alignment process operates in several phases:

```
Phase 1: Structural Analysis
    ├── Parse source architecture metadata
    ├── Parse target architecture metadata
    └── Identify structural correspondences

Phase 2: Representation Alignment
    ├── Compute shared semantic anchors
    ├── Learn dimensional projection via anchor alignment
    └── Validate projection on held-out anchors

Phase 3: Component-Level Mapping
    ├── Attention head redistribution
    ├── Feed-forward layer alignment
    ├── Normalization parameter adjustment
    └── Embedding space projection

Phase 4: Calibration
    ├── Fine-tune mapping on benchmark tasks
    ├── Measure quality metrics
    └── Generate quality certificate
```

### Semantic Anchors

The W-Matrix is learned by aligning **semantic anchors** -- internal representations of shared concepts that both models understand. The process:

1. Feed identical prompts to both source and target models
2. Extract internal representations at each layer
3. Identify corresponding activation patterns
4. Use these correspondences to learn the optimal linear transformation

```python
from awareness_sdk import WMatrixTrainer

trainer = WMatrixTrainer(
    source_model="gpt-4",
    target_model="llama-3.1-70b"
)

# Configure anchor generation
trainer.configure(
    num_anchors=10000,              # Number of shared concept probes
    anchor_domains=[                # Domains to sample from
        "general_knowledge",
        "reasoning",
        "language_understanding",
        "code",
        "mathematics"
    ],
    layers="all",                   # Align all layers
    optimization="svd",            # Use SVD-based optimization
    regularization=0.01            # L2 regularization strength
)

# Train the W-Matrix
w_matrix = trainer.train(
    epochs=100,
    validation_split=0.2,
    early_stopping_patience=10
)

print(f"Training complete")
print(f"Alignment accuracy: {w_matrix.accuracy:.3f}")
print(f"Reconstruction error: {w_matrix.reconstruction_error:.4f}")

# Save for reuse
w_matrix.save("gpt4-to-llama3-70b.wmatrix")
```

---

## Quality Estimation Before Purchase

One of the most valuable features of the W-Matrix system is the ability to **estimate transfer quality before purchasing** a Vector Package. Buyers can check how well a vector will transfer to their specific model without spending AMEM tokens.

### Pre-Purchase Compatibility Check

```python
from awareness_sdk import Marketplace, CompatibilityChecker

market = Marketplace(api_key="your-api-key")
checker = CompatibilityChecker()

# Get a vector listing
listing = market.vectors.get("vec_abc123")

# Run compatibility estimation (free, no purchase required)
estimate = checker.estimate(
    vector_listing=listing,
    target_model="llama-3.1-70b",
    target_config={
        "quantization": "fp16",
        "context_length": 128000,
        "custom_fine_tune": "my-checkpoint-v2"  # Optional
    }
)

print(f"Compatibility Report for: {listing.name}")
print(f"{'='*50}")
print(f"Source model:         {listing.source_model}")
print(f"Target model:         llama-3.1-70b")
print(f"Estimated retention:  {estimate.retention:.1%}")
print(f"Confidence interval:  {estimate.ci_low:.1%} - {estimate.ci_high:.1%}")
print(f"Alignment quality:    {estimate.alignment_quality:.3f}")
print(f"Risk level:           {estimate.risk_level}")
print(f"Recommendation:       {estimate.recommendation}")
```

### Quality Estimation Metrics

| Metric | Range | Description |
|---|---|---|
| **Estimated Retention** | 0--100% | Predicted capability preservation |
| **Confidence Interval** | +/- range | Statistical confidence bounds on retention estimate |
| **Alignment Quality** | 0.0--1.0 | How well the W-Matrix maps between these architectures |
| **Risk Level** | Low / Medium / High | Overall transfer risk assessment |
| **Dimensional Loss** | 0.0--1.0 | Information lost in dimensional projection |
| **Structural Mismatch** | 0.0--1.0 | Degree of architectural incompatibility |

---

## Supported Model Pairs

The Awareness Network maintains **pre-computed W-Matrices** for all combinations of fully supported models. Pre-computed matrices provide instant compatibility estimation and optimal transfer quality.

### Full Support Matrix

| Source \ Target | GPT-4 | GPT-4o | Claude 3.5 | Claude 3 Opus | LLaMA 3.1 | Mistral Large | Gemini Pro |
|---|---|---|---|---|---|---|---|
| **GPT-4** | -- | 95% | 87% | 86% | 85% | 84% | 86% |
| **GPT-4o** | 94% | -- | 88% | 87% | 86% | 85% | 87% |
| **Claude 3.5** | 86% | 87% | -- | 93% | 86% | 85% | 85% |
| **Claude 3 Opus** | 85% | 86% | 92% | -- | 85% | 84% | 84% |
| **LLaMA 3.1** | 84% | 85% | 85% | 84% | -- | 89% | 84% |
| **Mistral Large** | 83% | 84% | 84% | 83% | 88% | -- | 83% |
| **Gemini Pro** | 85% | 86% | 84% | 83% | 83% | 82% | -- |

Values represent **typical retention percentages** for Grade B or higher vectors. Actual retention varies by vector quality and capability domain.

### Partial Support Models

For models with partial W-Matrix support, alignment matrices are computed on-demand:

| Model | On-Demand Alignment Time | Typical Retention |
|---|---|---|
| Falcon 180B | 15--30 minutes | 75--82% |
| Phi-3 Medium | 5--10 minutes | 78--85% |
| Command R+ | 10--20 minutes | 76--83% |
| Qwen 2 72B | 10--20 minutes | 79--86% |
| DBRX | 15--25 minutes | 74--81% |

---

## Alignment Accuracy Metrics

The quality of the W-Matrix alignment is measured through several complementary metrics:

### Primary Metrics

| Metric | Definition | Target |
|---|---|---|
| **Reconstruction Error** | Mean squared error when round-tripping through W-Matrix | < 0.05 |
| **Semantic Preservation** | Cosine similarity of aligned representations vs. ground truth | > 0.90 |
| **Task Transfer Accuracy** | Performance on benchmark tasks after alignment | > 85% of source |
| **Attention Pattern Fidelity** | Similarity of attention distributions post-alignment | > 0.85 |
| **Gradient Stability** | Absence of gradient explosion/vanishing after injection | Pass/Fail |

### Alignment Quality Tiers

```
Tier 1 -- Excellent (Reconstruction Error < 0.02):
  Same-family transfers (e.g., Claude 3 to Claude 3.5)
  Expected retention: 90-95%

Tier 2 -- Good (Reconstruction Error 0.02-0.05):
  Cross-family, similar architecture (e.g., LLaMA to Mistral)
  Expected retention: 82-90%

Tier 3 -- Acceptable (Reconstruction Error 0.05-0.10):
  Cross-family, different architecture (e.g., GPT-4 to LLaMA)
  Expected retention: 75-85%

Tier 4 -- Marginal (Reconstruction Error 0.10-0.20):
  Highly different architectures or model generations
  Expected retention: 60-75%
```

### Monitoring Alignment Drift

W-Matrices are periodically revalidated to account for model updates. The platform monitors:

```python
from awareness_sdk import WMatrixMonitor

monitor = WMatrixMonitor()

# Check the current status of a W-Matrix
status = monitor.check("gpt4-to-llama3-70b.wmatrix")

print(f"Matrix version: {status.version}")
print(f"Last validated: {status.last_validated}")
print(f"Current accuracy: {status.accuracy:.3f}")
print(f"Drift detected: {status.drift_detected}")
print(f"Recommended action: {status.recommendation}")
```

---

## Advanced Topics

### Custom W-Matrix Training

For custom or fine-tuned models not in the standard support matrix, you can train a dedicated W-Matrix:

```python
from awareness_sdk import WMatrixTrainer

trainer = WMatrixTrainer(
    source_model="your-custom-model",
    target_model="llama-3.1-70b",
    source_endpoint="http://your-model:8080",
    target_endpoint="http://llama-endpoint:8080"
)

w_matrix = trainer.train(
    num_anchors=5000,
    epochs=50,
    anchor_domains=["your_domain"]
)

# Register for reuse
w_matrix.register(name="custom-to-llama3-70b")
```

### Multi-Hop Alignment

When direct alignment between two models yields poor results, the system can perform **multi-hop alignment** through an intermediary model:

```
Source (Model A) --W1--> Intermediary (Model B) --W2--> Target (Model C)
```

This sometimes produces better results than direct alignment when the intermediary model shares architectural similarities with both the source and target.

```python
from awareness_sdk import MultiHopAligner

aligner = MultiHopAligner()
result = aligner.find_optimal_path(
    source="falcon-180b",
    target="phi-3-medium"
)

print(f"Optimal path: {' -> '.join(result.path)}")
print(f"Expected retention: {result.estimated_retention:.1%}")
print(f"Direct alignment retention: {result.direct_retention:.1%}")
```

---

## Next Steps

- [How Vectors Work](how-vectors-work.md) -- Full technical pipeline overview
- [Buying and Selling](buying-and-selling.md) -- Marketplace guide
- [Cross-Model Compatibility](../memory-packages/cross-model-compatibility.md) -- W-Matrix for Memory Packages
