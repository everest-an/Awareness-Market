# Project Golem - 完整集成指南

## 文件清单

本集成包含以下文件:

```
📦 Project Golem 可视化工具集成包
├── 📄 PROJECT_GOLEM_ANALYSIS.md          # 详细分析文档
├── 📄 INTEGRATION_GUIDE.md                # 本文件
├── 🎨 GolemVisualizer.js                  # 前端可视化模块
├── 🐍 golem_backend.py                    # 后端服务模块
├── 📄 golem_integration_example.html      # 完整集成示例
└── 📄 requirements.txt                    # Python依赖
```

---

## 快速开始

### 1. 获取数据文件

首先，您需要从原始仓库获取或生成数据文件:

```bash
# 克隆原始仓库
git clone https://github.com/CyberMagician/Project_Golem.git

# 进入目录
cd Project_Golem

# 安装依赖
pip install -r requirements.txt

# 生成数据 (可能需要10-30分钟)
python ingest.py

# 复制生成的文件到您的项目
cp golem_cortex.json /path/to/your/project/
cp golem_vectors.npy /path/to/your/project/
```

### 2. 前端集成

#### 方式A: 使用完整示例HTML

```bash
# 复制文件
cp golem_integration_example.html /path/to/your/project/
cp GolemVisualizer.js /path/to/your/project/

# 在浏览器中打开
open golem_integration_example.html
```

#### 方式B: 集成到现有项目

```html
<!DOCTYPE html>
<html>
<head>
    <script src="https://unpkg.com/three@0.160.0/build/three.min.js"></script>
    <script src="https://unpkg.com/three@0.160.0/examples/js/controls/OrbitControls.js"></script>
    <script src="./GolemVisualizer.js"></script>
</head>
<body>
    <div id="my-container" style="width: 100%; height: 100%;"></div>
    
    <script>
        // 初始化可视化器
        const visualizer = new GolemVisualizer({
            containerId: 'my-container',
            apiUrl: 'http://localhost:8000',
            dataPath: './golem_cortex.json'
        });
        
        // 启动
        visualizer.init().then(() => {
            console.log('✅ Visualizer ready');
        }).catch(err => {
            console.error('❌ Error:', err);
        });
    </script>
</body>
</html>
```

### 3. 后端集成

#### 方式A: 使用原始GolemServer.py

```bash
# 复制原始文件
cp /path/to/Project_Golem/GolemServer.py /path/to/your/project/

# 在您的项目目录启动
python GolemServer.py
```

#### 方式B: 集成新的golem_backend.py模块

```python
from golem_backend import GolemBackend, create_flask_app

# 初始化后端
backend = GolemBackend(
    model_id="google/embedding-gemma-300m",
    vector_file="golem_vectors.npy",
    json_file="golem_cortex.json"
)

# 创建Flask应用
app = create_flask_app(backend)

# 运行服务器
if __name__ == '__main__':
    app.run(port=8000, debug=False)
```

#### 方式C: 自定义集成

```python
from golem_backend import GolemBackend
from your_framework import YourAPI  # 您的框架

backend = GolemBackend()

@YourAPI.route('/search')
def search(query):
    result = backend.query(query, top_k=50)
    return {
        'results': result['nodes'],
        'scores': result['scores']
    }
```

---

## API 参考

### 前端 - GolemVisualizer 类

#### 构造函数

```javascript
const visualizer = new GolemVisualizer({
    containerId: 'container-id',           // HTML容器ID
    apiUrl: 'http://localhost:8000',       // API服务器地址
    dataPath: './golem_cortex.json',       // 数据文件路径
    width: 1280,                           // 可视化宽度
    height: 720,                           // 可视化高度
    autoRotate: true,                      // 自动旋转
    rotateSpeed: 0.5,                      // 旋转速度
    fog: true                              // 启用雾效果
});
```

#### 方法

```javascript
// 初始化
await visualizer.init();

// 查询
const result = await visualizer.query("Julius Caesar");
// 返回: { indices: [...], scores: [...], topNode: {...} }

// 获取信息
visualizer.getNode(index);              // 获取单个节点
visualizer.getAllNodes();               // 获取所有节点
visualizer.getNodeCount();              // 获取节点总数

// 清理资源
visualizer.destroy();
```

---

### 后端 - GolemBackend 类

#### 初始化

```python
from golem_backend import GolemBackend

backend = GolemBackend(
    model_id="google/embedding-gemma-300m",  # 向量模型
    vector_file="golem_vectors.npy",         # 向量文件
    json_file="golem_cortex.json",           # 数据文件
    device="cuda"                            # 计算设备 (自动检测)
)
```

#### 查询方法

```python
# 基础查询
result = backend.query(
    text="Julius Caesar",
    top_k=50,              # 返回前50个结果
    min_score=0.5          # 最小相似度阈值
)
# 返回: {
#     'indices': [...],
#     'scores': [...],
#     'nodes': [...]
# }

# 高级查询 (支持分类过滤)
result = backend.query_advanced(
    text="Julius Caesar",
    top_k=50,
    category_filter="Hist",  # 仅返回History分类
    min_score=0.5
)

# 批量查询
results = backend.batch_query(
    texts=["Julius Caesar", "Napoleon", "Alexander"],
    top_k=10
)
```

#### 信息检索

```python
# 获取节点
node = backend.get_node(index)

# 获取所有节点
nodes = backend.get_all_nodes()

# 按分类获取
nodes = backend.get_nodes_by_category("Bio")

# 获取分类列表
categories = backend.get_categories()

# 按标题搜索
results = backend.search_by_title("neural")

# 获取邻居
neighbors = backend.get_neighbors(node_index, k=8)

# 统计信息
stats = backend.get_statistics()
```

---

### HTTP API 端点

#### POST /query
查询相似节点

```bash
curl -X POST http://localhost:8000/query \
  -H "Content-Type: application/json" \
  -d '{"query": "Julius Caesar", "top_k": 50}'
```

响应:
```json
{
    "indices": [125, 342, 89, ...],
    "scores": [0.89, 0.85, 0.82, ...]
}
```

#### POST /query/advanced
高级查询 (支持过滤)

```bash
curl -X POST http://localhost:8000/query/advanced \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Julius Caesar",
    "top_k": 50,
    "category": "Hist",
    "min_score": 0.5
  }'
```

#### GET /node/{index}
获取节点信息

```bash
curl http://localhost:8000/node/125
```

#### GET /categories
获取所有分类

```bash
curl http://localhost:8000/categories
```

#### GET /statistics
获取统计信息

```bash
curl http://localhost:8000/statistics
```

#### GET /health
健康检查

```bash
curl http://localhost:8000/health
```

---

## 数据格式

### golem_cortex.json

```json
[
  {
    "id": 0,
    "title": "Node Title",
    "cat": "Category",
    "pos": [x, y, z],
    "col": [r, g, b],
    "nbs": [neighbor1, neighbor2, ...]
  }
]
```

### 查询响应

```json
{
  "indices": [125, 342, 89],
  "scores": [0.89, 0.85, 0.82],
  "nodes": [
    {
      "id": 125,
      "title": "Julius Caesar",
      "cat": "Hist",
      "pos": [1.5, 2.3, -0.5],
      "col": [0.94, 0.94, 0.20]
    }
  ]
}
```

---

## 配置自定义

### 修改数据源

编辑 `ingest.py`:

```python
# 修改分类
TARGETS = {
    "Your Category": "Group",
    "Another Category": "Group"
}

# 修改颜色
COLOR_MAP = {
    "Group": [r, g, b]  # RGB 0-1范围
}
```

### 修改端口

```python
# golem_backend.py
app.run(port=8080)  # 改为其他端口
```

### 修改返回数量

```javascript
// GolemVisualizer.js
// 在 query 方法中修改
await fetch(`${this.config.apiUrl}/query`, {
  // ...
  body: JSON.stringify({
    query: queryText,
    top_k: 100  // 改为其他数值
  })
});
```

---

## 性能优化

### 1. GPU加速

自动检测和使用:
- NVIDIA CUDA
- Apple MPS (Metal Performance Shaders)
- 回退到CPU

### 2. 向量缓存

向量矩阵预加载到内存，提供毫秒级查询速度

### 3. 渲染优化

- WebGL着色器处理顶点变换
- 加性混合模式
- 自适应分辨率

### 4. 内存优化

```python
# 使用更小的模型
backend = GolemBackend(
    model_id="all-MiniLM-L6-v2"  # 更小的模型
)

# 减少节点数量
# 在ingest.py中修改: count < 50
```

---

## 故障排除

### 错误: "Vector file not found"

```
解决方案:
1. 确保运行了 python ingest.py
2. 检查文件路径是否正确
3. 检查文件权限
```

### 错误: "CUDA out of memory"

```
解决方案:
1. 使用CPU: device="cpu"
2. 使用更小的模型
3. 减少批处理大小
```

### 错误: "Cannot connect to API"

```
解决方案:
1. 确保后端正在运行
2. 检查端口号是否正确
3. 检查防火墙设置
4. 检查CORS配置
```

### 错误: "模型下载失败"

```
解决方案:
1. 检查网络连接
2. 使用代理或VPN
3. 指定本地模型路径
4. 离线运行: trust_remote_code=False
```

---

## 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                     前端 (Three.js)                          │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  GolemVisualizer.js                                    │ │
│  │  - 3D渲染                                              │ │
│  │  - 用户交互                                            │ │
│  │  - WebGL着色器                                         │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
           ↑                              ↓
        HTTP/JSON API
           ↑                              ↓
┌─────────────────────────────────────────────────────────────┐
│                 后端 (Flask + Python)                        │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  GolemBackend                                          │ │
│  │  - 向量查询 (numpy + BLAS)                            │ │
│  │  - 文本向量化 (Sentence Transformers)                │ │
│  │  - 数据管理                                            │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
           ↑
        文件I/O
           ↑
┌─────────────────────────────────────────────────────────────┐
│                    数据层                                     │
│  ├─ golem_vectors.npy   (向量矩阵)                          │
│  └─ golem_cortex.json   (节点数据)                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 部署指南

### Docker部署

```dockerfile
FROM python:3.10

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY golem_backend.py .
COPY golem_vectors.npy .
COPY golem_cortex.json .
COPY golem_integration_example.html .

EXPOSE 8000

CMD ["python", "golem_backend.py"]
```

```bash
# 构建
docker build -t golem-visualizer .

# 运行
docker run -p 8000:8000 golem-visualizer
```

### Kubernetes部署

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: golem-visualizer
spec:
  replicas: 1
  selector:
    matchLabels:
      app: golem
  template:
    metadata:
      labels:
        app: golem
    spec:
      containers:
      - name: golem
        image: golem-visualizer:latest
        ports:
        - containerPort: 8000
        resources:
          requests:
            memory: "2Gi"
            cpu: "500m"
          limits:
            memory: "4Gi"
            cpu: "2"
```

---

## 许可证

Apache License 2.0

原始项目: https://github.com/CyberMagician/Project_Golem

---

## 支持和反馈

- GitHub Issues: https://github.com/CyberMagician/Project_Golem/issues
- 文档: [PROJECT_GOLEM_ANALYSIS.md](PROJECT_GOLEM_ANALYSIS.md)

---

## 更新日志

### v1.0 (2024)
- 初始集成包发布
- 前端可视化模块
- 后端服务模块
- 完整API文档
- 集成示例

