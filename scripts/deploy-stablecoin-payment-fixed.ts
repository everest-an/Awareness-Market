/**
 * Deploy StablecoinPaymentSystem Contract (Hardhat 3.x compatible)
 */
import { ethers } from 'hardhat';

const STABLECOIN_ADDRESSES = {
  polygon: {
    USDC: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
  },
};

async function main() {
  console.log('Deploying StablecoinPaymentSystem...\n');

  const [deployer] = await ethers.getSigners();
  console.log('Deploying with account:', deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log('Account balance:', ethers.formatEther(balance), 'POL\n');

  const network = await ethers.provider.getNetwork();
  console.log('Network: Polygon (Chain ID:', network.chainId.toString(), ')\n');

  const platformTreasury = process.env.PLATFORM_TREASURY_ADDRESS || '0x3d0ab53241A2913D7939ae02f7083169fE7b823B';
  console.log('Platform Treasury:', platformTreasury);

  console.log('\nDeploying StablecoinPaymentSystem contract...');
  const StablecoinPaymentSystem = await ethers.getContractFactory('StablecoinPaymentSystem');
  const paymentSystem = await StablecoinPaymentSystem.deploy(platformTreasury);
  await paymentSystem.waitForDeployment();

  const paymentSystemAddress = await paymentSystem.getAddress();
  console.log('✅ StablecoinPaymentSystem deployed to:', paymentSystemAddress);

  const stablecoins = STABLECOIN_ADDRESSES.polygon;
  
  console.log('\nAdding USDC support...');
  const tx1 = await paymentSystem.addStablecoin(stablecoins.USDC);
  await tx1.wait();
  console.log('✅ USDC added');

  console.log('\nAdding USDT support...');
  const tx2 = await paymentSystem.addStablecoin(stablecoins.USDT);
  await tx2.wait();
  console.log('✅ USDT added');

  console.log('\n=== Deployment Summary ===');
  console.log('Contract Address:', paymentSystemAddress);
  console.log('Platform Treasury:', platformTreasury);
  console.log('Supported Stablecoins:');
  console.log('  - USDC:', stablecoins.USDC);
  console.log('  - USDT:', stablecoins.USDT);
  console.log('\nUpdate your .env file:');
  console.log('STABLECOIN_CONTRACT_ADDRESS=' + paymentSystemAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
