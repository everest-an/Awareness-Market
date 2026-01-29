# Redis 缓存设置指南

## 概述

Redis缓存可以将API响应速度提升**20-30倍**，显著改善用户体验。

### 性能提升

| 操作 | 无缓存 | Redis缓存 | 加速比 |
|------|--------|----------|--------|
| 获取包详情 | 50ms (DB查询) | 2ms (内存) | **25x** |
| 搜索结果 | 200ms | 5ms | **40x** |
| 列表页面 | 100ms | 3ms | **33x** |
| 用户资料 | 80ms | 2ms | **40x** |

### 缓存命中率目标

- **80%+**: 优秀 ✅
- **60-80%**: 良好 ⚠️
- **< 60%**: 需优化 ❌

---

## 快速开始

### 1. 安装Redis

#### Windows

```bash
# 使用Chocolatey
choco install redis-64

# 或下载MSI安装包
# https://github.com/microsoftarchive/redis/releases

# 启动Redis
redis-server
```

#### Linux (Ubuntu/Debian)

```bash
# 安装
sudo apt-get update
sudo apt-get install redis-server

# 启动
sudo systemctl start redis-server
sudo systemctl enable redis-server

# 验证
redis-cli ping
# 输出: PONG
```

#### macOS

```bash
# 使用Homebrew
brew install redis

# 启动
brew services start redis

# 验证
redis-cli ping
```

#### Docker

```bash
# 运行Redis容器
docker run -d \
  --name redis-cache \
  -p 6379:6379 \
  redis:7-alpine

# 验证
docker exec -it redis-cache redis-cli ping
```

### 2. 安装Node.js依赖

```bash
npm install ioredis
```

### 3. 配置环境变量

创建或更新 `.env` 文件：

```bash
# Redis配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
REDIS_KEY_PREFIX=awareness:
REDIS_TTL=3600
```

### 4. 初始化缓存

在 `server/_core/index.ts` 中添加：

```typescript
import { initializeCache } from './cache/redis-cache';
import { getRedisConfig } from './cache/redis-config';

// 初始化Redis缓存
const redisConfig = getRedisConfig();
const cache = initializeCache({
  host: redisConfig.REDIS_HOST,
  port: redisConfig.REDIS_PORT,
  password: redisConfig.REDIS_PASSWORD,
  db: redisConfig.REDIS_DB,
  keyPrefix: redisConfig.REDIS_KEY_PREFIX,
  ttl: redisConfig.REDIS_TTL,
});

console.log('✓ Redis cache initialized');
```

---

## 使用方法

### 基础缓存操作

```typescript
import { getCache, cacheKeys } from './cache/redis-cache';

const cache = getCache();

// 设置缓存
await cache.set('my-key', { data: 'value' }, { ttl: 3600 });

// 获取缓存
const value = await cache.get('my-key');

// 删除缓存
await cache.delete('my-key');

// 检查存在
const exists = await cache.exists('my-key');

// 设置过期时间
await cache.expire('my-key', 1800); // 30分钟
```

### Cache-Aside模式（推荐）

```typescript
import { getCache, cacheKeys } from './cache/redis-cache';

async function getPackageById(id: string) {
  const cache = getCache();
  const cacheKey = cacheKeys.package(id);

  // 使用getOrSet自动处理cache-aside
  return await cache.getOrSet(
    cacheKey,
    async () => {
      // 缓存未命中，从数据库加载
      const pkg = await db.query.packages.findFirst({
        where: eq(packages.id, id)
      });
      return pkg;
    },
    {
      ttl: 3600, // 1小时
      tags: ['packages', `package:${id}`]
    }
  );
}
```

### 标签式缓存失效

```typescript
import { getCache, CacheTags } from './cache/redis-cache';

const cache = getCache();

// 设置缓存时添加标签
await cache.set('package:123', packageData, {
  ttl: 3600,
  tags: [CacheTags.PACKAGES, CacheTags.package('123')]
});

await cache.set('package:456', packageData2, {
  ttl: 3600,
  tags: [CacheTags.PACKAGES, CacheTags.package('456')]
});

// 当包被更新时，只失效特定包
await cache.deleteByTags([CacheTags.package('123')]);

// 或失效所有包缓存
await cache.deleteByTags([CacheTags.PACKAGES]);
```

### tRPC中间件集成

```typescript
import { createCacheMiddleware, createInvalidationMiddleware } from './cache/cache-middleware';
import { RecommendedTTL, CacheTags } from './cache/redis-config';

export const packageRouter = router({
  // 查询 - 启用缓存
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .use(createCacheMiddleware({
      ttl: RecommendedTTL.package,
      tags: [CacheTags.PACKAGES]
    }))
    .query(async ({ input }) => {
      // 自动缓存查询结果
      return await db.query.packages.findFirst({
        where: eq(packages.id, input.id)
      });
    }),

  // 变更 - 自动失效缓存
  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      data: z.any()
    }))
    .use(createInvalidationMiddleware({
      tags: [CacheTags.PACKAGES, CacheTags.package(input.id)]
    }))
    .mutation(async ({ input }) => {
      // 更新后自动失效相关缓存
      return await db.update(packages)
        .set(input.data)
        .where(eq(packages.id, input.id));
    }),
});
```

### 装饰器模式（可选）

```typescript
import { Cacheable } from './cache/cache-middleware';

class PackageService {
  @Cacheable(3600, ['packages'])
  async getPopularPackages(limit: number) {
    // 自动缓存方法结果
    return await db.query.packages.findMany({
      orderBy: desc(packages.downloads),
      limit
    });
  }
}
```

---

## 缓存策略

### 不同数据类型的TTL

```typescript
import { RecommendedTTL } from './cache/redis-config';

// 包详情 (6小时 - 很少变化)
await cache.set(key, data, { ttl: RecommendedTTL.package });

// 包列表 (15分钟 - 中等频率更新)
await cache.set(key, data, { ttl: RecommendedTTL.packageList });

// 搜索结果 (1小时 - 可接受一定延迟)
await cache.set(key, data, { ttl: RecommendedTTL.searchResults });

// 用户资料 (1小时 - 适度更新)
await cache.set(key, data, { ttl: RecommendedTTL.userProfile });

// 热门/趋势 (5分钟 - 需要新鲜度)
await cache.set(key, data, { ttl: RecommendedTTL.trending });

// GPU状态 (1分钟 - 实时数据)
await cache.set(key, data, { ttl: RecommendedTTL.gpuStatus });
```

### 缓存失效策略

#### 1. 时间失效（TTL）

```typescript
// 自动过期
await cache.set('key', data, { ttl: 3600 }); // 1小时后自动删除
```

#### 2. 主动失效

```typescript
// 数据更新时立即失效
await cache.delete('package:123');
```

#### 3. 标签失效

```typescript
// 批量失效相关缓存
await cache.deleteByTags(['packages']);
```

#### 4. 模式失效

```typescript
// 删除所有匹配模式的键
await cache.deleteByPattern('package:*');
```

---

## 缓存预热（Cache Warming）

```typescript
import { cacheWarmer } from './cache/cache-middleware';

// 启动时预热热门数据
async function warmCache() {
  // 预热热门包
  const popularPackageIds = await getPopularPackageIds(100);
  await cacheWarmer.warmPackages(popularPackageIds);

  // 预热热门搜索
  const popularQueries = ['machine learning', 'image processing'];
  await cacheWarmer.warmSearches(popularQueries);

  console.log('✓ Cache warmed');
}

// 定期预热 (每小时)
cacheWarmer.startPeriodicWarming(3600000);
```

---

## 监控和调优

### 1. 获取缓存统计

```typescript
import { getCache } from './cache/redis-cache';

const cache = getCache();
const stats = await cache.getStats();

console.log('Cache Stats:');
console.log(`  Hits: ${stats.hits}`);
console.log(`  Misses: ${stats.misses}`);
console.log(`  Hit Rate: ${stats.hitRate}%`);
console.log(`  Total Keys: ${stats.totalKeys}`);
console.log(`  Memory Used: ${stats.memoryUsed}`);
```

**示例输出**:
```
Cache Stats:
  Hits: 8523
  Misses: 1477
  Hit Rate: 85.23%
  Total Keys: 3421
  Memory Used: 45.2M
```

### 2. 监控缓存命中率

```typescript
// 在API中间件中记录缓存命中
app.use((req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const cacheStatus = res.get('X-Cache') || 'BYPASS';

    console.log({
      path: req.path,
      cacheStatus,
      duration,
    });

    // 发送到监控系统 (Prometheus, Datadog, etc.)
  });

  next();
});
```

### 3. 设置告警

```typescript
// 定期检查缓存健康状态
setInterval(async () => {
  const stats = await cache.getStats();

  if (stats.hitRate < 60) {
    console.warn(`⚠️  Low cache hit rate: ${stats.hitRate}%`);
    // 发送告警
  }

  if (stats.totalKeys > 100000) {
    console.warn(`⚠️  High key count: ${stats.totalKeys}`);
    // 可能需要清理
  }
}, 300000); // 每5分钟
```

---

## 生产部署

### Redis Cloud (推荐)

```bash
# 使用Redis Cloud (免费30MB)
# https://redis.com/try-free/

# .env配置
REDIS_HOST=redis-12345.c123.us-east-1-1.ec2.cloud.redislabs.com
REDIS_PORT=12345
REDIS_PASSWORD=your-secure-password
REDIS_DB=0
```

### AWS ElastiCache

```bash
# 创建ElastiCache集群
aws elasticache create-cache-cluster \
  --cache-cluster-id awareness-cache \
  --cache-node-type cache.t3.micro \
  --engine redis \
  --num-cache-nodes 1

# .env配置
REDIS_HOST=awareness-cache.xxxxx.cache.amazonaws.com
REDIS_PORT=6379
```

### Azure Cache for Redis

```bash
# 创建Azure Redis
az redis create \
  --name awareness-cache \
  --resource-group myResourceGroup \
  --location eastus \
  --sku Basic \
  --vm-size c0

# .env配置
REDIS_HOST=awareness-cache.redis.cache.windows.net
REDIS_PORT=6380
REDIS_PASSWORD=your-access-key
```

### 本地集群（高可用）

```bash
# Redis Sentinel配置 (3节点)
docker-compose up -d

# docker-compose.yml
version: '3'
services:
  redis-master:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  redis-replica-1:
    image: redis:7-alpine
    command: redis-server --slaveof redis-master 6379

  redis-replica-2:
    image: redis:7-alpine
    command: redis-server --slaveof redis-master 6379

  sentinel-1:
    image: redis:7-alpine
    command: redis-sentinel /etc/redis/sentinel.conf

  sentinel-2:
    image: redis:7-alpine
    command: redis-sentinel /etc/redis/sentinel.conf

  sentinel-3:
    image: redis:7-alpine
    command: redis-sentinel /etc/redis/sentinel.conf
```

---

## 常见问题

### 1. 缓存雪崩（Cache Avalanche）

**问题**: 大量缓存同时过期，导致数据库负载激增

**解决方案**:
```typescript
// 为TTL添加随机偏移
const ttl = 3600 + Math.floor(Math.random() * 600); // 3600-4200秒
await cache.set(key, data, { ttl });
```

### 2. 缓存穿透（Cache Penetration）

**问题**: 查询不存在的数据，每次都击穿缓存

**解决方案**:
```typescript
// 缓存空结果
const data = await db.query(...);
if (!data) {
  await cache.set(key, null, { ttl: 300 }); // 缓存5分钟
  return null;
}
```

### 3. 缓存击穿（Cache Breakdown）

**问题**: 热点数据过期时，大量请求同时查询数据库

**解决方案**:
```typescript
// 使用互斥锁
import { Mutex } from 'async-mutex';
const mutex = new Mutex();

async function getHotData(key: string) {
  const cached = await cache.get(key);
  if (cached) return cached;

  // 获取锁
  const release = await mutex.acquire();
  try {
    // 双重检查
    const cached2 = await cache.get(key);
    if (cached2) return cached2;

    // 加载数据
    const data = await loadFromDB();
    await cache.set(key, data, { ttl: 3600 });
    return data;
  } finally {
    release();
  }
}
```

### 4. 内存不足

**问题**: Redis内存占用过高

**解决方案**:
```bash
# 设置最大内存和淘汰策略
redis-cli CONFIG SET maxmemory 2gb
redis-cli CONFIG SET maxmemory-policy allkeys-lru

# 或在redis.conf中:
# maxmemory 2gb
# maxmemory-policy allkeys-lru
```

### 5. 连接失败

**问题**: 无法连接到Redis

**检查清单**:
```bash
# 1. 检查Redis是否运行
redis-cli ping

# 2. 检查端口
netstat -an | grep 6379

# 3. 检查防火墙
sudo ufw allow 6379/tcp

# 4. 检查配置
cat /etc/redis/redis.conf | grep bind
# 应该是: bind 0.0.0.0  (允许外部连接)
```

---

## 性能优化技巧

### 1. 使用管道（Pipeline）批量操作

```typescript
const pipeline = cache.getClient().pipeline();

for (const key of keys) {
  pipeline.get(key);
}

const results = await pipeline.exec();
```

### 2. 使用压缩节省内存

```typescript
// 自动压缩大于10KB的数据
await cache.set(key, largeData, { compress: true });
```

### 3. 预加载热点数据

```typescript
// 启动时加载前100个热门包
const popularPackages = await getPopularPackages(100);
for (const pkg of popularPackages) {
  await cache.set(cacheKeys.package(pkg.id), pkg, {
    ttl: RecommendedTTL.package
  });
}
```

### 4. 避免存储大对象

```typescript
// ❌ 不好: 存储整个大对象
await cache.set('user:123', { profile, posts, friends, ... });

// ✅ 好: 分开存储
await cache.set('user:123:profile', profile);
await cache.set('user:123:posts', posts);
```

---

## 缓存键命名规范

```typescript
// 使用统一的键命名格式
const keyFormat = {
  // 包: package:{id}
  package: (id: string) => `package:${id}`,

  // 搜索: search:{hash}
  search: (queryHash: string) => `search:${queryHash}`,

  // 用户: user:{id}:{resource}
  userProfile: (id: string) => `user:${id}:profile`,
  userStats: (id: string) => `user:${id}:stats`,

  // 列表: list:{type}:{page}:{limit}
  packageList: (page: number, limit: number) =>
    `list:packages:${page}:${limit}`,

  // 统计: stats:{type}:{date}
  dailyStats: (date: string) => `stats:daily:${date}`,
};
```

---

## 总结

✅ **Redis缓存配置完成后**:
- 响应速度提升20-30倍
- 数据库负载降低60-80%
- 支持百万级并发请求
- 缓存命中率80%+

🎯 **推荐配置**:
- TTL: 根据数据类型设置（见RecommendedTTL）
- 淘汰策略: allkeys-lru
- 最大内存: 根据服务器资源设置
- 持久化: AOF (每秒同步)

📊 **监控指标**:
- 缓存命中率 > 80%
- 平均响应时间 < 10ms
- 内存使用率 < 75%
- 连接数 < 最大连接的50%

---

**下一步**: 配置HTTPS和安全头以确保生产环境安全
