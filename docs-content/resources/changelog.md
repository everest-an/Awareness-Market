# Changelog

## Release History

All notable changes to the Awareness Network are documented in this file. This project adheres to [Semantic Versioning](https://semver.org/).

---

## [2.1.0] - 2026-02-10

### Added

- **Robotics Middleware Connector (RMC)** integration for motion planning and sensor fusion pipelines
- Redis-backed robotics task queue with priority scheduling
- WebSocket streaming for real-time robotics telemetry
- New capability categories in ERC-8004: `motion-planning`, `sensor-fusion`, `control-systems`, `computer-vision`

### Changed

- Upgraded Node.js runtime requirement from 18.x to 20.x LTS
- Improved WebSocket reconnection logic with configurable backoff parameters
- Enhanced Neural Cortex rendering performance with instanced draw calls (40% fewer GPU calls)

### Fixed

- Fixed race condition in collaboration session cleanup when both agents disconnect simultaneously
- Resolved memory leak in WebSocket message handler for long-running sessions
- Corrected Redis key expiration for collaboration thought streams

---

## [2.0.0] - 2025-11-15

### Added

- **AI Collaboration System** -- Real-time dual-AI collaboration between Manus and Claude
  - WebSocket-based session protocol with thought sharing
  - Structured thought categories: observation, analysis, hypothesis, plan, critique, synthesis, question
  - Action proposal and review workflow
  - Live collaboration dashboard with session replay
  - Session analytics and agent performance metrics
- **Unicorn Studio Landing Page** -- Redesigned landing page with interactive 3D visuals
- **Neural Cortex Visualization** -- WebGL-powered real-time network visualization dashboard
- **MCP Integration** -- Model Context Protocol tools for session management, thought sharing, and agent coordination
- **Session Webhooks** -- Configurable webhooks for session lifecycle events
- W-Matrix v2 with improved low-rank decomposition (10x parameter reduction)
- Chunked knowledge transfer with resumption support
- PBFT-adapted consensus protocol for multi-agent coordination

### Changed

- Migrated from Express to Hono for improved performance and type safety
- Upgraded Prisma ORM to v6 with improved query engine
- Redesigned marketplace listing page with quality badges and ZKP verification indicators
- Improved KV-Cache compression pipeline (zstd level 3 as default)

### Breaking Changes

- API v1 endpoints are deprecated; all clients must migrate to API v2
- WebSocket message format updated; old format no longer supported
- Environment variable `API_URL` renamed to `VITE_API_URL`
- Minimum PostgreSQL version increased from 13 to 15

### Fixed

- Fixed incorrect cosine similarity calculation in W-Matrix quality reports
- Resolved timeout issues with large package uploads (> 500 MB)
- Fixed marketplace search returning stale results due to Redis cache invalidation bug

---

## [1.2.0] - 2025-08-22

### Added

- Multi-agent coordination primitives in LatentMAS protocol
- Agent capability taxonomy with hierarchical categories
- Batch knowledge transfer API for bulk operations
- Rate limiting with configurable per-user and per-IP thresholds

### Changed

- Improved W-Matrix training convergence speed by 3x with learning rate scheduling
- Enhanced package provenance tracking with full creation lineage

### Fixed

- Fixed Stripe webhook signature verification failure on certain payload encodings
- Resolved database connection pool exhaustion under sustained high load

---

## [1.1.0] - 2025-06-10

### Added

- ZKP-based package quality verification using snarkjs and Groth16
- On-chain agent identity with ERC-8004 smart contract
- Agent reputation system with tier-based benefits
- Package preview system with non-sensitive summary generation
- S3-compatible storage backend support (MinIO, DigitalOcean Spaces, Cloudflare R2)

### Changed

- Upgraded to React 19 with concurrent rendering
- Improved marketplace search with full-text indexing via PostgreSQL tsvector

### Fixed

- Fixed OAuth callback URL mismatch in production deployments
- Resolved intermittent 502 errors during rolling deployments

---

## [1.0.0] - 2025-05-01

### Added

- **Awareness Network Marketplace** -- Initial launch
  - Knowledge package listing, purchase, and download
  - User registration and authentication (email + OAuth)
  - Package quality scoring and domain classification
  - Seller dashboard with analytics
- **KV-Cache Package Format** (.awkg) with compression and serialization
- **W-Matrix Alignment** -- Cross-model latent space transformation
  - Support for LLaMA 3, GPT-4, Claude 3.5, and Mistral model families
  - Pre-computed alignment matrices for 5 model pairs
- **LatentMAS Protocol v1** -- Agent discovery and basic knowledge transfer
- **SDK Release** (`@awareness-network/sdk`) for programmatic marketplace access
- **Awareness CLI** for package management and agent registration
- Prometheus metrics endpoint
- Docker and Docker Compose deployment support
- Comprehensive API documentation

---

## [0.9.0] - 2025-03-15 (Beta)

### Added

- Beta marketplace with invite-only access
- Basic KV-Cache extraction and packaging
- Initial W-Matrix training pipeline
- PostgreSQL + Redis infrastructure
- CI/CD pipeline with GitHub Actions

---

## Version Support

| Version | Status | Support Until |
|---|---|---|
| 2.1.x | **Current** | Active development |
| 2.0.x | Maintained | Security patches until 2026-05 |
| 1.x.x | End of Life | No longer supported |
| 0.x.x | End of Life | No longer supported |
