/**
 * Deploy MemoryNFT Contract to Polygon Mumbai
 * 
 * Usage:
 *   npx hardhat run scripts/deploy/deploy-memory-nft.ts --network mumbai
 */

import hre from "hardhat";

async function main() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║  Deploying MemoryNFT to Polygon Mumbai                  ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  // Get deployer account
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "MATIC\n");
  
  if (balance < hre.ethers.parseEther("0.1")) {
    console.log("⚠️  Warning: Low balance. Get Mumbai MATIC from faucet:");
    console.log("   https://faucet.polygon.technology/\n");
  }

  // Deploy MemoryNFT
  console.log("Deploying MemoryNFT contract...");
  const MemoryNFT = await hre.ethers.getContractFactory("MemoryNFT");
  const memoryNFT = await MemoryNFT.deploy();
  
  await memoryNFT.waitForDeployment();
  const memoryNFTAddress = await memoryNFT.getAddress();
  
  console.log("✓ MemoryNFT deployed to:", memoryNFTAddress);
  
  // Wait for block confirmations
  console.log("\nWaiting for 5 block confirmations...");
  await memoryNFT.deploymentTransaction()?.wait(5);
  console.log("✓ Confirmed\n");
  
  // Save deployment info
  const deploymentInfo = {
    network: "mumbai",
    chainId: 80001,
    contracts: {
      memoryNFT: {
        address: memoryNFTAddress,
        deployer: deployer.address,
        deployedAt: new Date().toISOString(),
      },
      erc6551Registry: {
        address: "0x000000006551c19487814612e58FE06813775758",
        note: "Official ERC-6551 Registry (pre-deployed)",
      },
    },
    verification: {
      command: `npx hardhat verify --network mumbai ${memoryNFTAddress}`,
      polygonscan: `https://mumbai.polygonscan.com/address/${memoryNFTAddress}`,
    },
  };
  
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║  Deployment Summary                                      ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");
  console.log(JSON.stringify(deploymentInfo, null, 2));
  
  // Save to file
  const fs = await import("fs/promises");
  await fs.writeFile(
    "deployment-info.json",
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log("\n✓ Deployment info saved to deployment-info.json");
  
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║  Next Steps                                              ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");
  console.log("1. Verify contract on PolygonScan:");
  console.log(`   npx hardhat verify --network mumbai ${memoryNFTAddress}\n`);
  console.log("2. Update backend with contract address:");
  console.log(`   Edit server/latentmas/erc6551-tba.ts`);
  console.log(`   Set MEMORY_NFT_ADDRESS = "${memoryNFTAddress}"\n`);
  console.log("3. Test NFT minting:");
  console.log("   pnpm tsx scripts/test-nft-minting.ts\n");
  console.log("4. View on PolygonScan:");
  console.log(`   https://mumbai.polygonscan.com/address/${memoryNFTAddress}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
