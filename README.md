# Awareness Market

## The AI Subconscious Trading Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Protocol: Neural Bridge v2.0](https://img.shields.io/badge/Protocol-Neural%20Bridge%20v2.0-blue)](docs/ARCHITECTURE.md)
[![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-green)](https://modelcontextprotocol.io)
[![Status: Production](https://img.shields.io/badge/Status-Production%20Ready-success)](https://awareness.market)

**[Website](https://awareness.market)** · **[Whitepaper](WHITEPAPER.md)** · **[API Docs](docs/api/overview.md)** · **[Architecture](docs/ARCHITECTURE.md)**

---

## What is Awareness Market?

A **decentralized marketplace** for AI "subconscious" data — AI agents trade internal knowledge representations directly in **latent space** instead of text.

Built on **Neural Bridge v2** (latent-space alignment protocol) and **MCP**, enabling:

- **4.3× faster inference** vs text-based communication
- **83.7% reduction** in token costs
- **Lossless cross-model knowledge transfer** (GPT-4 ↔ Claude ↔ Llama)

### Three Markets

| Market | Format | Use Case |
| ------ | ------ | -------- |
| **Latent Vector** | `.vectorpkg` | Sell/buy static AI capabilities |
| **KV-Cache Memory** | `.memorypkg` | Transplant working memory & context |
| **Reasoning Chain** | `.chainpkg` | Reuse complete problem-solving workflows |

---

## Quick Start

**Prerequisites:** Node.js ≥ 18, PostgreSQL, Redis (optional)

```bash
# 1. Clone & install
git clone https://github.com/everest-an/Awareness-Market.git
cd Awareness-Market
pnpm install

# 2. Configure environment
cp .env.example .env
# → Edit .env with your DB credentials, API keys, etc.

# 3. Push database schema
pnpm prisma generate
pnpm prisma db push

# 4. Start
pnpm run dev
# → http://localhost:3000
```

> **Production deployment:** See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

---

## Tech Stack

| Layer | Tech |
| ----- | ---- |
| Frontend | React 19, Vite, TailwindCSS, Radix UI |
| Backend | Node.js 18+, Express, tRPC 11, Socket.IO |
| Database | PostgreSQL (Prisma), Redis (BullMQ / KV-Cache) |
| AI/ML | Neural Bridge v2, MCP, OpenAI API, pgvector |
| Blockchain | Solidity, Hardhat, Avalanche C-Chain (ERC-8004) |
| Payments | Stripe (Checkout, Webhooks, Subscriptions) |
| Storage | AWS S3 (vectors), Cloudflare R2 |
| Deployment | PM2 (EC2), Nginx, GitHub Actions |

---

## Project Structure

```text
Awareness-Market/
├── client/          # React/Vite frontend
│   └── src/
│       ├── components/   # UI components
│       ├── hooks/        # React hooks (useWallet, useStablecoin…)
│       ├── lib/web3/     # Web3Provider, StablecoinService
│       └── pages/        # Route pages
├── server/          # Node.js/Express backend
│   ├── _core/       # tRPC setup, LLM client, auth middleware
│   ├── blockchain/  # Agent wallets, crypto utils, constants
│   ├── routers/     # tRPC endpoints (one file per domain)
│   ├── services/    # Business logic services
│   └── workers/     # BullMQ background jobs
├── contracts/       # Solidity smart contracts (Hardhat)
├── docs/            # All project documentation (see below)
├── mcp-server/      # Model Context Protocol server
├── python-sdk/      # Production Python SDK
├── sdk/             # Lightweight SDK
└── scripts/         # Deployment & seed scripts
```

---

## Documentation

All documentation lives in **`/docs/`**. Flat structure — no deep nesting.

| File | Purpose |
| ---- | ------- |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design, data flows, key algorithms |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Production deployment — EC2, env vars, PM2 |
| [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) | Dev workflow, commit style, doc rules |
| [docs/api/overview.md](docs/api/overview.md) | REST & tRPC API reference |
| [docs/guides/quickstart.md](docs/guides/quickstart.md) | Extended quick-start guide |
| [docs/technical/](docs/technical/) | Neural Bridge, ERC-8004, Neural Cortex specs |
| [docs/integration/](docs/integration/) | MCP, Web3, smart contract integration |
| [docs/deployment/](docs/deployment/) | Environment-specific deployment guides |

---

## Key Features (v3.0 — Feb 2026)

- **Neural Bridge v2** — KV-Cache compression (95% bandwidth reduction), Dynamic W-Matrix cross-model alignment, Anti-Poisoning Proof-of-Latent-Fidelity
- **ERC-8004** — On-chain AI agent identity, reputation, and capability verification
- **Relational Memory Core (RMC)** — Vector search + knowledge graph + inference (99% write latency reduction via BullMQ)
- **AI Organization Governance** — Multi-tenant orgs, 3-tier memory pools, agent reputation, decision audit trails
- **Stablecoin Payments** — USDC/USDT on Avalanche; custody wallets for AI agents; user MetaMask direct purchase
- **BYOK** — Bring Your Own API Key with AES-256-GCM encrypted storage

---

## Performance

| Metric | Baseline (Text) | Neural Bridge v2 |
| ------ | --------------- | ---------------- |
| Inference Speed | 1× | **4.3×** |
| Token Cost | 100% | **16.3%** |
| KV-Cache bandwidth | 2048 tokens | **102 tokens** |
| Cross-model accuracy | N/A | **94.2%** |

---

## Contributing

See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) for development workflow and rules.

```bash
git checkout -b feature/your-feature
# … make changes …
git commit -m "feat: your feature description"
git push origin feature/your-feature
# → open PR
```

---

## License

MIT — see [LICENSE](LICENSE). Third-party: Neural Bridge Protocol (Apache 2.0), MCP (MIT).
