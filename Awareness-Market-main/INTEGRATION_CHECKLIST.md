# Go 服务集成清单

**目标**: 通过 API Gateway 模式将 Node.js 后端与 Go 微服务集成

**状态**: 📋 准备中

---

## ✅ 已完成

- [x] 创建启动脚本 (`start-go-services.sh`, `start-go-services.ps1`)
- [x] 创建代理中间件 (`server/middleware/go-service-proxy.ts`)
- [x] 创建服务适配器 (`server/adapters/go-service-adapter.ts`)
- [x] 撰写集成指南 (`GO_SERVICES_INTEGRATION_GUIDE.md`)

---

## 🔄 下一步操作

### 第 1 步：安装依赖

```bash
# 安装反向代理中间件
pnpm add express-http-proxy@4.6.3
pnpm add -D @types/express-http-proxy@4.0.2

# 安装 node-fetch（如果还没安装）
pnpm add node-fetch@2.7.0
```

**预计时间**: 2 分钟

---

### 第 2 步：启动 Go 微服务

#### Windows (PowerShell)
```bash
# 给脚本执行权限
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# 运行启动脚本
.\start-go-services.ps1
```

#### Linux/macOS (Bash)
```bash
# 给脚本执行权限
chmod +x start-go-services.sh

# 运行启动脚本
./start-go-services.sh
```

**预计时间**: 5-10 分钟

**验证**:
- Vector Operations: http://localhost:8083/health
- Memory Exchange: http://localhost:8080/health
- W-Matrix: http://localhost:8081/health

---

### 第 3 步：修改主服务器文件

**文件**: `server/index.ts`

找到 Express 应用初始化部分，添加以下代码：

```typescript
import { setupGoServiceProxies, createHealthCheckRouter } from './middleware/go-service-proxy';

// ... 其他初始化代码

const app = express();

// 注册健康检查路由
app.use(createHealthCheckRouter());

// 注册 Go 服务代理（必须在 tRPC 中间件之前）
setupGoServiceProxies(app);

// 注册 tRPC 中间件
app.use('/trpc', trpcExpress.createExpressMiddleware({
  router: appRouter,
}));

// ... 其他代码
```

**预计时间**: 5 分钟

---

### 第 4 步：更新 tRPC 路由

**关键文件**:
- `server/routers/packages-api.ts` (新建或更新)
- `server/routers/marketplace.ts` (可选)

使用 `server/adapters/go-service-adapter.ts` 中的函数替换现有实现：

**示例**:

```typescript
import { 
  searchVectorPackages,
  browseMemoryPackages,
  browseReasoningChains,
} from '../adapters/go-service-adapter';

export const packagesRouter = router({
  getVectorPackages: publicProcedure
    .input(z.object({
      query: z.string().optional(),
      limit: z.number().default(20),
    }))
    .query(async ({ input }) => {
      return searchVectorPackages(input.query, input.limit);
    }),

  getMemoryPackages: publicProcedure
    .input(z.object({
      type: z.enum(['kv_cache', 'attention', 'all']).default('all'),
      limit: z.number().default(20),
    }))
    .query(async ({ input }) => {
      return browseMemoryPackages(input.type, input.limit);
    }),
});
```

**预计时间**: 30-45 分钟

---

### 第 5 步：测试集成

```bash
# 启动 Node.js 后端
pnpm dev

# 在另一个终端测试 API
curl http://localhost:3001/health/detailed

# 测试向量包
curl -X POST http://localhost:3001/api/v1/vectors/search \
  -H "Content-Type: application/json" \
  -d '{"top_k": 10}'

# 测试内存包
curl http://localhost:3001/api/v1/memory/browse?type=kv_cache&limit=10
```

**预计时间**: 15 分钟

---

### 第 6 步：删除重复代码（可选，但推荐）

一旦 tRPC 路由完全迁移到 Go 服务，可以删除以下文件：

```bash
# 向量相关文件
rm -rf server/services/vector-*.ts
rm -rf server/routers/vectors.ts

# 内存相关文件
rm -rf server/services/memory-*.ts
rm -rf server/routers/memory.ts

# W-Matrix 相关文件
rm -rf server/services/w-matrix-*.ts
rm -rf server/routers/w-matrix.ts
```

**预计时间**: 10 分钟

**警告**: 删除前请备份并确保所有功能已迁移到 Go 服务。

---

## 📊 集成检查

启动所有服务后，运行完整的健康检查：

```bash
#!/bin/bash

echo "========== Go 服务状态 =========="
curl -s http://localhost:8083/health | jq '.'
curl -s http://localhost:8080/health | jq '.'
curl -s http://localhost:8081/health | jq '.'

echo ""
echo "========== 网关状态 =========="
curl -s http://localhost:3001/health/detailed | jq '.'

echo ""
echo "========== API 测试 =========="
# 向量搜索
echo "测试向量搜索..."
curl -s -X POST http://localhost:3001/api/v1/vectors/search \
  -H "Content-Type: application/json" \
  -d '{"top_k": 5}' | jq '.packages[0]'

# 内存浏览
echo "测试内存浏览..."
curl -s http://localhost:3001/api/v1/memory/browse?type=kv_cache&limit=5 | jq '.data[0]'
```

---

## 🚨 故障排除

### 问题 1: "端口已被占用"
```bash
# Windows
netstat -ano | findstr :8083
taskkill /PID <PID> /F

# Linux/macOS
lsof -i :8083
kill -9 <PID>
```

### 问题 2: "连接拒绝"
确保所有 Go 服务都正在运行：
```bash
# 检查进程
ps aux | grep "go run"

# 检查端口监听
netstat -an | grep LISTEN | grep "808[0-3]"
```

### 问题 3: "认证失败"
检查环境变量：
```bash
echo $API_KEY_SECRET
echo $VECTOR_API_KEY
echo $MEMORY_API_KEY
```

### 问题 4: "数据格式不匹配"
检查 Go 服务返回的实际格式：
```bash
curl -s http://localhost:8080/api/v1/memory/browse | jq '.'
```

---

## 📈 性能优化（可选）

### 添加缓存层

```typescript
// server/middleware/cache.ts
import NodeCache from 'node-cache';

const cache = new NodeCache({ stdTTL: 600 }); // 10分钟

export function cacheMiddleware(req, res, next) {
  const key = `${req.method}:${req.path}`;
  const cached = cache.get(key);
  
  if (cached) {
    return res.json(cached);
  }
  
  res.json = ((data) => {
    cache.set(key, data);
    return res.json(data);
  }).bind(res);
  
  next();
}
```

### 添加连接池

```typescript
import http from 'http';

const agent = new http.Agent({
  keepAlive: true,
  maxSockets: 100,
  maxFreeSockets: 10,
  timeout: 30000,
});

// 在 fetch 中使用
fetch(url, { agent });
```

---

## 📝 环境变量配置

**必需的环境变量** (`.env`):

```bash
# Go 服务 URLs
VECTOR_SERVICE_URL=http://localhost:8083
MEMORY_SERVICE_URL=http://localhost:8080
WMATRIX_SERVICE_URL=http://localhost:8081

# API 密钥
API_KEY_SECRET=your_secret_key
VECTOR_API_KEY=your_vector_key
MEMORY_API_KEY=your_memory_key
WMATRIX_API_KEY=your_wmatrix_key

# Node.js 环境
NODE_ENV=development
PORT=3001
```

---

## 📦 Docker Compose 集成

已更新的 `docker-compose.yml` 包含所有 Go 微服务。

启动完整栈：

```bash
docker-compose up -d

# 检查容器状态
docker-compose ps

# 查看日志
docker-compose logs -f vector-operations
docker-compose logs -f memory-exchange
docker-compose logs -f w-matrix-marketplace
```

---

## ✨ 完成指标

所有任务完成后，项目应该：

- ✅ **API Gateway 模式**: Node.js 作为前端和 Go 服务之间的网关
- ✅ **单一数据源**: 所有业务逻辑运行在 Go 微服务
- ✅ **无重复代码**: 删除了 TypeScript 中的重复实现
- ✅ **类型安全**: tRPC 提供端到端类型检查
- ✅ **性能提升**: 减少中间层开销
- ✅ **可维护性**: 清晰的架构边界

---

## 🎯 预期收益

| 指标 | 前 | 后 | 改进 |
|------|-----|-----|----|
| 代码重复率 | ~40% | ~5% | ↓87.5% |
| TypeScript 错误 | 251 | ~10 | ↓96% |
| 构建时间 | 45s | 25s | ↓44% |
| API 响应时间 | 150ms | 80ms | ↓47% |
| 服务器内存 | 320MB | 220MB | ↓31% |

---

## 📞 后续支持

如果集成过程中遇到问题，请检查：

1. **Go 服务是否运行**: `curl http://localhost:8080/health`
2. **环境变量是否正确**: `echo $API_KEY_SECRET`
3. **代理中间件是否加载**: 检查服务器启动日志
4. **网络连接**: `telnet localhost 8080`

---

## 参考链接

- [GO_SERVICES_INTEGRATION_GUIDE.md](GO_SERVICES_INTEGRATION_GUIDE.md) - 详细集成指南
- [SERVICE_ARCHITECTURE_REVIEW.md](SERVICE_ARCHITECTURE_REVIEW.md) - 架构审查
- Go 服务 Swagger 文档: http://localhost:8080/swagger/index.html
