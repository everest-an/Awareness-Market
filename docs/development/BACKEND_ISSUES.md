## Backend Issues Report (2026-02-02)

This document outlines the critical issues identified in the backend codebase that are preventing full functionality of the Awareness Market application.

### 1. Missing tRPC Router Registration

**Issue:** The `packages` API router is not correctly registered in the main application router, causing all package-related API calls to fail with a "No procedure found" error.

**File:** `server/routers.ts`

**Analysis:**
- The `packagesApiRouter` is imported but not included in the `appRouter` definition.
- This prevents tRPC from exposing the `packages.list`, `packages.get`, etc. endpoints.

**Recommended Fix:**
1.  Ensure `packages-api.ts` correctly exports `packagesApiRouter`.
2.  Add `packages: packagesApiRouter,` to the `appRouter` object in `server/routers.ts`.

### 2. Incorrect Import Paths in Multiple Files

**Issue:** The backend build process fails due to incorrect relative import paths for shared modules like `logger` and `trpc`.

**Files:**
- `server/socket-events.ts`
- `server/auth-phantom.ts`
- `server/latentmas-upload.ts`
- `server/latentmas-resonance.ts`

**Analysis:**
- These files use imports like `from './logger.js'` instead of `from './utils/logger'`.
- This indicates a lack of consistency in the project's path resolution strategy.

**Recommended Fix:**
- Correct all incorrect import paths to reflect the actual file structure.
- Consider using TypeScript path aliases (`tsconfig.json`) to simplify imports (e.g., `@/utils/logger`).

### 3. Build Process Failures

**Issue:** The `pnpm run build:server:esbuild` script is missing, and direct `esbuild` commands fail due to the import path errors.

**File:** `package.json`

**Analysis:**
- The backend build process is not robust and relies on specific, fragile configurations.
- The current `build` script attempts to build both client and server, which is inefficient and prone to failure.

**Recommended Fix:**
- Create separate, reliable build scripts for the client and server (e.g., `build:client` and `build:server`).
- Ensure the server build script correctly resolves all dependencies and paths.

### 4. Database Seeding and Initial Data

**Issue:** The marketplace appears empty, indicating that the database may not be seeded with initial data for packages, categories, etc.

**Analysis:**
- There is no evidence of a database seeding script being run after deployment.
- The recent migration from Drizzle to Prisma may have affected how initial data is handled.

**Recommended Fix:**
- Create a `seed.ts` script using Prisma Client to populate the database with necessary initial data.
- Add a `db:seed` script to `package.json` to be run after migrations.

### Summary of Required Actions

1.  **Fix Backend Code:**
    -   Correct all tRPC router registrations.
    -   Fix all incorrect import paths.
2.  **Improve Build Process:**
    -   Create stable, separate build scripts for client and server.
3.  **Implement Database Seeding:**
    -   Create and run a database seed script to populate the marketplace.

Addressing these issues is critical to restoring full backend functionality and enabling the marketplace and other features to work correctly.
