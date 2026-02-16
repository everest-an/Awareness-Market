# Awareness Market 部署指南

本文档提供 Awareness Market 项目的完整部署方案，包括 EC2 和 Vercel 两种部署方式。

---

## 📋 目录

- [架构概览](#架构概览)
- [环境要求](#环境要求)
- [EC2 部署](#ec2-部署)
- [Vercel 部署](#vercel-部署)
- [环境变量配置](#环境变量配置)
- [常见问题](#常见问题)
- [故障排查](#故障排查)

---

## 🏗️ 架构概览

### 生产环境架构

```
┌─────────────────────────────────────────────────────────────┐
│                        用户浏览器                              │
└────────────┬────────────────────────────────┬────────────────┘
             │                                │
             │ HTTPS                          │ HTTPS
             ▼                                ▼
┌────────────────────────┐      ┌────────────────────────────┐
│   EC2 部署 (推荐)        │      │      Vercel 部署            │
│  awareness.market      │      │  awareness-network-v2      │
│                        │      │  .vercel.app               │
├────────────────────────┤      └────────────┬───────────────┘
│  Nginx (反向代理)       │                   │
│  ├─ 静态文件服务        │                   │ HTTPS
│  └─ /api/* → Node.js   │                   │
├────────────────────────┤                   ▼
│  Node.js 后端          │      ┌────────────────────────────┐
│  ├─ tRPC API          │      │   EC2 后端 API             │
│  ├─ Socket.IO         │◄─────┤  api.protocolbanks.com     │
│  └─ Prisma ORM        │      │  ├─ tRPC API               │
└────────────┬───────────┘      │  ├─ Socket.IO              │
             │                  │  └─ Prisma ORM             │
             │ TCP              └────────────┬───────────────┘
             ▼                               │ TCP
┌────────────────────────┐                   │
│   PostgreSQL 数据库     │◄──────────────────┘
│   (AWS RDS)            │
└────────────────────────┘
```

### 部署方式对比

| 特性 | EC2 部署 | Vercel 部署 |
|:---|:---|:---|
| **前端** | Nginx 静态文件服务 | Vercel CDN |
| **后端** | 同一服务器 | 独立 EC2 API 服务器 |
| **HTTPS** | Let's Encrypt (Nginx) | Vercel 自动 |
| **域名** | awareness.market | awareness-network-v2.vercel.app |
| **部署速度** | 慢（需手动构建） | 快（自动 CI/CD） |
| **适用场景** | 生产环境 | 开发/预览环境 |

---

## 🔧 环境要求

### 服务器要求（EC2）

- **操作系统**: Amazon Linux 2023
- **实例类型**: t3.medium 或更高（推荐 t3.large）
- **内存**: 至少 4GB（构建时需要大量内存）
- **存储**: 至少 20GB
- **安全组**: 开放端口 22 (SSH), 80 (HTTP), 443 (HTTPS), 3001 (API)

### 软件依赖

```bash
# Node.js
node --version  # v22.13.0 或更高

# pnpm
pnpm --version  # 9.15.4 或更高

# PM2
pm2 --version   # 5.x

# Nginx
nginx -v        # 1.24.0 或更高

# Certbot (Let's Encrypt)
certbot --version  # 2.x
```

---

## 🚀 EC2 部署

### 1. 准备工作

#### 1.1 SSH 连接到 EC2

```bash
ssh -i awareness-key.pem ec2-user@44.220.181.78
```

#### 1.2 克隆代码仓库

```bash
cd /home/ec2-user
gh repo clone everest-an/Awareness-Market
cd Awareness-Market
```

#### 1.3 安装依赖

```bash
pnpm install
```

### 2. 环境变量配置

创建 `.env` 文件：

```bash
cat > .env << 'EOF'
# Database
DATABASE_URL="postgresql://username:password@database-host:5432/awareness"

# Server
NODE_ENV=production
PORT=3001

# API Keys (if needed)
# OPENAI_API_KEY=sk-...
# AWS_ACCESS_KEY_ID=...
# AWS_SECRET_ACCESS_KEY=...
EOF
```

### 3. 数据库迁移

```bash
# 生成 Prisma Client
pnpm prisma generate

# 运行数据库迁移
pnpm prisma migrate deploy
```

### 4. 构建项目

#### ⚠️ 重要：增加 Node.js 内存限制

由于项目较大，构建时需要增加内存限制：

```bash
export NODE_OPTIONS="--max-old-space-size=4096"
pnpm run build
```

**构建时间**: 约 2-3 分钟

**构建输出**:
```
dist/
├── public/          # 前端静态文件
│   ├── index.html
│   ├── js/
│   │   └── index-[hash].js  # 单文件构建 (~3.3MB)
│   ├── css/
│   └── chunks/
└── server/          # 后端代码（可选，如果后端构建失败可忽略）
```

### 5. 配置 Nginx

#### 5.1 创建 Nginx 配置文件

```bash
sudo nano /etc/nginx/conf.d/awareness.conf
```

**配置内容**:

```nginx
# HTTP 重定向到 HTTPS
server {
    listen 80;
    server_name awareness.market www.awareness.market;
    
    # Let's Encrypt 验证
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    # 重定向到 HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS 主站
server {
    listen 443 ssl http2;
    server_name awareness.market www.awareness.market;
    
    # SSL 证书
    ssl_certificate /etc/letsencrypt/live/awareness.market/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/awareness.market/privkey.pem;
    
    # SSL 配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # 静态文件根目录
    root /home/ec2-user/Awareness-Market/dist/public;
    index index.html;
    
    # 静态文件缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # API 代理
    location /api/ {
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
    
    # Socket.IO
    location /socket.io/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    
    # SPA 路由支持
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

#### 5.2 测试并重启 Nginx

```bash
sudo nginx -t
sudo systemctl restart nginx
```

### 6. 配置 SSL 证书（Let's Encrypt）

#### 6.1 安装 Certbot

```bash
sudo yum install -y certbot python3-certbot-nginx
```

#### 6.2 获取证书

```bash
sudo certbot --nginx -d awareness.market -d www.awareness.market
```

按提示输入邮箱并同意服务条款。

#### 6.3 自动续期

Certbot 会自动配置 cron 任务，证书将在到期前自动续期。

验证自动续期：

```bash
sudo certbot renew --dry-run
```

### 7. 启动后端服务

#### 7.1 使用 PM2 启动

```bash
pm2 start dist/server/index.js --name awareness-api
pm2 save
pm2 startup
```

#### 7.2 查看日志

```bash
pm2 logs awareness-api
```

#### 7.3 重启服务

```bash
pm2 restart awareness-api
```

### 8. 验证部署

访问 https://awareness.market 检查：

- ✅ 页面正常渲染
- ✅ 导航栏、按钮、内容完整显示
- ✅ API 请求正常（检查浏览器开发者工具 Network 标签）
- ✅ 无控制台错误

---

## ☁️ Vercel 部署

### 1. 准备工作

#### 1.1 连接 GitHub 仓库

1. 访问 [Vercel Dashboard](https://vercel.com)
2. 点击 "Add New Project"
3. 选择 `everest-an/Awareness-Market` 仓库
4. 点击 "Import"

#### 1.2 配置构建设置

- **Framework Preset**: Vite
- **Build Command**: `pnpm run build`
- **Output Directory**: `dist/public`
- **Install Command**: `pnpm install`

### 2. 环境变量配置

在 Vercel Dashboard → Settings → Environment Variables 添加：

| 变量名 | 值 | 环境 |
|:---|:---|:---|
| `VITE_API_URL` | `https://api.protocolbanks.com` | Production, Preview, Development |

**⚠️ 重要**: 环境变量修改后必须重新部署才能生效！

### 3. 配置 EC2 后端 API

#### 3.1 配置域名

在 DNS 提供商添加 A 记录：

```
api.protocolbanks.com → 44.220.181.78
```

#### 3.2 配置 Nginx（API 服务器）

```bash
sudo nano /etc/nginx/conf.d/api-protocolbanks.conf
```

**配置内容**:

```nginx
server {
    listen 80;
    server_name api.protocolbanks.com;
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    location / {
        return 301 https://$server_name$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name api.protocolbanks.com;
    
    ssl_certificate /etc/letsencrypt/live/api.protocolbanks.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.protocolbanks.com/privkey.pem;
    
    location / {
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
}
```

#### 3.3 获取 SSL 证书

```bash
sudo certbot --nginx -d api.protocolbanks.com
```

#### 3.4 配置 CORS

编辑 `server/_core/socket-events.ts`：

```typescript
const io = new Server(server, {
  cors: {
    origin: [
      'http://localhost:5173',
      'https://awareness-network-v2.vercel.app',
      'https://awareness-network-v2-git-main-everest-ans-projects.vercel.app',
      'https://awareness-network-v2-everest-ans-projects.vercel.app'
    ],
    credentials: true
  }
});
```

重新构建并重启：

```bash
export NODE_OPTIONS="--max-old-space-size=4096"
pnpm run build
pm2 restart awareness-api
```

### 4. 触发部署

#### 方法 1: 自动部署（推荐）

推送代码到 GitHub：

```bash
git add .
git commit -m "Update configuration"
git push origin main
```

Vercel 会自动检测并部署。

#### 方法 2: 手动部署

在 Vercel Dashboard → Deployments → 点击 "Redeploy"

### 5. 验证部署

访问 https://awareness-network-v2.vercel.app 检查：

- ✅ 页面正常渲染
- ✅ API 连接到 `https://api.protocolbanks.com`
- ✅ 无混合内容错误
- ✅ 无 CORS 错误

---

## 🔐 环境变量配置

### EC2 环境变量

**位置**: `/home/ec2-user/Awareness-Market/.env`

```bash
# 数据库
DATABASE_URL="postgresql://username:password@host:5432/awareness"

# 服务器
NODE_ENV=production
PORT=3001

# API Keys
OPENAI_API_KEY=sk-...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
S3_BUCKET_NAME=...

# JWT
JWT_SECRET=your-secret-key
```

### Vercel 环境变量

**位置**: Vercel Dashboard → Settings → Environment Variables

```bash
# API URL（必须）
VITE_API_URL=https://api.protocolbanks.com

# 其他前端环境变量（如需要）
VITE_GOOGLE_ANALYTICS_ID=G-...
```

**⚠️ 注意**:
- Vercel 环境变量以 `VITE_` 开头才能在前端访问
- 修改后必须重新部署

---

## ❓ 常见问题

### Q1: 前端黑屏，无法渲染

**症状**: 页面显示黑屏，`#root` 元素为空

**原因**: Vite 代码分割导致模块加载顺序问题

**解决方案**: 已在 `vite.config.ts` 中禁用代码分割

```typescript
rollupOptions: {
  output: {
    manualChunks: undefined, // 禁用代码分割
  }
}
```

### Q2: 构建失败（内存不足）

**症状**: 
```
FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory
```

**解决方案**: 增加 Node.js 内存限制

```bash
export NODE_OPTIONS="--max-old-space-size=4096"
pnpm run build
```

### Q3: Vercel 环境变量不生效

**症状**: 前端仍使用旧的 API URL

**原因**: Vercel 需要重新构建才能注入新的环境变量

**解决方案**:
1. 修改环境变量后，手动触发重新部署
2. 或者推送一个新的提交到 GitHub

### Q4: CORS 错误

**症状**: 
```
Access to fetch at 'https://api.protocolbanks.com/api/trpc/...' from origin 'https://awareness-network-v2.vercel.app' has been blocked by CORS policy
```

**解决方案**: 在 EC2 后端添加 Vercel 域名到 CORS 白名单

```typescript
cors: {
  origin: [
    'https://awareness-network-v2.vercel.app',
    // 添加其他 Vercel 预览域名
  ],
  credentials: true
}
```

### Q5: SSL 证书过期

**症状**: 浏览器显示 "Your connection is not private"

**解决方案**: Let's Encrypt 证书有效期 90 天，Certbot 会自动续期

手动续期：

```bash
sudo certbot renew
sudo systemctl reload nginx
```

---

## 🔍 故障排查

详细的故障排查指南请参阅 [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

### 快速诊断

```bash
# 检查后端服务状态
pm2 status

# 查看后端日志
pm2 logs awareness-api --lines 50

# 检查 Nginx 状态
sudo systemctl status nginx

# 查看 Nginx 错误日志
sudo tail -f /var/log/nginx/error.log

# 测试 API 连接
curl -I https://api.protocolbanks.com/api/trpc/auth.me

# 检查 SSL 证书
sudo certbot certificates
```

---

## 📚 相关文档

- [故障排查指南](./TROUBLESHOOTING.md)
- [前端黑屏问题修复总结](./fix-summary.md)
- [Vite 配置说明](./vite.config.ts)
- [Nginx 配置模板](./nginx/)

---

## 📝 更新日志

### 2026-02-02
- ✅ 修复前端黑屏问题（禁用代码分割）
- ✅ 配置 EC2 HTTPS（Let's Encrypt）
- ✅ 配置 API 服务器 CORS
- ✅ 创建完整部署文档

---

## 🤝 贡献

如果您在部署过程中遇到问题或有改进建议，请：

1. 查看 [故障排查指南](./TROUBLESHOOTING.md)
2. 提交 Issue 到 GitHub
3. 或直接提交 Pull Request

---

**部署愉快！🚀**
