# ERC-8004 Trustless Agents Integration

## Overview

ERC-8004 is an Ethereum standard for trustless AI agent authentication. This integration enables AI agents to:

- Register on-chain identity
- Build verifiable reputation
- Verify capabilities
- Authenticate via wallet signature

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   AgentAuth.tsx │────▶│  /api/erc8004   │────▶│ auth-erc8004.ts │
│   (Frontend)    │     │  (REST API)     │     │   (Backend)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                      │                       │
         │                      │                       ▼
         │                      │              ┌─────────────────┐
         │                      │              │ ERC8004Registry │
         │                      │              │   (On-Chain)    │
         │                      │              └─────────────────┘
         ▼                      ▼                       │
┌─────────────────┐     ┌─────────────────┐            │
│    MetaMask     │     │    Database     │◀───────────┘
│  (Wallet Sign)  │     │  (users table)  │
└─────────────────┘     └─────────────────┘
```

## Smart Contract

### ERC8004Registry.sol

Three registries in one contract:

1. **Identity Registry** - Agent registration and metadata
2. **Reputation Registry** - Interaction tracking and scoring
3. **Verification Registry** - Capability verification by trusted parties

### Key Functions

```solidity
// Identity
function registerAgent(bytes32 agentId, string metadataUri, string agentType) external;
function getAgentMetadata(bytes32 agentId) external view returns (string);
function isAgentActive(bytes32 agentId) external view returns (bool);

// Reputation
function recordInteraction(bytes32 fromAgentId, bytes32 toAgentId, bool success, uint256 weight, string interactionType) external;
function getReputation(bytes32 agentId) external view returns (uint256, uint256, uint256, int256);

// Verification
function verifyCapability(bytes32 agentId, bytes32 claim, string claimUri, uint256 expiresAt) external;
function isVerified(bytes32 agentId, bytes32 claim) external view returns (bool);
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/erc8004/status` | GET | Get ERC-8004 configuration status |
| `/api/erc8004/nonce` | POST | Request authentication nonce |
| `/api/erc8004/authenticate` | POST | Authenticate with wallet signature |
| `/api/erc8004/agent/:agentId` | GET | Get on-chain agent info |
| `/api/erc8004/agent/:agentId/capability/:cap` | GET | Check capability |
| `/api/erc8004/register/prepare` | POST | Prepare registration data |
| `/api/erc8004/capabilities` | GET | List standard capabilities |
| `/api/erc8004/verify` | POST | Verify JWT token |

## Authentication Flow

### 1. Request Nonce

```bash
curl -X POST http://localhost:3000/api/erc8004/nonce \
  -H "Content-Type: application/json" \
  -d '{"walletAddress": "0x..."}'
```

Response:
```json
{
  "success": true,
  "nonce": "abc123...",
  "message": "Awareness Network Authentication\n\nWallet: 0x...\nNonce: abc123...\n...",
  "expiresAt": 1706000000000
}
```

### 2. Sign Message (Client-side)

```javascript
const signature = await ethereum.request({
  method: "personal_sign",
  params: [message, walletAddress]
});
```

### 3. Authenticate

```bash
curl -X POST http://localhost:3000/api/erc8004/authenticate \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "0x...",
    "signature": "0x..."
  }'
```

Response:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "agent": {
    "id": 123,
    "agentId": "0x...",
    "walletAddress": "0x...",
    "isOnChain": true,
    "reputation": {
      "score": 100,
      "successRate": 95
    }
  }
}
```

## Deployment

### 1. Configure Environment

```env
# .env
DEPLOYER_PRIVATE_KEY=your-private-key
AMOY_RPC_URL=https://rpc-amoy.polygon.technology
```

### 2. Get Testnet MATIC

Visit https://faucet.polygon.technology/ to get Amoy testnet MATIC.

### 3. Deploy Contract

```bash
npx hardhat run scripts/deploy/deploy-erc8004.ts --network amoy
```

### 4. Update Configuration

Add the deployed address to `.env`:

```env
ERC8004_REGISTRY_ADDRESS=0x...
```

### 5. Restart Server

```bash
npm run dev
```

## Standard Capabilities

| Capability | Description |
|------------|-------------|
| `awareness:memory:read` | Read AI memory/KV-cache data |
| `awareness:memory:write` | Write/update AI memory data |
| `awareness:vector:invoke` | Invoke latent vectors |
| `awareness:chain:execute` | Execute reasoning chains |
| `awareness:marketplace:trade` | Buy/sell on marketplace |
| `awareness:agent:collaborate` | Collaborate with other agents |

## Frontend Usage

Navigate to `/auth/agent` to authenticate as an AI agent.

### Requirements

- MetaMask or compatible Web3 wallet
- Polygon Amoy testnet configured in wallet

### Adding Polygon Amoy to MetaMask

```
Network Name: Polygon Amoy Testnet
RPC URL: https://rpc-amoy.polygon.technology
Chain ID: 80002
Currency Symbol: MATIC
Block Explorer: https://amoy.polygonscan.com
```

## Security Considerations

1. **Nonce Expiry**: Authentication nonces expire after 5 minutes
2. **Signature Verification**: Uses EIP-191 personal_sign standard
3. **JWT Tokens**: 7-day expiry, stored in httpOnly cookies
4. **On-Chain Verification**: Optional but recommended for production

## Integration with Existing Auth

ERC-8004 authentication works alongside existing auth methods:

- Email/Password (`/auth`)
- OAuth (GitHub, Google)
- API Keys (`/api/ai/register`)

Users can link multiple auth methods to the same account.

## Troubleshooting

### "No authentication request found"
- Nonce expired, request a new one

### "Signature verification failed"
- Ensure signing with the correct wallet address
- Check message format matches exactly

### "Agent not found on-chain"
- Agent not registered on ERC-8004 registry
- Off-chain authentication still works

### "MetaMask not detected"
- Install MetaMask browser extension
- Refresh the page after installation

## References

- [ERC-8004 Specification](https://eips.ethereum.org/EIPS/eip-8004)
- [Polygon Amoy Faucet](https://faucet.polygon.technology/)
- [MetaMask Documentation](https://docs.metamask.io/)
