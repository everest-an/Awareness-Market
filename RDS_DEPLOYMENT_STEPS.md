# AWS RDS 部署步骤 - Awareness Network

## ✅ 当前状态

您的 RDS 实例正在创建中：

- **Instance ID**: `awareness-network-db`
- **Engine**: PostgreSQL 15.15
- **Status**: `creating`
- **Username**: `postgres`
- **Password**: `AwarenessDB2026SecurePass`
- **Database**: `awareness_market`
- **Security Group**: `sg-0a49a80bda988ee00`

**预计等待时间**: 10-15 分钟

---

## 📋 部署步骤清单

### ⏳ 步骤 1: 等待实例创建完成

**监控实例状态**（每 30 秒检查一次）:

```bash
# 方法 1: AWS CLI 监控
aws rds describe-db-instances \
  --db-instance-identifier awareness-network-db \
  --query 'DBInstances[0].[DBInstanceStatus,Endpoint.Address]' \
  --output table

# 方法 2: 持续监控（Windows PowerShell）
while ($true) {
  $status = aws rds describe-db-instances --db-instance-identifier awareness-network-db --query 'DBInstances[0].DBInstanceStatus' --output text
  Write-Host "$(Get-Date -Format 'HH:mm:ss') - Status: $status"
  if ($status -eq "available") {
    Write-Host "Database is ready!" -ForegroundColor Green
    break
  }
  Start-Sleep -Seconds 30
}

# 方法 3: AWS Console
# 访问: https://console.aws.amazon.com/rds/
# 等待 "Status" 列显示 "Available"
```

**状态变化**:
```
creating → backing-up → available ✅
```

---

### 🔗 步骤 2: 获取数据库 Endpoint

**实例可用后，获取连接地址**:

```bash
# 获取 Endpoint 和 Port
aws rds describe-db-instances \
  --db-instance-identifier awareness-network-db \
  --query 'DBInstances[0].[Endpoint.Address,Endpoint.Port]' \
  --output text
```

**预期输出**（示例）:
```
awareness-network-db.c9akl4cqzgqk.us-east-1.rds.amazonaws.com	5432
```

**保存 Endpoint 地址**:
```bash
# 格式
awareness-network-db.<随机字符>.us-east-1.rds.amazonaws.com
```

---

### 🔒 步骤 3: 配置安全组（允许访问）

#### A. 允许您的本地 IP 访问（开发测试）

```bash
# 获取您的公网 IP
MY_IP=$(curl -s https://checkip.amazonaws.com)
echo "Your IP: $MY_IP"

# 添加安全组规则
aws ec2 authorize-security-group-ingress \
  --group-id sg-0a49a80bda988ee00 \
  --protocol tcp \
  --port 5432 \
  --cidr $MY_IP/32 \
  --tag-specifications 'ResourceType=security-group-rule,Tags=[{Key=Name,Value=Dev-PostgreSQL-Access}]'
```

**Windows PowerShell 版本**:
```powershell
# 获取您的 IP
$MY_IP = (Invoke-WebRequest -Uri "https://checkip.amazonaws.com").Content.Trim()
Write-Host "Your IP: $MY_IP"

# 添加安全组规则
aws ec2 authorize-security-group-ingress `
  --group-id sg-0a49a80bda988ee00 `
  --protocol tcp `
  --port 5432 `
  --cidr "$MY_IP/32"
```

#### B. 允许 AWS 内部服务访问（生产环境）

```bash
# 如果您的应用部署在 EC2/ECS/Lambda
# 获取应用服务器的安全组 ID（例如: sg-app-servers）

aws ec2 authorize-security-group-ingress \
  --group-id sg-0a49a80bda988ee00 \
  --protocol tcp \
  --port 5432 \
  --source-group sg-app-servers \
  --group-owner-id YOUR_AWS_ACCOUNT_ID
```

#### C. 验证安全组规则

```bash
# 查看当前规则
aws ec2 describe-security-groups \
  --group-ids sg-0a49a80bda988ee00 \
  --query 'SecurityGroups[0].IpPermissions'
```

---

### 📝 步骤 4: 构建 DATABASE_URL

**使用您获取的 Endpoint 构建连接字符串**:

```bash
# 格式
postgresql://postgres:AwarenessDB2026SecurePass@awareness-network-db.xxxxxx.us-east-1.rds.amazonaws.com:5432/awareness_market?sslmode=require

# 实际示例（替换 xxxxxx 为您的真实 endpoint）
postgresql://postgres:AwarenessDB2026SecurePass@awareness-network-db.c9akl4cqzgqk.us-east-1.rds.amazonaws.com:5432/awareness_market?sslmode=require
```

**参数说明**:
- `postgres` - 用户名
- `AwarenessDB2026SecurePass` - 密码
- `awareness-network-db.xxxxxx.us-east-1.rds.amazonaws.com` - Endpoint（需替换）
- `5432` - 端口
- `awareness_market` - 数据库名
- `?sslmode=require` - 强制 SSL 连接（推荐）

---

### 🔧 步骤 5: 更新 .env 文件

**编辑本地 `.env` 文件**:

```bash
# 将
DATABASE_URL=postgresql://postgres:your_password@db.your-project-ref.supabase.co:5432/postgres

# 替换为（使用您的真实 endpoint）
DATABASE_URL=postgresql://postgres:AwarenessDB2026SecurePass@awareness-network-db.xxxxxx.us-east-1.rds.amazonaws.com:5432/awareness_market?sslmode=require
```

**⚠️ 重要**:
- 确保密码中没有特殊字符需要 URL 编码
- 如果密码包含 `@`, `#`, `%` 等字符，需要编码
- 推荐使用环境变量或 AWS Secrets Manager

---

### ✅ 步骤 6: 测试数据库连接

#### A. 使用 Prisma 测试

```bash
# 进入项目目录
cd "e:\Awareness Market\Awareness-Network"

# 测试连接
npx prisma db execute --stdin <<< "SELECT version();"
```

**成功输出**:
```
PostgreSQL 15.15 on x86_64-pc-linux-gnu...
```

#### B. 使用 psql 测试（如果已安装）

```bash
# 使用您的真实 endpoint 替换 xxxxxx
psql "postgresql://postgres:AwarenessDB2026SecurePass@awareness-network-db.xxxxxx.us-east-1.rds.amazonaws.com:5432/awareness_market?sslmode=require"

# 测试查询
\l              -- 列出所有数据库
\dt             -- 列出所有表（当前应该为空）
SELECT now();   -- 测试查询
\q              -- 退出
```

#### C. 使用 Node.js 脚本测试

创建测试文件 `test-db-connection.js`:

```javascript
const { PrismaClient } = require('@prisma/client');

async function testConnection() {
  const prisma = new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
  });

  try {
    await prisma.$connect();
    console.log('✅ Database connected successfully!');

    const result = await prisma.$queryRaw`SELECT version()`;
    console.log('PostgreSQL version:', result[0].version);

    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    process.exit(1);
  }
}

testConnection();
```

**运行测试**:
```bash
node test-db-connection.js
```

---

### 🚀 步骤 7: 运行 Prisma 迁移

**生成 Prisma Client**:
```bash
npx prisma generate
```

**应用数据库迁移**（创建所有表）:
```bash
npx prisma migrate deploy
```

**预期输出**:
```
Prisma schema loaded from prisma\schema.prisma
Datasource "db": PostgreSQL database "awareness_market"

The following migration(s) have been applied:

migrations/
  └─ 20260128000000_init_workflows_and_wmatrix/
    └─ migration.sql

All migrations have been successfully applied.
```

**验证表创建**:
```bash
npx prisma studio
```

在浏览器中打开 http://localhost:5555，您应该看到：
- workflows
- workflow_steps
- on_chain_interactions
- w_matrix_compatibility
- w_matrix_listings
- w_matrix_integrity
- users

---

### 📊 步骤 8: 验证部署

#### A. 检查表结构

```bash
# 使用 Prisma
npx prisma db pull

# 或使用 psql
psql "postgresql://postgres:AwarenessDB2026SecurePass@your-endpoint:5432/awareness_market" \
  -c "\dt"
```

#### B. 插入测试数据

```javascript
// test-insert.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testInsert() {
  const workflow = await prisma.workflow.create({
    data: {
      id: 'wf_test_' + Date.now(),
      task: 'Test workflow from RDS',
      orchestration: 'sequential',
      memorySharing: 'enabled',
      recordOnChain: true,
      createdBy: 1, // 假设用户 ID 为 1
    },
  });

  console.log('Created workflow:', workflow);

  // 查询
  const workflows = await prisma.workflow.findMany();
  console.log('All workflows:', workflows.length);

  await prisma.$disconnect();
}

testInsert();
```

**运行**:
```bash
node test-insert.js
```

---

## 🔐 安全最佳实践

### 1. 使用 AWS Secrets Manager（推荐）

**创建 Secret**:
```bash
aws secretsmanager create-secret \
  --name awareness-network/database \
  --description "Database credentials for Awareness Network" \
  --secret-string '{
    "username": "postgres",
    "password": "AwarenessDB2026SecurePass",
    "host": "awareness-network-db.xxxxxx.us-east-1.rds.amazonaws.com",
    "port": 5432,
    "database": "awareness_market"
  }' \
  --region us-east-1
```

**在代码中读取**（server/aws-secrets.ts）:
```typescript
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({ region: 'us-east-1' });

export async function getDatabaseUrl(): Promise<string> {
  const command = new GetSecretValueCommand({
    SecretId: 'awareness-network/database',
  });

  const response = await client.send(command);
  const secret = JSON.parse(response.SecretString!);

  return `postgresql://${secret.username}:${secret.password}@${secret.host}:${secret.port}/${secret.database}?sslmode=require`;
}
```

### 2. 配置 SSL/TLS

**下载 RDS CA 证书**:
```bash
curl -o rds-ca-2019-root.pem https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem
```

**更新 DATABASE_URL**:
```bash
DATABASE_URL=postgresql://postgres:AwarenessDB2026SecurePass@your-endpoint:5432/awareness_market?sslmode=require&sslrootcert=./rds-ca-2019-root.pem
```

### 3. 限制安全组访问

**生产环境只允许应用服务器访问**:
```bash
# 移除公网访问规则
aws ec2 revoke-security-group-ingress \
  --group-id sg-0a49a80bda988ee00 \
  --protocol tcp \
  --port 5432 \
  --cidr 0.0.0.0/0

# 仅允许应用服务器
aws ec2 authorize-security-group-ingress \
  --group-id sg-0a49a80bda988ee00 \
  --protocol tcp \
  --port 5432 \
  --source-group sg-app-servers
```

---

## 🔧 故障排查

### 问题 1: "connection timed out"

**原因**: 安全组未开放或实例未启用公网访问

**解决**:
1. 检查安全组规则（步骤 3）
2. 确认 RDS 实例启用了 "Publicly accessible"
3. 检查 VPC 路由表和 Internet Gateway

### 问题 2: "password authentication failed"

**原因**: 密码错误

**解决**:
```bash
# 重置密码
aws rds modify-db-instance \
  --db-instance-identifier awareness-network-db \
  --master-user-password NewSecurePassword123 \
  --apply-immediately
```

### 问题 3: "database does not exist"

**原因**: 数据库名称拼写错误

**解决**:
```bash
# 连接到 postgres 默认数据库
psql "postgresql://postgres:password@endpoint:5432/postgres"

# 创建数据库
CREATE DATABASE awareness_market;
```

### 问题 4: Prisma 连接失败

**启用调试日志**:
```typescript
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});
```

---

## 📋 快速命令参考

### 检查实例状态
```bash
aws rds describe-db-instances \
  --db-instance-identifier awareness-network-db \
  --query 'DBInstances[0].DBInstanceStatus'
```

### 获取连接信息
```bash
aws rds describe-db-instances \
  --db-instance-identifier awareness-network-db \
  --query 'DBInstances[0].[Endpoint.Address,Endpoint.Port,DBName]' \
  --output table
```

### 查看安全组
```bash
aws ec2 describe-security-groups \
  --group-ids sg-0a49a80bda988ee00
```

### 测试连接
```bash
npx prisma db execute --stdin <<< "SELECT 1"
```

### 运行迁移
```bash
npx prisma migrate deploy
```

### 打开管理界面
```bash
npx prisma studio
```

---

## ✅ 完成检查清单

- [ ] 实例状态为 "Available"
- [ ] 成功获取 Endpoint 地址
- [ ] 安全组已配置（允许您的 IP）
- [ ] DATABASE_URL 已更新
- [ ] 连接测试成功
- [ ] Prisma 迁移已运行
- [ ] 表已创建（6 个新表）
- [ ] 可以通过 Prisma Studio 查看数据
- [ ] （可选）配置了 AWS Secrets Manager
- [ ] （可选）启用了 SSL 连接

---

## 🎯 下一步

完成上述步骤后，您的数据库就准备好了！

**部署应用**:
1. 将 DATABASE_URL 设置为环境变量
2. 在部署环境运行 `npx prisma generate`
3. 在部署环境运行 `npx prisma migrate deploy`
4. 启动应用

**监控和维护**:
- 启用 CloudWatch 监控
- 配置自动备份（已启用 7 天保留）
- 设置告警（CPU、连接数、存储）
- 定期更新安全补丁

**需要帮助？** 告诉我遇到的任何问题！
