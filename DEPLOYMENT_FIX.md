# 🔧 部署问题修复指南

## 问题诊断

之前几百次部署失败的原因是 **GitHub Secrets 未正确配置**。

## 修复步骤

### 1️⃣ 配置 GitHub Secrets

1. 访问: https://github.com/everest-an/Awareness-Market/settings/secrets/actions
2. 点击 **"New repository secret"**
3. 配置以下 Secret:

#### `EC2_SSH_KEY`
- **Name**: `EC2_SSH_KEY`
- **Value**: 你的 EC2 私钥文件完整内容

**获取私钥内容：**
```bash
# 在你本地电脑或 EC2 上运行
cat ~/.ssh/your-ec2-key.pem
```

复制完整输出（包括 `-----BEGIN RSA PRIVATE KEY-----` 和 `-----END RSA PRIVATE KEY-----`）

### 2️⃣ 测试 SSH 连接

配置完成后，测试连接：

1. 访问: https://github.com/everest-an/Awareness-Market/actions
2. 点击左侧 **"Test SSH Connection"**
3. 点击 **"Run workflow"** → **"Run workflow"**
4. 等待运行完成，检查是否所有步骤都是绿色 ✅

### 3️⃣ 确认 EC2 安全组配置

确保你的 EC2 安全组允许 SSH 连接：

1. 访问 AWS Console → EC2 → Security Groups
2. 找到你的 EC2 实例的安全组
3. 确保有以下入站规则：
   - **Type**: SSH
   - **Port**: 22
   - **Source**: `0.0.0.0/0` (或限制为 GitHub Actions IP 范围)

### 4️⃣ 手动触发部署

测试通过后，手动触发一次完整部署：

1. 访问: https://github.com/everest-an/Awareness-Market/actions
2. 点击 **"Deploy Backend to EC2"**
3. 点击 **"Run workflow"** → **"Run workflow"**

## 常见问题

### ❌ "Permission denied (publickey)"
- **原因**: SSH 密钥不匹配或格式错误
- **解决**: 确保复制了正确的私钥，且格式完整

### ❌ "Connection timeout"
- **原因**: EC2 安全组未开放 SSH 或实例未运行
- **解决**: 检查安全组规则和 EC2 实例状态

### ❌ "pnpm: command not found"
- **原因**: EC2 上未安装 pnpm
- **解决**: SSH 到 EC2 运行: `npm install -g pnpm`

### ❌ "pm2: command not found"
- **原因**: EC2 上未安装 PM2
- **解决**: SSH 到 EC2 运行: `npm install -g pm2`

## 自动部署触发条件

配置完成后，以下情况会自动触发部署：

✅ 推送到 `main` 分支且修改了：
- `server/**` (后端代码)
- `client/**` (前端代码)
- `gitbook/**` (文档)
- `package.json` (依赖)
- `prisma/**` (数据库)

## Manus 手动部署（备用方案）

如果 GitHub Actions 仍有问题，你可以继续使用 Manus 手动部署：

```bash
# SSH 到 EC2
ssh -i ~/.ssh/your-key.pem ec2-user@44.220.181.78

# 拉取最新代码
cd /home/ec2-user/Awareness-Market
git pull

# 安装依赖
pnpm install

# 构建
pnpm run copy:docs
pnpm run build

# 重启服务
pm2 restart ecosystem.config.js
```

## 需要帮助？

如果遇到问题，请提供：
1. GitHub Actions 的错误日志
2. EC2 实例的安全组配置截图
3. 测试 SSH 连接的运行结果
