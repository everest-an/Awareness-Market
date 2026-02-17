# Contributing

## How to Contribute to the Awareness Network

Thank you for your interest in contributing to the Awareness Network. This guide covers the complete contribution workflow, from forking the repository through code review and merge.

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 20.x LTS or later
- [PostgreSQL](https://www.postgresql.org/) 15.x
- [Redis](https://redis.io/) 7.x
- [Git](https://git-scm.com/) 2.x or later
- A GitHub account

### Fork and Clone

1. Fork the repository on GitHub by clicking the **Fork** button on [github.com/awareness-network/awareness-network](https://github.com/awareness-network/awareness-network).

2. Clone your fork locally:

```bash
git clone https://github.com/YOUR_USERNAME/awareness-network.git
cd awareness-network
```

3. Add the upstream remote:

```bash
git remote add upstream https://github.com/awareness-network/awareness-network.git
```

4. Install dependencies:

```bash
npm install
```

5. Set up the development environment:

```bash
cp .env.example .env
# Edit .env with your local database and Redis connection strings

npx prisma migrate dev
npx prisma db seed
```

6. Verify everything works:

```bash
npm run dev
npm test
```

---

## Branch Strategy

All contributions should be made on a feature branch created from the latest `main` branch.

### Branch Naming Convention

| Prefix | Purpose | Example |
|---|---|---|
| `feature/` | New features or significant additions | `feature/session-replay` |
| `fix/` | Bug fixes | `fix/websocket-reconnect` |
| `docs/` | Documentation changes | `docs/api-reference-update` |
| `refactor/` | Code refactoring without behavior changes | `refactor/extract-auth-middleware` |
| `test/` | Adding or improving tests | `test/collaboration-session-tests` |
| `chore/` | Build, tooling, or dependency updates | `chore/upgrade-prisma-v6` |

### Creating a Branch

```bash
# Ensure your main branch is up to date
git checkout main
git pull upstream main

# Create your feature branch
git checkout -b feature/your-feature-name
```

---

## Commit Conventions

This project follows the [Conventional Commits](https://www.conventionalcommits.org/) specification. Every commit message must follow this format:

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types

| Type | Description |
|---|---|
| `feat` | A new feature |
| `fix` | A bug fix |
| `docs` | Documentation changes only |
| `style` | Formatting, missing semicolons, etc. (no code change) |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `perf` | Performance improvement |
| `test` | Adding or correcting tests |
| `chore` | Build process, tooling, or auxiliary changes |
| `ci` | CI/CD configuration changes |
| `revert` | Reverts a previous commit |

### Scopes

Common scopes include: `marketplace`, `collaboration`, `sdk`, `api`, `ui`, `auth`, `database`, `redis`, `mcp`, `neural-cortex`, `zkp`, `erc8004`, `deployment`.

### Examples

```
feat(collaboration): add session replay with variable speed playback

Implements a replay system that allows users to review completed
collaboration sessions at 1x, 2x, 4x, or 8x speed.

Closes #142
```

```
fix(marketplace): resolve stale search results from Redis cache

The cache invalidation was not triggered on package status changes,
causing deleted packages to appear in search results.

Fixes #287
```

```
docs(api): update WebSocket message type reference
```

---

## Pull Request Process

### Before Submitting

1. **Rebase on latest main** to ensure your branch is up to date:

```bash
git fetch upstream
git rebase upstream/main
```

2. **Run the full test suite** and ensure all tests pass:

```bash
npm test
```

3. **Run the linter** and fix any issues:

```bash
npm run lint
npm run lint:fix
```

4. **Run the type checker**:

```bash
npm run typecheck
```

5. **Build the project** to verify there are no compilation errors:

```bash
npm run build
```

### Submitting the PR

1. Push your branch to your fork:

```bash
git push origin feature/your-feature-name
```

2. Open a Pull Request on GitHub against the `main` branch of the upstream repository.

3. Fill in the PR template completely:

```markdown
## Summary
Brief description of what this PR does.

## Changes
- Bullet list of specific changes

## Testing
Describe how you tested these changes.

## Screenshots (if applicable)
Include screenshots for UI changes.

## Checklist
- [ ] Tests pass (`npm test`)
- [ ] Linter passes (`npm run lint`)
- [ ] Types check (`npm run typecheck`)
- [ ] Build succeeds (`npm run build`)
- [ ] Documentation updated (if applicable)
- [ ] Changelog entry added (if applicable)
```

### PR Size Guidelines

| Size | Lines Changed | Review Time | Guidance |
|---|---|---|---|
| **Small** | < 100 | Same day | Ideal; easy to review |
| **Medium** | 100 -- 500 | 1 -- 2 days | Acceptable; include good context |
| **Large** | 500 -- 1000 | 2 -- 5 days | Consider splitting into smaller PRs |
| **Extra Large** | > 1000 | May be rejected | Split into smaller, reviewable units |

---

## Code Review

All pull requests require at least one approving review from a maintainer before merge.

### What Reviewers Look For

- **Correctness**: Does the code do what it claims? Are there edge cases?
- **Testing**: Are there adequate tests? Do they cover failure modes?
- **Performance**: Are there obvious performance issues (N+1 queries, unnecessary allocations)?
- **Security**: Are there injection risks, authentication bypasses, or data leaks?
- **Readability**: Is the code clear and well-structured? Are names descriptive?
- **Consistency**: Does the code follow existing patterns and conventions?

### Responding to Feedback

- Address all review comments, either by making changes or explaining your reasoning.
- Mark resolved conversations as resolved.
- Push new commits rather than force-pushing over reviewed commits (makes it easier for reviewers to see incremental changes).
- Request re-review when all feedback has been addressed.

---

## Testing Requirements

### Test Categories

| Category | Location | Runner | When to Write |
|---|---|---|---|
| **Unit Tests** | `src/**/*.test.ts` | Vitest | For all business logic, utilities, and pure functions |
| **Integration Tests** | `tests/integration/` | Vitest | For API endpoints, database operations, and service interactions |
| **E2E Tests** | `tests/e2e/` | Playwright | For critical user flows (login, purchase, session creation) |

### Running Tests

```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# With coverage report
npm run test:coverage
```

### Coverage Expectations

| Metric | Minimum | Target |
|---|---|---|
| **Line coverage** | 70% | 85%+ |
| **Branch coverage** | 65% | 80%+ |
| **Function coverage** | 75% | 90%+ |

New code should not decrease the overall coverage percentage.

### Writing Good Tests

```typescript
describe('CollaborationSession', () => {
  describe('createSession', () => {
    it('should create a session with valid parameters', async () => {
      const session = await createSession({
        objective: 'Test objective',
        agents: ['manus', 'claude'],
      });

      expect(session.id).toBeDefined();
      expect(session.status).toBe('created');
      expect(session.agents).toHaveLength(2);
    });

    it('should reject sessions with no agents', async () => {
      await expect(
        createSession({ objective: 'Test', agents: [] })
      ).rejects.toThrow('At least one agent is required');
    });

    it('should enforce maximum session duration', async () => {
      const session = await createSession({
        objective: 'Test',
        agents: ['manus'],
        config: { maxDurationMs: 999999999 },
      });

      // Should be capped to the maximum allowed duration
      expect(session.config.maxDurationMs).toBeLessThanOrEqual(3600000);
    });
  });
});
```

---

## Code Style

- **Language**: TypeScript (strict mode)
- **Formatter**: Prettier (configuration in `.prettierrc`)
- **Linter**: ESLint (configuration in `.eslintrc.cjs`)
- **Import order**: External packages, then internal modules, then relative imports, separated by blank lines
- **Naming**: camelCase for variables and functions, PascalCase for types and classes, UPPER_SNAKE_CASE for constants

Run the formatter before committing:

```bash
npx prettier --write .
```

---

## Getting Help

- **Questions**: Open a [GitHub Discussion](https://github.com/awareness-network/awareness-network/discussions)
- **Bug reports**: Open a [GitHub Issue](https://github.com/awareness-network/awareness-network/issues) using the bug report template
- **Feature requests**: Open a [GitHub Issue](https://github.com/awareness-network/awareness-network/issues) using the feature request template
- **Security issues**: See [Security Policy](security.md) -- do not open public issues for security vulnerabilities
