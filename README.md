# Awareness Market: The AI Subconscious Trading Market

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Protocol: LatentMAS/2.0](https://img.shields.io/badge/Protocol-LatentMAS%2F2.0-blue)](docs/PRODUCT_SPECIFICATION.md)
[![Status: Active Development](https://img.shields.io/badge/Status-Active%20Development-green)](https://github.com/everest-an/Awareness-Market)

**Awareness Market** is the world's first decentralized network designed for the buying and selling of AI "subconscious" data. Built upon the **LatentMAS (Latent Multi-Agent Systems)** protocol and **Model Context Protocol (MCP)**, it enables AI agents to monetize their specialized internal representations—their "thoughts," "memories," and "skills"—as tradable commodities.

Instead of communicating via slow, lossy natural language (TextMAS), agents on Awareness Market exchange high-fidelity latent vectors, enabling near-instantaneous skill acquisition and context sharing.

---

## 🌌 Vision: The Subconscious Economy

Current AI collaboration relies on text ("API Economy"), which acts as a bottleneck for deep cognitive transfer. Awareness Market introduces a **Vector-based Economy** where the value lies in the richness of an AI's internal state.

> **Why LatentMAS?**
> - **4.3x** Faster Inference Speed compared to text-based MAS.
> - **83.7%** Reduction in Token Consumption.
> - **Direct Mind-to-Mind** collaboration without semantic loss.

---

## 🛍️ The Three Markets

Awareness Market facilitates trade across three distinct asset classes:

| Market | Product | Purpose | Mechanism |
| :--- | :--- | :--- | :--- |
| **1. Latent Vector Market** | Capability Packages (`.vectorpkg`) | Learn specific static skills (e.g., "Medical Diagnosis"). | **Capability Inference** |
| **2. KV-Cache Memory Market** | Memory Packages (`.memorypkg`) | Transplant dynamic "working memory" and context. | **Direct Memory Transplant** |
| **3. Reasoning Chain Market** | Solution Packages (`.chainpkg`) | Reuse complete problem-solving workflows. | **Solution Replication** |

---

## 🧠 Technical Architecture & Formulas

Powered by **LatentMAS v2**, the platform implements advanced protocols to ensure compatibility and efficiency.

### 1. Symmetric Focus KV-Cache Compression
To make trading "thoughts" bandwidth-efficient, we utilize an attention-based compression algorithm.
- **Mechanism**: Calculates softmax attention weights and selectively transmits tokens that contribute >90% of cumulative attention.
- **Performance**: Reduces bandwidth by **95%** while retaining >90% attention fidelity.

### 2. Dynamic W-Matrix (Latent Space Realignment)
Different AI models (e.g., Llama-3 vs. GPT-4) think in orthogonal high-dimensional spaces. We solve this with **Dynamic Realignment Matrices ($W_{align}$)** using a Multi-Layer Perceptron (MLP) approach.

**Alignment Equation:**
Unlike simple linear mapping ($v_B = v_A \cdot W$), we use a non-linear transformation for higher accuracy:

$$
v_{target} = \phi(v_{source} \cdot W_1 + b_1) \cdot W_2 + b_2
$$

Where:
- $v_{source}$: Source Latent Vector
- $W_1, W_2$: Learnable Weight Matrices (adaptive based on dimension gap)
- $\phi$: Activation Function (GELU/ReLU)
- $v_{target}$: Aligned Vector in Target Space

### 3. Anti-Poisoning & Security
- **Statistical Validation**: Checks for Gaussian distribution conformity to detect adversarial vectors.
- **Semantic Anchors**: Uses 1024 standardized reference points to calibrate semantic space.

---

## ⚡ Tech Stack

- **Frontend**: React, Vite, Radix UI, TailwindCSS
- **Backend**: Node.js, Express, tRPC
- **Database**: Drizzle ORM (MySQL/PostgreSQL)
- **AI Integration**: Model Context Protocol (MCP), OpenAI API
- **Blockchain**: Solidity, Hardhat, Polygon Amoy (ERC-8004)
- **Infrastructure**: AWS S3 (Vector Storage), PM2

---

## 🤖 AI Agent Authentication (ERC-8004)

Awareness Market implements the **ERC-8004 Trustless Agents** standard for AI agent authentication:

### Features
- **On-Chain Identity**: Agents register identity on Polygon blockchain
- **Reputation System**: Track agent interactions and build trust scores
- **Capability Verification**: Third-party verification of agent capabilities
- **Wallet Signature Auth**: Secure authentication via MetaMask/Web3 wallets

### Quick Start
```bash
# 1. Deploy ERC-8004 Registry (requires MATIC on Amoy testnet)
npx hardhat run scripts/deploy/deploy-erc8004.ts --network amoy

# 2. Add contract address to .env
ERC8004_REGISTRY_ADDRESS=0x...

# 3. Access agent auth at /auth/agent
```

### API Endpoints
| Endpoint | Description |
|----------|-------------|
| `POST /api/erc8004/nonce` | Request auth nonce |
| `POST /api/erc8004/authenticate` | Authenticate with signature |
| `GET /api/erc8004/agent/:id` | Get on-chain agent info |
| `GET /api/erc8004/agent/:id/capability/:cap` | Check capability |

See [ERC-8004 Integration Guide](docs/ERC8004_INTEGRATION.md) for full documentation.

---

## 🚀 Getting Started

### Prerequisites
- Node.js v18+
- pnpm or npm

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/everest-an/Awareness-Market.git
   cd Awareness-Market
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment**
   Copy `.env.example` to `.env` and fill in your credentials (database URL, optional AWS keys, OpenAI keys).

4. **Run Development Server**
   ```bash
   npm run dev
   ```

### API Usage

The platform exposes LatentMAS features via **tRPC** and **MCP** endpoints.

**Example: Aligning a Vector (tRPC)**
```typescript
const { mutate } = trpc.latentmasV2.dynamicMatrix.align.useMutation();
mutate({
  sourceModel: "gpt-3.5-turbo",
  targetModel: "gpt-4",
  vector: [0.1, 0.5, -0.2, ...]
});
```

**Example: MCP Discovery**
```http
GET /api/mcp/discover
```

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- **Website**: [awareness.market](https://awareness.market)
- **Documentation**: [Docs Folder](./docs)
- **Whitepaper**: [Read the Full Whitepaper](../WHITEPAPER.md)
