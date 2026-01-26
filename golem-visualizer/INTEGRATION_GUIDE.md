# Awareness Neural Cortex 集成指南

## 📋 项目结构

```
golem-visualizer/                    # Neural Cortex 可视化模块
├── frontend/
│   ├── GolemVisualizer.tsx          # React 组件 (旧版)
│   └── README.md                    # 前端文档
├── backend/
│   ├── golem_backend.py             # Python 后端模块
│   └── requirements.txt              # Python 依赖
├── docs/
│   ├── API.md                       # API 文档
│   └── INTEGRATION.md               # 集成指南
└── README.md                        # 项目说明

# 主要组件 (推荐):
client/src/components/
└── NeuralCortexVisualizer.tsx       # 主可视化组件

client/src/pages/
└── NeuralCortex.tsx                 # 页面入口
```

## 🚀 快速开始

### 前端集成

1. **导入组件**

```tsx
import GolemVisualizer from '@/golem-visualizer/frontend/GolemVisualizer';

const data = [
  { id: 'v1', vector: [1, 2, 3], label: 'Vector 1', color: '#4a9eff' },
  { id: 'v2', vector: [4, 5, 6], label: 'Vector 2', color: '#a855f7' },
];

function App() {
  return (
    <GolemVisualizer
      data={data}
      onPointClick={(point) => console.log('Clicked:', point)}
      height="600px"
      backgroundColor="#0a0e27"
      autoRotate={true}
    />
  );
}
```

2. **路由配置** (在 `client/src/App.tsx` 中)

```tsx
import GolemVisualizerPage from './pages/GolemVisualizerPage';

<Route path="/golem-visualizer" component={GolemVisualizerPage} />
```

3. **安装依赖**

```bash
# Three.js 应该已经在项目中，如果没有：
pnpm add three @types/three
```

### 后端集成

1. **安装 Python 依赖**

```bash
pip install -r golem-visualizer/backend/requirements.txt
```

2. **使用后端模块**

```python
from golem_backend import GolemBackend, create_flask_app

# 创建后端实例
backend = GolemBackend(use_pca=True, n_components=3)

# 添加向量
vectors = [
    {'id': 'v1', 'vector': [1.0, 2.0, 3.0], 'label': 'Vector 1'},
    {'id': 'v2', 'vector': [4.0, 5.0, 6.0], 'label': 'Vector 2'},
]
backend.add_vectors(vectors)

# 获取投影
projected = backend.project_to_3d()

# 启动 Flask API
app = create_flask_app(backend)
app.run(port=5000)
```

3. **API 端点**

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/vectors` | 获取所有投影向量 |
| POST | `/api/vectors` | 添加新向量 |
| GET | `/api/statistics` | 获取统计信息 |
| GET | `/api/similar/<id>` | 查找相似向量 |
| GET | `/api/health` | 健康检查 |

## 🎨 功能特性

### 前端功能

- ✅ 实时 3D 场景渲染 (Three.js)
- ✅ 交互式相机控制 (拖动、缩放)
- ✅ 点云点击选择
- ✅ 自动旋转选项
- ✅ 自定义颜色映射
- ✅ 响应式设计

### 后端功能

- ✅ PCA 降维 (高维到 3D)
- ✅ 向量标准化
- ✅ KNN 相似搜索
- ✅ 统计分析
- ✅ JSON 导入/导出
- ✅ Flask REST API

## 📊 数据格式

### 前端输入格式

```typescript
interface VectorData {
  id: string;           // 唯一标识
  vector: number[];     // 向量（3D 或更高维）
  label?: string;       // 标签显示
  color?: string;       // 十六进制颜色代码
}
```

### 后端 API 格式

**请求:**
```json
{
  "vectors": [
    {
      "id": "v1",
      "vector": [1.0, 2.0, 3.0, 4.0],
      "label": "Sample Vector",
      "metadata": {"source": "embedding_model"}
    }
  ]
}
```

**响应:**
```json
{
  "id": "v1",
  "vector": [0.5, 0.3, 0.2],
  "label": "Sample Vector",
  "metadata": {"source": "embedding_model"}
}
```

## 🔧 配置选项

### GolemVisualizer 组件属性

```typescript
interface GolemVisualizerProps {
  data: VectorData[];              // 向量数据
  onPointClick?: (point: VectorData) => void;  // 点击回调
  width?: string | number;         // 宽度 (默认: '100%')
  height?: string | number;        // 高度 (默认: '600px')
  backgroundColor?: string;        // 背景颜色 (默认: '#0a0e27')
  showLegend?: boolean;            // 显示图例 (默认: true)
  autoRotate?: boolean;            // 自动旋转 (默认: true)
}
```

### GolemBackend 配置

```python
backend = GolemBackend(
    use_pca=True,         # 使用 PCA 降维
    n_components=3,       # 目标维度
)
```

## 🎯 集成场景

### 1. 包市场可视化 (已实现)

```tsx
// 在 GolemVisualizerPage.tsx 中
const vectorizedPackages = packagesData.packages.map((pkg) => ({
  id: pkg.packageId,
  vector: [pkg.epsilon * 10, pkg.downloads / 100, pkg.rating * 10],
  label: pkg.name,
  color: getColorByCategory(pkg.category),
}));
```

### 2. 向量相似性搜索

```python
# 后端
similar = backend.find_similar(query_id='v1', k=5)
```

### 3. 高维数据投影

```python
# 自动将任何维度的向量投影到 3D
high_dim_vectors = [{'id': 'v1', 'vector': [1, 2, 3, 4, 5, 6, 7, 8]}]
backend.add_vectors(high_dim_vectors)
projected = backend.project_to_3d()
```

## 📚 示例代码

### 完整的 React 示例

```tsx
import React from 'react';
import GolemVisualizer from '@/golem-visualizer/frontend/GolemVisualizer';

export default function Demo() {
  const [selectedPoint, setSelectedPoint] = React.useState(null);

  const data = [
    { id: '1', vector: [1, 2, 3], label: 'Point 1', color: '#4a9eff' },
    { id: '2', vector: [4, 5, 6], label: 'Point 2', color: '#a855f7' },
    { id: '3', vector: [7, 8, 9], label: 'Point 3', color: '#10b981' },
  ];

  return (
    <div>
      <h1>Golem 3D Visualizer</h1>
      <GolemVisualizer
        data={data}
        onPointClick={setSelectedPoint}
        height="500px"
        autoRotate={true}
      />
      {selectedPoint && (
        <div>
          <h2>Selected: {selectedPoint.label}</h2>
          <p>ID: {selectedPoint.id}</p>
        </div>
      )}
    </div>
  );
}
```

### 完整的 Python 示例

```python
from golem_backend import GolemBackend, create_flask_app
import json

# 初始化
backend = GolemBackend()

# 加载数据
with open('vectors.json') as f:
    vectors = json.load(f)

backend.add_vectors(vectors)

# 投影到 3D
projected = backend.project_to_3d()
print(json.dumps(projected, indent=2))

# 统计
stats = backend.get_statistics()
print(f"总向量数: {stats['total_vectors']}")
print(f"原始维度: {stats['original_dimension']}")

# 启动 API 服务
app = create_flask_app(backend)
app.run(debug=True, port=5000)
```

## 🚢 部署

### 前端部署

集成到现有的 React + Vite 流程：

```bash
# 开发
pnpm dev

# 生产构建
pnpm build
```

### 后端部署

选项 1: 独立 Python 服务

```bash
# 启动 Flask 服务
python -m golem_visualizer.backend.golem_backend
```

选项 2: 与 Node.js 后端集成

```typescript
// server/golem-api.ts
import { spawn } from 'child_process';

export function startGolemBackend() {
  const python = spawn('python', ['golem-visualizer/backend/golem_backend.py']);
  python.stdout.on('data', (data) => console.log(data.toString()));
}
```

## 🐛 故障排除

### Three.js 不加载

```bash
# 确保安装了 Three.js
pnpm add three @types/three
```

### Python 依赖错误

```bash
# 更新依赖
pip install --upgrade scikit-learn numpy flask
```

### 数据不显示

1. 检查数据格式是否正确
2. 确保向量维度 >= 2
3. 检查浏览器控制台错误

## 📖 参考资源

- [Three.js 文档](https://threejs.org/docs/)
- [scikit-learn PCA](https://scikit-learn.org/stable/modules/generated/sklearn.decomposition.PCA.html)
- [Flask 文档](https://flask.palletsprojects.com/)

## 📄 许可证

MIT License - 见 LICENSE 文件
