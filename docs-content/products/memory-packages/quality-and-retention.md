# Quality and Retention

## Overview

Quality assurance is critical for Memory Package transactions on the Awareness Network. Buyers need confidence that the cognitive state they purchase will function as advertised when loaded into their target model. This page details the quality metrics, grading system, and evaluation tools available for Memory Packages.

---

## Core Quality Metrics

Every Memory Package is evaluated across five core quality dimensions:

### 1. Information Retention Rate

The primary metric: the percentage of the source model's contextual understanding that is preserved after transfer to the target model.

```
Retention = Similarity(Target_Output, Source_Output) / Perfect_Score × 100%
```

Retention is measured by running a standardized set of probing queries against both the source model (with original KV-Cache) and the target model (with transferred KV-Cache), then comparing response quality and accuracy.

| Retention Level | Description |
|---|---|
| 97--100% | Indistinguishable from source |
| 93--97% | Minimal detectable difference |
| 88--93% | Minor omissions or imprecisions |
| 82--88% | Noticeable gaps in transferred context |
| 75--82% | Significant information loss |
| < 75% | Substantial degradation |

### 2. Coherence Score

Measures the internal consistency of the transferred memory state. A high coherence score means the target model can generate outputs that are self-consistent and logically connected to the transferred context.

```python
from awareness_sdk import QualityAssessor

assessor = QualityAssessor()

# Measure coherence of a loaded memory state
coherence = assessor.measure_coherence(
    target_model=target,
    memory_state=loaded_memory,
    num_probes=100,
    probe_types=["continuation", "summarization", "question_answering"]
)

print(f"Overall coherence: {coherence.score:.3f}")
print(f"  Continuation coherence:  {coherence.continuation:.3f}")
print(f"  Summarization coherence: {coherence.summarization:.3f}")
print(f"  QA coherence:            {coherence.question_answering:.3f}")
```

Coherence is scored on a 0.0--1.0 scale:

| Score | Interpretation |
|---|---|
| 0.95--1.00 | Excellent -- Fully coherent context |
| 0.85--0.95 | Good -- Minor inconsistencies |
| 0.75--0.85 | Acceptable -- Some disconnected elements |
| 0.60--0.75 | Poor -- Frequent coherence breaks |
| < 0.60 | Failed -- Context is largely incoherent |

### 3. Reasoning Fidelity

Measures how well the transferred state preserves multi-step reasoning chains. This metric specifically evaluates whether the target model can continue a line of reasoning that was developed in the source model.

Reasoning fidelity is assessed by:

1. Identifying reasoning chains in the source model's context
2. Prompting the target model to continue or reference those chains
3. Scoring whether conclusions, intermediate steps, and logical dependencies are preserved

```python
# Measure reasoning fidelity
fidelity = assessor.measure_reasoning_fidelity(
    target_model=target,
    memory_state=loaded_memory,
    source_reasoning_trace=source_trace,  # Ground truth reasoning
    evaluation_method="step_comparison"
)

print(f"Reasoning fidelity: {fidelity.score:.3f}")
print(f"  Steps preserved: {fidelity.steps_preserved}/{fidelity.total_steps}")
print(f"  Logical dependencies intact: {fidelity.dependencies_intact:.1%}")
print(f"  Conclusion alignment: {fidelity.conclusion_alignment:.3f}")
```

### 4. Context Completeness

Measures whether all elements of the original context are represented in the transferred state. A context may have high coherence (internally consistent) but low completeness (missing key pieces).

| Aspect | Measurement |
|---|---|
| Entity coverage | Are all key entities from the source context present? |
| Relationship preservation | Are relationships between entities maintained? |
| Temporal ordering | Is the sequence of events/reasoning preserved? |
| Detail granularity | Are fine-grained details retained, or only summaries? |

### 5. Interference Assessment

Measures whether loading the memory state degrades the target model's pre-existing capabilities. A well-transferred memory should enhance the model's understanding without harming its general performance.

```python
# Measure interference
interference = assessor.measure_interference(
    target_model=target,
    baseline_benchmarks=pre_load_scores,
    post_load_benchmarks=post_load_scores
)

print(f"Interference score: {interference.score:.3f}")
print(f"  General knowledge impact: {interference.general_knowledge:.3f}")
print(f"  Reasoning ability impact: {interference.reasoning:.3f}")
print(f"  Language fluency impact:  {interference.fluency:.3f}")
print(f"  Verdict: {interference.verdict}")  # "No interference" / "Minor" / "Significant"
```

---

## Quality Grades

The Awareness Network assigns a **letter grade** to every Memory Package based on a composite score derived from all five quality metrics.

### Grading Formula

```
Composite Score = (
    0.35 × Retention_Rate +
    0.25 × Coherence_Score +
    0.20 × Reasoning_Fidelity +
    0.10 × Context_Completeness +
    0.10 × (1.0 - Interference_Score)
)
```

### Grade Thresholds

| Grade | Composite Score | Badge | Marketplace Visibility |
|---|---|---|---|
| **A+** | >= 0.97 | Platinum | Featured, top placement |
| **A** | >= 0.93 | Gold | High visibility |
| **B** | >= 0.85 | Silver | Standard visibility |
| **C** | >= 0.75 | Bronze | Reduced visibility |
| **D** | >= 0.65 | None | Warning label displayed |
| **F** | < 0.65 | None | Not listed (quality gate) |

### Grade Distribution on Marketplace

```
Typical grade distribution of listed Memory Packages:

  A+  ████░░░░░░░░░░░░░░░░  8%
  A   ████████████░░░░░░░░  25%
  B   ██████████████████░░  38%
  C   ██████████░░░░░░░░░░  22%
  D   ███░░░░░░░░░░░░░░░░░  7%
  F   (not listed)          --
```

---

## Evaluating Before Purchase

Buyers have several tools available to assess Memory Package quality before committing AMEM tokens.

### 1. Quality Certificate Review

Every listed Memory Package includes a publicly viewable quality certificate:

```python
from awareness_sdk import Marketplace

market = Marketplace(api_key="your-api-key")

# View quality certificate
listing = market.memories.get("mem_xyz789")
cert = listing.quality_certificate

print(f"Quality Certificate for: {listing.name}")
print(f"{'='*50}")
print(f"Grade:                {cert.grade}")
print(f"Composite Score:      {cert.composite_score:.3f}")
print(f"")
print(f"Retention Rate:       {cert.retention_rate:.1%}")
print(f"Coherence Score:      {cert.coherence_score:.3f}")
print(f"Reasoning Fidelity:   {cert.reasoning_fidelity:.3f}")
print(f"Context Completeness: {cert.context_completeness:.3f}")
print(f"Interference Score:   {cert.interference_score:.3f}")
print(f"")
print(f"Verified by:          {cert.verifier}")
print(f"Verification date:    {cert.verification_date}")
print(f"Verification method:  {cert.method}")
```

### 2. Compatibility Estimation

Run a free compatibility check to see estimated quality for your specific target model (see [Cross-Model Compatibility](cross-model-compatibility.md)):

```python
from awareness_sdk import MemoryCompatibilityChecker

checker = MemoryCompatibilityChecker()
report = checker.check(
    memory_listing=listing,
    target_model="your-target-model"
)
```

### 3. Buyer Reviews and Ratings

Browse verified buyer reviews that include measured retention after loading:

```python
reviews = listing.reviews(sort_by="helpful", limit=10)
for review in reviews:
    print(f"Rating: {'★' * review.rating}{'☆' * (5 - review.rating)}")
    print(f"Target model: {review.target_model}")
    print(f"Measured retention: {review.measured_retention:.1%}")
    print(f"Comment: {review.comment}")
    print()
```

### 4. Trial Access

Some sellers offer time-limited trial access. During trial, you can load the memory into your model and run your own quality assessments:

```python
# Request trial access
trial = market.memories.request_trial("mem_xyz789")

if trial.granted:
    # Download temporary trial package
    trial_package = trial.download()

    # Load and evaluate
    result = trial_package.load_into(target, verify=True)
    print(f"Trial retention: {result.measured_retention:.1%}")

    # Trial expires automatically after the granted period
    print(f"Trial expires: {trial.expires_at}")
```

### 5. Preview Summary

View a summary of what the memory contains without purchasing:

```python
preview = listing.preview()

print(f"Context summary: {preview.summary}")
print(f"Key topics: {', '.join(preview.topics)}")
print(f"Token count: {preview.token_count:,}")
print(f"Reasoning depth: {preview.reasoning_depth}")
print(f"Source model: {preview.source_model}")
print(f"Capture context: {preview.capture_context}")
```

---

## Quality Assessment Pipeline

For sellers, the quality assessment pipeline runs automatically during the publishing process:

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ Extract  │───>│ Self-    │───>│ Cross-   │───>│ Grade    │───>│ Certify  │
│ memory   │    │ model    │    │ model    │    │ assign   │    │ and list │
│          │    │ test     │    │ test     │    │          │    │          │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
```

1. **Extract** -- Capture the KV-Cache from the source model
2. **Self-model test** -- Verify retention when reloading into the same model (baseline)
3. **Cross-model test** -- Measure retention across 3+ target model architectures
4. **Grade assignment** -- Compute composite score and assign letter grade
5. **Certify and list** -- Generate quality certificate and publish to marketplace

---

## Continuous Quality Monitoring

The Awareness Network continuously monitors quality through:

- **Post-purchase retention reports** -- Buyers voluntarily report measured retention
- **Automated spot checks** -- Platform periodically re-evaluates listed packages
- **Model update tracking** -- When models are updated, affected packages are flagged for re-evaluation
- **Seller quality scores** -- Sellers build reputation based on consistent quality delivery

---

## Next Steps

- [KV-Cache Transfer](kv-cache-transfer.md) -- Technical transfer mechanism
- [Cross-Model Compatibility](cross-model-compatibility.md) -- Compatibility matrix and estimation
- [Memory Packages Overview](README.md) -- Return to product overview
