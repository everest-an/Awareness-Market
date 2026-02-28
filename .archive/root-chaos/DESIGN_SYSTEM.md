# Awareness Market - 设计系统规范

> iOS风格玻璃态设计系统 | 统一图标与色彩规范

## 📋 概述

本文档定义了Awareness Market的统一设计系统，采用现代iOS风格的玻璃态美学，确保整个应用的视觉一致性和专业性。

---

## 🎨 色彩系统

### 核心色彩（OKLCH颜色空间）

```css
/* 主色调 - Filecoin Blue */
--primary: oklch(0.65 0.20 230);           /* 蓝色主色 */
--primary-foreground: oklch(1 0 0);        /* 白色文本 */

/* 强调色 - Cyan */
--accent: oklch(0.75 0.18 195);            /* 青色强调 */
--accent-foreground: oklch(0.12 0.015 250); /* 深色文本 */

/* 背景色 */
--background: oklch(0.12 0.015 250);       /* 极深蓝灰背景 */
--foreground: oklch(0.95 0 0);             /* 近白色前景 */

/* 卡片与面板 */
--card: oklch(0.16 0.015 250);             /* 比背景稍亮的卡片 */
--muted: oklch(0.25 0.015 250);            /* 柔和背景 */
--muted-foreground: oklch(0.60 0.01 250);  /* 柔和文本 */

/* 边框 */
--border: oklch(1 0 0 / 8%);               /* 微妙的白色边框 */
```

### 数据可视化色彩

**仅在数据可视化组件中使用鲜艳色彩：**

```css
/* 图表配色 - 蓝到青色渐变 */
--chart-1: oklch(0.70 0.18 230);  /* 图表蓝1 */
--chart-2: oklch(0.65 0.20 210);  /* 图表蓝2 */
--chart-3: oklch(0.60 0.18 195);  /* 图表青1 */
--chart-4: oklch(0.75 0.15 180);  /* 图表青2 */
--chart-5: oklch(0.55 0.22 250);  /* 图表紫 */
```

### 状态色彩

```css
--destructive: oklch(0.60 0.22 25);        /* 警告/错误红橙色 */
```

**避免使用的颜色：**
- ❌ 黄色（`yellow-400`）在非可视化场景
- ❌ 紫色（`purple-500`）在非可视化场景
- ❌ 杂乱的彩色组合

**推荐使用：**
- ✅ `text-primary` - 主色文本（链接、高亮）
- ✅ `text-accent` - 强调文本（数值、重要信息）
- ✅ `text-foreground` - 标准文本
- ✅ `text-muted-foreground` - 次要文本
- ✅ `text-destructive` - 警告文本

---

## 🪟 玻璃态系统（Glassmorphism）

### 基础玻璃卡片

```css
.glass-card {
  background-color: oklch(0.16 0.015 250 / 40%);
  backdrop-filter: blur(32px) saturate(180%);
  -webkit-backdrop-filter: blur(32px) saturate(180%);
  border: 1px solid oklch(1 0 0 / 12%);
  border-radius: 0.875rem;
  box-shadow:
    0 1px 2px 0 oklch(0 0 0 / 5%),
    0 0 0 1px oklch(1 0 0 / 3%) inset;
}
```

**使用场景：** 卡片容器、信息面板

### 交互式玻璃卡片

```css
.glass-card-hover {
  /* 基础样式同 .glass-card */
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.glass-card-hover:hover {
  background-color: oklch(0.18 0.015 250 / 55%);
  border-color: oklch(1 0 0 / 18%);
  box-shadow:
    0 4px 12px 0 oklch(0 0 0 / 8%),
    0 0 0 1px oklch(1 0 0 / 5%) inset,
    0 0 24px -8px oklch(0.65 0.20 230 / 12%);
  transform: translateY(-1px);
}
```

**使用场景：** 可点击的列表项、活动卡片

### 玻璃面板

```css
.glass-panel {
  background-color: oklch(0.18 0.015 250 / 50%);
  backdrop-filter: blur(40px) saturate(180%);
  -webkit-backdrop-filter: blur(40px) saturate(180%);
  border: 1px solid oklch(1 0 0 / 15%);
  border-radius: 0.875rem;
  box-shadow:
    0 2px 8px 0 oklch(0 0 0 / 8%),
    0 0 0 1px oklch(1 0 0 / 5%) inset;
}
```

**使用场景：** 统计面板、信息覆盖层（如NetworkBrain的stats和analysis面板）

### 细腻玻璃效果

```css
.glass-subtle {
  background-color: oklch(0.18 0.015 250 / 30%);
  backdrop-filter: blur(20px) saturate(150%);
  -webkit-backdrop-filter: blur(20px) saturate(150%);
  border: 1px solid oklch(1 0 0 / 8%);
  border-radius: 0.625rem;
}
```

**使用场景：** 嵌套组件、小型控件、相机控制说明

### 玻璃遮罩

```css
.glass-overlay {
  background-color: oklch(0.12 0.015 250 / 60%);
  backdrop-filter: blur(48px) saturate(180%);
  -webkit-backdrop-filter: blur(48px) saturate(180%);
}
```

**使用场景：** 模态对话框背景、弹出层遮罩

---

## 🎯 图标系统

### 图标库：lucide-react

**统一使用 `lucide-react` 图标库，禁止使用emoji表情。**

### 图标尺寸规范

```tsx
// 标准尺寸
<Icon className="w-4 h-4" />  // 小型图标（16px）- 内联文本、次要功能
<Icon className="w-5 h-5" />  // 中型图标（20px）- 列表项、卡片标题
<Icon className="w-6 h-6" />  // 大型图标（24px）- 页面标题、主要功能
<Icon className="w-12 h-12" /> // 超大图标（48px）- 空状态、占位符
```

### 常用图标映射

**替换前（Emoji）→ 替换后（Lucide Icon）：**

| 场景 | 旧Emoji | 新图标 | 组件名称 |
|------|---------|--------|----------|
| 大脑/智能 | 🧠 | `<Brain />` | Brain |
| 数据库/存储 | 💾 | `<Database />` | Database |
| 用户加入 | 👋 | `<UserPlus />` | UserPlus |
| 空状态 | 🌌 | `<Activity />` | Activity |
| 活跃节点 | 💙 | `<Circle className="fill-primary" />` | Circle |
| 非活跃节点 | ⚪ | `<Circle className="fill-muted" />` | Circle |
| Hub节点 | 🌟 | `<Star className="fill-accent" />` | Star |
| 连接/共振 | 💜 | `<Zap />` | Zap |
| 警告 | ⚠️ | `<AlertTriangle />` | AlertTriangle |
| 鼠标操作 | 🖱️ | `<MousePointer2 />`, `<Move />`, `<ZoomIn />` | Mouse系列 |
| 新功能 | ✨ | `<Sparkles />` | Sparkles |
| 提示信息 | 💡 | `<Info />` | Info |

### 图标使用示例

```tsx
// ✅ 正确示例
import { Brain, Activity, AlertTriangle } from 'lucide-react';

// 列表项图标
<Brain className="w-5 h-5 text-primary" />

// 空状态图标
<Activity className="w-12 h-12 text-muted-foreground opacity-50" />

// 警告图标
<AlertTriangle className="w-4 h-4 text-destructive" />

// ❌ 错误示例
<div>🧠</div>  // 不要使用emoji
<div>💾</div>  // 不要使用emoji
```

---

## 📐 布局与间距

### 圆角规范

```css
--radius: 0.75rem;        /* 12px - 标准圆角 */
--radius-sm: 0.5rem;      /* 8px  - 小圆角 */
--radius-md: 0.625rem;    /* 10px - 中圆角 */
--radius-lg: 0.875rem;    /* 14px - 大圆角 */
--radius-xl: 1rem;        /* 16px - 超大圆角 */
```

### 间距系统（Tailwind）

```css
gap-1  /* 4px  - 最小间距 */
gap-2  /* 8px  - 紧密间距 */
gap-3  /* 12px - 标准间距 */
gap-4  /* 16px - 宽松间距 */
gap-6  /* 24px - 段落间距 */
```

---

## ✨ 特效系统

### 辉光效果

```css
.glow-primary {
  box-shadow: 0 0 32px -8px oklch(0.65 0.20 230 / 35%);
}

.glow-accent {
  box-shadow: 0 0 32px -8px oklch(0.75 0.18 195 / 35%);
}

.glow-primary-hover:hover {
  box-shadow: 0 0 40px -6px oklch(0.65 0.20 230 / 50%);
}
```

**使用场景：** 突出重要元素、交互反馈

### 渐变文本

```css
.gradient-text {
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
  background-image: linear-gradient(135deg,
    oklch(0.70 0.20 230),
    oklch(0.75 0.18 195)
  );
}
```

**使用场景：** 品牌标题、Hero区域标题

---

## 🚀 组件示例

### ActivityTicker（活动列表）

```tsx
// 玻璃态事件卡片
<div className="glass-card-hover cursor-pointer p-3">
  <div className="flex items-start space-x-3">
    <Brain className="w-5 h-5 text-primary" />
    <div className="flex-1">
      <span className="text-foreground">{agentName}</span>
      <span className="text-muted-foreground">→</span>
      <span className="text-primary">{providerName}</span>
    </div>
  </div>
</div>

// 统计面板
<div className="glass-subtle grid grid-cols-3 gap-3 p-3">
  <div className="text-center">
    <div className="text-lg font-bold text-foreground">{count}</div>
    <div className="text-xs text-muted-foreground">Events</div>
  </div>
</div>
```

### NetworkBrain（3D可视化）

```tsx
// 统计面板
<div className="glass-panel p-4 space-y-3">
  <div className="text-sm font-mono text-foreground">
    <div>Agents: {count}</div>
    <div>FPS: {fps}</div>
  </div>

  <div className="border-t border-border pt-2">
    <div className="flex items-center gap-2">
      <Circle className="w-3 h-3 fill-primary text-primary" />
      <span className="text-xs text-muted-foreground">Active Agent</span>
    </div>
  </div>
</div>

// 低FPS警告
<div className="glass-panel border-l-4 border-l-destructive p-3">
  <AlertTriangle className="w-4 h-4 text-destructive" />
  <span className="text-sm text-destructive-foreground">
    Low FPS detected
  </span>
</div>
```

---

## 🎯 最佳实践

### ✅ DO（推荐做法）

1. **统一使用lucide-react图标**，不使用emoji
2. **应用玻璃态样式**到所有卡片和面板组件
3. **保持色彩克制**，非数据可视化区域使用蓝灰色调
4. **使用语义化颜色变量**：`text-primary`、`text-accent`、`text-muted-foreground`
5. **保持一致的圆角和间距**
6. **使用过渡动画**：`transition-all duration-300 ease`

### ❌ DON'T（避免做法）

1. ❌ 不要在UI中使用emoji表情符号
2. ❌ 不要在非数据可视化场景使用鲜艳色彩
3. ❌ 不要混用不同风格的图标库
4. ❌ 不要使用纯黑/纯白背景（使用半透明玻璃态）
5. ❌ 不要忽略响应式设计和无障碍访问

---

## 📦 已更新组件清单

### 核心组件
- ✅ `client/src/index.css` - 玻璃态样式系统增强
- ✅ `client/src/components/ActivityTicker.tsx` - emoji → 图标，玻璃态卡片
- ✅ `client/src/components/NetworkBrain.tsx` - emoji → 图标，统计面板样式
- ✅ `client/src/pages/HiveMind.tsx` - 相机控制图标化

### 其他页面
- ✅ `client/src/pages/Home.tsx` - "✨ NEW" → `<Sparkles />` + "NEW"
- ✅ `client/src/components/TrialDialog.tsx` - "💡" → `<Info />`
- ✅ `client/src/pages/AiCollaboration/NewSession.tsx` - "💡" → `<Info />`
- ✅ `client/src/pages/PackageDetail.tsx` - emoji标题 → 图标标题
- ✅ `client/src/pages/DeveloperOnboarding.tsx` - "⚠️" → `<AlertTriangle />`

---

## 🔧 技术规格

- **颜色空间**: OKLCH（Chrome 111+）
- **图标库**: lucide-react v0.453.0
- **玻璃态**: `backdrop-filter` + `saturate(180%)`
- **模糊强度**: 20px - 48px（根据层级）
- **不透明度**: 30% - 60%（根据重要性）
- **过渡动画**: `cubic-bezier(0.4, 0, 0.2, 1)`

---

## 📝 维护日志

- **2026-02-07**: 初始设计系统建立
  - 增强玻璃态效果（blur 32px → 40px）
  - 移除所有emoji，统一使用lucide-react
  - 建立色彩规范（仅数据可视化使用鲜艳色）
  - 构建测试通过（42.20s, 3.79MB bundle）

---

**设计原则：** 简洁、专业、性能优先、视觉一致

**Logo保持不变** ✓
