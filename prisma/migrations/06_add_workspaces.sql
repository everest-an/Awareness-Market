-- ============================================================================
-- Migration 06: Multi-AI Workspace tables
-- Creates workspaces and workspace_agents for the developer pivot feature
-- Run: psql $DATABASE_URL -f prisma/migrations/06_add_workspaces.sql
-- ============================================================================

-- Enums (idempotent)
DO $$ BEGIN
  CREATE TYPE "WorkspaceStatus" AS ENUM ('active', 'paused', 'completed', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AgentIntegration" AS ENUM ('mcp', 'rest');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- workspaces table
CREATE TABLE IF NOT EXISTS "workspaces" (
  "id"                  VARCHAR(32) PRIMARY KEY,
  "user_id"             INTEGER NOT NULL,
  "name"                VARCHAR(200) NOT NULL,
  "description"         VARCHAR(1000),
  "status"              "WorkspaceStatus" NOT NULL DEFAULT 'active',
  "mcp_token_encrypted" TEXT NOT NULL,
  "mcp_token_mask"      VARCHAR(30) NOT NULL,
  "memory_key"          VARCHAR(255) NOT NULL,
  "created_at"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "workspaces_user_id_idx" ON "workspaces" ("user_id");
CREATE INDEX IF NOT EXISTS "workspaces_status_idx" ON "workspaces" ("status");

-- workspace_agents table
CREATE TABLE IF NOT EXISTS "workspace_agents" (
  "id"              VARCHAR(32) PRIMARY KEY,
  "workspace_id"    VARCHAR(32) NOT NULL,
  "name"            VARCHAR(100) NOT NULL,
  "role"            VARCHAR(50) NOT NULL,
  "model"           VARCHAR(100) NOT NULL,
  "integration"     "AgentIntegration" NOT NULL,
  "permissions"     TEXT[] DEFAULT ARRAY['read', 'write'],
  "description"     VARCHAR(500),
  "created_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "fk_workspace_agents_workspace"
    FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "workspace_agents_workspace_id_idx" ON "workspace_agents" ("workspace_id");

-- auto-update updated_at triggers
CREATE OR REPLACE FUNCTION update_workspaces_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_workspaces_updated_at ON "workspaces";
CREATE TRIGGER trg_workspaces_updated_at
  BEFORE UPDATE ON "workspaces"
  FOR EACH ROW EXECUTE FUNCTION update_workspaces_updated_at();

DROP TRIGGER IF EXISTS trg_workspace_agents_updated_at ON "workspace_agents";
CREATE TRIGGER trg_workspace_agents_updated_at
  BEFORE UPDATE ON "workspace_agents"
  FOR EACH ROW EXECUTE FUNCTION update_workspaces_updated_at();

-- ============================================================================
-- Verify
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workspaces') THEN
    RAISE NOTICE 'Migration 06 applied: workspaces and workspace_agents tables created';
  END IF;
END $$;
