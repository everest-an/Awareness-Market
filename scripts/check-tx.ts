import { ethers } from 'ethers';

const provider = new ethers.JsonRpcProvider(process.env.AVALANCHE_RPC_URL || 'https://api.avax.network/ext/bc/C/rpc');
const txHash = '0xe22b368311b571f21f8a2f07fa6a7f08e9c25afb699dec2b33b9b68ac6618942';

const tx = await provider.getTransaction(txHash);
if (tx === null) {
  console.log('Transaction not found');
} else if (tx.blockNumber === null) {
  console.log('Status: Pending');
} else {
  const receipt = await provider.getTransactionReceipt(txHash);
  console.log('Status:', receipt.status === 1 ? 'Success' : 'Failed');
  console.log('Contract Address:', receipt.contractAddress);
  console.log('Gas Used:', receipt.gasUsed.toString());
  console.log('Block:', receipt.blockNumber);
}
