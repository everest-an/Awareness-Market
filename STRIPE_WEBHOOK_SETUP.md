# Stripe Webhook 配置指南

## 📋 配置检查清单

- [x] 生产环境 API 密钥已配置
- [x] Webhook 端点代码已实现
- [ ] Stripe Dashboard 添加 webhook 端点
- [ ] 获取并配置 webhook 签名密钥
- [ ] 测试 webhook 是否正常工作
- [ ] 验证支付流程端到端

## 🔧 第一步：在 Stripe Dashboard 添加 Webhook 端点

### 1.1 访问 Webhook 配置页面

打开浏览器，访问：https://dashboard.stripe.com/webhooks

**重要**：确保您在 **生产模式**（右上角应该没有"测试模式"标记）

### 1.2 添加新端点

1. 点击右上角的 **"添加端点"** 或 **"Add endpoint"** 按钮

2. 在弹出的对话框中填写：

   **端点 URL**：
   ```
   http://44.220.181.78:3001/api/stripe/webhook
   ```

   > ⚠️ **注意**：
   > - URL 必须以 `/api/stripe/webhook` 结尾
   > - 端口是 `3001`（不是 3000）
   > - 如果您有域名，可以使用 `https://yourdomain.com/api/stripe/webhook`
   > - **强烈建议使用 HTTPS**（生产环境必需）

3. **描述**（可选）：
   ```
   Awareness Network Production Webhook
   ```

### 1.3 选择要监听的事件

在 "监听的事件" 或 "Events to send" 部分，您有两个选择：

**选项 A：选择所有事件（推荐用于调试）**
- 点击 "监听所有事件" 或 "Listen to all events"
- 这样可以确保不漏过任何事件

**选项 B：只选择必需的事件（推荐用于生产）**

点击 "选择事件" 或 "Select events"，然后搜索并勾选以下事件：

#### 支付相关 (Payment)
- ✅ `checkout.session.completed` - **最重要** - 支付成功
- ✅ `payment_intent.payment_failed` - 支付失败
- ✅ `charge.refunded` - 退款完成

#### 订阅相关 (Subscription)
- ✅ `customer.subscription.created` - 订阅创建
- ✅ `customer.subscription.updated` - 订阅更新（升级/降级）
- ✅ `customer.subscription.deleted` - 订阅取消

#### 发票相关 (Invoice)
- ✅ `invoice.paid` - 发票支付成功（续订）
- ✅ `invoice.payment_failed` - 发票支付失败

### 1.4 完成添加

点击 **"添加端点"** 或 **"Add endpoint"** 按钮完成配置。

## 🔑 第二步：获取 Webhook 签名密钥

### 2.1 查看端点详情

1. 在 webhook 列表中，找到刚才添加的端点
2. 点击端点 URL（`http://44.220.181.78:3001/api/stripe/webhook`）

### 2.2 获取签名密钥

1. 在端点详情页面，找到 **"签名密钥"** 或 **"Signing secret"** 部分
2. 点击 **"显示"** 或 **"Reveal"** 按钮
3. 复制密钥（格式：`whsec_xxxxxxxxxxxxx...`）

   示例：
   ```
   whsec_1234567890abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnop
   ```

### 2.3 更新 .env 文件

打开项目的 `.env` 文件，找到这一行：
```bash
STRIPE_WEBHOOK_SECRET=whsec_REPLACE_WITH_YOUR_WEBHOOK_SECRET_FROM_STRIPE_DASHBOARD
```

替换为您刚才复制的实际密钥：
```bash
STRIPE_WEBHOOK_SECRET=whsec_您刚才复制的实际密钥
```

**保存文件**。

## 🧪 第三步：测试 Webhook

### 3.1 使用 Stripe CLI 测试（推荐）

**安装 Stripe CLI**（如果尚未安装）：

Windows (使用 Scoop):
```bash
scoop bucket add stripe https://github.com/stripe/scoop-stripe-cli.git
scoop install stripe
```

或下载：https://github.com/stripe/stripe-cli/releases

**登录**：
```bash
stripe login
```

**转发 webhook 到本地**：
```bash
stripe listen --forward-to http://44.220.181.78:3001/api/stripe/webhook
```

**触发测试事件**：
```bash
# 测试支付成功
stripe trigger checkout.session.completed

# 测试订阅创建
stripe trigger customer.subscription.created

# 测试订阅更新
stripe trigger customer.subscription.updated
```

### 3.2 在 Stripe Dashboard 测试

1. 访问：https://dashboard.stripe.com/webhooks
2. 点击您的 webhook 端点
3. 点击 **"发送测试 webhook"** 或 **"Send test webhook"**
4. 选择事件类型：`checkout.session.completed`
5. 点击 **"发送测试事件"** 或 **"Send test event"**

### 3.3 检查测试结果

在 Stripe Dashboard 的 webhook 详情页面：
1. 查看 **"最近的事件"** 或 **"Recent events"** 部分
2. 应该看到测试事件的状态
3. ✅ **成功**：显示绿色勾号，状态码 200
4. ❌ **失败**：显示红色 X，可以点击查看错误详情

## 📊 第四步：查看服务器日志

### 4.1 启动服务器（如果尚未运行）

```bash
cd "e:\Awareness Market\Awareness-Network"
pnpm run build
NODE_ENV=production pnpm start
```

### 4.2 监控日志

在另一个终端窗口中：
```bash
# 如果使用 pm2
pm2 logs awareness-network

# 或直接查看日志文件
tail -f logs/app.log
```

成功接收 webhook 时，应该看到类似日志：
```
[Stripe:Webhook] Webhook event received eventType=checkout.session.completed eventId=evt_xxx
[Stripe:Webhook] Organization plan upgraded orgId=123 userId=456 targetTier=team
```

## 🔍 第五步：端到端测试（真实支付流程）

### 5.1 使用测试卡进行测试

即使在生产环境，Stripe 也支持使用测试卡号（不会产生真实费用）：

**成功支付测试卡**：
- 卡号：`4242 4242 4242 4242`
- 有效期：任意未来日期（如 `12/34`）
- CVC：任意 3 位数字（如 `123`）
- 邮编：任意 5 位数字（如 `12345`）

**3D Secure 测试卡**（需要额外验证）：
- 卡号：`4000 0027 6000 3184`

**支付失败测试卡**：
- 卡号：`4000 0000 0000 0002`

### 5.2 完整测试流程

1. **访问您的网站**：
   ```
   http://44.220.181.78:3001
   ```

2. **登录或注册账户**

3. **创建组织**（如果尚未创建）

4. **选择升级计划**：
   - 点击 "升级" 或 "Upgrade" 按钮
   - 选择计划：Lite ($49) / Team ($199) / Enterprise ($499) / Scientific ($999)

5. **进入 Stripe Checkout**：
   - 输入测试卡号：`4242 4242 4242 4242`
   - 填写其他信息
   - 点击 "订阅" 或 "Subscribe"

6. **等待重定向**：
   - 应该重定向回您的网站
   - 显示成功消息

7. **验证结果**：
   - 检查 Stripe Dashboard → Payments（应该看到新的支付记录）
   - 检查数据库（Organization 表的 `planTier` 应该已更新）
   - 检查 webhook 日志（应该显示 `checkout.session.completed` 事件）

### 5.3 验证数据库更新

连接数据库并查询：
```sql
-- 查看组织的计划等级
SELECT id, name, "planTier", "maxAgents", "stripeCustomerId"
FROM "Organization"
ORDER BY "createdAt" DESC
LIMIT 5;

-- 查看最近的通知
SELECT *
FROM "Notification"
WHERE type = 'subscription'
ORDER BY "createdAt" DESC
LIMIT 5;
```

## ⚠️ 常见问题排查

### 问题 1：Webhook 返回 401 Unauthorized

**原因**：签名验证失败

**解决方法**：
1. 检查 `.env` 文件中的 `STRIPE_WEBHOOK_SECRET` 是否正确
2. 确保密钥没有多余的空格或换行符
3. 重启服务器以应用新配置
4. 在 Stripe Dashboard 重新生成签名密钥

### 问题 2：Webhook 返回 404 Not Found

**原因**：URL 路径不正确

**解决方法**：
1. 确认 URL 是：`http://44.220.181.78:3001/api/stripe/webhook`
2. 注意端口号是 `3001`（不是 3000）
3. 确保 `/api/stripe/webhook` 路径完全匹配

### 问题 3：Webhook 返回 500 Internal Server Error

**原因**：服务器代码执行出错

**解决方法**：
1. 查看服务器日志：`tail -f logs/app.log`
2. 检查数据库连接是否正常
3. 确保所有环境变量都已正确配置
4. 检查 webhook 事件的 metadata 是否包含必需字段

### 问题 4：Webhook 接收成功，但数据库未更新

**原因**：Webhook 处理逻辑出错

**解决方法**：
1. 检查 webhook payload 中的 metadata：
   - `org_id` 是否存在
   - `target_tier` 是否正确
   - `user_id` 是否正确
2. 在 Stripe Dashboard 查看 webhook 详情，检查请求和响应内容
3. 手动触发 webhook 重放（Resend）
4. 检查代码中的事件处理逻辑：[server/stripe-webhook.ts:479-528](../server/stripe-webhook.ts#L479-L528)

### 问题 5：无法访问 webhook URL

**原因**：服务器未运行或防火墙阻止

**解决方法**：
1. 确认服务器正在运行：
   ```bash
   curl http://44.220.181.78:3001/health
   ```
2. 检查防火墙规则：
   - 允许入站连接到端口 3001
   - 允许来自 Stripe IP 的请求
3. 如果使用 HTTPS，确保 SSL 证书有效

## 🔐 安全最佳实践

### 1. 签名验证

✅ **已实现**：代码中已经实现了签名验证
```typescript
event = stripe.webhooks.constructEvent(
  req.body,
  sig,
  process.env.STRIPE_WEBHOOK_SECRET
);
```

### 2. HTTPS 配置（生产环境必需）

⚠️ **强烈建议**：使用 HTTPS 而不是 HTTP

**设置方法**：
1. 获取 SSL 证书（Let's Encrypt 免费）
2. 配置 Nginx 或 Caddy 作为反向代理
3. 更新 webhook URL 为 `https://yourdomain.com/api/stripe/webhook`

### 3. IP 白名单（可选）

Stripe webhook 请求来自以下 IP 范围：
- `3.18.12.63`
- `3.130.192.231`
- `13.235.14.237`
- `13.235.122.149`
- `18.211.135.69`
- `35.154.171.200`
- `52.15.183.38`
- `54.88.130.119`
- `54.88.130.237`
- `54.187.174.169`
- `54.187.205.235`
- `54.187.216.72`

可以在防火墙中只允许这些 IP 访问 webhook 端点。

## 📈 监控和维护

### 1. 设置告警

在 Stripe Dashboard → Settings → Webhooks：
- 启用 "失败 webhook 通知"
- 设置邮件接收地址
- 当 webhook 失败率超过 5% 时会收到邮件

### 2. 定期检查

每周检查：
- Webhook 成功率（应该 > 99%）
- 失败事件日志
- 响应时间（应该 < 1 秒）

### 3. Webhook 重试机制

Stripe 会自动重试失败的 webhook：
- 第 1 次：立即
- 第 2 次：1 小时后
- 第 3 次：3 小时后
- ...最多重试 3 天

如果所有重试都失败，您需要：
1. 在 Stripe Dashboard 查看失败的事件
2. 修复问题
3. 手动 "Resend" 重放事件

## ✅ 配置完成检查清单

在进入生产环境前，确认以下所有项：

### Stripe Dashboard 配置
- [ ] Webhook 端点已添加（`http://44.220.181.78:3001/api/stripe/webhook`）
- [ ] 所有必需事件已选择（至少 8 个）
- [ ] 签名密钥已复制并配置到 `.env` 文件
- [ ] 测试事件发送成功（返回 200）

### 服务器配置
- [ ] `.env` 文件中 `STRIPE_WEBHOOK_SECRET` 已更新
- [ ] 服务器已重启以应用新配置
- [ ] 端口 3001 已开放并可访问
- [ ] 日志记录已启用

### 测试验证
- [ ] CLI 测试成功（`stripe trigger` 命令）
- [ ] Dashboard 测试成功（发送测试 webhook）
- [ ] 端到端测试成功（使用测试卡完成支付）
- [ ] 数据库更新验证通过
- [ ] 用户收到通知邮件

### 安全检查
- [ ] 签名验证已启用
- [ ] 环境变量未提交到 Git
- [ ] 考虑迁移到 HTTPS
- [ ] 防火墙规则已配置

### 监控
- [ ] Webhook 失败告警已启用
- [ ] 日志监控已设置
- [ ] 定期检查计划已制定

## 🎉 下一步

配置完成后，您就可以：
1. ✅ 接收真实客户的订阅付款
2. ✅ 自动处理订阅升级/降级
3. ✅ 处理支付失败和退款
4. ✅ 追踪所有支付事件

**准备开始营销推广您的 AI Organization Governance 服务了！** 🚀

## 📞 获取帮助

- **Stripe 文档**：https://stripe.com/docs/webhooks
- **Webhook 测试工具**：https://dashboard.stripe.com/webhooks
- **Stripe CLI**：https://stripe.com/docs/stripe-cli
- **社区支持**：https://stripe.com/community

---

**需要帮助？** 查看完整部署指南：[STRIPE_PRODUCTION_SETUP.md](STRIPE_PRODUCTION_SETUP.md)
