# 快速部署和测试指南

## 📋 部署前检查清单

```
✅ Web3 集成完成
✅ 所有代码已本地提交到 Git
✅ 文档完整
✅ 测试套件就绪
⏳ 等待推送到 GitHub (网络待恢复)
```

## 🚀 分步部署指南

### 第一步：环境准备 (5 分钟)

1. **安装 MetaMask** (如未安装)
   - Chrome 扩展商店搜索 "MetaMask"
   - 创建或导入钱包

2. **配置 Polygon Amoy 网络**
   - 打开 MetaMask
   - 点击网络选择
   - 选择"Add Network"或让 WalletConnect 组件自动添加

3. **获取测试 POL**
   - 访问 [Polygon Faucet](https://faucet.polygon.technology/)
   - 选择 Amoy 网络
   - 输入你的钱包地址
   - 申请测试币（每天可申请多次）

### 第二步：部署合约 (15 分钟)

1. **配置部署环境**
   ```bash
   npm run deploy:setup
   ```
   这会启动交互式脚本，让你：
   - 导入现有私钥 或 生成新钱包
   - 配置 RPC 端点
   - 创建 `.env.local` 文件

2. **部署 NFT 合约**
   ```bash
   npm run deploy:memory-nft
   ```
   脚本会：
   - 编译 Solidity 合约
   - 验证部署环境
   - 部署到 Polygon Amoy
   - 显示合约地址

3. **保存合约地址**
   ```env
   # 在 .env.local 中更新
   VITE_MEMORY_NFT_ADDRESS=0x<deployment_address>
   REACT_APP_MEMORY_NFT_ADDRESS=0x<deployment_address>
   ```

### 第三步：测试应用 (10 分钟)

1. **启动开发服务器**
   ```bash
   npm run dev
   ```

2. **测试钱包连接**
   - 打开浏览器 http://localhost:5173
   - 找到 WalletConnect 组件（导航栏）
   - 点击"Connect Wallet"
   - 在 MetaMask 中确认连接
   - 验证显示你的地址和余额

3. **测试网络切换**
   - 打开钱包菜单
   - 验证显示"Polygon Amoy"网络
   - 如未连接，点击"Switch to Polygon Amoy"

4. **测试 NFT 功能**
   - 导航到 Memory Marketplace 页面
   - 使用钱包购买 NFT 许可证
   - 检查余额更新
   - 检查浏览器控制台的事件日志

### 第四步：验证部署 (5 分钟)

1. **验证合约在区块链上**
   ```bash
   npm run verify:contract -- <contract_address>
   ```

2. **在 Polygonscan 上查看**
   - 访问 [Amoy Polygonscan](https://amoy.polygonscan.com)
   - 搜索你的合约地址
   - 验证代码已验证

3. **测试交易**
   - 尝试购买 NFT 许可证
   - 验证 Polygonscan 上显示交易
   - 检查交易细节

## 🧪 测试场景

### 场景 1：基础钱包连接

```javascript
// 控制台测试
import { getWeb3Provider } from '@/lib/web3-provider';

const provider = getWeb3Provider();
const state = provider.getState();
console.log(state);
// 应该显示: { isConnected: true, address: "0x...", ... }
```

### 场景 2：获取 NFT 信息

```javascript
import { getMemoryNFTManager } from '@/lib/nft-contract';

const manager = getMemoryNFTManager('0x...');
const nfts = await manager.getUserNFTs('0x...');
console.log(nfts);
// 应该显示用户拥有的 NFT 列表
```

### 场景 3：购买许可证

```javascript
const manager = getMemoryNFTManager('0x...');
try {
  const txHash = await manager.buyLicense(1);
  console.log('Transaction:', txHash);
} catch (error) {
  console.error('Purchase failed:', error);
}
```

### 场景 4：监听事件

```javascript
const manager = getMemoryNFTManager('0x...');

manager.onNFTTransfer((from, to, tokenId) => {
  console.log(`NFT ${tokenId} transferred from ${from} to ${to}`);
});

manager.onLicensePurchased((tokenId, buyer, price) => {
  console.log(`License bought: Token ${tokenId}`);
});
```

## 🔍 调试技巧

### 查看钱包状态

```javascript
// 在浏览器控制台运行
import { useWeb3 } from '@/context/Web3Context';

// 注意：useWeb3 只能在 React 组件中使用
// 或者直接使用：
import { getWeb3Provider } from '@/lib/web3-provider';
const state = getWeb3Provider().getState();
console.log(state);
```

### 查看合约状态

```javascript
import { getMemoryNFTManager } from '@/lib/nft-contract';
const manager = getMemoryNFTManager('0x...');

// 获取总供应量
const supply = await manager.getTotalSupply();
console.log('Total NFTs:', supply);

// 获取用户余额
const balance = await manager.getBalance('0x...');
console.log('User NFTs:', balance);
```

### 启用详细日志

```javascript
// 在 web3-provider.ts 中取消注释 console.log
// 或者在控制台运行：
localStorage.setItem('DEBUG_WEB3', 'true');
```

## ⚠️ 常见问题和解决方案

### Q1: MetaMask 显示"User rejected"

**问题**: 用户拒绝连接请求
**解决**: 
1. 重新点击"Connect Wallet"
2. 在 MetaMask 中确认请求
3. 清除浏览器缓存后重试

### Q2: 交易显示"Insufficient balance"

**问题**: 账户没有足够的 POL 支付 gas
**解决**:
1. 从 faucet 申请更多测试币
2. 等待 confirmations
3. 检查 gas 费用

### Q3: 合约地址显示为 0x000...

**问题**: `.env.local` 中的合约地址配置错误
**解决**:
1. 验证地址格式 (以 0x 开头，40 个十六进制字符)
2. 检查地址来自 deploy 脚本的输出
3. 重启开发服务器使环境变量生效

### Q4: "Contract not initialized"错误

**问题**: MemoryNFTManager 未设置合约地址
**解决**:
```javascript
// 确保在使用前调用:
getMemoryNFTManager('0x...');
```

### Q5: 网络切换失败

**问题**: 无法切换到 Polygon Amoy
**解决**:
1. 检查 RPC URL 正确性
2. 手动在 MetaMask 中添加网络
3. 重新启动 MetaMask
4. 尝试 [Polygonscan 一键添加](https://amoy.polygonscan.com)

## 📊 验证清单

部署后验证以下所有项：

- [ ] 钱包连接成功
  - [ ] 显示正确的地址
  - [ ] 显示正确的 MATIC 余额
  - [ ] 显示"Polygon Amoy"网络

- [ ] 合约部署成功
  - [ ] 合约地址有效
  - [ ] 合约代码在 Polygonscan 上可见
  - [ ] 可以查询合约状态

- [ ] NFT 功能正常
  - [ ] 可以查询 NFT 信息
  - [ ] 可以获取用户 NFT
  - [ ] 可以购买许可证
  - [ ] 事件被正确捕获

- [ ] UI 组件正常
  - [ ] WalletConnect 显示正确
  - [ ] 按钮响应正常
  - [ ] 菜单展开/关闭正常
  - [ ] 移动端布局正确

## 🎯 后续步骤

### 立即（部署后）
1. ✅ 验证所有测试场景通过
2. ✅ 检查浏览器控制台无错误
3. ✅ 记录合约地址供生产使用

### 1-2 天内
1. 集成支付网关（Stripe）
2. 完善 MemoryMarketplace UI
3. 添加更多 NFT 功能

### 1 周内
1. 性能优化
2. 安全审计
3. 用户体验测试
4. 生产环境部署

## 📞 获取帮助

如遇到问题：

1. **检查文档**
   - [WEB3_INTEGRATION_GUIDE.md](./docs/WEB3_INTEGRATION_GUIDE.md) - 详细 API 文档
   - [DEPLOYMENT_MEMORY_NFT.md](./docs/DEPLOYMENT_MEMORY_NFT.md) - 部署指南

2. **查看代码示例**
   - [Web3Examples.tsx](./client/src/components/Web3Examples.tsx) - 5 个完整示例
   - [web3.test.ts](./client/src/lib/web3.test.ts) - 测试用例

3. **浏览器控制台**
   - 检查是否有错误消息
   - 使用 `console.log(state)` 调试状态

## 🔐 安全提示

- ⚠️ **永远不要** 在代码中硬编码私钥
- ⚠️ **永远不要** 在公共 Git 仓库中提交 `.env.local`
- ⚠️ **使用** `.env.local.example` 作为模板
- ⚠️ **定期** 轮换测试账户
- ✅ **使用** 强密码保护私钥
- ✅ **验证** 所有交易细节

## 📈 性能优化建议

1. **缓存合约实例**
   ```javascript
   // 已在 MemoryNFTManager 中实现
   // 使用全局实例: getMemoryNFTManager()
   ```

2. **批量查询**
   ```javascript
   // 同时查询多个 NFT
   const promises = nftIds.map(id => manager.getNFTInfo(id));
   const results = await Promise.all(promises);
   ```

3. **事件去抖动**
   ```javascript
   // 在处理事件时添加节流
   const throttledHandler = throttle(handler, 1000);
   ```

---

**部署状态**: ✅ 已准备就绪 | 🚀 可立即执行 | 📊 预计 30 分钟完成
