#!/usr/bin/env node

/**
 * MemoryNFT Contract Deployment Helper
 * 这个脚本帮助你:
 * 1. 生成新钱包 (如果需要)
 * 2. 配置 .env.local
 * 3. 部署合约到 Avalanche Fuji
 */

import { ethers } from 'ethers';
import * as fs from 'fs/promises';
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function generateWallet() {
  console.log('\n🔑 生成新钱包...\n');
  const wallet = ethers.Wallet.createRandom();

  console.log('✅ 钱包已生成!\n');
  console.log('地址:', wallet.address);
  console.log('私钥:', wallet.privateKey);
  console.log('\n⚠️  保妥善保管私钥！\n');

  return wallet;
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║       MemoryNFT 部署助手 (Avalanche Fuji 测试网)            ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  // 检查 .env.local
  let hasEnv = false;
  try {
    await fs.access('.env.local');
    hasEnv = true;
    console.log('✅ .env.local 已存在\n');
  } catch {
    console.log('⚠️  .env.local 不存在，将创建\n');
  }

  // 选择方式
  console.log('选择部署方式:\n');
  console.log('1. 使用已有的钱包 (MetaMask 导出的私钥)');
  console.log('2. 生成新钱包');
  console.log('3. 检查现有 .env.local 配置');
  console.log('4. 直接运行部署脚本\n');

  const choice = await question('选择 (1-4): ');

  switch(choice.trim()) {
    case '1': {
      // 导入已有私钥
      const privateKey = await question('\n输入私钥 (0x 开头): ');
      if (!privateKey.startsWith('0x') || privateKey.length !== 66) {
        console.error('❌ 私钥格式错误！');
        process.exit(1);
      }

      // 验证私钥
      try {
        const wallet = new ethers.Wallet(privateKey);
        console.log('\n✅ 私钥有效');
        console.log('   地址:', wallet.address);

        // 写入 .env.local
        const envContent = `# Avalanche Fuji Testnet Configuration
DEPLOYER_PRIVATE_KEY=${privateKey}
FUJI_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
MEMORY_NFT_CONTRACT_ADDRESS=
MEMORY_NFT_ABI_PATH=./artifacts/contracts/MemoryNFT.sol/MemoryNFT.json
DATABASE_URL=postgresql://user:password@localhost:5432/awareness_market
NODE_ENV=development
`;

        await fs.writeFile('.env.local', envContent);
        console.log('\n✅ .env.local 已更新');
        console.log('\n下一步: 获取 Fuji 测试币');
        console.log('  1. 访问: https://core.app/tools/testnet-faucet/?subnet=c&token=c');
        console.log('  2. 选择 Avalanche Fuji');
        console.log('  3. 输入地址:', wallet.address);
        console.log('  4. 获得测试币后，运行: npm run deploy:fuji');

      } catch (error) {
        console.error('❌ 私钥无效:', error.message);
        process.exit(1);
      }
      break;
    }

    case '2': {
      // 生成新钱包
      const wallet = await generateWallet();

      const envContent = `# Avalanche Fuji Testnet Configuration
DEPLOYER_PRIVATE_KEY=${wallet.privateKey}
FUJI_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
MEMORY_NFT_CONTRACT_ADDRESS=
MEMORY_NFT_ABI_PATH=./artifacts/contracts/MemoryNFT.sol/MemoryNFT.json
DATABASE_URL=postgresql://user:password@localhost:5432/awareness_market
NODE_ENV=development
`;

      await fs.writeFile('.env.local', envContent);
      console.log('✅ .env.local 已创建\n');
      console.log('下一步: 获取 Fuji 测试币');
      console.log('  1. 访问: https://core.app/tools/testnet-faucet/?subnet=c&token=c');
      console.log('  2. 选择 Avalanche Fuji');
      console.log('  3. 输入地址:', wallet.address);
      console.log('  4. 获得测试币后，运行: npm run deploy:fuji');
      break;
    }

    case '3': {
      // 检查配置
      try {
        const envContent = await fs.readFile('.env.local', 'utf-8');
        const lines = envContent.split('\n');

        console.log('\n当前 .env.local 配置:\n');
        lines.forEach(line => {
          if (line.startsWith('DEPLOYER_PRIVATE_KEY')) {
            const key = line.split('=')[1];
            console.log('DEPLOYER_PRIVATE_KEY:', key ? '✅ 已设置' : '❌ 未设置');
          } else if (line.startsWith('FUJI_RPC_URL')) {
            const url = line.split('=')[1];
            console.log('FUJI_RPC_URL:', url || '❌ 未设置');
          } else if (line.startsWith('MEMORY_NFT_CONTRACT_ADDRESS')) {
            const addr = line.split('=')[1];
            console.log('MEMORY_NFT_CONTRACT_ADDRESS:', addr ? '✅ ' + addr : '❌ 未设置');
          }
        });
      } catch (error) {
        console.error('❌ 无法读取 .env.local:', error.message);
      }
      break;
    }

    case '4': {
      console.log('\n运行部署脚本...\n');
      const { spawn } = await import('child_process');

      const deploy = spawn('npm', ['run', 'deploy:fuji'], {
        stdio: 'inherit',
        shell: true
      });

      deploy.on('close', (code) => {
        process.exit(code);
      });
      break;
    }

    default:
      console.error('❌ 无效选择');
      process.exit(1);
  }

  rl.close();
}

main().catch(error => {
  console.error('❌ 错误:', error);
  rl.close();
  process.exit(1);
});
