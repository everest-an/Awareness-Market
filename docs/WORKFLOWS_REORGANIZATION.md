# GitHub Actions 工作流重组说明

**日期**: 2026-02-02
**目的**: 整理和优化 CI/CD 工作流，适配当前项目架构

---

## 📋 变更概览

### 新增文件

1. **`.github/workflows/ci-cd-unified.yml`** ⭐ 主要工作流
   - 完整的 CI/CD 流程
   - 适配 pnpm + Prisma + EC2 部署
   - 包含测试、构建、部署、健康检查

2. **`.github/workflows/deploy-backend-quick.yml`** 🚀 快速部署
   - 紧急部署专用
   - 跳过测试直接部署
   - 手动触发

3. **`.github/workflows/README.md`** 📖 文档
   - 工作流使用说明
   - 故障排查指南
   - 最佳实践

### 现有文件状态

| 文件 | 状态 | 说明 |
|------|------|------|
| `ci.yml` | ⚠️ 可删除 | 旧版 CI（使用 npm） |
| `ci-cd.yml` | ⚠️ 可删除 | 旧版 CI/CD（使用 npm） |
| `deploy.yml` | ⚠️ 可删除 | 简化部署（配置不完整） |
| `go-services-ci.yml` | ✅ 保留 | Go 服务 CI |
| `python-sdk-ci.yml` | ✅ 保留 | Python SDK CI |

---

## 🎯 新工作流的优势

### 1. 适配当前技术栈

**之前**: 使用 npm，配置不匹配
**现在**: 使用 pnpm + Prisma + PM2

### 2. 完整的 CI/CD 流程

```
┌─────────────┐     ┌─────────┐     ┌──────────┐     ┌────────┐
│ Code Check  │ --> │  Tests  │ --> │  Build   │ --> │ Deploy │
│ ✅ Lint     │     │ ✅ Unit │     │ ✅ FE    │     │ ✅ EC2 │
│ ✅ TypeCheck│     │ ✅ API  │     │ ✅ BE    │     │ ✅ Check│
└─────────────┘     └─────────┘     └──────────┘     └────────┘
```

### 3. 自动回滚机制

部署失败时自动回滚到上一个版本，确保服务稳定。

### 4. 清晰的文档

包含使用说明、故障排查、最佳实践。

---

## 🚀 使用指南

### 日常开发流程

1. **开发功能**
   ```bash
   git checkout -b feature/my-feature
   # 编写代码
   git commit -m "feat: add feature"
   git push origin feature/my-feature
   ```

2. **创建 PR**
   - 自动触发 CI 检查
   - 等待测试通过
   - Code review

3. **合并到 main**
   - 自动部署到生产环境
   - 监控部署状态

### 紧急修复流程

1. **在 main 分支修复**
   ```bash
   git checkout main
   git pull
   # 修复代码
   git commit -m "fix: urgent bug fix"
   git push origin main
   ```

2. **手动触发快速部署**
   - GitHub → Actions
   - 选择 "Quick Deploy Backend"
   - Run workflow

---

## 🔧 GitHub Secrets 配置

### 需要配置的 Secret

```
EC2_SSH_KEY  # EC2 SSH 私钥
```

### 配置步骤

1. GitHub → Settings → Secrets → Actions
2. New repository secret
3. 名称: `EC2_SSH_KEY`
4. 值: 复制 EC2 私钥内容
5. Add secret

---

## 📊 部署架构

```
┌─────────────────────────────────────────────────────┐
│                   GitHub Repository                  │
│                                                       │
│  ┌──────────────────────────────────────────────┐  │
│  │         Push to main branch                   │  │
│  └─────────────────┬────────────────────────────┘  │
└────────────────────┼───────────────────────────────┘
                     │
                     │ Trigger
                     ▼
          ┌──────────────────────┐
          │   GitHub Actions     │
          │                      │
          │  1. Lint & Check     │
          │  2. Run Tests        │
          │  3. Build            │
          │  4. Security Audit   │
          └──────────┬───────────┘
                     │
           ┌─────────┴─────────┐
           │                   │
           ▼                   ▼
    ┌──────────┐        ┌──────────┐
    │  Vercel  │        │ EC2 SSH  │
    │          │        │          │
    │ Frontend │        │ Backend  │
    │   Auto   │        │  Deploy  │
    └──────────┘        └──────────┘
```

### 前端部署

- **平台**: Vercel
- **方式**: Vercel 自动检测 GitHub push
- **URL**: https://awareness-network-v2.vercel.app/
- **环境变量**: 在 Vercel Dashboard 配置

### 后端部署

- **平台**: AWS EC2 (44.220.181.78)
- **方式**: GitHub Actions rsync + PM2
- **API**: http://44.220.181.78:3001/api-docs/
- **进程**: PM2 管理

---

## 🗑️ 清理旧文件（可选）

如果确认新工作流运行正常，可以删除旧文件：

```bash
cd .github/workflows
git rm ci.yml ci-cd.yml deploy.yml
git commit -m "chore: remove deprecated workflow files"
git push origin main
```

**注意**: 建议先观察新工作流运行 1-2 周，确认无问题后再删除。

---

## 📈 监控和维护

### 定期检查

- **每周**: 查看 Actions 运行状态
- **每月**: 检查依赖更新
- **每季度**: 优化工作流性能

### 关键指标

- 部署成功率: 目标 > 95%
- 构建时间: 目标 < 5 分钟
- 测试覆盖率: 目标 > 80%

---

## ❓ 常见问题

### Q: 部署失败怎么办？

A:
1. 查看 GitHub Actions 日志
2. SSH 到 EC2 检查 PM2 日志
3. 手动回滚或使用快速部署

### Q: 如何跳过 CI 直接部署？

A: 使用 "Quick Deploy Backend" 工作流（手动触发）

### Q: 前端如何部署？

A: Vercel 自动部署，无需手动操作。确保在 Vercel Dashboard 配置了 `VITE_API_URL` 环境变量。

### Q: 如何测试工作流？

A:
1. 创建测试分支
2. 推送到 develop 分支（不会部署到生产）
3. 查看 Actions 运行结果

---

## 🎉 总结

### 改进点

✅ 适配当前技术栈（pnpm + Prisma）
✅ 完整的 CI/CD 流程
✅ 自动部署 + 健康检查
✅ 自动回滚机制
✅ 清晰的文档和指南

### 下一步

1. 配置 GitHub Secrets
2. 测试新工作流
3. 观察运行 1-2 周
4. 删除旧工作流文件

---

**文档维护者**: Claude Code Assistant
**最后更新**: 2026-02-02
