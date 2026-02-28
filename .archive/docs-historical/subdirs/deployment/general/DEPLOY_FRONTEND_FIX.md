# 🚀 前端黑屏修复 - 快速部署指南

## ✅ 已完成的修复

1. **移除损坏的环境变量占位符** (client/index.html)
2. **创建动态分析脚本加载工具** (client/src/utils/analytics.ts)
3. **更新主入口文件** (client/src/main.tsx)
4. **重新构建前端** (dist/public/)

**Git 提交**: `fb750cc`

---

## 📦 部署步骤

### 方法 1: 直接上传构建产物（推荐）

```bash
# 1. 在本地压缩构建产物
cd "e:\Awareness Market\Awareness-Network\dist"
tar -czf public.tar.gz public/

# 2. 上传到服务器
scp public.tar.gz user@awareness.market:/tmp/

# 3. SSH 到服务器
ssh user@awareness.market

# 4. 备份当前版本
sudo su
cd /var/www/
mv html html_backup_$(date +%Y%m%d_%H%M%S)

# 5. 解压新版本
cd /var/www/
tar -xzf /tmp/public.tar.gz
mv public html

# 6. 设置权限
chown -R www-data:www-data html
chmod -R 755 html

# 7. 验证文件
ls -la html/
head -20 html/index.html  # 检查不应该有 %VITE_

# 8. 重启 Nginx
nginx -t && systemctl reload nginx

# 9. 清理
rm /tmp/public.tar.gz
```

---

### 方法 2: Git Pull 并在服务器构建

```bash
# 在服务器上
ssh user@awareness.market
cd /var/www/awareness-network

# 拉取最新代码
git pull origin main

# 安装依赖
npm install

# 构建前端
npm run build

# 移动构建产物
sudo mv /var/www/html /var/www/html_backup_$(date +%Y%m%d_%H%M%S)
sudo cp -r dist/public /var/www/html
sudo chown -R www-data:www-data /var/www/html

# 重启 Nginx
sudo systemctl reload nginx
```

---

## 🔍 部署后验证

### 1. 检查文件内容

```bash
# 在服务器上
grep -i "%VITE_" /var/www/html/index.html
# 应该没有输出

# 检查 HTML 结构
tail -20 /var/www/html/index.html
# 应该看到：
# <!-- Analytics script will be loaded dynamically in main.tsx -->
# <script type="module" crossorigin src="/js/index-ehs4Xjea.js">
```

### 2. 浏览器测试

访问: https://awareness.market/

**开发者工具 Console**:
```javascript
// 运行诊断脚本
({
  rootExists: !!document.getElementById('root'),
  rootHasContent: (document.getElementById('root')?.innerHTML || '').length > 0,
  hasReact: typeof window.React !== 'undefined',
  scriptsLoaded: Array.from(document.querySelectorAll('script[src]')).map(s => ({
    src: s.src,
    loaded: !s.src.includes('%VITE_')
  }))
})
```

**期望输出**:
```json
{
  "rootExists": true,
  "rootHasContent": true,
  "hasReact": true,
  "scriptsLoaded": [
    {
      "src": "https://awareness.market/js/index-ehs4Xjea.js",
      "loaded": true
    }
  ]
}
```

### 3. 检查 Nginx 日志

```bash
sudo tail -f /var/log/nginx/error.log
# 应该没有 404 或 500 错误
```

### 4. 测试页面功能

- [ ] 首页正常显示
- [ ] 可以点击导航
- [ ] 市场页面加载
- [ ] 上传功能可用
- [ ] 控制台无 JavaScript 错误

---

## 🔄 回滚步骤（如果需要）

```bash
# 在服务器上
ssh user@awareness.market
sudo su
cd /var/www/

# 查看可用备份
ls -ld html_backup_*

# 回滚到最新备份
mv html html_broken
mv html_backup_YYYYMMDD_HHMMSS html  # 使用实际的备份目录名

# 重启 Nginx
systemctl reload nginx
```

---

## 📊 性能验证

### Lighthouse 测试

```bash
# 本地运行
npx lighthouse https://awareness.market/ \
  --only-categories=performance \
  --output=html \
  --output-path=./lighthouse-report.html
```

### 加载时间测试

在浏览器 Console 运行：
```javascript
{
  const timing = performance.timing;
  const loadTime = timing.loadEventEnd - timing.navigationStart;
  const domReady = timing.domContentLoadedEventEnd - timing.navigationStart;
  const firstPaint = performance.getEntriesByType('paint')[0]?.startTime || 0;

  console.log({
    总加载时间: loadTime + 'ms',
    DOM就绪: domReady + 'ms',
    首次渲染: Math.round(firstPaint) + 'ms'
  });
}
```

**期望值**:
- 总加载时间: < 5000ms
- DOM 就绪: < 3000ms
- 首次渲染: < 2000ms

---

## 🐛 常见问题

### 问题 1: 仍然看到黑屏

**解决**:
```bash
# 清除浏览器缓存
Ctrl + Shift + Delete

# 或强制刷新
Ctrl + F5

# 检查是否确实部署了新版本
curl -I https://awareness.market/js/index-ehs4Xjea.js
```

### 问题 2: JavaScript 404 错误

**检查**:
```bash
# 在服务器上
ls -la /var/www/html/js/index-*.js

# 应该看到文件存在
```

**修复**:
```bash
# 重新复制构建产物
sudo cp -r /path/to/dist/public/* /var/www/html/
```

### 问题 3: MIME 类型错误

**检查 Nginx 配置**:
```nginx
location ~* \.js$ {
    types { application/javascript js; }
    add_header Content-Type "application/javascript; charset=utf-8";
    add_header Cache-Control "public, max-age=31536000";
}
```

---

## 📝 部署清单

- [ ] 在本地成功构建 (`npm run build`)
- [ ] 验证没有 `%VITE_` 占位符
- [ ] 备份当前服务器版本
- [ ] 上传/部署新构建
- [ ] 设置正确的文件权限
- [ ] 重启 Nginx
- [ ] 浏览器验证（强制刷新）
- [ ] 检查 Console 无错误
- [ ] 测试核心功能
- [ ] 验证性能指标
- [ ] 通知团队部署完成

---

## ⚡ 快速部署脚本

创建 `deploy-frontend.sh`:

```bash
#!/bin/bash
set -e

echo "🚀 开始部署前端修复..."

# 配置
SERVER="user@awareness.market"
REMOTE_PATH="/var/www/"
BUILD_PATH="dist/public"

# 1. 验证构建
echo "📦 验证本地构建..."
if [ ! -d "$BUILD_PATH" ]; then
  echo "❌ 构建目录不存在，请先运行 npm run build"
  exit 1
fi

if grep -r "%VITE_" "$BUILD_PATH/"; then
  echo "❌ 发现未处理的环境变量"
  exit 1
fi

echo "✅ 本地构建验证通过"

# 2. 压缩
echo "📦 压缩构建产物..."
cd dist && tar -czf public.tar.gz public/ && cd ..

# 3. 上传
echo "📤 上传到服务器..."
scp dist/public.tar.gz "$SERVER:/tmp/"

# 4. 部署
echo "🔧 在服务器上部署..."
ssh "$SERVER" bash -s << 'ENDSSH'
  set -e
  sudo su - << 'ENDSUDO'
    cd /var/www/

    # 备份
    if [ -d "html" ]; then
      mv html "html_backup_$(date +%Y%m%d_%H%M%S)"
    fi

    # 解压
    tar -xzf /tmp/public.tar.gz
    mv public html

    # 权限
    chown -R www-data:www-data html
    chmod -R 755 html

    # 验证
    if ! grep -q "Analytics script will be loaded dynamically" html/index.html; then
      echo "❌ 部署验证失败"
      exit 1
    fi

    # 重启
    nginx -t && systemctl reload nginx

    # 清理
    rm /tmp/public.tar.gz

    echo "✅ 部署完成"
ENDSUDO
ENDSSH

echo "🎉 前端修复部署成功！"
echo "🔗 访问: https://awareness.market/"
echo "📊 验证: 打开开发者工具检查 Console"
```

使用方法:
```bash
chmod +x deploy-frontend.sh
./deploy-frontend.sh
```

---

**部署日期**: 2026-01-29
**预期结果**: ✅ 前端黑屏问题完全解决
**验证状态**: ⏳ 等待服务器部署

---

## 📞 支持

如遇问题：
1. 检查 [FRONTEND_BLACK_SCREEN_FIX.md](./FRONTEND_BLACK_SCREEN_FIX.md)
2. 查看 Nginx 错误日志
3. 验证构建产物完整性
4. 回滚到上一个稳定版本
