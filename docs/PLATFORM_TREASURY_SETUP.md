# Platform Treasury Address Setup Guide

## ⚠️ Critical Security Issue

**Current Platform Treasury Address**: `0x3d0ab53241A2913D7939ae02f7083169fE7b823B`

### Unknown Origin
- This address was hardcoded in deployment scripts on 2026-02-01
- No documentation exists about who controls this address
- **If you don't control this address, ALL platform revenue will be lost!**

---

## 🔍 Step 1: Verify Address Ownership

### Check if you control this address:

```bash
# 1. Check Snowscan for transaction history
https://snowscan.com/address/0x3d0ab53241A2913D7939ae02f7083169fE7b823B

# 2. Check your wallets:
# - MetaMask
# - Ledger Hardware Wallet
# - Trust Wallet
# - Any exchange accounts

# 3. Try sending a small transaction (0.001 POL) from this address
# If you can send, you control it ✅
# If you cannot send, you DON'T control it ❌
```

---

## 🛠️ Step 2: Replace with Your Address (If Needed)

### A. Generate a New Secure Wallet

**Option 1: Hardware Wallet (Most Secure)**
```bash
# Recommended: Ledger or Trezor
# 1. Purchase hardware wallet from official store
# 2. Initialize with 24-word seed phrase
# 3. Connect to MetaMask
# 4. Copy your Avalanche address
```

**Option 2: MetaMask (Secure if used properly)**
```bash
# 1. Install MetaMask browser extension
# 2. Create new wallet
# 3. WRITE DOWN your seed phrase on paper (NEVER store digitally!)
# 4. Store seed phrase in a safe location (fireproof safe, bank vault)
# 5. Switch to Avalanche network
# 6. Copy your address (starts with 0x...)
```

### B. Update Configuration

```bash
# 1. Update .env file
nano .env

# 2. Replace the address
PLATFORM_TREASURY_ADDRESS=0xYOUR_NEW_ADDRESS_HERE
MAINTAINER_POOL_ADDRESS=0xYOUR_NEW_ADDRESS_HERE

# 3. Save and exit (Ctrl+X, Y, Enter)
```

### C. Update Deployed Contracts

**⚠️ Critical**: You need to update the treasury address in ALREADY DEPLOYED contracts!

```bash
# StablecoinPaymentSystem (Already deployed)
# You need to call updateTreasury() function

# Use Hardhat console:
pnpm hardhat console --network avalanche

# In console:
const contract = await ethers.getContractAt(
  "StablecoinPaymentSystem",
  "0xbAEea6B8b53272c4624df53B954ed8c72Fd25dD8"
);

await contract.updateTreasury("0xYOUR_NEW_ADDRESS");
```

---

## 💰 Step 3: Verify Revenue Flow

### Check Platform Revenue

```bash
# 1. View balance on Snowscan
https://snowscan.com/address/0xYOUR_NEW_ADDRESS

# 2. Check USDC balance
https://snowscan.com/token/0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E?a=0xYOUR_NEW_ADDRESS

# 3. Check USDT balance
https://snowscan.com/token/0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7?a=0xYOUR_NEW_ADDRESS
```

---

## 🔐 Security Best Practices

### DO ✅
- Use a hardware wallet for production treasury
- Store seed phrases offline in multiple secure locations
- Enable 2FA on all accounts
- Use a dedicated wallet only for platform treasury
- Regularly withdraw funds to cold storage
- Monitor incoming transactions daily

### DON'T ❌
- Store private keys digitally (email, cloud, screenshots)
- Share seed phrases with anyone (including team members)
- Use the same wallet for personal and business funds
- Leave large amounts in hot wallets
- Use browser extension wallets for large sums

---

## 📊 Expected Revenue Streams

Your platform treasury will receive:

| Source | Fee Rate | Description |
|--------|----------|-------------|
| **StablecoinPaymentSystem** | 5% | Every USDC/USDT purchase |
| **AMEMToken** | 0.5% | 50% of 1% transaction fee |
| **AgentCreditSystem** | 15% | Agent API purchases |
| **MemoryNFT** | 5-10% | Minting + secondary sales |

**Estimated Monthly Revenue** (with $100k volume):
- Stablecoin: $5,000
- $AMEM: $5,000
- Agent Credit: $3,000
- NFT: $4,700
- **Total: ~$17,700/month**

---

## 🚨 Emergency Actions

### If You Discover the Current Address is NOT Yours:

1. **STOP ALL DEPLOYMENTS** immediately
2. **DO NOT deploy remaining contracts** (MemoryNFT, AMEMToken, AgentCreditSystem)
3. **Update StablecoinPaymentSystem** treasury address NOW
4. **Create new secure wallet**
5. **Notify users** if any revenue was lost

### Recovery Steps:

```bash
# 1. Update deployed contract treasury
pnpm hardhat console --network avalanche

const StablecoinPayment = await ethers.getContractAt(
  "StablecoinPaymentSystem",
  "0xbAEea6B8b53272c4624df53B954ed8c72Fd25dD8"
);

// Update to YOUR address
await StablecoinPayment.updateTreasury("0xYOUR_SECURE_ADDRESS");

# 2. Verify change
const newTreasury = await StablecoinPayment.platformTreasury();
console.log("New treasury:", newTreasury);
```

---

## 📝 Checklist Before Production

- [ ] I control the private key for the treasury address
- [ ] I have backed up the seed phrase securely (offline, multiple locations)
- [ ] I can send a test transaction from this address
- [ ] I have updated .env with my address
- [ ] I have verified the address on Snowscan
- [ ] I have enabled 2FA on my wallet provider
- [ ] I have set up transaction monitoring/alerts
- [ ] I have a plan for regular fund withdrawals to cold storage

---

## 🆘 Need Help?

If you're unsure about any of these steps:

1. **DO NOT proceed with deployment**
2. Consult with a blockchain security expert
3. Consider using a multi-sig wallet (Gnosis Safe) for added security
4. Review your organization's crypto custody policies

**Remember**: Once funds are sent to an address you don't control, they are PERMANENTLY LOST. Take the time to set this up correctly.
