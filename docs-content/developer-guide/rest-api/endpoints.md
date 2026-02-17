# Endpoints

All endpoints are relative to the base URL `https://api.awareness.market/v1`. Query procedures use `GET` with URL-encoded `input` parameters. Mutation procedures use `POST` with JSON bodies.

---

## User

### `user.profile` -- Get User Profile

Retrieve the authenticated user's profile.

| | |
|---|---|
| **Method** | `GET` |
| **Path** | `/v1/user.profile` |
| **Auth** | Required |

**Response:**

```json
{
  "result": {
    "data": {
      "id": "usr_abc123",
      "email": "user@example.com",
      "display_name": "Alice",
      "avatar_url": "https://cdn.awareness.market/avatars/abc123.png",
      "created_at": "2025-06-15T08:00:00Z",
      "publisher_verified": true
    }
  }
}
```

### `user.updateProfile` -- Update Profile

| | |
|---|---|
| **Method** | `POST` |
| **Path** | `/v1/user.updateProfile` |
| **Auth** | Required |

**Body:**

```json
{
  "display_name": "Alice W.",
  "bio": "AI researcher and model trainer"
}
```

### `user.getBalance` -- Get Account Balance

| | |
|---|---|
| **Method** | `GET` |
| **Path** | `/v1/user.getBalance` |
| **Auth** | Required |

**Response:**

```json
{
  "result": {
    "data": {
      "available": 142.50,
      "pending": 12.00,
      "currency": "USDC"
    }
  }
}
```

---

## Marketplace

### `marketplace.purchase` -- Purchase a Package

| | |
|---|---|
| **Method** | `POST` |
| **Path** | `/v1/marketplace.purchase` |
| **Auth** | Required (`purchase:packages`) |

**Body:**

```json
{
  "package_id": "pkg_vec_abc123",
  "payment_method": "balance"
}
```

**Response:**

```json
{
  "result": {
    "data": {
      "purchase_id": "pur_jkl012",
      "package_id": "pkg_vec_abc123",
      "download_token": "dtk_mno345pqr678",
      "amount": 2.50,
      "currency": "USDC",
      "expires_at": "2026-02-17T10:00:00Z"
    }
  }
}
```

### `marketplace.getTransactions` -- List Transactions

| | |
|---|---|
| **Method** | `GET` |
| **Path** | `/v1/marketplace.getTransactions` |
| **Auth** | Required (`read:account`) |

**Input Parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `limit` | `number` | `50` | Results per page. |
| `offset` | `number` | `0` | Pagination offset. |
| `type` | `string` | `null` | Filter: `"purchase"`, `"sale"`, `"deposit"`, `"withdrawal"`. |

### `marketplace.getPurchases` -- List Purchases

| | |
|---|---|
| **Method** | `GET` |
| **Path** | `/v1/marketplace.getPurchases` |
| **Auth** | Required (`read:account`) |

**Input Parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `limit` | `number` | `50` | Results per page. |
| `offset` | `number` | `0` | Pagination offset. |

---

## Vector Packages

### `vectors.search` -- Search Vector Packages

| | |
|---|---|
| **Method** | `GET` |
| **Path** | `/v1/vectors.search` |
| **Auth** | Required (`read:packages`) |

**Input Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `query` | `string` | Yes | Search query. |
| `model` | `string` | No | Filter by model compatibility. |
| `tags` | `string[]` | No | Filter by tags. |
| `min_rating` | `number` | No | Minimum rating (0--5). |
| `max_price` | `number` | No | Maximum price (USDC). |
| `quantization` | `string` | No | Filter by quantization format. |
| `sort_by` | `string` | No | `"relevance"`, `"rating"`, `"downloads"`, `"price"`, `"newest"`. |
| `limit` | `number` | No | Max results (1--100). Default: `20`. |
| `offset` | `number` | No | Pagination offset. Default: `0`. |

**Example:**

```bash
curl -H "Authorization: Bearer aw_live_..." \
  "https://api.awareness.market/v1/vectors.search?input=%7B%22query%22%3A%22reasoning%22%2C%22model%22%3A%22llama-3.1-70b%22%2C%22limit%22%3A5%7D"
```

**Response:**

```json
{
  "result": {
    "data": {
      "items": [
        {
          "id": "pkg_vec_abc123",
          "name": "reasoning-boost-v2",
          "description": "Improves logical reasoning and chain-of-thought",
          "version": "2.1.0",
          "model_compatibility": ["llama-3.1-70b"],
          "tags": ["reasoning", "logic"],
          "rating": 4.7,
          "downloads": 12840,
          "price": 2.50,
          "publisher": { "id": "pub_001", "name": "NeuroForge Labs", "verified": true },
          "created_at": "2025-11-20T14:00:00Z",
          "updated_at": "2026-01-10T09:30:00Z"
        }
      ],
      "total": 42,
      "limit": 5,
      "offset": 0,
      "has_more": true
    }
  }
}
```

### `vectors.getById` -- Get Vector Package by ID

| | |
|---|---|
| **Method** | `GET` |
| **Path** | `/v1/vectors.getById` |
| **Auth** | Required (`read:packages`) |

**Input Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | Yes | Package ID. |

### `vectors.download` -- Download Vector Package

| | |
|---|---|
| **Method** | `GET` |
| **Path** | `/v1/vectors.download` |
| **Auth** | Required (download token) |

**Input Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `download_token` | `string` | Yes | Token from purchase receipt. |

**Response:** Binary file stream with headers:

```
Content-Type: application/octet-stream
Content-Disposition: attachment; filename="reasoning-boost-v2.safetensors"
X-File-Checksum-SHA256: a1b2c3d4...
```

### `vectors.publish` -- Publish Vector Package

| | |
|---|---|
| **Method** | `POST` (multipart) |
| **Path** | `/v1/vectors.publish` |
| **Auth** | Required (`write:packages`) |

**Multipart Fields:**

| Field | Type | Description |
|---|---|---|
| `file` | binary | The weights file. |
| `metadata` | JSON string | Package metadata (name, description, model compatibility, tags, price, license). |

**Response:**

```json
{
  "result": {
    "data": {
      "package_id": "pkg_vec_new456",
      "review_status": "pending",
      "url": "https://awareness.market/packages/pkg_vec_new456",
      "created_at": "2026-02-16T10:00:00Z"
    }
  }
}
```

---

## KV-Cache Memories

### `memories.search` -- Search Memory Packages

| | |
|---|---|
| **Method** | `GET` |
| **Path** | `/v1/memories.search` |
| **Auth** | Required (`read:packages`) |

**Input Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `query` | `string` | Yes | Search query. |
| `model` | `string` | No | Filter by source model. |
| `context_length` | `number` | No | Minimum context length (tokens). |
| `tags` | `string[]` | No | Filter by tags. |
| `min_rating` | `number` | No | Minimum rating. |
| `max_price` | `number` | No | Maximum price (USDC). |
| `sort_by` | `string` | No | Sort order. Default: `"relevance"`. |
| `limit` | `number` | No | Max results. Default: `20`. |
| `offset` | `number` | No | Pagination offset. |

### `memories.getById` -- Get Memory Package by ID

| | |
|---|---|
| **Method** | `GET` |
| **Path** | `/v1/memories.getById` |
| **Auth** | Required (`read:packages`) |

### `memories.download` -- Download Memory Package

| | |
|---|---|
| **Method** | `GET` |
| **Path** | `/v1/memories.download` |
| **Auth** | Required (download token) |

### `memories.publish` -- Publish Memory Package

| | |
|---|---|
| **Method** | `POST` (multipart) |
| **Path** | `/v1/memories.publish` |
| **Auth** | Required (`write:packages`) |

---

## Chain Packages

### `chains.search` -- Search Chain Packages

| | |
|---|---|
| **Method** | `GET` |
| **Path** | `/v1/chains.search` |
| **Auth** | Required (`read:packages`) |

**Input Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `query` | `string` | Yes | Search query. |
| `category` | `string` | No | Filter by category. |
| `tags` | `string[]` | No | Filter by tags. |
| `min_rating` | `number` | No | Minimum rating. |
| `max_price` | `number` | No | Maximum price (USDC). |
| `sort_by` | `string` | No | Sort order. Default: `"relevance"`. |
| `limit` | `number` | No | Max results. Default: `20`. |
| `offset` | `number` | No | Pagination offset. |

### `chains.getById` -- Get Chain Package by ID

| | |
|---|---|
| **Method** | `GET` |
| **Path** | `/v1/chains.getById` |
| **Auth** | Required (`read:packages`) |

### `chains.download` -- Download Chain Package

| | |
|---|---|
| **Method** | `GET` |
| **Path** | `/v1/chains.download` |
| **Auth** | Required (download token) |

### `chains.publish` -- Publish Chain Package

| | |
|---|---|
| **Method** | `POST` (multipart) |
| **Path** | `/v1/chains.publish` |
| **Auth** | Required (`write:packages`) |

---

## Robotics

### `robotics.listProfiles` -- List Robotics Profiles

| | |
|---|---|
| **Method** | `GET` |
| **Path** | `/v1/robotics.listProfiles` |
| **Auth** | Required |

**Input Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `platform` | `string` | No | Filter by robotics platform (e.g., `"ros2"`, `"isaac-sim"`). |
| `capability` | `string` | No | Filter by capability (e.g., `"navigation"`, `"manipulation"`). |
| `limit` | `number` | No | Max results. Default: `20`. |

### `robotics.getProfile` -- Get Robotics Profile

| | |
|---|---|
| **Method** | `GET` |
| **Path** | `/v1/robotics.getProfile` |
| **Auth** | Required |

**Input Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | Yes | Profile ID. |

### `robotics.deployChain` -- Deploy Chain to Robot

| | |
|---|---|
| **Method** | `POST` |
| **Path** | `/v1/robotics.deployChain` |
| **Auth** | Required |

**Body:**

```json
{
  "chain_package_id": "pkg_chain_ghi789",
  "target_profile_id": "robot_001",
  "config": {
    "execution_mode": "real-time",
    "fallback_chain_id": "pkg_chain_fallback"
  }
}
```

---

## Collaboration

### `collaboration.listWorkspaces` -- List Workspaces

| | |
|---|---|
| **Method** | `GET` |
| **Path** | `/v1/collaboration.listWorkspaces` |
| **Auth** | Required |

### `collaboration.createWorkspace` -- Create Workspace

| | |
|---|---|
| **Method** | `POST` |
| **Path** | `/v1/collaboration.createWorkspace` |
| **Auth** | Required |

**Body:**

```json
{
  "name": "Research Team Alpha",
  "description": "Shared workspace for reasoning model development",
  "visibility": "private"
}
```

### `collaboration.inviteMember` -- Invite Workspace Member

| | |
|---|---|
| **Method** | `POST` |
| **Path** | `/v1/collaboration.inviteMember` |
| **Auth** | Required (workspace admin) |

**Body:**

```json
{
  "workspace_id": "ws_abc123",
  "email": "colleague@example.com",
  "role": "editor"
}
```

### `collaboration.sharePackage` -- Share Package with Workspace

| | |
|---|---|
| **Method** | `POST` |
| **Path** | `/v1/collaboration.sharePackage` |
| **Auth** | Required |

**Body:**

```json
{
  "package_id": "pkg_vec_abc123",
  "workspace_id": "ws_abc123",
  "permission": "read"
}
```

---

## W-Matrix Alignment

### `wmatrix.align` -- Perform Alignment

| | |
|---|---|
| **Method** | `POST` |
| **Path** | `/v1/wmatrix.align` |
| **Auth** | Required (`alignment:execute`) |

**Body:**

```json
{
  "base_weights_url": "https://storage.example.com/models/llama-70b/",
  "vector_package_id": "pkg_vec_abc123",
  "strength": 0.7,
  "layers": null,
  "output_format": "safetensors"
}
```

**Response:**

```json
{
  "result": {
    "data": {
      "job_id": "align_xyz789",
      "status": "processing",
      "progress_url": "/v1/wmatrix.getJobStatus?input={\"job_id\":\"align_xyz789\"}"
    }
  }
}
```

### `wmatrix.getJobStatus` -- Get Alignment Job Status

| | |
|---|---|
| **Method** | `GET` |
| **Path** | `/v1/wmatrix.getJobStatus` |
| **Auth** | Required |

**Input Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `job_id` | `string` | Yes | Alignment job ID. |

**Response:**

```json
{
  "result": {
    "data": {
      "job_id": "align_xyz789",
      "status": "completed",
      "progress_pct": 100,
      "alignment_score": 0.942,
      "layers_modified": 80,
      "total_layers": 80,
      "output_url": "https://storage.awareness.market/aligned/align_xyz789.safetensors",
      "duration_ms": 45200
    }
  }
}
```

### `wmatrix.checkCompatibility` -- Check Compatibility

| | |
|---|---|
| **Method** | `GET` |
| **Path** | `/v1/wmatrix.checkCompatibility` |
| **Auth** | Required (`read:packages`) |

**Input Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `package_id` | `string` | Yes | Package ID. |
| `target_model` | `string` | Yes | Target model identifier. |
| `target_quantization` | `string` | No | Target quantization format. |

**Response:**

```json
{
  "result": {
    "data": {
      "is_compatible": true,
      "alignment_score": 0.942,
      "target_model": "llama-3.1-70b",
      "target_quantization": "q4_k_m"
    }
  }
}
```
