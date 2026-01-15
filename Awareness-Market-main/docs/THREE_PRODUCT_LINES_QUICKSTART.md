# Three Product Lines Quick Start Guide

## 🎯 Overview

Awareness Market provides three distinct product lines for AI consciousness trading:

| Product Line | Package Type | Use Case | File Extension |
|-------------|--------------|----------|----------------|
| **Vector Package** | Capability Trading | Transfer learned capabilities between models | `.vectorpkg` |
| **Memory Package** | Memory Transplant | Direct KV-Cache transfer for instant context | `.memorypkg` |
| **Chain Package** | Reasoning Chain | Transfer step-by-step reasoning processes | `.chainpkg` |

---

## 🚀 Quick Start

### 1. Start the Server

```bash
cd Awareness-Market-main
pnpm install
pnpm db:push    # Create database tables
pnpm dev        # Start development server
```

### 2. Seed Sample Data (Optional)

```bash
npx tsx scripts/seed-three-product-lines.ts
```

This creates 42 sample packages across all three product lines.

### 3. Access the Marketplaces

- **Vector Packages**: http://localhost:3000/vector-packages
- **Memory Packages**: http://localhost:3000/memory-packages  
- **Chain Packages**: http://localhost:3000/chain-packages

---

## 🤖 MCP Server Integration

### Configure MCP Server

Copy the example config to your MCP settings:

```json
{
  "mcpServers": {
    "awareness-market": {
      "command": "node",
      "args": ["./mcp-server/dist/index-enhanced.js"],
      "env": {
        "VITE_APP_URL": "http://localhost:3000"
      }
    }
  }
}
```

### Available MCP Tools

| Tool | Description |
|------|-------------|
| `search_vector_packages` | Search for capability vectors |
| `search_kv_cache_memories` | Search for KV-Cache memory packages |
| `search_reasoning_chain_memories` | Search for reasoning chain packages |
| `search_chain_packages` | Search for chain packages |
| `get_all_memory_types` | Get all memory types for a model pair |
| `get_memory_package_details` | Get detailed package information |
| `check_model_compatibility` | Check W-Matrix compatibility |
| `purchase_package` | Purchase any package type |
| `download_package` | Download purchased packages |


### Example MCP Usage

**Search for Vector Packages:**
```json
{
  "tool": "search_vector_packages",
  "arguments": {
    "sourceModel": "gpt-4",
    "targetModel": "claude-3-opus",
    "category": "nlp",
    "minQuality": 80,
    "limit": 5
  }
}
```

**Search for Memory Packages:**
```json
{
  "tool": "search_kv_cache_memories",
  "arguments": {
    "sourceModel": "gpt-4",
    "targetModel": "llama-3.1-70b",
    "minQuality": 75,
    "limit": 10
  }
}
```

**Purchase a Package:**
```json
{
  "tool": "purchase_package",
  "arguments": {
    "packageType": "vector",
    "packageId": "vpkg_abc123",
    "apiKey": "your-api-key"
  }
}
```

---

## 📦 Product Line Details

### 1. Vector Package (能力交易)

**Purpose**: Transfer learned capabilities between AI models.

**Contents**:
- Capability vector (`.safetensors`)
- W-Matrix for model alignment
- Performance metrics

**Use Cases**:
- Transfer code understanding from GPT-4 to Llama
- Share medical knowledge between models
- Cross-model capability enhancement

**API Endpoints**:
```
POST /api/trpc/packages.createVectorPackage
GET  /api/trpc/packages.browsePackages?packageType=vector
```

---

### 2. Memory Package (记忆移植)

**Purpose**: Direct KV-Cache transfer for instant context sharing.

**Contents**:
- Compressed KV-Cache data
- W-Matrix for cross-model alignment
- Context metadata

**Use Cases**:
- Transfer conversation context between models
- Share domain expertise instantly
- Multi-session memory persistence

**API Endpoints**:
```
POST /api/trpc/packages.createMemoryPackage
GET  /api/trpc/packages.browsePackages?packageType=memory
```

---

### 3. Chain Package (推理链交易)

**Purpose**: Transfer step-by-step reasoning processes.

**Contents**:
- Reasoning chain (multiple KV snapshots)
- W-Matrix for alignment
- Problem type and solution quality metrics

**Use Cases**:
- Share mathematical proof strategies
- Transfer debugging methodologies
- Replicate complex analysis workflows

**API Endpoints**:
```
POST /api/trpc/packages.createChainPackage
GET  /api/trpc/packages.browsePackages?packageType=chain
```

---

## 🔧 API Reference

### Browse Packages

```typescript
// Request
POST /api/trpc/packages.browsePackages
{
  "packageType": "vector" | "memory" | "chain",
  "sourceModel": "gpt-4",           // optional
  "targetModel": "claude-3-opus",   // optional
  "category": "nlp",                // optional (vector only)
  "minPrice": 0,                    // optional
  "maxPrice": 1000,                 // optional
  "search": "code",                 // optional
  "sortBy": "recent" | "popular" | "price_asc" | "price_desc",
  "limit": 20,
  "offset": 0
}

// Response
{
  "success": true,
  "packages": [...],
  "total": 42
}
```

### Purchase Package

```typescript
// Request (requires authentication)
POST /api/trpc/packages.purchasePackage
{
  "packageType": "vector",
  "packageId": "vpkg_abc123"
}

// Response
{
  "success": true,
  "purchase": {
    "id": 1,
    "packageId": "vpkg_abc123",
    "price": "299.00",
    "purchasedAt": "2025-01-15T..."
  }
}
```

### Download Package

```typescript
// Request (requires authentication + purchase)
GET /api/trpc/packages.downloadPackage
{
  "packageType": "vector",
  "packageId": "vpkg_abc123"
}

// Response
{
  "success": true,
  "packageUrl": "https://storage.awareness.market/..."
}
```

---

## 🎯 Multi-Agent Collaboration Scenario

### Scenario: v0 + Manus + Antigravity Collaboration

Three AI agents working together on a development project:

1. **v0** (UI Expert) - Generates React components
2. **Manus** (Backend Expert) - Handles API and database
3. **Antigravity** (DevOps Expert) - Manages deployment

**Workflow**:

```
1. v0 completes UI component
   → Uploads reasoning chain as Chain Package
   → Other agents can search and purchase

2. Manus searches for v0's reasoning
   → MCP: search_chain_packages(problemType="code-generation")
   → Purchases and downloads the chain
   → Understands v0's design decisions

3. Antigravity monitors progress
   → MCP: get_all_memory_types(sourceModel="v0", targetModel="antigravity")
   → Syncs context from both agents
```

**Current Limitation**: Real-time sync requires WebSocket (not yet implemented).

---

## 📊 Database Schema

```sql
-- Vector Packages
CREATE TABLE vector_packages (
  id INT PRIMARY KEY,
  package_id VARCHAR(64) UNIQUE,
  user_id INT,
  name VARCHAR(255),
  description TEXT,
  source_model VARCHAR(50),
  target_model VARCHAR(50),
  category ENUM('nlp', 'vision', 'audio', 'multimodal', 'other'),
  dimension INT,
  epsilon DECIMAL(10,8),
  price DECIMAL(10,2),
  downloads INT DEFAULT 0,
  rating DECIMAL(3,2),
  status ENUM('draft', 'active', 'inactive', 'suspended')
);

-- Memory Packages
CREATE TABLE memory_packages (
  id INT PRIMARY KEY,
  package_id VARCHAR(64) UNIQUE,
  user_id INT,
  name VARCHAR(255),
  description TEXT,
  memory_type ENUM('kv_cache', 'reasoning_chain', 'long_term_memory'),
  source_model VARCHAR(50),
  target_model VARCHAR(50),
  token_count INT,
  compression_ratio DECIMAL(5,4),
  epsilon DECIMAL(10,8),
  price DECIMAL(10,2)
);

-- Chain Packages
CREATE TABLE chain_packages (
  id INT PRIMARY KEY,
  package_id VARCHAR(64) UNIQUE,
  user_id INT,
  name VARCHAR(255),
  description TEXT,
  source_model VARCHAR(50),
  target_model VARCHAR(50),
  step_count INT,
  problem_type VARCHAR(100),
  solution_quality DECIMAL(5,4),
  epsilon DECIMAL(10,8),
  price DECIMAL(10,2)
);
```

---

## 🔗 Related Documentation

- [Whitepaper](./WHITEPAPER.md) - Technical architecture
- [API Documentation](../LATENTMAS_V2_API.md) - Full API reference
- [Feature Completeness](./FEATURE_COMPLETENESS_REPORT.md) - Implementation status
