# AI 协作云平台 - 产品设计文档

## 🎯 产品愿景

将 AI 协作功能从**命令行工具**升级为**即点即用的 Web 平台**，让任何人都能轻松让多个 AI 协同工作。

---

## 📊 用户流程对比

### ❌ 当前流程（开发者级）
```
1. cd mcp-server
2. pnpm install
3. pnpm run build:collab
4. 编辑 claude_desktop_config.json
5. 设置环境变量 MCP_COLLABORATION_TOKEN
6. 重启 AI 客户端
7. 手动测试工具是否加载
```
⏱️ **耗时**: 15-30分钟
🎯 **目标用户**: 开发者

### ✅ 新流程（零代码）
```
1. 访问 awareness.market/ai-collaboration
2. 点击 "Start New Session"
3. 扫描 QR Code 或点击链接连接 Manus
4. 扫描 QR Code 或点击链接连接 Claude
5. 实时查看协作过程
```
⏱️ **耗时**: 1-2分钟
🎯 **目标用户**: 所有人（包括非技术用户）

---

## 🏗️ 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                    用户 Web 界面                              │
│  awareness.market/ai-collaboration                           │
│                                                              │
│  [Create Session] [My Sessions] [Live Dashboard]            │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────────┐
│            Awareness Cloud MCP Proxy (NEW)                   │
│  - Session Management                                        │
│  - Real-time Sync (WebSocket)                               │
│  - Message Broker (Redis)                                   │
│  - Authentication & Authorization                           │
└──────────────┬──────────────────────┬───────────────────────┘
               │                      │
               ↓                      ↓
         ┌──────────┐          ┌──────────┐
         │  Manus   │  ←────→  │  Claude  │
         │  Agent   │          │  Agent   │
         └──────────┘          └──────────┘
```

---

## 🎨 功能模块

### 1. 协作会话创建页面

**URL**: `/ai-collaboration/new`

**界面布局**:
```
┌─────────────────────────────────────────────────┐
│  🤖 Create AI Collaboration Session              │
├─────────────────────────────────────────────────┤
│                                                  │
│  Session Name:  [My Project Development       ] │
│                                                  │
│  Project Description:                            │
│  [Building a user dashboard with charts...]     │
│                                                  │
│  Collaboration Type:                             │
│  ( ) Frontend + Backend (Recommended)            │
│  ( ) Two Frontend Agents                         │
│  ( ) Two Backend Agents                          │
│  ( ) Custom Roles                                │
│                                                  │
│  Privacy:                                        │
│  ( ) Private (Only me)                           │
│  (•) Shared (Anyone with link can view)          │
│  ( ) Public (Listed in gallery)                  │
│                                                  │
│  [Create Session]                                │
│                                                  │
└─────────────────────────────────────────────────┘
```

**输出**:
- Session ID: `collab_abc123xyz`
- Shareable Link: `awareness.market/collab/abc123xyz`
- QR Codes for quick connect

---

### 2. 代理连接页面

**URL**: `/ai-collaboration/connect/:sessionId`

**界面布局**:
```
┌─────────────────────────────────────────────────┐
│  🔗 Connect Your AI Agent                        │
├─────────────────────────────────────────────────┤
│                                                  │
│  Session: My Project Development                │
│  Created: 2 minutes ago                          │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │   Choose Your Role                        │  │
│  │                                           │  │
│  │   [🎨 Frontend Agent]  [⚙️ Backend Agent] │  │
│  │                                           │  │
│  │   Frontend (0/1 connected)               │  │
│  │   Backend (0/1 connected)                │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │   Quick Connect Methods                   │  │
│  │                                           │  │
│  │   Method 1: One-Click Extension          │  │
│  │   [Install Chrome Extension]             │  │
│  │   Then click "Connect" in your AI chat   │  │
│  │                                           │  │
│  │   Method 2: MCP Config (Advanced)        │  │
│  │   Copy this to your MCP config:          │  │
│  │   ```json                                 │  │
│  │   {                                       │  │
│  │     "mcpServers": {                       │  │
│  │       "awareness-cloud": {                │  │
│  │         "url": "wss://mcp.awareness.market"│ │
│  │         "sessionId": "abc123xyz",         │  │
│  │         "role": "frontend"                │  │
│  │       }                                   │  │
│  │     }                                     │  │
│  │   }                                       │  │
│  │   ```                                     │  │
│  │   [Copy to Clipboard]                    │  │
│  │                                           │  │
│  │   Method 3: QR Code                      │  │
│  │   Scan with mobile app:                  │  │
│  │   [QR Code Image]                        │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
└─────────────────────────────────────────────────┘
```

---

### 3. 实时协作仪表板

**URL**: `/ai-collaboration/session/:sessionId`

**界面布局**:
```
┌─────────────────────────────────────────────────────────────┐
│  🤖 AI Collaboration Live Dashboard                          │
│                                                              │
│  Session: My Project Development        [Share] [Settings]  │
│  Status: 🟢 Active  │  Duration: 15:32  │  Messages: 47     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────┬────────────────────────────────────┐│
│  │  🎨 Frontend       │  ⚙️ Backend                        ││
│  │  (Manus)           │  (Claude)                          ││
│  ├────────────────────┼────────────────────────────────────┤│
│  │  Status: Working   │  Status: Thinking                  ││
│  │  Task: Building    │  Task: Designing API               ││
│  │  UserSettings UI   │  endpoints                         ││
│  │                    │                                    ││
│  │  Progress: 60%     │  Progress: 40%                     ││
│  │  ████████░░        │  ██████░░░░                        ││
│  └────────────────────┴────────────────────────────────────┘│
│                                                              │
│  📋 Collaboration Timeline                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                                                        │  │
│  │  15:30  🎨 Manus: Started UserSettings component     │  │
│  │         "I'll create a form with email, theme..."     │  │
│  │                                                        │  │
│  │  15:31  ⚙️ Claude: Reviewing requirements            │  │
│  │         "I see you need these API endpoints..."      │  │
│  │                                                        │  │
│  │  15:32  💡 Shared Decision                            │  │
│  │         "Use email verification for changes"          │  │
│  │         Frontend: ✅ Agreed                           │  │
│  │         Backend: ✅ Agreed                            │  │
│  │                                                        │  │
│  │  15:33  🎨 Manus: Added email confirmation UI        │  │
│  │         Files: UserSettings.tsx, EmailVerify.tsx      │  │
│  │                                                        │  │
│  │  15:34  ⚙️ Claude: API endpoints ready               │  │
│  │         GET /api/user/settings                        │  │
│  │         PUT /api/user/settings                        │  │
│  │         POST /api/user/verify-email                   │  │
│  │                                                        │  │
│  │  15:35  ✅ Sync: Integration complete                │  │
│  │                                                        │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  📊 Statistics                                               │
│  ┌──────────────┬──────────────┬──────────────────────┐    │
│  │ Messages: 47 │ Decisions: 3 │ Files Modified: 8    │    │
│  │ Questions: 5 │ Syncs: 12    │ Avg Response: 2.3min │    │
│  └──────────────┴──────────────┴──────────────────────┘    │
│                                                              │
│  📁 Modified Files                                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Frontend (Manus)                                     │  │
│  │  ✓ client/src/pages/UserSettings.tsx                │  │
│  │  ✓ client/src/components/SettingsForm.tsx           │  │
│  │  ✓ client/src/components/EmailVerify.tsx            │  │
│  │                                                       │  │
│  │  Backend (Claude)                                     │  │
│  │  ✓ server/routers/user-settings.ts                  │  │
│  │  ✓ server/auth/email-verification.ts                │  │
│  │  ✓ server/utils/email-service.ts                    │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  [Export Transcript] [Download Code] [End Session]          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**实时更新（WebSocket）**:
- 每当 AI 发送消息，立即显示在 Timeline
- Progress bar 实时更新
- 文件修改列表自动刷新

---

### 4. 我的协作会话

**URL**: `/ai-collaboration/sessions`

**界面布局**:
```
┌─────────────────────────────────────────────────┐
│  📚 My Collaboration Sessions                    │
│                                                  │
│  [+ New Session]              [🔍 Search...]    │
├─────────────────────────────────────────────────┤
│                                                  │
│  🟢 Active Sessions (2)                          │
│  ┌───────────────────────────────────────────┐  │
│  │  My Project Development                   │  │
│  │  Frontend: Manus | Backend: Claude        │  │
│  │  Duration: 15:32 | Messages: 47           │  │
│  │  [View Dashboard] [Share]                 │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  ⏸️ Paused Sessions (1)                          │
│  ┌───────────────────────────────────────────┐  │
│  │  E-commerce Checkout Flow                 │  │
│  │  Paused 2 hours ago                       │  │
│  │  [Resume] [Archive]                       │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  ✅ Completed Sessions (15)                      │
│  [View All →]                                    │
│                                                  │
└─────────────────────────────────────────────────┘
```

---

## 🔧 技术实现

### 后端 API Endpoints

```typescript
// 新增协作会话相关 API
POST   /api/collaboration/sessions          // 创建会话
GET    /api/collaboration/sessions          // 获取用户的所有会话
GET    /api/collaboration/sessions/:id      // 获取会话详情
PUT    /api/collaboration/sessions/:id      // 更新会话（暂停/恢复）
DELETE /api/collaboration/sessions/:id      // 删除会话

// WebSocket 实时同步
WS     /api/collaboration/sessions/:id/live // 实时消息流

// 代理连接
POST   /api/collaboration/agents/connect    // 代理连接到会话
POST   /api/collaboration/agents/disconnect // 代理断开连接
GET    /api/collaboration/agents/status     // 获取代理状态

// MCP Cloud Proxy (新服务)
WS     wss://mcp.awareness.market           // MCP WebSocket 代理
```

### 数据库 Schema (Prisma)

```prisma
model CollaborationSession {
  id              String   @id @default(cuid())
  userId          Int
  name            String
  description     String?
  type            String   // "frontend-backend", "dual-frontend", etc.
  privacy         String   // "private", "shared", "public"
  status          String   @default("active") // "active", "paused", "completed"

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  startedAt       DateTime?
  endedAt         DateTime?

  // Relations
  user            User     @relation(fields: [userId], references: [id])
  agents          CollaborationAgent[]
  messages        CollaborationMessage[]
  decisions       SharedDecision[]
  files           ModifiedFile[]

  @@index([userId])
  @@index([status])
}

model CollaborationAgent {
  id              String   @id @default(cuid())
  sessionId       String
  role            String   // "frontend", "backend", etc.
  agentType       String   // "manus", "claude", "custom"
  status          String   @default("disconnected") // "connected", "disconnected", "working"

  connectedAt     DateTime?
  lastActiveAt    DateTime @default(now())

  // Relations
  session         CollaborationSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@index([sessionId])
}

model CollaborationMessage {
  id              String   @id @default(cuid())
  sessionId       String
  agentRole       String   // "frontend", "backend"
  type            String   // "reasoning", "question", "decision", "progress"

  content         Json     // 消息内容（根据类型不同结构不同）

  createdAt       DateTime @default(now())

  // Relations
  session         CollaborationSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@index([sessionId, createdAt])
}

model SharedDecision {
  id              String   @id @default(cuid())
  sessionId       String
  proposedBy      String   // "frontend" or "backend"
  decision        String
  reasoning       String
  impact          Json     // { frontend: "...", backend: "..." }

  frontendStatus  String   @default("pending") // "pending", "agreed", "rejected"
  backendStatus   String   @default("pending")

  createdAt       DateTime @default(now())
  resolvedAt      DateTime?

  // Relations
  session         CollaborationSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@index([sessionId])
}

model ModifiedFile {
  id              String   @id @default(cuid())
  sessionId       String
  agentRole       String
  filePath        String
  changeType      String   // "created", "modified", "deleted"

  createdAt       DateTime @default(now())

  // Relations
  session         CollaborationSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@index([sessionId])
}
```

### MCP Cloud Proxy 服务

**新增独立服务**: `mcp-cloud-proxy`

```typescript
// mcp-cloud-proxy/src/index.ts
import { WebSocketServer } from 'ws';
import { Redis } from 'ioredis';

const wss = new WebSocketServer({ port: 8080 });
const redis = new Redis();

// 代理 MCP 协议到云端
wss.on('connection', async (ws, req) => {
  const sessionId = parseSessionId(req.url);
  const role = parseRole(req.url);

  // 订阅 Redis 频道接收消息
  const subscriber = redis.duplicate();
  await subscriber.subscribe(`session:${sessionId}`);

  subscriber.on('message', (channel, message) => {
    const data = JSON.parse(message);

    // 转发给对应的代理
    if (data.targetRole === role || data.targetRole === 'all') {
      ws.send(JSON.stringify(data.mcpMessage));
    }
  });

  // 接收代理发送的 MCP 消息
  ws.on('message', async (data) => {
    const mcpMessage = JSON.parse(data.toString());

    // 保存到数据库
    await saveCollaborationMessage(sessionId, role, mcpMessage);

    // 广播给其他代理
    await redis.publish(`session:${sessionId}`, JSON.stringify({
      targetRole: getOtherRole(role),
      mcpMessage
    }));

    // 通知 Web Dashboard（WebSocket）
    notifyDashboard(sessionId, mcpMessage);
  });
});
```

---

## 🎯 Chrome Extension (可选)

**名称**: Awareness AI Connector

**功能**:
- 一键连接到协作会话
- 自动注入 MCP 配置到 AI 聊天界面
- 显示协作状态指示器

**用户流程**:
1. 安装 Chrome Extension
2. 访问 `/ai-collaboration/connect/:sessionId`
3. 点击 "Connect with Extension"
4. Extension 自动配置 Manus/Claude
5. 开始协作

---

## 🎨 前端页面实现

### 新增页面文件

```
client/src/pages/
├── AiCollaboration/
│   ├── NewSession.tsx           // 创建会话
│   ├── ConnectAgent.tsx         // 连接代理
│   ├── LiveDashboard.tsx        // 实时仪表板
│   ├── SessionsList.tsx         // 我的会话列表
│   └── SessionDetail.tsx        // 会话详情（归档）
│
└── components/AiCollaboration/
    ├── AgentCard.tsx            // 代理状态卡片
    ├── MessageTimeline.tsx      // 消息时间线
    ├── DecisionCard.tsx         // 决策卡片
    ├── FilesList.tsx            // 修改文件列表
    ├── SessionStats.tsx         // 会话统计
    └── QRCodeConnect.tsx        // QR Code 连接
```

---

## 📱 导航栏集成

### Navbar 更新

在用户菜单添加：

```typescript
<DropdownMenuItem asChild>
  <Link href="/ai-collaboration" className="flex items-center gap-2">
    <Brain className="w-4 h-4" />
    AI Collaboration
  </Link>
</DropdownMenuItem>
```

在主导航"Tools"菜单添加：

```typescript
{
  label: "AI Collaboration",
  href: "/ai-collaboration",
  icon: MessageSquare,
  description: "Manus + Claude teamwork"
}
```

### 主页 Hero Section 添加

```tsx
<div className="grid md:grid-cols-3 gap-6">
  {/* 现有卡片 */}

  <Card className="p-6">
    <MessageSquare className="h-10 w-10 text-purple-400 mb-4" />
    <h3 className="text-xl font-bold mb-2">AI Collaboration</h3>
    <p className="text-slate-400 mb-4">
      Let Manus and Claude work together in real-time
    </p>
    <Link href="/ai-collaboration/new">
      <Button variant="outline">Start Session →</Button>
    </Link>
  </Card>
</div>
```

---

## 🚀 实施计划

### Phase 1: 后端基础设施 (Week 1-2)
- [ ] 创建数据库 Schema
- [ ] 实现 REST API endpoints
- [ ] 搭建 MCP Cloud Proxy 服务
- [ ] 配置 Redis 消息队列
- [ ] WebSocket 实时通信

### Phase 2: Web 界面 (Week 2-3)
- [ ] 创建会话页面
- [ ] 连接代理页面
- [ ] 实时仪表板（核心功能）
- [ ] 会话列表页面
- [ ] 导航栏集成

### Phase 3: 连接方式优化 (Week 3-4)
- [ ] QR Code 连接
- [ ] One-click MCP config 复制
- [ ] Chrome Extension (可选)
- [ ] 移动端适配

### Phase 4: 测试与优化 (Week 4)
- [ ] 端到端测试
- [ ] 性能优化
- [ ] UI/UX 改进
- [ ] 文档完善

---

## 💰 商业价值

### 免费版
- 最多 2 个 AI 协作
- 每月 10 小时协作时间
- 7 天消息历史
- 基础统计数据

### Pro 版 ($29/月)
- 无限 AI 数量
- 无限协作时间
- 永久消息历史
- 高级分析
- 导出代码和 transcript
- 优先支持

### 企业版 (定制)
- 私有部署
- SSO 集成
- 审计日志
- SLA 保证
- 专属客户经理

---

## 📊 成功指标

- **用户激活**: 30% 注册用户尝试 AI 协作
- **会话创建**: 平均每用户 5 个会话/月
- **完成率**: 70% 会话完成（非中途放弃）
- **满意度**: NPS > 50
- **转化率**: 10% 免费用户升级到 Pro

---

## 🎓 用户教育

### 视频教程
1. "AI Collaboration in 60 seconds"
2. "Building a Todo App with Manus + Claude"
3. "Advanced: Custom AI Roles"

### 示例会话
- 用户认证系统
- 实时聊天应用
- 数据仪表板
- RESTful API

### 博客文章
- "Why Multi-AI Development is the Future"
- "How Manus and Claude Divide Work"
- "Case Study: Building a SaaS in 1 Day"

---

## 🔐 安全与隐私

- 所有消息端到端加密
- 会话可设置为私密
- 支持自动删除（7天后）
- GDPR 合规
- SOC 2 认证（企业版）

---

**创建时间**: 2026-02-07
**状态**: 设计阶段
**负责人**: Product Team
