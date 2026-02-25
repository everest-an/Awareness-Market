import { ethers } from 'ethers';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const rpcUrl = process.env.FUJI_RPC_URL || "https://api.avax-test.network/ext/bc/C/rpc";
const address = process.env.DEPLOYER_ADDRESS;

console.log("Checking balance for:", address);
console.log("RPC:", rpcUrl);
console.log("");

const provider = new ethers.JsonRpcProvider(rpcUrl);

try {
  const balance = await provider.getBalance(address);
  const balanceInAVAX = ethers.formatEther(balance);

  console.log("Balance:", balanceInAVAX, "AVAX");
  console.log("");

  if (balance === 0n) {
    console.log("❌ Balance is 0. Get testnet AVAX from:");
    console.log("   https://core.app/tools/testnet-faucet/?subnet=c&token=c");
  } else if (balance < ethers.parseEther("0.01")) {
    console.log("⚠️  Low balance. Recommended: 0.1+ AVAX");
  } else {
    console.log("✅ Sufficient balance for deployment!");
  }

  console.log("");
  console.log("View on Snowscan:");
  console.log(`https://testnet.snowscan.xyz/address/${address}`);

} catch (error) {
  console.error("Error:", error.message);
}
