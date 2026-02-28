# Deployment

Production deployment guide for Awareness Market on EC2 + RDS + PM2.

---

## Production Environment (Current)

| Resource | Value |
| -------- | ----- |
| App server | EC2 (Amazon Linux 2023) |
| SSH | `ssh -i ~/.ssh/ec2-aws.pem ec2-user@api.awareness.market` |
| App path | `/home/ec2-user/Awareness-Market` |
| Process manager | PM2 — 2 cluster instances on port 3001 |
| Database | PostgreSQL on RDS (`awareness-network-db.cezeeou48sif.us-east-1.rds.amazonaws.com`) |
| Frontend | Vite build served via Nginx |

---

## Required Environment Variables

Copy `.env.example` to `.env` and fill in every value below.

### Core

```bash
NODE_ENV=production
PORT=3001
APP_URL=https://awareness.market

# Auth
SESSION_SECRET=<min-32-char-random-string>   # openssl rand -hex 32

# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Redis (required for BullMQ workers)
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
```

### AI / LLM

```bash
OPENAI_API_KEY=sk-...
# Optional self-hosted LLM override
USE_SELF_HOSTED_LLM=false
VLLM_BASE_URL=https://your-pod.runpod.net
VLLM_MODEL_NAME=llama-3.1-8b
```

### Payments — Stripe

```bash
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
```

### Payments — Stablecoin (Avalanche)

```bash
STABLECOIN_PAYMENT_ADDRESS=0x...    # Deployed contract address
PLATFORM_TREASURY_ADDRESS=0x...     # Fee recipient wallet
BLOCKCHAIN_RPC_URL=https://api.avax.network/ext/bc/C/rpc
AGENT_WALLET_MASTER_KEY=<min-32-char>  # openssl rand -hex 32
```

### BYOK Key Encryption

```bash
PROVIDER_KEY_SECRET=<min-32-char>   # AES key for encrypted API key storage
# Falls back to SESSION_SECRET if not set
```

### Storage

```bash
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
AWS_S3_BUCKET=awareness-vectors
```

### OAuth (optional)

```bash
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
```

---

## Deploy via GitHub Actions (Standard)

Push to `main` triggers the automated deploy pipeline (`.github/workflows/deploy-backend.yml`):

1. Build: `esbuild` bundles server — all deps use `--packages=external`
2. SSH to EC2 → pull latest → install deps → `prisma db push` → PM2 reload

**Manual / hotfix deploy** (no push needed):

Trigger `.github/workflows/deploy-backend-quick.yml` manually from GitHub Actions UI.

### SSH from GitHub Actions

The workflow uses `StrictHostKeyChecking=no`. If the security group blocks `ssh-keyscan`, add this to the SSH command:

```bash
ssh -o StrictHostKeyChecking=no -i key.pem ec2-user@api.awareness.market
```

---

## Manual Deploy (EC2 SSH)

```bash
ssh -i ~/.ssh/ec2-aws.pem ec2-user@api.awareness.market

cd /home/ec2-user/Awareness-Market

# Pull latest code
git pull origin main

# Install any new server deps
npm install --omit=dev

# Apply schema changes (no migration files — always use db push)
npx prisma db push

# Reload PM2 without downtime
pm2 reload awareness-market-api

# Verify
pm2 status
pm2 logs awareness-market-api --lines 50
```

---

## Database Schema Management

**Important:** This project uses `prisma db push` (schema push), NOT `prisma migrate deploy`. There are no migration history files.

```bash
# After any schema change in prisma/schema.prisma:
npx prisma generate      # Regenerate Prisma client
npx prisma db push       # Push schema diff to database

# Never run:
# npx prisma migrate deploy   ← will fail, no migration files exist
```

---

## PM2 Configuration

Two cluster instances run on port 3001, fronted by Nginx on port 443.

```bash
# Check status
pm2 status

# Graceful reload (zero downtime)
pm2 reload awareness-market-api

# View logs
pm2 logs awareness-market-api

# Hard restart (avoid in production)
pm2 restart awareness-market-api
```

---

## BullMQ Workers

Workers require Redis. They start automatically with the main process if `REDIS_HOST` is set.

| Worker | Schedule | Purpose |
| ------ | -------- | ------- |
| decay-worker | every 6 h | Memory score decay & auto-archive |
| conflict-arbitration | every 4 h | LLM-powered conflict resolution |
| reputation-decay | every 24 h | Agent reputation decay for inactivity |
| verification-worker | every 2 h | Cross-department peer review assignment |

If `REDIS_HOST` is not set, workers are silently skipped (app still starts).

---

## Build System

Server is bundled with `esbuild`:

```bash
# Build server bundle
npm run build:server

# Flags used:
# --packages=external   → all node_modules installed on EC2, not bundled
# --platform=node
# --target=node18
```

All dependencies must be present in `node_modules` on EC2. After pulling, always run `npm install --omit=dev`.

---

## Local Development

```bash
# Install deps
pnpm install

# Start Postgres + Redis (Docker Compose)
docker compose up -d

# Push schema
pnpm prisma db push

# Start dev server (hot-reload)
pnpm run dev
# → API:      http://localhost:3001
# → Frontend: http://localhost:5173
```

### pgvector setup (local Postgres)

```sql
-- Connect to your local DB and run:
CREATE EXTENSION IF NOT EXISTS vector;
```

### Self-hosted LLM (optional, cost-saving)

To use Llama instead of OpenAI for embeddings/inference:

1. Deploy vLLM on RunPod (RTX 4090 Spot ~$0.44/h)
2. Set env vars:

```bash
USE_SELF_HOSTED_LLM=true
VLLM_BASE_URL=https://your-pod-8000.proxy.runpod.net
VLLM_MODEL_NAME=llama-3.1-8b
```

Full guide: `docs/deployment/QUICK_START_LLAMA.md`

---

## Healthcheck

```bash
# API alive
curl https://api.awareness.market/health

# tRPC ping
curl https://api.awareness.market/api/trpc/health.ping
```

Expected response: `{"result":{"data":{"ok":true}}}`

---

## Smart Contract Deployment (Avalanche)

Contracts are in `contracts/`. Deployed with Hardhat to Avalanche Fuji testnet or mainnet.

```bash
# Compile
npx hardhat compile

# Deploy to Fuji testnet
npx hardhat run scripts/deploy-stablecoin-final.ts --network fuji

# Deploy to mainnet
npx hardhat run scripts/deploy-stablecoin-final.ts --network avalanche
```

Required env:

```bash
DEPLOYER_PRIVATE_KEY=0x...
FUJI_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
AVALANCHE_RPC_URL=https://api.avax.network/ext/bc/C/rpc
SNOWSCAN_API_KEY=...   # For contract verification
```

After deploying, update `STABLECOIN_PAYMENT_ADDRESS` in `.env` on EC2.
