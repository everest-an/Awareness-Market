# Local Deployment Guide - MemoryNFT to Polygon Mumbai

**Status**: Ready for local deployment  
**Network**: Polygon Mumbai Testnet  
**Wallet**: `0x66794fC75C351ad9677cB00B2043868C11dfcadA`

---

## Why Local Deployment?

The Manus Sandbox environment has network restrictions that prevent direct access to blockchain RPC nodes. Therefore, smart contract deployment must be completed in your local environment.

---

## Prerequisites

✅ **Already Prepared**:
- Smart contract compiled (`MemoryNFT.sol`)
- Deployment script created (`scripts/deploy/deploy-memory-nft-v2.mjs`)
- Wallet configured (`.env.local`)
- Hardhat environment set up

⚠️ **You Need**:
- Node.js 18+ installed locally
- Mumbai MATIC in wallet `0x66794fC75C351ad9677cB00B2043868C11dfcadA`

---

## Step 1: Get Mumbai MATIC

Your wallet address: `0x66794fC75C351ad9677cB00B2043868C11dfcadA`

### Option A: Polygon Faucet (Recommended)
1. Visit https://faucet.polygon.technology/
2. Select "Mumbai" network
3. Enter your wallet address: `0x66794fC75C351ad9677cB00B2043868C11dfcadA`
4. Complete CAPTCHA
5. Click "Submit"
6. Wait 1-2 minutes for MATIC to arrive

### Option B: Alchemy Faucet
1. Visit https://mumbaifaucet.com/
2. Enter wallet address
3. Get 0.5 MATIC

### Option C: Chainlink Faucet
1. Visit https://faucets.chain.link/mumbai
2. Connect wallet or enter address
3. Get 0.1 MATIC

**Verify Balance**:
```bash
# Check balance on PolygonScan
https://mumbai.polygonscan.com/address/0x66794fC75C351ad9677cB00B2043868C11dfcadA
```

---

## Step 2: Download Project Files

Download the entire project from Manus:

```bash
# In Manus UI, click "Download All Files" button
# Or use the Code panel to download specific files
```

**Required Files**:
- `contracts/MemoryNFT.sol`
- `scripts/deploy/deploy-memory-nft-v2.mjs`
- `hardhat.config.ts`
- `.env.local` (with your private key)
- `package.json`
- `artifacts/contracts/MemoryNFT.sol/MemoryNFT.json` (compiled contract)

---

## Step 3: Install Dependencies Locally

```bash
cd latentmind-marketplace
pnpm install
# or: npm install
```

---

## Step 4: Verify Wallet Configuration

Check `.env.local` file:

```env
# Deployment Configuration
DEPLOYER_PRIVATE_KEY=0x1cc1d0830f0316a907ca7029a173939c6f283ce67d0585cb048f26f092ad1718
DEPLOYER_ADDRESS=0x66794fC75C351ad9677cB00B2043868C11dfcadA

# Polygon Mumbai RPC
MUMBAI_RPC_URL=https://rpc.ankr.com/polygon_mumbai
```

**Security Note**: This is your testnet wallet. Never use this private key for mainnet!

---

## Step 5: Deploy Contract

```bash
node scripts/deploy/deploy-memory-nft-v2.mjs
```

**Expected Output**:
```
╔══════════════════════════════════════════════════════════╗
║  Deploying MemoryNFT to Polygon Mumbai                  ║
╚══════════════════════════════════════════════════════════╝

Connecting to Mumbai RPC: https://rpc.ankr.com/polygon_mumbai
Deploying with account: 0x66794fC75C351ad9677cB00B2043868C11dfcadA
Account balance: 0.5 MATIC

Loading compiled contract...
Deploying MemoryNFT contract...
Transaction hash: 0x...
Waiting for deployment...
✓ MemoryNFT deployed to: 0x...

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
      "address": "0x...",
      "deployer": "0x66794fC75C351ad9677cB00B2043868C11dfcadA",
      "deployedAt": "2026-01-05T...",
      "transactionHash": "0x..."
    },
    "erc6551Registry": {
      "address": "0x000000006551c19487814612e58FE06813775758",
      "note": "Official ERC-6551 Registry (pre-deployed)"
    }
  }
}

✓ Deployment info saved to deployment-info.json
```

---

## Step 6: Verify Contract on PolygonScan (Optional)

```bash
# Get PolygonScan API key from: https://polygonscan.com/apis
# Add to .env.local:
POLYGONSCAN_API_KEY=your_api_key_here

# Verify contract
npx hardhat verify --network mumbai <CONTRACT_ADDRESS>
```

---

## Step 7: Update Backend Configuration

After successful deployment, update the backend with the contract address:

### 7.1 Update `server/latentmas/erc6551-tba.ts`

```typescript
// Line 8-10
const MEMORY_NFT_ADDRESS = "0x..."; // Your deployed contract address
const ERC6551_REGISTRY = "0x000000006551c19487814612e58FE06813775758";
const MUMBAI_RPC_URL = "https://rpc.ankr.com/polygon_mumbai";
```

### 7.2 Update Environment Variables

Add to your production `.env`:

```env
# Smart Contract Addresses
MEMORY_NFT_CONTRACT=0x...
ERC6551_REGISTRY=0x000000006551c19487814612e58FE06813775758
POLYGON_RPC_URL=https://rpc.ankr.com/polygon_mumbai
```

---

## Step 8: Test NFT Minting

Create a test script `scripts/test-nft-minting.ts`:

```typescript
import { ethers } from 'ethers';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function testMinting() {
  const provider = new ethers.JsonRpcProvider(process.env.MUMBAI_RPC_URL);
  const wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY!, provider);
  
  const contractAddress = "0x..."; // Your deployed contract
  const abi = [
    "function mintMemoryNFT(address to, string memory tokenURI) public returns (uint256)",
    "function balanceOf(address owner) public view returns (uint256)",
    "function tokenURI(uint256 tokenId) public view returns (string memory)"
  ];
  
  const contract = new ethers.Contract(contractAddress, abi, wallet);
  
  console.log("Minting NFT...");
  const tx = await contract.mintMemoryNFT(
    wallet.address,
    "ipfs://QmTest123..."
  );
  
  console.log("Transaction hash:", tx.hash);
  await tx.wait();
  console.log("✓ NFT minted successfully!");
  
  const balance = await contract.balanceOf(wallet.address);
  console.log("NFT balance:", balance.toString());
}

testMinting().catch(console.error);
```

Run test:
```bash
pnpm tsx scripts/test-nft-minting.ts
```

---

## Step 9: Upload Deployment Info to Manus

After successful deployment:

1. Copy `deployment-info.json` content
2. In Manus, create a new file: `deployment-info.json`
3. Paste the deployment information
4. Save checkpoint

This ensures the deployment info is synced with your Manus project.

---

## Troubleshooting

### Error: "insufficient funds"
**Solution**: Get more Mumbai MATIC from faucet

### Error: "nonce too low"
**Solution**: Wait a few minutes and try again

### Error: "replacement transaction underpriced"
**Solution**: Increase gas price in deployment script:
```javascript
const contract = await factory.deploy({
  gasPrice: ethers.parseUnits("30", "gwei")
});
```

### Error: "contract creation code storage out of gas"
**Solution**: Contract is too large. This shouldn't happen with MemoryNFT.

### Error: "network does not support ENS"
**Solution**: Ignore this warning, it doesn't affect deployment

---

## Alternative: Use Remix IDE

If you prefer a GUI:

1. Visit https://remix.ethereum.org/
2. Upload `contracts/MemoryNFT.sol`
3. Compile with Solidity 0.8.20
4. Deploy & Run Transactions:
   - Environment: "Injected Provider - MetaMask"
   - Network: Polygon Mumbai
   - Deploy

---

## Next Steps After Deployment

1. ✅ Contract deployed to Mumbai
2. ✅ Verified on PolygonScan
3. ✅ Backend updated with contract address
4. ✅ NFT minting tested

**Now you can**:
- Test complete purchase flow (Buy W-Matrix → Mint NFT)
- Create Token Bound Accounts (TBA) for NFTs
- View NFTs on OpenSea Testnet
- Integrate with frontend

---

## Contract Addresses Reference

| Contract | Address | Network |
|----------|---------|---------|
| MemoryNFT | `0x...` (after deployment) | Mumbai |
| ERC6551 Registry | `0x000000006551c19487814612e58FE06813775758` | Mumbai (pre-deployed) |

---

## Useful Links

- **Mumbai Faucet**: https://faucet.polygon.technology/
- **PolygonScan Mumbai**: https://mumbai.polygonscan.com/
- **OpenSea Testnet**: https://testnets.opensea.io/
- **ERC-6551 Docs**: https://erc6551.org/

---

*Last Updated: 2026-01-05*  
*Network: Polygon Mumbai (Testnet)*  
*Deployer: 0x66794fC75C351ad9677cB00B2043868C11dfcadA*
