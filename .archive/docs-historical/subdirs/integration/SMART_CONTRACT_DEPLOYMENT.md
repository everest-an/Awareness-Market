# Smart Contract Deployment Guide

## Overview

This guide explains how to deploy the Neural Bridge Memory NFT (ERC-721) and ERC-6551 Token Bound Account contracts to Avalanche Fuji testnet.

## Prerequisites

- Node.js 18+ installed
- Hardhat or Foundry installed
- MetaMask wallet with Fuji AVAX (get from [Fuji Faucet](https://core.app/tools/testnet-faucet/?subnet=c&token=c/))
- Alchemy or Infura API key for Fuji RPC

## Contract Architecture

### 1. MemoryNFT.sol (ERC-721)

Main NFT contract representing Neural Bridge Memory ownership.

**Key Features:**
- Mints NFTs for each Memory (W-Matrix + KV-Cache package)
- Stores on-chain metadata (sourceModel, targetModel, hiddenDim, storageUrl, checksum)
- Registers Token Bound Accounts (TBA) for each NFT
- Emits events for minting and TBA creation

**Functions:**
- `mintMemory()` - Mint a new Memory NFT
- `registerTBA()` - Register a TBA for an NFT
- `getTBA()` - Get the TBA address for an NFT
- `getMemoryMetadata()` - Get memory metadata

### 2. ERC-6551 Registry (Standard)

Uses the official ERC-6551 Registry contract deployed at:
- **Mainnet**: `0x000000006551c19487814612e58FE06813775758`
- **Fuji**: `0x000000006551c19487814612e58FE06813775758`

**Note**: The ERC-6551 Registry is already deployed on all major networks. You don't need to deploy it yourself.

### 3. ERC-6551 Account Implementation

Uses a standard ERC-6551 Account implementation (e.g., from [tokenbound/contracts](https://github.com/tokenbound/contracts)).

## Deployment Steps

### Step 1: Install Dependencies

```bash
cd /home/ubuntu/latentmind-marketplace
pnpm add --save-dev hardhat @nomicfoundation/hardhat-toolbox @openzeppelin/contracts ethers dotenv
```

### Step 2: Initialize Hardhat

```bash
npx hardhat init
```

Select "Create a TypeScript project" and accept defaults.

### Step 3: Configure Hardhat

Edit `hardhat.config.ts`:

```typescript
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    fuji: {
      url: process.env.FUJI_RPC_URL || "https://api.avax-test.network/ext/bc/C/rpc",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 43113,
    },
    avalanche: {
      url: process.env.AVALANCHE_RPC_URL || "https://avalanche-rpc.com",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 43114,
    },
  },
  etherscan: {
    apiKey: {
      avalancheFuji: process.env.SNOWSCAN_API_KEY || "",
      avalanche: process.env.SNOWSCAN_API_KEY || "",
    },
  },
};

export default config;
```

### Step 4: Set Environment Variables

Create `.env` file:

```bash
PRIVATE_KEY=your_wallet_private_key_here
FUJI_RPC_URL=https://avalanche-fuji.g.alchemy.com/v2/YOUR_ALCHEMY_KEY
SNOWSCAN_API_KEY=your_snowscan_api_key_here
```

**⚠️ Security Warning**: Never commit `.env` file to Git. Add it to `.gitignore`.

### Step 5: Create Deployment Script

Create `scripts/deploy-memory-nft.ts`:

```typescript
import { ethers } from "hardhat";

async function main() {
  console.log("Deploying MemoryNFT contract to Fuji...");

  const MemoryNFT = await ethers.getContractFactory("MemoryNFT");
  const memoryNFT = await MemoryNFT.deploy();

  await memoryNFT.waitForDeployment();

  const address = await memoryNFT.getAddress();
  console.log(`MemoryNFT deployed to: ${address}`);

  // Wait for 5 confirmations before verifying
  console.log("Waiting for 5 confirmations...");
  await memoryNFT.deploymentTransaction()?.wait(5);

  // Verify contract on Snowscan
  console.log("Verifying contract on Snowscan...");
  try {
    await hre.run("verify:verify", {
      address: address,
      constructorArguments: [],
    });
    console.log("Contract verified successfully!");
  } catch (error) {
    console.log("Verification failed:", error);
  }

  console.log("\nDeployment Summary:");
  console.log("===================");
  console.log(`Network: Fuji Testnet`);
  console.log(`Contract Address: ${address}`);
  console.log(`Explorer: https://testnet.snowscan.xyz/address/${address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

### Step 6: Deploy to Fuji

```bash
npx hardhat run scripts/deploy-memory-nft.ts --network fuji
```

Expected output:
```
Deploying MemoryNFT contract to Fuji...
MemoryNFT deployed to: 0x1234567890abcdef1234567890abcdef12345678
Waiting for 5 confirmations...
Verifying contract on Snowscan...
Contract verified successfully!

Deployment Summary:
===================
Network: Fuji Testnet
Contract Address: 0x1234567890abcdef1234567890abcdef12345678
Explorer: https://testnet.snowscan.xyz/address/0x1234567890abcdef1234567890abcdef12345678
```

### Step 7: Update Backend Configuration

Add the deployed contract address to `.env`:

```bash
MEMORY_NFT_CONTRACT_ADDRESS=0x1234567890abcdef1234567890abcdef12345678
ERC6551_REGISTRY_ADDRESS=0x000000006551c19487814612e58FE06813775758
FUJI_RPC_URL=https://avalanche-fuji.g.alchemy.com/v2/YOUR_ALCHEMY_KEY
```

### Step 8: Test Minting

Create `scripts/test-mint.ts`:

```typescript
import { ethers } from "hardhat";

async function main() {
  const contractAddress = process.env.MEMORY_NFT_CONTRACT_ADDRESS;
  if (!contractAddress) {
    throw new Error("MEMORY_NFT_CONTRACT_ADDRESS not set");
  }

  const MemoryNFT = await ethers.getContractFactory("MemoryNFT");
  const memoryNFT = MemoryNFT.attach(contractAddress);

  console.log("Minting test Memory NFT...");

  const [owner] = await ethers.getSigners();
  const tx = await memoryNFT.mintMemory(
    owner.address,
    "test-memory-uuid-123",
    "gpt-3.5-turbo",
    "gpt-4",
    4096,
    "https://s3.amazonaws.com/awareness/memories/test.json",
    "abc123def456...",
    "ipfs://QmTest123..."
  );

  const receipt = await tx.wait();
  console.log(`Memory NFT minted! Transaction: ${receipt.hash}`);

  // Get the token ID from the event
  const event = receipt.logs.find((log: any) => log.eventName === "MemoryMinted");
  if (event) {
    console.log(`Token ID: ${event.args.tokenId}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

Run the test:
```bash
npx hardhat run scripts/test-mint.ts --network fuji
```

## ERC-6551 TBA Integration

### Step 1: Deploy ERC-6551 Account Implementation

You can use the official implementation from [tokenbound/contracts](https://github.com/tokenbound/contracts):

```bash
git clone https://github.com/tokenbound/contracts.git
cd contracts
npm install
npx hardhat run scripts/deploy.js --network fuji
```

Or use the already deployed implementation:
- **Fuji**: `0x2D25602551487C3f3354dD80D76D54383A243358`

### Step 2: Create TBA for Memory NFT

```typescript
import { ethers } from "hardhat";

async function createTBA(tokenId: number) {
  const registryAddress = "0x000000006551c19487814612e58FE06813775758";
  const implementationAddress = "0x2D25602551487C3f3354dD80D76D54383A243358";
  const memoryNFTAddress = process.env.MEMORY_NFT_CONTRACT_ADDRESS;
  const chainId = 43113; // Fuji

  const registry = await ethers.getContractAt("IERC6551Registry", registryAddress);

  const tx = await registry.createAccount(
    implementationAddress,
    chainId,
    memoryNFTAddress,
    tokenId,
    0, // salt
    "0x" // initData
  );

  const receipt = await tx.wait();
  console.log(`TBA created! Transaction: ${receipt.hash}`);

  // Compute the TBA address
  const tbaAddress = await registry.account(
    implementationAddress,
    chainId,
    memoryNFTAddress,
    tokenId,
    0
  );

  console.log(`TBA Address: ${tbaAddress}`);

  // Register TBA in MemoryNFT contract
  const memoryNFT = await ethers.getContractAt("MemoryNFT", memoryNFTAddress);
  await memoryNFT.registerTBA(tokenId, tbaAddress);

  return tbaAddress;
}
```

## Testing

### Test Checklist

- [ ] Deploy MemoryNFT contract to Fuji
- [ ] Verify contract on Snowscan
- [ ] Mint test Memory NFT
- [ ] Create TBA for the NFT
- [ ] Register TBA in MemoryNFT contract
- [ ] Transfer NFT and verify TBA ownership
- [ ] Test TBA can receive and send assets

### Test Commands

```bash
# Compile contracts
npx hardhat compile

# Run tests
npx hardhat test

# Deploy to Fuji
npx hardhat run scripts/deploy-memory-nft.ts --network fuji

# Verify contract
npx hardhat verify --network fuji DEPLOYED_ADDRESS

# Test minting
npx hardhat run scripts/test-mint.ts --network fuji
```

## Production Deployment (Avalanche C-Chain)

Once tested on Fuji, deploy to Avalanche C-Chain:

```bash
npx hardhat run scripts/deploy-memory-nft.ts --network avalanche
```

**Important**: Ensure you have enough AVAX for gas fees on mainnet.

## Integration with Backend

Update `server/blockchain/erc6551-tba.ts` to use the deployed contract addresses:

```typescript
const MEMORY_NFT_ADDRESS = process.env.MEMORY_NFT_CONTRACT_ADDRESS;
const ERC6551_REGISTRY_ADDRESS = "0x000000006551c19487814612e58FE06813775758";
const ERC6551_ACCOUNT_IMPLEMENTATION = "0x2D25602551487C3f3354dD80D76D54383A243358";
```

## Troubleshooting

### Issue: Insufficient funds for gas

**Solution**: Get Fuji AVAX from [Fuji Faucet](https://core.app/tools/testnet-faucet/?subnet=c&token=c/)

### Issue: Contract verification failed

**Solution**: Wait a few minutes and try again. Snowscan API can be slow.

### Issue: Transaction reverted

**Solution**: Check gas limit and ensure you're using the correct network (chainId 43113 for Fuji)

## Next Steps

1. Deploy contracts to Fuji testnet
2. Test minting and TBA creation
3. Integrate with backend API
4. Test complete workflow (mint → create TBA → transfer → verify)
5. Deploy to Avalanche C-Chain
6. Update frontend to display NFT ownership and TBA addresses

## Resources

- [ERC-6551 Specification](https://eips.ethereum.org/EIPS/eip-6551)
- [Tokenbound Contracts](https://github.com/tokenbound/contracts)
- [Avalanche Fuji Faucet](https://core.app/tools/testnet-faucet/?subnet=c&token=c/)
- [Hardhat Documentation](https://hardhat.org/docs)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts)
