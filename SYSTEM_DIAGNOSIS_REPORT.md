# 🔍 系统诊断报告：其他潜在问题

生成时间: 2026-02-19

## 已发现的问题清单

### ✅ FIXED - OAuth 回调路由 (已修复)
- **问题**: `/api/auth/callback/google` 返回 404
- **原因**: Express 路由定义为 `/api/oauth/callback` 而不是 provider-specific
- **修复**: 已更新 `server/_core/oauth.ts`
- **状态**: ✅ DEPLOYED

### ✅ FIXED - OAUTH_CALLBACK_URL (已修复)
- **问题**: `.env` 中指向 `http://localhost:3000`
- **原因**: 本地开发环境配置没有更新
- **修复**: 已更新为 `https://api.awareness.market`
- **验证**: EC2 backup 中已包含正确值
- **状态**: ✅ DEPLOYED

---

## 🚨 新发现的问题

### 1. ⚠️ nginx.conf 域名不匹配
**严重程度**: 中等
**文件**: `nginx.conf` 第 126, 142 行
**问题内容**:
```nginx
server_name awareness-market.com www.awareness-market.com;
ssl_certificate /etc/letsencrypt/live/awareness-market.com/fullchain.pem;
```

**实际情况**:
- 当前生产域名: `awareness.market`
- nginx 配置: `awareness-market.com`
- SSL 证书也指向旧域名

**影响**:
- SSL 证书不匹配 → HTTPS 错误
- 浏览器会显示证书警告
- 可能导致 CORS 错误

**修复建议**: 
```bash
# 检查 nginx 配置
sudo nginx -t

# 申请新证书
sudo certbot certonly --standalone -d awareness.market -d www.awareness.market

# 更新 nginx.conf 指向正确证书
ssl_certificate /etc/letsencrypt/live/awareness.market/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/awareness.market/privkey.pem;

# 重启 nginx
sudo systemctl restart nginx
```

**状态**: ❌ 需要手动修复 (EC2 nginx 配置)

---

### 2. ⚠️ robotics.ts 中 API_BASE_URL 未定义
**严重程度**: 中等
**文件**: `server/routers/robotics.ts` 第 22 行
**问题代码**:
```typescript
const API_BASE_URL = process.env.API_URL || 'http://localhost:5000';
```

**问题**:
- `process.env.API_URL` 在任何 `.env` 文件中都找不到
- 生产环境会默认使用 `http://localhost:5000`（错误的地址）
- 这会导致所有 robotics 相关的 API 调用失败

**应该是**:
- `API_URL` 应该是后端自己的服务地址，比如 `https://api.awareness.market` 或 `http://localhost:3001`
- 或者应该使用 `process.env.BACKEND_API_URL`

**修复建议**:
```typescript
// 选项 1: 使用后端 API 地址
const API_BASE_URL = process.env.API_BASE_URL || process.env.API_URL || 'http://localhost:3001';

// 选项 2: 使用当前服务器的地址
import { SERVER_URL } from '../_core/env';
const API_BASE_URL = SERVER_URL;  // 自动使用 BACKEND_URL 或构造
```

**状态**: ❌ 需要修复

---

### 3. ⚠️ vercel.json 缺少 OAUTH 环境变量
**严重程度**: 低
**文件**: `vercel.json` 第 1-30 行
**问题**:
- Vercel 部署配置中没有指定如何传递 OAUTH 相关环境变量到生产环境
- 虽然这些变量被保存在 GitHub Actions `production-backend` environment, 但 Vercel frontend 构建时可能没有获取到

**期望**:
```json
{
  "buildCommand": "pnpm run build:vercel",
  "outputDirectory": "dist/public",
  "installCommand": "pnpm install",
  "env": {
    "VITE_API_URL": "https://api.awareness.market"
  }
}
```

**实际**: vercel.json 中没有 `env` 部分

**状态**: ❌ 需要修复 Vercel 配置

---

### 4. ✅ VITE_API_URL 配置正确
**文件**: 
- `.env.production`: `VITE_API_URL=https://api.awareness.market` ✓
- `client/src/main.tsx: 第 44 行: `const API_URL = import.meta.env.VITE_API_URL || '';` ✓

**状态**: ✅ 正确

---

### 5. ⚠️ nginx 反向代理上游服务器列表
**严重程度**: 低
**文件**: `nginx.conf` 第 115-118 行
**问题内容**:
```nginx
upstream awareness_backend {
    server localhost:3001;
    server localhost:3002;
    server localhost:3003;
    server localhost:3004;
}
```

**问题**:
- 这个配置假设有 4 个后端实例运行在本地 3001-3004 端口
- 如果实际只有 1 个实例（比如 PM2 单例），这些额外的 server 条目会被忽略（不是错误，但冗余）
- 应该验证 PM2 配置是否真的启动了 4 个实例

**检查**:
```bash
# SSH 到 EC2
ssh ec2-user@api.awareness.market

# 检查 PM2 进程
pm2 list

# 应该看到 4 个实例还是 1 个?
pm2 logs awareness-api
```

**状态**: 🟡 需要验证 (可能不是问题，取决于 PM2 配置)

---

## 修复优先级

### 🔴 立即修复（阻塞 OAuth 功能）
1. ✅ **OAuth 路由和 CALLBACK_URL** - 已完成

### 🟠 高优先级（可能导致功能失败）
2. **robotics.ts API_BASE_URL** - server/routers/robotics.ts 第 22 行
3. **nginx SSL 证书** - EC2 上 nginx.conf 域名不匹配

### 🟡 中优先级（配置优化）
4. **vercel.json env 配置** - 确保 VITE_API_URL 传递正确
5. **nginx upstream 验证** - 确认 PM2 集群配置

---

## 快速修复脚本

### 修复 1: robotics.ts API_BASE_URL

```bash
cd /path/to/Awareness-Network

# 更新 robotics.ts
sed -i "s/const API_BASE_URL = process.env.API_URL || 'http:\/\/localhost:5000';/const API_BASE_URL = process.env.API_BASE_URL || process.env.API_URL || process.env.BACKEND_URL || 'http:\/\/localhost:3001';/" server/routers/robotics.ts

# 验证
grep "API_BASE_URL =" server/routers/robotics.ts
```

### 修复 2: 添加 API_BASE_URL 到 .env 和 EC2

```bash
# 在 .env 中添加
echo "API_BASE_URL=https://api.awareness.market" >> .env

# SSH 到 EC2 添加到生产环境
ssh ec2-user@api.awareness.market
nano ~/.env
# 添加: API_BASE_URL=https://api.awareness.market
source ~/.env
pm2 restart awareness-api
```

### 修复 3: 更新 vercel.json

编辑 `vercel.json`:
```json
{
  "buildCommand": "pnpm run build:vercel",
  "outputDirectory": "dist/public",
  "installCommand": "pnpm install",
  "framework": null,
  "env": {
    "VITE_API_URL": "https://api.awareness.market"
  },
  "envDescription": {
    "VITE_API_URL": "Backend API URL for frontend tRPC client"
  },
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "headers": [...]
}
```

---

## 全面检查清单

- [ ] OAuth 回调路由: `/api/auth/callback/:provider` ✅ 完成
- [ ] OAUTH_CALLBACK_URL 环境变量: `https://api.awareness.market` ✅ 完成
- [ ] robotics 路由 API_BASE_URL: 确保使用正确的后端地址
- [ ] nginx SSL 证书: 更新到 `awareness.market` 域名
- [ ] vercel.json: 添加 VITE_API_URL 环境变量
- [ ] EC2 .env: 确认所有必要的环境变量已设置
- [ ] PM2 日志: 验证 robotics 和其他服务正常运行
- [ ] curl 测试: `curl -I https://api.awareness.market/api-docs/`
- [ ] OAuth 完整测试流程: Google/GitHub 登录 → 重定向到仪表板

---

## 部署检查表

部署前运行:
```bash
# 1. 验证构建
pnpm run build

# 2. 验证环境变量
npm run check:env

# 3. 验证类型
npm run check

# 4. 运行测试
pnpm test

# 5. 部署到 GitHub
git add -A
git commit -m "fix: update API URLs and robotics configuration"
git push origin main
```

---

## 长期优化建议

1. **将 API URL 集中管理**
   - 在 `server/_core/env.ts` 中定义单一的 API_BASE_URL
   - 所有模块导入使用 `import { API_BASE_URL } from '../_core/env'`

2. **自动化环境变量验证**
   - 添加启动前检查脚本
   - 在构建时验证所有必要的 env vars

3. **分离本地/生产配置**
   - `.env` 用于本地开发
   - `.env.production` 用于生产
   - 使用配置验证确保一致性

4. **使用 ConfigMap/Secrets 管理**
   - 如果使用 Docker/Kubernetes，使用配置管理
   - 避免硬编码域名
