# 部署前检查清单 ✅

## 概述

本检查清单确保Awareness Market在部署前已正确配置所有必要组件。

**自动检查**: 运行 `pnpm run check:deploy`

---

## ✅ 1. 环境配置

### 1.1 环境变量

**检查命令**: `pnpm run check:env`

- [ ] `NODE_ENV=production`
- [ ] `DATABASE_URL` 已配置并可连接
- [ ] `JWT_SECRET` 已生成（>=32字符）
- [ ] AWS S3 凭证已配置
  - [ ] `AWS_REGION`
  - [ ] `AWS_ACCESS_KEY_ID`
  - [ ] `AWS_SECRET_ACCESS_KEY`
  - [ ] `S3_BUCKET_NAME`
- [ ] 邮件服务已配置
  - [ ] `RESEND_API_KEY`
  - [ ] `EMAIL_FROM`

**文档**: [ENV_SETUP_GUIDE.md](ENV_SETUP_GUIDE.md)

### 1.2 PostgreSQL数据库

- [ ] RDS PostgreSQL实例已创建
- [ ] 安全组配置正确（允许EC2访问）
- [ ] DATABASE_URL格式正确
- [ ] 数据库可连接

**测试连接**:
```bash
psql "$DATABASE_URL" -c "SELECT version();"
```

**文档**: [AWS_RDS_POSTGRESQL_SETUP.md](AWS_RDS_POSTGRESQL_SETUP.md)

### 1.3 AWS S3存储

- [ ] S3存储桶已创建
- [ ] IAM用户有S3访问权限
- [ ] 测试上传/下载成功

**测试S3**:
```bash
aws s3 ls s3://$S3_BUCKET_NAME --region $AWS_REGION
```

---

## ✅ 2. 代码和构建

### 2.1 代码准备

- [ ] 代码已提交到Git
- [ ] 所有TypeScript错误已修复 (`pnpm run check`)
- [ ] 所有测试通过 (`pnpm test`) - 97+ tests, 100% pass rate
- [ ] 生产环境构建成功 (`pnpm run build`)
- [ ] 依赖已更新 (`pnpm update`)

### 2.2 依赖安装

- [ ] Node.js >= 18.x 已安装
- [ ] pnpm 已安装
- [ ] PM2 已安装 (`npm install -g pm2`)
- [ ] 生产依赖已安装 (`pnpm install --prod`)

---

## ✅ 3. 数据库迁移

### 3.1 Schema部署

- [ ] PostgreSQL schema已转换
- [ ] Migration文件已生成
- [ ] Migrations已应用到数据库

**运行迁移**:
```bash
pnpm prisma generate
pnpm prisma migrate deploy
```

### 3.2 种子数据（可选）

- [ ] 示例数据已填充（用于测试）

**填充数据**:
```bash
npx tsx scripts/seed-three-product-lines.ts
```

---

## ✅ 4. PM2配置

### 4.1 配置检查

- [ ] `ecosystem.config.js` 存在
- [ ] 实例数量配置合理
- [ ] 内存限制已设置
- [ ] 日志路径正确

### 4.2 PM2启动

- [ ] PM2服务已启动
- [ ] 应用状态为 `online`
- [ ] 无频繁重启
- [ ] 日志无错误

**启动和检查**:
```bash
pnpm run pm2:start
pm2 status
pm2 logs --lines 50
```

### 4.3 开机自启

- [ ] PM2 startup配置完成
- [ ] 当前配置已保存 (`pm2 save`)

**配置自启动**:
```bash
pm2 startup
pm2 save
```

**文档**: [PM2_GUIDE.md](PM2_GUIDE.md)

---

## ✅ 5. 监控和日志

### 5.1 日志配置

- [ ] `logs/` 目录存在并有写权限
- [ ] PM2日志轮转已配置
- [ ] 日志级别适当（生产环境应为 `info` 或 `warn`）

**安装日志轮转**:
```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 30
```

### 5.2 资源监控

- [ ] 资源监控脚本可运行
- [ ] CPU使用率正常 (<80%)
- [ ] 内存使用率正常 (<85%)
- [ ] 磁盘空间充足 (>10GB可用)

**监控资源**:
```bash
pnpm run monitor:watch
```

---

## ✅ 6. 安全配置

### 6.1 访问控制

- [ ] EC2安全组仅开放必要端口
  - SSH (22): 仅特定IP
  - HTTP (80): 公开或通过CDN
  - HTTPS (443): 公开或通过CDN
  - 应用端口 (3001): 仅内部访问
- [ ] RDS安全组仅允许EC2访问
- [ ] S3存储桶禁用公共访问

### 6.2 密钥管理

- [ ] `.env` 文件未提交到Git
- [ ] JWT_SECRET使用强随机值
- [ ] AWS密钥定期轮换
- [ ] 数据库密码强度足够

### 6.3 HTTPS配置（生产环境）

- [ ] SSL证书已安装
- [ ] Nginx/CloudFront配置HTTPS
- [ ] HTTP自动重定向到HTTPS

---

## ✅ 7. 网络和DNS

### 7.1 域名配置

- [ ] 域名已注册
- [ ] DNS记录已配置
  - A记录指向EC2/负载均衡器
  - MX记录配置邮件服务
- [ ] DNS传播完成

### 7.2 反向代理（推荐）

- [ ] Nginx已安装并配置
- [ ] 反向代理到应用端口
- [ ] 静态文件服务配置
- [ ] Gzip压缩已启用

**文档**: [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) (步骤6)

---

## ✅ 8. 备份和恢复

### 8.1 数据库备份

- [ ] RDS自动备份已启用（7-30天）
- [ ] 手动快照已创建（部署前）
- [ ] 备份恢复流程已测试

### 8.2 代码备份

- [ ] 代码已推送到GitHub
- [ ] 生产分支（main）受保护
- [ ] Tag标记当前版本

---

## ✅ 9. 性能优化

### 9.1 应用优化

- [ ] 生产构建启用压缩
- [ ] 静态资源启用缓存
- [ ] 数据库连接池配置
- [ ] Redis缓存已配置（可选）

### 9.2 基础设施优化

- [ ] CDN已配置（CloudFront）
- [ ] 数据库索引优化
- [ ] 图片压缩和优化
- [ ] API响应缓存

---

## ✅ 10. 测试验证

### 10.1 功能测试

- [ ] 用户注册/登录正常
- [ ] 三大市场显示数据
- [ ] 向量包上传/下载正常
- [ ] 支付流程正常（如启用）
- [ ] 邮件发送正常

### 10.2 性能测试

- [ ] 页面加载时间 <3秒
- [ ] API响应时间 <500ms
- [ ] 并发处理能力测试
- [ ] 压力测试通过

### 10.3 安全测试

- [ ] SQL注入测试通过
- [ ] XSS防护测试通过
- [ ] CSRF防护测试通过
- [ ] 权限控制测试通过

---

## 🚀 部署流程

### 首次部署

```bash
# 1. 检查配置
pnpm run check:deploy

# 2. 检查环境变量
pnpm run check:env

# 3. 运行测试
pnpm test

# 4. 构建生产版本
pnpm run build

# 5. 运行数据库迁移
pnpm prisma migrate deploy

# 6. 填充示例数据（可选）
npx tsx scripts/seed-three-product-lines.ts

# 7. 启动PM2
pnpm run pm2:start

# 8. 验证状态
pm2 status
pm2 logs --lines 50

# 9. 监控资源
pnpm run monitor

# 10. 测试应用
curl http://localhost:3001/health
```

### 更新部署

```bash
# 1. 拉取最新代码
git pull origin main

# 2. 安装依赖
pnpm install

# 3. 构建
pnpm run build

# 4. 运行迁移（如有）
pnpm prisma migrate deploy

# 5. 零停机重载
pm2 reload ecosystem.config.js

# 6. 验证
pm2 status
```

---

## 🆘 故障排查

### 应用无法启动

```bash
# 检查日志
pm2 logs --err --lines 100

# 检查环境变量
pnpm run check:env

# 手动运行（调试）
NODE_ENV=production node dist/index.js
```

### 数据库连接失败

```bash
# 测试连接
psql "$DATABASE_URL"

# 检查安全组
# AWS Console → EC2 → Security Groups
# AWS Console → RDS → 数据库 → Connectivity
```

### S3上传失败

```bash
# 测试AWS凭证
aws sts get-caller-identity

# 测试S3访问
aws s3 ls s3://$S3_BUCKET_NAME
```

---

## 📊 监控指标

### 应该监控的关键指标

- **应用**
  - PM2进程状态
  - 应用重启次数
  - API响应时间
  - 错误率

- **服务器**
  - CPU使用率 (目标: <70%)
  - 内存使用率 (目标: <80%)
  - 磁盘使用率 (目标: <80%)
  - 网络I/O

- **数据库**
  - 连接数
  - 查询性能
  - 慢查询
  - 存储空间

- **业务**
  - 用户活跃数
  - 向量包下载量
  - 交易成功率
  - 错误日志数量

---

## 📞 紧急联系

### 服务提供商支持

- **AWS**: https://console.aws.amazon.com/support/home
- **Resend**: https://resend.com/support
- **Stripe**: https://support.stripe.com/

### 快速回滚

```bash
# 方法1: Git回滚
git revert HEAD
pnpm run build
pm2 reload ecosystem.config.js

# 方法2: PM2部署回滚
pm2 deploy ecosystem.config.js production revert 1

# 方法3: RDS恢复
# AWS Console → RDS → Automated backups → Restore to point in time
```

---

## ✅ 最终检查

部署到生产环境前，确认：

- [ ] 所有上述检查项已完成
- [ ] 自动检查脚本全部通过
- [ ] 在staging环境测试成功
- [ ] 团队成员已通知
- [ ] 备份已创建
- [ ] 回滚方案已准备
- [ ] 监控已配置
- [ ] 文档已更新

**运行最终检查**:
```bash
pnpm run check:deploy
```

如果所有检查通过，您已准备好部署到生产环境！🚀

---

**相关文档**:
- [ENV_SETUP_GUIDE.md](ENV_SETUP_GUIDE.md) - 环境变量配置
- [AWS_RDS_POSTGRESQL_SETUP.md](AWS_RDS_POSTGRESQL_SETUP.md) - 数据库设置
- [PM2_GUIDE.md](PM2_GUIDE.md) - PM2进程管理
- [POSTGRESQL_SETUP.md](POSTGRESQL_SETUP.md) - PostgreSQL本地设置
- [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) - 完整部署指南

---

**维护者**: Claude Opus 4.5
**最后更新**: 2026-02-01
