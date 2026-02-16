-- Install pgvector extension for PostgreSQL
-- This enables vector similarity search capabilities

-- Create extension if not exists
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify extension is installed
SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';

-- Note: This script should be run manually before creating the Prisma migration
-- Usage: psql -U postgres -d your_database_name -f prisma/migrations/00_install_pgvector.sql
