# Supabase (PostgreSQL) 配置指南

本项目已统一使用 **PostgreSQL + Prisma**。Supabase 可直接作为数据库。

---

## 🔧 快速配置步骤

### 1. 更新环境变量 (.env)

将 Supabase 连接字符串添加到 `.env` 文件：

```bash
# Supabase PostgreSQL 连接字符串
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres

# 示例格式
# DATABASE_URL=postgresql://postgres:your_password@db.abcdefghijklmnop.supabase.co:5432/postgres
```

**如何获取连接字符串**:
1. 打开 Supabase Dashboard: https://app.supabase.com
2. 选择项目 → Settings → Database
3. Connection string → URI

---

### 2. 生成 Prisma Client 并运行迁移

```bash
cd "e:\Awareness Market\Awareness-Network"
pnpm prisma generate
pnpm prisma migrate deploy
```

---

### 3. 可选：填充示例数据

```bash
pnpm run seed
```

---

## 🔍 验证配置

### 测试连接

```bash
# 安装 PostgreSQL 客户端工具
npm install -g pg

# 测试连接
psql "postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"
```

---

## 🆘 常见问题

### Q: "relation does not exist" 错误
**A**: 确保运行了 `pnpm prisma migrate deploy`。

### Q: 如何在 Supabase 中查看表？
**A**:
1. Supabase Dashboard → Table Editor
2. 或使用 SQL Editor 运行：`SELECT * FROM information_schema.tables WHERE table_schema = 'public';`

---

## ✅ 下一步

1. 更新 `.env` 连接字符串
2. 运行迁移
3. 启动应用并验证接口
