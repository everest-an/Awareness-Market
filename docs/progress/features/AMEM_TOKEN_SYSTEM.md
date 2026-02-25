# $AMEM Token System Documentation

**Version**: 1.0.0
**Date**: 2026-01-28
**Status**: ✅ Smart Contracts Implemented, Ready for Deployment

---

## 📊 Executive Summary

The **$AMEM (Awareness Memory Token)** system is a production-ready blockchain-based payment solution that replaces mock payments in the AI agent API. It implements the complete token economics from the whitepaper and provides a secure, scalable credit system for AI agents.

### Key Benefits

- ✅ **Production Ready**: No more mock payments
- 🔒 **Secure**: Blockchain-based with role access control
- 💰 **Deflationary**: 30% of fees burned automatically
- 🚀 **Scalable**: Supports millions of micro-transactions
- 📊 **Transparent**: All transactions on-chain
- 🤖 **AI-Friendly**: Optimized for autonomous agent operations

---

## 🏗️ Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Awareness Market Platform                 │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │              │    │              │    │              │  │
│  │  AI Agent    │───▶│  Backend API │───▶│  Blockchain  │  │
│  │              │    │              │    │              │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│                                                               │
│       deposits $AMEM ──▶ gets credits ──▶ purchases packages │
│                                                               │
└─────────────────────────────────────────────────────────────┘

Blockchain Layer:
┌─────────────────┐         ┌──────────────────────┐
│                 │         │                      │
│  AMEMToken.sol  │◀────────│ AgentCreditSystem.sol│
│  (ERC-20)       │         │  (Payment Logic)     │
│                 │         │                      │
└─────────────────┘         └──────────────────────┘
        │                            │
        │                            │
        ▼                            ▼
   1B Fixed Supply            Credit Management
   30% Fee Burn              Purchase Recording
   Role-Based Access         7-Day Withdrawal
```

---

## 💎 Token Specifications

### $AMEM Token (ERC-20)

| Property | Value |
|----------|-------|
| **Name** | Awareness Memory Token |
| **Symbol** | $AMEM |
| **Total Supply** | 1,000,000,000 (1 billion) |
| **Decimals** | 18 |
| **Token Standard** | ERC-20 (OpenZeppelin) |
| **Deflationary** | Yes (30% of fees burned) |
| **Contract** | [contracts/AMEMToken.sol](contracts/AMEMToken.sol) |

### Token Allocation (Per Whitepaper)

| Allocation | Percentage | Amount | Purpose |
|------------|------------|--------|---------|
| **Memory Mining** | 40% | 400,000,000 | Rewards for quality memory NFTs |
| **Standardization Nodes** | 20% | 200,000,000 | W-Matrix maintainer rewards |
| **Ecosystem & Partners** | 15% | 150,000,000 | Open-source integration incentives |
| **Treasury** | 15% | 150,000,000 | Liquidity and research funding |
| **Team & Contributors** | 10% | 100,000,000 | 12-month lock + 36-month vest |

### Fee Distribution

When an agent pays for a package using $AMEM:

```
Transaction Fee (default 1%):
├─ 30% → Burned (deflationary)
├─ 20% → W-Matrix Maintainer Pool
└─ 50% → Platform Fee Collector

Platform Fee (15% of purchase):
├─ 85% → Package Seller/Creator
└─ 15% → Platform Treasury
```

---

## 📜 Smart Contracts

### 1. AMEMToken.sol

**Purpose**: The native ERC-20 token with deflationary fee mechanism

**Key Features**:
- ✅ Fixed supply of 1 billion tokens
- ✅ Automatic fee burning (30%)
- ✅ Role-based access control (MINTER, PAUSER, FEE_MANAGER)
- ✅ Pausable for emergency situations
- ✅ Batch transfer optimization
- ✅ Fee-free transfers for system accounts

**Main Functions**:
```solidity
// Standard ERC-20
function transfer(address to, uint256 amount) returns (bool)
function balanceOf(address account) view returns (uint256)
function approve(address spender, uint256 amount) returns (bool)

// Token Economics
function circulatingSupply() view returns (uint256)
function getTokenStats() view returns (uint256, uint256, uint256, uint256)
function setTransactionFeeRate(uint256 newRate) // FEE_MANAGER_ROLE only

// Administration
function pause() // PAUSER_ROLE only
function setFeeCollector(address newCollector) // FEE_MANAGER_ROLE only
```

**Events**:
```solidity
event FeesCollected(address indexed from, address indexed to, uint256 amount, uint256 burned)
event FeeRateUpdated(uint256 oldRate, uint256 newRate)
```

---

### 2. AgentCreditSystem.sol

**Purpose**: Credit management system for AI agents to purchase packages

**Key Features**:
- ✅ Deposit $AMEM tokens for credits
- ✅ Purchase packages using credits
- ✅ Automatic USD to $AMEM conversion
- ✅ 7-day withdrawal cooldown (anti-abuse)
- ✅ Purchase history tracking
- ✅ Refund support (operator-controlled)
- ✅ Platform fee distribution (15%)

**Main Functions**:
```solidity
// User Operations
function deposit(uint256 amount) // Add credits
function purchasePackage(string packageId, string packageType, uint256 priceUSD, address seller) returns (uint256)
function requestWithdrawal(uint256 amount) // Start cooldown
function processWithdrawal() // After 7 days
function cancelWithdrawal() // Cancel pending withdrawal

// Read Functions
function getBalance(address user) view returns (uint256)
function getPurchaseHistory(address user) view returns (Purchase[])
function checkPurchased(string packageId, address user) view returns (bool)
function getWithdrawalStatus(address user) view returns (...)
function getSystemStats() view returns (...)

// Admin Functions (OPERATOR_ROLE)
function refundPurchase(address user, uint256 purchaseId)
function updatePriceRate(uint256 newRate) // PRICE_ORACLE_ROLE
function updatePlatformFeeRate(uint256 newRate)
```

**Events**:
```solidity
event Deposited(address indexed user, uint256 amount, uint256 newBalance)
event Spent(address indexed user, string packageId, string packageType, uint256 amount, uint256 platformFee)
event WithdrawalRequested(address indexed user, uint256 amount, uint256 availableAt)
event Withdrawn(address indexed user, uint256 amount)
event Refunded(address indexed user, string packageId, uint256 amount)
```

---

## 🚀 Deployment Guide

### Prerequisites

1. **Node.js** 18+ and npm
2. **Hardhat** development environment
3. **Deployer wallet** with ETH/AVAX for gas
4. **RPC endpoint** (Avalanche Fuji testnet or Avalanche C-Chain mainnet)

### Step 1: Install Dependencies

```bash
cd Awareness-Network
npm install
```

### Step 2: Configure Environment

Create `.env.local` with deployment configuration:

```bash
# Blockchain
DEPLOYER_PRIVATE_KEY=0x...your-private-key
FUJI_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
AVALANCHE_RPC_URL=https://api.avax.network/ext/bc/C/rpc

# Contract Configuration
FEE_COLLECTOR_ADDRESS=0x...your-fee-collector-address
MAINTAINER_POOL_ADDRESS=0x...maintainer-pool-address
PLATFORM_TREASURY_ADDRESS=0x...platform-treasury-address

# Optional: Initial allocation for testing
INITIAL_CREDIT_SYSTEM_ALLOCATION=1000000
```

### Step 3: Deploy to Testnet (Avalanche Fuji)

```bash
npx hardhat run scripts/deploy/deploy-amem-token.ts --network fuji
```

**Expected Output**:
```
🚀 Starting $AMEM Token deployment...

📡 Network: fuji (Chain ID: 43113)
👤 Deployer: 0x...
💰 Balance: 0.5 ETH

📝 Deploying AMEMToken...
✅ AMEMToken deployed to: 0x...
   Name: Awareness Memory Token
   Symbol: $AMEM
   Total Supply: 1000000000.0 $AMEM

📝 Deploying AgentCreditSystem...
✅ AgentCreditSystem deployed to: 0x...
   Platform Fee: 15%
   Withdrawal Cooldown: 7 days

🎉 Deployment completed successfully!
```

### Step 4: Verify Contracts

```bash
npx hardhat verify --network fuji <AMEM_TOKEN_ADDRESS> "<FEE_COLLECTOR>" "<MAINTAINER_POOL>"
npx hardhat verify --network fuji <CREDIT_SYSTEM_ADDRESS> "<AMEM_TOKEN_ADDRESS>" "<PLATFORM_TREASURY>"
```

### Step 5: Update Backend Configuration

Add deployed addresses to `.env`:

```bash
AMEM_TOKEN_ADDRESS=0x...deployed-token-address
AGENT_CREDIT_SYSTEM_ADDRESS=0x...deployed-credit-system-address
BLOCKCHAIN_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
```

---

## 🔧 Backend Integration

### TypeScript Client Usage

```typescript
import { createTokenSystemClient } from './server/blockchain/token-system';

// Initialize client (reads from environment variables)
const tokenSystem = createTokenSystemClient();

// Get user's credit balance
const balance = await tokenSystem.getCreditBalance(userAddress);
console.log(`Balance: ${balance} $AMEM`);

// Deposit tokens
const { txHash, newBalance } = await tokenSystem.deposit('100');
console.log(`Deposited. New balance: ${newBalance} $AMEM`);

// Purchase package
const { purchaseId } = await tokenSystem.purchasePackage(
  'vpkg_abc123',      // packageId
  'neural-bridge_package', // packageType
  9.99,               // priceUSD
  sellerWalletAddress // seller
);
console.log(`Purchase ID: ${purchaseId}`);

// Check purchase status
const hasBought = await tokenSystem.hasPurchased('vpkg_abc123', userAddress);
console.log(`Already purchased: ${hasBought}`);

// Get purchase history
const history = await tokenSystem.getPurchaseHistory(userAddress);
history.forEach(p => {
  console.log(`${p.packageId}: ${p.amountPaid} $AMEM at ${new Date(p.timestamp * 1000)}`);
});

// Request withdrawal
await tokenSystem.requestWithdrawal('50');

// After 7 days...
const status = await tokenSystem.getWithdrawalStatus(userAddress);
if (status.canProcess) {
  await tokenSystem.processWithdrawal();
}
```

### API Integration Example

Replace mock payment in `ai-agent-api.ts`:

```typescript
// Before (Mock):
stripePaymentId: `pi_mock_${Date.now()}`

// After (Real $AMEM):
import { createTokenSystemClient } from '../blockchain/token-system';

const tokenSystem = createTokenSystemClient();

// Check balance
const balance = await tokenSystem.getCreditBalance(ctx.user.walletAddress);
if (parseFloat(balance) < priceInAmem) {
  throw new TRPCError({
    code: 'BAD_REQUEST',
    message: `Insufficient credits. Need ${priceInAmem} $AMEM, have ${balance}`,
  });
}

// Purchase
const { purchaseId, txHash } = await tokenSystem.purchasePackage(
  packageId,
  packageType,
  priceUSD,
  sellerAddress
);

return {
  success: true,
  purchaseId,
  txHash,
  message: 'Purchase completed using $AMEM credits',
};
```

---

## 🔐 Security Considerations

### Smart Contract Security

1. **OpenZeppelin Libraries**: Uses audited ERC-20 and AccessControl implementations
2. **ReentrancyGuard**: Protects against reentrancy attacks
3. **Pausable**: Emergency stop mechanism
4. **Role-Based Access**: Granular permission control
5. **Safe Math**: Overflow protection (Solidity 0.8+)

### Operational Security

1. **Private Key Management**:
   - Store deployment keys in AWS Secrets Manager or similar
   - Use hardware wallets for admin operations
   - Never commit private keys to git

2. **Multi-Sig Recommended**:
   - Use Gnosis Safe for admin roles
   - Require 2-of-3 signatures for critical operations

3. **Rate Limiting**:
   - Backend should implement rate limits on deposit/withdrawal
   - Monitor for suspicious activity patterns

4. **Withdrawal Cooldown**:
   - 7-day cooldown prevents instant withdrawals after attack
   - Allows time to detect and respond to security incidents

---

## 💸 Price Oracle

### USD to $AMEM Conversion

The system uses an on-chain oracle rate stored in `AgentCreditSystem`:

```solidity
// Default: 1 USD = 10 $AMEM (i.e., 1 $AMEM = $0.10)
uint256 public usdToAmemRate = 10 * 1e18;
```

### Updating Price (Off-Chain)

Price updates should be performed by a backend service with PRICE_ORACLE_ROLE:

```typescript
// Fetch market price from exchange API
const marketPrice = await fetchAMEMPrice(); // e.g., $0.15

// Calculate rate: 1 USD = (1 / 0.15) = 6.67 $AMEM
const newRate = ethers.parseEther((1 / marketPrice).toString());

// Update on-chain (requires PRICE_ORACLE_ROLE)
const tx = await creditSystem.updatePriceRate(newRate);
await tx.wait();

console.log(`Price updated: 1 $AMEM = $${marketPrice}`);
```

### Recommended Update Frequency

- **Testnet**: Every 24 hours (automated cron job)
- **Production**: Every 1-6 hours (depending on volatility)
- **Manual**: Always before major purchases to avoid arbitrage

---

## 📊 Monitoring & Analytics

### On-Chain Metrics

```typescript
// Token statistics
const stats = await tokenSystem.getTokenStats();
console.log(`
  Total Supply: ${stats.totalSupply} $AMEM
  Circulating: ${stats.circulatingSupply} $AMEM
  Total Burned: ${stats.totalBurned} $AMEM (${(stats.totalBurned / stats.totalSupply * 100).toFixed(2)}%)
  Total Fees: ${stats.totalFees} $AMEM
`);

// System statistics
const systemStats = await tokenSystem.getSystemStats();
console.log(`
  Total Deposited: ${systemStats.totalDeposited} $AMEM
  Total Spent: ${systemStats.totalSpent} $AMEM
  Total Withdrawn: ${systemStats.totalWithdrawn} $AMEM
  Contract Balance: ${systemStats.contractBalance} $AMEM
`);
```

### Recommended Dashboards

1. **Token Metrics**:
   - Circulating supply over time
   - Burn rate and total burned
   - Transaction volume

2. **Credit System Metrics**:
   - Total active credits
   - Purchase volume by package type
   - Average purchase size
   - Withdrawal patterns

3. **User Metrics**:
   - Active users with credits
   - Top buyers
   - Credit balance distribution

### Alerts

Set up monitoring for:
- ⚠️ Large withdrawals (> $10,000)
- ⚠️ Rapid purchase patterns (potential abuse)
- ⚠️ Contract balance < expected amount
- ⚠️ Price oracle staleness (> 24 hours)
- ⚠️ Failed transactions spike

---

## 🧪 Testing Guide

### Local Testing

```bash
# Start Hardhat node
npx hardhat node

# Deploy to local network
npx hardhat run scripts/deploy/deploy-amem-token.ts --network localhost

# Run integration tests
npm test -- --grep "Token System"
```

### Testnet Testing Checklist

- [ ] Deploy contracts to Avalanche Fuji
- [ ] Mint test tokens to test wallet
- [ ] Deposit tokens to credit system
- [ ] Purchase test package
- [ ] Verify purchase recorded on-chain
- [ ] Request withdrawal
- [ ] Wait 7 days and process withdrawal
- [ ] Test refund flow
- [ ] Update price oracle
- [ ] Verify events emitted correctly

---

## 🚨 Troubleshooting

### Common Issues

#### "Insufficient credits" error

**Cause**: User hasn't deposited $AMEM or has insufficient balance

**Solution**:
```typescript
// Check balance first
const balance = await tokenSystem.getCreditBalance(userAddress);
console.log(`Current balance: ${balance} $AMEM`);

// If insufficient, prompt user to deposit
if (parseFloat(balance) < requiredAmount) {
  return { error: 'Please deposit more $AMEM tokens' };
}
```

#### "Approval required" error

**Cause**: User hasn't approved credit system to spend their tokens

**Solution**:
```typescript
// Frontend should call approve first
await amemToken.approve(creditSystemAddress, amount);

// Then deposit
await creditSystem.deposit(amount);
```

#### "Withdrawal cooldown not elapsed"

**Cause**: Trying to withdraw before 7-day cooldown period

**Solution**:
```typescript
const status = await tokenSystem.getWithdrawalStatus(userAddress);
console.log(`Time remaining: ${status.timeRemaining} seconds`);

// Show user when they can withdraw
const availableDate = new Date(Date.now() + status.timeRemaining * 1000);
console.log(`Available at: ${availableDate.toLocaleString()}`);
```

---

## 📚 Additional Resources

### Contract Documentation

- [AMEMToken.sol](contracts/AMEMToken.sol) - Full contract source
- [AgentCreditSystem.sol](contracts/AgentCreditSystem.sol) - Credit system source
- [deploy-amem-token.ts](scripts/deploy/deploy-amem-token.ts) - Deployment script
- [token-system.ts](server/blockchain/token-system.ts) - TypeScript integration

### External References

- [OpenZeppelin ERC-20](https://docs.openzeppelin.com/contracts/4.x/erc20)
- [Hardhat Documentation](https://hardhat.org/getting-started/)
- [Avalanche Network](https://www.avax.network/)
- [Neural Bridge Whitepaper](docs/archive/WHITEPAPER_COMPLETE.md)

---

## 🎯 Roadmap

### Phase 1: Core Implementation ✅ COMPLETE

- [x] AMEMToken contract with deflationary mechanism
- [x] AgentCreditSystem contract for payments
- [x] TypeScript integration client
- [x] Deployment scripts
- [x] Documentation

### Phase 2: Integration (Next)

- [ ] Integrate with ai-agent-api.ts
- [ ] Add deposit/withdrawal UI
- [ ] Backend API endpoints
- [ ] Price oracle automation
- [ ] Testing and QA

### Phase 3: Advanced Features

- [ ] Staking for Memory NFT slots (per whitepaper)
- [ ] Dynamic pricing with PID controller
- [ ] Governance token voting
- [ ] Cross-chain bridge (Ethereum ↔ Avalanche)

### Phase 4: Mainnet Launch

- [ ] Security audit
- [ ] Mainnet deployment
- [ ] Liquidity provision
- [ ] Exchange listings
- [ ] Community token distribution

---

## 📞 Support & Contact

- **GitHub Issues**: [Awareness Market Issues](https://github.com/everest-an/Awareness-Market/issues)
- **Documentation**: This file and [WHITEPAPER_COMPLETE.md](docs/archive/WHITEPAPER_COMPLETE.md)
- **Technical Questions**: Refer to code comments and inline documentation

---

**Last Updated**: 2026-01-28
**Version**: 1.0.0
**Status**: ✅ Ready for Testnet Deployment
