# WebMCP & ERC-8004 状态检查报告

**日期**: 2026-02-13
**检查项**: AI 登录格式 + ERC-8004 工作状态

---

## 🔍 问题 1: AI 登录会显示 MD 或 JSON 格式吗？

### ✅ 答案：JSON 格式（标准 RESTful API）

WebMCP 和所有 AI 认证端点都返回 **JSON 格式**，不返回 Markdown 或纯文本。

### 响应格式示例

#### 1. MCP Token 验证
```http
POST /api/mcp/auth/verify
Content-Type: application/json
```

**响应** (JSON):
```json
{
  "success": true,
  "sessionId": "sess_1234567890_abcdef",
  "userId": 1,
  "capabilities": ["read", "write_with_confirmation"],
  "expiresAt": "2026-02-14T10:30:00Z",
  "tokenPrefix": "mcp_abc"
}
```

#### 2. MCP 发现向量
```http
GET /api/mcp/discover
```

**响应** (JSON):
```json
{
  "protocol": "MCP/1.0",
  "vectors": [
    {
      "id": 123,
      "name": "BERT-Sentiment-V2",
      "description": "...",
      "category": "nlp",
      "performance": {...}
    }
  ],
  "total": 10
}
```

#### 3. ERC-8004 Nonce 生成
```http
POST /api/erc8004/nonce
```

**响应** (JSON):
```json
{
  "success": true,
  "nonce": "0x1234...",
  "message": "Sign this message to authenticate...",
  "expiresAt": "2026-02-13T10:35:00Z"
}
```

### 为什么使用 JSON？

1. **标准化** - RESTful API 标准格式
2. **易解析** - AI Agents 可以直接解析
3. **类型安全** - 支持验证和类型检查
4. **互操作性** - 所有编程语言都支持

### AI Agent 如何处理？

AI Agent（如 Claude Desktop）会：
1. 发送 HTTP 请求到 API 端点
2. 接收 JSON 响应
3. 解析 JSON 数据
4. 提取需要的信息
5. 以**自然语言**向用户展示（Markdown 格式）

**流程**:
```
API (JSON) → AI Agent (解析) → 用户 (Markdown/自然语言)
```

### 示例：Claude Desktop 处理流程

```typescript
// 1. AI Agent 调用 API
const response = await fetch('/api/mcp/discover');
const data = await response.json();  // JSON 格式

// 2. AI Agent 解析数据
const vectors = data.vectors;

// 3. AI 以 Markdown 格式展示给用户
const markdown = `
I found ${data.total} vectors:

1. **${vectors[0].name}** (${vectors[0].category})
   - Rating: ${vectors[0].rating}/5
   - Price: $${vectors[0].pricing.base_price}
`;

// 用户看到的是 Markdown，而不是原始 JSON
```

---

## 🔍 问题 2: ERC-8004 是否正常工作？

### ⚠️ 状态：部分实现，需要配置

ERC-8004 代码已完整实现，但需要以下配置才能正常工作。

### 现有实现 ✅

#### 1. 后端 API 端点
- ✅ `GET /api/erc8004/status` - 获取配置状态
- ✅ `POST /api/erc8004/nonce` - 生成认证 nonce
- ✅ `POST /api/erc8004/authenticate` - 钱包签名认证
- ✅ `GET /api/erc8004/agent/:agentId` - 获取链上 Agent 信息

#### 2. 认证逻辑
- ✅ 钱包签名验证（`auth-erc8004.ts`）
- ✅ JWT Token 生成
- ✅ Nonce 防重放攻击
- ✅ 链上 Agent 信息查询

#### 3. 智能合约
- ✅ ERC-8004 Registry 合约代码
- ✅ Agent 注册功能
- ✅ 声誉系统
- ✅ 能力验证

### 待配置项 ⏳

#### 1. 环境变量（.env）

需要在 `.env` 文件中添加：

```bash
# ERC-8004 配置
ERC8004_REGISTRY_ADDRESS=0x...  # 合约地址（需要部署）
AVALANCHE_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
# 或
AVALANCHE_RPC_URL=https://api.avax.network/ext/bc/C/rpc

# JWT 签名密钥
JWT_SECRET=your_secret_key_here
```

#### 2. 智能合约部署

合约尚未部署到链上。需要执行：

```bash
cd "e:\Awareness Market\Awareness-Network"

# 编译合约
npx hardhat compile

# 部署到测试网（Avalanche Fuji）
npx hardhat run scripts/deploy/deploy-erc8004.ts --network avalanche-fuji

# 或部署到主网
npx hardhat run scripts/deploy/deploy-erc8004.ts --network avalanche-mainnet
```

部署后会得到合约地址，填入 `ERC8004_REGISTRY_ADDRESS`。

#### 3. 数据库 Schema

确认数据库包含以下表：
- `users` - 用户表（包含 wallet_address 字段）
- `agent_identities` - Agent 身份表（可选）

检查：
```bash
npx prisma studio
# 查看 users 表是否有 walletAddress 字段
```

### 快速测试 ERC-8004

#### 测试 1: 检查状态

```bash
curl http://localhost:5000/api/erc8004/status
```

**期望输出**:
```json
{
  "enabled": true,
  "registryAddress": "0x...",
  "networkId": "43113",
  "networkName": "Avalanche Fuji"
}
```

或（如果未配置）:
```json
{
  "enabled": false,
  "error": "ERC8004_REGISTRY_ADDRESS not configured"
}
```

#### 测试 2: 生成 Nonce

```bash
curl -X POST http://localhost:5000/api/erc8004/nonce \
  -H "Content-Type: application/json" \
  -d '{"walletAddress": "0x1234567890123456789012345678901234567890"}'
```

**期望输出**:
```json
{
  "success": true,
  "nonce": "0xabc...",
  "message": "Sign this message to authenticate with Awareness Market...",
  "expiresAt": "2026-02-13T10:35:00Z"
}
```

#### 测试 3: 模拟认证（需要钱包签名）

```javascript
// 前端代码示例（使用 ethers.js）
import { ethers } from 'ethers';

// 1. 请求 nonce
const nonceResponse = await fetch('/api/erc8004/nonce', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ walletAddress: myAddress })
});
const { nonce, message } = await nonceResponse.json();

// 2. 签名消息
const provider = new ethers.BrowserProvider(window.ethereum);
const signer = await provider.getSigner();
const signature = await signer.signMessage(message);

// 3. 认证
const authResponse = await fetch('/api/erc8004/authenticate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    walletAddress: myAddress,
    signature: signature,
    agentId: 'optional_agent_id'
  })
});

const { success, token, agent } = await authResponse.json();
console.log('Authenticated:', success, token);
```

---

## 🔧 配置步骤（让 ERC-8004 工作）

### 选项 A: 使用测试网（推荐开发环境）

#### 步骤 1: 获取 RPC URL

访问 [Alchemy](https://www.alchemy.com/) 或 [Infura](https://infura.io/)，创建项目并获取 Avalanche Fuji RPC URL。

#### 步骤 2: 配置环境变量

在 `.env` 中添加：
```bash
AVALANCHE_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
JWT_SECRET=$(openssl rand -hex 32)
```

#### 步骤 3: 部署合约

```bash
# 安装依赖
pnpm install

# 编译合约
npx hardhat compile

# 配置部署钱包（在 hardhat.config.ts 中）
# 导出私钥到 .env
DEPLOYER_PRIVATE_KEY=your_private_key

# 部署
npx hardhat run scripts/deploy/deploy-erc8004.ts --network avalanche-fuji
```

部署成功后，复制合约地址并添加到 `.env`:
```bash
ERC8004_REGISTRY_ADDRESS=0x1234567890abcdef...
```

#### 步骤 4: 重启服务器

```bash
pnpm run dev
```

#### 步骤 5: 验证

```bash
curl http://localhost:5000/api/erc8004/status
```

应该返回 `"enabled": true`。

### 选项 B: 禁用 ERC-8004（如果暂时不需要）

在 `.env` 中不配置 `ERC8004_REGISTRY_ADDRESS`，ERC-8004 功能会自动禁用，不影响其他功能（如 WebMCP）。

---

## 📊 功能对比表

| 功能 | WebMCP | ERC-8004 |
|------|--------|----------|
| **用途** | AI Agent 通用认证 | 链上 Agent 身份认证 |
| **认证方式** | MCP Token / OAuth | 钱包签名 |
| **状态** | ✅ 100% 完成 | ⚠️ 代码完成，待部署合约 |
| **响应格式** | JSON | JSON |
| **依赖** | 无（可立即使用） | 需要区块链合约 |
| **适用场景** | Claude Desktop, GPT-4 | 链上 AI Agents |

---

## ✅ 当前可用功能

### 立即可用 ✅

1. **WebMCP 认证** - MCP Token + OAuth 2.0
2. **MCP 工具调用** - 5 个工具（search_vectors, retrieve_memories_rmc, etc.）
3. **MCP 资源访问** - 6 个资源（memory://, vectors://, entities://, etc.）
4. **Token 管理 UI** - 创建、查看、撤销 Token

### 需要配置 ⏳

1. **ERC-8004 认证** - 需要部署合约 + 配置环境变量
2. **链上 Agent 注册** - 需要合约部署
3. **钱包签名登录** - 需要前端钱包集成（MetaMask, WalletConnect）

---

## 🎯 建议

### 如果你需要 AI Agent 立即访问 Awareness Market：

**使用 WebMCP** ✅
- 无需区块链
- 配置简单
- 立即可用
- 支持 Claude Desktop, GPT-4, AutoGPT 等

### 如果你需要链上 AI Agent 身份验证：

**配置 ERC-8004** ⏳
1. 部署合约到 Avalanche Fuji（测试网）
2. 配置环境变量
3. 集成钱包登录（MetaMask）
4. 测试 Agent 注册和认证

### 两者可以共存 ✅

- WebMCP 用于通用 AI Agents
- ERC-8004 用于需要链上身份的 Agents
- 用户可以选择任一方式登录

---

## 🚀 快速启动指南

### 使用 WebMCP（推荐开始）

```bash
# 1. 启动服务器
pnpm run dev

# 2. 访问 Demo 页面
# http://localhost:5173/webmcp-demo.html

# 3. 创建 MCP Token
curl -X POST http://localhost:5000/api/mcp/tokens \
  -H "X-API-Key: your_api_key" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Token", "permissions": ["read"], "expiresInDays": 30}'

# 4. 使用 Widget 连接
# 粘贴 token 到右下角蓝色 Widget
```

### 配置 ERC-8004（如需链上认证）

```bash
# 1. 配置 .env
echo "AVALANCHE_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc" >> .env
echo "JWT_SECRET=$(openssl rand -hex 32)" >> .env

# 2. 部署合约
npx hardhat run scripts/deploy/deploy-erc8004.ts --network avalanche-fuji

# 3. 添加合约地址到 .env
echo "ERC8004_REGISTRY_ADDRESS=0x..." >> .env

# 4. 重启服务器
pnpm run dev

# 5. 测试状态
curl http://localhost:5000/api/erc8004/status
```

---

## 📞 需要帮助？

- **WebMCP 文档**: [WEBMCP_USER_GUIDE.md](WEBMCP_USER_GUIDE.md)
- **ERC-8004 集成**: [docs/integration/ERC8004_INTEGRATION.md](docs/integration/ERC8004_INTEGRATION.md)
- **部署指南**: [WEBMCP_DEPLOYMENT_GUIDE.md](WEBMCP_DEPLOYMENT_GUIDE.md)

---

## 总结

**问题 1 答案**:
- ✅ AI 登录返回 **JSON 格式**（标准 RESTful API）
- ✅ AI Agent 将 JSON 解析后以 **Markdown/自然语言** 展示给用户

**问题 2 答案**:
- ⚠️ ERC-8004 **代码完成**，但需要：
  1. 部署智能合约（测试网或主网）
  2. 配置环境变量（RPC URL + 合约地址）
  3. 重启服务器

**建议**:
- 使用 **WebMCP** 实现 AI 登录（立即可用）
- 需要链上身份时再配置 **ERC-8004**

---

**当前状态**: WebMCP ✅ 完全可用 | ERC-8004 ⏳ 待配置
