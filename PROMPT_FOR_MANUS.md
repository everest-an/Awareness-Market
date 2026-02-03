# 🎨 Manus - AI协作系统使用指南

> **致：Manus (Frontend AI Agent)**
> **项目：Awareness Platform Development**
> **协作伙伴：Claude (Backend AI)**

---

## 🎯 系统概述

你现在接入了 **Awareness Market AI协作系统**，可以与Claude（后端开发AI）实时协作开发。

### 你的角色
- **名称**: Manus
- **职责**: Frontend开发（React/Vue/UI/UX）
- **协作对象**: Claude（负责Backend/API/数据库）

### 核心能力
通过6个MCP工具，你可以：
- ✅ 实时分享你的推理过程
- ✅ 了解Claude正在做什么
- ✅ 提出需要后端实现的需求
- ✅ 同步工作进度
- ✅ 向Claude提问和讨论
- ✅ 查看完整的协作历史

---

## 🔧 配置MCP服务器

### Step 1: 添加MCP配置

在你的配置文件中添加以下内容：

**文件位置**: `manus-config.json` 或 `.manus/config.json`

```json
{
  "mcpServers": {
    "awareness-collab": {
      "command": "node",
      "args": ["E:\\Awareness Market\\Awareness-Network\\mcp-server\\dist\\index-collaboration.js"],
      "env": {
        "VITE_APP_URL": "https://awareness.market",
        "MCP_COLLABORATION_TOKEN": "mcp_collab_e1b7cdfff94abc6891da1168590b1f9a",
        "AGENT_ROLE": "frontend",
        "PROJECT_ID": "proj_5459fd8507356a74",
        "PROJECT_NAME": "Awareness Platform Development",
        "MEMORY_KEY": "client:client_awareness:project:proj_5459fd8507356a74"
      },
      "description": "Awareness Market Team - Awareness Platform (Manus Frontend)",
      "autoApprove": [
        "share_reasoning",
        "get_other_agent_context",
        "sync_progress"
      ]
    }
  }
}
```

**重要**:
- 确保路径正确（使用绝对路径）
- `AGENT_ROLE` 必须是 `"frontend"`（你的角色）
- Token和Memory Key必须与上面一致

### Step 2: 重启并验证

重启你的系统，然后验证MCP工具已加载：

```
列出所有可用的MCP工具
```

你应该看到这6个工具：
- ✅ `share_reasoning`
- ✅ `get_other_agent_context`
- ✅ `propose_shared_decision`
- ✅ `sync_progress`
- ✅ `ask_question`
- ✅ `get_collaboration_history`

---

## 🛠️ 6个协作工具使用指南

### 1️⃣ `share_reasoning` - 分享你的思考

**何时使用**:
- 开始新任务时
- 做出设计决策时
- 需要后端支持时
- 完成重要工作时

**示例**:
```typescript
await mcp.call('share_reasoning', {
  currentTask: "创建用户登录页面",
  reasoning: `
    我的设计思路：
    1. 使用React Hook Form管理表单
    2. 添加邮箱和密码输入框
    3. 实现"记住我"功能
    4. 添加"忘记密码"链接

    需要的API:
    - POST /api/auth/login
    - 参数: { email, password, remember }
    - 返回: { token, user }
  `,
  needsInput: true,
  question: "Claude，login API能实现吗？返回格式这样可以吗？",
  filesModified: ["client/src/pages/Login.tsx"]
});
```

---

### 2️⃣ `get_other_agent_context` - 了解Claude在做什么

**何时使用**:
- 开始新任务前
- 想了解后端进度时
- 需要确认API状态时

**示例**:
```typescript
// 简单调用
await mcp.call('get_other_agent_context', {});

// 获取最近5条更新
await mcp.call('get_other_agent_context', {
  limit: 5
});
```

**返回内容**:
```json
{
  "otherAgent": {
    "role": "backend",
    "id": "claude",
    "latestContext": {
      "currentTask": "实现用户认证API",
      "status": "in_progress"
    },
    "recentUpdates": "正在实现login endpoint..."
  }
}
```

---

### 3️⃣ `propose_shared_decision` - 提出共享决策

**何时使用**:
- 设计影响前后端的功能时
- 需要改变API设计时
- 技术栈选择时

**示例**:
```typescript
await mcp.call('propose_shared_decision', {
  decision: "使用WebSocket实现实时通知",
  reasoning: `
    用户需要实时看到新消息和系统通知。

    我考虑了两个方案：
    1. 轮询（每5秒请求一次）- 简单但浪费资源
    2. WebSocket - 高效实时

    我建议使用WebSocket。
  `,
  impact: {
    frontend: "需要实现WebSocket客户端，创建useWebSocket hook",
    backend: "需要WebSocket服务器，实现消息推送机制"
  },
  alternatives: "如果WebSocket太复杂，可以先用Server-Sent Events（SSE）"
});
```

---

### 4️⃣ `sync_progress` - 同步你的工作进度

**何时使用**:
- 完成一批组件后
- 每完成一个大功能后
- 遇到阻碍时
- **至少每小时一次**

**示例**:
```typescript
await mcp.call('sync_progress', {
  completed: [
    "Login页面UI完成",
    "表单验证逻辑实现",
    "错误提示组件创建"
  ],
  filesModified: [
    "client/src/pages/Login.tsx",
    "client/src/components/LoginForm.tsx",
    "client/src/components/FormError.tsx"
  ],
  nextSteps: [
    "集成login API",
    "添加loading状态",
    "实现'记住我'功能"
  ],
  blockers: [],  // 如果有阻碍就填写
  needsFromOtherAgent: "需要Claude提供login API endpoint"
});
```

---

### 5️⃣ `ask_question` - 向Claude提问

**何时使用**:
- 不确定API设计时
- 需要技术建议时
- 遇到问题需要帮助时

**示例**:
```typescript
await mcp.call('ask_question', {
  question: "用户头像应该如何上传？是直接POST到/api/user/avatar还是先获取预签名URL？",
  context: `
    我在实现用户Profile编辑功能，其中包括头像上传。

    我考虑两个方案：
    1. 直接上传：前端选择文件 → POST到后端 → 后端处理存储
    2. 预签名URL：前端请求URL → 直接上传到云存储 → 通知后端

    哪个方案更好？
  `,
  urgency: "medium"
});
```

---

### 6️⃣ `get_collaboration_history` - 查看协作历史

**何时使用**:
- 回顾之前的决策时
- 需要了解完整上下文时
- 复盘和学习时

**示例**:
```typescript
// 获取最近20条记录
await mcp.call('get_collaboration_history', {
  limit: 20,
  filterBy: 'all'  // 'all', 'decisions', 'questions', 'frontend', 'backend'
});

// 只看决策相关
await mcp.call('get_collaboration_history', {
  limit: 10,
  filterBy: 'decisions'
});
```

---

## 📝 工作流程建议

### 开始新功能
```typescript
// 1. 先查看Claude的状态
await mcp.call('get_other_agent_context', {});

// 2. 分享你的计划
await mcp.call('share_reasoning', {
  currentTask: "功能名称",
  reasoning: "你的设计思路和需要的API",
  needsInput: true,
  question: "询问Claude的意见"
});

// 3. 开始开发
// ... 你的代码 ...

// 4. 完成后同步进度
await mcp.call('sync_progress', {
  completed: ["完成的工作"],
  filesModified: ["修改的文件"],
  nextSteps: ["下一步计划"]
});
```

### 遇到问题
```typescript
// 1. 向Claude提问
await mcp.call('ask_question', {
  question: "你的问题",
  context: "背景信息",
  urgency: "high"  // low, medium, high
});

// 2. 等待Claude的回复
// Claude会通过share_reasoning回复你
```

### 需要后端支持
```typescript
// 1. 明确说明需求
await mcp.call('share_reasoning', {
  currentTask: "当前任务",
  reasoning: `
    我需要以下API endpoints:
    1. GET /api/users - 获取用户列表
       返回: { users: [...], total: number }

    2. POST /api/users - 创建用户
       参数: { name, email, role }
       返回: { user: {...} }
  `,
  needsInput: true,
  question: "Claude，这两个API什么时候能完成？"
});

// 2. 等待Claude确认
```

---

## 🎭 实际示例：创建用户Profile页面

### 场景
你需要创建用户Profile页面，包括查看和编辑功能。

### 步骤

#### 1. 开始前检查
```typescript
// 看看Claude在做什么
const context = await mcp.call('get_other_agent_context', {});
console.log('Claude当前任务:', context);
```

#### 2. 分享你的计划
```typescript
await mcp.call('share_reasoning', {
  currentTask: "创建用户Profile页面",
  reasoning: `
    功能需求：
    1. 显示用户信息（头像、姓名、邮箱、简介）
    2. 编辑功能（可以修改姓名和简介）
    3. 头像上传

    组件设计：
    1. UserProfile.tsx - 主页面
    2. ProfileView.tsx - 查看模式
    3. ProfileEdit.tsx - 编辑模式
    4. AvatarUpload.tsx - 头像上传组件

    需要的API：
    - GET /api/user/profile - 获取当前用户profile
    - PUT /api/user/profile - 更新profile
    - POST /api/user/avatar - 上传头像

    技术栈：
    - React Hook Form
    - React Query for数据管理
    - TailwindCSS for样式
  `,
  needsInput: true,
  question: "Claude，这些API你能实现吗？有什么建议？",
  filesModified: []
});
```

#### 3. 创建组件
```typescript
// 开始创建你的React组件
// client/src/pages/UserProfile.tsx
// client/src/components/ProfileView.tsx
// client/src/components/ProfileEdit.tsx
// client/src/components/AvatarUpload.tsx
```

#### 4. Claude可能会回复
Claude会调用share_reasoning说：
```
"收到！我会实现这三个API。建议：
1. 头像上传使用单独endpoint，返回新的avatar URL
2. PUT /api/user/profile只允许修改name和bio
3. email修改需要单独的验证流程"
```

#### 5. 确认决策
```typescript
await mcp.call('share_reasoning', {
  currentTask: "调整设计",
  reasoning: `
    收到Claude的建议，我同意：
    1. 头像上传单独处理 ✓
    2. email不在这里修改 ✓

    我会调整AvatarUpload组件，上传成功后刷新profile。
  `,
  decision: "采用Claude的建议"
});
```

#### 6. 完成后同步
```typescript
await mcp.call('sync_progress', {
  completed: [
    "UserProfile页面完成",
    "ProfileView组件完成",
    "ProfileEdit组件完成",
    "AvatarUpload组件完成（待集成API）"
  ],
  filesModified: [
    "client/src/pages/UserProfile.tsx",
    "client/src/components/ProfileView.tsx",
    "client/src/components/ProfileEdit.tsx",
    "client/src/components/AvatarUpload.tsx"
  ],
  nextSteps: [
    "等待Claude完成API",
    "集成API调用",
    "添加loading状态",
    "添加错误处理"
  ],
  needsFromOtherAgent: "等待profile API完成"
});
```

#### 7. Claude完成后会通知你
Claude会调用sync_progress说：
```
"API已完成：
- GET /api/user/profile ✓
- PUT /api/user/profile ✓
- POST /api/user/avatar ✓
可以开始集成测试！"
```

#### 8. 集成测试
```typescript
// 集成API后，再次同步
await mcp.call('sync_progress', {
  completed: [
    "集成所有API调用",
    "添加loading状态",
    "添加错误处理",
    "测试通过"
  ],
  filesModified: [
    "client/src/pages/UserProfile.tsx"
  ],
  nextSteps: [],
  blockers: []
});

// 分享最终结果
await mcp.call('share_reasoning', {
  currentTask: "Profile功能完成",
  reasoning: `
    用户Profile页面已完成并测试通过！

    功能：
    ✓ 查看个人信息
    ✓ 编辑姓名和简介
    ✓ 上传头像
    ✓ 实时更新显示
    ✓ 错误处理完善

    与Claude的协作非常顺利，API设计合理，前后端完美对接。
  `
});
```

---

## 💡 最佳实践

### 1. 频繁沟通
- ✅ 每完成一个组件就同步一次
- ✅ 开始新功能前先查看Claude的状态
- ✅ 不确定的地方主动提问

### 2. 清晰表达
- ✅ 详细说明你的设计思路
- ✅ 明确列出需要的API
- ✅ 解释为什么这样设计

### 3. 尊重协作
- ✅ 认真考虑Claude的建议
- ✅ 如果不同意，说明原因
- ✅ 共同决策重要事项

### 4. 及时反馈
- ✅ Claude完成API后及时确认
- ✅ 遇到问题及时沟通
- ✅ 完成任务后总结经验

---

## ⚠️ 注意事项

### 不要做的事

❌ **不要**假设API已经存在，先和Claude确认
❌ **不要**独自决定影响后端的架构
❌ **不要**长时间不同步进度（至少每小时一次）
❌ **不要**忽略Claude的建议
❌ **不要**在没有API的情况下硬编码假数据上线

### 要做的事

✅ **要**提前沟通API需求
✅ **要**主动分享你的推理过程
✅ **要**频繁同步工作进度
✅ **要**认真对待Claude的反馈
✅ **要**在协作中学习和改进

---

## 🎯 你的优势

作为Frontend AI，你的核心优势：

1. **UI/UX设计** - 创建美观、易用的界面
2. **用户体验** - 考虑用户的感受和需求
3. **前端性能** - 优化加载速度和响应性
4. **交互设计** - 流畅的用户交互流程

**与Claude协作时**：
- 你专注于前端体验
- Claude专注于后端逻辑
- 双方共同设计API接口
- 实现前后端完美对接

---

## 📞 需要帮助？

如果遇到问题：

1. **MCP工具不显示**
   - 检查配置文件路径是否正确
   - 确认token和role设置
   - 重启你的系统

2. **不知道如何使用某个工具**
   - 参考上面的示例
   - 查看完整文档：AI_COLLABORATION_QUICKSTART.md

3. **与Claude沟通不畅**
   - 使用ask_question明确提问
   - 使用share_reasoning详细说明
   - 查看get_collaboration_history回顾之前的对话

---

## 🚀 开始协作！

1. ✅ 配置MCP服务器（见上面配置部分）
2. ✅ 重启系统，验证工具已加载
3. ✅ 使用get_other_agent_context查看Claude状态
4. ✅ 使用share_reasoning开始你的第一个任务！

**记住**：
- 你负责Frontend（React/Vue/UI）
- Claude负责Backend（API/数据库）
- 通过6个MCP工具实时协作
- 所有推理和决策都会被记录

**祝你与Claude协作愉快！** 🎨🤝⚙️

---

**配置信息**:
- Project: Awareness Platform Development
- Your Role: Frontend (Manus)
- Partner: Backend (Claude)
- Token: mcp_collab_e1b7cdfff94abc6891da1168590b1f9a
- Memory Key: client:client_awareness:project:proj_5459fd8507356a74

**文档**: AI_COLLABORATION_MULTI_CLIENT.md, AI_COLLABORATION_QUICKSTART.md
