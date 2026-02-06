# AWS RDS PostgreSQL 设置指南

## 概述

本指南将帮助您在AWS上为Awareness Market创建和配置PostgreSQL数据库。

**预计时间**: 15-20分钟
**成本**: 免费套餐或 ~$15/月起

---

## 步骤1: 创建RDS PostgreSQL实例

### 1.1 登录AWS控制台

访问 [AWS RDS Console](https://console.aws.amazon.com/rds/)

### 1.2 创建数据库

1. 点击 **"Create database"** (创建数据库)

2. **引擎选项**：
   - 选择: **PostgreSQL**
   - 版本: **PostgreSQL 16.1-R3** (或最新稳定版)

3. **模板**：
   - 开发/测试: **Free tier** (免费套餐，如果符合条件)
   - 生产: **Production** (生产环境)

4. **设置**：
   ```
   DB实例标识符: awareness-market-db
   主用户名: postgres (或 admin)
   主密码: [创建强密码，至少16字符]
   确认密码: [重复密码]
   ```

   ⚠️ **重要**: 保存您的密码到安全位置！

5. **实例配置**：

   **免费套餐**:
   ```
   DB实例类: db.t3.micro
   存储类型: gp2 (通用SSD)
   分配的存储: 20 GiB
   ```

   **生产环境（推荐）**:
   ```
   DB实例类: db.t4g.small (或 db.t3.small)
   存储类型: gp3 (最新一代SSD，更好性能)
   分配的存储: 20-100 GiB
   启用存储自动扩展: ✅ 是
   最大存储阈值: 100 GiB
   ```

6. **存储自动扩展** (推荐):
   - ✅ 启用存储自动扩展
   - 最大存储阈值: 100 GiB

7. **可用性和持久性**：

   **开发/测试**:
   - 单可用区 (Single-AZ)

   **生产环境（强烈推荐）**:
   - ✅ **Multi-AZ部署** (多可用区)
   - 自动故障转移
   - 高可用性

8. **连接**：
   ```
   虚拟私有云(VPC): [选择您的VPC，或使用默认]
   公共访问: 是 (开发) / 否 (生产，通过EC2访问)
   VPC安全组: 创建新的 "awareness-market-db-sg"
   可用区: 无首选项
   ```

9. **数据库身份验证**：
   - 选择: **密码身份验证**

10. **其他配置**：
    ```
    初始数据库名称: awareness_market
    数据库端口: 5432 (默认)
    备份保留期: 7天 (生产推荐30天)
    备份时段: 选择业务低峰时段
    加密: ✅ 启用加密
    性能详情: ✅ 启用增强监控
    ```

11. **预估成本**：
    - 查看右侧成本预估
    - 免费套餐: $0 (12个月)
    - db.t3.small: ~$25/月
    - db.t4g.small: ~$20/月 (ARM架构，更便宜)

12. 点击 **"Create database"** (创建数据库)

### 1.3 等待创建完成

- 状态变为 **"Available"** (可用) 需要5-10分钟
- 期间可以继续下一步的EC2设置

---

## 步骤2: 配置安全组

### 2.1 允许EC2访问RDS

1. 进入 **RDS → Databases → awareness-market-db**
2. 点击 **"VPC安全组"** 链接
3. 选择安全组 → **"入站规则"** → **"编辑入站规则"**
4. 添加规则:
   ```
   类型: PostgreSQL
   协议: TCP
   端口: 5432
   源:
     - 生产: [EC2实例的安全组ID]  ✅ 推荐
     - 开发: 您的IP地址/32 (临时，仅测试用)
   描述: Allow EC2 to access PostgreSQL
   ```

### 2.2 测试连接（可选）

如果开启了公共访问，可以从本地测试连接：

```bash
# 安装PostgreSQL客户端
# Windows (使用scoop)
scoop install postgresql

# 测试连接
psql "postgresql://postgres:YOUR_PASSWORD@awareness-db.xxxxx.us-east-1.rds.amazonaws.com:5432/awareness_market"

# 成功会看到:
# awareness_market=>
```

⚠️ **生产环境**: 完成测试后，移除允许公共IP的规则，仅允许EC2安全组访问。

---

## 步骤3: 获取连接信息

### 3.1 查找端点地址

1. **RDS Console** → **Databases** → **awareness-market-db**
2. 找到 **"连接和安全性"** 部分
3. 复制 **"端点"**（类似）:
   ```
   awareness-db.c9akciq32.us-east-1.rds.amazonaws.com
   ```

### 3.2 构建DATABASE_URL

格式:
```bash
DATABASE_URL=postgresql://[用户名]:[密码]@[端点]:[端口]/[数据库名]
```

示例:
```bash
DATABASE_URL=postgresql://postgres:MySecurePass123!@awareness-db.c9akciq32.us-east-1.rds.amazonaws.com:5432/awareness_market
```

⚠️ **注意**:
- 如果密码包含特殊字符（`@`, `:`, `/`等），需要URL编码
- `@` → `%40`
- `:` → `%3A`
- `/` → `%2F`

---

## 步骤4: 配置EC2环境变量

SSH到您的EC2实例:

```bash
ssh -i your-key.pem ubuntu@your-ec2-ip

# 编辑.env文件
cd /var/www/awareness-market
nano .env
```

更新DATABASE_URL:
```bash
# ============================================
# Database - AWS RDS PostgreSQL
# ============================================
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@YOUR_RDS_ENDPOINT:5432/awareness_market
```

保存并退出 (Ctrl+X → Y → Enter)

---

## 步骤5: 运行数据库迁移

在EC2上运行:

```bash
cd /var/www/awareness-market

# 确保依赖已安装
pnpm install

# 运行PostgreSQL migrations
pnpm prisma migrate deploy

# 应该看到:
# ✅ Migrations applied successfully
```

### 故障排查

如果出现 `connection timeout`:
1. 检查安全组规则是否正确
2. 检查EC2是否在RDS的同一VPC内
3. 检查RDS是否为"可用"状态

如果出现 `password authentication failed`:
1. 检查密码是否正确
2. 检查用户名是否正确（postgres或admin）
3. 密码中的特殊字符是否已URL编码

---

## 步骤6: 填充示例数据

```bash
# 运行种子脚本
npx tsx scripts/seed-three-product-lines.ts

# 应该看到:
# ✅ Created 15 vector packages
# ✅ Created 12 memory packages
# ✅ Created 15 chain packages
```

---

## 步骤7: 启动应用

```bash
# 使用PM2启动
pnpm run pm2:start

# 查看日志
pm2 logs awareness-market-api

# 应该看到:
# Connected to PostgreSQL database ✅
```

---

## 性能优化（可选）

### 启用连接池

RDS PostgreSQL默认限制:
- db.t3.micro: 最多87个连接
- db.t3.small: 最多150个连接

如果需要更多连接，使用PgBouncer连接池:

```bash
# 安装PgBouncer在EC2上
sudo apt install pgbouncer

# 配置 /etc/pgbouncer/pgbouncer.ini
[databases]
awareness_market = host=your-rds-endpoint.rds.amazonaws.com port=5432 dbname=awareness_market

[pgbouncer]
listen_port = 6432
listen_addr = 127.0.0.1
auth_type = md5
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 25

# 更新.env使用PgBouncer
DATABASE_URL=postgresql://postgres:password@localhost:6432/awareness_market
```

### 启用性能洞察

1. RDS Console → 您的数据库
2. 修改 → 性能洞察 → 启用
3. 监控慢查询和性能瓶颈

---

## 监控和维护

### CloudWatch监控

AWS自动提供以下指标:
- CPU使用率
- 数据库连接数
- 磁盘I/O
- 网络吞吐量

**查看方式**:
RDS Console → 您的数据库 → Monitoring标签

### 备份验证

定期测试备份恢复:
```bash
# 创建手动快照
RDS Console → 您的数据库 → Actions → Take snapshot

# 从快照恢复（测试环境）
Snapshots → 选择快照 → Restore snapshot
```

### 自动备份

RDS自动备份配置在创建时已设置:
- 每日备份
- 保留7-30天
- 可随时恢复到任意时间点（PITR）

---

## 成本优化

### 免费套餐（12个月）
```
实例: db.t3.micro
存储: 20GB gp2
备份: 20GB
```

### 生产环境预算
```
db.t4g.small: ~$20/月
20GB gp3存储: ~$3/月
备份: ~$2/月
总计: ~$25-30/月
```

### 节省成本技巧
1. 使用**Graviton2**实例 (db.t4g.*)，比x86便宜20%
2. 使用**gp3**替代gp2存储，同性能更便宜
3. 开发环境使用Single-AZ，生产用Multi-AZ
4. 启用**自动停止**（开发环境）

---

## 安全最佳实践

### ✅ 必须做
- ✅ 启用加密
- ✅ 使用强密码（16+字符，包含特殊字符）
- ✅ 限制安全组仅允许EC2访问
- ✅ 启用自动备份
- ✅ 定期更新PostgreSQL版本

### ❌ 不要做
- ❌ 不要在公网暴露RDS（除非临时测试）
- ❌ 不要使用弱密码
- ❌ 不要将DATABASE_URL提交到Git
- ❌ 不要在日志中打印密码

---

## 故障恢复

### 场景1: 数据误删除

```bash
# 1. 立即创建快照
RDS Console → Take snapshot

# 2. 从备份恢复到新实例
Automated backups → 选择时间点 → Restore

# 3. 验证数据
连接新实例，检查数据完整性

# 4. 切换DNS/连接字符串到新实例
```

### 场景2: 性能问题

```bash
# 1. 查看Performance Insights
识别慢查询

# 2. 优化查询或添加索引
CREATE INDEX idx_user_email ON users(email);

# 3. 升级实例类型（如果需要）
Modify → 选择更大实例 → Apply immediately
```

---

## 下一步

1. ✅ RDS PostgreSQL已配置
2. ✅ 应用已连接数据库
3. ✅ 示例数据已填充
4. 继续查看 [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) 完成完整部署

---

## 快速参考

### 连接字符串格式
```bash
postgresql://用户名:密码@端点地址:5432/数据库名
```

### 常用端口
- PostgreSQL: 5432
- PgBouncer: 6432

### 常用命令
```bash
# 测试连接
psql "postgresql://..."

# 查看数据库大小
SELECT pg_size_pretty(pg_database_size('awareness_market'));

# 查看连接数
SELECT count(*) FROM pg_stat_activity;

# 查看慢查询
SELECT * FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;
```

---

**维护者**: Claude Sonnet 4.5
**最后更新**: 2026-01-30
