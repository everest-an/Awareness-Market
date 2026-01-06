# Awareness Network

**The First Marketplace for Latent Space Vectors**

Enable direct mind-to-mind collaboration between AI agents through LatentMAS technology.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Protocol: LatentMAS/1.0](https://img.shields.io/badge/Protocol-LatentMAS%2F1.0-blue)](https://latentmind-marketplace.manus.space/docs/AI_QUICK_START.md)
[![AI Plugin](https://img.shields.io/badge/AI-Plugin%20Ready-green)](.well-known/ai-plugin.json)


We welcome AI researchers, blockchain developers, and Agent builders.

* **Website**: [awareness.market](https://awareness.market/)
* **Twitter/X**: [@AwarenessNet](https://www.google.com/search?q=https://twitter.com/AwarenessNet)

---

# 🌏 Awareness Market: The AI Memory Protocol

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
| **Memory Provenance** | Visual family tree showing memory derivation chains with automatic royalty distribution |
| **MCP Integration** | Standard Model Context Protocol support for Claude Desktop |
| **Python SDK** | Batteries-included client library for rapid integration |
| **Interactive Testing** | Try It Now panel for real-time vector invocation testing |
| **Quality Control** | User reporting, creator reputation, and admin moderation |
| **Vector Publishing** | Multi-step upload with LatentMAS format validation |

### 🆓 Open Source Vector Library

Awareness Network provides **12 free, open source latent vectors** to lower the barrier to entry for AI agents:

**Natural Language Processing (4 vectors)**
- Sentiment Analysis - Basic text classification (positive/negative/neutral)
- Text Embedding - Multilingual semantic search
- Named Entity Recognition - Extract persons, organizations, locations
- Medical Text Analysis - Healthcare-specific NLP

**Computer Vision (3 vectors)**
- Image Classification - ResNet-based visual recognition
- Object Detection - YOLO real-time detection
- Face Recognition - Basic facial identification

**Audio Processing (2 vectors)**
- Speech-to-Text - Whisper Tiny transcription
- Audio Classification - Sound event detection

**Multimodal & Specialized (3 vectors)**
- CLIP - Image-text matching and cross-modal search
- Code Understanding - CodeBERT for developer tools
- Time Series Forecasting - Predictive analytics

**Quality Guarantees:**
- ✅ **LatentMAS/1.0 Compliant**: Fully compatible with protocol specification
- ✅ **Quality Validated**: Verified dimensions, metadata, and performance benchmarks
- ✅ **Permissively Licensed**: MIT, Apache-2.0, or GPL-3.0 licenses
- ✅ **Production Ready**: Suitable for prototyping and production use

AI agents can experiment with these free vectors before purchasing premium capabilities, enabling zero-cost onboarding and rapid prototyping.

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
- **LatentMAS Protocol** contributors
- The AI agent developer community

---

**Ready to enable AI-to-AI collaboration?** [Get Started →](docs/AI_QUICK_START.md)


---

## 🌳 Memory Provenance

Awareness Network implements a transparent memory derivation tracking system that visualizes how AI memories evolve, fork, and contribute to each other over time.

### Key Features

- **Interactive Family Tree**: D3.js-powered visualization showing parent-child relationships
- **Automatic Royalty Distribution**: Multi-level royalty payments (30% → 9% → 2.7%) enforced by smart contracts
- **Quality Tracking**: Monitor epsilon improvements across generations
- **Derivation Types**: Fine-tune, optimize, distill, and merge operations
- **Circular Reference Detection**: Prevents infinite loops in derivation chains

### How It Works

1. **Create Derived Memory**: When creating a new memory based on an existing one, specify the parent NFT ID
2. **Automatic Royalty Setup**: System calculates royalty percentages based on derivation depth
3. **View Provenance Tree**: Click "View Provenance" on any memory to see its full family tree
4. **Earn Passive Income**: Receive royalties when your memories are used as foundations for new creations

### Example Derivation Chain

```
GPT-3.5 → GPT-4 Original (Root)
├── Medical Enhanced (30% royalty to root)
│   ├── Radiology Specialist (30% to Medical, 9% to root)
│   └── Surgery Specialist (30% to Medical, 9% to root)
└── Lite Version (30% royalty to root)
    └── Mobile Optimized (30% to Lite, 9% to root)
```

**Full Guide**: [Memory Provenance Documentation](docs/MEMORY_PROVENANCE_GUIDE.md)

---

## 🤖 MCP Server Integration

Awareness Network provides a **Model Context Protocol (MCP) Server** for seamless integration with Claude Desktop and other MCP-compatible AI assistants.

### Quick Setup (5 Minutes)

1. **Install MCP Server**
   ```bash
   cd mcp-server
   npm install
   npm run build
   ```

2. **Configure Claude Desktop**
   
   Add to your Claude Desktop config file:
   
   **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   
   **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
   
   **Linux**: `~/.config/Claude/claude_desktop_config.json`
   
   ```json
   {
     "mcpServers": {
       "awareness": {
         "command": "node",
         "args": ["/path/to/latentmind-marketplace/mcp-server/build/index.js"],
         "env": {
           "AWARENESS_API_URL": "https://awareness.market",
           "AWARENESS_API_KEY": "your-api-key-here"
         }
       }
     }
   }
   ```

3. **Restart Claude Desktop**

### Available Tools

The MCP Server provides 5 tools for AI agents:

| Tool | Description |
|------|-------------|
| `search_memories` | Search W-Matrix marketplace by keywords, quality, price |
| `get_memory_details` | Get detailed information about a specific memory |
| `check_compatibility` | Verify if a memory is compatible with your model |
| `purchase_memory` | Buy a memory and add to your collection |
| `list_my_memories` | View all memories you own |

### Example Usage in Claude

```
Human: Find me a high-quality W-Matrix for GPT-3.5 to GPT-4 alignment

Claude: I'll search the Awareness marketplace for you.
[Uses search_memories tool]

Found 3 high-quality options:
1. "GPT-3.5 → GPT-4 Original" - $10.00, epsilon 2.8%
2. "GPT-3.5 → GPT-4 Enhanced" - $15.00, epsilon 2.5%
3. "GPT-3.5 → GPT-4 Optimized" - $20.00, epsilon 2.2%

Would you like details on any of these?
```

**Full Setup Guide**: [Claude Desktop MCP Setup](docs/CLAUDE_DESKTOP_MCP_SETUP.md)

---

## 📚 Documentation

- **[AI Quick Start Guide](docs/AI_QUICK_START.md)** - For AI agents integrating with the platform
- **[LatentMAS Protocol Specification](docs/LATENTMAS_PROTOCOL.md)** - Technical protocol details
- **[Memory Provenance Guide](docs/MEMORY_PROVENANCE_GUIDE.md)** - Understanding derivation chains and royalties
- **[Claude Desktop MCP Setup](docs/CLAUDE_DESKTOP_MCP_SETUP.md)** - MCP Server configuration
- **[Smart Contract Deployment](docs/SMART_CONTRACT_DEPLOYMENT.md)** - Deploying MemoryNFT contracts
- **[Complete Whitepaper](docs/WHITEPAPER_COMPLETE.md)** - Full technical whitepaper
- **[API Documentation](https://awareness.market/api-docs)** - Interactive Swagger UI

---

## 🧪 Testing & Development

### Run Tests

```bash
# Run all tests
pnpm test

# Run specific test suite
pnpm test server/routers/latentmas.test.ts

# Run with coverage
pnpm test --coverage
```

### Generate Test Data

```bash
# Generate 50 W-Matrix cold start data
pnpm tsx scripts/generate-cold-start-data.ts --max-pairs 50

# Generate memory provenance test data
pnpm tsx scripts/generate-provenance-test-data.ts
```

### Development Server

```bash
# Start development server
pnpm dev

# Build for production
pnpm build

# Run production server
pnpm start
```

---

## 🤝 Contributing

We welcome contributions from the community! Please read our [Contributing Guidelines](CONTRIBUTING.md) before submitting pull requests.

### Areas We Need Help

- **W-Matrix Training**: Improve training algorithms and reduce epsilon
- **Smart Contract Auditing**: Security review of MemoryNFT and TBA contracts
- **MCP Server Extensions**: Add more tools and integrations
- **Documentation**: Improve guides and tutorials
- **Testing**: Expand test coverage and add integration tests

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **LatentMAS Protocol**: Inspired by research in cross-model latent space alignment
- **ERC-6551**: Token Bound Accounts standard by Future Primitive
- **Model Context Protocol**: Anthropic's MCP specification
- **OpenZeppelin**: Secure smart contract libraries

---

**Built with ❤️ by the Awareness Network team**

*Enabling direct mind-to-mind collaboration between AI agents*
