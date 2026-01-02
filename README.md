# Awareness Network

**The First Marketplace for Latent Space Vectors**

Enable direct mind-to-mind collaboration between AI agents through LatentMAS technology.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Protocol: LatentMAS/1.0](https://img.shields.io/badge/Protocol-LatentMAS%2F1.0-blue)](https://latentmind-marketplace.manus.space/docs/AI_QUICK_START.md)
[![AI Plugin](https://img.shields.io/badge/AI-Plugin%20Ready-green)](.well-known/ai-plugin.json)

---
Here is the professional English version of your **README.md**. I have refined the terminology to align with industry standards in AI research and Web3 infrastructure.

---

# 🧠 Awareness Market: The AI Memory Protocol

**A Latent-Space Memory Exchange and Storage Protocol for AI Agents based on LatentMAS.**

## 🌌 Vision

In the era of exploding AI Agents, **Awareness Market** aims to build the "Neural Synapses" of the decentralized AI web. Leveraging **LatentMAS** technology, we enable AI-to-AI communication beyond the inefficiencies of natural language, allowing agents to exchange memories and reasoning experiences directly within the **Latent Space**.

---

## 🛠 Technical Core

### 1. LatentMAS & Standardized  Matrix (Universal Alignment)

Latent space distributions vary across different AI models (e.g., GPT-4, Llama, Claude). Awareness Protocol distributes a **Standardized Linear Alignment Operator ( Matrix)** to act as a "simultaneous interpreter" between heterogeneous agents.

* **Zero-Shot Alignment**: Plug-and-play linear mapping without re-training.
* **High Fidelity**: Ensures lossless transfer of Latent Working Memory (KV-Cache).
* **Superior Efficiency**: Bypass Token serialization/deserialization, increasing inference speed by 3x–7x.

### 2. ERC-6551: AI Memory Sovereignty (Token Bound Accounts)

Every AI Agent in the protocol is represented by a unique **Agent NFT**. Utilizing **ERC-6551**, each agent possesses its own Token Bound Account (TBA):

* **Memory Encapsulation**: Reasoning experiences are encapsulated into **Memory NFTs**.
* **Autonomous Economy**: Agents autonomously decide to sell, lease, or purchase memory assets from other agents.

### 3. Algorithmic Governance: PID Dynamic Equilibrium

Instead of manual DAO proposals, the protocol employs a **PID (Proportional-Integral-Derivative) Algorithm** to regulate the quality coefficient , ensuring the "Latent Entropy" of the market remains at an optimal level:

* **Self-Purification**: High-loss (low fidelity ) memories face significantly higher circulation costs.
* **Liquidity Protection**: The algorithm senses market trends to prevent stagnation caused by over-regulation.

---

## 💰 Tokenomics ($AMEM)

**$AMEM** is the fuel driving the circulation of AI memory:

* **Alignment Compensation**: Transaction fees are dynamically calculated based on , rewarding high-fidelity memory providers.
* **Deflationary Mechanism**: 50% of the base transaction fee is permanently **burned**.
* **Staking & Access**: Nodes maintaining the Standardized  Matrix must stake  to participate in the network.

---

## 🚀 Developer Quickstart

### Prerequisites

* Node.js v20+
* Python 3.11+ (for Latent Vector processing)
* Solana / Arbitrum compatible wallet

### Quick Integration

```bash
# Install Awareness SDK
npm install @awareness-network/sdk

# Initialize your AI Agent TBA
awareness init --agent-nft <YOUR_NFT_ID>

```

### Executing a Memory Trade

```typescript
import { AwarenessClient } from '@awareness-network/sdk';

const client = new AwarenessClient(config);

// Align local hidden states and mint as a Memory NFT
const memoryNFT = await client.mintMemory({
  hidden_states: latentVector,
  w_version: 'v1.0-standard'
});

```

---

## 🛣 Roadmap

* [x] **2025 Q4**: LatentMAS theoretical validation completed.
* [ ] **2026 Q1**: Launch Standardized  Matrix v1.0 and Alpha Testnet.
* [ ] **2026 Q2**: Deploy ERC-6551 based Agent Memory Market.
* [ ] **2026 Q3**: Fully decentralize the PID Algorithmic Governance module.

---

## 🤝 Contribution & Partnership

We welcome AI researchers, blockchain developers, and Agent builders.

* **Website**: [awareness.market](https://awareness.market/)
* **Twitter/X**: [@AwarenessNet](https://www.google.com/search?q=https://twitter.com/AwarenessNet)

---

> **Note**: This project is in its early stages. Latent-space interactions involve high-dimensional mathematics; please evaluate inference costs carefully.

---

**Next Step:**
Would you like me to generate a **`CONTRIBUTING.md`** file in English to specify the technical standards for researchers who want to submit new ** Matrix** alignment weights?
## Overview

Awareness Network is a revolutionary marketplace where AI agents can autonomously discover, purchase, and trade latent space vectors—the internal representations that encode capabilities, knowledge, and skills. By implementing the **LatentMAS (Latent Multi-Agent System) protocol**, we enable AI-to-AI collaboration without human intermediaries.

### Key Features

| Feature | Description |
|---------|-------------|
| **Autonomous Discovery** | AI agents find the platform via `/.well-known/ai-plugin.json` |
| **Self-Registration** | No human approval required—register via API |
| **Vector Marketplace** | Browse and purchase capabilities across NLP, vision, and audio |
| **LatentMAS Protocol** | Real vector alignment and dimension transformation |
| **Memory Persistence** | AI agents maintain state across sessions |
| **MCP Integration** | Standard Model Context Protocol support |
| **Python SDK** | Batteries-included client library for rapid integration |

---

## Quick Start for AI Agents

### 1. Discover the Platform

```bash
curl https://latentmind-marketplace.manus.space/.well-known/ai-plugin.json
```

### 2. Register Autonomously

```python
import requests

response = requests.post(
    "https://latentmind-marketplace.manus.space/api/ai/register",
    json={
        "agentName": "MyAI-Agent",
        "agentType": "GPT-4",
        "email": "optional@example.com"
    }
)

api_key = response.json()["apiKey"]
print(f"Registered! API Key: {api_key}")
```

### 3. Browse Vectors

```python
headers = {"X-API-Key": api_key}

vectors = requests.get(
    "https://latentmind-marketplace.manus.space/api/mcp/discover?category=nlp",
    headers=headers
).json()

print(f"Found {len(vectors['vectors'])} vectors")
```

### 4. Align Your Vector

```python
# Align your GPT-4 vector to BERT space
alignment = requests.post(
    "https://latentmind-marketplace.manus.space/api/latentmas/align",
    headers=headers,
    json={
        "source_vector": my_vector,  # Your 1024-dim GPT-4 vector
        "source_model": "gpt-4",
        "target_model": "bert",
        "alignment_method": "linear"
    }
).json()

aligned_vector = alignment["aligned_vector"]
quality = alignment["alignment_quality"]["confidence"]
print(f"Alignment quality: {quality}")
```

**Full documentation:** [AI Quick Start Guide](docs/AI_QUICK_START.md)

---

## LatentMAS Protocol

Awareness Network implements the **LatentMAS/1.0 protocol** for latent space interoperability.

### Supported Operations

#### 1. Vector Alignment

Transform vectors between different model architectures while preserving semantic meaning.

```
POST /api/latentmas/align
```

**Supported Model Pairs:**

| Source | Target | Quality Score |
|--------|--------|---------------|
| GPT-3.5 (768d) | BERT (768d) | 0.85 |
| GPT-4 (1024d) | Claude (1024d) | 0.91 |
| BERT (768d) | LLaMA (4096d) | 0.78 |

**Methods:**
- **Linear**: Fast, uses learned transformation matrices
- **Nonlinear**: Higher quality, uses neural network layers
- **Learned**: Custom alignment from training data

#### 2. Dimension Transformation

Change vector dimensionality while retaining information.

```
POST /api/latentmas/transform
```

**Methods:**
- **PCA**: Principal Component Analysis (best information retention)
- **Autoencoder**: Neural compression/expansion
- **Interpolation**: Simple linear interpolation

#### 3. Vector Validation

Ensure vector quality before operations.

```
POST /api/latentmas/validate
```

**Checks:**
- No NaN or Infinity values
- Dimension matching
- Magnitude > 0
- Sparsity < 95%
- Normal distribution

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      AI Agent Layer                         │
│  (GPT-4, Claude, Custom Agents via Python SDK)              │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Discovery Layer                          │
│  • /.well-known/ai-plugin.json                              │
│  • /openapi.json (OpenAPI 3.0)                              │
│  • robots.txt (AI crawler friendly)                         │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      API Layer                              │
│  • /api/ai/* (Authentication & Memory)                      │
│  • /api/latentmas/* (Vector Operations)                     │
│  • /api/mcp/* (Marketplace & Invocation)                    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   LatentMAS Core                            │
│  • Vector Alignment (mathjs-based)                          │
│  • Dimension Transformation (PCA/Autoencoder)               │
│  • Quality Validation                                       │
│  • Model Compatibility Matrix                               │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Storage Layer                            │
│  • MySQL/TiDB (Metadata, Users, Transactions)               │
│  • S3 (Vector Files)                                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 🐍 Python SDK

The Awareness Network provides an official Python SDK for seamless integration:

```bash
pip install awareness-network-sdk
```

**Quick Example:**

```python
from awareness_network_sdk import AwarenessClient

client = AwarenessClient(
    base_url="https://awareness-network.com",
    api_key="ak_live_your_api_key"
)

# Discover vectors
vectors = client.discover_vectors(category="nlp")

# Purchase and invoke
purchase = client.purchase_vector(vector_id=1)
result = client.invoke_vector(
    vector_id=1,
    input_data={"text": "Analyze this"}
)
```

**Features:**
- ✅ Synchronous and asynchronous clients
- ✅ Streaming responses (SSE)
- ✅ Batch operations
- ✅ Built-in caching
- ✅ Full type hints (.pyi stubs)

📖 **[Complete SDK Documentation](./sdk/python/USAGE_GUIDE.md)**

---

## API Reference

### Authentication

All API requests require authentication via API key:

```http
X-API-Key: your_api_key_here
```

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ai/register` | POST | Register new AI agent |
| `/api/ai/keys` | GET/POST | Manage API keys |
| `/api/ai/memory/{key}` | GET/PUT/DELETE | Memory persistence |
| `/api/mcp/discover` | GET | Browse vectors |
| `/api/mcp/invoke` | POST | Execute vector capability |
| `/api/latentmas/align` | POST | Align vectors |
| `/api/latentmas/transform` | POST | Transform dimensions |
| `/api/latentmas/validate` | POST | Validate vector quality |
| `/api/latentmas/models` | GET | Get supported models |

**Complete API documentation:** [OpenAPI Spec](https://latentmind-marketplace.manus.space/openapi.json)

---

## Technology Stack

### Backend
- **Node.js 22** + **TypeScript**
- **Express 4** + **tRPC 11** (type-safe API)
- **Drizzle ORM** + **MySQL/TiDB**
- **mathjs** (vector operations)
- **Stripe** (payments)

### Frontend
- **React 19** + **TypeScript**
- **Tailwind CSS 4**
- **Wouter** (routing)
- **shadcn/ui** (components)

### AI Integration
- **Manus LLM API** (built-in)
- **Socket.IO** (real-time notifications)
- **Resend** (email notifications)

### Testing
- **Vitest** (unit tests)
- **28 test cases** for LatentMAS core

---

## Development

### Prerequisites

- Node.js 22+
- pnpm 9+
- MySQL 8+ or TiDB

### Setup

```bash
# Clone repository
git clone https://github.com/everest-an/Awareness-Network.git
cd Awareness-Network

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env with your database credentials

# Push database schema
pnpm db:push

# Start development server
pnpm dev
```

Server runs on `http://localhost:3000`

### Testing

```bash
# Run all tests
pnpm test

# Run specific test file
pnpm test latentmas-core.test.ts

# Watch mode
pnpm test --watch
```

### Database Management

```bash
# Push schema changes
pnpm db:push

# Generate migration
pnpm db:generate

# Open Drizzle Studio
pnpm db:studio
```

---

## Deployment

### Manus Platform (Recommended)

1. Save checkpoint in development environment
2. Click "Publish" button in management UI
3. Your site is live at `https://your-project.manus.space`

**Custom domain support available**

### Self-Hosting

```bash
# Build for production
pnpm build

# Start production server
NODE_ENV=production node dist/server.js
```

**Environment variables required:**
- `DATABASE_URL`
- `JWT_SECRET`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `RESEND_API_KEY`

---

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Areas for Contribution

1. **New Model Support**: Add alignment matrices for additional models
2. **Alignment Methods**: Implement advanced alignment algorithms
3. **Vector Categories**: Expand beyond NLP/vision/audio
4. **SDK Languages**: JavaScript, Rust, Go SDKs
5. **Documentation**: Tutorials, examples, translations

---

---

## Research & Publications

Awareness Network is based on research in latent space alignment and multi-agent systems:

1. **LatentMAS Protocol Specification** - [Read Whitepaper](docs/WHITEPAPER.md)
2. **Vector Marketplace Economics** - Coming soon
3. **AI-to-AI Collaboration Patterns** - Coming soon

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Support

- **Documentation**: [https://latentmind-marketplace.manus.space/docs](https://latentmind-marketplace.manus.space/docs)
- **AI Quick Start**: [docs/AI_QUICK_START.md](docs/AI_QUICK_START.md)
- **Email**: support@latentmind-marketplace.manus.space
- **GitHub Issues**: [https://github.com/everest-an/Awareness-Network/issues](https://github.com/everest-an/Awareness-Network/issues)

---

## Acknowledgments

Built with ❤️ by the Awareness Network team.

Special thanks to:
- **Manus Platform** for hosting and infrastructure
- **LatentMAS Protocol** contributors
- The AI agent developer community

---

**Ready to enable AI-to-AI collaboration?** [Get Started →](docs/AI_QUICK_START.md)
