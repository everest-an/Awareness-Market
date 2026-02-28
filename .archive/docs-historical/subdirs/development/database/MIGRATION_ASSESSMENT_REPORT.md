# Drizzle → Prisma 迁移评估报告

> 说明：本报告为历史评估，当前数据库已统一使用 PostgreSQL + Prisma。

**生成时间**: 2026-02-01
**项目**: Awareness Network
**评估范围**: 完整的 ORM 迁移评估

---

## 📊 执行摘要

### 当前状况

- **数据库**: PostgreSQL (Supabase)
- **当前 ORM**: Prisma v6.19.2
- **目标 ORM**: Prisma (已完成迁移)
- **数据库表总数**: **50+ 张表**
- **数据库操作函数**: **100+ 个函数** (在 `server/db.ts` 中)
- **依赖文件数**: **15+ 个文件** 直接使用 Drizzle

### 严重问题 🚨

#### 1. Drizzle Schema 语法错误

在多个 PostgreSQL schema 文件中发现 **SQLite 语法错误**:

**文件**: `drizzle/schema-api-usage-pg.ts`
**第 13 行**:
```typescript
id: integer('id').primaryKey().autoincrement(), // ❌ 错误！
```

**问题**: PostgreSQL 不支持 `.autoincrement()`，应该使用 `.generatedAlwaysAsIdentity()` 或 `serial()`

**影响**:
- 无法正确生成数据库迁移
- 可能导致 `colBuilder.setName is not a function` 错误

#### 2. Missing import 错误

**文件**: `drizzle/schema-mcp-tokens-pg.ts`
**第 15 行**:
```typescript
id: serial("id").primaryKey(), // ❌ serial 未定义！
```

**问题**: 缺少 `serial` 的导入
**修复**: 需要从 `drizzle-orm/pg-core` 导入 `serial`

### 迁移复杂度评估

| 维度 | 评分 | 说明 |
|------|------|------|
| **Schema 完整性** | ⚠️ 中等 | Prisma schema 只包含 ~15% 的表 |
| **业务逻辑复杂度** | 🔴 高 | db.ts 有 1346 行复杂查询 |
| **关联关系** | 🔴 高 | 大量外键和 JOIN 查询 |
| **迁移风险** | 🔴 高 | 影响生产环境核心功能 |
| **预计工作量** | 🔴 高 | 3-4 周 (全职工作) |

---

## 📁 Schema 对比分析

### Prisma Schema 现状 (仅 7 张表)

✅ **已定义的表** (7/50):

1. `User` - 用户表
2. `Workflow` - 工作流
3. `WorkflowStep` - 工作流步骤
4. `OnChainInteraction` - 链上交互
5. `WMatrixCompatibility` - W-Matrix 兼容性
6. `WMatrixListing` - W-Matrix 市场列表
7. `WMatrixIntegrity` - W-Matrix 完整性验证

### ❌ 缺少的核心表 (43 张)

#### 🔴 高优先级 - 核心业务表 (必须迁移)

| 表名 | 用途 | 依赖的代码文件 | 复杂度 |
|------|------|---------------|--------|
| `latentVectors` | AI 向量存储 | `db.ts`, `api/vector-api.ts` | ⭐⭐⭐⭐ |
| `transactions` | 交易记录 | `db.ts`, `blockchain/*` | ⭐⭐⭐⭐ |
| `accessPermissions` | 访问权限 | `db.ts`, `auth*.ts` | ⭐⭐⭐ |
| `apiKeys` | API 密钥 | `db.ts`, `auth-ai-agent.ts` | ⭐⭐⭐ |
| `mcpTokens` | MCP 同步令牌 | `db.ts`, `api/mcp-api.ts` | ⭐⭐ |
| `apiCallLogs` | API 调用日志 | `db.ts`, `middleware/*` | ⭐⭐ |
| `vectorPackages` | 向量包管理 | `db.ts`, `neural-bridge/*` | ⭐⭐⭐⭐ |
| `memoryPackages` | 记忆包管理 | `db.ts`, `neural-bridge/*` | ⭐⭐⭐ |
| `packagePurchases` | 包购买记录 | `db.ts`, `api/package-api.ts` | ⭐⭐⭐⭐ |

#### 🟡 中优先级 - 业务支持表

| 表名 | 用途 | 复杂度 |
|------|------|--------|
| `reviews` | 评论系统 | ⭐⭐ |
| `subscriptionPlans` | 订阅计划 | ⭐⭐ |
| `userSubscriptions` | 用户订阅 | ⭐⭐⭐ |
| `notifications` | 通知系统 | ⭐⭐ |
| `userPreferences` | 用户偏好 | ⭐ |
| `browsingHistory` | 浏览历史 | ⭐ |
| `aiMemory` | AI 记忆存储 | ⭐⭐⭐ |
| `trialUsage` | 试用统计 | ⭐ |

#### 🟢 低优先级 - 辅助功能表

| 表名 | 用途 | 复杂度 |
|------|------|--------|
| `userBehavior` | 用户行为追踪 | ⭐ |
| `abTestExperiments` | A/B 测试 | ⭐ |
| `abTestAssignments` | A/B 测试分配 | ⭐ |
| `blogPosts` | 博客文章 | ⭐⭐ |
| `vectorInvocations` | 向量调用详情 | ⭐⭐ |
| `vectorReports` | 向量举报 | ⭐⭐ |
| `creatorReputations` | 创作者声誉 | ⭐⭐ |
| `vectorQualityChecks` | 质量检查 | ⭐⭐ |
| `memoryExchanges` | 记忆交换 | ⭐⭐⭐ |
| `reasoningChains` | 推理链 | ⭐⭐⭐ |
| `wMatrixVersions` | W-Matrix 版本 | ⭐⭐ |
| `passwordResetCodes` | 密码重置码 | ⭐ |
| `alignmentCalculations` | 对齐计算历史 | ⭐⭐ |
| `wMatrices` | W-Matrix 存储 | ⭐⭐⭐ |
| `challenges` | 验证挑战 | ⭐⭐ |
| `wMatrixPurchases` | W-Matrix 购买 | ⭐⭐⭐ |
| `chainPackages` | 链包管理 | ⭐⭐⭐ |
| `packageDownloads` | 包下载记录 | ⭐⭐ |
| `memoryUsageLog` | 记忆使用日志 | ⭐⭐ |

#### 🔵 扩展功能表

| 表名 | 用途 | 复杂度 |
|------|------|--------|
| `apiUsageLogs` | API 使用日志 | ⭐ |
| `apiUsageDailyStats` | API 每日统计 | ⭐⭐ |
| `apiEndpoints` | API 端点注册 | ⭐ |
| `rateLimitConfig` | 速率限制配置 | ⭐ |
| `neural-bridgeVectorPackages` | Neural Bridge 向量包扩展 | ⭐⭐⭐ |
| `neural-bridgeMemoryPackages` | Neural Bridge 记忆包扩展 | ⭐⭐⭐ |
| `neural-bridgeChainPackages` | Neural Bridge 链包扩展 | ⭐⭐⭐ |
| `userLatentSpaces` | 用户 Latent 空间 | ⭐⭐ |

---

## 📄 需要迁移的文件清单

### 🔴 高优先级文件 (核心功能)

#### 1. 用户认证和授权
- [ ] `server/auth.ts` - 基础认证逻辑
- [ ] `server/auth-ai-agent.ts` - AI Agent 认证
- [ ] `server/auth-phantom.ts` - Phantom 钱包认证
- [ ] `server/auth-erc8004.ts` - ERC-8004 认证
- [ ] `server/auth-standalone.ts` - 独立认证

**涉及的表**: `users`, `apiKeys`, `mcpTokens`
**函数数量**: ~15 个
**迁移复杂度**: ⭐⭐⭐ (中等)

#### 2. 交易和支付
- [ ] `server/api/transaction-api.ts` - 交易 API
- [ ] `server/blockchain/stablecoin-payment.ts` - 稳定币支付

**涉及的表**: `transactions`, `accessPermissions`, `packagePurchases`
**函数数量**: ~20 个
**迁移复杂度**: ⭐⭐⭐⭐ (较高)

#### 3. 向量和包管理
- [ ] `server/api/package-api.ts` - 包管理 API
- [ ] `server/neural-bridge/package-manager.ts` - Neural Bridge 包管理器

**涉及的表**: `vectorPackages`, `memoryPackages`, `chainPackages`, `packagePurchases`
**函数数量**: ~30 个
**迁移复杂度**: ⭐⭐⭐⭐ (较高)

#### 4. API 使用统计
- [ ] `server/api/api-usage-api.ts` - API 使用 API
- [ ] `server/middleware/api-usage-tracker.ts` - API 使用追踪中间件

**涉及的表**: `apiUsageLogs`, `apiKeys`
**函数数量**: ~10 个
**迁移复杂度**: ⭐⭐ (简单)

### 🟡 中优先级文件 (业务功能)

#### 5. 工作流管理 (部分已迁移)
- [ ] `server/workflow/workflow-manager.ts` - 工作流管理器
- [ ] `server/workflow/workflow-history.ts` - 工作流历史

**涉及的表**: `workflows`, `workflowSteps`, `onChainInteractions` (✅ Prisma schema 已有)
**函数数量**: ~25 个
**迁移复杂度**: ⭐⭐⭐ (中等)

#### 6. AI Agent 管理
- [ ] `server/api/ai-agent-api.ts` - AI Agent API
- [ ] `server/erc8004/agent-registry.ts` - Agent 注册表

**涉及的表**: `latentVectors`, `aiMemory`
**函数数量**: ~15 个
**迁移复杂度**: ⭐⭐⭐ (中等)

### 🟢 低优先级文件 (辅助功能)

#### 7. 监控和日志
- [ ] `server/utils/logger.ts` - 日志工具
- [ ] `server/monitoring/metrics.ts` - 指标监控

**涉及的表**: `apiCallLogs`, `vectorInvocations`
**迁移复杂度**: ⭐ (简单)

---

## 🔍 db.ts 文件详细分析

### 文件统计
- **总行数**: 1346 行
- **导出函数**: ~100 个
- **使用的 Drizzle 特性**:
  - ✅ `select()`, `from()`, `where()`, `limit()`
  - ✅ `insert()`, `values()`, `returning()`
  - ✅ `update()`, `set()`
  - ✅ `delete()`
  - ✅ `eq()`, `and()`, `desc()`, `sql`, `gte()`, `lte()`, `like()`, `or()`
  - ✅ `leftJoin()`, `innerJoin()`
  - ✅ `onConflictDoUpdate()` (Upsert 操作)

### 按功能模块分类的函数

#### 1. User Management (10 个函数)
```typescript
✓ upsertUser()
✓ getUserByOpenId()
✓ getUserById()
✓ updateUserRole()
✓ updateUserProfile()
```

#### 2. Latent Vectors (8 个函数)
```typescript
✓ createLatentVector()
✓ getLatentVectorById()
✓ getLatentVectorsByCreator()
✓ searchLatentVectors() // 复杂查询！
✓ getAllCategories()
✓ updateLatentVector()
✓ incrementVectorStats() // 使用 sql 标签
```

#### 3. Transactions (6 个函数)
```typescript
✓ createTransaction()
✓ getTransactionById()
✓ getUserTransactions() // 使用 JOIN
✓ updateTransactionStatus()
✓ updateTransactionPaymentInfo()
```

#### 4. Access Permissions (7 个函数)
```typescript
✓ createAccessPermission()
✓ getAccessPermissionByToken()
✓ getUserAccessPermissions() // 使用 LEFT JOIN
✓ getAccessPermissionById()
✓ renewAccessPermission()
✓ decrementCallsRemaining() // 使用 sql 标签
```

#### 5. API Keys (4 个函数)
```typescript
✓ getUserApiKeys()
✓ createApiKey()
✓ revokeApiKey()
```

#### 6. MCP Tokens (5 个函数)
```typescript
✓ createMcpToken()
✓ listMcpTokens()
✓ revokeMcpToken()
✓ getMcpTokenByToken()
```

#### 7. AI Memory (2 个函数)
```typescript
✓ getAIMemoryByKey()
✓ upsertAIMemory() // 复杂的 upsert 逻辑
```

#### 8. Reviews (2 个函数)
```typescript
✓ createReview() // 包含统计更新
✓ getVectorReviews() // 使用 LEFT JOIN
```

#### 9. Subscriptions (4 个函数)
```typescript
✓ getSubscriptionPlans()
✓ getUserSubscription()
✓ createUserSubscription()
✓ updateUserSubscription()
```

#### 10. API Call Logs (4 个函数)
```typescript
✓ logApiCall()
✓ getVectorCallStats()
✓ getCreatorRevenueTrend() // 复杂的 SQL 查询
✓ getCreatorCallTrend() // 复杂的 SQL 查询
```

#### 11. Notifications (3 个函数)
```typescript
✓ createNotification()
✓ getUserNotifications()
✓ markNotificationAsRead()
```

#### 12. User Preferences (2 个函数)
```typescript
✓ getUserPreferences()
✓ upsertUserPreferences()
```

#### 13. Browsing History (2 个函数)
```typescript
✓ insertBrowsingHistory()
✓ getBrowsingHistory()
```

#### 14. Vector Packages (6 个函数)
```typescript
✓ createVectorPackage()
✓ getVectorPackageById()
✓ getVectorPackageByPackageId()
✓ browseVectorPackages() // 复杂查询
✓ updateVectorPackageStats()
✓ incrementVectorPackageDownloads() // 使用 sql 标签
```

#### 15. Memory Packages (3 个函数)
```typescript
✓ createMemoryPackage()
✓ getMemoryPackageById()
✓ browseMemoryPackages() // 复杂查询
```

#### 16. Package Purchases (4 个函数)
```typescript
✓ createPackagePurchase()
✓ getUserPackagePurchaseByPackageId()
✓ updatePackagePurchaseStatus()
✓ incrementPackageDownloads()
```

---

## ⚠️ 迁移风险评估

### 高风险操作

#### 1. 原始 SQL 查询 (5 处)
**位置**: `db.ts:805-877`

```typescript
// ❌ Drizzle 直接 SQL
const rows = await db.execute(sql`
  SELECT DATE(t.createdAt) as date,
         SUM(t.creator_earnings) as revenue
  FROM transactions t
  INNER JOIN latent_vectors v ON t.vector_id = v.id
  WHERE v.creator_id = ${userId}
    AND t.status = 'completed'
    AND t.createdAt >= ${startDate}
  GROUP BY DATE(t.createdAt)
  ORDER BY DATE(t.createdAt)
`);
```

**Prisma 迁移策略**:
- 选项 1: 使用 Prisma `$queryRaw`
- 选项 2: 重写为 Prisma 查询 API (推荐)
- 选项 3: 使用 Prisma 视图功能

**风险**: 🔴 高 - 可能影响报表功能

#### 2. Upsert 操作 (4 处)
**位置**: `db.ts:115`, `db.ts:656`, `db.ts:923`

```typescript
// Drizzle Upsert
await db.insert(users).values(values).onConflictDoUpdate({
  target: users.openId,
  set: updateSet,
});
```

**Prisma 迁移**:
```typescript
// Prisma Upsert
await prisma.users.upsert({
  where: { openId: user.openId },
  update: updateSet,
  create: values,
});
```

**风险**: 🟡 中 - 语法差异较大,需要仔细测试

#### 3. SQL 标签语句 (6 处)
**位置**: `db.ts:309`, `db.ts:626`, `db.ts:1102`

```typescript
// Drizzle
await db.update(latentVectors)
  .set({
    totalCalls: sql`${latentVectors.totalCalls} + 1`,
    totalRevenue: sql`${latentVectors.totalRevenue} + ${revenue}`,
  })
  .where(eq(latentVectors.id, vectorId));
```

**Prisma 迁移**:
```typescript
// Prisma
await prisma.latentVectors.update({
  where: { id: vectorId },
  data: {
    totalCalls: { increment: 1 },
    totalRevenue: { increment: revenue },
  },
});
```

**风险**: 🟢 低 - Prisma 支持原子增量操作

#### 4. 复杂 JOIN 查询 (8 处)
**位置**: `db.ts:342`, `db.ts:548`, `db.ts:719`

```typescript
// Drizzle
return await db
  .select()
  .from(transactions)
  .innerJoin(latentVectors, eq(transactions.vectorId, latentVectors.id))
  .where(eq(latentVectors.creatorId, userId))
  .orderBy(desc(transactions.createdAt));
```

**Prisma 迁移**:
```typescript
// Prisma (使用关联)
return await prisma.transactions.findMany({
  where: {
    vector: {
      creatorId: userId,
    },
  },
  include: {
    vector: true,
  },
  orderBy: { createdAt: 'desc' },
});
```

**风险**: 🟡 中 - 需要定义 Prisma relations

---

## 📋 推荐的迁移步骤

### 阶段 0: 准备工作 (1-2 天)

✅ **已完成**:
- [x] Prisma 依赖已安装
- [x] 基础 Prisma schema 已存在

⚠️ **待完成**:
- [ ] 修复 Drizzle schema 中的语法错误
  - [ ] `schema-api-usage-pg.ts:13` - 修复 `autoincrement()` 错误
  - [ ] `schema-mcp-tokens-pg.ts:15` - 添加 `serial` 导入
- [ ] 从数据库反向生成完整的 Prisma schema
  ```bash
  npx prisma db pull
  npx prisma generate
  ```
- [ ] 备份生产数据库

### 阶段 1: Schema 迁移 (3-4 天)

#### 1.1 完善 Prisma Schema
- [ ] 添加所有缺失的表定义到 `prisma/schema.prisma`
- [ ] 定义所有关联关系 (relations)
- [ ] 添加索引 (indexes)
- [ ] 验证 schema 与数据库一致性
  ```bash
  npx prisma validate
  npx prisma format
  ```

#### 1.2 创建 Prisma 客户端单例
- [ ] 创建 `server/db-prisma.ts`
- [ ] 配置连接池
- [ ] 添加查询日志 (开发环境)
- [ ] 实现优雅关闭

**参考实现** (迁移指南已提供):
```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: [
    { level: 'query', emit: 'event' },
    { level: 'error', emit: 'stdout' },
  ],
});

export { prisma };
```

### 阶段 2: 核心功能迁移 (1 周)

#### 优先级 1: 用户认证 (1-2 天)
- [ ] 迁移 `upsertUser()`
- [ ] 迁移 `getUserByOpenId()`
- [ ] 迁移 `getUserById()`
- [ ] 迁移 `updateUserRole()`
- [ ] 迁移 `updateUserProfile()`
- [ ] 单元测试 (Vitest)
- [ ] 集成测试

#### 优先级 2: API 密钥管理 (1 天)
- [ ] 迁移 `getUserApiKeys()`
- [ ] 迁移 `createApiKey()`
- [ ] 迁移 `revokeApiKey()`
- [ ] 迁移 `createMcpToken()`
- [ ] 迁移 `listMcpTokens()`
- [ ] 迁移 `getMcpTokenByToken()`
- [ ] 单元测试

#### 优先级 3: 交易管理 (2-3 天)
- [ ] 迁移 `createTransaction()`
- [ ] 迁移 `getTransactionById()`
- [ ] 迁移 `getUserTransactions()` (含 JOIN)
- [ ] 迁移 `updateTransactionStatus()`
- [ ] 迁移 `updateTransactionPaymentInfo()`
- [ ] 单元测试
- [ ] 集成测试 (支付流程)

#### 优先级 4: 向量包管理 (2-3 天)
- [ ] 迁移 `createVectorPackage()`
- [ ] 迁移 `getVectorPackageById()`
- [ ] 迁移 `browseVectorPackages()` (复杂查询)
- [ ] 迁移 `createPackagePurchase()`
- [ ] 迁移 `updatePackagePurchaseStatus()`
- [ ] 单元测试
- [ ] E2E 测试 (购买流程)

### 阶段 3: 业务功能迁移 (1 周)

#### 向量和权限管理 (3 天)
- [ ] 迁移所有 Latent Vectors 函数
- [ ] 迁移所有 Access Permissions 函数
- [ ] 迁移评论系统
- [ ] 测试

#### 工作流和 AI Memory (2 天)
- [ ] 迁移工作流管理函数
- [ ] 迁移 AI Memory 函数
- [ ] 测试

#### 订阅和通知 (2 天)
- [ ] 迁移订阅管理函数
- [ ] 迁移通知系统
- [ ] 测试

### 阶段 4: 辅助功能迁移 (3-5 天)

- [ ] 迁移日志和统计函数
- [ ] 迁移浏览历史
- [ ] 迁移用户偏好
- [ ] 迁移其他辅助功能
- [ ] 全面测试

### 阶段 5: 清理和优化 (2-3 天)

- [ ] 删除所有 Drizzle 导入
- [ ] 删除 `drizzle/` 目录
- [ ] 卸载 `drizzle-orm` 包
  ```bash
  pnpm remove drizzle-orm drizzle-kit
  ```
- [ ] 更新 package.json scripts
- [ ] 更新文档
- [ ] 性能测试和优化
- [ ] 最终代码审查

### 阶段 6: 部署和监控 (2-3 天)

- [ ] 在测试环境部署
- [ ] 运行完整的 E2E 测试套件
- [ ] 性能基准测试
- [ ] 准备回滚计划
- [ ] 生产环境部署 (灰度发布)
- [ ] 监控关键指标
- [ ] 验证所有功能正常

---

## 📊 预计工作量

| 阶段 | 工作日 | 人员 | 备注 |
|------|--------|------|------|
| 阶段 0: 准备工作 | 1-2 天 | 1 人 | 修复现有错误 |
| 阶段 1: Schema 迁移 | 3-4 天 | 1 人 | 完善 Prisma schema |
| 阶段 2: 核心功能迁移 | 5-7 天 | 1-2 人 | 认证、交易、包管理 |
| 阶段 3: 业务功能迁移 | 5-7 天 | 1-2 人 | 向量、工作流、订阅 |
| 阶段 4: 辅助功能迁移 | 3-5 天 | 1 人 | 日志、统计等 |
| 阶段 5: 清理和优化 | 2-3 天 | 1 人 | 代码清理、性能优化 |
| 阶段 6: 部署和监控 | 2-3 天 | 2 人 | 测试、部署、监控 |
| **总计** | **21-31 天** | **1-2 人** | **约 3-4 周** |

---

## 🎯 成功标准

### 功能完整性
- ✅ 所有 API 端点正常响应
- ✅ 用户认证和授权正常
- ✅ 交易流程完整无误
- ✅ 包下载和购买功能正常
- ✅ 工作流执行正常
- ✅ 数据库查询结果一致

### 性能指标
- ✅ 简单查询响应时间 < 100ms
- ✅ 复杂查询响应时间 < 500ms
- ✅ 无内存泄漏
- ✅ 数据库连接池稳定

### 代码质量
- ✅ 所有单元测试通过 (覆盖率 > 80%)
- ✅ 所有集成测试通过
- ✅ 无 TypeScript 错误
- ✅ 无 ESLint 警告
- ✅ 代码审查通过

### 文档完整性
- ✅ API 文档已更新
- ✅ 数据库 Schema 文档已更新
- ✅ 迁移日志已记录
- ✅ 运维文档已更新

---

## ⚡ 快速开始建议

基于评估结果,我建议采用以下策略:

### 方案 A: 保守渐进式迁移 (推荐)
**适合**: 生产环境稳定性优先

1. **先修复 Drizzle 错误** (1 天)
   - 修复 `schema-api-usage-pg.ts` 的 autoincrement 错误
   - 修复 `schema-mcp-tokens-pg.ts` 的导入错误
   - 验证 Drizzle 可以正常工作

2. **完善 Prisma Schema** (3-4 天)
   - 使用 `npx prisma db pull` 从数据库生成完整 schema
   - 手动调整和验证
   - 生成 Prisma Client

3. **创建并行测试环境** (1-2 天)
   - 创建 `db-prisma.ts` 文件
   - 编写对比测试,确保 Prisma 和 Drizzle 返回相同结果

4. **逐模块迁移** (2-3 周)
   - 按优先级逐个模块迁移
   - 每个模块都要有完整的测试
   - 在开发环境充分验证后再部署

### 方案 B: 激进式迁移 (高风险)
**适合**: 快速解决问题,愿意承担风险

1. **立即完善 Prisma Schema** (1-2 天)
2. **全部迁移到 Prisma** (1 周)
3. **密集测试** (3-5 天)
4. **快速部署** (1-2 天)

**风险**: 🔴 可能导致生产环境故障

---

## 📞 下一步行动

请选择一个策略:

1. **方案 A: 保守渐进式迁移** (推荐)
   - 我将先修复 Drizzle 错误
   - 然后完善 Prisma schema
   - 再逐步迁移核心功能

2. **方案 B: 激进式迁移**
   - 立即开始全面迁移
   - 接受更高的风险

3. **自定义方案**
   - 根据您的具体需求定制迁移计划

---

## 📝 附录: 关键文件路径

### Schema 文件
```
drizzle/
├── schema-pg.ts                    (主 schema,1276 行)
├── schema-api-usage-pg.ts          (API 使用,115 行) ⚠️ 有错误
├── schema-mcp-tokens-pg.ts         (MCP tokens,33 行) ⚠️ 有错误
├── schema-neural-bridge-packages-pg.ts (Neural Bridge 包,288 行)
├── schema-workflows-pg.ts          (工作流,122 行)
└── schema-w-matrix-compat-pg.ts    (W-Matrix,169 行)
```

### 数据库操作文件
```
server/
├── db.ts                           (主数据库文件,1346 行)
├── auth*.ts                        (认证相关,9 个文件)
├── api/
│   ├── package-api.ts              (包管理 API)
│   ├── transaction-api.ts          (交易 API)
│   └── api-usage-api.ts            (API 使用 API)
├── neural-bridge/
│   └── package-manager.ts          (包管理器)
└── workflow/
    ├── workflow-manager.ts         (工作流管理)
    └── workflow-history.ts         (工作流历史)
```

### 配置文件
```
prisma/
└── schema.prisma                   (Prisma schema,310 行,需要扩展)

package.json                        (依赖配置)
```

---

**报告结束**

如有疑问或需要进一步的详细分析,请随时提出。
