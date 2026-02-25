# 🚀 MemoryNFT 智能合约部署指南

## 📋 目标
部署 MemoryNFT 合约到 Avalanche Fuji 测试网，获得合约地址和 ABI，以便前端集成。

## ⏱️ 预计时间
- 准备钱包: 5 分钟
- 获取测试币: 10-30 分钟 (等待 faucet)
- 部署合约: 2-3 分钟
- **总计**: 20-40 分钟

---

## 📚 前置条件

✅ 已完成:
- 合约代码已编写 (contracts/MemoryNFT.sol)
- 部署脚本已准备 (scripts/deploy/deploy-to-fuji.mjs)
- Node.js 和 npm 已安装

需要:
- Avalanche Fuji 测试网的 AVAX 代币 (约 0.05-0.1 POL)
- MetaMask 或其他以太坊钱包

---

## 🔧 部署步骤

### 步骤 1: 设置部署钱包

**选项 A: 使用 MetaMask (推荐)**

1. 打开 MetaMask
2. 确保切换到 Avalanche Fuji 网络
3. 点击菜单 → 账户详情 → 导出私钥
4. 复制私钥 (格式: 0x开头的64个16进制字符)

**选项 B: 生成新钱包**

运行部署助手:
```bash
node scripts/deploy/setup-deploy.mjs
```

选择选项 2 (生成新钱包)，脚本会为你生成钱包并保存到 .env.local

---

### 步骤 2: 创建 .env.local 配置

创建文件 `.env.local`:

```env
# ⚠️ 替换为你的实际私钥！不要在 git 中提交！
DEPLOYER_PRIVATE_KEY=0x0000000000000000000000000000000000000000000000000000000000000000

# Avalanche Fuji RPC (已配置，无需修改)
FUJI_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc/
```

或者直接使用设置工具:
```bash
node scripts/deploy/setup-deploy.mjs
```

---

### 步骤 3: 获取 Avalanche Fuji 测试币

1. 访问 faucet: https://core.app/tools/testnet-faucet/?subnet=c&token=c/
2. 选择网络: **Avalanche Fuji**
3. 输入钱包地址 (来自 MetaMask 或生成的)
4. 点击 "Submit"
5. 等待 10-30 分钟，你会收到 0.5-1AVAX

**查看余额:**
```bash
# 或者在 MetaMask 中查看
# 确保选择了 Avalanche Fuji 网络
```

---

### 步骤 4: 编译合约

```bash
npm install

# 编译 Solidity 合约
npx hardhat compile
```

输出应该显示:
```
Compiling 1 file with 0.8.19
MemoryNFT.sol

✅ Compiled successfully
```

---

### 步骤 5: 部署合约

```bash
# 使用部署脚本
npx hardhat run scripts/deploy/deploy-to-fuji.mjs --network fuji
```

或者直接运行 JavaScript 版本:
```bash
node scripts/deploy/deploy-to-fuji.mjs
```

部署输出示例:
```
╔══════════════════════════════════════════════════════════╗
║  Deploying MemoryNFT to Avalanche Fuji Testnet            ║
╚══════════════════════════════════════════════════════════╝

Connecting to Fuji RPC: https://api.avax-test.network/ext/bc/C/rpc/
Deploying with account: 0x1234...5678
Account balance: 0.75AVAX

Loading compiled contract...
Contract size: 8.2 KB

📡 Deploying MemoryNFT contract...
⏳ Transaction hash: 0xabcd...1234
⏳ Waiting for confirmation... (this may take 30-60 seconds)

✅ Contract deployed successfully!

📊 Deployment Summary:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Contract Address: 0xabcd1234567890abcd1234567890abcd12345678
Network: Avalanche Fuji
Transaction Hash: 0xabcd...1234
Gas Used: 2,345,678
Deployer: 0x1234...5678
Timestamp: 2026-01-17 12:34:56 UTC

✨ Next Steps:
1. Update MEMORY_NFT_CONTRACT_ADDRESS in .env.local
2. Update frontend with contract address
3. Test minting an NFT
4. Verify contract on Snowscan

🔍 View on Snowscan:
https://testnet.snowscan.xyz/address/0xabcd1234567890abcd1234567890abcd12345678
```

---

### 步骤 6: 保存部署信息

部署成功后，脚本会输出合约地址。更新 `.env.local`:

```env
DEPLOYER_PRIVATE_KEY=0x...

# 从部署输出复制过来
MEMORY_NFT_CONTRACT_ADDRESS=0xabcd1234567890abcd1234567890abcd12345678
```

---

## 🔍 验证部署

### 方式 1: 在 Snowscan 上查看

1. 访问: https://testnet.snowscan.xyz/
2. 输入合约地址
3. 应该能看到 "MemoryNFT" 合约

### 方式 2: 调用合约方法

```bash
# 测试 read 操作
cast call YOUR_CONTRACT_ADDRESS "name()" --rpc-url https://api.avax-test.network/ext/bc/C/rpc/

# 输出: 0x... (返回 "MemoryNFT")
```

### 方式 3: 前端集成测试

集成到前端后，访问:
```
/memory-marketplace
```

应该能看到市场页面加载（如果已连接钱包）。

---

## ⚙️ 合约功能一览

部署后的合约支持:

```solidity
// 核心功能
- name() → "MemoryNFT"
- symbol() → "MNFT"
- totalSupply() → 0 (初始)

// 创建 Memory 包
- createMemoryPackage(name, description, price, royalty)

// 购买并 Mint NFT
- purchaseWithNative() - 用原生币购买
- purchaseWithToken(token, amount) - 用 ERC-20 token 购买
- purchaseMem oryNFT(packageId) - 直接购买

// 查询
- balanceOf(address) - 查询 NFT 数量
- ownerOf(tokenId) - 查询 NFT 所有者
- tokenURI(tokenId) - 查询 NFT 元数据

// 版税和分配
- getRoyaltyInfo(tokenId, salePrice) - 获取版税信息
- distributeRoyalties(tokenId, amount) - 分配版税
```

---

## 🐛 常见问题

### Q1: 部署失败 - "Account has 0 POL"

**解决**: 去 faucet 获取测试币:
https://core.app/tools/testnet-faucet/?subnet=c&token=c/

### Q2: 部署失败 - "privateKey is invalid"

**解决**: 检查 `.env.local` 中的私钥格式，应该是 `0x` 开头的 64 个字符

### Q3: 部署失败 - "Contract code is invalid"

**解决**: 重新编译合约
```bash
npx hardhat compile --force
```

### Q4: 部署成功但地址为 0x0

**解决**: 这通常是合约部署失败的信号。检查:
1. 账户是否有足够的AVAX
2. 合约代码是否有语法错误
3. Gas 限制是否足够

---

## 📞 下一步

部署完成后:

1. ✅ **保存合约地址**
   - 更新 `.env.local` 中的 `MEMORY_NFT_CONTRACT_ADDRESS`
   - 保存到安全的地方

2. ✅ **集成到前端**
   - 使用合约地址更新前端配置
   - 集成 MetaMask 钱包

3. ✅ **测试 NFT 铸造**
   - 在前端创建 Memory Package
   - 测试购买和铸造 NFT

4. ✅ **验证链上数据**
   - 在 Snowscan 上查看交易
   - 检查版税分配是否正确

---

## 📄 相关文件

- 合约源码: `contracts/MemoryNFT.sol`
- 部署脚本: `scripts/deploy/deploy-to-fuji.mjs`
- 设置工具: `scripts/deploy/setup-deploy.mjs`
- 硬件配置: `hardhat.config.ts`

---

## 🔒 安全提示

⚠️ **重要**:
- 永远不要在 git 中提交 `.env.local`
- 不要在代码中硬编码私钥
- 使用测试网络进行测试
- 定期检查合约安全审计

---

**部署完成后，你将拥有完整的 NFT 交易系统！** 🎉
