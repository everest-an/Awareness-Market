# 开源项目安全配置指南

## 📋 目录
1. [核心原则](#核心原则)
2. [环境变量管理](#环境变量管理)
3. [GitHub仓库配置](#github仓库配置)
4. [CI/CD安全](#cicd安全)
5. [生产环境部署](#生产环境部署)
6. [密钥轮换](#密钥轮换)

---

## 🎯 核心原则

### ✅ 已经做对的地方

1. **代码中使用环境变量**
   ```typescript
   // ✅ 正确做法
   const resend = new Resend(process.env.RESEND_API_KEY);
   const jwtSecret = process.env.JWT_SECRET;

   // ❌ 绝对不要这样
   const resend = new Resend('re_N77j99Gs_Przu5TT26gCwo2dH6onBXStF');
   ```

2. **.gitignore 配置正确**
   ```bash
   # ✅ 已经排除
   .env
   .env.local
   .env.*.local
   ```

3. **.env.example 提供模板**
   - ✅ 不包含真实密钥
   - ✅ 使用占位符 `CHANGE_ME`
   - ✅ 包含安全警告和说明

---

## 🔐 环境变量管理

### 文件结构

```
Awareness-Network/
├── .env                    # ❌ 不提交到Git（本地开发用）
├── .env.example           # ✅ 提交到Git（模板文件）
├── .env.production        # ❌ 不提交到Git（生产环境独立管理）
└── .gitignore             # ✅ 确保 .env* 被忽略
```

### .env.example（开源模板）

```bash
# ============================================
# Email Service (Resend)
# ============================================
# 获取密钥: https://resend.com/api-keys
RESEND_API_KEY=re_CHANGE_ME_GET_FROM_RESEND_DASHBOARD
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME=Your App Name

# ============================================
# JWT Authentication
# ============================================
# 生成强密钥: openssl rand -base64 64
JWT_SECRET=CHANGE_ME_USE_openssl_rand_base64_64

# ============================================
# Database
# ============================================
DATABASE_URL=postgresql://user:password@localhost:5432/awareness_dev

# ============================================
# AWS S3
# ============================================
AWS_ACCESS_KEY_ID=CHANGE_ME
AWS_SECRET_ACCESS_KEY=CHANGE_ME
AWS_REGION=us-east-1
S3_BUCKET_NAME=your-bucket-name
```

### 本地开发设置

```bash
# 1. 克隆项目
git clone https://github.com/everest-an/Awareness-Market.git
cd Awareness-Market/Awareness-Network

# 2. 复制环境变量模板
cp .env.example .env

# 3. 编辑 .env 文件，填入真实密钥
nano .env  # 或使用其他编辑器

# 4. 验证 .env 不会被Git追踪
git check-ignore .env
# 输出: .gitignore:11:.env   ✅ 说明已被忽略
```

---

## 🛡️ GitHub仓库配置

### 1. GitHub Secrets（用于CI/CD）

在GitHub仓库设置中添加Secrets：

```
Settings → Secrets and variables → Actions → New repository secret
```

添加以下Secrets：

| Secret名称 | 用途 | 示例值 |
|-----------|------|-------|
| `RESEND_API_KEY` | 邮件服务 | `re_abc123...` |
| `JWT_SECRET` | JWT签名 | `openssl rand -base64 64` 输出 |
| `DATABASE_URL` | 数据库连接 | `postgresql://...` |
| `AWS_ACCESS_KEY_ID` | S3上传 | `AKIA...` |
| `AWS_SECRET_ACCESS_KEY` | S3上传 | `wJal...` |
| `DEPLOYER_PRIVATE_KEY` | 智能合约部署 | `0x123...` |

### 2. Branch Protection Rules

```
Settings → Branches → Add rule
```

配置：
- ✅ Require pull request reviews before merging
- ✅ Require status checks to pass before merging
- ✅ Do not allow bypassing the above settings

### 3. Security Alerts

启用安全功能：
```
Settings → Security → Code security and analysis
```

- ✅ Dependabot alerts
- ✅ Secret scanning alerts
- ✅ Code scanning (CodeQL)

---

## 🚀 CI/CD安全

### GitHub Actions配置

`.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: pnpm install

      - name: Build
        env:
          # ✅ 从GitHub Secrets读取
          RESEND_API_KEY: ${{ secrets.RESEND_API_KEY }}
          JWT_SECRET: ${{ secrets.JWT_SECRET }}
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
        run: pnpm build

      - name: Deploy to EC2
        env:
          SSH_PRIVATE_KEY: ${{ secrets.SSH_PRIVATE_KEY }}
          EC2_HOST: ${{ secrets.EC2_HOST }}
        run: |
          # 部署脚本
          echo "$SSH_PRIVATE_KEY" > private_key.pem
          chmod 600 private_key.pem
          ssh -i private_key.pem ec2-user@$EC2_HOST 'cd ~/app && git pull && pm2 restart all'
```

---

## 🖥️ 生产环境部署

### EC2环境变量管理

**选项1: 使用 .env 文件（推荐）**

```bash
# SSH登录到EC2
ssh ec2-user@your-ec2-ip

# 进入项目目录
cd ~/Awareness-Market/Awareness-Network

# 创建生产环境配置（不在Git仓库中）
nano .env

# 粘贴真实的生产密钥
RESEND_API_KEY=re_your_production_key
JWT_SECRET=your_64_char_production_secret
DATABASE_URL=postgresql://prod:pass@rds.amazonaws.com:5432/awareness_prod
# ... 其他配置

# 保存并退出（Ctrl+O, Enter, Ctrl+X）

# 设置正确的权限
chmod 600 .env
```

**选项2: 使用系统环境变量**

```bash
# 编辑 ~/.bashrc 或 ~/.bash_profile
nano ~/.bashrc

# 添加环境变量
export RESEND_API_KEY="re_your_production_key"
export JWT_SECRET="your_64_char_production_secret"
export DATABASE_URL="postgresql://..."

# 重新加载
source ~/.bashrc
```

**选项3: 使用PM2 Ecosystem文件**

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'awareness-backend',
    script: './dist/server.js',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    env_file: '.env' // PM2会自动加载.env文件
  }]
};
```

### AWS Secrets Manager（企业级方案）

```bash
# 安装AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# 存储密钥
aws secretsmanager create-secret \
  --name awareness/production/resend-api-key \
  --secret-string "re_your_production_key"

# 在应用中读取（Node.js）
const AWS = require('aws-sdk');
const client = new AWS.SecretsManager({ region: 'us-east-1' });

async function getSecret(secretName) {
  const data = await client.getSecretValue({ SecretId: secretName }).promise();
  return JSON.parse(data.SecretString);
}

// 使用
const resendKey = await getSecret('awareness/production/resend-api-key');
```

---

## 🔄 密钥轮换

### 定期轮换密钥（推荐90天）

#### 1. Resend API密钥轮换

```bash
# Step 1: 登录Resend Dashboard
# https://resend.com/api-keys

# Step 2: 创建新密钥
# 点击 "Create API Key"
# 复制新密钥: re_NEW_KEY_123...

# Step 3: 更新EC2环境变量
ssh ec2-user@your-ec2-ip
cd ~/Awareness-Market/Awareness-Network

# 备份旧配置
cp .env .env.backup.$(date +%Y%m%d)

# 更新密钥
nano .env
# 修改: RESEND_API_KEY=re_NEW_KEY_123...

# Step 4: 重启应用
pm2 restart awareness-backend

# Step 5: 测试邮件功能
curl -X POST http://localhost:3001/api/trpc/auth.sendVerificationEmail \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# Step 6: 确认新密钥工作后，删除旧密钥
# 回到Resend Dashboard，删除旧密钥
```

#### 2. JWT密钥轮换

```bash
# 生成新密钥
openssl rand -base64 64

# 重要: JWT密钥轮换会导致所有现有token失效
# 建议在用户活跃度低的时间段进行（如凌晨3点）

# 更新 .env
JWT_SECRET=new_generated_secret_here

# 重启应用
pm2 restart awareness-backend

# 通知用户需要重新登录
```

#### 3. 自动化轮换脚本

```bash
# scripts/rotate-credentials.sh
#!/bin/bash

echo "🔄 Starting credential rotation..."

# 1. 生成新JWT密钥
NEW_JWT_SECRET=$(openssl rand -base64 64)
echo "✅ Generated new JWT secret"

# 2. 备份当前配置
cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
echo "✅ Backed up current .env"

# 3. 更新JWT密钥
sed -i "s/^JWT_SECRET=.*/JWT_SECRET=$NEW_JWT_SECRET/" .env
echo "✅ Updated JWT_SECRET in .env"

# 4. 提示手动更新其他密钥
echo ""
echo "⚠️  Please manually rotate the following:"
echo "   1. RESEND_API_KEY - https://resend.com/api-keys"
echo "   2. AWS credentials - https://console.aws.amazon.com/iam/"
echo "   3. Database password"
echo ""
echo "After updating .env, run: pm2 restart all"
```

---

## 🚨 密钥泄露应急响应

### 如果密钥已经提交到Git

#### 方法1: BFG Repo-Cleaner（推荐）

```bash
# 1. 下载BFG
wget https://repo1.maven.org/maven2/com/madgag/bfg/1.14.0/bfg-1.14.0.jar

# 2. 创建替换规则文件
echo "re_N77j99Gs_Przu5TT26gCwo2dH6onBXStF==>REDACTED" > passwords.txt

# 3. 清理历史
java -jar bfg-1.14.0.jar --replace-text passwords.txt .git

# 4. 清理引用
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# 5. 强制推送（危险操作！）
git push origin --force --all
git push origin --force --tags
```

#### 方法2: git filter-branch

```bash
# 从历史中删除包含密钥的文件
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch EMAIL_VERIFICATION_FIX.md" \
  --prune-empty --tag-name-filter cat -- --all

# 强制推送
git push origin --force --all
```

### 泄露后的检查清单

- [ ] 立即撤销泄露的密钥
- [ ] 生成新密钥
- [ ] 更新所有部署环境
- [ ] 检查访问日志（是否有未授权使用）
- [ ] 通知团队成员
- [ ] 更新CI/CD secrets
- [ ] 清理Git历史
- [ ] 强制推送（如果是私有仓库）
- [ ] 如果是公开仓库，考虑重新创建仓库

---

## ✅ 安全检查清单

### 代码提交前

- [ ] 确认 `.env` 在 `.gitignore` 中
- [ ] 运行 `git status` 确认不包含敏感文件
- [ ] 搜索硬编码密钥: `git grep -i "api.key\|secret\|password" | grep -v ".example"`
- [ ] 检查即将提交的文件: `git diff --cached`

### 开源前

- [ ] 审查所有提交历史
- [ ] 确认 `.env.example` 不包含真实密钥
- [ ] 确认文档中的示例使用占位符
- [ ] 启用GitHub Secret Scanning
- [ ] 配置Branch Protection
- [ ] 添加 SECURITY.md 文件

### 生产部署前

- [ ] 所有密钥已轮换为生产专用
- [ ] 数据库使用强密码
- [ ] EC2安全组限制访问
- [ ] 启用HTTPS
- [ ] 配置WAF（Web Application Firewall）
- [ ] 设置日志监控

---

## 📞 密钥获取指南

### 新贡献者如何获取密钥

**README.md 添加说明**:

```markdown
## 🔧 Development Setup

1. Clone the repository
   ```bash
   git clone https://github.com/everest-an/Awareness-Market.git
   cd Awareness-Market/Awareness-Network
   ```

2. Install dependencies
   ```bash
   pnpm install
   ```

3. Set up environment variables
   ```bash
   cp .env.example .env
   ```

4. Get your API keys:
   - **Resend** (Email): https://resend.com/api-keys
   - **AWS** (Storage): https://console.aws.amazon.com/iam/
   - **JWT Secret**: `openssl rand -base64 64`

5. Update `.env` with your real credentials

6. Run database migrations
   ```bash
   pnpm prisma migrate dev
   ```

7. Start development server
   ```bash
   pnpm dev
   ```
```

---

## 🎓 最佳实践总结

1. **永远不要**在代码中硬编码密钥
2. **永远不要**提交 `.env` 文件到Git
3. **始终**使用 `process.env.VARIABLE_NAME`
4. **始终**提供 `.env.example` 模板
5. **定期**轮换生产环境密钥（90天）
6. **使用**GitHub Secrets管理CI/CD密钥
7. **启用**GitHub Secret Scanning
8. **分离**开发/测试/生产环境密钥
9. **限制**密钥访问权限（最小权限原则）
10. **监控**异常API使用

---

## 📚 相关资源

- [GitHub Secrets Documentation](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [OWASP Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [12-Factor App: Config](https://12factor.net/config)
- [AWS Secrets Manager](https://aws.amazon.com/secrets-manager/)
- [Resend API Documentation](https://resend.com/docs)

---

**最后更新**: 2026-02-03
**维护者**: Awareness Market Team
