-- Migration: Add webhook_events table for Webhook Adapter Layer audit logging
-- Date: 2026-02-26
-- Description: Creates the webhook_events table to track all inbound and outbound
--   webhook events with idempotency, retry tracking, and dead letter status.

CREATE TABLE IF NOT EXISTS "webhook_events" (
  "id"           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  "workflow_id"  VARCHAR(64)  NOT NULL,
  "direction"    VARCHAR(10)  NOT NULL,        -- 'inbound' | 'outbound'
  "event"        VARCHAR(64)  NOT NULL,        -- e.g. 'workflow.execute', 'workflow.step.completed'
  "action"       VARCHAR(32),                  -- inbound only: 'propose'|'execute'|'stop'|'sync'|'tool'
  "request_id"   VARCHAR(64)  NOT NULL UNIQUE, -- idempotency key
  "payload"      JSONB,
  "status"       VARCHAR(16)  NOT NULL DEFAULT 'pending', -- pending|processing|delivered|failed|dlq
  "attempts"     INTEGER      NOT NULL DEFAULT 0,
  "status_code"  INTEGER,
  "error"        TEXT,
  "source_ip"    VARCHAR(45),
  "created_at"   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "processed_at" TIMESTAMPTZ
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS "idx_webhook_events_workflow_id"
  ON "webhook_events" ("workflow_id");

CREATE INDEX IF NOT EXISTS "idx_webhook_events_direction_status"
  ON "webhook_events" ("direction", "status");

CREATE INDEX IF NOT EXISTS "idx_webhook_events_created_at"
  ON "webhook_events" ("created_at");

-- Also add the pending webhook columns to workflows table if not already present
-- (These were added in the previous feature but may not be migrated yet)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workflows' AND column_name = 'webhook_url') THEN
    ALTER TABLE "workflows" ADD COLUMN "webhook_url" VARCHAR(2048);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workflows' AND column_name = 'webhook_secret') THEN
    ALTER TABLE "workflows" ADD COLUMN "webhook_secret" VARCHAR(255);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workflows' AND column_name = 'webhook_events') THEN
    ALTER TABLE "workflows" ADD COLUMN "webhook_events" TEXT;
  END IF;
END $$;
