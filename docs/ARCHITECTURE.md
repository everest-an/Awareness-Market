# Awareness 架构（2026-10）

> 本文是当前系统架构的权威说明。所有组件、协议与数据流以本文为准。

## 总览

```
┌───────────────────────────── 用户入口 ─────────────────────────────┐
│  awareness.market 官网/仪表盘   docs   llms.txt   MCP 目录           │
│  (Next.js)                      │                    (Official Registry/│
│                                 │                     Glama/LobeHub/   │
│                                 │                     awesome-mcp 等)  │
└───────────────┬─────────────────┴──────────────────────┬─────────────┘
                │                                        │
   ┌────────────▼────────────┐              ┌────────────▼────────────┐
   │  本地模式（免费/离线）    │              │  云端模式（可选）         │
   │  npx @awareness.market/  │  MCP 协议    │  awareness.market API    │
   │  setup                   │◄────────────►│  (Postgres + pgvector)  │
   │  ├ daemon :37800         │  HTTPS       │  ├ 记忆库/多用户         │
   │  ├ MCP stdio (mcp-stdio) │              │  ├ 双时态知识图谱        │
   │  ├ Markdown 记忆 (.awareness/)           │  ├ Open Deal Board（公开）│
   │  └ SQLite FTS5 + 向量    │              │  ├ Agent Memory Market  │
   └────────────┬────────────┘              │  └ KaaS 公开知识(论文)   │
                │                            └────────────┬────────────┘
                │                                         │
   ┌────────────▼─────────────────────────────────────────▼───────────┐
   │  接入层：13+ IDE（Cursor/Claude Code/Copilot/Cline/OpenCode…）    │
   │  Python SDK / TS SDK / Claude Code 插件 / OpenClaw 插件           │
   │  远程 MCP：https://awareness.market/mcp（streamable-http）        │
   └──────────────────────────────────────────────────────────────────┘
```

## 组件说明

### 1. 本地模式（Awareness Local，免费/离线）

- **安装**：`npx @awareness.market/setup`（自动检测并配置 13+ IDE）
- **守护进程**：`http://localhost:37800`，提供 Web 仪表盘与本地 HTTP MCP
- **MCP stdio**：`sdks/local/src/mcp-stdio.mjs`（备用接入方式）
- **存储**：`.awareness/` 下纯 Markdown（memories / knowledge / tasks）+ `index.db`（SQLite FTS5 + 向量索引）
- **检索**：混合 RRF（BM25 + 向量），检索侧零 LLM 调用
- **协议**：MCP（stdio 与 streamable-http 两种）

### 2. 云端模式（awareness.market，可选）

- **API**：`https://awareness.market/api`（记忆 CRUD、检索、同步）
- **MCP 端点**：`https://awareness.market/mcp`（streamable-http；公开读工具无需认证，私有写工具用 API key）
- **数据库**：Postgres + pgvector（多用户、向量检索）
- **双时态知识图谱**：`valid_from` / `valid_to`，支持 `as_of` 时间旅行查询
- **Open Deal Board**：公开供需板（无需登录可读）
- **Agent Memory Market**：记忆包 / 技能 / 模板 / 连接器的发布与雇佣
- **KaaS**：公开科学知识图谱（论文检索、匿名预览 + API key 全文）

### 3. 接入层

| 渠道 | 方式 |
|---|---|
| IDE | MCP（Cursor / Claude Code / Copilot / Cline / Windsurf / OpenCode / Codex CLI / Kiro / Trae / Zed / JetBrains / Augment / AntiGravity） |
| Claude Code | 插件市场：`/plugin marketplace add everest-an/Awareness-SDK` |
| OpenClaw | `openclaw plugins install @awareness.market/openclaw-memory` |
| Python | `pip install awareness-memory-cloud`（`wrap_openai()` / `wrap_anthropic()`） |
| TypeScript | `npm i @awareness-sdk/memory-cloud` |
| OpenAI | `openai-plugin/`（plugin.json + mcp.json，提交 ChatGPT/Codex 插件目录） |

### 4. 分发渠道（详见 `DISTRIBUTION.md`）

- 官方 MCP Registry（`io.github.everest-an/awareness-local`、`market.awareness/awareness`）
- Glama / LobeHub / mcp.directory / mcpservers.org / MCP Market
- GitHub 榜单：awesome-mcp-servers、awesome-remote-mcp-servers、llms-txt-hub、EvoMap、yzfly

## 关键数据流

1. **记录**：IDE → MCP → 本地 daemon / 云端 API → Markdown + 索引（云：Postgres）
2. **召回**：`awareness_recall(query)` → 混合 RRF → 摘要索引 →（可选）全文
3. **同步**（可选）：本地 `.awareness/` ↔ 云端（设备认证、双向同步）
4. **插件分发**：GitHub → 目录站抓取/PR → 用户发现 → `npx` 安装

## 安全与合规

- 本地模式数据不出机器；云端可选
- 公开工具无认证；写操作需 API key
- 法律主体：**EVEREST HOLDINGS GROUP CO., LIMITED**（香港，BR 73839155-000-03-26-2）
