# 仓库结构整理方案

> ✅ **整理已完成** - 2026-01-26

## 一、当前结构分析

### `_core` 目录说明
- `server/_core/` - 核心基础设施（tRPC、LLM调用、环境变量、邮件等），被大量模块依赖，**保留不动**
- `client/src/_core/` - 仅包含一个 `useAuth.ts`，应合并到 `hooks/`
- `shared/_core/` - 错误定义，**保留**

### 问题汇总
1. 根目录有 **40+ 个 markdown 文档**，应分类整理
2. **seed 脚本分散** - 根目录和 `scripts/` 都有
3. **Golem 文件分散** - 根目录有独立文件，又有 `golem-visualizer/` 目录
4. **context vs contexts** - 前端两个上下文目录应合并
5. **启动脚本过多** - 多个 `start-*.sh/ps1` 文件

---

## 二、整理方案

### 1. 根目录 Markdown 文档整理

#### 移动到 `docs/guides/`（用户指南类）
```
QUICKSTART.md → docs/guides/quickstart.md
USER_GUIDE.md → docs/guides/user-guide.md
DEMO_ACCOUNT_GUIDE.md → docs/guides/demo-account.md
WEB3_QUICKSTART.md → docs/guides/web3-quickstart.md
TROUBLESHOOTING_GUIDE.md → docs/guides/troubleshooting.md
```

#### 移动到 `docs/deployment/`（部署相关）
```
DEPLOYMENT.md → docs/deployment/overview.md
DEPLOYMENT_GUIDE.md → docs/deployment/guide.md
DEPLOYMENT_READY.md → docs/deployment/checklist.md
DEPLOY_AND_TEST_GUIDE.md → docs/deployment/test-guide.md
SMTP_SETUP_GUIDE.md → docs/deployment/smtp-setup.md
```

#### 移动到 `docs/architecture/`（架构设计）
```
SERVICE_ARCHITECTURE_REVIEW.md → docs/architecture/service-review.md
ARCHITECTS_CHEATSHEET.md → docs/architecture/cheatsheet.md
GO_SERVICES_INTEGRATION_GUIDE.md → docs/architecture/go-services.md
INTEGRATION_GUIDE.md → docs/architecture/integration.md
```

#### 移动到 `docs/reports/`（报告类，可考虑归档或删除）
```
COMPLETION_REPORT.md
FINAL_COMPLETION_REPORT.md
FINAL_OPTIMIZATION_REPORT.md
FINAL_SUMMARY.md
PROJECT_COMPLETION_SUMMARY.md
PROJECT_SUMMARY.md
INTEGRATION_COMPLETE.md
WEB3_COMPLETION_SUMMARY.md
GO_SERVICES_INTEGRATION_COMPLETION.md
```

#### 保留在根目录
```
README.md          # 项目入口
CHANGELOG.md       # 变更日志
CONTRIBUTING.md    # 贡献指南
CODE_OF_CONDUCT.md # 行为准则
LICENSE            # 许可证（如果有）
```

---

### 2. 脚本文件整理

#### 移动 seed 脚本到 `scripts/seed/`
```bash
# 从根目录移动
seed-enterprise-vectors.mjs → scripts/seed/enterprise-vectors.mjs
seed-latentmas-enterprise.ts → scripts/seed/latentmas-enterprise.ts
seed-opensource-vectors.ts → scripts/seed/opensource-vectors.ts
seed-reasoning-chains.ts → scripts/seed/reasoning-chains.ts
```

#### 移动启动脚本到 `scripts/start/`
```bash
start-all-services.ps1 → scripts/start/all-services.ps1
start-go-services.ps1 → scripts/start/go-services.ps1
start-go-services.sh → scripts/start/go-services.sh
start-services-simple.sh → scripts/start/services-simple.sh
start-services.ps1 → scripts/start/services.ps1
```

#### 移动测试脚本到 `scripts/test/`
```bash
test-integration.mjs → scripts/test/integration.mjs
test-registration.mjs → scripts/test/registration.mjs
test_ai_agent_flow.py → scripts/test/ai-agent-flow.py
check-user.mjs → scripts/test/check-user.mjs
```

---

### 3. Golem 文件整合

将根目录的 Golem 文件移入 `golem-visualizer/`：
```bash
golem_backend.py → golem-visualizer/backend/golem_backend.py
GolemVisualizer.js → golem-visualizer/frontend/GolemVisualizer.js
golem_integration_example.html → golem-visualizer/examples/integration.html
GOLEM_README.md → golem-visualizer/README.md (合并)
GOLEM_REQUIREMENTS.txt → golem-visualizer/requirements.txt
GOLEM_FILE_INDEX.md → 删除（整合后不需要）
GOLEM_INTEGRATION_SUMMARY.md → golem-visualizer/docs/integration.md
PROJECT_GOLEM_ANALYSIS.md → golem-visualizer/docs/analysis.md
```

---

### 4. 前端目录整理

#### 合并 context 目录
```bash
# 将 context/ 内容移到 contexts/
client/src/context/Web3Context.tsx → client/src/contexts/Web3Context.tsx
# 删除空的 context/ 目录
```

#### 合并 _core 到 hooks
```bash
client/src/_core/hooks/useAuth.ts → client/src/hooks/useAuth.ts
# 删除 _core/ 目录
```

---

### 5. 清理建议

#### 可删除的文件
- `README.md.backup` - 备份文件
- `wouter-patch.zip` - 已应用的补丁
- `push_log.txt` - 临时日志
- `WAITING_FOR_GITHUB_PUSH.md` - 临时状态文件
- `todo.md` - 如果已完成可删除
- `COMPLETION_DASHBOARD.txt` - 临时文件

#### 可归档的文件（移到 `docs/archive/`）
- 各种 `*_COMPLETE.md`、`*_SUMMARY.md` 报告
- `MARKET_ANALYSIS.md`
- `LEGAL_COMPLIANCE.md`

---

## 三、整理后的目录结构

```
Awareness-Network/
├── client/                    # 前端代码
│   └── src/
│       ├── components/
│       ├── contexts/          # 合并后的上下文
│       ├── hooks/             # 合并后的 hooks
│       ├── lib/
│       ├── pages/
│       └── types/
├── server/                    # 后端代码
│   ├── _core/                 # 核心基础设施（保留）
│   ├── routers/
│   ├── latentmas/
│   └── ...
├── shared/                    # 共享代码
├── drizzle/                   # 数据库
├── contracts/                 # 智能合约
├── go-services/               # Go 微服务
├── mcp-server/                # MCP 服务
├── mcp-gateway/               # MCP 网关
├── golem-visualizer/          # Golem 可视化（整合后）
├── python-sdk/                # Python SDK
├── scripts/                   # 脚本
│   ├── seed/                  # 数据填充
│   ├── start/                 # 启动脚本
│   ├── test/                  # 测试脚本
│   └── deploy/                # 部署脚本
├── docs/                      # 文档
│   ├── guides/                # 用户指南
│   ├── deployment/            # 部署文档
│   ├── architecture/          # 架构文档
│   ├── api/                   # API 文档
│   ├── reports/               # 报告（可选归档）
│   └── archive/               # 归档文档
├── examples/                  # 示例代码
├── README.md
├── CHANGELOG.md
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
├── package.json
└── ...配置文件
```

---

## 四、执行步骤

1. **备份** - 先 commit 当前状态
2. **移动文档** - 按上述方案移动 markdown 文件
3. **整理脚本** - 移动并更新 package.json 中的脚本路径
4. **整合 Golem** - 移动文件并更新引用
5. **前端整理** - 合并 context/contexts 和 _core
6. **清理** - 删除临时文件
7. **更新引用** - 检查并修复所有 import 路径
8. **测试** - 确保项目正常运行

---

## 五、注意事项

- `server/_core/` 是核心模块，**不要移动**
- 移动文件后需要更新所有 import 路径
- 建议分批执行，每批完成后测试
- 保留 git 历史，使用 `git mv` 命令

需要我帮你执行这个整理方案吗？
