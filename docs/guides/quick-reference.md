# 🚀 Awareness Market - 服务架构快速参考

## 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                      前端 (React 18)                         │
│                    client/src/ folder                       │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP/REST
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                  Node.js API Gateway                        │
│                 (Express + tRPC)                            │
│              server/middleware/go-service-proxy.ts          │
└────────┬────────────────┬────────────────────┬──────────────┘
         │                │                    │
         ↓                ↓                    ↓
   Port 8083         Port 8080             Port 8081
┌──────────────┐ ┌──────────────┐ ┌──────────────────┐
│   Vector     │ │   Memory     │ │   W-Matrix       │
│ Operations   │ │  Exchange    │ │  Marketplace     │
│   (Go)       │ │   (Go)       │ │   (Go)           │
│              │ │              │ │                  │
│ • Search     │ │ • KV-Cache   │ │ • Versions       │
│ • Stats      │ │ • Reasoning  │ │ • Alignment      │
│ • Batch      │ │ • Publish    │ │ • Cross-model    │
└──────────────┘ └──────────────┘ └──────────────────┘
         │                │                    │
         └────────────────┴────────────────────┘
                         ↓
           AWS RDS MySQL Database
```

---

## 🎯 三条产品线

### 1️⃣ Vector Marketplace
**URL**: `/products/vectors`
- **服务**: Vector Operations (Port 8083)
- **功能**:
  - 搜索向量模型
  - 获取向量统计
  - 批量操作
- **API Endpoint**: 
  ```
  GET    /api/v1/vectors/stats
  POST   /api/v1/vectors/search
  POST   /api/v1/vectors/batch
  GET    /api/v1/vectors/{id}
  ```

### 2️⃣ Memory Marketplace
**URL**: `/products/memory`
- **服务**: Memory Exchange (Port 8080)
- **功能**:
  - KV-Cache 交易
  - 内存发布/购买
  - 交易历史
- **API Endpoint**:
  ```
  GET    /api/v1/memory/browse
  POST   /api/v1/memory/publish
  POST   /api/v1/memory/purchase
  GET    /api/v1/memory/my-history
  ```

### 3️⃣ Reasoning Chain Marketplace
**URL**: `/products/chains`
- **服务**: Memory Exchange (Port 8080)
- **功能**:
  - 推理链发布
  - 链式购买/使用
  - 历史记录
- **API Endpoint**:
  ```
  GET    /api/v1/reasoning-chain/browse
  POST   /api/v1/reasoning-chain/publish
  POST   /api/v1/reasoning-chain/use
  ```

### 🔧 Bonus: W-Matrix Marketplace
**URL**: `/products/wmatrix`
- **服务**: W-Matrix Marketplace (Port 8081)
- **功能**:
  - 模型对齐矩阵
  - 版本管理
  - 跨模型兼容性
- **API Endpoint**:
  ```
  GET    /api/v1/w-matrix/versions
  POST   /api/v1/w-matrix/versions
  GET    /api/v1/w-matrix/versions/{id}
  ```

---

## 📋 快速命令

### 启动 Go 服务

```bash
# Windows PowerShell
.\start-go-services.ps1

# Linux/macOS
./start-go-services.sh

# Docker Compose
docker-compose up -d vector-operations memory-exchange w-matrix-marketplace
```

### 启动 Node.js 后端

```bash
pnpm install
pnpm dev
```

### 启动前端

```bash
cd client
pnpm install
pnpm dev
```

### 完整启动（开发环境）

```bash
# Terminal 1: Go 微服务
./start-go-services.sh

# Terminal 2: Node.js 后端
pnpm dev

# Terminal 3: 前端
cd client && pnpm dev
```

---

## 🔍 健康检查

```bash
# 检查所有 Go 服务
curl http://localhost:8083/health  # Vector
curl http://localhost:8080/health  # Memory
curl http://localhost:8081/health  # W-Matrix

# 检查网关状态
curl http://localhost:3001/health/detailed

# Swagger 文档
http://localhost:8080/swagger/index.html
```

---

## 🐛 常见问题

| 问题 | 解决方案 |
|------|--------|
| "端口已被占用" | 使用启动脚本会自动处理，或手动: `lsof -i :8080 \| grep LISTEN \| awk '{print $2}' \| xargs kill -9` |
| "连接拒绝" | 确保 Go 服务已启动: `netstat -an \| grep 808` |
| "认证失败" | 检查环境变量: `echo $API_KEY_SECRET` |
| "TypeScript 错误" | 运行 `pnpm check` 检查，应该 <50 errors |
| "构建失败" | 确保所有依赖安装: `pnpm install --force` |

---

## 📦 环境变量

**创建 `.env` 文件**:

```bash
# Go 服务 URLs
VECTOR_SERVICE_URL=http://localhost:8083
MEMORY_SERVICE_URL=http://localhost:8080
WMATRIX_SERVICE_URL=http://localhost:8081

# API Keys (需要与 Go 服务配置匹配)
API_KEY_SECRET=your_secret_key_here

# 数据库 (已配置在 Docker)
DATABASE_URL=mysql://user:password@localhost/awareness

# Node.js
NODE_ENV=development
PORT=3001

# Vite
VITE_API_URL=http://localhost:3001
```

---

## 📊 项目结构

```
Awareness-Market-main/
├── client/                  # React 前端
│   ├── src/
│   │   ├── components/     # React 组件
│   │   ├── pages/          # 页面（Home, Dashboard 等）
│   │   └── hooks/          # 自定义 hooks (use-auth, use-packages 等)
│   └── vite.config.ts
│
├── server/                  # Node.js 后端
│   ├── middleware/
│   │   └── go-service-proxy.ts  # ✨ API Gateway 代理
│   ├── adapters/
│   │   └── go-service-adapter.ts # ✨ Go 服务调用适配器
│   ├── routers/            # tRPC 路由
│   └── index.ts            # Express 主应用
│
├── go-services/            # Go 微服务
│   ├── vector-operations/  # 向量搜索 (Port 8083)
│   ├── memory-exchange/    # 内存交易 (Port 8080)
│   └── w-matrix-marketplace/ # W-Matrix (Port 8081)
│
├── start-go-services.sh    # ✨ Linux/Mac 启动脚本
├── start-go-services.ps1   # ✨ Windows 启动脚本
├── INTEGRATION_CHECKLIST.md # ✨ 集成清单
├── GO_SERVICES_INTEGRATION_GUIDE.md # ✨ 集成指南
└── docker-compose.yml      # Docker 容器配置
```

**✨** = 新增文件

---

## 🔄 API 调用流程

### 示例：浏览向量包

```
1. 前端请求
   GET /api/v1/vectors/search?top_k=20
   
2. API Gateway (Node.js)
   ├─ 接收请求
   ├─ 转发到 Vector Operations
   └─ 返回响应

3. Go 服务 (Port 8083)
   ├─ 处理向量搜索
   ├─ 查询数据库
   └─ 返回 {success, packages[], total}

4. 前端渲染
   ├─ 接收响应
   ├─ 更新 UI
   └─ 显示向量列表
```

---

## 🚀 部署清单

### 本地开发
- [x] Go 服务启动脚本
- [x] API Gateway 中间件
- [x] 环境变量配置
- [x] 整合文档

### 生产环境

```bash
# 使用 Docker Compose
docker-compose -f docker-compose.yml up -d

# 检查服务状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 停止所有服务
docker-compose down
```

---

## 📞 资源链接

| 资源 | 链接 |
|------|------|
| API 网关 | http://localhost:3001 |
| Memory API Docs | http://localhost:8080/swagger/index.html |
| Vector Service Health | http://localhost:8083/health |
| 完整架构审查 | [SERVICE_ARCHITECTURE_REVIEW.md](SERVICE_ARCHITECTURE_REVIEW.md) |
| 集成指南 | [GO_SERVICES_INTEGRATION_GUIDE.md](GO_SERVICES_INTEGRATION_GUIDE.md) |

---

## 💡 下一步

1. **启动服务**: `./start-go-services.ps1`
2. **验证连接**: `curl http://localhost:3001/health/detailed`
3. **运行前端**: `cd client && pnpm dev`
4. **开始开发**: 浏览 http://localhost:5173

---

**最后更新**: 2024 年 [当前月份]
**状态**: ✅ 集成完成，可用于开发
**维护者**: Awareness Market Team
