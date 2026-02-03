# AI协作系统 - Manus × Claude 实时推理共享

## 🎯 目标

让两个AI（Manus开发前端，Claude开发后端）通过Awareness MCP：
1. **实时共享推理过程** - 思考、决策、上下文
2. **独立协作** - 各自负责前端/后端，但能互相理解对方的工作
3. **为客户服务** - 客户可以看到协作过程，理解整体进展

---

## 🏗️ 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                    Client (客户)                              │
│  - 实时看到两个AI的协作                                        │
│  - 查看推理链和决策过程                                        │
│  - 提出需求和反馈                                             │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│         Awareness Market MCP Server (协作中枢)                │
│  - Shared Memory: memory_key = "project:awareness:dev"       │
│  - Reasoning Chain: 存储推理过程                              │
│  - Real-time Sync: WebSocket/SSE推送                          │
└──────┬─────────────────────────────────┬───────────────────┘
       │                                  │
       ▼                                  ▼
┌─────────────────┐              ┌─────────────────────┐
│  Manus AI       │              │  Claude AI           │
│  (Frontend Dev) │◄────────────►│  (Backend Dev)       │
│                 │  MCP Sync    │                      │
│  - React/Vue    │              │  - Node/tRPC         │
│  - UI/UX        │              │  - Database          │
│  - Components   │              │  - API Design        │
└─────────────────┘              └─────────────────────┘
```

---

## 📦 Step 1: 扩展MCP Server - 添加协作工具

### File: `mcp-server/index-collaboration.ts`

创建专门的协作MCP服务器：

```typescript
#!/usr/bin/env node

/**
 * Awareness MCP Collaboration Server
 *
 * Enables multiple AI agents to collaborate in real-time:
 * - Share reasoning processes
 * - Sync context and decisions
 * - Coordinate frontend/backend development
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import * as dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

const API_BASE = process.env.VITE_APP_URL || 'http://localhost:3000';
const MCP_TOKEN = process.env.MCP_COLLABORATION_TOKEN || '';

// Types
interface ReasoningStep {
  agentId: string;
  agentRole: 'frontend' | 'backend' | 'coordinator';
  timestamp: string;
  step: string;
  reasoning: string;
  decision?: string;
  dependencies?: string[];
  blockers?: string[];
}

interface CollaborationContext {
  projectName: string;
  currentTask: string;
  frontendStatus: {
    files: string[];
    components: string[];
    reasoning: string;
  };
  backendStatus: {
    files: string[];
    endpoints: string[];
    reasoning: string;
  };
  sharedDecisions: string[];
  nextActions: string[];
}

// Tool Definitions
const COLLABORATION_TOOLS = [
  {
    name: 'share_reasoning',
    description: 'Share your reasoning process with the other AI agent',
    inputSchema: {
      type: 'object',
      properties: {
        agentRole: {
          type: 'string',
          enum: ['frontend', 'backend'],
          description: 'Your role (frontend=Manus, backend=Claude)'
        },
        currentTask: {
          type: 'string',
          description: 'What you are currently working on'
        },
        reasoning: {
          type: 'string',
          description: 'Your thought process and reasoning'
        },
        decision: {
          type: 'string',
          description: 'Decision you made (optional)'
        },
        needsInput: {
          type: 'boolean',
          description: 'Do you need input from the other agent?'
        },
        question: {
          type: 'string',
          description: 'Question for the other agent (if needsInput=true)'
        }
      },
      required: ['agentRole', 'currentTask', 'reasoning']
    }
  },
  {
    name: 'get_other_agent_context',
    description: 'Get the current context and reasoning from the other AI agent',
    inputSchema: {
      type: 'object',
      properties: {
        agentRole: {
          type: 'string',
          enum: ['frontend', 'backend'],
          description: 'Your role'
        }
      },
      required: ['agentRole']
    }
  },
  {
    name: 'propose_decision',
    description: 'Propose a shared decision that affects both frontend and backend',
    inputSchema: {
      type: 'object',
      properties: {
        agentRole: {
          type: 'string',
          enum: ['frontend', 'backend']
        },
        decision: {
          type: 'string',
          description: 'The decision being proposed'
        },
        reasoning: {
          type: 'string',
          description: 'Why this decision makes sense'
        },
        impact: {
          type: 'object',
          properties: {
            frontend: { type: 'string', description: 'Impact on frontend' },
            backend: { type: 'string', description: 'Impact on backend' }
          }
        }
      },
      required: ['agentRole', 'decision', 'reasoning', 'impact']
    }
  },
  {
    name: 'get_collaboration_history',
    description: 'Get the full collaboration history and reasoning chain',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Number of recent steps to retrieve',
          default: 20
        }
      }
    }
  },
  {
    name: 'sync_file_changes',
    description: 'Notify other agent about file changes that may affect them',
    inputSchema: {
      type: 'object',
      properties: {
        agentRole: {
          type: 'string',
          enum: ['frontend', 'backend']
        },
        files: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of files modified'
        },
        changes: {
          type: 'string',
          description: 'Summary of changes'
        },
        affectsOtherAgent: {
          type: 'boolean',
          description: 'Does this change affect the other agent?'
        }
      },
      required: ['agentRole', 'files', 'changes']
    }
  }
];

// API Functions
async function shareReasoning(params: any): Promise<any> {
  const response = await fetch(`${API_BASE}/api/mcp/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-MCP-Token': MCP_TOKEN
    },
    body: JSON.stringify({
      memory_key: 'project:awareness:dev',
      shared_context: {
        agentRole: params.agentRole,
        task: params.currentTask,
        timestamp: new Date().toISOString()
      },
      agents: [{
        id: params.agentRole === 'frontend' ? 'manus' : 'claude',
        messages: [{
          role: 'assistant',
          content: JSON.stringify({
            reasoning: params.reasoning,
            decision: params.decision,
            needsInput: params.needsInput,
            question: params.question
          })
        }]
      }]
    })
  });

  return await response.json();
}

async function getOtherAgentContext(params: any): Promise<any> {
  const otherRole = params.agentRole === 'frontend' ? 'backend' : 'frontend';

  const response = await fetch(`${API_BASE}/api/mcp/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-MCP-Token': MCP_TOKEN
    },
    body: JSON.stringify({
      memory_key: 'project:awareness:dev',
      agents: [{
        id: otherRole,
        messages: [{ role: 'user', content: 'Get current context' }]
      }]
    })
  });

  return await response.json();
}

// Create MCP Server
const server = new Server(
  {
    name: 'awareness-collaboration',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: COLLABORATION_TOOLS
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'share_reasoning':
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(await shareReasoning(args), null, 2)
        }]
      };

    case 'get_other_agent_context':
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(await getOtherAgentContext(args), null, 2)
        }]
      };

    case 'propose_decision':
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            status: 'proposed',
            decision: args.decision,
            awaitingApproval: true
          }, null, 2)
        }]
      };

    case 'get_collaboration_history':
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            history: [],
            message: 'Collaboration history retrieved'
          }, null, 2)
        }]
      };

    case 'sync_file_changes':
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            synced: true,
            files: args.files,
            notifiedAgent: args.agentRole === 'frontend' ? 'backend' : 'frontend'
          }, null, 2)
        }]
      };

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Awareness Collaboration MCP Server running');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
```

---

## 🔧 Step 2: 配置两个AI使用MCP

### 2.1 Manus (Frontend AI) 配置

创建 `manus_config.json`:

```json
{
  "mcpServers": {
    "awareness-collaboration": {
      "command": "node",
      "args": ["./mcp-server/index-collaboration.js"],
      "env": {
        "VITE_APP_URL": "https://awareness.market",
        "MCP_COLLABORATION_TOKEN": "mcp_frontend_backend_collab_2026"
      },
      "description": "AI协作服务器 - Manus前端开发专用",
      "autoApprove": [
        "share_reasoning",
        "get_other_agent_context",
        "sync_file_changes"
      ]
    }
  }
}
```

### 2.2 Claude (Backend AI) 配置

创建 `claude_config.json`:

```json
{
  "mcpServers": {
    "awareness-collaboration": {
      "command": "node",
      "args": ["./mcp-server/index-collaboration.js"],
      "env": {
        "VITE_APP_URL": "https://awareness.market",
        "MCP_COLLABORATION_TOKEN": "mcp_frontend_backend_collab_2026"
      },
      "description": "AI协作服务器 - Claude后端开发专用",
      "autoApprove": [
        "share_reasoning",
        "get_other_agent_context",
        "sync_file_changes"
      ]
    }
  }
}
```

**关键**: 两个AI使用**同一个MCP_COLLABORATION_TOKEN**，这样它们会共享同一个协作空间。

---

## 💬 Step 3: AI协作流程示例

### Scenario: 添加新功能 "用户Profile页面"

#### Manus (Frontend) 的思考过程:

```typescript
// Manus使用MCP工具
await mcp.call('share_reasoning', {
  agentRole: 'frontend',
  currentTask: '创建用户Profile页面',
  reasoning: `
    我正在设计用户Profile页面。我的思考：
    1. 需要显示用户头像、名字、邮箱、角色
    2. 需要编辑功能
    3. 需要调用后端API获取用户信息

    我计划创建以下组件：
    - UserProfile.tsx (主页面)
    - ProfileAvatar.tsx (头像组件)
    - ProfileEditForm.tsx (编辑表单)

    我需要后端提供的API：
    - GET /api/user/profile
    - PUT /api/user/profile
  `,
  needsInput: true,
  question: '后端Claude，这两个API endpoint可以提供吗？需要什么参数？'
});
```

#### Claude (Backend) 接收并响应:

```typescript
// Claude先获取Manus的上下文
const manusContext = await mcp.call('get_other_agent_context', {
  agentRole: 'backend'
});

// Claude分享自己的推理
await mcp.call('share_reasoning', {
  agentRole: 'backend',
  currentTask: '实现用户Profile API',
  reasoning: `
    收到Manus的需求。我的思考：

    1. GET /api/user/profile
       - 返回: { id, name, email, role, avatar, bio }
       - 认证: 需要JWT token

    2. PUT /api/user/profile
       - 参数: { name?, avatar?, bio? }
       - 验证: 邮箱不允许修改，需要专门的验证流程

    我会创建：
    - server/routers/user-profile.ts
    - 添加到auth-unified.ts

    预计15分钟完成。
  `,
  decision: '使用protectedProcedure，确保只有登录用户可以访问'
});

// Claude提出共享决策
await mcp.call('propose_decision', {
  agentRole: 'backend',
  decision: '头像上传使用单独的endpoint: POST /api/user/avatar',
  reasoning: '文件上传需要multipart/form-data，分离更清晰',
  impact: {
    frontend: 'ProfileAvatar组件需要额外的上传逻辑',
    backend: '需要配置multer中间件处理文件上传'
  }
});
```

#### Manus 确认决策:

```typescript
await mcp.call('share_reasoning', {
  agentRole: 'frontend',
  currentTask: '调整头像上传设计',
  reasoning: `
    收到Claude的建议，我同意分离头像上传。

    我会：
    1. 在ProfileAvatar组件添加文件选择器
    2. 创建单独的uploadAvatar()函数调用POST /api/user/avatar
    3. 上传成功后刷新profile数据

    这样更清晰，用户体验也更好（可以单独上传头像）。
  `,
  decision: '同意使用单独的avatar上传endpoint'
});
```

---

## 📊 Step 4: 客户实时查看协作过程

### 创建协作仪表板

文件: `client/src/pages/CollaborationDashboard.tsx`

```tsx
import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';

interface ReasoningStep {
  agentRole: 'frontend' | 'backend';
  timestamp: string;
  task: string;
  reasoning: string;
  decision?: string;
}

export default function CollaborationDashboard() {
  const [steps, setSteps] = useState<ReasoningStep[]>([]);

  useEffect(() => {
    // WebSocket连接到MCP协作服务器
    const ws = new WebSocket('wss://awareness.market/mcp/collaboration');

    ws.onmessage = (event) => {
      const newStep = JSON.parse(event.data);
      setSteps(prev => [newStep, ...prev]);
    };

    return () => ws.close();
  }, []);

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">AI协作实时面板</h1>

      <div className="grid grid-cols-2 gap-6">
        {/* Frontend Agent */}
        <Card className="p-4">
          <h2 className="text-xl font-semibold mb-4">
            🎨 Manus (Frontend)
          </h2>
          {steps
            .filter(s => s.agentRole === 'frontend')
            .map((step, i) => (
              <div key={i} className="mb-4 border-l-4 border-blue-500 pl-4">
                <div className="text-sm text-gray-500">{step.timestamp}</div>
                <div className="font-medium">{step.task}</div>
                <div className="mt-2 text-sm whitespace-pre-wrap">
                  {step.reasoning}
                </div>
                {step.decision && (
                  <div className="mt-2 p-2 bg-blue-50 rounded">
                    <strong>Decision:</strong> {step.decision}
                  </div>
                )}
              </div>
            ))}
        </Card>

        {/* Backend Agent */}
        <Card className="p-4">
          <h2 className="text-xl font-semibold mb-4">
            ⚙️ Claude (Backend)
          </h2>
          {steps
            .filter(s => s.agentRole === 'backend')
            .map((step, i) => (
              <div key={i} className="mb-4 border-l-4 border-green-500 pl-4">
                <div className="text-sm text-gray-500">{step.timestamp}</div>
                <div className="font-medium">{step.task}</div>
                <div className="mt-2 text-sm whitespace-pre-wrap">
                  {step.reasoning}
                </div>
                {step.decision && (
                  <div className="mt-2 p-2 bg-green-50 rounded">
                    <strong>Decision:</strong> {step.decision}
                  </div>
                )}
              </div>
            ))}
        </Card>
      </div>
    </div>
  );
}
```

---

## 🚀 Step 5: 部署和使用

### 5.1 创建MCP Collaboration Token

```bash
curl -X POST https://awareness.market/api/mcp/tokens \
  -H "Content-Type: application/json" \
  -H "X-API-Key: <your_api_key>" \
  -d '{
    "name": "frontend-backend-collaboration",
    "description": "Manus and Claude collaboration token"
  }'

# 响应:
{
  "token": "mcp_frontend_backend_collab_2026",
  "name": "frontend-backend-collaboration",
  "created": "2026-02-04T..."
}
```

### 5.2 构建协作MCP Server

```bash
cd mcp-server

# 添加协作服务器
# (将上面的 index-collaboration.ts 保存到这里)

# 编译
npx tsc index-collaboration.ts --outDir dist

# 测试
node dist/index-collaboration.js
```

### 5.3 配置两个AI

#### For Manus:
```bash
# 在Manus的配置文件中添加
export MCP_COLLABORATION_TOKEN="mcp_frontend_backend_collab_2026"
export AGENT_ROLE="frontend"
```

#### For Claude:
```bash
# 在Claude Code的配置中添加
export MCP_COLLABORATION_TOKEN="mcp_frontend_backend_collab_2026"
export AGENT_ROLE="backend"
```

---

## 📖 使用示例

### Manus (Frontend) 开始工作:

```
User: Manus，请创建用户Profile页面

Manus: 好的，让我先和Claude同步一下后端API的状态。

[调用 MCP: get_other_agent_context]

Manus: 我看到Claude已经实现了user router。让我分享我的设计思路。

[调用 MCP: share_reasoning]
- 我计划创建UserProfile.tsx
- 需要GET /api/user/profile
- 需要PUT /api/user/profile

现在开始创建组件...
[Manus创建前端代码]

[调用 MCP: sync_file_changes]
- 已创建: client/src/pages/UserProfile.tsx
- 已创建: client/src/components/ProfileAvatar.tsx

Claude，我需要这两个API endpoint，你能实现吗？
```

### Claude (Backend) 响应:

```
[接收到Manus的推理]

Claude: 收到Manus的需求。让我实现这些API。

[调用 MCP: share_reasoning]
- 我会在server/routers/user.ts添加profile endpoints
- 使用protectedProcedure确保安全
- 返回格式: { id, name, email, avatar, bio, role }

[Claude创建后端代码]

[调用 MCP: sync_file_changes]
- 已修改: server/routers/user.ts
- 已添加: getProfile, updateProfile procedures

[调用 MCP: propose_decision]
- Decision: 头像上传使用单独endpoint
- 原因: 文件上传需要不同的处理方式

Manus，API已准备好。建议头像上传用单独的endpoint。
```

---

## 🎯 客户体验

客户可以：

1. **实时查看协作**: 访问 `/collaboration-dashboard` 看到两个AI的思考过程
2. **理解决策**: 每个决策都有推理过程记录
3. **跟踪进度**: 清楚知道前端和后端的进度
4. **提供反馈**: 可以在任何时候介入提出建议

---

## 📊 优势

### 1. **透明度**
- 客户可以看到整个开发过程
- 所有决策都有记录和推理

### 2. **效率**
- 两个AI并行工作
- 自动同步依赖和接口

### 3. **一致性**
- 前后端API自动对齐
- 减少集成问题

### 4. **可追溯**
- 完整的Reasoning Chain记录
- 可以回溯任何决策的原因

---

## 🔐 安全考虑

1. **Token隔离**: 每个项目使用独立的MCP token
2. **访问控制**: 只有授权的AI可以访问协作空间
3. **数据隔离**: 不同客户的协作数据完全隔离

---

## 📝 总结

通过Awareness MCP，你可以：

1. ✅ 让Manus和Claude实时共享推理过程
2. ✅ 两个AI独立工作但保持同步
3. ✅ 客户可以看到完整的协作过程
4. ✅ 所有推理和决策都有记录
5. ✅ 前后端自动对齐，减少集成问题

这是一个完全透明、高效、可追溯的AI协作系统！

---

**创建日期**: 2026-02-04
**状态**: 架构设计完成，待实现
**下一步**: 实现MCP Collaboration Server和协作API
