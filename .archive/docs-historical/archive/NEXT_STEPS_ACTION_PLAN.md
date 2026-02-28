# 🚀 下一步行动计划 - 部署和测试

**状态**: ✅ GitHub 推送完成  
**开始日期**: 2026-01-18  
**总耗时**: ~30 分钟

---

## 📋 完整行动清单

### 1️⃣ 配置部署 (5 分钟)

**目标**: 启动 PM2 集群并验证所有服务运行

**步骤**:
```bash
# 进入项目目录
cd Awareness-Market-main

# 执行完整部署脚本
bash deploy-performance-optimizations.sh

# 验证 PM2 集群启动
pm2 list
pm2 monit

# 查看构建大小验证优化效果
npm run analyze:build
```

**预期结果**:
- ✅ 4+ PM2 进程运行 (根据 CPU 核心数)
- ✅ 文件大小 580KB → 174KB (70% 缩小)
- ✅ 所有服务状态 online

**检查点**:
- [ ] PM2 进程全部 online
- [ ] 没有错误日志
- [ ] 构建大小符合预期

---

### 2️⃣ 完善登录系统 (待定)

**目标**: 增强用户认证和数据隔离

**功能需求**:

#### A. 邮箱验证系统
```typescript
// 需要实施:
- 发送验证码邮箱
- 验证邮箱地址
- 邮箱确认状态跟踪
- 重新发送验证码
```

**步骤**:
1. 配置 SMTP 服务
   ```bash
   # 参考文档
   cat SMTP_SETUP_GUIDE.md
   ```

2. 创建邮箱验证服务
   ```bash
   # 创建文件
   server/services/email-verification.ts
   ```

3. 更新用户注册流程
   - 添加邮箱验证步骤
   - 存储验证状态
   - 添加验证按钮到 UI

#### B. 用户账户数据隔离
```typescript
// 需要实施:
- 用户私密数据加密
- 用户 NFT 所有权验证
- 个人向量模型隔离
- 私有推理链隔离
```

**步骤**:
1. 审查数据库模式 (drizzle/schema.ts)
2. 添加用户隔离中间件
3. 为用户数据添加加密层
4. 验证所有 API 端点都检查用户权限

**文件清单**:
- [ ] `server/services/email-verification.ts` (新建)
- [ ] `server/middleware/user-isolation.ts` (新建/修改)
- [ ] `drizzle/schema.ts` (修改 - 添加加密字段)
- [ ] `server/routes/auth.ts` (修改 - 邮箱验证流程)

---

### 3️⃣ 获取测试币 (2 分钟)

**目标**: 获取 Avalanche Fuji 测试网络的 AVAX 代币

#### A. 访问 Avalanche Faucet
```bash
# 打开浏览器访问
https://core.app/tools/testnet-faucet/?subnet=c&token=c/

# 选择网络: Fuji Testnet
# 选择代币: AVAX (AVAX)
```

#### B. 申请测试AVAX
1. 连接 MetaMask 钱包
2. 选择 Fuji 网络
3. 填入钱包地址（如果需要）
4. 申请代币（通常 0.5-2 POL）
5. 等待交易确认 (30-60 秒)

**验证**:
```bash
# 在 MetaMask 中检查
- 网络: Fuji
- 余额: > 0AVAX
- 最近交易: Avalanche Faucet
```

**检查点**:
- [ ] 钱包已连接 MetaMask
- [ ] 选择了 Fuji 网络
- [ ] 收到测试AVAX
- [ ] 余额在 MetaMask 中可见

---

### 4️⃣ 部署合约 (10 分钟)

**目标**: 部署 Memory NFT 合约到 Avalanche Fuji

#### A. 配置 Hardhat
```bash
# 编辑 hardhat.config.ts
# 确保包含 Fuji 网络配置:
# - RPC URL: https://api.avax-test.network/ext/bc/C/rpc/
# - Chain ID: 43113
```

#### B. 设置部署账户
```bash
# 方式 1: 使用 .env 私钥
echo "DEPLOYER_PRIVATE_KEY=0x..." >> .env.local

# 方式 2: 使用 MetaMask 导出
# MetaMask → Settings → Security & Privacy → 
# Show Private Key → 复制 → 粘贴到 .env
```

#### C. 编译合约
```bash
npx hardhat compile
```

#### D. 部署到 Fuji
```bash
# 部署合约
npx hardhat run scripts/deploy.ts --network fuji

# 输出应该包含:
# - MemoryNFT deployed to: 0x...
# - Deployment transaction: 0x...
```

**预期结果**:
```
✅ MemoryNFT 合约部署成功
✅ 合约地址已获取
✅ 部署交易已确认
```

**检查点**:
- [ ] 合约编译成功
- [ ] 部署交易已发送
- [ ] 合约已验证部署
- [ ] 可以在 Fuji Snowscan 查看合约

**在 Snowscan 验证**:
```
访问: https://testnet.snowscan.xyz/
搜索: <your-contract-address>
验证合约代码（可选）
```

---

### 5️⃣ 配置环境 (2 分钟)

**目标**: 配置应用使用部署的合约

#### A. 更新环境变量
```bash
# .env.local 中添加:
VITE_MEMORY_NFT_ADDRESS=0x<deployed-address>
VITE_AVALANCHE_FUJI_RPC=https://api.avax-test.network/ext/bc/C/rpc/
VITE_AVALANCHE_CHAIN_ID=43113
```

#### B. 更新前端配置
```typescript
// client/src/config/contracts.ts
export const MEMORY_NFT_ADDRESS = import.meta.env.VITE_MEMORY_NFT_ADDRESS;
export const AVALANCHE_FUJI_RPC = import.meta.env.VITE_AVALANCHE_FUJI_RPC;
```

#### C. 重建应用
```bash
npm run build
```

**检查点**:
- [ ] 环境变量已设置
- [ ] 合约地址正确
- [ ] 构建成功完成
- [ ] 没有环境变量丢失警告

---

### 6️⃣ 测试应用 (5 分钟)

**目标**: 端到端测试完整流程

#### A. 启动应用
```bash
# 开发模式 (推荐用于测试)
npm run dev

# 或生产模式
npm run build
npm run preview
```

#### B. 测试登录流程
```
1. 打开应用 → http://localhost:5173
2. 点击登录/注册
3. 连接 MetaMask 钱包
   - 确保钱包在 Fuji 网络
   - 确保有测试AVAX
```

#### C. 测试 NFT 铸造
```
1. 导航到 "创建记忆" 页面
2. 填写数据:
   - 标题: "测试记忆"
   - 描述: "这是一个测试"
   - 向量数据: (自动生成)
3. 点击 "铸造 NFT"
4. 在 MetaMask 中确认交易
5. 等待区块确认
```

#### D. 验证 NFT
```
1. 在应用中查看 "我的 NFT"
   - 新 NFT 应该出现
2. 在 Snowscan 上查看交易
   - https://testnet.snowscan.xyz/
   - 搜索你的钱包地址
   - 验证 NFT 交易
```

**测试检查点**:
- [ ] 应用在 localhost:5173 运行
- [ ] MetaMask 连接成功
- [ ] 钱包余额显示正确
- [ ] NFT 铸造交易已发送
- [ ] NFT 在区块链上可见
- [ ] 应用中显示新 NFT
- [ ] 没有控制台错误

#### E. 测试推理链功能
```
1. 导航到 "推理市场"
2. 选择示例推理链
3. 查看推理步骤
4. 测试投票功能
5. 验证投票已记录
```

---

## 📊 时间表

| 步骤 | 预计时间 | 状态 |
|-----|--------|------|
| 配置部署 | 5 分钟 | ⏳ 开始 |
| 完善登录系统 | 待定 | ⏸ 后续 |
| 获取测试币 | 2 分钟 | ⏳ 之后 |
| 部署合约 | 10 分钟 | ⏳ 之后 |
| 配置环境 | 2 分钟 | ⏳ 之后 |
| 测试应用 | 5 分钟 | ⏳ 最后 |
| **总计** | **~30 分钟** | |

---

## 🔍 关键检查点

### 部署检查
- [ ] PM2 进程全部 online
- [ ] 没有错误日志
- [ ] 应用可访问

### 测试币检查
- [ ] 钱包已连接
- [ ] 收到 AVAX 代币
- [ ] 余额 > 0

### 合约部署检查
- [ ] 编译成功
- [ ] 部署交易已确认
- [ ] 合约在 Snowscan 可见

### 应用测试检查
- [ ] 登录/连接工作
- [ ] NFT 铸造成功
- [ ] 交易可在区块链上验证
- [ ] 应用 UI 正常显示

---

## 📝 故障排查

### 问题: PM2 进程启动失败

**原因**: 
- 依赖未安装
- 端口被占用
- 内存不足

**解决**:
```bash
# 清理并重新启动
pm2 delete all
npm ci
npm run build
bash deploy-performance-optimizations.sh
```

### 问题: MetaMask 连接失败

**原因**:
- 未安装 MetaMask
- 网络配置错误
- RPC 无法访问

**解决**:
```bash
1. 安装 MetaMask 浏览器扩展
2. 添加 Fuji 网络:
   - 网络名称: Avalanche Fuji
   - RPC URL: https://api.avax-test.network/ext/bc/C/rpc/
   - Chain ID: 43113
   - 货币符号:AVAX
3. 刷新页面重新连接
```

### 问题: NFT 铸造失败

**原因**:
- AVAX 代币不足
- 合约地址错误
- 交易超时

**解决**:
```bash
1. 检查钱包余额 (需要 > 0.01 POL)
2. 再次申请测试币
3. 检查 .env 中的合约地址
4. 增加 gas limit
```

---

## ✅ 完成标志

当以下条件都满足时，本阶段完成：

- [x] GitHub 推送完成
- [ ] PM2 集群运行正常
- [ ] 应用成功部署
- [ ] MetaMask 集成工作
- [ ] NFT 合约已部署
- [ ] 完整的 E2E 测试通过
- [ ] 应用可在生产环境使用

---

## 🎯 下一阶段

完成上述步骤后，建议继续：

1. **监控和优化** (1-2 周)
   - 监控 CloudWatch 指标
   - 优化 Nginx 缓存参数
   - 调整代码分割块大小

2. **用户反馈** (1-2 周)
   - 收集用户意见
   - 修复报告的问题
   - 优化用户体验

3. **扩展功能** (2-4 周)
   - 添加社交功能
   - 实现付款系统
   - 添加高级分析

---

**准备开始? 从第 1 步开始:** 

```bash
bash deploy-performance-optimizations.sh
```

**预计 30 分钟内完成所有测试！** 🚀
