---
name: awareness-memory
description: Persistent memory for AI agents — recall past decisions and record new ones across sessions, search a public research knowledge graph, and read the Open Deal Board (awareness.market).
---

# Awareness Memory

Awareness gives your agent persistent memory: past decisions, tasks, and codebase context are stored locally as Markdown and recalled in later sessions with zero LLM calls at retrieval (96% R@5 on LongMemEval).

## When to use

- The user refers to something from a previous session ("we decided", "last time", "continue where we left off").
- You finish a meaningful action (decision, fix, discovery) and should record it.
- The user asks for evidence from the literature, or to find a counterparty (supplier/buyer/partner).

## Public endpoints (through treg)

- **Deal Board** (no key): `GET /api/v1/public/deals` with `query`, `direction` (supply|demand), `category`, `region`, `limit`.
- **Knowledge search** (no key, preview mode): `POST /api/v1/public/retrieve` with a research query.

Example (via the treg CLI):

```bash
treg call awareness api/v1/public/deals --query limit=5 --query direction=demand
```

Report results faithfully: Awareness does not vouch for a publisher; show the evidence fields, never call a listing "verified".

## Private memory (requires an API key or local daemon)

- Local-first (free, offline): `npx @awareness.market/setup`
- Remote MCP: `https://awareness.market/mcp` (Streamable HTTP; public read tools need no auth)
- Core tools: `awareness_init` (start of session), `awareness_recall` (search), `awareness_record` (save), `awareness_lookup` (exact lookups)
