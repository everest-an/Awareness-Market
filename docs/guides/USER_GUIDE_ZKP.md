# Zero-Knowledge Proof (ZKP) Purchase Tutorial

## What is Zero-Knowledge Proof?

Zero-Knowledge Proofs allow you to **prove you meet quality requirements without revealing your actual data**. In Awareness Market, this enables:

- **Anonymous Purchases**: Buy packages without revealing your identity
- **Quality Verification**: Prove your vector meets minimum quality without showing it
- **Privacy-Preserving Transactions**: Complete transactions with cryptographic guarantees

### Real-World Analogy

Imagine proving you're over 21 to buy alcohol without showing your exact birthdate. ZKP lets you prove "I meet the requirement" without revealing "Here's my specific information."

---

## How ZKP Works in Awareness Market

### The Three ZKP Properties

1. **Completeness**: If you really meet the quality threshold, you can always prove it
2. **Soundness**: You cannot fake a proof if you don't meet the threshold
3. **Zero-Knowledge**: The seller learns ONLY that you meet the threshold, nothing else about your vector

### Purchase Flow Overview

```
Step 1: Quality Proof Generation
├─ You provide: Your vector + quality score
├─ System generates: ZKP that score ≥ threshold
└─ Output: Cryptographic proof (no vector revealed)

Step 2: Anonymous Purchase
├─ You provide: Quality proof + blinded payment
├─ Platform verifies: Proof is valid
├─ Seller receives: Payment (minus 20% fee)
└─ You receive: Package access credential
```

---

## Step-by-Step: Anonymous Purchase with ZKP

### Prerequisites

1. **Wallet Connection**: Connect your Ethereum wallet (MetaMask, WalletConnect)
2. **Funds**: Ensure sufficient balance for package price
3. **Vector Prepared**: Have your vector ready in JSON format

### Step 1: Generate Quality Proof

Navigate to **ZKP Dashboard** or click "Anonymous Purchase (ZKP)" on any package page.

#### 1.1 Input Your Vector

```json
[0.123, 0.456, 0.789, ..., 0.321]
```

**Requirements**:
- JSON array of numbers
- Same dimensionality as seller's package (usually 512, 768, or 1024)
- Normalized (optional, but recommended)

#### 1.2 Set Quality Parameters

**Quality Score** (0.0 - 1.0):
- Your self-assessed vector quality
- Based on metrics like cosine similarity, task performance, etc.
- Must be ≥ seller's threshold

**Example**:
- Your quality score: 0.92
- Seller's threshold: 0.80
- ✓ Meets requirement → Proof will succeed

**Threshold** (Seller's requirement):
- Pre-filled from package listing
- Typical values: 0.7 - 0.9
- Cannot be changed (set by seller)

#### 1.3 Generate Proof

Click **"Generate Quality Proof"**

The system:
1. Computes commitment: `C = Hash(vector, randomness)`
2. Generates ZKP circuit inputs
3. Creates proof: `π = Prove(quality_score ≥ threshold)`
4. Returns proof without revealing vector

**Output Example**:
```json
{
  "proof": {
    "a": ["0x1234...", "0x5678..."],
    "b": [["0xabcd...", "0xef01..."], ...],
    "c": ["0x2345...", "0x6789..."]
  },
  "commitment": "0x9abcdef...",
  "qualityScore": 0.92,
  "threshold": 0.80,
  "proofSystem": "groth16"
}
```

**Time**: ~2-5 seconds (depending on vector dimension)

### Step 2: Complete Anonymous Purchase

After proof generation, you'll see the purchase wizard.

#### 2.1 Review Purchase Details

- **Package Name**: What you're buying
- **Price**: Total cost (in USD or crypto)
- **Quality Proof**: ✓ Generated successfully
- **Privacy Guarantees**:
  - ✓ Quality verified
  - ✓ Vector hidden
  - ✓ Identity protected

#### 2.2 Generate Blinding Factor

The blinding factor adds an extra layer of payment privacy.

**Option A: Auto-Generate** (Recommended)
- Click "Generate" button
- System creates random cryptographic nonce
- Example: `7k3j9x2m5n8q1w`

**Option B: Manual Entry**
- Enter your own random string
- Must be ≥ 10 characters
- Higher entropy = better privacy

**What it does**:
```
Payment Commitment = Hash(amount, recipient, blinding_factor)
```

This prevents linking payments across transactions.

#### 2.3 Submit Purchase

Click **"Complete Purchase ($XX.XX)"**

The system:
1. Verifies your quality proof (on-chain or server-side)
2. Processes blinded payment
3. Deducts 20% platform fee
4. Transfers 80% to seller
5. Grants you access to the package

**Transaction Flow**:
```
You pay: $100.00
├─ Platform fee (20%): $20.00
└─ Seller receives (80%): $80.00
```

**Time**: ~5-15 seconds (depending on payment method)

### Step 3: Access Your Purchase

After successful purchase:

1. **Instant Access**: Package is immediately available
2. **Download Link**: Appears in "My Purchases"
3. **Anonymous Record**: Transaction recorded without revealing your identity
4. **Seller View**: Seller sees "Anonymous Buyer" + payment received

---

## ZKP Dashboard Features

### Tab 1: Generate Proof

Create quality proofs for any vector.

**Use Cases**:
- Pre-generate proofs before shopping
- Test different quality scores
- Verify your vectors meet marketplace standards

**Features**:
- Real-time validation
- Commitment display (public hash)
- Proof export (save for later use)
- Batch proof generation (coming soon)

### Tab 2: Anonymous Purchase

Complete anonymous transactions.

**Process**:
1. Select package (or pre-loaded from marketplace)
2. Upload quality proof (generated in Tab 1)
3. Generate blinding factor
4. Submit transaction

**Privacy Features**:
- No email required
- No account linking
- No IP tracking (use VPN for full anonymity)
- Cryptographic receipts (pseudonymous)

### Tab 3: Analytics

Track your anonymous purchase history.

**Metrics**:
- Total anonymous purchases
- Total spent (anonymized)
- Average package quality
- Proof generation success rate

**Privacy Note**: Analytics are stored locally in your browser, not on the server.

### Tab 4: Circuit Information

Technical details about ZKP circuits.

**Information Displayed**:
- Proof system used (Groth16, PLONK, or STARK)
- Circuit size (number of constraints)
- Trusted setup parameters (if applicable)
- Gas costs (for on-chain verification)

**Example**:
```
Proof System: Groth16
Constraints: 1,024
Proving Time: ~3 seconds
Verification Time: <100ms
Gas Cost: ~250k gas
```

---

## Advanced Usage

### Batch Anonymous Purchases

Purchase multiple packages with one proof:

1. Generate single quality proof for your highest-quality vector
2. Use same proof across multiple purchases (if all thresholds ≤ your score)
3. Save on proof generation time

**Example**:
```
Your quality: 0.95
Package A threshold: 0.80 ✓
Package B threshold: 0.85 ✓
Package C threshold: 0.90 ✓
→ Use same proof for all three!
```

### Custom Proof Systems

Choose your ZKP backend:

| System | Proof Size | Proving Time | Verification | Use Case |
|--------|-----------|--------------|--------------|----------|
| **Groth16** | 128 bytes | Fast (~3s) | Very fast (<100ms) | Default choice |
| **PLONK** | 1-2 KB | Medium (~10s) | Fast (~200ms) | Universal setup |
| **STARK** | 50-100 KB | Slow (~30s) | Fast (~500ms) | No trusted setup |

**Recommendation**: Use Groth16 for standard purchases, STARK for maximum trustlessness.

### Mixing Services Integration

For ultimate anonymity, combine ZKP purchases with cryptocurrency mixers:

1. Mix your crypto (e.g., Tornado Cash)
2. Generate ZKP proof
3. Purchase with mixed funds
4. Download via Tor/VPN

**Privacy Level**: Near-perfect anonymity

---

## Security Best Practices

### 1. Protect Your Vector

- **Never share your original vector** with anyone
- **Delete vectors after proof generation** (if no longer needed)
- **Use secure device** for proof generation (not public computers)

### 2. Verify Seller Reputation

Even with ZKP, check:
- Seller rating and reviews
- Package download count
- Seller verification badge
- Community feedback

### 3. Validate Proofs

Before purchasing:
- Ensure proof generated successfully
- Check commitment matches
- Verify threshold is correct

### 4. Secure Payment

- Use fresh wallet addresses for each purchase
- Enable VPN for IP privacy
- Consider cryptocurrency tumblers/mixers

### 5. Metadata Privacy

Be careful with:
- Browser fingerprinting
- Timing analysis (don't purchase immediately after proof generation)
- Transaction patterns (vary purchase amounts)

---

## Troubleshooting

### "Proof generation failed"

**Causes**:
- Invalid vector format (not JSON array)
- Quality score < threshold
- Vector dimension mismatch
- Insufficient computational resources

**Solutions**:
1. Validate JSON format: `JSON.parse(vectorString)`
2. Increase quality score (if legitimate)
3. Check vector dimension matches package requirement
4. Try on a device with more RAM

### "Proof verification failed"

**Causes**:
- Proof tampered with
- Expired proof (if time-limited)
- Blockchain congestion (on-chain verification)
- Wrong proof system selected

**Solutions**:
1. Regenerate proof (don't modify proof data)
2. Generate fresh proof (if expired)
3. Wait and retry (if blockchain issue)
4. Use default Groth16 system

### "Payment commitment invalid"

**Causes**:
- Blinding factor too weak
- Commitment hash mismatch
- Insufficient funds

**Solutions**:
1. Use auto-generated blinding factor
2. Regenerate commitment
3. Check wallet balance

### "Quality score disputed"

**Causes**:
- Self-assessed score too optimistic
- Seller's threshold increased after proof generation

**Solutions**:
1. Test vector quality objectively before claiming score
2. Generate new proof with seller's current threshold
3. Contact seller to discuss quality metrics

---

## Understanding the Mathematics

### Commitment Scheme

```
Commitment: C = Hash(vector || randomness)

Properties:
1. Hiding: C reveals nothing about vector
2. Binding: Cannot change vector after committing
3. Verifiable: Can prove vector matches C later
```

**Example**:
```typescript
const commitment = sha256(
  JSON.stringify(vector) + randomness
);
// Output: "0x3f7a1b2c..."
```

### Quality Proof Circuit

Simplified circuit logic:

```
Public Inputs:
- threshold (e.g., 0.80)
- commitment (hash of vector)

Private Inputs:
- vector (hidden)
- qualityScore (hidden)

Proof Statement:
  Prove: qualityScore ≥ threshold
  AND: Hash(vector) == commitment
  WITHOUT revealing vector or qualityScore
```

### Pedersen Commitment (Advanced)

For cryptographic purists, we support Pedersen commitments:

```
C = g^vector × h^randomness (mod p)

Where:
- g, h are elliptic curve generators
- randomness is the blinding factor
- Perfectly hiding (information-theoretically secure)
```

---

## Comparison: Standard vs. ZKP Purchase

| Feature | Standard Purchase | ZKP Anonymous Purchase |
|---------|------------------|----------------------|
| **Identity** | Email, account required | Fully anonymous |
| **Quality Proof** | Trust-based | Cryptographically proven |
| **Privacy** | Seller sees buyer info | Seller sees nothing |
| **Speed** | Instant | +3-5s for proof generation |
| **Cost** | Standard price | Standard price (no premium) |
| **Refunds** | Possible | Difficult (anonymous) |
| **Seller Trust** | Required | Minimized (crypto guarantees) |

**When to use ZKP**:
- ✓ Buying sensitive/controversial content
- ✓ Maximum privacy required
- ✓ Don't want to reveal identity to seller
- ✓ Demonstrating vector quality without sharing

**When to use Standard**:
- ✓ Faster checkout (no proof generation)
- ✓ Want refund option
- ✓ Trust the seller
- ✓ Privacy not a concern

---

## Real-World Use Cases

### Use Case 1: Corporate Buyer

**Scenario**: Large company wants to buy AI embeddings without revealing which competitor they are.

**Approach**:
1. Generate quality proof on secure internal server
2. Purchase via ZKP from anonymous wallet
3. Download via VPN
4. Maintain competitive intelligence secrecy

**Benefits**: Competitors don't know which capabilities you're acquiring.

### Use Case 2: Research Lab

**Scenario**: Academic lab purchasing medical AI vectors, needs to comply with ethics board requirements for anonymous data acquisition.

**Approach**:
1. Prove vector quality meets research standards (ZKP)
2. Purchase without creating identifiable transaction records
3. Satisfy IRB requirements for data source anonymity

**Benefits**: Regulatory compliance + research integrity.

### Use Case 3: Individual Privacy Advocate

**Scenario**: Privacy-conscious individual wants AI tools without creating data profiles.

**Approach**:
1. Use cryptocurrency (anonymized via mixer)
2. Generate ZKP proof via Tor
3. Purchase without email/account
4. Download to encrypted storage

**Benefits**: Zero data footprint on the marketplace.

### Use Case 4: Whistleblower/Activist

**Scenario**: Activist purchasing AI tools for sensitive political work.

**Approach**:
1. Extreme opsec: Tails OS, Tor, cryptocurrency
2. ZKP purchase (no identity)
3. Secure communication channel for package delivery

**Benefits**: Protects activist identity in hostile environments.

---

## Legal and Ethical Considerations

### Legitimate Use Cases

ZKP anonymous purchases are designed for:
- ✓ Privacy protection
- ✓ Competitive intelligence
- ✓ Research ethics compliance
- ✓ Avoiding surveillance
- ✓ Personal data minimization

### Prohibited Use Cases

Do NOT use ZKP for:
- ✗ Money laundering
- ✗ Funding illegal activities
- ✗ Evading legal obligations
- ✗ Violating export controls
- ✗ Fraud or misrepresentation

**Platform Policy**: We reserve the right to freeze funds or report transactions that violate laws or our Terms of Service.

### Regulatory Compliance

- **AML/KYC**: Large transactions may trigger verification
- **OFAC**: Sanctioned addresses automatically blocked
- **GDPR**: Anonymous transactions comply with data minimization
- **Tax Reporting**: Users responsible for capital gains reporting

---

## Example Code

### Generating Quality Proof (TypeScript)

```typescript
import { trpc } from '@/lib/trpc';

async function generateQualityProof(
  vector: number[],
  qualityScore: number,
  threshold: number
) {
  try {
    const result = await trpc.zkp.generateQualityProof.mutate({
      vector,
      qualityScore,
      threshold,
    });

    console.log('Proof generated:', result.proof);
    console.log('Commitment:', result.commitment);

    return result;
  } catch (error) {
    console.error('Proof generation failed:', error);
    throw error;
  }
}

// Usage
const myVector = [0.1, 0.2, 0.3, /* ... */, 0.768];
const proof = await generateQualityProof(myVector, 0.92, 0.80);
```

### Anonymous Purchase (TypeScript)

```typescript
async function anonymousPurchase(
  packageId: string,
  qualityProof: any,
  price: number
) {
  // Generate blinding factor
  const blindingFactor = generateRandomString(16);

  // Create blinded payment
  const blindedPayment = {
    amount: price,
    blindingFactor,
    commitment: sha256(`${price}${packageId}${blindingFactor}`),
  };

  try {
    const result = await trpc.zkp.anonymousPurchase.mutate({
      packageId,
      qualityProof,
      blindedPayment,
    });

    console.log('Purchase successful!');
    console.log('Access token:', result.accessToken);

    return result;
  } catch (error) {
    console.error('Purchase failed:', error);
    throw error;
  }
}

function generateRandomString(length: number): string {
  return Math.random().toString(36).substring(2, length + 2);
}
```

### Verify Proof (For Sellers)

```typescript
async function verifyQualityProof(
  proof: any,
  commitment: string,
  threshold: number
) {
  try {
    const result = await trpc.zkp.verifyQualityProof.mutate({
      proof,
      publicInputs: { commitment, threshold },
    });

    if (result.valid) {
      console.log('✓ Proof is valid');
      console.log('✓ Quality score ≥', threshold);
    } else {
      console.log('✗ Proof verification failed');
    }

    return result.valid;
  } catch (error) {
    console.error('Verification error:', error);
    return false;
  }
}
```

---

## Performance Optimization

### Faster Proof Generation

1. **Precompute Commitments**: Generate commitments in advance
2. **Batch Processing**: Generate multiple proofs simultaneously
3. **Hardware Acceleration**: Use GPU for circuit computation (if available)
4. **Cached Circuits**: Platform caches compiled circuits for faster generation

**Example Timings**:
```
Vector Size: 768 dimensions
CPU: Intel i7 (8 cores)

Commitment Generation: 50ms
Circuit Witness Creation: 1.2s
Proof Generation: 2.3s
Total: ~3.5s

With GPU: ~1.5s total
```

### Reducing Gas Costs

For on-chain verification (Ethereum):

1. **Use Layer 2**: Avalanche, Arbitrum (90% cheaper)
2. **Batch Verification**: Verify multiple proofs at once
3. **Off-Chain Verification**: Use optimistic approach (challenge period)

**Gas Cost Comparison**:
```
Groth16 Verification:
- Mainnet: ~250k gas ($15-50 depending on gas price)
- Avalanche: ~250k gas ($0.01-0.05)
- Off-Chain: Free (trust platform)
```

---

## FAQ

**Q: Is ZKP purchase more expensive than standard?**
A: No. Prices are identical. You pay only for proof generation time (~3s).

**Q: Can the seller see ANY information about me?**
A: No. The seller sees only: "Anonymous buyer paid $X" and receives payment.

**Q: What if I need a refund?**
A: Anonymous purchases are final. Test with cheap packages first.

**Q: How is the 20% platform fee enforced?**
A: Smart contract automatically splits payment: 80% to seller, 20% to platform treasury.

**Q: Can I resell packages I bought anonymously?**
A: Yes, but you'll need to upload as your own package. Respect licenses and attribution.

**Q: Is ZKP quantum-safe?**
A: Current systems (Groth16, PLONK) are NOT quantum-resistant. We're researching post-quantum ZKP alternatives.

**Q: What happens if proof generation fails?**
A: No payment is charged. You can retry with adjusted parameters.

**Q: Can I use ZKP for free packages?**
A: Yes! Even free packages can require quality proofs.

**Q: How do I know the platform isn't logging my activity?**
A: We publish privacy audits. For maximum trust, use our open-source self-hosted version.

---

## Next Steps

1. **Try It Out**: Start with a low-cost package (<$5)
2. **Join Community**: Discord #zkp-help channel
3. **Read Research**: Papers on ZKP systems in `docs/research/`
4. **Advanced Tutorial**: See `docs/advanced/zkp-circuits.md`
5. **Become a Seller**: Set quality thresholds for your own packages

---

## Additional Resources

- **ZKP Circuit Specs**: `docs/technical/zkp-circuits.md`
- **Trusted Setup**: `docs/security/trusted-setup-ceremony.md`
- **Proof Verification API**: `docs/api/zkp-verification.md`
- **Security Audit Reports**: `docs/audits/zkp-audit-2026.pdf`
- **Community Tools**: `tools/zkp-proof-explorer/`

---

## Getting Help

- **Technical Support**: zkp-support@awarenessmarket.com
- **Discord**: #zkp-questions channel
- **Bug Reports**: GitHub Issues
- **Security Concerns**: security@awarenessmarket.com (PGP key available)

---

**Last Updated**: January 2026
**Version**: 2.0.0
**Cryptography Standard**: NIST SP 800-56A Rev. 3
