# 🚀 RMC Quick Start Guide

**5 分钟快速上手 Relational Memory Core**

---

## ⚡ 快速启动（3 步）

### 步骤 1: 运行数据库迁移

```bash
cd "e:\Awareness Market\Awareness-Network"

# 生成并应用迁移
npx prisma migrate dev --name add-rmc-support

# 或者如果使用 AWS RDS/Docker PostgreSQL
pnpm run memory:migrate
```

**期望输出**:
```
✔ Generated Prisma Client
✔ Your database is now in sync with your schema.
```

### 步骤 2: 测试 RMC 功能

```bash
# 测试实体提取
pnpm run rmc:test:entity

# 测试关系构建（需要数据库连接）
pnpm run rmc:test:relation

# 测试混合检索
pnpm run rmc:test:retrieval

# 或者运行全部测试
pnpm run rmc:test:all
```

**期望输出**:
```
🧪 Testing RMC Entity Extraction...
  Test 1: Technical Decision
    Entities: [ { name: 'PostgreSQL', type: 'TECHNOLOGY', ... } ]
  ✅ Entity Extraction Tests Complete!

🧪 Testing RMC Relation Building...
  ✅ Created Memory 1: abc12345
  ✅ Created Memory 2: def67890
  ✅ Created 2 relations
  ✅ Relation Building Tests Complete!
```

### 步骤 3: 在代码中使用

```typescript
import { createRMCRetriever } from '@/server/memory-core';

const retriever = createRMCRetriever(prisma);

const result = await retriever.retrieve("Why did the server crash?", {
  maxDepth: 2,
  relationTypes: ['CAUSES', 'IMPACTS'],
  includeInferencePaths: true,
});

console.log('Direct Matches:', result.directMatches.length);
console.log('Inference Paths:', result.inferencePaths.length);
console.log('Summary:', result.summary);
```

---

## 📝 核心概念速览

### 1. Entity Extraction（实体提取）

从文本中提取结构化信息：

```typescript
const extractor = createEntityExtractor();
const result = await extractor.extract("PostgreSQL is our primary database");

// 结果：
// entities: [{ name: 'PostgreSQL', type: 'TECHNOLOGY', confidence: 0.95 }]
// concepts: ['database']
// topics: ['technology']
```

### 2. Relation Building（关系构建）

自动发现记忆之间的关系：

```typescript
const builder = createRelationBuilder(prisma);
await builder.buildRelations(memoryId);

// 自动创建关系:
// Memory A --CAUSES--> Memory B
// Memory C --CONTRADICTS--> Memory D
// Memory E --SUPPORTS--> Memory F
```

**关系类型**:
- `CAUSES` - A 导致 B
- `CONTRADICTS` - A 与 B 矛盾
- `SUPPORTS` - A 支持 B
- `IMPACTS` - A 影响 B
- `TEMPORAL_BEFORE` / `TEMPORAL_AFTER` - 时间顺序

### 3. Hybrid Retrieval（混合检索）

向量检索 + 图谱游走 + 推理路径：

```typescript
const retriever = createRMCRetriever(prisma);
const result = await retriever.retrieve("search query", {
  maxDepth: 2,  // 图谱游走深度 (1-5)
  relationTypes: ['CAUSES', 'SUPPORTS'],  // 关注的关系类型
  includeInferencePaths: true,  // 是否计算推理路径
});
```

**返回内容**:
- `directMatches` - 向量检索的直接匹配（Top-5）
- `relatedContext` - 图谱扩展的相关上下文
- `inferencePaths` - 推理路径（因果链、矛盾、支持链）
- `summary` - 检索结果总结

---

## 🎯 常见使用场景

### 场景 1: 技术决策支持

```typescript
// 3 个 AI Agent 各自创建记忆
await memoryRouter.create({
  content: "PostgreSQL for ACID guarantees",
  claim_key: "database",
  claim_value: "PostgreSQL",
  created_by: "agent-backend",
});

await memoryRouter.create({
  content: "MongoDB for document workloads",
  claim_key: "database",
  claim_value: "MongoDB",
  created_by: "agent-data",
});

// 决策 AI 查询
const result = await retriever.retrieve("Which database to use?");

// 得到矛盾路径，辅助决策
// inferencePaths: [{ type: 'contradiction_resolution', ... }]
```

### 场景 2: 根因分析

```typescript
// 创建因果链
// m1: "Algorithm deployed" → m2: "Queries slow" → m3: "CPU 100%" → m4: "Crash"

const result = await retriever.retrieve("Why server crash?", {
  maxDepth: 3,
  relationTypes: ['CAUSES', 'IMPACTS'],
});

// 得到完整因果链
// [Algorithm] --CAUSES--> [Slow Query] --CAUSES--> [CPU] --IMPACTS--> [Crash]
```

### 场景 3: 知识发现

```typescript
// 查找所有与"数据库"相关的记忆及其关系
const result = await retriever.retrieve("database", {
  maxDepth: 2,
  includeInferencePaths: false,  // 只要图谱扩展，不计算推理路径
});

// relatedContext 包含所有通过关系连接的记忆
```

---

## 🔧 配置选项

### EntityExtractor 配置

```typescript
createEntityExtractor({
  enableLLM: true,              // 使用 LLM 还是规则引擎
  openaiApiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4o-mini',         // LLM 模型
})
```

### RelationBuilder 配置

```typescript
createRelationBuilder(prisma, {
  enableLLM: true,              // 使用 LLM 推理关系
  candidateLimit: 20,           // 每次检查的候选记忆数
  minEntityOverlap: 1,          // 最少共享实体数
  minVectorSimilarity: 0.7,     // 向量相似度阈值
  maxCandidateAge: 30,          // 只检查 N 天内的记忆
})
```

### RMCRetriever 选项

```typescript
retriever.retrieve(query, {
  maxDepth: 2,                  // 图谱游走深度 (推荐 1-3)
  relationTypes: ['CAUSES'],    // 关注的关系类型（可选）
  agentFilter: ['agent-a'],     // 只检索特定 AI 的记忆
  includeInferencePaths: true,  // 是否计算推理路径
  minConfidence: 0.5,           // 最小置信度阈值
})
```

---

## 📊 数据库查询示例

### 查看记忆的实体

```sql
SELECT id, content, entities
FROM memory_entries
WHERE entities IS NOT NULL
LIMIT 5;
```

### 查看所有关系

```sql
SELECT
  r.relation_type,
  COUNT(*) as count,
  AVG(r.strength) as avg_strength
FROM memory_relations r
GROUP BY r.relation_type
ORDER BY count DESC;
```

### 查看特定记忆的关系图

```sql
SELECT
  r.relation_type,
  r.strength,
  m1.content as source_content,
  m2.content as target_content
FROM memory_relations r
JOIN memory_entries m1 ON r.source_memory_id = m1.id
JOIN memory_entries m2 ON r.target_memory_id = m2.id
WHERE r.source_memory_id = 'your-memory-id'
ORDER BY r.strength DESC;
```

---

## ⚠️ 故障排查

### Q: 迁移失败 - "relation already exists"
```bash
# 重置迁移状态
npx prisma migrate reset

# 重新应用
npx prisma migrate dev
```

### Q: 实体提取返回空数组
```bash
# 检查是否使用规则引擎模式
const extractor = createEntityExtractor({ enableLLM: false });

# 或检查 OpenAI API Key
echo $OPENAI_API_KEY
```

### Q: 关系构建失败 - "Cannot find module"
```bash
# 确保导出正确
cat server/memory-core/index.ts | grep RelationBuilder

# 重新生成 Prisma Client
npx prisma generate
```

### Q: 检索结果为空
```bash
# 检查数据库中是否有记忆
SELECT COUNT(*) FROM memory_entries WHERE is_latest = true;

# 检查是否有关系
SELECT COUNT(*) FROM memory_relations;

# 降低置信度阈值
const result = await retriever.retrieve(query, { minConfidence: 0.3 });
```

---

## 📚 相关文档

- **完整架构**: [RMC_ARCHITECTURE.md](./RMC_ARCHITECTURE.md)
- **集成指南**: [RMC_INTEGRATION_GUIDE.md](./RMC_INTEGRATION_GUIDE.md)
- **完整总结**: [RMC_COMPLETE_SUMMARY.md](./RMC_COMPLETE_SUMMARY.md)

---

## 🎉 下一步

1. ✅ 运行迁移 - `npx prisma migrate dev`
2. ✅ 运行测试 - `pnpm run rmc:test:all`
3. 集成到 MemoryRouter - 参考 [RMC_INTEGRATION_GUIDE.md](./RMC_INTEGRATION_GUIDE.md) 步骤 2
4. 添加 tRPC 端点 - 参考集成指南步骤 3
5. 创建前端可视化 - 参考集成指南步骤 4

---

**5 分钟内就能让 RMC 运行起来！** 🚀

有问题请查看 [RMC_INTEGRATION_GUIDE.md](./RMC_INTEGRATION_GUIDE.md) 的故障排查部分。
