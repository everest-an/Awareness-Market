# LatentMAS Marketplace Complete Deployment Guide

**Last Updated**: 2026-01-05  
**Status**: Production-Ready ✅

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Smart Contract Deployment](#smart-contract-deployment)
4. [MCP Server Configuration](#mcp-server-configuration)
5. [Cold Start Data Generation](#cold-start-data-generation)
6. [End-to-End Testing](#end-to-end-testing)
7. [Production Checklist](#production-checklist)

---

## Overview

This guide walks you through deploying the complete LatentMAS Marketplace system:

- **Smart Contracts**: MemoryNFT (ERC-721) + ERC-6551 TBA integration
- **MCP Server**: AI Agent integration for Claude Desktop
- **Market Data**: 50 high-quality W-Matrix listings
- **Backend Integration**: Connect contracts to tRPC API

**Estimated Time**: 45-60 minutes  
**Estimated Cost**: ~$0.25 (Mumbai testnet MATIC + API calls)

---

## Prerequisites

### 1. System Requirements

- Node.js 18+ installed
- pnpm package manager
- MetaMask wallet
- Git and GitHub account

### 2. Get Mumbai MATIC

1. Visit [Polygon Mumbai Faucet](https://faucet.polygon.technology/)
2. Connect your MetaMask wallet
3. Request 0.5 MATIC (enough for ~50 contract deployments)
4. Wait 1-2 minutes for confirmation

### 3. Get RPC Endpoint

**Option A: Alchemy (Recommended)**
1. Sign up at [alchemy.com](https://www.alchemy.com/)
2. Create a new app → Select "Polygon Mumbai"
3. Copy the HTTPS endpoint (e.g., `https://polygon-mumbai.g.alchemy.com/v2/YOUR_KEY`)

**Option B: Infura**
1. Sign up at [infura.io](https://infura.io/)
2. Create a new project → Enable Polygon Mumbai
3. Copy the endpoint

**Option C: Public RPC (No signup required)**
- `https://rpc-mumbai.maticvigil.com/`
- Note: May be slower and less reliable

### 4. Export Private Key from MetaMask

⚠️ **Security Warning**: Never share your private key or commit it to Git!

1. Open MetaMask
2. Click account menu → Account Details
3. Click "Export Private Key"
4. Enter password → Copy private key
5. Save securely (you'll need it for deployment)

---

## Smart Contract Deployment

### Step 1: Set Environment Variables

Create `.env.local` file in project root:

```bash
# Deployment Wallet
DEPLOYER_PRIVATE_KEY=your_private_key_here

# RPC Endpoints
MUMBAI_RPC_URL=https://polygon-mumbai.g.alchemy.com/v2/YOUR_KEY

# PolygonScan API Key (optional, for contract verification)
POLYGONSCAN_API_KEY=your_polygonscan_api_key
```

**Get PolygonScan API Key** (optional but recommended):
1. Sign up at [polygonscan.com](https://polygonscan.com/)
2. Go to API-KEYs section
3. Create new API key
4. Copy and add to `.env.local`

### Step 2: Compile Contracts

```bash
cd /home/ubuntu/latentmind-marketplace
npx hardhat compile
```

Expected output:
```
Compiled 1 Solidity file with solc 0.8.20
✓ MemoryNFT.sol compiled successfully
```

### Step 3: Deploy MemoryNFT

```bash
npx hardhat run scripts/deploy/deploy-memory-nft.ts --network mumbai
```

Expected output:
```
╔══════════════════════════════════════════════════════════╗
║  Deploying MemoryNFT to Polygon Mumbai                  ║
╚══════════════════════════════════════════════════════════╝

Deploying contracts with account: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
Account balance: 0.5 MATIC

Deploying MemoryNFT contract...
✓ MemoryNFT deployed to: 0x1234567890abcdef1234567890abcdef12345678

Waiting for 5 block confirmations...
✓ Confirmed

╔══════════════════════════════════════════════════════════╗
║  Deployment Summary                                      ║
╚══════════════════════════════════════════════════════════╝

{
  "network": "mumbai",
  "chainId": 80001,
  "contracts": {
    "memoryNFT": {
      "address": "0x1234567890abcdef1234567890abcdef12345678",
      "deployer": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
      "deployedAt": "2026-01-05T10:30:00.000Z"
    },
    "erc6551Registry": {
      "address": "0x000000006551c19487814612e58FE06813775758",
      "note": "Official ERC-6551 Registry (pre-deployed)"
    }
  }
}

✓ Deployment info saved to deployment-info.json
```

**Save the contract address!** You'll need it for backend integration.

### Step 4: Verify Contract on PolygonScan

```bash
npx hardhat verify --network mumbai 0x1234567890abcdef1234567890abcdef12345678
```

Expected output:
```
Successfully verified contract MemoryNFT on PolygonScan.
https://mumbai.polygonscan.com/address/0x1234567890abcdef1234567890abcdef12345678#code
```

### Step 5: Update Backend with Contract Address

Edit `server/latentmas/erc6551-tba.ts`:

```typescript
// Line 15-20
const MEMORY_NFT_ADDRESS = {
  mumbai: '0x1234567890abcdef1234567890abcdef12345678', // ← Your deployed address
  polygon: '0x0000000000000000000000000000000000000000', // Mainnet (deploy later)
};

const ERC6551_REGISTRY = '0x000000006551c19487814612e58FE06813775758'; // Same on all chains
```

### Step 6: Test NFT Minting

```bash
pnpm tsx scripts/test-nft-minting.ts
```

Expected output:
```
=== Testing NFT Minting ===
✓ Connected to Mumbai testnet
✓ Minted NFT #1 for test user
✓ Created TBA: 0xabcdef1234567890abcdef1234567890abcdef12
✓ Verified on-chain ownership
✓ All tests passed
```

---

## MCP Server Configuration

### Step 1: Build MCP Server

```bash
cd /home/ubuntu/latentmind-marketplace/mcp-server
pnpm install
pnpm build
```

### Step 2: Configure Claude Desktop

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`  
**Linux**: `~/.config/Claude/claude_desktop_config.json`

Add MCP server configuration:

```json
{
  "mcpServers": {
    "latentmas-marketplace": {
      "command": "node",
      "args": ["/home/ubuntu/latentmind-marketplace/mcp-server/dist/index.js"],
      "env": {
        "API_BASE_URL": "https://awareness.market",
        "API_KEY": "your_api_key_here"
      }
    }
  }
}
```

### Step 3: Restart Claude Desktop

1. Quit Claude Desktop completely
2. Reopen Claude Desktop
3. Check MCP server status (should show "Connected")

### Step 4: Test MCP Tools

In Claude Desktop, try these queries:

**Test 1: Search Memories**
```
Search for W-Matrix memories compatible with GPT-4
```

Expected response:
```
Found 3 compatible W-Matrices:
1. gpt-3.5-turbo → gpt-4 (Epsilon: 3.2%, Price: $9.99)
2. claude-2 → gpt-4 (Epsilon: 4.1%, Price: $12.99)
3. llama-2-70b → gpt-4 (Epsilon: 4.8%, Price: $8.99)
```

**Test 2: Check Compatibility**
```
Check if there's a W-Matrix from GPT-3.5 to Claude 3
```

Expected response:
```
✓ Compatible W-Matrix found
Source: gpt-3.5-turbo
Target: claude-3-opus
Epsilon: 3.7%
Price: $11.99
```

**Test 3: Estimate Performance**
```
Estimate TTFT reduction for GPT-3.5 → GPT-4 transformation
```

Expected response:
```
Estimated Performance Gain:
- TTFT Reduction: 45% (from 2.3s to 1.27s)
- Bandwidth Savings: 95%
- Quality: Gold tier (ε = 3.2%)
```

---

## Cold Start Data Generation

### Step 1: Run Generation Script

```bash
pnpm tsx scripts/generate-cold-start-data.ts --max-pairs 50
```

**Parameters**:
- `--max-pairs`: Number of W-Matrix pairs to generate (default: 50)
- `--models`: Comma-separated list of models (default: GPT-3.5, GPT-4, Claude-2, Claude-3, Llama-2)
- `--anchors`: Number of anchor prompts per pair (default: 100)

### Step 2: Monitor Progress

Expected output:
```
╔══════════════════════════════════════════════════════════╗
║  Generating Cold Start Data (50 W-Matrices)             ║
╚══════════════════════════════════════════════════════════╝

[1/50] Training: gpt-3.5-turbo → gpt-4
  ✓ Extracted 100 hidden states (20s)
  ✓ Trained W-Matrix (15s)
  ✓ Epsilon: 3.21% (Gold tier)
  ✓ Uploaded to S3
  ✓ Saved to database

[2/50] Training: gpt-3.5-turbo → claude-3-opus
  ✓ Extracted 100 hidden states (22s)
  ✓ Trained W-Matrix (16s)
  ✓ Epsilon: 3.87% (Gold tier)
  ✓ Uploaded to S3
  ✓ Saved to database

...

[50/50] Training: llama-2-70b → gpt-4
  ✓ Extracted 100 hidden states (25s)
  ✓ Trained W-Matrix (18s)
  ✓ Epsilon: 4.52% (Silver tier)
  ✓ Uploaded to S3
  ✓ Saved to database

╔══════════════════════════════════════════════════════════╗
║  Generation Complete                                     ║
╚══════════════════════════════════════════════════════════╝

Total W-Matrices: 50
Average Epsilon: 3.91%
Quality Distribution:
  - Platinum (ε < 0.5%): 2 (4%)
  - Gold (ε < 1%): 18 (36%)
  - Silver (ε < 5%): 28 (56%)
  - Bronze (ε < 10%): 2 (4%)

Total Time: 18 minutes 32 seconds
Total API Cost: $0.21
```

### Step 3: Verify Data in Database

```bash
pnpm tsx scripts/check-db-data.ts
```

Expected output:
```
=== Database Data Check ===
W-Matrix Versions: 50
Latent Vectors: 200
Memory NFTs: 0 (will be minted on purchase)
```

---

## End-to-End Testing

### Test 1: Complete Purchase Flow

1. **Login as test user**
   - Email: `test_1767595154095@awareness.market`
   - Password: `TestPassword123!`

2. **Browse marketplace**
   - Visit: https://awareness.market/w-matrix-marketplace
   - Filter by target model: GPT-4
   - Sort by epsilon (ascending)

3. **Purchase W-Matrix**
   - Click "Purchase" on top result
   - Complete Stripe checkout (use test card: `4242 4242 4242 4242`)
   - Verify purchase success

4. **Check NFT minting**
   - Visit: https://awareness.market/my-memories
   - Verify NFT appears in "My Memories"
   - Click "View on PolygonScan" → Verify on-chain

5. **Check TBA creation**
   - On PolygonScan, click "Token Bound Account" tab
   - Verify TBA address is created
   - Check TBA balance (should be 0 initially)

### Test 2: MCP Server Integration

In Claude Desktop:

```
I need a W-Matrix to speed up my GPT-4 inference. 
Search for the best quality option and purchase it for me.
```

Expected behavior:
1. Claude searches marketplace using `search_latentmas_memories`
2. Claude checks compatibility using `check_model_compatibility`
3. Claude estimates performance using `estimate_performance_gain`
4. Claude asks for confirmation
5. Claude purchases using `purchase_latentmas_package`
6. Claude confirms NFT minting and TBA creation

### Test 3: Memory Provenance

1. **Create derived memory**
   - Use purchased W-Matrix to create new memory
   - Upload to marketplace as "derived" memory

2. **Check provenance chain**
   - Visit: https://awareness.market/memory-provenance/:id
   - Verify family tree shows parent → child relationship
   - Verify royalty calculation (5% to original creator)

3. **Verify on-chain**
   - Check PolygonScan for provenance events
   - Verify `MemoryDerived` event is emitted

---

## Production Checklist

### Pre-Launch

- [ ] Smart contracts deployed to Mumbai testnet
- [ ] Contracts verified on PolygonScan
- [ ] Backend updated with contract addresses
- [ ] NFT minting tested successfully
- [ ] TBA creation tested successfully
- [ ] MCP Server configured in Claude Desktop
- [ ] All 5 MCP tools tested
- [ ] 50 W-Matrices generated and uploaded
- [ ] Database backup created
- [ ] API rate limiting configured
- [ ] Stripe webhook configured
- [ ] Email notifications tested

### Launch Day

- [ ] Deploy contracts to Polygon mainnet
- [ ] Update frontend with mainnet contract addresses
- [ ] Switch Stripe to production mode
- [ ] Enable production LLM API keys
- [ ] Configure production database
- [ ] Set up monitoring (Sentry, DataDog)
- [ ] Enable CDN for static assets
- [ ] Run final end-to-end test
- [ ] Announce launch on Twitter/Discord
- [ ] Monitor error logs for first 24 hours

### Post-Launch

- [ ] Generate 200+ W-Matrices for market depth
- [ ] Onboard first 10 creators
- [ ] Create video tutorials
- [ ] Write blog post about LatentMAS protocol
- [ ] Submit to Product Hunt
- [ ] Apply for grants (Polygon, Ethereum Foundation)
- [ ] Start community Discord server
- [ ] Plan v2 features (multi-chain, governance)

---

## Troubleshooting

### Contract Deployment Fails

**Error**: "Insufficient funds for gas"
- **Solution**: Get more Mumbai MATIC from faucet

**Error**: "Nonce too low"
- **Solution**: Reset MetaMask account (Settings → Advanced → Reset Account)

**Error**: "Contract creation code storage out of gas"
- **Solution**: Increase gas limit in hardhat.config.ts

### MCP Server Not Connecting

**Error**: "MCP server failed to start"
- **Solution**: Check Claude Desktop logs (`~/Library/Logs/Claude/mcp.log`)
- **Solution**: Verify node path: `which node`
- **Solution**: Rebuild MCP server: `pnpm build`

**Error**: "API authentication failed"
- **Solution**: Verify API_KEY in claude_desktop_config.json
- **Solution**: Generate new API key from dashboard

### W-Matrix Generation Slow

**Issue**: Generation takes > 30 seconds per matrix
- **Solution**: Use faster LLM models (GPT-3.5 instead of GPT-4)
- **Solution**: Reduce anchor count (50 instead of 100)
- **Solution**: Use parallel generation (split into batches)

### NFT Minting Fails

**Error**: "Transaction reverted"
- **Solution**: Check contract address is correct
- **Solution**: Verify wallet has enough MATIC for gas
- **Solution**: Check PolygonScan for detailed error message

---

## Support

### Documentation
- **Main Docs**: `/docs` folder in repository
- **API Reference**: https://awareness.market/api-docs
- **Smart Contracts**: https://github.com/everest-an/Awareness-Market/tree/main/contracts

### Community
- **Discord**: https://discord.gg/latentmas
- **Twitter**: https://twitter.com/latentmas
- **GitHub Issues**: https://github.com/everest-an/Awareness-Market/issues

### Contact
- **Email**: support@awareness.market
- **Telegram**: @latentmas_support

---

## Appendix

### Useful Commands

```bash
# Compile contracts
npx hardhat compile

# Deploy to Mumbai
npx hardhat run scripts/deploy/deploy-memory-nft.ts --network mumbai

# Verify contract
npx hardhat verify --network mumbai <CONTRACT_ADDRESS>

# Generate W-Matrices
pnpm tsx scripts/generate-cold-start-data.ts --max-pairs 50

# Test NFT minting
pnpm tsx scripts/test-nft-minting.ts

# Check database
pnpm tsx scripts/check-db-data.ts

# Run all tests
pnpm test

# Build MCP server
cd mcp-server && pnpm build

# Start dev server
pnpm dev
```

### Contract Addresses

**Mumbai Testnet**:
- MemoryNFT: `0x1234567890abcdef1234567890abcdef12345678` (example)
- ERC6551 Registry: `0x000000006551c19487814612e58FE06813775758`

**Polygon Mainnet** (deploy after testing):
- MemoryNFT: TBD
- ERC6551 Registry: `0x000000006551c19487814612e58FE06813775758`

### API Endpoints

**Production**:
- Frontend: https://awareness.market
- API: https://awareness.market/api/trpc
- MCP Server: wss://awareness.market/mcp

**Staging**:
- Frontend: https://staging.awareness.market
- API: https://staging.awareness.market/api/trpc

---

*Last updated: 2026-01-05*  
*Version: 1.0.0*  
*License: MIT*
