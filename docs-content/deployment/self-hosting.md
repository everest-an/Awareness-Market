# Self-Hosting Guide

## Deploy the Awareness Network on Your Own Infrastructure

This guide walks you through every step of deploying a self-hosted instance of the Awareness Network, from prerequisites through production-ready configuration with process management, reverse proxy, and SSL termination.

---

## Prerequisites

Before you begin, ensure you have the following installed and configured:

| Requirement | Minimum Version | Purpose |
|---|---|---|
| **Node.js** | 20.x LTS | Application runtime |
| **npm** | 10.x | Package management |
| **PostgreSQL** | 15.x | Primary database |
| **Redis** | 7.x | Caching, sessions, and real-time messaging |
| **Git** | 2.x | Source code management |
| **Nginx** | 1.24+ | Reverse proxy and SSL termination |
| **PM2** or **Docker** | PM2 5.x / Docker 24.x | Process management and deployment |

### Hardware Recommendations

| Component | Minimum | Recommended |
|---|---|---|
| **CPU** | 2 cores | 4+ cores |
| **RAM** | 4 GB | 8+ GB |
| **Storage** | 40 GB SSD | 100+ GB SSD |
| **Network** | 100 Mbps | 1 Gbps |

---

## Step 1: Clone the Repository

```bash
git clone https://github.com/awareness-network/awareness-network.git
cd awareness-network
```

---

## Step 2: Install Dependencies

```bash
npm install
```

This installs all dependencies for both the server and client applications.

---

## Step 3: Configure Environment Variables

Copy the example environment file and edit it with your configuration:

```bash
cp .env.example .env
```

Edit `.env` with your values. See the [Environment Variables](environment-variables.md) page for a complete reference. At minimum, you must set:

```bash
# Database
DATABASE_URL="postgresql://awareness:your_password@localhost:5432/awareness_network"

# Redis
REDIS_URL="redis://localhost:6379"

# Security
SESSION_SECRET="generate-a-random-64-character-string"

# Application
NODE_ENV="production"
VITE_API_URL="https://your-domain.com"
```

Generate a secure session secret:

```bash
openssl rand -hex 32
```

---

## Step 4: Set Up the Database

Ensure PostgreSQL is running and create the database:

```bash
# Create the database user and database
sudo -u postgres createuser --pwprompt awareness
sudo -u postgres createdb -O awareness awareness_network
```

Run Prisma migrations to create the schema:

```bash
npx prisma migrate deploy
```

Optionally seed the database with initial data:

```bash
npx prisma db seed
```

For detailed database setup instructions, see [Database Setup](database-setup.md).

---

## Step 5: Build the Application

```bash
npm run build
```

This compiles the TypeScript server code and builds the Vite-powered client application for production.

Verify the build succeeded:

```bash
ls -la dist/
```

---

## Step 6: Deploy

Choose one of the following deployment methods.

### Option A: Deploy with PM2

PM2 is a production-grade process manager for Node.js that provides automatic restarts, load balancing, and log management.

#### Install PM2

```bash
npm install -g pm2
```

#### Create PM2 Ecosystem File

Create `ecosystem.config.cjs` in the project root:

```javascript
module.exports = {
  apps: [
    {
      name: 'awareness-network',
      script: 'dist/index.js',
      instances: 'max',          // Use all available CPU cores
      exec_mode: 'cluster',      // Enable cluster mode
      env: {
        NODE_ENV: 'production',
      },
      env_file: '.env',
      max_memory_restart: '1G',  // Restart if memory exceeds 1 GB
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: 'logs/error.log',
      out_file: 'logs/output.log',
      merge_logs: true,
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
    },
  ],
};
```

#### Start the Application

```bash
pm2 start ecosystem.config.cjs
```

#### Enable Startup on Boot

```bash
pm2 startup
pm2 save
```

#### Useful PM2 Commands

```bash
pm2 status                    # View running processes
pm2 logs awareness-network    # View live logs
pm2 monit                     # Real-time monitoring dashboard
pm2 restart awareness-network # Restart the application
pm2 stop awareness-network    # Stop the application
pm2 reload awareness-network  # Zero-downtime reload
```

### Option B: Deploy with Docker

#### Dockerfile

The repository includes a production-ready Dockerfile:

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
RUN npx prisma generate

FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma

EXPOSE 5000

CMD ["node", "dist/index.js"]
```

#### Docker Compose

Create `docker-compose.yml` for the full stack:

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "5000:5000"
    environment:
      - DATABASE_URL=postgresql://awareness:secretpassword@postgres:5432/awareness_network
      - REDIS_URL=redis://redis:6379
      - SESSION_SECRET=${SESSION_SECRET}
      - NODE_ENV=production
      - VITE_API_URL=https://your-domain.com
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=awareness
      - POSTGRES_PASSWORD=secretpassword
      - POSTGRES_DB=awareness_network
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U awareness"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru --appendonly yes
    volumes:
      - redisdata:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  pgdata:
  redisdata:
```

#### Start the Stack

```bash
# Build and start all services
docker compose up -d --build

# Run database migrations
docker compose exec app npx prisma migrate deploy

# View logs
docker compose logs -f app

# Stop all services
docker compose down
```

---

## Step 7: Configure Nginx Reverse Proxy

Nginx serves as the public-facing entry point, handling SSL termination, WebSocket upgrades, and static file caching.

### Install Nginx

```bash
# Debian/Ubuntu
sudo apt update && sudo apt install -y nginx

# RHEL/CentOS
sudo dnf install -y nginx
```

### Create the Site Configuration

Create `/etc/nginx/sites-available/awareness-network`:

```nginx
upstream awareness_backend {
    server 127.0.0.1:5000;
    keepalive 32;
}

server {
    listen 80;
    server_name your-domain.com;

    # Redirect all HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL certificates (managed by Certbot)
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;

    # HSTS
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript;
    gzip_min_length 1000;

    # Client body size (for file uploads)
    client_max_body_size 100M;

    # API and application
    location / {
        proxy_pass http://awareness_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }

    # WebSocket support
    location /ws {
        proxy_pass http://awareness_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    # Static assets caching
    location /assets {
        proxy_pass http://awareness_backend;
        proxy_cache_valid 200 7d;
        add_header Cache-Control "public, max-age=604800, immutable";
    }
}
```

### Enable the Site

```bash
sudo ln -s /etc/nginx/sites-available/awareness-network /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## Step 8: Set Up SSL with Let's Encrypt

Install Certbot and obtain a free SSL certificate:

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d your-domain.com

# Verify auto-renewal
sudo certbot renew --dry-run
```

Certbot automatically modifies the Nginx configuration and sets up a cron job for automatic renewal.

---

## Post-Deployment Verification

Run through this checklist to verify your deployment:

```bash
# 1. Health check
curl https://your-domain.com/api/health

# 2. SSL certificate
curl -vI https://your-domain.com 2>&1 | grep "SSL certificate"

# 3. WebSocket connectivity
wscat -c wss://your-domain.com/ws

# 4. Database connectivity
docker compose exec app npx prisma db execute --stdin <<< "SELECT 1;"

# 5. Redis connectivity
redis-cli -u $REDIS_URL ping
```

---

## Updating

To update to a new version:

### PM2 Deployment

```bash
git pull origin main
npm install
npm run build
npx prisma migrate deploy
pm2 reload awareness-network
```

### Docker Deployment

```bash
git pull origin main
docker compose up -d --build
docker compose exec app npx prisma migrate deploy
```
