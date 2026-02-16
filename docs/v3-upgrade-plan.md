# Awareness Network v3.0 — AI Organization Governance & Decision Infrastructure

## Context

Based on strategic analysis (ChatGPT session), Awareness Network needs to evolve from a marketplace into enterprise-grade **AI Organization Governance Infrastructure** that supports:
- **Individual developers**: 2-4 AI agent teams
- **Enterprise**: 64+ AI agents with departments (Finance, Dev, BD, Legal, Research)
- **Scientific collaboration**: Cross-domain verification (Math AI + Physics AI + Chemistry AI)

The goal is commercial viability with a phased approach where each phase is independently shippable and sellable.

## Existing Foundation (Already Implemented)

The codebase already has significant scaffolding:
- `MemoryEntry` model with `orgId`, `namespace`, `department`, `agentId`, `decayFactor`, `claimKey`, `claimValue` fields
- `scoring-engine.ts` with base score + decay + usage/validation/reputation components
- `semantic-conflict-detector.ts` + `conflict-resolver.ts` with claim_value_mismatch and semantic_contradiction
- `version-manager.ts` + `version-tree.ts` for memory versioning
- `entity-extractor.ts`, `relation-builder.ts`, `rmc-retriever.ts` for knowledge graph
- BullMQ worker pattern in `server/workers/rmc-worker.ts`
- 25+ tRPC routers, Redis caching, Socket.IO real-time
- Frontend: MemoryManagement, ConflictResolution, MemoryScoreBreakdown, AgentRegistry pages

**Key Gaps**: No Organization/Department models, no Decision recording, no multi-layer memory pools, no cross-domain verification, no automated decay processing, no multi-dimensional agent reputation.

---

## Phase 1: Organization Foundation + Enhanced Scoring + Memory Lifecycle (Weeks 1-3)

**Commercial Value**: "Create your AI organization" — enables multi-tenant enterprise sales

### 1.1 Database Schema (Prisma)

New models in `prisma/schema.prisma`:

| Model | Purpose | Key Fields |
|-------|---------|------------|
| `Organization` | Multi-tenant org | id, name, slug, planTier (lite/team/enterprise/scientific), maxAgents, maxMemories, stripeCustomerId |
| `Department` | Org subdivision | orgId, name, slug, parentDeptId (tree hierarchy) |
| `OrgMembership` | User-to-org | userId, orgId, role (owner/admin/dept_admin/member/viewer), departmentIds |
| `AgentAssignment` | Agent-to-dept | agentId, orgId, departmentId |

New enum `MemoryType` on `MemoryEntry`: episodic (λ=0.05), semantic (λ=0.01), strategic (λ=0.001), procedural (λ=0.02)

Modify existing `MemoryEntry.orgId` from free-form string to Organization FK (with migration script).

### 1.2 Backend

| File | Action | Description |
|------|--------|-------------|
| `server/organization/org-service.ts` | NEW | Org CRUD, plan tier enforcement, agent limit checks |
| `server/organization/dept-service.ts` | NEW | Department CRUD, hierarchy management |
| `server/organization/membership-service.ts` | NEW | User-org membership, role checks |
| `server/routers/organization.ts` | NEW | tRPC router (follows `memory.ts` pattern) |
| `server/workers/decay-worker.ts` | NEW | BullMQ cron (every 6h): recalculate decay, auto-archive low-score memories, per-MemoryType lambda |
| `server/memory-core/scoring-engine.ts` | MODIFY | Add `classifyQualityTier()` (platinum/gold/silver/bronze), configurable weights |
| `server/memory-core/router.ts` | MODIFY | Accept `memoryType` parameter on create |
| `server/routers.ts` | MODIFY | Register new organization router |

### 1.3 Frontend

| File | Action | Description |
|------|--------|-------------|
| `client/src/pages/OrganizationSetup.tsx` | NEW | Org creation wizard: name, plan tier, initial departments |
| `client/src/pages/OrgDashboard.tsx` | NEW | Org overview: departments, agents, memory counts, plan usage |
| `client/src/components/DepartmentManager.tsx` | NEW | Department CRUD with tree hierarchy |
| `client/src/pages/AdminPanel.tsx` | MODIFY | Add "Organizations" tab for platform admins |
| `client/src/App.tsx` | MODIFY | Add routes: /org/setup, /org/dashboard |

### 1.4 Migration

- Additive-only: new tables + new columns with defaults
- Backfill script: `scripts/migrate-phase-1.ts` creates default Organization for existing MemoryEntry records
- Feature flag: `ENABLE_ORGANIZATIONS=true`

### 1.5 Testing

- Unit: org-service CRUD, plan limit enforcement, quality tier classification
- Integration: decay-worker archives low-score memories correctly
- E2E: Create org → add departments → create memory in department → verify namespace isolation

### 1.6 Pricing Milestone

| Plan | Agents | Price | Features |
|------|--------|-------|----------|
| Lite | 2-8 | $49/mo | Basic org, 1 department, memory lifecycle |
| Team | 8-32 | $199/mo | Multi-department, decay automation |

---

## Phase 2: Multi-Layer Memory Pools + Enhanced Conflict Arbitration (Weeks 4-6)

**Commercial Value**: "Enterprise AI Governance" — departmental isolation with automated conflict resolution

### 2.1 Database Schema

New models:

| Model | Purpose | Key Fields |
|-------|---------|------------|
| `MemoryPool` | Pool configuration | orgId, poolType (private/domain/global), departmentId, readPolicy, writePolicy, promotionThreshold |

Modify `MemoryEntry`: add `poolType` field (default: domain)

Modify `MemoryConflict`: add `severity` (low/medium/high/critical), `autoResolvable`, `arbitrationAgent`, `impactScope` JSON, `explanation`

### 2.2 Backend

| File | Action | Description |
|------|--------|-------------|
| `server/memory-core/memory-pool-router.ts` | NEW | Pool-aware retrieval: Private → Domain → Global read order, token budget control, multi-pool merge & rank |
| `server/memory-core/memory-promoter.ts` | NEW | Domain → Global promotion when validation_count exceeds threshold |
| `server/workers/conflict-arbitration-worker.ts` | NEW | BullMQ worker for high-severity conflict LLM arbitration |
| `server/memory-core/conflict-resolver.ts` | MODIFY | Add: `classifySeverity()`, `autoResolve()` (low), `requestArbitration()` (high/critical), `propagateImpact()` via MemoryRelation graph |
| `server/memory-core/semantic-conflict-detector.ts` | MODIFY | Output severity classification, extract structured claims {claim_key, claim_value, domain, assumptions[], evidence[]} |
| `server/memory-core/router.ts` | MODIFY | Accept `pools` parameter, integrate pool-router |

### 2.3 Frontend

| File | Action | Description |
|------|--------|-------------|
| `client/src/components/MemoryPoolVisualizer.tsx` | NEW | 3-tier pool diagram with memory flow arrows |
| `client/src/pages/MemoryManagement.tsx` | MODIFY | Pool selector tabs (Private/Domain/Global), pool-specific counts, "Promote to Global" button |
| `client/src/pages/ConflictResolution.tsx` | MODIFY | Severity badges, "Auto-Resolve" button (low), "Request Arbitration" button (high/critical), Impact Propagation Viewer |

### 2.4 Testing

- Unit: pool-aware retrieval order, token budget enforcement, promotion threshold logic
- Integration: conflict severity classification, impact propagation through dependency graph
- E2E: Agent A writes domain → conflicts with Agent B → auto-resolve fires for low severity

### 2.5 Pricing Milestone

Team plan ($199/mo) now includes: memory pools, conflict arbitration, promotion policies

---

## Phase 3: Decision Recorder + Agent Reputation System (Weeks 7-9)

**Commercial Value**: "AI Compliance & Audit" — every AI decision is traceable and every agent is accountable

### 3.1 Database Schema

New models:

| Model | Purpose | Key Fields |
|-------|---------|------------|
| `Decision` | Decision audit trail | orgId, agentId, departmentId, inputQuery, retrievedMemoryIds[], memoryScoresSnapshot JSON, output, confidence, outcomeVerified, outcomeCorrect |
| `AgentReputation` | Multi-dimensional rep | agentId, orgId, departmentId, writeQuality, decisionAccuracy, collaborationScore, domainExpertise, overallReputation, totalWrites, validatedWrites, conflictedWrites, totalDecisions, correctDecisions |

### 3.2 Backend

| File | Action | Description |
|------|--------|-------------|
| `server/decision/decision-recorder.ts` | NEW | Intercepts agent query responses, snapshots memory context at decision time |
| `server/decision/decision-replay.ts` | NEW | Reconstructs historical memory state for a given decision ID |
| `server/routers/decision.ts` | NEW | tRPC router: list, get, replay, export decisions |
| `server/reputation/reputation-engine.ts` | NEW | Multi-dimensional calculation: writeQuality*0.3 + decisionAccuracy*0.3 + collaboration*0.2 + domainExpertise*0.2 |
| `server/reputation/reputation-hooks.ts` | NEW | Event hooks: memory validated → writeQuality up, conflict → writeQuality down, outcome verified → decisionAccuracy update |
| `server/workers/reputation-decay-worker.ts` | NEW | BullMQ cron: decay reputation for inactive agents |
| `server/memory-core/scoring-engine.ts` | MODIFY | Fetch AgentReputation.overallReputation for memory scoring (feedback loop: high-rep agents → higher-scored memories) |

### 3.3 Frontend

| File | Action | Description |
|------|--------|-------------|
| `client/src/pages/DecisionAudit.tsx` | NEW | Decision timeline, filter by agent/department, replay button |
| `client/src/components/DecisionReplayViewer.tsx` | NEW | Shows memories available at decision time with historical scores |
| `client/src/components/AgentReputationCard.tsx` | NEW | Radar chart (Recharts) of 4 reputation dimensions + sparklines |
| `client/src/pages/AgentRegistry.tsx` | MODIFY | Add multi-dimensional reputation display, per-department breakdown |

### 3.4 Testing

- Unit: decision snapshot accuracy, multi-dimensional reputation calculation
- Integration: memory validated → reputation increases → new memory gets higher base score (feedback loop)
- E2E: decision replay shows correct historical memory state

### 3.5 Pricing Milestone

| Plan | Price | New Features |
|------|-------|-------------|
| Enterprise | $499/mo | Decision audit, reputation system, compliance export |

---

## Phase 4: Cross-Domain Verification + Evidence Layer (Weeks 10-12)

**Commercial Value**: "Scientific AI Collaboration" — peer-reviewed AI knowledge with dependency tracking

### 4.1 Database Schema

New models:

| Model | Purpose | Key Fields |
|-------|---------|------------|
| `VerificationRequest` | Cross-dept peer review | memoryId, sourceDepartment, targetDepartment, status (pending/assigned/verified/rejected/expired), verifierAgentId, verificationResult JSON, scoreImpact |
| `Evidence` | Citation backing | memoryId, evidenceType (arxiv/doi/internal_data/experimental/computational), sourceUrl, sourceDoi, claimType (theorem/hypothesis/model/experimental_result), assumptions JSON, unit, dimension |
| `MemoryDependency` | Dependency graph | sourceMemoryId, dependsOnMemoryId, dependencyType (assumes/builds_on/requires), needsRevalidation |

### 4.2 Backend

| File | Action | Description |
|------|--------|-------------|
| `server/verification/verification-service.ts` | NEW | Cross-department peer review workflow: auto-create requests for strategic claims, select best verifier by AgentReputation.domainExpertise, update confidence on completion |
| `server/verification/verification-worker.ts` | NEW | BullMQ worker: assign verifiers, track timeouts |
| `server/evidence/evidence-service.ts` | NEW | Evidence CRUD, DOI resolution, citation validation |
| `server/evidence/dependency-cascade.ts` | NEW | When base memory invalidated → traverse MemoryDependency graph → set needsRevalidation=true → reduce dependent confidence → notify via Socket.IO |
| `server/routers/verification.ts` | NEW | tRPC router |
| `server/routers/evidence.ts` | NEW | tRPC router |
| `server/memory-core/router.ts` | MODIFY | Accept `evidence[]` and `dependencies[]` on create |

### 4.3 Frontend

| File | Action | Description |
|------|--------|-------------|
| `client/src/pages/VerificationDashboard.tsx` | NEW | Pending reviews, verification history, cross-department analytics |
| `client/src/components/EvidenceAttachment.tsx` | NEW | DOI lookup, URL input, claim type selection, unit/dimension fields |
| `client/src/components/DependencyGraph.tsx` | NEW | Interactive dependency graph (follows MemoryGraphViewer pattern), revalidation flags highlighted |

### 4.4 Testing

- Unit: cross-department verifier selection, dependency cascade propagation
- Integration: memory invalidated → cascade → dependent memories flagged → agents notified
- Scientific mode test: mandatory peer review for all strategic claims

### 4.5 Pricing Milestone

| Plan | Price | New Features |
|------|-------|-------------|
| Scientific | $999/mo | Cross-domain verification, evidence tracking, dependency graphs |

---

## Phase 5: Enterprise Dashboard + Analytics (Weeks 13-14)

**Commercial Value**: "See your AI organization at a glance" — executive visibility and compliance reporting

*Can run in parallel with Phase 4 (no dependency)*

### 5.1 Backend

| File | Action | Description |
|------|--------|-------------|
| `server/analytics/org-analytics.ts` | NEW | Org-level aggregation: memory health, agent performance, department productivity, cross-dept collaboration frequency |
| `server/analytics/billing-tracker.ts` | NEW | Usage tracking per org: memory count, API calls, agent count, LLM tokens |
| `server/analytics/report-exporter.ts` | NEW | Export decision audit reports as CSV/PDF |
| `server/routers/org-analytics.ts` | NEW | tRPC router |

### 5.2 Frontend

| File | Action | Description |
|------|--------|-------------|
| `client/src/pages/OrgAnalytics.tsx` | NEW | Department productivity bars, agent leaderboard, memory health trends, real-time monitoring (Socket.IO) |
| `client/src/pages/BillingDashboard.tsx` | NEW | Plan tier visualization, usage vs limits, upgrade CTA |
| `client/src/components/DecisionAuditExport.tsx` | NEW | Export format selection (CSV/PDF) |
| `client/src/pages/AdminPanel.tsx` | MODIFY | Cross-organization analytics for platform admins |

### 5.3 Testing

- Unit: analytics aggregation queries (correct grouping/filtering)
- Load test: 64+ agents, thousands of memories
- E2E: Full workflow from org creation through decision audit export

---

## Phase Dependency Graph

```
Phase 1 (Org + Scoring + Lifecycle)     ← Foundation, must be first
    ↓
Phase 2 (Memory Pools + Conflict)       ← Depends on Org hierarchy
    ↓
Phase 3 (Decisions + Reputation)        ← Depends on Pools for decision context
    ↓
Phase 4 (Verification + Evidence)  ←┐
                                     ├── Can run in parallel
Phase 5 (Dashboard + Analytics)    ←┘
```

---

## File Summary

### New Files (~38 total)

| Category | Count | Examples |
|----------|-------|---------|
| Backend services | 14 | org-service, decision-recorder, reputation-engine, verification-service, evidence-service |
| tRPC routers | 5 | organization, decision, verification, evidence, org-analytics |
| BullMQ workers | 4 | decay-worker, conflict-arbitration-worker, reputation-decay-worker, verification-worker |
| Frontend pages | 9 | OrganizationSetup, OrgDashboard, DecisionAudit, VerificationDashboard, OrgAnalytics, BillingDashboard |
| Frontend components | 6 | DepartmentManager, MemoryPoolVisualizer, DecisionReplayViewer, AgentReputationCard, EvidenceAttachment, DependencyGraph |

### Modified Files (~12 total)

| File | Phases |
|------|--------|
| `prisma/schema.prisma` | 1, 2, 3, 4 |
| `server/memory-core/scoring-engine.ts` | 1, 3 |
| `server/memory-core/router.ts` | 1, 2, 4 |
| `server/memory-core/conflict-resolver.ts` | 2 |
| `server/memory-core/semantic-conflict-detector.ts` | 2 |
| `server/routers.ts` | 1, 2, 3, 4, 5 |
| `client/src/pages/MemoryManagement.tsx` | 2 |
| `client/src/pages/ConflictResolution.tsx` | 2 |
| `client/src/pages/AgentRegistry.tsx` | 3 |
| `client/src/pages/AdminPanel.tsx` | 1, 5 |
| `client/src/App.tsx` | 1, 2, 3, 4, 5 |

---

## Cross-Cutting Concerns

- **Feature Flags**: Each phase behind env vars (`ENABLE_ORGANIZATIONS`, `ENABLE_MEMORY_POOLS`, `ENABLE_DECISIONS`, `ENABLE_VERIFICATION`)
- **Zero-Downtime Migrations**: All new columns have `@default()` values, additive-only
- **Redis Caching**: All analytics use existing `RedisCacheService` with tag-based invalidation
- **Security**: All endpoints verify OrgMembership, dept_admin scoped to department, Global pool writes require admin or automated promotion, Decisions are insert-only (immutable audit)
- **SDK Updates**: Python SDK (`sdk/python/`) and MCP Server (`server/mcp-api.ts`) need org_id parameter added after Phase 1

---

## Commercial Pricing Summary

| Plan | Price | Max Agents | Key Features |
|------|-------|-----------|-------------|
| **Lite** | $49/mo | 8 | 1 org, basic departments, memory lifecycle, scoring |
| **Team** | $199/mo | 32 | Multi-department, memory pools, conflict arbitration |
| **Enterprise** | $499/mo | 128 | Decision audit, reputation system, compliance export |
| **Scientific** | $999/mo | Unlimited | Cross-domain verification, evidence tracking, dependency graphs |

---

## Verification & Testing Strategy

After each phase:
1. Run `pnpm prisma migrate dev` — verify schema migration succeeds
2. Run `pnpm test` — verify no regressions
3. Run backfill script — verify existing data migrated correctly
4. Manual smoke test of new frontend pages
5. Run `pnpm build` — verify production build succeeds
6. Load test with simulated multi-agent scenarios
