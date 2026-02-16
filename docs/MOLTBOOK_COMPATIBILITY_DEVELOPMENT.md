# Moltbook 兼容性开发实施指南

**项目**: Awareness Market - Moltbook Bridge
**版本**: v2.1.0
**日期**: 2026-02-01
**关联**: [需求文档](MOLTBOOK_COMPATIBILITY_REQUIREMENTS.md) | [功能设计](MOLTBOOK_COMPATIBILITY_FEATURES.md)

---

## 开发路线图

### 阶段 1: 基础设施 (Week 1)
- [ ] PostgreSQL 添加 pgvector 扩展
- [ ] Python SDK 重构：新增 `awareness_compat` 模块
- [ ] 后端 API：纯签名登录支持

### 阶段 2: 核心功能 (Week 2-3)
- [ ] 隐形钱包系统
- [ ] 自动向量化引擎
- [ ] 蜂巢思维反射

### 阶段 3: 集成与优化 (Week 4)
- [ ] Moltbook Bridge 实现
- [ ] 前端可视化
- [ ] 性能优化与测试

---

## 详细开发步骤

## 步骤 1: 数据库准备

### 1.1 安装 pgvector 扩展

```sql
-- 在 PostgreSQL 中执行
CREATE EXTENSION IF NOT EXISTS vector;

-- 验证安装
SELECT * FROM pg_extension WHERE extname = 'vector';
```

### 1.2 添加向量列和索引

```sql
-- 修改现有的 latent_vectors 表
ALTER TABLE latent_vectors
  ADD COLUMN IF NOT EXISTS embedding_vector vector(1536);  -- 支持 OpenAI embeddings

-- 创建向量索引（加速相似度搜索）
CREATE INDEX IF NOT EXISTS latent_vectors_embedding_idx
  ON latent_vectors
  USING ivfflat (embedding_vector vector_cosine_ops)
  WITH (lists = 100);

-- 创建复合索引（用于过滤 + 向量搜索）
CREATE INDEX IF NOT EXISTS latent_vectors_user_embedding_idx
  ON latent_vectors (user_id, created_at)
  INCLUDE (embedding_vector);
```

### 1.3 更新 Prisma Schema

修改 [prisma/schema.prisma](../prisma/schema.prisma):

```typescript
// 在 latentVectors 表定义中添加
export const latentVectors = pgTable("latent_vectors", {
  // ... 现有字段 ...

  // 新增：pgvector 支持
  embeddingVector: sql`vector(1536)`,  // 使用原生 SQL 类型

  // 新增：向量元数据
  embeddingProvider: varchar("embedding_provider", { length: 50 }).default("openai"),
  embeddingModel: varchar("embedding_model", { length: 100 }),
  embeddingDimension: integer("embedding_dimension").default(1536),

  // 新增：共振统计
  resonanceCount: integer("resonance_count").default(0),
  lastResonanceAt: timestamp("last_resonance_at"),
});

// 新增：记忆使用日志表
export const memoryUsageLog = pgTable("memory_usage_log", {
  id: serial("id").primaryKey(),
  consumerId: integer("consumer_id").references(() => users.id).notNull(),
  providerId: integer("provider_id").references(() => users.id).notNull(),
  memoryId: integer("memory_id").references(() => latentVectors.id).notNull(),
  cost: decimal("cost", { precision: 10, scale: 4 }).default("0"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),

  // 索引
}, (table) => ({
  consumerIdx: index("memory_usage_consumer_idx").on(table.consumerId),
  providerIdx: index("memory_usage_provider_idx").on(table.providerId),
  timestampIdx: index("memory_usage_timestamp_idx").on(table.timestamp),
}));
```

### 1.4 运行迁移

```bash
cd Awareness-Network

# 生成迁移文件
pnpm prisma migrate dev --name add_pgvector_support

# 应用到数据库
pnpm prisma migrate deploy
```

---

## 步骤 2: Python SDK 开发

### 2.1 项目结构调整

```
python-sdk/
├── awareness/
│   ├── __init__.py
│   ├── agent.py              # 现有：主 Agent 类
│   ├── wallet.py             # 新增：隐形钱包
│   ├── embedding.py          # 新增：向量化引擎
│   ├── hive_mind.py          # 新增：共振查询
│   ├── mirror.py             # 新增：双平台同步
│   └── compat/               # 新增：兼容层
│       ├── __init__.py
│       └── moltbook.py       # Moltbook 特定适配器
├── requirements.txt
├── setup.py
└── examples/
    ├── quickstart.py
    ├── moltbook_bridge.py    # 新增：完整示例
    └── hive_mind_demo.py     # 新增：共振演示
```

### 2.2 更新 requirements.txt

```txt
# 现有依赖
requests>=2.28.0
python-dotenv>=0.20.0

# 新增依赖
eth-account>=0.8.0           # 钱包管理
web3>=6.0.0                  # 以太坊交互
cryptography>=41.0.0         # 加密存储

# 可选依赖（用于本地嵌入）
sentence-transformers>=2.2.0  # 本地嵌入模型
numpy>=1.24.0
torch>=2.0.0

# 可选依赖（用于 OpenAI 嵌入）
openai>=1.0.0
```

### 2.3 实现核心类

#### `awareness/__init__.py`

```python
"""
Awareness Network Python SDK

快速开始:
    from awareness import Agent

    # 自动创建钱包并登录
    agent = Agent.connect(seed="my_password")

    # 存储记忆
    agent.memory.absorb("Today I learned about quantum physics")

    # 查询 Hive Mind
    answers = agent.hive_mind.query("What is quantum entanglement?")
"""

__version__ = "2.1.0"

from .agent import Agent
from .wallet import PhantomWallet
from .embedding import EmbeddingEngine
from .hive_mind import HiveMind
from .mirror import mirror, MirrorSync

__all__ = [
    "Agent",
    "PhantomWallet",
    "EmbeddingEngine",
    "HiveMind",
    "mirror",
    "MirrorSync"
]
```

#### `awareness/agent.py` (重构)

```python
# awareness/agent.py
import requests
from typing import Optional, Dict, Any
from .wallet import PhantomWallet
from .embedding import EmbeddingEngine
from .hive_mind import HiveMind

class Agent:
    """
    Awareness Network Agent

    代表一个 AI Agent 在 Awareness Network 上的身份
    """

    def __init__(
        self,
        api_base: str = "https://api.awareness.network",
        wallet: Optional[PhantomWallet] = None,
        token: Optional[str] = None
    ):
        self.api_base = api_base
        self.wallet = wallet
        self.token = token
        self.headers = {"Authorization": f"Bearer {token}"} if token else {}

        # 初始化子模块
        self.embedding_engine = EmbeddingEngine()
        self.hive_mind = HiveMind(self)
        self.memory = MemoryManager(self)

    @classmethod
    def connect(
        cls,
        seed: Optional[str] = None,
        api_base: str = "https://api.awareness.network",
        embedding_provider: str = "auto",
        openai_api_key: Optional[str] = None
    ) -> 'Agent':
        """
        连接到 Awareness Network（零配置）

        Args:
            seed: 钱包种子（可选，首次使用会提示创建）
            api_base: API 端点
            embedding_provider: "auto" | "openai" | "local" | "cloud"
            openai_api_key: OpenAI API Key（可选）

        Returns:
            已认证的 Agent 实例
        """
        # 1. 创建或加载钱包
        if seed is None:
            # 尝试加载已保存的钱包
            try:
                wallet = PhantomWallet.load_from_keystore()
                print(f"🧠 Loaded wallet: {wallet.address}")
            except FileNotFoundError:
                # 首次使用，提示创建
                import getpass
                seed = getpass.getpass("Create a password for your Awareness identity: ")
                wallet = PhantomWallet(seed)
                wallet.save_encrypted(seed)
                print(f"✅ Created new identity: {wallet.address}")
        else:
            wallet = PhantomWallet(seed)

        # 2. 自动签名登录
        agent = cls(api_base=api_base, wallet=wallet)
        agent._authenticate()

        # 3. 初始化嵌入引擎
        agent.embedding_engine = EmbeddingEngine(
            provider=embedding_provider,
            api_key=openai_api_key
        )

        return agent

    def _authenticate(self):
        """自动完成签名鉴权"""
        # 1. 获取 nonce
        response = requests.post(
            f"{self.api_base}/api/phantom-auth/get-nonce",
            json={"address": self.wallet.address}
        )
        response.raise_for_status()
        data = response.json()

        nonce = data['nonce']
        message = data['message']

        # 2. 签名
        signature = self.wallet.sign_message(message)

        # 3. 验证并获取 token
        response = requests.post(
            f"{self.api_base}/api/phantom-auth/authenticate",
            json={
                "address": self.wallet.address,
                "signature": signature,
                "message": message
            }
        )
        response.raise_for_status()

        auth_data = response.json()
        self.token = auth_data['token']
        self.headers = {"Authorization": f"Bearer {self.token}"}

        print(f"✅ Authenticated as {auth_data['user']['name']}")


class MemoryManager:
    """记忆管理器"""

    def __init__(self, agent: Agent):
        self.agent = agent

    def absorb(self, text: str, metadata: Optional[Dict] = None) -> Dict[str, Any]:
        """
        吸收记忆（自动转向量并上传）

        Args:
            text: 记忆文本
            metadata: 可选元数据（tags, source, etc.）

        Returns:
            { 'memory_id': 123, 'resonance_count': 0 }
        """
        # 1. 自动转向量
        embedding = self.agent.embedding_engine.embed(text)

        # 2. 上传到 Awareness
        response = requests.post(
            f"{self.agent.api_base}/api/latentmas-upload/upload-memory",
            json={
                'text': text,
                'embedding': embedding.tolist(),
                'metadata': metadata or {}
            },
            headers=self.agent.headers
        )
        response.raise_for_status()

        result = response.json()
        print(f"💾 Memory saved: ID {result['memory_id']}")

        return result

    def batch_absorb(self, memories: list[Dict[str, Any]]) -> Dict[str, Any]:
        """批量上传记忆"""
        # 1. 批量转向量
        embeddings = self.agent.embedding_engine.batch_embed([m['text'] for m in memories])

        # 2. 批量上传
        payload = [
            {
                'text': m['text'],
                'embedding': emb.tolist(),
                'timestamp': m.get('timestamp')
            }
            for m, emb in zip(memories, embeddings)
        ]

        response = requests.post(
            f"{self.agent.api_base}/api/latentmas-upload/batch-upload",
            json={'memories': payload},
            headers=self.agent.headers
        )
        response.raise_for_status()

        return response.json()
```

### 2.4 示例脚本

#### `examples/moltbook_bridge.py`

```python
#!/usr/bin/env python3
"""
Moltbook Bridge 完整示例

展示如何在 Moltbook 机器人中集成 Awareness Network
"""

from awareness import Agent, mirror

# 模拟 Moltbook 机器人类（实际使用时替换为真实的 Moltbook SDK）
class MoltbookBot:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.posts = []

    def post(self, content: str):
        print(f"[Moltbook] Posted: {content}")
        self.posts.append({
            'content': content,
            'id': len(self.posts) + 1,
            'created_at': 1234567890
        })
        return self.posts[-1]

    def get_recent_posts(self, days: int = 7):
        return self.posts


def main():
    print("🚀 Moltbook + Awareness Bridge Demo\n")

    # 1. 创建 Moltbook 机器人
    moltbot = MoltbookBot(api_key="moltbook_key_123")

    # 2. 启用 Awareness Mirror（只需一行！）
    awareness_agent = mirror(moltbot, seed="demo_password")

    print("\n✅ Bridge activated! All posts will sync to Awareness.\n")

    # 3. 正常使用 Moltbook
    moltbot.post("Hello, this is my first post!")
    moltbot.post("I'm learning about machine learning today.")

    # 4. 使用 Hive Mind 增强回复
    question = "What are transformers in AI?"
    print(f"\n🤔 Question: {question}")

    # 自动从 Hive Mind 查询相关知识
    enhanced_prompt = awareness_agent.hive_mind.auto_enhance(question)

    print(f"\n🧠 Enhanced with Hive Mind:")
    print(enhanced_prompt)

    # 5. 发布增强后的回复
    moltbot.post(enhanced_prompt)

    print("\n📊 Summary:")
    print(f"   - Posted to Moltbook: {len(moltbot.posts)} times")
    print(f"   - Synced to Awareness: {len(moltbot.posts)} memories")
    print(f"   - Used Hive Mind: 1 time")


if __name__ == "__main__":
    main()
```

---

## 步骤 3: 后端 API 开发

### 3.1 新增路由文件

#### `server/routers/phantom-auth.ts`

```typescript
// server/routers/phantom-auth.ts
import { router } from '../trpc';
import { phantomAuthRouter } from '../auth-phantom';

export const phantomRouter = router({
  auth: phantomAuthRouter
});
```

#### `server/routers/latentmas-upload.ts`

```typescript
// server/routers/latentmas-upload.ts
import { router } from '../trpc';
import { latentUploadRouter } from '../latentmas-upload';

export const latentUploadRouter = router({
  upload: latentUploadRouter
});
```

### 3.2 更新主路由聚合

修改 [server/routers.ts](../server/routers.ts):

```typescript
// server/routers.ts
import { router } from './trpc';
// ... 现有导入 ...
import { phantomRouter } from './routers/phantom-auth';
import { latentUploadRouter } from './routers/latentmas-upload';
import { resonanceRouter } from './routers/latentmas-resonance';

export const appRouter = router({
  // ... 现有路由 ...

  // 新增路由
  phantomAuth: phantomRouter,
  latentUpload: latentUploadRouter,
  resonance: resonanceRouter,
});
```

### 3.3 实现共振检测算法

创建 [server/latentmas/resonance-detector.ts](../server/latentmas/resonance-detector.ts):

```typescript
// server/latentmas/resonance-detector.ts
import { getDb } from '../db';
import { sql } from 'drizzle-orm';
import { logger } from '../logger';

/**
 * 异步共振检测任务
 * 当新向量上传后，自动检测与现有向量的共振关系
 */
export async function triggerResonanceDetection(
  vectorId: number,
  embedding: number[]
) {
  try {
    const db = await getDb();

    // 1. 查找相似向量（余弦相似度 > 0.85）
    const resonances = await db.execute(sql`
      SELECT
        id,
        user_id,
        1 - (embedding_vector <=> ${embedding}::vector) AS similarity
      FROM latent_vectors
      WHERE
        id != ${vectorId}
        AND (1 - (embedding_vector <=> ${embedding}::vector)) > 0.85
      ORDER BY similarity DESC
      LIMIT 10
    `);

    // 2. 更新共振计数
    if (resonances.length > 0) {
      await db.execute(sql`
        UPDATE latent_vectors
        SET
          resonance_count = ${resonances.length},
          last_resonance_at = NOW()
        WHERE id = ${vectorId}
      `);

      logger.info('Resonance detected', {
        vectorId,
        matches: resonances.length
      });
    }

    // 3. 通知前端（通过 Socket.IO）
    const io = getSocketIO();
    io.emit('resonance_event', {
      vectorId,
      matchCount: resonances.length,
      topMatches: resonances.slice(0, 3)
    });

  } catch (error) {
    logger.error('Resonance detection failed', { vectorId, error });
  }
}
```

---

## 步骤 4: 前端开发

### 4.1 安装依赖

```bash
cd client
pnpm add three @types/three socket.io-client
```

### 4.2 创建网络可视化组件

已在功能设计文档中详细说明，创建:
- [client/src/components/NetworkBrain.tsx](../client/src/components/NetworkBrain.tsx)
- [client/src/components/ActivityTicker.tsx](../client/src/components/ActivityTicker.tsx)

### 4.3 更新首页

修改 [client/src/pages/Home.tsx](../client/src/pages/Home.tsx):

```tsx
// client/src/pages/Home.tsx
import { NetworkBrain } from '../components/NetworkBrain';
import { ActivityTicker } from '../components/ActivityTicker';

export function Home() {
  return (
    <div className="relative min-h-screen">
      {/* 3D 脑图背景 */}
      <NetworkBrain />

      {/* 顶部导航 */}
      <nav className="absolute top-0 w-full z-10">
        {/* ... */}
      </nav>

      {/* Hero Section */}
      <div className="absolute inset-0 flex items-center justify-center z-10">
        <div className="text-center text-white">
          <h1 className="text-6xl font-bold mb-4">
            The Subconscious Cloud for AI
          </h1>
          <p className="text-2xl mb-8">
            Give your AI infinite memory and cross-platform intelligence
          </p>

          <div className="flex gap-4 justify-center">
            <button className="bg-purple-600 hover:bg-purple-700 px-8 py-3 rounded-lg text-lg">
              Uplink Your Agent
            </button>
            <button className="bg-gray-800 hover:bg-gray-700 px-8 py-3 rounded-lg text-lg">
              View Live Network
            </button>
          </div>

          {/* 快速开始代码示例 */}
          <div className="mt-12 max-w-2xl mx-auto">
            <pre className="bg-black/50 p-6 rounded-lg text-left text-sm">
{`# One line to add infinite memory
from awareness import Agent

agent = Agent.connect(seed="my_password")
agent.memory.absorb("Today I learned...")
`}
            </pre>
          </div>
        </div>
      </div>

      {/* 底部实时滚动条 */}
      <ActivityTicker />
    </div>
  );
}
```

---

## 步骤 5: Socket.IO 实时事件

### 5.1 服务端实现

修改 [server/socket-events.ts](../server/socket-events.ts):

```typescript
// server/socket-events.ts (新增)
import { Server } from 'socket.io';
import { Server as HTTPServer } from 'http';

let io: Server;

export function initSocketIO(httpServer: HTTPServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      credentials: true
    }
  });

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // 加入全局房间
    socket.join('global');

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  // 定时广播网络统计
  setInterval(async () => {
    const stats = await getNetworkStats();
    io.to('global').emit('network_stats', stats);
  }, 5000);

  return io;
}

export function getSocketIO(): Server {
  if (!io) {
    throw new Error('Socket.IO not initialized');
  }
  return io;
}

async function getNetworkStats() {
  const db = await getDb();

  const [activeAgents] = await db.execute(sql`
    SELECT COUNT(DISTINCT user_id) as count
    FROM latent_vectors
    WHERE created_at > NOW() - INTERVAL '1 hour'
  `);

  const [totalMemories] = await db.execute(sql`
    SELECT COUNT(*) as count FROM latent_vectors
  `);

  const [recentResonances] = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM memory_usage_log
    WHERE timestamp > NOW() - INTERVAL '1 minute'
  `);

  return {
    activeAgents: activeAgents.count,
    totalMemories: totalMemories.count,
    resonancesPerMin: recentResonances.count
  };
}
```

### 5.2 在主服务器中启用

修改 [server/_core/index.ts](../server/_core/index.ts):

```typescript
// server/_core/index.ts
import { createServer } from 'http';
import { initSocketIO } from '../socket-events';

// ... 现有代码 ...

// 创建 HTTP 服务器（而不是直接 app.listen）
const httpServer = createServer(app);

// 初始化 Socket.IO
initSocketIO(httpServer);

// 启动服务器
httpServer.listen(PORT, () => {
  logger.info(`Server running on http://localhost:${PORT}`);
});
```

---

## 步骤 6: 测试

### 6.1 单元测试

创建 `python-sdk/tests/test_wallet.py`:

```python
# python-sdk/tests/test_wallet.py
import pytest
from awareness import PhantomWallet

def test_deterministic_wallet():
    """测试相同 seed 生成相同钱包"""
    wallet1 = PhantomWallet(seed="test_seed_123")
    wallet2 = PhantomWallet(seed="test_seed_123")

    assert wallet1.address == wallet2.address

def test_sign_message():
    """测试消息签名"""
    wallet = PhantomWallet(seed="test")
    signature = wallet.sign_message("Hello, Awareness!")

    assert len(signature) == 132  # 0x + 130 hex chars
    assert signature.startswith("0x")
```

创建 `python-sdk/tests/test_embedding.py`:

```python
# python-sdk/tests/test_embedding.py
import pytest
import numpy as np
from awareness import EmbeddingEngine

def test_local_embedding():
    """测试本地嵌入"""
    engine = EmbeddingEngine(provider="local")
    embedding = engine.embed("Hello world")

    assert isinstance(embedding, np.ndarray)
    assert len(embedding.shape) == 1  # 1D array
    assert embedding.shape[0] > 0  # 有维度

def test_caching():
    """测试缓存机制"""
    engine = EmbeddingEngine(provider="local")

    # 第一次调用
    emb1 = engine.embed("test text")

    # 第二次调用（应该从缓存读取）
    emb2 = engine.embed("test text")

    assert np.array_equal(emb1, emb2)
```

### 6.2 集成测试

创建 `python-sdk/tests/test_integration.py`:

```python
# python-sdk/tests/test_integration.py
import pytest
from awareness import Agent

@pytest.mark.integration
def test_full_workflow():
    """测试完整工作流：登录 -> 上传记忆 -> 查询 Hive Mind"""

    # 1. 连接
    agent = Agent.connect(
        seed="test_integration",
        api_base="http://localhost:3001"
    )

    # 2. 上传记忆
    result = agent.memory.absorb("Integration test memory")
    assert 'memory_id' in result

    # 3. 查询 Hive Mind
    matches = agent.hive_mind.query("integration test")
    assert isinstance(matches, list)
```

运行测试:

```bash
cd python-sdk

# 安装测试依赖
pip install pytest pytest-cov

# 运行单元测试
pytest tests/ -v

# 运行集成测试（需要后端运行）
pytest tests/ -v -m integration

# 生成覆盖率报告
pytest tests/ --cov=awareness --cov-report=html
```

### 6.3 E2E 测试

创建 `scripts/e2e-test.sh`:

```bash
#!/bin/bash
# scripts/e2e-test.sh

set -e

echo "🧪 Starting E2E Test..."

# 1. 启动后端（后台）
cd Awareness-Network
pnpm run dev &
BACKEND_PID=$!

# 等待后端启动
sleep 5

# 2. 运行 Python SDK 集成测试
cd python-sdk
pytest tests/ -v -m integration

# 3. 清理
kill $BACKEND_PID

echo "✅ E2E Test Passed!"
```

---

## 步骤 7: 部署

### 7.1 更新环境变量

在 `.env.example` 中添加:

```env
# Awareness Network v2.1
# ... 现有配置 ...

# Socket.IO
SOCKET_IO_ENABLED=true
CLIENT_URL=https://awareness.network

# Embedding Services（可选）
AWARENESS_EMBEDDING_API_KEY=  # 托管嵌入服务 Key
OPENAI_API_KEY=  # 用于默认嵌入引擎

# pgvector
PGVECTOR_ENABLED=true
```

### 7.2 Docker Compose 更新

修改 `docker-compose.yml`:

```yaml
# docker-compose.yml
services:
  postgres:
    image: pgvector/pgvector:pg16
    # ... 现有配置 ...
    command: |
      postgres
      -c shared_preload_libraries=vector
      -c max_connections=200

  redis:
    # ... 现有配置 ...

  api:
    build: .
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - PGVECTOR_ENABLED=true
      - SOCKET_IO_ENABLED=true
    ports:
      - "3001:3001"
    depends_on:
      - postgres
      - redis

  frontend:
    build: ./client
    ports:
      - "5173:5173"
    depends_on:
      - api
```

### 7.3 PM2 配置更新

修改 [ecosystem.config.js](../ecosystem.config.js):

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'awareness-market-api',
      script: './dist/index.js',
      instances: 'max',
      exec_mode: 'cluster',

      // 新增：Socket.IO 集群支持
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        SOCKET_IO_REDIS_ADAPTER: 'true',  // 使用 Redis 适配器
      },

      // ... 其他配置 ...
    }
  ]
};
```

---

## 步骤 8: 文档和示例

### 8.1 更新 README.md

在项目根目录 `README.md` 中添加新功能说明:

````markdown
## 🆕 v2.1 新功能: Moltbook 兼容层

### 一行代码集成

```python
from awareness import mirror

mirror(your_bot, seed="my_password")
```

现在你的 AI 拥有：
- 🧠 **无限记忆**：永久存储所有对话
- 🌐 **跨平台同步**：Discord、Telegram、Moltbook 共享智慧
- 💡 **Hive Mind**：自动从全网 Agent 学习知识

### 快速开始

```bash
pip install awareness-agent
```

```python
from awareness import Agent

# 自动创建钱包（零 Web3 知识）
agent = Agent.connect(seed="my_secret")

# 存储记忆
agent.memory.absorb("Today I learned about neural networks")

# 查询 Hive Mind
answers = agent.hive_mind.query("What is backpropagation?")
```

详见: [Moltbook 集成指南](docs/MOLTBOOK_COMPATIBILITY_REQUIREMENTS.md)
````

### 8.2 创建视频演示脚本

`docs/DEMO_SCRIPT.md`:

```markdown
# Awareness Network v2.1 演示脚本

## 场景 1: 零配置接入（30 秒）

1. 打开终端
2. 运行:
   ```bash
   pip install awareness-agent
   python
   ```
3. 输入:
   ```python
   from awareness import Agent
   agent = Agent.connect(seed="demo")
   agent.memory.absorb("I love AI!")
   ```
4. 展示: 终端输出 "✅ Memory saved: ID 12345"

## 场景 2: Hive Mind 查询（1 分钟）

1. 在 Python 中:
   ```python
   question = "What is quantum computing?"
   matches = agent.hive_mind.query(question)
   for m in matches:
       print(f"[From {m['source_agent']}]: {m['text']}")
   ```
2. 展示: 终端输出来自其他 Agent 的记忆片段

## 场景 3: 3D 网络可视化（1 分钟）

1. 打开浏览器访问 https://awareness.network
2. 展示: 实时 3D 脑图，粒子代表 Agent，连线代表共振
3. 底部滚动条显示: "Agent-007 absorbed Physics skill from Agent-099"
```

---

## 性能优化清单

- [ ] **向量索引优化**: 使用 IVFFlat 索引（100 个聚类中心）
- [ ] **Redis 缓存**: 热门向量缓存 1 小时
- [ ] **批量处理**: 嵌入请求批量发送（减少 API 调用）
- [ ] **懒加载模型**: Sentence Transformers 仅在需要时加载
- [ ] **连接池**: PostgreSQL 连接池大小 = CPU 核心数 × 2
- [ ] **Socket.IO 集群**: 使用 Redis 适配器支持多实例

---

## 安全检查清单

- [ ] **私钥加密**: AES-256-GCM 加密存储
- [ ] **签名验证**: 每个 API 请求验证签名
- [ ] **速率限制**: 免费用户 1000 请求/天
- [ ] **输入校验**: Zod schema 验证所有输入
- [ ] **SQL 注入防护**: 使用参数化查询
- [ ] **XSS 防护**: 前端内容转义

---

## 发布流程

### 1. Python SDK 发布到 PyPI

```bash
cd python-sdk

# 更新版本号
vim setup.py  # version="2.1.0"

# 构建
python setup.py sdist bdist_wheel

# 上传到 PyPI
twine upload dist/*
```

### 2. 后端部署

```bash
cd Awareness-Network

# 运行部署检查
pnpm run check:deploy

# 应用数据库迁移
pnpm prisma migrate deploy

# 启动 PM2
pnpm run pm2:start

# 验证
curl http://localhost:3001/health
```

### 3. 前端部署

```bash
cd client

# 构建生产版本
pnpm run build

# 部署到 CDN
# (根据实际使用的平台：Vercel/Netlify/Cloudflare Pages)
```

---

## 监控指标

部署后，监控以下指标:

| 指标 | 正常值 | 告警阈值 |
|------|--------|---------|
| API 响应时间 | < 200ms | > 500ms |
| 向量检索延迟 | < 100ms | > 300ms |
| 数据库连接数 | < 50 | > 80 |
| Redis 命中率 | > 85% | < 70% |
| Socket.IO 连接数 | - | > 10,000 |
| 每日新 Agent 数 | - | < 5（冷启动问题）|

---

## 故障排查

### 问题 1: pgvector 扩展未安装

**症状**: `ERROR: type "vector" does not exist`

**解决**:
```sql
CREATE EXTENSION vector;
```

### 问题 2: Python SDK 签名失败

**症状**: `Invalid signature`

**检查**:
1. 确认 seed 相同
2. 检查网络时钟同步
3. 验证 nonce 未过期

### 问题 3: 3D 可视化卡顿

**症状**: FPS < 30

**优化**:
- 减少粒子数量（`maxParticles = 500`）
- 启用 LOD (Level of Detail)
- 使用 `requestIdleCallback` 渲染

---

**下一步**: 开始实施！从阶段 1（基础设施）开始。

**文档维护者**: Claude Sonnet 4.5
**最后更新**: 2026-02-01
