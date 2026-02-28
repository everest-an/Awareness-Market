# 🚀 快速测试指南 (Quick Start Testing)

## 方案1: Docker 本地测试（推荐）⚡

### 步骤

#### 1. 启动 Docker Desktop
- 打开 Docker Desktop 应用程序
- 等待状态变为 "Engine running"

#### 2. 启动 PostgreSQL + pgvector 容器

**PowerShell**:
```powershell
cd "e:\Awareness Market\Awareness-Network"

# 启动容器
docker run -d `
  --name awareness-postgres-test `
  -e POSTGRES_PASSWORD=testpass `
  -e POSTGRES_DB=awareness_market `
  -p 5432:5432 `
  pgvector/pgvector:pg16

# 等待数据库启动（约5秒）
Start-Sleep -Seconds 5

# 设置环境变量
$env:DATABASE_URL="postgresql://postgres:testpass@localhost:5432/awareness_market"
```

**CMD** (Windows):
```cmd
cd "e:\Awareness Market\Awareness-Network"

REM 启动容器
docker run -d ^
  --name awareness-postgres-test ^
  -e POSTGRES_PASSWORD=testpass ^
  -e POSTGRES_DB=awareness_market ^
  -p 5432:5432 ^
  pgvector/pgvector:pg16

REM 等待数据库启动（约5秒）
timeout /t 5

REM 设置环境变量
set DATABASE_URL=postgresql://postgres:testpass@localhost:5432/awareness_market
```

#### 3. 检查数据库连接

```bash
pnpm run memory:check
```

**预期输出**:
```
✅ Connected successfully!
✅ PostgreSQL version: PostgreSQL 16.x
✅ pgvector installed
⚠️  memory_entries table NOT found
```

#### 4. 运行迁移

```bash
pnpm run memory:migrate
```

**预期输出**:
```
✅ Migration completed successfully!
✅ 6个新列创建
✅ memory_conflicts 表创建
✅ 5个索引创建
✅ 2个触发器创建
```

#### 5. 运行第一阶段测试

```bash
pnpm run memory:test
```

**预期输出**:
```
✅ Test 1: Basic Scoring Formula - PASS
✅ Test 2: Usage Tracking - PASS
✅ Test 3: Conflict Detection - PASS
✅ Test 4: Version Tree - PASS
```

#### 6. 运行第二阶段测试

```bash
pnpm run memory:test:phase2
```

**预期输出**:
```
✅ Test 1: Conflict Detection API - PASS
✅ Test 2: Version Tree API - PASS
⏭️  Test 3: Semantic Detection - SKIPPED (需要 OPENAI_API_KEY)
```

#### 7. (可选) 测试语义冲突检测

```bash
# 设置 OpenAI API Key
$env:OPENAI_API_KEY="sk-your-api-key-here"

# 重新运行第二阶段测试
pnpm run memory:test:phase2
```

#### 8. 清理（完成后）

```bash
# 停止并删除容器
docker stop awareness-postgres-test
docker rm awareness-postgres-test
```

---

## 方案2: AWS RDS 测试 🌐

### 步骤

#### 1. 登录 AWS Console
```
https://console.aws.amazon.com/rds/home?region=us-east-1
```

#### 2. 启动 RDS 实例
- 找到 `awareness-network-db` 实例
- 点击 **Actions** → **Start**
- 等待状态变为 **Available**（约 2-5 分钟）

#### 3. 检查安全组
- 确保端口 5432 对您的 IP 开放
- Security group → Inbound rules → Edit
- 添加规则：
  - Type: PostgreSQL
  - Port: 5432
  - Source: 您的 IP 或 0.0.0.0/0（测试）

#### 4. 运行测试

```bash
cd "e:\Awareness Market\Awareness-Network"

# 数据库 URL 应该已经在 .env 中配置
pnpm run memory:check
pnpm run memory:test
pnpm run memory:test:phase2
```

---

## 快速命令参考

| 命令 | 描述 |
|------|------|
| `pnpm run memory:check` | 检查数据库连接 |
| `pnpm run memory:migrate` | 运行数据库迁移 |
| `pnpm run memory:test` | 第一阶段测试 |
| `pnpm run memory:test:phase2` | 第二阶段测试 |
| `pnpm run memory:verify` | 模块导入验证 |

---

## 故障排查

### Docker 容器已存在
```bash
# 如果容器已存在，先删除
docker rm -f awareness-postgres-test

# 然后重新创建
docker run -d ...
```

### 端口 5432 已被占用
```bash
# 检查端口占用
netstat -ano | findstr :5432

# 使用不同端口
docker run -d -p 5433:5432 ...

# 更新 DATABASE_URL
set DATABASE_URL=postgresql://postgres:testpass@localhost:5433/awareness_market
```

### 迁移失败（表已存在）
```bash
# 这是正常的（幂等性），迁移会跳过已存在的对象
# 只要看到 "Migration completed successfully!" 即可
```

---

## 下一步

测试通过后：
1. ✅ 代码验证完成
2. ✅ 数据库功能验证完成
3. 🎯 准备部署到生产环境

---

**总结**: 选择方案1（Docker）进行快速本地测试，或选择方案2（AWS RDS）进行生产环境测试。
