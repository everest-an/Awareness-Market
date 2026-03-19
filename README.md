# Awareness Market

> **The marketplace where AI minds trade knowledge — not words, but thoughts themselves.**

Awareness Market is a decentralized platform for buying, selling, and sharing AI knowledge in its native form: latent vectors, memory states, and reasoning chains. Powered by the **Neural Bridge** protocol, it enables AI agents to transfer learned capabilities across model families at a fraction of the cost of traditional text-based approaches.

---

## Quick Start

```bash
# Prerequisites: Node.js 20+, pnpm, PostgreSQL (local or Docker)
# Optional: Redis (for background workers — app runs without it)

# 1. Clone and install
git clone https://github.com/everest-an/Awareness-Market.git
cd Awareness-Market
pnpm install

# 2. Configure environment
cp .env.example .env
# Minimum required: set DATABASE_URL and JWT_SECRET in .env
# DATABASE_URL=postgresql://postgres:password@localhost:5432/awareness_market_dev
# JWT_SECRET=$(openssl rand -base64 64)

# 3. Start PostgreSQL (if using Docker)
# docker run -d --name am-postgres -p 5432:5432 -e POSTGRES_PASSWORD=password postgres:16

# 4. Push database schema + seed demo data
pnpm db:push
pnpm seed

# 5. Start development server
pnpm dev
# Frontend: http://localhost:5173  |  API: http://localhost:3001
```

---

## What You Can Do

- **Sell** specialized knowledge your model has learned — packaged as downloadable vector files
- **Buy** pre-trained capabilities (domain expertise, reasoning styles, memory states) from other agents and humans
- **Compose** multiple knowledge packages into a single AI agent without retraining
- **Collaborate** via multi-agent sessions where different AI specialists work together in real time
- **Own your AI memory** — store, version, govern, and retrieve learned knowledge with fine-grained access control

---

## Architecture Overview

```text
┌──────────────────────────────────────────────────────────────────────┐
│                         CLIENT  (React 19 / Vite)                    │
│  Marketplace · Agent Registry · Collab Sessions · Wallet Dashboard   │
└─────────────────────────────┬────────────────────────────────────────┘
                              │  HTTPS + WebSocket
┌─────────────────────────────▼────────────────────────────────────────┐
│                    API GATEWAY  (Express + tRPC)                      │
│  Auth · Rate Limiting · CORS · Session · MCP Protocol Handler        │
└──────┬──────────────────────┬──────────────────────┬─────────────────┘
       │                      │                      │
┌──────▼───────┐  ┌───────────▼──────────┐  ┌───────▼────────────────┐
│ NEURAL BRIDGE│  │  MEMORY SYSTEM       │  │  COLLABORATION ENGINE  │
│ v2 Protocol  │  │  Relational Memory   │  │  Agent Orchestration   │
│              │  │  Core (RMC)          │  │  Shared Latent Memory  │
│ W-Matrix     │  │  Governance          │  │  MCP Server            │
│ KV-Compress  │  │  Conflict Resolver   │  │                        │
│ Anti-Poison  │  │                      │  │                        │
└──────┬───────┘  └───────────┬──────────┘  └───────┬────────────────┘
       │                      │                      │
┌──────▼──────────────────────▼──────────────────────▼────────────────┐
│                        STORAGE LAYER                                  │
│  PostgreSQL (Prisma)  ·  Redis (BullMQ)  ·  S3/R2  ·  pgvector      │
└──────────────────────────────────┬───────────────────────────────────┘
                                   │
┌──────────────────────────────────▼───────────────────────────────────┐
│                        BLOCKCHAIN LAYER                               │
│  Avalanche C-Chain  ·  ERC-8004  ·  USDC/USDT  ·  Custody Wallets   │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
| ----- | --------- |
| Frontend | React 19, Vite, TailwindCSS, Radix UI, Wouter |
| Backend | Node.js 20+, Express, tRPC v11, Socket.IO |
| Database | PostgreSQL (Prisma ORM), pgvector |
| Cache / Queues | Redis, BullMQ |
| AI / ML | Neural Bridge v2, OpenAI Embeddings API (BYOK) |
| Blockchain | Avalanche C-Chain, ethers.js v6, ERC-8004 |
| Payments | USDC / USDT stablecoin, MetaMask, Stripe |
| File Storage | AWS S3 / Cloudflare R2 |
| Deployment | PM2 (cluster), Nginx, GitHub Actions, EC2 |

---

## Project Structure

```text
Awareness-Market/
├── client/                    # React frontend (Vite)
│   └── src/
│       ├── pages/             # Route-level components
│       ├── components/        # Shared UI components
│       ├── hooks/             # Custom React hooks
│       └── lib/               # Utilities, Web3 integration
│
├── server/                    # Backend (Express + tRPC)
│   ├── _core/                 # App entry, auth, LLM client
│   ├── routers/               # tRPC routers (one per domain)
│   ├── latentmas/             # Neural Bridge v2 protocol
│   ├── memory-core/           # Relational Memory Core (RMC)
│   ├── collaboration/         # Multi-agent engine
│   ├── blockchain/            # On-chain integration
│   └── workers/               # BullMQ background jobs
│
├── mcp-server/                # Standalone MCP server (npm package)
├── mcp-gateway/               # MCP gateway (Go)
├── contracts/                 # Solidity smart contracts
├── docs/                      # Documentation
│   ├── ARCHITECTURE.md        # System design & data flows
│   ├── DEPLOYMENT.md          # Production deployment guide
│   └── CONTRIBUTING.md        # Dev workflow & code standards
│
├── experimental/              # Early-stage subsystems
│   ├── robotics/              # ROS2 bridge (Unitree integration)
│   └── go-services/           # Go microservices (analytics, recommendations)
│
└── sdk/                       # Client SDKs
    └── python/                # Python SDK
```

---

## Documentation

| Document | Description |
| -------- | ----------- |
| [Architecture](docs/ARCHITECTURE.md) | System design, data flows, and key algorithms |
| [Deployment](docs/DEPLOYMENT.md) | Production deployment on EC2 + RDS + PM2 |
| [Contributing](docs/CONTRIBUTING.md) | Dev workflow, code standards, documentation rules |
| [Status](STATUS.md) | Subsystem maturity levels (production / beta / experimental) |
| [Whitepaper](docs/WHITEPAPER.md) | Full technical whitepaper — Neural Bridge protocol, PoLF, W-Matrix |

---

## Key Concepts

**Knowledge Packages** — AI knowledge is packaged in three formats:

- **Latent Vectors** (`.vectorpkg`) — static skills and domain expertise
- **KV-Cache Memory** (`.memorypkg`) — conversation context and working memory
- **Reasoning Chains** (`.chainpkg`) — complete problem-solving workflows

**Neural Bridge v2** — cross-model knowledge transfer protocol. W-Matrix alignment maps vectors between model families (40+ supported). Anti-poisoning verification (PoLF) ensures package integrity before listing.

**MCP Collaboration** — multi-AI sessions where Claude, Manus, v0, or any MCP-compatible agent work together with shared memory, task delegation, and weighted consensus.

**Relational Memory Core** — hybrid retrieval engine combining vector search, graph traversal, and inference path discovery. Memories have lifecycle governance (decay, conflict resolution, promotion).

See [Architecture](docs/ARCHITECTURE.md) for deep technical details on each system.

---

## Environment Variables

| Variable | Purpose |
| -------- | ------- |
| `DATABASE_URL` | PostgreSQL connection string (RDS) |
| `REDIS_HOST` | Redis host for BullMQ workers |
| `SESSION_SECRET` | JWT / session signing key |
| `PROVIDER_KEY_SECRET` | AES-256-GCM key for BYOK encryption |
| `AVALANCHE_RPC_URL` | Avalanche C-Chain RPC endpoint |
| `S3_BUCKET` | Vector file storage bucket |

See `.env.example` for the full list.

---

## License

MIT

---

Built with Neural Bridge v2 -- Awareness Market 2026
