# Railway PostgreSQL + pgvector 设置指南

**数据库环境**: Railway PostgreSQL
**状态**: 已有数据（需要谨慎迁移）
**目标**: 安装 pgvector 扩展并添加向量列

---

## 步骤 1: 检查 pgvector 是否可用

Railway 默认支持 pgvector，但需要手动启用。

### 方法 A: 使用我们的检查脚本

```bash
# 在项目根目录运行
cd Awareness-Network
pnpm run check:pgvector
```

### 方法 B: 手动检查（通过 Railway CLI）

```bash
# 安装 Railway CLI（如果还没有）
npm install -g @railway/cli

# 登录
railway login

# 连接到数据库
railway link

# 进入 PostgreSQL shell
railway run psql $DATABASE_URL

# 在 psql 中运行
\dx  -- 查看已安装的扩展
SELECT * FROM pg_available_extensions WHERE name = 'vector';
```

**预期结果**:
- ✅ 如果看到 `vector | 0.5.1 | available`，说明扩展可用
- ❌ 如果没有结果，需要联系 Railway 支持

---

## 步骤 2: 安装 pgvector 扩展

### 方法 A: 通过 Railway Dashboard

1. 登录 Railway Dashboard: https://railway.app
2. 选择你的项目和 PostgreSQL 服务
3. 点击 "Data" 或 "Query" 标签页
4. 在 SQL 查询框中输入并执行:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

5. 验证安装:

```sql
SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';
```

### 方法 B: 通过 Railway CLI

```bash
# 从项目根目录
cd Awareness-Network

# 运行安装脚本
railway run psql $DATABASE_URL < scripts/setup-pgvector.sql
```

### 方法 C: 通过本地 psql 客户端

```bash
# 获取 Railway 数据库连接字符串
railway variables

# 复制 DATABASE_URL 并连接
psql "your-database-url-here"

# 在 psql 中执行
CREATE EXTENSION vector;
\dx  -- 验证安装
```

---

## 步骤 3: 生成数据库迁移

⚠️ **重要**: 因为数据库已有数据，我们需要生成 SQL 迁移文件并仔细审查。

```bash
cd Awareness-Network

# 生成迁移文件（不自动应用）
pnpm run db:generate
```

**预期输出**:
```
📦 Generating migrations...
✓ Generated migration: drizzle/migrations-pg/0001_add_pgvector_support.sql
```

### 审查迁移文件

打开生成的迁移文件：`drizzle/migrations-pg/0001_*.sql`

**应该包含的安全操作**:
```sql
-- 添加新列（不会影响现有数据）
ALTER TABLE "latent_vectors"
  ADD COLUMN IF NOT EXISTS "embedding_vector" vector(1536),
  ADD COLUMN IF NOT EXISTS "embedding_provider" varchar(50) DEFAULT 'openai',
  ADD COLUMN IF NOT EXISTS "embedding_dimension" integer DEFAULT 1536,
  ADD COLUMN IF NOT EXISTS "resonance_count" integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "last_resonance_at" timestamp,
  ADD COLUMN IF NOT EXISTS "is_public" boolean DEFAULT false NOT NULL;

-- 添加新表（不会影响现有数据）
CREATE TABLE IF NOT EXISTS "memory_usage_log" (
  ...
);

-- 创建索引（可能需要较长时间，但不会破坏数据）
CREATE INDEX IF NOT EXISTS "embedding_vector_idx"
  ON "latent_vectors" USING ivfflat (embedding_vector vector_cosine_ops)
  WITH (lists = 100);
```

**⚠️ 需要避免的危险操作**:
```sql
-- ❌ 不要有这些命令！
DROP TABLE ...
DROP COLUMN ...
TRUNCATE ...
DELETE FROM ...
```

如果迁移文件看起来安全，继续下一步。

---

## 步骤 4: 备份现有数据（强烈建议）

### 方法 A: Railway 自动备份

Railway 每天自动备份，但手动创建一个快照更安全：

1. 进入 Railway Dashboard
2. 选择 PostgreSQL 服务
3. 点击 "Backups" 标签页
4. 点击 "Create Manual Backup"

### 方法 B: 手动导出

```bash
# 导出整个数据库
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# 仅导出 schema（不包含数据）
pg_dump $DATABASE_URL --schema-only > schema_backup.sql

# 仅导出数据（不包含 schema）
pg_dump $DATABASE_URL --data-only > data_backup.sql
```

---

## 步骤 5: 应用迁移（谨慎！）

### 推荐方式: 分步执行

不要直接运行 `pnpm run db:push`，而是手动逐步执行：

#### 5.1 测试连接

```bash
cd Awareness-Network
psql "$DATABASE_URL" -c "SELECT version();"
```

#### 5.2 添加新列（先不创建索引）

```bash
railway run psql $DATABASE_URL << 'EOF'
-- 逐个添加列
ALTER TABLE latent_vectors ADD COLUMN IF NOT EXISTS embedding_vector vector(1536);
ALTER TABLE latent_vectors ADD COLUMN IF NOT EXISTS embedding_provider varchar(50) DEFAULT 'openai';
ALTER TABLE latent_vectors ADD COLUMN IF NOT EXISTS embedding_dimension integer DEFAULT 1536;
ALTER TABLE latent_vectors ADD COLUMN IF NOT EXISTS resonance_count integer DEFAULT 0 NOT NULL;
ALTER TABLE latent_vectors ADD COLUMN IF NOT EXISTS last_resonance_at timestamp;
ALTER TABLE latent_vectors ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT false NOT NULL;

-- 验证
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'latent_vectors' AND column_name LIKE '%embedding%';
EOF
```

#### 5.3 添加 users 表的新列

```bash
railway run psql $DATABASE_URL << 'EOF'
ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_address varchar(42) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_memories integer DEFAULT 0 NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_resonances integer DEFAULT 0 NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS credits_balance numeric(12, 4) DEFAULT 1000.0000 NOT NULL;

SELECT column_name FROM information_schema.columns
WHERE table_name = 'users' AND column_name LIKE '%wallet%';
EOF
```

#### 5.4 创建新表

```bash
railway run psql $DATABASE_URL << 'EOF'
CREATE TABLE IF NOT EXISTS memory_usage_log (
  id serial PRIMARY KEY,
  consumer_id integer NOT NULL,
  provider_id integer NOT NULL,
  memory_id integer NOT NULL,
  similarity numeric(5, 4),
  cost numeric(10, 4) DEFAULT 0.0000,
  context_query text,
  was_helpful boolean,
  created_at timestamp DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS memory_usage_consumer_idx ON memory_usage_log(consumer_id);
CREATE INDEX IF NOT EXISTS memory_usage_provider_idx ON memory_usage_log(provider_id);
CREATE INDEX IF NOT EXISTS memory_usage_memory_idx ON memory_usage_log(memory_id);
CREATE INDEX IF NOT EXISTS memory_usage_created_at_idx ON memory_usage_log(created_at);

\dt memory_usage_log
EOF
```

#### 5.5 创建 IVFFlat 索引（最耗时）

⚠️ **注意**: 此步骤可能需要 5-30 分钟（取决于现有数据量）

```bash
railway run psql $DATABASE_URL << 'EOF'
-- 检查是否有数据
SELECT COUNT(*) FROM latent_vectors WHERE embedding_vector IS NOT NULL;

-- 如果有数据，创建索引（可能很慢）
-- 如果没有数据，索引创建会很快但可能在插入数据时重建
CREATE INDEX CONCURRENTLY IF NOT EXISTS embedding_vector_idx
  ON latent_vectors USING ivfflat (embedding_vector vector_cosine_ops)
  WITH (lists = 100);

-- 验证索引
\d latent_vectors
EOF
```

**提示**: `CONCURRENTLY` 关键字允许在创建索引时继续访问表，但速度更慢。

---

## 步骤 6: 验证迁移成功

```bash
cd Awareness-Network
pnpm run check:pgvector
```

**预期输出**:
```
🔍 Checking pgvector extension...

✅ pgvector extension is available
   Available version: 0.5.1

✅ pgvector extension is installed
   Installed version: 0.5.1

✅ Vector operations working correctly
   Test distance calculation: 5.196152422706632

📊 Existing vector columns:
   - latent_vectors.embedding_vector

🎉 pgvector is ready for use!
```

---

## 步骤 7: 回滚方案（如果出错）

### 选项 A: 从 Railway 备份恢复

1. Railway Dashboard → PostgreSQL → Backups
2. 选择迁移前的备份
3. 点击 "Restore"

### 选项 B: 手动删除新增内容

```sql
-- 删除新表
DROP TABLE IF EXISTS memory_usage_log;

-- 删除新列
ALTER TABLE latent_vectors
  DROP COLUMN IF EXISTS embedding_vector,
  DROP COLUMN IF EXISTS embedding_provider,
  DROP COLUMN IF EXISTS embedding_dimension,
  DROP COLUMN IF EXISTS resonance_count,
  DROP COLUMN IF EXISTS last_resonance_at,
  DROP COLUMN IF EXISTS is_public;

ALTER TABLE users
  DROP COLUMN IF EXISTS wallet_address,
  DROP COLUMN IF EXISTS total_memories,
  DROP COLUMN IF EXISTS total_resonances,
  DROP COLUMN IF EXISTS credits_balance;
```

---

## 常见问题

### Q1: 迁移会删除现有数据吗？

**A**: 不会！我们只添加新列和新表，不会修改或删除现有数据。但为了安全，请务必备份。

### Q2: IVFFlat 索引创建很慢，正常吗？

**A**: 是的。如果表中已有大量数据（>10,000 行），索引创建可能需要 10-30 分钟。使用 `CONCURRENTLY` 选项可以避免锁表。

### Q3: Railway 的 pgvector 版本够新吗？

**A**: Railway 通常提供 pgvector 0.5.x，支持所有我们需要的功能（cosine distance, IVFFlat index）。

### Q4: 能否先在测试环境迁移？

**A**: 强烈建议！步骤：
1. 在 Railway 创建新的 PostgreSQL 服务（测试用）
2. 导入生产数据库的备份
3. 在测试数据库上执行迁移
4. 验证一切正常后，再在生产环境操作

---

## 下一步

迁移完成后：

1. ✅ 启动开发服务器测试：
   ```bash
   pnpm run dev
   ```

2. ✅ 测试 Python SDK 连接：
   ```bash
   cd python-sdk
   python -c "from awareness import PhantomWallet; w = PhantomWallet('test'); print(w.address)"
   ```

3. ✅ 准备种子数据（可选）：
   ```bash
   cd Awareness-Network
   npx tsx scripts/seed-three-product-lines.ts
   ```

---

## 技术支持

**遇到问题？**

1. 查看日志：`railway logs`
2. 检查 Railway 服务状态：https://railway.app/status
3. Railway 社区：https://discord.gg/railway
4. 项目 Issues: https://github.com/everest-an/Awareness-Market/issues

---

**文档维护者**: Claude Sonnet 4.5
**最后更新**: 2026-02-01
**Railway PostgreSQL 版本**: 15+
**pgvector 版本**: 0.5.1+
