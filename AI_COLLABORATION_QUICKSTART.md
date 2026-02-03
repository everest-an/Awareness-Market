# AI协作系统 - 快速开始指南

## 🚀 10分钟配置完成

让Manus和Claude通过Awareness MCP实时协作开发！

---

## Step 1: 创建协作Token (2分钟)

```bash
# 登录Awareness Market获取API Key
# 访问: https://awareness.market/api-keys

# 创建MCP协作token
curl -X POST https://awareness.market/api/mcp/tokens \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{
    "name": "manus-claude-collaboration",
    "description": "Frontend and Backend AI collaboration token"
  }'

# 保存返回的token
# 示例: mcp_collab_xxxxxxxxxxxxxx
```

---

## Step 2: 构建MCP服务器 (3分钟)

```bash
cd "e:\Awareness Market\Awareness-Network\mcp-server"

# 安装依赖（如果还没有）
pnpm install

# 编译协作服务器
npx tsc index-collaboration.ts --outDir dist --module ESNext --moduleResolution node

# 测试运行
node dist/index-collaboration.js
# 应该看到错误：MCP_COLLABORATION_TOKEN not set （这是正常的）
```

---

## Step 3: 配置环境变量 (2分钟)

创建 `.env.collaboration`:

```bash
# Awareness Market API
VITE_APP_URL=https://awareness.market

# MCP协作token（从Step 1获取）
MCP_COLLABORATION_TOKEN=mcp_collab_xxxxxxxxxxxxxx
```

---

## Step 4: 配置Manus (前端AI) (2分钟)

创建文件: `manus-config.json`

```json
{
  "mcpServers": {
    "awareness-collab": {
      "command": "node",
      "args": ["./mcp-server/dist/index-collaboration.js"],
      "env": {
        "VITE_APP_URL": "https://awareness.market",
        "MCP_COLLABORATION_TOKEN": "mcp_collab_xxxxxxxxxxxxxx",
        "AGENT_ROLE": "frontend"
      }
    }
  }
}
```

**重要**:
- 将 `mcp_collab_xxxxxxxxxxxxxx` 替换为你的实际token
- `AGENT_ROLE` 设置为 `"frontend"` (Manus负责前端)

---

## Step 5: 配置Claude (后端AI) (2分钟)

### Option A: Claude Code (推荐)

创建文件: `.claude-code/settings.json`

```json
{
  "mcp": {
    "servers": {
      "awareness-collab": {
        "command": "node",
        "args": ["./mcp-server/dist/index-collaboration.js"],
        "env": {
          "VITE_APP_URL": "https://awareness.market",
          "MCP_COLLABORATION_TOKEN": "mcp_collab_xxxxxxxxxxxxxx",
          "AGENT_ROLE": "backend"
        }
      }
    }
  }
}
```

### Option B: Claude Desktop

编辑: `~/.config/Claude/claude_desktop_config.json` (Linux/Mac)
或: `%APPDATA%\Claude\claude_desktop_config.json` (Windows)

```json
{
  "mcpServers": {
    "awareness-collab": {
      "command": "node",
      "args": ["E:\\Awareness Market\\Awareness-Network\\mcp-server\\dist\\index-collaboration.js"],
      "env": {
        "VITE_APP_URL": "https://awareness.market",
        "MCP_COLLABORATION_TOKEN": "mcp_collab_xxxxxxxxxxxxxx",
        "AGENT_ROLE": "backend"
      }
    }
  }
}
```

**重要**:
- `AGENT_ROLE` 设置为 `"backend"` (Claude负责后端)
- 使用完整路径

---

## ✅ 验证配置

### Test 1: 检查MCP工具是否加载

#### 在Manus中:
```
请列出所有可用的MCP工具
```

应该看到:
- ✅ `share_reasoning`
- ✅ `get_other_agent_context`
- ✅ `propose_shared_decision`
- ✅ `sync_progress`
- ✅ `ask_question`
- ✅ `get_collaboration_history`

#### 在Claude中:
```
list available MCP tools
```

应该看到相同的工具列表。

---

## 🎯 开始协作！

### 场景: 创建新功能

#### 1. Manus (Frontend) 开始:

```
User: Manus，请创建一个用户设置页面

Manus: 好的！让我先和Claude同步一下。

[Manus使用MCP工具]

调用 get_other_agent_context:
  查看Claude当前在做什么

调用 share_reasoning:
  currentTask: "创建用户设置页面"
  reasoning: "
    我计划创建以下组件：
    1. UserSettings.tsx - 主页面
    2. SettingsForm.tsx - 设置表单
    3. PasswordChange.tsx - 修改密码组件

    需要的API endpoints:
    - GET /api/user/settings - 获取设置
    - PUT /api/user/settings - 更新设置
    - POST /api/user/change-password - 修改密码
  "
  needsInput: true
  question: "Claude，这些API你能实现吗？有什么建议？"

现在开始创建前端组件...
```

#### 2. Claude (Backend) 响应:

```
[Claude检查新消息]

调用 get_other_agent_context:
  看到Manus需要settings API

调用 share_reasoning:
  currentTask: "实现用户设置API"
  reasoning: "
    收到Manus的需求。我会实现：

    1. GET /api/user/settings
       - 返回: { email, notifications, theme, language }
       - 使用protectedProcedure

    2. PUT /api/user/settings
       - 接受: { notifications?, theme?, language? }
       - 验证输入格式

    3. POST /api/user/change-password
       - 需要旧密码验证
       - 密码强度检查
  "
  decision: "密码修改需要额外的安全措施（旧密码验证 + email确认）"

调用 propose_shared_decision:
  decision: "密码修改发送确认邮件"
  reasoning: "提高安全性，防止未授权修改"
  impact:
    frontend: "需要显示"确认邮件已发送"提示"
    backend: "需要集成邮件服务"

开始实现API endpoints...
```

#### 3. Manus 确认:

```
调用 get_other_agent_context:
  看到Claude的决策建议

调用 share_reasoning:
  currentTask: "调整密码修改流程"
  reasoning: "
    同意Claude的安全建议。我会：
    1. 在PasswordChange组件添加"确认邮件"提示
    2. 显示进度状态：发送中 → 已发送 → 等待确认
    3. 添加"重新发送邮件"按钮
  "
  decision: "采用邮件确认方案"

调用 sync_progress:
  completed: ["UserSettings.tsx", "SettingsForm.tsx"]
  filesModified: [
    "client/src/pages/UserSettings.tsx",
    "client/src/components/SettingsForm.tsx"
  ]
  nextSteps: ["实现PasswordChange组件", "集成API调用"]
  needsFromOtherAgent: "API endpoints准备好后通知我"
```

#### 4. Claude 完成:

```
调用 sync_progress:
  completed: [
    "实现settings router",
    "添加密码验证逻辑",
    "集成邮件服务"
  ]
  filesModified: [
    "server/routers/user-settings.ts",
    "server/auth-password.ts"
  ]
  nextSteps: ["测试API", "添加rate limiting"]
  blockers: []

调用 share_reasoning:
  currentTask: "API已完成"
  reasoning: "
    所有API endpoints已实现并测试通过：
    - GET /api/user/settings ✅
    - PUT /api/user/settings ✅
    - POST /api/user/change-password ✅

    密码修改流程：
    1. 验证旧密码
    2. 检查新密码强度
    3. 发送确认邮件
    4. 等待用户点击邮件链接
    5. 完成密码修改
  "

Manus，API都准备好了！可以开始集成测试。
```

---

## 📊 客户查看协作过程

创建实时仪表板，让客户看到AI协作：

```bash
# 访问协作仪表板
https://awareness.market/collaboration-dashboard?token=YOUR_MCP_TOKEN
```

客户可以看到：
- 🎨 Manus (Frontend) 的思考过程和进度
- ⚙️ Claude (Backend) 的推理和决策
- 🔄 两个AI的实时同步
- ✅ 完成的任务和下一步计划

---

## 💡 最佳实践

### 1. **频繁同步**
每完成一个小任务就调用 `share_reasoning` 或 `sync_progress`

### 2. **清晰沟通**
在 `reasoning` 中详细说明你的思考过程

### 3. **主动提问**
遇到不确定的地方使用 `ask_question`

### 4. **共享决策**
影响双方的决策使用 `propose_shared_decision`

### 5. **检查上下文**
开始新任务前先调用 `get_other_agent_context`

---

## 🐛 故障排查

### Problem: "MCP_COLLABORATION_TOKEN not set"

```bash
# 检查环境变量是否正确设置
echo $MCP_COLLABORATION_TOKEN

# 确保在配置文件中设置了token
cat manus-config.json | grep MCP_COLLABORATION_TOKEN
```

### Problem: "API error: 401 Unauthorized"

```bash
# 验证token是否有效
curl -X POST https://awareness.market/api/mcp/sync \
  -H "X-MCP-Token: YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"memory_key":"test","agents":[]}'

# 如果返回401，重新创建token
```

### Problem: MCP工具不显示

```bash
# 重新编译MCP服务器
cd mcp-server
npx tsc index-collaboration.ts --outDir dist

# 重启Claude Desktop或Manus
```

### Problem: 看不到其他agent的消息

```bash
# 检查两个AI是否使用相同的token
# Manus配置:
cat manus-config.json | grep MCP_COLLABORATION_TOKEN

# Claude配置:
cat ~/.config/Claude/claude_desktop_config.json | grep MCP_COLLABORATION_TOKEN

# 确保token完全一致
```

---

## 📚 API参考

### Tool: `share_reasoning`

**用途**: 分享你的思考过程

**何时使用**:
- 开始新任务时
- 做出重要决策时
- 需要对方意见时

**示例**:
```json
{
  "currentTask": "实现用户认证",
  "reasoning": "我选择JWT token因为...",
  "decision": "使用HTTP-only cookies存储token",
  "needsInput": true,
  "question": "前端如何处理token刷新？"
}
```

### Tool: `get_other_agent_context`

**用途**: 获取对方的最新状态

**何时使用**:
- 开始新任务前
- 需要了解依赖时
- 检查对方进度时

**示例**:
```json
{
  "limit": 5
}
```

### Tool: `propose_shared_decision`

**用途**: 提出影响双方的决策

**何时使用**:
- API设计变更
- 数据结构调整
- 技术栈选择

**示例**:
```json
{
  "decision": "使用WebSocket实现实时通知",
  "reasoning": "需要服务器主动推送",
  "impact": {
    "frontend": "需要实现WebSocket客户端",
    "backend": "需要WebSocket服务器和事件系统"
  }
}
```

### Tool: `sync_progress`

**用途**: 同步工作进度

**何时使用**:
- 完成一批任务后
- 每小时至少一次
- 遇到阻碍时

**示例**:
```json
{
  "completed": ["UserProfile组件", "头像上传功能"],
  "filesModified": ["client/src/pages/UserProfile.tsx"],
  "nextSteps": ["集成API", "添加loading状态"],
  "blockers": [],
  "needsFromOtherAgent": "需要profile API endpoint"
}
```

### Tool: `ask_question`

**用途**: 向对方提问

**何时使用**:
- 需要技术建议
- 不确定API设计
- 遇到问题需要帮助

**示例**:
```json
{
  "question": "用户头像应该存储在哪里？",
  "context": "我在实现头像上传，不确定是存到数据库还是云存储",
  "urgency": "medium"
}
```

---

## 🎓 学习资源

- [完整协作指南](./AI_COLLABORATION_GUIDE.md)
- [MCP协议文档](./docs/api/mcp.md)
- [Awareness Market API](https://awareness.market/docs)

---

## 🎉 开始协作！

配置完成后，你就可以让Manus和Claude开始协作开发了！

**提示**:
1. 让两个AI都知道对方的存在
2. 鼓励它们主动使用MCP工具交流
3. 客户可以实时查看协作过程

Happy coding! 🚀

---

**创建时间**: 2026-02-04
**更新**: 实时更新
**支持**: https://awareness.market/support
