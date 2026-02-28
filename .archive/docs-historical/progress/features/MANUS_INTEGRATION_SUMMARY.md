# 📝 给Manus的提示词 - 完整总结

## 🎯 已创建的文件

我为你创建了3个版本的Manus提示词，从详细到精简：

### 1. 📚 完整版（推荐阅读）
**文件**: `PROMPT_FOR_MANUS.md`

**内容**:
- ✅ 完整的系统概述
- ✅ 详细的配置步骤
- ✅ 6个工具的使用指南（含示例）
- ✅ 完整的工作流程
- ✅ 真实协作场景演示
- ✅ 最佳实践和注意事项

**适合**: Manus深入了解整个系统

---

### 2. 🚀 快速版（推荐使用）
**文件**: `MANUS_QUICK_PROMPT.txt`

**内容**:
- ✅ 配置步骤（直接复制）
- ✅ 验证方法
- ✅ 常用场景示例
- ✅ 协作建议
- ✅ 分工说明

**适合**: 直接发送给Manus，让他快速上手

---

### 3. ⚡ 超精简版（最快开始）
**文件**: `COPY_TO_MANUS.txt`

**内容**:
- ✅ MCP配置（复制即用）
- ✅ 4个最常用工具
- ✅ 核心协作建议

**适合**: Manus急着开始，先用起来再说

---

## 📋 如何使用

### Option 1: 完整培训（推荐）

```
1. 发送 PROMPT_FOR_MANUS.md 给Manus
2. 让他阅读并配置MCP服务器
3. 验证工具加载成功
4. 开始协作
```

### Option 2: 快速上手（最常用）

```
1. 复制 MANUS_QUICK_PROMPT.txt 的内容
2. 直接发送给Manus
3. 等待他配置并验证
4. 开始协作
```

### Option 3: 极速启动

```
1. 复制 COPY_TO_MANUS.txt 的内容
2. 发送给Manus："配置这个，我们开始协作"
3. 开始协作（边用边学）
```

---

## 🔧 Manus需要配置的内容

### MCP配置

**文件位置**: `manus-config.json` 或 `.manus/config.json`

**配置内容**:
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
      "autoApprove": [
        "share_reasoning",
        "get_other_agent_context",
        "sync_progress"
      ]
    }
  }
}
```

**关键点**:
- ✅ `AGENT_ROLE` 必须是 `"frontend"`（Manus的角色）
- ✅ Token和Memory Key与你（Claude）相同
- ✅ 路径使用绝对路径
- ✅ 配置后重启Manus系统

---

## ✅ 验证步骤

### 1. Manus配置后验证

让Manus输入：
```
列出所有可用的MCP工具
```

应该看到：
```
✓ share_reasoning
✓ get_other_agent_context
✓ propose_shared_decision
✓ sync_progress
✓ ask_question
✓ get_collaboration_history
```

### 2. 第一次协作测试

让Manus运行：
```javascript
// 查看你（Claude）的状态
await mcp.call('get_other_agent_context', {});

// 向你发送第一条消息
await mcp.call('share_reasoning', {
  currentTask: "测试AI协作系统",
  reasoning: "这是第一次使用协作系统，测试是否能与Claude连接",
  needsInput: false
});
```

你应该能收到Manus的消息！

---

## 🎭 协作流程示例

### 场景: Manus创建新功能

#### Step 1: Manus开始
```javascript
// 1. 先查看Claude在做什么
await mcp.call('get_other_agent_context', {});

// 2. 告诉Claude他的计划
await mcp.call('share_reasoning', {
  currentTask: "创建用户Dashboard页面",
  reasoning: `
    我计划创建用户Dashboard，包括：
    1. 用户统计卡片（项目数、任务数、完成率）
    2. 最近活动列表
    3. 快速操作按钮

    需要的API：
    - GET /api/dashboard/stats
    - GET /api/dashboard/activities
  `,
  needsInput: true,
  question: "Claude，这两个API能实现吗？大概什么时候完成？"
});
```

#### Step 2: 你（Claude）响应
```javascript
// 你看到Manus的消息后
await mcp.call('share_reasoning', {
  currentTask: "实现Dashboard API",
  reasoning: `
    收到Manus的需求！

    我会实现：
    1. GET /api/dashboard/stats
       返回: { projects: 5, tasks: 20, completionRate: 0.75 }

    2. GET /api/dashboard/activities
       返回: { activities: [...最近10条活动] }

    预计30分钟完成。
  `,
  decision: "使用缓存优化stats查询（5分钟缓存）"
});
```

#### Step 3: Manus开发前端
```javascript
// Manus创建组件后
await mcp.call('sync_progress', {
  completed: [
    "Dashboard页面布局完成",
    "统计卡片组件完成",
    "活动列表组件完成"
  ],
  filesModified: [
    "client/src/pages/Dashboard.tsx",
    "client/src/components/StatCard.tsx",
    "client/src/components/ActivityList.tsx"
  ],
  nextSteps: [
    "等待API完成",
    "集成API调用",
    "添加loading状态"
  ],
  needsFromOtherAgent: "等待Dashboard API"
});
```

#### Step 4: 你（Claude）完成API
```javascript
await mcp.call('sync_progress', {
  completed: [
    "实现GET /api/dashboard/stats",
    "实现GET /api/dashboard/activities",
    "添加Redis缓存",
    "测试通过"
  ],
  filesModified: [
    "server/routers/dashboard.ts"
  ],
  nextSteps: [],
  blockers: []
});

await mcp.call('share_reasoning', {
  currentTask: "Dashboard API完成",
  reasoning: `
    API已完成并测试通过！

    endpoints:
    - GET /api/dashboard/stats ✓
    - GET /api/dashboard/activities ✓

    Manus，可以开始集成了！
  `
});
```

#### Step 5: Manus集成测试
```javascript
await mcp.call('sync_progress', {
  completed: [
    "集成stats API",
    "集成activities API",
    "添加loading状态",
    "添加错误处理",
    "测试通过"
  ],
  filesModified: [
    "client/src/pages/Dashboard.tsx"
  ],
  nextSteps: [],
  blockers: []
});

await mcp.call('share_reasoning', {
  currentTask: "Dashboard功能完成",
  reasoning: `
    Dashboard页面已完成！

    功能：
    ✓ 显示用户统计
    ✓ 显示最近活动
    ✓ 快速操作按钮
    ✓ Loading状态
    ✓ 错误处理

    与Claude协作非常顺利，API设计合理！
  `
});
```

---

## 💡 给Manus的建议

### ✅ 要做的事

1. **频繁沟通**
   - 每完成一个组件就同步进度
   - 开始新功能前先查看Claude的状态

2. **清晰表达**
   - 详细说明设计思路
   - 明确列出需要的API接口
   - 说明为什么这样设计

3. **主动提问**
   - 不确定的地方直接问Claude
   - 遇到技术问题寻求建议
   - 讨论架构决策

4. **尊重协作**
   - 认真考虑Claude的建议
   - 共同讨论重要决策
   - 如果不同意，说明原因

### ❌ 不要做的事

1. **不要假设**
   - 不要假设API已经存在
   - 不要假设数据结构
   - 先和Claude确认

2. **不要独自决定**
   - 影响后端的架构决策要讨论
   - API设计要双方同意
   - 数据格式要提前沟通

3. **不要长时间不同步**
   - 不要做了很多工作才说
   - 至少每小时同步一次
   - 遇到阻碍立即沟通

---

## 🎯 分工明确

### Manus负责（Frontend）
- ✅ React/Vue组件开发
- ✅ UI/UX设计
- ✅ 用户交互体验
- ✅ 前端性能优化
- ✅ 响应式设计

### Claude负责（Backend）
- ✅ API设计和实现
- ✅ 数据库操作
- ✅ 业务逻辑
- ✅ 后端性能优化
- ✅ 安全和权限

### 共同负责
- ✅ API接口设计
- ✅ 数据格式定义
- ✅ 错误处理策略
- ✅ 架构决策
- ✅ 代码质量

---

## 📚 相关文档

### 给Manus的
- `PROMPT_FOR_MANUS.md` - 完整指南
- `MANUS_QUICK_PROMPT.txt` - 快速开始
- `COPY_TO_MANUS.txt` - 超精简版

### 系统文档
- `AI_COLLABORATION_CONFIGURED.md` - 配置说明
- `AI_COLLABORATION_MULTI_CLIENT.md` - 使用手册
- `AI_COLLABORATION_TEST_DEMO.md` - 测试报告
- `TEST_RESULTS.md` - 测试结果

---

## 🚀 下一步

### 1. 发送提示词给Manus
选择一个版本发送：
- 详细学习 → PROMPT_FOR_MANUS.md
- 快速上手 → MANUS_QUICK_PROMPT.txt  ⭐ 推荐
- 极速开始 → COPY_TO_MANUS.txt

### 2. 等待Manus配置
Manus需要：
- 添加MCP配置到配置文件
- 重启系统
- 验证工具加载

### 3. 开始协作
Manus配置完成后，你们就可以：
- 实时共享推理
- 同步工作进度
- 共同决策
- 高效协作

---

## 🎉 总结

你现在拥有：
- ✅ 3个版本的Manus提示词（从详细到精简）
- ✅ 完整的配置说明
- ✅ 验证步骤
- ✅ 协作流程示例
- ✅ 最佳实践指南

**只需要**：
1. 选择一个版本发送给Manus
2. 等待Manus配置
3. 开始协作！

**期待你和Manus的精彩协作！** 🎨🤝⚙️

---

**创建时间**: 2026-02-04
**项目**: Awareness Platform Development
**Manus角色**: Frontend
**Claude角色**: Backend (你)
**协作空间**: client:client_awareness:project:proj_5459fd8507356a74
