# Awareness Network 2.0 - 部署问题备注

## 项目信息

- **项目名称**: Awareness Network 2.0
- **GitHub仓库**: https://github.com/everest-an/Awareness-Network
- **Railway项目**: enthusiastic-delight (Project ID: 09a7ca04-b08f-4e94-b3dc-7c1974e2980d)
- **部署日期**: 2025年11月4日

## 已完成的工作

### 1. GitHub代码修复 ✅

**问题**: Dockerfile.backend引用了不存在的`pnpm-workspace.yaml`文件
```dockerfile
# 错误的第10行
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
```

**解决方案**: 已修复并推送到GitHub main分支
```dockerfile
# 修复后的第10行
COPY package.json pnpm-lock.yaml ./
```

**提交记录**:
- Commit: cd931c3 - "fix: Remove pnpm-workspace.yaml from Dockerfile.backend"
- 推送时间: 2025-11-04 15:18 UTC
- 推送状态: ✅ 成功

### 2. Railway账号设置 ✅

- ✅ Railway账号已创建并登录
- ✅ GitHub App已授权并连接
- ✅ everest-an/Awareness-Network仓库已授权给Railway App
- ✅ 30天免费试用期已激活($5额度)

## 当前遇到的问题

### 问题1: Railway创建GitHub Repo服务时循环重定向

**症状**:
1. 在Railway中点击"Create" → "GitHub Repo" → "everest-an/Awareness-Network"
2. 自动重定向到GitHub设置页面: https://github.com/settings/installations/93078398
3. GitHub页面显示Railway App已安装,仓库已选中
4. 点击"Save"按钮无响应
5. 返回Railway后无法创建服务,重复上述循环

**尝试过的解决方案**:
- ❌ 重新授权GitHub App
- ❌ 删除并重新创建Empty Service
- ❌ 直接在Empty Service中连接GitHub仓库
- ❌ 配置GitHub App权限

**可能的原因**:
1. Railway和GitHub App集成存在bug
2. 浏览器cookie或session问题
3. Railway项目配置问题
4. GitHub App权限配置不完整

### 问题2: GitHub Personal Access Token认证失败

**尝试的Token**:
- Token #1 - ❌ 返回401 Bad credentials
- Token #2 - ✅ 成功推送代码

**注意**: 第二个token已成功用于推送代码到GitHub,但在使用GitHub API时可能需要额外的权限。Token已从文档中移除以保护安全。

## 建议的解决方案

### 方案1: 使用Railway CLI部署 (推荐)

```bash
# 安装Railway CLI
npm install -g @railway/cli

# 登录Railway
railway login

# 链接到现有项目
railway link 09a7ca04-b08f-4e94-b3dc-7c1974e2980d

# 部署
railway up
```

### 方案2: 使用Docker Image方式部署

1. 在本地构建Docker镜像
2. 推送到Docker Hub或GitHub Container Registry
3. 在Railway中选择"Docker Image"方式创建服务
4. 指定镜像地址

### 方案3: 使用其他部署平台

**Render.com**:
- 优点: 免费tier,GitHub集成稳定
- 缺点: 冷启动时间较长

**Fly.io**:
- 优点: 性能好,全球部署
- 缺点: 配置相对复杂

**Vercel** (仅前端):
- 优点: 最适合Next.js/React应用
- 缺点: 后端API需要Serverless Functions

### 方案4: 联系Railway技术支持

Railway Discord: https://discord.gg/railway
Railway Support: https://help.railway.app/

**问题描述模板**:
```
Title: Unable to create service from GitHub repository - redirect loop

Description:
When trying to create a new service from GitHub repository (everest-an/Awareness-Network), 
I'm experiencing a redirect loop to GitHub settings page. The Railway App is already 
installed and authorized, but clicking on the repository in Railway keeps redirecting 
to GitHub instead of creating the service.

Project ID: 09a7ca04-b08f-4e94-b3dc-7c1974e2980d
Repository: https://github.com/everest-an/Awareness-Network
```

## 项目结构

```
Awareness-Network/
├── backend/              # Express.js后端API
│   ├── server.js
│   ├── package.json
│   └── ...
├── ai-service/          # AI服务(Python)
│   ├── app.py
│   ├── requirements.txt
│   └── ...
├── frontend/            # React前端
│   ├── src/
│   ├── package.json
│   └── ...
├── Dockerfile.backend   # 后端Dockerfile (已修复)
├── Dockerfile.ai        # AI服务Dockerfile
├── railway.json         # Railway配置文件
└── vercel.json         # Vercel配置文件
```

## 部署配置

### 后端API (Node.js + Express)

**Dockerfile.backend** (已修复):
```dockerfile
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

FROM base AS runner
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app .
EXPOSE 3001
CMD ["node", "backend/server.js"]
```

**环境变量需求**:
- `PORT`: 3001
- `DATABASE_URL`: MongoDB连接字符串
- `JWT_SECRET`: JWT密钥
- `OPENAI_API_KEY`: OpenAI API密钥

### AI服务 (Python + Flask)

**Dockerfile.ai**:
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY ai-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY ai-service/ .
EXPOSE 5000
CMD ["python", "app.py"]
```

**环境变量需求**:
- `PORT`: 5000
- `OPENAI_API_KEY`: OpenAI API密钥

### 前端 (React + Vite)

**部署平台**: Vercel
**构建命令**: `cd frontend && npm install && npm run build`
**输出目录**: `frontend/dist`

**环境变量需求**:
- `VITE_API_URL`: 后端API地址
- `VITE_AI_SERVICE_URL`: AI服务地址

## 下一步行动

1. **立即可行**: 使用Railway CLI部署(方案1)
2. **备选方案**: 切换到Render或Fly.io(方案3)
3. **长期方案**: 联系Railway技术支持解决GitHub集成问题(方案4)

## 联系信息

- **GitHub**: everest-an
- **Email**: everest9812@gmail.com
- **Railway Project**: https://railway.com/project/09a7ca04-b08f-4e94-b3dc-7c1974e2980d

## 时间线

- **15:00 UTC**: 开始部署流程
- **15:10 UTC**: 发现Dockerfile.backend错误
- **15:18 UTC**: 修复并推送到GitHub
- **15:20 UTC**: 遇到Railway GitHub集成循环重定向问题
- **15:25 UTC**: 创建此问题备注文档

---

**最后更新**: 2025-11-04 15:25 UTC
**状态**: 🔴 部署受阻,等待解决方案
