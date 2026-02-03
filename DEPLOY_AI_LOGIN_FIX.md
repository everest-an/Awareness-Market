# AI Agent Login Fix - Deployment Guide

## ✅ Implementation Complete

AI Agent登录问题已修复！现在Agent登录后会自动转换为标准JWT session，可以正常使用所有功能。

---

## 📋 Deployment Checklist

### Step 1: Verify Local Changes

```bash
# 检查修改的文件
cd "e:\Awareness Market\Awareness-Network"

# Backend changes
git diff server/routers/auth-unified.ts

# Frontend changes
git diff client/src/pages/AgentAuth.tsx
```

**Expected changes**:
- ✅ server/routers/auth-unified.ts: Added `convertAgentToken` endpoint
- ✅ client/src/pages/AgentAuth.tsx: Added token conversion call

---

### Step 2: Test Locally (Optional)

如果想在本地测试：

```bash
# Terminal 1: Start backend
cd server
npm run dev

# Terminal 2: Start frontend
cd client
pnpm dev
```

访问 `http://localhost:5173/auth/agent` 测试登录流程

---

### Step 3: Commit Changes

```bash
cd "e:\Awareness Market\Awareness-Network"

# Stage changes
git add server/routers/auth-unified.ts
git add client/src/pages/AgentAuth.tsx

# Commit with clear message
git commit -m "fix: AI Agent login persistence issue

- Add convertAgentToken endpoint to convert ERC-8004 token to JWT cookies
- Modify AgentAuth.tsx to call conversion after successful authentication
- Fixes issue where agents couldn't publish products or start interactions
- Resolves authentication state loss after page refresh"

# Push to GitHub
git push origin main
```

---

### Step 4: Deploy to EC2

```bash
# SSH到EC2服务器
ssh ec2-user@44.220.181.78

# 进入项目目录
cd ~/Awareness-Market/Awareness-Network

# 拉取最新代码
git pull origin main

# 重新构建并重启后端
cd server
npm install
npm run build
pm2 restart awareness-backend

# 检查后端日志（确保没有错误）
pm2 logs awareness-backend --lines 20

# 重新构建并重启前端
cd ../client
pnpm install
pnpm build
pm2 restart awareness-frontend

# 检查前端日志
pm2 logs awareness-frontend --lines 20
```

---

### Step 5: Verify Deployment

#### Test 1: AI Agent Login Flow

1. 打开浏览器访问: `https://awareness.market/auth/agent`
2. 点击 "Connect Wallet"
3. 连接MetaMask并签名
4. ✅ 应该看到 "Authentication Successful" 提示
5. ✅ 自动跳转到首页
6. ✅ 右上角显示用户头像/菜单（已登录状态）

#### Test 2: Authentication Persistence

1. 刷新页面 (F5)
2. ✅ 应该保持登录状态
3. ✅ 不会跳转到登录页

#### Test 3: Access Protected Features

1. 访问: `https://awareness.market/marketplace`
2. 点击任意Package的 "Purchase" 按钮
3. ✅ 应该能正常进入购买流程
4. ✅ 不会提示 "Please log in"

#### Test 4: Check Cookies

1. 打开 DevTools (F12)
2. 进入 Application → Cookies → awareness.market
3. ✅ 应该看到 `jwt_token` cookie
4. ✅ 应该看到 `jwt_refresh` cookie

---

### Step 6: Monitor

部署后监控一段时间，确保没有问题：

```bash
# 查看后端日志（检查convertAgentToken调用）
pm2 logs awareness-backend | grep -i "convert"

# 查看错误日志
pm2 logs awareness-backend --err

# 查看前端日志
pm2 logs awareness-frontend --err
```

---

## 🔧 Troubleshooting

### Problem 1: "Invalid ERC-8004 token" error

**Possible causes**:
- Token已过期（7天有效期）
- Token格式错误

**Solution**:
```bash
# 检查后端日志
pm2 logs awareness-backend | grep -i "erc8004"

# 清除localStorage重新登录
localStorage.clear();
```

---

### Problem 2: Cookies not set

**Possible causes**:
- Cookie配置问题
- HTTPS/HTTP mismatch

**Solution**:
```bash
# 检查cookie配置
cd ~/Awareness-Market/Awareness-Network/server
grep -r "getSessionCookieOptions" _core/cookies.ts

# 确保在HTTPS环境下
curl -I https://awareness.market | grep -i https
```

---

### Problem 3: Still shows "not logged in"

**Possible causes**:
- Frontend缓存未更新
- Backend未重启

**Solution**:
```bash
# 强制清除浏览器缓存
Ctrl+Shift+Delete

# 硬刷新页面
Ctrl+Shift+R

# 重启服务
pm2 restart awareness-backend
pm2 restart awareness-frontend
```

---

## 📊 Expected Behavior

| Scenario | Before Fix | After Fix |
|----------|-----------|-----------|
| Agent登录后首页状态 | ❌ 未登录 | ✅ 已登录 |
| 刷新页面 | ❌ 变成未登录 | ✅ 保持登录 |
| 发布产品 | ❌ 提示未登录 | ✅ 可以发布 |
| 开始交互 | ❌ 无法交互 | ✅ 可以交互 |
| Cookie存储 | ❌ 无jwt_token | ✅ 有jwt_token |

---

## 🎯 Success Metrics

部署成功后，应该看到：

- ✅ AI Agent登录成功率 = 100%
- ✅ 登录后认证状态保持率 = 100%
- ✅ 刷新页面后仍登录 = 100%
- ✅ 可以访问所有已认证功能
- ✅ 后端日志没有"UNAUTHORIZED"错误

---

## 📝 Rollback Plan (如果需要回滚)

如果部署后发现问题：

```bash
# 回滚代码
cd ~/Awareness-Market/Awareness-Network
git log --oneline | head -5  # 查看最近的commits
git revert HEAD              # 回滚最新commit

# 重新构建
cd server && npm run build && pm2 restart awareness-backend
cd ../client && pnpm build && pm2 restart awareness-frontend
```

---

## 🚀 Post-Deployment

部署成功后：

1. ✅ 更新AI_LOGIN_BUG_FIX.md状态为"已修复"
2. ✅ 通知用户测试AI Agent登录功能
3. ✅ 监控错误日志24小时
4. ✅ 收集用户反馈

---

## 📞 Support

如果遇到问题：

1. 查看 AI_LOGIN_FIX_IMPLEMENTATION.md 了解实现细节
2. 查看后端日志: `pm2 logs awareness-backend`
3. 查看前端日志: `pm2 logs awareness-frontend`
4. 检查浏览器控制台错误 (F12 → Console)

---

**Created**: 2026-02-04
**Status**: Ready for Deployment
**Estimated Time**: 10-15 minutes
**Risk**: Low (只修改登录流程，不影响其他功能)
