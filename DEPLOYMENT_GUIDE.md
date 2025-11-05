# Awareness Network 2.0 - 部署指南

本指南将帮助您将Awareness Network 2.0部署到生产环境。

## 架构概览

```
awareness.market (前端 - Vercel)
    ↓
api.awareness.market (后端API - Railway)
    ↓
ai.awareness.market (AI服务 - Railway)
```

## 前置要求

1. **Vercel账号** - 用于部署前端
2. **Railway账号** - 用于部署后端和AI服务
3. **MySQL数据库** - TiDB Cloud或其他MySQL服务
4. **Stripe账号** - 用于支付功能
5. **OpenAI API Key** - 用于AI文档生成

## 步骤1：部署后端API到Railway

### 1.1 创建Railway项目

```bash
# 安装Railway CLI
npm install -g @railway/cli

# 登录Railway
railway login

# 创建新项目
railway init
```

### 1.2 配置环境变量

在Railway Dashboard中设置以下环境变量：

```env
# 数据库
DATABASE_URL=mysql://user:password@host:port/database

# OpenAI
OPENAI_API_KEY=sk-...

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# JWT
JWT_SECRET=your-secret-key

# OAuth (Manus)
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://auth.manus.im

# AI Service URL
AI_SERVICE_URL=https://ai.awareness.market

# Node环境
NODE_ENV=production
```

### 1.3 部署

```bash
# 使用Dockerfile.backend部署
railway up --dockerfile Dockerfile.backend
```

### 1.4 配置自定义域名

在Railway Dashboard中：
1. 进入Settings → Domains
2. 添加自定义域名：`api.awareness.market`
3. 按照提示配置DNS记录

## 步骤2：部署AI服务到Railway

### 2.1 创建新的Railway服务

```bash
# 在同一个项目中创建新服务
railway service create ai-service
```

### 2.2 配置环境变量

```env
# OpenAI
OPENAI_API_KEY=sk-...

# Port
PORT=5000
```

### 2.3 部署

```bash
# 使用Dockerfile.ai部署
railway up --dockerfile Dockerfile.ai --service ai-service
```

### 2.4 配置自定义域名

添加域名：`ai.awareness.market`

## 步骤3：部署前端到Vercel

### 3.1 准备前端代码

```bash
cd client
```

### 3.2 部署到Vercel

```bash
# 使用Vercel CLI
vercel --prod

# 或者通过GitHub集成自动部署
```

### 3.3 配置环境变量

在Vercel Dashboard中设置：

```env
VITE_API_URL=https://api.awareness.market
VITE_OAUTH_PORTAL_URL=https://auth.manus.im
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

### 3.4 配置自定义域名

1. 在Vercel Dashboard中进入Settings → Domains
2. 添加域名：`awareness.market`
3. 配置DNS记录（如果域名在其他服务商）

## 步骤4：配置Stripe Webhook

1. 访问 [Stripe Dashboard](https://dashboard.stripe.com/webhooks)
2. 点击"Add endpoint"
3. 输入URL：`https://api.awareness.market/api/stripe/webhook`
4. 选择事件：
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. 复制Webhook签名密钥并更新Railway环境变量

## 步骤5：初始化数据库

```bash
# 连接到生产数据库
export DATABASE_URL="mysql://..."

# 运行迁移
pnpm db:push
```

## 步骤6：验证部署

### 6.1 测试前端

访问 https://awareness.market

### 6.2 测试后端API

```bash
curl https://api.awareness.market/api/trpc/auth.me
```

### 6.3 测试AI服务

```bash
curl https://ai.awareness.market/health
```

### 6.4 测试完整工作流

1. 登录应用
2. 上传一张图片
3. 查看OCR识别结果
4. 查看生成的知识文档

## 故障排查

### 前端无法连接后端

检查：
- `client/vercel.json`中的API代理配置
- Railway后端服务是否正常运行
- CORS配置是否正确

### AI服务超时

检查：
- Railway AI服务的内存配置（建议至少2GB）
- PaddleOCR模型是否正确下载
- OpenAI API密钥是否有效

### 支付功能无法使用

检查：
- Stripe Webhook是否正确配置
- Webhook签名密钥是否匹配
- Railway环境变量中的Stripe密钥是否正确

## 性能优化

### Railway

- 升级到Pro计划以获得更好的性能
- 启用自动扩展
- 配置Redis缓存（可选）

### Vercel

- 启用Edge Functions
- 配置CDN缓存策略
- 优化图片加载

## 监控和日志

### Railway

- 使用Railway内置的日志查看器
- 配置日志转发到第三方服务（如Datadog）

### Vercel

- 使用Vercel Analytics
- 配置Error Tracking

## 备份策略

### 数据库

- 配置自动备份（TiDB Cloud提供）
- 定期导出重要数据

### 代码

- 使用Git版本控制
- 定期推送到GitHub

## 成本估算

- **Vercel**: $0-20/月（Hobby计划免费，Pro $20/月）
- **Railway**: $5-50/月（按使用量计费）
- **TiDB Cloud**: $0-50/月（Serverless层免费额度）
- **Stripe**: 2.9% + $0.30/交易
- **OpenAI**: 按使用量计费

**总计**: 约$10-120/月（取决于流量和使用量）

## 下一步

- 配置CI/CD自动部署
- 设置监控和告警
- 实施安全审计
- 优化性能和成本

## 支持

如有问题，请联系：
- Email: everest9812@gmail.com
- GitHub: https://github.com/everest-an/Awareness-Network
