# Known Issues

## 概览

本文档记录了Awareness Network项目中的已知问题和待修复事项。

**最后更新**: 2026-01-30
**TypeScript错误数**: 28个 (服务端全部修复，仅剩依赖缺失和少量类型不匹配)
**测试失败数**: 14/722个 (98.1%通过率)

---

## 🔴 严重问题（已修复）

### ✅ 数据库操作类型安全
- **状态**: 已修复
- **文件**: `server/stripe-webhook.ts`, `server/vector-invocation.ts`
- **问题**: 数据库对象可能为null时未进行检查
- **修复**: 添加了null检查和早期返回

### ✅ Logger类型错误
- **状态**: 已修复
- **文件**: `server/storage/*`, `server/vector-invocation.ts`, `server/routers/neural-bridge-api.ts`
- **问题**: catch块中的error类型为unknown，不能直接传递给logger
- **修复**: 将error包装在对象中: `logger.error(msg, { error })`

### ✅ VectorMetadata类型兼容性
- **状态**: 已修复
- **文件**: `server/vector-database.ts`
- **问题**: VectorMetadata缺少索引签名，与Qdrant类型不兼容
- **修复**: 添加 `[key: string]: unknown;` 索引签名

### ✅ Drizzle ORM SQL语法
- **状态**: 已修复
- **文件**: `server/vector-invocation.ts`
- **问题**: 使用了不存在的`db.raw()`方法
- **修复**: 替换为`sql`模板字符串

---

## ⚠️ 待修复问题

### 1. 前端Phase 3组件类型不匹配（~50个错误）

**受影响文件**:
- `client/src/pages/PrivacySettings.tsx` (11个错误)
- `client/src/components/PrivacySelector.tsx` (4个错误)
- `client/src/components/GPUStatusIndicator.tsx` (5个错误)
- `client/src/pages/CrossModalSearch.tsx` (2个错误)
- `client/src/pages/UploadMultimodalPackage.tsx` (2个错误)
- `client/src/pages/MyMemories.tsx` (5个错误)
- `client/src/pages/Leaderboard.tsx` (5个错误)

**问题描述**:
- API响应类型与前端期望不匹配
- 缺少属性: `differentialPrivacyEnabled`, `defaultEpsilon`, `gpuDevice`, `memoryUsage`等
- 需要后端API与前端组件对齐

**优先级**: 中等（功能可运行但类型不安全）

**建议修复**:
1. 审查后端API响应schema
2. 更新前端tRPC类型定义
3. 添加缺失的API字段或调整前端期望

---

### 2. 多模态API属性缺失（~6个错误）

**受影响文件**:
- `server/routers/multimodal-api.ts`

**问题描述**:
- 数据库schema缺少`qualityScore`属性
- 查询方法链断裂（`.where`不存在）

**示例错误**:
```typescript
// Line 211, 434, 574
Property 'qualityScore' does not exist on type '{ id: number; packageId: string; ... }'

// Line 419
Property 'where' does not exist on type 'Omit<MySqlSelectBase<...>>'
```

**优先级**: 高（影响多模态包功能）

**建议修复**:
1. 在数据库schema中添加`qualityScore`字段
2. 修复Drizzle查询链

---

### 3. 路由器类型转换问题（~11个错误）

**受影响文件**:
- `server/routers.ts`

**问题描述**:
- `MySqlRawQueryResult`到`InsertResult`的不安全类型转换
- 字符串数组`.split()`调用错误
- null值赋值给非null类型

**示例错误**:
```typescript
// Line 70
Property 'split' does not exist on type 'string | string[]'

// Line 429, 588
Conversion of type 'MySqlRawQueryResult' to type 'InsertResult' may be a mistake

// Line 593
Type 'string | null' is not assignable to type 'string'
```

**优先级**: 中等

**建议修复**:
1. 添加类型守卫
2. 使用`as unknown as`进行两步转换
3. 添加null检查

---

### 4. 其他文件类型错误（~120个错误）

**受影响文件**（错误数量）:
- `server/mcp-api.ts` (13个)
- `server/ab-test-framework.ts` (6个)
- `server/middleware/go-service-proxy.ts` (5个)
- `server/llm-aws.ts` (5个)
- `server/latentmas-api.ts` (5个)
- `server/ai-auth-api.ts` (5个)
- `client/src/components/GlobalSearch.tsx` (1个)
- 其他50+文件 (~80个)

**问题描述**: 各种类型不匹配、属性缺失、方法调用错误

**优先级**: 低到中等（大部分不影响核心功能）

---

## 🧪 测试失败（34/722个）

### 安全测试失败（7个）

**文件**: `server/__tests__/security/privacy-leakage.test.ts`, `permission-verification.test.ts`

**失败测试**:
1. ✗ Differential Privacy - noise composition
2. ✗ Data Anonymization - k-anonymity
3. ✗ Side-Channel Attack - constant-time comparison
4. ✗ Side-Channel Attack - timing attack on similarity checks
5. ✗ Privacy Budget Enforcement
6. ✗ ZKP Proof Replay Attack Prevention
7. ✗ CSRF Protection

**问题描述**:
- 噪声计算不符合预期范围
- k-anonymity分组不满足最小组大小
- 时间攻击检测超过阈值
- 模拟函数未正确实现

**优先级**: 高（安全功能）

**建议修复**:
1. 审查差分隐私实现
2. 修复k-anonymity算法
3. 实现constant-time比较
4. 完善ZKP和CSRF实现

---

### 其他测试失败（27个）

**受影响范围**:
- 组件测试: 部分React组件
- API测试: 部分端点测试
- 集成测试: 工作流测试

**优先级**: 中等

---

## 📋 修复计划

### 阶段1: 关键问题修复（已完成✅）
- [x] 数据库null检查
- [x] Logger类型错误
- [x] VectorMetadata索引签名
- [x] Drizzle ORM SQL语法

### 阶段2: API和Schema对齐（进行中）
- [ ] 多模态API schema更新
- [ ] 前端API类型同步
- [ ] 路由器类型转换修复

### 阶段3: 安全测试修复
- [ ] 差分隐私算法审查
- [ ] ZKP实现完善
- [ ] 时间攻击防护

### 阶段4: 其他类型错误清理
- [ ] 批量修复logger调用
- [ ] 添加类型守卫
- [ ] 更新过时的API调用

---

## 🛠️ 临时解决方案

如果需要快速构建项目而不修复所有类型错误，可以临时调整TypeScript配置：

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": false,
    "noImplicitAny": false,
    "strictNullChecks": false
  }
}
```

⚠️ **警告**: 这会降低类型安全性，仅用于快速开发和测试。生产环境应修复所有类型错误。

---

## 📊 进度跟踪

| 日期 | TypeScript错误 | 测试失败 | 备注 |
|------|----------------|----------|------|
| 2026-01-29 (初始) | 230 | 34/722 | Phase 3完成后 |
| 2026-01-29 (第一批) | 194 | 34/722 | 修复关键数据库和logger问题 |
| 2026-01-29 (第二批) | 154 | 34/722 | 修复multimodal API、routers、mcp-api、packages-api |
| 2026-01-30 (测试修复) | 154 | 14/722 | 修复20个测试失败 (58.8%改善) |
| 2026-01-30 (logger修复) | 59 | 14/722 | 修复所有LogContext错误 (61.7%减少) |
| 2026-01-30 (类型修复) | 28 | 14/722 | 修复router、middleware、数据库类型 |

**总减少错误**: 202个 (从230到28)
**总修复率**: 87.8%
**测试通过率**: 98.1% (708/722)

---

## 🔗 相关文档

- [Phase 3完成报告](P3_COMPLETION_REPORT.md)
- [性能测试结果](docs/performance/PERFORMANCE_TEST_RESULTS.md)
- [安全测试结果](docs/security/SECURITY_TEST_RESULTS.md)
- [API文档](docs/api/P2_API_DOCUMENTATION.md)

---

## 💬 贡献指南

如果你想修复这些问题：

1. 选择一个优先级高的问题
2. 创建新分支: `git checkout -b fix/issue-name`
3. 修复问题并添加测试
4. 更新此文档
5. 提交PR

---

**最后更新**: 2026-01-29
**维护者**: Claude Sonnet 4.5 + everest-an
