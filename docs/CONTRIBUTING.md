# Contributing

Development workflow, code standards, and documentation rules for Awareness Market.

---

## Documentation Maintenance Rules

> These rules exist to prevent documentation sprawl caused by AI-assisted ("vibe coding") iteration.
> Every contributor — human or AI — must follow them without exception.

1. **Never create `README_new.md`, `DEPLOYMENT_v2.md`, or any versioned/suffixed doc files.** Edit the existing file directly. Git history is the version control.
2. **Never place `.md` files inside `client/`, `server/`, `contracts/`, or any source directory.** Documentation belongs in `/docs/` only.
3. **Never create status reports, phase summaries, or "completion" documents.** (`PHASE1_STATUS.md`, `V3_COMPLETION_REPORT.md`, etc. are banned.) Use GitHub issues/PRs for tracking.
4. **The only permitted files in `/docs/` root are:** `ARCHITECTURE.md`, `DEPLOYMENT.md`, `CONTRIBUTING.md`. All others go in a subdirectory.
5. **All documentation changes must be included in the same PR as the code change they document.** No documentation-only PRs unless fixing an existing doc error.

---

## Development Workflow

### Branch naming

```text
feat/short-description      # new feature
fix/short-description       # bug fix
refactor/short-description  # code change with no behavior change
docs/short-description      # documentation only (rare — see rule 5 above)
```

### Commit style (Conventional Commits)

```text
feat: add BYOK provider key storage
fix: resolve double DB call in agentPurchase
refactor: split web3-provider.ts into focused modules
docs: update DEPLOYMENT.md with pgvector setup
chore: bump ethers to 6.16
```

### Pull request checklist

Before opening a PR:

- [ ] `pnpm run build` passes (no TypeScript errors)
- [ ] `pnpm test` passes (or new tests added for new logic)
- [ ] No `any` types introduced without a comment explaining why
- [ ] New tRPC routers registered in `server/routers.ts`
- [ ] New env vars documented in `docs/DEPLOYMENT.md`
- [ ] No `.md` files created in source directories

---

## Code Standards

### TypeScript

- No `any` — use `unknown` + type narrowing, or explicit interfaces
- Pure functions for business logic (no DB/network calls) — makes unit testing trivial
- Constants in `server/blockchain/constants.ts` (server) or `client/src/lib/web3/constants.ts` (client) — never inline magic numbers

### tRPC router conventions

```typescript
// server/routers/your-feature.ts
export const yourFeatureRouter = router({
  getData: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      // DB / service calls here
      return { success: true, data: result };
    }),
});
```

Then register in `server/routers.ts`:

```typescript
import { yourFeatureRouter } from './routers/your-feature';

export const appRouter = router({
  // … existing routers …
  yourFeature: yourFeatureRouter,
});
```

### Error handling layers

| Error type | How to throw |
| ---------- | ------------ |
| Not found | `throw new TRPCError({ code: 'NOT_FOUND', message: '…' })` |
| Auth failure | `throw new TRPCError({ code: 'FORBIDDEN', message: '…' })` |
| Validation | Use Zod schema on input — tRPC surfaces automatically |
| On-chain errors | Catch in mutation, classify via `classifyError()` in `useStablecoinPayment.ts` |

### React component rules

- Business logic belongs in hooks (`client/src/hooks/`), not in component bodies
- Payment step UI is split into sub-components in `client/src/components/payment/`
- No fee math in components — derive from server quote data

---

## Running Tests

```bash
# Server unit tests (Vitest)
pnpm test

# Specific test file
pnpm vitest server/blockchain/__tests__/crypto-utils.test.ts

# Frontend component tests
pnpm test:client
```

### Test file locations

| Scope | Location |
| ----- | -------- |
| Server pure functions | `server/blockchain/__tests__/` |
| Server service logic | `server/services/__tests__/` |
| Client hooks | `client/src/hooks/__tests__/` |

### Writing tests for new features

- Pure functions (no DB/network): test directly with Vitest
- Service functions with DB: mock Prisma via `vi.mock('../db-prisma', …)`
- tRPC procedures: use `createCallerFactory` for integration tests

---

## Adding Environment Variables

1. Add to `.env.example` with a placeholder value and comment
2. Document in `docs/DEPLOYMENT.md` under the relevant section
3. Read in the relevant module — never call `process.env.X` inside a loop or hot path; read once at module level

```typescript
// Good — read once at module level
const MY_KEY = process.env.MY_KEY;
if (!MY_KEY) throw new Error('MY_KEY is required');
```

---

## Local Setup

See [README.md](../README.md#quick-start) for the 4-step quick start.

For extended local setup (pgvector, Redis, Docker Compose): [docs/development/setup/](development/setup/)
