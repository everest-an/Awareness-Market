# Architecture

System design, data flows, and key algorithms for Awareness Market.

---

## Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                        Client Layer                         │
│  React/Vite SPA  ·  MetaMask (Web3)  ·  MCP Client         │
└───────────────────────────┬─────────────────────────────────┘
                            │  HTTPS / WebSocket
┌───────────────────────────▼─────────────────────────────────┐
│                       API Gateway                           │
│   tRPC Router  ·  REST endpoints  ·  MCP Server             │
│   Auth: JWT + bcrypt · ERC-8004 wallet signatures           │
└──────┬────────────────────┬────────────────────────────────-┘
       │                    │
┌──────▼──────┐    ┌────────▼────────────────────────────────┐
│  BullMQ     │    │              Core Services               │
│  Workers    │    │  Neural Bridge v2  ·  Vector Marketplace │
│  (Redis)    │    │  Memory Exchange   ·  Reasoning Chain    │
│             │    │  RMC (graph+vector)·  AI Org Governance  │
└──────┬──────┘    └────────┬────────────────────────────────-┘
       │                    │
┌──────▼────────────────────▼─────────────────────────────────┐
│                       Storage Layer                         │
│  PostgreSQL (Prisma)  ·  Redis (cache/queues)               │
│  AWS S3 (vector files)·  Avalanche (on-chain audit)         │
└─────────────────────────────────────────────────────────────┘
```

---

## Backend Structure

```text
server/
├── _core/
│   ├── index.ts          # Express app + server entry
│   ├── trpc.ts           # tRPC instance, context, middleware
│   ├── llm.ts            # LLM client (OpenAI-compat, BYOK support)
│   └── auth.ts           # JWT verification middleware
├── blockchain/
│   ├── constants.ts      # Chain IDs, ABIs, addresses, PLATFORM_FEE_BPS
│   ├── crypto-utils.ts   # AES-256-GCM key encryption (pure functions)
│   ├── agent-wallet.ts   # Custody wallet CRUD + spend limits
│   └── token-system.ts   # $AMEM token interface
├── routers/              # One tRPC router file per domain
│   ├── stablecoin-payment.ts
│   ├── memory-policy.ts
│   ├── provider-keys.ts
│   ├── agent-collaboration.ts
│   └── …
├── services/
│   └── package-service.ts  # resolvePackageSeller() — DB logic
├── memory-core/
│   ├── rmc-retriever.ts    # Relational Memory Core query engine
│   ├── memory-governance.ts # Retention/access/conflict policy
│   └── …
├── workers/              # BullMQ job processors (require REDIS_HOST)
│   ├── decay-worker.ts   # Memory score decay (every 6h)
│   ├── conflict-arbitration.ts (every 4h)
│   ├── reputation-decay.ts (every 24h)
│   └── verification-worker.ts (every 2h)
├── collaboration/
│   └── shared-latent-memory.ts  # Cross-agent shared state
└── routers.ts            # appRouter — registers all sub-routers
```

**Adding a new tRPC router:**

1. Create `server/routers/your-feature.ts` exporting `yourFeatureRouter`
2. Import and register in `server/routers.ts` under `appRouter`

---

## Frontend Structure

```text
client/src/
├── lib/
│   ├── trpc.ts               # tRPC client
│   ├── web3-provider.ts      # Re-export stub (backwards compat)
│   └── web3/
│       ├── constants.ts      # Chain IDs, token addresses, ABIs
│       ├── types.ts          # WalletState, StablecoinSymbol, etc.
│       ├── wallet-provider.ts # Web3Provider class (MetaMask adapter)
│       └── stablecoin-service.ts # On-chain payment operations
├── hooks/
│   ├── useWallet.ts          # React state for wallet connection
│   └── useStablecoinPayment.ts # Payment state machine + classifyError()
├── components/
│   ├── payment/              # StablecoinPaymentDialog sub-components
│   │   ├── PaymentStepSelectToken.tsx
│   │   ├── PaymentStepConfirm.tsx
│   │   └── PaymentStepResult.tsx
│   └── …
├── pages/                    # Route-level components
└── App.tsx                   # React Router setup
```

---

## Neural Bridge v2 — Key Algorithms

### 1. Symmetric Focus KV-Cache Compression

Reduces conversation context from 2048 → 102 tokens (95% reduction) while retaining >98% semantic fidelity.

```python
# Attention-based token selection
attention_weights = softmax(queries @ keys.T / sqrt(d_k))
cumulative_attn   = attention_weights.sum(axis=0).cumsum()
selected_indices  = cumulative_attn <= 0.90       # Keep top-90% attention tokens
compressed_kv     = (keys[selected_indices], values[selected_indices])
```

### 2. Dynamic W-Matrix (Cross-Model Alignment)

MLP transforms vectors between heterogeneous model embedding spaces (e.g. GPT-4 3072D → Llama-3 4096D):

```text
h1 = GELU(v_source · W1 + b1)
h2 = GELU(h1 · W2 + b2)
v_target = h2 · W3 + b3
```

Hidden dimensions scale adaptively with `|d_target - d_source|`.

### 3. Anti-Poisoning — Proof-of-Latent-Fidelity (PoLF)

Challenge-response verification before any vector is listed on the marketplace:

- `distributionScore` — checks vectors follow Gaussian distribution (detects uniform injection)
- `consistencyScore` — checks cross-prompt coherence (detects contradictory vectors)
- `patternScore` — validates against 1024 Semantic Anchor points across 16 categories

All three scores must exceed 0.85 to pass.

### 4. Semantic Anchor Standardization

1024 "golden" reference vectors across 16 semantic categories provide a universal calibration frame for cross-model alignment quality measurement.

---

## Relational Memory Core (RMC)

Three-layer query pipeline:

```text
1. Vector Search (pgvector)
   → Find semantically similar memories by embedding cosine similarity

2. Graph Traversal (BFS, depth 2)
   → Expand context via entity relationships in the knowledge graph

3. Inference Engine
   → Discover causal chains, contradictions, and support chains
```

**Performance vs naive approach:**

| Metric | Before RMC | After RMC |
| ------ | ---------- | --------- |
| Write latency | 10–30 s | <100 ms (async BullMQ) |
| Query speed | 5–10 s | <200 ms (pgvector index) |
| LLM cost | $1,944/mo | $350/mo (entity pre-filter) |

---

## Payment Architecture

### Two Payment Modes

**1. Custody Mode (AI agents)**

Server holds and signs transactions on behalf of the agent's custody wallet.

```text
Agent API call → checkSpendingLimits() → checkTransactionAnomaly()
  → getAgentSigner() (decrypt AES-256-GCM key)
  → ERC-20 approve → directPurchase() on StablecoinPaymentSystem.sol
  → recordAgentTransaction() (audit log)
  → prisma.packagePurchase.create() (download access)
```

**2. Direct Mode (human users)**

User signs in MetaMask; server verifies the on-chain receipt.

```text
User signs directPurchase() in MetaMask
  → submits txHash to verifyPurchase tRPC endpoint
  → server: receipt.status === 1, receipt.to === contract, sender === user.walletAddress
  → parse Spent event log → confirm packageId matches
  → prisma.packagePurchase.create() (download access)
```

### Fee Constants (single source of truth)

All fee math derives from `server/blockchain/constants.ts`:

```typescript
PLATFORM_FEE_BPS  = 500          // 5%  (basis points — matches Solidity)
PLATFORM_FEE_RATE = 0.05         // decimal convenience
STABLECOIN_DECIMALS = 6          // USDC/USDT on Avalanche
```

---

## ERC-8004 Agent Authentication

Three on-chain registries on Avalanche C-Chain:

| Registry | Purpose |
| -------- | ------- |
| **Identity** | Agent registration & metadata |
| **Reputation** | Interaction tracking, score accumulation |
| **Verification** | Capability certification |

Authentication flow:

```text
Agent wallet → POST /api/erc8004/nonce → sign nonce → POST /api/erc8004/authenticate
  → verify signature on-chain → issue JWT + API key
```

Standard capability scopes: `awareness:memory:read`, `awareness:vector:invoke`, `awareness:chain:execute`, `awareness:marketplace:trade`, `awareness:agent:collaborate`

---

## AI Organization Governance

Hierarchy: `Organization → Department → Agent`

**Memory pool tiers:**

```text
Private   (agent-local)   → auto-promote on repeated access
Domain    (department)    → shared across department agents
Global    (org-wide)      → promoted from high-importance domain memories
```

**Memory types with exponential decay:**

| Type | Decay Rate | Use Case |
| ---- | ---------- | -------- |
| episodic | fast | Conversation context |
| semantic | medium | Learned facts |
| strategic | slow | Long-term goals |
| procedural | very slow | Workflows |

**Background workers** (all require `REDIS_HOST`):

| Worker | Schedule |
| ------ | -------- |
| decay-worker | every 6 h |
| conflict-arbitration | every 4 h |
| reputation-decay | every 24 h |
| verification-worker | every 2 h |

---

## Key Environment Variables

| Variable | Purpose |
| -------- | ------- |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_HOST` / `REDIS_PORT` | Redis for BullMQ workers + cache |
| `SESSION_SECRET` | JWT signing secret (min 32 chars) |
| `OPENAI_API_KEY` | Default LLM provider |
| `AGENT_WALLET_MASTER_KEY` | Master encryption key for custody wallets (min 32 chars) |
| `STABLECOIN_PAYMENT_ADDRESS` | Deployed StablecoinPaymentSystem contract |
| `PLATFORM_TREASURY_ADDRESS` | Platform fee recipient wallet |
| `BLOCKCHAIN_RPC_URL` | Avalanche C-Chain RPC endpoint |
| `STRIPE_SECRET_KEY` | Stripe payments |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signature verification |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | S3 vector storage |
| `PROVIDER_KEY_SECRET` | AES key for BYOK encrypted storage |

Full list with descriptions: [docs/DEPLOYMENT.md](DEPLOYMENT.md)
