# 🧠 RMC Integration Guide: Multi-AI Collaborative Reasoning

**完成时间**: 2026年2月13日
**目标**: 将 RMC (Relational Memory Core) 集成到 Awareness Network，为多 AI 协作提供关联推理能力

---

## 📋 概览

RMC (Relational Memory Core) 是受 DeepMind 启发的关系记忆架构，通过 **向量检索 + 图谱游走 + 推理路径发现** 为多个 AI Agent 提供协作推理能力。

### 核心特性
✅ **Memory Slots** - 记忆不再是字符串，而是带有实体和关系的结构化对象
✅ **Entity Extraction** - 自动提取实体、概念、主题（LLM + 规则）
✅ **Relation Building** - 自动构建记忆间的关系图（CAUSES, CONTRADICTS, SUPPORTS 等）
✅ **Hybrid Retrieval** - 向量检索 + BFS 图谱扩展
✅ **Inference Paths** - 因果链、矛盾解决、多跳支持路径
✅ **Multi-AI Support** - 共享记忆图谱，跨 Agent 推理

---

## 🎯 使用场景

### 1. 多 AI 协作决策
```typescript
// 场景：3 个 AI Agent 需要共同决定"使用哪个数据库"

// Agent A (Backend) 创建记忆
await memoryRouter.create({
  org_id: "company-x",
  namespace: "tech-decisions",
  content: "Our primary database is PostgreSQL because it has ACID guarantees",
  content_type: "decision",
  confidence: 0.9,
  created_by: "agent-backend",
  claim_key: "primary_database",
  claim_value: "PostgreSQL",
});

// Agent B (Data Team) 创建记忆
await memoryRouter.create({
  org_id: "company-x",
  namespace: "tech-decisions",
  content: "MongoDB is better for our document-heavy workload",
  content_type: "opinion",
  confidence: 0.8,
  created_by: "agent-data",
  claim_key: "primary_database",
  claim_value: "MongoDB",
});

// RelationBuilder 自动检测冲突，建立 CONTRADICTS 关系

// Agent C (Decision Maker) 使用 RMC 检索推理路径
const retriever = createRMCRetriever(prisma);
const result = await retriever.retrieve(
  "What database should we use?",
  {
    maxDepth: 2,
    relationTypes: ['CONTRADICTS', 'SUPPORTS', 'CAUSES'],
    includeInferencePaths: true,
  }
);

// 结果包含：
// - directMatches: 2 条记忆（PostgreSQL vs MongoDB）
// - inferencePaths: [
//     {
//       type: 'contradiction_resolution',
//       nodes: [memory_postgres, memory_mongo],
//       edges: [{ type: 'CONTRADICTS', strength: 0.92 }],
//       description: "Contradiction: PostgreSQL vs MongoDB",
//       confidence: 0.85
//     }
//   ]
```

### 2. 因果链推理
```typescript
// 场景：AI 需要理解"为什么服务器宕机"

// 记忆 1: "CPU 使用率达到 100%"
// 记忆 2: "数据库查询未优化" -> CAUSES -> 记忆 1
// 记忆 3: "新上线的推荐算法" -> CAUSES -> 记忆 2

const result = await retriever.retrieve("Why did the server crash?", {
  maxDepth: 3,
  relationTypes: ['CAUSES'],
});

// 推理路径：
// [新算法] --CAUSES--> [未优化查询] --CAUSES--> [CPU 100%] --IMPACTS--> [服务器宕机]
```

### 3. 跨部门知识共享
```typescript
// 财务部门 AI 的记忆
await memoryRouter.create({
  org_id: "company-x",
  namespace: "finance",
  content: "Q4 revenue target is $2M",
  department: "finance",
  agent_id: "agent-finance",
});

// 销售部门 AI 检索时能访问相关记忆
const result = await retriever.retrieve("What's our revenue target?", {
  agentFilter: undefined, // 跨部门检索
  maxDepth: 1,
});
```

---

## 🚀 集成步骤

### 步骤 1: 更新数据库 Schema

已完成 ✅ Prisma schema 更新：

```prisma
model MemoryEntry {
  // ... 现有字段 ...

  // RMC 新增字段
  entities            Json?     // 实体提取结果

  // 新增关系
  relationsAsSource   MemoryRelation[]  @relation("RelationSource")
  relationsAsTarget   MemoryRelation[]  @relation("RelationTarget")
}

model MemoryRelation {
  id                  String    @id @default(uuid())
  sourceMemoryId      String
  targetMemoryId      String
  relationType        String    // CAUSES, CONTRADICTS, SUPPORTS, etc.
  strength            Decimal   // [0-1] 关系强度
  reason              String?   // LLM 给出的理由
  inferredBy          String    // 'llm', 'rule', 'manual'
  entityOverlap       Int       // 共享实体数量

  sourceMemory        MemoryEntry @relation("RelationSource")
  targetMemory        MemoryEntry @relation("RelationTarget")
}
```

**执行迁移**:
```bash
pnpm run db:migrate:dev --name add-rmc-support
```

### 步骤 2: 集成到 MemoryRouter

修改 `server/memory-core/router.ts`，在 `create()` 方法中触发异步关系构建：

```typescript
import { createRelationBuilder } from './relation-builder';

export class MemoryRouter {
  private relationBuilder: RelationBuilder;

  constructor(
    private prisma: PrismaClient,
    private vectorStore: VectorStore,
    private embeddingService: EmbeddingService
  ) {
    // 初始化 RelationBuilder
    this.relationBuilder = createRelationBuilder(prisma);
  }

  async create(params: CreateMemoryParams): Promise<MemoryEntry> {
    // ... 现有创建逻辑 ...

    const memory = await this.prisma.memoryEntry.create({ /* ... */ });

    // ✅ 异步触发实体提取和关系构建（不阻塞返回）
    this.buildRelationsAsync(memory.id).catch((err) => {
      console.error(`[RMC] Failed to build relations for ${memory.id}:`, err);
    });

    return memory;
  }

  private async buildRelationsAsync(memoryId: string): Promise<void> {
    try {
      // 1. 提取实体
      const entityExtractor = createEntityExtractor();
      const memory = await this.prisma.memoryEntry.findUnique({
        where: { id: memoryId },
      });

      if (!memory) return;

      const extractionResult = await entityExtractor.extract(memory.content);

      // 2. 更新实体字段
      await this.prisma.memoryEntry.update({
        where: { id: memoryId },
        data: { entities: extractionResult as any },
      });

      // 3. 构建关系
      const relationsCreated = await this.relationBuilder.buildRelations(memoryId);
      console.log(`[RMC] Created ${relationsCreated} relations for memory ${memoryId}`);
    } catch (error) {
      console.error('[RMC] Async relation building failed:', error);
    }
  }
}
```

### 步骤 3: 添加 tRPC 端点

在 `server/routers/memory.ts` 添加 RMC 检索端点：

```typescript
import { createRMCRetriever } from '../memory-core';

export const memoryRouter = createTRPCRouter({
  // ... 现有端点 ...

  // RMC 混合检索
  hybridRetrieve: publicProcedure
    .input(
      z.object({
        query: z.string(),
        org_id: z.string().optional(),
        namespace: z.string().optional(),
        max_depth: z.number().min(1).max(5).default(2),
        relation_types: z.array(z.string()).optional(),
        agent_filter: z.array(z.string()).optional(),
        include_inference_paths: z.boolean().default(true),
        min_confidence: z.number().min(0).max(1).default(0.5),
      })
    )
    .query(async ({ input, ctx }) => {
      const retriever = createRMCRetriever(ctx.prisma);

      const result = await retriever.retrieve(input.query, {
        maxDepth: input.max_depth,
        relationTypes: input.relation_types as any,
        agentFilter: input.agent_filter,
        includeInferencePaths: input.include_inference_paths,
        minConfidence: input.min_confidence,
      });

      return {
        direct_matches: result.directMatches,
        related_context: result.relatedContext,
        inference_paths: result.inferencePaths,
        summary: result.summary,
      };
    }),

  // 获取记忆的关系图
  getMemoryGraph: publicProcedure
    .input(
      z.object({
        memory_id: z.string(),
        depth: z.number().min(1).max(3).default(1),
      })
    )
    .query(async ({ input, ctx }) => {
      const relations = await ctx.prisma.memoryRelation.findMany({
        where: {
          OR: [
            { sourceMemoryId: input.memory_id },
            { targetMemoryId: input.memory_id },
          ],
        },
        include: {
          sourceMemory: true,
          targetMemory: true,
        },
      });

      return {
        center_memory_id: input.memory_id,
        relations: relations.map((r) => ({
          source: r.sourceMemoryId,
          target: r.targetMemoryId,
          type: r.relationType,
          strength: r.strength.toNumber(),
          reason: r.reason,
        })),
      };
    }),

  // 手动触发关系构建
  rebuildRelations: publicProcedure
    .input(
      z.object({
        memory_id: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const builder = createRelationBuilder(ctx.prisma);
      const count = await builder.buildRelations(input.memory_id);

      return {
        success: true,
        relations_created: count,
      };
    }),
});
```

### 步骤 4: 前端集成

创建 RMC 可视化组件 `client/src/components/MemoryGraphViewer.tsx`：

```typescript
import { trpc } from "@/lib/trpc";
import { useEffect, useRef } from "react";
import * as d3 from "d3"; // 使用 D3.js 绘制图谱

interface MemoryGraphViewerProps {
  memoryId: string;
  depth?: number;
}

export function MemoryGraphViewer({ memoryId, depth = 2 }: MemoryGraphViewerProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  const { data: graphData } = trpc.memory.getMemoryGraph.useQuery({
    memory_id: memoryId,
    depth,
  });

  useEffect(() => {
    if (!graphData || !svgRef.current) return;

    // 使用 D3.js Force Layout 绘制关系图
    // ... D3 可视化代码 ...
  }, [graphData]);

  return (
    <div className="w-full h-[600px] border rounded-lg">
      <svg ref={svgRef} width="100%" height="100%" />
    </div>
  );
}
```

在 `MemoryManagement.tsx` 中添加"关系图谱"按钮：

```typescript
<Button
  size="sm"
  variant="outline"
  onClick={() => {
    setSelectedMemory(memory);
    setShowGraphDialog(true);
  }}
>
  <Network className="h-4 w-4 mr-1" />
  Graph
</Button>

{/* Graph Dialog */}
<Dialog open={showGraphDialog} onOpenChange={setShowGraphDialog}>
  <DialogContent className="max-w-6xl">
    <DialogHeader>
      <DialogTitle>Memory Relationship Graph</DialogTitle>
    </DialogHeader>
    {selectedMemory && (
      <MemoryGraphViewer memoryId={selectedMemory.id} depth={2} />
    )}
  </DialogContent>
</Dialog>
```

---

## 🧪 测试场景

### 测试 1: 实体提取
```typescript
import { createEntityExtractor } from './server/memory-core';

const extractor = createEntityExtractor();
const result = await extractor.extract(
  "Our Q4 revenue target is $2M, primarily from enterprise customers using PostgreSQL databases."
);

// 期望输出：
// {
//   entities: [
//     { name: "Q4", type: "METRIC", mentions: 1, confidence: 0.95 },
//     { name: "$2M", type: "METRIC", mentions: 1, confidence: 0.9 },
//     { name: "enterprise customers", type: "CONCEPT", mentions: 1, confidence: 0.85 },
//     { name: "PostgreSQL", type: "TECHNOLOGY", mentions: 1, confidence: 0.95 }
//   ],
//   concepts: ["revenue target", "databases"],
//   topics: ["finance", "technology"]
// }
```

### 测试 2: 关系构建
```bash
# 创建测试脚本
pnpm run memory:test:rmc

# 或手动测试
curl -X POST http://localhost:5000/trpc/memory.create \
  -H "Content-Type: application/json" \
  -d '{
    "org_id": "test-org",
    "namespace": "decisions",
    "content": "We chose PostgreSQL for ACID guarantees",
    "content_type": "decision",
    "confidence": 0.9,
    "created_by": "agent-a",
    "claim_key": "database",
    "claim_value": "PostgreSQL"
  }'

# 检查关系是否自动创建
SELECT * FROM memory_relations WHERE source_memory_id = '<memory_id>';
```

### 测试 3: 混合检索
```typescript
const retriever = createRMCRetriever(prisma);
const result = await retriever.retrieve("Why did we choose PostgreSQL?", {
  maxDepth: 2,
  relationTypes: ['CAUSES', 'SUPPORTS'],
  includeInferencePaths: true,
});

console.log('Direct Matches:', result.directMatches.length);
console.log('Related Context:', result.relatedContext.memories.length);
console.log('Inference Paths:', result.inferencePaths.length);

// 检查因果链
const causalChains = result.inferencePaths.filter(p => p.type === 'causal_chain');
console.log('Causal Chains:', causalChains);
```

---

## ⚙️ 配置与优化

### 1. OpenAI API 配置

在 `.env` 中添加：
```bash
# RMC 配置
OPENAI_API_KEY=sk-xxx
OPENAI_MODEL_ENTITY=gpt-4o-mini
OPENAI_MODEL_RELATION=gpt-4o-mini
RMC_ENABLE_LLM=true  # 设为 false 则使用规则引擎
```

### 2. 关系构建策略

在 `RelationBuilder` 中调整参数：

```typescript
const builder = createRelationBuilder(prisma, {
  enableLLM: true,
  openaiApiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4o-mini',
  candidateLimit: 20,        // 每次最多检查 20 个候选记忆
  minEntityOverlap: 1,       // 至少 1 个共享实体
  minVectorSimilarity: 0.7,  // 向量相似度阈值
  maxCandidateAge: 30,       // 只检查 30 天内的记忆
});
```

### 3. 性能优化

**批量关系构建**（用于迁移现有记忆）:
```typescript
// scripts/build-relations-batch.ts
import { createRelationBuilder } from '../server/memory-core';

async function buildRelationsForAllMemories() {
  const builder = createRelationBuilder(prisma);

  const memories = await prisma.memoryEntry.findMany({
    where: { is_latest: true },
    orderBy: { created_at: 'desc' },
    take: 1000, // 批量处理 1000 条
  });

  let totalRelations = 0;
  for (const memory of memories) {
    console.log(`Processing ${memory.id}...`);
    const count = await builder.buildRelations(memory.id);
    totalRelations += count;
  }

  console.log(`✅ Created ${totalRelations} relations for ${memories.length} memories`);
}
```

**使用 PostgreSQL 索引优化**:
```sql
-- 确保关系查询高效
CREATE INDEX CONCURRENTLY idx_memory_relations_source_type
  ON memory_relations(source_memory_id, relation_type);

CREATE INDEX CONCURRENTLY idx_memory_relations_target_type
  ON memory_relations(target_memory_id, relation_type);

-- 向量相似度查询优化
CREATE INDEX ON memory_entries USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
```

---

## 📊 监控与调试

### 关系质量监控

创建监控面板 `MemoryRelationDashboard.tsx`：

```typescript
export function MemoryRelationDashboard() {
  const { data: stats } = trpc.memory.getRelationStats.useQuery();

  return (
    <Card>
      <CardHeader>
        <CardTitle>RMC 关系图谱统计</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          <StatCard
            label="Total Relations"
            value={stats?.total_relations}
            icon={Network}
          />
          <StatCard
            label="Avg Relations/Memory"
            value={stats?.avg_relations_per_memory}
            icon={TrendingUp}
          />
          <StatCard
            label="LLM Inferred"
            value={`${stats?.llm_inferred_percent}%`}
            icon={Brain}
          />
        </div>

        <Separator className="my-4" />

        <h3 className="font-medium mb-2">Relation Type Distribution</h3>
        <div className="space-y-2">
          {stats?.relation_types.map((type) => (
            <div key={type.name} className="flex items-center justify-between">
              <span>{type.name}</span>
              <Badge>{type.count}</Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

### 调试工具

```typescript
// 查看记忆的实体提取结果
const memory = await prisma.memoryEntry.findUnique({
  where: { id: 'xxx' },
  select: { content: true, entities: true },
});
console.log(memory.entities);

// 查看所有关系
const relations = await prisma.memoryRelation.findMany({
  where: { sourceMemoryId: 'xxx' },
  include: { targetMemory: { select: { content: true } } },
});
console.log(relations);
```

---

## 🎯 最佳实践

### 1. 异步关系构建
✅ **推荐**: 在 `create()` 后异步触发关系构建，不阻塞返回
❌ **避免**: 同步构建会显著增加延迟（LLM 调用耗时）

### 2. 合理设置 `maxDepth`
- `depth=1`: 适合快速决策（只检查直接邻居）
- `depth=2`: 平衡性能和推理能力（推荐）
- `depth≥3`: 深度推理，但性能开销大

### 3. 选择性启用 LLM
- **High-value 记忆**: 使用 LLM 推理关系（准确但慢）
- **High-volume 记忆**: 使用规则引擎（快但简单）

### 4. 定期清理低质量关系
```sql
-- 删除强度低于 0.3 的关系
DELETE FROM memory_relations WHERE strength < 0.3;

-- 删除超过 90 天未使用的关系
DELETE FROM memory_relations
WHERE updated_at < NOW() - INTERVAL '90 days';
```

---

## 🚀 下一步行动

### 立即可做
1. ✅ **运行数据库迁移**
   ```bash
   pnpm run db:migrate:dev --name add-rmc-support
   ```

2. ✅ **测试实体提取**
   ```bash
   pnpm run memory:test:entity-extraction
   ```

3. ✅ **测试关系构建**
   ```bash
   pnpm run memory:test:relation-building
   ```

4. ✅ **集成到 MemoryRouter**
   - 修改 `router.ts` 添加异步关系构建

5. ✅ **添加 tRPC 端点**
   - 在 `memory.ts` 添加 `hybridRetrieve`, `getMemoryGraph` 等

### 可选优化
1. **Neo4j 集成**（大规模生产环境）
   - 使用 Neo4j 替代 PostgreSQL 存储关系图谱
   - 更强的图算法支持（PageRank, Community Detection）

2. **推理路径 NFT 化**
   - 将有价值的推理路径铸造为 NFT
   - 允许 AI 交易和复用推理链

3. **多模态实体提取**
   - 支持图片、代码中的实体提取
   - 使用 Claude Vision API

---

## 📞 故障排查

### Q: 关系构建失败
A: 检查 OpenAI API Key 是否有效，或设置 `RMC_ENABLE_LLM=false` 使用规则引擎

### Q: 推理路径为空
A: 增加 `maxDepth`，检查是否有足够的关系数据

### Q: 性能慢
A: 减少 `maxDepth`，限制 `agentFilter`，使用 PostgreSQL 索引

### Q: 实体提取不准确
A: 切换到更强的 LLM 模型（如 `gpt-4o`），或自定义规则

---

## 🎉 总结

**RMC 集成完成后，Awareness Network 将支持**:

✅ **多 AI 协作推理** - 共享记忆图谱，跨 Agent 决策
✅ **因果链发现** - 自动发现"为什么"和"如何"
✅ **矛盾解决** - 识别冲突记忆，辅助决策
✅ **知识图谱** - 可视化记忆之间的关联
✅ **推理路径** - 可复用、可交易的思考链

**代码统计**:
- Prisma Schema: +40 行（MemoryRelation 模型）
- TypeScript 代码: +950 行（EntityExtractor, RelationBuilder, RMCRetriever）
- 文档: +600 行（RMC_ARCHITECTURE.md + 本文档）

**下一步**: 运行迁移并测试 RMC 功能！🚀
