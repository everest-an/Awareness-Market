# Deployed Smart Contracts

## Network: Avalanche C-Chain (Chain ID: 43114)

### StablecoinPaymentSystem
- **Address**: `0xbAEea6B8b53272c4624df53B954ed8c72Fd25dD8`
- **Explorer**: https://snowscan.com/address/0xbAEea6B8b53272c4624df53B954ed8c72Fd25dD8
- **Platform Fee**: 5% (500 basis points)
- **Platform Treasury**: `0x3d0ab53241A2913D7939ae02f7083169fE7b823B`

#### Supported Stablecoins
| Token | Address |
|-------|---------|
| USDC  | `0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E` |
| USDT  | `0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7` |

#### Key Functions
- `deposit(token, amount)` - Deposit stablecoins
- `directPurchase(packageId, packageType, token, priceUSD, seller)` - One-step purchase
- `purchasePackage(packageId, packageType, token, priceUSD, seller)` - Purchase with balance
- `withdraw(token, amount)` - Withdraw stablecoins
- `getBalance(user, token)` - Check balance

---

### ERC8004Registry (AI Agent Registry)
- **Address**: `0x1Ae90F59731e16b548E34f81F0054e96DdACFc28`
- **Explorer**: https://snowscan.com/address/0x1Ae90F59731e16b548E34f81F0054e96DdACFc28
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
# Avalanche C-Chain Contracts
STABLECOIN_CONTRACT_ADDRESS=0xbAEea6B8b53272c4624df53B954ed8c72Fd25dD8
ERC8004_REGISTRY_ADDRESS=0x1Ae90F59731e16b548E34f81F0054e96DdACFc28
PLATFORM_TREASURY_ADDRESS=0x3d0ab53241A2913D7939ae02f7083169fE7b823B

# Network
BLOCKCHAIN_NETWORK=avalanche
BLOCKCHAIN_RPC_URL=https://avalanche-rpc.com
```

## Deployment Date
- **Date**: 2026-02-01
- **Deployer**: Owner wallet
