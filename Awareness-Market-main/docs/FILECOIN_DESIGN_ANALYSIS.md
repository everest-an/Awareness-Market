# Filecoin UI Design Style Analysis

## 核心设计特征

### 1. 颜色方案
- **主色调**: 深蓝色 (#0090FF) - Filecoin标志性蓝色
- **辅助色**: 
  - 深色背景: #0D1117 (近黑色)
  - 渐变: 蓝色到青色渐变
  - 强调色: #00D4FF (亮青色)
- **中性色**:
  - 白色文字: #FFFFFF
  - 灰色文字: #8B949E
  - 边框: rgba(255,255,255,0.1)

### 2. 字体
- **主字体**: Inter (现代无衬线字体)
- **标题**: 粗体 (700-800)
- **正文**: 常规 (400)
- **特点**: 清晰、现代、技术感

### 3. 布局特点
- **大量留白**: 宽松的间距
- **全宽Hero区域**: 大标题 + 简洁描述
- **卡片式设计**: 圆角卡片，微妙阴影
- **网格系统**: 3-4列响应式网格

### 4. 视觉元素
- **渐变背景**: 深色到浅色的微妙渐变
- **玻璃态效果**: 半透明卡片，模糊背景
- **动画**: 平滑过渡，悬停效果
- **图标**: 简洁线条图标

### 5. 组件风格
- **按钮**: 
  - 主按钮: 蓝色填充，圆角
  - 次按钮: 透明边框
- **卡片**: 
  - 深色背景
  - 微妙边框
  - 悬停时提升
- **导航**: 
  - 固定顶部
  - 透明/模糊背景

## 应用到LatentMind Marketplace

### 颜色变量更新
```css
:root {
  --primary: oklch(0.65 0.2 230);      /* Filecoin蓝 */
  --primary-foreground: oklch(1 0 0);
  --secondary: oklch(0.15 0.02 250);   /* 深色背景 */
  --accent: oklch(0.75 0.15 195);      /* 青色强调 */
  --background: oklch(0.08 0.02 250);  /* 近黑背景 */
  --foreground: oklch(0.98 0 0);       /* 白色文字 */
  --muted: oklch(0.5 0.02 250);        /* 灰色 */
  --border: oklch(0.25 0.02 250);      /* 边框 */
}
```

### 字体配置
```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

body {
  font-family: 'Inter', system-ui, sans-serif;
}
```

### 关键组件样式
- 大标题: text-5xl font-bold
- 渐变文字: bg-gradient-to-r from-blue-400 to-cyan-400
- 卡片: bg-secondary/50 backdrop-blur border border-white/10
- 按钮: bg-primary hover:bg-primary/90 rounded-lg
