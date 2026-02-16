# 市场点击报错修复指南

## 🔍 问题分析

用户反馈：点击市场上的各个案例都会报错

### 可能的原因

1. **数据库中没有测试数据** - vectors 表为空
2. **API 路由配置错误** - vector.id 格式不匹配
3. **前端 API 调用失败** - tRPC 查询错误
4. **路由配置不匹配** - Marketplace 和 VectorDetail 路由问题

---

## 🔧 快速诊断

### Step 1: 检查数据库是否有数据

```bash
# 在 EC2 上执行
cd ~/Awareness-Market/Awareness-Network

# 启动 Prisma Studio 查看数据库
pnpm prisma studio

# 或者直接查询
pnpm prisma db seed  # 如果没有数据，先生成样本数据
```

### Step 2: 检查浏览器控制台错误

打开浏览器开发者工具 (F12)，查看：

1. **Console** 标签 - 查看 JavaScript 错误
2. **Network** 标签 - 查看 API 请求是否成功

常见错误：
```
❌ TRPCClientError: NOT_FOUND - No vector found with id: xxx
❌ TRPCClientError: INTERNAL_SERVER_ERROR
❌ TypeError: Cannot read properties of undefined
```

### Step 3: 检查后端日志

```bash
# EC2 上查看后端日志
pm2 logs awareness-backend --lines 50
```

---

## ✅ 解决方案

### 方案 1: 生成测试数据 (最可能的问题)

**原因**: 数据库中没有 vectors/packages 数据

**修复步骤**:

```bash
# 1. SSH 登录到 EC2
ssh ec2-user@44.220.181.78

# 2. 进入项目目录
cd ~/Awareness-Market/Awareness-Network

# 3. 生成样本数据
pnpm tsx scripts/generate-sample-packages-prisma.ts

# 预期输出:
# ✅ Created 7 Vector Packages
# ✅ Created 7 Memory Packages
# ✅ Created 7 Chain Packages
# Total: 21 packages generated

# 4. 重启后端服务
pm2 restart awareness-backend

# 5. 测试 API
curl http://localhost:3001/api/trpc/vectors.search | jq
```

**验证**:
- 刷新前端页面
- Marketplace 应该显示包列表
- 点击任意包应该能正常打开详情页

---

### 方案 2: 修复 API 路由问题

**问题**: `trpc.vectors.search` 可能返回错误格式的数据

让我检查 vectors API:

```bash
# 检查 vectors API 路由
cat server/routers/vectors-api.ts

# 确保有 search 和 getById endpoints
```

**常见问题**:
- `vectors.search` 返回空数组
- `vectors.getById` 找不到 vector
- ID 类型不匹配 (string vs number)

---

### 方案 3: 修复路由配置问题

**当前路由配置**:
```typescript
// client/src/App.tsx
<Route path={"/marketplace/:id"} component={VectorDetail} />
```

**问题**: Marketplace 显示的可能不只是 vectors，还有 memory 和 chain packages

**修复**: 更新路由以支持多种类型

```typescript
// 需要添加:
<Route path={"/marketplace/vector/:id"} component={VectorDetail} />
<Route path={"/marketplace/memory/:id"} component={MemoryDetail} />
<Route path={"/marketplace/chain/:id"} component={ChainDetail} />

// 或者统一用 PackageDetail
<Route path={"/marketplace/:type/:id"} component={PackageDetail} />
```

**修复 Marketplace.tsx 中的链接**:
```typescript
// 当前 (第316行):
<Link href={`/marketplace/${vector.id}`}>

// 应该改为:
<Link href={`/marketplace/vector/${vector.id}`}>
// 或者根据 type 动态生成:
<Link href={`/marketplace/${vector.type}/${vector.id}`}>
```

---

## 📊 完整修复步骤

### 1. 确认问题类型

在浏览器访问: `http://your-domain.com/marketplace`

- ✅ 如果看到空白或"No AI capabilities found" → 数据库问题 (方案1)
- ❌ 如果看到列表，但点击报错 → 路由或API问题 (方案2/3)

### 2. 生成测试数据 (推荐先做)

```bash
ssh ec2-user@44.220.181.78
cd ~/Awareness-Market/Awareness-Network
pnpm tsx scripts/generate-sample-packages-prisma.ts
pm2 restart awareness-backend
```

### 3. 测试 API 是否正常

```bash
# 测试 vectors.search
curl "http://44.220.181.78:3001/api/trpc/vectors.search?input=%7B%22json%22%3A%7B%7D%7D" | jq

# 测试 vectors.getById
curl "http://44.220.181.78:3001/api/trpc/vectors.getById?input=%7B%22json%22%3A%7B%22id%22%3A1%7D%7D" | jq
```

### 4. 查看详细错误日志

```bash
# 后端日志
pm2 logs awareness-backend --lines 100

# 查找错误关键词
pm2 logs awareness-backend | grep -i "error\|not found\|failed"
```

---

## 🚨 常见错误和解决方案

### 错误 1: "No vector found with id: xxx"

**原因**: 数据库中没有该 ID 的 vector

**解决**:
```bash
# 重新生成样本数据
pnpm tsx scripts/generate-sample-packages-prisma.ts
```

### 错误 2: "INTERNAL_SERVER_ERROR"

**原因**: 后端代码错误或数据库连接问题

**检查**:
```bash
# 检查数据库连接
pnpm prisma db push

# 查看后端日志
pm2 logs awareness-backend
```

### 错误 3: "TypeError: Cannot read properties of undefined"

**原因**: 前端代码尝试访问不存在的数据属性

**检查**: Marketplace.tsx 和 VectorDetail.tsx 是否正确处理 loading 和 error 状态

---

## 🎯 验证修复成功

完成修复后，验证以下功能:

- [ ] 访问 /marketplace 能看到包列表
- [ ] 每个包显示正确的名称、描述、价格
- [ ] 点击任意包能打开详情页
- [ ] 详情页显示完整信息（没有 undefined）
- [ ] 没有浏览器控制台错误
- [ ] 后端日志没有错误

---

## 📞 需要更多帮助？

如果按照以上步骤仍然报错，请提供：

1. 浏览器控制台的完整错误信息（F12 → Console）
2. Network 标签中失败的 API 请求详情
3. 后端日志中的错误信息（`pm2 logs awareness-backend`）
4. 截图显示具体的错误界面

我会根据这些信息提供针对性的解决方案！
