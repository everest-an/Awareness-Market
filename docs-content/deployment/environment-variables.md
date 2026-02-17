# Environment Variables

## Complete Configuration Reference

This page documents every environment variable used by the Awareness Network application. Copy `.env.example` to `.env` and configure the values for your environment.

---

## Required Variables

These variables must be set for the application to start.

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string. Format: `postgresql://user:password@host:port/database` | `postgresql://awareness:secret@localhost:5432/awareness_network` |
| `REDIS_URL` | Redis connection string. Used for caching, sessions, and pub/sub messaging. | `redis://localhost:6379` |
| `SESSION_SECRET` | A random string used to sign session cookies. Must be at least 32 characters. Generate with `openssl rand -hex 32`. | `a1b2c3d4e5f6...` (64 hex characters) |

---

## Application Settings

| Variable | Description | Default | Required |
|---|---|---|---|
| `NODE_ENV` | Application environment. Affects logging level, error detail, and optimization. | `development` | No |
| `PORT` | HTTP port the server listens on. | `5000` | No |
| `HOST` | Host address to bind to. Use `0.0.0.0` to accept connections from all interfaces. | `0.0.0.0` | No |
| `VITE_API_URL` | The public-facing URL of the application. Used by the client for API requests. Must not include a trailing slash. | `http://localhost:5000` | No |
| `LOG_LEVEL` | Logging verbosity. Options: `debug`, `info`, `warn`, `error`. | `info` | No |
| `CORS_ORIGIN` | Allowed CORS origins. Comma-separated list or `*` for all origins (not recommended for production). | `*` | No |

---

## Database Configuration

| Variable | Description | Default | Required |
|---|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string (see above). | -- | Yes |
| `DATABASE_POOL_MIN` | Minimum number of connections in the pool. | `2` | No |
| `DATABASE_POOL_MAX` | Maximum number of connections in the pool. | `10` | No |
| `DATABASE_SSL` | Enable SSL for database connections. Set to `true` for cloud-hosted databases. | `false` | No |
| `DATABASE_SSL_REJECT_UNAUTHORIZED` | Reject self-signed SSL certificates. Set to `false` for development with self-signed certs. | `true` | No |

---

## Redis Configuration

| Variable | Description | Default | Required |
|---|---|---|---|
| `REDIS_URL` | Redis connection string (see above). | -- | Yes |
| `REDIS_KEY_PREFIX` | Prefix for all Redis keys. Useful for sharing a Redis instance across applications. | `awareness:` | No |
| `REDIS_SESSION_TTL` | Session time-to-live in seconds. | `86400` (24 hours) | No |
| `REDIS_CACHE_TTL` | Default cache entry time-to-live in seconds. | `3600` (1 hour) | No |

---

## Authentication

| Variable | Description | Default | Required |
|---|---|---|---|
| `SESSION_SECRET` | Cookie signing secret (see above). | -- | Yes |
| `JWT_SECRET` | Secret for signing JSON Web Tokens. If not set, falls back to `SESSION_SECRET`. | -- | No |
| `JWT_EXPIRY` | JWT token expiration time. | `7d` | No |
| `BCRYPT_ROUNDS` | Number of bcrypt hashing rounds. Higher values are more secure but slower. | `12` | No |
| `OAUTH_GOOGLE_CLIENT_ID` | Google OAuth 2.0 client ID for social login. | -- | No |
| `OAUTH_GOOGLE_CLIENT_SECRET` | Google OAuth 2.0 client secret. | -- | No |
| `OAUTH_GITHUB_CLIENT_ID` | GitHub OAuth client ID for social login. | -- | No |
| `OAUTH_GITHUB_CLIENT_SECRET` | GitHub OAuth client secret. | -- | No |

---

## AWS / S3 Storage

Used for storing knowledge packages, user uploads, and other binary assets.

| Variable | Description | Default | Required |
|---|---|---|---|
| `AWS_ACCESS_KEY_ID` | AWS IAM access key ID. | -- | No* |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM secret access key. | -- | No* |
| `AWS_REGION` | AWS region for S3 and other services. | `us-east-1` | No |
| `S3_BUCKET_NAME` | S3 bucket for storing packages and uploads. | `awareness-network-storage` | No |
| `S3_ENDPOINT` | Custom S3 endpoint. Set this for S3-compatible services like MinIO, DigitalOcean Spaces, or Cloudflare R2. | -- | No |
| `S3_FORCE_PATH_STYLE` | Use path-style S3 URLs instead of virtual-hosted. Required for MinIO and some S3-compatible services. | `false` | No |

*Required if using S3 storage. If not set, the application falls back to local file storage in `./uploads`.

---

## Stripe Payment Processing

| Variable | Description | Default | Required |
|---|---|---|---|
| `STRIPE_SECRET_KEY` | Stripe secret API key. Starts with `sk_live_` or `sk_test_`. | -- | No* |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key for client-side integration. Starts with `pk_live_` or `pk_test_`. | -- | No* |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret. Starts with `whsec_`. Used to verify webhook payloads. | -- | No* |
| `STRIPE_PRICE_ID` | Default Stripe price ID for subscription plans. | -- | No |

*Required if payment processing is enabled. Without these, the marketplace operates in "free" mode.

---

## Blockchain / Web3

| Variable | Description | Default | Required |
|---|---|---|---|
| `ETH_RPC_URL` | Ethereum JSON-RPC endpoint. | `https://eth-mainnet.g.alchemy.com/v2/...` | No |
| `ERC8004_CONTRACT_ADDRESS` | Deployed ERC-8004 contract address. | -- | No |
| `AGENT_WALLET_PRIVATE_KEY` | Private key for the platform's agent wallet. Handle with extreme care. | -- | No |
| `CHAIN_ID` | Ethereum chain ID. `1` for mainnet, `11155111` for Sepolia testnet. | `1` | No |

---

## Email

| Variable | Description | Default | Required |
|---|---|---|---|
| `SMTP_HOST` | SMTP server hostname. | -- | No |
| `SMTP_PORT` | SMTP server port. | `587` | No |
| `SMTP_USER` | SMTP authentication username. | -- | No |
| `SMTP_PASSWORD` | SMTP authentication password. | -- | No |
| `SMTP_FROM` | Default "From" address for outgoing emails. | `noreply@awareness.network` | No |
| `SMTP_SECURE` | Use TLS for SMTP connection. | `true` | No |

---

## Monitoring and Observability

| Variable | Description | Default | Required |
|---|---|---|---|
| `PROMETHEUS_ENABLED` | Enable Prometheus metrics endpoint at `/metrics`. | `false` | No |
| `PROMETHEUS_PORT` | Port for the Prometheus metrics server (if separate from main app). | `9090` | No |
| `SENTRY_DSN` | Sentry error tracking DSN. | -- | No |
| `SENTRY_ENVIRONMENT` | Sentry environment identifier. | Value of `NODE_ENV` | No |
| `SENTRY_TRACES_SAMPLE_RATE` | Sentry performance monitoring sample rate (0.0 to 1.0). | `0.1` | No |

---

## AI and Model Configuration

| Variable | Description | Default | Required |
|---|---|---|---|
| `OPENAI_API_KEY` | OpenAI API key for GPT model integrations. | -- | No |
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude model integrations. | -- | No |
| `AWARENESS_MCP_SERVER_URL` | URL of the Awareness MCP server for AI collaboration features. | `http://localhost:3001` | No |
| `MAX_CONCURRENT_SESSIONS` | Maximum number of concurrent AI collaboration sessions. | `10` | No |
| `SESSION_TIMEOUT_MS` | Default session timeout in milliseconds. | `600000` (10 min) | No |

---

## Feature Flags

| Variable | Description | Default | Required |
|---|---|---|---|
| `FEATURE_MARKETPLACE` | Enable the knowledge marketplace. | `true` | No |
| `FEATURE_COLLABORATION` | Enable AI collaboration sessions. | `true` | No |
| `FEATURE_NEURAL_CORTEX` | Enable the Neural Cortex visualization dashboard. | `true` | No |
| `FEATURE_ZKP_VERIFICATION` | Enable ZKP-based package verification. | `false` | No |
| `FEATURE_ROBOTICS` | Enable the RMC robotics middleware integration. | `false` | No |

---

## Rate Limiting

| Variable | Description | Default | Required |
|---|---|---|---|
| `RATE_LIMIT_WINDOW_MS` | Rate limiting window duration in milliseconds. | `900000` (15 min) | No |
| `RATE_LIMIT_MAX_REQUESTS` | Maximum requests per window per IP. | `100` | No |
| `RATE_LIMIT_API_MAX` | Maximum API requests per window per authenticated user. | `1000` | No |

---

## Example `.env` File

```bash
# === Required ===
DATABASE_URL="postgresql://awareness:your_secure_password@localhost:5432/awareness_network"
REDIS_URL="redis://localhost:6379"
SESSION_SECRET="your-64-character-random-hex-string-generated-with-openssl-rand"

# === Application ===
NODE_ENV="production"
PORT=5000
VITE_API_URL="https://your-domain.com"
LOG_LEVEL="info"
CORS_ORIGIN="https://your-domain.com"

# === AWS S3 ===
AWS_ACCESS_KEY_ID="AKIA..."
AWS_SECRET_ACCESS_KEY="..."
AWS_REGION="us-east-1"
S3_BUCKET_NAME="your-awareness-bucket"

# === Stripe ===
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_PUBLISHABLE_KEY="pk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# === Monitoring ===
PROMETHEUS_ENABLED="true"
SENTRY_DSN="https://...@sentry.io/..."

# === Feature Flags ===
FEATURE_MARKETPLACE="true"
FEATURE_COLLABORATION="true"
FEATURE_NEURAL_CORTEX="true"
FEATURE_ZKP_VERIFICATION="false"
```
