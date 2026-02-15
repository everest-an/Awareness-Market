# WebMCP 部署指南

**版本**: v1.0
**日期**: 2026-02-13
**状态**: 准备部署

---

## 📋 部署前检查清单

### ✅ 已完成的工作

- [x] **WebMCP 客户端库** - 完整实现 (~2,050 行)
- [x] **后端认证端点** - OAuth + Token 验证 (+200 行)
- [x] **主应用集成** - main.tsx 中初始化 WebMCP
- [x] **MCP Token 管理组件** - React UI 组件
- [x] **tRPC Router** - MCP token CRUD 操作
- [x] **样式文件** - Widget 和组件样式
- [x] **Demo 页面** - 交互式测试页面
- [x] **完整文档** - 架构、用户指南、总结

---

## 🚀 部署步骤

### 步骤 1: 安装依赖

```bash
cd "e:\Awareness Market\Awareness-Network"

# 安装所有依赖（如果还没有）
pnpm install
```

**注意**: WebMCP 使用的都是现有依赖，无需额外安装。

### 步骤 2: 数据库检查

确认数据库 schema 已包含 `mcp_tokens` 表：

```bash
# 检查 Prisma schema
cat prisma/schema.prisma | grep "model McpToken" -A 20
```

如果表已存在，跳到步骤 3。否则运行迁移：

```bash
npx prisma migrate dev --name add-mcp-tokens
```

### 步骤 3: 环境变量配置

在 `.env` 文件中确认以下配置：

```bash
# API Base URL (前端)
VITE_API_URL=http://localhost:5000

# WebMCP 配置（可选）
WEBMCP_ENABLED=true
WEBMCP_OAUTH_CLIENT_ID=awareness-market-webmcp
WEBMCP_DEVICE_CODE_EXPIRY=600  # 10 minutes
```

### 步骤 4: 启动开发服务器

```bash
# 终端 1: 启动后端
pnpm run dev

# 终端 2: 启动前端（新终端）
cd client
pnpm run dev
```

等待服务器启动完成。

### 步骤 5: 验证部署

访问以下 URL 验证部署：

1. **主应用**: http://localhost:5173
   - 应该在右下角看到蓝色的 WebMCP Widget 按钮

2. **Demo 页面**: http://localhost:5173/webmcp-demo.html
   - 点击 "Test Connection" 按钮
   - 应该显示 "✅ API is healthy"

3. **API 健康检查**: http://localhost:5000/api/mcp/health
   - 应该返回 JSON: `{"protocol":"MCP/1.0","status":"healthy",...}`

---

## 🧪 功能测试

### 测试 1: 创建 MCP Token（通过 API）

```bash
# 首先需要获取 API Key（假设你已经有一个）
export API_KEY="your_api_key_here"

# 创建 MCP Token
curl -X POST http://localhost:5000/api/mcp/tokens \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test WebMCP Token",
    "permissions": ["read", "write_with_confirmation"],
    "expiresInDays": 30
  }'
```

**期望输出**:
```json
{
  "success": true,
  "token": "mcp_abc123def456...",
  "tokenPrefix": "mcp_abc",
  "expiresAt": "2026-03-15T10:30:00Z",
  "message": "MCP token created successfully..."
}
```

**重要**: 立即复制 `token` 值，它只显示一次！

### 测试 2: 验证 Token

```bash
export MCP_TOKEN="mcp_abc123def456..."  # 使用上面创建的 token

curl -X POST http://localhost:5000/api/mcp/auth/verify \
  -H "X-MCP-Token: $MCP_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"token\": \"$MCP_TOKEN\"}"
```

**期望输出**:
```json
{
  "success": true,
  "sessionId": "sess_1234567890_abcdef",
  "userId": 1,
  "capabilities": ["read", "write_with_confirmation"],
  "expiresAt": "2026-02-14T10:30:00Z",
  "tokenPrefix": "mcp_abc"
}
```

### 测试 3: 使用 WebMCP Widget

1. 打开 http://localhost:5173
2. 点击右下角蓝色 WebMCP 按钮
3. 在输入框中粘贴 MCP Token: `mcp_abc123def456...`
4. 点击 "Connect" 按钮
5. 应该显示: "✅ Connected as User 1"

### 测试 4: 测试工具调用

打开浏览器控制台 (F12)，运行：

```javascript
// 获取 WebMCP 客户端实例
const webmcp = window.awarenessWebMCP;

// 测试连接
const session = webmcp.getSession();
console.log('Session:', session);

// 调用 search_vectors 工具
const vectors = await webmcp.callTool('search_vectors', {
  query: 'vision transformers',
  minRating: 4.0,
  limit: 5
});
console.log('Search results:', vectors);
```

**期望输出**:
```
Session: {sessionId: "sess_...", userId: 1, capabilities: [...], ...}
Search results: {total: 5, vectors: [...]}
```

### 测试 5: MCP Token 管理页面

1. 访问 http://localhost:5173/mcp-tokens（需要先配置路由）
2. 应该看到 MCP Token Manager 界面
3. 点击 "+ Create New Token"
4. 填写表单并创建新 token
5. 应该看到新创建的 token 显示在列表中

---

## 🔧 故障排除

### 问题 1: Widget 没有显示

**症状**: 页面右下角没有蓝色按钮

**解决方案**:
1. 检查浏览器控制台是否有错误
2. 确认 WebMCP 样式已导入:
   ```bash
   grep "webmcp-styles.css" client/src/main.tsx
   ```
3. 检查 WebMCP 初始化:
   ```bash
   grep "initializeWebMCP" client/src/main.tsx
   ```

### 问题 2: Token 创建失败

**症状**: API 返回 500 错误

**解决方案**:
1. 检查数据库连接:
   ```bash
   pnpm run memory:check
   ```
2. 确认 `mcp_tokens` 表存在:
   ```sql
   \d mcp_tokens  -- PostgreSQL
   ```
3. 检查后端日志中的错误信息

### 问题 3: Token 验证失败

**症状**: `/api/mcp/auth/verify` 返回 403

**解决方案**:
1. 确认 token 格式正确（以 `mcp_` 开头）
2. 检查 token 是否过期:
   ```sql
   SELECT * FROM mcp_tokens WHERE token_prefix = 'mcp_abc';
   ```
3. 确认 token 的 `isActive` 字段为 `true`

### 问题 4: tRPC 端点不可用

**症状**: 前端调用 `trpc.mcp.listTokens` 报错

**解决方案**:
1. 确认 MCP router 已导入:
   ```bash
   grep "mcpRouter" server/routers.ts
   ```
2. 确认 MCP router 已添加到 appRouter:
   ```bash
   grep "mcp: mcpRouter" server/routers.ts
   ```
3. 重启后端服务器

### 问题 5: OAuth 设备流程失败

**症状**: `/api/mcp/auth/device` 返回错误

**解决方案**:
1. 检查环境变量:
   ```bash
   echo $WEBMCP_OAUTH_CLIENT_ID
   ```
2. 确认设备代码存储正常（检查后端日志）
3. 使用生产环境时，将内存 Map 替换为 Redis

---

## 📊 性能测试

### 测试工具响应时间

```bash
# 测试 search_vectors 性能
time curl -X POST http://localhost:5000/api/mcp/discover \
  -H "Authorization: Bearer $MCP_TOKEN"
```

**目标**: < 200ms

### 测试并发连接

```bash
# 使用 ab (Apache Bench) 测试
ab -n 100 -c 10 \
  -H "Authorization: Bearer $MCP_TOKEN" \
  http://localhost:5000/api/mcp/health
```

**目标**:
- 成功率 100%
- 平均响应时间 < 100ms

---

## 🔒 安全检查

### 检查清单

- [ ] **Token 存储**: Token 哈希存储在数据库中（不是明文）
- [ ] **过期管理**: 过期 token 无法使用
- [ ] **权限验证**: 每个操作都验证权限
- [ ] **Rate Limiting**: 已配置速率限制（可选）
- [ ] **HTTPS**: 生产环境使用 HTTPS
- [ ] **CORS**: 配置正确的 CORS 白名单
- [ ] **Audit Logging**: 所有 token 使用都记录日志

### 安全测试

```bash
# 1. 测试过期 token
# 创建一个 expiresInDays=0 的 token，应该立即过期
curl -X POST http://localhost:5000/api/mcp/tokens \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "Expired Test", "expiresInDays": 0}'

# 尝试使用，应该返回 403
curl -X POST http://localhost:5000/api/mcp/auth/verify \
  -H "X-MCP-Token: $EXPIRED_TOKEN"

# 2. 测试撤销的 token
# 创建 token 后撤销，然后尝试使用
curl -X DELETE http://localhost:5000/api/mcp/tokens/123 \
  -H "X-API-Key: $API_KEY"

curl -X POST http://localhost:5000/api/mcp/auth/verify \
  -H "X-MCP-Token: $REVOKED_TOKEN"
# 应该返回 403
```

---

## 📝 生产部署

### 额外步骤

1. **使用 Redis 存储设备代码**

   编辑 `server/mcp-api.ts`:
   ```typescript
   // 替换内存 Map
   import { createClient } from 'redis';
   const redis = createClient({ url: process.env.REDIS_URL });
   await redis.connect();

   // 存储设备代码
   await redis.setEx(`device:${device_code}`, 600, JSON.stringify(data));
   ```

2. **配置 Rate Limiting**

   ```typescript
   import rateLimit from 'express-rate-limit';

   const mcpRateLimit = rateLimit({
     windowMs: 60 * 1000, // 1 minute
     max: 100, // 100 requests per minute
     standardHeaders: true,
   });

   app.use('/api/mcp', mcpRateLimit);
   ```

3. **配置 HTTPS**

   ```bash
   # 使用 Let's Encrypt
   certbot --nginx -d awareness-market.com
   ```

4. **配置监控**

   添加日志和监控：
   ```typescript
   // server/mcp-api.ts
   import { createLogger } from './utils/logger';
   const logger = createLogger('MCP:Auth');

   logger.info('Token verified', { userId, tokenPrefix });
   ```

---

## 🎉 部署完成检查

所有以下项均✅后，WebMCP 部署完成：

- [ ] 前端服务器正常运行（http://localhost:5173）
- [ ] 后端服务器正常运行（http://localhost:5000）
- [ ] WebMCP Widget 显示在页面右下角
- [ ] 可以创建 MCP Token（通过 API 或 UI）
- [ ] Token 验证成功
- [ ] Widget 连接成功
- [ ] 工具调用测试通过
- [ ] Demo 页面正常工作
- [ ] 安全测试通过
- [ ] 性能测试达标

---

## 📚 下一步

### 可选集成

1. **添加路由** - 在 React Router 中添加 `/mcp-tokens` 路由
2. **添加导航** - 在导航菜单中添加 "MCP Tokens" 链接
3. **添加通知** - Token 创建/撤销后显示通知
4. **添加分析** - 追踪 token 使用情况

### 高级功能

1. **Token 使用统计** - 显示每个 token 的调用次数
2. **IP 白名单** - 限制 token 只能从特定 IP 使用
3. **Webhook 通知** - Token 使用时发送 webhook
4. **Token 轮换** - 自动轮换即将过期的 token

---

## 🆘 获取帮助

- **文档**: 查看 [WEBMCP_USER_GUIDE.md](WEBMCP_USER_GUIDE.md)
- **架构**: 查看 [WEBMCP_INTEGRATION.md](WEBMCP_INTEGRATION.md)
- **Demo**: 访问 http://localhost:5173/webmcp-demo.html
- **Issues**: https://github.com/your-org/awareness-market/issues

---

**祝部署顺利！** 🚀

如有问题，请参考故障排除部分或查看完整文档。
