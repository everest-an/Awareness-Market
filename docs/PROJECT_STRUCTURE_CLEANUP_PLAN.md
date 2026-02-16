# 项目结构整理方案

> **目标**: 消除重复代码，整理文件夹结构，确保项目清晰整洁

**分析日期**: 2026-02-06
**状态**: 🔄 待执行

---

## 📊 问题分析

### 1. Python SDK 重复问题

**发现的重复**:
- ❌ `sdk/python/` - 简化版 SDK（同步客户端）
- ❌ `python-sdk/` - 完整版 SDK（包含多个子模块）

**分析**:
```
sdk/python/
├── awareness_network_sdk.py      # 单文件 SDK，基础功能
├── awareness_network_async.py    # 异步版本
└── 简单的 API 包装

python-sdk/
├── awareness/                     # 高级 Agent SDK
│   ├── agent.py                  # Agent 类
│   ├── wallet.py                 # 钱包管理
│   └── embedding.py              # 嵌入引擎
├── awareness_sdk/                # 市场 SDK
│   ├── client.py                 # 统一客户端
│   ├── packages.py               # 包管理
│   ├── memory_exchange.py        # 内存交换
│   ├── w_matrix.py               # W-Matrix
│   └── kv_cache.py               # KV-Cache
└── examples/                     # 示例代码
```

**结论**: 这是**两个不同用途的 SDK**，不是重复！
- `sdk/python/` = 轻量级 API 客户端（适合快速集成）
- `python-sdk/` = 完整功能 SDK（适合生产使用）

**建议**: 保留两者，但需要明确文档说明用途区别

---

### 2. 根目录文档混乱

**问题**: 根目录有 **80+ 个 Markdown 文件**，严重影响可读性

**分类统计**:
```
部署相关: 15 个文件
  - DEPLOYMENT.md, DEPLOYMENT_GUIDE.md, DEPLOYMENT_CHECKLIST.md
  - AWS_DATABASE_SETUP.md, RDS_DEPLOYMENT_STEPS.md
  - VERCEL_DEPLOYMENT_FIX.md, DEPLOY_*.md

AI 协作相关: 7 个文件
  - AI_COLLABORATION_*.md (6个)
  - AI_LOGIN_*.md (2个)

进度报告: 10 个文件
  - PROGRESS_UPDATE_*.md (4个)
  - P0_INTEGRATION_PROGRESS.md, P1_*, P2_*, P3_*

数据库迁移: 5 个文件
  - DATABASE_MIGRATION_STATUS.md
  - DRIZZLE_*.md (3个)
  - PRISMA_*.md (3个)

安装指南: 8 个文件
  - *_INSTALLATION.md (5个)
  - *_SETUP.md (3个)

状态报告: 12 个文件
  - *_STATUS.md (6个)
  - *_SUMMARY.md (4个)
  - *_REPORT.md (2个)

其他: 23 个文件
```

**建议**: 整理到 `docs/` 子文件夹

---

### 3. 可视化组件重复

**发现**:
```
golem-visualizer/
├── frontend/.gitkeep              # 空文件夹
├── backend/golem_backend.py       # Python 后端
└── docs/.gitkeep                  # 空文件夹

client/src/components/
├── GolemVisualizer.tsx            # React 组件
├── InferenceVisualizer.tsx        # React 组件
└── NeuralCortexVisualizer.tsx     # React 组件

client/src/pages/
├── GolemVisualizerPage.tsx        # 页面
├── InferenceDashboard.tsx         # 页面
└── NeuralCortex.tsx               # 页面
```

**分析**: 
- `golem-visualizer/` 是独立的 Python 可视化工具
- `client/` 中的组件是 React 前端实现
- **不是重复**，是不同技术栈的实现

**建议**: 保留，但 `golem-visualizer/frontend/` 和 `docs/` 是空的，可以删除

---

### 4. 数据库 Schema 重复

**发现**:
```
drizzle/
├── schema.ts                      # MySQL schema
├── schema-pg.ts                   # PostgreSQL schema
├── schema-*.ts                    # 各种功能模块 schema
└── schema-*-pg.ts                 # PostgreSQL 版本

prisma/
└── schema.prisma                  # Prisma schema（已废弃？）
```

**分析**: 
- Drizzle 同时支持 MySQL 和 PostgreSQL
- Prisma 可能是旧的 ORM，已迁移到 Drizzle

**建议**: 
- 保留 Drizzle schemas（MySQL 和 PG 都需要）
- 确认 Prisma 是否还在使用，如果不用则删除

---

### 5. 示例代码分散

**发现**:
```
examples/                          # 根目录示例
├── javascript_example.js
├── python_example.py
└── three_product_lines_example.py

python-sdk/examples/               # SDK 示例
├── basic_usage.py
└── kv_cache_compression_example.py

sdk/python/examples/               # 简化 SDK 示例
└── (空)

scripts/test/                      # 测试脚本
└── e2e-package-flow.ts
```

**建议**: 合并到统一的 `examples/` 目录

---

## ✅ 整理方案

### 阶段 1: 文档整理（优先级：高）

**目标**: 将根目录的 80+ 个 MD 文件整理到 `docs/` 子文件夹

```bash
# 创建新的文档结构
docs/
├── deployment/                    # 部署相关
│   ├── aws/
│   ├── vercel/
│   └── general/
├── development/                   # 开发相关
│   ├── setup/
│   ├── database/
│   └── ai-collaboration/
├── progress/                      # 进度报告
│   ├── integration/
│   └── features/
├── technical/                     # 技术文档（已存在）
│   ├── LATENTMAS_IMPLEMENTATION_STATUS.md
│   └── NEURAL_CORTEX_SPEC.md
└── guides/                        # 用户指南
    ├── installation/
    └── troubleshooting/
```

**执行步骤**:
1. 创建新的文档目录结构
2. 移动文件到对应目录
3. 更新所有文档中的相对路径引用
4. 更新 README.md 中的文档链接
5. 创建 `docs/INDEX.md` 作为文档导航

---

### 阶段 2: SDK 文档化（优先级：中）

**目标**: 明确两个 SDK 的用途和使用场景

**创建文件**:
```
sdk/python/README.md               # 轻量级 SDK 说明
python-sdk/README.md               # 完整 SDK 说明（已存在）
docs/guides/sdk-comparison.md     # SDK 对比指南
```

**内容**:
- 轻量级 SDK: 快速集成，单文件，适合简单场景
- 完整 SDK: 生产级，模块化，适合复杂应用

---

### 阶段 3: 清理空文件夹和废弃代码（优先级：中）

**删除**:
```bash
# 空文件夹
golem-visualizer/frontend/         # 空的
golem-visualizer/docs/             # 空的
sdk/python/examples/               # 空的

# 废弃文件（需确认）
prisma/                            # 如果已完全迁移到 Drizzle
.manus/                            # 如果不再使用
```

**确认后删除**:
- 检查 `prisma/` 是否还在代码中被引用
- 检查 `.manus/` 的用途

---

### 阶段 4: 示例代码整合（优先级：低）

**目标**: 统一示例代码位置

```
examples/
├── javascript/
│   └── basic-usage.js
├── python/
│   ├── basic-usage.py
│   ├── three-product-lines.py
│   └── kv-cache-compression.py
├── typescript/
│   └── e2e-package-flow.ts
└── README.md                      # 示例索引
```

---

### 阶段 5: 根目录清理（优先级：高）

**保留在根目录的文件**:
```
必须保留:
- README.md                        # 项目主文档
- WHITEPAPER.md                    # 白皮书
- CHANGELOG.md                     # 变更日志
- CONTRIBUTING.md                  # 贡献指南
- CODE_OF_CONDUCT.md               # 行为准则
- LICENSE                          # 许可证
- package.json                     # NPM 配置
- tsconfig.json                    # TypeScript 配置
- .gitignore                       # Git 配置
- .env.example                     # 环境变量示例

可以保留:
- todo.md                          # 待办事项
- QUICK_ACCESS_GUIDE.md            # 快速访问指南

移动到 docs/:
- 其他所有 .md 文件
```

---

## 🎯 执行优先级

### 立即执行（Phase 1）
1. ✅ 创建文档目录结构
2. ✅ 移动部署相关文档
3. ✅ 移动开发相关文档
4. ✅ 移动进度报告
5. ✅ 更新 README.md 链接

### 短期执行（Phase 2）
1. 创建 SDK 对比文档
2. 清理空文件夹
3. 确认并删除废弃代码

### 长期优化（Phase 3）
1. 整合示例代码
2. 优化文档结构
3. 添加文档搜索功能

---

## 📝 注意事项

1. **备份**: 执行任何删除操作前，先创建 Git 分支备份
2. **测试**: 移动文件后，测试所有导入路径是否正常
3. **文档**: 更新所有相关文档中的路径引用
4. **CI/CD**: 检查 CI/CD 配置中的路径引用
5. **团队通知**: 通知团队成员文件结构变更

---

## 🔍 验证清单

- [ ] 所有文档链接正常工作
- [ ] 所有导入路径正常工作
- [ ] CI/CD 构建成功
- [ ] 测试套件通过
- [ ] README.md 更新完成
- [ ] 团队成员已通知

---

## 📊 预期效果

**整理前**:
- 根目录: 80+ 个文件
- 文档分散: 难以查找
- SDK 用途不清: 容易混淆

**整理后**:
- 根目录: ~15 个核心文件
- 文档集中: 易于导航
- SDK 用途明确: 清晰的使用指南

**可维护性提升**: ⭐⭐⭐⭐⭐

---

*最后更新: 2026-02-06*
*执行状态: 待审核*
