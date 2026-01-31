-- Setup pgvector extension for Awareness Network
-- Run this SQL script once on your PostgreSQL database before deploying

-- ==========================================
-- 1. Install pgvector extension
-- ==========================================

-- Check if extension is available
SELECT * FROM pg_available_extensions WHERE name = 'vector';

-- Install extension (requires superuser privileges)
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify installation
SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';

-- ==========================================
-- 2. Create vector column migration
-- ==========================================

-- Add embedding_vector column to latent_vectors table
-- (This will be done automatically by Drizzle migration)
-- But you can run this manually if needed:

-- ALTER TABLE latent_vectors ADD COLUMN IF NOT EXISTS embedding_vector vector(1536);
-- ALTER TABLE latent_vectors ADD COLUMN IF NOT EXISTS embedding_provider varchar(50) DEFAULT 'openai';
-- ALTER TABLE latent_vectors ADD COLUMN IF NOT EXISTS embedding_model varchar(100);
-- ALTER TABLE latent_vectors ADD COLUMN IF NOT EXISTS embedding_dimension integer DEFAULT 1536;
-- ALTER TABLE latent_vectors ADD COLUMN IF NOT EXISTS resonance_count integer DEFAULT 0 NOT NULL;
-- ALTER TABLE latent_vectors ADD COLUMN IF NOT EXISTS last_resonance_at timestamp;
-- ALTER TABLE latent_vectors ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT false NOT NULL;

-- ==========================================
-- 3. Create IVFFlat index for fast similarity search
-- ==========================================

-- Note: IVFFlat index requires some data to determine cluster centers
-- We'll create it after seeding some initial vectors

-- The index will be created by Drizzle with this syntax:
-- CREATE INDEX IF NOT EXISTS embedding_vector_idx ON latent_vectors
-- USING ivfflat (embedding_vector vector_cosine_ops)
-- WITH (lists = 100);

-- ==========================================
-- 4. Test vector operations
-- ==========================================

-- Test cosine similarity (after data is inserted)
-- SELECT id, title, 1 - (embedding_vector <=> '[0.1, 0.2, ...]'::vector) AS similarity
-- FROM latent_vectors
-- WHERE embedding_vector IS NOT NULL
-- ORDER BY similarity DESC
-- LIMIT 5;

-- ==========================================
-- 5. Performance tuning (optional)
-- ==========================================

-- Increase work_mem for better index performance (adjust based on your server)
-- SET work_mem = '256MB';

-- Increase maintenance_work_mem for index creation
-- SET maintenance_work_mem = '512MB';

-- ==========================================
-- Success!
-- ==========================================

SELECT 'pgvector setup complete! Extension version: ' || extversion
FROM pg_extension
WHERE extname = 'vector';
