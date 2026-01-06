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
