# 多客户AI协作管理指南

> 支持无限客户、无限项目、完全隔离的AI协作系统

---

## 🎯 核心特性

✅ **多客户支持** - 每个客户独立管理
✅ **无限项目** - 每个客户可以有多个项目
✅ **完全隔离** - 每个项目有独立的MCP token和memory space
✅ **灵活配置** - 每个项目可以配置不同的AI agents
✅ **安全保障** - 客户之间数据完全隔离

---

## 🏗️ 系统架构

```
Awareness Market Platform
│
├── Client A (client_acme)
│   ├── Project 1: E-commerce Platform
│   │   ├── MCP Token: mcp_collab_xxx111
│   │   ├── Memory Key: client:client_acme:project:proj_xxx111
│   │   ├── Agents:
│   │   │   ├── Manus (frontend)
│   │   │   ├── Claude (backend)
│   │   │   └── GPT-4 (testing)
│   │   └── Status: active
│   │
│   └── Project 2: Mobile App
│       ├── MCP Token: mcp_collab_xxx222
│       ├── Memory Key: client:client_acme:project:proj_xxx222
│       ├── Agents:
│       │   ├── Manus (frontend)
│       │   └── Claude (backend)
│       └── Status: active
│
├── Client B (client_techcorp)
│   └── Project 1: API Platform
│       ├── MCP Token: mcp_collab_yyy111
│       ├── Memory Key: client:client_techcorp:project:proj_yyy111
│       ├── Agents:
│       │   ├── Claude (backend)
│       │   ├── GPT-4 (frontend)
│       │   └── Gemini (devops)
│       └── Status: active
│
└── Client C (client_startup)
    └── Project 1: MVP Development
        ├── MCP Token: mcp_collab_zzz111
        ├── Memory Key: client:client_startup:project:proj_zzz111
        ├── Agents:
        │   └── Claude (fullstack)
        └── Status: active
```

**关键点**:
- 不同客户的token完全不同
- Memory Key包含client ID和project ID
- 数据在后端完全隔离

---

## 🚀 快速开始

### Step 1: 安装和构建

```bash
# Windows
setup-collaboration.bat

# Linux/Mac
chmod +x setup-collaboration.sh
./setup-collaboration.sh
```

这会自动：
- ✅ 构建MCP协作服务器
- ✅ 构建项目管理工具
- ✅ 创建示例项目
- ✅ 列出所有项目

---

### Step 2: 为新客户创建项目

```bash
cd mcp-server

# 语法
node dist/project-manager.js create <项目名称> <客户ID> <客户名称>

# 示例：为Acme Corp创建电商平台项目
node dist/project-manager.js create \
  "E-commerce Platform" \
  "client_acme" \
  "Acme Corporation"

# 输出:
# ✅ Project created successfully!
#
# Project Details:
#   ID: proj_a1b2c3d4e5f6g7h8
#   Name: E-commerce Platform
#   Client: Acme Corporation (client_acme)
#   MCP Token: mcp_collab_1234567890abcdef1234567890abcdef
#   Memory Key: client:client_acme:project:proj_a1b2c3d4e5f6g7h8
#
# Agents:
#   - Manus (frontend) - manus
#   - Claude (backend) - claude-sonnet-4.5
```

---

### Step 3: 查看所有项目

```bash
# 查看所有项目
node dist/project-manager.js list

# 查看特定客户的项目
node dist/project-manager.js list client_acme

# 输出示例:
# 📋 Projects for client client_acme
#
# 🟢 proj_a1b2c3d4e5f6g7h8
#    Name: E-commerce Platform
#    Client: Acme Corporation (client_acme)
#    Agents: Manus(frontend), Claude(backend)
#    Created: 2/4/2026
#
# 🟢 proj_x9y8z7w6v5u4t3s2
#    Name: Mobile App
#    Client: Acme Corporation (client_acme)
#    Agents: Manus(frontend), Claude(backend), GPT-4(testing)
#    Created: 2/4/2026
```

---

### Step 4: 查看项目详情

```bash
node dist/project-manager.js show proj_a1b2c3d4e5f6g7h8

# 输出:
# 📦 Project Details
#
# ID: proj_a1b2c3d4e5f6g7h8
# Name: E-commerce Platform
# Client: Acme Corporation (client_acme)
# Status: active
# MCP Token: mcp_collab_1234567890abcdef1234567890abcdef
# Memory Key: client:client_acme:project:proj_a1b2c3d4e5f6g7h8
# Created: 2026-02-04T10:30:00.000Z
#
# Agents (2):
#   agent_1a2b
#     Name: Manus
#     Role: frontend
#     Model: manus
#     Description: Frontend development
#   agent_3c4d
#     Name: Claude
#     Role: backend
#     Model: claude-sonnet-4.5
#     Description: Backend development
```

---

### Step 5: 生成Agent配置

```bash
# 为前端AI（Manus）生成配置
node dist/project-manager.js config proj_a1b2c3d4e5f6g7h8 frontend

# 输出:
# 🔧 MCP Configuration
#
# {
#   "mcpServers": {
#     "awareness-collab-proj_a1b2c3d4e5f6g7h8": {
#       "command": "node",
#       "args": ["./mcp-server/dist/index-collaboration.js"],
#       "env": {
#         "VITE_APP_URL": "https://awareness.market",
#         "MCP_COLLABORATION_TOKEN": "mcp_collab_1234567890abcdef1234567890abcdef",
#         "AGENT_ROLE": "frontend",
#         "PROJECT_ID": "proj_a1b2c3d4e5f6g7h8",
#         "PROJECT_NAME": "E-commerce Platform",
#         "MEMORY_KEY": "client:client_acme:project:proj_a1b2c3d4e5f6g7h8"
#       },
#       "description": "Acme Corporation - E-commerce Platform (Manus)",
#       "autoApprove": [
#         "share_reasoning",
#         "get_other_agent_context",
#         "sync_progress"
#       ]
#     }
#   }
# }

# 为后端AI（Claude）生成配置
node dist/project-manager.js config proj_a1b2c3d4e5f6g7h8 backend
```

---

### Step 6: 配置AI Agents

#### 配置Manus (Frontend)

复制上面生成的配置到Manus的配置文件：

**文件**: `manus-config.json` 或 `.manus/config.json`

```json
{
  "mcpServers": {
    "awareness-collab-proj_a1b2c3d4e5f6g7h8": {
      "command": "node",
      "args": ["E:\\Awareness Market\\Awareness-Network\\mcp-server\\dist\\index-collaboration.js"],
      "env": {
        "VITE_APP_URL": "https://awareness.market",
        "MCP_COLLABORATION_TOKEN": "mcp_collab_1234567890abcdef1234567890abcdef",
        "AGENT_ROLE": "frontend",
        "PROJECT_ID": "proj_a1b2c3d4e5f6g7h8",
        "PROJECT_NAME": "E-commerce Platform",
        "MEMORY_KEY": "client:client_acme:project:proj_a1b2c3d4e5f6g7h8"
      },
      "description": "Acme Corporation - E-commerce Platform (Manus)",
      "autoApprove": [
        "share_reasoning",
        "get_other_agent_context",
        "sync_progress"
      ]
    }
  }
}
```

#### 配置Claude (Backend)

**文件**: `.claude-code/settings.json` 或 `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcp": {
    "servers": {
      "awareness-collab-proj_a1b2c3d4e5f6g7h8": {
        "command": "node",
        "args": ["E:\\Awareness Market\\Awareness-Network\\mcp-server\\dist\\index-collaboration.js"],
        "env": {
          "VITE_APP_URL": "https://awareness.market",
          "MCP_COLLABORATION_TOKEN": "mcp_collab_1234567890abcdef1234567890abcdef",
          "AGENT_ROLE": "backend",
          "PROJECT_ID": "proj_a1b2c3d4e5f6g7h8",
          "PROJECT_NAME": "E-commerce Platform",
          "MEMORY_KEY": "client:client_acme:project:proj_a1b2c3d4e5f6g7h8"
        },
        "description": "Acme Corporation - E-commerce Platform (Claude)",
        "autoApprove": [
          "share_reasoning",
          "get_other_agent_context",
          "sync_progress"
        ]
      }
    }
  }
}
```

---

## 🔧 高级功能

### 添加更多Agent

```bash
# 添加测试agent到项目
node dist/project-manager.js add-agent \
  proj_a1b2c3d4e5f6g7h8 \
  "QA Bot" \
  testing \
  gpt-4

# ✅ Agent QA Bot (testing) added to project proj_a1b2c3d4e5f6g7h8

# 为新agent生成配置
node dist/project-manager.js config proj_a1b2c3d4e5f6g7h8 testing
```

支持的Agent角色：
- `frontend` - 前端开发
- `backend` - 后端开发
- `testing` - 测试和QA
- `devops` - 运维和部署
- `design` - UI/UX设计
- `fullstack` - 全栈开发
- 任意自定义角色

---

### 更新项目状态

```bash
# 暂停项目
node dist/project-manager.js status proj_a1b2c3d4e5f6g7h8 paused

# 恢复项目
node dist/project-manager.js status proj_a1b2c3d4e5f6g7h8 active

# 完成项目
node dist/project-manager.js status proj_a1b2c3d4e5f6g7h8 completed
```

---

## 📊 项目隔离机制

### Memory Key隔离

每个项目有唯一的Memory Key：

```
client:client_acme:project:proj_xxx111  ← Acme的电商项目
client:client_acme:project:proj_xxx222  ← Acme的移动app项目
client:client_techcorp:project:proj_yyy111  ← TechCorp的API项目
```

**保证**:
- ✅ 不同项目的数据完全隔离
- ✅ 即使同一客户的项目也是独立的
- ✅ 后端API根据Memory Key分隔数据

### Token隔离

每个项目有唯一的MCP Token：

```
Project A: mcp_collab_aaa111...
Project B: mcp_collab_bbb222...
Project C: mcp_collab_ccc333...
```

**保证**:
- ✅ 使用错误token无法访问其他项目
- ✅ Token泄露只影响单个项目
- ✅ 可以随时revoke和regenerate

---

## 🔒 安全最佳实践

### 1. Token管理

```bash
# 不要在代码中硬编码token
# ❌ 错误
const MCP_TOKEN = "mcp_collab_1234567890abcdef...";

# ✅ 正确 - 使用环境变量
const MCP_TOKEN = process.env.MCP_COLLABORATION_TOKEN;
```

### 2. .gitignore

确保配置文件不会被提交：

```gitignore
# AI Collaboration
.ai-collaboration/
mcp-config.json
manus-config.json
.claude-code/settings.json
```

### 3. 项目文件保护

```bash
# 设置适当的文件权限
chmod 600 .ai-collaboration/projects.json

# 定期备份
cp .ai-collaboration/projects.json .ai-collaboration/projects.backup.json
```

---

## 💼 实际使用场景

### 场景1: 为新客户开始项目

```bash
# 1. 创建项目
node dist/project-manager.js create \
  "SaaS Platform MVP" \
  "client_newstartup" \
  "New Startup Inc"

# 2. 查看项目详情（获取project ID）
node dist/project-manager.js list client_newstartup

# 3. 为每个agent生成配置
node dist/project-manager.js config proj_xxx frontend
node dist/project-manager.js config proj_xxx backend

# 4. 配置Manus和Claude
# 5. 开始开发！
```

### 场景2: 同一客户的多个项目

```bash
# Acme Corp有3个项目
node dist/project-manager.js create "Web App" "client_acme" "Acme Corp"
node dist/project-manager.js create "Mobile App" "client_acme" "Acme Corp"
node dist/project-manager.js create "Admin Dashboard" "client_acme" "Acme Corp"

# 查看这个客户的所有项目
node dist/project-manager.js list client_acme

# 每个项目独立配置和协作
```

### 场景3: 添加专业角色Agent

```bash
# 项目需要DevOps agent
node dist/project-manager.js add-agent proj_xxx "DevOps AI" devops gemini-pro

# 项目需要UI/UX设计agent
node dist/project-manager.js add-agent proj_xxx "Design AI" design midjourney

# 为新角色生成配置
node dist/project-manager.js config proj_xxx devops
node dist/project-manager.js config proj_xxx design
```

---

## 📈 扩展性

### 当前容量

- ✅ **客户数量**: 无限制
- ✅ **每客户项目数**: 无限制
- ✅ **每项目Agent数**: 无限制
- ✅ **并发协作**: 支持（每个项目独立）

### 性能考虑

| 项目数量 | 内存占用 | 响应时间 |
|---------|---------|----------|
| 1-10 | < 100MB | < 100ms |
| 10-50 | < 500MB | < 200ms |
| 50-100 | < 1GB | < 300ms |
| 100+ | 按需扩展 | < 500ms |

---

## 🛠️ 管理命令总结

```bash
# 项目管理
create <name> <client-id> <client-name>  # 创建项目
list [client-id]                         # 列出项目
show <project-id>                        # 查看详情
status <project-id> <status>             # 更新状态

# Agent管理
config <project-id> <role>               # 生成配置
add-agent <project-id> <name> <role> <model>  # 添加agent

# 数据文件
.ai-collaboration/projects.json          # 所有项目数据
```

---

## 📞 故障排查

### 问题: "Project not found"

```bash
# 检查项目ID是否正确
node dist/project-manager.js list

# 查看完整项目信息
cat .ai-collaboration/projects.json
```

### 问题: Agent无法看到其他agent的消息

```bash
# 检查两个agent是否使用相同的token
# Manus配置中的token
grep MCP_COLLABORATION_TOKEN manus-config.json

# Claude配置中的token
grep MCP_COLLABORATION_TOKEN ~/.config/Claude/claude_desktop_config.json

# 确保token完全一致
```

### 问题: 数据泄露到其他项目

**这不应该发生！** 如果发生，立即检查：

```bash
# 查看memory key是否正确
node dist/project-manager.js show <project-id>

# 确保每个项目有唯一的memory key
# 格式: client:CLIENT_ID:project:PROJECT_ID
```

---

## 🎉 总结

你现在拥有一个**企业级、多客户、多项目、完全隔离**的AI协作系统！

特性：
- ✅ 无限客户和项目
- ✅ 完全数据隔离
- ✅ 灵活的agent配置
- ✅ 简单的CLI管理
- ✅ 自动生成配置

下一步：
1. 运行 `setup-collaboration.bat` 开始
2. 为你的客户创建项目
3. 配置agents并开始协作！

---

**创建**: 2026-02-04
**版本**: 1.0.0
**文档**: [AI_COLLABORATION_README.md](./AI_COLLABORATION_README.md)
