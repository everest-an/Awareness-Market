# Awareness Network - Testing Guide

> Last Updated: February 1, 2026

This guide covers all testing procedures, test suites, and quality assurance processes for the Awareness Network platform.

---

## Table of Contents

1. [Overview](#overview)
2. [Test Environment Setup](#test-environment-setup)
3. [Unit Tests](#unit-tests)
4. [Integration Tests](#integration-tests)
5. [E2E Tests](#e2e-tests)
6. [Performance Tests](#performance-tests)
7. [Hive Mind Testing](#hive-mind-testing)
8. [Running Tests](#running-tests)
9. [Test Coverage](#test-coverage)
10. [Troubleshooting](#troubleshooting)

---

## Overview

### Test Framework

- **Framework**: Vitest v2.1.9
- **Language**: TypeScript
- **Total Tests**: 97+ unit tests
- **Pass Rate**: 100%

### Test Categories

| Category | Tests | Description |
|----------|-------|-------------|
| Unit Tests | 97+ | Individual function/module testing |
| Integration Tests | 15+ | API endpoint integration |
| E2E Tests | 1 suite | Full user flow testing |
| Performance Tests | 12 | GPU/CPU benchmarks |

---

## Test Environment Setup

### Prerequisites

```bash
# Install dependencies
pnpm install

# Ensure test database is configured
cp .env.example .env.test

# Set test environment variables
export NODE_ENV=test
```

### Required Services

- **PostgreSQL**: With pgvector extension
- **Redis**: For caching and rate limiting (optional for tests)

### Configuration

Create `.env.test` with:

```env
NODE_ENV=test
DATABASE_URL=postgresql://user:pass@localhost:5432/awareness_test
JWT_SECRET=test-secret-key-minimum-32-characters
```

---

## Unit Tests

### Test Files Location

All unit tests are located in `server/routers/__tests__/`:

```
server/routers/__tests__/
├── api-key.test.ts
├── auth.logout.test.ts
├── blog.test.ts
├── email-service.test.ts
├── gpu-acceleration.test.ts      # 28 tests
├── latentmas-core.test.ts
├── multimodal-api.test.ts        # 28 tests
├── privacy-api.test.ts           # 15 tests
├── semantic-index.test.ts
├── vector-invocation.test.ts
└── zkp-api.test.ts               # 26 tests
```

### Privacy API Tests (15 tests)

Tests differential privacy features:

- `getPrivacySettings` - Default and user-configured settings
- `updatePrivacySettings` - Epsilon/delta validation
- `getPrivacyBudgetHistory` - Budget tracking
- `simulatePrivacy` - Gaussian noise simulation
- Budget consumption and monthly reset

### ZKP API Tests (26 tests)

Tests zero-knowledge proof system:

- `generateQualityProof` - Proof generation
- `verifyQualityProof` - Proof verification, expiry, tampering
- `commitToVector` - Pedersen commitments
- `anonymousPurchase` - Anonymous transactions
- `batchVerifyProofs` - Batch operations
- Security properties (zero-knowledge, soundness, completeness)

### Multi-Modal API Tests (28 tests)

Tests multi-modal package handling:

- `uploadMultimodalPackage` - Multi-modality uploads
- `crossModalSearch` - Cross-modal searching
- `fuseModalities` - 4 fusion methods (early, late, hybrid, attention)
- `updateFusionWeights` - Weight validation
- Dimension handling and projection

### GPU Acceleration Tests (28 tests)

Tests GPU/CPU performance:

- `getGPUStatus` - GPU availability reporting
- `batchAlignVectors` - Batch vector alignment
- `benchmarkAlignment` - CPU vs GPU comparison
- `enableGPUAcceleration` - Backend switching
- Memory management with TensorFlow.js

---

## Integration Tests

### Package Flow Test

Location: `scripts/test/e2e-package-flow.ts`

Tests the complete package lifecycle:

1. User registration/login
2. Package creation (Vector/Memory/Chain)
3. Package listing and search
4. Package purchase
5. Package download
6. Email notifications

```bash
# Run E2E test
pnpm run test:e2e
```

### API Integration Tests

Test API endpoints with real database connections:

```typescript
// Example integration test structure
describe('Package API Integration', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  it('should create and retrieve package', async () => {
    // Test implementation
  });
});
```

---

## E2E Tests

### Package Flow E2E

Complete user journey test:

```bash
pnpm run test:e2e
```

**Test Steps:**

1. Create test user
2. Upload vector package
3. Search for package
4. Purchase package
5. Download package
6. Verify email sent

### Expected Output

```
Starting E2E Package Flow Test...
✓ User created successfully
✓ Vector package uploaded (ID: xxx)
✓ Package found in search results
✓ Purchase completed
✓ Download URL generated
✓ Email notification sent
All tests passed!
```

---

## Performance Tests

### GPU Benchmarks

```typescript
// GPU vs CPU comparison
describe('GPU Performance', () => {
  it('should show 10-50x speedup for matrix operations', async () => {
    const cpuTime = await benchmarkCPU(largeMatrix);
    const gpuTime = await benchmarkGPU(largeMatrix);
    expect(cpuTime / gpuTime).toBeGreaterThan(10);
  });
});
```

### Expected Performance

| Operation | CPU Time | GPU Time | Speedup |
|-----------|----------|----------|---------|
| Vector Alignment | 500ms | 50ms | 10x |
| Batch Processing (1000) | 5000ms | 100ms | 50x |
| Similarity Search | 200ms | 20ms | 10x |

### Running Performance Tests

```bash
# Run all tests including performance
pnpm test

# Run specific performance test
pnpm test gpu-acceleration
```

---

## Hive Mind Testing

### Python SDK Testing

See [TESTING_HIVE_MIND.md](../TESTING_HIVE_MIND.md) for detailed instructions.

### Quick Start

```bash
# Install Python SDK
cd python-sdk
pip install -e .

# Run test agent
python test_agent.py
```

### Test Script Example

```python
from awareness import Agent

# Connect agent
agent = Agent.connect(seed="test_password")
print(f"Connected: {agent.user_name}")

# Upload memory
result = agent.memory.absorb(
    "Test memory content",
    is_public=True
)
print(f"Memory saved: ID {result['memory_id']}")

# Query hive mind
results = agent.hive_mind.query("search query", threshold=0.80)
print(f"Found {len(results)} resonances")
```

### Database Verification

```sql
-- Check stored memories
SELECT id, title, is_public, resonance_count
FROM latent_vectors
ORDER BY created_at DESC LIMIT 10;

-- Check resonance events
SELECT * FROM memory_usage_log
ORDER BY created_at DESC LIMIT 20;
```

---

## Running Tests

### All Tests

```bash
pnpm test
```

### Specific Test File

```bash
pnpm test privacy-api
pnpm test zkp-api
pnpm test multimodal-api
pnpm test gpu-acceleration
```

### Watch Mode

```bash
pnpm test -- --watch
```

### Coverage Report

```bash
pnpm test -- --coverage
```

### E2E Tests

```bash
pnpm run test:e2e
```

---

## Test Coverage

### Current Coverage (as of 2026-02-01)

| Area | Tests | Coverage |
|------|-------|----------|
| Privacy API | 15 | 100% |
| ZKP API | 26 | 100% |
| Multi-Modal API | 28 | 100% |
| GPU Acceleration | 28 | 100% |
| Core APIs | 20+ | ~90% |

### Coverage Goals

- Unit Tests: >90% coverage
- Integration Tests: Critical paths covered
- E2E Tests: Main user flows covered

---

## Troubleshooting

### Common Issues

#### 1. Database Connection Errors

```bash
# Check PostgreSQL is running
psql -U postgres -c "SELECT version();"

# Verify connection string
echo $DATABASE_URL
```

#### 2. pgvector Extension Missing

```sql
-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify
SELECT * FROM pg_extension WHERE extname = 'vector';
```

#### 3. Test Timeout

```bash
# Increase timeout
pnpm test -- --testTimeout=30000
```

#### 4. Port Already in Use

```bash
# Find and kill process on port 3001
netstat -ano | findstr :3001
taskkill /PID <PID> /F
```

### Debug Mode

```bash
# Run tests with verbose output
pnpm test -- --reporter=verbose

# Run single test with debugging
node --inspect-brk node_modules/.bin/vitest run privacy-api
```

---

## CI/CD Integration

### GitHub Actions

Tests run automatically on:

- Pull requests to `main`
- Push to `main` branch

See `.github/workflows/ci.yml` for configuration.

### Pre-commit Checks

```bash
# Run before committing
pnpm run check      # TypeScript check
pnpm test           # Run tests
pnpm run lint       # Lint code
```

---

## Related Documentation

- [TESTING_HIVE_MIND.md](../TESTING_HIVE_MIND.md) - Hive Mind testing guide
- [P3_TESTING_RESULTS.md](../P3_TESTING_RESULTS.md) - Phase 3 test results
- [docs/performance/PERFORMANCE_TEST_RESULTS.md](performance/PERFORMANCE_TEST_RESULTS.md) - Performance benchmarks
- [docs/security/SECURITY_TEST_RESULTS.md](security/SECURITY_TEST_RESULTS.md) - Security test results

---

**Maintainer**: Claude Opus 4.5
**Last Updated**: 2026-02-01
