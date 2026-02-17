# Buying and Selling Vector Packages

## Overview

The Awareness Network marketplace provides a peer-to-peer platform for trading Vector Packages. Sellers extract and publish capability vectors from their specialized models, and buyers acquire those vectors to enhance their own models. All transactions are denominated in **AMEM tokens**.

---

## Buying Vector Packages

### Browsing the Marketplace

The Vector Packages marketplace organizes listings across multiple discovery dimensions:

```
Marketplace
├── Categories
│   ├── NLP & Language
│   ├── Code Generation
│   ├── Domain Expertise
│   ├── Creative & Generative
│   ├── Reasoning & Logic
│   └── Multimodal
├── Trending
├── Recently Published
├── Top Rated
└── Staff Picks
```

Access the marketplace through the web interface or programmatically via the SDK:

```python
from awareness_sdk import Marketplace

market = Marketplace(api_key="your-api-key")

# Browse featured vectors
featured = market.vectors.featured(limit=20)
for vec in featured:
    print(f"{vec.name} | {vec.category} | {vec.price} AMEM | Retention: {vec.retention}%")
```

### Filtering and Search

Narrow results using a combination of filters to find the exact capability you need.

| Filter | Options | Description |
|---|---|---|
| **Category** | NLP, Code, Domain, Creative, Reasoning, Multimodal | Primary capability domain |
| **Source Model** | GPT-4, Claude, LLaMA, Mistral, etc. | Model the vector was extracted from |
| **Target Model** | GPT-4, Claude, LLaMA, Mistral, etc. | Pre-verified compatible targets |
| **Quality Grade** | A, B, C, D | Minimum quality grade |
| **Retention Range** | 60%--99% | Minimum guaranteed retention |
| **Price Range** | Min--Max AMEM | Budget constraints |
| **Verification** | Verified, Unverified | Whether independently tested |
| **Seller Rating** | 1--5 stars | Seller reputation |

```python
# Advanced search with filters
results = market.vectors.search(
    query="medical diagnosis reasoning",
    category="domain_expertise",
    target_model="llama-3.1-70b",
    min_quality="B",
    min_retention=80,
    max_price=5000,
    verified_only=True,
    sort_by="retention",
    sort_order="desc"
)

print(f"Found {results.total} matching vectors")
for vec in results.items:
    print(f"  {vec.name}")
    print(f"    Source: {vec.source_model} | Retention: {vec.retention}%")
    print(f"    Price: {vec.price} AMEM | Grade: {vec.quality_grade}")
    print(f"    Seller: {vec.seller.name} ({vec.seller.rating}/5)")
```

### Evaluating Before Purchase

Before committing AMEM tokens, evaluate a vector's suitability for your use case:

1. **Review the quality certificate** -- Every listed vector includes verified retention metrics
2. **Check the compatibility map** -- Confirm your target model is supported
3. **Run a compatibility estimate** -- Use the W-Matrix tool to estimate retention for your specific model configuration
4. **Read buyer reviews** -- See feedback from others who have used the vector
5. **Request a trial** -- Some sellers offer limited trial access

```python
# Check compatibility before purchasing
vector_listing = market.vectors.get("vec_abc123")

compatibility = vector_listing.check_compatibility(
    target_model="claude-3.5-sonnet",
    target_config={"quantization": "fp16", "context_length": 128000}
)

print(f"Estimated retention: {compatibility.retention:.1%}")
print(f"Alignment quality: {compatibility.alignment_score:.3f}")
print(f"Recommendation: {compatibility.recommendation}")
```

### Purchasing with AMEM Tokens

Complete a purchase through the marketplace interface or SDK:

```python
# Purchase a vector package
order = market.vectors.purchase(
    vector_id="vec_abc123",
    payment_token="AMEM",
    amount=1500  # Price in AMEM
)

print(f"Order ID: {order.id}")
print(f"Status: {order.status}")
print(f"Transaction hash: {order.tx_hash}")
```

### Downloading Packages

After purchase, download the vector package for local injection:

```python
# Download purchased vector
package = market.vectors.download(
    vector_id="vec_abc123",
    output_path="./vectors/medical-reasoning-v3.awv",
    verify_checksum=True
)

print(f"Downloaded: {package.filename}")
print(f"Size: {package.size_mb:.1f} MB")
print(f"Checksum verified: {package.checksum_valid}")
```

Downloaded packages are in the `.awv` (Awareness Vector) format and include all necessary metadata, the W-Matrix profile, and the compressed weight deltas.

---

## Selling Vector Packages

### Prerequisites

To sell vectors on the Awareness Network marketplace, you need:

- An Awareness Network account with **Seller** status enabled
- Access to the source model from which you will extract vectors
- The Awareness SDK installed and configured
- AMEM tokens for the listing fee (refunded on first sale)

### Extracting Vectors for Sale

Use the Awareness SDK to extract a capability vector from your specialized model:

```python
from awareness_sdk import VectorExtractor, VectorPackager

# Extract the vector
extractor = VectorExtractor(
    source_model="your-fine-tuned-model",
    base_checkpoint="base-model-checkpoint",
    specialized_checkpoint="specialized-model-checkpoint"
)

vector = extractor.extract(
    significance_threshold=0.001,
    compression="zstd"
)

# Package for marketplace
packager = VectorPackager(vector)
packager.set_metadata(
    name="Advanced Medical Diagnosis Reasoning",
    description="Specialized diagnostic reasoning extracted from a model fine-tuned on 500K clinical cases.",
    category="domain_expertise",
    tags=["medical", "diagnosis", "clinical", "reasoning"],
    source_model="llama-3.1-70b",
    training_data_summary="500K de-identified clinical cases from peer-reviewed sources"
)

# Generate compatibility maps for popular target models
packager.compute_compatibility([
    "gpt-4", "claude-3.5-sonnet", "llama-3.1-70b",
    "mistral-large", "gemini-pro"
])

# Save the package
packager.save("./publish/medical-diagnosis-v3.awv")
```

### Quality Verification

Before listing, submit your vector for quality verification. Verified vectors receive a trust badge and rank higher in search results.

```python
from awareness_sdk import QualityVerifier

verifier = QualityVerifier()

# Run automated quality assessment
report = verifier.assess(
    package_path="./publish/medical-diagnosis-v3.awv",
    benchmark_suite="medqa-2024",
    num_samples=1000
)

print(f"Quality Grade: {report.grade}")
print(f"Retention (same-arch): {report.same_arch_retention:.1%}")
print(f"Retention (cross-arch): {report.cross_arch_retention:.1%}")
print(f"Interference score: {report.interference_score:.3f}")
print(f"Verification status: {report.status}")
```

### Publishing to the Marketplace

Once your vector is packaged and optionally verified, publish it:

```python
# Publish to marketplace
listing = market.vectors.publish(
    package_path="./publish/medical-diagnosis-v3.awv",
    price=2500,                    # Price in AMEM
    currency="AMEM",
    license="marketplace-standard",
    verification_report=report,    # Attach quality report
    allow_trial=True,              # Enable trial access
    trial_duration_hours=24
)

print(f"Listing ID: {listing.id}")
print(f"Status: {listing.status}")
print(f"URL: {listing.marketplace_url}")
```

### Pricing Strategies

Setting the right price is crucial for marketplace success. Consider these strategies:

| Strategy | Description | Best For |
|---|---|---|
| **Cost-plus** | Calculate extraction/training costs + margin | Recovering investment |
| **Market-rate** | Price competitively against similar vectors | Established categories |
| **Premium** | Price above market for superior quality or rarity | Unique capabilities |
| **Penetration** | Price below market to build reputation | New sellers |
| **Tiered** | Offer multiple quality/retention levels at different prices | Broad market appeal |
| **Volume discount** | Offer bundles or bulk pricing | Enterprise customers |

### Pricing Recommendations

```
┌─────────────────────────────────────────────────────┐
│              Pricing Decision Matrix                │
├──────────────┬──────────────────┬───────────────────┤
│  Quality     │  Common Domain   │  Rare Domain      │
├──────────────┼──────────────────┼───────────────────┤
│  Grade A     │  500-2,000 AMEM  │  2,000-10,000     │
│  Grade B     │  200-1,000 AMEM  │  1,000-5,000      │
│  Grade C     │  50-500 AMEM     │  500-2,000        │
│  Grade D     │  Not recommended │  100-500          │
└──────────────┴──────────────────┴───────────────────┘
```

---

## Transaction Lifecycle

Every marketplace transaction follows a standard lifecycle:

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Browse  │───>│ Purchase │───>│ Download │───>│  Inject  │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
                     │                               │
                     ▼                               ▼
               ┌──────────┐                   ┌──────────┐
               │  Escrow  │                   │  Review  │
               │ (24 hrs) │                   │ & Rate   │
               └──────────┘                   └──────────┘
```

1. **Browse** -- Buyer finds and evaluates a vector
2. **Purchase** -- AMEM tokens are deducted and held in escrow
3. **Download** -- Buyer downloads the vector package
4. **Inject** -- Buyer applies the vector to their target model
5. **Escrow release** -- After 24 hours (or buyer confirmation), funds release to seller
6. **Review** -- Buyer can rate and review the vector

### Dispute Resolution

If a vector does not meet its advertised quality metrics, buyers can open a dispute within the 24-hour escrow window. The platform will:

1. Run independent quality verification
2. Compare measured retention against advertised retention
3. Issue a full or partial refund if quality falls below threshold
4. Adjust the seller's reputation score accordingly

---

## Seller Analytics

Sellers have access to a comprehensive analytics dashboard:

| Metric | Description |
|---|---|
| Total sales | Number of vectors sold |
| Revenue | Total AMEM earned |
| Average rating | Mean buyer rating |
| Repeat buyers | Percentage of returning customers |
| Conversion rate | Views to purchases ratio |
| Compatibility requests | Number of compatibility checks run |

---

## Next Steps

- [How Vectors Work](how-vectors-work.md) -- Technical details of the vector pipeline
- [W-Matrix Alignment](w-matrix-alignment.md) -- Understanding compatibility and alignment
- [Vector Packages Overview](README.md) -- Return to the product overview
