# AWS PostgreSQL 数据库部署指南

## 概览

在 AWS 上部署 PostgreSQL 有多种选择，每种都适合不同的使用场景。

---

## 选项对比

| 服务 | 适用场景 | 成本 | 管理复杂度 | 性能 |
|------|---------|------|-----------|------|
| **RDS PostgreSQL** | 生产环境标准选择 | 中 | 低 | 高 |
| **Aurora Serverless v2** | 流量波动大的应用 | 按使用付费 | 极低 | 极高 |
| **Aurora PostgreSQL** | 高可用、高性能需求 | 高 | 低 | 极高 |
| **EC2 自托管** | 完全控制需求 | 低 | 高 | 中 |

**推荐**: 对于大多数应用，**Amazon RDS for PostgreSQL** 是最佳选择。

---

## 方案 1: Amazon RDS for PostgreSQL（推荐）

### 特点
- ✅ 全托管服务（自动备份、补丁、监控）
- ✅ 高可用性（Multi-AZ 部署）
- ✅ 性能优化（可扩展存储和计算）
- ✅ 与 AWS 生态系统无缝集成
- ✅ 免费套餐（db.t3.micro 每月 750 小时）

### 创建步骤

#### 1. 通过 AWS Console 创建

**步骤 A: 登录并创建数据库**
1. 访问 AWS Console: https://console.aws.amazon.com/rds/
2. 点击 **Create database**
3. 选择 **PostgreSQL**

**步骤 B: 配置设置**

**引擎选项**:
- Engine type: **PostgreSQL**
- Version: **15.5** 或 **16.1**（推荐最新稳定版）

**模板**:
- 生产环境: **Production**
- 开发/测试: **Free tier**（如符合条件）

**数据库实例**:
- DB instance identifier: `awareness-network-db`
- Master username: `postgres`（或自定义）
- Master password: 设置强密码（建议 16+ 字符）

**实例配置**:
- DB instance class:
  - 开发: `db.t3.micro`（免费套餐）
  - 生产: `db.t3.medium` 或 `db.m6g.large`

**存储**:
- Storage type: **General Purpose SSD (gp3)**
- Allocated storage: `20 GB`（开发）/ `100 GB`（生产）
- ✅ Enable storage autoscaling（自动扩展到 1000 GB）

**可用性与持久性**:
- Multi-AZ deployment:
  - 开发: **不启用**（节省成本）
  - 生产: **启用**（高可用性）

**连接性**:
- Virtual Private Cloud (VPC): 选择现有 VPC
- Public access:
  - **Yes**（如果从本地访问）
  - **No**（生产环境推荐，仅 VPC 内访问）
- VPC security group: 创建新的或选择现有

**数据库认证**:
- 选择 **Password authentication**

**其他配置**:
- Initial database name: `awareness_market`
- Automated backups: **Enable**（保留 7 天）
- Backup window: 自动或自定义（建议凌晨 2-3 点）
- Encryption: **启用**（使用 AWS KMS）
- Performance Insights: **启用**（免费 7 天数据）
- Monitoring: **启用 Enhanced Monitoring**

4. 点击 **Create database**

**等待时间**: 约 10-15 分钟

#### 2. 通过 AWS CLI 创建

```bash
# 创建 RDS 实例
aws rds create-db-instance \
  --db-instance-identifier awareness-network-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --engine-version 15.5 \
  --master-username postgres \
  --master-user-password 'YOUR_STRONG_PASSWORD' \
  --allocated-storage 20 \
  --storage-type gp3 \
  --storage-encrypted \
  --vpc-security-group-ids sg-xxxxxxxx \
  --db-subnet-group-name default \
  --publicly-accessible \
  --backup-retention-period 7 \
  --preferred-backup-window "03:00-04:00" \
  --preferred-maintenance-window "sun:04:00-sun:05:00" \
  --enable-cloudwatch-logs-exports '["postgresql"]' \
  --db-name awareness_market \
  --tags Key=Environment,Value=Production Key=Project,Value=AwarenessNetwork
```

#### 3. 获取连接信息

**方法 1: AWS Console**
1. RDS Dashboard → Databases
2. 点击您的数据库实例
3. 在 **Connectivity & security** 标签页查看：
   - Endpoint: `awareness-network-db.xxxxxxxxx.us-east-1.rds.amazonaws.com`
   - Port: `5432`

**方法 2: AWS CLI**
```bash
aws rds describe-db-instances \
  --db-instance-identifier awareness-network-db \
  --query 'DBInstances[0].[Endpoint.Address,Endpoint.Port]' \
  --output text
```

### DATABASE_URL 格式

```bash
# 基础格式
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@awareness-network-db.xxxxxxxxx.us-east-1.rds.amazonaws.com:5432/awareness_market

# 带 SSL 强制（推荐生产环境）
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@awareness-network-db.xxxxxxxxx.us-east-1.rds.amazonaws.com:5432/awareness_market?sslmode=require

# 带连接池配置
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@awareness-network-db.xxxxxxxxx.us-east-1.rds.amazonaws.com:5432/awareness_market?sslmode=require&connect_timeout=10&pool_timeout=10
```

**⚠️ 安全提示**:
- 永远不要将密码硬编码在代码中
- 使用 AWS Secrets Manager 或环境变量

### 安全组配置

**创建安全组规则**（允许 PostgreSQL 访问）:

```bash
# 获取您的 IP
MY_IP=$(curl -s https://checkip.amazonaws.com)

# 创建安全组规则
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxxxxx \
  --protocol tcp \
  --port 5432 \
  --cidr $MY_IP/32 \
  --description "PostgreSQL access from my IP"
```

**生产环境最佳实践**:
```bash
# 仅允许 VPC 内访问
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxxxxx \
  --protocol tcp \
  --port 5432 \
  --source-group sg-app-server-sg \
  --description "PostgreSQL access from app servers"
```

### 成本估算（美东-1 区域）

**开发环境**:
- db.t3.micro (1 vCPU, 1 GB RAM): **$0.017/小时** = ~$12.24/月
- 20 GB gp3 存储: **$2.30/月**
- **总计**: ~$14.54/月
- 📝 **免费套餐**: 前 12 个月免费 750 小时/月

**生产环境**:
- db.t3.medium (2 vCPU, 4 GB RAM): **$0.068/小时** = ~$49/月
- Multi-AZ: **x2** = ~$98/月
- 100 GB gp3 存储: **$11.50/月**
- 备份存储（20 GB）: **$2/月**
- **总计**: ~$111.50/月

---

## 方案 2: Amazon Aurora Serverless v2 PostgreSQL

### 特点
- ✅ 按秒计费，自动扩缩容
- ✅ 极低延迟扩展（秒级）
- ✅ 高可用性（多 AZ 自动复制）
- ✅ 与 PostgreSQL 14+ 兼容
- ✅ 适合流量波动大的应用

### 创建步骤

```bash
# 创建 Aurora Serverless v2 集群
aws rds create-db-cluster \
  --db-cluster-identifier awareness-aurora-cluster \
  --engine aurora-postgresql \
  --engine-version 15.5 \
  --master-username postgres \
  --master-user-password 'YOUR_STRONG_PASSWORD' \
  --database-name awareness_market \
  --vpc-security-group-ids sg-xxxxxxxx \
  --db-subnet-group-name default \
  --serverless-v2-scaling-configuration \
    MinCapacity=0.5,MaxCapacity=16 \
  --storage-encrypted \
  --backup-retention-period 7 \
  --enable-cloudwatch-logs-exports '["postgresql"]'

# 创建实例
aws rds create-db-instance \
  --db-instance-identifier awareness-aurora-instance-1 \
  --db-cluster-identifier awareness-aurora-cluster \
  --db-instance-class db.serverless \
  --engine aurora-postgresql
```

### DATABASE_URL 格式

```bash
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@awareness-aurora-cluster.cluster-xxxxxxxxx.us-east-1.rds.amazonaws.com:5432/awareness_market?sslmode=require
```

### 成本估算

**按 ACU (Aurora Capacity Unit) 计费**:
- 1 ACU = 2 GB RAM
- **$0.12/ACU/小时**

**示例场景**:
- 最低配置（0.5 ACU）: **$0.06/小时** = ~$43/月
- 平均配置（2 ACU）: **$0.24/小时** = ~$173/月
- 存储: **$0.10/GB/月**

**适合场景**: 流量波动大（如夜间 0.5 ACU，白天 8 ACU）

---

## 方案 3: Amazon Aurora PostgreSQL（标准版）

### 特点
- ✅ 高性能（5 倍于标准 PostgreSQL）
- ✅ 自动故障转移（<30 秒）
- ✅ 最多 15 个只读副本
- ✅ 自动备份到 S3
- ❌ 成本较高

### DATABASE_URL 格式

```bash
# 写入（主实例）
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@awareness-aurora-cluster.cluster-xxxxxxxxx.us-east-1.rds.amazonaws.com:5432/awareness_market

# 只读（副本）
DATABASE_URL_READONLY=postgresql://postgres:YOUR_PASSWORD@awareness-aurora-cluster.cluster-ro-xxxxxxxxx.us-east-1.rds.amazonaws.com:5432/awareness_market
```

### 成本估算

**实例成本**:
- db.r6g.large (2 vCPU, 16 GB): **$0.26/小时** = ~$187/月
- 多 AZ（1 主 + 1 副本）: **x2** = ~$374/月
- 存储: **$0.10/GB/月**

---

## 方案 4: EC2 自托管 PostgreSQL

### 特点
- ✅ 完全控制配置
- ✅ 成本最低（按需优化）
- ❌ 需要手动管理（备份、补丁、监控）
- ❌ 高可用性需要自行配置

### 创建步骤

```bash
# 1. 启动 EC2 实例
aws ec2 run-instances \
  --image-id ami-xxxxxxxxx \
  --instance-type t3.medium \
  --key-name your-key-pair \
  --security-group-ids sg-xxxxxxxx \
  --subnet-id subnet-xxxxxxxx \
  --block-device-mappings '[{"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":100,"VolumeType":"gp3"}}]' \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=PostgreSQL-Server}]'

# 2. SSH 连接到实例
ssh -i your-key.pem ec2-user@ec2-xx-xx-xx-xx.compute.amazonaws.com

# 3. 安装 PostgreSQL
sudo yum update -y
sudo amazon-linux-extras install postgresql15 -y
sudo yum install postgresql-server postgresql-contrib -y

# 4. 初始化数据库
sudo postgresql-setup initdb

# 5. 启动服务
sudo systemctl start postgresql
sudo systemctl enable postgresql

# 6. 创建数据库和用户
sudo -u postgres psql
CREATE DATABASE awareness_market;
CREATE USER awareness_user WITH ENCRYPTED PASSWORD 'YOUR_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE awareness_market TO awareness_user;
\q

# 7. 配置远程访问
sudo vi /var/lib/pgsql/data/postgresql.conf
# 修改: listen_addresses = '*'

sudo vi /var/lib/pgsql/data/pg_hba.conf
# 添加: host all all 0.0.0.0/0 md5

sudo systemctl restart postgresql
```

### DATABASE_URL 格式

```bash
DATABASE_URL=postgresql://awareness_user:YOUR_PASSWORD@ec2-xx-xx-xx-xx.compute.amazonaws.com:5432/awareness_market
```

### 成本估算

- t3.medium (2 vCPU, 4 GB): **$0.0416/小时** = ~$30/月
- 100 GB gp3: **$11.50/月**
- **总计**: ~$41.50/月

---

## 使用 AWS Secrets Manager 管理密码

### 创建 Secret

```bash
# 创建数据库凭证
aws secretsmanager create-secret \
  --name awareness-network/database \
  --description "Database credentials for Awareness Network" \
  --secret-string '{
    "username": "postgres",
    "password": "YOUR_STRONG_PASSWORD",
    "host": "awareness-network-db.xxxxxxxxx.us-east-1.rds.amazonaws.com",
    "port": 5432,
    "database": "awareness_market"
  }'
```

### 在代码中读取

**Node.js 示例**:

```typescript
// server/aws-secrets.ts
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

// 使用
const DATABASE_URL = await getDatabaseUrl();
```

**安装 SDK**:
```bash
npm install @aws-sdk/client-secrets-manager
```

**更新 Prisma**:

```typescript
// server/db-workflows.ts
import { getDatabaseUrl } from './aws-secrets';

async function getPrisma(): Promise<PrismaClient> {
  if (!prisma) {
    const databaseUrl = await getDatabaseUrl();
    prisma = new PrismaClient({
      datasources: {
        db: { url: databaseUrl }
      }
    });
  }
  return prisma;
}
```

---

## 使用 AWS Systems Manager Parameter Store

### 创建参数（免费）

```bash
# 创建参数
aws ssm put-parameter \
  --name "/awareness-network/database-url" \
  --value "postgresql://postgres:PASSWORD@host:5432/awareness_market" \
  --type "SecureString" \
  --description "Database connection string"
```

### 读取参数

```typescript
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

const client = new SSMClient({ region: 'us-east-1' });

export async function getDatabaseUrl(): Promise<string> {
  const command = new GetParameterCommand({
    Name: '/awareness-network/database-url',
    WithDecryption: true,
  });

  const response = await client.send(command);
  return response.Parameter!.Value!;
}
```

**安装 SDK**:
```bash
npm install @aws-sdk/client-ssm
```

---

## 部署在 AWS 的完整流程

### 1. 创建 RDS 数据库

```bash
# 使用上述 RDS 创建命令
aws rds create-db-instance ...
```

### 2. 配置安全组

```bash
# 允许应用服务器访问
aws ec2 authorize-security-group-ingress \
  --group-id sg-database \
  --protocol tcp \
  --port 5432 \
  --source-group sg-app-servers
```

### 3. 存储凭证到 Secrets Manager

```bash
aws secretsmanager create-secret \
  --name awareness-network/database \
  --secret-string '{...}'
```

### 4. 更新应用代码

```typescript
// 从 Secrets Manager 读取 DATABASE_URL
const DATABASE_URL = await getDatabaseUrl();
```

### 5. 部署到 AWS

**选项 A: Elastic Beanstalk**
```bash
eb create awareness-network-prod \
  --instance-type t3.medium \
  --envvars DATABASE_URL_SECRET=awareness-network/database
```

**选项 B: ECS Fargate**
```json
{
  "containerDefinitions": [{
    "secrets": [{
      "name": "DATABASE_URL",
      "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789012:secret:awareness-network/database"
    }]
  }]
}
```

**选项 C: EC2 + PM2**
```bash
# 在 EC2 上
export DATABASE_URL=$(aws secretsmanager get-secret-value \
  --secret-id awareness-network/database \
  --query SecretString \
  --output text | jq -r '.url')

npm run start
```

### 6. 运行 Prisma 迁移

```bash
# 本地（通过 VPN/Bastion）
npx prisma migrate deploy

# 或在 CI/CD 中
- name: Run migrations
  run: |
    export DATABASE_URL=$(aws secretsmanager ...)
    npx prisma migrate deploy
```

---

## 网络架构建议

### 生产环境架构

```
┌─────────────────────────────────────────┐
│            Internet                      │
└──────────────┬──────────────────────────┘
               │
        ┌──────▼──────┐
        │  CloudFront │ (CDN)
        └──────┬──────┘
               │
        ┌──────▼──────┐
        │     ALB     │ (Load Balancer)
        └──────┬──────┘
               │
    ┌──────────┴──────────┐
    │   Public Subnet     │
    │  ┌───────────────┐  │
    │  │  EC2/ECS App  │  │
    │  └───────┬───────┘  │
    └──────────┼──────────┘
               │
    ┌──────────┴──────────┐
    │  Private Subnet     │
    │  ┌───────────────┐  │
    │  │  RDS Primary  │  │
    │  └───────────────┘  │
    │  ┌───────────────┐  │
    │  │ RDS Standby   │  │ (Multi-AZ)
    │  └───────────────┘  │
    └─────────────────────┘
```

### 安全最佳实践

1. **数据库在私有子网** - 无公网访问
2. **应用层在公有子网** - 通过 ALB 访问
3. **使用 Bastion Host** - 用于数据库管理
4. **启用 SSL/TLS** - 所有数据库连接
5. **启用加密** - 静态数据和传输中数据
6. **定期备份** - 自动备份 + 手动快照
7. **监控和告警** - CloudWatch + SNS

---

## 故障排查

### 连接失败

```bash
# 测试连接
psql "postgresql://postgres:PASSWORD@your-endpoint.rds.amazonaws.com:5432/awareness_market"

# 如果失败，检查：
1. 安全组规则是否允许您的 IP
2. RDS 实例状态是否为 Available
3. 密码是否正确
4. 数据库名称是否存在
```

### Prisma 连接问题

```typescript
// 启用调试日志
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

// 测试连接
await prisma.$connect();
console.log('Database connected successfully');
```

---

## 成本优化建议

### 开发环境
- 使用 **db.t3.micro**（免费套餐）
- 单 AZ 部署
- 白天工作后停止实例（节省 ~70% 成本）
- 使用 **Aurora Serverless v2**（流量低时自动缩减）

### 生产环境
- 使用 **Reserved Instances**（节省 ~40%）
- 启用 **Storage Auto Scaling**
- 定期清理旧备份
- 使用 **Read Replicas** 分担读取负载
- 考虑 **Savings Plans**（1-3 年承诺）

### 自动化停止/启动脚本

```bash
# Lambda 函数（每晚停止开发数据库）
aws lambda create-function \
  --function-name stop-dev-database \
  --runtime python3.11 \
  --handler lambda_function.lambda_handler \
  --role arn:aws:iam::account-id:role/lambda-rds-role \
  --code S3Bucket=my-bucket,S3Key=lambda.zip \
  --environment Variables={DB_INSTANCE_ID=awareness-network-db-dev}
```

---

## 推荐方案总结

### 小型项目/开发环境
**RDS db.t3.micro (免费套餐)**
- 成本: **免费**（前 12 个月）→ $14/月
- 简单易用，无需管理

### 中型项目/生产环境
**RDS db.t3.medium + Multi-AZ**
- 成本: **~$111/月**
- 高可用性，自动备份

### 大型项目/高并发
**Aurora Serverless v2**
- 成本: **按实际使用**（$43-$300/月）
- 自动扩缩容，极高性能

### 成本敏感型
**EC2 自托管**
- 成本: **~$42/月**
- 需要技术能力，手动管理

---

## 下一步

1. ✅ 选择适合您的方案（推荐 **RDS for PostgreSQL**）
2. ✅ 创建数据库实例
3. ✅ 配置安全组
4. ✅ 获取连接端点
5. ✅ 更新 `.env` 文件的 `DATABASE_URL`
6. ✅ 运行 `npx prisma migrate deploy`

**需要帮助？** 告诉我您选择哪个方案，我可以提供详细的部署脚本！
