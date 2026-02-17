# Vector Packages

## Overview

Vector Packages are the foundational product of the Awareness Network marketplace. A Vector Package contains **trained capability weights** extracted from one AI model that can be transferred to another, enabling models to acquire new skills, domain expertise, and behavioral patterns without retraining from scratch.

At their core, vectors represent the learned parameters that encode a model's proficiency in a specific domain or task. Through the Awareness Network's proprietary extraction and alignment pipeline, these weights are isolated, packaged, and made portable across different model architectures.

---

## What Are Vector Packages?

A Vector Package is a serialized collection of neural network weight deltas that capture a specific capability. When a model has been fine-tuned or has developed expertise in a particular area, the difference between its general-purpose weights and its specialized weights constitutes a **capability vector**.

```
Capability Vector = Specialized_Weights - Base_Weights
```

These vectors can then be applied to other models through the W-Matrix alignment process, effectively "teaching" the target model a new capability.

### Package Structure

Each Vector Package contains:

| Component | Description |
|---|---|
| `vector_payload` | The serialized weight deltas (compressed) |
| `source_manifest` | Metadata about the source model and training context |
| `w_matrix_profile` | Pre-computed alignment data for supported target models |
| `quality_certificate` | Verified retention and accuracy metrics |
| `compatibility_map` | List of target models and expected retention rates |

---

## Use Cases

Vector Packages unlock a broad range of capability transfer scenarios:

### Natural Language Processing (NLP)

Transfer specialized language understanding between models, including:

- **Multilingual proficiency** -- Add fluency in underrepresented languages to a base model
- **Sentiment analysis** -- Transfer fine-tuned sentiment detection capabilities
- **Named entity recognition** -- Share domain-specific NER models (medical, legal, financial)
- **Summarization styles** -- Transfer preferred summarization approaches and formats

### Code Generation

Share programming expertise across models:

- **Language-specific mastery** -- Transfer deep expertise in Rust, Haskell, or niche languages
- **Framework knowledge** -- Share understanding of specific frameworks (React, Django, Rails)
- **Code style and patterns** -- Transfer architectural decision-making patterns
- **Debugging strategies** -- Share systematic debugging approaches

### Domain Expertise

Enable models to acquire specialized knowledge:

- **Medical reasoning** -- Transfer clinical decision-making patterns
- **Legal analysis** -- Share case law reasoning and statutory interpretation skills
- **Financial modeling** -- Transfer quantitative analysis capabilities
- **Scientific research** -- Share hypothesis formation and experimental design patterns

### Creative and Generative Tasks

- **Writing styles** -- Transfer specific authorial voices or genre expertise
- **Visual description** -- Share enhanced scene description capabilities
- **Dialogue generation** -- Transfer natural conversation patterns

---

## Information Retention

Vector Packages achieve approximately **85% information retention** when transferred between compatible model architectures. This metric represents the proportion of the source model's capability that is successfully preserved in the target model after injection.

| Transfer Type | Typical Retention | Notes |
|---|---|---|
| Same architecture (e.g., LLaMA to LLaMA) | 90--95% | Minimal alignment loss |
| Same family (e.g., GPT-4 to GPT-4 Turbo) | 88--92% | Near-native transfer |
| Cross-architecture (e.g., Claude to LLaMA) | 80--88% | W-Matrix alignment required |
| Cross-generation (e.g., GPT-3.5 to GPT-4) | 75--85% | Dimensional mapping needed |

Retention is measured across multiple dimensions including task accuracy, behavioral consistency, and output quality. See [W-Matrix Alignment](w-matrix-alignment.md) for details on how alignment affects retention.

---

## Pricing Model

All Vector Package transactions on the Awareness Network are denominated in **AMEM tokens** (Awareness Memory tokens), the native utility token of the platform.

### Pricing Factors

| Factor | Impact on Price |
|---|---|
| Source model quality | Higher-quality source models command premium pricing |
| Vector dimensionality | Larger vectors with more parameters cost more |
| Retention guarantee | Packages with higher guaranteed retention are priced higher |
| Domain rarity | Niche expertise vectors carry scarcity premiums |
| Verification status | Independently verified packages earn trust premiums |

### Example Pricing Tiers

```
Tier 1 -- Basic Vectors:        50-200 AMEM
  General-purpose capabilities, common domains

Tier 2 -- Professional Vectors:  200-1,000 AMEM
  Specialized domain expertise, high retention

Tier 3 -- Premium Vectors:       1,000-10,000 AMEM
  Rare capabilities, cutting-edge models, verified quality

Tier 4 -- Enterprise Vectors:    Custom pricing
  Bulk packages, exclusive capabilities, SLA-backed
```

Sellers set their own prices, and the marketplace applies a **5% platform fee** on each transaction.

---

## Supported Models

The Awareness Network supports vector extraction and injection across a broad range of leading AI model architectures:

| Model | Extraction | Injection | W-Matrix Support |
|---|---|---|---|
| GPT-4 / GPT-4 Turbo | Yes | Yes | Full |
| GPT-4o | Yes | Yes | Full |
| Claude 3.5 / Claude 3 Opus | Yes | Yes | Full |
| LLaMA 3 / LLaMA 3.1 | Yes | Yes | Full |
| Mistral / Mixtral | Yes | Yes | Full |
| Gemini Pro / Ultra | Yes | Yes | Full |
| Falcon | Yes | Yes | Partial |
| Phi-3 | Yes | Yes | Partial |
| Command R+ | Yes | Yes | Partial |
| Custom fine-tuned models | Via API | Via API | On request |

Models with **Full** W-Matrix support have pre-computed alignment matrices for all other fully supported models, enabling instant compatibility estimation. Models with **Partial** support require on-demand alignment computation.

---

## Getting Started

1. **Browse the marketplace** -- Explore available Vector Packages by category, model, or domain. See [Buying and Selling](buying-and-selling.md).
2. **Check compatibility** -- Use the W-Matrix compatibility tool to estimate retention for your target model. See [W-Matrix Alignment](w-matrix-alignment.md).
3. **Purchase and download** -- Acquire vectors using AMEM tokens and download the package.
4. **Inject into your model** -- Use the Awareness SDK to apply the vector to your target model.

```python
from awareness_sdk import VectorPackage, ModelTarget

# Load a purchased vector package
package = VectorPackage.load("./downloads/nlp-sentiment-v2.awv")

# Check compatibility with your target model
target = ModelTarget(model="llama-3.1-70b", endpoint="http://localhost:8080")
compatibility = package.check_compatibility(target)
print(f"Expected retention: {compatibility.retention_rate}%")

# Inject the vector
result = package.inject(target, verify=True)
print(f"Injection complete. Verified retention: {result.measured_retention}%")
```

---

## Next Steps

- [How Vectors Work](how-vectors-work.md) -- Technical deep dive into vector extraction and injection
- [Buying and Selling](buying-and-selling.md) -- Marketplace guide for purchasing and publishing vectors
- [W-Matrix Alignment](w-matrix-alignment.md) -- Understanding cross-model compatibility
