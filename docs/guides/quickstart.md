# LatentMAS Marketplace - Quick Start Guide

**Get started in 5 minutes** ⚡

---

## What is LatentMAS Marketplace?

The world's first decentralized marketplace for AI latent space vectors and reasoning chains. Enable direct mind-to-mind collaboration between AI agents with:

- **95% bandwidth savings** through KV-Cache compression
- **45% TTFT reduction** via W-Matrix transformations
- **On-chain ownership** with ERC-721 NFTs + ERC-6551 TBAs
- **AI agent integration** through MCP Server

---

## Quick Links

- 🌐 **Live Demo**: https://awareness.market
- 📚 **Full Docs**: `/docs` folder
- 🔗 **GitHub**: https://github.com/everest-an/Awareness-Market
- 💬 **Discord**: https://discord.gg/latentmas

---

## For Users: Browse & Purchase

### 1. Create Account

Visit https://awareness.market/auth and register with email:

```
Email: your@email.com
Password: YourSecurePassword123!
```

### 2. Browse Marketplace

**W-Matrix Marketplace**: https://awareness.market/w-matrix-marketplace

Filter by:
- Source model (e.g., GPT-3.5)
- Target model (e.g., GPT-4)
- Quality tier (Platinum/Gold/Silver)
- Price range

### 3. Purchase W-Matrix

1. Click "View Details" on any listing
2. Review performance metrics (epsilon, TTFT reduction)
3. Click "Purchase" → Complete Stripe checkout
4. Download W-Matrix package (JSON file)

### 4. Use W-Matrix

```python
import json
import numpy as np

# Load W-Matrix
with open('wmatrix-gpt35-to-gpt4.json') as f:
    wmatrix = json.load(f)

# Transform KV-Cache
def transform_kv_cache(source_kv, wmatrix):
    W = np.array(wmatrix['weights'])
    b = np.array(wmatrix['biases'])
    return source_kv @ W.T + b

# Use in your application
source_kv = get_kv_cache_from_gpt35(prompt)
target_kv = transform_kv_cache(source_kv, wmatrix)
response = gpt4_with_kv_cache(target_kv)  # 45% faster!
```

---

## For Developers: Deploy & Extend

### 1. Clone Repository

```bash
git clone https://github.com/everest-an/Awareness-Market.git
cd Awareness-Market
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Configure Environment

Create `.env.local`:

```bash
# Database
DATABASE_URL=your_postgresql_connection_string

# Authentication
JWT_SECRET=your_jwt_secret

# LLM APIs
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key

# Storage
S3_BUCKET=your_s3_bucket
S3_ACCESS_KEY=your_access_key
S3_SECRET_KEY=your_secret_key
```

### 4. Run Development Server

```bash
pnpm dev
```

Visit http://localhost:3000

### 5. Deploy Smart Contracts

```bash
# Get Mumbai MATIC from faucet
# https://faucet.polygon.technology/

# Configure deployer private key
echo "DEPLOYER_PRIVATE_KEY=your_private_key" >> .env.local

# Deploy MemoryNFT
npx hardhat run scripts/deploy/deploy-memory-nft.ts --network mumbai

# Verify on PolygonScan
npx hardhat verify --network mumbai <CONTRACT_ADDRESS>
```

### 6. Generate W-Matrices

```bash
# Generate 50 W-Matrices (15-20 minutes, ~$0.20 cost)
pnpm tsx scripts/generate-cold-start-data.ts --max-pairs 50
```

---

## For AI Agents: MCP Integration

### 1. Configure Claude Desktop

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "latentmas-marketplace": {
      "command": "node",
      "args": ["/path/to/mcp-server/dist/index.js"],
      "env": {
        "API_BASE_URL": "https://awareness.market",
        "API_KEY": "your_api_key"
      }
    }
  }
}
```

### 2. Restart Claude Desktop

Quit and reopen Claude Desktop. MCP server should show "Connected".

### 3. Test AI Agent

In Claude Desktop:

```
Search for W-Matrix memories compatible with GPT-4
```

Claude will automatically:
1. Search marketplace using `search_latentmas_memories`
2. Check compatibility using `check_model_compatibility`
3. Estimate performance using `estimate_performance_gain`
4. Present top 3 options with recommendations

### 4. Auto-Purchase

```
Purchase the best quality W-Matrix for GPT-3.5 → GPT-4
```

Claude will:
1. Find best option (lowest epsilon)
2. Confirm with you
3. Complete purchase using `purchase_latentmas_package`
4. Download and save W-Matrix locally

---

## Key Concepts

### W-Matrix
A transformation matrix that aligns latent spaces between two LLMs. Trained using 100+ anchor prompts and gradient descent.

**Formula**: `H_target ≈ W * H_source + b`

### KV-Cache
Key-Value cache from transformer attention layers. Can be compressed by 95% using Symmetric Focus algorithm.

### Epsilon (ε)
Alignment loss between source and target models after W-Matrix transformation. Lower is better.

- **Platinum**: ε < 0.5% (rare, expensive)
- **Gold**: ε < 1% (high quality)
- **Silver**: ε < 5% (paper baseline)
- **Bronze**: ε < 10% (acceptable)

### Token Bound Account (TBA)
ERC-6551 smart contract wallet owned by an NFT. Enables autonomous asset management.

### Memory Provenance
Derivation chain tracking parent → child relationships. Enables automatic royalty distribution.

---

## Common Use Cases

### 1. Reduce Inference Costs

**Problem**: GPT-4 is expensive ($0.03/1K tokens)  
**Solution**: Use GPT-3.5 + W-Matrix → GPT-4 transformation  
**Savings**: 70% cost reduction ($0.009/1K tokens)

### 2. Speed Up TTFT

**Problem**: GPT-4 has 2.3s Time-To-First-Token  
**Solution**: Use compressed KV-Cache from GPT-3.5  
**Improvement**: 45% faster (1.27s TTFT)

### 3. Multi-Model Pipelines

**Problem**: Need to switch between models mid-conversation  
**Solution**: Use W-Matrix to transfer context seamlessly  
**Benefit**: No context loss, smooth transitions

### 4. AI Agent Collaboration

**Problem**: Different agents use different models  
**Solution**: Share latent space vectors via marketplace  
**Benefit**: Direct mind-to-mind communication

---

## Troubleshooting

### "Cannot connect to database"
- Check `DATABASE_URL` in `.env.local`
- Verify database is running
- Test connection: `pnpm tsx scripts/check-db-data.ts`

### "LLM API key invalid"
- Verify `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`
- Check API key permissions
- Test: `curl https://api.openai.com/v1/models -H "Authorization: Bearer $OPENAI_API_KEY"`

### "Smart contract deployment fails"
- Get Mumbai MATIC from faucet
- Check `DEPLOYER_PRIVATE_KEY` is correct
- Verify RPC endpoint: `curl https://rpc-mumbai.maticvigil.com`

### "MCP Server not connecting"
- Check Claude Desktop logs: `~/Library/Logs/Claude/mcp.log`
- Verify node path: `which node`
- Rebuild MCP server: `cd mcp-server && pnpm build`

---

## Next Steps

### Learn More
- 📖 **Architecture**: Read `/docs/ARCHITECTURE.md`
- 🧪 **Protocol**: Read `/docs/LATENTMAS_PROTOCOL.md`
- 🚀 **Deploy**: Read `/docs/DEPLOYMENT_COMPLETE_GUIDE.md`

### Join Community
- 💬 **Discord**: https://discord.gg/latentmas
- 🐦 **Twitter**: https://twitter.com/latentmas
- 📧 **Email**: support@awareness.market

### Contribute
- 🐛 **Report bugs**: GitHub Issues
- 💡 **Suggest features**: GitHub Discussions
- 🔧 **Submit PRs**: Fork → Branch → PR

---

## Support

**Need help?**
- Check `/docs` folder for detailed guides
- Visit https://awareness.market/docs
- Join Discord: https://discord.gg/latentmas
- Email: support@awareness.market

**Found a bug?**
- Open GitHub Issue: https://github.com/everest-an/Awareness-Market/issues
- Include: OS, Node version, error message, steps to reproduce

---

## License

MIT License - See LICENSE file for details

---

*Built with ❤️ by the LatentMAS community*  
*Powered by LatentMAS research paper*  
*Version 1.0.0 | Last updated: 2026-01-05*
