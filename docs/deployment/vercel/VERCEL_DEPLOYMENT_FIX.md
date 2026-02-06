# Vercel 部署修复指南

**修复时间**: 2026-02-02
**问题**: 前端构建成功但无法渲染（黑屏，无控制台错误）
**根本原因**: tRPC 客户端无法连接到 EC2 后端 API

---

## ✅ 已完成的修复

### 1. 修复后端模块导入错误

**文件**: [server/auth-phantom.ts](server/auth-phantom.ts)
**问题**: 错误导入路径 `'./trpc.js'`
**修复**: 改为正确路径 `'./_core/trpc'`

### 2. 修复 tRPC 客户端 API URL 配置

**文件**: [client/src/main.tsx:44](client/src/main.tsx#L44)

**修复前**:
```typescript
const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",  // ❌ 硬编码相对路径
      // ...
    }),
  ],
});
```

**修复后**:
```typescript
const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: import.meta.env.VITE_API_URL
        ? `${import.meta.env.VITE_API_URL}/api/trpc`
        : "/api/trpc",  // ✅ 使用环境变量
      // ...
    }),
  ],
});
```

### 3. 添加环境变量配置

**文件**: [.env](.env) 和 [.env.production](.env.production)

**添加的变量**:
```bash
# 本地开发（.env）
VITE_API_URL=

# 生产环境（.env.production）
VITE_API_URL=http://44.220.181.78:3001
```

### 4. 优化 Vercel 配置

**文件**: [vercel.json](vercel.json)

**修复前**:
```json
{
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api/index.ts"  // ❌ 尝试使用不存在的 Vercel Functions
    }
  ]
}
```

**修复后**:
```json
{
  "routes": [
    {
      "src": "/assets/(.*)",
      "dest": "/assets/$1"
    },
    // ... 其他静态资源路由
    {
      "src": "/(.*)",
      "dest": "/index.html"  // ✅ SPA 路由
    }
  ],
  "headers": [
    // 安全头部配置
  ]
}
```

---

## 🚀 部署步骤

### 步骤 1：配置 Vercel 环境变量

1. 登录 [Vercel Dashboard](https://vercel.com/)
2. 进入项目设置：Settings → Environment Variables
3. 添加以下环境变量：

| Variable Name | Value | Environment |
|--------------|-------|-------------|
| `VITE_API_URL` | `http://44.220.181.78:3001` | Production |
| `NODE_ENV` | `production` | Production |

**重要提示**：
- ⚠️ 确保 `VITE_API_URL` 不包含尾部斜杠
- ⚠️ 确保 EC2 后端允许来自 Vercel 的跨域请求（CORS）

### 步骤 2：提交并推送代码

```bash
git add .
git commit -m "Fix Vercel deployment: Configure API URL with environment variables

- Fix tRPC client to use VITE_API_URL environment variable
- Update vercel.json to use routes instead of rewrites
- Add .env.production with production configuration
- Fix auth-phantom.ts import path
"

git push origin main
```

### 步骤 3：触发 Vercel 重新部署

Vercel 会自动检测 GitHub 推送并触发部署。

或者手动触发：
1. 进入 Vercel Dashboard
2. 点击 "Deployments"
3. 点击 "Redeploy"

### 步骤 4：配置 EC2 后端 CORS

**重要**：确保 EC2 后端允许来自 Vercel 域名的跨域请求。

**文件**: `server/_core/index.ts`

检查 CORS 配置：
```typescript
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://awareness-network-v2.vercel.app',  // ✅ 添加 Vercel 域名
  ],
  credentials: true,
}));
```

如果需要修改，登录 EC2 并重启服务：
```bash
ssh ec2-user@44.220.181.78
cd /path/to/Awareness-Network
pm2 restart awareness-network
```

---

## 🔍 验证部署

### 1. 检查前端是否可以访问

访问：https://awareness-network-v2.vercel.app/

### 2. 检查浏览器控制台

打开浏览器开发者工具（F12）：
- **Network 面板**: 查看是否有 API 请求到 `http://44.220.181.78:3001/api/trpc`
- **Console 面板**: 查看是否有错误信息

### 3. 测试 API 连接

在浏览器控制台运行：
```javascript
fetch('http://44.220.181.78:3001/api-docs/')
  .then(res => res.text())
  .then(console.log)
  .catch(console.error);
```

如果成功，应该返回 API 文档 HTML。

---

## ⚠️ 可能的问题

### 问题 1：CORS 错误

**症状**:
```
Access to fetch at 'http://44.220.181.78:3001/api/trpc' from origin 'https://awareness-network-v2.vercel.app' has been blocked by CORS policy
```

**解决**:
在 EC2 后端添加 Vercel 域名到 CORS 白名单（见步骤 4）。

### 问题 2：Mixed Content 错误

**症状**:
```
Mixed Content: The page at 'https://awareness-network-v2.vercel.app/' was loaded over HTTPS, but requested an insecure resource 'http://44.220.181.78:3001/api/trpc'
```

**解决**:
1. 在 EC2 上配置 SSL 证书（推荐）
2. 或者将 `VITE_API_URL` 改为 HTTPS 地址

### 问题 3：环境变量未生效

**症状**:
前端仍然尝试连接到 `/api/trpc` 而不是 `http://44.220.181.78:3001/api/trpc`

**解决**:
1. 确认 Vercel 环境变量已正确配置
2. 重新部署项目（Vercel Dashboard → Redeploy）
3. 清除浏览器缓存并刷新

---

## 📊 期望结果

修复后，您应该看到：

1. ✅ 前端成功渲染（不再是黑屏）
2. ✅ 用户可以看到登录页面或主页
3. ✅ API 请求成功连接到 EC2 后端
4. ✅ 无 CORS 错误
5. ✅ 无控制台错误

---

## 🔗 相关链接

- **前端 (Vercel)**: https://awareness-network-v2.vercel.app/
- **后端 API (EC2)**: http://44.220.181.78:3001/api-docs/
- **GitHub 仓库**: https://github.com/everest-an/Awareness-Market
- **Vercel 项目**: https://vercel.com/dashboard

---

## 📞 后续优化建议

### 短期（立即）

1. **配置 SSL 证书** - 在 EC2 上使用 Let's Encrypt 配置 HTTPS
2. **设置域名** - 将 `awareness.market` 指向 Vercel 前端
3. **配置 API 子域名** - 将 `api.awareness.market` 指向 EC2 后端

### 中期（1-2 周）

1. **添加错误边界** - 在 React 中添加更好的错误处理
2. **优化 Vite 配置** - 简化代码分割策略
3. **添加监控** - 使用 Sentry 或其他监控服务

### 长期（1-3 月）

1. **迁移到 Next.js** - 更好的 SEO 和服务端渲染
2. **使用 Vercel Functions** - 减少对 EC2 的依赖
3. **配置 CDN** - 优化全球访问速度

---

**修复完成时间**: 2026-02-02
**状态**: ✅ 代码已修复，等待部署验证
