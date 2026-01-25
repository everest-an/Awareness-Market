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
  
  // Check balance on Mumbai
  const provider = new ethers.JsonRpcProvider('https://rpc-mumbai.maticvigil.com');
  const balance = await provider.getBalance(wallet.address);
  
  console.log('=== Mumbai Testnet Balance ===');
  console.log('Balance:', ethers.formatEther(balance), 'MATIC');
  console.log('');
  
  if (balance === 0n) {
    console.log('⚠️  WARNING: Wallet has 0 MATIC!');
    console.log('Please get testnet MATIC from: https://faucet.polygon.technology/');
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
