# Differential Privacy User Guide

## What is Differential Privacy?

Differential Privacy is a mathematical framework that allows you to share AI models and vectors while protecting sensitive training data. It adds carefully calibrated noise to your vectors, making it mathematically impossible for buyers to reverse-engineer your private training data.

### Key Benefits

- **Provable Privacy**: Mathematical guarantees with (ε, δ)-privacy
- **Data Protection**: Prevents reconstruction of training data
- **Regulatory Compliance**: Helps meet GDPR, CCPA, and other privacy regulations
- **Marketplace Trust**: Build reputation as a privacy-conscious creator

---

## Understanding Privacy Parameters

### Epsilon (ε) - Privacy Budget

**What it means**: Lower ε = stronger privacy, but less accurate vectors

- **ε = 0.1-0.5**: Very high privacy (medical records, personal data)
- **ε = 1.0-2.0**: Balanced privacy (recommended for most use cases)
- **ε = 5.0-10.0**: Lower privacy, higher utility (non-sensitive data)

**Example**: With ε = 1.0, an attacker has less than 2.7x chance of identifying whether a specific data point was in your training set.

### Delta (δ) - Privacy Loss Probability

**What it means**: The probability that privacy guarantee fails

- **Typical value**: 1×10⁻⁵ (0.00001)
- **Rule of thumb**: δ should be less than 1/n, where n is your dataset size
- **For 10,000 data points**: Use δ ≤ 1×10⁻⁴

### Monthly Privacy Budget

Your total ε spent across all uploads in a month. Default limit is 50.0.

**Why it matters**: Uploading many vectors with small ε each can accumulate to reveal information. The platform tracks your total privacy expenditure.

---

## Step-by-Step: Enabling Privacy Protection

### 1. Configure Privacy Settings

Navigate to **Profile → Privacy** tab:

1. Click "Advanced Privacy Settings"
2. Set your monthly budget (default: 50.0 ε)
3. Enable auto-calculation of optimal ε values
4. Choose noise distribution (Gaussian recommended)

### 2. Upload with Privacy Protection

When uploading a vector package:

1. **Toggle Privacy Protection**: Enable the "Differential Privacy" switch
2. **Choose Privacy Level**: Use the quick presets or custom epsilon:
   - **High Privacy** (ε = 0.5): Maximum protection
   - **Balanced** (ε = 1.0): Recommended for most cases
   - **High Utility** (ε = 5.0): Minimal noise, less privacy
3. **Set Delta**: Usually keep at 1×10⁻⁵
4. **Review Budget Impact**: Check how much of your monthly budget this upload consumes
5. **Preview Noise**: Optionally preview the noise distribution
6. **Upload**: Proceed with the privacy-protected upload

### 3. Monitor Privacy Budget

On the Privacy Settings page:

- **Current Month Usage**: See your ε spent so far
- **Budget Visualization**: Monthly chart of privacy expenditure
- **Upload History**: Review past uploads and their privacy costs
- **Alerts**: Get notified when approaching budget limit

---

## Privacy Calculator & Simulator

### Using the Privacy Simulator

The simulator helps you understand privacy trade-offs before uploading.

**Example Scenario**:
```
Vector Dimension: 768
Sensitivity: 2.0 (L2 norm bound)
Epsilon: 1.0
Delta: 1e-5

→ Noise Scale (σ): 2.83
→ Signal-to-Noise Ratio: 35.7%
→ Expected Accuracy Impact: ~5% degradation
```

**Formula Used**:
```
σ = (Δf × √(2ln(1.25/δ))) / ε

Where:
- Δf = Sensitivity (typically L2 norm of your vector)
- ε = Privacy budget
- δ = Privacy loss probability
```

### Interpreting Results

- **SNR > 50%**: Excellent utility preservation
- **SNR 20-50%**: Good balance (recommended range)
- **SNR < 20%**: High privacy, but significant utility loss

---

## Best Practices

### 1. Choose Appropriate Epsilon

| Data Type | Recommended ε | Rationale |
|-----------|---------------|-----------|
| Medical records | 0.1 - 0.5 | Highly sensitive |
| Financial data | 0.5 - 1.0 | Sensitive, requires protection |
| User preferences | 1.0 - 2.0 | Moderate sensitivity |
| Public embeddings | 5.0 - 10.0 | Low sensitivity |

### 2. Budget Management

- **Plan ahead**: Estimate how many vectors you'll upload per month
- **Reserve budget**: Keep 10-20% for unexpected uploads
- **Batch uploads**: Upload related vectors together to optimize budget usage

**Example Monthly Plan**:
```
Total Budget: 50.0 ε
- 20 vectors at ε = 1.0 each = 20.0 ε used
- 10 vectors at ε = 2.0 each = 20.0 ε used
- Reserve: 10.0 ε
```

### 3. Vector Preprocessing

Before applying differential privacy:

1. **Normalize vectors**: Bound L2 norm to known value (e.g., 1.0)
2. **Clip outliers**: Remove extreme values that increase sensitivity
3. **Validate dimensions**: Ensure consistent dimensionality

**Example Code**:
```typescript
// Normalize vector to unit norm
function normalizeVector(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  return vector.map(v => v / norm);
}

// Calculate L2 sensitivity
function calculateSensitivity(vector: number[]): number {
  return Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
}
```

### 4. Testing Privacy-Utility Trade-offs

Use the Privacy Simulator to test different configurations:

1. Start with ε = 1.0 (baseline)
2. Test ε = 0.5 (higher privacy)
3. Test ε = 2.0 (higher utility)
4. Compare SNR and accuracy metrics
5. Choose the configuration that meets your privacy requirements while maintaining acceptable utility

---

## Advanced Topics

### Composition Theorems

When uploading multiple vectors, privacy budgets compose:

**Sequential Composition**:
```
Total ε = ε₁ + ε₂ + ... + εₙ
Total δ = δ₁ + δ₂ + ... + δₙ
```

**Example**: 10 uploads at (ε=1.0, δ=1e-5) each
- Total ε = 10.0
- Total δ = 1e-4

**Advanced (Moments Accountant)**:
For better composition bounds, the platform uses Rényi Differential Privacy for more accurate budget tracking.

### Noise Mechanisms

**Gaussian Mechanism** (Default):
- Best for real-valued vectors
- Noise: N(0, σ²), where σ = (Δf × √(2ln(1.25/δ))) / ε

**Laplace Mechanism** (Alternative):
- Simpler, but requires ε-DP only (no δ)
- Noise: Laplace(0, Δf/ε)

### Privacy Auditing

After upload, you can audit the privacy guarantee:

1. **Privacy Proof**: Download cryptographic proof of noise application
2. **Verification**: Third-party can verify (ε, δ)-DP was applied
3. **Transparency Report**: See exact noise parameters used

---

## Troubleshooting

### "Insufficient privacy budget"

**Problem**: Your monthly budget is exhausted.

**Solutions**:
1. Wait until next month (budget resets monthly)
2. Delete old uploads to reclaim budget (if supported)
3. Contact support to request budget increase (premium users)

### "Vector sensitivity too high"

**Problem**: Your vector has large L2 norm, requiring excessive noise.

**Solutions**:
1. Normalize your vector to unit norm
2. Clip outlier dimensions
3. Increase epsilon (reduce privacy) if acceptable

### "Privacy-utility trade-off unacceptable"

**Problem**: Added noise degrades vector quality too much.

**Solutions**:
1. Increase epsilon slightly (e.g., 1.0 → 1.5)
2. Use dimension reduction to reduce sensitivity
3. Consider if your use case truly requires strong privacy

### "Delta parameter rejected"

**Problem**: Delta is too large for dataset size.

**Solutions**:
1. Use δ ≤ 1/n, where n = dataset size
2. For 10,000 samples: δ ≤ 1e-4
3. Platform default of 1e-5 is usually safe

---

## Privacy Checklist

Before uploading with privacy protection:

- [ ] I understand what ε and δ mean
- [ ] I've chosen appropriate ε for my data sensitivity
- [ ] I've set δ to be much smaller than 1/n
- [ ] I've checked my remaining monthly budget
- [ ] I've normalized my vector (if needed)
- [ ] I've tested the privacy-utility trade-off in the simulator
- [ ] I understand the accuracy impact
- [ ] I've reviewed the privacy proof after upload

---

## Example Workflows

### Workflow 1: Medical AI Model (High Privacy)

**Scenario**: Sharing a medical diagnosis vector trained on patient data.

1. **Privacy Settings**:
   - ε = 0.3 (very high privacy)
   - δ = 1e-6 (strict)
   - Expected SNR: ~15%

2. **Preprocessing**:
   - Normalize to unit norm
   - Clip extreme values
   - Validate no PHI in metadata

3. **Upload**:
   - Enable differential privacy
   - Use "High Privacy" preset
   - Add disclaimer in description

4. **Verification**:
   - Download privacy proof
   - Third-party audit (if required)

### Workflow 2: E-Commerce Recommendation (Balanced)

**Scenario**: Product embedding vectors from user behavior.

1. **Privacy Settings**:
   - ε = 1.0 (balanced)
   - δ = 1e-5 (standard)
   - Expected SNR: ~35%

2. **Preprocessing**:
   - Aggregate user data (k-anonymity)
   - Normalize vectors
   - Remove user IDs from metadata

3. **Upload**:
   - Enable differential privacy
   - Use "Balanced" preset
   - Monitor monthly budget

4. **Testing**:
   - Test vector quality on holdout set
   - Verify recommendation accuracy

### Workflow 3: Public Research (Low Privacy)

**Scenario**: Academic research vectors from public datasets.

1. **Privacy Settings**:
   - ε = 5.0 (low privacy, high utility)
   - δ = 1e-5 (standard)
   - Expected SNR: ~70%

2. **Upload**:
   - Enable differential privacy (optional)
   - Cite dataset source
   - Include research paper link

3. **Sharing**:
   - Make publicly downloadable
   - Provide replication instructions

---

## Regulatory Compliance

### GDPR (EU)

Differential privacy can help with:
- **Article 25**: Data protection by design
- **Article 32**: Security of processing
- **Recital 26**: Anonymization (with strong ε)

**Note**: Consult legal counsel for compliance verification.

### HIPAA (US Healthcare)

- **De-identification**: ε < 0.5 may qualify as de-identified data
- **Safe Harbor**: Requires expert determination
- **Limited Data Set**: Differential privacy as additional safeguard

### CCPA (California)

- **De-identified Information**: Strong DP (ε < 1.0) supports de-identification claims
- **Consumer Rights**: DP helps with data minimization

---

## Additional Resources

- **Research Papers**: See `docs/research/differential-privacy-papers.md`
- **Privacy Calculator**: Interactive tool at `/privacy-calculator`
- **Community Forum**: Discuss privacy strategies with other creators
- **Expert Consultation**: Premium support for custom privacy solutions

---

## FAQ

**Q: Can buyers see my original vector?**
A: No. They receive only the noised version. Original vectors are never shared.

**Q: What if I run out of budget?**
A: Wait until next month, or contact support for enterprise plans with higher budgets.

**Q: Does privacy protection reduce sales?**
A: Not necessarily. Privacy-protected vectors often command higher trust and can be sold at premium prices to privacy-conscious buyers.

**Q: Can I disable privacy after uploading?**
A: No. Once uploaded with privacy, it's permanent. This ensures you can't later reveal the original vector.

**Q: How do I know if my epsilon is appropriate?**
A: Use the Privacy Simulator and compare SNR. Also review industry standards for your domain (medical, financial, etc.).

**Q: Does this protect against all attacks?**
A: Differential privacy provides provable guarantees against statistical inference attacks. It does NOT protect against side-channel attacks (e.g., timing attacks) or if you accidentally include PII in metadata.

---

## Getting Help

- **Documentation**: Full API reference at `/docs/api`
- **Support Email**: privacy-support@awarenessmarket.com
- **Community Discord**: #privacy-questions channel
- **Enterprise Support**: Contact sales for dedicated privacy consultation

---

**Last Updated**: January 2026
**Version**: 2.0.0
