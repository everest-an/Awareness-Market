import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';

dotenv.config();

const STABLECOIN_ADDRESSES = {
  USDC: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
  USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
};

async function main() {
  console.log('Replacing Nonce 0 transaction with HIGH gas...');

  const rpcUrl = 'https://polygon-mainnet.g.alchemy.com/v2/vg-5r0YReOdDkSCOhgKOnsnuRJXsZLID';
  const provider = new ethers.JsonRpcProvider(rpcUrl, {
    name: 'polygon',
    chainId: 137
  });
  
  const wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY!, provider);
  
  const feeData = await provider.getFeeData();
  const maxFee = (feeData.maxFeePerGas || 0n) * 200n / 100n;
  const priorityFee = (feeData.maxPriorityFeePerGas || 0n) * 200n / 100n;
  
  console.log('Using Gas Price:', ethers.formatUnits(maxFee, 'gwei'), 'Gwei (200%)');

  const platformTreasury = process.env.PLATFORM_TREASURY_ADDRESS || '0x3d0ab53241A2913D7939ae02f7083169fE7b823B';
  const contractPath = './artifacts/contracts/StablecoinPaymentSystem.sol/StablecoinPaymentSystem.json';
  const contractJson = JSON.parse(readFileSync(contractPath, 'utf8'));

  console.log('Deploying with Nonce 0...');
  const factory = new ethers.ContractFactory(contractJson.abi, contractJson.bytecode, wallet);
  
  const paymentSystem = await factory.deploy(platformTreasury, {
    nonce: 0,
    gasLimit: 3000000,
    maxFeePerGas: maxFee,
    maxPriorityFeePerGas: priorityFee
  });
  
  console.log('Replacement Tx:', paymentSystem.deploymentTransaction()?.hash);
  console.log('Waiting...');
  await paymentSystem.waitForDeployment();

  const addr = await paymentSystem.getAddress();
  console.log('✅ Deployed:', addr);

  console.log('Adding USDC...');
  const tx1 = await paymentSystem.addStablecoin(STABLECOIN_ADDRESSES.USDC);
  await tx1.wait();
  console.log('✅ USDC added');

  console.log('Adding USDT...');
  const tx2 = await paymentSystem.addStablecoin(STABLECOIN_ADDRESSES.USDT);
  await tx2.wait();
  console.log('✅ USDT added');

  console.log('\\n=== SUCCESS ===');
  console.log('STABLECOIN_CONTRACT_ADDRESS=' + addr);
}

main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
