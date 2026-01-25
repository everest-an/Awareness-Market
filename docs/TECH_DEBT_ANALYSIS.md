# 技术债务分析报告

## 一、中文字符编码问题

### 问题描述
10 个前端文件中的中文字符被截断，显示为 `�?` 乱码。

### 受影响文件
| 文件 | 错误数 | 问题内容 |
|------|--------|----------|
| ForgotPasswordDialog.tsx | 28 | 中文 toast 消息被截断 |
| Analytics.tsx | 14 | Loading 状态文字 `"…"` 被截断 |
| AuthPage.tsx | 17 | 表单提示文字 |
| Blog.tsx | 8 | 面包屑分隔符 `→` |
| BlogLatentMASPaper.tsx | 2 | 面包屑分隔符 |
| Home.tsx | 2 | 统计数字占位符 |
| ReviewSection.tsx | 5 | 星级显示 `★` |
| VectorPackageMarket.tsx | 4 | 排序标签 `↑↓` |
| Web3Examples.tsx | 6 | 连接状态文字 |
| web3-provider.ts | 1 | 错误消息 |

### 原因分析
这些文件在某次编辑/保存时，编码从 UTF-8 变成了其他编码（可能是 GB2312 或 Windows-1252），导致多字节中文字符被截断。

### 修复方案
需要手动修复这些文件中的中文字符串，恢复正确内容。

---

## 二、三大市场示例数据状态

### 数据位置
示例数据存在于以下位置：

| 类型 | 文件 | 数据量 | 状态 |
|------|------|--------|------|
| Genesis Memories | `shared/genesis-memories.ts` | 100 条 | ✅ 完整 |
| Sample Vectors | `scripts/seed-test-data.ts` | ~20 条 | ✅ 完整 |
| Sample Packages | `scripts/generate-sample-packages.ts` | 15 条 | ✅ 完整 |
| Reasoning Chains | `scripts/seed/seed-reasoning-chains.ts` | ~10 条 | ✅ 完整 |

### 为什么"看不到"？

1. **数据在代码中，不在数据库中**
   - 这些是 seed 脚本，需要运行才能写入数据库
   - 运行命令：`npm run seed` 或 `tsx scripts/seed-test-data.ts`

2. **Genesis Memories 是内存数据**
   - `GENESIS_MEMORIES` 数组直接在代码中定义
   - 通过 API `/api/trpc/marketplace.genesisMemories` 访问
   - 不需要数据库，但需要后端运行

3. **数据库可能为空**
   - 如果没有运行过 seed 脚本，数据库中没有数据
   - 前端显示空列表

### 如何让数据显示

```bash
# 1. 确保数据库连接正常
npm run db:push

# 2. 运行 seed 脚本填充数据
npm run seed
tsx scripts/seed-test-data.ts
tsx scripts/generate-sample-packages.ts
tsx scripts/seed/seed-reasoning-chains.ts

# 3. 启动服务
npm run dev
```

---

## 三、Golem 可视化器状态

### 文件位置（整理后）
```
golem-visualizer/
├── backend/
│   └── golem_backend.py      # Python 后端
├── frontend/
│   └── (GolemVisualizer.js 已存在)
├── examples/
│   └── integration.html      # 集成示例
├── docs/
│   ├── integration.md
│   └── analysis.md
├── requirements.txt
├── README.md
└── INTEGRATION_GUIDE.md
```

### 状态
- ✅ 代码完整
- ⚠️ 需要单独启动 Python 后端
- ⚠️ 需要安装 Python 依赖

---

## 四、其他技术债务

### 1. 重复的 seed 脚本
`scripts/` 目录下有多个功能重叠的 seed 脚本：
- seed-data.mjs
- seed-test-data.ts
- seed-agents.mjs
- seed-example-vectors.mjs
- seed-example-vectors.ts
- seed-genesis-memories.mjs
- seed-three-product-lines.ts

**建议**：合并为一个统一的 seed 入口。

### 2. docs/ 目录仍有散落文件
`docs/` 根目录还有 30+ 个未分类的 markdown 文件，建议继续整理到子目录。

### 3. 前端 hooks 重复
- `hooks/use-auth.ts` 和 `hooks/useAuth.ts` 可能重复
- 需要检查并合并

### 4. 测试覆盖不足
- 只有少量 `.test.ts` 文件
- 缺少 E2E 测试

### 5. 环境变量模板不一致
- `.env.local.example`
- `.env.local.template`
- `.env.production.template`

应该统一为一个 `.env.example`。

---

## 五、优先级建议

| 优先级 | 任务 | 影响 |
|--------|------|------|
| P0 | 修复中文编码问题 | 阻塞编译 |
| P1 | 运行 seed 脚本填充数据 | 前端显示空 |
| P2 | 合并重复的 seed 脚本 | 维护成本 |
| P3 | 继续整理 docs/ | 可读性 |
| P4 | 统一环境变量模板 | 开发体验 |
