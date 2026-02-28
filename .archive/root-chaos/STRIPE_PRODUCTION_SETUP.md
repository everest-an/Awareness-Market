# Stripe 生产环境部署指南

## ✅ 第一步：API 密钥配置（已完成）

您的生产环境密钥已经成功配置到 `.env` 文件：
- ✅ `STRIPE_SECRET_KEY` - 已更新为生产密钥
- ✅ `STRIPE_PUBLISHABLE_KEY` - 已更新为生产公钥
- ⚠️ `STRIPE_WEBHOOK_SECRET` - 需要在 Stripe Dashboard 配置 webhook 后填写

## 🔧 第二步：配置 Stripe Webhook（必须完成）

### 2.1 登录 Stripe Dashboard

访问：https://dashboard.stripe.com/webhooks

### 2.2 添加 Webhook 端点

1. 点击 **"添加端点"** 或 **"Add endpoint"**
2. 填写端点 URL：
   ```
   http://44.220.181.78:3001/webhook/stripe
   ```
   或者如果有域名：
   ```
   https://yourdomain.com/webhook/stripe
   ```

3. 选择要监听的事件：
   - ✅ `checkout.session.completed` - 支付成功
   - ✅ `customer.subscription.created` - 订阅创建
   - ✅ `customer.subscription.updated` - 订阅更新
   - ✅ `customer.subscription.deleted` - 订阅取消
   - ✅ `invoice.paid` - 发票支付成功
   - ✅ `invoice.payment_failed` - 支付失败

4. 点击 **"添加端点"**

### 2.3 获取 Webhook 签名密钥

1. 在 webhook 列表中，点击刚创建的端点
2. 找到 **"签名密钥"** 或 **"Signing secret"**
3. 点击 **"显示"** 或 **"Reveal"**
4. 复制密钥（格式：`whsec_xxxxxxxxxxxxx`）
5. 更新 `.env` 文件：
   ```bash
   STRIPE_WEBHOOK_SECRET=whsec_你的实际密钥
   ```

## 💳 第三步：完成 Stripe 账户设置

### 3.1 验证账户信息

访问：https://dashboard.stripe.com/settings/account

必须完成：
- ✅ 企业/个人信息
- ✅ 税务信息（纳税人识别号）
- ✅ 银行账户信息（用于接收付款）

### 3.2 设置付款时间表

访问：https://dashboard.stripe.com/settings/payouts

- **标准时间表**：T+2 工作日（免费）
- **即时付款**：需要额外费用（可选）
- **最低提现金额**：建议设置为 $100

### 3.3 启用邮件通知

访问：https://dashboard.stripe.com/settings/emails

建议启用：
- ✅ 成功付款通知
- ✅ 失败付款通知
- ✅ 争议通知
- ✅ 退款通知

## 📊 第四步：创建产品和价格（可选）

如果要使用 Stripe 预定义的产品和价格（而不是动态创建），可以在 Dashboard 创建：

访问：https://dashboard.stripe.com/products

### 创建 v3.0 组织计划产品

#### Lite Plan
- **名称**：Awareness Network — Lite Plan
- **价格**：$49/月
- **描述**：8 AI agents, basic departments, memory lifecycle
- **Metadata**：
  - `plan_tier`: lite
  - `max_agents`: 8
  - `max_memories`: 10000

#### Team Plan
- **名称**：Awareness Network — Team Plan
- **价格**：$199/月
- **描述**：32 AI agents, multi-department, memory pools, conflict arbitration
- **Metadata**：
  - `plan_tier`: team
  - `max_agents`: 32
  - `max_memories`: 50000

#### Enterprise Plan
- **名称**：Awareness Network — Enterprise Plan
- **价格**：$499/月
- **描述**：128 AI agents, decision audit, reputation system, compliance export
- **Metadata**：
  - `plan_tier`: enterprise
  - `max_agents`: 128
  - `max_memories`: 500000

#### Scientific Plan
- **名称**：Awareness Network — Scientific Plan
- **价格**：$999/月
- **描述**：Unlimited agents, cross-domain verification, evidence tracking, dependency graphs
- **Metadata**：
  - `plan_tier`: scientific
  - `max_agents`: 999999
  - `max_memories`: 9999999

## 🧪 第五步：测试生产环境付款

### 5.1 使用测试卡号测试

在生产环境中，您可以使用以下测试卡号进行测试（不会产生真实费用）：

**成功支付**：
- 卡号：`4242 4242 4242 4242`
- 有效期：任意未来日期
- CVC：任意 3 位数字
- 邮编：任意 5 位数字

**支付失败**：
- 卡号：`4000 0000 0000 0002`

### 5.2 测试订阅流程

1. 访问您的网站：http://44.220.181.78:3001
2. 创建测试组织
3. 选择升级到 Lite/Team/Enterprise/Scientific 计划
4. 使用测试卡号完成支付
5. 检查：
   - ✅ Stripe Dashboard 是否显示订阅
   - ✅ 数据库中 `Organization` 表的 `planTier` 是否更新
   - ✅ Webhook 是否被正确调用
   - ✅ 用户是否收到确认通知

## 🔐 第六步：安全检查

### 6.1 保护 Webhook 端点

webhook 端点 `/webhook/stripe` 已经实现了签名验证（在 [server/stripe-webhook.ts](server/stripe-webhook.ts#L38-L46) 中）。

验证代码：
```typescript
event = stripe.webhooks.constructEvent(
  req.body,
  sig,
  process.env.STRIPE_WEBHOOK_SECRET
);
```

### 6.2 密钥安全

⚠️ **关键提醒**：
- ✅ 生产密钥已写入 `.env` 文件
- ❌ **永远不要提交** `.env` 文件到 Git
- ✅ 确保 `.env` 在 `.gitignore` 中
- 🔄 定期轮换密钥（建议每 90 天）

### 6.3 验证 .gitignore

运行检查：
```bash
cat .gitignore | grep ".env"
```

应该包含：
```
.env
.env.local
.env.production
```

## 💰 第七步：资金流向确认

### 付款流程图

```
客户选择计划 ($49/$199/$499/$999/月)
    ↓
Stripe Checkout Session 创建
    ↓
客户输入信用卡信息
    ↓
Stripe 处理付款
    ↓
✅ 资金进入您的 Stripe 账户余额（扣除 2.9% + $0.30 手续费）
    ↓
Webhook 通知您的服务器（/webhook/stripe）
    ↓
更新数据库：Organization.planTier 升级
    ↓
发送邮件通知用户
```

### 收款时间表

| 事件 | 时间 | 说明 |
|------|------|------|
| 客户支付 | T+0 | 资金进入 Stripe 余额（pending） |
| 可用余额 | T+2 天 | 可以提现到银行 |
| 银行到账 | T+2~4 天 | 根据银行处理速度 |

### 查看收入

访问：https://dashboard.stripe.com/balance

- **可用余额**：可以立即提现
- **待处理**：正在处理中的付款
- **交易记录**：所有历史交易

## 🚀 第八步：重启服务器应用更改

### 8.1 停止当前服务

```bash
# 如果使用 pm2
pm2 stop awareness-network

# 或者如果直接运行
# 按 Ctrl+C 停止
```

### 8.2 重新启动

```bash
# 进入项目目录
cd "e:\Awareness Market\Awareness-Network"

# 确保依赖已安装
pnpm install

# 启动服务器
pnpm run dev

# 或生产模式
pnpm run build
NODE_ENV=production pnpm run start
```

### 8.3 验证配置

访问日志查看 Stripe 是否正确初始化：
```bash
# 查看日志
tail -f logs/app.log

# 应该看到类似信息：
# [Stripe] Initialized with production keys
```

## 📈 第九步：监控和维护

### 9.1 监控 Dashboard

定期检查：
- https://dashboard.stripe.com/payments - 所有付款记录
- https://dashboard.stripe.com/subscriptions - 订阅管理
- https://dashboard.stripe.com/customers - 客户列表
- https://dashboard.stripe.com/webhooks - Webhook 日志

### 9.2 处理失败付款

如果客户付款失败：
1. Stripe 会自动重试 3 次
2. 您的系统会收到 `invoice.payment_failed` webhook
3. 用户会收到邮件通知（由您的系统发送）
4. 订阅状态会变为 `past_due`

### 9.3 处理退款

如果需要退款：
1. 访问：https://dashboard.stripe.com/payments
2. 找到对应的付款记录
3. 点击 **"退款"** 或 **"Refund"**
4. 选择全额或部分退款
5. Stripe 会自动触发 `charge.refunded` webhook
6. 您的系统会更新数据库状态

## ✅ 完成检查清单

在正式上线前，确保所有项都已完成：

### API 配置
- [x] `.env` 文件中的 `STRIPE_SECRET_KEY` 已更新为生产密钥
- [x] `.env` 文件中的 `STRIPE_PUBLISHABLE_KEY` 已更新为生产公钥
- [ ] `.env` 文件中的 `STRIPE_WEBHOOK_SECRET` 已填写实际密钥
- [x] `.env` 文件中的 `BASE_URL` 已设置为生产域名

### Stripe Dashboard 配置
- [ ] Webhook 端点已添加并配置正确的事件
- [ ] 企业/个人信息已验证
- [ ] 银行账户已绑定
- [ ] 邮件通知已启用

### 测试
- [ ] 使用测试卡完成一次完整的支付流程
- [ ] Webhook 日志显示事件被正确接收
- [ ] 数据库中组织计划等级正确更新
- [ ] 用户收到确认邮件

### 安全
- [x] `.env` 文件在 `.gitignore` 中
- [ ] 服务器防火墙已配置（允许 Stripe IP）
- [ ] SSL 证书已配置（推荐使用 HTTPS）
- [ ] 日志记录已启用以便审计

### 监控
- [ ] 设置 Stripe Dashboard 邮件通知
- [ ] 定期检查 webhook 日志
- [ ] 监控付款失败率
- [ ] 定期备份数据库

## 🆘 故障排查

### Webhook 无法接收

**症状**：客户支付成功，但数据库未更新

**解决方法**：
1. 检查 webhook URL 是否正确：`http://44.220.181.78:3001/webhook/stripe`
2. 检查服务器是否在运行
3. 检查防火墙是否允许 Stripe IP 访问
4. 检查 `STRIPE_WEBHOOK_SECRET` 是否正确
5. 查看 Stripe Dashboard → Webhooks → 你的端点 → 查看失败日志

### 支付成功但订阅未激活

**症状**：Stripe 显示支付成功，但 `Organization.planTier` 未更新

**解决方法**：
1. 检查 webhook 日志：`server/stripe-webhook.ts`
2. 检查数据库连接是否正常
3. 手动触发 webhook 重放（在 Stripe Dashboard 中）
4. 检查代码中的 metadata 是否正确传递（`org_id`, `target_tier`）

### 生产密钥无效

**症状**：API 请求返回 401 错误

**解决方法**：
1. 确认密钥是否以 `sk_live_` 开头（不是 `sk_test_`）
2. 检查密钥是否有多余的空格或换行符
3. 在 Stripe Dashboard 重新生成密钥
4. 确认账户已完成验证

## 📞 获取帮助

### Stripe 支持
- **文档**：https://stripe.com/docs
- **社区**：https://stripe.com/community
- **支持**：https://support.stripe.com

### 相关文件
- 后端配置：[server/stripe-client.ts](server/stripe-client.ts)
- Webhook 处理：[server/stripe-webhook.ts](server/stripe-webhook.ts)
- 组织服务：[server/organization/org-service.ts](server/organization/org-service.ts)
- 环境变量：[.env](.env)

## 🎉 恭喜！

如果您完成了所有步骤，您的 Stripe 生产环境就已经准备好接收真实客户付款了！

**下一步**：
1. 开始营销推广您的 v3.0 AI Organization Governance 服务
2. 监控首批客户的支付流程
3. 根据反馈优化用户体验
4. 定期检查 Stripe Dashboard 的收入报告

祝您业务成功！🚀
