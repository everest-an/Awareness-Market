# ⚙️ Awareness Market 配置指南

**日期**: 2026-02-13
**用途**: 快速配置开发环境

---

## 📋 配置清单

### ✅ 已完成（自动配置）

- [x] **WebMCP 集成** - 已在 `main.tsx` 中初始化
- [x] **ERC-8004 合约** - 已部署 (0x1Ae90F59731e16b548E34f81F0054e96DdACFc28)
- [x] **MCP Router** - 已添加到 tRPC

### ⏳ 需要手动配置

- [ ] **JWT Secret** - 用于 Token 签名
- [ ] **数据库连接** - PostgreSQL URL
- [ ] **RPC 端点** - Avalanche/Fuji (ERC-8004 需要)

---

## 🚀 快速配置（5 分钟）

### 步骤 1: 生成 JWT Secret

```bash
cd "e:\Awareness Market\Awareness-Network"

# 生成强随机密钥
openssl rand -base64 64
```

复制输出的字符串，稍后会用到。

### 步骤 2: 更新 .env 文件

打开 `.env` 文件，确保以下配置正确：

```bash
# ============================================
# JWT Authentication (必需)
# ============================================
JWT_SECRET=<粘贴步骤1生成的密钥>

# ============================================
# Database (必需 - 如果使用数据库功能)
# ============================================
DATABASE_URL=postgresql://postgres:password@localhost:5432/awareness_market_dev

# ============================================
# ERC-8004 配置 (可选 - 如果需要区块链登录)
# ============================================
ERC8004_REGISTRY_ADDRESS=0x1Ae90F59731e16b548E34f81F0054e96DdACFc28

# 选择一个 RPC 端点：
# 选项 1: 公共 RPC (免费，可能限速)
AVALANCHE_RPC_URL=https://api.avax.network/ext/bc/C/rpc

# 选项 2: Alchemy (推荐，需要注册)
# AVALANCHE_RPC_URL=https://api.avax.network/ext/bc/C/rpc

# 选项 3: Infura
# AVALANCHE_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc

# ============================================
# WebMCP 配置 (可选 - 使用默认值即可)
# ============================================
# WEBMCP_ENABLED=true
# WEBMCP_OAUTH_CLIENT_ID=awareness-market-webmcp
# WEBMCP_DEVICE_CODE_EXPIRY=600
```

### 步骤 3: 验证配置

```bash
# 检查配置是否正确
cat .env | grep -E "JWT_SECRET|DATABASE_URL|ERC8004|AVALANCHE_RPC"
```

应该看到类似输出：
```
JWT_SECRET=YourGeneratedSecretHere...
DATABASE_URL=postgresql://postgres:password@localhost:5432/awareness_market_dev
ERC8004_REGISTRY_ADDRESS=0x1Ae90F59731e16b548E34f81F0054e96DdACFc28
AVALANCHE_RPC_URL=https://api.avax.network/ext/bc/C/rpc
```

### 步骤 4: 启动服务器

```bash
# 安装依赖（如果还没有）
pnpm install

# 启动开发服务器
pnpm run dev
```

等待服务器启动完成（通常 30-60 秒）。

### 步骤 5: 验证 WebMCP

1. **访问主页**
   ```
   http://localhost:5173
   ```

2. **检查 WebMCP Widget**
   - 右下角应该有蓝色的 WebMCP 按钮 ✓
   - 打开浏览器控制台 (F12)
   - 应该看到：`✅ WebMCP initialized successfully`

3. **访问 Demo 页面**
   ```
   http://localhost:5173/webmcp-demo.html
   ```

4. **测试连接**
   - 点击 "Test Connection" 按钮
   - 应该显示：`✅ API is healthy`

### 步骤 6: 验证 ERC-8004（可选）

```bash
curl http://localhost:5000/api/erc8004/status
```

**期望输出**:
```json
{
  "enabled": true,
  "registryAddress": "0x1Ae90F59731e16b548E34f81F0054e96DdACFc28",
  "networkId": "137",
  "networkName": "Avalanche"
}
```

如果返回 `"enabled": false`，说明 RPC URL 未配置，但这不影响 WebMCP 功能。

---

## 🔧 常见配置问题

### 问题 1: JWT_SECRET 未配置

**症状**:
```
Error: JWT_SECRET is required
```

**解决**:
```bash
# 生成密钥
openssl rand -base64 64

# 添加到 .env
echo "JWT_SECRET=<生成的密钥>" >> .env
```

### 问题 2: 数据库连接失败

**症状**:
```
Error: P1001: Can't reach database server
```

**解决方案 A** - 使用 Docker PostgreSQL:
```bash
docker run -d \
  --name awareness-postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=awareness_market_dev \
  -p 5432:5432 \
  ankane/pgvector

# 更新 .env
DATABASE_URL=postgresql://postgres:password@localhost:5432/awareness_market_dev
```

**解决方案 B** - 使用云数据库:
```bash
# 如果已有 AWS RDS，使用该连接字符串
DATABASE_URL=postgresql://user:pass@your-rds.amazonaws.com:5432/dbname
```

**解决方案 C** - 跳过数据库（仅测试 WebMCP）:
```bash
# WebMCP 不依赖数据库，可以先测试
# 只有 RMC 检索和 Memory 功能需要数据库
```

### 问题 3: RPC URL 配置（ERC-8004）

**症状**:
```
ERC-8004 status: "enabled": false
```

**解决**:
1. **免费公共 RPC** (可能限速):
   ```bash
   AVALANCHE_RPC_URL=https://api.avax.network/ext/bc/C/rpc
   ```

2. **Alchemy** (推荐):
   - 访问 https://www.alchemy.com/
   - 创建账户并创建 App
   - 选择 Avalanche 或 Avalanche Fuji
   - 复制 HTTPS URL
   ```bash
   AVALANCHE_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
   ```

3. **Infura**:
   - 访问 https://infura.io/
   - 创建项目
   - 选择 Avalanche 网络
   ```bash
   AVALANCHE_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
   ```

### 问题 4: WebMCP Widget 不显示

**症状**: 页面右下角没有蓝色按钮

**解决**:
1. 检查控制台错误:
   ```
   F12 → Console
   ```

2. 确认 WebMCP 已初始化:
   ```javascript
   window.awarenessWebMCP  // 应该有值
   ```

3. 清除缓存并刷新:
   ```
   Ctrl + Shift + R (强制刷新)
   ```

4. 检查 CSS 是否加载:
   ```bash
   grep "webmcp-styles.css" client/src/main.tsx
   ```

---

## 📊 配置优先级

### 最小配置（可立即测试）

```bash
# .env
JWT_SECRET=<生成的密钥>
```

**可用功能**:
- ✅ WebMCP Widget 显示
- ✅ MCP Token 创建（需要 API Key）
- ✅ Demo 页面
- ❌ RMC 检索（需要数据库）
- ❌ ERC-8004 登录（需要 RPC URL）

### 推荐配置（完整功能）

```bash
# .env
JWT_SECRET=<生成的密钥>
DATABASE_URL=postgresql://postgres:password@localhost:5432/awareness_market_dev
AVALANCHE_RPC_URL=https://api.avax.network/ext/bc/C/rpc
ERC8004_REGISTRY_ADDRESS=0x1Ae90F59731e16b548E34f81F0054e96DdACFc28
```

**可用功能**:
- ✅ 所有 WebMCP 功能
- ✅ RMC 混合检索
- ✅ Memory 管理
- ✅ ERC-8004 区块链登录
- ✅ Multi-Agent 协作

---

## 🎯 配置验证脚本

创建并运行验证脚本：

```bash
cat > verify-config.sh << 'EOF'
#!/bin/bash
echo "🔍 检查 Awareness Market 配置..."

# 检查 .env 文件
if [ ! -f .env ]; then
  echo "❌ .env 文件不存在"
  echo "   运行: cp .env.example .env"
  exit 1
fi
echo "✅ .env 文件存在"

# 检查 JWT_SECRET
if grep -q "JWT_SECRET=CHANGE_ME" .env || grep -q "JWT_SECRET=$" .env; then
  echo "❌ JWT_SECRET 未配置"
  echo "   运行: openssl rand -base64 64"
else
  echo "✅ JWT_SECRET 已配置"
fi

# 检查 DATABASE_URL
if grep -q "DATABASE_URL=" .env; then
  echo "✅ DATABASE_URL 已配置"
else
  echo "⚠️  DATABASE_URL 未配置（WebMCP 不需要，但 RMC 需要）"
fi

# 检查 ERC8004
if grep -q "ERC8004_REGISTRY_ADDRESS=0x1Ae90F59731e16b548E34f81F0054e96DdACFc28" .env; then
  echo "✅ ERC-8004 合约地址已配置"
else
  echo "⚠️  ERC-8004 未配置（钱包登录需要）"
fi

# 检查 RPC URL
if grep -q "AVALANCHE_RPC_URL=" .env && ! grep -q "AVALANCHE_RPC_URL=$" .env; then
  echo "✅ AVALANCHE_RPC_URL 已配置"
else
  echo "⚠️  AVALANCHE_RPC_URL 未配置（ERC-8004 需要）"
fi

echo ""
echo "📋 配置总结:"
echo "   必需配置: JWT_SECRET"
echo "   可选配置: DATABASE_URL, AVALANCHE_RPC_URL"
echo ""
echo "🚀 运行: pnpm run dev"
EOF

chmod +x verify-config.sh
./verify-config.sh
```

---

## 🔗 相关文档

- **WebMCP 用户指南**: [WEBMCP_USER_GUIDE.md](WEBMCP_USER_GUIDE.md)
- **部署指南**: [WEBMCP_DEPLOYMENT_GUIDE.md](WEBMCP_DEPLOYMENT_GUIDE.md)
- **ERC-8004 集成**: [docs/integration/ERC8004_INTEGRATION.md](docs/integration/ERC8004_INTEGRATION.md)
- **状态报告**: [WEBMCP_AND_ERC8004_STATUS.md](WEBMCP_AND_ERC8004_STATUS.md)

---

## 🆘 需要帮助？

### 快速诊断

```bash
# 1. 检查服务器是否运行
curl http://localhost:5000/api/mcp/health

# 2. 检查 WebMCP 状态
curl http://localhost:5173/webmcp-demo.html

# 3. 检查 ERC-8004 状态
curl http://localhost:5000/api/erc8004/status

# 4. 查看日志
# 终端会显示错误信息
```

### 常用命令

```bash
# 重新安装依赖
pnpm install --force

# 清除缓存
pnpm run clean

# 重启服务器
pnpm run dev

# 数据库迁移
npx prisma migrate dev

# 数据库可视化
npx prisma studio
```

---

**配置完成后，访问 http://localhost:5173 即可开始使用！** 🎉
