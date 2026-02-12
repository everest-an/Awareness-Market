-- Migration: Create Memory System Tables (Phase A)
-- Description: Add memory_entries, memory_scores, memory_policies, memory_access_logs
-- Prerequisites: pgvector extension must be installed (run 00_install_pgvector.sql first)

BEGIN;

-- ============================================================================
-- Memory Entries Table (Core memory storage)
-- ============================================================================

CREATE TABLE IF NOT EXISTS memory_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id VARCHAR(255) NOT NULL,
  namespace VARCHAR(255) NOT NULL,

  -- Content
  content_type VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536),  -- OpenAI text-embedding-3-small dimension
  metadata JSONB,

  -- Quality Signals
  confidence DECIMAL(3, 2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  reputation DECIMAL(5, 2) NOT NULL DEFAULT 50 CHECK (reputation >= 0 AND reputation <= 100),
  usage_count INTEGER NOT NULL DEFAULT 0,
  validation_count INTEGER NOT NULL DEFAULT 0,

  -- Versioning
  version INTEGER NOT NULL DEFAULT 1,
  parent_id UUID REFERENCES memory_entries(id) ON DELETE SET NULL,
  is_latest BOOLEAN NOT NULL DEFAULT TRUE,

  -- Lifecycle
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  accessed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP,

  -- Decay
  decay_factor DECIMAL(5, 4) NOT NULL DEFAULT 0.01 CHECK (decay_factor >= 0),
  decay_checkpoint TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for memory_entries
CREATE INDEX IF NOT EXISTS idx_memory_entries_org_namespace ON memory_entries(org_id, namespace);
CREATE INDEX IF NOT EXISTS idx_memory_entries_created_by ON memory_entries(created_by);
CREATE INDEX IF NOT EXISTS idx_memory_entries_is_latest ON memory_entries(is_latest);
CREATE INDEX IF NOT EXISTS idx_memory_entries_content_type ON memory_entries(content_type);
CREATE INDEX IF NOT EXISTS idx_memory_entries_created_at ON memory_entries(created_at);

-- Vector similarity search index (IVFFlat for performance)
-- Note: This will be created after data is loaded (requires at least 1000 vectors for optimal performance)
-- CREATE INDEX IF NOT EXISTS idx_memory_entries_embedding ON memory_entries
--   USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- For initial development, use a simpler index:
CREATE INDEX IF NOT EXISTS idx_memory_entries_embedding ON memory_entries USING ivfflat (embedding vector_cosine_ops);

-- ============================================================================
-- Memory Scores Table (Pre-computed scores for performance)
-- ============================================================================

CREATE TABLE IF NOT EXISTS memory_scores (
  memory_id UUID PRIMARY KEY REFERENCES memory_entries(id) ON DELETE CASCADE,
  base_score DECIMAL(5, 2) NOT NULL,
  decay_multiplier DECIMAL(5, 4) NOT NULL,
  final_score DECIMAL(5, 2) NOT NULL,
  last_calculated TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index for score-based sorting
CREATE INDEX IF NOT EXISTS idx_memory_scores_final_score ON memory_scores(final_score DESC);

-- ============================================================================
-- Memory Policies Table (Phase B - Governance rules)
-- ============================================================================

CREATE TABLE IF NOT EXISTS memory_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id VARCHAR(255) NOT NULL,
  namespace VARCHAR(255) NOT NULL,
  policy_type VARCHAR(50) NOT NULL, -- 'retention', 'access', 'conflict_resolution'
  rules JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for memory_policies
CREATE INDEX IF NOT EXISTS idx_memory_policies_org_namespace ON memory_policies(org_id, namespace);

-- ============================================================================
-- Memory Access Logs Table (Phase B - Audit trail)
-- ============================================================================

CREATE TABLE IF NOT EXISTS memory_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id UUID NOT NULL, -- No FK constraint to allow log retention after memory deletion
  accessed_by VARCHAR(255) NOT NULL,
  access_type VARCHAR(50) NOT NULL, -- 'read', 'write', 'delete'
  accessed_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for memory_access_logs
CREATE INDEX IF NOT EXISTS idx_memory_access_logs_memory_id ON memory_access_logs(memory_id);
CREATE INDEX IF NOT EXISTS idx_memory_access_logs_accessed_at ON memory_access_logs(accessed_at);

-- ============================================================================
-- Triggers and Functions
-- ============================================================================

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_memory_entry_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER memory_entries_updated_at
  BEFORE UPDATE ON memory_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_memory_entry_updated_at();

-- Function to mark old versions as not latest
CREATE OR REPLACE FUNCTION mark_previous_version_not_latest()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    UPDATE memory_entries
    SET is_latest = FALSE
    WHERE id = NEW.parent_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER memory_entries_version_update
  AFTER INSERT ON memory_entries
  FOR EACH ROW
  EXECUTE FUNCTION mark_previous_version_not_latest();

COMMIT;

-- ============================================================================
-- Verification Queries
-- ============================================================================

-- Check tables created
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('memory_entries', 'memory_scores', 'memory_policies', 'memory_access_logs');

-- Check pgvector extension
SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';

-- Check indexes
SELECT schemaname, tablename, indexname
FROM pg_indexes
WHERE tablename IN ('memory_entries', 'memory_scores', 'memory_policies', 'memory_access_logs');
