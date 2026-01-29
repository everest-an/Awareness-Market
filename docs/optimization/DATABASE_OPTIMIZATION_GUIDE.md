# 数据库查询优化指南

## 概述

数据库查询优化可以将查询速度提升**2-10倍**，显著改善应用响应速度。

### 性能提升目标

| 查询类型 | 优化前 | 优化后 | 加速比 |
|---------|--------|--------|--------|
| 包列表查询 | 100ms | 30ms | **3.3x** |
| 用户的包 | 200ms | 20ms | **10x** |
| 包搜索 | 150ms | 30ms | **5x** |
| 购买验证 | 50ms | 5ms | **10x** |
| 评论加载 | 80ms | 25ms | **3.2x** |

---

## 快速开始

### 1. 运行优化脚本

```bash
# MySQL
mysql -u username -p database_name < scripts/optimize-database.sql

# PostgreSQL
psql -U username -d database_name -f scripts/optimize-database.sql

# 或通过数据库管理工具执行
```

### 2. 验证索引已创建

#### MySQL

```sql
-- 查看packages表的索引
SHOW INDEX FROM packages;

-- 查看所有表的索引统计
SELECT
  TABLE_NAME,
  INDEX_NAME,
  SEQ_IN_INDEX,
  COLUMN_NAME
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = 'your_database'
ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX;
```

#### PostgreSQL

```sql
-- 查看所有索引
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- 查看索引大小
SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
ORDER BY pg_relation_size(indexrelid) DESC;
```

### 3. 测试查询性能

```sql
-- MySQL: 查看查询执行计划
EXPLAIN SELECT * FROM packages WHERE published = true ORDER BY created_at DESC LIMIT 20;

-- PostgreSQL: 查看详细执行计划
EXPLAIN ANALYZE SELECT * FROM packages WHERE published = true ORDER BY created_at DESC LIMIT 20;
```

**好的执行计划应该显示**:
- `type: ref` 或 `type: range` (使用索引)
- 不应该有 `type: ALL` (全表扫描)
- `Extra: Using index` (只使用索引)

---

## 索引策略

### 1. 单列索引

**何时使用**: WHERE子句中频繁查询单个列

```sql
-- 创建
CREATE INDEX idx_packages_author ON packages(author_id);

-- 使用
SELECT * FROM packages WHERE author_id = 'user123';
```

### 2. 复合索引

**何时使用**: WHERE子句中同时查询多个列

```sql
-- 创建 (列顺序很重要!)
CREATE INDEX idx_packages_published_created
ON packages(published, created_at DESC);

-- 高效使用复合索引
SELECT * FROM packages
WHERE published = true
ORDER BY created_at DESC;

-- 部分使用复合索引 (只用第一列)
SELECT * FROM packages
WHERE published = true;

-- ❌ 不使用复合索引 (缺少第一列)
SELECT * FROM packages
ORDER BY created_at DESC;
```

**复合索引最佳实践**:
1. **选择性高的列放前面** (如user_id)
2. **查询频率高的列放前面**
3. **排序列放后面**

### 3. 唯一索引

**何时使用**: 需要保证唯一性的列

```sql
-- 创建
CREATE UNIQUE INDEX idx_users_email ON users(email);

-- 自动防止重复
INSERT INTO users (email) VALUES ('test@example.com'); -- OK
INSERT INTO users (email) VALUES ('test@example.com'); -- 错误: Duplicate entry
```

### 4. 全文索引

**何时使用**: 需要搜索文本内容

#### MySQL

```sql
-- 创建全文索引
CREATE FULLTEXT INDEX idx_packages_fulltext
ON packages(name, description);

-- 使用全文搜索
SELECT *, MATCH(name, description) AGAINST('machine learning' IN NATURAL LANGUAGE MODE) AS score
FROM packages
WHERE MATCH(name, description) AGAINST('machine learning' IN NATURAL LANGUAGE MODE)
ORDER BY score DESC;
```

#### PostgreSQL

```sql
-- 创建tsvector列
ALTER TABLE packages ADD COLUMN search_vector tsvector;

-- 更新tsvector
UPDATE packages
SET search_vector = to_tsvector('english', name || ' ' || description);

-- 创建GIN索引
CREATE INDEX idx_packages_search ON packages USING gin(search_vector);

-- 使用全文搜索
SELECT *
FROM packages
WHERE search_vector @@ to_tsquery('english', 'machine & learning')
ORDER BY ts_rank(search_vector, to_tsquery('english', 'machine & learning')) DESC;
```

---

## 查询优化技巧

### 1. 避免SELECT *

```sql
-- ❌ 不好: 查询所有列
SELECT * FROM packages WHERE id = '123';

-- ✅ 好: 只查询需要的列
SELECT id, name, price, downloads FROM packages WHERE id = '123';
```

**性能提升**: 30-50%（减少网络传输和内存使用）

### 2. 使用LIMIT分页

```sql
-- ❌ 不好: 加载所有数据
SELECT * FROM packages ORDER BY created_at DESC;

-- ✅ 好: 分页加载
SELECT * FROM packages ORDER BY created_at DESC LIMIT 20 OFFSET 0;

-- 更好: 使用WHERE代替OFFSET (Keyset Pagination)
SELECT * FROM packages
WHERE created_at < '2026-01-01'
ORDER BY created_at DESC
LIMIT 20;
```

### 3. 使用EXISTS代替IN

```sql
-- ❌ 较慢: 使用IN
SELECT * FROM packages
WHERE author_id IN (SELECT id FROM users WHERE verified = true);

-- ✅ 更快: 使用EXISTS
SELECT * FROM packages p
WHERE EXISTS (
  SELECT 1 FROM users u
  WHERE u.id = p.author_id AND u.verified = true
);

-- 最快: 使用JOIN
SELECT p.* FROM packages p
INNER JOIN users u ON p.author_id = u.id
WHERE u.verified = true;
```

### 4. 避免在WHERE中使用函数

```sql
-- ❌ 不好: 索引失效
SELECT * FROM packages WHERE YEAR(created_at) = 2026;

-- ✅ 好: 使用范围查询
SELECT * FROM packages
WHERE created_at >= '2026-01-01' AND created_at < '2027-01-01';
```

### 5. 使用覆盖索引

```sql
-- 创建覆盖索引 (包含所有需要的列)
CREATE INDEX idx_packages_covering
ON packages(published, id, name, price);

-- 查询只使用索引，无需回表
SELECT id, name, price FROM packages WHERE published = true;
```

### 6. 批量操作

```typescript
// ❌ 不好: 逐条插入
for (const pkg of packages) {
  await db.insert(packages).values(pkg);
}

// ✅ 好: 批量插入
await db.insert(packages).values(packages); // 10-50x faster
```

---

## Drizzle ORM优化

### 1. 只选择需要的列

```typescript
// ❌ 不好
const packages = await db.select().from(packages);

// ✅ 好
const packages = await db.select({
  id: packages.id,
  name: packages.name,
  price: packages.price,
}).from(packages);
```

### 2. 使用WHERE条件

```typescript
// ✅ 使用索引
const userPackages = await db.select()
  .from(packages)
  .where(eq(packages.author_id, userId)); // 使用idx_packages_author索引
```

### 3. 分页查询

```typescript
// ✅ 分页
const page = 1;
const limit = 20;

const packages = await db.select()
  .from(packages)
  .where(eq(packages.published, true))
  .orderBy(desc(packages.created_at))
  .limit(limit)
  .offset((page - 1) * limit);
```

### 4. JOIN优化

```typescript
// ✅ 高效JOIN
const packagesWithAuthors = await db.select({
  package: packages,
  author: users,
})
  .from(packages)
  .innerJoin(users, eq(packages.author_id, users.id))
  .where(eq(packages.published, true));
```

### 5. 使用事务

```typescript
// ✅ 事务批量操作
await db.transaction(async (tx) => {
  await tx.insert(packages).values(newPackage);
  await tx.update(users)
    .set({ package_count: sql`package_count + 1` })
    .where(eq(users.id, userId));
});
```

---

## 性能监控

### 1. 慢查询日志

#### MySQL

```ini
# /etc/mysql/my.cnf
[mysqld]
slow_query_log = 1
slow_query_log_file = /var/log/mysql/slow-query.log
long_query_time = 1  # 超过1秒的查询
log_queries_not_using_indexes = 1
```

查看慢查询:
```bash
# 分析慢查询日志
mysqldumpslow /var/log/mysql/slow-query.log

# 实时监控慢查询
tail -f /var/log/mysql/slow-query.log
```

#### PostgreSQL

```ini
# postgresql.conf
log_min_duration_statement = 1000  # 1000ms = 1秒
```

### 2. 查询分析

```typescript
// 在应用中记录慢查询
const start = Date.now();
const result = await db.select().from(packages);
const duration = Date.now() - start;

if (duration > 100) {
  console.warn(`Slow query detected: ${duration}ms`);
  // 发送到监控系统
}
```

### 3. 索引使用率监控

#### MySQL

```sql
-- 查看未使用的索引
SELECT
  object_schema,
  object_name,
  index_name
FROM performance_schema.table_io_waits_summary_by_index_usage
WHERE index_name IS NOT NULL
AND count_star = 0
AND object_schema != 'mysql';
```

#### PostgreSQL

```sql
-- 查看索引使用统计
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan AS index_scans,
  idx_tup_read AS tuples_read,
  idx_tup_fetch AS tuples_fetched
FROM pg_stat_user_indexes
ORDER BY idx_scan;
```

---

## 数据库配置优化

### MySQL配置 (/etc/mysql/my.cnf)

```ini
[mysqld]
# 内存配置
innodb_buffer_pool_size = 2G      # 总内存的60-70%
innodb_log_file_size = 512M
innodb_flush_log_at_trx_commit = 2

# 连接配置
max_connections = 200
max_connect_errors = 100

# 查询缓存 (MySQL 5.7)
query_cache_type = 1
query_cache_size = 64M

# InnoDB配置
innodb_file_per_table = 1
innodb_flush_method = O_DIRECT
```

### PostgreSQL配置 (postgresql.conf)

```ini
# 内存配置
shared_buffers = 2GB              # 总内存的25%
effective_cache_size = 6GB        # 总内存的50-75%
maintenance_work_mem = 512MB
work_mem = 64MB

# 连接配置
max_connections = 200

# 查询优化
random_page_cost = 1.1            # SSD优化
effective_io_concurrency = 200    # SSD并发

# 检查点
checkpoint_completion_target = 0.9
```

---

## 定期维护

### 1. 更新统计信息

#### MySQL

```sql
-- 分析所有表 (每月运行)
ANALYZE TABLE packages;
ANALYZE TABLE users;
ANALYZE TABLE packagePurchases;

-- 优化表 (清理碎片)
OPTIMIZE TABLE packages;
```

#### PostgreSQL

```sql
-- 更新统计信息 (每周运行)
ANALYZE;

-- 清理死元组
VACUUM ANALYZE;

-- 完全清理 (需要锁表,谨慎使用)
VACUUM FULL;
```

### 2. 索引维护

```sql
-- MySQL: 重建索引
ALTER TABLE packages ENGINE=InnoDB;

-- PostgreSQL: 重建索引
REINDEX TABLE packages;
```

### 3. 自动化维护任务

```bash
# crontab -e
# 每周日凌晨3点运行
0 3 * * 0 mysql -u root -p your_database < /path/to/maintenance.sql

# maintenance.sql
-- ANALYZE TABLE packages;
-- ANALYZE TABLE users;
-- OPTIMIZE TABLE packages;
```

---

## 常见问题

### 1. 索引过多

**问题**: 索引太多会降低写入性能

**解决方案**:
- 删除未使用的索引
- 合并可以复用的索引
- 监控索引使用率

```sql
-- 删除未使用的索引
DROP INDEX idx_unused ON packages;
```

### 2. 全表扫描

**问题**: 查询没有使用索引

**检查**:
```sql
EXPLAIN SELECT * FROM packages WHERE YEAR(created_at) = 2026;
-- type: ALL  (全表扫描,不好)
```

**解决**:
```sql
-- 改用范围查询
SELECT * FROM packages
WHERE created_at >= '2026-01-01' AND created_at < '2027-01-01';
-- type: range  (范围扫描,好)
```

### 3. N+1查询问题

**问题**: 循环中执行查询

```typescript
// ❌ N+1问题
const packages = await db.select().from(packages);
for (const pkg of packages) {
  const author = await db.select().from(users).where(eq(users.id, pkg.author_id));
}
```

**解决**:
```typescript
// ✅ 使用JOIN
const packagesWithAuthors = await db.select({
  package: packages,
  author: users,
})
  .from(packages)
  .leftJoin(users, eq(packages.author_id, users.id));
```

### 4. 大表分页性能差

**问题**: OFFSET很大时性能下降

```sql
-- ❌ 慢: OFFSET 10000
SELECT * FROM packages LIMIT 20 OFFSET 10000;
```

**解决: 使用Keyset Pagination**
```sql
-- ✅ 快: 使用WHERE
SELECT * FROM packages
WHERE id > 'last_id_from_previous_page'
ORDER BY id
LIMIT 20;
```

---

## 性能基准测试

### 测试工具

```typescript
import { performance } from 'perf_hooks';

async function benchmarkQuery(name: string, queryFn: () => Promise<any>) {
  const iterations = 100;
  const times: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await queryFn();
    times.push(performance.now() - start);
  }

  const avg = times.reduce((sum, t) => sum + t, 0) / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);

  console.log(`${name}:`);
  console.log(`  Avg: ${avg.toFixed(2)}ms`);
  console.log(`  Min: ${min.toFixed(2)}ms`);
  console.log(`  Max: ${max.toFixed(2)}ms`);
}

// 使用
benchmarkQuery('Package List', async () => {
  return await db.select().from(packages).limit(20);
});
```

### 基准测试结果示例

```
优化前:
Package List:
  Avg: 95.32ms
  Min: 82.45ms
  Max: 125.67ms

优化后:
Package List:
  Avg: 28.15ms
  Min: 22.31ms
  Max: 38.92ms

加速: 3.4x
```

---

## 最佳实践清单

### 开发阶段

- [ ] 为所有WHERE条件创建索引
- [ ] 为所有JOIN条件创建索引
- [ ] 为所有ORDER BY列创建索引
- [ ] 使用EXPLAIN分析查询计划
- [ ] 避免SELECT *
- [ ] 实现分页
- [ ] 使用批量操作
- [ ] 实现查询缓存 (Redis)

### 生产阶段

- [ ] 启用慢查询日志
- [ ] 监控索引使用率
- [ ] 定期ANALYZE表
- [ ] 定期VACUUM (PostgreSQL)
- [ ] 监控数据库连接数
- [ ] 配置连接池
- [ ] 设置查询超时
- [ ] 备份数据库

### 监控指标

- [ ] 平均查询时间 < 50ms
- [ ] 慢查询数量 < 1%
- [ ] 索引命中率 > 95%
- [ ] 缓存命中率 > 80%
- [ ] 连接池使用率 < 70%

---

## 总结

✅ **数据库优化完成后**:
- 查询速度提升2-10倍
- 减少数据库负载60-80%
- 改善应用响应速度
- 支持更高并发

🎯 **关键优化**:
- 索引覆盖90%+常用查询
- 避免全表扫描
- 使用缓存减少查询
- 定期维护和监控

📊 **性能目标**:
- 简单查询 < 10ms
- 复杂查询 < 50ms
- 分页查询 < 30ms
- JOIN查询 < 100ms

---

**完成**: 所有4个生产优化已完成 ✅
**下一步**: 部署到生产环境并监控性能指标
