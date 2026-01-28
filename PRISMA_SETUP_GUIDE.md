# Prisma + Supabase 配置指南

## ✅ 已完成的配置

1. **安装 Prisma** - Prisma 6.19.2 已安装
2. **创建 Schema** - [prisma/schema.prisma](prisma/schema.prisma) 已创建
3. **生成 Prisma Client** - 类型安全的数据库客户端已生成
4. **更新 .env** - DATABASE_URL 已配置为 PostgreSQL 格式

---

## 📋 需要您完成的步骤

### 步骤 1: 获取 Supabase 连接字符串

1. 打开 Supabase Dashboard: https://app.supabase.com
2. 选择您的项目
3. 点击左侧 **Settings** → **Database**
4. 找到 **Connection string** → **URI**
5. 复制连接字符串

连接字符串格式：
```
postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres
```

### 步骤 2: 更新 .env 文件

编辑 [.env](.env) 文件，将第 10 行的 DATABASE_URL 替换为您的真实连接字符串：

```bash
# 替换这一行:
DATABASE_URL=postgresql://postgres:your_password@db.your-project-ref.supabase.co:5432/postgres

# 改为您的真实连接字符串:
DATABASE_URL=postgresql://postgres:actual_password@db.abcdefghijklmnop.supabase.co:5432/postgres
```

### 步骤 3: 运行数据库迁移

更新 DATABASE_URL 后，在终端运行：

```bash
cd "e:\Awareness Market\Awareness-Network"
npx prisma migrate dev --name init_workflows_and_wmatrix
```

这将：
- 创建迁移 SQL 文件
- 在 Supabase 数据库中创建以下表：
  - `workflows` - AI 协作工作流
  - `workflow_steps` - 工作流步骤
  - `on_chain_interactions` - 链上交互记录
  - `w_matrix_compatibility` - W-Matrix 兼容性矩阵
  - `w_matrix_listings` - W-Matrix 市场列表
  - `w_matrix_integrity` - W-Matrix 完整性验证

### 步骤 4: 验证数据库连接

运行测试连接：

```bash
npx prisma db push
```

如果成功，您会看到：
```
✔ Database synchronized with Prisma schema
```

---

## 🗂️ Prisma Schema 概览

[prisma/schema.prisma](prisma/schema.prisma) 包含以下模型：

### 现有表
- `User` - 用户账户（已存在于数据库）

### 新增表 - Workflow（AI 协作）
- `Workflow` - 工作流主表
  - 支持 sequential（顺序）和 parallel（并行）编排
  - 共享内存管理（memorySharing, sharedMemory）
  - 执行时间跟踪
- `WorkflowStep` - 工作流步骤
  - 每个步骤关联一个 AI 代理
  - 输入/输出数据存储（JSON）
  - 错误处理
- `OnChainInteraction` - 链上交互记录
  - ERC-8004 兼容
  - 声誉权重（weight）
  - 交易哈希（txHash）

### 新增表 - W-Matrix（跨模型对齐）
- `WMatrixCompatibility` - 兼容性矩阵
  - 模型对配置（sourceModel → targetModel）
  - 语义版本控制（major.minor.patch）
  - 质量指标（epsilon, cosine similarity）
  - 认证等级（bronze/silver/gold/platinum）
- `WMatrixListing` - 市场列表
  - 定价和销售追踪
  - 评分和评论统计
  - 训练元数据
- `WMatrixIntegrity` - 完整性验证缓存
  - SHA-256 校验和
  - 验证计数

---

## 📊 数据库关系

```
User (1) ─── (N) Workflow
                 │
                 ├── (N) WorkflowStep
                 └── (N) OnChainInteraction

WMatrixListing (独立表)
WMatrixCompatibility (独立表)
WMatrixIntegrity (独立表)
```

---

## 🔧 Prisma 常用命令

### 开发

```bash
# 生成 Prisma Client（修改 schema 后运行）
npx prisma generate

# 创建迁移
npx prisma migrate dev --name your_migration_name

# 重置数据库（⚠️ 删除所有数据）
npx prisma migrate reset

# 查看数据库状态
npx prisma migrate status
```

### 生产

```bash
# 应用迁移（不提示）
npx prisma migrate deploy

# 推送 schema 更改（不创建迁移文件）
npx prisma db push
```

### 调试

```bash
# 打开 Prisma Studio（可视化数据库管理）
npx prisma studio

# 验证 schema
npx prisma validate

# 格式化 schema
npx prisma format
```

---

## 🔍 在 Supabase 中验证表

### 方法 1: Supabase Dashboard
1. Dashboard → **Table Editor**
2. 您应该看到所有新表

### 方法 2: SQL Editor
在 SQL Editor 中运行：
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

---

## 🚨 常见问题

### Q: "P1001: Can't reach database server" 错误
**A**: 检查：
1. DATABASE_URL 是否正确
2. Supabase 项目是否处于活动状态
3. 网络连接是否正常
4. 数据库密码是否正确

### Q: "relation already exists" 错误
**A**: 表已存在。选项：
1. 删除现有表（Supabase Dashboard → Table Editor）
2. 使用 `npx prisma db pull` 从现有数据库生成 schema
3. 使用 `npx prisma migrate resolve` 标记迁移为已应用

### Q: 如何在代码中使用 Prisma？
**A**: 导入 Prisma Client：
```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 查询示例
const workflows = await prisma.workflow.findMany({
  where: { createdBy: userId },
  include: { steps: true }
});
```

### Q: Drizzle 和 Prisma 可以共存吗？
**A**: 可以，但不推荐。建议：
1. 保留 Drizzle 用于现有表（users 等）
2. Prisma 仅用于新表（workflows, w_matrix_*）
3. 最终迁移所有表到 Prisma

---

## ✅ 下一步

1. **更新 .env** - 添加真实 Supabase 连接字符串
2. **运行迁移** - `npx prisma migrate dev`
3. **测试连接** - `npx prisma studio`
4. **更新代码** - 数据库操作模块将自动使用 Prisma Client

---

## 📚 资源

- Prisma 文档: https://www.prisma.io/docs
- Supabase + Prisma: https://supabase.com/docs/guides/integrations/prisma
- Prisma Studio: https://www.prisma.io/studio

---

**准备好后，运行迁移命令即可开始使用！🚀**
