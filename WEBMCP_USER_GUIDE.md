# WebMCP 用户指南

**版本**: v1.0
**日期**: 2026-02-13

---

## 📋 目录

1. [简介](#简介)
2. [快速开始](#快速开始)
3. [创建 MCP Token](#创建-mcp-token)
4. [使用 WebMCP Widget](#使用-webmcp-widget)
5. [AI Agent 使用场景](#ai-agent-使用场景)
6. [可用工具 (Tools)](#可用工具-tools)
7. [提示词模板 (Prompts)](#提示词模板-prompts)
8. [资源访问 (Resources)](#资源访问-resources)
9. [安全与权限](#安全与权限)
10. [常见问题](#常见问题)

---

## 简介

WebMCP 是一个 JavaScript 库，使 Awareness Market 能够与 AI Agent（如 Claude Desktop、GPT-4 Custom Actions）无缝集成。通过 WebMCP，AI 可以：

- **搜索向量市场** - 找到最适合特定任务的 latent vector
- **访问共享记忆** - 使用 RMC 混合检索查询记忆图谱
- **创建新记忆** - 向共享知识库添加信息
- **多 AI 协作** - 协调多个 AI Agent 进行决策
- **探索关系图谱** - 发现推理路径和知识连接

**核心优势**:
- ✅ AI 自主登录（使用 MCP Token）
- ✅ 丰富的工具集（5 个核心工具）
- ✅ 预定义提示词（5 个常用模板）
- ✅ 资源暴露（6 种数据资源）
- ✅ 用户确认机制（敏感操作需授权）

---

## 快速开始

### 步骤 1: 访问 Awareness Market

打开浏览器，访问:
```
https://awareness-market.com
```

或本地开发环境:
```
http://localhost:5173
```

### 步骤 2: 创建 MCP Token

在右下角找到蓝色的 WebMCP 按钮，点击打开面板。

按照提示创建一个 MCP Token（需要先登录账户）。

### 步骤 3: 连接 AI Agent

将生成的 MCP Token 粘贴到 WebMCP Widget 中，点击 "Connect"。

### 步骤 4: 开始使用

连接成功后，AI Agent 可以通过 Tools、Prompts 和 Resources 与 Awareness Market 交互。

---

## 创建 MCP Token

### 方式 1: 通过 API

```bash
curl -X POST https://awareness-market.com/api/mcp/tokens \
  -H "X-API-Key: your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My AI Agent Token",
    "permissions": ["read", "write_with_confirmation"],
    "expiresInDays": 30
  }'
```

响应:
```json
{
  "success": true,
  "token": "mcp_abc123def456...",
  "tokenPrefix": "mcp_abc",
  "expiresAt": "2026-03-15T10:30:00Z",
  "message": "MCP token created successfully. Store it securely - it won't be shown again."
}
```

### 方式 2: 通过 Web UI

1. 登录 Awareness Market
2. 进入 **Settings → MCP Tokens**
3. 点击 "Create New Token"
4. 选择权限级别和有效期
5. 点击 "Generate"
6. **重要**: 立即复制 Token（只显示一次）

### Token 权限级别

| 权限 | 说明 | 适用场景 |
|------|------|----------|
| `read` | 只读访问，不需要确认 | 搜索向量、查询记忆 |
| `write_with_confirmation` | 写入需用户确认 | 创建记忆、购买向量 |
| `write` | 完全写入权限 | 可信 AI Agent |
| `admin` | 管理员操作 | 修改设置、删除数据 |

**推荐**: 大多数情况下使用 `write_with_confirmation`，兼顾功能性和安全性。

---

## 使用 WebMCP Widget

### Widget 位置

蓝色的 WebMCP 按钮默认显示在页面右下角。你可以自定义位置：

```javascript
initializeWebMCP({
  apiBaseUrl: 'https://awareness-market.com',
  enableWidget: true,
  widgetPosition: 'bottom-left'  // 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
});
```

### 连接流程

1. **点击蓝色按钮** - 打开连接面板
2. **粘贴 MCP Token** - 输入你的 `mcp_xxx...` token
3. **点击 Connect** - 验证并建立会话
4. **等待确认** - 显示 "✅ Connected as User {id}"

### 连接状态

- 🟢 **绿点** - 已连接，AI 可以调用工具
- 🔴 **红点** - 未连接，需要重新认证

### 断开连接

点击 Widget 中的 "Disconnect" 按钮，或关闭浏览器标签页。

---

## AI Agent 使用场景

### 场景 1: Claude Desktop 使用

在 Claude Desktop 中，用户可以这样与 AI 交互：

**用户**: "Help me find the best vision transformer vector for image classification."

**Claude**:
```
I'll search Awareness Market for vision transformer vectors.

[Calls tool: search_vectors]
{
  "query": "vision transformer image classification",
  "category": "computer_vision",
  "minRating": 4.0
}

I found 5 highly-rated vision transformer vectors:

1. **ViT-Large-16** (4.8★, 15K calls)
   - Accuracy: 87.6% on ImageNet
   - Latency: 45ms
   - Price: $0.002/call

2. **DeiT-III-Base** (4.7★, 8K calls)
   - Accuracy: 83.2%
   - Latency: 28ms
   - Price: $0.0015/call

Recommendation: ViT-Large-16 offers the best accuracy-performance balance.
Would you like me to purchase access for you?
```

**用户**: "Yes, please."

**Claude**: [Requests user confirmation via WebMCP]
```
🔔 User Confirmation Required:
Allow AI to purchase access to "ViT-Large-16"?
Price: $0.002 per call
[Approve] [Deny]
```

### 场景 2: 多 AI 协作决策

**用户**: "Should我们 invest in quantum computing research?"

**AI Coordinator**:
```
I'll coordinate multiple AI agents to analyze this decision.

[Calls tool: multi_agent_sync]
{
  "agents": [
    { "id": "financial_analyst", "messages": [...] },
    { "id": "tech_expert", "messages": [...] },
    { "id": "risk_assessor", "messages": [...] }
  ],
  "shared_context": {
    "decision": "Invest in quantum computing research",
    "budget": "$10M",
    "timeframe": "5 years"
  },
  "memory_key": "quantum_investment_decision_2026"
}

═══════════════════════════════════════════════════════════
MULTI-AGENT COLLABORATIVE ANALYSIS
═══════════════════════════════════════════════════════════

Financial Agent (72% confidence):
✓ RECOMMEND INVEST
- ROI projection: 3.2x over 10 years
- Market size: $65B by 2030
- Risk-adjusted NPV: +$8.2M

Technical Agent (85% confidence):
✓ RECOMMEND INVEST
- Technology readiness: Level 6/9
- Competitive advantage: 3-year lead possible
- Success probability: 45%

Risk Assessor (68% confidence):
⚠️  CONDITIONAL RECOMMEND
- High risk, high reward profile
- Recommend hedging: 40% allocation, not 100%
- Require quarterly review gates

═══════════════════════════════════════════════════════════
CONSENSUS (75% confidence):
✓ INVEST with conditions
- Allocate $4M (40% of budget) initially
- Establish quarterly review process
- Focus on hybrid quantum-classical algorithms
═══════════════════════════════════════════════════════════

This analysis has been saved to AI memory for future reference.
```

### 场景 3: 记忆图谱探索

**用户**: "What do we know about SpaceX Starship development?"

**AI**:
```
Let me search the memory graph and analyze relationships.

[Calls tool: retrieve_memories_rmc]
{
  "query": "SpaceX Starship development",
  "maxDepth": 3,
  "includeInferencePaths": true
}

📊 Found 47 related memories with 12 inference paths

KEY ENTITIES DISCOVERED:
- Elon Musk (mentioned 23 times)
- SpaceX (18 times)
- FAA (12 times)
- Starship (47 times)

CAUSAL CHAINS:
1. Starship test flight → FAA environmental review delay → Launch postponed to Q2 2026
   Strength: 0.92 (high confidence)

2. Raptor engine improvements → Increased thrust → Higher payload capacity
   Strength: 0.87

CONTRADICTIONS FOUND:
⚠️  Conflict on "starship_launch_date":
   - Memory A (2026-01-10): "Elon targets March 2026 for orbital launch"
   - Memory B (2026-02-05): "FAA approval pending, likely delayed to June 2026"

   Recommendation: Memory B is more recent and cites official source (FAA).

KNOWLEDGE GAPS:
❓ What is the current status of the heat shield tiles?
❓ Has the chopstick catch mechanism been tested successfully?
❓ What is the payload manifest for the first orbital flight?

Would you like me to help fill these knowledge gaps by searching for more information?
```

---

## 可用工具 (Tools)

AI Agents 可以调用以下 5 个工具：

### 1. `search_vectors`

**描述**: 搜索 Awareness Market 中的 latent vectors

**参数**:
```typescript
{
  query: string,           // 搜索查询（如 "vision transformers"）
  category?: string,       // 类别过滤
  minRating?: number,      // 最低评分 (0-5)
  limit?: number           // 结果数量（默认 10）
}
```

**示例**:
```javascript
const result = await webmcp.callTool('search_vectors', {
  query: 'sentiment analysis for product reviews',
  category: 'nlp',
  minRating: 4.0,
  limit: 5
});
```

**返回**:
```json
{
  "total": 5,
  "vectors": [
    {
      "id": 123,
      "name": "BERT-Sentiment-V2",
      "description": "Fine-tuned BERT for sentiment classification",
      "category": "nlp",
      "rating": 4.7,
      "total_calls": 25000,
      "pricing": {
        "model": "pay-per-call",
        "base_price": 0.0012
      },
      "performance": {
        "accuracy": 0.924,
        "latency_ms": 18
      }
    }
  ]
}
```

---

### 2. `retrieve_memories_rmc`

**描述**: 使用 RMC 混合检索查询记忆（向量 + 图谱 + 推理路径）

**参数**:
```typescript
{
  query: string,                   // 查询文本
  maxDepth?: number,               // 图遍历深度（默认 2）
  includeInferencePaths?: boolean, // 包含推理路径（默认 true）
  relationTypes?: string[]         // 关系类型过滤
}
```

**示例**:
```javascript
const memories = await webmcp.callTool('retrieve_memories_rmc', {
  query: 'Tesla FSD v12 improvements',
  maxDepth: 3,
  includeInferencePaths: true,
  relationTypes: ['CAUSES', 'SUPPORTS', 'TEMPORAL_AFTER']
});
```

**返回**:
```json
{
  "directMatches": [...],      // 向量检索结果
  "relatedContext": [...],     // 图谱扩展的相关记忆
  "inferencePaths": [          // 推理路径
    {
      "type": "causal_chain",
      "path": [memoryA, memoryB, memoryC],
      "relationships": ["CAUSES", "CAUSES"],
      "strength": 0.89,
      "reasoning": "A causes B causes C"
    }
  ],
  "summary": "Found 23 memories with 4 causal chains..."
}
```

---

### 3. `create_memory`

**描述**: 在共享记忆图谱中创建新记忆

**参数**:
```typescript
{
  content: string,              // 记忆内容
  namespace?: string,           // 命名空间（默认 "shared"）
  priority?: string,            // 处理优先级（默认 "normal"）
  claim_key?: string,           // 冲突解决键
  claim_value?: string          // 声明值
}
```

**⚠️ 需要用户确认** (除非 token 有 `write` 权限)

**示例**:
```javascript
const memory = await webmcp.callTool('create_memory', {
  content: 'Claude Desktop v1.2.5 released with improved WebMCP support',
  namespace: 'shared',
  priority: 'normal',
  claim_key: 'claude_desktop_version',
  claim_value: '1.2.5'
});
```

---

### 4. `get_memory_graph`

**描述**: 获取特定记忆的关系图谱

**参数**:
```typescript
{
  memoryId: string,       // 记忆 ID
  maxDepth?: number       // 遍历深度（默认 2）
}
```

**示例**:
```javascript
const graph = await webmcp.callTool('get_memory_graph', {
  memoryId: 'mem_abc123',
  maxDepth: 2
});
```

---

### 5. `multi_agent_sync`

**描述**: 协调多个 AI Agent 进行协作决策

**参数**:
```typescript
{
  agents: Array<{
    id: string,
    messages: Array<{role: string, content: string}>
  }>,
  shared_context?: object,
  memory_key?: string,         // 存储结果的键
  memory_ttl_days?: number     // 保留天数
}
```

**示例**:
```javascript
const result = await webmcp.callTool('multi_agent_sync', {
  agents: [
    {
      id: 'financial_analyst',
      messages: [
        { role: 'user', content: 'Analyze ROI of quantum computing investment' }
      ]
    },
    {
      id: 'tech_expert',
      messages: [
        { role: 'user', content: 'Assess technical feasibility of quantum research' }
      ]
    }
  ],
  shared_context: {
    budget: '$10M',
    timeframe: '5 years'
  },
  memory_key: 'quantum_decision_2026',
  memory_ttl_days: 90
});
```

**返回**:
```json
{
  "results": [...],                  // 各 Agent 的分析结果
  "consensus": "Recommend invest...",// 共识摘要
  "merged_context": {...},           // 合并后的上下文
  "action_items": [...]              // 行动项
}
```

---

## 提示词模板 (Prompts)

预定义的提示词模板，AI 可以直接调用：

### 1. `search_by_capability`

搜索具有特定能力的向量。

```javascript
const prompt = webmcp.renderPrompt('search_by_capability', {
  capability: 'image classification',
  budget: '$0.002 per call'
});
```

### 2. `analyze_memory_graph`

分析记忆图谱中的关系和推理路径。

```javascript
const prompt = webmcp.renderPrompt('analyze_memory_graph', {
  topic: 'SpaceX Starship development',
  focus: 'contradictions'
});
```

### 3. `multi_agent_decision`

使用多 AI 协作进行决策。

```javascript
const prompt = webmcp.renderPrompt('multi_agent_decision', {
  decision: 'Should we invest in quantum computing?',
  context: 'Budget: $10M, Timeframe: 5 years',
  perspectives: 'financial,technical,ethical,risk'
});
```

### 4. `optimize_vector_search`

根据详细需求找到最优向量。

```javascript
const prompt = webmcp.renderPrompt('optimize_vector_search', {
  use_case: 'Real-time sentiment analysis for social media',
  constraints: 'max latency 50ms, accuracy >92%',
  scale: '10M requests/day'
});
```

### 5. `debug_memory_conflicts`

识别和解决记忆冲突。

```javascript
const prompt = webmcp.renderPrompt('debug_memory_conflicts', {
  claim_key: 'starship_launch_date',
  resolution_strategy: 'most_recent'
});
```

---

## 资源访问 (Resources)

AI 可以通过 URI 访问以下资源：

### 1. `memory://graph/{memoryId}`

获取记忆的关系图谱。

```javascript
const graph = await webmcp.getResource(
  'memory://graph/mem_abc123?depth=2&includeInferencePaths=true'
);
```

### 2. `vectors://marketplace/trending`

获取热门向量。

```javascript
const trending = await webmcp.getResource(
  'vectors://marketplace/trending?limit=20&category=nlp'
);
```

### 3. `entities://hot`

获取最常被提及的实体。

```javascript
const hotEntities = await webmcp.getResource(
  'entities://hot?type=COMPANY&minMentions=10'
);
```

### 4. `memories://search/{query}`

搜索记忆。

```javascript
const results = await webmcp.getResource(
  'memories://search/Tesla FSD?limit=10&namespace=shared'
);
```

### 5. `vectors://vector/{vectorId}`

获取向量详情。

```javascript
const vectorDetails = await webmcp.getResource(
  'vectors://vector/123'
);
```

### 6. `rmc://inference-paths/{memoryId}`

获取推理路径。

```javascript
const paths = await webmcp.getResource(
  'rmc://inference-paths/mem_abc123?maxDepth=3&pathType=causal'
);
```

---

## 安全与权限

### 权限验证

所有 WebMCP 操作都需要有效的 MCP Token。Token 包含：

- **userId** - 用户身份
- **permissions** - 权限列表（read, write, admin）
- **expiresAt** - 过期时间

### 用户确认机制

敏感操作（如写入、购买）会触发确认对话框：

```
╔════════════════════════════════════════╗
║ AI Agent Permission Request            ║
╠════════════════════════════════════════╣
║ Allow AI to create memory:             ║
║                                        ║
║ "Claude Desktop v1.2.5 released..."    ║
║                                        ║
║ Namespace: shared                      ║
╠════════════════════════════════════════╣
║ [Approve]           [Deny]             ║
╚════════════════════════════════════════╝
```

### Rate Limiting

基于 MCP Token 的速率限制：

| 操作类型 | 限制 |
|---------|------|
| Read | 100 请求/分钟 |
| Write | 10 请求/分钟 |
| Admin | 5 请求/分钟 |

### Audit Logging

所有 AI 操作都会记录日志：

```json
{
  "timestamp": "2026-02-13T10:30:00Z",
  "mcpTokenId": 123,
  "userId": 456,
  "action": "create_memory",
  "parameters": { "content": "..." },
  "result": "success",
  "ipAddress": "203.0.113.1"
}
```

---

## 常见问题

### Q1: 如何获取 MCP Token？

**A**: 有两种方式：
1. 通过 API: `POST /api/mcp/tokens` (需要 API key)
2. 通过 Web UI: Settings → MCP Tokens → Create New Token

### Q2: Token 过期了怎么办？

**A**: 创建新的 Token。旧 Token 过期后无法恢复，只能生成新的。

### Q3: 可以撤销 Token 吗？

**A**: 可以。在 Settings → MCP Tokens 中找到对应 Token，点击 "Revoke"。

### Q4: AI 能否在没有用户确认的情况下进行写操作？

**A**: 只有当 Token 具有 `write` 权限时才可以。默认的 `write_with_confirmation` 权限需要用户确认。

### Q5: WebMCP 支持哪些 AI Agent？

**A**: 任何支持 MCP 协议的 AI Agent，包括：
- Claude Desktop
- GPT-4 Custom Actions (需要配置)
- AutoGPT
- LangChain Agents
- 自定义 MCP 客户端

### Q6: 如何调试 WebMCP 连接问题？

**A**:
1. 打开浏览器控制台 (F12)
2. 查看 Network 标签页
3. 检查 `/api/mcp/auth/verify` 请求的响应
4. 确认 Token 格式正确（以 `mcp_` 开头）
5. 检查 Token 是否过期

### Q7: 多个 AI Agent 可以共享同一个 Token 吗？

**A**: 可以，但不推荐。建议为每个 AI Agent 创建独立的 Token，便于管理和审计。

### Q8: WebMCP 性能如何？

**A**:
- Tool 调用延迟: < 200ms
- Resource 获取: < 100ms
- Multi-agent sync: 2-5s（取决于 Agent 数量）

---

## 下一步

- 查看 [WEBMCP_INTEGRATION.md](WEBMCP_INTEGRATION.md) 了解技术架构
- 访问 [/webmcp-demo.html](/webmcp-demo.html) 查看在线 Demo
- 加入社区讨论: https://discord.gg/awareness-market

**祝你使用愉快！** 🎉
