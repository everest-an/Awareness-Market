# Supabase (PostgreSQL) 配置指南

## 当前状态

您的项目配置为 **MySQL**，但您使用的是 **Supabase (PostgreSQL)**。需要进行以下更改：

---

## 🔧 快速配置步骤

### 1. 更新环境变量 (.env)

将您的 Supabase 连接字符串添加到 `.env` 文件：

```bash
# Supabase PostgreSQL 连接字符串
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres

# 示例格式
# DATABASE_URL=postgresql://postgres:your_password@db.abcdefghijklmnop.supabase.co:5432/postgres
```

**如何获取连接字符串**:
1. 打开 Supabase Dashboard: https://app.supabase.com
2. 选择您的项目
3. 点击左侧 "Settings" → "Database"
4. 找到 "Connection string" → "URI"
5. 复制 URI 格式的连接字符串

### 2. 已完成的配置更新 ✅

我已经更新了以下文件：

1. **drizzle.config.ts** - 从 `dialect: "mysql"` 改为 `dialect: "postgresql"`
2. **schema-workflows-pg.ts** - PostgreSQL 版本的 workflows schema
3. **schema-w-matrix-compat-pg.ts** - PostgreSQL 版本的 W-Matrix schema

---

## 📋 需要完成的任务

### 选项 A: 仅使用新表 (推荐 - 最快)

如果您的现有表已经在 Supabase 中运行，只需添加新表：

#### 步骤 1: 更新主 schema.ts

编辑 `drizzle/schema.ts`，将新表的导入改为 PostgreSQL 版本：

```typescript
// 将这两行：
export * from './schema-workflows';
export * from './schema-w-matrix-compat';

// 改为：
export * from './schema-workflows-pg';
export * from './schema-w-matrix-compat-pg';
```

#### 步骤 2: 生成迁移

```bash
cd "e:\Awareness Market\Awareness-Network"
npx drizzle-kit generate
```

这将生成 PostgreSQL 格式的迁移 SQL。

#### 步骤 3: 运行迁移

```bash
npx drizzle-kit push
```

或手动在 Supabase SQL Editor 中运行生成的 SQL。

---

### 选项 B: 完整迁移 (需要更多工作)

如果您想将所有表从 MySQL 转换为 PostgreSQL：

**⚠️ 警告**: 这需要转换整个 schema.ts 文件（约 1000+ 行代码）。

主要改动：
- `mysqlTable` → `pgTable`
- `mysqlEnum` → `pgEnum` (需要先定义)
- `int` → `integer`
- `decimal` → `numeric`
- `json` → `jsonb`
- `.onUpdateNow()` → 移除（PostgreSQL 需要触发器）

---

## 🚀 推荐方案

### 如果您的 Supabase 数据库已有数据

**使用选项 A**：
1. 保持现有表不变
2. 只添加新的 PostgreSQL 表（workflows, w_matrix_*）
3. 更新 schema.ts 中的导入
4. 运行迁移

### 如果这是新项目/空数据库

**使用选项 B** 或重新创建：
1. 删除所有现有迁移
2. 转换整个 schema.ts 为 PostgreSQL
3. 生成新迁移
4. 一次性部署

---

## 📝 数据库操作模块更新

新创建的数据库模块已经兼容 PostgreSQL：

✅ **server/db-workflows.ts** - 使用 Drizzle ORM，自动兼容
✅ **server/db-wmatrix.ts** - 使用 Drizzle ORM，自动兼容

这些模块使用 Drizzle ORM 的抽象层，因此无需修改。

---

## 🔍 验证配置

### 测试连接

```bash
# 安装 PostgreSQL 客户端工具
npm install -g pg

# 测试连接
psql "postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"
```

### 检查 Drizzle 配置

```bash
npx drizzle-kit check
```

---

## 📊 PostgreSQL vs MySQL 主要差异

| 特性 | MySQL | PostgreSQL |
|------|-------|------------|
| 主键自增 | `.autoincrement()` | `.generatedAlwaysAsIdentity()` |
| 枚举 | `mysqlEnum()` | `pgEnum()` (需先定义) |
| JSON | `json()` | `jsonb()` (推荐) |
| 小数 | `decimal()` | `numeric()` |
| 整数 | `int()` | `integer()` |
| 自动更新时间 | `.onUpdateNow()` | 需要触发器 |

---

## 🆘 常见问题

### Q: "relation does not exist" 错误
**A**: 运行迁移创建表：`npx drizzle-kit push`

### Q: 如何在 Supabase 中查看表？
**A**:
1. Supabase Dashboard → Table Editor
2. 或使用 SQL Editor 运行：`SELECT * FROM information_schema.tables WHERE table_schema = 'public';`

### Q: 迁移失败怎么办？
**A**:
1. 检查 Supabase 日志：Dashboard → Logs
2. 手动在 SQL Editor 中运行迁移 SQL
3. 检查 `drizzle/migrations/` 中的 SQL 文件

---

## ✅ 下一步

1. **更新 .env** 添加 Supabase 连接字符串
2. **选择方案** (推荐选项 A)
3. **更新 schema.ts** 导入
4. **生成迁移** `npx drizzle-kit generate`
5. **运行迁移** `npx drizzle-kit push`
6. **测试连接** 创建测试 workflow

---

**准备好后告诉我，我将帮助您完成迁移！ 🚀**

**您需要提供**:
- Supabase 项目的连接字符串
- 选择哪个方案（A 或 B）
