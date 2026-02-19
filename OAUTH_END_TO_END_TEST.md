# 🧪 OAuth 端对端测试指南

## ✅ 前置条件检查

所有 Manus 任务已完成:
- ✅ nginx SSL 证书有效（awareness.market 和 api.awareness.market）
- ✅ EC2 .env 环境变量正确配置
- ✅ OAUTH_CALLBACK_URL = https://api.awareness.market
- ✅ GitHub OAuth App 回调 URL = https://api.awareness.market/api/auth/callback/github
- ✅ Google OAuth App 重定向 URI 已配置
- ✅ PM2 2 个 cluster 实例在线
- ✅ 后端 API 可访问 (HTTP/2 200)

---

## 🧪 测试流程

### 第 1 步: 验证后端健康状态

```bash
# 检查后端是否正常响应
curl -i https://api.awareness.market/health

# 预期结果: HTTP/2 200 OK

# 检查 OAuth 路由（应该返回 400 缺少 code，而非 404）
curl -i "https://api.awareness.market/api/auth/callback/google"
# 预期: HTTP/2 400 或 401

curl -i "https://api.awareness.market/api/auth/callback/github"
# 预期: HTTP/2 400 或 401

# 检查 API 文档
curl -i https://api.awareness.market/api-docs/
# 预期: HTTP/2 200
```

---

### 第 2 步: 验证前端构建

```bash
# 检查前端是否正常运行
curl -i https://awareness.market

# 预期结果: HTTP/2 200 OK
# 响应头应该包含: Content-Type: text/html

# 检查前端是否能正确获取 API URL
# 在浏览器 DevTools → Console 中运行:
console.log(import.meta.env.VITE_API_URL)
# 预期输出: https://api.awareness.market
```

---

### 第 3 步: 测试 Google OAuth 登录

⚠️ **使用真实浏览器进行此测试（不能用 curl）**

#### 3.1 打开登录页面

```
访问: https://awareness.market
点击: "Sign in with Google" 按钮
```

#### 3.2 期望流程

```
1. 重定向到 Google 登录页面
   URL 应该长这样:
   https://accounts.google.com/o/oauth2/v2/auth?
     client_id=YOUR_CLIENT_ID
     redirect_uri=https%3A%2F%2Fapi.awareness.market%2Fapi%2Fauth%2Fcallback%2Fgoogle
     response_type=code
     scope=openid%20profile%20email
     
2. 使用 Google 账户登录并授权

3. 重定向回应用
   URL: https://api.awareness.market/api/auth/callback/google?code=XXXX&state=YYYY
   
4. 重定向到前端仪表板
   URL: https://awareness.market/dashboard
   
5. 已登录状态显示（用户名、头像等）
```

#### 3.3 验证登录状态

```javascript
// 在浏览器 DevTools → Application → Cookies 中检查
// 应该看到名为 "session" 或 "Authorization" 的 HTTP-only Cookie

// 在 Console 中验证:
fetch('https://api.awareness.market/api/user', {
  credentials: 'include'
})
.then(r => r.json())
.then(data => console.log('User:', data))

// 预期: 应该返回当前用户信息，而不是 401 Unauthorized
```

---

### 第 4 步: 测试 GitHub OAuth 登录

#### 4.1 登出前面的 Google 登录

```
方式 1: 清除 Cookie
  DevTools → Application → Cookies → 删除 session/Authorization

方式 2: 在后端注销
  curl -X POST https://api.awareness.market/api/auth/logout \
    -H "Cookie: session=YOUR_SESSION_COOKIE" \
    -b "session=YOUR_SESSION_COOKIE"
```

#### 4.2 打开登录页面

```
访问: https://awareness.market
点击: "Sign in with GitHub" 按钮
```

#### 4.3 期望流程

```
1. 重定向到 GitHub 登录页面
   URL 应该长这样:
   https://github.com/login/oauth/authorize?
     client_id=YOUR_CLIENT_ID
     redirect_uri=https%3A%2F%2Fapi.awareness.market%2Fapi%2Fauth%2Fcallback%2Fgithub
     scope=user:email
     
2. 使用 GitHub 账户登录并授权

3. 重定向回应用
   URL: https://api.awareness.market/api/auth/callback/github?code=XXXX&state=YYYY
   
4. 重定向到前端仪表板
   URL: https://awareness.market/dashboard
   
5. 已登录状态显示（用户名、头像等）
```

---

## 🔍 实时日志检查

### 查看后端日志（实时）

```bash
# SSH 连接到 EC2
ssh ec2-user@api.awareness.market

# 查看 PM2 日志
pm2 logs awareness-api

# 查看最近 100 行
pm2 logs awareness-api --lines 100

# 查看特定日期范围的日志
pm2 logs awareness-api | grep "2026-02-19"

# 过滤 OAuth 相关日志
pm2 logs awareness-api | grep -i "oauth\|callback\|auth"
```

### 日志中应该看到

```
[OAuth] Attempting Google OAuth callback
[OAuth] Successfully exchanged code for tokens
[OAuth] Created session for user: xxx@gmail.com
[Session] Set HTTP-only cookie for session

或

[OAuth] Attempting GitHub OAuth callback
[OAuth] Successfully exchanged code for tokens  
[OAuth] Created session for user: github_username
[Session] Set HTTP-only cookie for session
```

---

## ⚠️ 常见问题排查

### 问题 1: "OAuth callback 仍然返回 404"

**原因**: nginx 配置或后端代码未更新

**检查**:
```bash
# 1. 确认 nginx 配置正确
sudo grep -A 5 "api/auth/callback" /etc/nginx/nginx.conf

# 2. 确认后端代码已部署最新版本
pm2 show awareness-api | grep "version\|commit"

# 3. 检查后端是否已重启
pm2 restart awareness-api

# 4. 查看后端日志
pm2 logs awareness-api | grep -i "oauth\|route\|404"
```

### 问题 2: "收到 CORS 错误"

**原因**: 后端 CORS 配置未允许前端域名或请求方法

**检查**:
```bash
# 查看后端 CORS 配置
grep -r "cors\|CORS" server/ | head -20

# 测试 CORS 预检请求
curl -i -X OPTIONS https://api.awareness.market/api/auth/callback/google \
  -H "Origin: https://awareness.market" \
  -H "Access-Control-Request-Method: POST"

# 预期: 应该返回 200 或 204，并包含 Access-Control-Allow-Origin header
```

### 问题 3: "OAuth 凭证被拒绝"

**原因**: OAuth App 的 Client ID/Secret 不匹配或已过期

**检查**:
```bash
# 1. 验证 EC2 .env 中的凭证
grep -E "GOOGLE_CLIENT|GITHUB_CLIENT" ~/.env

# 2. 对比 Google Cloud Console 中的凭证
# 对比 GitHub Settings 中的凭证

# 3. 如果凭证已更改，更新 .env 文件
nano ~/.env
# 修改 GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET/GITHUB_CLIENT_ID/GITHUB_CLIENT_SECRET

# 4. 重启后端
pm2 restart awareness-api
```

### 问题 4: "登录后重定向到错误的 URL"

**原因**: 前端或后端的重定向 URL 配置不正确

**检查**:
```bash
# 1. 检查前端配置
grep -r "VITE_API_URL\|redirect\|dashboard" client/src/ | head -10

# 2. 检查后端重定向逻辑
grep -r "redirect\|dashboard" server/auth-oauth.ts

# 3. 验证环境变量
echo $VITE_API_URL
echo $REDIRECT_URL
```

### 问题 5: "HTTP-only Cookie 未设置"

**原因**: 后端未正确设置 Cookie 或 HTTPS 配置不正确

**检查**:
```bash
# 1. 验证后端使用 HTTPS
curl -i https://api.awareness.market/api-docs/ | grep -i "strict-transport"

# 2. 查看 Set-Cookie 响应头
curl -i "https://api.awareness.market/api/auth/callback/google?code=test" | grep -i "set-cookie"

# 3. 检查后端 Cookie 设置代码
grep -A 10 "res.cookie\|sessionCookie" server/ -r | head -30
```

---

## ✅ 测试成功的验证清单

全部打勾 = OAuth 完全正常：

- [ ] POST to https://api.awareness.market/health → 200
- [ ] POST to https://api.awareness.market/api-docs/ → 200
- [ ] Google OAuth 重定向到 Google 登录页面
- [ ] 授权后重定向回 https://api.awareness.market/api/auth/callback/google?code=XXX
- [ ] 最终重定向到前端仪表板
- [ ] 用户信息正确显示
- [ ] HTTP-only Cookie 已设置
- [ ] GitHub OAuth 流程相同且成功
- [ ] 后端日志显示成功的 OAuth 交换
- [ ] 退出登录后 Cookie 已清除

---

## 🎉 如果所有测试都通过

```
✅ OAuth 登录完全正常工作
✅ 可以进行生产环境测试
✅ 系统已准备好上线

后续任务:
1. 邀请测试用户登录
2. 监控后端日志查找错误
3. 性能和负载测试
4. 完整的端对端功能测试
```

---

## 📞 如果遇到问题

1. 检查 **实时日志** (pm2 logs awareness-api)
2. 查看本文档的 **常见问题排查** 部分
3. 验证 **所有环境变量** 是否正确
4. 确认 **OAuth App 配置** 是否与 EC2 匹配
5. 查看 **浏览器 DevTools** 的 Network/Console 标签中的错误信息

---

**测试时间**: 2026-02-19T00:00:00Z  
**准备状态**: ✅ 所有前置条件满足  
**下一步**: 立即执行端对端测试！
