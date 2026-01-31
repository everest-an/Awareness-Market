import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';

dotenv.config();

async function main() {
  console.log('Deploying ERC-8004 Registry to Polygon Mainnet...');

  const rpcUrl = 'https://polygon-mainnet.g.alchemy.com/v2/vg-5r0YReOdDkSCOhgKOnsnuRJXsZLID';
  const provider = new ethers.JsonRpcProvider(rpcUrl, { name: 'polygon', chainId: 137 });
  const wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY!, provider);
  
  console.log('Deployer:', wallet.address);
  
  const balance = await provider.getBalance(wallet.address);
  console.log('Balance:', ethers.formatEther(balance), 'POL');

  const feeData = await provider.getFeeData();
  const maxFee = (feeData.maxFeePerGas || 0n) * 200n / 100n;
  const priorityFee = (feeData.maxPriorityFeePerGas || 0n) * 200n / 100n;
  
  console.log('Gas Price:', ethers.formatUnits(maxFee, 'gwei'), 'Gwei');

  const contractPath = './artifacts/contracts/ERC8004Registry.sol/ERC8004Registry.json';
  const contractJson = JSON.parse(readFileSync(contractPath, 'utf8'));

  console.log('Deploying ERC8004Registry...');
  const factory = new ethers.ContractFactory(contractJson.abi, contractJson.bytecode, wallet);
  
  const registry = await factory.deploy({
    gasLimit: 3000000,
    maxFeePerGas: maxFee,
    maxPriorityFeePerGas: priorityFee
  });
  
  console.log('Tx:', registry.deploymentTransaction()?.hash);
  await registry.waitForDeployment();

  const address = await registry.getAddress();
  console.log('✅ ERC8004Registry deployed:', address);

  console.log('Verifying deployment...');
  const owner = await registry.owner();
  console.log('Owner:', owner);
  
  const totalAgents = await registry.totalAgents();
  console.log('Total agents:', totalAgents.toString());

  console.log('\\nERC8004_REGISTRY_ADDRESS=' + address);
}

main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
