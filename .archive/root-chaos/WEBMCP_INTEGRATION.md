# WebMCP 集成架构设计

**版本**: v1.0
**日期**: 2026-02-13
**状态**: 设计完成，待实施

---

## 📋 概述

WebMCP 是一个 JavaScript 库，使任何网站都能集成 Model Context Protocol (MCP)。Awareness Market 将通过 WebMCP 实现：

1. **AI 自主登录** - AI Agent 可以使用 MCP Token 自动认证
2. **Tools 暴露** - 向量搜索、RMC 检索、记忆管理等操作
3. **Prompts 模板** - 常用查询模板（搜索向量、分析记忆图谱）
4. **Resources 暴露** - 记忆数据、向量市场数据、RMC 关系图谱
5. **Multi-Agent 协作** - 基于现有 `/api/mcp/sync` 端点的协作功能

---

## 🏗️ 架构设计

### 现有 MCP 实现（后端）

```
server/mcp-api.ts
├── GET  /api/mcp/discover        # 发现可用向量
├── POST /api/mcp/tokens          # 创建 MCP Token
├── GET  /api/mcp/tokens          # 列出 Tokens
├── DELETE /api/mcp/tokens/:id    # 撤销 Token
├── GET  /api/mcp/vectors/:id     # 向量详情
├── POST /api/mcp/invoke          # 调用向量
├── POST /api/mcp/sync            # Multi-Agent 协作
└── GET  /api/mcp/health          # 健康检查
```

### 新增 WebMCP 实现（前端）

```
client/src/lib/webmcp/
├── webmcp-client.ts              # WebMCP 客户端封装
├── tools.ts                      # MCP Tools 定义
├── prompts.ts                    # MCP Prompts 定义
├── resources.ts                  # MCP Resources 定义
└── auth.ts                       # AI 自主登录机制

client/src/components/
├── WebMCPWidget.tsx              # WebMCP 蓝色小部件
└── MCPTokenManager.tsx           # Token 管理界面
```

---

## 🔧 核心功能设计

### 1. AI 自主登录

**问题**: WebMCP 原始设计需要用户手动粘贴 Token（不支持完全自主登录）
**解决方案**: 实现混合认证机制

```typescript
// 认证流程
1. AI Agent 提供 MCP Token（通过 WebMCP widget 或 API）
2. 后端验证 Token 并创建临时会话
3. 返回 sessionId + capabilities
4. AI 使用 sessionId 调用 Tools/Resources
```

**安全机制**:
- Token 只能用于只读操作（默认权限）
- 需要用户确认的敏感操作（购买向量、修改设置）弹出确认对话框
- Token 有过期时间（默认 30 天）
- 支持 Token 撤销

### 2. Tools 定义

#### Tool 1: `search_vectors`
```typescript
{
  name: "search_vectors",
  description: "Search for latent vectors in Awareness Market",
  inputSchema: {
    query: string,          // "find vision transformer vectors"
    category?: string,      // "computer_vision", "nlp", etc.
    minRating?: number,     // 0-5
    limit?: number          // default: 10
  },
  handler: async (args) => {
    const response = await fetch('/api/mcp/discover', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mcpToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(args)
    });
    return await response.json();
  }
}
```

#### Tool 2: `retrieve_memories_rmc`
```typescript
{
  name: "retrieve_memories_rmc",
  description: "Use RMC hybrid retrieval to find related memories with reasoning paths",
  inputSchema: {
    query: string,
    maxDepth?: number,      // Graph traversal depth
    includeInferencePaths?: boolean
  },
  handler: async (args) => {
    const response = await fetch('/api/trpc/memory.hybridRetrieve', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mcpToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(args)
    });
    return await response.json();
  }
}
```

#### Tool 3: `create_memory`
```typescript
{
  name: "create_memory",
  description: "Create a new memory entry in the shared memory graph",
  inputSchema: {
    content: string,
    namespace: string,
    priority?: "low" | "normal" | "high" | "critical"
  },
  handler: async (args) => {
    // Requires user confirmation for write operations
    const confirmed = await requestUserConfirmation(
      `Allow AI to create memory: "${args.content.substring(0, 100)}..."`
    );

    if (!confirmed) {
      throw new Error("User denied permission");
    }

    const response = await fetch('/api/trpc/memory.create', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mcpToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(args)
    });
    return await response.json();
  }
}
```

#### Tool 4: `get_memory_graph`
```typescript
{
  name: "get_memory_graph",
  description: "Get the relationship graph for a specific memory",
  inputSchema: {
    memoryId: string,
    maxDepth?: number
  },
  handler: async (args) => {
    const response = await fetch('/api/trpc/memory.getMemoryGraph', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mcpToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(args)
    });
    return await response.json();
  }
}
```

#### Tool 5: `multi_agent_sync`
```typescript
{
  name: "multi_agent_sync",
  description: "Coordinate multiple AI agents with shared context and consensus building",
  inputSchema: {
    agents: Array<{
      id: string,
      messages: Array<{role: string, content: string}>
    }>,
    shared_context?: object,
    memory_key?: string,
    memory_ttl_days?: number
  },
  handler: async (args) => {
    const response = await fetch('/api/mcp/sync', {
      method: 'POST',
      headers: {
        'X-MCP-Token': mcpToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(args)
    });
    return await response.json();
  }
}
```

### 3. Prompts 定义

#### Prompt 1: `search_by_capability`
```typescript
{
  name: "search_by_capability",
  description: "Search for vectors by specific capability",
  arguments: [
    {
      name: "capability",
      description: "e.g., 'image classification', 'sentiment analysis'",
      required: true
    }
  ],
  template: `Find latent vectors in Awareness Market that can perform: {{capability}}

Please include:
1. Top 5 matching vectors
2. Performance metrics
3. Pricing information
4. Usage examples`
}
```

#### Prompt 2: `analyze_memory_graph`
```typescript
{
  name: "analyze_memory_graph",
  description: "Analyze relationships and reasoning paths in memory graph",
  arguments: [
    {
      name: "topic",
      description: "Topic to analyze (e.g., 'SpaceX launches')",
      required: true
    }
  ],
  template: `Analyze the memory graph for topic: {{topic}}

Please provide:
1. Key entities and their relationships
2. Inference paths (causal chains, contradictions)
3. Knowledge gaps or inconsistencies
4. Recommendations for additional data collection`
}
```

#### Prompt 3: `multi_agent_decision`
```typescript
{
  name: "multi_agent_decision",
  description: "Use multiple AI agents to make a collaborative decision",
  arguments: [
    {
      name: "decision",
      description: "Decision to be made",
      required: true
    },
    {
      name: "context",
      description: "Relevant context",
      required: false
    }
  ],
  template: `Make a collaborative decision on: {{decision}}

Context: {{context}}

Please coordinate multiple AI agents to:
1. Analyze from different perspectives
2. Identify potential risks and benefits
3. Build consensus
4. Provide final recommendation with confidence level`
}
```

### 4. Resources 定义

#### Resource 1: `memory://graph/{memoryId}`
```typescript
{
  uri: "memory://graph/{memoryId}",
  name: "Memory Relationship Graph",
  description: "Retrieve the full relationship graph for a memory",
  mimeType: "application/json",
  handler: async ({ memoryId }) => {
    const response = await fetch(`/api/trpc/memory.getMemoryGraph`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${mcpToken}` },
      body: JSON.stringify({ memoryId })
    });
    return {
      contents: [{
        uri: `memory://graph/${memoryId}`,
        mimeType: "application/json",
        text: JSON.stringify(await response.json(), null, 2)
      }]
    };
  }
}
```

#### Resource 2: `vectors://marketplace/trending`
```typescript
{
  uri: "vectors://marketplace/trending",
  name: "Trending Vectors",
  description: "Get currently trending latent vectors",
  mimeType: "application/json",
  handler: async () => {
    const response = await fetch('/api/mcp/discover?sortBy=trending&limit=20', {
      headers: { 'Authorization': `Bearer ${mcpToken}` }
    });
    return {
      contents: [{
        uri: "vectors://marketplace/trending",
        mimeType: "application/json",
        text: JSON.stringify(await response.json(), null, 2)
      }]
    };
  }
}
```

#### Resource 3: `entities://hot`
```typescript
{
  uri: "entities://hot",
  name: "Hot Entities",
  description: "Get most frequently mentioned entities in memory graph",
  mimeType: "application/json",
  handler: async () => {
    const response = await fetch('/api/trpc/memory.getHotEntities', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${mcpToken}` }
    });
    return {
      contents: [{
        uri: "entities://hot",
        mimeType: "application/json",
        text: JSON.stringify(await response.json(), null, 2)
      }]
    };
  }
}
```

---

## 🔐 AI 自主登录实现

### 方案 1: MCP Token 直接认证（推荐）

```typescript
// Step 1: AI 获取 MCP Token (通过用户创建或环境变量)
const mcpToken = "mcp_abc123..."

// Step 2: WebMCP Widget 接收 Token
webMCP.setToken(mcpToken)

// Step 3: 自动验证并建立会话
const session = await webMCP.authenticate({
  token: mcpToken,
  capabilities: ['read', 'write_with_confirmation']
})

// Step 4: AI 可以调用 Tools/Resources
const vectors = await webMCP.callTool('search_vectors', {
  query: 'vision transformers',
  minRating: 4.0
})
```

### 方案 2: OAuth 2.0 设备流程（完全自主）

```typescript
// Step 1: AI 请求设备代码
const deviceAuth = await fetch('/api/mcp/auth/device', {
  method: 'POST',
  body: JSON.stringify({
    client_id: 'awareness-market-webmcp',
    scope: 'read:vectors read:memories write:memories'
  })
})

const { device_code, user_code, verification_uri } = await deviceAuth.json()

// Step 2: AI 指示用户访问 verification_uri 并输入 user_code
console.log(`Please visit ${verification_uri} and enter code: ${user_code}`)

// Step 3: AI 轮询等待用户授权
let accessToken = null
while (!accessToken) {
  await sleep(5000)
  const tokenResponse = await fetch('/api/mcp/auth/token', {
    method: 'POST',
    body: JSON.stringify({
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      device_code,
      client_id: 'awareness-market-webmcp'
    })
  })

  if (tokenResponse.ok) {
    const data = await tokenResponse.json()
    accessToken = data.access_token
  }
}

// Step 4: 使用 access_token 认证
webMCP.setToken(accessToken)
```

---

## 📦 实现清单

### Phase 1: 核心基础设施 ✅

- [ ] 创建 `client/src/lib/webmcp/webmcp-client.ts`
- [ ] 创建 `client/src/lib/webmcp/tools.ts` (5 个工具)
- [ ] 创建 `client/src/lib/webmcp/prompts.ts` (3 个模板)
- [ ] 创建 `client/src/lib/webmcp/resources.ts` (3 个资源)
- [ ] 创建 `client/src/lib/webmcp/auth.ts` (认证机制)

### Phase 2: UI 组件

- [ ] 创建 `client/src/components/WebMCPWidget.tsx` (蓝色小部件)
- [ ] 创建 `client/src/components/MCPTokenManager.tsx` (Token 管理)
- [ ] 集成到主应用 `client/src/App.tsx`

### Phase 3: 后端扩展

- [ ] 添加 OAuth 2.0 设备流程端点
  - `POST /api/mcp/auth/device`
  - `POST /api/mcp/auth/token`
- [ ] 添加 MCP Token 权限验证中间件
- [ ] 更新 `server/mcp-api.ts` 支持 WebMCP

### Phase 4: 测试与文档

- [ ] 创建测试脚本 `scripts/test-webmcp.html`
- [ ] 创建用户文档 `WEBMCP_USER_GUIDE.md`
- [ ] 创建开发者文档 `WEBMCP_DEVELOPER_GUIDE.md`

---

## 🎯 使用场景

### 场景 1: Claude Desktop 用户使用 Awareness Market

```typescript
// 在 Claude Desktop 中，用户可以：
1. 通过 WebMCP widget 连接到 Awareness Market
2. 使用自然语言："Help me find the best vision transformer vector"
3. Claude 调用 search_vectors Tool
4. 返回结果并提供购买建议
5. 用户确认后，Claude 调用购买 API
```

### 场景 2: 多 AI 协作决策

```typescript
// 3 个 AI Agent 协作分析商业决策
const decision = await webMCP.callTool('multi_agent_sync', {
  agents: [
    { id: 'financial_analyst', messages: [...] },
    { id: 'market_researcher', messages: [...] },
    { id: 'risk_assessor', messages: [...] }
  ],
  shared_context: {
    company: 'ACME Corp',
    decision: 'Should we invest in quantum computing?'
  },
  memory_key: 'quantum_investment_analysis',
  memory_ttl_days: 90
})

// 返回:
// - 3 个 Agent 的独立分析
// - Consensus summary
// - Merged context
// - Action items
```

### 场景 3: AI 自动探索记忆图谱

```typescript
// AI 使用 RMC 检索自动发现知识
const memories = await webMCP.callTool('retrieve_memories_rmc', {
  query: 'SpaceX Starship development',
  maxDepth: 3,
  includeInferencePaths: true
})

// 返回:
// - Direct matches (向量检索)
// - Related context (图谱扩展)
// - Inference paths (推理路径):
//   - Causal chain: "Starship test → FAA approval delay → launch postponed"
//   - Contradiction: "Elon said Q1 launch" vs "FAA approval pending"
//   - Multi-hop: "Starship → Mars mission → Life support systems"
```

---

## 🔒 安全考虑

### Token 权限分级

| 权限级别 | 操作 | 需要确认 |
|---------|------|----------|
| `read` | 搜索向量、查询记忆 | ❌ |
| `write_with_confirmation` | 创建记忆、购买向量 | ✅ |
| `write` | 所有写操作 | ❌ (仅限可信 AI) |
| `admin` | 修改设置、删除数据 | ✅ (始终确认) |

### Rate Limiting

```typescript
// 基于 MCP Token 的速率限制
{
  read: 100 requests/minute,
  write: 10 requests/minute,
  admin: 5 requests/minute
}
```

### Audit Logging

```typescript
// 所有 AI 操作都记录日志
{
  timestamp: "2026-02-13T10:30:00Z",
  mcpTokenId: 123,
  userId: 456,
  action: "search_vectors",
  parameters: { query: "vision transformers" },
  result: "success",
  ipAddress: "203.0.113.1",
  userAgent: "Claude Desktop/1.2.3"
}
```

---

## 📊 性能指标

### 预期性能

| 操作 | 延迟 | 吞吐量 |
|------|------|--------|
| Tool 调用 | < 200ms | 100 req/s |
| Resource 获取 | < 100ms | 200 req/s |
| Multi-agent sync | 2-5s | 10 req/s |
| RMC 检索 | < 500ms | 50 req/s |

### 可扩展性

- **用户数**: 支持 10,000 并发 WebMCP 连接
- **Token 数量**: 每用户最多 10 个 MCP Token
- **会话时长**: Token 有效期 30 天（可配置）

---

## 🚀 部署步骤

### 1. 安装 WebMCP 库

```bash
pnpm add @modelcontextprotocol/webmcp
# 或使用 CDN
<script src="https://unpkg.com/@modelcontextprotocol/webmcp@latest/dist/webmcp.js"></script>
```

### 2. 集成到前端

```typescript
// client/src/main.tsx
import { initializeWebMCP } from './lib/webmcp/webmcp-client'

// 在应用启动时初始化
initializeWebMCP({
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000',
  enableWidget: true,
  widgetPosition: 'bottom-right'
})
```

### 3. 配置后端

```bash
# .env
WEBMCP_ENABLED=true
WEBMCP_OAUTH_CLIENT_ID=awareness-market-webmcp
WEBMCP_OAUTH_CLIENT_SECRET=***
WEBMCP_DEVICE_CODE_EXPIRY=600  # 10 minutes
```

### 4. 启动服务

```bash
pnpm run dev  # 开发环境
pnpm run build && pnpm start  # 生产环境
```

---

## 📚 参考资源

- **WebMCP 官网**: https://webmcp.dev/
- **WebMCP GitHub**: https://github.com/webmachinelearning/webmcp
- **MCP 协议**: https://spec.modelcontextprotocol.io/
- **Awareness Market 白皮书**: [WHITEPAPER.md](WHITEPAPER.md)
- **RMC 架构**: [RMC_ARCHITECTURE.md](RMC_ARCHITECTURE.md)

---

**下一步**: 开始实现 Phase 1 - 核心基础设施代码 ✨
