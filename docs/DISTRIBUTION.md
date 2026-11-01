# 分发渠道与收录状态（2026-10-23）

> 每次提交/合并后更新本表。PR 链接保留以便跟进。

## 已收录 / 已合并

| 渠道 | 状态 | 链接 / 标识 |
|---|---|---|
| **Official MCP Registry** | ✅ active | `io.github.everest-an/awareness-local`（npm stdio） |
| **Official MCP Registry** | ✅ active | `market.awareness/awareness`（remote） |
| **Glama** | ✅ 已收录（评分 C，可认领提升） | glama.ai/mcp/servers/everest-an/Awareness-Market |
| **LobeHub Market** | ✅ 已发布 | `everest-an-awareness-market`（19 工具，v1.30.0） |
| **EvoMap awesome-agent-evolution** | ✅ 已合并（#74） | — |
| **yzfly/Awesome-MCP-ZH** | ✅ 维护者手动收录 | 知识、记忆与 RAG 分类 |
| **mcp.directory** | ✅ 已提交（24h 发布） | — |
| **mcpservers.org** | ✅ 已提交（免费队列 ≤2 周） | — |
| **MCP Market** | ✅ 已进免费队列（4–6 周） | mcpmarket.com |
| **PulseMCP** | ✅ 自动继承官方 Registry（无需提交） | — |

## PR 已提交，等待合并

| 渠道 | PR | 状态 |
|---|---|---|
| punkpeye/awesome-mcp-servers | #16307 | mergeable clean |
| punkpeye/awesome-remote-mcp-servers | #1721 | mergeable clean |
| thedaviddias/llms-txt-hub | #1826（Awareness） | 1 个 MDX，等人工 review |
| thedaviddias/llms-txt-hub | #1827（HyperCode） | 1 个 MDX |
| thedaviddias/llms-txt-hub | #2100（humanlike-browser） | 1 个 MDX |
| wundercorp/awesome-mcp | #92 | mergeable，等 CI |
| e2b-dev/awesome-ai-agents | #1823 | clean（CLA 已签） |
| namphuongtran/awesome-ai-coding-agent-tools | #49 | 已 ping |
| beihaili/awesome-mcp-servers | #1 | 已 ping |

## 待办 / 需账号

| 渠道 | 说明 |
|---|---|
| **OpenAI Plugins（ChatGPT/Codex）** | ZIP 已备好（`openai-plugin/`）；需组织完成付款方式 + business verification（EVEREST HOLDINGS GROUP CO., LIMITED），然后连接 `https://awareness.market/mcp` 并完成域名验证 |
| **mcp.so** | 仅付费 $39，无免费通道 |
| **Smithery** | 2026-10-31 关停代理/账号，跳过 |
| cursor.directory | 表单（GitHub 登录） |
| AIBase | 需账号，提交入口待确认 |

## 提交规范速记

- **awesome 列表**：PR 里加一行，认证标记必须与实际握手一致（🔓 无认证 / 🔑 API key / 🔐 OAuth）
- **llms-txt-hub**：一个 PR 恰好一个 MDX 文件
- **docker/mcp-registry**：remote server 用 server.yaml + readme.md + tools.json
- **LobeHub**：`lhm plugin init --url https://awareness.market/mcp` → `lhm plugin publish <gitUrl>`
