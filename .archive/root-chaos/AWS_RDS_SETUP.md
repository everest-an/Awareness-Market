# AWS RDS 启动和配置指南

## 🌐 当前状态

**数据库**: `awareness-network-db.cezeeou48sif.us-east-1.rds.amazonaws.com:5432`
**状态**: ❌ 无法连接
**可能原因**: RDS 实例已停止或安全组配置问题

---

## 🚀 快速启动步骤

### 方法1: AWS Console（推荐）

#### 1. 登录 AWS RDS Console
```
https://console.aws.amazon.com/rds/home?region=us-east-1
```

#### 2. 查找 RDS 实例
- 在左侧菜单点击 **"Databases"**
- 查找名称包含以下关键字的实例：
  - `awareness-network-db`
  - `awareness`
  - `market`

#### 3. 检查实例状态

**如果状态是 "Stopped"**:
1. 选中该实例
2. 点击 **Actions** → **Start**
3. 等待 2-5 分钟
4. 状态变为 **"Available"** 后继续

**如果状态是 "Available"**:
- 实例已启动，问题可能是安全组配置

#### 4. 配置安全组（允许访问）

**步骤**:
1. 点击 RDS 实例名称查看详情
2. 找到 **"Connectivity & security"** 标签
3. 找到 **"VPC security groups"** 部分
4. 点击安全组名称（例如：`sg-xxxxx`）
5. 在新页面中点击 **"Inbound rules"** 标签
6. 点击 **"Edit inbound rules"**

**添加规则**:
- **Type**: PostgreSQL
- **Protocol**: TCP
- **Port range**: 5432
- **Source**:
  - **开发测试**: `0.0.0.0/0` (任何 IP，不推荐生产环境)
  - **生产环境**: 您的 IP 地址（更安全）

7. 点击 **"Save rules"**

#### 5. 验证连接

回到终端运行：
```bash
cd "e:\Awareness Market\Awareness-Network"
pnpm run memory:check
```

**预期输出**:
```
✅ Connected successfully!
✅ PostgreSQL version: PostgreSQL 16.x
✅ pgvector installed
```

---

### 方法2: AWS CLI（如果已配置）

#### 检查 RDS 实例状态
```bash
aws rds describe-db-instances \
  --region us-east-1 \
  --query 'DBInstances[*].[DBInstanceIdentifier,DBInstanceStatus,Endpoint.Address]' \
  --output table
```

#### 启动 RDS 实例
```bash
aws rds start-db-instance \
  --db-instance-identifier awareness-network-db \
  --region us-east-1
```

#### 等待实例可用
```bash
aws rds wait db-instance-available \
  --db-instance-identifier awareness-network-db \
  --region us-east-1
```

---

## 🔍 故障排查

### 问题1: 找不到 RDS 实例

**可能原因**:
- 实例名称不是 `awareness-network-db`
- 实例在其他 AWS 区域

**解决方法**:
```bash
# 列出所有区域的 RDS 实例
aws rds describe-db-instances \
  --query 'DBInstances[*].[DBInstanceIdentifier,DBInstanceStatus,AvailabilityZone]' \
  --output table
```

### 问题2: 安全组规则添加失败

**可能原因**:
- 没有足够的 IAM 权限
- VPC 配置问题

**解决方法**:
- 联系 AWS 管理员
- 检查 IAM 用户权限（需要 `ec2:AuthorizeSecurityGroupIngress` 权限）

### 问题3: 实例启动后仍无法连接

**检查清单**:
1. ✅ RDS 实例状态为 "Available"
2. ✅ 安全组允许端口 5432 入站流量
3. ✅ `.env` 文件中 `DATABASE_URL` 正确
4. ✅ 本地网络可以访问 AWS（检查 VPN/防火墙）

**测试网络连接**:
```bash
# Windows
Test-NetConnection -ComputerName awareness-network-db.cezeeou48sif.us-east-1.rds.amazonaws.com -Port 5432

# Linux/Mac
nc -zv awareness-network-db.cezeeou48sif.us-east-1.rds.amazonaws.com 5432
```

---

## 💰 成本优化

**注意**: RDS 实例运行时会产生费用

### 开发环境建议
- 开发完成后停止实例：**Actions** → **Stop**
- 或使用 AWS RDS 定时停止功能

### 测试后停止实例
```bash
# AWS CLI
aws rds stop-db-instance \
  --db-instance-identifier awareness-network-db \
  --region us-east-1
```

---

## 📋 配置检查清单

测试前确认：

- [ ] RDS 实例状态为 "Available"
- [ ] 安全组允许端口 5432（来源：您的 IP 或 0.0.0.0/0）
- [ ] `.env` 文件包含正确的 `DATABASE_URL`
- [ ] 本地网络可以访问 AWS（ping 测试）
- [ ] pgvector 扩展已安装（首次运行迁移会自动安装）

---

## 🎯 完成启动后的测试步骤

### 1. 验证连接
```bash
pnpm run memory:check
```

### 2. 运行数据库迁移
```bash
pnpm run memory:migrate
```

### 3. 运行第一阶段测试
```bash
pnpm run memory:test
```

### 4. 运行第二阶段测试
```bash
pnpm run memory:test:phase2
```

---

## 🆘 需要帮助？

### 选项1: 使用本地 Docker 代替
如果 AWS RDS 启动困难，可以快速切换到本地 Docker 测试：

参考：[QUICK_START_TESTING.md](QUICK_START_TESTING.md) - 方案1

### 选项2: 联系 AWS 支持
- AWS Support Center: https://console.aws.amazon.com/support/
- 提供错误信息和实例 ID

---

**总结**: 按照上述步骤启动 AWS RDS 实例并配置安全组后，即可运行完整测试。
