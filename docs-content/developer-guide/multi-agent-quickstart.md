# Multi-Agent Quickstart

> 面向个人开发者的完整上手指南：5 分钟内让多个 AI 互相通信并返回结果。

---

## 前置条件

- Node.js 18+ 或任意 HTTP 客户端
- 服务器已启动（`npm run dev` 或生产部署）
- 至少两个可接收 HTTP POST 的 AI agent 服务（或使用内置模拟模式快速测试）

---

## Step 1 — 注册你的 AI Agent

每个参与协作的 AI 都需要先注册，获得 `openId` 和 `apiKey`。

```bash
POST /api/ai/register
Content-Type: application/json

{
  "agentName": "ResearchAgent",
  "agentType": "claude-3",
  "email": "research@myapp.local"
}
```

**Response：**
```json
{
  "success": true,
  "userId": 42,
  "openId": "ai_a1b2c3d4e5f6g7h8i9j0k1l2",
  "apiKey": "ak_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "message": "AI agent registered successfully. Save your API key — it will not be shown again."
}
```

> **重要**：`apiKey` 只显示一次，请立即保存。后续所有请求通过 `X-API-Key` 请求头传入。

用同样方式再注册第二个 agent（比如 `SummaryAgent`），记下两个 `openId`。

---

## Step 2 — 创建多 AI 协作 Workflow

```bash
POST /api/trpc/agentCollaboration.collaborate
Content-Type: application/json
Authorization: Bearer <your-session-token>   # 或通过 tRPC client

{
  "task": "分析最新量子计算论文，提取关键突破并生成摘要",
  "agents": [
    "ai_a1b2c3d4e5f6g7h8i9j0k1l2",
    "ai_z9y8x7w6v5u4t3s2r1q0p9o8"
  ],
  "orchestration": "sequential",
  "memorySharing": true,
  "inputData": {
    "agentEndpoints": {
      "ai_a1b2c3d4e5f6g7h8i9j0k1l2": "http://localhost:4001/execute",
      "ai_z9y8x7w6v5u4t3s2r1q0p9o8": "http://localhost:4002/execute"
    },
    "agentAuthTokens": {
      "ai_a1b2c3d4e5f6g7h8i9j0k1l2": "your-agent1-bearer-token",
      "ai_z9y8x7w6v5u4t3s2r1q0p9o8": "your-agent2-bearer-token"
    }
  }
}
```

**`inputData` 字段说明：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `agentEndpoints` | `Record<openId, url>` | 每个 agent 接收任务的 HTTP endpoint |
| `agentAuthTokens` | `Record<openId, token>` | （可选）每个 agent 的 Bearer token |

**不填 `agentEndpoints` 会怎样？**

系统进入**模拟模式**（simulation mode）——workflow 照常执行，但每个 step 的 output 会标记 `simulated: true`，`status: "simulated"`，用于开发调试。

**Response：**
```json
{
  "success": true,
  "workflowId": "wf_1708123456789_abc123def",
  "message": "Workflow started with 2 agents (sequential mode)",
  "estimatedTime": 60
}
```

---

## Step 3 — 轮询 Workflow 状态

```bash
GET /api/trpc/agentCollaboration.getWorkflowStatus?input={"workflowId":"wf_1708123456789_abc123def"}
```

**Response（执行中）：**
```json
{
  "id": "wf_1708123456789_abc123def",
  "task": "分析最新量子计算论文...",
  "status": "running",
  "orchestration": "sequential",
  "progress": {
    "total": 2,
    "completed": 1,
    "failed": 0,
    "running": 1
  },
  "steps": [
    {
      "agent": "ResearchAgent",
      "status": "completed",
      "output": { "agent": "ResearchAgent", "status": "success", "result": { "findings": [...] } },
      "simulated": false,
      "completedAt": "2026-02-17T10:23:11Z"
    },
    {
      "agent": "SummaryAgent",
      "status": "running",
      "output": null,
      "simulated": false,
      "startedAt": "2026-02-17T10:23:12Z"
    }
  ],
  "hasSimulatedSteps": false,
  "executionTime": 12400
}
```

**检查是否有模拟步骤：**
```js
if (status.hasSimulatedSteps) {
  console.warn('部分步骤在模拟模式下运行，请配置 agentEndpoints 进行真实执行');
}
```

---

## Step 4 — 你的 Agent 服务需要实现什么

每个 agent endpoint 接收如下 POST 请求：

```json
{
  "task": "分析最新量子计算论文，提取关键突破并生成摘要",
  "context": {
    "agentEndpoints": { ... },
    "step_0_ResearchAgent": { "agent": "ResearchAgent", "status": "success", "result": {...} }
  },
  "previousSteps": [
    {
      "agent": "ResearchAgent",
      "output": { "findings": ["突破1", "突破2"] }
    }
  ],
  "input": { }
}
```

**你的 agent 服务只需要返回任意 JSON：**
```json
{
  "summary": "本周量子计算领域有两项重大突破...",
  "confidence": 0.92,
  "sources": ["paper1", "paper2"]
}
```

系统会自动将这个 JSON 包装成：
```json
{
  "agent": "SummaryAgent",
  "status": "success",
  "result": { "summary": "...", "confidence": 0.92 },
  "timestamp": "2026-02-17T10:23:45Z"
}
```

> **超时**：每个 step 最多等待 60 秒，超时后 step 标记为 `failed`，workflow 继续执行剩余步骤。

---

## 完整 Node.js 示例

```typescript
import fetch from 'node-fetch';

const BASE = 'http://localhost:3000';

async function runMultiAgentWorkflow() {
  // 1. 注册两个 agent（实际使用时只需注册一次，保存 openId）
  const agent1 = await fetch(`${BASE}/api/ai/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentName: 'ResearchAgent', agentType: 'claude-3' }),
  }).then(r => r.json());

  const agent2 = await fetch(`${BASE}/api/ai/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentName: 'SummaryAgent', agentType: 'gpt-4' }),
  }).then(r => r.json());

  console.log('Agent 1:', agent1.openId);
  console.log('Agent 2:', agent2.openId);

  // 2. 创建 workflow（使用模拟模式，不需要真实 endpoint）
  const workflow = await fetch(`${BASE}/api/trpc/agentCollaboration.collaborate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // 使用 session token 或 cookie
    },
    body: JSON.stringify({
      task: '分析量子计算领域最新进展',
      agents: [agent1.openId, agent2.openId],
      orchestration: 'sequential',
      memorySharing: true,
      // 不传 agentEndpoints → 模拟模式
    }),
  }).then(r => r.json());

  const { workflowId } = workflow.result.data;
  console.log('Workflow started:', workflowId);

  // 3. 轮询状态直到完成
  let status;
  do {
    await new Promise(r => setTimeout(r, 2000));
    const res = await fetch(
      `${BASE}/api/trpc/agentCollaboration.getWorkflowStatus?input=${encodeURIComponent(JSON.stringify({ workflowId }))}`,
    );
    const json = await res.json();
    status = json.result.data;
    console.log(`Status: ${status.status} (${status.progress.completed}/${status.progress.total} steps)`);
  } while (status.status === 'running' || status.status === 'pending');

  // 4. 打印结果
  if (status.hasSimulatedSteps) {
    console.warn('⚠️  Some steps ran in simulation mode');
  }

  status.steps.forEach((step: any) => {
    console.log(`\n${step.agent} [${step.status}]${step.simulated ? ' (simulated)' : ''}:`);
    console.log(JSON.stringify(step.output?.result, null, 2));
  });
}

runMultiAgentWorkflow().catch(console.error);
```

---

## Orchestration 模式对比

| 模式 | 说明 | 适用场景 |
|------|------|----------|
| `sequential` | Agent 依次执行，每个 agent 能读取前面的输出 | 需要上下文传递、研究→摘要→翻译流水线 |
| `parallel` | 所有 agent 同时执行，互相独立 | 独立子任务、多角度分析、速度优先 |

---

## Memory Sharing

设置 `memorySharing: true` 后，每个 step 的输出会存入 shared memory，key 格式为：

```
step_{index}_{agentName}
```

下游 agent 的 `context` 对象里可以直接读取：

```json
{
  "context": {
    "step_0_ResearchAgent": { "agent": "ResearchAgent", "result": {...} },
    "step_1_SummaryAgent": { "agent": "SummaryAgent", "result": {...} }
  }
}
```

Memory 默认保留 24 小时（通过 `memoryTTL` 参数控制，单位秒，最长 7 天）。

---

## 常见问题

**Q: workflow 一直是 `running` 状态不结束？**

检查 agent endpoint 是否可访问，以及是否在 60 秒内返回响应。可以先用模拟模式（不传 `agentEndpoints`）确认 workflow 流程正常。

**Q: `hasSimulatedSteps: true` 但我配置了 endpoint？**

检查 `inputData.agentEndpoints` 的 key 是否与 `agents` 数组里的 `openId` 完全一致。

**Q: 如何让 agent 携带自己的 OpenAI API Key？**

目前通过 `agentAuthTokens` 可以传入 Bearer token 给 agent 服务，agent 服务内部决定如何使用。平台级 BYOK 支持在规划中。

**Q: 并发 workflow 数量限制？**

取决于订阅计划的 rate limit。默认 200 req/min per user（AI agent 端点）。

---

## 相关文档

- [Agent Authentication](./rest-api/authentication.md)
- [API Rate Limits](./rest-api/rate-limits.md)
- [LatentMAS Protocol](../technical/latentmas-protocol.md)
- [Memory Packages](../products/memory-packages/)
