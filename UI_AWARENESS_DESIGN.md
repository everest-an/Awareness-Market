# 🎨 高觉察力 UI 设计规范

**版本**: 1.0
**日期**: 2026-02-16
**适用范围**: Awareness Network - Robotics Middleware Dashboard

---

## 📖 设计理念

本文档定义了机器人管理系统前端界面的"高觉察力 UI"设计原则。设计目标是通过**结构、对比度、文字层级和明确的视觉符号**，让用户在**无需额外操作的情况下**立即感知到：

1. **系统状态觉察 (System Status Awareness)** - 系统是否正常运行
2. **行动觉察 (Actionable Awareness)** - 当前应该做什么
3. **资源觉察 (Resource Awareness)** - 可用资源和容量状态

---

## 🎯 核心设计原则

### 原则 1: 摒弃色彩依赖，使用高对比度

**问题**: 传统 Dashboard 依赖颜色传递信息（绿色=好，红色=坏），但色盲用户或黑白打印时信息丢失。

**解决方案**:
- ✅ 使用**黑白灰**单色调
- ✅ 通过**字重对比**（font-weight: 400 vs 700 vs 900）建立层级
- ✅ 通过**边框粗细**（border: 1px vs 2px vs 4px）强调重要性
- ✅ 使用**明确的文字标签** `[状态: 运行正常]` 而非单纯的绿点

**代码示例**:
```tsx
// ❌ 旧版 - 依赖颜色
<span className="text-green-600">●</span> Online

// ✅ 新版 - 高对比度 + 文字明确
<span className="px-3 py-1 text-xs font-black border-2 border-gray-900 bg-gray-100">
  [ONLINE]
</span>
```

---

### 原则 2: 全局觉察条 (Global Awareness Bar)

**位置**: 页面最顶部，横跨全宽

**作用**: 用户打开页面的第一眼就能看到**最关键的 4-6 个系统指标**

**设计规格**:
```tsx
+-----------------------------------------------------------------------------------+
| 系统状态: [运行正常] | 在线机器人: 5 | 活跃任务: 2 | 缓存命中: 87% | 更新: 10:30:00 |
+-----------------------------------------------------------------------------------+
```

**实现要点**:
- 使用 `border-b-2` 与主内容区分离
- 关键数字使用 `text-2xl font-black`
- 状态使用带边框的标签 `border-2 border-gray-900`
- 更新时间放在右侧，字号最小

**代码**:
```tsx
<div className="bg-white border-b-2 border-gray-200 px-6 py-3">
  <div className="max-w-7xl mx-auto flex items-center justify-between">
    <div className="flex items-center gap-6">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-700">系统状态:</span>
        <span className="px-3 py-1 text-xs font-bold uppercase border-2 border-gray-900 bg-gray-100">
          [运行正常]
        </span>
      </div>
      {/* ... 其他指标 */}
    </div>
    <div className="text-xs text-gray-500">
      最后更新: {lastUpdate.toLocaleTimeString()}
    </div>
  </div>
</div>
```

---

### 原则 3: 显性觉察引导 (Empty State Hero)

**场景**: 用户首次登录，还未连接任何机器人

**问题**: 传统设计显示空白图表和"暂无数据"，用户迷茫

**解决方案**: 将"下一步行动"作为**页面视觉焦点**

**设计规格**:
```
+---------------------------------------------------------------+
| [大图标]                                                      |
|                                                               |
| ████████████ 系统就绪，等待机器人连接 ████████████          |
|                                                               |
| 您尚未连接任何机器人。为了开始使用，请立即执行以下操作：     |
|                                                               |
|     ███████████████████████████████████████                   |
|     █  ▶ 连接我的第一台机器人           █                   | <- 最重按钮
|     ███████████████████████████████████████                   |
|                                                               |
|     [ 查看快速入门指南 → ]                                   |
|                                                               |
| 💡 提示: 您可以连接宇树 Go2、Boston Dynamics Spot 等         |
+---------------------------------------------------------------+
```

**实现要点**:
- 使用 `border-4 border-gray-900` 创建最强视觉边界
- 主按钮使用 `bg-gray-900 text-white py-4 px-6 text-lg font-bold`
- 次要按钮使用 `border-2 border-gray-300`
- 仅在 `robots.length === 0` 时显示

**代码**:
```tsx
{!loading && robots.length === 0 && (
  <div className="mb-6 bg-white border-4 border-gray-900 rounded-lg p-8">
    <div className="max-w-2xl mx-auto text-center">
      {/* 大图标 */}
      <div className="inline-block p-4 bg-gray-100 rounded-full mb-4">
        <svg className="w-16 h-16 text-gray-900" {...iconProps}>
          {/* SVG path */}
        </svg>
      </div>

      {/* 标题 */}
      <h2 className="text-2xl font-black text-gray-900 mb-3">
        系统就绪，等待机器人连接
      </h2>

      {/* 说明文字 */}
      <p className="text-gray-600 mb-6 text-lg">
        您尚未连接任何机器人。为了开始使用...
      </p>

      {/* 主要行动按钮 */}
      <button type="button" className="w-full bg-gray-900 text-white py-4 px-6 text-lg font-bold hover:bg-gray-800">
        ▶ 连接我的第一台机器人
      </button>

      {/* 次要行动 */}
      <button type="button" className="w-full bg-white text-gray-900 py-3 px-6 text-base font-medium border-2 border-gray-300">
        查看快速入门指南 →
      </button>
    </div>
  </div>
)}
```

---

### 原则 4: 关键指标觉察 (Key Metrics Awareness)

**设计**: 使用卡片网格展示核心指标

**指标选择标准**:
1. **系统健康度** - 整体运行状态
2. **活跃会话数** - 资源使用情况
3. **缓存效率** - 性能指标

**视觉层级**:
```
+---------------------------+
| 系统健康度                |  <- 小字标签
|                           |
|    100  %                 |  <- 超大数字 (text-5xl font-black)
|                           |
| [状态: 优秀]              |  <- 带边框标签
|                           |
| Redis: 2ms                |  <- 详细指标
| PostgreSQL: 5ms           |
+---------------------------+
```

**实现要点**:
- 数字使用 `text-5xl font-black text-gray-900`
- 状态标签使用 `border-2 border-gray-900 bg-gray-100 text-xs font-bold`
- 卡片使用 `border-2 border-gray-300 hover:border-gray-900`

**代码**:
```tsx
<div className="bg-white border-2 border-gray-300 rounded-lg p-6">
  <div className="text-sm text-gray-600 mb-2">系统健康度</div>

  {/* 核心数字 */}
  <div className="flex items-baseline gap-3">
    <div className="text-5xl font-black text-gray-900">100</div>
    <div className="text-xl text-gray-600">%</div>
  </div>

  {/* 状态标签 */}
  <div className="mt-3">
    <span className="px-2 py-1 text-xs font-bold border-2 border-gray-900 bg-gray-100">
      [状态: 优秀]
    </span>
  </div>

  {/* 详细指标 */}
  <div className="mt-4 space-y-1 text-sm text-gray-600">
    <div>Redis: 2ms</div>
    <div>PostgreSQL: 5ms</div>
  </div>
</div>
```

---

### 原则 5: 进度和容量的视觉化

**场景**: 显示"活跃会话数: 150 / 1,000"

**设计**: 使用进度条 + 大数字 + 文字说明

```
活跃会话
   150  个                  <- 超大数字

容量: 150 / 1,000          <- 文字说明
[███████░░░░░░░░░] 15%     <- 进度条
```

**实现**:
```tsx
<div>
  <div className="text-sm text-gray-600 mb-2">活跃会话</div>

  {/* 大数字 */}
  <div className="flex items-baseline gap-3">
    <div className="text-5xl font-black text-gray-900">150</div>
    <div className="text-xl text-gray-600">个</div>
  </div>

  {/* 容量说明 */}
  <div className="text-xs text-gray-500 mt-3">
    容量: 150 / 1,000
  </div>

  {/* 进度条 */}
  <div className="mt-2 bg-gray-200 rounded-full h-2 overflow-hidden">
    <div
      className="bg-gray-900 h-2 rounded-full transition-all"
      style={{ width: '15%' }}
    />
  </div>
</div>
```

---

## 📐 设计规格表

### 字体大小层级

| 用途 | Tailwind Class | 实际大小 | 用例 |
|------|----------------|----------|------|
| 超大核心数字 | `text-5xl font-black` | 48px / 900 | 指标数值 |
| 大标题 | `text-2xl font-black` | 24px / 900 | 卡片标题 |
| 标准标题 | `text-xl font-bold` | 20px / 700 | 区域标题 |
| 正文 | `text-base font-medium` | 16px / 500 | 说明文字 |
| 小字 | `text-sm text-gray-600` | 14px / 400 | 次要信息 |
| 超小字 | `text-xs text-gray-500` | 12px / 400 | 时间戳、提示 |

### 边框和间距

| 元素 | 边框 | 圆角 | 间距 |
|------|------|------|------|
| 全局觉察条 | `border-b-2` | - | `px-6 py-3` |
| Hero 引导区 | `border-4 border-gray-900` | `rounded-lg` | `p-8` |
| 指标卡片 | `border-2 border-gray-300` | `rounded-lg` | `p-6` |
| 状态标签 | `border-2 border-gray-900` | - | `px-3 py-1` |
| 列表项 | `border-2 border-gray-300` | `rounded-lg` | `p-4` |

### 按钮规格

| 类型 | 样式 | 用例 |
|------|------|------|
| 主要按钮 | `bg-gray-900 text-white py-4 px-6 text-lg font-bold border-4` | 核心行动 |
| 次要按钮 | `bg-white text-gray-900 py-3 px-6 border-2 border-gray-300` | 辅助行动 |
| 小按钮 | `bg-gray-900 text-white py-2 px-4 text-sm font-bold` | 工具栏 |

---

## 🎨 颜色使用规范

虽然我们**摒弃依赖颜色传递核心信息**，但仍需要颜色来提升美观度：

| 颜色 | Tailwind | 用途 | 禁止用途 |
|------|----------|------|----------|
| 深灰/黑 | `gray-900` | 主要文字、关键按钮、状态标签边框 | - |
| 中灰 | `gray-600` | 次要文字 | - |
| 浅灰 | `gray-300` | 边框、分隔线 | - |
| 极浅灰 | `gray-100` | 卡片背景、标签背景 | - |
| 白色 | `white` | 主背景 | - |

**禁止使用**:
- ❌ 红色/绿色/蓝色作为**唯一**的状态指示器
- ❌ 纯色彩编码的图表（除非同时有文字标签）

**允许使用**:
- ✅ 辅助性颜色（如背景渐变、装饰性元素）
- ✅ 带文字标签的彩色状态（如 `[状态: 正常]` + 绿色背景）

---

## 🔧 实现检查清单

升级任何 Dashboard 页面时，请确保：

### A. 全局觉察条
- [ ] 是否在页面顶部添加了全局状态栏？
- [ ] 是否显示了 4-6 个核心系统指标？
- [ ] 是否包含最后更新时间？
- [ ] 数字是否使用 `font-black` 加粗？

### B. 空状态处理
- [ ] 空状态是否有明确的引导文案？
- [ ] 主要行动按钮是否是页面最重的视觉元素？
- [ ] 是否提供了次要行动（如"查看文档"）？
- [ ] 是否有提示信息说明下一步？

### C. 关键指标
- [ ] 核心数字是否使用 `text-5xl font-black`？
- [ ] 是否有明确的文字标签说明状态？
- [ ] 卡片边框是否有悬停效果（hover:border-gray-900）？
- [ ] 是否避免了纯色彩状态指示？

### D. 列表和表格
- [ ] 状态是否使用 `[括号]` 包裹的文字标签？
- [ ] 标题是否使用 `font-bold` 或 `font-black`？
- [ ] 边框是否有清晰的对比度？

### E. 错误和警告
- [ ] 错误消息是否有明确的 `[系统错误]` 标签？
- [ ] 是否提供了重试或解决按钮？
- [ ] 是否使用了粗边框引起注意？

---

## 📊 设计对比示例

### 旧版 vs 新版

#### 示例 1: 系统状态指示

**旧版**:
```tsx
<div className="flex items-center gap-2">
  <span className="w-3 h-3 rounded-full bg-green-500"></span>
  <span className="text-gray-600">System Online</span>
</div>
```
**问题**: 色盲用户无法区分绿点/红点

**新版**:
```tsx
<div className="flex items-center gap-2">
  <span className="text-sm font-medium text-gray-700">系统状态:</span>
  <span className="px-3 py-1 text-xs font-bold border-2 border-gray-900 bg-gray-100">
    [运行正常]
  </span>
</div>
```
**优势**: 即使黑白打印也能清晰阅读

---

#### 示例 2: 空状态页面

**旧版**:
```tsx
<div className="text-center py-20">
  <p className="text-gray-500">暂无数据</p>
</div>
```
**问题**: 用户不知道下一步该做什么

**新版**:
```tsx
<div className="border-4 border-gray-900 rounded-lg p-8">
  <h2 className="text-2xl font-black mb-3">系统就绪，等待机器人连接</h2>
  <p className="text-gray-600 mb-6">您尚未连接任何机器人...</p>
  <button type="button" className="w-full bg-gray-900 text-white py-4 px-6 text-lg font-bold">
    ▶ 连接我的第一台机器人
  </button>
</div>
```
**优势**: 明确的行动引导，用户不会迷茫

---

#### 示例 3: 数值展示

**旧版**:
```tsx
<div>
  <span className="text-sm text-gray-600">在线机器人:</span>
  <span className="ml-2 text-base">5</span>
</div>
```
**问题**: 数字不够突出，难以快速扫视

**新版**:
```tsx
<div className="flex items-baseline gap-2">
  <span className="text-sm text-gray-600">在线机器人:</span>
  <span className="text-2xl font-black text-gray-900">5</span>
</div>
```
**优势**: 核心数据一眼可见

---

## 🚀 下一步行动

1. **立即应用**: 所有新开发的 Dashboard 页面必须遵循本规范
2. **逐步迁移**: 现有页面按优先级逐步升级
3. **用户测试**: 邀请色盲用户测试，确保可访问性
4. **打印测试**: 打印黑白版本，验证信息传达完整性

---

## 📚 参考资源

- [WCAG 2.1 对比度标准](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)
- [高觉察力设计原则 - Awareness Market 内部文档]
- [Tailwind CSS Typography](https://tailwindcss.com/docs/font-weight)

---

**最后更新**: 2026-02-16
**维护者**: Awareness Network Frontend Team
**反馈**: 如有建议请提交 Issue 或联系团队
