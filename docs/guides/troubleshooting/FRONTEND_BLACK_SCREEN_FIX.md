# 前端黑屏问题 - 完整修复指南

## 📋 问题摘要

**症状**：前端页面完全黑屏，JavaScript 文件无法正常执行

**根本原因**：
1. ❌ HTML 中使用了错误的环境变量语法 `%VITE_ANALYTICS_ENDPOINT%`
2. ❌ Vite 不会替换这种格式的占位符
3. ❌ 导致分析脚本标签损坏，可能影响其他脚本加载

## ✅ 已实施的修复

### 1. 移除 HTML 中的环境变量占位符

**之前** (❌ 错误):
```html
<script src="%VITE_ANALYTICS_ENDPOINT%/umami"></script>
```

**之后** (✅ 正确):
```html
<!-- Analytics script will be loaded dynamically in main.tsx -->
```

### 2. 动态加载分析脚本

创建了 `client/src/utils/analytics.ts` 来动态加载分析脚本。

### 3. 在 main.tsx 中调用

在应用启动后加载分析脚本。

## 🔧 重新构建和部署

```bash
# 1. 清除旧构建
rm -rf dist/public client/.vite

# 2. 重新构建
npm run build

# 3. 部署到服务器
# (按照您的部署流程)
```

## 🔍 验证修复

浏览器 Console 检查：
```javascript
({
  rootExists: !!document.getElementById('root'),
  rootContent: (document.getElementById('root')?.innerHTML || '').length > 0,
  hasReact: typeof window.React !== 'undefined',
  scripts: Array.from(document.querySelectorAll('script[src]')).map(s => s.src)
})
```

期望结果：
- `rootExists`: true
- `rootContent`: > 0
- `hasReact`: true
- `scripts`: 不应包含 `%VITE_` 字符串

---

**修复日期**: 2026-01-29
**文件变更**:
- client/index.html
- client/src/main.tsx
- client/src/utils/analytics.ts (新建)
