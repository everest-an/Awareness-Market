# Awareness Market - AWS 部署指南

## 项目概述

**项目名称**: Awareness Market (Neural Bridge AI潜意识市场)
**GitHub仓库**: https://github.com/everest-an/Awareness-Market
**技术栈**: Node.js + React + PostgreSQL (Prisma) + Redis (可选)
**部署目标**: AWS EC2 + RDS + S3

---

## 📋 前置准备清单

### 1. AWS服务需求

#### 必需服务：
- **EC2**: t3.medium 或更高 (2核4GB+)
- **RDS**: PostgreSQL 14+ 或 MySQL 8.0+
- **S3**: 存储向量包和文件
- **Security Groups**: 配置端口 3000, 3001, 8080, 8083

#### 可选服务：
- **ElastiCache Redis**: 生产环境速率限制
- **CloudFront**: CDN加速
- **Route 53**: 域名解析
- **Certificate Manager**: SSL证书

---

## 🗄️ 数据库配置

### PostgreSQL (推荐)

**RDS实例配置**:
```
引擎: PostgreSQL 14.x
实例类型: db.t3.small (最小)
存储: 20GB gp3
多可用区: 推荐启用
备份保留: 7天
```

**连接信息**:
```bash
# PostgreSQL URL格式
DATABASE_URL=postgresql://username:password@your-rds-endpoint.region.rds.amazonaws.com:5432/awareness_market

# 示例
DATABASE_URL=postgresql://admin:SecurePass123@awareness-db.abc123.us-east-1.rds.amazonaws.com:5432/awareness_market
```

## 🔐 环境变量配置

### 创建 `.env` 文件

在EC2上创建 `/var/www/awareness-market/.env`:

```bash
# ============================================
# Application
# ============================================
NODE_ENV=production
PORT=3001

# ============================================
# Database - 使用RDS端点
# ============================================
# PostgreSQL (推荐)
DATABASE_URL=postgresql://admin:YOUR_PASSWORD@your-rds-endpoint.us-east-1.rds.amazonaws.com:5432/awareness_market

# ============================================
# JWT Authentication - 生成新密钥
# ============================================
# 生成命令: openssl rand -base64 32
JWT_SECRET=YOUR_GENERATED_JWT_SECRET_HERE

# ============================================
# AWS S3 Storage - 使用IAM角色或密钥
# ============================================
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
S3_BUCKET_NAME=awareness-market-storage

# ============================================
# Email Service (Resend)
# ============================================
RESEND_API_KEY=re_...
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME=Awareness Market

# ============================================
# Redis (可选 - 推荐生产环境)
# ============================================
# ElastiCache Redis端点
REDIS_URL=redis://your-redis-endpoint.cache.amazonaws.com:6379

# ============================================
# Stripe (可选)
# ============================================
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...

# ============================================
# Blockchain (可选)
# ============================================
AMOY_RPC_URL=https://rpc-amoy.polygon.technology
POLYGON_RPC_URL=https://polygon-rpc.com
# AMEM_TOKEN_ADDRESS=0x...
# ERC8004_REGISTRY_ADDRESS=0x...

# ============================================
# OpenAI (可选)
# ============================================
# OPENAI_API_KEY=sk-...
```

---

## 🚀 部署步骤

### 步骤1: 准备EC2实例

```bash
# 1. SSH连接到EC2
ssh -i your-key.pem ubuntu@your-ec2-public-ip

# 2. 更新系统
sudo apt update && sudo apt upgrade -y

# 3. 安装Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# 4. 安装pnpm
sudo npm install -g pnpm

# 5. 安装PM2
sudo npm install -g pm2

# 6. 安装Git
sudo apt install -y git
```

### 步骤2: 克隆代码

```bash
# 创建项目目录
sudo mkdir -p /var/www/awareness-market
sudo chown -R ubuntu:ubuntu /var/www/awareness-market

# 克隆代码
cd /var/www
git clone https://github.com/everest-an/Awareness-Market.git awareness-market
cd awareness-market
```

### 步骤3: 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑环境变量 (使用nano或vim)
nano .env

# 重要: 更新以下内容
# 1. DATABASE_URL - 使用RDS端点
# 2. JWT_SECRET - 生成新的安全密钥
# 3. AWS_* - 配置S3访问
# 4. 其他必需的API密钥
```

### 步骤4: 安装依赖和构建

```bash
# 安装依赖
pnpm install

# 构建生产版本
pnpm run build

# 检查构建结果
ls -la dist/
```

### 步骤5: 数据库迁移

```bash
# 生成 Prisma Client
pnpm prisma generate

# 运行数据库迁移
pnpm prisma migrate deploy

# 可选: 运行种子数据
pnpm run seed
```

### 步骤6: 启动服务

```bash
# 使用PM2启动
pnpm run pm2:start

# 或直接使用PM2
pm2 start ecosystem.config.js --env production

# 查看状态
pm2 status

# 查看日志
pm2 logs awareness-market-api
```

### 步骤7: 配置PM2自动重启

```bash
# 保存PM2配置
pm2 save

# 设置开机自启动
pm2 startup

# 执行上一步输出的命令 (类似下面)
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu
```

---

## 🔧 配置Nginx反向代理 (推荐)

```bash
# 安装Nginx
sudo apt install -y nginx

# 创建配置文件
sudo nano /etc/nginx/sites-available/awareness-market
```

**Nginx配置**:
```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    # API代理
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 前端静态文件
    location / {
        root /var/www/awareness-market/dist/public;
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "public, max-age=31536000";
    }
}
```

```bash
# 启用站点
sudo ln -s /etc/nginx/sites-available/awareness-market /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重启Nginx
sudo systemctl restart nginx
```

---

## 📊 监控和日志

### PM2监控

```bash
# 实时监控
pm2 monit

# 查看日志
pm2 logs awareness-market-api

# 查看特定日志文件
tail -f logs/pm2-error.log
tail -f logs/pm2-out.log
```

### 系统监控

```bash
# CPU和内存使用
htop

# 磁盘使用
df -h

# 网络连接
netstat -tulpn | grep node
```

---

## 🔒 安全配置

### 1. 防火墙设置

```bash
# 配置UFW
sudo ufw allow 22/tcp  # SSH
sudo ufw allow 80/tcp  # HTTP
sudo ufw allow 443/tcp # HTTPS
sudo ufw enable
```

### 2. AWS Security Groups

配置EC2安全组:
- **入站规则**:
  - SSH (22): 仅你的IP
  - HTTP (80): 0.0.0.0/0
  - HTTPS (443): 0.0.0.0/0

- **出站规则**:
  - 允许所有 (访问RDS、S3等)

### 3. RDS安全组

- **入站规则**:
  - PostgreSQL (5432) 或 MySQL (3306): 仅EC2安全组

---

## 🔄 更新部署

```bash
# 1. 拉取最新代码
cd /var/www/awareness-market
git pull origin main

# 2. 安装新依赖
pnpm install

# 3. 重新构建
pnpm run build

# 4. 运行数据库迁移 (如果有)
pnpm prisma migrate deploy

# 5. 重启服务
pm2 restart awareness-market-api

# 6. 查看状态
pm2 status
```

---

## 🆘 故障排查

### 服务无法启动

```bash
# 检查PM2日志
pm2 logs awareness-market-api --lines 100

# 检查错误日志
cat logs/pm2-error.log

# 检查端口占用
sudo lsof -i :3001
```

### 数据库连接失败

```bash
# 测试数据库连接
# PostgreSQL
psql "postgresql://user:pass@endpoint:5432/dbname"

# MySQL
mysql -h endpoint -u user -p dbname

# 检查安全组规则
# 确保EC2可以访问RDS的端口
```

### 内存不足

```bash
# 查看内存使用
free -h

# 减少PM2实例数量 (编辑ecosystem.config.js)
# instances: 'max' 改为 instances: 2

# 重启PM2
pm2 restart ecosystem.config.js
```

---

## 📞 快速参考

### 关键文件位置

```
/var/www/awareness-market/          # 项目根目录
├── .env                            # 环境变量 (必须配置)
├── dist/                           # 构建产物
├── logs/                           # PM2日志
├── ecosystem.config.js             # PM2配置
└── package.json                    # 项目配置
```

### 常用命令

```bash
# PM2管理
pm2 start ecosystem.config.js       # 启动
pm2 restart awareness-market-api    # 重启
pm2 stop awareness-market-api       # 停止
pm2 logs awareness-market-api       # 查看日志
pm2 monit                          # 监控

# 数据库
pnpm prisma migrate deploy              # 运行迁移
pnpm run seed                      # 填充种子数据

# 构建
pnpm install                       # 安装依赖
pnpm run build                     # 构建生产版本
```

### 环境变量优先级

1. **必需** (服务无法启动):
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `NODE_ENV=production`

2. **强烈推荐**:
   - `AWS_*` (S3存储)
   - `REDIS_URL` (生产速率限制)

3. **可选**:
   - `STRIPE_*` (支付功能)
   - `OAUTH_*` (第三方登录)
   - `OPENAI_API_KEY` (AI功能)

---

## ✅ 部署检查清单

部署前确认:

- [ ] RDS数据库已创建并可访问
- [ ] S3存储桶已创建
- [ ] `.env` 文件已配置所有必需变量
- [ ] JWT_SECRET已生成新密钥 (不要使用默认值)
- [ ] 数据库迁移已运行
- [ ] 构建成功 (`dist/` 目录存在)
- [ ] PM2服务启动成功
- [ ] 通过公网IP/域名可访问
- [ ] Nginx反向代理已配置 (如果使用)
- [ ] SSL证书已配置 (生产环境)
- [ ] PM2已配置开机自启动

---

**部署支持**: 如有问题，检查 `logs/pm2-error.log` 和 GitHub Issues
**仓库**: https://github.com/everest-an/Awareness-Market
