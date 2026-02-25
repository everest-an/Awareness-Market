import hre from 'hardhat';

const STABLECOIN_ADDRESSES = {
  avalanche: {
    USDC: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
    USDT: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7',
  },
};

async function main() {
  console.log('Deploying StablecoinPaymentSystem...\n');

  const signers = await hre.ethers.getSigners();
  const deployer = signers[0];

  console.log('Deploying with account:', deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log('Account balance:', hre.ethers.formatEther(balance), 'AVAX\n');

  const network = await hre.ethers.provider.getNetwork();
  console.log('Network: Avalanche (Chain ID:', network.chainId.toString(), ')\n');

  const platformTreasury = process.env.PLATFORM_TREASURY_ADDRESS || '0x3d0ab53241A2913D7939ae02f7083169fE7b823B';
  console.log('Platform Treasury:', platformTreasury);

  console.log('\nDeploying StablecoinPaymentSystem contract...');
  const StablecoinPaymentSystem = await hre.ethers.getContractFactory('StablecoinPaymentSystem');
  const paymentSystem = await StablecoinPaymentSystem.deploy(platformTreasury);
  await paymentSystem.waitForDeployment();

  const paymentSystemAddress = await paymentSystem.getAddress();
  console.log('✅ StablecoinPaymentSystem deployed to:', paymentSystemAddress);

  const stablecoins = STABLECOIN_ADDRESSES.avalanche;

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
