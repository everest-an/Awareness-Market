# Subsystem Maturity Status

Last updated: 2026-03-20

Each subsystem is classified by its current readiness level:

| Level | Meaning |
|-------|---------|
| **Production** | Running in production, tested, monitored |
| **Beta** | Feature-complete, needs more production validation |
| **Experimental** | Prototype / framework implementation, not production-ready |
| **Planned** | Interface defined, implementation pending |

---

## Core Platform

| Subsystem | Status | Notes |
|-----------|--------|-------|
| React Frontend (Marketplace, Auth, Dashboard) | **Production** | Deployed via Vite + Nginx |
| Express + tRPC API Gateway | **Production** | PM2 cluster on EC2 |
| PostgreSQL + Prisma ORM | **Production** | RDS-hosted |
| Redis + BullMQ Workers | **Production** | Decay, conflict arbitration, reputation |
| Auth (JWT, OAuth, email verification) | **Production** | Google + GitHub OAuth |
| Stripe Payments | **Production** | Subscription + credits |
| File Storage (S3 / R2) | **Production** | Vector package uploads/downloads |

## Neural Bridge v2 (LatentMAS)

| Subsystem | Status | Notes |
|-----------|--------|-------|
| KV-Cache Compressor | **Beta** | Production variant exists (`kv-cache-compressor-production.ts`), needs scale testing |
| W-Matrix Cross-Model Alignment | **Beta** | Xavier-initialized MLP, 40+ model configs |
| Anti-Poisoning (PoLF) | **Beta** | Challenge-response verification operational |
| Semantic Anchors (1024 vectors) | **Beta** | Template-generated, runtime kNN |
| ZKP Verification | **Experimental** | Framework only — no circom/snarkjs integration. Uses hash-based simulation in `development` mode |
| TEE Integration (SGX/SEV/Nitro) | **Experimental** | AWS Nitro attestation stubbed. SGX/SEV marked as placeholder. Development mode uses simulated attestation |
| Differential Privacy | **Experimental** | Noise injection implemented, not validated against formal DP guarantees |
| GPU Acceleration | **Experimental** | TensorFlow.js optional path, not benchmarked in production |

## Memory System

| Subsystem | Status | Notes |
|-----------|--------|-------|
| Relational Memory Core (RMC) | **Beta** | Vector + graph + inference retrieval |
| Memory Governance (policies, decay, promotion) | **Beta** | Configurable per namespace |
| Conflict Resolution | **Beta** | LLM arbitration on 4h schedule |
| Memory Forgetting | **Beta** | Score-based expiration |

## Collaboration

| Subsystem | Status | Notes |
|-----------|--------|-------|
| MCP Server (standalone npm package) | **Beta** | 11 collaboration tools, session management |
| Collaboration Engine | **Beta** | Sequential + parallel workflows. Fallback mode returns degraded status when MCP endpoint unavailable |
| Shared Latent Memory | **Beta** | Session-scoped vector store |
| Webhook Dispatcher | **Beta** | Lifecycle events (propose/execute/complete/fail) |

## Blockchain

| Subsystem | Status | Notes |
|-----------|--------|-------|
| Avalanche C-Chain Integration | **Beta** | USDC/USDT payment verification |
| ERC-8004 Agent Identity | **Beta** | On-chain registration + reputation |
| Custody Wallets | **Beta** | AES-256-GCM encrypted, server-side signing |
| Smart Contracts (Solidity) | **Beta** | AMEMToken, AgentCreditSystem, MemoryNFT, StablecoinPaymentSystem, ERC8004Registry |

## Peripheral / Experimental

| Subsystem | Status | Notes |
|-----------|--------|-------|
| Robotics (ROS2 Bridge) | **Experimental** | Unitree integration design, no hardware-validated paths |
| Go Microservices | **Experimental** | 6 services with skeleton code (analytics, recommendations, vector-ops, etc.) |
| MCP Gateway (Go) | **Experimental** | Go-based gateway, not deployed |
| Python SDK | **Experimental** | Basic client, async variant available |
| Golem Visualizer | **Experimental** | Standalone visualization tool |

---

## How to Interpret

- **Production** and **Beta** subsystems are safe to build on and integrate with.
- **Experimental** subsystems are functional prototypes. They may use simulated backends (e.g., ZKP `development` mode, TEE mock attestation) and should not be presented as production-ready.
- Contributions that move a subsystem from Experimental to Beta (by adding real integrations, tests, or production validation) are especially welcome.
