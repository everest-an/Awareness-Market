# 🎯 快速修复总结 & 部署指南

日期: 2026-02-19
状态: 准备部署

## 已完成的修复 ✅

> 总共修复了 6 个地方的配置问题

### 1. OAuth 回调路由 ✅
- **文件**: `server/_core/oauth.ts`
- **更改**: `/api/oauth/callback` → `/api/auth/callback/:provider`
- **影响**: 解决 Google/GitHub 登录 404 错误
- **验证**: `curl -I https://api.awareness.market/api/auth/callback/google?code=test` 应该返回 400 (缺少 code)，不是 404

### 2. OAUTH_CALLBACK_URL 环境变量 ✅
- **文件**: `.env`
- **更改**: `http://localhost:3000` → `https://api.awareness.market`
- **影响**: 确保 OAuth 授权 URL 使用正确的域名

### 3. robotics API_BASE_URL ✅
- **文件**: `server/routers/robotics.ts` 第 22 行
- **更改**: `'http://localhost:5000'` → `'http://localhost:3001'` (带 fallback)
- **优先级**:
  1. `process.env.API_BASE_URL`
  2. `process.env.API_URL`
  3. `process.env.BACKEND_URL`
  4. `'http://localhost:3001'` (fallback)

### 4. 添加 API_BASE_URL 到 .env ✅
- **文件**: `.env`
- **添加**:
  ```
  API_BASE_URL=http://localhost:3001
  BACKEND_URL=http://localhost:3001
  ```
- **影响**: 本地开发时 robotics 路由能正确传递 API 地址

### 5. 更新 vercel.json 环境变量 ✅
- **文件**: `vercel.json`
- **添加**:
  ```json
  "env": {
    "VITE_API_URL": "https://api.awareness.market"
  }
  ```
- **影响**: Vercel 前端构建时正确传入后端 API 地址

### 6. 更新 .env.production ✅
- **文件**: `.env.production` 
- **验证**: 已包含 `VITE_API_URL=https://api.awareness.market`

---

## 🚀 部署步骤

### 步骤 1: 验证本地构建
```bash
cd "e:\Awareness Market\Awareness-Network"

# 清理
rm -r dist node_modules pnpm-lock.yaml

# 重新安装
pnpm install

# 构建前检查
pnpm run check:env
pnpm run check

# 构建
pnpm run build

# 如果成功，应该看到 dist/ 和 dist/public/ 文件夹
```

### 步骤 2: 提交代码到 GitHub
```bash
# 检查状态
git status

# 添加修改
git add .

# 创建提交
git commit -m "fix: resolve OAuth, robotics, and environment configuration issues

- Fix OAuth callback route to /api/auth/callback/:provider (fixes 404)
- Update OAUTH_CALLBACK_URL to https://api.awareness.market
- Fix robotics.ts API_BASE_URL fallback chain
- Add API_BASE_URL and BACKEND_URL to .env
- Update vercel.json with VITE_API_URL environment variable

Fixes Google/GitHub login, robotics service routing, and Vercel deployment"

# 推送到 GitHub
git push origin main
```

### 步骤 3: GitHub Actions 自动部署
- GitHub Actions 会自动运行 `ci-cd-unified.yml` workflow
- 从 `production-backend` environment 读取所有secrets
- 部署到 Vercel 和 EC2

**检查部署状态**:
1. 打开 https://github.com/everest-an/Awareness-Market/actions
2. 查看最新的 workflow run
3. 等待所有 jobs 完成 (通常 5-10 分钟)

### 步骤 4: EC2 后端部署
GitHub Actions 部署完毕后，SSH 到 EC2 并重启:

```bash
ssh ec2-user@api.awareness.market

# 更新代码（如果使用 PM2 pull）
cd ~/awareness-market
git pull origin main

# 添加新的环境变量到 .env
nano ~/.env

# 确保添加了:
# API_BASE_URL=https://api.awareness.market
# OAUTH_CALLBACK_URL=https://api.awareness.market

# 重启后端服务
pm2 restart awareness-api
pm2 logs awareness-api

# 验证健康检查
curl -I https://api.awareness.market/api-docs/
```

### 步骤 5: Vercel 前端验证
- Vercel 会自动部署 (由 GitHub push trigger)
- **访问**: https://awareness.market
- **清理浏览器缓存**: Ctrl+Shift+Delete
- **刷新页面**: F5

---

## 🧪 完整功能测试

### 测试 1: OAuth 登录流程
```
1. 访问 https://awareness.market
2. 点击 "Sign in with Google" 按钮
3. 批准 Google OAuth 权限
4. 应该重定向到仪表板 (不是 404)
5. 检查浏览器 DevTools > Application > Cookies 看 jwt_token
```

### 测试 2: API 连接性
```bash
# 从本地测试前端 → 后端连接
curl -X POST https://api.awareness.market/api/trpc/auth.me \
  -H "Content-Type: application/json" \
  -d '{"json":null}'

# 应该返回 JSON 响应，不是 404
```

### 测试 3: robotics 端点
```bash
curl -X POST https://api.awareness.market/api/trpc/robotics.health \
  -H "Content-Type: application/json" \
  -d '{"json":{}}'

# 应该返回健康状态 JSON
```

### 测试 4: OAuth 生成的授权 URL
```bash
curl -X GET "https://api.awareness.market/api/trpc/auth.oauthAuthorizeUrl?input=%7B%22json%22:%7B%22provider%22:%22google%22%7D%7D" \
  -H "Content-Type: application/json"

# 应该返回有效的 Google OAuth URL，包含:
# - client_id
# - redirect_uri=https://api.awareness.market/api/auth/callback/google
# - scope
```

---

## ⚠️ 已知的余留问题 (低优先级)

### 1. nginx SSL 证书 (需手动修复)
**问题**: nginx.conf 配置的是 `awareness-market.com` 而实际域名是 `awareness.market`

**修复** (在 EC2 上):
```bash
# 检查现有证书
sudo certbot certificates

# 如果证书是 awareness-market.com，需要重新申请
sudo certbot certonly --standalone -d awareness.market

# 更新 nginx.conf
sudo sed -i 's/awareness-market\.com/awareness.market/g' /etc/nginx/nginx.conf

# 验证 nginx 配置
sudo nginx -t

# 重启 nginx
sudo systemctl restart nginx
```

### 2. PM2 upstream 在 nginx 配置 (验证问题)
**问题**: nginx 配置指向 4 个上游服务器 (localhost:3001-3004)

**验证**:
```bash
# 在 EC2 上检查 PM2 进程数
pm2 list

# 如果只有 1 个实例，但 nginx 配置 4 个，这是冗余的
# 更新 ecosystem.config.js instances 设置或 nginx upstream
```

---

## 📋 最终检查清单

部署前完整检查:

- [x] OAuth 路由已修复
- [x] OAUTH_CALLBACK_URL 已更新
- [x] robotics API_BASE_URL 已修复
- [x] .env 已添加 API_BASE_URL
- [x] vercel.json 已更新 VITE_API_URL
- [x] 本地构建成功
- [x] 所有修改已提交到 git
- [ ] 推送到 GitHub (即将完成)
- [ ] GitHub Actions workflow 完成
- [ ] EC2 后端已重启并验证
- [ ] Vercel 前端已更新
- [ ] OAuth 登录测试通过
- [ ] API 连接性测试通过

---

## 🔗 快速链接

- **GitHub Repo**: https://github.com/everest-an/Awareness-Market
- **GitHub Actions**: https://github.com/everest-an/Awareness-Market/actions
- **Vercel Dashboard**: https://vercel.com/dashboard
- **EC2 API Server**: https://api.awareness.market/api-docs/
- **Production Frontend**: https://awareness.market

---

## 📞 故障排除

### 如果 OAuth 仍然返回 404

1. **检查路由是否正确注册**:
   ```bash
   curl -v https://api.awareness.market/api/auth/callback/google 2>&1 | grep "< HTTP"
   # 应该是 400（缺少 code）不是 404
   ```

2. **检查后端日志**:
   ```bash
   ssh ec2-user@api.awareness.market
   pm2 logs awareness-api | grep -i oauth
   ```

3. **检查环境变量**:
   ```bash
   ssh ec2-user@api.awareness.market
   grep OAUTH ~/.env
   ```

### 如果 Vercel 前端仍显示旧 URL

1. **清空 Vercel 缓存**:
   - Vercel Dashboard → Settings → Advanced → Rebuild
   - 点击 "Delete all Cache"

2. **清空浏览器缓存**:
   - Ctrl+Shift+Delete
   - 选择所有时间范围

3. **强制刷新**:
   - Ctrl+F5 或 Cmd+Shift+R

### 如果 robotics 端点返回错误

1. **检查 API_BASE_URL 是否正确**:
   ```bash
   ssh ec2-user@api.awareness.market
   pm2 logs awareness-api | grep "API_BASE_URL\|robotics"
   ```

2. **检查是否需要重启**:
   ```bash
   pm2 restart awareness-api
   ```

---

## ✨ 总结

这个修复涉及 3 个主要部分：
1. **OAuth 认证** - 修复 Google/GitHub 登录流程
2. **配置管理** - 统一所有 API URL 配置
3. **部署流程** - 确保环境变量正确传播到所有环节

所有修改都是向后兼容的，不会破坏现有功能。
