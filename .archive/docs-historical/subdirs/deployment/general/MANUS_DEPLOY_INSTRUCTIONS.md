# Manus 部署指令 - 剩余 3 个智能合约

## 🎯 任务概述

部署以下 3 个智能合约到 Avalanche C-Chain:
1. **MemoryNFT** - ERC-721 with ERC-6551 TBA
2. **AMEMToken** - ERC-20 治理代币
3. **AgentCreditSystem** - Agent 信用支付系统

---

## ✅ 前置条件确认

- [x] 平台金库地址: `0x3d0ab53241A2913D7939ae02f7083169fE7b823B` (everestan.eth)
- [x] 部署脚本已修复构造函数参数
- [x] .env 安全检查通过
- [ ] EC2 上有 DEPLOYER_PRIVATE_KEY 配置
- [ ] 部署钱包有至少 0.5 AVAX (gas 费用)

---

## 🚀 执行步骤

### 1. SSH 登录到 EC2

```bash
ssh ec2-user@44.220.181.78
```

### 2. 进入项目目录

```bash
cd ~/Awareness-Market/Awareness-Network
```

### 3. 拉取最新代码

```bash
git pull origin main
```

**预期输出**:
```
From https://github.com/everest-an/Awareness-Market
 * branch            main       -> FETCH_HEAD
Already up to date. (或显示更新的文件)
```

### 4. 确认环境变量

```bash
# 检查 DEPLOYER_PRIVATE_KEY 是否配置
grep "DEPLOYER_PRIVATE_KEY" .env | head -c 30
```

**预期输出**:
```
DEPLOYER_PRIVATE_KEY=0x...
```

如果未配置，需要添加：
```bash
echo "DEPLOYER_PRIVATE_KEY=你的私钥" >> .env
```

### 5. 检查钱包余额

```bash
# 安装依赖（如果需要）
pnpm install

# 使用 Hardhat console 检查余额
pnpm hardhat console --network avalanche
```

在 console 中执行：
```javascript
const [deployer] = await ethers.getSigners();
console.log("Deployer:", deployer.address);

const balance = await ethers.provider.getBalance(deployer.address);
console.log("Balance:", ethers.formatEther(balance), "POL");

// 应该显示:
// Deployer: 0x3d0ab53241A2913D7939ae02f7083169fE7b823B
// Balance: 250.78 AVAX (或其他数值)

// 退出 console
.exit
```

**确认**: 余额至少有 0.5AVAX

### 6. 编译智能合约

```bash
pnpm hardhat compile
```

**预期输出**:
```
Compiling 5 files with 0.8.20
Compilation finished successfully
```

### 7. 🎯 执行部署脚本

```bash
pnpm tsx scripts/deploy-remaining-contracts.ts
```

**预期部署流程**:

```
🚀 Deploying Remaining Smart Contracts...

Network: avalanche (Chain ID: 43114)
RPC: https://avalanche-rpc.com
Platform Treasury: 0x3d0ab53241A2913D7939ae02f7083169fE7b823B
Maintainer Pool: 0x3d0ab53241A2913D7939ae02f7083169fE7b823B

Deployer: 0x3d0ab53241A2913D7939ae02f7083169fE7b823B
Balance: 250.78AVAX
Gas Price: 45.5 Gwei
Priority Fee: 30.2 Gwei

📦 1/3: Deploying MemoryNFT...
   Transaction: 0xabc123def456...
   ✅ Deployed: 0x1234567890abcdef1234567890abcdef12345678

📦 2/3: Deploying AMEMToken...
   Transaction: 0xfed654cba321...
   ✅ Deployed: 0x234567890abcdef1234567890abcdef123456789

📦 3/3: Deploying AgentCreditSystem...
   Transaction: 0x789abcdef012...
   ✅ Deployed: 0x34567890abcdef1234567890abcdef1234567890

🎉 All contracts deployed successfully!

📝 Deployment Summary:
==========================================
Network: avalanche (Chain ID: 43114)

Deployed Contracts:
  MEMORY_NFT_CONTRACT_ADDRESS=0x1234567890abcdef...
  AMEM_TOKEN_CONTRACT_ADDRESS=0x234567890abcdef1...
  AGENT_CREDIT_CONTRACT_ADDRESS=0x34567890abcdef1...

📄 Updating DEPLOYED_CONTRACTS.md...
   ✅ Updated DEPLOYED_CONTRACTS.md

🎯 Next Steps:

1. Update .env file:

   MEMORY_NFT_CONTRACT_ADDRESS=0x1234567890abcdef...
   AMEM_TOKEN_CONTRACT_ADDRESS=0x234567890abcdef1...
   AGENT_CREDIT_CONTRACT_ADDRESS=0x34567890abcdef1...

2. Verify contracts on Snowscan:

   npx hardhat verify --network avalanche 0x1234... "0x000000006551c19487814612e58FE06813775758"
   npx hardhat verify --network avalanche 0x2345... "0x3d0ab...823B" "0x3d0ab...823B"
   npx hardhat verify --network avalanche 0x3456... "0x2345..." "0x3d0ab...823B"

3. Test contract integration:

   - Restart backend server
   - Test Memory NFT minting
   - Test AMEM token operations
   - Test agent credit scoring

✨ Done!
```

### 8. 更新 .env 文件

```bash
nano .env
```

添加部署输出的合约地址：
```bash
MEMORY_NFT_CONTRACT_ADDRESS=0x[部署输出的地址]
AMEM_TOKEN_CONTRACT_ADDRESS=0x[部署输出的地址]
AGENT_CREDIT_CONTRACT_ADDRESS=0x[部署输出的地址]
```

保存并退出 (Ctrl+X, Y, Enter)

### 9. 重启后端服务

```bash
pm2 restart awareness-backend
```

### 10. 验证合约 (可选但推荐)

```bash
# 复制部署输出的验证命令，例如:
npx hardhat verify --network avalanche 0x1234... "0x000000006551c19487814612e58FE06813775758"
npx hardhat verify --network avalanche 0x2345... "0x3d0ab53241A2913D7939ae02f7083169fE7b823B" "0x3d0ab53241A2913D7939ae02f7083169fE7b823B"
npx hardhat verify --network avalanche 0x3456... "0x2345..." "0x3d0ab53241A2913D7939ae02f7083169fE7b823B"
```

---

## 📊 部署后验证

### A. 在 Snowscan 上查看合约

```bash
# MemoryNFT
https://snowscan.com/address/0x[MEMORY_NFT_ADDRESS]

# AMEMToken
https://snowscan.com/address/0x[AMEM_TOKEN_ADDRESS]

# AgentCreditSystem
https://snowscan.com/address/0x[AGENT_CREDIT_ADDRESS]
```

### B. 测试 API 集成

```bash
# 测试 Memory NFT API
curl http://localhost:3001/api/trpc/memoryNFT.browse | jq

# 测试 $AMEM Token 信息
curl http://localhost:3001/api/trpc/token.info | jq
```

### C. 检查平台金库地址

```bash
# 查看你的钱包 (everestan.eth)
https://snowscan.com/address/0x3d0ab53241A2913D7939ae02f7083169fE7b823B

# 应该看到:
# - 合约部署交易 (3 笔新交易)
# - Gas 费用消耗 (约 0.3-0.5 POL)
```

---

## ⚠️ 可能遇到的问题

### 问题 1: 余额不足

**错误信息**:
```
Error: insufficient funds for intrinsic transaction cost
```

**解决方案**:
```bash
# 向部署钱包充值AVAX
# 地址: 0x3d0ab53241A2913D7939ae02f7083169fE7b823B
# 建议充值: 1 AVAX (当前只有 0.25 POL)
```

### 问题 2: Gas 价格过高

**错误信息**:
```
Error: transaction underpriced
```

**解决方案**:
```bash
# 等待 10-15 分钟后重试
# 或者修改脚本中的 gas multiplier (从 1.5x 改为 2x)
```

### 问题 3: Nonce 冲突

**错误信息**:
```
Error: nonce too low
```

**解决方案**:
```bash
# 重新运行部署脚本即可，ethers.js 会自动处理
pnpm tsx scripts/deploy-remaining-contracts.ts
```

### 问题 4: RPC 限流

**错误信息**:
```
Error: Too Many Requests
```

**解决方案**:
```bash
# 在 .env 中使用备用 RPC
AVALANCHE_RPC_URL=https://avalanche.llamarpc.com
# 或
AVALANCHE_RPC_URL=https://api.avax.network/ext/bc/C/rpc
```

---

## 📋 部署完成检查清单

完成后请确认：

- [ ] 3 个合约全部部署成功
- [ ] .env 文件已更新合约地址
- [ ] 后端服务已重启
- [ ] API 调用正常响应
- [ ] Snowscan 上可以看到合约
- [ ] 合约已验证 (源代码可见)
- [ ] 平台金库地址正确 (everestan.eth)

---

## 🎉 部署成功后

请将以下信息反馈给我：

```
✅ 部署完成报告

MemoryNFT 地址: 0x...
AMEMToken 地址: 0x...
AgentCreditSystem 地址: 0x...

Snowscan 链接:
- https://snowscan.com/address/0x...
- https://snowscan.com/address/0x...
- https://snowscan.com/address/0x...

部署交易总 Gas 费用: X.XXAVAX
剩余钱包余额: X.XXAVAX
```

---

## 📞 需要帮助?

如果遇到任何问题，请提供：
1. 完整的错误信息
2. 部署脚本输出
3. 当前钱包余额
4. Gas 价格 (Gwei)

我会立即协助解决！🚀
