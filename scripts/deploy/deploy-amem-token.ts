/**
 * Deploy $AMEM Token and AgentCreditSystem
 *
 * Usage:
 *   npx hardhat run scripts/deploy/deploy-amem-token.ts --network amoy
 *   npx hardhat run scripts/deploy/deploy-amem-token.ts --network polygon
 *
 * Environment variables required:
 *   - DEPLOYER_PRIVATE_KEY: Private key for deployment
 *   - AMOY_RPC_URL or POLYGON_RPC_URL: RPC endpoint
 *   - FEE_COLLECTOR_ADDRESS: Address to collect platform fees
 *   - MAINTAINER_POOL_ADDRESS: Address for W-Matrix maintainer rewards
 *   - PLATFORM_TREASURY_ADDRESS: Address for platform treasury
 */

import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

interface DeploymentRecord {
  network: string;
  chainId: number;
  deployer: string;
  timestamp: string;
  contracts: {
    AMEMToken: {
      address: string;
      totalSupply: string;
      feeCollector: string;
      maintainerPool: string;
      transactionHash: string;
    };
    AgentCreditSystem: {
      address: string;
      amemToken: string;
      platformTreasury: string;
      platformFeeRate: string;
      transactionHash: string;
    };
  };
}

async function main() {
  console.log("🚀 Starting $AMEM Token deployment...\n");

  // Get network info
  const network = await ethers.provider.getNetwork();
  const [deployer] = await ethers.getSigners();

  console.log("📡 Network:", network.name, `(Chain ID: ${network.chainId})`);
  console.log("👤 Deployer:", deployer.address);
  console.log("💰 Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

  // Configuration from environment variables
  const feeCollectorAddress = process.env.FEE_COLLECTOR_ADDRESS || deployer.address;
  const maintainerPoolAddress = process.env.MAINTAINER_POOL_ADDRESS || deployer.address;
  const platformTreasuryAddress = process.env.PLATFORM_TREASURY_ADDRESS || deployer.address;

  console.log("⚙️  Configuration:");
  console.log("   Fee Collector:", feeCollectorAddress);
  console.log("   Maintainer Pool:", maintainerPoolAddress);
  console.log("   Platform Treasury:", platformTreasuryAddress);
  console.log("");

  // Deploy AMEMToken
  console.log("📝 Deploying AMEMToken...");
  const AMEMToken = await ethers.getContractFactory("AMEMToken");
  const amemToken = await AMEMToken.deploy(
    feeCollectorAddress,
    maintainerPoolAddress
  );

  await amemToken.waitForDeployment();
  const amemTokenAddress = await amemToken.getAddress();

  console.log("✅ AMEMToken deployed to:", amemTokenAddress);

  // Get deployment transaction
  const amemDeployTx = amemToken.deploymentTransaction();
  if (!amemDeployTx) {
    throw new Error("Failed to get AMEMToken deployment transaction");
  }

  // Verify token details
  const totalSupply = await amemToken.TOTAL_SUPPLY();
  const tokenName = await amemToken.name();
  const tokenSymbol = await amemToken.symbol();
  const tokenDecimals = await amemToken.decimals();

  console.log("   Name:", tokenName);
  console.log("   Symbol:", tokenSymbol);
  console.log("   Decimals:", tokenDecimals);
  console.log("   Total Supply:", ethers.formatEther(totalSupply), "$AMEM");
  console.log("   Transaction:", amemDeployTx.hash);
  console.log("");

  // Deploy AgentCreditSystem
  console.log("📝 Deploying AgentCreditSystem...");
  const AgentCreditSystem = await ethers.getContractFactory("AgentCreditSystem");
  const creditSystem = await AgentCreditSystem.deploy(
    amemTokenAddress,
    platformTreasuryAddress
  );

  await creditSystem.waitForDeployment();
  const creditSystemAddress = await creditSystem.getAddress();

  console.log("✅ AgentCreditSystem deployed to:", creditSystemAddress);

  // Get deployment transaction
  const creditDeployTx = creditSystem.deploymentTransaction();
  if (!creditDeployTx) {
    throw new Error("Failed to get AgentCreditSystem deployment transaction");
  }

  // Verify credit system details
  const platformFeeRate = await creditSystem.platformFeeRate();
  const withdrawalCooldown = await creditSystem.withdrawalCooldown();

  console.log("   Platform Fee:", (Number(platformFeeRate) / 100), "%");
  console.log("   Withdrawal Cooldown:", Number(withdrawalCooldown) / 86400, "days");
  console.log("   Transaction:", creditDeployTx.hash);
  console.log("");

  // Transfer initial tokens to credit system for testing (optional)
  if (process.env.INITIAL_CREDIT_SYSTEM_ALLOCATION) {
    const allocationAmount = ethers.parseEther(process.env.INITIAL_CREDIT_SYSTEM_ALLOCATION);
    console.log("💸 Transferring initial allocation to credit system...");
    const transferTx = await amemToken.transfer(creditSystemAddress, allocationAmount);
    await transferTx.wait();
    console.log("✅ Transferred", ethers.formatEther(allocationAmount), "$AMEM");
    console.log("");
  }

  // Save deployment information
  const deploymentRecord: DeploymentRecord = {
    network: network.name,
    chainId: Number(network.chainId),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      AMEMToken: {
        address: amemTokenAddress,
        totalSupply: ethers.formatEther(totalSupply),
        feeCollector: feeCollectorAddress,
        maintainerPool: maintainerPoolAddress,
        transactionHash: amemDeployTx.hash,
      },
      AgentCreditSystem: {
        address: creditSystemAddress,
        amemToken: amemTokenAddress,
        platformTreasury: platformTreasuryAddress,
        platformFeeRate: platformFeeRate.toString(),
        transactionHash: creditDeployTx.hash,
      },
    },
  };

  // Save to file
  const deploymentsDir = path.join(__dirname, "../../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const filename = `amem-${network.name}-${Date.now()}.json`;
  const filepath = path.join(deploymentsDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(deploymentRecord, null, 2));

  console.log("📄 Deployment record saved to:", filepath);
  console.log("");

  // Print summary
  console.log("🎉 Deployment completed successfully!");
  console.log("");
  console.log("📋 Summary:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Contract              Address");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("AMEMToken            ", amemTokenAddress);
  console.log("AgentCreditSystem    ", creditSystemAddress);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("");

  console.log("📝 Next steps:");
  console.log("1. Add contract addresses to .env:");
  console.log(`   AMEM_TOKEN_ADDRESS=${amemTokenAddress}`);
  console.log(`   AGENT_CREDIT_SYSTEM_ADDRESS=${creditSystemAddress}`);
  console.log("");
  console.log("2. Verify contracts on blockchain explorer:");
  console.log(`   npx hardhat verify --network ${network.name} ${amemTokenAddress} "${feeCollectorAddress}" "${maintainerPoolAddress}"`);
  console.log(`   npx hardhat verify --network ${network.name} ${creditSystemAddress} "${amemTokenAddress}" "${platformTreasuryAddress}"`);
  console.log("");
  console.log("3. Grant roles if needed:");
  console.log("   - OPERATOR_ROLE for backend services");
  console.log("   - PRICE_ORACLE_ROLE for price updates");
  console.log("");

  return deploymentRecord;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
