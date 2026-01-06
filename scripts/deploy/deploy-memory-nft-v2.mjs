/**
 * Deploy MemoryNFT Contract to Polygon Mumbai
 * Compatible with Hardhat 3.x and ethers v6
 * 
 * Usage:
 *   node scripts/deploy/deploy-memory-nft-v2.mjs
 */

import { ethers } from 'ethers';
import * as fs from 'fs/promises';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config();

async function main() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║  Deploying MemoryNFT to Polygon Mumbai                  ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  // Setup provider and wallet
  const rpcUrl = process.env.MUMBAI_RPC_URL || "https://rpc.ankr.com/polygon_mumbai";
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  
  if (!privateKey) {
    console.error("❌ Error: DEPLOYER_PRIVATE_KEY not found in .env.local");
    process.exit(1);
  }
  
  console.log("Connecting to Mumbai RPC:", rpcUrl);
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  
  console.log("Deploying with account:", wallet.address);
  
  // Check balance
  const balance = await provider.getBalance(wallet.address);
  console.log("Account balance:", ethers.formatEther(balance), "MATIC\n");
  
  if (balance < ethers.parseEther("0.1")) {
    console.log("⚠️  Warning: Low balance. Get Mumbai MATIC from faucet:");
    console.log("   https://faucet.polygon.technology/\n");
    
    if (balance === 0n) {
      console.error("❌ Error: Account has 0 MATIC. Cannot deploy.");
      console.error("Please get testnet MATIC and try again.");
      process.exit(1);
    }
  }

  // Load compiled contract
  console.log("Loading compiled contract...");
  const artifactPath = "./artifacts/contracts/MemoryNFT.sol/MemoryNFT.json";
  
  try {
    const artifact = JSON.parse(await fs.readFile(artifactPath, 'utf8'));
    const { abi, bytecode } = artifact;
    
    // Deploy contract
    console.log("Deploying MemoryNFT contract...");
    const factory = new ethers.ContractFactory(abi, bytecode, wallet);
    const contract = await factory.deploy();
    
    console.log("Transaction hash:", contract.deploymentTransaction().hash);
    console.log("Waiting for deployment...");
    
    await contract.waitForDeployment();
    const contractAddress = await contract.getAddress();
    
    console.log("✓ MemoryNFT deployed to:", contractAddress);
    
    // Wait for confirmations
    console.log("\nWaiting for 5 block confirmations...");
    await contract.deploymentTransaction().wait(5);
    console.log("✓ Confirmed\n");
    
    // Save deployment info
    const deploymentInfo = {
      network: "mumbai",
      chainId: 80001,
      contracts: {
        memoryNFT: {
          address: contractAddress,
          deployer: wallet.address,
          deployedAt: new Date().toISOString(),
          transactionHash: contract.deploymentTransaction().hash,
        },
        erc6551Registry: {
          address: "0x000000006551c19487814612e58FE06813775758",
          note: "Official ERC-6551 Registry (pre-deployed)",
        },
      },
      verification: {
        command: `npx hardhat verify --network mumbai ${contractAddress}`,
        polygonscan: `https://mumbai.polygonscan.com/address/${contractAddress}`,
      },
    };
    
    console.log("╔══════════════════════════════════════════════════════════╗");
    console.log("║  Deployment Summary                                      ║");
    console.log("╚══════════════════════════════════════════════════════════╝\n");
    console.log(JSON.stringify(deploymentInfo, null, 2));
    
    // Save to file
    await fs.writeFile(
      "deployment-info.json",
      JSON.stringify(deploymentInfo, null, 2)
    );
    console.log("\n✓ Deployment info saved to deployment-info.json");
    
    console.log("\n╔══════════════════════════════════════════════════════════╗");
    console.log("║  Next Steps                                              ║");
    console.log("╚══════════════════════════════════════════════════════════╝\n");
    console.log("1. Verify contract on PolygonScan:");
    console.log(`   npx hardhat verify --network mumbai ${contractAddress}\n`);
    console.log("2. Update backend with contract address:");
    console.log(`   Edit server/latentmas/erc6551-tba.ts`);
    console.log(`   Set MEMORY_NFT_ADDRESS = "${contractAddress}"\n`);
    console.log("3. Test NFT minting:");
    console.log("   pnpm tsx scripts/test-nft-minting.ts\n");
    console.log("4. View on PolygonScan:");
    console.log(`   https://mumbai.polygonscan.com/address/${contractAddress}\n`);
    
  } catch (error) {
    console.error("❌ Deployment failed:", error.message);
    if (error.code === 'ENOENT') {
      console.error("\nContract not compiled. Run:");
      console.error("  npx hardhat compile");
    }
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
