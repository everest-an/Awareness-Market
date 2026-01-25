/**
 * Deploy MemoryNFT Contract to Polygon Amoy Testnet
 * Compatible with ethers v6
 * 
 * Usage:
 *   node scripts/deploy/deploy-to-amoy.mjs
 */

import { ethers } from 'ethers';
import * as fs from 'fs/promises';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config();

async function main() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║  Deploying MemoryNFT to Polygon Amoy Testnet            ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  // Setup provider and wallet
  const rpcUrl = process.env.AMOY_RPC_URL || "https://rpc-amoy.polygon.technology/";
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  
  if (!privateKey) {
    console.error("❌ Error: DEPLOYER_PRIVATE_KEY not found in .env.local");
    process.exit(1);
  }
  
  console.log("Connecting to Amoy RPC:", rpcUrl);
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  
  console.log("Deploying with account:", wallet.address);
  
  // Check balance
  try {
    const balance = await provider.getBalance(wallet.address);
    console.log("Account balance:", ethers.formatEther(balance), "POL\n");
    
    if (balance < ethers.parseEther("0.01")) {
      console.log("⚠️  Warning: Low balance. Get Amoy POL from faucet:");
      console.log("   https://faucet.polygon.technology/\n");
      
      if (balance === 0n) {
        console.error("❌ Error: Account has 0 POL. Cannot deploy.");
        console.error("Please get testnet POL from faucet and try again.");
        process.exit(1);
      }
    }
  } catch (error) {
    console.error("❌ Error checking balance:", error.message);
    console.error("Continuing with deployment anyway...\n");
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
    
    // Deploy with explicit gas settings
    const contract = await factory.deploy({
      gasLimit: 3000000, // 3M gas limit
      gasPrice: ethers.parseUnits("50", "gwei") // 50 gwei
    });
    
    console.log("Transaction hash:", contract.deploymentTransaction().hash);
    console.log("Waiting for deployment confirmation...");
    
    await contract.waitForDeployment();
    const contractAddress = await contract.getAddress();
    
    console.log("✓ MemoryNFT deployed to:", contractAddress);
    
    // Wait for confirmations
    console.log("\nWaiting for 5 block confirmations...");
    await contract.deploymentTransaction().wait(5);
    console.log("✓ Confirmed\n");
    
    // Save deployment info
    const deploymentInfo = {
      network: "amoy",
      chainId: 80002,
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
        command: `npx hardhat verify --network amoy ${contractAddress}`,
        polygonscan: `https://amoy.polygonscan.com/address/${contractAddress}`,
      },
      rpcUrl: rpcUrl,
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
    console.log(`   npx hardhat verify --network amoy ${contractAddress}\n`);
    console.log("2. Update backend with contract address:");
    console.log(`   Edit server/latentmas/erc6551-tba.ts`);
    console.log(`   Set MEMORY_NFT_ADDRESS = "${contractAddress}"\n`);
    console.log("3. Test NFT minting:");
    console.log("   pnpm tsx scripts/test-nft-minting.ts\n");
    console.log("4. View on PolygonScan:");
    console.log(`   https://amoy.polygonscan.com/address/${contractAddress}\n`);
    console.log("5. Get testnet POL:");
    console.log("   https://faucet.polygon.technology/\n");
    
  } catch (error) {
    console.error("❌ Deployment failed:", error.message);
    
    if (error.code === 'ENOENT') {
      console.error("\nContract not compiled. Run:");
      console.error("  npx hardhat compile");
    } else if (error.code === 'INSUFFICIENT_FUNDS') {
      console.error("\nInsufficient funds. Get testnet POL from:");
      console.error("  https://faucet.polygon.technology/");
    } else if (error.code === 'NONCE_EXPIRED') {
      console.error("\nNonce issue. Wait a few minutes and try again.");
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
