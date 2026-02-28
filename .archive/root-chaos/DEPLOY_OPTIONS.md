# 🚀 部署方案选择指南

您的系统当前缺少：
- ❌ PostgreSQL
- ❌ Docker

我为您准备了 2 个完整的部署方案，请选择：

---

## 方案 A: 本地全自动安装（推荐 - 30 分钟）

**优点**：
- ✅ 完全本地，无需云服务
- ✅ 零月度成本
- ✅ 一键自动安装

**步骤**：

### 1. 以管理员身份运行 PowerShell

```powershell
# 右键点击 Windows 开始菜单
# 选择 "Windows PowerShell (管理员)" 或 "终端(管理员)"
```

### 2. 运行自动安装脚本

```powershell
cd "e:\Awareness Market\Awareness-Market - MAIN"

# 允许脚本执行
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process

# 运行安装脚本
.\scripts\auto-install-windows.ps1
```

### 3. 等待自动完成

脚本会自动：
1. ✅ 安装 Chocolatey（包管理器）
2. ✅ 安装 PostgreSQL 15
3. ✅ 安装 Docker Desktop
4. ✅ 创建数据库
5. ✅ 安装 pgvector 扩展
6. ✅ 运行数据库迁移
7. ✅ 部署 Infinity Server
8. ✅ 验证所有服务

**预计时间**：30 分钟

**注意**：
- 首次安装 Docker 后需要重启电脑
- 重启后重新运行脚本即可继续

---

## 方案 B: 使用云端服务（快速 - 10 分钟）

**优点**：
- ✅ 无需安装任何软件
- ✅ 快速开始
- ✅ 自动备份

**缺点**：
- ⚠️ 有月度费用（可选免费层）
- ⚠️ 依赖网络连接

### 选项 B1: Supabase（推荐 - 免费）

#### 1. 创建 Supabase 项目

访问：https://supabase.com/dashboard

```bash
1. 注册/登录
2. 点击 "New Project"
3. 填写：
   - Name: awareness-market
   - Database Password: 设置一个强密码
   - Region: 选择最近的区域
4. 等待项目创建（约 2 分钟）
```

#### 2. 安装 pgvector 扩展

```sql
-- 在 Supabase SQL Editor 中运行
CREATE EXTENSION IF NOT EXISTS vector;
```

#### 3. 获取数据库连接字符串

```bash
# 在 Supabase 项目设置中找到 Connection String
# 格式：postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

#### 4. 更新 .env 文件

```bash
# 编辑 .env
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

#### 5. 运行迁移（在您的电脑上）

```bash
# 确保安装了 psql
# 或使用 Supabase SQL Editor 直接粘贴 SQL

# 方法 1: 使用 psql（如果已安装）
psql "postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres" \
  -f prisma/migrations/11_add_package_embeddings.sql

# 方法 2: 手动复制粘贴
# 打开 prisma/migrations/11_add_package_embeddings.sql
# 复制内容到 Supabase SQL Editor
# 点击 Run
```

#### 6. 部署 Infinity Server（仍需 Docker）

**选项 1: 使用 Render（免费层）**

访问：https://render.com

```yaml
# 创建 Web Service
Service Type: Web Service
Runtime: Docker
Docker Image: michaelf34/infinity:latest
Port: 7997
Environment:
  - MODEL_ID=nomic-ai/nomic-embed-text-v1.5
  - BATCH_SIZE=32
  - ENGINE=torch
```

**选项 2: 使用 Railway（免费 $5 额度）**

访问：https://railway.app

```bash
1. 创建新项目
2. 添加服务 → Docker Image
3. Image: michaelf34/infinity:latest
4. 环境变量：
   - MODEL_ID=nomic-ai/nomic-embed-text-v1.5
   - BATCH_SIZE=32
5. 部署并获取 URL
```

**选项 3: 本地 Docker（需要先安装）**

```bash
# 手动安装 Docker Desktop
# https://www.docker.com/products/docker-desktop

# 然后运行：
docker run -d \
  --name infinity-embedding \
  -p 7997:7997 \
  -e MODEL_ID=nomic-ai/nomic-embed-text-v1.5 \
  michaelf34/infinity:latest
```

#### 7. 更新 .env

```bash
# 如果使用 Render/Railway
INFINITY_EMBEDDING_URL=https://your-service-url.onrender.com

# 如果本地 Docker
INFINITY_EMBEDDING_URL=http://localhost:7997
```

**成本**：
- Supabase: 免费（最多 500MB 数据库）
- Render/Railway: 免费层或 $5-10/月

---

### 选项 B2: Neon（PostgreSQL 专用 - 免费）

访问：https://neon.tech

```bash
1. 创建账户
2. 创建项目
3. 启用 pgvector：
   - 在 SQL Editor 运行: CREATE EXTENSION vector;
4. 获取连接字符串
5. 更新 .env
6. 运行迁移（同上）
```

**优点**：
- ✅ 专为 PostgreSQL 优化
- ✅ 免费 0.5GB
- ✅ 自动扩展

---

## 方案对比

| 特性 | 方案 A (本地) | 方案 B (云端) |
|------|--------------|--------------|
| **初始设置** | 30 分钟 | 10 分钟 |
| **月度成本** | $0 | $0-10 |
| **需要安装** | PostgreSQL + Docker | 无 |
| **性能** | 取决于本地硬件 | 稳定 |
| **备份** | 需要手动 | 自动 |
| **可扩展性** | 受限 | 易扩展 |
| **网络要求** | 无 | 必需 |

---

## 📋 推荐选择

### 如果您想：

**快速开始测试** → 选择**方案 B**（Supabase + Render）
- 10 分钟内可用
- 完全免费
- 无需安装

**长期使用，控制成本** → 选择**方案 A**（本地安装）
- 零月度成本
- 完全控制
- 更快的性能

**生产环境** → 选择**方案 B**（Supabase Pro + Railway）
- 自动备份
- 高可用
- 易于扩展

---

## ⚡ 现在就开始

### 方案 A: 本地安装

```powershell
# 以管理员身份运行 PowerShell
cd "e:\Awareness Market\Awareness-Market - MAIN"
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
.\scripts\auto-install-windows.ps1
```

### 方案 B: 云端部署

1. 打开 https://supabase.com/dashboard
2. 创建项目
3. 按照上述步骤配置

---

## ❓ 需要帮助？

**如果遇到问题**：
1. 查看详细日志
2. 检查 QUICK_DEPLOY_CHECKLIST.md
3. 参考 DEPLOYMENT_GUIDE.md

**我可以帮您**：
- 解答任何问题
- 排查错误
- 提供替代方案

---

**更新时间**：2026-02-26
