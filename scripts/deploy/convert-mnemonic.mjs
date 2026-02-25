import { ethers } from 'ethers';

const mnemonic = process.argv[2];

if (!mnemonic) {
  console.error('Usage: node convert-mnemonic.mjs "<mnemonic phrase>"');
  process.exit(1);
}

try {
  // Create wallet from mnemonic
  const wallet = ethers.Wallet.fromPhrase(mnemonic);

  console.log('=== Wallet Information ===');
  console.log('Address:', wallet.address);
  console.log('Private Key:', wallet.privateKey);
  console.log('');

  // Check balance on Avalanche Fuji
  const provider = new ethers.JsonRpcProvider('https://api.avax-test.network/ext/bc/C/rpc');
  const balance = await provider.getBalance(wallet.address);

  console.log('=== Avalanche Fuji Testnet Balance ===');
  console.log('Balance:', ethers.formatEther(balance), 'AVAX');
  console.log('');

  if (balance === 0n) {
    console.log('⚠️  WARNING: Wallet has 0 AVAX!');
    console.log('Please get testnet AVAX from: https://core.app/tools/testnet-faucet/?subnet=c&token=c');
    console.log('');
  } else {
    console.log('✅ Wallet has sufficient balance for deployment');
    console.log('');
  }

  console.log('=== Next Steps ===');
  console.log('1. Copy the private key above');
  console.log('2. Create .env.local file with:');
  console.log('   DEPLOYER_PRIVATE_KEY=' + wallet.privateKey);
  console.log('3. Run deployment script');

} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
