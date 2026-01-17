# Project Golem - 可视化工具集成包

> 一个3D神经内存可视化系统，用于实时显示RAG（检索增强生成）内存结构

## 📦 集成包内容

本包包含从 [Project Golem](https://github.com/CyberMagician/Project_Golem) 提取的完整可视化工具代码和集成模块。

### 文件说明

| 文件 | 类型 | 说明 |
|------|------|------|
| **PROJECT_GOLEM_ANALYSIS.md** | 📄 文档 | 详细的项目分析和代码解析 |
| **INTEGRATION_GUIDE.md** | 📄 文档 | 完整的集成步骤和API参考 |
| **GolemVisualizer.js** | 🎨 前端 | 可集成的JavaScript可视化模块 |
| **golem_backend.py** | 🐍 后端 | 可集成的Python后端服务模块 |
| **golem_integration_example.html** | 📄 示例 | 完整的HTML集成示例 |
| **GOLEM_REQUIREMENTS.txt** | 📦 依赖 | Python依赖列表 |
| **README.md** | 📄 文档 | 本文件 |

---

## 🚀 快速开始

### 前置条件
- Python 3.8+
- Node.js/npm (可选)
- GPU (可选，但推荐用于加速)

### 步骤1: 获取数据文件

```bash
# 克隆原始仓库并生成数据
git clone https://github.com/CyberMagician/Project_Golem.git
cd Project_Golem
pip install -r requirements.txt
python ingest.py

# 复制生成的数据文件到您的项目
cp golem_cortex.json /path/to/your/project/
cp golem_vectors.npy /path/to/your/project/
```

### 步骤2: 安装依赖

```bash
pip install -r GOLEM_REQUIREMENTS.txt
```

### 步骤3: 启动后端服务

```python
# backend_server.py
from golem_backend import GolemBackend, create_flask_app

backend = GolemBackend()
app = create_flask_app(backend)

if __name__ == '__main__':
    app.run(port=8000)
```

```bash
python backend_server.py
```

### 步骤4: 打开前端

```bash
# 方式A: 使用完整示例
open golem_integration_example.html

# 方式B: 集成到现有项目
# 参考下面的"集成示例"部分
```

访问浏览器 → 开始查询！

---

## 💡 集成示例

### 最小化集成

```html
<!DOCTYPE html>
<html>
<head>
    <script src="https://unpkg.com/three@0.160.0/build/three.min.js"></script>
    <script src="https://unpkg.com/three@0.160.0/examples/js/controls/OrbitControls.js"></script>
    <script src="./GolemVisualizer.js"></script>
</head>
<body>
    <div id="container" style="width: 100%; height: 100vh;"></div>
    
    <script>
        const viz = new GolemVisualizer({
            containerId: 'container',
            apiUrl: 'http://localhost:8000'
        });
        
        viz.init().then(() => {
            // 执行查询
            viz.query("Julius Caesar").then(result => {
                console.log("Found:", result.nodes.length);
            });
        });
    </script>
</body>
</html>
```

### Python后端集成

```python
from golem_backend import GolemBackend

# 初始化
backend = GolemBackend()

# 查询
result = backend.query("Julius Caesar", top_k=50)
print(f"Found {len(result['nodes'])} nodes")

# 按分类过滤
history_results = backend.query_advanced(
    text="Julius Caesar",
    category_filter="Hist"
)

# 获取信息
categories = backend.get_categories()
stats = backend.get_statistics()
```

---

## 🎨 技术栈

### 前端
- **Three.js** v0.160.0 - 3D渲染
- **WebGL** - GPU加速
- **Custom GLSL Shaders** - 自定义着色器

### 后端
- **Flask** - Web框架
- **PyTorch** - 深度学习
- **sentence-transformers** - 向量化 (Google embedding-gemma-300m)
- **NumPy** - 快速向量计算
- **UMAP** - 降维算法

### 数据库
- **LanceDB** - 向量数据库
- **NumPy** - 本地向量存储

---

## 📊 核心特性

### 1. 实时3D可视化
- 2000+个节点的流畅渲染
- 交互式摄像机控制
- 自动旋转和动画

### 2. 语义查询
- 自然语言查询
- 毫秒级响应时间
- 余弦相似度排名

### 3. 视觉反馈
- 脉冲效果显示查询结果
- 分类颜色编码
- 实时图例显示

### 4. 灵活集成
- 模块化设计
- 可独立使用前/后端
- RESTful API

---

## 🔧 配置

### 修改可视化参数

```javascript
const viz = new GolemVisualizer({
    width: 1920,              // 宽度
    height: 1080,             // 高度
    autoRotate: true,         // 自动旋转
    rotateSpeed: 0.5,         // 旋转速度
    fog: true,                // 雾效果
    apiUrl: 'http://your-api' // API地址
});
```

### 修改后端设置

```python
backend = GolemBackend(
    model_id="all-MiniLM-L6-v2",  # 不同的向量模型
    device="cuda",                 # GPU设备
    vector_file="vectors.npy",
    json_file="cortex.json"
)
```

---

## 📈 性能指标

| 指标 | 值 |
|------|-----|
| 节点数量 | 2000+ |
| 向量维度 | 768 |
| 查询响应时间 | <100ms |
| 帧率 (60 FPS) | ✅ 支持 |
| GPU内存占用 | ~2GB |

---

## 🛠️ API 参考

### JavaScript API

```javascript
// 初始化
await visualizer.init();

// 查询
result = await visualizer.query("text");

// 获取数据
node = visualizer.getNode(index);
nodes = visualizer.getAllNodes();
count = visualizer.getNodeCount();

// 清理
visualizer.destroy();
```

### Python API

```python
# 查询
result = backend.query(text, top_k=50)

# 高级查询
result = backend.query_advanced(
    text,
    category_filter="Hist"
)

# 数据检索
backend.get_categories()
backend.get_nodes_by_category("Bio")
backend.search_by_title("caesar")
```

### HTTP API

```bash
# 查询
POST /query
{"query": "text", "top_k": 50}

# 高级查询
POST /query/advanced
{"query": "text", "category": "Hist"}

# 获取节点
GET /node/{index}

# 获取分类
GET /categories

# 统计信息
GET /statistics
```

---

## 📚 文档

- **项目分析** → [PROJECT_GOLEM_ANALYSIS.md](PROJECT_GOLEM_ANALYSIS.md)
- **集成指南** → [INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md)
- **原始仓库** → https://github.com/CyberMagician/Project_Golem

---

## ⚙️ 故障排除

### "Vector file not found"
```bash
# 确保运行了数据生成
python /path/to/Project_Golem/ingest.py
# 复制文件到项目目录
```

### "CUDA out of memory"
```python
# 使用CPU或更小的模型
backend = GolemBackend(device="cpu")
```

### "Cannot connect to API"
```bash
# 检查后端是否运行
ps aux | grep python
# 确保使用正确的端口
```

---

## 🎯 使用场景

1. **知识可视化** - 可视化文本语义空间
2. **RAG系统调试** - 理解检索过程
3. **数据探索** - 交互式数据浏览
4. **教育演示** - 机器学习概念展示
5. **信息检索** - 语义搜索界面

---

## 📝 许可证

Apache License 2.0

原始项目: [CyberMagician/Project_Golem](https://github.com/CyberMagician/Project_Golem)

---

## 🙏 致谢

感谢 CyberMagician 创建的原始 Project Golem 项目。

---

## 📞 支持

遇到问题？查看：
1. [INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md) - 集成指南
2. [PROJECT_GOLEM_ANALYSIS.md](PROJECT_GOLEM_ANALYSIS.md) - 技术分析
3. [GitHub Issues](https://github.com/CyberMagician/Project_Golem/issues) - 原始仓库问题

---

**让您的知识可视化！** 🚀
