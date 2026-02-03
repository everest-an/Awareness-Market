/**
 * Deploy Remaining Smart Contracts
 *
 * Deploys:
 * 1. MemoryNFT (ERC-721 with ERC-6551 TBA support)
 * 2. AMEMToken (ERC-20 governance token)
 * 3. AgentCreditSystem (FICO-style credit scoring)
 *
 * Network: Polygon Mainnet (Chain ID: 137)
 *
 * Usage:
 *   pnpm tsx scripts/deploy-remaining-contracts.ts
 *
 * Requirements:
 *   - DEPLOYER_PRIVATE_KEY in .env
 *   - POL tokens for gas fees (~0.5 POL recommended)
 */

import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
import { readFileSync, writeFileSync } from 'fs';

dotenv.config();

// Configuration
const NETWORK = 'polygon'; // or 'amoy' for testnet
const RPC_URLS = {
  polygon: 'https://polygon-rpc.com',
  amoy: 'https://rpc-amoy.polygon.technology'
};

const CHAIN_IDS = {
  polygon: 137,
  amoy: 80002
};

// ERC-6551 Registry (standard address on all chains)
const ERC6551_REGISTRY = '0x000000006551c19487814612e58FE06813775758';

// Platform addresses
const PLATFORM_TREASURY = process.env.PLATFORM_TREASURY_ADDRESS || '0x3d0ab53241A2913D7939ae02f7083169fE7b823B';
const MAINTAINER_POOL = process.env.MAINTAINER_POOL_ADDRESS || PLATFORM_TREASURY; // Default to same address

async function main() {
  console.log('🚀 Deploying Remaining Smart Contracts...\n');
  console.log(`Network: ${NETWORK} (Chain ID: ${CHAIN_IDS[NETWORK as keyof typeof CHAIN_IDS]})`);
  console.log(`RPC: ${RPC_URLS[NETWORK as keyof typeof RPC_URLS]}`);
  console.log(`Platform Treasury: ${PLATFORM_TREASURY}`);
  console.log(`Maintainer Pool: ${MAINTAINER_POOL}\n`);

  // Setup provider and wallet
  const rpcUrl = RPC_URLS[NETWORK as keyof typeof RPC_URLS];
  const provider = new ethers.JsonRpcProvider(rpcUrl, {
    name: NETWORK,
    chainId: CHAIN_IDS[NETWORK as keyof typeof CHAIN_IDS]
  });

  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('DEPLOYER_PRIVATE_KEY not found in .env');
  }

  const wallet = new ethers.Wallet(privateKey, provider);
  console.log(`Deployer: ${wallet.address}`);

  // Check balance
  const balance = await provider.getBalance(wallet.address);
  console.log(`Balance: ${ethers.formatEther(balance)} POL`);

  if (balance < ethers.parseEther('0.1')) {
    console.warn('⚠️  Warning: Low balance! You may need more POL for gas fees.\n');
  }

  // Get gas settings
  const feeData = await provider.getFeeData();
  const maxFee = (feeData.maxFeePerGas || 0n) * 150n / 100n; // 1.5x
  const priorityFee = (feeData.maxPriorityFeePerGas || 0n) * 150n / 100n; // 1.5x

  console.log(`Gas Price: ${ethers.formatUnits(maxFee, 'gwei')} Gwei`);
  console.log(`Priority Fee: ${ethers.formatUnits(priorityFee, 'gwei')} Gwei\n`);

  const deployedAddresses: Record<string, string> = {};

  // ============================================================================
  // 1. Deploy MemoryNFT
  // ============================================================================
  console.log('📦 1/3: Deploying MemoryNFT...');
  try {
    const memoryNFTPath = './artifacts/contracts/MemoryNFT.sol/MemoryNFT.json';
    const memoryNFTJson = JSON.parse(readFileSync(memoryNFTPath, 'utf8'));

    const MemoryNFTFactory = new ethers.ContractFactory(
      memoryNFTJson.abi,
      memoryNFTJson.bytecode,
      wallet
    );

    const memoryNFT = await MemoryNFTFactory.deploy(
      ERC6551_REGISTRY, // ERC-6551 registry address
      {
        maxFeePerGas: maxFee,
        maxPriorityFeePerGas: priorityFee,
        gasLimit: 3000000
      }
    );

    console.log(`   Transaction: ${memoryNFT.deploymentTransaction()?.hash}`);
    await memoryNFT.waitForDeployment();

    const memoryNFTAddress = await memoryNFT.getAddress();
    deployedAddresses.MEMORY_NFT_CONTRACT_ADDRESS = memoryNFTAddress;
    console.log(`   ✅ Deployed: ${memoryNFTAddress}\n`);
  } catch (error) {
    console.error('   ❌ Failed to deploy MemoryNFT:', error);
    throw error;
  }

  // ============================================================================
  // 2. Deploy AMEMToken
  // ============================================================================
  console.log('📦 2/3: Deploying AMEMToken...');
  try {
    const amemTokenPath = './artifacts/contracts/AMEMToken.sol/AMEMToken.json';
    const amemTokenJson = JSON.parse(readFileSync(amemTokenPath, 'utf8'));

    const AMEMTokenFactory = new ethers.ContractFactory(
      amemTokenJson.abi,
      amemTokenJson.bytecode,
      wallet
    );

    // Constructor: (address _feeCollector, address _maintainerPool)
    const amemToken = await AMEMTokenFactory.deploy(
      PLATFORM_TREASURY,    // _feeCollector (平台收入地址)
      MAINTAINER_POOL,      // _maintainerPool (W-Matrix 维护者奖励池)
      {
        maxFeePerGas: maxFee,
        maxPriorityFeePerGas: priorityFee,
        gasLimit: 3000000
      }
    );

    console.log(`   Transaction: ${amemToken.deploymentTransaction()?.hash}`);
    await amemToken.waitForDeployment();

    const amemTokenAddress = await amemToken.getAddress();
    deployedAddresses.AMEM_TOKEN_CONTRACT_ADDRESS = amemTokenAddress;
    console.log(`   ✅ Deployed: ${amemTokenAddress}\n`);
  } catch (error) {
    console.error('   ❌ Failed to deploy AMEMToken:', error);
    throw error;
  }

  // ============================================================================
  // 3. Deploy AgentCreditSystem
  // ============================================================================
  console.log('📦 3/3: Deploying AgentCreditSystem...');
  try {
    const agentCreditPath = './artifacts/contracts/AgentCreditSystem.sol/AgentCreditSystem.json';
    const agentCreditJson = JSON.parse(readFileSync(agentCreditPath, 'utf8'));

    const AgentCreditFactory = new ethers.ContractFactory(
      agentCreditJson.abi,
      agentCreditJson.bytecode,
      wallet
    );

    // Constructor: (address _amemToken, address _platformTreasury)
    const agentCredit = await AgentCreditFactory.deploy(
      deployedAddresses.AMEM_TOKEN_CONTRACT_ADDRESS,  // _amemToken
      PLATFORM_TREASURY,                              // _platformTreasury
      {
        maxFeePerGas: maxFee,
        maxPriorityFeePerGas: priorityFee,
        gasLimit: 3000000
      }
    );

    console.log(`   Transaction: ${agentCredit.deploymentTransaction()?.hash}`);
    await agentCredit.waitForDeployment();

    const agentCreditAddress = await agentCredit.getAddress();
    deployedAddresses.AGENT_CREDIT_CONTRACT_ADDRESS = agentCreditAddress;
    console.log(`   ✅ Deployed: ${agentCreditAddress}\n`);
  } catch (error) {
    console.error('   ❌ Failed to deploy AgentCreditSystem:', error);
    throw error;
  }

  // ============================================================================
  // Summary
  // ============================================================================
  console.log('🎉 All contracts deployed successfully!\n');
  console.log('📝 Deployment Summary:');
  console.log('==========================================');
  console.log(`Network: ${NETWORK} (Chain ID: ${CHAIN_IDS[NETWORK as keyof typeof CHAIN_IDS]})`);
  console.log('');
  console.log('Deployed Contracts:');
  for (const [name, address] of Object.entries(deployedAddresses)) {
    console.log(`  ${name}=${address}`);
  }
  console.log('');

  // ============================================================================
  // Update DEPLOYED_CONTRACTS.md
  // ============================================================================
  console.log('📄 Updating DEPLOYED_CONTRACTS.md...');
  try {
    const deployedFile = './DEPLOYED_CONTRACTS.md';
    let content = readFileSync(deployedFile, 'utf8');

    // Add new section for these contracts
    const newSection = `
---

### MemoryNFT (ERC-721 with ERC-6551 TBA)
- **Address**: \`${deployedAddresses.MEMORY_NFT_CONTRACT_ADDRESS}\`
- **Explorer**: https://polygonscan.com/address/${deployedAddresses.MEMORY_NFT_CONTRACT_ADDRESS}
- **ERC-6551 Registry**: \`${ERC6551_REGISTRY}\`

#### Key Functions
- \`mintMemory(to, uri)\` - Mint memory NFT
- \`createTBA(tokenId)\` - Create Token Bound Account
- \`getTokenBoundAccount(tokenId)\` - Get TBA address

---

### AMEMToken (ERC-20 Governance Token)
- **Address**: \`${deployedAddresses.AMEM_TOKEN_CONTRACT_ADDRESS}\`
- **Explorer**: https://polygonscan.com/address/${deployedAddresses.AMEM_TOKEN_CONTRACT_ADDRESS}
- **Total Supply**: 1,000,000,000 AMEM
- **Platform Treasury**: \`${PLATFORM_TREASURY}\`

#### Key Functions
- \`mint(to, amount)\` - Mint tokens (only treasury)
- \`stake(amount)\` - Stake AMEM tokens
- \`unstake(amount)\` - Unstake tokens
- \`getStake(user)\` - Check staked balance

---

### AgentCreditSystem (FICO-style Scoring)
- **Address**: \`${deployedAddresses.AGENT_CREDIT_CONTRACT_ADDRESS}\`
- **Explorer**: https://polygonscan.com/address/${deployedAddresses.AGENT_CREDIT_CONTRACT_ADDRESS}
- **Score Range**: 300-850 (FICO-compatible)

#### Key Functions
- \`initializeAgent(agentId)\` - Initialize agent credit
- \`recordSuccessfulPurchase(agentId, amount)\` - Record purchase
- \`recordFailedPayment(agentId)\` - Record failure
- \`getCreditScore(agentId)\` - Get current score
- \`getCreditGrade(agentId)\` - Get grade (S/A/B/C/D)
`;

    // Update environment variables section
    const envVarsSection = `
# Blockchain - Polygon Mainnet (Chain ID: 137)
BLOCKCHAIN_NETWORK=polygon
BLOCKCHAIN_RPC_URL=https://polygon-rpc.com
POLYGON_RPC_URL=https://polygon-rpc.com

# Deployed Smart Contracts
STABLECOIN_CONTRACT_ADDRESS=0xbAEea6B8b53272c4624df53B954ed8c72Fd25dD8
ERC8004_REGISTRY_ADDRESS=0x1Ae90F59731e16b548E34f81F0054e96DdACFc28
MEMORY_NFT_CONTRACT_ADDRESS=${deployedAddresses.MEMORY_NFT_CONTRACT_ADDRESS}
AMEM_TOKEN_CONTRACT_ADDRESS=${deployedAddresses.AMEM_TOKEN_CONTRACT_ADDRESS}
AGENT_CREDIT_CONTRACT_ADDRESS=${deployedAddresses.AGENT_CREDIT_CONTRACT_ADDRESS}
PLATFORM_TREASURY_ADDRESS=${PLATFORM_TREASURY}
ERC6551_REGISTRY_ADDRESS=${ERC6551_REGISTRY}
\`\`\`
`;

    // Insert new sections
    content = content.replace('## Environment Variables', newSection + '\n## Environment Variables');
    content = content.replace(/```bash\n# Polygon Mainnet Contracts[\s\S]*?```/, envVarsSection);

    // Update deployment date
    const today = new Date().toISOString().split('T')[0];
    content = content.replace(/- \*\*Date\*\*: .*/, `- **Date**: ${today} (Updated)`);

    writeFileSync(deployedFile, content);
    console.log('   ✅ Updated DEPLOYED_CONTRACTS.md\n');
  } catch (error) {
    console.error('   ⚠️  Failed to update DEPLOYED_CONTRACTS.md:', error);
  }

  // ============================================================================
  // Next Steps
  // ============================================================================
  console.log('🎯 Next Steps:');
  console.log('');
  console.log('1. Update .env file:');
  console.log('');
  console.log(`   MEMORY_NFT_CONTRACT_ADDRESS=${deployedAddresses.MEMORY_NFT_CONTRACT_ADDRESS}`);
  console.log(`   AMEM_TOKEN_CONTRACT_ADDRESS=${deployedAddresses.AMEM_TOKEN_CONTRACT_ADDRESS}`);
  console.log(`   AGENT_CREDIT_CONTRACT_ADDRESS=${deployedAddresses.AGENT_CREDIT_CONTRACT_ADDRESS}`);
  console.log('');
  console.log('2. Verify contracts on Polygonscan:');
  console.log('');
  console.log(`   npx hardhat verify --network polygon ${deployedAddresses.MEMORY_NFT_CONTRACT_ADDRESS} "${ERC6551_REGISTRY}"`);
  console.log(`   npx hardhat verify --network polygon ${deployedAddresses.AMEM_TOKEN_CONTRACT_ADDRESS} "${PLATFORM_TREASURY}"`);
  console.log(`   npx hardhat verify --network polygon ${deployedAddresses.AGENT_CREDIT_CONTRACT_ADDRESS}`);
  console.log('');
  console.log('3. Test contract integration:');
  console.log('');
  console.log('   - Restart backend server');
  console.log('   - Test Memory NFT minting');
  console.log('   - Test AMEM token operations');
  console.log('   - Test agent credit scoring');
  console.log('');
  console.log('✨ Done!');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Deployment failed:', error.message);
    process.exit(1);
  });
