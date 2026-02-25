import { ethers } from 'ethers';

const provider = new ethers.JsonRpcProvider(process.env.AVALANCHE_RPC_URL || 'https://api.avax.network/ext/bc/C/rpc');
const contractAddr = '0x3D9c5826082d76Bed2ab5555a06F883e8CC871eD';

const code = await provider.getCode(contractAddr);
console.log('Contract has code:', code !== '0x');
console.log('Code length:', code.length);

if (code !== '0x') {
  console.log('✅ Contract deployed successfully!');
  console.log('Contract Address:', contractAddr);
} else {
  console.log('❌ No contract code found');
}
