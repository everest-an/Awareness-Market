# 🧠 RMC-Inspired Memory Architecture
## Relational Memory Core for Multi-AI Collaboration

**基于**: DeepMind RMC 思想
**目标**: 多 AI 协作时的关联推理和决策支持
**核心**: "图 + 向量" 混合架构

---

## 🎯 核心概念

### 1. Memory Slot = Object（不再是 String）

```typescript
interface MemorySlot {
  // 基础标识
  id: string;                    // mem_uuid_v4_1024
  content: string;               // 原始文本
  agentId: string;               // 生产该记忆的 AI
  timestamp: Date;

  // 向量检索部分（模糊匹配）
  embedding: number[];           // 1536 维向量

  // 结构化部分（精确匹配）
  entities: Entity[];            // 提取的实体
  concepts: string[];            // 提取的概念

  // 关系部分（推理核心）
  relations: Relation[];         // 与其他记忆的关系

  // 元数据
  confidence: number;
  usageCount: number;
}

interface Entity {
  name: string;                  // "SpaceX"
  type: EntityType;              // "Company"
  mentions: number;              // 在文本中出现次数
}

interface Relation {
  targetMemoryId: string;        // 目标记忆 ID
  relationType: RelationType;    // 关系类型
  strength: number;              // 关系强度 (0-1)
  inferredBy: string;            // "llm" | "rule" | "user"
  reason?: string;               // 推理原因
}

enum RelationType {
  CAUSES = "CAUSES",                    // 因果关系
  CONTRADICTS = "CONTRADICTS",          // 矛盾关系
  SUPPORTS = "SUPPORTS",                // 支持关系
  TEMPORAL_BEFORE = "TEMPORAL_BEFORE",  // 时序：之前
  TEMPORAL_AFTER = "TEMPORAL_AFTER",    // 时序：之后
  DERIVED_FROM = "DERIVED_FROM",        // 派生自
  PART_OF = "PART_OF",                  // 部分-整体
  SIMILAR_TO = "SIMILAR_TO",            // 相似
}

enum EntityType {
  COMPANY = "Company",
  PRODUCT = "Product",
  PERSON = "Person",
  METRIC = "Metric",
  EVENT = "Event",
  CONCEPT = "Concept",
}
```

---

## 🏗️ 架构设计

### 分层架构

```
┌─────────────────────────────────────────────────────────┐
│  Multi-AI Collaboration Layer (金融AI, 物理AI, ...)    │
├─────────────────────────────────────────────────────────┤
│  Inference Engine (推理路径发现)                        │
│  - Path Finder (图谱游走)                              │
│  - Context Synthesizer (上下文合成)                    │
├─────────────────────────────────────────────────────────┤
│  Hybrid Retrieval Layer (混合检索)                      │
│  - Vector Search (向量检索)                             │
│  - Graph Traversal (图谱遍历)                          │
├─────────────────────────────────────────────────────────┤
│  Relation Builder (关系构建器)                          │
│  - Entity Extractor (实体提取)                         │
│  - Relation Inference (关系推理)                       │
│  - Link Manager (连接管理)                             │
├─────────────────────────────────────────────────────────┤
│  Storage Layer (存储层)                                 │
│  - PostgreSQL + pgvector (向量存储)                    │
│  - Graph Structure (关系图谱)                          │
│    * PostgreSQL Recursive Queries (轻量方案)           │
│    * Neo4j (专业图数据库，可选)                        │
└─────────────────────────────────────────────────────────┘
```

---

## 🔄 核心流程

### Phase 1: 写入与实体化 (Write & Entity Extraction)

**当 AI Agent 产生输出时：**

```typescript
// 1. 记忆网关接收
const rawOutput = {
  agentId: "Physics_Agent_01",
  content: "SpaceX 的 Starship 第四次试飞成功，成本降低了40%。",
};

// 2. 实体提取 (LLM Call)
const entities = await extractEntities(rawOutput.content);
// 结果: [
//   { name: "SpaceX", type: "Company" },
//   { name: "Starship", type: "Product" },
//   { name: "成本", type: "Metric" },
//   { name: "试飞", type: "Event" }
// ]

// 3. 向量化
const embedding = await generateEmbedding(rawOutput.content);

// 4. 存入数据库
const memoryId = await memoryCore.create({
  content: rawOutput.content,
  agentId: rawOutput.agentId,
  embedding,
  entities,
});

// 5. 触发关系构建（异步）
await relationBuilder.buildRelations(memoryId);
```

---

### Phase 2: 关系构建 (Relation Building)

**模拟 RMC 的 Attention(Memory, Memory)：**

```typescript
class RelationBuilder {
  async buildRelations(newMemoryId: string) {
    const newMemory = await this.getMemory(newMemoryId);

    // Step 1: 找候选记忆（两种方式）
    const candidates = await this.findCandidates(newMemory);

    // Step 2: 对每个候选，计算关系
    for (const candidate of candidates) {
      const relation = await this.inferRelation(newMemory, candidate);

      if (relation.type !== "NONE") {
        // Step 3: 存入图谱
        await this.saveRelation({
          sourceId: newMemoryId,
          targetId: candidate.id,
          type: relation.type,
          strength: relation.strength,
          reason: relation.reason,
        });
      }
    }
  }

  async findCandidates(memory: MemorySlot): Promise<MemorySlot[]> {
    // 方法 1: 向量相似度（Top-5）
    const vectorCandidates = await this.vectorSearch(memory.embedding, 5);

    // 方法 2: 实体共现（相同实体的记忆）
    const entityCandidates = await this.entitySearch(memory.entities);

    // 合并去重
    return this.deduplicate([...vectorCandidates, ...entityCandidates]);
  }

  async inferRelation(
    memA: MemorySlot,
    memB: MemorySlot
  ): Promise<{ type: RelationType; strength: number; reason: string }> {
    // 调用 LLM 推理关系
    const prompt = `
分析以下两段记忆的关系：

记忆 A (来自 ${memA.agentId}):
"${memA.content}"

记忆 B (来自 ${memB.agentId}):
"${memB.content}"

请判断它们的关系类型：
- CAUSES: A 导致 B
- CONTRADICTS: A 与 B 矛盾
- SUPPORTS: A 支持 B
- TEMPORAL_BEFORE: A 发生在 B 之前
- SIMILAR_TO: A 与 B 相似
- NONE: 无明显关系

输出 JSON 格式：
{
  "type": "CAUSES",
  "strength": 0.85,
  "reason": "技术突破导致成本降低"
}
`;

    const response = await this.llm.predict(prompt);
    return JSON.parse(response);
  }
}
```

---

### Phase 3: 混合检索推理 (Hybrid Retrieval)

**当另一个 AI 需要决策时：**

```typescript
class AwarenessRetriever {
  async retrieve(query: string, options?: {
    maxDepth?: number;      // 图谱游走深度（默认 2）
    relationTypes?: RelationType[];  // 关注的关系类型
    agentFilter?: string[]; // 只检索特定 AI 的记忆
  }): Promise<RetrievalResult> {

    // Step 1: 向量检索（直觉层）
    const vectorResults = await this.vectorSearch(query, 5);

    // Step 2: 图谱扩展（推理层）
    const graphContext = await this.expandGraph(vectorResults, {
      maxDepth: options?.maxDepth || 2,
      relationTypes: options?.relationTypes || [
        RelationType.CAUSES,
        RelationType.SUPPORTS,
        RelationType.CONTRADICTS,
      ],
    });

    // Step 3: 推理路径发现
    const inferencePaths = this.findInferencePaths(vectorResults, graphContext);

    // Step 4: 合成上下文
    return {
      directMatches: vectorResults,      // 直接匹配的记忆
      relatedContext: graphContext,      // 关联上下文
      inferencePaths,                    // 推理路径（可 NFT 化）
    };
  }

  async expandGraph(
    startNodes: MemorySlot[],
    options: { maxDepth: number; relationTypes: RelationType[] }
  ): Promise<GraphContext> {
    const visited = new Set<string>();
    const context: MemorySlot[] = [];
    const edges: Relation[] = [];

    // BFS 图谱游走
    const queue = startNodes.map(n => ({ node: n, depth: 0 }));

    while (queue.length > 0) {
      const { node, depth } = queue.shift()!;

      if (depth >= options.maxDepth || visited.has(node.id)) continue;
      visited.add(node.id);

      // 查找邻居（只关注特定关系类型）
      const neighbors = await this.getNeighbors(node.id, options.relationTypes);

      for (const neighbor of neighbors) {
        context.push(neighbor.memory);
        edges.push(neighbor.relation);
        queue.push({ node: neighbor.memory, depth: depth + 1 });
      }
    }

    return { memories: context, relations: edges };
  }

  findInferencePaths(
    startNodes: MemorySlot[],
    graph: GraphContext
  ): InferencePath[] {
    const paths: InferencePath[] = [];

    // 寻找因果链：A -> CAUSES -> B -> CAUSES -> C
    for (const start of startNodes) {
      const causePaths = this.dfs(
        start.id,
        graph,
        [RelationType.CAUSES],
        3  // 最多 3 跳
      );

      paths.push(...causePaths.map(p => ({
        type: "causal_chain",
        nodes: p,
        description: this.generatePathDescription(p),
      })));
    }

    return paths;
  }
}

interface RetrievalResult {
  directMatches: MemorySlot[];        // 向量检索结果
  relatedContext: GraphContext;       // 图谱扩展结果
  inferencePaths: InferencePath[];    // 推理路径
}

interface InferencePath {
  type: "causal_chain" | "contradiction_resolution" | "multi_hop_support";
  nodes: MemorySlot[];
  description: string;
}
```

---

## 🎬 完整使用案例

### 场景：预测科技公司股价

**时间线：**

#### T1: 物理 AI 说话
```typescript
// Physics_Agent_01 输出
await memoryCore.add({
  agentId: "Physics_Agent_01",
  content: "公司发布了新型超导电池，能效提升50%。",
});

// 系统自动处理：
// 1. 提取实体: ["公司", "超导电池", "能效"]
// 2. 生成向量
// 3. 查找相关记忆 -> 发现 mem_0988: "电力成本占公司支出30%"
// 4. LLM 推理关系 -> IMPACTS (能效提升 -> 影响 -> 电力成本)
// 5. 存入图谱: (mem_1024) -[IMPACTS]-> (mem_0988)
```

#### T2: 金融 AI 决策
```typescript
// Finance_Agent_01 查询
const context = await memoryRetriever.retrieve(
  "这家公司的股价会涨吗？",
  {
    maxDepth: 3,
    relationTypes: [RelationType.CAUSES, RelationType.IMPACTS],
    agentFilter: ["Physics_Agent_01", "Finance_Agent_01"],
  }
);

// 返回结果：
{
  directMatches: [
    { content: "公司Q3财报显示利润率12%", ... }
  ],
  relatedContext: {
    memories: [
      { content: "电力成本占支出30%", ... },
      { content: "能效提升50%", ... },
    ],
    relations: [
      { source: "能效", target: "成本", type: "IMPACTS" },
      { source: "成本", target: "利润", type: "CAUSES" },
    ]
  },
  inferencePaths: [
    {
      type: "causal_chain",
      nodes: [
        "能效提升50%",
        "电力成本降低",
        "利润率提升",
        "股价上涨"
      ],
      description: "物理技术突破 -> 成本优化 -> 财务改善"
    }
  ]
}

// Finance_Agent 使用上下文：
const decision = await financeAI.decide(
  context.directMatches +
  context.relatedContext +
  "推理路径: " + context.inferencePaths[0].description
);

// 输出:
// "虽然没有直接财务报告，但根据物理AI提供的'能效提升'与历史数据中'电力成本占比'的
//  强因果关系，预计利润率将提升15%，建议买入。"
```

---

## 💎 NFT 化推理路径

**核心价值：不卖数据，卖逻辑**

```typescript
interface ReasoningPathNFT {
  id: string;
  name: "SpaceX 技术突破 -> 股价预测推理路径";

  // 路径节点（匿名化）
  path: [
    { concept: "电池技术突破", source: "Physics_Agent" },
    { concept: "能源成本降低", source: "System_Inference" },
    { concept: "利润率提升", source: "Finance_Agent" },
  ],

  // 路径强度（推理置信度）
  strength: 0.87,

  // 验证数据
  validationHistory: [
    { date: "2025-01", actualOutcome: "股价涨18%", predicted: "涨15%" }
  ],

  // 使用许可
  usage: "可用于金融决策，禁止用于内幕交易",
}
```

---

## 🔧 实现策略

### 方案 A: 轻量级（基于 PostgreSQL）

**优势**: 不需要额外数据库，降低复杂度
**适用**: MVP 阶段，记忆数量 < 100万

```sql
-- 关系表
CREATE TABLE memory_relations (
  id UUID PRIMARY KEY,
  source_memory_id UUID REFERENCES memory_entries(id),
  target_memory_id UUID REFERENCES memory_entries(id),
  relation_type VARCHAR(50),
  strength FLOAT,
  reason TEXT,
  inferred_by VARCHAR(20),
  created_at TIMESTAMP
);

CREATE INDEX idx_source ON memory_relations(source_memory_id);
CREATE INDEX idx_target ON memory_relations(target_memory_id);

-- 递归查询（图谱游走）
WITH RECURSIVE memory_graph AS (
  -- Base case: 起始节点
  SELECT id, content, 0 as depth
  FROM memory_entries
  WHERE id = 'start_memory_id'

  UNION ALL

  -- Recursive case: 向外扩展
  SELECT m.id, m.content, mg.depth + 1
  FROM memory_entries m
  JOIN memory_relations r ON r.target_memory_id = m.id
  JOIN memory_graph mg ON r.source_memory_id = mg.id
  WHERE mg.depth < 3  -- 最多 3 跳
    AND r.relation_type IN ('CAUSES', 'SUPPORTS')
)
SELECT * FROM memory_graph;
```

### 方案 B: 专业级（PostgreSQL + Neo4j）

**优势**: 极速图谱查询，支持复杂推理
**适用**: 生产环境，记忆数量 > 100万

```typescript
// Neo4j Cypher 查询
const causePath = await neo4j.run(`
  MATCH path = (start:Memory {id: $startId})-[:CAUSES*1..3]->(end:Memory)
  WHERE start.agentId = 'Physics_Agent'
    AND end.agentId = 'Finance_Agent'
  RETURN path
  ORDER BY length(path)
  LIMIT 1
`, { startId: 'mem_1024' });
```

---

## 📊 性能优化

### 1. 异步关系构建
- 新记忆写入后，立即返回 ID
- 关系推理放入后台队列（Celery / BullMQ）

### 2. 缓存热点路径
- 对常用推理路径（如"技术 -> 成本 -> 股价"）建立快捷索引

### 3. 批量实体提取
- 100 条记忆一起调用 LLM，降低 API 成本

---

## 🎯 与现有系统集成

### 扩展当前 Prisma Schema

```prisma
model MemoryEntry {
  id          String   @id @default(uuid())
  content     String
  embedding   Unsupported("vector(1536)")

  // 新增：实体存储
  entities    Json?    // [{ name: "SpaceX", type: "Company" }]
  concepts    String[] // ["超导", "能效", "成本"]

  // 关系（出边）
  outgoingRelations MemoryRelation[] @relation("SourceMemory")
  incomingRelations MemoryRelation[] @relation("TargetMemory")
}

model MemoryRelation {
  id              String   @id @default(uuid())
  sourceMemoryId  String
  targetMemoryId  String
  relationType    String   // "CAUSES", "CONTRADICTS", etc.
  strength        Float    @default(0.5)
  reason          String?
  inferredBy      String   @default("llm")

  sourceMemory    MemoryEntry @relation("SourceMemory", fields: [sourceMemoryId], references: [id])
  targetMemory    MemoryEntry @relation("TargetMemory", fields: [targetMemoryId], references: [id])

  createdAt       DateTime @default(now())

  @@index([sourceMemoryId])
  @@index([targetMemoryId])
  @@index([relationType])
}
```

---

## 🚀 实施路线图

### Week 1: 基础设施
- [ ] 扩展 Prisma Schema（添加 entities, MemoryRelation）
- [ ] 实现实体提取器（LLM API 调用）
- [ ] 实现关系存储（PostgreSQL）

### Week 2: 关系推理
- [ ] 实现 RelationBuilder（候选查找 + LLM 推理）
- [ ] 异步任务队列（处理关系构建）

### Week 3: 混合检索
- [ ] 实现图谱游走算法（PostgreSQL 递归查询）
- [ ] 实现推理路径发现

### Week 4: Multi-AI 接口
- [ ] 创建 Agent Context API
- [ ] 实现推理路径 NFT 化

---

## 📖 参考资料

- **DeepMind RMC Paper**: "Relational Memory for Multi-Agent Learning" (2018)
- **LangGraph**: 图谱增强检索实现
- **Neo4j GraphRAG**: 图数据库 + LLM 集成

---

**总结**: 这套架构将 Awareness Market 从"记忆存储"升级为"关系推理引擎"，为多 AI 协作提供了类似人脑的关联思考能力。
