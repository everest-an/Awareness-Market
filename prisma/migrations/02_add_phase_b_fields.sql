-- Migration: Add Phase B Fields for 5-Feature Implementation
-- Description: Add conflict detection, version tree, permissions, and decision replay fields
-- Features: 1) Scoring 2) Conflict Detection 3) Version Tree 4) Permissions 5) Decision Replay
-- User spec: "总体原则：不要一开始做复杂分布式。先做：结构化数据模型 + 规则引擎"

BEGIN;

-- ============================================================================
-- Phase B: Add New Fields to memory_entries
-- ============================================================================

-- 冲突检测 (Conflict Detection) - claim_key/claim_value matching
ALTER TABLE memory_entries
  ADD COLUMN IF NOT EXISTS claim_key VARCHAR(255),
  ADD COLUMN IF NOT EXISTS claim_value TEXT;

-- 版本树 (Version Tree) - root_id for full tree queries
ALTER TABLE memory_entries
  ADD COLUMN IF NOT EXISTS root_id UUID;

-- 权限与部门隔离 (Permissions & Department Isolation)
ALTER TABLE memory_entries
  ADD COLUMN IF NOT EXISTS agent_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS department VARCHAR(100),
  ADD COLUMN IF NOT EXISTS role VARCHAR(50);

-- Add foreign key constraint for root_id (self-referencing)
ALTER TABLE memory_entries
  ADD CONSTRAINT fk_memory_entries_root_id
  FOREIGN KEY (root_id) REFERENCES memory_entries(id) ON DELETE SET NULL;

-- ============================================================================
-- Create Indexes for New Fields (第1阶段: Multi-index)
-- ============================================================================

-- Conflict detection index
CREATE INDEX IF NOT EXISTS idx_memory_entries_claim_key ON memory_entries(claim_key);

-- Version tree index
CREATE INDEX IF NOT EXISTS idx_memory_entries_root_id ON memory_entries(root_id);

-- Permissions indexes
CREATE INDEX IF NOT EXISTS idx_memory_entries_department ON memory_entries(department);
CREATE INDEX IF NOT EXISTS idx_memory_entries_agent_id ON memory_entries(agent_id);

-- Composite index for department + role filtering
CREATE INDEX IF NOT EXISTS idx_memory_entries_dept_role ON memory_entries(department, role);

-- ============================================================================
-- Memory Conflicts Table (第2阶段: 冲突检测)
-- ============================================================================

CREATE TABLE IF NOT EXISTS memory_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id_1 UUID NOT NULL REFERENCES memory_entries(id) ON DELETE CASCADE,
  memory_id_2 UUID NOT NULL REFERENCES memory_entries(id) ON DELETE CASCADE,

  -- Conflict type: 'claim_value_mismatch' (simple), 'semantic_contradiction' (LLM-based)
  conflict_type VARCHAR(50) NOT NULL,

  -- Status: 'pending', 'resolved', 'ignored'
  status VARCHAR(20) NOT NULL DEFAULT 'pending',

  -- Resolution tracking
  resolution_memory_id UUID REFERENCES memory_entries(id) ON DELETE SET NULL,
  detected_at TIMESTAMP NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMP,
  resolved_by VARCHAR(255),

  -- Prevent duplicate conflicts (A-B same as B-A)
  CONSTRAINT unique_conflict_pair UNIQUE (memory_id_1, memory_id_2),

  -- Ensure memory_id_1 < memory_id_2 for canonical ordering
  CONSTRAINT check_conflict_ordering CHECK (memory_id_1 < memory_id_2)
);

-- Indexes for memory_conflicts
CREATE INDEX IF NOT EXISTS idx_memory_conflicts_status ON memory_conflicts(status);
CREATE INDEX IF NOT EXISTS idx_memory_conflicts_detected_at ON memory_conflicts(detected_at);
CREATE INDEX IF NOT EXISTS idx_memory_conflicts_memory_id_1 ON memory_conflicts(memory_id_1);
CREATE INDEX IF NOT EXISTS idx_memory_conflicts_memory_id_2 ON memory_conflicts(memory_id_2);
CREATE INDEX IF NOT EXISTS idx_memory_conflicts_type ON memory_conflicts(conflict_type);

-- ============================================================================
-- Triggers for Conflict Detection (第2阶段)
-- ============================================================================

-- Auto-detect claim_key conflicts on INSERT/UPDATE
CREATE OR REPLACE FUNCTION detect_claim_conflicts()
RETURNS TRIGGER AS $$
BEGIN
  -- Only check if claim_key is set
  IF NEW.claim_key IS NOT NULL AND NEW.claim_value IS NOT NULL THEN
    -- Find other memories with same claim_key but different claim_value
    INSERT INTO memory_conflicts (memory_id_1, memory_id_2, conflict_type, status)
    SELECT
      LEAST(NEW.id, existing.id) AS memory_id_1,
      GREATEST(NEW.id, existing.id) AS memory_id_2,
      'claim_value_mismatch' AS conflict_type,
      'pending' AS status
    FROM memory_entries existing
    WHERE existing.claim_key = NEW.claim_key
      AND existing.claim_value != NEW.claim_value
      AND existing.id != NEW.id
      AND existing.org_id = NEW.org_id
      AND existing.is_latest = TRUE
    ON CONFLICT (memory_id_1, memory_id_2) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER memory_entries_detect_conflicts
  AFTER INSERT OR UPDATE OF claim_key, claim_value ON memory_entries
  FOR EACH ROW
  EXECUTE FUNCTION detect_claim_conflicts();

-- ============================================================================
-- Trigger for Version Tree root_id (第2阶段)
-- ============================================================================

-- Auto-populate root_id when creating new versions
CREATE OR REPLACE FUNCTION set_version_root_id()
RETURNS TRIGGER AS $$
BEGIN
  -- If this is a new version (has parent_id), inherit root_id from parent
  IF NEW.parent_id IS NOT NULL THEN
    SELECT COALESCE(root_id, id) INTO NEW.root_id
    FROM memory_entries
    WHERE id = NEW.parent_id;
  ELSE
    -- If this is a root memory (no parent), set root_id to self
    NEW.root_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER memory_entries_set_root_id
  BEFORE INSERT ON memory_entries
  FOR EACH ROW
  EXECUTE FUNCTION set_version_root_id();

COMMIT;

-- ============================================================================
-- Verification Queries
-- ============================================================================

-- Check new columns added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'memory_entries'
  AND column_name IN ('claim_key', 'claim_value', 'root_id', 'agent_id', 'department', 'role');

-- Check memory_conflicts table created
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'memory_conflicts';

-- Check new indexes
SELECT schemaname, tablename, indexname
FROM pg_indexes
WHERE tablename IN ('memory_entries', 'memory_conflicts')
  AND indexname LIKE '%claim%' OR indexname LIKE '%root%' OR indexname LIKE '%department%' OR indexname LIKE '%agent%';

-- Check triggers
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE event_object_table = 'memory_entries'
  AND trigger_name IN ('memory_entries_detect_conflicts', 'memory_entries_set_root_id');
