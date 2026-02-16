# Stripe 收单 + v3.0 部署清单

## 📦 本次更新内容总结

### 1️⃣ Stripe 生产环境收单配置

**功能**：客户可以订阅付费计划，资金直接进入您的 Stripe 账户

**定价**：
- **Lite Plan**: $49/月 - 8 AI agents
- **Team Plan**: $199/月 - 32 AI agents
- **Enterprise Plan**: $499/月 - 128 AI agents
- **Scientific Plan**: $999/月 - Unlimited agents

**收款流向**：
```
客户支付 → Stripe 处理 → 扣除手续费(2.9%+$0.30) → 进入您的账户 → T+2天提现到银行
```

### 2️⃣ v3.0 AI Organization Governance（已完成100%）

**核心功能**：
- ✅ 多租户组织架构（Organization/Department）
- ✅ 4种内存类型（episodic/semantic/strategic/procedural）
- ✅ 自动内存衰减系统（基于类型的不同衰减率）
- ✅ 3层内存池（Private/Domain/Global）
- ✅ 冲突检测与自动仲裁
- ✅ AI决策记录与审计追踪
- ✅ 多维度Agent信誉系统
- ✅ 跨部门验证与证据追踪
- ✅ 依赖图与级联失效
- ✅ 组织分析仪表板
- ✅ 使用追踪与账单系统

**5个阶段**：
- Phase 1: Organization Foundation（组织基础）
- Phase 2: Memory Pools + Conflict Resolution（内存池+冲突解决）
- Phase 3: Decision Recording + Agent Reputation（决策记录+信誉）
- Phase 4: Verification + Evidence（验证+证据）
- Phase 5: Analytics + Billing（分析+账单）

---

## 🔧 需要部署的文件

### 配置文件（必须）

**`.env` 文件更新**（已完成）：
```bash
# Stripe生产密钥 (⚠️ 实际密钥请从 Stripe Dashboard 获取)
STRIPE_SECRET_KEY=sk_live_YOUR_SECRET_KEY_HERE
STRIPE_PUBLISHABLE_KEY=pk_live_YOUR_PUBLISHABLE_KEY_HERE
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET_HERE

# Base URL
BASE_URL=http://44.220.181.78:3001
```

⚠️ **安全提醒**：
- ❌ **不要**将 `.env` 文件提交到 Git
- ✅ 确保 `.gitignore` 包含 `.env`
- ✅ 在服务器上手动创建 `.env` 文件

### v3.0 新增文件（全部已创建）

#### 数据库 Schema
- `prisma/schema.prisma` - 已包含所有v3.0模型

#### 后端服务（14个新文件）
```
server/organization/
├── org-service.ts              ← 组织CRUD服务
├── dept-service.ts             ← 部门管理服务
└── membership-service.ts       ← 成员管理服务

server/decision/
├── decision-recorder.ts        ← 决策记录服务
└── decision-replay.ts          ← 历史决策重放

server/reputation/
├── reputation-engine.ts        ← 信誉计算引擎
└── reputation-hooks.ts         ← 信誉事件钩子

server/verification/
└── verification-service.ts     ← 跨部门验证服务

server/evidence/
├── evidence-service.ts         ← 证据管理服务
└── dependency-cascade.ts       ← 依赖级联处理

server/analytics/
├── org-analytics.ts            ← 组织分析服务
├── billing-tracker.ts          ← 使用追踪服务（已存在）
└── report-exporter.ts          ← 报告导出服务

server/memory-core/
├── memory-pool-router.ts       ← 池感知检索路由
└── memory-promoter.ts          ← 内存晋升服务
```

#### tRPC 路由（5个新路由）
```
server/routers/
├── organization.ts             ← 组织API
├── decision.ts                 ← 决策API
├── verification.ts             ← 验证API
├── evidence.ts                 ← 证据API
└── org-analytics.ts            ← 分析API（已存在）
```

#### 后台工作进程（4个新worker）
```
server/workers/
├── decay-worker.ts                    ← 内存衰减（每6小时）
├── conflict-arbitration-worker.ts    ← 冲突仲裁（每4小时）
├── reputation-decay-worker.ts        ← 信誉衰减（每天）
├── verification-worker.ts            ← 验证分配（每2小时）
└── worker-deployment-config.ts       ← Worker统一配置（已创建）
```

#### 前端页面（9个新页面）
```
client/src/pages/
├── OrganizationSetup.tsx      ← 组织创建向导
├── OrgDashboard.tsx           ← 组织仪表板（已存在）
├── DecisionAudit.tsx          ← 决策审计页面
├── VerificationDashboard.tsx  ← 验证管理页面
├── OrgAnalytics.tsx           ← 组织分析页面
└── BillingDashboard.tsx       ← 账单仪表板（已存在）

client/src/components/
├── DepartmentManager.tsx       ← 部门管理组件
├── MemoryPoolVisualizer.tsx   ← 内存池可视化
├── DecisionReplayViewer.tsx   ← 决策重放查看器
├── AgentReputationCard.tsx    ← Agent信誉卡片
├── EvidenceAttachment.tsx     ← 证据附件组件
└── DependencyGraph.tsx        ← 依赖图组件
```

#### 工具脚本（3个）
```
scripts/
├── backfill-v3-organizations.ts   ← v3.0数据迁移脚本
├── start-workers.ts               ← Worker启动脚本
└── test-stripe-webhook.ts         ← Stripe测试脚本
```

#### 配置文件（1个）
```
server/config/
└── feature-flags.ts              ← 功能开关配置（18个开关）
```

#### 文档（7个新文档）
```
├── V3_IMPLEMENTATION_STATUS.md          ← v3.0实现状态（95%→100%）
├── V3_COMPLETION_REPORT.md              ← v3.0完成报告
├── STRIPE_PRODUCTION_SETUP.md           ← Stripe生产环境指南
├── STRIPE_WEBHOOK_SETUP.md              ← Webhook配置指南
├── STRIPE_QUICK_START.md                ← 快速启动指南
└── DEPLOYMENT_CHECKLIST_STRIPE_V3.md    ← 本文档
```

---

## 🚀 部署步骤（Manus执行）

### 第1步：代码部署

```bash
# 1. 拉取最新代码（如果使用Git）
git pull origin main

# 2. 安装依赖
pnpm install

# 3. 构建前端
pnpm run build

# 4. 数据库迁移
npx prisma migrate deploy

# 5. 生成Prisma客户端
npx prisma generate
```

### 第2步：环境变量配置

在服务器上创建/更新 `.env` 文件：

```bash
# 复制并编辑
nano .env

# 必须包含以下Stripe配置 (⚠️ 实际密钥从 Stripe Dashboard 获取)：
STRIPE_SECRET_KEY=sk_live_YOUR_SECRET_KEY_HERE
STRIPE_PUBLISHABLE_KEY=pk_live_YOUR_PUBLISHABLE_KEY_HERE
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET_HERE
BASE_URL=http://44.220.181.78:3001

# v3.0 必需（如果启用功能）
REDIS_HOST=localhost
REDIS_PORT=6379
```

### 第3步：数据库初始化（如果需要）

```bash
# 运行v3.0数据迁移脚本（将现有数据迁移到组织结构）
npx tsx scripts/backfill-v3-organizations.ts

# 或先预览（不实际执行）
npx tsx scripts/backfill-v3-organizations.ts --dry-run
```

### 第4步：启动服务

```bash
# 启动主服务器
NODE_ENV=production pnpm start

# 或使用PM2（推荐）
pm2 start ecosystem.config.js
pm2 save
```

### 第5步：启动后台Worker（如果使用v3.0功能）

```bash
# 启动所有enabled的workers
npx tsx scripts/start-workers.ts

# 或只启动Phase 1的workers
npx tsx scripts/start-workers.ts --phase=1

# 或只启动关键workers
npx tsx scripts/start-workers.ts --critical-only

# 使用PM2（推荐）
pm2 start scripts/start-workers.ts --name awareness-workers
pm2 save
```

### 第6步：验证部署

```bash
# 1. 测试服务器健康
curl http://44.220.181.78:3001/health

# 2. 测试Stripe webhook
npx tsx scripts/test-stripe-webhook.ts

# 3. 检查日志
pm2 logs awareness-network
pm2 logs awareness-workers
```

---

## ✅ Stripe Webhook 配置（必须完成）

### 在 Stripe Dashboard 操作

1. **访问**：https://dashboard.stripe.com/webhooks

2. **确认端点已添加**：
   - URL: `http://44.220.181.78:3001/api/stripe/webhook`
   - 状态: ✅ Active

3. **确认监听的事件**：
   - ✅ `checkout.session.completed`
   - ✅ `customer.subscription.created`
   - ✅ `customer.subscription.updated`
   - ✅ `customer.subscription.deleted`
   - ✅ `invoice.paid`
   - ✅ `invoice.payment_failed`
   - ✅ `payment_intent.payment_failed`
   - ✅ `charge.refunded`

4. **测试 Webhook**：
   - 点击 "发送测试 webhook"
   - 选择 `checkout.session.completed`
   - 验证返回 **200 OK** ✅

---

## 🧪 部署后测试

### 1. Stripe 支付测试

```bash
# 访问网站
http://44.220.181.78:3001

# 操作流程：
1. 注册/登录账户
2. 创建组织
3. 选择升级计划（Lite $49 / Team $199）
4. 使用测试卡：4242 4242 4242 4242
5. 完成支付
6. 验证：
   - 组织planTier已更新
   - Stripe Dashboard显示支付
   - Webhook日志显示200 OK
```

### 2. v3.0 功能测试

```bash
# 如果启用了v3.0功能，测试：
1. 创建部门（Department）
2. 创建不同类型的内存（episodic/semantic/strategic）
3. 检查内存衰减（等6小时或手动触发worker）
4. 创建内存冲突并观察自动仲裁
5. 记录决策并查看审计日志
```

### 3. 监控检查

```bash
# 查看服务器日志
pm2 logs awareness-network --lines 50

# 查看worker日志
pm2 logs awareness-workers --lines 50

# 检查Stripe Dashboard
https://dashboard.stripe.com/payments
https://dashboard.stripe.com/webhooks
```

---

## 📊 功能开关（Feature Flags）

v3.0功能默认**关闭**，通过环境变量启用：

```bash
# Phase 1: 组织基础
ENABLE_ORGANIZATIONS=true
ENABLE_DEPARTMENTS=true
ENABLE_MEMORY_TYPES=true
ENABLE_MEMORY_DECAY=true
ENABLE_QUALITY_TIERS=true

# Phase 2: 内存池
ENABLE_MEMORY_POOLS=true
ENABLE_MEMORY_PROMOTION=true
ENABLE_CONFLICT_SEVERITY=true
ENABLE_CONFLICT_ARBITRATION=true

# Phase 3: 决策与信誉
ENABLE_DECISIONS=true
ENABLE_DECISION_REPLAY=true
ENABLE_AGENT_REPUTATION=true
ENABLE_REPUTATION_DECAY=true

# Phase 4: 验证与证据
ENABLE_VERIFICATION=true
ENABLE_EVIDENCE_TRACKING=true
ENABLE_DEPENDENCY_GRAPHS=true

# Phase 5: 分析仪表板
ENABLE_ORG_ANALYTICS=true
ENABLE_BILLING_TRACKER=true
ENABLE_REPORT_EXPORT=true
```

**推荐启用顺序**：
1. 先启用 Phase 1（组织基础）
2. 测试通过后启用 Phase 2-5

---

## ⚠️ 注意事项

### 安全

- ❌ **不要**将 `.env` 提交到 Git
- ✅ 使用 `.gitignore` 保护敏感文件
- ✅ 定期轮换 API 密钥（每90天）
- ✅ 启用 HTTPS（生产环境必需）

### 数据库

- ⚠️ 运行 `backfill-v3-organizations.ts` 前先**备份数据库**
- ✅ 先用 `--dry-run` 预览迁移
- ✅ 在低峰期执行大规模迁移

### Redis

- ✅ v3.0 workers 需要 Redis（用于 BullMQ）
- 如果不启用 workers，可以不安装 Redis

### 监控

- ✅ 定期检查 Stripe webhook 日志
- ✅ 设置告警（支付失败、webhook失败）
- ✅ 监控服务器负载和内存

---

## 💰 收款验证

部署完成后：

1. **查看 Stripe 余额**：
   https://dashboard.stripe.com/balance

2. **设置银行账户**（如未设置）：
   https://dashboard.stripe.com/settings/payouts

3. **验证收款**：
   - 完成一笔测试支付
   - 在 Payments 页面确认支付成功
   - 余额应增加（扣除手续费）

4. **提现测试**：
   - T+2 天后余额可用
   - 可手动提现或设置自动提现

---

## 📞 故障排查

### Webhook 返回 401/400

**原因**：签名验证失败

**解决**：
1. 检查 `STRIPE_WEBHOOK_SECRET` 是否正确
2. 重启服务器
3. 在 Stripe Dashboard 重新生成签名密钥

### 服务器无法启动

**检查**：
```bash
# 查看错误日志
pm2 logs awareness-network --err

# 常见问题：
# - 数据库连接失败 → 检查 DATABASE_URL
# - 端口被占用 → 修改 PORT
# - 环境变量缺失 → 检查 .env 文件
```

### 支付成功但数据库未更新

**检查**：
1. Webhook 是否收到（查看日志）
2. Webhook 事件 metadata 是否正确
3. 在 Stripe Dashboard 手动重放 webhook

---

## 🎉 完成！

部署完成后，您的系统将：

- ✅ 接收真实客户订阅付款（$49/$199/$499/$999/月）
- ✅ 资金直接进入您的 Stripe 账户
- ✅ 自动处理订阅升级/降级/取消
- ✅ 提供完整的 v3.0 AI Organization Governance 功能

**准备开始营销推广！** 🚀

---

## 📚 相关文档

- [V3_COMPLETION_REPORT.md](V3_COMPLETION_REPORT.md) - v3.0完整报告
- [STRIPE_QUICK_START.md](STRIPE_QUICK_START.md) - Stripe快速启动
- [STRIPE_WEBHOOK_SETUP.md](STRIPE_WEBHOOK_SETUP.md) - Webhook详细配置
- [STRIPE_PRODUCTION_SETUP.md](STRIPE_PRODUCTION_SETUP.md) - 生产环境指南
