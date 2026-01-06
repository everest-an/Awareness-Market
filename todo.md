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

