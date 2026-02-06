# Awareness Market 故障排查指南

本文档提供 Awareness Market 项目的常见问题和故障排查步骤。

---

## 📋 目录

- [前端问题](#前端问题)
  - [前端黑屏](#前端黑屏)
  - [API 连接失败](#api-连接失败)
  - [CORS 错误](#cors-错误)
- [后端问题](#后端问题)
  - [服务无法启动](#服务无法启动)
  - [数据库连接失败](#数据库连接失败)
  - [502 Bad Gateway](#502-bad-gateway)
- [构建问题](#构建问题)
  - [内存不足](#内存不足)
  - [构建失败](#构建失败)
- [部署问题](#部署问题)
  - [Vercel 部署失败](#vercel-部署失败)
  - [SSL 证书问题](#ssl-证书问题)

---

## 🔍 前端问题

### 1. 前端黑屏

**症状**: 页面显示黑屏，`#root` 元素为空

**排查步骤**:

1. **检查浏览器控制台**
   - 按 F12 打开开发者工具，切换到 "Console" 标签
   - 查找错误信息，特别是 `TypeError: Cannot read properties of undefined (reading 'createContext')`

2. **检查模块加载顺序**
   - 如果出现 `createContext` 错误，说明 React 模块加载顺序有问题
   - **解决方案**: 在 `vite.config.ts` 中禁用代码分割
     ```typescript
     rollupOptions: {
       output: {
         manualChunks: undefined, // 禁用代码分割
       }
     }
     ```

3. **检查 HTML 文件**
   - 查看页面源代码，确认 `<div id="root"></div>` 是否存在
   - 确认 `<script type="module" ...>` 标签是否正确加载

4. **检查 JavaScript 文件**
   - 访问 JavaScript 文件 URL，确认文件内容完整
   - 搜索 `createRoot` 和 `render`，确认 React 渲染代码存在

### 2. API 连接失败

**症状**: 页面正常渲染，但数据无法加载

**排查步骤**:

1. **检查浏览器 Network 标签**
   - 查找 `/api/trpc/...` 请求，确认状态码
   - 如果是 404 Not Found，说明 API 路径错误
   - 如果是 5xx Server Error，说明后端有问题

2. **检查 API URL 配置**
   - **EC2 部署**: 应该使用相对路径 `/api/trpc`
   - **Vercel 部署**: 应该使用绝对路径 `https://api.protocolbanks.com`
   - 检查 `VITE_API_URL` 环境变量是否正确配置

3. **测试 API 可访问性**
   ```bash
   curl -I https://api.protocolbanks.com/api/trpc/auth.me
   ```
   - 确认返回 204 No Content 或 200 OK

### 3. CORS 错误

**症状**: 
```
Access to fetch at ... has been blocked by CORS policy
```

**排查步骤**:

1. **检查后端 CORS 配置**
   - 编辑 `server/_core/socket-events.ts`
   - 确认 `origin` 数组中包含前端域名
     ```typescript
     cors: {
       origin: [
         // ...
         'https://awareness-network-v2.vercel.app'
       ],
       credentials: true
     }
     ```

2. **重启后端服务**
   ```bash
   pm2 restart awareness-api
   ```

---

## ⚙️ 后端问题

### 1. 服务无法启动

**症状**: `pm2 status` 显示 `errored`

**排查步骤**:

1. **查看日志**
   ```bash
   pm2 logs awareness-api --lines 100
   ```
   - 查找错误信息，如 `Error: listen EADDRINUSE: address already in use :::3001`

2. **检查端口占用**
   ```bash
   sudo lsof -i :3001
   ```
   - 如果有其他进程占用，杀死它：`sudo kill -9 <PID>`

3. **检查环境变量**
   - 确认 `.env` 文件存在且 `DATABASE_URL` 等变量正确

### 2. 数据库连接失败

**症状**: 日志中出现 `PrismaClientInitializationError`

**排查步骤**:

1. **检查数据库 URL**
   - 确认 `.env` 文件中的 `DATABASE_URL` 正确
   - 格式: `postgresql://username:password@host:5432/database`

2. **检查数据库可访问性**
   - 从 EC2 服务器 `ping` 数据库主机
   - 检查 AWS RDS 安全组是否允许 EC2 IP 访问

3. **运行数据库迁移**
   ```bash
   pnpm prisma migrate deploy
   ```

### 3. 502 Bad Gateway

**症状**: 访问网站返回 502 Bad Gateway

**排查步骤**:

1. **检查后端服务状态**
   ```bash
   pm2 status
   ```
   - 确认 `awareness-api` 正在运行

2. **检查 Nginx 配置**
   - 确认 `proxy_pass` 指向正确的端口（`http://localhost:3001`）

3. **查看 Nginx 错误日志**
   ```bash
   sudo tail -f /var/log/nginx/error.log
   ```
   - 查找 `(111: Connection refused) while connecting to upstream`

---

## 🛠️ 构建问题

### 1. 内存不足

**症状**: `JavaScript heap out of memory`

**解决方案**: 增加 Node.js 内存限制

```bash
export NODE_OPTIONS="--max-old-space-size=4096"
pnpm run build
```

### 2. 构建失败

**症状**: 构建过程提前终止，没有生成 `dist` 目录

**排查步骤**:

1. **查看构建日志**
   - 在本地构建，直接看控制台输出
   - 在 EC2 上，查看 `/tmp/build.log`

2. **检查依赖**
   ```bash
   pnpm install
   ```

3. **检查代码错误**
   - 查找 TypeScript 或语法错误

---

## 🚀 部署问题

### 1. Vercel 部署失败

**症状**: Vercel Dashboard 显示部署失败

**排查步骤**:

1. **查看部署日志**
   - 在 Vercel Dashboard → Deployments → Logs
   - 查找错误信息，如构建失败、环境变量缺失等

2. **检查构建设置**
   - 确认 Framework Preset, Build Command, Output Directory 正确

3. **检查 GitHub 集成**
   - 确认 Vercel App 有权限访问 GitHub 仓库

### 2. SSL 证书问题

**症状**: 浏览器显示 "Your connection is not private"

**排查步骤**:

1. **检查证书状态**
   ```bash
   sudo certbot certificates
   ```
   - 确认证书有效且未过期

2. **手动续期**
   ```bash
   sudo certbot renew
   sudo systemctl reload nginx
   ```

3. **检查 Nginx 配置**
   - 确认 `ssl_certificate` 和 `ssl_certificate_key` 路径正确

---

**如果以上步骤无法解决问题，请提交 Issue 到 GitHub 并附上详细的错误信息和排查步骤。**
