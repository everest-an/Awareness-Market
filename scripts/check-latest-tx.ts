import { ethers } from 'ethers';

const provider = new ethers.JsonRpcProvider(process.env.AVALANCHE_RPC_URL || 'https://api.avax.network/ext/bc/C/rpc');
const txHash = '0x5075a7d6fd119bcbaae9a214db71abe0ad4b1a16182b182aa44ea6e10edb00fa';

const tx = await provider.getTransaction(txHash);
if (tx === null) {
  console.log('Transaction not found');
} else if (tx.blockNumber === null) {
  console.log('Status: Pending');
  console.log('Nonce:', tx.nonce);
} else {
  const receipt = await provider.getTransactionReceipt(txHash);
  console.log('Status:', receipt.status === 1 ? 'Success' : 'Failed');
  console.log('Contract Address:', receipt.contractAddress);
  console.log('Gas Used:', receipt.gasUsed.toString());
  console.log('Block:', receipt.blockNumber);
}
