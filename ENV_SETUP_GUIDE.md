# 环境变量配置指南

## 概述

本指南帮助您配置Awareness Market所需的所有环境变量。

**检查配置**: 运行 `npx tsx scripts/check-env-config.ts`

---

## 快速开始

### 1. 复制模板

```bash
cp .env.example .env
```

### 2. 运行配置检查

```bash
npx tsx scripts/check-env-config.ts
```

### 3. 按照下面的指南填写缺失的值

---

## 🔴 必需配置（Critical）

### NODE_ENV

**描述**: 应用程序运行环境

**值**:
```bash
# 开发环境
NODE_ENV=development

# 生产环境
NODE_ENV=production
```

---

### DATABASE_URL

**描述**: PostgreSQL数据库连接字符串

**格式**:
```bash
DATABASE_URL=postgresql://用户名:密码@主机:端口/数据库名
```

**示例**:
```bash
# AWS RDS
DATABASE_URL=postgresql://postgres:SecurePass123@awareness-db.c9akciq32.us-east-1.rds.amazonaws.com:5432/awareness_market

# Railway
DATABASE_URL=postgresql://postgres:abc123@containers-us-west.railway.app:5432/railway

# Neon
DATABASE_URL=postgresql://user:pass@ep-cool-darkness-123456.us-east-2.aws.neon.tech/neondb
```

**获取方式**: 查看 [AWS_RDS_POSTGRESQL_SETUP.md](AWS_RDS_POSTGRESQL_SETUP.md) 或 [POSTGRESQL_SETUP.md](POSTGRESQL_SETUP.md)

---

### JWT_SECRET

**描述**: JWT令牌签名密钥（用于用户认证）

**⚠️ 重要**:
- 必须是强随机字符串
- 至少32字符
- 生产环境**绝不**使用默认值

**生成方法**:

#### 方法1: OpenSSL（推荐）
```bash
openssl rand -base64 32
```

输出示例:
```
rKz8vX2mN9pQwE1rTyU3jH6sL4cV7bN8xM5zD0aF2qG=
```

#### 方法2: Node.js
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

#### 方法3: Python
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

**配置**:
```bash
JWT_SECRET=rKz8vX2mN9pQwE1rTyU3jH6sL4cV7bN8xM5zD0aF2qG=
```

**⚠️ 安全提示**:
- ❌ 不要提交到Git
- ❌ 不要在日志中打印
- ✅ 使用环境变量或密钥管理服务
- ✅ 定期轮换（推荐每6个月）

---

## 🟡 重要配置（Important）

### AWS S3 配置

向量包和文件存储需要AWS S3。

#### AWS_REGION

**描述**: S3存储桶所在的AWS区域

**常用值**:
```bash
AWS_REGION=us-east-1      # 美国东部（弗吉尼亚北部）- 推荐
AWS_REGION=us-west-2      # 美国西部（俄勒冈）
AWS_REGION=ap-southeast-1 # 亚太（新加坡）
AWS_REGION=eu-west-1      # 欧洲（爱尔兰）
```

#### AWS_ACCESS_KEY_ID

**描述**: AWS访问密钥ID

**格式**: 20个字符，以`AKIA`开头

**获取步骤**:

1. 登录 [AWS IAM Console](https://console.aws.amazon.com/iam/)
2. 导航到 **Users** → 选择用户 → **Security credentials**
3. 点击 **Create access key**
4. 选择 **Application running outside AWS**
5. 复制 **Access key ID** (AKIA...)

**配置**:
```bash
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
```

#### AWS_SECRET_ACCESS_KEY

**描述**: AWS访问密钥密码

**格式**: 40个字符的Base64字符串

**获取**: 创建access key时一起显示（⚠️ 只显示一次，请保存）

**配置**:
```bash
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
```

#### S3_BUCKET_NAME

**描述**: 存储向量包的S3存储桶名称

**创建步骤**:

1. 访问 [S3 Console](https://s3.console.aws.amazon.com/s3/)
2. 点击 **Create bucket**
3. 配置:
   ```
   Bucket name: awareness-market-storage  (必须全局唯一)
   AWS Region: us-east-1 (与AWS_REGION一致)
   Block Public Access: ✅ 全部启用 (推荐)
   Versioning: ✅ 启用 (推荐)
   Encryption: ✅ SSE-S3 (服务器端加密)
   ```
4. 点击 **Create bucket**

**配置**:
```bash
S3_BUCKET_NAME=awareness-market-storage
```

**IAM权限要求**:

您的AWS用户需要以下S3权限:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::awareness-market-storage",
        "arn:aws:s3:::awareness-market-storage/*"
      ]
    }
  ]
}
```

**测试S3连接**:
```bash
npx tsx scripts/test-s3-connection.ts
```

---

### 邮件服务配置（Resend）

用于发送验证邮件、通知等。

#### RESEND_API_KEY

**描述**: Resend邮件服务API密钥

**获取步骤**:

1. 注册 [Resend](https://resend.com/)
2. 导航到 [API Keys](https://resend.com/api-keys)
3. 点击 **Create API Key**
4. 复制密钥（以`re_`开头）

**配置**:
```bash
RESEND_API_KEY=re_123456789_AbCdEfGhIjKlMnOpQrStUvWxYz
```

**免费额度**: 100封邮件/天

#### EMAIL_FROM

**描述**: 发件人邮箱地址

**配置**:
```bash
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME=Awareness Market
```

**要求**:
- 必须是您验证过的域名
- 在Resend中添加并验证域名DNS记录

---

## 🔵 可选配置（Optional）

### Stripe 支付（可选）

如果需要集成支付功能。

```bash
STRIPE_SECRET_KEY=sk_test_51AbC...  # 测试密钥
STRIPE_PUBLISHABLE_KEY=pk_test_51...
# STRIPE_WEBHOOK_SECRET=whsec_...   # Webhook签名密钥
```

**获取**: [Stripe Dashboard](https://dashboard.stripe.com/apikeys)

---

### OAuth 社交登录（可选）

#### GitHub OAuth

```bash
GITHUB_CLIENT_ID=Iv1.abc123def456
GITHUB_CLIENT_SECRET=abc123def456...
```

**获取**: [GitHub Developer Settings](https://github.com/settings/developers)

#### Google OAuth

```bash
GOOGLE_CLIENT_ID=123456789-abc.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-abc123...
```

**获取**: [Google Cloud Console](https://console.cloud.google.com/apis/credentials)

**回调URL配置**:
```bash
OAUTH_CALLBACK_URL=http://localhost:3000  # 开发环境
# OAUTH_CALLBACK_URL=https://yourdomain.com  # 生产环境
```

---

### Redis 缓存（推荐生产环境）

用于速率限制和缓存。

```bash
REDIS_URL=redis://localhost:6379              # 本地
# REDIS_URL=redis://default:pass@host:6379    # 远程
# REDIS_URL=rediss://...                       # TLS加密连接
```

**服务提供商**:
- [Upstash Redis](https://upstash.com/) - Serverless, 免费10000请求/天
- [Redis Cloud](https://redis.com/try-free/) - 30MB免费
- AWS ElastiCache - $15/月起

---

### 区块链 RPC（可选）

如果使用$AMEM代币和ERC-8004功能。

```bash
AMOY_RPC_URL=https://rpc-amoy.polygon.technology
POLYGON_RPC_URL=https://polygon-rpc.com
# AMEM_TOKEN_ADDRESS=0x...
# ERC8004_REGISTRY_ADDRESS=0x...
```

---

### OpenAI API（可选）

如果需要AI辅助功能。

```bash
OPENAI_API_KEY=sk-proj-...
```

**获取**: [OpenAI API Keys](https://platform.openai.com/api-keys)

---

## 环境变量优先级

### 必需（应用无法启动）
```bash
DATABASE_URL          ✅ PostgreSQL连接
JWT_SECRET            ✅ 用户认证
```

### 强烈推荐（核心功能需要）
```bash
AWS_REGION            ⚠️ S3存储区域
AWS_ACCESS_KEY_ID     ⚠️ S3访问密钥
AWS_SECRET_ACCESS_KEY ⚠️ S3密钥密码
S3_BUCKET_NAME        ⚠️ S3存储桶
RESEND_API_KEY        ⚠️ 邮件服务
EMAIL_FROM            ⚠️ 发件人地址
```

### 可选（增强功能）
```bash
STRIPE_*              💡 支付功能
GITHUB_*              💡 GitHub登录
GOOGLE_*              💡 Google登录
REDIS_URL             💡 缓存和速率限制
OPENAI_API_KEY        💡 AI功能
```

---

## 配置验证

### 自动检查

运行配置检查脚本:
```bash
npx tsx scripts/check-env-config.ts
```

输出示例:
```
🔍 Checking Environment Configuration

✅ CRITICAL VARIABLES
   Passed: 3
   Failed: 0

⚠️  IMPORTANT VARIABLES
   Passed: 6
   Failed: 0
   Warnings: 2

✅ All environment variables are properly configured!
   Ready for deployment.
```

### 手动检查

```bash
# 检查DATABASE_URL
echo $DATABASE_URL | grep -q "postgresql://" && echo "✅ DATABASE_URL OK" || echo "❌ DATABASE_URL missing"

# 检查JWT_SECRET长度
[ ${#JWT_SECRET} -ge 32 ] && echo "✅ JWT_SECRET OK" || echo "❌ JWT_SECRET too short"

# 测试S3连接
aws s3 ls s3://$S3_BUCKET_NAME --region $AWS_REGION
```

---

## 安全最佳实践

### ✅ 应该做

1. **使用强随机密钥**
   ```bash
   # 好
   JWT_SECRET=rKz8vX2mN9pQwE1rTyU3jH6sL4cV7bN8xM5zD0aF2qG=

   # 坏
   JWT_SECRET=mysecret123
   ```

2. **不同环境使用不同值**
   ```bash
   # .env.development
   JWT_SECRET=dev_random_key_123...

   # .env.production
   JWT_SECRET=prod_different_key_456...
   ```

3. **定期轮换密钥**
   - JWT_SECRET: 每6个月
   - AWS密钥: 每90天
   - API密钥: 按需轮换

4. **使用环境变量管理工具**
   - AWS Secrets Manager
   - HashiCorp Vault
   - Doppler
   - 1Password

### ❌ 不应该做

1. ❌ 不要提交.env到Git
   ```bash
   # .gitignore中应包含
   .env
   .env.local
   .env.production
   ```

2. ❌ 不要在代码中硬编码密钥
   ```typescript
   // 坏
   const JWT_SECRET = "mysecret123";

   // 好
   const JWT_SECRET = process.env.JWT_SECRET;
   ```

3. ❌ 不要在日志中打印敏感信息
   ```typescript
   // 坏
   console.log('JWT_SECRET:', process.env.JWT_SECRET);

   // 好
   console.log('JWT_SECRET configured:', !!process.env.JWT_SECRET);
   ```

4. ❌ 不要使用默认/示例值
   ```bash
   # 坏 - 这些是示例值！
   JWT_SECRET=your-secure-jwt-secret-change-in-production
   AWS_ACCESS_KEY_ID=AKIA...

   # 好 - 真实的值
   JWT_SECRET=rKz8vX2mN9pQwE1rTyU3jH6sL4cV7bN8...
   AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
   ```

---

## 故障排查

### 问题: DATABASE_URL连接失败

**检查**:
```bash
# 测试连接
psql "$DATABASE_URL"

# 检查格式
echo $DATABASE_URL
# 应输出: postgresql://user:pass@host:5432/dbname
```

**常见错误**:
- 密码包含特殊字符未URL编码
- 端口错误（PostgreSQL默认5432）
- 主机名错误或无法访问

---

### 问题: S3上传失败

**检查**:
```bash
# 测试AWS凭证
aws sts get-caller-identity --region $AWS_REGION

# 测试S3访问
aws s3 ls s3://$S3_BUCKET_NAME --region $AWS_REGION
```

**常见错误**:
- IAM权限不足
- 存储桶不存在
- 区域不匹配

---

### 问题: JWT认证失败

**检查**:
```bash
# 检查JWT_SECRET是否设置
echo ${#JWT_SECRET}  # 应该 >= 32

# 检查是否是placeholder
echo $JWT_SECRET | grep -q "your-" && echo "❌ Using placeholder" || echo "✅ OK"
```

---

## 完整配置示例

**生产环境 .env 模板**:

```bash
# ============================================
# Application
# ============================================
NODE_ENV=production
PORT=3001

# ============================================
# Database
# ============================================
DATABASE_URL=postgresql://postgres:YourSecurePassword@awareness-db.c9akciq32.us-east-1.rds.amazonaws.com:5432/awareness_market

# ============================================
# JWT Authentication
# ============================================
JWT_SECRET=rKz8vX2mN9pQwE1rTyU3jH6sL4cV7bN8xM5zD0aF2qG=

# ============================================
# AWS S3 Storage
# ============================================
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
S3_BUCKET_NAME=awareness-market-storage

# ============================================
# Email Service (Resend)
# ============================================
RESEND_API_KEY=re_123456789_AbCdEfGhIjKlMnOpQrStUvWxYz
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME=Awareness Market

# ============================================
# Redis (Recommended for production)
# ============================================
REDIS_URL=redis://awareness-redis.abc123.cache.amazonaws.com:6379

# ============================================
# Stripe (Optional)
# ============================================
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...

# ============================================
# Blockchain (Optional)
# ============================================
AMOY_RPC_URL=https://rpc-amoy.polygon.technology
POLYGON_RPC_URL=https://polygon-rpc.com
```

---

## 下一步

1. ✅ 配置所有必需的环境变量
2. ✅ 运行 `npx tsx scripts/check-env-config.ts` 验证
3. ✅ 测试数据库连接: `pnpm run db:push`
4. ✅ 测试S3上传: `npx tsx scripts/test-s3-connection.ts`
5. ✅ 启动应用: `pnpm run dev`

---

**维护者**: Claude Sonnet 4.5
**最后更新**: 2026-01-30
