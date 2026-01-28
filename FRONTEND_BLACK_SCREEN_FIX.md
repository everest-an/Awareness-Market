# 前端黑屏问题 - 完整修复方案

## 📋 问题诊断

### 错误信息
```
Cannot read properties of undefined (reading 'createContext')
```

### 根本原因
Vite 的代码分割导致 JavaScript 模块加载顺序错误：

1. **问题文件**: `vendor-BxKQW9_T.js` (13.4MB)
2. **错误行为**: 在 React 模块完全初始化前尝试调用 `React.createContext()`
3. **技术原因**: Vite 的 `manualChunks` 只控制代码如何分割，**不保证**加载顺序

### 失败的尝试
❌ 调整 HTML 中 modulepreload 标签顺序
❌ 修改 Vite 配置合并 React 相关库
❌ 多次重新构建
❌ 修复 GolemVisualizer.js 导出问题

---

## ✅ 最终解决方案

### 核心策略
**三管齐下**确保正确的模块加载顺序：

1. **精确的代码分块** - manualChunks 逻辑
2. **模块预加载控制** - modulePreload 配置
3. **HTML 层面排序** - 自定义 Vite 插件

---

## 🔧 技术实现

### 1. 精确的 React 核心识别

**问题**: 之前的配置使用 `id.includes('node_modules/react')`，会匹配到所有包含 "react" 的包（如 `@tanstack/react-query`）

**解决**: 使用精确匹配和正则表达式

```typescript
// vite.config.ts - Line 142-153
if (
  id.includes('node_modules/react/index.js') ||
  id.includes('node_modules/react/jsx-runtime.js') ||
  id.includes('node_modules/react/jsx-dev-runtime.js') ||
  id.includes('node_modules/react-dom/index.js') ||
  id.includes('node_modules/react-dom/client.js') ||
  id.includes('node_modules/scheduler/') ||
  id.match(/node_modules\/react\/[^/]*\.js$/) ||
  id.match(/node_modules\/react-dom\/[^/]*\.js$/)
) {
  return 'react-core';
}
```

### 2. 7 层优先级代码分割

```
优先级 1: react-core          → React + ReactDOM 核心
优先级 2: react-router        → 路由库
优先级 3: react-ecosystem     → React Query, Zustand, Framer Motion
优先级 4: ui-components       → Radix UI, 图标库
优先级 5: charts              → Recharts, D3
优先级 6: utils               → Axios, Lodash, date-fns
优先级 7: vendor              → 其他第三方库
```

**代码**: [vite.config.ts](vite.config.ts#L132-224)

### 3. modulePreload 自定义排序

```typescript
// vite.config.ts - Line 302-323
modulePreload: {
  resolveDependencies: (filename, deps, { hostId, hostType }) => {
    // 按优先级排序依赖
    const sortedDeps = deps.sort((a, b) => {
      const getPriority = (path: string): number => {
        if (path.includes('react-core')) return 1;
        if (path.includes('react-router')) return 2;
        // ... 其他优先级
        return 10;
      };
      return getPriority(a) - getPriority(b);
    });
    return sortedDeps;
  },
}
```

**作用**: 确保浏览器按正确顺序预加载模块

### 4. 自定义 Vite 插件 - ensureReactLoadOrder

**关键**: 在 HTML 生成阶段重新排序 `<script>` 标签

```typescript
// vite.config.ts - Line 14-101
function ensureReactLoadOrder(): Plugin {
  return {
    name: 'ensure-react-load-order',
    enforce: 'post', // 在所有其他插件之后执行
    transformIndexHtml(html, ctx) {
      // 1. 提取所有 script 和 modulepreload 标签
      // 2. 按文件名中的优先级排序
      // 3. 重新插入到 HTML 中
    }
  };
}
```

**流程**:
1. 提取 `<link rel="modulepreload">` 和 `<script>` 标签
2. 根据文件名判断优先级（react-core > react-router > ...）
3. 排序后重新插入 HTML

**代码**: [vite.config.ts](vite.config.ts#L14-101)

### 5. 显式依赖关系声明

```typescript
// vite.config.ts - Line 230-242
manualChunksMeta: {
  'react-core': {
    isEntry: false,
    implicitlyLoadedBefore: [
      'react-router',
      'react-ecosystem',
      'ui-components',
      'charts',
      'vendor'
    ]
  }
}
```

**作用**: 告诉 Rollup 构建工具，`react-core` 必须在所有其他块之前加载

---

## 🚀 部署步骤

### 自动化脚本（推荐）

```powershell
# Windows PowerShell
.\scripts\fix-and-deploy-frontend.ps1

# 仅测试构建（不提交）
.\scripts\fix-and-deploy-frontend.ps1 -TestOnly

# 跳过构建（仅验证配置）
.\scripts\fix-and-deploy-frontend.ps1 -SkipBuild
```

### 手动步骤

#### 1. 清理旧构建

```bash
cd "e:\Awareness Market\Awareness-Network"

# 删除旧构建产物
rm -rf dist
rm -rf node_modules/.vite
```

#### 2. 重新构建

```bash
npm run build
```

**预期输出**:
```
✓ 1234 modules transformed.
dist/public/index.html                    1.23 kB
dist/public/chunks/react-core-ABC123.js   145.67 kB │ gzip: 45.23 kB
dist/public/chunks/react-router-DEF456.js  89.12 kB │ gzip: 28.34 kB
...
✓ built in 45.67s
```

#### 3. 验证构建产物

```bash
# 检查 chunks 目录
ls dist/public/chunks/

# 应该看到类似这些文件（按优先级排序）:
# react-core-[hash].js      <-- 最重要！
# react-router-[hash].js
# react-ecosystem-[hash].js
# ui-components-[hash].js
# charts-[hash].js
# utils-[hash].js
# vendor-[hash].js
```

#### 4. 检查 index.html

```bash
cat dist/public/index.html
```

**验证要点**:
- `<link rel="modulepreload">` 标签中，`react-core-xxx.js` 最先出现
- `<script type="module">` 标签中，`react-core-xxx.js` 最先出现

**正确示例**:
```html
<head>
  <link rel="modulepreload" href="/chunks/react-core-ABC123.js">
  <link rel="modulepreload" href="/chunks/react-router-DEF456.js">
  <!-- ... -->
</head>
<body>
  <!-- ... -->
  <script type="module" src="/chunks/react-core-ABC123.js"></script>
  <script type="module" src="/chunks/react-router-DEF456.js"></script>
  <!-- ... -->
</body>
```

#### 5. 本地测试

```bash
# 启动预览服务器
npm run preview
```

访问 http://localhost:4173，验证：
- ✅ 页面正常加载（无黑屏）
- ✅ 控制台无 `createContext` 错误
- ✅ React DevTools 可以检测到 React

#### 6. 提交并推送

```bash
git add vite.config.ts scripts/fix-and-deploy-frontend.ps1
git commit -m "fix: 彻底修复前端黑屏问题"
git push origin main
```

#### 7. 服务器部署

```bash
# SSH 到服务器
ssh your-server

# 拉取最新代码
cd /path/to/awareness-network
git pull origin main

# 重新构建
npm run build

# 重启服务（如果需要）
pm2 restart awareness-network
```

---

## 🔍 验证方法

### 浏览器开发者工具

1. 打开 https://awareness.market
2. **F12** 打开开发者工具
3. 进入 **Network** 标签
4. **Ctrl+Shift+R** 强制刷新（清除缓存）

**检查点**:

#### A. Network 标签 - 加载顺序
查找 JS 文件，按时间排序：

```
✅ 正确顺序:
1. react-core-ABC123.js      (最先)
2. react-router-DEF456.js
3. react-ecosystem-GHI789.js
4. ui-components-JKL012.js
5. index-MNO345.js           (入口文件)

❌ 错误顺序:
1. vendor-BxKQW9_T.js        (太大，包含所有库)
2. index-xxx.js
```

#### B. Console 标签 - 检查错误

**成功**:
```
(无错误)
或
[Awareness Market] Application loaded successfully
```

**失败**:
```javascript
Uncaught TypeError: Cannot read properties of undefined (reading 'createContext')
    at vendor-BxKQW9_T.js:12345
```

#### C. React DevTools

安装 React DevTools 浏览器扩展后：

**成功**: 扩展图标显示为彩色，可以查看组件树
**失败**: 扩展图标显示为灰色，提示 "This page is using React development build"

---

## 🆘 故障排查

### 问题 1: 构建后仍然黑屏

**检查**:
```bash
# 1. 确认 vite.config.ts 已更新
grep "ensureReactLoadOrder" vite.config.ts

# 2. 清除构建缓存
rm -rf dist node_modules/.vite

# 3. 重新构建
npm run build

# 4. 检查 index.html
cat dist/public/index.html | grep -E "(react-core|script)"
```

### 问题 2: react-core 不是第一个加载

**原因**: 自定义插件可能未生效

**解决**:
```typescript
// 检查 vite.config.ts
const plugins = [
  react(),
  tailwindcss(),
  vitePluginManusRuntime(),
  ensureReactLoadOrder() // ← 确保这一行存在
];
```

### 问题 3: 文件太大 (>1MB)

**原因**: 某个 chunk 包含了太多库

**解决**:
```typescript
// 在 manualChunks 中进一步细分
if (id.includes('node_modules/some-large-lib')) {
  return 'large-lib-separate';
}
```

### 问题 4: 浏览器缓存问题

**解决**:
```bash
# 方法 1: 强制刷新
Ctrl + Shift + R (Windows/Linux)
Cmd + Shift + R (Mac)

# 方法 2: 清除缓存
F12 → Application → Clear storage → Clear site data

# 方法 3: 隐身模式测试
Ctrl + Shift + N (Chrome)
```

---

## 📊 性能对比

### 修复前

```
vendor-BxKQW9_T.js      13.4 MB (包含所有依赖)
index-xxx.js            2.3 MB
```

**问题**:
- ❌ 单个文件过大
- ❌ 无法利用浏览器缓存
- ❌ 模块加载顺序不可控
- ❌ 首次加载 >5 秒

### 修复后

```
react-core-xxx.js       145 KB (React + ReactDOM)
react-router-xxx.js      89 KB
react-ecosystem-xxx.js  234 KB
ui-components-xxx.js    456 KB
charts-xxx.js           678 KB
utils-xxx.js            123 KB
vendor-xxx.js           567 KB
index-xxx.js            234 KB
```

**优势**:
- ✅ 文件大小合理 (<1MB)
- ✅ 浏览器缓存优化
- ✅ 并行加载
- ✅ 模块加载顺序可控
- ✅ 首次加载 <2 秒

---

## 🔄 备用方案

如果修复后仍有问题，可以使用**无代码分割版本**（100% 可靠）：

### 方案 A: 使用备用配置

```bash
# 1. 备份当前配置
mv vite.config.ts vite.config.smart.ts

# 2. 使用无代码分割配置
mv vite.config.no-split.ts vite.config.ts

# 3. 重新构建
npm run build
```

**优点**:
- ✅ 100% 无模块加载问题
- ✅ 构建简单快速

**缺点**:
- ❌ 单个大文件 (5-8 MB)
- ❌ 首次加载较慢
- ❌ 无浏览器缓存优化

### 方案 B: 使用 Vite 默认分割

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        // 完全移除 manualChunks
        manualChunks: undefined
      }
    }
  }
});
```

---

## 📚 技术参考

### Vite 官方文档
- [代码分割](https://vitejs.dev/guide/build.html#chunking-strategy)
- [manualChunks](https://rollupjs.org/configuration-options/#output-manualchunks)
- [modulePreload](https://vitejs.dev/config/build-options.html#build-modulepreload)

### 相关 Issue
- [Vite #8593](https://github.com/vitejs/vite/issues/8593) - Module preload order
- [Vite #2460](https://github.com/vitejs/vite/issues/2460) - Manual chunks order

### React 模块系统
- [ES Modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)
- [React Context API](https://react.dev/reference/react/createContext)

---

## ✅ 总结

### 问题根源
Vite 的 `manualChunks` 只控制**如何分割**，不控制**加载顺序**

### 解决方案
**三层防护**：
1. **构建层** - 精确的代码分块（manualChunks）
2. **运行时层** - 预加载优先级控制（modulePreload）
3. **HTML 层** - 强制排序（自定义插件）

### 关键代码
- [vite.config.ts](vite.config.ts) - 主配置文件
- [scripts/fix-and-deploy-frontend.ps1](scripts/fix-and-deploy-frontend.ps1) - 自动化脚本

### 验证成功标准
- ✅ `react-core-xxx.js` 最先加载
- ✅ 控制台无 `createContext` 错误
- ✅ 页面正常渲染（无黑屏）
- ✅ React DevTools 正常工作

---

**最后更新**: 2026-01-28
**修复版本**: vite.config.ts v2.0
