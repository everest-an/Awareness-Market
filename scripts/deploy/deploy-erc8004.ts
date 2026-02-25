/**
 * Deploy ERC-8004 Registry Contract
 * 
 * Usage:
 *   npx hardhat run scripts/deploy/deploy-erc8004.ts --network fuji
 *
 * Environment Variables Required:
 *   - DEPLOYER_PRIVATE_KEY: Private key for deployment
 *   - FUJI_RPC_URL: Avalanche Fuji RPC URL
 */

import { ethers } from "hardhat";

async function main() {
  console.log("🚀 Deploying ERC-8004 Registry Contract...\n");

  // Get deployer
  const [deployer] = await ethers.getSigners();
  console.log("Deployer address:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Deployer balance:", ethers.formatEther(balance), "AVAX\n");

  if (balance === 0n) {
    console.error("❌ Deployer has no AVAX. Get testnet AVAX from faucet:");
    console.error("   https://core.app/tools/testnet-faucet/?subnet=c&token=c");
    process.exit(1);
  }

  // Deploy contract
  console.log("Deploying ERC8004Registry...");
  const ERC8004Registry = await ethers.getContractFactory("ERC8004Registry");
  const registry = await ERC8004Registry.deploy();
  
  await registry.waitForDeployment();
  const address = await registry.getAddress();
  
  console.log("\n✅ ERC8004Registry deployed to:", address);
  
  // Verify deployment
  console.log("\nVerifying deployment...");
  const owner = await registry.owner();
  console.log("Contract owner:", owner);
  
  const totalAgents = await registry.totalAgents();
  console.log("Total agents:", totalAgents.toString());

  // Output configuration
  console.log("\n" + "=".repeat(60));
  console.log("📋 Add to your .env file:");
  console.log("=".repeat(60));
  console.log(`ERC8004_REGISTRY_ADDRESS=${address}`);
  console.log("=".repeat(60));

  // Test registration
  console.log("\n🧪 Testing agent registration...");
  
  const testAgentName = "TestAgent";
  const testAgentId = ethers.solidityPackedKeccak256(
    ["string", "address"],
    [testAgentName, deployer.address]
  );
  
  console.log("Test Agent ID:", testAgentId);
  
  const tx = await registry.registerAgent(
    testAgentId,
    "https://awareness.market/api/agents/test/metadata",
    "ai"
  );
  await tx.wait();
  
  console.log("✅ Test agent registered successfully!");
  
  // Check registration
  const agent = await registry.agents(testAgentId);
  console.log("\nRegistered Agent:");
  console.log("  Owner:", agent.owner);
  console.log("  Type:", agent.agentType);
  console.log("  Active:", agent.isActive);
  
  const newTotal = await registry.totalAgents();
  console.log("\nTotal agents after registration:", newTotal.toString());

  console.log("\n🎉 Deployment complete!");
  console.log("\nNext steps:");
  console.log("1. Add ERC8004_REGISTRY_ADDRESS to .env");
  console.log("2. Restart the server");
  console.log("3. Test at /auth/agent");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
