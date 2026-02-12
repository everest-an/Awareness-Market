# Awareness Network - Architecture Upgrade Plan

**Vision**: Transform Awareness from AI Collaboration Platform to Universal AI Memory & Governance Infrastructure

**Timeline**: 18 months (3 phases)
**Status**: Phase A - In Progress
**Document Version**: 1.0
**Last Updated**: 2026-02-07

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current Architecture](#current-architecture)
3. [Target Architecture](#target-architecture)
4. [Memory Schema Specification](#memory-schema-specification)
5. [Namespace System](#namespace-system)
6. [Control Plane Components](#control-plane-components)
7. [Data Plane Components](#data-plane-components)
8. [Migration Strategy](#migration-strategy)
9. [Implementation Roadmap](#implementation-roadmap)
10. [Technical Decisions](#technical-decisions)

---

## Executive Summary

### The Problem

Current Awareness Network is a **monolithic AI collaboration platform** with:
- Workflow-centric data model (workflows → steps → outputs)
- Tightly coupled to collaboration use case
- No standardized memory format across AI agents
- Limited multi-tenancy (single org context)
- No memory governance or lifecycle management

### The Vision (5-10 Years)

Become the **universal infrastructure layer for AI memory management**, comparable to:
- **Memory Layer**: Like PostgreSQL/Redis for relational/cache storage, Awareness becomes the standard for AI memory storage
- **Governance Layer**: Like AWS IAM for access control, Awareness manages memory permissions, versioning, conflict resolution

### Success Criteria

- **For AI Frameworks**: LangChain, AutoGen, CrewAI integrate `@awareness/core` for memory persistence
- **For Enterprises**: Self-hosted Awareness manages cross-departmental AI agent memory with governance
- **For Developers**: Open Memory Schema Standard (AMSS) adopted as industry best practice
- **For Ecosystem**: Optional Memory Marketplace enables specialized memory trading

---

## Current Architecture

### Database Schema (v1.0 - Collaboration-Centric)

```
┌─────────────────────────────────────────────────────┐
│                    workflows                        │
├─────────────────────────────────────────────────────┤
│ id, task, orchestration, status, created_by         │
│ shared_memory (JSON), started_at, completed_at      │
└─────────────────────────────────────────────────────┘
                        │
                        │ 1:N
                        ▼
┌─────────────────────────────────────────────────────┐
│                  workflow_steps                     │
├─────────────────────────────────────────────────────┤
│ workflow_id, agent_id, status, output (JSON)        │
│ memory_keys (String[]), execution_time              │
└─────────────────────────────────────────────────────┘
```

### API Layer

```
server/routers/agent-collaboration.ts
├── collaborate()        # Create workflow
├── getWorkflowStatus()  # Query workflow
├── stopWorkflow()       # Cancel workflow
└── listWorkflows()      # List user workflows
```

### Storage

- **Primary**: PostgreSQL (via Prisma)
- **Vector**: Not implemented
- **Cache**: In-memory (workflow.sharedMemory)

### Limitations

1. **No Memory Abstraction**: Output stored as opaque JSON blob
2. **No Versioning**: Updates overwrite previous memory
3. **No Multi-Tenancy**: Single organization context
4. **No Governance**: No memory lifecycle, scoring, or conflict resolution
5. **Tight Coupling**: Collaboration workflow logic mixed with memory storage

---

## Target Architecture

### High-Level Overview

```
┌───────────────────────────────────────────────────────────────────┐
│                       CONTROL PLANE                               │
│  (Memory Governance, Policies, Scoring, Versioning, Arbitration)  │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │   Memory    │  │   Scoring    │  │   Conflict           │   │
│  │   Router    │  │   Engine     │  │   Arbitration        │   │
│  └─────────────┘  └──────────────┘  └──────────────────────┘   │
│                                                                   │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │   Version   │  │  Namespace   │  │   Access Control     │   │
│  │   Manager   │  │  Resolver    │  │   (RBAC)             │   │
│  └─────────────┘  └──────────────┘  └──────────────────────┘   │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
                              ▲
                              │ Memory API
                              ▼
┌───────────────────────────────────────────────────────────────────┐
│                        DATA PLANE                                 │
│        (Storage Abstraction, Vector DB, Persistence)              │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              Pluggable Vector Store Interface           │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐ │    │
│  │  │ pgvector │  │  Chroma  │  │  Milvus  │  │  Weaviate│ │    │
│  │  └──────────┘  └──────────┘  └──────────┘  └────────┘ │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              Relational Storage (Prisma)                │    │
│  │  ┌────────────────┐  ┌────────────────┐                │    │
│  │  │ memory_entries │  │ memory_scores  │                │    │
│  │  └────────────────┘  └────────────────┘                │    │
│  │  ┌────────────────┐  ┌────────────────┐                │    │
│  │  │memory_policies │  │ memory_versions│                │    │
│  │  └────────────────┘  └────────────────┘                │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
                              ▲
                              │
                              ▼
┌───────────────────────────────────────────────────────────────────┐
│                     APPLICATION LAYER                             │
│  (Collaboration Workflows, Agents, Memory Marketplace, etc.)      │
└───────────────────────────────────────────────────────────────────┘
```

### Separation of Concerns

| Layer | Responsibility | Examples |
|-------|----------------|----------|
| **Control Plane** | Memory governance logic | Scoring, versioning, conflict resolution, access control |
| **Data Plane** | Physical storage and retrieval | Vector DB, PostgreSQL, caching, search indexing |
| **Application Layer** | Business logic using memory | Collaboration workflows, agent coordination, marketplace |

---

## Memory Schema Specification

### Version 1.0 (Awareness Memory Schema Standard - AMSS)

```typescript
interface MemoryEntry {
  // Identity
  id: string;                    // UUID v7 (time-sortable)
  org_id: string;                // Organization identifier
  namespace: string;             // e.g., "global", "finance", "private/agent-x"

  // Content
  content_type: 'text' | 'code' | 'data' | 'image' | 'audio' | 'composite';
  content: string;               // Raw content (text, code, data JSON, URL for media)
  embedding: number[];           // Vector embedding (dimension: 1536 for OpenAI, 768 for sentence-transformers)
  metadata: Record<string, any>; // Extensible metadata (tags, source, context)

  // Quality Signals
  confidence: number;            // [0-1] Creator's confidence in memory accuracy
  reputation: number;            // [0-100] Aggregated reputation score
  usage_count: number;           // Number of times memory was retrieved
  validation_count: number;      // Number of successful validations

  // Versioning
  version: number;               // Sequential version number (1, 2, 3, ...)
  parent_id: string | null;      // Parent memory ID (for version tree)
  is_latest: boolean;            // True only for the current version

  // Lifecycle
  created_by: string;            // User/Agent ID who created this memory
  created_at: Date;              // Creation timestamp
  updated_at: Date;              // Last update timestamp
  accessed_at: Date;             // Last access timestamp
  expires_at: Date | null;       // Optional expiration (for ephemeral memory)

  // Decay
  decay_factor: number;          // Time-based decay coefficient (λ in e^(-λt))
  decay_checkpoint: Date;        // Last decay calculation timestamp
}
```

### Field Design Rationale

- **`org_id` + `namespace`**: Multi-tenant isolation (Phase B)
- **`embedding`**: Enable semantic search and similarity matching
- **`confidence` + `reputation`**: Quality signals for scoring engine
- **`version` + `parent_id`**: Non-destructive updates (Version Tree)
- **`decay_factor`**: Time-based relevance decay (configurable per memory type)
- **`metadata`**: Extensibility without schema changes

### Content Types

| Type | Description | Example Use Case |
|------|-------------|------------------|
| `text` | Natural language | Meeting notes, task descriptions, conversations |
| `code` | Source code snippets | Function implementations, bug fixes |
| `data` | Structured data (JSON/CSV) | API responses, database query results |
| `image` | Visual content | Diagrams, screenshots, UI mockups |
| `audio` | Audio recordings | Voice memos, meeting recordings |
| `composite` | Multi-modal memory | Code + documentation + diagram |

---

## Namespace System

### Purpose

Enable **multi-tenant memory isolation** while supporting **controlled cross-department sharing**.

### Namespace Structure

```
<org_id>/<scope>/<entity>

Examples:
- org-123/global                    # Organization-wide shared memory
- org-123/finance                   # Finance department memory
- org-123/engineering               # Engineering department memory
- org-123/private/agent-abc         # Agent-specific private memory
- org-123/project/alpha             # Project-scoped memory
```

### Access Control Matrix (Phase B)

| Namespace | Reader | Writer | Admin |
|-----------|--------|--------|-------|
| `org-123/global` | All org members | Verified agents | Org admins |
| `org-123/finance` | Finance team | Finance agents | Finance managers |
| `org-123/private/agent-x` | agent-x only | agent-x only | Org admins |

### Namespace Resolution

```typescript
// Example query
const memories = await memoryRouter.query({
  namespaces: [
    'org-123/global',           // Shared organizational knowledge
    'org-123/engineering',      // Department-specific memory
    'org-123/private/agent-1',  // Agent's private memory
  ],
  query: 'How do we handle authentication?',
  limit: 10,
});

// Namespace scoring weights
const weights = {
  'org-123/private/agent-1': 1.0,    // Highest priority
  'org-123/engineering': 0.7,        // Department context
  'org-123/global': 0.5,             // General knowledge
};
```

---

## Control Plane Components

### 1. Memory Router (`server/memory-core/router.ts`)

**Responsibilities**:
- Route memory operations to appropriate storage backend
- Apply namespace resolution and access control
- Handle memory lifecycle (create, update, delete, archive)

**Key Methods**:
```typescript
class MemoryRouter {
  async create(entry: MemoryEntry): Promise<string>;
  async query(params: QueryParams): Promise<MemoryEntry[]>;
  async update(id: string, update: Partial<MemoryEntry>): Promise<void>;
  async delete(id: string): Promise<void>;
  async archive(id: string): Promise<void>;
}
```

### 2. Scoring Engine (`server/memory-core/scoring-engine.ts`)

**Responsibilities**:
- Calculate dynamic memory scores based on quality signals
- Apply time-based decay to reduce stale memory relevance
- Re-rank memories based on context and usage patterns

**Scoring Formula**:
```
score = base_score * decay_multiplier

where:
  base_score = (confidence * reputation * 0.5)
             + (log(usage_count + 1) * 0.3)
             + (validation_ratio * 0.2)

  decay_multiplier = exp(-λ * time_elapsed)

  λ (decay_factor) varies by content_type:
    - text: 0.01  (slow decay, ~70 days half-life)
    - code: 0.05  (medium decay, ~14 days half-life)
    - data: 0.1   (fast decay, ~7 days half-life)
```

**Implementation**:
```typescript
class ScoringEngine {
  calculateScore(entry: MemoryEntry): number;
  applyDecay(entry: MemoryEntry): number;
  rerank(memories: MemoryEntry[], context: QueryContext): MemoryEntry[];
}
```

### 3. Version Manager (`server/memory-core/version-manager.ts`)

**Responsibilities**:
- Maintain memory version tree (parent-child relationships)
- Enable non-destructive updates (create new version, keep old)
- Support memory rollback and audit trails

**Version Tree Example**:
```
memory-001 (v1) "User prefers dark mode"
    │
    ├─ memory-002 (v2) "User prefers dark mode with high contrast"
    │       │
    │       └─ memory-003 (v3) "User prefers system theme"  [is_latest: true]
    │
    └─ memory-004 (v2-alt) "User disabled dark mode"  [abandoned branch]
```

**Implementation**:
```typescript
class VersionManager {
  async createVersion(parentId: string, update: Partial<MemoryEntry>): Promise<string>;
  async getVersionTree(memoryId: string): Promise<VersionNode[]>;
  async rollback(memoryId: string, targetVersion: number): Promise<void>;
}
```

### 4. Conflict Arbitration (`server/memory-core/conflict-arbitration.ts`) - Phase B

**Responsibilities**:
- Detect memory conflicts (e.g., engineering says "API uses JWT", finance says "API uses OAuth")
- Resolve conflicts via scoring, voting, or human intervention
- Maintain conflict resolution history

**Conflict Resolution Strategies**:
1. **Automatic** (score-based): Keep memory with higher score
2. **Voting** (agent consensus): Multiple agents vote on correct version
3. **Human** (escalation): Flag for human review
4. **Namespace** (isolation): Keep both, scoped to different namespaces

---

## Data Plane Components

### 1. Pluggable Vector Store Interface

**Purpose**: Abstract vector database implementation to support multiple backends.

**Interface**:
```typescript
interface VectorStore {
  // Insert vector
  insert(id: string, embedding: number[], metadata: Record<string, any>): Promise<void>;

  // Similarity search
  search(query: number[], limit: number, filters?: Record<string, any>): Promise<SearchResult[]>;

  // Delete vector
  delete(id: string): Promise<void>;

  // Batch operations
  batchInsert(vectors: VectorData[]): Promise<void>;
}
```

**Implementations**:
```typescript
// Phase A: pgvector (integrated with PostgreSQL)
class PgVectorStore implements VectorStore { ... }

// Phase B: ChromaDB (standalone vector DB)
class ChromaVectorStore implements VectorStore { ... }

// Phase C: Enterprise options
class MilvusVectorStore implements VectorStore { ... }
class WeaviateVectorStore implements VectorStore { ... }
```

### 2. Database Schema (Phase A Migration)

**New Tables**:

```sql
-- Memory entries (primary storage)
CREATE TABLE memory_entries (
  id UUID PRIMARY KEY,
  org_id VARCHAR(255) NOT NULL,
  namespace VARCHAR(255) NOT NULL,
  content_type VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536),  -- pgvector extension
  metadata JSONB,
  confidence DECIMAL(3,2) CHECK (confidence >= 0 AND confidence <= 1),
  reputation DECIMAL(5,2) DEFAULT 50,
  usage_count INTEGER DEFAULT 0,
  validation_count INTEGER DEFAULT 0,
  version INTEGER DEFAULT 1,
  parent_id UUID REFERENCES memory_entries(id),
  is_latest BOOLEAN DEFAULT TRUE,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  accessed_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  decay_factor DECIMAL(5,4) DEFAULT 0.01,
  decay_checkpoint TIMESTAMP DEFAULT NOW(),

  INDEX idx_org_namespace (org_id, namespace),
  INDEX idx_created_by (created_by),
  INDEX idx_is_latest (is_latest),
  INDEX idx_embedding USING ivfflat (embedding vector_cosine_ops)  -- pgvector index
);

-- Memory scores (pre-computed for performance)
CREATE TABLE memory_scores (
  memory_id UUID PRIMARY KEY REFERENCES memory_entries(id) ON DELETE CASCADE,
  base_score DECIMAL(5,2),
  decay_multiplier DECIMAL(5,4),
  final_score DECIMAL(5,2),
  last_calculated TIMESTAMP DEFAULT NOW(),

  INDEX idx_final_score (final_score DESC)
);

-- Memory policies (Phase B - governance rules)
CREATE TABLE memory_policies (
  id UUID PRIMARY KEY,
  org_id VARCHAR(255) NOT NULL,
  namespace VARCHAR(255) NOT NULL,
  policy_type VARCHAR(50),  -- 'retention', 'access', 'conflict_resolution'
  rules JSONB,
  created_at TIMESTAMP DEFAULT NOW(),

  INDEX idx_org_namespace (org_id, namespace)
);

-- Memory access logs (Phase B - audit trail)
CREATE TABLE memory_access_logs (
  id UUID PRIMARY KEY,
  memory_id UUID REFERENCES memory_entries(id) ON DELETE CASCADE,
  accessed_by VARCHAR(255),
  access_type VARCHAR(50),  -- 'read', 'write', 'delete'
  accessed_at TIMESTAMP DEFAULT NOW(),

  INDEX idx_memory_id (memory_id),
  INDEX idx_accessed_at (accessed_at)
);
```

---

## Migration Strategy

### Principle: **Zero-Downtime Migration**

**Goal**: Upgrade infrastructure without breaking existing Collaboration Workflow features.

### Phase A Migration (Months 1-3)

#### Week 1-2: Database Schema Addition

```sql
-- Step 1: Add new tables (non-breaking)
CREATE TABLE memory_entries ( ... );
CREATE TABLE memory_scores ( ... );

-- Step 2: Install pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;
```

#### Week 3-4: Dual-Write Implementation

**Strategy**: Write to both old (`workflows.shared_memory`) and new (`memory_entries`) storage.

```typescript
// server/routers/agent-collaboration.ts - executeStep()

async function executeStep(...) {
  // ... execute agent logic ...

  const output = { agent: step.agentName, result: ... };

  // OLD PATH (keep for backward compatibility)
  if (workflow.memorySharing) {
    const memoryKey = `step_${stepIndex}_${step.agentName}`;
    sharedMemory[memoryKey] = output;
    await workflowDb.updateSharedMemory(workflowId, sharedMemory);
  }

  // NEW PATH (dual-write to memory system)
  await memoryRouter.create({
    org_id: `org-${workflow.createdBy}`,
    namespace: `workflow/${workflowId}`,
    content_type: 'data',
    content: JSON.stringify(output),
    embedding: await embeddings.generate(JSON.stringify(output)),
    metadata: {
      workflow_id: workflowId,
      step_index: stepIndex,
      agent_id: step.agentId,
    },
    confidence: 0.85,
    created_by: step.agentId,
  });
}
```

#### Month 2: Control Plane Implementation

1. Implement `memory-core/router.ts`
2. Implement `memory-core/scoring-engine.ts`
3. Implement `memory-core/version-manager.ts`
4. Add tRPC router `server/routers/memory.ts`

#### Month 3: Integration Testing

1. Test dual-write correctness (both systems store same data)
2. Verify collaboration workflows still work
3. Performance benchmarks (latency, throughput)
4. Migration validation queries

**Validation Query**:
```sql
-- Verify all workflow outputs are in memory_entries
SELECT
  w.id AS workflow_id,
  COUNT(DISTINCT ws.agent_id) AS workflow_steps,
  COUNT(DISTINCT me.id) AS memory_entries
FROM workflows w
JOIN workflow_steps ws ON w.id = ws.workflow_id
LEFT JOIN memory_entries me ON me.metadata->>'workflow_id' = w.id
WHERE w.status = 'completed'
GROUP BY w.id
HAVING COUNT(DISTINCT ws.agent_id) != COUNT(DISTINCT me.id);
-- Expected: 0 rows (all workflows have matching memory entries)
```

### Phase B Migration (Months 4-9)

1. Deprecate `workflows.shared_memory` (read-only, not written)
2. Add memory policies and access logs
3. Implement Conflict Arbitration Layer
4. Add Memory Insights Dashboard

### Phase C Migration (Months 10-18)

1. Remove old `shared_memory` column (breaking change)
2. Publish `@awareness/core` NPM package
3. Open-source Control Plane (Apache 2.0 license)

---

## Implementation Roadmap

### Phase A: Infrastructure Transformation (Months 1-3)

| Week | Milestone | Deliverables |
|------|-----------|--------------|
| 1-2 | Database Architecture | `memory_entries`, `memory_scores` tables; pgvector setup |
| 3-4 | Control Plane Core | `router.ts`, `scoring-engine.ts` modules |
| 5-6 | Dual-Write Integration | Collaboration workflow writes to both systems |
| 7-8 | Vector Store Abstraction | `VectorStore` interface + pgvector implementation |
| 9-10 | tRPC Memory API | `memory.query()`, `memory.create()` endpoints |
| 11-12 | Testing & Validation | Integration tests, migration validation, performance benchmarks |

**Success Criteria**:
- ✅ All collaboration workflows write to memory_entries
- ✅ Memory query API returns relevant results (semantic search)
- ✅ No performance degradation (<50ms latency increase)
- ✅ 100% data consistency between old and new systems

### Phase B: Memory Governance (Months 4-9)

| Month | Focus Area | Key Features |
|-------|------------|--------------|
| 4 | Scoring Engine | Dynamic scoring, decay calculations, re-ranking |
| 5 | Version Manager | Version tree, rollback, audit trails |
| 6 | Namespace System | Multi-tenant isolation, cross-department policies |
| 7 | Conflict Arbitration | Automatic conflict detection, resolution strategies |
| 8 | Access Control | RBAC, namespace permissions, audit logs |
| 9 | Insights Dashboard | Memory analytics, usage trends, quality metrics |

**Success Criteria**:
- ✅ Memory scores update dynamically based on usage
- ✅ Conflict resolution success rate >90%
- ✅ Multi-tenant isolation verified (no cross-org leakage)
- ✅ Dashboard shows real-time memory health metrics

### Phase C: Open Ecosystem (Months 10-18)

| Month | Focus Area | Key Deliverables |
|-------|------------|------------------|
| 10-11 | SDK Development | `@awareness/core` NPM package, documentation |
| 12-13 | Framework Integration | LangChain adapter, AutoGen adapter, CrewAI adapter |
| 14-15 | Self-Hosted Version | Docker Compose setup, Kubernetes Helm chart |
| 16-17 | Memory Schema Standard | AMSS v1.0 specification, RFC process, community feedback |
| 18 | Memory Marketplace | Optional marketplace for specialized memory agents |

**Success Criteria**:
- ✅ `@awareness/core` downloaded >1,000 times/month
- ✅ At least 2 major AI frameworks integrate Awareness
- ✅ Self-hosted deployment guide verified by community
- ✅ AMSS adopted by at least 3 external projects

---

## Technical Decisions

### 1. Vector Database: **pgvector** (Phase A)

**Rationale**:
- ✅ **Integrated**: Runs inside PostgreSQL (no additional infrastructure)
- ✅ **Transaction Support**: ACID guarantees with relational data
- ✅ **Simple Deployment**: No separate service to manage
- ✅ **Cost-Effective**: Leverage existing PostgreSQL hosting
- ⚠️ **Scale Limit**: Handles <10M vectors well; may need migration at >50M vectors

**Alternatives Considered**:
- **ChromaDB**: Better for ML teams, but adds deployment complexity
- **Milvus**: Enterprise-grade, but overkill for Phase A
- **Weaviate**: GraphQL API elegant, but learning curve for team

**Migration Path**: Phase C can introduce ChromaDB/Milvus as pluggable alternatives via `VectorStore` interface.

### 2. Embedding Model: **OpenAI text-embedding-3-small** (1536 dimensions)

**Rationale**:
- ✅ **Quality**: State-of-the-art performance on MTEB benchmark
- ✅ **Cost**: $0.02/1M tokens (10x cheaper than text-embedding-3-large)
- ✅ **Latency**: <200ms for typical memory content
- ⚠️ **Vendor Lock-in**: Requires OpenAI API key

**Alternatives**:
- **sentence-transformers/all-MiniLM-L6-v2**: Free, self-hosted, 384 dimensions (good for cost-sensitive deployments)
- **Cohere Embed v3**: Multilingual support, comparable quality

### 3. Namespace Format: **Hierarchical Slash-Delimited**

**Format**: `<org_id>/<scope>/<entity>`

**Rationale**:
- ✅ **Readable**: Humans can understand `org-123/engineering/agent-x`
- ✅ **Prefix Matching**: Easy to query all `org-123/engineering/*` memories
- ✅ **Flexible**: Supports arbitrary depth (e.g., `org-123/project/alpha/sprint-1`)

**Alternatives Considered**:
- **Dot-notation**: `org-123.engineering.agent-x` (less readable for paths)
- **UUID-based**: `ns-abc123` (opaque, hard to debug)

### 4. Decay Function: **Exponential Decay**

**Formula**: `decay_multiplier = exp(-λ * time_elapsed)`

**Rationale**:
- ✅ **Gradual**: Smooth decay over time (no cliff effect)
- ✅ **Tunable**: Different λ for different content types
- ✅ **Mathematically Sound**: Standard in information retrieval

**Example Decay Rates**:
- **Text** (λ=0.01): 70-day half-life (long-term knowledge)
- **Code** (λ=0.05): 14-day half-life (medium-term patterns)
- **Data** (λ=0.1): 7-day half-life (ephemeral facts)

### 5. Version Strategy: **Non-Destructive Updates**

**Approach**: Create new row with `version++`, set old row `is_latest=false`.

**Rationale**:
- ✅ **Audit Trail**: Full history of memory evolution
- ✅ **Rollback**: Easy to restore previous version
- ✅ **Conflict Resolution**: Multiple versions can coexist during arbitration
- ⚠️ **Storage Cost**: Versions accumulate (mitigated by periodic archival)

**Cleanup Strategy**:
- Keep latest version + last 5 versions by default
- Archive older versions to cold storage (S3/R2) after 90 days
- Delete archived versions after 1 year (configurable)

---

## Appendix A: Example Queries

### Create Memory
```typescript
const memoryId = await memoryRouter.create({
  org_id: 'org-123',
  namespace: 'engineering',
  content_type: 'text',
  content: 'We use JWT tokens with 15-minute expiry for authentication',
  embedding: await embeddings.generate('JWT authentication policy'),
  metadata: { source: 'tech-meeting-2026-02-07', confidence: 0.9 },
  confidence: 0.9,
  created_by: 'user-alice',
});
```

### Query Memory (Semantic Search)
```typescript
const results = await memoryRouter.query({
  org_id: 'org-123',
  namespaces: ['engineering', 'global'],
  query: 'How do we authenticate users?',
  limit: 5,
  filters: {
    content_type: 'text',
    min_confidence: 0.7,
  },
});

// Returns ranked memories with scores:
// [
//   { content: 'We use JWT tokens...', score: 0.92, namespace: 'engineering' },
//   { content: 'Authentication flow diagram...', score: 0.78, namespace: 'global' },
// ]
```

### Update Memory (Create New Version)
```typescript
await versionManager.createVersion('memory-abc', {
  content: 'We migrated to OAuth 2.0 with PKCE for authentication',
  confidence: 0.95,
});

// Result:
// memory-abc (v1) "We use JWT tokens..." [is_latest: false]
//   └─ memory-xyz (v2) "We migrated to OAuth 2.0..." [is_latest: true]
```

---

## Appendix B: Migration Checklist

### Pre-Migration
- [ ] Backup production database
- [ ] Set up staging environment with production data snapshot
- [ ] Install pgvector extension on staging
- [ ] Run migration scripts on staging
- [ ] Validate data integrity (all workflows → memory entries)

### Phase A Go-Live
- [ ] Deploy database migrations to production
- [ ] Enable dual-write mode (feature flag)
- [ ] Monitor error rates (alert if >1% errors)
- [ ] Validate consistency (daily cron job)
- [ ] Performance monitoring (latency, query time)

### Post-Migration
- [ ] Run migration validation queries weekly
- [ ] Deprecation notice for `shared_memory` (Phase B)
- [ ] Documentation update (API changes, migration guide)
- [ ] Team training on new Memory API

---

## Appendix C: References

- **Embedding Models**: [OpenAI Embeddings Guide](https://platform.openai.com/docs/guides/embeddings)
- **pgvector**: [GitHub - pgvector/pgvector](https://github.com/pgvector/pgvector)
- **Vector Search**: [Pinecone Vector Database Guide](https://www.pinecone.io/learn/vector-database/)
- **Information Retrieval**: [Introduction to Information Retrieval - Manning, Raghavan, Schütze](https://nlp.stanford.edu/IR-book/)
- **Multi-Tenancy**: [AWS Multi-Tenant SaaS Architecture](https://docs.aws.amazon.com/whitepapers/latest/saas-architecture-fundamentals/multi-tenant-saas-architecture.html)

---

**Document Owner**: Awareness Network Architecture Team
**Review Cycle**: Monthly during Phase A, Quarterly during Phase B/C
**Feedback**: Create GitHub issue or contact architecture@awareness.market
