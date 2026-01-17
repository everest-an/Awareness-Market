# Project Golem - 可视化工具分析与集成指南

## 1. 项目概述

**Project Golem** 是一个3D神经内存可视化工具，用于实时可视化 RAG（检索增强生成）内存结构。

**GitHub仓库**: https://github.com/CyberMagician/Project_Golem

---

## 2. 项目结构与入口文件

### 目录结构
```
Project_Golem/
├── index.html              # 前端主文件（入口）
├── GolemServer.py          # Flask后端服务器
├── ingest.py              # 数据摄入与处理脚本
├── requirements.txt        # Python依赖
└── golem_cortex.json      # 生成的数据文件（运行时创建）
└── golem_vectors.npy      # 向量矩阵文件（运行时创建）
```

### 关键文件说明
- **index.html**: 前端可视化界面，包含所有Three.js渲染代码
- **GolemServer.py**: Flask Web服务器，提供API和静态文件服务
- **ingest.py**: 数据处理脚本，从Wikipedia爬取数据并进行向量化

---

## 3. 技术栈

### 前端技术
- **Three.js** v0.160.0 - 3D渲染库
- **WebGL** - GPU加速图形渲染
- **Vanilla JavaScript** - 原生JS（无框架）
- **GLSL着色器** - 自定义顶点和片段着色器

### 后端技术
- **Python** - 主要编程语言
- **Flask** - Web框架
- **PyTorch** - 深度学习框架（GPU支持）

### 向量与数据处理
- **sentence-transformers** - 文本向量化 (Google embedding-gemma-300m)
- **UMAP** - 高维到3D空间的降维
- **scikit-learn** - KNN算法（构建神经突触）
- **LanceDB** - 向量数据库存储
- **NumPy** - 快速向量计算
- **wikipediaapi** - 维基百科数据爬取
- **langchain** - 文本分割器

---

## 4. 主要可视化组件代码

### 4.1 Three.js场景初始化
```javascript
// 创建3D场景
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x050505, 0.002);

// 透视摄像机
const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
camera.position.set(0, 20, 120);

// WebGL渲染器
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// 轨道控制器（鼠标交互）
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.5;
```

### 4.2 自定义着色器材质
```javascript
const material = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    
    // 顶点着色器 - 处理点的大小和位置
    vertexShader: `
        attribute vec3 color;
        attribute float activationTime;
        varying vec3 vColor;
        varying float vAlpha;
        uniform float uTime;
        
        void main() {
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            float timeSinceHit = uTime - activationTime;
            float intensity = 0.0;
            
            // 查询激活时3秒内的脉冲效果
            if (timeSinceHit > 0.0 && timeSinceHit < 3.0) {
                intensity = 1.0 / (1.0 + timeSinceHit * 3.0); 
                gl_PointSize = (4.0 * (1.0 + intensity * 5.0)) * (300.0 / -mvPosition.z);
            } else {
                gl_PointSize = 2.5 * (300.0 / -mvPosition.z);
            }
            
            gl_Position = projectionMatrix * mvPosition;
            vColor = mix(color, vec3(1.0, 1.0, 1.0), intensity);
            vAlpha = 0.4 + (intensity * 0.6);
        }
    `,
    
    // 片段着色器 - 处理点的颜色和透明度
    fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;
        
        void main() {
            vec2 coord = gl_PointCoord - vec2(0.5);
            if(length(coord) > 0.5) discard;
            float strength = 1.0 - (length(coord) * 2.0);
            gl_FragColor = vec4(vColor, vAlpha * strength);
        }
    `,
    
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
});
```

### 4.3 点云几何体构建
```javascript
// 创建缓冲几何体
const geometry = new THREE.BufferGeometry();

// 从JSON加载顶点数据
fetch('./golem_cortex.json')
    .then(res => res.json())
    .then(data => {
        nodes = data;
        const positions = [];
        const colors = [];
        const activationTimes = [];
        
        // 解析每个节点
        data.forEach(n => {
            positions.push(n.pos[0]*8, n.pos[1]*8, n.pos[2]*8);
            colors.push(n.col[0], n.col[1], n.col[2]);
            activationTimes.push(-100.0);
        });
        
        // 设置属性
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geometry.setAttribute('activationTime', new THREE.Float32BufferAttribute(activationTimes, 1));
        geometry.attributes.activationTime.setUsage(THREE.DynamicDrawUsage);
        
        // 创建点云
        const pointsMesh = new THREE.Points(geometry, material);
        scene.add(pointsMesh);
    });
```

### 4.4 查询触发脉冲效果
```javascript
// 查询输入监听
input.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
        const query = input.value;
        
        // 发送查询到后端
        const response = await fetch('/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: query })
        });
        
        const result = await response.json();
        
        // 触发多点脉冲
        triggerMultiPulse(result.indices);
        
        // 显示顶级匹配
        if(result.indices.length > 0) {
            const topNode = nodes[result.indices[0]];
            log.innerHTML = `> Top Match: <span style="color:#fff">${topNode.title}</span><br>[${topNode.cat}]`;
        }
    }
});

// 脉冲触发函数
function triggerMultiPulse(indices) {
    const currentTime = performance.now() / 1000;
    const activations = geometry.attributes.activationTime.array;
    indices.forEach((idx, i) => {
        activations[idx] = currentTime + (i * 0.02);
    });
    geometry.attributes.activationTime.needsUpdate = true;
}
```

### 4.5 动画循环
```javascript
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    
    // 更新时间uniform（驱动着色器动画）
    material.uniforms.uTime.value = performance.now() / 1000;
    
    // 渲染场景
    renderer.render(scene, camera);
}

// 响应式调整
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
```

### 4.6 图例UI构建
```javascript
// 从类别映射构建图例
const categoryMap = new Map();
data.forEach(n => {
    if (!categoryMap.has(n.cat)) {
        const r = Math.floor(n.col[0] * 255);
        const g = Math.floor(n.col[1] * 255);
        const b = Math.floor(n.col[2] * 255);
        categoryMap.set(n.cat, `rgb(${r},${g},${b})`);
    }
});

const legendContainer = document.getElementById('legend-container');
const sortedCats = Array.from(categoryMap.entries()).sort();

sortedCats.forEach(([cat, colorStr]) => {
    const item = document.createElement('div');
    item.className = 'legend-item';
    item.innerHTML = `
        <span>${cat.toUpperCase()}</span>
        <div class="legend-dot" style="background-color: ${colorStr}; color: ${colorStr};"></div>
    `;
    legendContainer.appendChild(item);
});
```

---

## 5. 依赖库与工具

### Python依赖 (requirements.txt)
```
flask                      # Web框架
sentence-transformers     # 文本向量化
torch                     # 深度学习框架
numpy                     # 数值计算
umap-learn               # 降维算法
scikit-learn             # 机器学习工具
wikipediaapi             # 维基百科API
lancedb                  # 向量数据库
langchain               # 文本处理
```

### JavaScript依赖
- **Three.js v0.160.0** - 从CDN加载
  ```javascript
  import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
  import { OrbitControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js';
  ```

---

## 6. 配置文件

### 6.1 GolemServer.py 配置部分
```python
# --- CONFIG ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_ID = "google/embeddinggemma-300m"

# 输入输出文件
VECTOR_FILE = "golem_vectors.npy"
JSON_FILE = "golem_cortex.json"
HTML_FILE = "index.html"

# Flask应用配置
app = Flask(__name__, static_folder=BASE_DIR)

# 服务端口
if __name__ == '__main__':
    app.run(port=8000)  # http://localhost:8000
```

### 6.2 ingest.py 配置部分
```python
# --- CONFIG ---
DB_PATH = "./my_lancedb"
TABLE_NAME = "golem_memories"
JSON_OUTPUT_PATH = "./golem_cortex.json"
EMBEDDING_MODEL_ID = "google/embeddinggemma-300m"

# 颜色映射（5个主要分类）
COLOR_MAP = {
    "Bio": [0.29, 0.87, 0.50],   # 绿色 - 生物学
    "Tech": [0.22, 0.74, 0.97],  # 蓝色 - 技术
    "Phys": [0.60, 0.20, 0.80],  # 紫色 - 物理学
    "Hist": [0.94, 0.94, 0.20],  # 金色 - 历史
    "Misc": [0.98, 0.55, 0.00]   # 橙色 - 其他
}

# 20个分类目标
TARGETS = {
    "Neurology": "Bio", "Immunology": "Bio", "Botany": "Bio", "Genetics": "Bio",
    "Artificial intelligence": "Tech", "Cybernetics": "Tech", "Cryptography": "Tech", "Robotics": "Tech",
    "Quantum mechanics": "Phys", "Astrophysics": "Phys", "Thermodynamics": "Phys", "Optics": "Phys",
    "Roman Empire": "Hist", "Ancient Egypt": "Hist", "Renaissance": "Hist", "Industrial Revolution": "Hist",
    "Basketball": "Misc", "Chess": "Misc", "Music theory": "Misc", "Game theory": "Misc"
}
```

---

## 7. API端点

### POST /query
查询向量数据库中的相似项

**请求**:
```json
{
  "query": "Julius Caesar"
}
```

**响应**:
```json
{
  "indices": [125, 342, 89, ...],
  "scores": [0.89, 0.85, 0.82, ...]
}
```

**实现代码** (GolemServer.py):
```python
@app.route('/query', methods=['POST'])
def query_brain():
    data = request.json
    text = data.get('query', '')
    if not text: return jsonify({"indices": []})

    # 向量化查询
    query_vec = model.encode(["Represent this query for retrieval: " + text])[0]
    
    # 余弦相似度计算
    scores = np.dot(memory_matrix, query_vec)
    top_indices = np.argsort(scores)[-50:][::-1]
    
    return jsonify({
        "indices": top_indices.tolist(),
        "scores": scores[top_indices].tolist()
    })
```

---

## 8. 数据格式

### golem_cortex.json 格式
```json
[
  {
    "id": 0,
    "title": "Node Title",
    "cat": "Category",
    "pos": [x, y, z],
    "col": [r, g, b],
    "nbs": [neighbor_id1, neighbor_id2, ...]
  },
  ...
]
```

### 数据结构说明
- **id**: 节点唯一标识符
- **title**: 节点显示名称
- **cat**: 分类名称
- **pos**: 3D空间坐标（由UMAP生成）
- **col**: RGB颜色值 (0-1范围)
- **nbs**: 最近的8个邻居ID（KNN结果）

---

## 9. UI层CSS样式

```css
/* UI层容器 */
#ui-layer {
    position: absolute;
    top: 20px;
    left: 20px;
    width: 350px;
    pointer-events: none;
    z-index: 10;
}

/* 查询输入框 */
#query-input {
    width: 100%;
    background: rgba(0,0,0,0.6);
    border: 1px solid #4ade80;
    color: #4ade80;
    padding: 10px;
    font-family: 'Courier New', monospace;
    font-size: 14px;
    outline: none;
    transition: 0.2s;
}

#query-input:focus {
    background: rgba(74, 222, 128, 0.1);
    box-shadow: 0 0 10px rgba(74, 222, 128, 0.3);
}

/* 图例容器 */
#legend-container {
    position: absolute;
    bottom: 20px;
    right: 20px;
    text-align: right;
    pointer-events: none;
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 80vh;
    overflow-y: auto;
}

/* 图例项目 */
.legend-item {
    font-size: 11px;
    color: #94a3b8;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    opacity: 0.8;
    transition: opacity 0.2s;
}

.legend-item:hover { opacity: 1.0; }

/* 图例点 */
.legend-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    box-shadow: 0 0 5px currentColor;
}
```

---

## 10. 集成步骤

### 步骤1: 复制文件
```bash
# 复制这些文件到你的项目
- index.html              # 前端代码
- GolemServer.py          # 后端服务
- ingest.py              # 数据处理脚本
```

### 步骤2: 安装依赖
```bash
pip install -r requirements.txt
```

### 步骤3: 生成数据
```bash
python ingest.py
# 生成: golem_cortex.json 和 golem_vectors.npy
```

### 步骤4: 启动服务器
```bash
python GolemServer.py
# 访问: http://localhost:8000
```

---

## 11. 自定义配置

### 修改颜色方案
在 `ingest.py` 中修改 `COLOR_MAP`:
```python
COLOR_MAP = {
    "YourCategory": [r, g, b],  # RGB范围 0-1
}
```

### 修改数据源
在 `ingest.py` 中修改 `TARGETS` 字典:
```python
TARGETS = {
    "Your Category": "Group",
}
```

### 修改查询返回数量
在 `GolemServer.py` 中修改:
```python
top_indices = np.argsort(scores)[-50:][::-1]  # 修改50为其他数值
```

### 修改服务器端口
在 `GolemServer.py` 中修改:
```python
app.run(port=8080)  # 修改为其他端口
```

---

## 12. 性能优化

### GPU加速
```python
# ingest.py 中自动检测
device = "mps" if torch.backends.mps.is_available() else "cpu"
# Mac: MPS, NVIDIA: cuda, CPU: cpu
```

### 向量缓存
- 向量矩阵存储在 `.npy` 文件中，快速加载
- NumPy进行超快速的余弦相似度计算

### 渲染优化
- 使用 WebGL 顶点着色器处理2000+个顶点
- 加性混合模式提高渲染性能
- 自动响应式调整

---

## 13. 故障排除

### 错误: "Missing files"
```
确保运行: python ingest.py
检查生成: golem_vectors.npy 和 golem_cortex.json
```

### 错误: "CUDA not available"
```
使用CPU: 自动降级到CPU模式
或安装PyTorch CUDA: pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
```

### 性能问题
```
- 减少节点数量: 在ingest.py中改 count < 100
- 使用更小的模型: embedding-gecko-001
- 启用GPU加速
```

---

## 14. 许可证
Apache License 2.0

---

## 15. 参考资源

- 官方仓库: https://github.com/CyberMagician/Project_Golem
- Three.js文档: https://threejs.org/docs/
- Sentence-Transformers: https://www.sbert.net/
- UMAP: https://umap-learn.readthedocs.io/
