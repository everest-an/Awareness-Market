-- ============================================================================
-- Migration 07: Enhance WorkspaceAgent for CrewAI-style configuration
-- Adds goal, backstory, tools, priority, endpoint, connection status, config
-- Run: psql $DATABASE_URL -f prisma/migrations/07_enhance_workspace_agents.sql
-- ============================================================================

-- Goal: short description of agent's objective
DO $$ BEGIN
  ALTER TABLE "workspace_agents" ADD COLUMN "goal" VARCHAR(500);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Backstory: system prompt / context for the agent
DO $$ BEGIN
  ALTER TABLE "workspace_agents" ADD COLUMN "backstory" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Tools: array of tool names the agent can use
DO $$ BEGIN
  ALTER TABLE "workspace_agents" ADD COLUMN "tools" TEXT[] DEFAULT ARRAY[]::TEXT[];
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Priority: 1-10, higher = more important
DO $$ BEGIN
  ALTER TABLE "workspace_agents" ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 5;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Endpoint: callback URL for the agent
DO $$ BEGIN
  ALTER TABLE "workspace_agents" ADD COLUMN "endpoint" VARCHAR(512);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Auth token encrypted (AES-256-GCM)
DO $$ BEGIN
  ALTER TABLE "workspace_agents" ADD COLUMN "auth_token_enc" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Connection status: connected / disconnected / pending
DO $$ BEGIN
  ALTER TABLE "workspace_agents" ADD COLUMN "connection_status" VARCHAR(20) NOT NULL DEFAULT 'disconnected';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Last seen timestamp (heartbeat)
DO $$ BEGIN
  ALTER TABLE "workspace_agents" ADD COLUMN "last_seen_at" TIMESTAMPTZ;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Config: extensible JSON (Windows MCP paths, custom params, etc.)
DO $$ BEGIN
  ALTER TABLE "workspace_agents" ADD COLUMN "config" JSONB;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Add windows_mcp to AgentIntegration enum
DO $$ BEGIN
  ALTER TYPE "AgentIntegration" ADD VALUE 'windows_mcp';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Index for connection status queries
CREATE INDEX IF NOT EXISTS "workspace_agents_connection_status_idx" ON "workspace_agents" ("connection_status");

-- ============================================================================
-- Verify
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workspace_agents' AND column_name = 'goal'
  ) THEN
    RAISE NOTICE 'Migration 07 applied: workspace_agents enhanced with goal, backstory, tools, priority, connection_status, config';
  END IF;
END $$;
