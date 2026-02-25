/**
 * Deploy StablecoinPaymentSystem Contract
 *
 * Usage:
 *   npx hardhat run scripts/deploy-stablecoin-payment.ts --network avalanche
 */
import hre from 'hardhat';

// Stablecoin addresses
const STABLECOIN_ADDRESSES = {
  avalanche: {
    USDC: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
    USDT: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7',
  },
  fuji: {
    USDC: process.env.USDC_TESTNET_ADDRESS || '',
    USDT: process.env.USDT_TESTNET_ADDRESS || '',
  },
};

async function main() {
  console.log('Deploying StablecoinPaymentSystem...\n');

  const [deployer] = await hre.ethers.getSigners();
  console.log('Deploying with account:', deployer.address);
  console.log('Account balance:', hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), 'AVAX\n');

  // Get network
  const network = await hre.ethers.provider.getNetwork();
  const networkName = network.chainId === 43114n ? 'avalanche' : 'fuji';
  console.log('Network:', networkName, '(Chain ID:', network.chainId.toString(), ')\n');

  // Platform treasury address
  const platformTreasury = process.env.PLATFORM_TREASURY_ADDRESS || '0x3d0ab53241A2913D7939ae02f7083169fE7b823B';
  console.log('Platform Treasury:', platformTreasury);

  // Deploy StablecoinPaymentSystem
  console.log('\nDeploying StablecoinPaymentSystem contract...');
  const StablecoinPaymentSystem = await hre.ethers.getContractFactory('StablecoinPaymentSystem');
  const paymentSystem = await StablecoinPaymentSystem.deploy(platformTreasury);
  await paymentSystem.waitForDeployment();

  const paymentSystemAddress = await paymentSystem.getAddress();
  console.log('StablecoinPaymentSystem deployed to:', paymentSystemAddress);

  // Add supported stablecoins
  const stablecoins = STABLECOIN_ADDRESSES[networkName];
  if (stablecoins.USDC) {
    console.log('\nAdding USDC support...');
    const tx1 = await paymentSystem.addStablecoin(stablecoins.USDC);
    await tx1.wait();
    console.log('USDC added:', stablecoins.USDC);
  }

  if (stablecoins.USDT) {
    console.log('Adding USDT support...');
    const tx2 = await paymentSystem.addStablecoin(stablecoins.USDT);
    await tx2.wait();
    console.log('USDT added:', stablecoins.USDT);
  }

  // Verify contract configuration
  console.log('\n=== Deployment Summary ===');
  console.log('Network:', networkName);
  console.log('StablecoinPaymentSystem:', paymentSystemAddress);
  console.log('Platform Treasury:', platformTreasury);
  console.log('Platform Fee Rate:', (await paymentSystem.platformFeeRate()).toString(), 'basis points (5%)');
  console.log('Withdrawal Cooldown:', (await paymentSystem.withdrawalCooldown()).toString(), 'seconds');

  // Get supported stablecoins
  const [tokens, symbols] = await paymentSystem.getSupportedStablecoins();
  console.log('\nSupported Stablecoins:');
  for (let i = 0; i < tokens.length; i++) {
    console.log(`  ${symbols[i]}: ${tokens[i]}`);
  }

  // Print environment variables to add
  console.log('\n=== Environment Variables ===');
  console.log('Add these to your .env file:\n');
  console.log(`STABLECOIN_PAYMENT_ADDRESS=${paymentSystemAddress}`);
  console.log(`VITE_STABLECOIN_PAYMENT_ADDRESS=${paymentSystemAddress}`);
  if (stablecoins.USDC) {
    console.log(`USDC_ADDRESS=${stablecoins.USDC}`);
    console.log(`VITE_USDC_ADDRESS=${stablecoins.USDC}`);
  }
  if (stablecoins.USDT) {
    console.log(`USDT_ADDRESS=${stablecoins.USDT}`);
    console.log(`VITE_USDT_ADDRESS=${stablecoins.USDT}`);
  }

  // Print verification command
  console.log('\n=== Contract Verification ===');
  console.log('Run this command to verify on Snowscan:\n');
  console.log(`npx hardhat verify --network ${networkName} ${paymentSystemAddress} ${platformTreasury}`);

  return {
    paymentSystemAddress,
    platformTreasury,
    stablecoins,
  };
}

main()
  .then(() => {
    console.log('\nDeployment successful!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Deployment failed:', error);
    process.exit(1);
  });
