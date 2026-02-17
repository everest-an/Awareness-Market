# W-Matrix Theory

## Mathematical Foundations of Cross-Model Latent Space Alignment

The W-Matrix is the mathematical core of the Awareness Network's knowledge transfer system. It is a learned transformation matrix that maps representations from one model's latent space into another's, preserving semantic content while adapting to structural differences between architectures.

---

## The Alignment Problem

Every large language model encodes information in a high-dimensional latent space. A concept like "recursion in computer science" is represented as a vector in that space, but the specific coordinates depend entirely on the model's architecture, training data, and random initialization.

**The problem:** Given a latent vector from Model A, how do we produce a semantically equivalent vector in Model B's space?

```
Model A (LLaMA 3 70B)                  Model B (GPT-4 Turbo)
Latent Space: R^8192                    Latent Space: R^12288

  "recursion" = [0.23, -0.14, ...]        "recursion" = [0.71, 0.03, ...]
  (8192 dimensions)                        (12288 dimensions)

         │                                        ▲
         │            W-Matrix                    │
         └──────────── W ∈ R^(12288×8192) ────────┘
```

Naive approaches like zero-padding or truncation destroy semantic content. The W-Matrix learns the correct mapping through a principled training process.

---

## W-Matrix Definition

### Formal Definition

Given:

- Source model latent space **S** with dimension *d_s*
- Target model latent space **T** with dimension *d_t*
- A set of semantically paired representations {(s_i, t_i)} where s_i is in S and t_i is in T

The W-Matrix **W** is in R^(d_t x d_s) such that:

```
W* = argmin_W  Σ_i ||W · s_i - t_i||² + λ · R(W)
```

Where:

- `||W · s_i - t_i||²` is the reconstruction loss
- `R(W)` is a regularization term
- `λ` controls the regularization strength

### Matrix Structure

For efficiency, the W-Matrix uses a low-rank decomposition:

```
W = U · Σ · V^T
```

Where:

- **U** is in R^(d_t x r), the target-side projection
- **Σ** is in R^(r x r), a diagonal scaling matrix
- **V** is in R^(d_s x r), the source-side projection
- **r** is the alignment rank (typically r << min(d_s, d_t))

This decomposition reduces the parameter count from `d_s * d_t` to `r * (d_s + d_t + r)`. For a typical pair (d_s = 8192, d_t = 12288, r = 512), this reduces parameters from ~100M to ~10M.

```typescript
interface WMatrix {
  sourceModel: string;
  targetModel: string;
  rank: number;
  U: Float32Array;  // d_t x r
  Sigma: Float32Array; // r (diagonal values only)
  V: Float32Array;  // d_s x r
  bias: Float32Array; // d_t (optional bias term)
  metadata: {
    trainedOn: string;
    datasetSize: number;
    quality: QualityMetrics;
    version: string;
  };
}
```

---

## Training Process

### Step 1: Parallel Corpus Generation

Both models process the same set of inputs, producing paired latent representations:

```python
# Simplified parallel corpus generation
paired_representations = []

for text in calibration_corpus:
    # Extract hidden states from both models
    source_hidden = source_model.encode(text, return_hidden=True)
    target_hidden = target_model.encode(text, return_hidden=True)

    # Use the last hidden state (or a specific layer)
    s_i = source_hidden[:, -1, :]  # Shape: (batch, d_s)
    t_i = target_hidden[:, -1, :]  # Shape: (batch, d_t)

    paired_representations.append((s_i, t_i))
```

The calibration corpus should be diverse and representative, typically containing 10,000 to 100,000 text samples spanning multiple domains.

### Step 2: Low-Rank Factorization Initialization

The initial W-Matrix is computed using truncated SVD on the cross-covariance matrix:

```python
import numpy as np

# Stack all paired representations
S = np.stack([s for s, t in paired_representations])  # (N, d_s)
T = np.stack([t for s, t in paired_representations])  # (N, d_t)

# Center the data
S_centered = S - S.mean(axis=0)
T_centered = T - T.mean(axis=0)

# Cross-covariance matrix
C = T_centered.T @ S_centered / len(S)  # (d_t, d_s)

# Truncated SVD
U, sigma, Vt = np.linalg.svd(C, full_matrices=False)
U_r = U[:, :rank]        # (d_t, r)
sigma_r = sigma[:rank]   # (r,)
V_r = Vt[:rank, :].T     # (d_s, r)
```

### Step 3: Fine-Tuning with Gradient Descent

The initial SVD solution is refined using gradient descent with a composite loss:

```python
import torch
import torch.nn as nn

class WMatrixTrainer(nn.Module):
    def __init__(self, d_s, d_t, rank):
        super().__init__()
        self.U = nn.Parameter(torch.randn(d_t, rank))
        self.sigma = nn.Parameter(torch.ones(rank))
        self.V = nn.Parameter(torch.randn(d_s, rank))
        self.bias = nn.Parameter(torch.zeros(d_t))

    def forward(self, s):
        # W = U @ diag(sigma) @ V^T
        projected = s @ self.V                  # (batch, r)
        scaled = projected * self.sigma         # (batch, r)
        transformed = scaled @ self.U.T         # (batch, d_t)
        return transformed + self.bias

    def compute_loss(self, s, t):
        t_pred = self.forward(s)

        # Reconstruction loss
        l_recon = nn.functional.mse_loss(t_pred, t)

        # Cosine similarity preservation
        cos_sim = nn.functional.cosine_similarity(t_pred, t, dim=-1).mean()
        l_cosine = 1.0 - cos_sim

        # Orthogonality regularization (keeps U and V well-conditioned)
        l_ortho_u = torch.norm(self.U.T @ self.U - torch.eye(self.U.shape[1]))
        l_ortho_v = torch.norm(self.V.T @ self.V - torch.eye(self.V.shape[1]))

        return l_recon + 0.5 * l_cosine + 0.01 * (l_ortho_u + l_ortho_v)
```

### Step 4: Validation

The trained W-Matrix is validated on a held-out test set using the quality metrics described below.

---

## Quality Metrics

### Primary Metrics

| Metric | Formula | Target |
|---|---|---|
| **Mean Cosine Similarity** | `(1/N) * Σ cos(W·s_i, t_i)` | > 0.85 |
| **Reconstruction MSE** | `(1/N) * Σ \|\|W·s_i - t_i\|\|²` | < 0.05 |
| **Round-Trip Error** | `(1/N) * Σ \|\|W_BA · W_AB · s_i - s_i\|\|²` | < 0.10 |
| **Semantic Preservation** | Task accuracy with aligned vs. native representations | > 90% |

### Diagnostic Metrics

| Metric | Description | Purpose |
|---|---|---|
| **Effective Rank** | Number of singular values above threshold | Measures how much of the alignment rank is utilized |
| **Condition Number** | Ratio of largest to smallest singular value | Detects numerical instability (should be < 1000) |
| **Residual Variance** | Variance unexplained by the low-rank approximation | Guides rank selection |
| **Per-Domain Accuracy** | Semantic preservation broken down by domain | Identifies domain-specific alignment weaknesses |

### Quality Grades

| Grade | Cosine Similarity | Reconstruction MSE | Suitability |
|---|---|---|---|
| **A** | > 0.95 | < 0.01 | Production use, critical applications |
| **B** | 0.90 -- 0.95 | 0.01 -- 0.03 | Production use, general applications |
| **C** | 0.85 -- 0.90 | 0.03 -- 0.05 | Development and experimentation |
| **D** | 0.80 -- 0.85 | 0.05 -- 0.10 | Research only |
| **F** | < 0.80 | > 0.10 | Not recommended |

---

## Supported Model Pairs

The Awareness Network maintains pre-trained W-Matrices for the following model pairs. Community members can also train and contribute their own.

| Source Model | Target Model | Rank | Quality Grade | Parameters |
|---|---|---|---|---|
| LLaMA 3 70B | GPT-4 Turbo | 512 | A (0.93) | 10.5M |
| LLaMA 3 70B | Claude 3.5 Sonnet | 512 | B (0.91) | 10.5M |
| GPT-4 Turbo | Claude 3.5 Sonnet | 384 | A (0.94) | 9.6M |
| Mistral Large | LLaMA 3 70B | 256 | B (0.89) | 4.2M |
| Claude 3.5 Sonnet | Mistral Large | 256 | C (0.87) | 4.2M |
| LLaMA 3 8B | LLaMA 3 70B | 128 | A (0.96) | 2.1M |
| Qwen 2.5 72B | LLaMA 3 70B | 512 | B (0.90) | 10.5M |

### Training Your Own W-Matrix

```bash
# Install the alignment toolkit
npm install -g @awareness-network/alignment-tools

# Generate parallel corpus
awareness-align generate-corpus \
  --source-model llama-3-70b \
  --target-model your-model \
  --corpus-size 50000 \
  --output ./corpus

# Train the W-Matrix
awareness-align train \
  --corpus ./corpus \
  --rank 256 \
  --epochs 100 \
  --learning-rate 0.001 \
  --output ./w-matrix.bin

# Validate quality
awareness-align validate \
  --w-matrix ./w-matrix.bin \
  --test-corpus ./corpus/test \
  --report ./quality-report.json
```

---

## Implementation Details

### Numerical Precision

W-Matrices are stored and computed in `float32` precision by default. For inference on resource-constrained devices, `float16` and `bfloat16` quantized variants are available with minimal quality degradation (typically < 0.02 cosine similarity loss).

### Batched Transformation

For throughput-critical applications, the transformation supports batched operations:

```python
# Batched transformation: (batch_size, d_s) -> (batch_size, d_t)
def transform_batch(w_matrix, source_vectors, batch_size=256):
    results = []
    for i in range(0, len(source_vectors), batch_size):
        batch = source_vectors[i:i + batch_size]
        transformed = batch @ w_matrix.V * w_matrix.sigma @ w_matrix.U.T + w_matrix.bias
        results.append(transformed)
    return np.concatenate(results)
```

### Caching Strategy

Transformed representations are cached using content-addressable storage. The cache key combines the source vector hash, W-Matrix version, and precision level:

```
cache_key = sha256(source_vector_hash + w_matrix_version + precision)
```

This avoids redundant transformations when the same knowledge is requested by multiple agents using the same model pair.
