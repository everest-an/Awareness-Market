# 🚀 Manus 测试部署指南

**目标**: 完成 Phase 2 功能的数据库测试验证

**预计时间**: 15-20 分钟

---

## 📋 步骤 1: 启动 AWS RDS 数据库（5 分钟）

### 1.1 登录 AWS Console

在浏览器打开：
```
https://console.aws.amazon.com/rds/home?region=us-east-1
```

### 1.2 启动数据库实例

1. 左侧菜单点击 **"Databases"**
2. 找到实例名称：`awareness-network-db`
3. 选中该实例
4. 点击顶部 **Actions** 按钮 → 选择 **Start**
5. 等待状态变为 **"Available"**（约 2-5 分钟）
   - 刷新页面查看状态更新
   - 状态栏会从 "Starting" 变为 "Available"

### 1.3 配置安全组（首次测试需要）

**检查是否已配置**：
- 点击实例名称进入详情页
- 找到 **"Connectivity & security"** 标签
- 查看 **"VPC security groups"** 部分
- 点击安全组名称（例如：`sg-xxxxx`）

**添加入站规则**（如果端口 5432 未开放）：
1. 在安全组页面点击 **"Inbound rules"** 标签
2. 点击 **"Edit inbound rules"** 按钮
3. 点击 **"Add rule"** 按钮
4. 配置规则：
   - **Type**: 选择 `PostgreSQL`
   - **Protocol**: `TCP`（自动填充）
   - **Port range**: `5432`（自动填充）
   - **Source**:
     - 测试环境：选择 `Anywhere-IPv4` 或输入 `0.0.0.0/0`
     - 生产环境：选择 `My IP` 或输入您的 IP 地址
5. 点击 **"Save rules"** 按钮

**⏰ 检查点**: RDS 实例状态显示 "Available"，端口 5432 已开放

---

## 📋 步骤 2: 运行测试命令（10 分钟）

### 2.1 打开 PowerShell

- 按 `Win + X`
- 选择 **"Windows PowerShell"** 或 **"终端"**

### 2.2 进入项目目录

```powershell
cd "e:\Awareness Market\Awareness-Network"
```

### 2.3 执行测试序列

**依次执行以下 4 条命令**（复制粘贴即可）：

#### 命令 1: 检查数据库连接
```powershell
pnpm run memory:check
```

**预期输出**：
```
✅ Connected successfully!
✅ PostgreSQL version: PostgreSQL 16.x on x86_64...
✅ pgvector extension installed
✅ memory_entries table found
✅ All Phase 2 fields present
✅ All indexes created
✅ All triggers created
```

**如果失败**：
- ❌ 连接超时 → 检查 RDS 实例是否为 "Available" 状态
- ❌ 端口拒绝 → 检查安全组端口 5432 是否开放
- ❌ 认证失败 → 检查 `.env` 文件中的 `DATABASE_URL`

---

#### 命令 2: 运行数据库迁移
```powershell
pnpm run memory:migrate
```

**预期输出**：
```
✅ Migration completed successfully!
✅ Phase 2 fields created: 6 new columns
✅ memory_conflicts table created
✅ Indexes created: 5 indexes
✅ Triggers created: 2 triggers
```

**说明**: 如果已经迁移过，会看到 "already exists" 消息，这是正常的（幂等性）。

---

#### 命令 3: Phase 1 测试（基础功能）
```powershell
pnpm run memory:test
```

**预期输出**：
```
🧪 Testing Memory System Phase 1

Test 1: Basic Scoring Formula
  ✅ Memory created with correct initial score
  ✅ Score calculation verified

Test 2: Usage Tracking
  ✅ Usage count increments correctly
  ✅ Last accessed timestamp updated

Test 3: Conflict Detection (Trigger-based)
  ✅ Claim-based conflict detected automatically
  ✅ Conflict entry created in memory_conflicts table

Test 4: Version Tree (Trigger-based)
  ✅ Root ID populated automatically
  ✅ Version chain maintained correctly

📊 Phase 1 Test Summary
  1. Basic Scoring Formula: ✅ PASS
  2. Usage Tracking: ✅ PASS
  3. Conflict Detection: ✅ PASS
  4. Version Tree: ✅ PASS

🎉 All tests passed!
```

**如果失败**: 截图错误信息发给我。

---

#### 命令 4: Phase 2 测试（冲突检测 + 版本树）
```powershell
pnpm run memory:test:phase2
```

**预期输出**：
```
🧪 Testing Phase 2 Implementation

Test 1: Conflict Detection API
------------------------------------------------------------
Creating conflicting memories...
  ✅ Memory 1: primary_database = PostgreSQL
  ✅ Memory 2: primary_database = MongoDB (CONFLICT!)

Found 1 pending conflicts:
  [1] claim_mismatch
      Memory 1: Our primary database is PostgreSQL...
      Memory 2: Our primary database is MongoDB...
      Status: pending

Conflict Statistics:
  Pending: 1
  Resolved: 0
  Ignored: 0
  Total: 1

Resolving conflict (choosing PostgreSQL)...
  ✅ Conflict resolved
     Status: resolved
     Winner: Memory 1 (PostgreSQL)
     Resolved by: user-admin

✅ Conflict Detection API verified

============================================================

Test 2: Version Tree API
------------------------------------------------------------
Creating memory with version history...
  ✅ Original version: "timeout = 30s"
  ✅ Version 2: "timeout = 60s"
  ✅ Version 3: "timeout = 120s"

Version History (linear chain):
  Total versions: 3
  Depth: 3
  Root: API timeout is set to 30 seconds...
  Current: API timeout is set to 120 seconds...

  Versions:
    [1] API timeout is set to 30 seconds...
        Created by: user-alice, Confidence: 0.9
    [2] API timeout is set to 60 seconds...
        Created by: user-alice, Confidence: 0.95
    [3] API timeout is set to 120 seconds...
        Created by: user-bob, Confidence: 0.98

Version Tree (full structure):
  Root ID: xxxxxxxx
  Children: 1

  → API timeout is set to 30 seconds...
    (v1, user-alice)
    → API timeout is set to 60 seconds...
      (v2, user-alice)
      → API timeout is set to 120 seconds...
        (v3, user-bob)

Version Comparison (Original vs Latest):
  content:
    Old: API timeout is set to 30 seconds
    New: API timeout is set to 120 seconds
  confidence:
    Old: 0.9
    New: 0.98

Rolling back to version 2...
  ✅ Rolled back successfully
     New version ID: xxxxxxxx
     Content: API timeout is set to 60 seconds
     Parent: Version 3 (xxxxxxxx)

✅ Version Tree API verified

============================================================

Test 3: Semantic Conflict Detection - SKIPPED
------------------------------------------------------------
⚠️  OPENAI_API_KEY not set, skipping LLM-based tests

============================================================

📊 Phase 2 Test Summary

Test Results:
  1. Conflict Detection API: ✅ PASS
  2. Version Tree API: ✅ PASS
  3. Semantic Detection: ⏭️  SKIPPED

🎉 Phase 2 testing complete!

Cleaning up test data...
✅ Cleanup complete
```

**说明**:
- Test 3 显示 "SKIPPED" 是正常的（需要 OpenAI API Key）
- 只要 Test 1 和 Test 2 显示 ✅ PASS 即可

---

## ✅ 测试完成检查清单

请确认所有项目都打勾：

- [ ] AWS RDS 实例状态为 "Available"
- [ ] 安全组端口 5432 已开放
- [ ] `pnpm run memory:check` - ✅ 通过
- [ ] `pnpm run memory:migrate` - ✅ 通过
- [ ] `pnpm run memory:test` - ✅ 所有 4 项测试通过
- [ ] `pnpm run memory:test:phase2` - ✅ Test 1 和 Test 2 通过

---

## 🔧 故障排查

### 问题 1: `memory:check` 连接失败

**错误信息**: `connect ETIMEDOUT` 或 `connect ECONNREFUSED`

**解决方案**:
1. 检查 RDS 实例状态是否为 "Available"（不是 "Stopped"）
2. 检查安全组入站规则是否包含端口 5432
3. 检查 `.env` 文件中的 `DATABASE_URL` 是否正确

### 问题 2: 端口 5432 已被占用

**错误信息**: `EADDRINUSE`

**解决方案**:
```powershell
# 检查端口占用
netstat -ano | findstr :5432

# 如果有本地 PostgreSQL 服务，停止它
net stop postgresql-x64-16
```

### 问题 3: 测试失败（代码错误）

**解决方案**:
1. 截图完整错误堆栈
2. 记录失败的测试名称
3. 发送给我进行排查

### 问题 4: 迁移报错 "already exists"

**说明**: 这是正常的！迁移脚本具有幂等性，会跳过已存在的对象。

**验证**: 只要看到最后一行 `✅ Migration completed successfully!` 即可。

---

## 🛑 测试后清理（可选）

**停止 AWS RDS 实例以节省费用**：

1. 返回 AWS RDS Console
2. 选中 `awareness-network-db` 实例
3. 点击 **Actions** → **Stop**
4. 确认停止（实例会在 7 天后自动重启）

**注意**:
- 停止实例不会删除数据
- 下次测试前需要再次启动（2-5 分钟）

---

## 📞 需要帮助？

**如果遇到任何问题**:
1. 截图完整错误信息
2. 记录执行到哪一步失败
3. 将信息发给我

**常见错误代码**:
- `ETIMEDOUT` → 网络/安全组问题
- `ECONNREFUSED` → RDS 未启动或端口错误
- `ENOTFOUND` → DNS 解析失败
- `Authentication failed` → 数据库密码错误

---

## 📊 测试结果提交

**测试完成后，请提供以下信息**:

1. ✅ 所有 4 条命令的完整输出（可以截图）
2. ✅ 任何错误或警告信息
3. ✅ 测试总耗时

**格式示例**:
```
✅ memory:check - 通过（2秒）
✅ memory:migrate - 通过（5秒）
✅ memory:test - 通过（8秒，4/4 测试通过）
✅ memory:test:phase2 - 通过（12秒，2/2 测试通过）

总耗时: 27秒
```

---

**祝测试顺利！** 🎉
