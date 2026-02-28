# 🔧 Manus 手动修改任务清单

这份文档包含所有需要手动修改的任务。请分别给 Manus 执行。

---

## 📋 任务 1: 更新 nginx SSL 证书和域名配置

**位置**: EC2 服务器 `/etc/nginx/nginx.conf`  
**严重程度**: 🔴 高  
**影响**: SSL 证书不匹配会导致浏览器警告，API 调用可能失败

**Manus 提示词**:
```
Please perform these nginx configuration updates on EC2 server:

1. SSH into EC2: ssh ec2-user@api.awareness.market

2. Backup current nginx config:
   sudo cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup

3. Replace old domain with new domain throughout nginx.conf:
   sudo sed -i 's/awareness-market\.com/awareness.market/g' /etc/nginx/nginx.conf

4. Verify all instances were replaced:
   sudo grep -n "awareness.market" /etc/nginx/nginx.conf | wc -l
   # Should show multiple matches

5. Check if SSL certificates exist for awareness.market:
   sudo ls -la /etc/letsencrypt/live/awareness.market/

6. If certificates don't exist, renew with Let's Encrypt:
   sudo certbot certonly --standalone -d awareness.market -d www.awareness.market

7. Verify nginx configuration syntax:
   sudo nginx -t
   # Should output: "nginx: configuration file test is successful"

8. Restart nginx:
   sudo systemctl restart nginx

9. Verify nginx is running:
   sudo systemctl status nginx
   # Should show "active (running)"

10. Test HTTPS connection:
    curl -I https://api.awareness.market/api-docs/
    # Should return HTTP/2 200, not redirect or SSL error
```

**验证清单**:
- [ ] nginx 配置文件已备份
- [ ] 所有 `awareness-market.com` 已替换为 `awareness.market`
- [ ] nginx 配置验证通过 (`nginx -t`)
- [ ] nginx 已重启
- [ ] HTTPS 连接可用 (curl 测试成功)

---

## 📋 任务 2: 更新 EC2 .env 环境变量

**位置**: EC2 服务器 `~/.env` 或 `/root/.env`  
**严重程度**: 🔴 高  
**影响**: OAuth 和 API 配置错误会导致登录失败和服务异常

**Manus 提示词**:
```
Please update environment variables on EC2 server:

1. SSH into EC2: ssh ec2-user@api.awareness.market

2. Edit .env file:
   nano ~/.env
   # or
   sudo nano /root/.env

3. Verify/Update these critical variables (search with Ctrl+W):

   ✅ OAUTH_CALLBACK_URL=https://api.awareness.market
      (should NOT be localhost:3000)

   ✅ API_BASE_URL=https://api.awareness.market
      (for robotics internal service routing)

   ✅ BACKEND_URL=https://api.awareness.market
      (fallback for API_BASE_URL)

   ✅ GOOGLE_CLIENT_ID=<should be populated>
      (verify not empty)

   ✅ GOOGLE_CLIENT_SECRET=<should be populated>
      (verify not empty)

   ✅ GITHUB_CLIENT_ID=<should be populated>
      (verify not empty)

   ✅ GITHUB_CLIENT_SECRET=<should be populated>
      (verify not empty)

4. Save file: Ctrl+O, Enter, Ctrl+X

5. Source the environment:
   source ~/.env

6. Verify variables are loaded:
   echo $OAUTH_CALLBACK_URL
   # Should print: https://api.awareness.market

7. Restart PM2 processes:
   pm2 restart awareness-api
   # or all processes
   pm2 restart all

8. Check PM2 logs for errors:
   pm2 logs awareness-api | head -50
   # Look for "OAuth" or "API" error messages

9. Verify backend is running:
   curl -I https://api.awareness.market/api-docs/
   # Should return 200 OK
```

**验证清单**:
- [ ] OAUTH_CALLBACK_URL 已更新为 https://api.awareness.market
- [ ] API_BASE_URL 已设置
- [ ] 所有 OAuth credentials 已填充 (不为空)
- [ ] 环境变量已 source
- [ ] PM2 已重启
- [ ] 后端 API 可访问

---

## 📋 任务 3: 更新 GitHub OAuth App 配置

**位置**: GitHub Settings > Developer Settings > OAuth Apps  
**严重程度**: 🟠 中  
**影响**: GitHub 登录按钮会重定向失败

**Manus 提示词**:
```
Please update GitHub OAuth App configuration:

1. Open: https://github.com/settings/developers (登录 GitHub)

2. In "OAuth Apps" section, find and click on the Awareness Market OAuth app

3. Locate "Authorization callback URL" field

4. Update the value from:
   ❌ http://localhost:3000/api/auth/callback/github
   OR any old domain
   
   TO:
   ✅ https://api.awareness.market/api/auth/callback/github

5. Click "Update Application"

6. Verify the change was saved (page should show the new URL)

7. Test callback URL:
   curl -I "https://api.awareness.market/api/auth/callback/github?code=test&state=test"
   # Should return 400 Bad Request, NOT 404
```

**验证清单**:
- [ ] GitHub OAuth App callback URL 已更新到 https://api.awareness.market/api/auth/callback/github
- [ ] 更改已保存
- [ ] curl 测试返回 400 (not 404)

---

## 📋 任务 4: 更新 Google OAuth App 配置

**位置**: Google Cloud Console > APIs & Services > Credentials  
**严重程度**: 🟠 中  
**影响**: Google 登录按钮会重定向失败

**Manus 提示词**:
```
Please update Google OAuth App configuration:

1. Open: https://console.cloud.google.com/apis/credentials
   (Make sure you're logged into the correct Google account)

2. Click on the OAuth 2.0 Client ID for "Awareness Market" (or similar name)
   (Look for type "Web application")

3. In the details panel, find "Authorized redirect URIs" section

4. Remove old URIs (if they exist):
   - http://localhost:3000/api/auth/callback/google
   - http://44.220.181.78:3001/api/auth/callback/google
   - http://awareness-network-v2.vercel.app/api/auth/callback/google
   - Any other old domains

5. Add new URI:
   ✅ https://api.awareness.market/api/auth/callback/google

6. Make sure you also have:
   ✅ https://awareness.market/api/auth/callback/google
   (frontend domain, in case OAuth is called from frontend)

7. Click "Save" button

8. Verify the changes were saved (refresh page if needed)

9. Test callback URL:
   curl -I "https://api.awareness.market/api/auth/callback/google?code=test&state=test"
   # Should return 400 Bad Request, NOT 404
```

**验证清单**:
- [ ] 旧的回调 URIs 已删除
- [ ] https://api.awareness.market/api/auth/callback/google 已添加
- [ ] https://awareness.market/api/auth/callback/google 已添加 (可选)
- [ ] 更改已保存
- [ ] curl 测试返回 400 (not 404)

---

## 📋 任务 5: PM2 集群配置验证

**位置**: EC2 服务器 `ecosystem.config.js`  
**严重程度**: 🟡 低  
**影响**: 可能影响负载均衡，但不影响功能

**Manus 提示词**:
```
Please verify PM2 cluster configuration on EC2:

1. SSH into EC2: ssh ec2-user@api.awareness.market

2. Check current PM2 running processes:
   pm2 list

3. Count the "awareness-api" instances:
   pm2 list | grep awareness-api | wc -l

4. Verify nginx upstream configuration matches:
   grep "server localhost" /etc/nginx/nginx.conf

5. If PM2 shows 4 instances (awareness-api-cluster-0 through 3):
   ✅ nginx upstream should have 4 server entries (good)

6. If PM2 shows fewer instances (e.g., 1 or 2):
   Update nginx upstream to match:
   
   For 1 instance:
   upstream awareness_backend {
       server localhost:3001;
   }

   For 2 instances:
   upstream awareness_backend {
       server localhost:3001;
       server localhost:3002;
   }

7. After updating nginx, test:
   sudo nginx -t
   sudo systemctl restart nginx

8. Verify:
   curl -I https://api.awareness.market/api-docs/
```

**验证清单**:
- [ ] PM2 实例数已确认
- [ ] nginx upstream 与 PM2 配置匹配
- [ ] nginx 配置验证通过
- [ ] 后端 API 可访问

---

## 🎯 执行顺序建议

推荐按以下顺序执行 (每个任务独立，可并行):

### 第 1 优先级 (必须，今天完成):
1. **任务 1**: nginx SSL 证书更新
2. **任务 2**: EC2 .env 环境变量更新
3. **任务 3**: GitHub OAuth App 回调 URL
4. **任务 4**: Google OAuth App 回调 URI

### 第 2 优先级 (建议，今天或明天):
5. **任务 5**: PM2 集群配置验证

---

## 📊 完成检查清单

每个任务完成后，请标记:

- [ ] 任务 1: nginx 配置
  - 完成时间: _________
  - 验证状态: 成功 / 失败

- [ ] 任务 2: EC2 .env
  - 完成时间: _________
  - 验证状态: 成功 / 失败

- [ ] 任务 3: GitHub OAuth
  - 完成时间: _________
  - 验证状态: 成功 / 失败

- [ ] 任务 4: Google OAuth
  - 完成时间: _________
  - 验证状态: 成功 / 失败

- [ ] 任务 5: PM2 配置
  - 完成时间: _________
  - 验证状态: 成功 / 失败

---

## 🆘 故障排除

### 如果 nginx -t 报错
```bash
# 查看具体错误
sudo nginx -t -c /etc/nginx/nginx.conf

# 恢复备份
sudo cp /etc/nginx/nginx.conf.backup /etc/nginx/nginx.conf
```

### 如果 PM2 重启失败
```bash
# 查看错误日志
pm2 logs awareness-api

# 查看详细错误
pm2 describe awareness-api

# 强制删除并重启
pm2 kill
pm2 start ecosystem.config.js --env production
```

### 如果 OAuth 仍然返回 404
1. 验证 nginx 配置已更新: `grep "callback" /etc/nginx/nginx.conf`
2. 验证后端代码已部署: `git log --oneline -n 1` (应该显示最新的 commit ecfa532)
3. 重启后端: `pm2 restart awareness-api`
4. 查看日志: `pm2 logs awareness-api | grep -i auth`

---

**文档创建时间**: 2026-02-19  
**代码提交**: ecfa532  
**状态**: 等待手动执行
