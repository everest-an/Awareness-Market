import { ethers } from 'ethers';

const provider = new ethers.JsonRpcProvider(process.env.AVALANCHE_RPC_URL || 'https://api.avax.network/ext/bc/C/rpc');

const feeData = await provider.getFeeData();
console.log('Current Gas Price:', ethers.formatUnits(feeData.gasPrice || 0n, 'gwei'), 'Gwei');
console.log('Max Fee Per Gas:', ethers.formatUnits(feeData.maxFeePerGas || 0n, 'gwei'), 'Gwei');
console.log('Max Priority Fee:', ethers.formatUnits(feeData.maxPriorityFeePerGas || 0n, 'gwei'), 'Gwei');

const block = await provider.getBlock('latest');
console.log('Latest Block:', block?.number);
console.log('Base Fee:', ethers.formatUnits(block?.baseFeePerGas || 0n, 'gwei'), 'Gwei');
