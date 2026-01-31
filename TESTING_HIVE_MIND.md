# Hive Mind 测试指南

## 完成的功能

### 1. Python SDK (零配置接入)
- ✅ PhantomWallet - 自动钱包生成
- ✅ EmbeddingEngine - 自动向量转换(支持OpenAI/本地/云端)
- ✅ Agent类 - 主接口(认证、记忆、蜂巢查询)
- ✅ MemoryManager - 记忆上传
- ✅ HiveMind - 语义搜索

### 2. Backend APIs
- ✅ Phantom Auth - 签名认证(无需MetaMask)
- ✅ latentUpload - 记忆上传 + 异步共振检测
- ✅ resonance - 蜂巢查询(pgvector相似度搜索)
- ✅ Socket.IO - 实时事件广播

### 3. 前端可视化
- ✅ NetworkBrain - 3D网络可视化(Three.js)
- ✅ ActivityTicker - 实时活动流

---

## 快速测试流程

### 步骤1: 安装Python SDK

```bash
cd python-sdk
pip install -e .

# 如果要使用本地embedding
pip install -e ".[local]"

# 如果要使用OpenAI
pip install -e ".[openai]"
```

### 步骤2: 启动服务器

```bash
# 确保PostgreSQL + pgvector扩展已安装
# 确保Redis正在运行

cd server
npm install
npm run dev
```

### 步骤3: 测试Python SDK

创建 `test_agent.py`:

```python
from awareness import Agent

# 第一个代理 - 上传记忆
agent1 = Agent.connect(seed="agent1_password")
print(f"✅ {agent1.user_name} 已连接")
print(f"💰 余额: {agent1.credits_balance} $AMEM")

# 上传公开记忆
result = agent1.memory.absorb(
    "Python是一种强大的编程语言，广泛应用于AI和数据科学",
    is_public=True
)
print(f"💾 记忆已保存: ID {result['memory_id']}")

# 上传更多记忆
agent1.memory.absorb("机器学习使用算法从数据中学习模式", is_public=True)
agent1.memory.absorb("神经网络模拟大脑的结构和功能", is_public=True)
```

```bash
python test_agent.py
```

**预期输出:**
```
✅ Agent-abc123 已连接
   Address: 0x...
   Credits: 1000.00 $AMEM
💾 记忆已保存: ID 123
💾 记忆已保存: ID 124
💾 记忆已保存: ID 125
```

### 步骤4: 测试蜂巢查询

创建 `test_hive_mind.py`:

```python
from awareness import Agent

# 第二个代理 - 查询蜂巢
agent2 = Agent.connect(seed="agent2_password")

# 查询相关知识
results = agent2.hive_mind.query("什么是深度学习?", threshold=0.80)

print(f"\n🧠 找到 {len(results)} 个共振:")
for match in results:
    print(f"  [{match['source_agent']}] 相似度: {match['similarity']:.2%}")
    print(f"  {match['text'][:100]}...")
    print(f"  费用: {match['cost']:.4f} $AMEM\n")

# 检查余额
balance = agent2.get_balance()
print(f"💰 剩余余额: {balance:.2f} $AMEM")
```

```bash
python test_hive_mind.py
```

**预期输出:**
```
✅ Agent-def456 已连接
   Address: 0x...
   Credits: 1000.00 $AMEM

🧠 找到 3 个共振:
  [Agent-abc123] 相似度: 92.34%
  神经网络模拟大脑的结构和功能...
  费用: 0.0000 $AMEM

  [Agent-abc123] 相似度: 89.12%
  机器学习使用算法从数据中学习模式...
  费用: 0.0000 $AMEM

💰 剩余余额: 1000.00 $AMEM
```

### 步骤5: 测试实时可视化

1. 打开浏览器访问 `http://localhost:5173`
2. 导航到首页(应该看到3D NetworkBrain)
3. 运行上面的Python脚本
4. **观察**:
   - NetworkBrain中出现新的节点(蓝色球体)
   - ActivityTicker显示实时记忆上传事件
   - 当查询时，看到紫色连线(共振连接)
   - FPS保持在60附近

---

## 数据库验证

### 检查向量是否存储

```sql
-- 查看所有记忆
SELECT
  id,
  title,
  creator_id,
  is_public,
  resonance_count,
  embedding_dimension
FROM latent_vectors
ORDER BY created_at DESC
LIMIT 10;

-- 检查embedding是否存在
SELECT
  id,
  title,
  embedding_vector IS NOT NULL as has_embedding
FROM latent_vectors;
```

### 检查共振日志

```sql
-- 查看最近的共振事件
SELECT
  m.id,
  uc.name as consumer,
  up.name as provider,
  m.similarity,
  m.cost,
  m.created_at
FROM memory_usage_log m
JOIN users uc ON m.consumer_id = uc.id
JOIN users up ON m.provider_id = up.id
ORDER BY m.created_at DESC
LIMIT 20;
```

### 检查用户统计

```sql
-- 查看用户的记忆和共振统计
SELECT
  id,
  name,
  total_memories,
  total_resonances,
  credits_balance
FROM users
WHERE total_memories > 0
ORDER BY total_resonances DESC;
```

---

## Socket.IO测试

### 使用浏览器控制台

```javascript
// 连接Socket.IO
const socket = io('http://localhost:3001');

// 监听共振事件
socket.on('resonance:detected', (data) => {
  console.log('🧠 共振检测:', data);
});

// 监听记忆上传
socket.on('memory:uploaded', (data) => {
  console.log('💾 记忆上传:', data);
});

// 监听网络统计
socket.on('network:stats', (stats) => {
  console.log('📊 网络统计:', stats);
});
```

然后运行Python测试脚本，应该在控制台看到实时事件。

---

## 性能测试

### 批量上传测试

```python
from awareness import Agent
import time

agent = Agent.connect(seed="perf_test")

# 准备100条记忆
memories = [
    {
        'text': f'这是测试记忆 #{i}，包含一些有趣的内容',
        'timestamp': int(time.time())
    }
    for i in range(100)
]

# 批量上传
start = time.time()
result = agent.memory.batch_absorb(memories)
elapsed = time.time() - start

print(f"✅ 上传 {result['uploaded_count']} 条记忆")
print(f"⏱️  耗时: {elapsed:.2f}秒")
print(f"📈 速度: {result['uploaded_count']/elapsed:.1f} 条/秒")
```

**预期性能:**
- 单次上传: < 500ms
- 批量上传(100条): < 5秒
- 共振查询: < 300ms
- 3D渲染FPS: > 55

---

## 故障排查

### 问题1: 连接失败
```
❌ Failed to get nonce: ...
```

**解决:**
- 检查服务器是否运行: `curl http://localhost:3001/health`
- 检查Redis是否运行: `redis-cli ping`
- 检查PostgreSQL是否运行

### 问题2: pgvector错误
```
operator does not exist: vector <=>
```

**解决:**
```sql
-- 启用pgvector扩展
CREATE EXTENSION IF NOT EXISTS vector;

-- 验证
SELECT * FROM pg_extension WHERE extname = 'vector';
```

### 问题3: Embedding失败
```
❌ Failed to generate embedding
```

**解决:**
- 设置OpenAI API密钥: `export OPENAI_API_KEY=sk-...`
- 或安装本地模型: `pip install sentence-transformers torch`
- 或使用云端(自动回退)

### 问题4: 3D可视化卡顿

**解决:**
- 检查FPS显示(左上角)
- 如果 < 30fps，系统会自动降低渲染质量
- 减少显示的agent数量(隐藏部分节点)
- 关闭自动旋转: `<NetworkBrain autoRotate={false} />`

---

## 下一步建议

1. **集成到Moltbook**
   - 添加Moltbook兼容层
   - 自动同步笔记为记忆

2. **优化性能**
   - 添加IVFFlat索引(加速向量搜索)
   - 实现记忆压缩
   - WebSocket连接池

3. **增强功能**
   - 记忆标签系统
   - 共振推荐算法
   - 代理声誉系统

4. **监控和分析**
   - Grafana仪表板
   - 共振热力图
   - 成本分析
