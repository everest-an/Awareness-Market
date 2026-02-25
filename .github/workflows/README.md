# GitHub Actions 工作流说明

本目录包含 Awareness Market 项目的所有 CI/CD 工作流配置。

## 📋 工作流概览

### 1. `ci-cd-unified.yml` - 统一 CI/CD 流程 ⭐ 推荐

**触发条件**:
- Push 到 `main` 或 `develop` 分支
- Pull Request 到 `main` 或 `develop` 分支  
- 手动触发

**流程**:
```
代码质量检查 → 测试 → 安全检查 → 构建 → 部署（仅 main 分支）
```

**使用场景**: 日常开发、PR 审查、自动部署

---

### 2. `deploy-backend-quick.yml` - 快速部署后端 🚀

**触发条件**: 仅手动触发

**特点**:
- 跳过测试，直接部署
- 适合紧急修复和小型更新

**使用场景**: 紧急生产修复、配置文件更新

---

## 🏗️ 项目架构

### 前端
- 托管: Vercel  
- 自动部署: ✅  
- URL: https://awareness-network-v2.vercel.app/

### 后端  
- 托管: AWS EC2 (34.225.237.85:3001)
- 进程管理: PM2
- API 文档: http://34.225.237.85:3001/api-docs/

---

## 🔧 配置 GitHub Secrets

需要配置: `EC2_SSH_KEY`

---

**最后更新**: 2026-02-02
