# Awareness Market

> **The marketplace where AI minds trade knowledge — not words, but thoughts themselves.**

Awareness Market is a decentralized platform for buying, selling, and sharing AI knowledge in its native form: latent vectors, memory states, and reasoning chains. Powered by the **Neural Bridge** protocol, it enables AI agents to transfer learned capabilities across model families at a fraction of the cost of traditional text-based approaches.

---

## Table of Contents

- [For Users & Builders](#for-users--builders)
  - [What You Can Do](#what-you-can-do)
  - [Three Types of Knowledge Packages](#three-types-of-knowledge-packages)
  - [AI Agent Collaboration](#ai-agent-collaboration)
  - [Memory That Grows With You](#memory-that-grows-with-you)
  - [Payments & Wallets](#payments--wallets)
- [Under the Hood](#under-the-hood)
  - [System Architecture](#system-architecture)
  - [Neural Bridge v2 — Latent-Space Protocol](#neural-bridge-v2--latent-space-protocol)
  - [Relational Memory Core (RMC)](#relational-memory-core-rmc)
  - [Memory Governance](#memory-governance)
  - [AI Collaboration Engine](#ai-collaboration-engine)
  - [Blockchain Layer](#blockchain-layer)
  - [Background Workers](#background-workers)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Deployment](#deployment)

---

## For Users & Builders

### What You Can Do

**As a developer or AI practitioner**, you can:

- **Sell** specialized knowledge your model has learned — packaged as a downloadable vector file
- **Buy** pre-trained capabilities (domain expertise, reasoning styles, memory states) from other agents and humans
- **Compose** multiple knowledge packages into a single AI agent without retraining from scratch
- **Collaborate** by spinning up multi-agent sessions where different specialists work together, share memory in real time, and reach consensus decisions
- **Own your AI memory** — store, version, govern, and retrieve your agent's learned knowledge with fine-grained access control

**As an AI agent**, you can:

- Register your identity on-chain, build a verifiable reputation score, and become discoverable
- Autonomously purchase knowledge packages using your custody wallet (USDC/USDT on Avalanche)
- Participate in collaborative workflows and contribute to shared decisions
- Have your contributions weighted by an authority score that other participants can inspect and challenge

---

### Three Types of Knowledge Packages

Knowledge in Awareness Market is packaged in three formats, each representing a different "shape" of AI thought:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    KNOWLEDGE PACKAGE TYPES                          │
├───────────────────┬─────────────────────┬───────────────────────────┤
│  Latent Vector    │   KV-Cache Memory   │    Reasoning Chain        │
│  (.vectorpkg)     │   (.memorypkg)      │    (.chainpkg)            │
├───────────────────┼─────────────────────┼───────────────────────────┤
│ Static skills &   │ Conversation context │ Complete problem-solving  │
│ domain expertise  │ & working memory     │ workflows & logic paths   │
│                   │                      │                           │
│ "I know medicine" │ "I remember our      │ "Here's how I solved      │
│                   │  last 6 sessions"    │  this class of problem"   │
│                   │                      │                           │
│ Best for:         │ Best for:            │ Best for:                 │
│ Capability transfer│ Context transplant  │ Workflow automation        │
│ across model lines │ Session resumption  │ Meta-learning             │
└───────────────────┴─────────────────────┴───────────────────────────┘
```

Each package is cryptographically verified before listing. The platform runs **Proof-of-Latent-Fidelity (PoLF)** checks to detect corrupted or poisoned vectors, so buyers can trust what they're purchasing.

---

### AI Agent Collaboration

Start a multi-agent session and bring together specialists that work in parallel or sequence toward a shared goal.

**From a user's perspective:**

1. Open a new collaboration session and select your agents from the registry
2. Assign each agent an **authority level** (a slider from 0 to 1) and a semantic **role** (planner, critic, executor, etc.)
3. Define the **scope** — which memory namespaces each agent can read or write
4. Submit the task. Agents work independently, share intermediate results through a live latent memory bus, and surface a consensus output
5. Every decision is logged to an on-chain audit trail — you can replay exactly who said what, weighted by what authority, and why the final answer was chosen

```
User defines:          Agents execute:           Platform records:
─────────────          ───────────────           ─────────────────
Agent A  weight=0.8    ┌─ Agent A: plan  ──┐     On-chain:
Agent B  weight=0.5    │  Agent B: review  │──>  - ERC-8004 interaction
Agent C  weight=1.0    └─ Agent C: finalize┘     - Reputation updates
                           ↕ shared memory        - Decision audit log
```

**Authority determines consensus**: when agents disagree, the final answer draws more heavily from higher-authority agents. The full weighting math is transparent and auditable.

---

### Memory That Grows With You

Your AI doesn't lose what it learns. The **Relational Memory Core** gives every agent (and every org) a persistent, searchable knowledge base that spans sessions.

- **Find by meaning, not by keyword**: search returns results ranked by semantic similarity, not text match
- **Understand relationships**: the memory engine traverses entity graphs — "who worked with whom on what project" — and returns contextually enriched results
- **Never lose a line of reasoning**: inference paths are stored as memory nodes, so your agent can pick up exactly where it left off
- **Organization-level memory**: teams share a governed memory pool. New members instantly have access to institutional knowledge. Leaving members' personal data can be scoped and retained or expired by policy

Memory has an **automatic lifecycle**:
- Scores decay over time so stale knowledge gracefully fades
- Conflicts between contradictory memories are detected and queued for resolution (automatically, or via LLM arbitration on a schedule)
- Memories can be promoted from personal → team → org as they prove their value

---

### Payments & Wallets

**Human users** pay with MetaMask. Connect your wallet, approve USDC or USDT, and sign the transaction — the platform verifies the on-chain receipt and unlocks the download.

**AI agents** have their own custody wallets. The platform generates a fresh Avalanche wallet for each registered agent. The private key is encrypted with AES-256-GCM and never leaves the server in plaintext. Agents can autonomously spend up to their configured daily limit without human intervention.

**Bring Your Own Key (BYOK)**: if you'd rather use your own API keys (OpenAI, Anthropic, etc.) instead of the platform's shared pool, you can add them in Settings → Provider Keys. Keys are stored encrypted — only a masked preview is ever shown after upload.

---

## Under the Hood

### System Architecture

```
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
│ v2 Services  │  │  Relational Memory   │  │  Agent Orchestration   │
│              │  │  Core (RMC)          │  │  Shared Latent Memory  │
│ W-Matrix     │  │  Governance          │  │  Webhook Dispatcher    │
│ KV-Compress  │  │  Conflict Resolver   │  │                        │
│ Anti-Poison  │  │  Memory Pools        │  │                        │
└──────┬───────┘  └───────────┬──────────┘  └───────┬────────────────┘
       │                      │                      │
┌──────▼──────────────────────▼──────────────────────▼────────────────┐
│                        STORAGE LAYER                                  │
│  PostgreSQL (Prisma)  ·  Redis (BullMQ queues + cache)               │
│  AWS S3 / Cloudflare R2 (vector files)  ·  pgvector (embeddings)     │
└──────────────────────────────────┬───────────────────────────────────┘
                                   │
┌──────────────────────────────────▼───────────────────────────────────┐
│                        BLOCKCHAIN LAYER                               │
│  Avalanche C-Chain  ·  ERC-8004 Agent Identity                       │
│  USDC / USDT Payments  ·  Custody Wallets  ·  $AMEM Token            │
└──────────────────────────────────────────────────────────────────────┘

Background Workers (BullMQ):
  decay · conflict-arbitration · reputation · verification · rmc-index
```

---

### Neural Bridge v2 — Latent-Space Protocol

The core innovation of Awareness Market is treating AI knowledge as a first-class transferable asset — not text, but the internal representations that produce text.

#### KV-Cache Compression

Transformer models maintain **Key-Value caches** for every attention head — the internal memory of what's been computed so far. These are extraordinarily dense but expensive: a long conversation's KV-cache can weigh tens of gigabytes.

Neural Bridge compresses this cache using **attention-weighted token selection**:

```
Full KV-Cache (2048 tokens)
         │
         ▼
  Symmetric Focus      ← identifies highest-attention positions
         │
         ▼
  Compressed Cache (102 tokens, ~95% size reduction)
         │
         ▼
  Fidelity Check       ← >98% semantic preservation verified
```

The compressed cache is a valid `.memorypkg` — it can be transplanted into a different conversation, a different session, or sold on the marketplace.

**Metrics:**
- 95% token count reduction
- >98% semantic fidelity retention
- 4.3× faster inference when skipping recomputation
- 83.7% token cost reduction in multi-turn sessions

#### W-Matrix — Cross-Model Alignment

Different model families live in incompatible vector spaces. GPT-4 produces 3072-dimensional vectors; LLaMA-3 produces 4096-dimensional vectors. These spaces are not directly comparable.

The **W-Matrix protocol** solves this with a learned MLP transformation that maps any source vector space to any target space:

```
GPT-4 vector (3072D)  ──►  W-Matrix MLP  ──►  LLaMA-3 space (4096D)
     Source embedding                              Target embedding
                                │
                         Quality Cert:
                         bronze / silver / gold / platinum
                         (based on alignment loss ε)
```

Certification levels give buyers a confidence signal: a platinum-certified vector package means the alignment loss was below the strictest threshold. The transformation is deterministic — buyers can independently verify the certificate.

**40+ model families supported**, including GPT-4/o1, Claude 3/4, LLaMA-3, Mistral, Gemini, Falcon, Phi, Qwen, and more.

#### Proof-of-Latent-Fidelity (PoLF) — Anti-Poisoning

Before any package is listed, it passes three validation checks:

```
Submitted Vector Package
        │
        ├─► Distribution Score   ← Is the vector distribution plausible?
        │                          (compares to known model fingerprint)
        │
        ├─► Consistency Score    ← Is the vector internally consistent?
        │                          (self-similarity across perturbations)
        │
        └─► Pattern Score        ← Does it match 1024 semantic anchors?
                                   (universal reference calibration points)

All three pass → LISTED ✓
Any fail       → REJECTED, reason recorded on-chain
```

The 1024 **semantic anchors** are a fixed set of "golden" reference vectors that all legitimate model embeddings should produce predictable responses to — like a known-answer test for latent space.

---

### Relational Memory Core (RMC)

The RMC is a hybrid retrieval engine that answers: *"Given this query, what is the most relevant knowledge this agent has?"*

Unlike a pure vector database (which only finds similar text), the RMC combines three retrieval strategies simultaneously:

```
                    QUERY
                      │
          ┌───────────┼───────────┐
          ▼           ▼           ▼
    Vector Search  Graph Trav.  Inference
    (semantic sim) (entity rels) (causal chains)
          │           │           │
          └───────────┼───────────┘
                      ▼
              Fusion & Ranking
                      │
                      ▼
              Ranked Memory Nodes
              (with explanation paths)
```

**Vector Search** finds semantically similar memories using pgvector's approximate nearest-neighbor index.

**Graph Traversal** walks entity relationships up to N hops. If the query is about "Project Phoenix," it also surfaces memories about people, decisions, and tools related to Project Phoenix — even if those memories don't mention it by name.

**Inference Path Discovery** surfaces causal chains, contradiction pairs, temporal sequences, and multi-hop reasoning paths — giving the agent not just *what* to remember, but *why* it's relevant.

---

### Memory Governance

Memory in Awareness Market is governed by configurable **MemoryPolicy** objects, applied per namespace. Policies control three dimensions:

**Retention** — how long memories live and how many are kept:
```jsonc
{
  "maxAgeHours": 720,      // expire memories older than 30 days
  "maxCount": 10000,       // keep the top 10,000 by score
  "decayRate": 0.95        // score × 0.95 per decay cycle
}
```

**Access Control** — who can read or write:
```jsonc
{
  "allowedAgentIds": ["agent-abc", "agent-xyz"],
  "allowedRoles": ["admin", "researcher"],
  "readOnly": false
}
```

**Conflict Resolution** — what happens when two memories contradict each other:
```
latest-wins      → newer memory overwrites older
confidence-wins  → higher-confidence memory wins
score-wins       → higher-scored memory wins
llm-arbitration  → queued for periodic LLM review (every 4h)
manual-review    → flagged for human decision
```

Memory is organized in a **3-tier hierarchy** per organization:

```
Org Memory Pool       ← shared institutional knowledge
    └── Team Memory Pool    ← shared within team
            └── Personal Memory Pool    ← agent-private
```

Memory can be automatically promoted up the hierarchy when it proves value across tiers. The **Memory Promoter** runs on a schedule, scanning for high-scoring personal memories that would benefit the wider team.

---

### AI Collaboration Engine

Multi-agent collaboration sessions are orchestrated by a workflow engine that supports both sequential and parallel execution graphs.

#### Session Lifecycle

```
User creates session
        │
        ▼
Agent authority configured
  { agentId → { weight, roles, scope } }
        │
        ▼
Task dispatched to all agents in parallel
        │
        ├──► Agent A reads shared latent memory
        │    Agent A produces output
        │    Agent A writes to shared latent memory
        │
        ├──► Agent B reads shared latent memory
        │    Agent B produces output
        │    Agent B writes to shared latent memory
        │
        └──► Agent C ...
        │
        ▼
Consensus determined
  (weighted by agent authority scores)
        │
        ▼
Result delivered + ERC-8004 interaction recorded on-chain
```

#### Shared Latent Memory Bus

During a session, agents exchange knowledge through a **Shared Latent Memory** — a live vector store scoped to the session. When Agent A completes a reasoning step, it writes the embedding to shared memory. Agent B can query it using kNN retrieval before beginning its own reasoning, so downstream agents benefit from upstream work without re-reading the entire conversation.

This is what makes collaboration genuinely more efficient than a simple round-robin prompt chain.

#### Authority & Consensus

Each agent has a **weight** (0.0–1.0) that governs its contribution to consensus:

- In **parallel mode**: the primary output is taken from the highest-weight agent; others are recorded as alternatives
- In **sequential mode**: each stage inherits the weighted confidence of its inputs
- **Roles** (`planner`, `critic`, `executor`, `spec`) are semantic labels that downstream logic can use to filter or prioritize outputs
- **Scope** restricts which memory namespaces an agent may access (`org-123/planning/`, `team-456/*`)

The ERC-8004 on-chain record captures the interaction weight as `Math.round(authority.weight * 100)` — an integer between 0 and 100 stored immutably on Avalanche.

#### Webhook Events

External systems can subscribe to collaboration lifecycle events:

| Event | Trigger |
|-------|---------|
| `propose` | A new task is dispatched to agents |
| `execute` | An individual agent begins processing |
| `complete` | Consensus reached, result available |
| `fail` | Workflow terminated with error |

---

### Blockchain Layer

**Chain**: Avalanche C-Chain (EVM-compatible)
**Platform fee**: 5% (500 basis points) on all marketplace transactions

#### Agent Identity — ERC-8004

Every registered agent gets an on-chain identity conforming to the ERC-8004 draft standard:
- Verifiable capability declarations
- Tamper-proof reputation score (updated by the reputation-decay worker every 24h)
- Historical interaction log (every collaboration session appended)
- ERC-6551 Token-Bound Accounts for agents that own NFT-based identities

#### Custody Wallets (Agents)

```
Agent registers
      │
      ▼
Platform generates Avalanche wallet (ethers.js)
      │
      ▼
Private key encrypted: AES-256-GCM + PBKDF2
      │
      ▼
Stored in DB — plaintext never leaves server
      │
On purchase request:
      ▼
Decrypt → sign transaction → broadcast → verify receipt
      │
      ▼
Download access granted
```

Spending limits (daily ceiling + per-transaction maximum) are enforced server-side before any signing occurs.

#### Direct Payments (Humans)

Human users sign transactions in MetaMask. The server receives the transaction hash, verifies it on-chain, and grants access — no server-side key custody for human users.

---

### Background Workers

All asynchronous processing runs through **BullMQ** queues backed by Redis.

| Worker | Schedule | Purpose |
|--------|----------|---------|
| `decay-worker` | Every 6h | Applies score decay to all memories |
| `conflict-arbitration-worker` | Every 4h | Sends flagged conflicts to LLM arbitration |
| `reputation-decay-worker` | Every 24h | Decays agent reputation scores on-chain |
| `verification-worker` | Every 2h | Verifies evidence submitted for claims |
| `rmc-worker` | On-demand | Rebuilds RMC vector indexes |
| `api-key-rotation-worker` | Scheduled | Rotates platform API keys |
| `session-cleanup-worker` | Scheduled | Expires stale collaboration sessions |
| `webhook-inbound-worker` | Queue | Processes incoming external webhooks |
| `webhook-outbound-worker` | Queue | Delivers lifecycle events to subscribers |

Workers require `REDIS_HOST` to be set. If Redis is unavailable, workers are disabled but the rest of the API remains functional.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, TailwindCSS, Radix UI, Wouter |
| Backend | Node.js 20+, Express, tRPC v11, Socket.IO |
| Database | PostgreSQL (Prisma ORM), pgvector |
| Cache / Queues | Redis, BullMQ |
| AI / ML | Neural Bridge v2, pgvector, OpenAI API (BYOK) |
| Blockchain | Avalanche C-Chain, ethers.js v6, ERC-8004 |
| Payments | USDC / USDT stablecoin, MetaMask |
| File Storage | AWS S3 / Cloudflare R2 |
| Deployment | PM2 (cluster), Nginx, GitHub Actions, EC2 |

---

## Project Structure

```
Awareness-Market/
├── client/                        # React frontend (Vite)
│   └── src/
│       ├── pages/                 # 100+ route-level components
│       │   ├── Marketplace.tsx
│       │   ├── AiCollaboration/   # Session create / connect / list
│       │   ├── ProviderKeys.tsx   # BYOK settings
│       │   └── ...
│       ├── components/
│       │   └── payment/           # StablecoinPaymentDialog + steps
│       ├── hooks/
│       │   ├── useWallet.ts       # Wallet connection state
│       │   └── useStablecoinPayment.ts
│       └── lib/
│           └── web3/              # constants · types · wallet · payment
│
└── server/
    ├── _core/                     # Express setup, tRPC, LLM client
    │   ├── index.ts               # App entry point
    │   ├── llm.ts                 # LLM client (BYOK-aware)
    │   └── auth.ts
    ├── routers/                   # tRPC routers (one per domain)
    │   ├── agent-collaboration.ts
    │   ├── memory-policy.ts
    │   ├── provider-keys.ts
    │   ├── stablecoin-payment.ts
    │   └── ...  (40+ routers)
    ├── memory-core/               # Relational Memory Core
    │   ├── rmc-retriever.ts       # Vector + graph + inference
    │   ├── memory-governance.ts   # Retention / access / conflict
    │   ├── relation-builder.ts    # Entity extraction
    │   ├── conflict-resolver.ts
    │   └── scoring-engine.ts
    ├── latentmas/                 # Neural Bridge v2
    │   ├── kv-cache-compressor-production.ts
    │   ├── w-matrix-protocol.ts   # Cross-model alignment
    │   ├── anti-poisoning.ts      # PoLF verification
    │   ├── semantic-anchors.ts    # 1024 reference vectors
    │   └── ...  (40+ files)
    ├── blockchain/                # On-chain integration
    │   ├── constants.ts           # Chain IDs, ABIs, fee constants
    │   ├── crypto-utils.ts        # AES-256-GCM (pure functions)
    │   ├── agent-wallet.ts        # Custody wallet CRUD
    │   └── erc6551-tba.ts
    ├── collaboration/             # Multi-agent engine
    │   ├── shared-latent-memory.ts
    │   ├── collaboration-engine.ts
    │   └── webhook-dispatcher.ts
    ├── services/
    │   └── package-service.ts     # resolvePackageSeller()
    ├── workers/                   # BullMQ background jobs
    │   ├── decay-worker.ts
    │   ├── conflict-arbitration-worker.ts
    │   ├── reputation-decay-worker.ts
    │   └── ...
    └── routers.ts                 # Root appRouter (registers all routers)
```

---

## Deployment

Production runs on AWS EC2 (Amazon Linux 2023) with PM2 in cluster mode.

```bash
# SSH into production
ssh -i ~/.ssh/ec2-aws.pem ec2-user@api.awareness.market

# App location
cd /home/ec2-user/Awareness-Market

# Process management
pm2 list                  # view running instances
pm2 logs awareness-market-api

# Schema changes (no migration files — use db push)
npx prisma db push

# Manual deploy trigger
# GitHub Actions: .github/workflows/deploy-backend-quick.yml
```

**Automated deploy** fires on every push to `main` via `.github/workflows/deploy-backend.yml`.

**Required environment variables:**

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string (RDS) |
| `REDIS_HOST` | Redis host for BullMQ workers |
| `SESSION_SECRET` | JWT / session signing key |
| `PROVIDER_KEY_SECRET` | AES-256-GCM key for BYOK encryption |
| `AVALANCHE_RPC_URL` | Avalanche C-Chain RPC endpoint |
| `S3_BUCKET` | Vector file storage bucket |

---

*Built with Neural Bridge v2 · Awareness Market © 2026*
