# 邮件验证系统部署指南

## ✅ 完成的修改

### 1. 数据库Schema
- ✅ 添加 `VerificationCode` 模型到 `prisma/schema.prisma`
- ✅ 添加 `verificationCodes` 关联到 `User` 模型

### 2. 邮件服务
- ✅ 添加 `sendVerificationCodeEmail()` 到 `server/email-service.ts`

### 3. 验证码管理
- ✅ 添加 `sendEmailVerificationCode()` - 生成并发送验证码
- ✅ 添加 `verifyEmailWithCode()` - 验证码校验
- ✅ 添加 `getVerificationStatus()` - 获取验证状态

### 4. tRPC API endpoints
- ✅ `auth.sendVerificationEmail` - 重发验证邮件
- ✅ `auth.verifyEmail` - 验证邮箱
- ✅ `auth.verificationStatus` - 查询验证状态

### 5. 注册流程
- ✅ 更新 `registerWithEmail()` - 自动发送验证码

---

## 🚀 EC2部署步骤

### Step 1: 备份数据库

```bash
# SSH登录到EC2
ssh ec2-user@44.220.181.78

# 备份数据库
cd ~/Awareness-Market/Awareness-Network
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Step 2: 拉取最新代码

```bash
cd ~/Awareness-Market/Awareness-Network

# 拉取代码
git pull origin main

# 查看修改
git log --oneline -5
```

### Step 3: 安装依赖（如果需要）

```bash
pnpm install
```

### Step 4: 运行数据库迁移

```bash
# 运行Prisma迁移
pnpm prisma migrate dev --name add_verification_codes

# 预期输出:
# ✔ Applying migration `20260203XXXXXX_add_verification_codes`
# ✔ Generated Prisma Client
```

**如果迁移失败**，手动执行SQL：

```sql
-- 创建 verification_codes 表
CREATE TABLE IF NOT EXISTS "verification_codes" (
    "id" SERIAL PRIMARY KEY,
    "user_id" INTEGER NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "code" VARCHAR(6) NOT NULL,
    "type" VARCHAR(50) NOT NULL DEFAULT 'email_verification',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_codes_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

-- 创建索引
CREATE INDEX "verification_codes_email_code_type_idx"
    ON "verification_codes"("email", "code", "type");

CREATE INDEX "verification_codes_expires_at_idx"
    ON "verification_codes"("expires_at");

CREATE INDEX "verification_codes_user_id_idx"
    ON "verification_codes"("user_id");
```

运行手动SQL：

```bash
# 方法1: 使用psql
psql $DATABASE_URL -f migration.sql

# 方法2: 使用Prisma Studio
pnpm prisma studio
# 在Studio界面手动执行SQL
```

### Step 5: 重新生成Prisma Client

```bash
pnpm prisma generate
```

### Step 6: 构建项目

```bash
# 构建后端
pnpm build

# 构建前端
cd client && pnpm build && cd ..
```

### Step 7: 重启服务

```bash
# 重启后端
pm2 restart awareness-backend

# 重启前端（如果需要）
pm2 restart awareness-frontend

# 查看日志
pm2 logs awareness-backend --lines 50
```

### Step 8: 验证部署

```bash
# 1. 检查后端健康
curl http://localhost:3001/health

# 2. 测试发送验证码API（需要登录token）
curl -X POST http://localhost:3001/api/trpc/auth.sendVerificationEmail \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{}'

# 3. 测试查询验证状态（公开API）
curl "http://localhost:3001/api/trpc/auth.verificationStatus?input=%7B%22json%22%3A%7B%22email%22%3A%22test%40example.com%22%7D%7D"
```

---

## 🧪 功能测试

### 1. 完整注册流程测试

```bash
# 1. 注册新用户
curl -X POST https://awareness.market/api/trpc/auth.registerHuman \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "password": "Test1234!",
    "name": "Test User"
  }'

# 预期: 返回 success: true, accessToken, refreshToken
# 邮箱应该收到6位验证码

# 2. 检查邮箱，获取验证码（例如: 123456）

# 3. 验证邮箱
curl -X POST https://awareness.market/api/trpc/auth.verifyEmail \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "code": "123456"
  }'

# 预期: 返回 success: true

# 4. 查询验证状态
curl "https://awareness.market/api/trpc/auth.verificationStatus?input=%7B%22json%22%3A%7B%22email%22%3A%22testuser%40example.com%22%7D%7D"

# 预期: hasPendingCode: false (已验证)
```

### 2. 重发验证码测试

```bash
# 使用注册时返回的JWT token
ACCESS_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

curl -X POST https://awareness.market/api/trpc/auth.sendVerificationEmail \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# 预期: success: true
# 60秒内重发会返回错误: "Please wait X seconds"
```

### 3. 前端测试

1. 访问 https://awareness.market/auth
2. 注册新用户
3. 应该自动跳转到 `/verify-email?email=xxx`
4. 检查邮箱，输入6位验证码
5. 点击"Verify Email"
6. 应该显示成功并跳转到登录页

---

## 🔍 故障排查

### 问题1: 收不到验证码邮件

**检查Resend配置**:
```bash
cat .env | grep RESEND

# 应该看到:
# RESEND_API_KEY=re_xxx...
# EMAIL_FROM=noreply@awareness.market
```

**测试Resend API**:
```bash
node
> const { Resend } = require('resend');
> const resend = new Resend(process.env.RESEND_API_KEY);
> resend.emails.send({
    from: 'Awareness Market <noreply@awareness.market>',
    to: ['your-email@example.com'],
    subject: 'Test',
    html: '<p>Test email</p>'
  }).then(console.log).catch(console.error);
```

**查看后端日志**:
```bash
pm2 logs awareness-backend | grep -i "email\|resend\|verification"
```

### 问题2: 数据库迁移失败

**检查数据库连接**:
```bash
# 测试连接
psql $DATABASE_URL -c "SELECT version();"

# 查看现有表
psql $DATABASE_URL -c "\dt"
```

**检查是否已有表**:
```bash
psql $DATABASE_URL -c "SELECT * FROM information_schema.tables WHERE table_name = 'verification_codes';"
```

### 问题3: 前端调用失败

**检查前端配置**:
```bash
# 确认API URL配置
cat client/.env | grep VITE_API_URL
```

**查看浏览器控制台**:
- F12 → Console 查看错误
- Network → 查看API请求状态

### 问题4: 验证码已过期

**清理过期验证码（定期任务）**:
```sql
-- 删除已过期的验证码
DELETE FROM verification_codes
WHERE expires_at < NOW()
  AND used = false;
```

可以添加到cron job:
```bash
crontab -e

# 每小时清理一次
0 * * * * psql $DATABASE_URL -c "DELETE FROM verification_codes WHERE expires_at < NOW() AND used = false;"
```

---

## 📊 监控和日志

### 查看验证码统计

```sql
-- 今天发送的验证码数量
SELECT COUNT(*) FROM verification_codes
WHERE created_at > CURRENT_DATE;

-- 验证成功率
SELECT
  COUNT(*) FILTER (WHERE used = true) as verified,
  COUNT(*) FILTER (WHERE used = false AND expires_at < NOW()) as expired,
  COUNT(*) FILTER (WHERE used = false AND expires_at >= NOW()) as pending,
  COUNT(*) as total
FROM verification_codes
WHERE created_at > CURRENT_DATE;

-- 最近的验证码记录
SELECT
  email,
  code,
  type,
  used,
  expires_at,
  created_at
FROM verification_codes
ORDER BY created_at DESC
LIMIT 10;
```

### PM2日志监控

```bash
# 实时查看日志
pm2 logs awareness-backend --lines 100

# 只看错误
pm2 logs awareness-backend --err

# 保存日志到文件
pm2 logs awareness-backend --lines 1000 > verification_logs.txt
```

---

## ✅ 部署检查清单

部署完成后，确认以下功能正常：

- [ ] 数据库迁移成功执行
- [ ] `verification_codes` 表已创建
- [ ] 后端服务正常启动（无报错）
- [ ] 注册新用户能收到验证码邮件
- [ ] 邮件中的6位验证码正确显示
- [ ] 输入验证码能成功验证
- [ ] 验证成功后 `emailVerified` 字段更新为 `true`
- [ ] 重发验证码功能正常（60秒限制）
- [ ] 过期验证码无法使用（10分钟后）
- [ ] 前端验证页面显示正确
- [ ] 没有控制台错误

---

## 🔄 回滚方案

如果部署后发现问题，可以快速回滚：

```bash
# 1. 恢复代码到上一个版本
git log --oneline -5  # 查看提交历史
git checkout <previous-commit-hash>

# 2. 恢复数据库（删除新表）
psql $DATABASE_URL -c "DROP TABLE IF EXISTS verification_codes CASCADE;"

# 3. 重新构建
pnpm build

# 4. 重启服务
pm2 restart all

# 5. 验证旧功能正常
```

---

## 📞 需要帮助？

如果部署过程中遇到问题，请提供：

1. 错误日志: `pm2 logs awareness-backend --lines 100`
2. 数据库迁移输出
3. 浏览器控制台错误
4. Network请求详情

---

**部署时间估计**: 10-15分钟
**风险等级**: 低（纯功能增加，不影响现有功能）
**回滚时间**: < 5分钟
