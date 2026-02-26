# 🚀 pgvector + Local Embedding 部署指南

## 快速开始（5 分钟）

### 前提条件检查

```bash
# 1. Node.js 版本检查
node --version  # 需要 >= 18.0.0

# 2. PostgreSQL 版本检查
psql --version  # 需要 >= 15.0

# 3. Docker 检查（用于 Infinity Server）
docker --version  # 需要 >= 20.10
```

---

## Step 1: 配置环境变量

```bash
# 1. 复制环境配置文件
cp .env.example .env

# 2. 编辑 .env 文件
nano .env
```

**必需配置**：

```bash
# 数据库连接（替换为您的实际配置）
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/awareness_market_dev

# Infinity Embedding Server（保持默认即可）
INFINITY_EMBEDDING_URL=http://localhost:7997
```

---

## Step 2: 安装项目依赖

```bash
# 使用 legacy peer deps 解决 React 版本冲突
npm install --legacy-peer-deps
```

**预计时间**: 3-5 分钟

---

## Step 3: 数据库迁移

### 3.1 安装 pgvector 扩展

```bash
# 连接到数据库
psql postgresql://postgres:your_password@localhost:5432/awareness_market_dev

# 在 psql 中执行
CREATE EXTENSION IF NOT EXISTS vector;

# 验证安装
SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';

# 退出 psql
\q
```

**期望输出**:
```
 extname | extversion
---------+------------
 vector  | 0.7.0
```

### 3.2 运行 Package Embedding 迁移

#### 方法 A: 使用 psql 命令（推荐）

```bash
psql postgresql://postgres:your_password@localhost:5432/awareness_market_dev \
  -f prisma/migrations/11_add_package_embeddings.sql
```

#### 方法 B: 在 psql 交互式界面

```bash
# 连接数据库
psql postgresql://postgres:your_password@localhost:5432/awareness_market_dev

# 执行迁移
\i prisma/migrations/11_add_package_embeddings.sql

# 验证 embedding 列已添加
\d vector_packages

# 验证 HNSW 索引已创建
\di *embedding*

# 退出
\q
```

**期望输出**:
```
                    List of indexes
 Schema |              Name                   | Type
--------+-------------------------------------+------
 public | vector_packages_embedding_hnsw_idx  | hnsw
 public | memory_packages_embedding_hnsw_idx  | hnsw
 public | chain_packages_embedding_hnsw_idx   | hnsw
```

---

## Step 4: 部署 Infinity Embedding Server

### 4.1 快速部署（推荐）

```bash
# 运行自动化部署脚本
bash scripts/deploy-infinity-embedding.sh
```

**首次运行**会自动：
1. ✅ 拉取 Docker 镜像（~2GB）
2. ✅ 下载 nomic-embed-text-v1.5 模型（~500MB）
3. ✅ 启动服务并运行健康检查
4. ✅ 测试 embedding 生成

**预计时间**: 5-8 分钟（首次）/ 30秒（后续）

### 4.2 手动部署（备选）

```bash
# 拉取镜像
docker pull michaelf34/infinity:latest

# 启动容器
docker run -d \
  --name infinity-embedding \
  --restart unless-stopped \
  -p 7997:7997 \
  -e MODEL_ID=nomic-ai/nomic-embed-text-v1.5 \
  -e BATCH_SIZE=32 \
  -e ENGINE=torch \
  -v infinity_cache:/app/.cache \
  michaelf34/infinity:latest

# 等待模型加载（3-5 分钟）
docker logs -f infinity-embedding
```

**看到此消息表示成功**：
```
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:7997
```

### 4.3 验证服务

```bash
# 健康检查
curl http://localhost:7997/health

# 测试 embedding（应返回 512 维向量）
curl -X POST http://localhost:7997/embeddings \
  -H "Content-Type: application/json" \
  -d '{
    "model": "nomic-ai/nomic-embed-text-v1.5",
    "input": "Hello world",
    "dimensions": 512
  }' | jq '.data[0].embedding | length'
```

**期望输出**: `512`

---

## Step 5: 回填现有 Package Embeddings

⚠️ **重要**: OpenAI embeddings 与 nomic embeddings **不兼容**，必须重新生成所有 embeddings。

### 5.1 检查需要回填的数量

```sql
-- 连接数据库
psql postgresql://postgres:your_password@localhost:5432/awareness_market_dev

-- 检查现有 packages
SELECT
  'vector_packages' as type,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'active') as active
FROM vector_packages
UNION ALL
SELECT 'memory_packages', COUNT(*), COUNT(*) FILTER (WHERE status = 'active')
FROM memory_packages
UNION ALL
SELECT 'chain_packages', COUNT(*), COUNT(*) FILTER (WHERE status = 'active')
FROM chain_packages;
```

### 5.2 运行回填脚本

```bash
# 安装 p-limit 依赖（如果尚未安装）
npm install --save p-limit

# 回填所有 package 类型
npm run backfill-embeddings

# 或分别回填（推荐用于大数据集）
npm run backfill-embeddings -- --type=vector
npm run backfill-embeddings -- --type=memory
npm run backfill-embeddings -- --type=chain
```

**预计时间**:
- 10 packages: ~10 秒
- 100 packages: ~1 分钟
- 1,000 packages: ~10 分钟
- 10,000 packages: ~1.5 小时

### 5.3 监控回填进度

```bash
# 实时查看日志
# (脚本会自动显示进度)

# 在另一个终端查看数据库进度
watch -n 5 '
psql postgresql://postgres:your_password@localhost:5432/awareness_market_dev \
  -c "SELECT
    \"type\",
    total,
    with_embedding,
    ROUND(with_embedding::numeric / NULLIF(total, 0) * 100, 1) as pct
  FROM (
    SELECT \"vector\" as type,
      COUNT(*) as total,
      COUNT(embedding) as with_embedding
    FROM vector_packages
    UNION ALL
    SELECT \"memory\",
      COUNT(*) as total,
      COUNT(embedding) as with_embedding
    FROM memory_packages
    UNION ALL
    SELECT \"chain\",
      COUNT(*) as total,
      COUNT(embedding) as with_embedding
    FROM chain_packages
  ) s"
'
```

---

## Step 6: 更新 API 代码（可选 - 需要代码修改）

⚠️ **注意**: 此步骤需要修改代码，建议在开发环境测试后再部署。

### 6.1 添加 package.json scripts

```json
{
  "scripts": {
    "backfill-embeddings": "tsx scripts/backfill-embeddings.ts"
  }
}
```

### 6.2 更新 API 端点（示例）

参考 [实施计划](C:\Users\ASUS\.claude\plans\splendid-humming-widget.md) 的 Phase 4 部分。

---

## Step 7: 验证部署

### 7.1 数据库验证

```sql
-- 验证所有索引
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE indexname LIKE '%embedding%'
ORDER BY tablename;

-- 验证数据完整性
SELECT
  'vector' as type,
  COUNT(*) as total,
  COUNT(embedding) as with_embedding,
  COUNT(*) FILTER (WHERE embedding IS NULL AND status = 'active') as missing
FROM vector_packages
UNION ALL
SELECT 'memory', COUNT(*), COUNT(embedding),
  COUNT(*) FILTER (WHERE embedding IS NULL AND status = 'active')
FROM memory_packages
UNION ALL
SELECT 'chain', COUNT(*), COUNT(embedding),
  COUNT(*) FILTER (WHERE embedding IS NULL AND status = 'active')
FROM chain_packages;
```

**期望结果**:
- ✅ 3 个 HNSW 索引
- ✅ `missing` 列应为 0

### 7.2 性能基准测试

```sql
-- 生成随机查询向量（512 维）
WITH random_vec AS (
  SELECT array_agg(random()::float)::vector(512) as vec
  FROM generate_series(1, 512)
)
-- 测试搜索速度
EXPLAIN ANALYZE
SELECT * FROM search_vector_packages(
  (SELECT vec FROM random_vec),
  10,
  0.3
);
```

**期望性能**:
- ✅ 执行时间 < 50ms（对于 10k packages）
- ✅ 使用 Index Scan (HNSW)

### 7.3 Infinity Server 压力测试

```bash
# 安装 hey（HTTP 负载测试工具）
# macOS: brew install hey
# Linux: go install github.com/rakyll/hey@latest
# Windows: 下载 https://github.com/rakyll/hey/releases

# 运行负载测试（100 请求，10 并发）
hey -n 100 -c 10 \
  -m POST \
  -H "Content-Type: application/json" \
  -d '{"model":"nomic-ai/nomic-embed-text-v1.5","input":"test","dimensions":512}' \
  http://localhost:7997/embeddings
```

**期望结果**:
- ✅ 成功率 100%
- ✅ 平均响应时间 < 200ms
- ✅ 无错误

---

## 故障排除

### 问题 1: pgvector 扩展安装失败

**错误**: `ERROR: could not open extension control file`

**解决**:
```bash
# Ubuntu/Debian
sudo apt-get install postgresql-15-pgvector

# macOS (Homebrew)
brew install pgvector

# 重启 PostgreSQL
sudo systemctl restart postgresql
```

### 问题 2: Infinity Server 无法启动

**错误**: `Error response from daemon: Conflict. The container name "/infinity-embedding" is already in use`

**解决**:
```bash
# 停止并删除现有容器
docker stop infinity-embedding
docker rm infinity-embedding

# 重新运行部署脚本
bash scripts/deploy-infinity-embedding.sh
```

### 问题 3: Embedding 回填速度太慢

**症状**: 1000 packages 需要 > 30 分钟

**优化**:
```bash
# 增加批量大小和并发数
BATCH_SIZE=64 CONCURRENCY=5 npm run backfill-embeddings
```

### 问题 4: 内存不足

**错误**: `JavaScript heap out of memory`

**解决**:
```bash
# 增加 Node.js 内存限制
NODE_OPTIONS="--max-old-space-size=8192" npm run backfill-embeddings
```

---

## 监控与维护

### 日常监控命令

```bash
# 1. 检查 Infinity Server 状态
docker ps | grep infinity-embedding

# 2. 查看 Infinity 日志
docker logs -f --tail 100 infinity-embedding

# 3. 检查数据库连接
psql $DATABASE_URL -c "SELECT 1"

# 4. 检查 embedding 完整性
psql $DATABASE_URL -c "
  SELECT
    COUNT(*) FILTER (WHERE embedding IS NULL AND status = 'active') as missing_embeddings
  FROM vector_packages
"
```

### 自动化健康检查脚本

```bash
# 创建 scripts/health-check.sh
cat > scripts/health-check.sh << 'EOF'
#!/bin/bash
set -e

echo "🏥 Health Check Start"

# 1. Infinity Server
if curl -sf http://localhost:7997/health > /dev/null; then
  echo "✅ Infinity Server: OK"
else
  echo "❌ Infinity Server: DOWN"
  exit 1
fi

# 2. Database
if psql $DATABASE_URL -c "SELECT 1" > /dev/null 2>&1; then
  echo "✅ Database: OK"
else
  echo "❌ Database: DOWN"
  exit 1
fi

# 3. pgvector Extension
if psql $DATABASE_URL -c "SELECT extname FROM pg_extension WHERE extname = 'vector'" | grep -q vector; then
  echo "✅ pgvector: OK"
else
  echo "❌ pgvector: NOT INSTALLED"
  exit 1
fi

echo "🎉 All systems healthy!"
EOF

chmod +x scripts/health-check.sh

# 运行
bash scripts/health-check.sh
```

---

## 成本估算

### 基础设施成本（月度）

| 项目 | 成本 | 说明 |
|------|------|------|
| **Infinity Server (Docker)** | $0 - $20 | 本地免费 / Cloud VM $20/月 |
| **PostgreSQL + pgvector** | $0 - $50 | 本地免费 / AWS RDS $50/月 |
| **存储（embeddings）** | $1 - $5 | 100k packages × 2KB = 200MB |
| **总计** | **$1 - $75** | vs OpenAI $2,000/月 |

**成本节省**: 96% - 99%

---

## 下一步

✅ **Phase 1 完成**: pgvector + Local Embedding 已部署
📅 **Phase 2 (下周)**: 部署 Qdrant 用于 Memory Package 历史索引
📅 **Phase 3 (2 周后)**: 实现真实 W-Matrix 对齐（GPT-4 → Llama-3）

---

**需要帮助?**
- 📧 邮箱: support@awareness-market.com
- 💬 Discord: [discord.gg/awareness](https://discord.gg/awareness)
- 📖 文档: [docs.awareness-market.com](https://docs.awareness-market.com)

**最后更新**: 2026-02-26
