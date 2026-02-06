# Go 服务集成指南

**目标**: 将现有 Go 微服务集成到 Node.js 后端作为 API Gateway

---

## 第 1 步：启动 Go 微服务

### 前置条件

```bash
# 检查 Go 版本
go version  # 应该是 1.21+

# 检查环境变量
echo $DATABASE_URL
echo $API_KEY_SECRET
```

### 启动脚本

创建 `start-services.sh`：

```bash
#!/bin/bash

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 启动 Awareness Market Go 微服务${NC}"

# 1. Vector Operations (Port 8083)
echo -e "${BLUE}启动 Vector Operations Service...${NC}"
cd go-services/vector-operations
export VECTOR_OPS_PORT=8083
go run cmd/main.go &
VECTOR_PID=$!
echo -e "${GREEN}✓ Vector Operations (PID: $VECTOR_PID) - http://localhost:8083${NC}"

sleep 2

# 2. Memory Exchange (Port 8080)
echo -e "${BLUE}启动 Memory Exchange Service...${NC}"
cd ../memory-exchange
export MEMORY_EXCHANGE_PORT=8080
export API_KEY_SECRET=${API_KEY_SECRET:-"default_secret"}
go run cmd/main.go &
MEMORY_PID=$!
echo -e "${GREEN}✓ Memory Exchange (PID: $MEMORY_PID) - http://localhost:8080${NC}"

sleep 2

# 3. W-Matrix Marketplace (Port 8081)
echo -e "${BLUE}启动 W-Matrix Marketplace Service...${NC}"
cd ../w-matrix-marketplace
export WMATRIX_PORT=8081
go run cmd/main.go &
WMATRIX_PID=$!
echo -e "${GREEN}✓ W-Matrix Marketplace (PID: $WMATRIX_PID) - http://localhost:8081${NC}"

echo -e "${GREEN}所有服务已启动${NC}"
echo "健康检查:"
echo "  Vector Ops:     curl http://localhost:8083/health"
echo "  Memory:         curl http://localhost:8080/health"
echo "  W-Matrix:       curl http://localhost:8081/health"

# 等待中断信号
wait
```

### 验证 Go 服务运行

```bash
# 检查 Vector Operations
curl http://localhost:8083/health

# 检查 Memory Exchange
curl http://localhost:8080/health

# 检查 W-Matrix
curl http://localhost:8081/health
```

---

## 第 2 步：配置 Node.js 代理层

### 2.1 安装代理中间件

```bash
pnpm add express-http-proxy
pnpm add -D @types/express-http-proxy
```

### 2.2 创建代理中间件

`server/middleware/go-service-proxy.ts`：

```typescript
import { Router, Request, Response, NextFunction } from 'express';
import { createProxyMiddleware } from 'express-http-proxy';

export function setupGoServiceProxies(app: any) {
  // Vector Operations Proxy
  app.use(
    '/api/v1/vectors',
    createProxyMiddleware({
      target: 'http://localhost:8083',
      changeOrigin: true,
      pathRewrite: {
        '^/api/v1/vectors': '/api/v1/vectors',
      },
      onError: (err: Error, req: Request, res: Response) => {
        console.error('[Vector Proxy Error]', err);
        res.status(503).json({ error: 'Vector service unavailable' });
      },
    })
  );

  // Memory Exchange Proxy
  app.use(
    '/api/v1/memory',
    createProxyMiddleware({
      target: 'http://localhost:8080',
      changeOrigin: true,
      pathRewrite: {
        '^/api/v1/memory': '/api/v1/memory',
      },
      onError: (err: Error, req: Request, res: Response) => {
        console.error('[Memory Proxy Error]', err);
        res.status(503).json({ error: 'Memory service unavailable' });
      },
    })
  );

  // Reasoning Chain Proxy
  app.use(
    '/api/v1/reasoning-chain',
    createProxyMiddleware({
      target: 'http://localhost:8080',
      changeOrigin: true,
      pathRewrite: {
        '^/api/v1/reasoning-chain': '/api/v1/reasoning-chain',
      },
    })
  );

  // W-Matrix Marketplace Proxy
  app.use(
    '/api/v1/w-matrix',
    createProxyMiddleware({
      target: 'http://localhost:8081',
      changeOrigin: true,
      pathRewrite: {
        '^/api/v1/w-matrix': '/api/v1/w-matrix',
      },
    })
  );
}
```

### 2.3 在主服务器中注册代理

`server/index.ts`：

```typescript
import { setupGoServiceProxies } from './middleware/go-service-proxy';

// ... 其他设置

// 在 tRPC 中间件之前注册 Go 服务代理
setupGoServiceProxies(app);

// tRPC 路由
app.use('/trpc', trpcExpress.createExpressMiddleware({ router: appRouter }));
```

---

## 第 3 步：更新 tRPC 路由

### 3.1 创建类型适配层

`server/adapters/go-service-adapter.ts`：

```typescript
import fetch from 'node-fetch';

/**
 * 调用 Go Vector Service
 */
export async function callVectorService(
  endpoint: string,
  method: 'GET' | 'POST' = 'GET',
  body?: any
) {
  const url = `http://localhost:8083/api/v1/vectors${endpoint}`;
  
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': process.env.API_KEY_SECRET || '',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`Vector service error: ${response.status}`);
  }

  return response.json();
}

/**
 * 调用 Go Memory Service
 */
export async function callMemoryService(
  endpoint: string,
  method: 'GET' | 'POST' = 'GET',
  body?: any
) {
  const url = `http://localhost:8080/api/v1${endpoint}`;
  
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.API_KEY_SECRET || ''}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`Memory service error: ${response.status}`);
  }

  return response.json();
}

/**
 * 调用 Go W-Matrix Service
 */
export async function callWMatrixService(
  endpoint: string,
  method: 'GET' | 'POST' = 'GET',
  body?: any
) {
  const url = `http://localhost:8081/api/v1/w-matrix${endpoint}`;
  
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': process.env.API_KEY_SECRET || '',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`W-Matrix service error: ${response.status}`);
  }

  return response.json();
}
```

### 3.2 更新 tRPC 路由

`server/routers/packages-api.ts`：

```typescript
import {
  callVectorService,
  callMemoryService,
} from '../adapters/go-service-adapter';

export const packagesApiRouter = router({
  browsePackages: publicProcedure
    .input(z.object({
      packageType: z.enum(['vector', 'memory', 'chain']),
      limit: z.number().optional(),
      offset: z.number().optional(),
    }))
    .query(async ({ input }) => {
      switch (input.packageType) {
        case 'vector':
          return callVectorService('/search', 'POST', {
            top_k: input.limit || 20,
          });

        case 'memory':
        case 'chain':
          return callMemoryService('/browse?type=' + input.packageType, 'GET');

        default:
          throw new Error('Unknown package type');
      }
    }),

  getPackage: publicProcedure
    .input(z.object({
      packageType: z.enum(['vector', 'memory', 'chain']),
      packageId: z.string(),
    }))
    .query(async ({ input }) => {
      // 根据类型调用相应的 Go 服务
      // ...
    }),
});
```

---

## 第 4 步：环境配置

### 4.1 .env 文件

```bash
# Go 服务端口
VECTOR_OPS_PORT=8083
MEMORY_EXCHANGE_PORT=8080
WMATRIX_PORT=8081

# 共享配置
DATABASE_URL=postgresql://user:pass@host:5432/awareness
API_KEY_SECRET=your_secret_key

# Go 服务 URL
VECTOR_SERVICE_URL=http://localhost:8083
MEMORY_SERVICE_URL=http://localhost:8080
WMATRIX_SERVICE_URL=http://localhost:8081
```

### 4.2 docker-compose.yml 更新

```yaml
version: '3.8'

services:
  # Go 微服务
  vector-operations:
    build: ./go-services/vector-operations
    ports:
      - "8083:8083"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - API_KEY_SECRET=${API_KEY_SECRET}
    networks:
      - awareness

  memory-exchange:
    build: ./go-services/memory-exchange
    ports:
      - "8080:8080"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - API_KEY_SECRET=${API_KEY_SECRET}
    networks:
      - awareness

  w-matrix-marketplace:
    build: ./go-services/w-matrix-marketplace
    ports:
      - "8081:8081"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - API_KEY_SECRET=${API_KEY_SECRET}
    networks:
      - awareness

  # Node.js 后端 (API Gateway)
  backend:
    build: .
    ports:
      - "3001:3001"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - VECTOR_SERVICE_URL=http://vector-operations:8083
      - MEMORY_SERVICE_URL=http://memory-exchange:8080
      - WMATRIX_SERVICE_URL=http://w-matrix-marketplace:8081
    depends_on:
      - vector-operations
      - memory-exchange
      - w-matrix-marketplace
    networks:
      - awareness

networks:
  awareness:
```

---

## 第 5 步：测试集成

### 5.1 健康检查

```bash
#!/bin/bash

echo "检查 Go 服务健康状态..."

# Vector
curl -s http://localhost:8083/health | jq '.'
echo ""

# Memory
curl -s http://localhost:8080/health | jq '.'
echo ""

# W-Matrix
curl -s http://localhost:8081/health | jq '.'
echo ""

echo "检查 Node.js 网关..."
curl -s http://localhost:3001/health | jq '.'
```

### 5.2 API 测试

```bash
# 通过网关搜索向量
curl -X POST http://localhost:3001/api/trpc/packages.browsePackages \
  -H "Content-Type: application/json" \
  -d '{"packageType": "vector", "limit": 10}'

# 浏览内存包
curl -X GET 'http://localhost:3001/api/v1/memory/browse?type=kv_cache&limit=20'

# W-Matrix 版本
curl -X GET 'http://localhost:3001/api/v1/w-matrix/versions'
```

---

## 第 6 步：前端更新

### 6.1 API 调用更新

`client/src/lib/api.ts`：

```typescript
// 使用新的 Go 服务端点
export async function browseVectorPackages(limit: number = 20) {
  const response = await fetch('/api/v1/vectors/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ top_k: limit }),
  });
  return response.json();
}

export async function browseMemoryPackages(type: string, limit: number = 20) {
  const response = await fetch(`/api/v1/memory/browse?type=${type}&limit=${limit}`);
  return response.json();
}
```

### 6.2 组件更新

前端组件无需大改，只需确保数据映射正确：

```typescript
// client/src/pages/Dashboard.tsx
const { data: packages } = useSWR(
  '/api/v1/memory/browse?type=all&limit=20',
  fetcher
);

// packages 现在来自 Go 服务，格式更清晰
if (packages && packages.data) {
  // 使用 Go 服务的响应格式
}
```

---

## 故障排除

### 问题 1: "连接被拒绝"

```bash
# 检查服务是否运行
lsof -i :8083  # Vector
lsof -i :8080  # Memory
lsof -i :8081  # W-Matrix

# 重启服务
pkill -f "go run"
./start-services.sh
```

### 问题 2: "认证失败"

检查 API Key：

```bash
# 环境变量中的 API_KEY_SECRET 是否正确
echo $API_KEY_SECRET

# 检查 Go 服务日志
# 验证认证头格式是否正确
```

### 问题 3: "数据类型不匹配"

查看 Go 服务返回的实际数据格式：

```bash
curl -X GET http://localhost:8080/api/v1/memory/browse -H "Authorization: Bearer YOUR_KEY" | jq '.'
```

---

## 性能优化建议

1. **连接池**: 使用 `http.Agent` 复用 TCP 连接
2. **缓存**: 在网关层添加 Redis 缓存
3. **负载均衡**: 为高流量 Go 服务添加多个实例
4. **监控**: 使用 Prometheus 监控各微服务性能

```typescript
import http from 'http';

const agent = new http.Agent({
  keepAlive: true,
  maxSockets: 50,
});

fetch(url, { agent });
```

---

## 完成检查清单

- [x] Go 服务架构已设计
- [x] Node.js 代理层已配置 (server/middleware/go-service-proxy.ts)
- [x] tRPC 路由已更新 (server/routers.ts)
- [x] Go 服务适配器已实现 (server/adapters/go-service-adapter.ts)
- [x] API Gateway 已集成 (server/_core/index.ts)
- [x] 项目构建成功
- [ ] 前端测试通过 (需要运行)
- [ ] Docker Compose 配置已更新
- [ ] 环境变量已配置
- [ ] 健康检查通过 (需要服务运行)
- [ ] API 集成测试通过 (需要服务运行)

---

## ✅ 当前进度总结

**已完成：**
1. ✅ Step 1 - 安装所有依赖 (express-http-proxy, three.js)
2. ✅ Step 2 - 创建 Go 服务启动脚本
3. ✅ Step 3 - 实现 API Gateway 代理层
4. ✅ Step 4 - 更新所有 tRPC 路由指向 Go 服务
5. ✅ Step 5 - 创建集成测试脚本

**待完成：**
- 运行服务并执行集成测试
- 前端组件适配
- 生产环境部署配置

**下一步**: 
```bash
# 运行此脚本启动所有服务
.\start-all-services.ps1

# 然后运行集成测试
node test-integration.mjs
```
