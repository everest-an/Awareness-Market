# Python SDK 对比指南

> 选择适合你的 Awareness Network Python SDK

**最后更新**: 2026-02-06

---

## 📦 两个 SDK 概览

Awareness Network 提供**两个不同的 Python SDK**，分别针对不同的使用场景：

| 特性 | 轻量级 SDK | 完整 SDK |
|------|-----------|---------|
| **位置** | `sdk/python/` | `python-sdk/` |
| **文件数** | 2 个主文件 | 10+ 个模块 |
| **安装大小** | ~50 KB | ~500 KB |
| **依赖** | 仅 `requests` | `requests`, `numpy`, `cryptography` 等 |
| **适用场景** | 快速集成、简单脚本 | 生产应用、复杂功能 |
| **学习曲线** | ⭐ 简单 | ⭐⭐⭐ 中等 |
| **功能完整度** | 基础功能 | 完整功能 |

---

## 🚀 轻量级 SDK (`sdk/python/`)

### 特点

✅ **优势**:
- 单文件设计，易于理解
- 零配置，开箱即用
- 适合快速原型开发
- 同步和异步版本都有

❌ **限制**:
- 功能相对基础
- 不支持高级特性（钱包、嵌入引擎等）
- 错误处理较简单

### 使用场景

适合以下情况：
- 🎯 快速测试 API
- 🎯 简单的脚本自动化
- 🎯 学习 Awareness Network API
- 🎯 不需要复杂功能的小项目

### 快速开始

```python
# 安装
pip install requests

# 使用
from awareness_network_sdk import AwarenessNetworkClient

client = AwarenessNetworkClient(api_key="your_api_key")

# 搜索向量
vectors = client.search_vectors(category="nlp", min_rating=4.0)

# 购买和使用
access = client.purchase_vector(vector_id=123)
result = client.invoke_vector(access.access_token, {"text": "Hello"})
```

### 文件结构

```
sdk/python/
├── awareness_network_sdk.py      # 同步客户端
├── awareness_network_async.py    # 异步客户端
├── README.md                      # 文档
└── setup.py                       # 安装脚本
```

---

## 🏢 完整 SDK (`python-sdk/`)

### 特点

✅ **优势**:
- 模块化设计，易于扩展
- 完整的功能覆盖
- 生产级错误处理
- 支持高级特性（钱包、嵌入、Hive Mind）
- 完善的类型提示
- 详细的文档和示例

❌ **限制**:
- 学习曲线较陡
- 依赖较多
- 文件较大

### 使用场景

适合以下情况：
- 🎯 生产环境应用
- 🎯 需要完整功能的项目
- 🎯 AI Agent 开发
- 🎯 需要钱包管理和加密
- 🎯 需要本地嵌入引擎
- 🎯 需要 Hive Mind 集成

### 快速开始

```python
# 安装
pip install awareness-sdk

# 方式 1: 使用统一客户端
from awareness_sdk import AwarenessClient

client = AwarenessClient(api_key="your_api_key")

# 访问各个服务
memories = client.memory_exchange.browse_memories(limit=10)
matrices = client.w_matrix.browse_listings()
result = client.kv_cache.compress(...)

# 方式 2: 使用 Agent SDK
from awareness import Agent

agent = Agent.connect(seed="my_password")
agent.memory.absorb("Today I learned about quantum computing")
results = agent.hive_mind.query("What is quantum entanglement?")
```

### 文件结构

```
python-sdk/
├── awareness/                     # Agent SDK
│   ├── __init__.py
│   ├── agent.py                  # Agent 主类
│   ├── wallet.py                 # Phantom 钱包
│   └── embedding.py              # 嵌入引擎
├── awareness_sdk/                # 市场 SDK
│   ├── __init__.py
│   ├── client.py                 # 统一客户端
│   ├── packages.py               # 包管理
│   ├── memory_exchange.py        # 内存交换
│   ├── w_matrix.py               # W-Matrix
│   ├── kv_cache.py               # KV-Cache
│   └── exceptions.py             # 异常定义
├── examples/                     # 示例代码
│   ├── basic_usage.py
│   └── kv_cache_compression_example.py
├── README.md                      # 主文档
├── README_KV_CACHE.md            # KV-Cache 文档
└── setup.py                       # 安装脚本
```

---

## 🎯 选择指南

### 决策树

```
需要快速测试 API？
├─ 是 → 使用轻量级 SDK
└─ 否 → 继续

需要生产级应用？
├─ 是 → 使用完整 SDK
└─ 否 → 继续

需要钱包管理？
├─ 是 → 使用完整 SDK
└─ 否 → 继续

需要本地嵌入引擎？
├─ 是 → 使用完整 SDK
└─ 否 → 继续

需要 Hive Mind 功能？
├─ 是 → 使用完整 SDK
└─ 否 → 轻量级 SDK 即可
```

### 场景对比

| 场景 | 推荐 SDK | 原因 |
|------|---------|------|
| 学习 API | 轻量级 | 简单直观 |
| 快速原型 | 轻量级 | 快速上手 |
| 生产应用 | 完整 | 功能完整，错误处理好 |
| AI Agent | 完整 | 需要 Agent 类和 Hive Mind |
| 数据分析脚本 | 轻量级 | 够用且简单 |
| 企业集成 | 完整 | 需要完整功能和安全性 |
| 移动应用后端 | 完整 | 需要钱包和加密 |
| Serverless 函数 | 轻量级 | 冷启动快 |

---

## 📊 功能对比

### API 覆盖

| 功能 | 轻量级 SDK | 完整 SDK |
|------|-----------|---------|
| **向量市场** | ✅ | ✅ |
| **内存交换** | ✅ | ✅ |
| **W-Matrix** | ✅ | ✅ |
| **KV-Cache** | ✅ | ✅ |
| **包管理** | ❌ | ✅ |
| **钱包管理** | ❌ | ✅ |
| **嵌入引擎** | ❌ | ✅ |
| **Hive Mind** | ❌ | ✅ |
| **Agent 类** | ❌ | ✅ |

### 高级特性

| 特性 | 轻量级 SDK | 完整 SDK |
|------|-----------|---------|
| **类型提示** | 部分 | 完整 |
| **异步支持** | ✅ | ✅ |
| **错误处理** | 基础 | 完善 |
| **重试机制** | ❌ | ✅ |
| **日志记录** | ❌ | ✅ |
| **测试覆盖** | 基础 | 完整 |
| **文档** | 基础 | 详细 |

---

## 🔄 迁移指南

### 从轻量级迁移到完整 SDK

如果你开始使用轻量级 SDK，后来需要更多功能，迁移很简单：

**轻量级 SDK**:
```python
from awareness_network_sdk import AwarenessNetworkClient

client = AwarenessNetworkClient(api_key="key")
vectors = client.search_vectors(category="nlp")
```

**完整 SDK**:
```python
from awareness_sdk import AwarenessClient

client = AwarenessClient(api_key="key")
# 使用相同的 API，但有更多功能
vectors = client.vector_packages.search(category="nlp")
```

大部分 API 调用是兼容的，只需要改变导入和客户端初始化。

---

## 📚 学习资源

### 轻量级 SDK
- [README](../../sdk/python/README.md)
- [API 参考](../../sdk/python/awareness_network_sdk.py)
- [示例代码](../../examples/python_example.py)

### 完整 SDK
- [主 README](../../python-sdk/README.md)
- [KV-Cache 文档](../../python-sdk/README_KV_CACHE.md)
- [示例代码](../../python-sdk/examples/)
- [API 文档](../api/)

---

## 🤔 常见问题

### Q: 可以同时使用两个 SDK 吗？

A: 技术上可以，但不推荐。选择一个适合你需求的 SDK 即可。

### Q: 哪个 SDK 性能更好？

A: 轻量级 SDK 启动更快（适合 Serverless），完整 SDK 运行时性能相似但功能更多。

### Q: 完整 SDK 的依赖会影响部署吗？

A: 如果你不使用嵌入引擎，可以不安装 `numpy` 等依赖。SDK 会自动降级到云端服务。

### Q: 未来会合并两个 SDK 吗？

A: 不会。它们服务于不同的用例，保持分离更好。

---

## 💡 最佳实践

### 轻量级 SDK

```python
# ✅ 好的做法
client = AwarenessNetworkClient(api_key=os.getenv("API_KEY"))

# ❌ 避免
client = AwarenessNetworkClient(api_key="hardcoded_key")
```

### 完整 SDK

```python
# ✅ 好的做法 - 使用 Agent 类
agent = Agent.connect(seed=os.getenv("SEED"))
agent.memory.absorb("Important information")

# ✅ 好的做法 - 使用统一客户端
client = AwarenessClient(api_key=os.getenv("API_KEY"))
result = client.memory_exchange.browse_memories()

# ❌ 避免 - 直接使用子客户端
from awareness_sdk.memory_exchange import MemoryExchangeClient
client = MemoryExchangeClient(...)  # 不推荐
```

---

## 📞 获取帮助

- 轻量级 SDK 问题: [GitHub Issues](https://github.com/awareness-network/sdk-python/issues)
- 完整 SDK 问题: [GitHub Issues](https://github.com/awareness-network/python-sdk/issues)
- 通用问题: [Discord 社区](https://discord.gg/awareness)

---

*选择合适的工具，事半功倍！*
