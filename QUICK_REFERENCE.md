# 📌 快速参考卡

## 给 Manus 的任务 (5 个)

全部在这个文件: **`MANUS_MANUAL_TASKS.md`**

```
✅ 自动完成  (我做的)
├─ OAuth 路由修复
├─ robotics API_BASE_URL 修复  
├─ vercel.json 更新
├─ .env 更新
├─ 诊断脚本生成
└─ GitHub 推送 (已完成)

❌ 需要手动完成 (Manus 做的)
├─ Task 1: nginx SSL 证书和域名配置 (最重要)
├─ Task 2: EC2 .env 环境变量 (最重要)
├─ Task 3: GitHub OAuth App 回调 URL (重要)
├─ Task 4: Google OAuth App 回调 URL (重要)
└─ Task 5: PM2 集群配置验证 (可选)
```

---

## 给你的 Manus 提示词模板

### 给 Manus 说:

```
我需要你执行 5 个配置任务来完成 OAuth 登录修复。

所有详细的步骤、命令、验证方法都在这个文件:
./MANUS_MANUAL_TASKS.md

请按优先级顺序执行 (前 4 个必须今天完成):

1. Task 1 - nginx SSL 证书更新 (priority: 高)
2. Task 2 - EC2 .env 环境变量 (priority: 高)  
3. Task 3 - GitHub OAuth App 回调 URL (priority: 中)
4. Task 4 - Google OAuth App 回调 URL (priority: 中)
5. Task 5 - PM2 配置验证 (priority: 低, 可明天做)

每个任务都有完整的提示词、命令示例和验证清单。

完成每个任务后，请告诉我:
- 完成时间
- 验证状态 (成功/失败)
- 遇到的任何问题

感谢!
```

---

## 部署现状

| 环节 | 状态 | 时间戳 |
|-----|------|--------|
| 📝 代码修复 | ✅ 完成 | 2026-02-19 |
| 🚀 GitHub 推送 | ✅ 完成 | 2026-02-19 |
| ⚙️ CI/CD 自动部署 | ⏳ 进行中 | - |
| 🔧 手动配置 | ❌ 待开始 | - |
| ✅ 验证测试 | ❌ 待开始 | - |

---

## 自动化脚本 (我完成的)

已创建的验证脚本:

```bash
# 1. 检查 OAuth 配置
./scripts/verify-oauth-config.ps1 (Windows)
./scripts/verify-oauth-config.sh (Linux/Mac)

# 2. 检查 GitHub 环境变量
./scripts/verify-github-env.sh

# 3. 部署后完整验证
./scripts/verify-oauth-deployment.sh
```

---

## 关键文档

| 文档 | 用途 | 受众 |
|------|------|------|
| **MANUS_MANUAL_TASKS.md** | 所有手动任务的详细步骤 | Manus |
| **FINAL_FIX_DEPLOYMENT_GUIDE.md** | 部署和测试指南 | 所有人 |
| **DEPLOYMENT_DASHBOARD.md** | 实时部署进度 | 所有人 |
| **SYSTEM_DIAGNOSIS_REPORT.md** | 技术诊断报告 | 开发人员 |
| **COMPLETE_DIAGNOSIS_SUMMARY.md** | 完整诊断总结 | 技术负责人 |

---

## 验证检查清单（部署完毕后）

```bash
# 1. 检查后端可访问
curl -I https://api.awareness.market/api-docs/

# 2. 检查 OAuth 路由（应该 400，不是 404）
curl -I "https://api.awareness.market/api/auth/callback/google?code=test"
curl -I "https://api.awareness.market/api/auth/callback/github?code=test"

# 3. 检查前端
curl -I https://awareness.market

# 4. 查看后端日志
ssh ec2-user@api.awareness.market
pm2 logs awareness-api | head -50

# 5. 验证环境变量
grep OAUTH_CALLBACK_URL ~/.env
grep VITE_API_URL ~/.env
```

---

## 预期完成顺序

```
今天必做:
  1. ✅ 代码修复 (已完成)
  2. ⏳ GitHub Actions 自动部署 (等待 5-10 分钟)
  3. ❌ Manus 完成 4 个手动配置任务
  4. ❌ 运行验证脚本
  5. ❌ 生产环境 OAuth 登录测试

明天可以做:
  6. ❌ PM2 集群验证 (Task 5)
  7. ❌ 监控和日志检查
```

---

## 常见问题速查

### Q: GitHub Actions 怎么实时查看?
A: https://github.com/everest-an/Awareness-Market/actions

### Q: 部署失败了怎么办?
A: 查看 Actions 失败的 log，通常是 secrets 配置问题。检查 `production-backend` environment 中所有必要的变量。

### Q: OAuth 仍然返回 404 怎么办?
A: 按顺序检查:
1. nginx 配置已更新 (`sudo nginx -t`)
2. PM2 已重启 (`pm2 restart awareness-api`)
3. 后端代码已更新到最新 commit
4. OAuth app 回调 URL 已在 GitHub/Google 更新

### Q: 怎样完全回滚?
A: 
```bash
git revert ecfa532
git push origin main
# GitHub Actions 会自动部署旧版本
```

---

## 重要提醒

⚠️ **必须完成的任务** (Manus):
- Task 1 & 2: nginx 和 EC2 .env 配置 (否则所有 OAuth 调用都会失败)
- Task 3 & 4: OAuth app 回调 URL (否则授权会失败)

💡 **可以稍后完成**:
- Task 5: PM2 集群配置 (可选优化)

---

## 联系信息

如有问题:
- 查看对应文档
- 查看部署 dashboard: `DEPLOYMENT_DASHBOARD.md`
- 查看诊断报告: `SYSTEM_DIAGNOSIS_REPORT.md`
- 查看手动任务提示词: `MANUS_MANUAL_TASKS.md`

---

**生成时间**: 2026-02-19  
**最后提交**: ecfa532  
**当前状态**: 等待手动配置

