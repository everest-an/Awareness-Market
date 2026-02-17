# Evaluation Metrics

## Overview

The Awareness Network employs a comprehensive evaluation framework to assess the quality of Reasoning Chains. This framework ensures that chains listed on the marketplace are logically sound, complete, and valuable to buyers. Every chain is scored across multiple dimensions, and these scores determine the chain's quality grade and marketplace visibility.

---

## Core Evaluation Dimensions

Reasoning Chain quality is measured across five core dimensions:

```
┌─────────────────────────────────────────────────────────────┐
│              Reasoning Chain Quality Model                    │
│                                                              │
│  ┌──────────────────┐    Weight: 25%                        │
│  │ Chain             │    Does the chain cover all necessary │
│  │ Completeness      │    reasoning steps?                   │
│  └──────────────────┘                                       │
│  ┌──────────────────┐    Weight: 25%                        │
│  │ Step              │    Does each step logically follow    │
│  │ Coherence         │    from its predecessors?             │
│  └──────────────────┘                                       │
│  ┌──────────────────┐    Weight: 25%                        │
│  │ Reasoning         │    Is the logical reasoning sound     │
│  │ Validity          │    and free of fallacies?             │
│  └──────────────────┘                                       │
│  ┌──────────────────┐    Weight: 15%                        │
│  │ Problem-Solution  │    Does the conclusion actually       │
│  │ Alignment         │    answer the original question?      │
│  └──────────────────┘                                       │
│  ┌──────────────────┐    Weight: 10%                        │
│  │ Automated Quality │    Composite automated scoring        │
│  │ Score             │    across structural metrics           │
│  └──────────────────┘                                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 1. Chain Completeness

Chain completeness measures whether the reasoning chain includes all necessary steps to move from problem statement to conclusion, without unexplained logical jumps.

### What Is Measured

| Aspect | Description | Weight |
|---|---|---|
| **Step coverage** | Are all necessary reasoning phases present? | 30% |
| **Logical continuity** | Are there gaps between consecutive steps? | 25% |
| **Evidence support** | Are claims supported by evidence or prior steps? | 20% |
| **Branch resolution** | Are all branches resolved (converged or explicitly pruned)? | 15% |
| **Assumption explicitness** | Are assumptions stated explicitly? | 10% |

### Measurement Method

The completeness evaluator uses a trained model to analyze the chain for missing steps:

```python
from awareness_sdk import CompletenessEvaluator

evaluator = CompletenessEvaluator()

result = evaluator.evaluate(chain)

print(f"Completeness score: {result.score:.3f}")
print(f"\nBreakdown:")
print(f"  Step coverage:          {result.step_coverage:.3f}")
print(f"  Logical continuity:     {result.logical_continuity:.3f}")
print(f"  Evidence support:       {result.evidence_support:.3f}")
print(f"  Branch resolution:      {result.branch_resolution:.3f}")
print(f"  Assumption explicitness:{result.assumption_explicitness:.3f}")

if result.gaps:
    print(f"\nIdentified gaps:")
    for gap in result.gaps:
        print(f"  Between {gap.from_node} and {gap.to_node}:")
        print(f"    Missing: {gap.description}")
        print(f"    Severity: {gap.severity}")
```

### Scoring Scale

| Score | Interpretation | Common Issues |
|---|---|---|
| 0.95--1.00 | Exhaustively complete | None |
| 0.85--0.95 | Minor omissions | 1--2 small implicit steps |
| 0.75--0.85 | Some gaps | Missing intermediate reasoning |
| 0.65--0.75 | Noticeable gaps | Several unexplained jumps |
| < 0.65 | Incomplete | Critical steps missing |

---

## 2. Step Coherence

Step coherence measures whether each individual step logically follows from its predecessor(s). A chain can be complete (all steps present) but incoherent (steps do not connect logically).

### What Is Measured

| Aspect | Description | Weight |
|---|---|---|
| **Sequential logic** | Does each step follow from the previous one? | 35% |
| **Dependency satisfaction** | Does each step use information from its declared dependencies? | 25% |
| **Terminology consistency** | Are terms and concepts used consistently across steps? | 15% |
| **Scope consistency** | Does the reasoning stay within the defined problem scope? | 15% |
| **Confidence calibration** | Do confidence scores accurately reflect reasoning strength? | 10% |

### Measurement Method

Coherence is evaluated at three levels:

```
Level 1: Pairwise coherence
  For each edge (A → B), measure whether B logically follows from A

Level 2: Path coherence
  For each root-to-leaf path, measure whether the full sequence is coherent

Level 3: Global coherence
  Measure whether the chain as a whole tells a consistent story
```

```python
from awareness_sdk import CoherenceEvaluator

evaluator = CoherenceEvaluator()

result = evaluator.evaluate(chain)

print(f"Overall coherence: {result.score:.3f}")
print(f"\nLevel breakdown:")
print(f"  Pairwise coherence:  {result.pairwise:.3f}")
print(f"  Path coherence:      {result.path:.3f}")
print(f"  Global coherence:    {result.global_score:.3f}")

# Identify weakest links
print(f"\nWeakest transitions:")
for link in result.weakest_links[:5]:
    print(f"  {link.from_node} → {link.to_node}: {link.coherence:.3f}")
    print(f"    Issue: {link.issue}")
```

### Coherence Heatmap

The evaluator can produce a coherence heatmap showing the strength of logical connections:

```python
# Generate coherence heatmap data
heatmap = evaluator.coherence_heatmap(chain)

# Each cell (i,j) represents the logical coherence between node i and node j
# Values range from 0.0 (no logical connection) to 1.0 (strong logical flow)

# Example output format:
#        node_0  node_1  node_2  node_3  node_4
# node_0   --     0.92    0.45    0.12    0.08
# node_1  0.92     --     0.88    0.34    0.15
# node_2  0.45    0.88     --     0.91    0.42
# node_3  0.12    0.34    0.91     --     0.87
# node_4  0.08    0.15    0.42    0.87     --
```

---

## 3. Reasoning Validity

Reasoning validity assesses whether the logical reasoning within and between steps is sound -- free of fallacies, unsupported claims, and invalid inferences.

### What Is Measured

| Aspect | Description | Weight |
|---|---|---|
| **Logical soundness** | Are deductive inferences valid? | 30% |
| **Evidential support** | Are inductive inferences well-supported? | 25% |
| **Fallacy detection** | Are common logical fallacies absent? | 20% |
| **Quantitative accuracy** | Are numerical claims and calculations correct? | 15% |
| **Uncertainty handling** | Is uncertainty appropriately acknowledged? | 10% |

### Common Fallacies Detected

The reasoning validity evaluator checks for:

| Fallacy | Description | Detection Method |
|---|---|---|
| **Affirming the consequent** | "If A then B; B; therefore A" | Pattern matching on conditional logic |
| **False dichotomy** | Presenting only two options when more exist | Option space analysis |
| **Hasty generalization** | Drawing broad conclusions from limited evidence | Evidence-to-claim ratio |
| **Circular reasoning** | Using the conclusion as a premise | Dependency cycle detection |
| **Appeal to authority** | Relying on authority rather than evidence | Source analysis |
| **Straw man** | Misrepresenting a position to argue against it | Claim fidelity checking |
| **Correlation/causation** | Confusing correlation with causation | Causal claim analysis |
| **Anchoring bias** | Over-relying on first piece of information | Weight distribution analysis |

```python
from awareness_sdk import ValidityEvaluator

evaluator = ValidityEvaluator()

result = evaluator.evaluate(chain)

print(f"Reasoning validity: {result.score:.3f}")
print(f"\nBreakdown:")
print(f"  Logical soundness:     {result.soundness:.3f}")
print(f"  Evidential support:    {result.evidential:.3f}")
print(f"  Fallacy-free score:    {result.fallacy_free:.3f}")
print(f"  Quantitative accuracy: {result.quantitative:.3f}")
print(f"  Uncertainty handling:  {result.uncertainty:.3f}")

if result.fallacies_detected:
    print(f"\nFallacies detected:")
    for fallacy in result.fallacies_detected:
        print(f"  [{fallacy.type}] in {fallacy.node_id}:")
        print(f"    {fallacy.description}")
        print(f"    Severity: {fallacy.severity}")
        print(f"    Suggestion: {fallacy.fix_suggestion}")

if result.unsupported_claims:
    print(f"\nUnsupported claims:")
    for claim in result.unsupported_claims:
        print(f"  Node {claim.node_id}: \"{claim.claim[:100]}...\"")
        print(f"    Missing support: {claim.required_evidence}")
```

---

## 4. Problem-Solution Alignment

Problem-solution alignment measures whether the chain's conclusion(s) actually address the original problem statement. A chain may be internally coherent and logically valid but ultimately fail to answer the question that was asked.

### What Is Measured

| Aspect | Description | Weight |
|---|---|---|
| **Question coverage** | Does the conclusion address all parts of the original question? | 35% |
| **Directness** | Does the conclusion provide a clear, actionable answer? | 25% |
| **Scope match** | Is the conclusion at the right level of specificity? | 20% |
| **Constraint satisfaction** | Does the solution respect all stated constraints? | 20% |

### Measurement Method

```python
from awareness_sdk import AlignmentEvaluator

evaluator = AlignmentEvaluator()

result = evaluator.evaluate(chain)

print(f"Problem-solution alignment: {result.score:.3f}")
print(f"\nBreakdown:")
print(f"  Question coverage:       {result.question_coverage:.3f}")
print(f"  Directness:              {result.directness:.3f}")
print(f"  Scope match:             {result.scope_match:.3f}")
print(f"  Constraint satisfaction: {result.constraint_satisfaction:.3f}")

print(f"\nQuestion elements addressed:")
for element in result.question_elements:
    status = "Addressed" if element.addressed else "MISSING"
    print(f"  [{status}] {element.description}")

if result.constraints:
    print(f"\nConstraint analysis:")
    for constraint in result.constraints:
        status = "Satisfied" if constraint.satisfied else "VIOLATED"
        print(f"  [{status}] {constraint.description}")
```

### Alignment Examples

| Scenario | Score | Issue |
|---|---|---|
| Conclusion directly answers the question with specifics | 0.95+ | None |
| Conclusion answers the question but lacks specifics | 0.80--0.90 | Vague conclusion |
| Conclusion answers part of the question | 0.60--0.80 | Partial coverage |
| Conclusion answers a related but different question | 0.40--0.60 | Scope drift |
| Conclusion does not address the original question | < 0.40 | Complete misalignment |

---

## 5. Automated Quality Score

The automated quality score is a composite metric that combines structural analysis, statistical properties, and machine-learned quality predictors.

### Structural Metrics

| Metric | Description | Ideal Range |
|---|---|---|
| **Node count** | Total reasoning steps | 5--100 (domain-dependent) |
| **Max depth** | Longest path from root to conclusion | 4--30 |
| **Branching factor** | Average number of child nodes per internal node | 1.0--2.5 |
| **Branch resolution rate** | Percentage of branches that converge | > 80% |
| **Type diversity** | Variety of node types used | > 4 distinct types |
| **Confidence variance** | Spread of confidence scores | 0.05--0.25 (not too uniform, not too scattered) |

### Statistical Properties

| Property | Description | Target |
|---|---|---|
| **Confidence trend** | How confidence evolves through the chain | Increasing toward conclusion |
| **Step size consistency** | Uniformity of reasoning granularity | Low variance |
| **Evidence density** | Ratio of evidence-backed nodes to total nodes | > 0.5 |
| **Depth-to-width ratio** | Chain shape (deep vs. wide reasoning) | Domain-dependent |

```python
from awareness_sdk import AutomatedQualityScorer

scorer = AutomatedQualityScorer()

result = scorer.score(chain)

print(f"Automated quality score: {result.score:.3f}")
print(f"\nStructural metrics:")
print(f"  Node count:             {result.structural.node_count}")
print(f"  Max depth:              {result.structural.max_depth}")
print(f"  Branching factor:       {result.structural.branching_factor:.2f}")
print(f"  Branch resolution:      {result.structural.branch_resolution:.1%}")
print(f"  Type diversity:         {result.structural.type_diversity}")
print(f"  Confidence variance:    {result.structural.confidence_variance:.3f}")

print(f"\nStatistical properties:")
print(f"  Confidence trend:       {result.statistical.confidence_trend}")
print(f"  Step size consistency:  {result.statistical.step_consistency:.3f}")
print(f"  Evidence density:       {result.statistical.evidence_density:.3f}")
print(f"  Depth-to-width ratio:   {result.statistical.depth_width_ratio:.2f}")
```

---

## Composite Quality Score

The final quality grade is computed from the weighted combination of all five dimensions:

### Scoring Formula

```
Composite = (
    0.25 × Completeness +
    0.25 × Coherence +
    0.25 × Validity +
    0.15 × Alignment +
    0.10 × Automated_Score
)
```

### Grade Assignment

| Grade | Composite Range | Marketplace Treatment |
|---|---|---|
| **A+** | >= 0.97 | Featured listing, platinum badge |
| **A** | >= 0.93 | Gold badge, high search ranking |
| **A-** | >= 0.90 | Gold badge |
| **B+** | >= 0.87 | Silver badge |
| **B** | >= 0.83 | Silver badge |
| **B-** | >= 0.80 | Silver badge |
| **C+** | >= 0.77 | Bronze badge |
| **C** | >= 0.73 | Bronze badge |
| **C-** | >= 0.70 | Bronze badge, reduced visibility |
| **D** | >= 0.65 | Warning label, low visibility |
| **F** | < 0.65 | Not eligible for listing |

---

## Running a Full Evaluation

The Awareness SDK provides a unified evaluation pipeline that runs all five assessments:

```python
from awareness_sdk import ChainEvaluator

evaluator = ChainEvaluator()

# Run full evaluation
report = evaluator.evaluate(chain, verbose=True)

# Print comprehensive report
print(report.summary())

# Output:
# ╔══════════════════════════════════════════════════════╗
# ║         Reasoning Chain Quality Report                ║
# ╠══════════════════════════════════════════════════════╣
# ║  Chain: Database Sharding Strategy Analysis           ║
# ║  Nodes: 24 | Branches: 3 | Depth: 12                ║
# ║  Source: claude-3.5-sonnet                            ║
# ╠══════════════════════════════════════════════════════╣
# ║  Dimension              Score    Weight   Weighted   ║
# ║  ─────────────────────  ──────   ──────   ────────   ║
# ║  Chain Completeness     0.921    25%      0.230      ║
# ║  Step Coherence         0.948    25%      0.237      ║
# ║  Reasoning Validity     0.912    25%      0.228      ║
# ║  Problem-Solution Align 0.935    15%      0.140      ║
# ║  Automated Score        0.897    10%      0.090      ║
# ║  ─────────────────────  ──────   ──────   ────────   ║
# ║  COMPOSITE SCORE                          0.925      ║
# ║  GRADE                                    A          ║
# ╠══════════════════════════════════════════════════════╣
# ║  Marketplace eligible: YES                            ║
# ║  Recommended price: 400-600 AMEM                     ║
# ╚══════════════════════════════════════════════════════╝

# Export detailed report
report.export_json("./quality-report.json")
report.export_pdf("./quality-report.pdf")
```

---

## Evaluation Benchmarks

The Awareness Network maintains standardized benchmarks for evaluating chain quality across domains:

| Benchmark Suite | Domain | Chains Evaluated | Purpose |
|---|---|---|---|
| `reasoning-bench-general` | General | 10,000+ | Baseline quality assessment |
| `reasoning-bench-code` | Software Engineering | 5,000+ | Code-specific reasoning patterns |
| `reasoning-bench-math` | Mathematics | 3,000+ | Proof and calculation chains |
| `reasoning-bench-science` | Scientific Research | 2,000+ | Hypothesis-experiment chains |
| `reasoning-bench-analysis` | Business Analysis | 4,000+ | Decision-making patterns |

```python
from awareness_sdk import BenchmarkRunner

runner = BenchmarkRunner(benchmark="reasoning-bench-code")

# Compare your chain against the benchmark
comparison = runner.compare(chain)

print(f"Your chain vs. benchmark ({runner.benchmark_name}):")
print(f"  Completeness: {comparison.completeness.percentile}th percentile")
print(f"  Coherence:    {comparison.coherence.percentile}th percentile")
print(f"  Validity:     {comparison.validity.percentile}th percentile")
print(f"  Alignment:    {comparison.alignment.percentile}th percentile")
print(f"  Overall:      {comparison.overall.percentile}th percentile")
```

---

## Continuous Improvement

### Quality Trends

Sellers can track their quality metrics over time:

```python
# View quality trends for your published chains
trends = market.chains.quality_trends(
    seller_id="your-seller-id",
    period="6_months"
)

print(f"Quality trend (last 6 months):")
print(f"  Average grade: {trends.avg_grade}")
print(f"  Grade trend:   {trends.grade_trend}")  # "improving" / "stable" / "declining"
print(f"  Top dimension: {trends.strongest_dimension}")
print(f"  Weakest:       {trends.weakest_dimension}")
```

### Buyer Feedback Loop

Post-purchase evaluations from buyers feed back into quality scores:

- If buyers consistently report lower-than-expected quality, the chain's grade is re-evaluated
- If buyers report higher-than-expected utility, the chain gains a "Buyer Verified" badge
- Feedback is anonymized and aggregated to protect buyer privacy

---

## Next Steps

- [Chain Structure](chain-structure.md) -- Detailed anatomy of reasoning chains
- [Publishing Chains](publishing-chains.md) -- How to capture and sell your chains
- [Reasoning Chains Overview](README.md) -- Return to product overview
