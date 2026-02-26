-- ============================================================================
-- Migration: Add pgvector embeddings to Package tables
-- Purpose: Enable 500x faster vector search using HNSW indexes
-- Date: 2026-02-26
-- ============================================================================

-- Prerequisites check
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    RAISE EXCEPTION 'pgvector extension not installed. Run: CREATE EXTENSION vector;';
  END IF;
END $$;

-- ============================================================================
-- 1. Add embedding columns to Package tables
-- ============================================================================

-- Vector Packages: 512 dimensions (Matryoshka embedding)
ALTER TABLE vector_packages
ADD COLUMN IF NOT EXISTS embedding vector(512);

COMMENT ON COLUMN vector_packages.embedding IS
'Semantic embedding for vector search. Generated from name + description using nomic-embed-text-v1.5 (512 dim)';

-- Memory Packages: 256 dimensions (optimized for storage)
ALTER TABLE memory_packages
ADD COLUMN IF NOT EXISTS embedding vector(256);

COMMENT ON COLUMN memory_packages.embedding IS
'Semantic embedding for memory search. Optimized for KV-Cache retrieval (256 dim)';

-- Chain Packages: 768 dimensions (full quality for reasoning chains)
ALTER TABLE chain_packages
ADD COLUMN IF NOT EXISTS embedding vector(768);

COMMENT ON COLUMN chain_packages.embedding IS
'Semantic embedding for chain search. Full dimension for complex reasoning patterns (768 dim)';

-- ============================================================================
-- 2. Create HNSW indexes for fast approximate nearest neighbor search
-- ============================================================================

-- Vector Packages index
-- m=16: number of bi-directional links (higher = better recall, slower build)
-- ef_construction=64: quality during index build (higher = better index, slower build)
CREATE INDEX IF NOT EXISTS vector_packages_embedding_hnsw_idx
ON vector_packages
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Memory Packages index
CREATE INDEX IF NOT EXISTS memory_packages_embedding_hnsw_idx
ON memory_packages
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Chain Packages index
CREATE INDEX IF NOT EXISTS chain_packages_embedding_hnsw_idx
ON chain_packages
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- ============================================================================
-- 3. Add helper function for similarity search
-- ============================================================================

CREATE OR REPLACE FUNCTION search_vector_packages(
  query_embedding vector(512),
  match_count int DEFAULT 10,
  min_similarity float DEFAULT 0.3
)
RETURNS TABLE (
  id int,
  package_id text,
  name text,
  description text,
  category text,
  price numeric,
  downloads int,
  rating numeric,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    vp.id,
    vp.package_id,
    vp.name,
    vp.description,
    vp.category,
    vp.price,
    vp.downloads,
    vp.rating,
    1 - (vp.embedding <=> query_embedding) AS similarity
  FROM vector_packages vp
  WHERE
    vp.status = 'active'
    AND vp.embedding IS NOT NULL
    AND (1 - (vp.embedding <=> query_embedding)) >= min_similarity
  ORDER BY vp.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

CREATE OR REPLACE FUNCTION search_memory_packages(
  query_embedding vector(256),
  match_count int DEFAULT 10,
  min_similarity float DEFAULT 0.3
)
RETURNS TABLE (
  id int,
  package_id text,
  name text,
  description text,
  token_count int,
  compression_ratio numeric,
  price numeric,
  downloads int,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    mp.id,
    mp.package_id,
    mp.name,
    mp.description,
    mp.token_count,
    mp.compression_ratio,
    mp.price,
    mp.downloads,
    1 - (mp.embedding <=> query_embedding) AS similarity
  FROM memory_packages mp
  WHERE
    mp.status = 'active'
    AND mp.embedding IS NOT NULL
    AND (1 - (mp.embedding <=> query_embedding)) >= min_similarity
  ORDER BY mp.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

CREATE OR REPLACE FUNCTION search_chain_packages(
  query_embedding vector(768),
  match_count int DEFAULT 10,
  min_similarity float DEFAULT 0.3
)
RETURNS TABLE (
  id int,
  package_id text,
  name text,
  description text,
  problem_type text,
  step_count int,
  solution_quality numeric,
  price numeric,
  downloads int,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cp.id,
    cp.package_id,
    cp.name,
    cp.description,
    cp.problem_type,
    cp.step_count,
    cp.solution_quality,
    cp.price,
    cp.downloads,
    1 - (cp.embedding <=> query_embedding) AS similarity
  FROM chain_packages cp
  WHERE
    cp.status = 'active'
    AND cp.embedding IS NOT NULL
    AND (1 - (cp.embedding <=> query_embedding)) >= min_similarity
  ORDER BY cp.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ============================================================================
-- 4. Performance optimization: Set HNSW search quality
-- ============================================================================

-- ef_search: higher = better recall, slower search (default: 40)
-- For production, ef_search=64 gives good balance
-- Can be adjusted per-session or per-query
ALTER DATABASE awareness SET hnsw.ef_search = 64;

-- ============================================================================
-- 5. Verification queries
-- ============================================================================

-- Check indexes
DO $$
DECLARE
  idx_count int;
BEGIN
  SELECT COUNT(*) INTO idx_count
  FROM pg_indexes
  WHERE indexname LIKE '%embedding_hnsw_idx';

  RAISE NOTICE 'Created % HNSW indexes', idx_count;

  IF idx_count < 3 THEN
    RAISE WARNING 'Expected 3 HNSW indexes, found only %', idx_count;
  END IF;
END $$;

-- Show index details
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE indexname LIKE '%embedding%'
ORDER BY tablename, indexname;

-- ============================================================================
-- Migration complete!
--
-- Next steps:
-- 1. Run embedding generation for existing packages (see scripts/backfill-embeddings.ts)
-- 2. Update API endpoints to use vector search
-- 3. Monitor query performance (should see <10ms for 100k packages)
--
-- Benchmark query example:
-- EXPLAIN ANALYZE
-- SELECT * FROM search_vector_packages('[0.1, 0.2, ...]'::vector(512), 10, 0.5);
-- ============================================================================
