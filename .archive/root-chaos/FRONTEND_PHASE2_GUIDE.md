# 🎨 Phase 2 Frontend Integration Guide

**完成时间**: 2026年2月13日
**前端框架**: React + Wouter + Radix UI + TailwindCSS
**API**: tRPC

---

## 📦 新增组件和页面

### 1. MemoryScoreBreakdown 组件
**文件**: `client/src/components/MemoryScoreBreakdown.tsx`

**功能**:
- 显示记忆的总评分和详细分解
- 基础评分（Base Score）展示
- 时间衰减因子（Time Decay）可视化
- 使用频率加成（Usage Boost）显示
- 评分公式展示
- 质量徽章（Platinum/High/Good/Needs Refresh）

**使用示例**:
```tsx
import { MemoryScoreBreakdown } from "@/components/MemoryScoreBreakdown";

<MemoryScoreBreakdown
  score={{
    totalScore: 0.856,
    baseScore: 0.8,
    timeDecay: 0.95,
    usageBoost: 0.096,
    confidence: 0.9,
    usageCount: 12,
    createdAt: new Date("2025-12-01"),
  }}
/>
```

**特性**:
- 响应式进度条显示各评分组件
- Tooltip 提示详细说明
- 实时计算评分百分比
- 颜色编码的质量指标

---

### 2. ConflictResolution 页面
**文件**: `client/src/pages/ConflictResolution.tsx`
**路由**: `/conflicts`

**功能**:
- 冲突列表展示（Pending/Resolved/Ignored）
- 冲突统计卡片
- 冲突详细信息对比
- 冲突解决界面（选择保留的记忆）
- 忽略冲突功能
- 实时状态更新

**API 调用**:
```typescript
// 获取冲突列表
trpc.memory.listConflicts.useQuery({ status: "pending" })

// 获取冲突统计
trpc.memory.getConflictStats.useQuery()

// 解决冲突
trpc.memory.resolveConflict.useMutation()

// 忽略冲突
trpc.memory.ignoreConflict.useMutation()
```

**特性**:
- 分页冲突列表
- 冲突类型标签（Claim Mismatch / Semantic Contradiction）
- 内存对比视图
- 置信度对比
- 解决历史记录

---

### 3. VersionHistoryViewer 组件
**文件**: `client/src/components/VersionHistoryViewer.tsx`

**功能**:
- 版本树可视化（树形结构）
- 线性版本历史时间线
- 版本对比功能
- 版本回滚操作
- 版本详情展示

**使用示例**:
```tsx
import { VersionHistoryViewer } from "@/components/VersionHistoryViewer";

<VersionHistoryViewer memoryId="memory-uuid-123" />
```

**API 调用**:
```typescript
// 获取版本树
trpc.memory.getVersionTree.useQuery({ memory_id: memoryId })

// 获取版本历史（线性）
trpc.memory.getVersionHistory.useQuery({ memory_id: memoryId })

// 对比版本
trpc.memory.compareVersions.useQuery({
  version_id_1: "v1-uuid",
  version_id_2: "v2-uuid",
})

// 回滚版本
trpc.memory.rollbackVersion.useMutation()
```

**特性**:
- 可折叠版本树节点
- 版本差异高亮显示
- 回滚确认对话框
- 版本选择器
- 版本元数据展示

---

### 4. MemoryManagement 页面
**文件**: `client/src/pages/MemoryManagement.tsx`
**路由**: `/memory-management`

**功能**:
- 记忆搜索功能
- 快速统计卡片
- 记忆列表展示
- 评分查看（集成 MemoryScoreBreakdown）
- 版本历史查看（集成 VersionHistoryViewer）
- 快速导航到冲突解决页面

**API 调用**:
```typescript
// 搜索记忆
trpc.memory.search.useQuery({ query: "search term", limit: 20 })

// 获取冲突统计
trpc.memory.getConflictStats.useQuery()
```

**特性**:
- 实时搜索
- 分页加载
- 快速操作按钮
- 统计仪表盘
- 导航链接

---

## 🚀 集成步骤

### 步骤 1: 添加到导航栏

编辑 `client/src/components/Navbar.tsx`，添加新的导航链接：

```tsx
<Link href="/memory-management">
  <Button variant="ghost" className="flex items-center gap-2">
    <Database className="h-4 w-4" />
    Memory
  </Button>
</Link>

<Link href="/conflicts">
  <Button variant="ghost" className="flex items-center gap-2">
    <AlertTriangle className="h-4 w-4" />
    Conflicts
    {conflictCount > 0 && (
      <Badge variant="destructive">{conflictCount}</Badge>
    )}
  </Button>
</Link>
```

### 步骤 2: 在 Dashboard 中添加快捷方式

编辑 `client/src/pages/Dashboard.tsx`，添加新的卡片：

```tsx
<Link href="/memory-management">
  <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <Database className="h-5 w-5" />
        Memory Management
      </CardTitle>
      <CardDescription>
        Manage and analyze your memories
      </CardDescription>
    </CardHeader>
  </Card>
</Link>
```

### 步骤 3: 集成到现有记忆详情页

编辑 `client/src/pages/MemoryNFTDetail.tsx`，添加评分和版本查看器：

```tsx
import { MemoryScoreBreakdown } from "@/components/MemoryScoreBreakdown";
import { VersionHistoryViewer } from "@/components/VersionHistoryViewer";

// 在页面中添加标签页
<Tabs>
  <TabsList>
    <TabsTrigger value="details">Details</TabsTrigger>
    <TabsTrigger value="score">Score Breakdown</TabsTrigger>
    <TabsTrigger value="versions">Version History</TabsTrigger>
  </TabsList>

  <TabsContent value="score">
    <MemoryScoreBreakdown score={memoryScore} />
  </TabsContent>

  <TabsContent value="versions">
    <VersionHistoryViewer memoryId={memory.id} />
  </TabsContent>
</Tabs>
```

---

## 🎯 测试清单

### 功能测试

- [ ] **记忆搜索** - `/memory-management`
  - [ ] 输入搜索词能返回结果
  - [ ] 搜索结果显示正确的记忆信息
  - [ ] 点击"Score"按钮打开评分详情对话框
  - [ ] 点击"Versions"按钮打开版本历史对话框

- [ ] **评分详情**
  - [ ] 总评分正确显示
  - [ ] 基础评分、时间衰减、使用加成都有可视化进度条
  - [ ] Tooltip 提示显示详细说明
  - [ ] 评分公式正确展示
  - [ ] 质量徽章正确显示

- [ ] **冲突管理** - `/conflicts`
  - [ ] 统计卡片显示正确的数字
  - [ ] 三个标签页（Pending/Resolved/Ignored）切换正常
  - [ ] 冲突列表正确展示
  - [ ] 点击"Resolve"打开解决对话框
  - [ ] 选择记忆后能成功解决冲突
  - [ ] 点击"Ignore"能成功忽略冲突
  - [ ] 状态更新后列表自动刷新

- [ ] **版本历史**
  - [ ] 版本树正确显示层级结构
  - [ ] 可以折叠/展开树节点
  - [ ] 线性时间线正确显示版本顺序
  - [ ] 点击版本能选中
  - [ ] "Compare Versions"功能正常
  - [ ] 版本差异高亮显示
  - [ ] 版本回滚功能正常
  - [ ] 回滚后自动刷新版本树

### UI/UX 测试

- [ ] 响应式设计在不同屏幕尺寸下正常
- [ ] 暗色模式下样式正确
- [ ] 加载状态显示正确
- [ ] 错误提示友好
- [ ] Toast 通知正常工作
- [ ] 对话框打开/关闭动画流畅

### 性能测试

- [ ] 大量记忆列表加载流畅
- [ ] 搜索响应速度快
- [ ] 版本树渲染不卡顿
- [ ] 分页加载正常

---

## 🔧 依赖检查

确保以下 UI 组件已安装：

```bash
# 检查 package.json 中是否包含：
- @radix-ui/react-dialog
- @radix-ui/react-alert-dialog
- @radix-ui/react-progress
- @radix-ui/react-scroll-area
- @radix-ui/react-tooltip
- @radix-ui/react-tabs
- @radix-ui/react-separator
- lucide-react
- sonner (toast notifications)
```

如果缺少，运行：
```bash
pnpm add @radix-ui/react-dialog @radix-ui/react-alert-dialog @radix-ui/react-progress
```

---

## 📸 UI 截图说明

### Memory Management 页面
```
┌─────────────────────────────────────────────────┐
│ Memory Management                                │
├─────────────────────────────────────────────────┤
│ [Total Memories] [Pending Conflicts] [Branches] │
├─────────────────────────────────────────────────┤
│ Search: [___________________________] [Clear]    │
├─────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────┐        │
│ │ Memory Item                           │        │
│ │ [text] [namespace]  2025-12-01       │        │
│ │ "Our primary database is..."         │        │
│ │ Confidence: 90% • Used 12 times      │        │
│ │                     [Score] [Versions]│        │
│ └──────────────────────────────────────┘        │
└─────────────────────────────────────────────────┘
```

### Conflict Resolution 页面
```
┌─────────────────────────────────────────────────┐
│ Conflict Resolution                              │
├─────────────────────────────────────────────────┤
│ [Pending: 3] [Resolved: 15] [Ignored: 2]        │
├─────────────────────────────────────────────────┤
│ [Pending] [Resolved] [Ignored]                  │
├─────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────┐        │
│ │ ⚠ Conflict Detected                  │        │
│ │ [claim_mismatch] [pending] 2025-12-01│        │
│ │ ┌────────────┐ ┌────────────┐       │        │
│ │ │ Memory 1   │ │ Memory 2   │       │        │
│ │ │ PostgreSQL │ │ MongoDB    │       │        │
│ │ └────────────┘ └────────────┘       │        │
│ │                  [Ignore] [Resolve] │        │
│ └──────────────────────────────────────┘        │
└─────────────────────────────────────────────────┘
```

### Version History Viewer
```
┌─────────────────────────────────────────────────┐
│ Version History • 3 versions • Depth: 3          │
├─────────────────────────────────────────────────┤
│ Linear Timeline:                                 │
│ ● [v3] Latest - "timeout = 120s" by Bob         │
│ │                                                 │
│ ○ [v2] "timeout = 60s" by Alice                 │
│ │                                                 │
│ ○ [v1] "timeout = 30s" by Alice                 │
├─────────────────────────────────────────────────┤
│ Version Tree:                                    │
│ ▼ v1 "timeout = 30s" (Alice) [Rollback]        │
│   ▼ v2 "timeout = 60s" (Alice) [Rollback]      │
│     • v3 "timeout = 120s" (Bob) [Latest]       │
└─────────────────────────────────────────────────┘
```

---

## 🎉 完成状态

**已完成**:
- ✅ MemoryScoreBreakdown 组件
- ✅ ConflictResolution 页面
- ✅ VersionHistoryViewer 组件
- ✅ MemoryManagement 集成页面
- ✅ App.tsx 路由配置

**待测试**:
- ⏳ 端到端功能测试
- ⏳ UI/UX 测试
- ⏳ 性能测试

**下一步**:
1. 启动开发服务器：`pnpm run dev`
2. 访问 `/memory-management` 测试主页面
3. 访问 `/conflicts` 测试冲突解决功能
4. 在现有记忆详情页集成新组件
5. 根据测试结果优化 UI

---

**总结**: Phase 2 前端所有核心功能已完成，符合 Awareness Network 的设计风格，使用 Radix UI 组件库保持一致性。现在可以进行功能测试和集成！🚀
