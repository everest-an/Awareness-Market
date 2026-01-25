# Awareness Market - AWS EC2 Deployment Guide

## 概述

本指南将帮助您将Awareness Market平台部署到AWS EC2服务器（3.235.251.106，域名：https://awareness.market）。

## 重要变更

本次更新包含以下重大变更：

1. **独立认证系统**：完全移除Manus OAuth依赖，实现基于JWT的邮箱/密码认证
2. **JWT令牌认证**：使用HTTP-only cookies存储JWT访问令牌和刷新令牌
3. **向后兼容**：保留Manus OAuth fallback支持，确保平滑迁移

## 部署前准备

### 1. 环境变量配置

确保EC2服务器上的`.env`文件包含以下必需变量：

```bash
# 数据库配置（AWS RDS）
DATABASE_URL=mysql://username:password@awareness-db.cluster-cezeeou48sif.us-east-1.rds.amazonaws.com:3306/awareness

# JWT密钥（重要：生产环境必须更改！）
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# S3存储配置
AWS_S3_BUCKET=awareness-market-storage
AWS_S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key

# OpenAI API（用于智能推荐）
OPENAI_API_KEY=your-openai-api-key

# Stripe支付配置
STRIPE_SECRET_KEY=your-stripe-secret-key
STRIPE_WEBHOOK_SECRET=your-stripe-webhook-secret

# 应用配置
NODE_ENV=production
PORT=3000
```

### 2. 备份当前部署

```bash
# SSH登录到EC2
ssh -i your-key.pem ubuntu@3.235.251.106

# 备份当前应用
cd /var/www
sudo tar -czf awareness-backup-$(date +%Y%m%d-%H%M%S).tar.gz awareness/

# 备份数据库（可选）
mysqldump -h awareness-db.cluster-cezeeou48sif.us-east-1.rds.amazonaws.com \
  -u username -p awareness > awareness-db-backup-$(date +%Y%m%d).sql
```

## 部署步骤

### 步骤1：上传部署包

```bash
# 在本地机器上，将部署包上传到EC2
scp -i your-key.pem awareness-market-deployment.tar.gz ubuntu@3.235.251.106:/tmp/
```

### 步骤2：解压并替换文件

```bash
# SSH登录到EC2
ssh -i your-key.pem ubuntu@3.235.251.106

# 停止当前应用
pm2 stop awareness

# 解压部署包
cd /tmp
tar -xzf awareness-market-deployment.tar.gz

# 备份当前.env文件
cp /var/www/awareness/.env /tmp/awareness-env-backup

# 替换应用文件（保留.env）
sudo rm -rf /var/www/awareness/dist
sudo rm -rf /var/www/awareness/node_modules
sudo cp -r awareness-market-deployment/* /var/www/awareness/

# 恢复.env文件
sudo cp /tmp/awareness-env-backup /var/www/awareness/.env

# 设置权限
sudo chown -R ubuntu:ubuntu /var/www/awareness
```

### 步骤3：安装依赖

```bash
cd /var/www/awareness

# 安装Node.js依赖
pnpm install --prod
```

### 步骤4：数据库迁移

```bash
# 运行数据库迁移（如果有schema变更）
pnpm db:push
```

### 步骤5：启动应用

```bash
# 使用PM2启动应用
pm2 start dist/index.js --name awareness

# 或者重启现有进程
pm2 restart awareness

# 查看日志确认启动成功
pm2 logs awareness

# 保存PM2配置
pm2 save
```

### 步骤6：验证部署

```bash
# 检查应用状态
pm2 status

# 检查应用日志
pm2 logs awareness --lines 50

# 测试HTTP响应
curl http://localhost:3000

# 测试HTTPS（通过Nginx）
curl https://awareness.market
```

## 认证系统测试

### 1. 测试注册功能

```bash
curl -X POST https://awareness.market/api/trpc/auth.registerEmail \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "testpassword123",
    "name": "Test User"
  }'
```

### 2. 测试登录功能

```bash
curl -X POST https://awareness.market/api/trpc/auth.loginEmail \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "testpassword123"
  }' \
  -c cookies.txt
```

### 3. 测试受保护路由

```bash
curl https://awareness.market/api/trpc/auth.me \
  -b cookies.txt
```

## Nginx配置（如需更新）

确保Nginx配置正确代理到Node.js应用：

```nginx
server {
    listen 80;
    listen 443 ssl http2;
    server_name awareness.market;

    ssl_certificate /etc/letsencrypt/live/awareness.market/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/awareness.market/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

重启Nginx：

```bash
sudo nginx -t
sudo systemctl restart nginx
```

## 故障排除

### 应用无法启动

```bash
# 查看详细日志
pm2 logs awareness --lines 100

# 检查端口占用
sudo netstat -tulpn | grep 3000

# 检查环境变量
cat /var/www/awareness/.env
```

### 数据库连接失败

```bash
# 测试数据库连接
mysql -h awareness-db.cluster-cezeeou48sif.us-east-1.rds.amazonaws.com \
  -u username -p -e "SELECT 1"

# 检查RDS安全组规则
# 确保EC2实例的安全组可以访问RDS的3306端口
```

### JWT令牌问题

```bash
# 检查JWT_SECRET是否设置
grep JWT_SECRET /var/www/awareness/.env

# 清除浏览器cookies重新登录
# 或使用无痕模式测试
```

### Nginx 502错误

```bash
# 检查Node.js应用是否运行
pm2 status

# 检查Nginx错误日志
sudo tail -f /var/log/nginx/error.log

# 检查防火墙规则
sudo ufw status
```

## 回滚步骤

如果部署出现问题，可以快速回滚：

```bash
# 停止当前应用
pm2 stop awareness

# 恢复备份
cd /var/www
sudo rm -rf awareness
sudo tar -xzf awareness-backup-YYYYMMDD-HHMMSS.tar.gz

# 重启应用
pm2 restart awareness
```

## 性能优化建议

### 1. 启用PM2集群模式

```bash
pm2 start dist/index.js --name awareness -i max
```

### 2. 配置Nginx缓存

```nginx
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=my_cache:10m max_size=1g inactive=60m;

location /assets {
    proxy_cache my_cache;
    proxy_cache_valid 200 1d;
    proxy_pass http://localhost:3000;
}
```

### 3. 启用Gzip压缩

```nginx
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json;
```

## Cloudflare CDN配置（可选）

为了提高中国地区访问速度，建议配置Cloudflare CDN：

### 1. 添加域名到Cloudflare

1. 登录Cloudflare控制台
2. 添加站点：awareness.market
3. 按照提示更新DNS nameservers

### 2. 配置DNS记录

```
类型: A
名称: @
内容: 3.235.251.106
代理状态: 已代理（橙色云朵）
```

### 3. 配置缓存规则

- 缓存级别：标准
- 浏览器缓存TTL：4小时
- 始终在线：启用

### 4. 配置SSL/TLS

- SSL/TLS加密模式：完全（严格）
- 自动HTTPS重写：启用
- 最低TLS版本：TLS 1.2

## 监控和维护

### 设置PM2监控

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

### 设置自动重启

```bash
# 添加到crontab
crontab -e

# 每天凌晨3点重启应用
0 3 * * * pm2 restart awareness
```

### 监控日志

```bash
# 实时查看日志
pm2 logs awareness

# 查看错误日志
pm2 logs awareness --err

# 清空日志
pm2 flush
```

## 安全建议

1. **更改JWT_SECRET**：使用强随机字符串
2. **启用防火墙**：只开放必要端口（80, 443, 22）
3. **定期更新**：保持系统和依赖包最新
4. **备份策略**：每天自动备份数据库和应用文件
5. **SSL证书**：使用Let's Encrypt自动续期

## 联系支持

如有问题，请联系：
- GitHub: https://github.com/everest-an/Awareness-Market
- Email: support@awareness.market

---

部署日期：2026-01-03
版本：v2.0 (JWT Authentication)
