# ✅ RMC 部署清单

**当前状态**: 代码集成完成，等待数据库启动

---

## 📋 完成状态

### ✅ 已完成（代码层面）

- [x] **核心模块实现**
  - [x] EntityExtractor (entity-extractor.ts)
  - [x] RelationBuilder (relation-builder.ts)
  - [x] RMCRetriever (rmc-retriever.ts)

- [x] **Router 集成**
  - [x] MemoryRouter 添加异步 RMC 处理 (router.ts)
  - [x] 优化版 MemoryRouterOptimized (router-optimized.ts)
  - [x] RMC Worker (rmc-worker.ts)

- [x] **tRPC API 端点**
  - [x] `hybridRetrieve` - 混合检索
  - [x] `getMemoryGraph` - 获取关系图谱
  - [x] `rebuildRelations` - 手动触发关系构建
  - [x] `searchEntities` - 搜索实体
  - [x] `getHotEntities` - 获取热门实体

- [x] **前端组件**
  - [x] MemoryGraphViewer.tsx - D3.js 可视化
  - [x] MemoryScoreBreakdown.tsx (Phase 2)
  - [x] VersionHistoryViewer.tsx (Phase 2)
  - [x] ConflictResolution.tsx (Phase 2)
  - [x] MemoryManagement.tsx (Phase 2)

- [x] **Prisma Schema 更新**
  - [x] EntityTag 表 (支持反向查询)
  - [x] MemoryRelation 表 (关系图谱)
  - [x] latentState 字段 (Neural Bridge 集成)
  - [x] NFT 元数据 (isNFTized, nftTokenId, latentValueUSD)

- [x] **优化脚本**
  - [x] create-rmc-indexes.sql (10 个优化索引)

- [x] **测试脚本**
  - [x] test-rmc-entity-extraction.ts
  - [x] test-rmc-relation-building.ts
  - [x] test-rmc-retrieval.ts

- [x] **文档**
  - [x] RMC_ARCHITECTURE.md
  - [x] RMC_INTEGRATION_GUIDE.md
  - [x] RMC_COMPLETE_SUMMARY.md
  - [x] RMC_QUICK_START.md
  - [x] RMC_PRODUCTION_OPTIMIZATION.md
  - [x] RMC_FINAL_SUMMARY.md

---

## ⏳ 待执行（部署层面）

### 步骤 1: 启动数据库

**当前状态**: ❌ AWS RDS 未启动

```bash
# 检查数据库连接
pnpm run memory:check

# 如果 AWS RDS 停止，需要从 AWS Console 启动
# 或使用本地 Docker PostgreSQL:
docker run -d \
  --name awareness-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=awareness_market \
  -p 5432:5432 \
  ankane/pgvector
```

### 步骤 2: 运行数据库迁移

**依赖**: 数据库已启动

```bash
cd "e:\Awareness Market\Awareness-Network"

# 生成并应用迁移
npx prisma migrate dev --name add-rmc-support

# 或使用生产环境迁移
npx prisma migrate deploy
```

**预期结果**:
```
✔ Generated Prisma Client
✔ Applied migration 20XX_add_rmc_support
✔ Your database is now in sync with your schema.
```

### 步骤 3: 创建优化索引

**依赖**: 迁移已完成

```bash
# 方式 1: 使用 npm 脚本
pnpm run rmc:optimize:indexes

# 方式 2: 手动执行
psql $DATABASE_URL -f scripts/create-rmc-indexes.sql
```

**预期结果**:
- 10 个索引成功创建
- 执行时间: 5-30 分钟（取决于数据量）

### 步骤 4: 安装前端依赖

**依赖**: 无

```bash
# 安装 D3.js (用于图谱可视化)
pnpm add d3 @types/d3

# 安装 BullMQ (用于异步队列，可选)
pnpm add bullmq ioredis
```

### 步骤 5: 部署 Redis（可选，用于异步队列）

**依赖**: 无（可选）

```bash
# Docker 方式
docker run -d \
  --name rmc-redis \
  -p 6379:6379 \
  --restart unless-stopped \
  redis:alpine

# 验证
docker ps | grep rmc-redis
```

### 步骤 6: 启动 RMC Worker（可选）

**依赖**: Redis 已启动

```bash
# 开发环境
pnpm run rmc:worker

# 生产环境（使用 PM2）
pnpm run rmc:worker:prod

# 检查状态
pm2 list
pm2 logs rmc-worker
```

### 步骤 7: 测试 RMC 功能

**依赖**: 数据库已启动，迁移已完成

```bash
# 测试实体提取（不需要数据库）
pnpm run rmc:test:entity

# 测试关系构建（需要数据库）
pnpm run rmc:test:relation

# 测试混合检索
pnpm run rmc:test:retrieval

# 运行所有测试
pnpm run rmc:test:all
```

**预期结果**:
```
✅ Entity Extraction Tests Complete!
✅ Relation Building Tests Complete!
✅ RMC Retrieval Tests Complete!
```

### 步骤 8: 启动开发服务器

**依赖**: 所有前面步骤已完成

```bash
pnpm run dev
```

### 步骤 9: 前端测试

**依赖**: 开发服务器已启动

1. 访问 `http://localhost:5173/memory-management`
2. 搜索记忆
3. 点击 "Graph" 按钮查看关系图谱
4. 测试 RMC 混合检索功能

---

## 🔧 配置文件

### .env 配置

```bash
# 数据库
DATABASE_URL="postgresql://..."

# Redis (可选)
REDIS_HOST=localhost
REDIS_PORT=6379

# RMC 配置
RMC_ENABLE_LLM=false  # 开发环境使用规则引擎
RMC_WORKER_CONCURRENCY=5

# OpenAI API (用于 LLM 模式)
OPENAI_API_KEY=sk-xxx
OPENAI_MODEL_ENTITY=gpt-4o-mini
OPENAI_MODEL_RELATION=gpt-4o-mini
```

---

## 🧪 快速测试脚本

创建 `scripts/test-rmc-quick.ts`:

```typescript
import { PrismaClient } from '@prisma/client';
import { createEntityExtractor, createRelationBuilder, createRMCRetriever } from '../server/memory-core';

const prisma = new PrismaClient();

async function quickTest() {
  console.log('🧪 Quick RMC Test\n');

  // 1. Test entity extraction
  console.log('1. Testing EntityExtractor...');
  const extractor = createEntityExtractor({ enableLLM: false });
  const result = await extractor.extract('PostgreSQL is our primary database');
  console.log('  ✅ Extracted entities:', result.entities.length);

  // 2. Test database connection
  console.log('\n2. Testing database connection...');
  const count = await prisma.memoryEntry.count();
  console.log('  ✅ Database connected. Total memories:', count);

  // 3. Test relation builder (if memories exist)
  if (count > 0) {
    console.log('\n3. Testing RelationBuilder...');
    const builder = createRelationBuilder(prisma, { enableLLM: false });
    const memories = await prisma.memoryEntry.findMany({ take: 1 });
    const relCount = await builder.buildRelations(memories[0].id);
    console.log('  ✅ Created relations:', relCount);
  }

  // 4. Test retriever
  console.log('\n4. Testing RMCRetriever...');
  const retriever = createRMCRetriever(prisma);
  const searchResult = await retriever.retrieve('database', { maxDepth: 1 });
  console.log('  ✅ Retrieved memories:', searchResult.directMatches.length);

  console.log('\n✅ All tests passed!');
  await prisma.$disconnect();
}

quickTest().catch(console.error);
```

运行:
```bash
tsx scripts/test-rmc-quick.ts
```

---

## 📊 验证清单

运行以下命令验证部署：

### 数据库层面

```sql
-- 1. 检查表是否存在
SELECT COUNT(*) FROM pg_tables
WHERE tablename IN ('memory_relations', 'entity_tags');
-- 期望: 2

-- 2. 检查索引
SELECT indexname FROM pg_indexes
WHERE tablename = 'memory_relations';
-- 期望: 至少 5 个索引

-- 3. 检查记忆数量
SELECT COUNT(*) FROM memory_entries WHERE is_latest = true;

-- 4. 检查关系数量
SELECT COUNT(*) FROM memory_relations;

-- 5. 检查实体数量
SELECT COUNT(*) FROM entity_tags;
```

### API 层面

```bash
# 测试 tRPC 端点（需要开发服务器运行）
curl http://localhost:5000/trpc/memory.getHotEntities

# 期望返回: JSON 响应
```

### 前端层面

1. ✅ 打开 `http://localhost:5173/memory-management`
2. ✅ 可以看到 Memory Management 页面
3. ✅ 搜索功能正常
4. ✅ Graph 按钮可以打开可视化
5. ✅ D3.js 图谱渲染正常

---

## 🚨 常见问题

### Q1: 数据库连接失败

**症状**:
```
Error: P1001: Can't reach database server
```

**解决**:
1. 检查 AWS RDS 是否启动
2. 检查 DATABASE_URL 是否正确
3. 检查网络连接和安全组规则

### Q2: 迁移失败 - 表已存在

**症状**:
```
Error: Relation "entity_tags" already exists
```

**解决**:
```bash
# 重置迁移状态
npx prisma migrate reset

# 重新应用
npx prisma migrate dev
```

### Q3: D3.js 类型错误

**症状**:
```
Cannot find module 'd3'
```

**解决**:
```bash
pnpm add d3 @types/d3
```

### Q4: Worker 无法连接 Redis

**症状**:
```
Error: connect ECONNREFUSED localhost:6379
```

**解决**:
```bash
# 启动 Redis
docker start rmc-redis

# 或重新创建
docker run -d -p 6379:6379 redis:alpine
```

---

## 📈 性能验证

运行以下查询验证索引效果：

```sql
-- 1. 检查查询计划（应该使用 Index Scan）
EXPLAIN ANALYZE
SELECT * FROM memory_relations
WHERE relation_type = 'CAUSES' AND strength > 0.7
ORDER BY strength DESC
LIMIT 10;

-- 期望输出:
-- Index Scan using idx_memory_relations_type_strength
-- Execution Time: < 10ms

-- 2. 检查实体查询性能
EXPLAIN ANALYZE
SELECT * FROM entity_tags
WHERE normalized_name = 'elon_musk' AND type = 'PERSON';

-- 期望输出:
-- Index Scan using entity_tags_normalized_name_type_key
-- Execution Time: < 5ms
```

---

## 🎉 部署完成确认

所有以下项均✅后，RMC 部署完成：

- [ ] 数据库已启动
- [ ] 迁移已成功应用
- [ ] 索引已创建
- [ ] D3.js 依赖已安装
- [ ] 测试脚本全部通过
- [ ] 开发服务器可以启动
- [ ] 前端可视化正常渲染
- [ ] API 端点响应正常

---

**下一步**: 启动 AWS RDS 或本地 PostgreSQL，然后按清单逐步执行！
