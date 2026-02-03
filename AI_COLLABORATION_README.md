# 🤝 AI协作系统 - Manus × Claude

> 让两个AI通过Awareness MCP实时协作，为客户透明服务

---

## 🎯 实现目标

✅ **Manus（前端）和Claude（后端）实时共享推理过程**
✅ **两个AI独立协作，各自负责专业领域**
✅ **客户可以实时查看完整的协作过程**
✅ **所有决策都有推理链记录，完全可追溯**

---

## 📚 文档导航

### 🚀 立即开始
**[快速开始指南](./AI_COLLABORATION_QUICKSTART.md)** (推荐)
- 10分钟完成配置
- 分步骤清晰说明
- 包含故障排查

### 📖 深入了解
**[完整协作指南](./AI_COLLABORATION_GUIDE.md)**
- 详细架构设计
- 协作流程示例
- 客户仪表板设计

### 📊 概览总结
**[系统总结文档](./AI_COLLABORATION_SUMMARY.md)**
- 所有文件清单
- 核心概念解释
- 优势和下一步

---

## 🛠️ 核心文件

| 文件 | 用途 | 状态 |
|------|------|------|
| `mcp-server/index-collaboration.ts` | MCP协作服务器 | ✅ 已完成 |
| `mcp-server/package.json` | 构建配置 | ✅ 已更新 |
| `AI_COLLABORATION_GUIDE.md` | 完整指南 | ✅ 已完成 |
| `AI_COLLABORATION_QUICKSTART.md` | 快速开始 | ✅ 已完成 |
| `AI_COLLABORATION_SUMMARY.md` | 系统总结 | ✅ 已完成 |

---

## 🔧 6个MCP协作工具

| Tool | 功能 | 使用频率 |
|------|------|----------|
| `share_reasoning` | 分享推理过程 | 🔥🔥🔥 高 |
| `get_other_agent_context` | 获取对方状态 | 🔥🔥🔥 高 |
| `propose_shared_decision` | 提出共享决策 | 🔥🔥 中 |
| `sync_progress` | 同步工作进度 | 🔥🔥🔥 高 |
| `ask_question` | 向对方提问 | 🔥🔥 中 |
| `get_collaboration_history` | 查看协作历史 | 🔥 低 |

---

## ⚡ 快速开始（3步）

### Step 1: 创建Token
```bash
curl -X POST https://awareness.market/api/mcp/tokens \
  -H "X-API-Key: YOUR_KEY" \
  -d '{"name":"manus-claude-collab"}'
```

### Step 2: 构建服务器
```bash
cd mcp-server
pnpm install
pnpm run build:collab
```

### Step 3: 配置两个AI

**Manus (Frontend):**
```json
{
  "env": {
    "MCP_COLLABORATION_TOKEN": "mcp_xxx",
    "AGENT_ROLE": "frontend"
  }
}
```

**Claude (Backend):**
```json
{
  "env": {
    "MCP_COLLABORATION_TOKEN": "mcp_xxx",
    "AGENT_ROLE": "backend"
  }
}
```

**完整配置**: 见 [快速开始指南](./AI_COLLABORATION_QUICKSTART.md)

---

## 💬 使用示例

### Manus开始任务:
```
1. [get_other_agent_context] - 检查Claude在做什么
2. [share_reasoning] - "我要创建UserProfile页面，需要API"
3. 创建组件...
4. [sync_progress] - "已完成UserProfile.tsx"
```

### Claude响应:
```
1. [get_other_agent_context] - 看到Manus的需求
2. [share_reasoning] - "我会实现profile API"
3. 实现endpoints...
4. [sync_progress] - "API已完成并测试通过"
```

**详细示例**: 见 [快速开始指南 Step 6](./AI_COLLABORATION_QUICKSTART.md#-开始协作)

---

## 📊 客户体验

客户访问: `https://awareness.market/collaboration-dashboard?token=YOUR_TOKEN`

看到：
- 🎨 Manus的思考过程（实时）
- ⚙️ Claude的决策推理（实时）
- 🔄 两个AI的协作同步
- ✅ 完成的任务和下一步计划
- 📝 完整的Reasoning Chain

**完全透明的AI开发过程！**

---

## 🎓 核心概念

### Shared Memory
两个AI通过 `memory_key = "project:awareness:dev"` 共享上下文

### Agent Role
- `frontend` = Manus (UI/UX/组件)
- `backend` = Claude (API/数据库/逻辑)

### Reasoning Chain
每个思考步骤都被记录，形成完整的推理链

### Consensus
MCP自动合并两个AI的推理，生成统一行动计划

---

## 🔒 安全

- ✅ 每个项目使用独立的MCP token
- ✅ 不同token的数据完全隔离
- ✅ 客户只能访问自己的协作数据
- ✅ HTTP-only cookies + JWT认证

---

## 📈 优势

| 优势 | 说明 |
|------|------|
| **透明度** | 客户看到完整开发过程 |
| **效率** | 两个AI并行工作，自动同步 |
| **质量** | 前后端自动一致，减少bug |
| **可追溯** | 完整推理链，便于维护 |

---

## 🚀 部署

### 本地开发
```bash
# 启动协作服务器
cd mcp-server
pnpm run dev:collab
```

### 生产部署
```bash
# 构建
pnpm run build:collab

# 运行
node dist/index-collaboration.js
```

**完整部署**: 见 [快速开始指南](./AI_COLLABORATION_QUICKSTART.md)

---

## 🐛 故障排查

### MCP工具不显示
```bash
# 重新构建
cd mcp-server
pnpm run build:collab

# 检查配置
echo $MCP_COLLABORATION_TOKEN
```

### 看不到其他agent消息
```bash
# 确保两个AI使用相同的token
cat manus-config.json | grep MCP_COLLABORATION_TOKEN
cat claude-config.json | grep MCP_COLLABORATION_TOKEN
```

**更多问题**: 见 [快速开始指南 - 故障排查](./AI_COLLABORATION_QUICKSTART.md#-故障排查)

---

## 📞 支持

- 📖 [完整文档](./AI_COLLABORATION_GUIDE.md)
- 🚀 [快速开始](./AI_COLLABORATION_QUICKSTART.md)
- 📊 [系统总结](./AI_COLLABORATION_SUMMARY.md)
- 🌐 [Awareness Market](https://awareness.market)
- 📧 support@awareness.market

---

## 🎉 开始使用

```bash
# 1. 跟随快速开始指南
cat AI_COLLABORATION_QUICKSTART.md

# 2. 配置两个AI

# 3. 开始协作！
```

**Happy Collaborating! 🤝🚀**

---

**创建**: 2026-02-04
**版本**: 1.0.0
**许可**: MIT
**作者**: Awareness Market Team

---

## 🌟 关键亮点

这是一个**真正创新的AI协作系统**：

1. ✨ **业界首创** - 多AI实时推理共享
2. 🔄 **完全透明** - 客户看到所有思考过程
3. 🎯 **自动对齐** - 前后端接口自动同步
4. 📝 **可追溯** - 完整的Reasoning Chain记录
5. 🚀 **即用即部** - 10分钟完成配置

**这就是AI协作的未来！**
