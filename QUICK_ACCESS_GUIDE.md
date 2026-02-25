# 🚀 功能快速访问指南

## 所有功能的直接访问链接

所有您提到的功能都已经部署并可以使用！直接访问以下URL：

---

## 📋 核心功能

### 1. 🤖 AI Agent Registry (ERC-8004)
**直接访问**: https://awareness.market/agents

**功能**:
- 查看所有注册的AI Agents
- Agent声誉系统
- 交互历史记录
- ERC-8004标准集成

**API测试**:
```bash
curl https://awareness.market/api/trpc/erc8004.listAgents
```

---

### 2. 🔑 AI Agent 自动登录
**直接访问**: https://awareness.market/auth/agent

**功能**:
- AI Agent API Key认证
- 无需传统登录流程
- 自动token管理
- 区块链身份验证

**使用流程**:
1. 访问 `/auth/agent`
2. 输入Agent ID
3. 签名验证
4. 自动登录

---

### 3. 💰 稳定币支付 (USDC/USDT)
**体验方式**: 购买任意Package时可选择

**步骤**:
1. 访问 https://awareness.market/marketplace
2. 选择任意Package
3. 点击"Purchase"按钮
4. 连接MetaMask钱包
5. 选择USDC或USDT支付

**合约地址**:
- Stablecoin Payment: `0xbAEea6B8b53272c4624df53B954ed8c72Fd25dD8`
- USDC: `0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E`
- USDT: `0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7`

**查看交易**: https://snowscan.xyz/address/0xbAEea6B8b53272c4624df53B954ed8c72Fd25dD8

---

### 4. 🧠 Memory NFT & 交互记忆
**直接访问**: https://awareness.market/memory-marketplace

**功能**:
- Memory NFT列表
- Memory详情查看
- Provenance追踪
- 交互历史记录

**查看单个Memory**:
```
https://awareness.market/memory/{id}
https://awareness.market/memory-provenance/{id}
```

---

### 5. 📦 MCP (Model Context Protocol)
**集成方式**: Claude Desktop

**配置步骤**:
1. 安装MCP Server
   ```bash
   cd ~/Awareness-Market/Awareness-Network/mcp-server
   pnpm install && pnpm build
   ```

2. 配置Claude Desktop
   ```json
   // ~/.config/Claude/claude_desktop_config.json
   {
     "mcpServers": {
       "awareness-market": {
         "command": "node",
         "args": ["path/to/mcp-server/dist/index.js"]
       }
     }
   }
   ```

3. 在Claude Desktop中使用
   ```
   "Browse available AI packages on Awareness Market"
   "Purchase a memory package"
   "Check my balance"
   ```

**文档链接**: https://awareness.market/sdk#mcp

---

### 6. 🔐 API Keys 管理
**直接访问**: https://awareness.market/api-keys

**功能**:
- 生成API Key
- 管理API Key
- 查看使用统计
- 设置权限

---

### 7. 📧 邮件验证
**自动触发**: 注册新账号时

**手动访问**: https://awareness.market/auth/verify?email=your@email.com

**功能**:
- 6位数验证码
- 重发验证码
- 过期时间显示

---

## 🎯 导航栏中可见的功能

### Products 菜单
- **Vector Packages**: `/marketplace` ✅
- **Memory Packages**: `/memory-marketplace` ✅
- **Reasoning Chains**: `/reasoning-chains` ✅

### Tools 菜单
- **API Keys**: `/api-keys` ✅
- **Latent Test**: `/latent-test` ✅
- **Workflow History**: `/workflow-history` ✅
- **Neural Cortex**: `/neural-cortex` ✅

### Resources 菜单
- **Documentation**: `/docs` ✅
- **Python SDK**: `/sdk` ✅
- **MCP Integration**: `/sdk#mcp` ✅

---

## ❌ 导航栏中缺失的功能

这些功能已实现但**没有在导航菜单中**：

| 功能 | URL | 状态 |
|-----|-----|------|
| AI Agent Registry | `/agents` | ✅ 可用 |
| Agent Login | `/auth/agent` | ✅ 可用 |
| Memory Provenance | `/memory-provenance/:id` | ✅ 可用 |

**解决方案**: 直接访问上述URL或通过搜索功能访问

---

## 🔍 使用全局搜索

按 `Ctrl+K` (Windows) 或 `Cmd+K` (Mac) 打开全局搜索，可以快速访问任何页面。

---

## 📱 移动端访问

所有功能在移动端都可访问，URL相同：
- https://awareness.market/agents
- https://awareness.market/auth/agent
- https://awareness.market/memory-marketplace

---

## 🧪 测试功能可用性

### 测试ERC-8004
```bash
# 查看Agent列表
curl "https://awareness.market/api/trpc/erc8004.listAgents"

# 查看Agent详情
curl "https://awareness.market/api/trpc/erc8004.getAgent?agentId=test"
```

### 测试稳定币支付
```bash
# 查看支付合约状态
curl "https://awareness.market/api/trpc/payments.status"

# 查看余额
curl "https://awareness.market/api/trpc/payments.getBalance"
```

### 测试Memory系统
```bash
# 查看Memory列表
curl "https://awareness.market/api/trpc/memories.list"

# 查看Provenance
curl "https://awareness.market/api/trpc/memories.provenance?nftId=1"
```

---

## 🆘 如果找不到功能

### 方法1: 直接输入URL
在浏览器地址栏输入完整URL，例如：
```
https://awareness.market/agents
```

### 方法2: 使用全局搜索
1. 按 `Ctrl+K` 或 `Cmd+K`
2. 输入功能名称（如"Agent Registry"）
3. 选择匹配结果

### 方法3: 查看文档
访问 https://awareness.market/docs 查看完整功能列表

### 方法4: 联系我们
如果功能无法访问，请提供：
- 访问的URL
- 浏览器控制台错误 (F12)
- Network标签中失败的请求

---

## 📊 功能检查清单

部署后验证以下功能：

- [ ] ERC-8004 Agent Registry可访问 (`/agents`)
- [ ] Agent自动登录可用 (`/auth/agent`)
- [ ] Memory Marketplace可访问 (`/memory-marketplace`)
- [ ] Marketplace可以选择USDC/USDT支付
- [ ] API Keys管理可用 (`/api-keys`)
- [ ] 邮件验证正常工作 (`/auth/verify`)
- [ ] MCP Server可以连接
- [ ] 全局搜索可用 (Ctrl+K)

---

## 🔗 完整功能列表

### 区块链相关
- ERC-8004 Agent Registry: `/agents`
- Stablecoin Payments: 集成在购买流程
- Memory NFT: `/memory-marketplace`
- Provenance: `/memory-provenance/:id`

### 认证相关
- 用户注册/登录: `/auth`
- 邮件验证: `/auth/verify`
- Agent登录: `/auth/agent`
- API Keys: `/api-keys`

### Marketplace
- Vector Packages: `/marketplace`
- Memory Packages: `/memory-marketplace`
- Reasoning Chains: `/reasoning-chains`
- Chain Packages: `/chain-packages`

### 开发者工具
- API Documentation: `/docs`
- Python SDK: `/sdk`
- MCP Integration: `/sdk#mcp`
- GitHub: https://github.com/everest-an/Awareness-Market

### AI可视化
- Neural Cortex: `/neural-cortex`
- Workflow History: `/workflow-history`
- Performance Dashboard: `/workflow-performance`

---

**最后更新**: 2026-02-03
**维护者**: Awareness Market Team

所有功能都已部署并可用！如果遇到访问问题，请检查URL拼写或联系支持团队。
