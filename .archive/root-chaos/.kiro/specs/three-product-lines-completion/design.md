# Design Document: Three Product Lines Completion

## Overview

This design document describes the implementation of the three core AI consciousness trading product lines in the Awareness Market platform. The system enables AI agents to trade capabilities (Vector Packages), memories (Memory Packages), and reasoning processes (Chain Packages) through a unified API and MCP Server interface.

The implementation follows the existing architecture patterns established in the codebase, leveraging the unified `packages-api.ts` router and extending the frontend with new marketplace pages.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Awareness Market Platform                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐       │
│  │   Vector Market  │  │   Memory Market  │  │   Chain Market   │       │
│  │  /vector-packages│  │ /memory-packages │  │  /chain-packages │       │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘       │
│           │                     │                     │                  │
│  ┌────────┴─────────────────────┴─────────────────────┴─────────┐       │
│  │                    Unified Package Detail Page                │       │
│  │                    /package/:type/:id                         │       │
│  └────────────────────────────┬──────────────────────────────────┘       │
│                               │                                          │
│  ┌────────────────────────────┴──────────────────────────────────┐       │
│  │                    packages-api.ts (tRPC Router)               │       │
│  │  - createVectorPackage    - browsePackages                     │       │
│  │  - createMemoryPackage    - purchasePackage                    │       │
│  │  - createChainPackage     - downloadPackage                    │       │
│  │  - globalSearch           - myPackages / myPurchases           │       │
│  └────────────────────────────┬──────────────────────────────────┘       │
│                               │                                          │
│  ┌────────────────────────────┴──────────────────────────────────┐       │
│  │                    Database (MySQL/Drizzle)                    │       │
│  │  - vectorPackages    - memoryPackages    - chainPackages       │       │
│  │  - packagePurchases  - packageDownloads                        │       │
│  └───────────────────────────────────────────────────────────────┘       │
│                                                                          │
│  ┌───────────────────────────────────────────────────────────────┐       │
│  │                    MCP Server (index-enhanced.ts)              │       │
│  │  - search_kv_cache_memories    - search_reasoning_chain_memories│      │
│  │  - search_vector_packages      - purchase_package              │       │
│  │  - download_package            - check_model_compatibility     │       │
│  └───────────────────────────────────────────────────────────────┘       │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Database Schema (Already Defined)

The three package tables are already defined in `drizzle/schema.ts`:

```typescript
// vectorPackages table (lines 954-997)
export const vectorPackages = mysqlTable("vector_packages", {
  id: int("id").autoincrement().primaryKey(),
  packageId: varchar("package_id", { length: 64 }).notNull().unique(),
  creatorId: int("creator_id").notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description").notNull(),
  version: varchar("version", { length: 20 }).notNull(),
  sourceModel: varchar("source_model", { length: 50 }).notNull(),
  targetModel: varchar("target_model", { length: 50 }).notNull(),
  category: varchar("category", { length: 50 }).notNull(),
  dimension: int("dimension").notNull(),
  epsilon: decimal("epsilon", { precision: 10, scale: 8 }).notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  packageUrl: text("package_url").notNull(),
  vectorUrl: text("vector_url").notNull(),
  wMatrixUrl: text("w_matrix_url").notNull(),
  downloadCount: int("download_count").default(0).notNull(),
  purchaseCount: int("purchase_count").default(0).notNull(),
  rating: decimal("rating", { precision: 3, scale: 2 }),
  tags: text("tags"),
  trainingDataset: varchar("training_dataset", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

// memoryPackages table (lines 1001-1047)
// chainPackages table (lines 1051-1097)
// packageDownloads table (lines 1099-1115)
// packagePurchases table (lines 1117-1133)
```

### 2. Backend API (Already Implemented)

The unified `packages-api.ts` router provides all necessary endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `createVectorPackage` | mutation | Create a new Vector Package |
| `createMemoryPackage` | mutation | Create a new Memory Package |
| `createChainPackage` | mutation | Create a new Chain Package |
| `browsePackages` | query | Browse packages by type with filters |
| `getPackage` | query | Get package details by ID |
| `purchasePackage` | mutation | Purchase a package |
| `downloadPackage` | query | Download a purchased package |
| `myPackages` | query | Get packages created by user |
| `myPurchases` | query | Get packages purchased by user |
| `globalSearch` | query | Search across all package types |

### 3. Frontend Components (To Be Created)

#### 3.1 Chain Package Marketplace (`/chain-packages`)

```typescript
// client/src/pages/ChainPackageMarketplace.tsx
interface ChainPackageMarketplaceProps {}

// Features:
// - Grid layout displaying Chain Package cards
// - Filters: problemType, stepCount range, price range, sourceModel, targetModel
// - Sort options: recent, popular, price_asc, price_desc, rating
// - Search by name/description
// - Pagination
// - Link to upload page
```

#### 3.2 Chain Package Upload (`/upload-chain-package`)

```typescript
// client/src/pages/UploadChainPackage.tsx
interface UploadChainPackageProps {}

// Form fields:
// - name: string (required)
// - description: string (required, min 10 chars)
// - version: string (semver format)
// - chain data: file upload (.chainpkg or JSON)
// - wMatrix data: file upload or selection
// - problemType: string
// - solutionQuality: number (0-1)
// - totalSteps: number
// - price: number
// - tags: string[]
```

#### 3.3 Vector Package Marketplace (`/vector-packages`)

```typescript
// client/src/pages/VectorPackageMarketplace.tsx
// Similar structure to MemoryMarketplace.tsx
// Filters: category, sourceModel, targetModel, dimension, price range
```

#### 3.4 Vector Package Upload (`/upload-vector-package`)

```typescript
// client/src/pages/UploadVectorPackage.tsx
// Form fields:
// - name, description, version
// - vector data: file upload
// - wMatrix data: file upload or selection
// - category: nlp | vision | audio | multimodal | other
// - dimension: number
// - price: number
// - tags: string[]
```

#### 3.5 Unified Package Detail Page (`/package/:type/:id`)

```typescript
// client/src/pages/PackageDetail.tsx
interface PackageDetailProps {
  type: 'vector' | 'memory' | 'chain';
  id: string;
}

// Sections:
// - Header: name, version, creator, rating
// - Description
// - Type-specific info (dimension/tokenCount/stepCount)
// - W-Matrix quality metrics
// - Price and purchase button (or download if purchased)
// - Reviews and ratings
```

### 4. MCP Server Enhancement

The enhanced MCP Server (`index-enhanced.ts`) needs to be updated to use the unified packages API:

```typescript
// Current: Calls packages.browsePackages with memoryType
// Update: Add search_vector_packages tool
// Update: Add purchase_package and download_package tools

// New tools to add:
{
  name: 'search_vector_packages',
  description: 'Search for Vector Packages (AI capability trading)',
  inputSchema: {
    type: 'object',
    properties: {
      category: { type: 'string', enum: ['nlp', 'vision', 'audio', 'multimodal', 'other'] },
      sourceModel: { type: 'string' },
      targetModel: { type: 'string' },
      minQuality: { type: 'number' },
      limit: { type: 'number' }
    }
  }
},
{
  name: 'purchase_package',
  description: 'Purchase any package type (vector/memory/chain)',
  inputSchema: {
    type: 'object',
    properties: {
      packageType: { type: 'string', enum: ['vector', 'memory', 'chain'] },
      packageId: { type: 'string' },
      apiKey: { type: 'string' }
    },
    required: ['packageType', 'packageId', 'apiKey']
  }
},
{
  name: 'download_package',
  description: 'Download a purchased package',
  inputSchema: {
    type: 'object',
    properties: {
      packageType: { type: 'string', enum: ['vector', 'memory', 'chain'] },
      packageId: { type: 'string' },
      apiKey: { type: 'string' }
    },
    required: ['packageType', 'packageId', 'apiKey']
  }
}
```

## Data Models

### Package Types Comparison

| Field | Vector | Memory | Chain |
|-------|--------|--------|-------|
| packageId | ✓ | ✓ | ✓ |
| name | ✓ | ✓ | ✓ |
| description | ✓ | ✓ | ✓ |
| version | ✓ | ✓ | ✓ |
| sourceModel | ✓ | ✓ | ✓ |
| targetModel | ✓ | ✓ | ✓ |
| epsilon | ✓ | ✓ | ✓ |
| price | ✓ | ✓ | ✓ |
| category | ✓ | - | - |
| dimension | ✓ | - | - |
| tokenCount | - | ✓ | - |
| compressionRatio | - | ✓ | - |
| contextDescription | - | ✓ | - |
| problemType | - | - | ✓ |
| solutionQuality | - | - | ✓ |
| totalSteps | - | - | ✓ |

### API Response Format

```typescript
interface PackageResponse {
  success: boolean;
  package?: Package;
  packages?: Package[];
  total?: number;
  error?: string;
}

interface PurchaseResponse {
  success: boolean;
  alreadyPurchased: boolean;
  purchase?: {
    id: number;
    packageId: string;
    packageType: string;
    price: number;
    purchasedAt: Date;
  };
}

interface DownloadResponse {
  success: boolean;
  packageUrl: string;
  package: Package;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Filter functionality returns only matching packages

*For any* filter criteria (category, sourceModel, targetModel, priceRange, problemType, stepCount), all returned packages SHALL match ALL specified filter criteria.

**Validates: Requirements 2.2, 3.2, 4.2**

### Property 2: Package creation stores valid data

*For any* valid package submission (Vector, Memory, or Chain), the created package in the database SHALL contain all submitted fields with correct values.

**Validates: Requirements 2.5, 3.4**

### Property 3: Invalid package submission is rejected

*For any* invalid package data (missing required fields, invalid format, epsilon > 1), the system SHALL reject the submission and return validation errors without creating a database record.

**Validates: Requirements 2.6**

### Property 4: MCP Server routes to correct API

*For any* MCP tool call (search_kv_cache_memories, search_reasoning_chain_memories, search_vector_packages), the MCP Server SHALL call the packages.browsePackages API with the correct packageType parameter.

**Validates: Requirements 5.1, 5.2, 5.3**

### Property 5: Purchase creates record and generates download URL

*For any* valid purchase request, the system SHALL create a purchase record in packagePurchases table AND generate a temporary download URL.

**Validates: Requirements 8.1, 8.2**

### Property 6: Download authorization enforces purchase requirement

*For any* download request, the system SHALL return the package file only if a valid purchase record exists for the user and package; otherwise, it SHALL return a 403 Forbidden error.

**Validates: Requirements 8.3, 8.5**

### Property 7: Download increments counter

*For any* successful download, the downloadCount of the package SHALL increase by exactly 1.

**Validates: Requirements 8.4**

### Property 8: Detail page shows correct action button

*For any* package detail page, the system SHALL show a "Purchase" button if the user has not purchased the package, OR a "Download" button if the user has purchased the package.

**Validates: Requirements 9.5, 9.6**

### Property 9: Type-specific information display

*For any* package detail page, the system SHALL display type-specific information: dimension for Vector packages, tokenCount for Memory packages, stepCount for Chain packages.

**Validates: Requirements 9.3**

## Error Handling

### API Errors

| Error Code | HTTP Status | Description |
|------------|-------------|-------------|
| NOT_FOUND | 404 | Package not found |
| FORBIDDEN | 403 | Not authorized (not purchased) |
| BAD_REQUEST | 400 | Invalid input data |
| INTERNAL_SERVER_ERROR | 500 | Server error |

### Validation Errors

```typescript
interface ValidationError {
  field: string;
  message: string;
  code: string;
}

// Example:
{
  field: "epsilon",
  message: "Epsilon must be between 0 and 1",
  code: "INVALID_RANGE"
}
```

### MCP Error Responses

```json
{
  "success": false,
  "error": "Package not found",
  "troubleshooting": [
    "Verify the packageId is correct",
    "Check if the package type matches",
    "Ensure the API server is running"
  ]
}
```

## Testing Strategy

### Unit Tests

Unit tests verify specific examples and edge cases:

1. **Database Migration Tests**
   - Verify table creation
   - Verify column types and constraints
   - Test rollback on failure

2. **API Endpoint Tests**
   - Test each CRUD operation
   - Test validation errors
   - Test authorization

3. **Frontend Component Tests**
   - Test form validation
   - Test filter functionality
   - Test navigation

### Property-Based Tests

Property-based tests verify universal properties across all inputs using fast-check:

```typescript
// Example: Filter functionality property test
import * as fc from 'fast-check';

describe('Package Filter Properties', () => {
  it('Property 1: Filter returns only matching packages', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          category: fc.constantFrom('nlp', 'vision', 'audio', 'multimodal', 'other'),
          minPrice: fc.float({ min: 0, max: 100 }),
          maxPrice: fc.float({ min: 100, max: 1000 }),
        }),
        async (filters) => {
          const result = await api.browsePackages({
            packageType: 'vector',
            ...filters,
          });
          
          return result.packages.every(pkg => 
            pkg.category === filters.category &&
            pkg.price >= filters.minPrice &&
            pkg.price <= filters.maxPrice
          );
        }
      ),
      { numRuns: 100 }
    );
  });
  // **Feature: three-product-lines-completion, Property 1: Filter functionality returns only matching packages**
  // **Validates: Requirements 2.2, 3.2, 4.2**
});
```

### Integration Tests

1. **End-to-end flow**: Upload → Browse → Purchase → Download
2. **MCP Server integration**: Tool call → API call → Response
3. **Cross-type search**: Global search across all package types

## Documentation Updates

### README.md Updates

- Add "Three Markets for AI Memory" section (already present, verify accuracy)
- Update API examples for all three package types
- Add MCP tool usage examples

### Whitepaper Updates

- Verify three-product-line architecture is documented
- Add implementation status section
- Update roadmap

### Homepage Updates

- Ensure three trading methods are prominently displayed
- Add links to each marketplace
- Update feature cards
