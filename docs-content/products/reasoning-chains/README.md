# Reasoning Chains

## Overview

Reasoning Chains are the Awareness Network's highest-fidelity product, capturing not just *what* an AI model concluded, but *how* it arrived at that conclusion. A Reasoning Chain is a structured record of the multi-step solution process a model used to solve a problem -- the sequence of thoughts, hypotheses, verifications, and logical connections that led to a final answer.

With approximately **98% information retention**, Reasoning Chains preserve the full problem-solving methodology, making them invaluable for education, pattern learning, and replicable problem-solving.

---

## What Are Reasoning Chains?

A Reasoning Chain is a directed graph of **thought nodes**, where each node represents a discrete step in the model's reasoning process. Unlike Memory Packages (which transfer raw attention state) or Vector Packages (which transfer learned weights), Reasoning Chains operate at the **semantic level** -- they capture the logical structure of problem-solving itself.

```
┌─────────────────────────────────────────────────────────┐
│                    Reasoning Chain                        │
│                                                          │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐          │
│  │ Problem  │───>│ Analysis │───>│ Hypothesis│          │
│  │ Framing  │    │          │    │ 1        │          │
│  └──────────┘    └──────────┘    └──────┬───┘          │
│                                         │               │
│                                    ┌────┴────┐          │
│                                    │         │          │
│                               ┌────▼───┐ ┌──▼───────┐  │
│                               │ Test   │ │ Test     │  │
│                               │ Path A │ │ Path B   │  │
│                               └────┬───┘ └──┬───────┘  │
│                                    │         │          │
│                                    └────┬────┘          │
│                                         │               │
│                                    ┌────▼────┐          │
│                                    │ Verify  │          │
│                                    │ & Merge │          │
│                                    └────┬────┘          │
│                                         │               │
│                                    ┌────▼────┐          │
│                                    │Conclusion│          │
│                                    └─────────┘          │
└─────────────────────────────────────────────────────────┘
```

### Key Properties

| Property | Description |
|---|---|
| **Structured** | Each step is a typed node with defined inputs and outputs |
| **Directed** | Steps follow logical dependency order |
| **Branching** | Chains can split to explore multiple hypotheses |
| **Annotated** | Each node carries metadata (confidence, model, timestamp) |
| **Replayable** | Chains can be "replayed" to guide another model through the same reasoning |
| **Composable** | Chains can be combined, extended, or modified |

---

## Information Retention

Reasoning Chains achieve approximately **98% information retention** -- the highest of any Awareness Network product. This is because the transfer operates at the semantic and structural level rather than the numerical weight level.

| Aspect | Retention | Why |
|---|---|---|
| Logical structure | 99%+ | Explicit graph representation, no lossy transformation |
| Step content | 97--99% | Natural language descriptions are architecture-independent |
| Confidence metadata | 99%+ | Numeric metadata transfers losslessly |
| Reasoning dependencies | 97--99% | Dependency graph is explicitly encoded |
| Branching decisions | 96--98% | Branch conditions are explicitly recorded |

### Why Retention Is So High

Unlike vectors and memories, Reasoning Chains are:

1. **Architecture-independent** -- The chain is represented in a universal format, not in model-specific weight space
2. **Semantically explicit** -- Each step is described in natural language, not encoded in numerical tensors
3. **Structurally preserved** -- The graph structure is stored as an explicit data structure, not implicit in attention patterns

---

## Use Cases

### Education and Training

Reasoning Chains are powerful educational tools. Instead of giving a student model (or a human learner) just the answer, the chain provides the complete thought process.

**Example**: A chain that shows how a model diagnosed a rare medical condition step-by-step -- from symptom analysis through differential diagnosis to final conclusion -- teaches the *methodology*, not just the answer.

```python
from awareness_sdk import ReasoningChain

# Load an educational reasoning chain
chain = ReasoningChain.load("./chains/differential-diagnosis-lupus.awrc")

# Display the reasoning steps
for step in chain.walk():
    print(f"Step {step.index}: [{step.type}] {step.title}")
    print(f"  Content: {step.content[:200]}...")
    print(f"  Confidence: {step.confidence:.1%}")
    print(f"  Dependencies: {step.dependency_ids}")
    print()
```

### Pattern Learning

Models can learn problem-solving patterns by studying collections of Reasoning Chains. A model that has ingested chains for many similar problems develops meta-reasoning capabilities -- it learns not just solutions, but solution *strategies*.

**Example**: Feeding a model 100 chains of mathematical proof construction teaches it proof strategies (contradiction, induction, construction) and when to apply each.

```python
from awareness_sdk import ChainCollection, PatternExtractor

# Load a collection of related chains
collection = ChainCollection.load("./chains/math-proofs/")

# Extract common patterns
extractor = PatternExtractor()
patterns = extractor.analyze(collection)

for pattern in patterns:
    print(f"Pattern: {pattern.name}")
    print(f"  Frequency: {pattern.frequency:.1%}")
    print(f"  Avg. steps: {pattern.avg_steps}")
    print(f"  Domains: {', '.join(pattern.domains)}")
    print(f"  Template: {pattern.template_summary}")
```

### Problem-Solving Templates

Reasoning Chains can serve as templates for solving new, similar problems. A model can follow the structure of an existing chain while adapting the content to a new problem.

**Example**: A chain that solved a supply chain optimization problem can serve as a template for solving a different logistics optimization, preserving the approach while changing the specifics.

```python
from awareness_sdk import ReasoningChain, ChainReplayer

# Load a template chain
template = ReasoningChain.load("./chains/supply-chain-optimization.awrc")

# Create a replayer that guides a model through the same reasoning pattern
replayer = ChainReplayer(
    chain=template,
    target_model=target,
    adaptation_mode="structural"   # Follow structure, adapt content
)

# Replay with a new problem
new_problem = "Optimize delivery routes for 50 warehouses across 3 regions..."
result = replayer.replay(
    new_context=new_problem,
    allow_branching=True,
    max_adaptations=5
)

print(f"Template steps: {template.num_steps}")
print(f"Adapted steps: {result.num_steps}")
print(f"Structural similarity: {result.structural_similarity:.1%}")
print(f"Solution quality: {result.quality_score:.3f}")
```

### Research and Reproducibility

Reasoning Chains provide a transparent audit trail for AI-generated analysis, enabling:

- **Peer review** -- Examine exactly how a model reached its conclusions
- **Reproducibility** -- Replay chains to verify results independently
- **Debugging** -- Identify where reasoning went wrong in failed analyses
- **Comparison** -- Compare reasoning strategies across different models

### Knowledge Transfer Between Teams

Teams can share not just results but the reasoning behind them:

- A senior engineer's debugging chain teaches junior team members systematic debugging
- A data scientist's analysis chain documents the thought process behind modeling decisions
- A researcher's hypothesis-testing chain preserves the experimental reasoning for future reference

---

## Pricing

Reasoning Chains are priced in **AMEM tokens** based on:

| Factor | Impact |
|---|---|
| **Chain complexity** | More steps and branches command higher prices |
| **Domain value** | High-value domains (medical, legal, financial) are priced higher |
| **Source model quality** | Chains from premium models are valued more |
| **Verification status** | Verified chains with quality certificates earn premiums |
| **Reusability** | General templates are priced higher than problem-specific chains |

### Typical Price Ranges

```
Simple chains (3-10 steps):           10-100 AMEM
Moderate chains (10-30 steps):        100-500 AMEM
Complex chains (30-100 steps):        500-5,000 AMEM
Expert multi-branch chains (100+):    5,000-50,000 AMEM
Curated chain collections:            1,000-100,000 AMEM
```

---

## Supported Formats

| Format | Extension | Description |
|---|---|---|
| Awareness Reasoning Chain | `.awrc` | Native format with full metadata |
| Chain JSON | `.chain.json` | Human-readable JSON representation |
| Chain Graph | `.chain.graphml` | GraphML format for visualization tools |
| Markdown Export | `.chain.md` | Readable Markdown for documentation |

---

## Getting Started

```python
from awareness_sdk import Marketplace

market = Marketplace(api_key="your-api-key")

# Browse reasoning chains
results = market.chains.search(
    query="algorithm optimization dynamic programming",
    min_steps=10,
    max_price=1000,
    verified_only=True,
    sort_by="quality_score"
)

for chain in results.items:
    print(f"{chain.name}")
    print(f"  Steps: {chain.num_steps} | Branches: {chain.num_branches}")
    print(f"  Domain: {chain.domain} | Quality: {chain.quality_score:.3f}")
    print(f"  Price: {chain.price} AMEM")
```

---

## Next Steps

- [Chain Structure](chain-structure.md) -- Detailed anatomy of a reasoning chain
- [Publishing Chains](publishing-chains.md) -- How to capture and sell your reasoning chains
- [Evaluation Metrics](evaluation-metrics.md) -- Quality scoring and evaluation
