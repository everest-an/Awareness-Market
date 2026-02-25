import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';

dotenv.config();

const STABLECOIN_ADDRESSES = {
  USDC: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
  USDT: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7',
};

async function main() {
  console.log('Deploying StablecoinPaymentSystem to Avalanche...');

  const rpcUrl = process.env.AVALANCHE_RPC_URL || 'https://api.avax.network/ext/bc/C/rpc';
  const provider = new ethers.JsonRpcProvider(rpcUrl, {
    name: 'avalanche',
    chainId: 43114
  });

  const wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY!, provider);

  console.log('Deploying with account:', wallet.address);

  const balance = await provider.getBalance(wallet.address);
  console.log('Account balance:', ethers.formatEther(balance), 'AVAX');

  const feeData = await provider.getFeeData();
  console.log('Current Gas Price:', ethers.formatUnits(feeData.gasPrice || 0n, 'gwei'), 'Gwei');

  const platformTreasury = process.env.PLATFORM_TREASURY_ADDRESS || '0x3d0ab53241A2913D7939ae02f7083169fE7b823B';
  console.log('Platform Treasury:', platformTreasury);

  const contractPath = './artifacts/contracts/StablecoinPaymentSystem.sol/StablecoinPaymentSystem.json';
  const contractJson = JSON.parse(readFileSync(contractPath, 'utf8'));

  console.log('Deploying StablecoinPaymentSystem contract...');
  const factory = new ethers.ContractFactory(contractJson.abi, contractJson.bytecode, wallet);

  const paymentSystem = await factory.deploy(platformTreasury, {
    nonce: 1,
    gasLimit: 3000000,
    maxFeePerGas: feeData.maxFeePerGas,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas
  });

  console.log('Transaction sent:', paymentSystem.deploymentTransaction()?.hash);
  console.log('Waiting for confirmation...');
  await paymentSystem.waitForDeployment();

  const paymentSystemAddress = await paymentSystem.getAddress();
  console.log('✅ StablecoinPaymentSystem deployed to:', paymentSystemAddress);

  console.log('Adding USDC support...');
  const tx1 = await paymentSystem.addStablecoin(STABLECOIN_ADDRESSES.USDC);
  await tx1.wait();
  console.log('✅ USDC added');

  console.log('Adding USDT support...');
  const tx2 = await paymentSystem.addStablecoin(STABLECOIN_ADDRESSES.USDT);
  await tx2.wait();
  console.log('✅ USDT added');

  console.log('\\n=== Deployment Summary ===');
  console.log('Contract Address:', paymentSystemAddress);
  console.log('Platform Treasury:', platformTreasury);
  console.log('Supported Stablecoins:');
  console.log('  - USDC:', STABLECOIN_ADDRESSES.USDC);
  console.log('  - USDT:', STABLECOIN_ADDRESSES.USDT);
  console.log('\\nUpdate your .env file:');
  console.log('STABLECOIN_CONTRACT_ADDRESS=' + paymentSystemAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Deployment failed:', error.message || error);
    process.exit(1);
  });
