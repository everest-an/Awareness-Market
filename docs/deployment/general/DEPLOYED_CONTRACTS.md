# Deployed Smart Contracts

## Network: Polygon Mainnet (Chain ID: 137)

### StablecoinPaymentSystem
- **Address**: `0xbAEea6B8b53272c4624df53B954ed8c72Fd25dD8`
- **Explorer**: https://polygonscan.com/address/0xbAEea6B8b53272c4624df53B954ed8c72Fd25dD8
- **Platform Fee**: 5% (500 basis points)
- **Platform Treasury**: `0x3d0ab53241A2913D7939ae02f7083169fE7b823B`

#### Supported Stablecoins
| Token | Address |
|-------|---------|
| USDC  | `0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359` |
| USDT  | `0xc2132D05D31c914a87C6611C10748AEb04B58e8F` |

#### Key Functions
- `deposit(token, amount)` - Deposit stablecoins
- `directPurchase(packageId, packageType, token, priceUSD, seller)` - One-step purchase
- `purchasePackage(packageId, packageType, token, priceUSD, seller)` - Purchase with balance
- `withdraw(token, amount)` - Withdraw stablecoins
- `getBalance(user, token)` - Check balance

---

### ERC8004Registry (AI Agent Registry)
- **Address**: `0x1Ae90F59731e16b548E34f81F0054e96DdACFc28`
- **Explorer**: https://polygonscan.com/address/0x1Ae90F59731e16b548E34f81F0054e96DdACFc28
- **Standard**: ERC-8004 Trustless Agents

#### Key Functions
- `registerAgent(agentId, metadataUri, agentType)` - Register AI agent
- `recordInteraction(fromAgentId, toAgentId, success, weight, interactionType)` - Record interaction
- `verifyCapability(agentId, claim, claimUri, expiresAt)` - Verify agent capability
- `getReputation(agentId)` - Get agent reputation

---

## Environment Variables

Add to your `.env` file:

```bash
# Polygon Mainnet Contracts
STABLECOIN_CONTRACT_ADDRESS=0xbAEea6B8b53272c4624df53B954ed8c72Fd25dD8
ERC8004_REGISTRY_ADDRESS=0x1Ae90F59731e16b548E34f81F0054e96DdACFc28
PLATFORM_TREASURY_ADDRESS=0x3d0ab53241A2913D7939ae02f7083169fE7b823B

# Network
BLOCKCHAIN_NETWORK=polygon
BLOCKCHAIN_RPC_URL=https://polygon-rpc.com
```

## Deployment Date
- **Date**: 2026-02-01
- **Deployer**: Owner wallet
