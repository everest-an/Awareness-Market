import { ethers } from 'ethers';

const provider = new ethers.JsonRpcProvider(process.env.AVALANCHE_RPC_URL || 'https://api.avax.network/ext/bc/C/rpc');
const wallet = '0xBB14Dd923A28DBEB6BA86801DA38CdE60b72D35b';

const nonce = await provider.getTransactionCount(wallet, 'latest');
const pendingNonce = await provider.getTransactionCount(wallet, 'pending');

console.log('Confirmed Nonce:', nonce);
console.log('Pending Nonce:', pendingNonce);
console.log('Pending Transactions:', pendingNonce - nonce);

const txHashes = [
  '0xe22b368311b571f21f8a2f07fa6a7f08e9c25afb699dec2b33b9b68ac6618942',
  '0x397fbe12b96ff0ebd7abced64e4f941006bd131f1f20b5c546d3cd4b5e068e37',
  '0x5075a7d6fd119bcbaae9a214db71abe0ad4b1a16182b182aa44ea6e10edb00fa'
];

for (const hash of txHashes) {
  const tx = await provider.getTransaction(hash);
  if (tx) {
    console.log('\\nTx:', hash.slice(0, 10) + '...');
    console.log('  Nonce:', tx.nonce);
    console.log('  Block:', tx.blockNumber || 'Pending');
  }
}
