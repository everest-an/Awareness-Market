import { ethers } from 'ethers';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const rpcUrl = process.env.AMOY_RPC_URL;
const address = process.env.DEPLOYER_ADDRESS;

console.log("Checking balance for:", address);
console.log("RPC:", rpcUrl);
console.log("");

const provider = new ethers.JsonRpcProvider(rpcUrl);

try {
  const balance = await provider.getBalance(address);
  const balanceInPOL = ethers.formatEther(balance);
  
  console.log("Balance:", balanceInPOL, "POL");
  console.log("");
  
  if (balance === 0n) {
    console.log("❌ Balance is 0. Get testnet POL from:");
    console.log("   https://faucet.polygon.technology/");
  } else if (balance < ethers.parseEther("0.01")) {
    console.log("⚠️  Low balance. Recommended: 0.1+ POL");
  } else {
    console.log("✅ Sufficient balance for deployment!");
  }
  
  console.log("");
  console.log("View on PolygonScan:");
  console.log(`https://amoy.polygonscan.com/address/${address}`);
  
} catch (error) {
  console.error("Error:", error.message);
}
