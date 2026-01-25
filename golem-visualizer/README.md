# Golem Visualizer - Awareness Market 集成

将 Project Golem 的 3D 向量可视化工具独立部署到 Awareness Market 项目中。

## 📂 项目结构

```
golem-visualizer/                 # 独立的可视化工具模块
├── frontend/
│   └── GolemVisualizer.tsx        # React 组件 (350+ 行)
├── backend/
│   ├── golem_backend.py           # Python 后端 (400+ 行)
│   └── requirements.txt           # Python 依赖
├── docs/
│   └── INTEGRATION_GUIDE.md       # 完整集成指南
└── README.md                      # 本文件

client/src/pages/
└── GolemVisualizerPage.tsx        # 完整的页面实现

```

## ✅ 已完成的工作

### 1. **数据库配置修复** ✓
- ✅ 更新 `.env` 为 AWS RDS MySQL 配置
- ✅ drizzle.config.ts 已配置为 MySQL 方言

### 2. **独立的可视化工具模块** ✓
- ✅ React 组件完整实现 (GolemVisualizer.tsx)
  - Three.js 3D 场景
  - 交互式相机控制
  - 点云渲染
  - 点击选择功能
  - 自动旋转
  
- ✅ Python 后端模块 (golem_backend.py)
  - PCA 降维
  - KNN 相似搜索
  - 统计分析
  - Flask REST API
  - JSON 导入/导出

### 3. **完整的页面集成** ✓
- ✅ GolemVisualizerPage.tsx
  - 包市场可视化
  - 实时数据过滤
  - 统计面板
  - 颜色图例
  - 导出功能

### 4. **路由配置** ✓
- ✅ App.tsx 中添加路由
- ✅ URL: `/golem-visualizer`

### 5. **文档** ✓
- ✅ 完整集成指南 (INTEGRATION_GUIDE.md)
- ✅ API 参考
- ✅ 使用示例
- ✅ 故障排除

## 🚀 快速开始

### 访问可视化工具

```bash
# 1. 确保数据库配置正确
# .env 已更新为 AWS RDS MySQL

# 2. 安装依赖
pnpm install

# 3. 启动开发服务器
pnpm dev

# 4. 访问页面
http://localhost:3000/golem-visualizer
```

### 后端服务（可选）

```bash
# 1. 安装 Python 依赖
pip install -r golem-visualizer/backend/requirements.txt

# 2. 启动 Flask 服务
python golem-visualizer/backend/golem_backend.py

# 3. API 可用于 http://localhost:5000
```

## 🎯 功能特性

### 前端（React + Three.js）

```tsx
import GolemVisualizer from '@/golem-visualizer/frontend/GolemVisualizer';

<GolemVisualizer
  data={[
    { id: 'v1', vector: [1, 2, 3], label: 'Vector 1', color: '#4a9eff' },
    { id: 'v2', vector: [4, 5, 6], label: 'Vector 2', color: '#a855f7' },
  ]}
  onPointClick={(point) => console.log(point)}
  height="600px"
  autoRotate={true}
/>
```

**支持的交互：**
- 🖱️ 拖动旋转视角
- 🔍 滚轮缩放
- ✋ 点击选择点
- 🔄 自动旋转

### 后端（Python）

```python
from golem_backend import GolemBackend

backend = GolemBackend()
backend.add_vectors([
    {'id': 'v1', 'vector': [1, 2, 3, 4]},  # 高维自动投影
    {'id': 'v2', 'vector': [5, 6, 7, 8]},
])

# 投影到 3D
result = backend.project_to_3d()

# 查找相似向量
similar = backend.find_similar('v1', k=5)

# 统计信息
stats = backend.get_statistics()
```

**API 端点：**
- `GET /api/vectors` - 获取所有向量
- `POST /api/vectors` - 添加向量
- `GET /api/similar/<id>` - 相似搜索
- `GET /api/statistics` - 统计信息

## 📊 数据可视化场景

### 1. **包市场可视化** (已实现)

在 GolemVisualizerPage 中：
- Vector Packages - 按 epsilon、下载量、评分可视化
- Memory Packages - 按压缩率、大小、质量可视化
- Chain Packages - 按步数、质量、复杂度可视化
- 按类别颜色编码（NLP/Vision/Audio/Multimodal）

### 2. **相似性分析**

```tsx
// 查找相似的包
const similar = await backend.find_similar('package_id', k=10);
```

### 3. **高维向量投影**

自动将任何维度的向量投影到 3D：
```python
# 输入：1024 维向量
high_dim = [1.0, 2.0, ..., 1024.0]

# 输出：3D 坐标
[0.5, 0.3, 0.2]  # 使用 PCA 投影
```

## 🔌 集成示例

### 与 Package API 集成

```tsx
// 在 GolemVisualizerPage.tsx 中
const { data: packagesData } = trpc.packages.browsePackages.useQuery({
  packageType: 'vector',
  limit: 50,
});

// 转换为向量
const vectors = packagesData.packages.map(pkg => ({
  id: pkg.packageId,
  vector: [pkg.epsilon * 10, pkg.downloads / 100, pkg.rating * 10],
  label: pkg.name,
  color: getColorByCategory(pkg.category),
}));

// 渲染
<GolemVisualizer data={vectors} />
```

## 📚 文件清单

| 文件 | 位置 | 说明 |
|------|------|------|
| GolemVisualizer.tsx | `golem-visualizer/frontend/` | React 组件 |
| golem_backend.py | `golem-visualizer/backend/` | Python 后端 |
| GolemVisualizerPage.tsx | `client/src/pages/` | 完整页面 |
| INTEGRATION_GUIDE.md | `golem-visualizer/docs/` | 详细指南 |
| requirements.txt | `golem-visualizer/backend/` | Python 依赖 |

## 🛠️ 技术栈

### 前端
- React 18
- TypeScript
- Three.js 0.160+
- WebGL

### 后端
- Python 3.8+
- scikit-learn (PCA, 预处理)
- NumPy (向量操作)
- Flask (REST API)

## 📖 相关文档

- [完整集成指南](./golem-visualizer/INTEGRATION_GUIDE.md)
- [Project Golem 原项目](https://github.com/CyberMagician/Project_Golem)
- [Three.js 文档](https://threejs.org/)

## ✨ 特性亮点

✅ **即插即用** - 独立模块，无需修改现有代码  
✅ **完整文档** - 集成指南、API 参考、示例代码  
✅ **性能优化** - WebGL 渲染，支持大规模数据  
✅ **交互丰富** - 拖动、缩放、点击选择  
✅ **跨端兼容** - 同时支持 React 和 Python  
✅ **可扩展性** - 模块化设计，易于定制  

## 🚢 部署

### 前端部署
集成到现有 Vite 构建流程：
```bash
pnpm build  # 包含 GolemVisualizerPage
```

### 后端部署
独立的 Python 微服务：
```bash
python golem-visualizer/backend/golem_backend.py
# 或 Docker
docker run -p 5000:5000 golem-backend
```

## 📝 许可证

MIT License - 与 Project Golem 原项目保持一致

---

**集成日期**: 2026-01-17  
**状态**: ✅ 完成  
**版本**: 1.0.0
