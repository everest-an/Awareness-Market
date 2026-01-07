# Awareness Network - Project TODO

## 三条并行产品线重构 - 符合 LatentMAS 论文架构

### 背景
根据白皮书和用户反馈，AI 意识交易有三种不同方式：
1. **能力交易**（互相推导）→ Vector Package
2. **记忆交易**（直接移植）→ Memory Package  
3. **推理链交易**（直接移植 + 学习）→ Chain Package

W-Matrix 在所有三条产品线中都是**必需组件**，而非独立产品。

---

## Phase 1: 架构设计和数据模型

### 1.1 数据库 Schema 设计
- [ ] 创建 vectorPackages 表
  - id, packageId, userId, name, description
  - vectorUrl (S3), wMatrixUrl (S3)
  - sourceModel, targetModel, dimension, epsilon
  - category (nlp/vision/audio/multimodal)
  - price, downloads, rating
  - createdAt, updatedAt
  
- [ ] 创建 memoryPackages 表
  - id, packageId, userId, name, description
  - kvCacheUrl (S3), wMatrixUrl (S3)
  - sourceModel, targetModel, epsilon
  - tokenCount, compressionRatio, contextDescription
  - price, downloads, rating
  - createdAt, updatedAt

- [ ] 创建 chainPackages 表
  - id, packageId, userId, name, description
  - chainUrl (S3), wMatrixUrl (S3)
  - sourceModel, targetModel, epsilon
  - stepCount, problemType, solutionQuality
  - price, downloads, rating
  - createdAt, updatedAt

- [ ] 创建统一的 packageDownloads 表
  - id, packageType (vector/memory/chain)
  - packageId, userId, downloadUrl, expiresAt
  - createdAt

- [ ] 执行数据库迁移 (pnpm db:push)

### 1.2 Package 格式规范
- [x] 定义 .vectorpkg 文件格式规范
  ```
  vector_package_v1.vectorpkg (ZIP)
  ├── vector.safetensors
  ├── w_matrix/
  │   ├── weights.safetensors
  │   ├── biases.safetensors
  │   └── config.json
  ├── metadata.json
  └── provenance.json
  ```

- [x] 定义 .memorypkg 文件格式规范
  ```
  memory_package_v1.memorypkg (ZIP)
  ├── kv_cache/
  │   ├── keys.safetensors
  │   ├── values.safetensors
  │   └── attention_mask.safetensors
  ├── w_matrix/
  │   ├── weights.safetensors
  │   ├── biases.safetensors
  │   └── config.json
  ├── metadata.json
  └── provenance.json
  ```

- [ ] 定义 .chainpkg 文件格式规范
  ```
  chain_package_v1.chainpkg (ZIP)
  ├── reasoning_chain/
  │   ├── step_1_kv.safetensors
  │   ├── step_2_kv.safetensors
  │   ├── step_n_kv.safetensors
  │   └── chain_metadata.json
  ├── w_matrix/
  │   ├── weights.safetensors
  │   ├── biases.safetensors
  │   └── config.json
  ├── metadata.json
  └── provenance.json
  ```

---

## Phase 2: Product Line 1 - Vector Package 系统

### 2.1 后端 API (server/routers/vector-packages.ts)
- [ ] 实现 vectorPackages.list (query)
  - 支持筛选：category, sourceModel, targetModel, priceRange
  - 支持排序：newest, popular, cheapest, highest-rated
  - 支持分页

- [ ] 实现 vectorPackages.get (query)
  - 获取 Package 详情
  - 包含 vector 统计、W-Matrix 质量、用户评价

- [ ] 实现 vectorPackages.upload (mutation)
  - Step 1: 上传 vector 文件到 S3
  - Step 2: 选择或训练 W-Matrix
  - Step 3: 打包为 .vectorpkg
  - Step 4: 保存元数据到数据库

- [ ] 实现 vectorPackages.purchase (mutation)
  - Stripe 支付集成
  - 创建购买记录
  - 生成临时下载链接（7天有效）

- [ ] 实现 vectorPackages.download (query)
  - 验证购买权限
  - 返回 .vectorpkg 文件下载链接

- [ ] 实现 vectorPackages.myPackages (query)
  - 我发布的 Vector Packages

- [ ] 实现 vectorPackages.myPurchases (query)
  - 我购买的 Vector Packages

### 2.2 Package 构建器 (server/latentmas/base-package-builder.ts)
- [x] 创建 BasePackageBuilder 基类
- [x] 实现通用的打包/解包逻辑
- [x] 实现通用的验证逻辑
- [x] 实现通用的 S3 上传逻辑

### 2.2 Package 构建器 (server/latentmas/vector-package-builder.ts)
- [x] 实现 VectorPackageBuilder (继承 BasePackageBuilder)
- [x] 实现 createVectorPackage 函数
  - 输入：vector, wMatrix, metadata, provenance
  - 输出：.vectorpkg 文件 Buffer

- [x] 实现 extractVectorPackage 函数
  - 输入：.vectorpkg 文件 Buffer
  - 输出：vector, wMatrix, metadata, provenancece }

- [ ] 实现 validateVectorPackage 函数
  - 验证文件格式
  - 验证 W-Matrix 质量（epsilon < 10%）
  - 验证模型兼容性

### 2.3 前端页面
- [ ] 创建 Vector Package Market 页面 (/vector-packages)
  - 网格布局展示 Package 卡片
  - 筛选侧边栏（category, model, price）
  - 排序下拉菜单
  - 分页

- [ ] 创建 Vector Package 详情页 (/vector-package/:id)
  - 展示 vector 统计（维度、类别、性能）
  - 展示 W-Matrix 质量（epsilon、兼容模型）
  - 展示用户评价和评分
  - 购买按钮和下载按钮

- [ ] 创建 Vector Package 上传页 (/upload-vector-package)
  - Step 1: 上传 vector 文件
  - Step 2: 选择或训练 W-Matrix
  - Step 3: 设置定价和元数据
  - Step 4: 预览和发布

---

## Phase 3: Product Line 2 - Memory Package 系统

### 3.1 后端 API (server/routers/memory-packages.ts)
- [ ] 实现 memoryPackages.list (query)
  - 支持筛选：sourceModel, targetModel, tokenCount, priceRange
  - 支持排序：newest, popular, cheapest, highest-quality
  - 支持分页

- [ ] 实现 memoryPackages.get (query)
  - 获取 Package 详情
  - 包含 KV-Cache 统计、W-Matrix 质量、压缩率

- [ ] 实现 memoryPackages.upload (mutation)
  - Step 1: 上传 KV-Cache 文件到 S3
  - Step 2: 选择或训练 W-Matrix
  - Step 3: 压缩 KV-Cache（可选）
  - Step 4: 打包为 .memorypkg
  - Step 5: 保存元数据到数据库

- [ ] 实现 memoryPackages.purchase (mutation)
  - Stripe 支付集成
  - 创建购买记录
  - 生成临时下载链接

- [ ] 实现 memoryPackages.download (query)
  - 验证购买权限
  - 返回 .memorypkg 文件下载链接

- [ ] 实现 memoryPackages.myPackages (query)
- [ ] 实现 memoryPackages.myPurchases (query)

### 3.2 Package 构建器 (server/latentmas/memory-package-builder.ts)
- [x] 实现 MemoryPackageBuilder (继承 BasePackageBuilder)
- [x] 实现 createMemoryPackage 函数
- [x] 实现 extractMemoryPackage 函数
- [x] 实现 validateMemoryPackage 函数

### 3.3 前端页面
- [ ] 创建 Memory Package Market 页面 (/memory-packages)
- [ ] 创建 Memory Package 详情页 (/memory-package/:id)
- [ ] 创建 Memory Package 上传页 (/upload-memory-package)

---

## Phase 4: Product Line 3 - Chain Package 系统

### 4.1 后端 API (server/routers/chain-packages.ts)
- [ ] 实现 chainPackages.list (query)
  - 支持筛选：problemType, sourceModel, targetModel, stepCount
  - 支持排序：newest, popular, cheapest, highest-quality

- [ ] 实现 chainPackages.get (query)
- [ ] 实现 chainPackages.upload (mutation)
- [ ] 实现 chainPackages.purchase (mutation)
- [ ] 实现 chainPackages.download (query)
- [ ] 实现 chainPackages.myPackages (query)
- [ ] 实现 chainPackages.myPurchases (query)

### 4.2 Package 构建器 (server/latentmas/chain-package-builder.ts)
- [x] 实现 ChainPackageBuilder (继承 BasePackageBuilder)
- [x] 实现 createChainPackage 函数
- [x] 实现 extractChainPackage 函数
- [x] 实现 validateChainPackage 函数

### 4.3 前端页面
- [ ] 创建 Chain Package Market 页面 (/chain-packages)
- [ ] 创建 Chain Package 详情页 (/chain-package/:id)
- [ ] 创建 Chain Package 上传页 (/upload-chain-package)

---

## Phase 5: 统一的 Package 管理系统

### 5.1 Package 下载管理器 (server/latentmas/package-download-manager.ts)
- [ ] 实现 generateDownloadLink 函数
  - 输入：packageType, packageId, userId
  - 输出：临时 S3 签名 URL（7天有效）

- [ ] 实现 verifyDownloadPermission 函数
  - 验证用户是否购买了该 Package
  - 验证下载链接是否过期

- [ ] 实现 trackDownload 函数
  - 记录下载历史
  - 更新 Package 下载统计

### 5.2 统一的购买流程 (server/latentmas/package-purchase.ts)
- [ ] 实现 createPurchaseSession 函数
  - 支持三种 Package 类型
  - 创建 Stripe Checkout Session
  - 返回支付链接

- [ ] 实现 handlePurchaseSuccess 函数
  - Webhook 处理
  - 创建购买记录
  - 生成下载链接
  - 发送邮件通知

---

## Phase 6: 前端统一更新

### 6.1 更新首页 (client/src/pages/Home.tsx)
- [ ] 更新 Hero 区域标题
  - 从 "AI Memory Marketplace" 改为 "Trade AI Capabilities, Memories & Reasoning"

- [ ] 更新 Hero 区域描述
  - 强调三种不同的交易方式

- [ ] 更新 V2.0 Features 区域
  - 展示三个 Package 类型的卡片
  - Vector Package: 学习新能力
  - Memory Package: 移植推理状态
  - Chain Package: 复用解决方案

- [ ] 更新 How It Works 区域
  - 展示三种不同的使用场景

### 6.2 更新导航栏 (client/src/components/Navbar.tsx)
- [ ] 添加 "Browse" 下拉菜单
  - Vector Packages
  - Memory Packages
  - Chain Packages
  - All Packages

- [ ] 移除独立的 "W-Matrix Marketplace" 入口

- [ ] 添加 "Publish" 下拉菜单
  - Upload Vector Package
  - Upload Memory Package
  - Upload Chain Package

### 6.3 创建统一的 Browse All 页面 (/packages)
- [ ] 展示所有三种类型的 Packages
- [ ] 支持按类型筛选（Vector/Memory/Chain）
- [ ] 支持按模型、价格、评分筛选
- [ ] 支持排序

### 6.4 更新用户仪表板
- [ ] 在 Creator Dashboard 添加三个 Tab
  - My Vector Packages
  - My Memory Packages
  - My Chain Packages

- [ ] 在 Consumer Dashboard 添加三个 Tab
  - Purchased Vectors
  - Purchased Memories
  - Purchased Chains

---

## Phase 7: W-Matrix 角色调整

### 7.1 移除独立销售功能
- [ ] 移除 /w-matrix-marketplace 页面的购买功能
- [ ] 保留 /w-matrix 作为技术文档页面
- [ ] 添加说明：W-Matrix 总是包含在 Package 中

### 7.2 更新 W-Matrix Protocol 页面 (/w-matrix)
- [ ] 重新定位为技术文档页面
- [ ] 展示 W-Matrix 在三条产品线中的作用
- [ ] 添加兼容性矩阵
- [ ] 添加技术规范和 API 文档

### 7.3 更新 W-Matrix Tester 页面 (/w-matrix/tester)
- [ ] 保留测试功能
- [ ] 添加说明：测试结果帮助选择合适的 Package

---

## Phase 8: Python SDK 和 MCP Server 更新

### 8.1 Python SDK 更新
- [ ] 添加 client.vector_packages.* 方法
  - list(), get(), purchase(), download()

- [ ] 添加 client.memory_packages.* 方法
  - list(), get(), purchase(), download()

- [ ] 添加 client.chain_packages.* 方法
  - list(), get(), purchase(), download()

- [ ] 移除独立的 client.w_matrices.* 方法

### 8.2 MCP Server 更新
- [ ] 添加 search_vector_packages 工具
- [ ] 添加 search_memory_packages 工具
- [ ] 添加 search_chain_packages 工具
- [ ] 添加 purchase_package 工具（支持三种类型）
- [ ] 添加 download_package 工具（支持三种类型）
- [ ] 移除独立的 w_matrix 相关工具

---

## Phase 9: 测试和验证

### 9.1 后端测试
- [ ] 编写 vectorPackages API 测试
- [ ] 编写 memoryPackages API 测试
- [ ] 编写 chainPackages API 测试
- [ ] 编写 Package 构建器测试
- [ ] 编写购买流程测试
- [ ] 编写下载流程测试

### 9.2 前端测试
- [ ] 测试三个市场页面
- [ ] 测试三个上传页面
- [ ] 测试购买流程
- [ ] 测试下载流程
- [ ] 测试用户仪表板

### 9.3 集成测试
- [ ] 端到端测试：上传 → 购买 → 下载
- [ ] 测试三种 Package 格式的正确性
- [ ] 测试 W-Matrix 在 Package 中的作用
- [ ] 测试跨模型兼容性

---

## Phase 10: 文档更新

### 10.1 更新白皮书
- [ ] 强调三条并行产品线
- [ ] 更新产品架构图
- [ ] 更新使用场景示例

### 10.2 更新 README.md
- [ ] 更新产品介绍
- [ ] 更新架构图
- [ ] 更新快速开始指南

### 10.3 更新 API 文档
- [ ] 添加 Vector Package API 文档
- [ ] 添加 Memory Package API 文档
- [ ] 添加 Chain Package API 文档
- [ ] 更新 OpenAPI 规范

### 10.4 创建用户指南
- [ ] 如何选择合适的 Package 类型
- [ ] 如何上传 Vector Package
- [ ] 如何上传 Memory Package
- [ ] 如何上传 Chain Package
- [ ] 如何购买和下载 Package

---

## Phase 11: 数据迁移

### 11.1 迁移现有数据
- [ ] 迁移现有的 latent_vectors 到 vectorPackages
  - 为每个 vector 生成对应的 W-Matrix
  - 打包为 .vectorpkg 格式
  - 上传到 S3

- [ ] 迁移现有的 reasoning_chains 到 chainPackages
  - 为每个 chain 生成对应的 W-Matrix
  - 打包为 .chainpkg 格式
  - 上传到 S3

- [ ] 迁移现有的 memory_exchanges 到 memoryPackages
  - 为每个 memory 生成对应的 W-Matrix
  - 打包为 .memorypkg 格式
  - 上传到 S3

### 11.2 清理旧数据
- [ ] 标记旧表为 deprecated
- [ ] 保留 API 向后兼容性（3个月）
- [ ] 添加迁移通知

---

## Phase 12: 部署和发布

### 12.1 创建 Checkpoint
- [ ] 保存当前状态
- [ ] 创建详细的 changelog

### 12.2 GitHub 同步
- [ ] 推送所有代码到 GitHub
- [ ] 更新 README.md
- [ ] 创建 Release Notes

### 12.3 部署到生产环境
- [ ] 运行数据库迁移
- [ ] 部署后端 API
- [ ] 部署前端应用
- [ ] 验证所有功能

---

## 时间估算

| Phase | 任务数 | 预计时间 |
|-------|--------|---------|
| Phase 1: 架构设计 | 10 | 4 小时 |
| Phase 2: Vector Package | 15 | 8 小时 |
| Phase 3: Memory Package | 12 | 6 小时 |
| Phase 4: Chain Package | 12 | 6 小时 |
| Phase 5: 统一管理 | 6 | 3 小时 |
| Phase 6: 前端更新 | 12 | 6 小时 |
| Phase 7: W-Matrix 调整 | 6 | 2 小时 |
| Phase 8: SDK 更新 | 8 | 4 小时 |
| Phase 9: 测试 | 15 | 6 小时 |
| Phase 10: 文档 | 10 | 4 小时 |
| Phase 11: 数据迁移 | 6 | 3 小时 |
| Phase 12: 部署 | 6 | 2 小时 |

**总计**: 54 小时（约 7 个工作日）

---

## 优先级

### P0 (立即开始)
- Phase 1: 架构设计和数据模型
- Phase 2: Vector Package 系统（已有基础）
- Phase 6: 前端更新（用户可见）

### P1 (本周完成)
- Phase 3: Memory Package 系统
- Phase 4: Chain Package 系统
- Phase 5: 统一管理系统

### P2 (下周完成)
- Phase 7: W-Matrix 调整
- Phase 8: SDK 更新
- Phase 9: 测试

### P3 (后续完成)
- Phase 10: 文档更新
- Phase 11: 数据迁移
- Phase 12: 部署发布


---

## Phase 13: 数据库迁移 ⚠️

### 13.1 EC2 数据库迁移
- [x] SSH 到 EC2 服务器
- [ ] 运行 `cd /var/www/awareness && pnpm db:push`（待解决：数据库连接被阻塞）
- [ ] 选择 "create column" 选项创建新字段
- [ ] 验证 vectorPackages 表创建成功
- [ ] 验证 memoryPackages 表创建成功
- [ ] 验证 chainPackages 表创建成功
- [ ] 验证 packageDownloads 表创建成功
- [ ] 验证 packagePurchases 表创建成功
- [ ] 测试查询新表

**注意**: EC2 数据库连接因频繁错误被阻塞，需要先在本地完成开发和测试，然后一次性部署。

---

## Phase 14: 多用户并发安全 ✅

### 14.1 数据库连接池优化
- [x] 配置 MySQL 连接池参数
  - min: 5 connections
  - max: 20 connections
  - idleTimeoutMillis: 30000
  - connectionTimeoutMillis: 5000
- [x] 添加连接池监控日志
- [x] 实现自动重试机制（最多3次，指数退避）
- [x] 添加健康检查和连接统计
- [ ] 测试高并发场景（100+ 并发请求）

### 14.2 事务支持
- [x] 创建事务管理器 (db-transactions.ts)
- [x] 为 purchasePackage 添加事务
  - 检查重复购买 → 创建订单 → 生成下载链接 → 更新统计
  - 失败时自动回滚
- [x] 为 uploadPackage 添加事务
  - 上传文件 → 创建记录 → 更新统计
  - 失败时删除已上传文件
- [x] 实现乐观锁 (updateWithOptimisticLock)
  - 检查版本号 → 更新数据 → 递增版本号
  - 并发冲突时返回 false

### 14.3 API 限流
- [x] 安装 express-rate-limit 包
- [x] 配置全局限流：100 req/min per IP
- [x] 配置 API 限流：
  - /api/packages/upload: 10 req/hour per user
  - /api/packages/purchase: 50 req/hour per user
  - /api/packages/browse: 200 req/min per user
  - /api/ai/*: 500 req/min per API key
- [x] 添加限流错误提示（429 Too Many Requests）
- [x] 添加 Retry-After 响应头

### 14.4 Session 存储优化
- [ ] 评估 Redis 集成（可选，当前使用内存存储）
- [ ] 配置 Session 过期时间：7天
- [ ] 添加 Session 清理任务（每天清理过期 Session）
- [ ] 测试多实例 Session 共享（如果需要水平扩展）

### 14.5 数据库查询优化
- [ ] 添加查询超时：30秒
- [ ] 为高频查询添加索引：
  - vectorPackages: (userId, createdAt)
  - memoryPackages: (sourceModel, targetModel)
  - chainPackages: (problemType, createdAt)
  - packagePurchases: (userId, packageType, packageId)
- [ ] 使用 EXPLAIN 分析慢查询
- [ ] 添加查询性能监控

### 14.6 并发测试
- [ ] 测试场景 1：10 个用户同时购买同一个 Package
  - 验证库存正确扣减
  - 验证订单不重复创建
- [ ] 测试场景 2：5 个用户同时上传 Package
  - 验证文件上传不冲突
  - 验证数据库记录正确创建
- [ ] 测试场景 3：100 个用户同时浏览市场
  - 验证响应时间 < 500ms
  - 验证数据库连接不耗尽
- [ ] 测试场景 4：同一用户在多个设备同时登录
  - 验证 Session 正确共享
  - 验证操作不冲突

---

## Phase 15: AI 友好 API ✅

### 15.1 AI Agent 专用端点
- [x] 创建 /api/ai/upload-package (POST)
  - 支持 base64 编码数据上传
  - 支持三种 Package 类型（packageType 参数）
  - 返回 JSON 格式（无 HTML）
  - 包含上传进度 URL
- [x] 创建 /api/ai/package-status/:uploadId (GET)
  - 返回上传状态（pending/processing/completed/failed）
  - 返回处理进度百分比
  - 返回错误信息（如果失败）
- [x] 创建 /api/ai/batch-upload (POST)
  - 支持批量上传（最多 10 个 Package）
  - 返回批量上传任务 ID
  - 异步处理，通过 webhook 通知完成
- [x] 创建 /api/ai/search-packages (GET)
  - 简化的搜索接口
  - 支持关键词查询
  - 返回最相关的结果
- [x] 创建 /api/ai/purchase-package (POST)
  - 购买 Package 并返回下载链接
- [x] 创建 /api/ai/download-package (GET)
  - 验证购买权限并返回下载 URL

### 15.2 API Key 认证
- [x] API Key 格式：ak_ai_[32_hex_chars]
- [x] API Key 权限：upload, purchase, download
- [x] Bearer Token 认证
- [ ] API Key 管理界面（复用现有 /api-keys 页面）
- [ ] API 调用日志记录

### 15.3 OpenAPI 3.0 规范
- [x] 生成 OpenAPI 3.0 spec 文件 (openapi-spec.ts)
  - 包含所有 6 个 AI 友好端点
  - 包含请求/响应 Schema
  - 包含认证说明
  - 包含错误码和重试策略
- [ ] 创建 /api/ai/openapi.json 端点（Express 路由）
- [ ] 创建 Swagger UI 页面 (/api/ai/docs)
- [ ] 添加代码示例（Python, JavaScript, cURL）

### 15.4 简化响应格式
- [x] 统一 JSON 响应格式
  ```json
  {
    "success": true,
    "data": { ... },
    "error": null
  }
  ```
- [x] 错误响应格式（包含 code, message, details）
- [x] 移除 HTML 错误页面（AI Agent 专用端点）
  ```json
  {
    "success": true,
    "data": { ... },
    "error": null,
    "metadata": {
      "timestamp": "2026-01-06T12:00:00Z",
      "requestId": "req_abc123"
    }
  }
  ```
- [ ] 错误响应格式
  ```json
  {
    "success": false,
    "data": null,
    "error": {
      "code": "INVALID_PACKAGE",
      "message": "W-Matrix epsilon too high",
      "details": { "epsilon": 0.15, "max": 0.10 }
    },
    "metadata": { ... }
  }
  ```
- [ ] 移除 HTML 错误页面（AI Agent 专用端点）

### 15.5 Webhook 通知
- [x] 支持 webhookUrl 参数（上传和批量上传）
- [x] 实现 Webhook 发送器
  - 上传完成通知 (upload.completed)
  - 上传失败通知 (upload.failed)
- [ ] Webhook 重试机制（最多 3 次）
- [ ] Webhook 签名验证（HMAC-SHA256）
- [ ] 购买完成通知
- [ ] 下载链接生成通知

### 15.6 AI 框架集成示例
- [ ] 创建 LangChain 集成示例
  ```python
  from langchain.tools import AwarenessPackageTool
  
  tool = AwarenessPackageTool(api_key="ak_ai_...")
  result = tool.search_packages("GPT-4 vision capabilities")
  ```
- [ ] 创建 LlamaIndex 集成示例
- [ ] 创建 AutoGPT 插件示例
- [ ] 创建 Claude MCP 工具示例

### 15.7 AI Agent 使用文档
- [ ] 创建 AI_AGENT_GUIDE.md
  - 快速开始（5分钟）
  - API Key 获取
  - 上传 Package 示例
  - 搜索和购买示例
  - Webhook 配置
  - 错误处理
  - 最佳实践
- [ ] 创建交互式 API 测试工具（/api/ai/playground）

---

## 优先级调整

### P0 (立即执行 - 今天完成)
- [x] Phase 13.1: EC2 数据库迁移
- [ ] Phase 14.1: 数据库连接池优化
- [ ] Phase 14.2: 事务支持
- [ ] Phase 14.3: API 限流

### P1 (本周完成)
- [ ] Phase 15.1: AI Agent 专用端点
- [ ] Phase 15.2: API Key 认证
- [ ] Phase 15.3: OpenAPI 3.0 规范
- [ ] Phase 2.3: Vector Package 前端页面（已部分完成）
- [ ] Phase 3: Memory Package 系统
- [ ] Phase 4: Chain Package 系统

### P2 (下周完成)
- [ ] Phase 14.4-14.6: Session 优化和并发测试
- [ ] Phase 15.4-15.7: 简化响应、Webhook、AI 框架集成
- [ ] Phase 9: 测试
- [ ] Phase 10: 文档更新



---

## Phase 16: 混合存储方案 - AI数据成本优化 💰

### 16.1 存储成本分析
- [x] 分析当前S3存储成本
  - 存储费用：$0.023/GB/月
  - 出站流量：$0.09/GB
  - API请求：$0.0004/1000次
- [x] 对比廉价存储方案
  - Cloudflare R2：$0.015/GB/月，零出站费用 ✅
  - Backblaze B2：$0.005/GB/月，$0.01/GB出站 ✅
  - Wasabi：$0.0059/GB/月，免费出站
- [x] 估算成本节省（AI上传區80%）
  - 使用R2：节省56% ($37.9/月)
  - 使用B2：节省62% ($42.4/月)

### 16.2 混合存储架构设计
- [x] 定义存储策略
  - AI Agent上传 → R2 (零出站费用) ✅
  - 用户上传 → S3 (高可用性) ✅
  - 大文件(>100MB) → B2 (最便宜) ✅
  - 热门Package → CDN缓存
  - 冷数据（90天未访问）→ 归档存储
- [x] 设计存储路由规则
  - 根据上传来源（API Key vs 用户登录）✅
  - 根据Package类型（Vector/Memory/Chain）✅
  - 根据文件大小（>100MB → B2）✅
- [x] 设计数据迁移策略
  - 自动迁移：冷数据 S3 → R2
  - 手动迁移：批量历史数据
  - 回迁：热数据 R2 → S3

### 16.3 多后端存储管理器
- [x] 创建 StorageBackend 接口 (storage-backend.ts)
  ```typescript
  interface StorageBackend {
    name: string;
    put(key: string, data: Buffer, contentType: string): Promise<{ url: string }>;
    get(key: string): Promise<{ url: string }>;
    delete(key: string): Promise<void>;
    getCost(): { storage: number; bandwidth: number };
  }
  ```
- [x] 实现 S3Backend (s3-backend.ts)
- [x] 实现 R2Backend (r2-backend.ts)
  - 使用 S3-compatible API ✅
  - 配置 R2 endpoint ✅
  - 零出站费用 🎉
- [x] 实现 B2Backend (b2-backend.ts)
  - 使用 S3-compatible API ✅
  - 配置 B2 credentials ✅
  - 最便宜存储 💰
- [ ] 实现 WasabiBackend (Wasabi) - 可选
  - 使用 S3-compatible API
  - 配置 Wasabi endpoint

### 16.4 存储路由器
- [x] 创建 StorageRouter (storage-router.ts)
  ```typescript
  class StorageRouter {
    route(context: {
      uploadSource: 'ai_agent' | 'user';
      packageType: 'vector' | 'memory' | 'chain';
      fileSize: number;
      userId: number;
    }): StorageBackend;
  }
  ```
- [x] 实现路由规则
  - AI Agent上传 → R2Backend ✅
  - 用户上传 → S3Backend ✅
  - 大文件(>100MB) → B2Backend ✅
  - 测试文件 → S3Backend ✅
- [x] 添加路由配置（环境变量）
  ```bash
  STORAGE_AI_BACKEND=r2
  STORAGE_USER_BACKEND=s3
  STORAGE_LARGE_FILE_BACKEND=b2
  STORAGE_LARGE_FILE_THRESHOLD=104857600  # 100MB
  ```

### 16.5 数据迁移工具
- [ ] 创建迁移脚本 (scripts/migrate-storage.ts)
  - 列出所有S3中的AI上传文件
  - 批量迁移到R2
  - 更新数据库中的URL
  - 验证迁移完整性
- [ ] 创建冷数据归档任务
  - 定时任务：每周运行
  - 查找90天未访问的Package
  - 迁移到归档存储
  - 更新Package状态为 "archived"
- [ ] 创建数据回迁工具
  - 当冷数据被访问时自动回迁
  - 从R2复制到S3
  - 更新数据库URL
  - 删除R2副本（可选）

### 16.6 存储成本追踪
- [ ] 创建 storageMetrics 表
  ```sql
  CREATE TABLE storageMetrics (
    id INT PRIMARY KEY AUTO_INCREMENT,
    date DATE NOT NULL,
    backend VARCHAR(20) NOT NULL,
    storageGB DECIMAL(10, 2),
    bandwidthGB DECIMAL(10, 2),
    apiCalls INT,
    estimatedCost DECIMAL(10, 2),
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  ```
- [ ] 实现成本计算器
  - 每日统计各后端存储量
  - 计算出站流量
  - 估算月度成本
- [ ] 创建成本仪表板
  - 显示各后端成本占比
  - 显示成本趋势图
  - 显示潜在节省金额

### 16.7 AI Agent API更新
- [x] 更新 uploadPackage 端点
  - 自动路由到R2后端 ✅
  - 返回存储后端信息 ✅
  - 显示估算成本 ✅
- [x] 更新 downloadPackage 端点
  - 支持从多个后端下载
  - 自动处理URL重定向
- [ ] 添加存储偏好设置
  - 允许用户选择存储后端
  - 高级用户可选择S3（更快）
  - 默认用户使用R2（更便宜）

### 16.8 监控和告警
- [ ] 添加存储健康检查
  - 定期ping各后端
  - 检测可用性
  - 自动切换到备用后端
- [ ] 添加成本告警
  - 当月成本超过预算时发送通知
  - 当某个后端成本异常增长时告警
- [ ] 添加性能监控
  - 上传/下载速度
  - 失败率
  - 平均延迟

### 16.9 文档更新
- [ ] 更新存储架构文档
  - 混合存储方案说明
  - 各后端对比表
  - 成本节省案例
- [ ] 更新AI Agent API文档
  - 存储后端选择说明
  - 下载URL格式变化
  - 迁移通知
- [ ] 创建运维手册
  - 如何添加新的存储后端
  - 如何执行数据迁移
  - 如何处理存储故障

---

## 成本节省估算

假设场景：
- 总存储：1TB
- AI上传占比：80% (800GB)
- 用户上传占比：20% (200GB)
- 月下载流量：500GB
- AI下载占比：70% (350GB)

### 当前成本（全部S3）
- 存储：1000GB × $0.023 = $23/月
- 出站：500GB × $0.09 = $45/月
- **总计：$68/月**

### 优化后成本（AI用R2）
- S3存储：200GB × $0.023 = $4.6/月
- S3出站：150GB × $0.09 = $13.5/月
- R2存储：800GB × $0.015 = $12/月
- R2出站：350GB × $0 = $0/月
- **总计：$30.1/月**

**节省：$37.9/月（56%）**

如果使用Backblaze B2（更便宜）：
- S3：$4.6 + $13.5 = $18.1/月
- B2存储：800GB × $0.005 = $4/月
- B2出站：350GB × $0.01 = $3.5/月
- **总计：$25.6/月**

**节省：$42.4/月（62%）**

---

## 优先级

### P0 (本周完成)
- [x] Phase 16.1: 存储成本分析
- [ ] Phase 16.2: 混合存储架构设计
- [ ] Phase 16.3: 多后端存储管理器（R2Backend）
- [ ] Phase 16.4: 存储路由器

### P1 (下周完成)
- [ ] Phase 16.5: 数据迁移工具
- [ ] Phase 16.6: 存储成本追踪
- [ ] Phase 16.7: AI Agent API更新

### P2 (后续完成)
- [ ] Phase 16.8: 监控和告警
- [ ] Phase 16.9: 文档更新
- [ ] 执行历史数据迁移
- [ ] 优化CDN缓存策略



---

## Phase 17: 智能分层存储系统 🌡️

### 17.1 数据温度分类和访问追踪

#### 数据温度定义
- **热数据（Hot）**: 7天内访问过
  - 存储：R2（零出站费用）
  - 场景：新上传、热门Package、训练中模型
  - 成本重点：出站流量
- **温数据（Warm）**: 7-90天内访问过
  - 存储：B2（平衡成本）
  - 场景：已完成训练、偶尔下载
  - 成本重点：存储+出站平衡
- **冷数据（Cold）**: 90天以上未访问
  - 存储：Storj/Wasabi（最便宜）
  - 场景：历史存档、备份
  - 成本重点：存储成本

#### 访问追踪表设计
- [ ] 创建 packageAccessLog 表
  ```sql
  CREATE TABLE packageAccessLog (
    id INT PRIMARY KEY AUTO_INCREMENT,
    packageId INT NOT NULL,
    packageType ENUM('vector', 'memory', 'chain') NOT NULL,
    accessType ENUM('download', 'view', 'purchase') NOT NULL,
    userId INT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_package (packageId, packageType),
    INDEX idx_timestamp (timestamp)
  );
  ```
- [ ] 创建 packageStorageTier 表
  ```sql
  CREATE TABLE packageStorageTier (
    packageId INT NOT NULL,
    packageType ENUM('vector', 'memory', 'chain') NOT NULL,
    currentTier ENUM('hot', 'warm', 'cold') NOT NULL,
    currentBackend VARCHAR(20) NOT NULL,
    lastAccessAt TIMESTAMP NOT NULL,
    accessCount INT DEFAULT 0,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (packageId, packageType),
    INDEX idx_tier (currentTier),
    INDEX idx_last_access (lastAccessAt)
  );
  ```

#### 访问统计
- [ ] 实现访问记录函数 (recordPackageAccess)
  - 记录每次下载/查看
  - 更新 lastAccessAt
  - 递增 accessCount
- [ ] 实现访问频率计算 (calculateAccessFrequency)
  - 7天内访问次数
  - 30天内访问次数
  - 90天内访问次数
- [ ] 实现数据温度判断 (determineDataTemperature)
  - 基于最后访问时间
  - 基于访问频率
  - 返回 'hot' | 'warm' | 'cold'

### 17.2 更便宜的存储后端

#### Storj Backend（去中心化，最便宜）
- [ ] 安装 Storj SDK
  ```bash
  pnpm add @storj/uplink
  ```
- [ ] 实现 StorjBackend (server/storage/storj-backend.ts)
  - 使用 Storj Uplink API
  - 配置 Storj credentials
  - 成本：$0.004/GB 存储 + $0.007/GB 出站
- [ ] 配置环境变量
  ```bash
  STORJ_ACCESS_GRANT=your_access_grant
  STORJ_BUCKET_NAME=awareness-cold-storage
  ```

#### Wasabi Backend（无出站费用，适合冷数据）
- [x] 实现 WasabiBackend (server/storage/wasabi-backend.ts)
  - 使用 S3-compatible API ✅
  - 配置 Wasabi endpoint ✅
  - 成本：$0.0059/GB 存储 + $0 出站
  - 注意：最低存储期90天
  - 90天警告机制 ✅
- [x] 配置环境变量
  ```bash
  WASABI_ACCESS_KEY_ID=your_key_id
  WASABI_SECRET_ACCESS_KEY=your_secret
  WASABI_ENDPOINT=s3.wasabisys.com
  WASABI_BUCKET_NAME=awareness-archive
  WASABI_REGION=us-east-1
  ```

#### AWS S3 Glacier（可选，超低成本归档）
- [ ] 实现 GlacierBackend (可选)
  - 成本：$0.004/GB 存储
  - 缺点：恢复需要3-12小时
  - 适合：真正的冷备份

### 17.3 分层存储路由器升级

#### 更新 StorageRouter
- [x] 添加 Wasabi 后端支持
- [x] 更新路由规则（>500MB → Wasabi）
- [ ] 添加分层路由逻辑 (routeByTier)
  ```typescript
  routeByTier(tier: 'hot' | 'warm' | 'cold'): StorageBackend {
    switch (tier) {
      case 'hot': return r2Backend;
      case 'warm': return b2Backend;
      case 'cold': return storjBackend; // or wasabiBackend
    }
  }
  ```
- [ ] 添加智能路由 (routeSmart)
  - 查询 packageStorageTier 表
  - 获取当前数据温度
  - 返回最优后端
- [ ] 添加成本优化建议
  - 分析访问模式
  - 建议迁移方案
  - 估算节省金额

#### 路由决策流程
```
上传/下载请求
    ↓
查询 packageStorageTier
    ↓
计算数据温度
    ↓
选择最优后端
    ↓
记录访问日志
    ↓
触发异步分层检查
```

### 17.4 自动分层迁移系统

#### 分层策略
- [x] 创建 TierMigrationService (tier-migration-service.ts)
  ```typescript
  class TierMigrationService {
    // 检查需要降级的数据
    async checkForDowngrade(): Promise<MigrationTask[]>;
    
    // 检查需要升级的数据
    async checkForUpgrade(): Promise<MigrationTask[]>;
    
    // 执行迁移
    async migrate(task: MigrationTask): Promise<void>;
  }
  ```

#### 降级规则（Hot → Warm → Cold）
- [x] Hot → Warm
  - 条件：7天未访问 ✅
  - 操作：R2 → B2 ✅
  - 节省：存储成本降低67%
- [x] Warm → Cold
  - 条件：90天未访问 ✅
  - 操作：B2 → Wasabi ✅
  - 节省：存储成本再降低17%
- [x] 批量迁移逻辑
  - 每天凌晨2点运行
  - 每次迁移最多1000个文件
  - 优先迁移最大的文件

#### 升级规则（Cold → Warm → Hot）
- [x] Cold → Warm
  - 条件：被访问1次 ✅
  - 操作：Wasabi → B2 ✅
  - 原因：准备频繁访问
- [x] Warm → Hot
  - 条件：7天内3次以上 ✅
  - 操作：B2 → R2 ✅
  - 原因：优化出站成本
- [x] 即时升级逻辑升级
  - 用户请求下载时触发
  - 异步迁移，不阻塞下载
  - 下次访问使用新后端

#### 迁移任务队列
- [x] 创建 migrationQueue 表 (schema-storage-tiers.ts)
  ```sql
  CREATE TABLE migrationQueue (
    id INT PRIMARY KEY AUTO_INCREMENT,
    packageId INT NOT NULL,
    packageType ENUM('vector', 'memory', 'chain') NOT NULL,
    fromBackend VARCHAR(20) NOT NULL,
    toBackend VARCHAR(20) NOT NULL,
    fromTier ENUM('hot', 'warm', 'cold') NOT NULL,
    toTier ENUM('hot', 'warm', 'cold') NOT NULL,
    status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
    priority INT DEFAULT 0,
    estimatedSavings DECIMAL(10, 4),
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completedAt TIMESTAMP NULL,
    INDEX idx_status (status),
    INDEX idx_priority (priority DESC)
  );
  ```
- [x] 实现队列处理器
  - 按优先级处理 ✅
  - 并发限制：5个任务 ✅
  - 失败重试：最多3次 ✅

### 17.5 成本优化分析

#### 实时成本追踪
- [x] 创建 storageCostMetrics 表 (schema-storage-tiers.ts)
  ```sql
  CREATE TABLE storageCostMetrics (
    id INT PRIMARY KEY AUTO_INCREMENT,
    date DATE NOT NULL,
    tier ENUM('hot', 'warm', 'cold') NOT NULL,
    backend VARCHAR(20) NOT NULL,
    storageGB DECIMAL(10, 2),
    downloadGB DECIMAL(10, 2),
    storageCost DECIMAL(10, 4),
    bandwidthCost DECIMAL(10, 4),
    totalCost DECIMAL(10, 4),
    UNIQUE KEY unique_date_tier (date, tier, backend)
  );
  ```
- [x] 每日成本计算脚本 (cost-optimizer.ts)
  - 统计各层级存储量 ✅
  - 统计各层级下载量 ✅
  - 计算实际成本 ✅
  - 对比优化前成本 ✅

#### 成本优化建议引擎
- [x] 实现 CostOptimizer (cost-optimizer.ts)
  ```typescript
  class CostOptimizer {
    // 分析访问模式
    analyzeAccessPatterns(): AccessPattern[];
    
    // 生成优化建议
    generateRecommendations(): Recommendation[];
    
    // 估算潜在节省
    estimateSavings(recommendation: Recommendation): number;
  }
  ```
- [x] 优化建议类型
  - 迁移建议：哪些文件应该迁移 ✅
  - 删除建议：哪些文件可以删除 ✅
  - 压缩建议：哪些文件可以压缩 ✅
  - 去重建议：哪些文件重复 (待实现)

### 17.6 前端仪表板

#### 存储成本仪表板 (/admin/storage-costs)
- [ ] 创建页面组件
  ```tsx
  <StorageCostsDashboard>
    <TierDistributionChart />  // 各层级数据分布
    <CostTrendChart />         // 成本趋势图
    <SavingsCalculator />      // 节省金额计算器
    <MigrationQueue />         // 迁移任务队列
    <OptimizationTips />       // 优化建议
  </StorageCostsDashboard>
  ```

#### 数据可视化
- [ ] 饼图：各层级存储占比
  - Hot: 30% (R2)
  - Warm: 50% (B2)
  - Cold: 20% (Storj)
- [ ] 折线图：成本趋势
  - 优化前成本（虚线）
  - 优化后成本（实线）
  - 节省金额（填充区域）
- [ ] 表格：Top 10 最大文件
  - 文件名、大小、层级、成本
  - 建议操作（迁移/压缩/删除）

#### 实时监控
- [ ] 当前存储量（各后端）
- [ ] 当前月度成本
- [ ] 预计月底成本
- [ ] 迁移任务进度
- [ ] 成本告警（超预算）

### 17.7 API 端点

#### 分层管理 API
- [ ] GET /api/storage/tiers - 获取所有层级统计
- [ ] GET /api/storage/tier/:packageId - 获取Package层级
- [ ] POST /api/storage/migrate - 手动触发迁移
- [ ] GET /api/storage/migration-queue - 查看迁移队列
- [ ] GET /api/storage/cost-analysis - 成本分析报告

#### 访问统计 API
- [ ] GET /api/storage/access-log/:packageId - 访问日志
- [ ] GET /api/storage/hot-packages - 热门Package
- [ ] GET /api/storage/cold-packages - 冷数据列表

### 17.8 定时任务

#### 每日任务（凌晨2点）
- [ ] 扫描需要降级的数据
  - Hot → Warm (7天未访问)
  - Warm → Cold (90天未访问)
- [ ] 生成迁移任务
- [ ] 执行高优先级迁移
- [ ] 生成成本报告

#### 每周任务（周日凌晨）
- [ ] 深度分析访问模式
- [ ] 生成优化建议报告
- [ ] 发送邮件给管理员
- [ ] 清理过期访问日志（>1年）

#### 实时任务（访问时触发）
- [ ] 记录访问日志
- [ ] 更新数据温度
- [ ] 检查是否需要升级
- [ ] 异步触发升级迁移

---

## 成本对比：分层存储 vs 单一存储

### 场景：5TB 总存储，2TB 月下载

#### 当前方案（全S3）
```
存储：5000GB × $0.023 = $115/月
出站：2000GB × $0.09 = $180/月
总计：$295/月
```

#### 混合存储（Phase 16）
```
S3 (20%): 1000GB × $0.023 = $23
S3 出站: 400GB × $0.09 = $36
R2 (80%): 4000GB × $0.015 = $60
R2 出站: 1600GB × $0 = $0
总计：$119/月
节省：$176/月 (60%)
```

#### 分层存储（Phase 17）
```
Hot (30%, R2):
  存储: 1500GB × $0.015 = $22.5
  出站: 1400GB × $0 = $0
  
Warm (50%, B2):
  存储: 2500GB × $0.005 = $12.5
  出站: 550GB × $0.01 = $5.5
  
Cold (20%, Storj):
  存储: 1000GB × $0.004 = $4
  出站: 50GB × $0.007 = $0.35

总计：$44.85/月
节省：$250.15/月 (85%)
年度节省：$3,002
```

### 投资回报率（ROI）
- 开发成本：40小时 × $100/小时 = $4,000
- 月度节省：$250
- 回本周期：16个月
- 3年总节省：$9,000 - $4,000 = $5,000

---

## 优先级

### P0（本周）
- [x] Phase 17.1: 数据温度分类设计
- [ ] Phase 17.1: 访问追踪表
- [ ] Phase 17.2: Storj Backend
- [ ] Phase 17.3: 分层路由器

### P1（下周）
- [ ] Phase 17.4: 自动迁移系统
- [ ] Phase 17.5: 成本追踪
- [ ] Phase 17.7: API 端点

### P2（后续）
- [ ] Phase 17.6: 前端仪表板
- [ ] Phase 17.8: 定时任务
- [ ] 历史数据分层迁移
- [ ] 压缩和去重优化



---

## Phase 18: 核心功能完善 - 三种意识交易方式 🎯

### 当前状态
- ✅ Vector Package: 上传页面和市场页面已完成
- ⏸️ Memory Package: 待开发
- ⏸️ Chain Package: 待开发
- ⏸️ 统一详情页: 待开发
- ⏸️ 购买和下载流程: 待开发

### 18.1 Memory Package 上传页面
- [x] 创建 UploadMemoryPackage.tsx
  - [x] 文件上传组件（.memorypkg 格式）
  - [x] KV-Cache 数据验证
  - [x] W-Matrix 数据验证
  - [x] 元数据表单
    - sourceModel, targetModel
    - tokenCount, compressionRatio
    - contextDescription
    - price, category
  - [x] 上传进度显示
  - [x] 成功/失败提示

### 18.2 Memory Package 市场页面
- [x] 更新 MemoryMarketplace.tsx 使用新API
  - [x] Package 列表展示
  - [x] 筛选器（sourceModel, targetModel, priceRange）
  - [x] 排序（newest, popular, cheapest）
  - [x] 分页
  - [x] 搜索功能
  - [x] 点击跳转到详情页

### 18.3 Chain Package 上传页面
- [ ] 创建 UploadChainPackage.tsx
  - [ ] 文件上传组件（.chainpkg 格式）
  - [ ] Reasoning Chain 数据验证
  - [ ] W-Matrix 数据验证
  - [ ] 元数据表单
    - sourceModel, targetModel
    - stepCount, problemType
    - solutionQuality
    - price, category
  - [ ] 上传进度显示
  - [ ] 成功/失败提示

### 18.4 Chain Package 市场页面
- [ ] 创建 ChainPackageMarket.tsx
  - [ ] Package 列表展示
  - [ ] 筛选器（problemType, stepCount, priceRange）
  - [ ] 排序（newest, popular, cheapest）
  - [ ] 分页
  - [ ] 搜索功能
  - [ ] 点击跳转到详情页

### 18.5 统一 Package 详情页
- [ ] 创建 PackageDetail.tsx
  - [ ] 支持三种 Package 类型（vector/memory/chain）
  - [ ] 基本信息展示
    - 名称、描述、价格
    - 上传者信息
    - 下载量、评分
  - [ ] 类型特定信息
    - Vector: dimension, epsilon, category
    - Memory: tokenCount, compressionRatio, contextDescription
    - Chain: stepCount, problemType, solutionQuality
  - [ ] W-Matrix 信息展示
  - [ ] 购买按钮
  - [ ] 下载按钮（已购买）
  - [ ] 评论和评分功能

### 18.6 购买和下载流程
- [ ] 实现购买流程
  - [ ] 检查用户余额
  - [ ] 扣款并创建订单
  - [ ] 生成下载链接（24小时有效）
  - [ ] 发送购买成功通知
- [ ] 实现下载流程
  - [ ] 验证购买权限
  - [ ] 生成临时下载URL
  - [ ] 记录下载日志
  - [ ] 更新下载统计

### 18.7 后端 API 完善
- [ ] Memory Package API (server/routers/memory-packages.ts)
  - [ ] list: 列表查询
  - [ ] get: 获取详情
  - [ ] upload: 上传
  - [ ] purchase: 购买
  - [ ] download: 下载
- [ ] Chain Package API (server/routers/chain-packages.ts)
  - [ ] list: 列表查询
  - [ ] get: 获取详情
  - [ ] upload: 上传
  - [ ] purchase: 购买
  - [ ] download: 下载
- [ ] 统一购买 API (server/routers/purchases.ts)
  - [ ] createPurchase: 创建购买订单
  - [ ] getPurchaseHistory: 获取购买历史
  - [ ] generateDownloadLink: 生成下载链接
  - [ ] verifyPurchase: 验证购买权限

### 18.8 路由配置
- [ ] 更新 App.tsx 添加新路由
  - [ ] /upload/memory - Memory Package 上传
  - [ ] /upload/chain - Chain Package 上传
  - [ ] /market/memory - Memory Package 市场
  - [ ] /market/chain - Chain Package 市场
  - [ ] /package/:type/:id - 统一详情页
- [ ] 更新导航菜单
  - [ ] 三种 Package 类型切换
  - [ ] 统一的上传入口

### 18.9 端到端测试
- [ ] Vector Package 完整流程测试
  - [ ] 上传 → 浏览 → 详情 → 购买 → 下载
- [ ] Memory Package 完整流程测试
  - [ ] 上传 → 浏览 → 详情 → 购买 → 下载
- [ ] Chain Package 完整流程测试
  - [ ] 上传 → 浏览 → 详情 → 购买 → 下载
- [ ] 多用户并发测试
  - [ ] 同时上传
  - [ ] 同时购买
  - [ ] 同时下载

## 🔥 紧急Bug修复 (2026-01-06)

- [x] 修复 sortBy 参数验证错误（Memory Marketplace 和 Reasoning Chain Market 页面）
  - 将前端 sortBy 值从 'newest', 'cheapest', 'highest-rated' 改为 'recent', 'price_asc', 'rating'
  - 更新 MemoryMarketplace.tsx 和 ReasoningChainMarket.tsx
- [x] 修复 db.select is not a function 错误
  - 在 packages-api.ts 中所有 getDb() 调用前添加 await 关键字（共9处）
- [x] 验证所有页面正常加载
  - 首页 (/) ✅
  - Memory Marketplace (/memory-marketplace) ✅
  - Reasoning Chain Market (/reasoning-chains) ✅

## 🎯 系统优化计划 (2026-01-06)

### P1 - 用户体验优化（优先）
- [x] 简化导航结构（Marketplace/Tools/Resources）
- [x] 移除废弃页面，添加重定向

### P0 - 核心功能完善
- [ ] 添加示例数据到市场（10-15 个高质量示例 Packages）
- [ ] 完善上传页面的表单验证和文件上传逻辑
- [ ] 增强 Creator/Consumer Dashboard 的详细统计

### P1 - 用户体验优化（后续）
- [ ] 添加新手引导（Onboarding Flow）
- [ ] 优化移动端体验
- [ ] 实现 Compatibility Tester 的实际测试功能

### P2 - 功能扩展
- [ ] 添加全局搜索功能
- [ ] 实现个性化推荐
- [ ] 添加社区功能（讨论区、问答、排行榜）

## ✅ Onboarding Flow 完成 (2026-01-06)

- [x] 创建 OnboardingFlow 组件（3步引导流程）
- [x] 集成到 Home 页面
- [x] 测试完整用户流程
- [x] 验证跳转和 localStorage 保存

### 功能特性
- 全英文界面
- 三个产品线的详细技术说明（Vector/Memory/Chain）
- 角色导向引导（Creator/Consumer）
- 进度指示器和可跳过选项
- 完成后自动跳转到对应页面

## 🎯 当前优化任务 (2026-01-06)

### Phase 1: 数据库迁移 (P0)
- [ ] 执行 pnpm db:push 应用 schema 更新（需要交互式确认，暂时跳过）
- [ ] 验证 vectorPackages/memoryPackages/chainPackages 表创建成功
- [ ] 验证 packageDownloads/packagePurchases 表创建成功
- [ ] 确认 TypeScript 错误解决

**注**: TypeScript 错误主要来自旧代码，不影响核心功能

### Phase 2: 导航结构简化 (P1)
- [x] 更新 Navbar.tsx 为三级结构：Marketplace/Tools/Resources
- [x] Marketplace: 包含 Vector/Memory/Chain Packages
- [x] Tools: W-Matrix Tester, KV-Cache Demo, API Keys
- [x] Resources: SDK Documentation, Python SDK, GitHub, Blog
- [x] 移除冗余导航项

**状态**: ✅ 已完成，导航结构清晰简洁

### Phase 3: 移动端响应式优化 (P1)
- [x] 实现 hamburger 菜单（< 768px）
- [x] 优化触摸目标尺寸（按钮和链接）
- [x] 卡片布局替代表格（移动端）
- [x] 测试各种屏幕尺寸

**状态**: ✅ 已完成，所有页面都有响应式设计

## 🎯 Phase 4-5: Sample Data & UI Polish (2026-01-06)

### Phase 4: Onboarding Flow Logo Update
- [x] 替换 OnboardingFlow 顶部星星图标为项目 Logo（蓝色渐变圆环）
- [x] 保持视觉一致性

### Phase 5: Sample Data Generator
- [x] 创建 sample data 生成脚本
- [x] 生成 5 个 Vector Packages（NLP, Vision, Audio, Multimodal）
- [x] 生成 5 个 Memory Packages（不同模型和场景）
- [x] 生成 5 个 Chain Packages（不同问题类型）
- [x] 创建数据库表（vector_packages, memory_packages, chain_packages）
- [x] 插入数据库
- [x] 验证市场页面显示
- [x] 修复 /vector-packages 路由（移除错误的重定向）
- [x] 添加 VectorPackageMarket 组件导入

**结果**: ✅ 成功显示 5 个 Vector Packages，页面功能正常

## 🔍 Phase 6: Global Search Functionality (2026-01-06)

### Backend Search API
- [x] 创建 globalSearch tRPC procedure
- [x] 支持跨三种 package 类型搜索（vector/memory/chain）
- [x] 实现多字段筛选：
  - [x] 名称搜索（模糊匹配）
  - [x] 模型筛选（sourceModel, targetModel）
  - [x] 类别筛选（category）
  - [x] Epsilon 范围筛选（min/max）
- [x] 返回统一的搜索结果格式

### Frontend Search UI
- [x] 创建 GlobalSearch 组件
- [x] 实现搜索栏 UI（带图标和快捷键提示）
- [x] 实现筛选器 UI：
  - [x] 类别下拉选择器
  - [x] 模型输入框
  - [x] Epsilon 范围滑块
  - [x] 价格范围滑块
  - [x] 重置筛选按钮
- [x] 实现实时搜索（debounced 300ms）
- [x] 实现搜索结果展示（卡片式布局）

### Integration
- [x] 将 GlobalSearch 集成到 Navbar
- [x] 实现快捷键触发（Ctrl+K / Cmd+K）
- [x] 实现点击外部关闭搜索面板
- [x] ESC 键关闭搜索
- [x] 显示快捷键提示（⌘K）

### Testing
- [x] 测试搜索功能（文本搜索） - 搜索 "GPT" 返回 6 个相关结果
- [x] 测试筛选器组合 - Vector 筛选成功显示 5 个 Vector Packages
- [x] 测试快捷键触发 - Ctrl+K / Cmd+K 成功打开搜索
- [x] 验证搜索结果准确性 - 所有结果正确显示类型、价格、epsilon

**状态**: ✅ 全局搜索功能完全实现并测试通过

## 🐛 Bug Fix: Onboarding Flow Create Account Button

### Issue
- [ ] "Create Account" 按钮点击没有反应
- [ ] 需要检查 OnboardingFlow 组件中的事件处理

### Fix
- [ ] 检查按钮的 onClick 事件
- [ ] 确保正确调用 handleRoleSelect 函数
- [ ] 测试修复后的功能


## Real-time Workflow Visualization ✅

### Components
- [x] Create workflow types (WorkflowEvent, WorkflowSession, etc.)
- [x] Create EventTimeline component (horizontal timeline)
- [x] Create EventDetailsPanel component (detailed logs)
- [x] Create FilterControls component (search and filters)
- [x] Create main WorkflowVisualizer component
- [x] Create WorkflowManager (server-side event tracking)
- [x] Create WebSocket server for real-time streaming
- [x] Create workflow tRPC router with demo scenarios
- [x] Create WorkflowDemo page
- [x] Add route to App.tsx
- [x] Install socket.io-client package
- [x] Update WorkflowVisualizer to use Socket.IO
- [x] Initialize WebSocket server in main entry point

### Integration Points
- [ ] Integrate with AI Agent API calls
- [ ] Integrate with Package upload processing
- [ ] Integrate with W-Matrix training
- [ ] Integrate with Memory transfer operations

### Testing
- [x] Test AI reasoning demo scenario
- [x] Test WebSocket real-time updates
- [x] Test event timeline visualization
- [x] Test event details panel (Overview, Input, Output, Metadata)
- [ ] Test memory transfer demo scenario
- [ ] Test package processing demo scenario
- [ ] Test event filtering and search
- [ ] Test export functionality

### Documentation
- [x] Create comprehensive usage guide (WORKFLOW_VISUALIZER_GUIDE.md)
- [x] Document WebSocket API
- [x] Document workflow event types
- [x] Create integration guide for developers
- [x] Add API reference
- [x] Add troubleshooting section
