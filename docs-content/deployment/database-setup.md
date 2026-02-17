# Database Setup

## PostgreSQL Installation, Configuration, and Maintenance

The Awareness Network uses PostgreSQL as its primary relational database, managed through Prisma ORM. This guide covers installation, database creation, schema migrations, seed data, and backup strategies.

---

## Installation

### Debian / Ubuntu

```bash
# Add PostgreSQL APT repository
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -

# Install PostgreSQL 15
sudo apt update
sudo apt install -y postgresql-15 postgresql-contrib-15

# Start and enable the service
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### RHEL / CentOS / Fedora

```bash
# Install the repository RPM
sudo dnf install -y https://download.postgresql.org/pub/repos/yum/reporpms/EL-9-x86_64/pgdg-redhat-repo-latest.noarch.rpm

# Install PostgreSQL 15
sudo dnf install -y postgresql15-server postgresql15-contrib

# Initialize the database cluster
sudo /usr/pgsql-15/bin/postgresql-15-setup initdb

# Start and enable
sudo systemctl start postgresql-15
sudo systemctl enable postgresql-15
```

### macOS (Homebrew)

```bash
brew install postgresql@15
brew services start postgresql@15
```

### Docker

```bash
docker run -d \
  --name awareness-postgres \
  -e POSTGRES_USER=awareness \
  -e POSTGRES_PASSWORD=your_secure_password \
  -e POSTGRES_DB=awareness_network \
  -p 5432:5432 \
  -v pgdata:/var/lib/postgresql/data \
  postgres:15-alpine
```

---

## Create the Database

### Create the User

```bash
sudo -u postgres psql
```

```sql
-- Create the application user
CREATE USER awareness WITH PASSWORD 'your_secure_password';

-- Grant necessary permissions
ALTER USER awareness CREATEDB;
```

### Create the Database

```sql
-- Create the database owned by the application user
CREATE DATABASE awareness_network OWNER awareness;

-- Connect to the new database
\c awareness_network

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Exit psql
\q
```

### Verify the Connection

```bash
psql -U awareness -h localhost -d awareness_network -c "SELECT version();"
```

---

## Configure PostgreSQL for Production

Edit the PostgreSQL configuration file. On Debian/Ubuntu, this is typically at `/etc/postgresql/15/main/postgresql.conf`.

### Key Settings

```ini
# Connection settings
listen_addresses = 'localhost'         # Only accept local connections (use Nginx/app for external)
port = 5432
max_connections = 100                  # Adjust based on connection pool size

# Memory settings (for 8 GB RAM server)
shared_buffers = 2GB                   # 25% of available RAM
effective_cache_size = 6GB             # 75% of available RAM
work_mem = 64MB                        # Per-operation memory
maintenance_work_mem = 512MB           # For VACUUM, CREATE INDEX, etc.

# Write-ahead log (WAL)
wal_level = replica                    # Enables point-in-time recovery
max_wal_size = 2GB
min_wal_size = 80MB
checkpoint_completion_target = 0.9

# Query planner
random_page_cost = 1.1                 # For SSD storage (default 4.0 for HDD)
effective_io_concurrency = 200         # For SSD storage

# Logging
log_min_duration_statement = 1000      # Log queries slower than 1 second
log_checkpoints = on
log_connections = on
log_disconnections = on
log_lock_waits = on
```

### Client Authentication

Edit `pg_hba.conf` to configure authentication:

```
# TYPE  DATABASE          USER        ADDRESS         METHOD
local   all               postgres                    peer
local   awareness_network awareness                   scram-sha-256
host    awareness_network awareness   127.0.0.1/32    scram-sha-256
host    awareness_network awareness   ::1/128         scram-sha-256
```

Reload after changes:

```bash
sudo systemctl reload postgresql
```

---

## Run Prisma Migrations

Prisma manages the database schema through migration files stored in `prisma/migrations/`.

### Deploy Migrations (Production)

This applies all pending migrations without generating new ones:

```bash
npx prisma migrate deploy
```

### Create a New Migration (Development)

When you change the Prisma schema, create a migration:

```bash
npx prisma migrate dev --name describe_your_change
```

### Reset the Database (Development Only)

This drops the database and re-applies all migrations. **Never run this in production.**

```bash
npx prisma migrate reset
```

### Check Migration Status

```bash
npx prisma migrate status
```

### View the Current Schema

```bash
npx prisma db pull   # Introspect the database and update schema.prisma
npx prisma studio    # Open the visual database browser
```

---

## Seed Data

The seed script populates the database with initial data needed for the application to function.

### Run the Seed Script

```bash
npx prisma db seed
```

### What Gets Seeded

| Data | Description |
|---|---|
| **Default categories** | Knowledge package categories (e.g., "Software Engineering", "Data Science") |
| **Model architectures** | Supported model definitions (LLaMA 3, GPT-4, Claude 3.5, etc.) |
| **Capability taxonomy** | Standard capability definitions for agent registration |
| **System agent** | The platform's system agent identity |
| **Demo packages** | Sample knowledge packages for development and testing |
| **Admin user** | Default administrator account (change the password immediately) |

### Custom Seed Data

You can extend the seed script at `prisma/seed.ts`:

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create custom categories
  await prisma.category.createMany({
    data: [
      { name: 'Robotics', slug: 'robotics', description: 'Motion planning and control systems' },
      { name: 'Healthcare', slug: 'healthcare', description: 'Medical knowledge and clinical reasoning' },
    ],
    skipDuplicates: true,
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

---

## Backup Strategies

### Automated Daily Backups with pg_dump

Create a backup script at `/opt/awareness/backup.sh`:

```bash
#!/bin/bash
set -euo pipefail

BACKUP_DIR="/var/backups/postgresql"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/awareness_network_${TIMESTAMP}.sql.gz"
RETENTION_DAYS=30

# Create backup directory if it doesn't exist
mkdir -p "${BACKUP_DIR}"

# Create compressed backup
pg_dump -U awareness -h localhost awareness_network | gzip > "${BACKUP_FILE}"

# Verify the backup file is not empty
if [ ! -s "${BACKUP_FILE}" ]; then
  echo "ERROR: Backup file is empty" >&2
  exit 1
fi

echo "Backup created: ${BACKUP_FILE} ($(du -h "${BACKUP_FILE}" | cut -f1))"

# Remove backups older than retention period
find "${BACKUP_DIR}" -name "awareness_network_*.sql.gz" -mtime +${RETENTION_DAYS} -delete

echo "Cleanup complete. Removed backups older than ${RETENTION_DAYS} days."
```

Schedule with cron:

```bash
# Run daily at 2:00 AM
echo "0 2 * * * /opt/awareness/backup.sh >> /var/log/awareness-backup.log 2>&1" | sudo crontab -
```

### Point-in-Time Recovery (PITR)

For production environments, enable continuous archiving for point-in-time recovery:

```ini
# In postgresql.conf
wal_level = replica
archive_mode = on
archive_command = 'cp %p /var/backups/postgresql/wal/%f'
```

### Restore from Backup

```bash
# Restore from a pg_dump backup
gunzip -c /var/backups/postgresql/awareness_network_20260216_020000.sql.gz | psql -U awareness -h localhost awareness_network

# Or create a fresh database and restore
sudo -u postgres createdb -O awareness awareness_network_restored
gunzip -c backup.sql.gz | psql -U awareness -h localhost awareness_network_restored
```

### Remote Backup to S3

For off-site backup redundancy:

```bash
#!/bin/bash
BACKUP_FILE="/var/backups/postgresql/awareness_network_$(date +%Y%m%d_%H%M%S).sql.gz"
pg_dump -U awareness -h localhost awareness_network | gzip > "${BACKUP_FILE}"
aws s3 cp "${BACKUP_FILE}" s3://your-backup-bucket/postgresql/
```

---

## Monitoring Database Health

### Key Queries

```sql
-- Active connections
SELECT count(*) FROM pg_stat_activity WHERE datname = 'awareness_network';

-- Slow queries (currently running)
SELECT pid, now() - pg_stat_activity.query_start AS duration, query
FROM pg_stat_activity
WHERE (now() - pg_stat_activity.query_start) > interval '5 seconds'
  AND state = 'active';

-- Table sizes
SELECT relname AS table_name,
       pg_size_pretty(pg_total_relation_size(relid)) AS total_size
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC;

-- Index usage statistics
SELECT relname, indexrelname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- Dead tuples (need for VACUUM)
SELECT relname, n_dead_tup, last_vacuum, last_autovacuum
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC;
```

### Automated Health Check

Add to your monitoring system:

```bash
# Check if PostgreSQL is accepting connections
pg_isready -U awareness -h localhost -d awareness_network

# Check replication lag (if using replicas)
psql -U awareness -h localhost -d awareness_network -c "SELECT EXTRACT(EPOCH FROM (now() - pg_last_xact_replay_timestamp())) AS lag_seconds;"
```
