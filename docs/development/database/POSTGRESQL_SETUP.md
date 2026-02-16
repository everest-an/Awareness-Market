# PostgreSQL 数据库设置指南

## 项目已转换为PostgreSQL ✅

项目数据库统一使用 **PostgreSQL + Prisma**。

### 当前状态

1. ✅ Prisma schema 已就绪 (`prisma/schema.prisma`)
2. ✅ 数据库连接使用 Prisma Client (`server/db.ts`)
3. ✅ 迁移通过 Prisma Migrate 管理 (`prisma/migrations/`)

---

## 步骤1: 创建PostgreSQL数据库

选择以下**任一**云服务提供商创建PostgreSQL数据库（**推荐用于公网部署**）:

### 选项A: Railway (推荐 - 最简单)

1. 访问 https://railway.app/
2. 创建新项目 → Add Database → PostgreSQL
3. 复制 `DATABASE_URL` (格式: `postgresql://postgres:xxx@xxx.railway.app:5432/railway`)
4. 免费额度: $5/月

### 选项B: Neon (Serverless PostgreSQL)

1. 访问 https://neon.tech/
2. 创建新项目
3. 复制连接字符串
4. 免费额度: 0.5GB存储

### 选项C: Supabase

1. 访问 https://supabase.com/
2. 创建新项目
3. Settings → Database → Connection String (Direct connection)
4. 免费额度: 500MB数据库

### 选项D: Vercel Postgres

1. 访问 https://vercel.com/storage/postgres
2. 创建数据库
3. 复制 `POSTGRES_URL`
4. 免费额度: 256MB

### 选项E: DigitalOcean Managed PostgreSQL

1. 访问 https://cloud.digitalocean.com/databases
2. 创建PostgreSQL数据库集群
3. 复制连接字符串
4. 收费: $15/月起

---

## 步骤2: 配置DATABASE_URL

将获取的PostgreSQL连接字符串更新到 `.env` 文件:

```bash
# .env
DATABASE_URL=postgresql://user:password@host:5432/dbname
```

**示例**:
```bash
# Railway
DATABASE_URL=postgresql://postgres:abc123@containers-us-west-1.railway.app:5432/railway

# Neon
DATABASE_URL=postgresql://user:password@ep-cool-darkness-123456.us-east-2.aws.neon.tech/neondb

# Supabase (使用Direct connection，不是Pooled)
DATABASE_URL=postgresql://postgres:password@db.xyz.supabase.co:5432/postgres
```

---

## 步骤3: 运行数据库迁移

创建数据库表结构:

```bash
cd "e:\Awareness Market\Awareness-Network"

# 生成 Prisma Client
pnpm prisma generate

# 运行数据库迁移
pnpm prisma migrate deploy
```

如果出现权限错误，确保数据库用户有创建schema的权限。

---

## 步骤4: 填充示例数据 (可选)

运行种子脚本为三大市场添加示例数据:

```bash
# 方法1: 使用三大产品线种子脚本 (推荐)
npx tsx scripts/seed-three-product-lines.ts

# 方法2: 使用通用种子脚本
pnpm run seed
```

种子数据包括:
- ✅ 15个Vector Packages (向量能力包)
- ✅ 12个Memory Packages (KV-Cache内存包)
- ✅ 15个Chain Packages (推理链包)
- ✅ 5个示例用户 (创作者和消费者)

---

## 步骤5: 启动应用

```bash
# 开发模式
pnpm run dev

# 生产模式
pnpm run build
pnpm run start
```

访问 http://localhost:3000 查看三大市场。

---

## 验证数据库连接

运行此测试脚本检查数据库是否正常连接:

```typescript
// scripts/test-db-connection-pg.ts
import { getDb } from '../server/db';

async function test() {
  console.log('Testing PostgreSQL connection...');
  const db = await getDb();

  if (!db) {
    console.error('❌ Failed to connect to database');
    return;
  }

  console.log('✅ Successfully connected to PostgreSQL!');

  // Test query
  const result = await db.$queryRaw<{ version: string }[]>`SELECT version()`;
  console.log('PostgreSQL version:', result[0]?.version);
}

test();
```

运行:
```bash
npx tsx scripts/test-db-connection-pg.ts
```

---

## 常见问题

### Q: Migration失败 "permission denied to create extension"

A: 某些托管PostgreSQL限制扩展权限。检查并删除migration中不需要的扩展语句。

### Q: "relation does not exist"错误

A: 确保运行了 `pnpm prisma migrate deploy` 创建所有表。

### Q: Connection timeout

A: 检查:
1. DATABASE_URL格式正确
2. 数据库防火墙允许您的IP访问
3. 使用**Direct Connection**而不是Pooled Connection (Supabase)

### Q: 三大市场还是空的

A: 运行种子脚本: `npx tsx scripts/seed-three-product-lines.ts`

---

## 下一步

1. ✅ 数据库设置完成
2. 运行应用并测试三大市场
3. 查看 [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) 了解AWS生产部署

---

## PostgreSQL vs MySQL对比

| 特性 | PostgreSQL ✅ | MySQL |
|------|--------------|-------|
| 数据类型 | JSON, Arrays, UUID | 基础类型 |
| 全文搜索 | 内置强大 | 需要额外配置 |
| 性能 | 复杂查询更快 | 简单查询更快 |
| 开源 | 完全开源 | 双许可 |
| 云支持 | 所有平台 | 所有平台 |

**您已选择PostgreSQL - 这是正确的选择！**

---

**维护者**: Claude Sonnet 4.5
**最后更新**: 2026-01-30
