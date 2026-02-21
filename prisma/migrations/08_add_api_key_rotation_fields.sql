-- ============================================================================
-- Migration 08: Add auto-rotation fields to api_keys table
-- Matches Prisma schema ApiKey model P2 Security fields
-- Run: psql $DATABASE_URL -f prisma/migrations/08_add_api_key_rotation_fields.sql
-- ============================================================================

-- auto_rotation_enabled: whether auto-rotation is enabled
DO $$ BEGIN
  ALTER TABLE "api_keys" ADD COLUMN "auto_rotation_enabled" BOOLEAN NOT NULL DEFAULT FALSE;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- rotation_interval_days: how often to rotate (default 90 days)
DO $$ BEGIN
  ALTER TABLE "api_keys" ADD COLUMN "rotation_interval_days" INTEGER NOT NULL DEFAULT 90;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- rotated_from_id: reference to the previous key this was rotated from
DO $$ BEGIN
  ALTER TABLE "api_keys" ADD COLUMN "rotated_from_id" INTEGER;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- notification_sent_at: when the rotation notification was sent
DO $$ BEGIN
  ALTER TABLE "api_keys" ADD COLUMN "notification_sent_at" TIMESTAMPTZ;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ============================================================================
-- ApiKeyRotationHistory table
-- ============================================================================
CREATE TABLE IF NOT EXISTS "api_key_rotation_history" (
  "id"               SERIAL PRIMARY KEY,
  "api_key_id"       INTEGER NOT NULL REFERENCES "api_keys"("id") ON DELETE CASCADE,
  "old_key_prefix"   VARCHAR(16) NOT NULL,
  "new_key_prefix"   VARCHAR(16) NOT NULL,
  "rotation_type"    VARCHAR(20) NOT NULL,  -- 'manual', 'automatic', 'forced'
  "rotated_by"       INTEGER,               -- User ID who triggered manual rotation
  "rotation_reason"  VARCHAR(255),
  "created_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "api_key_rotation_history_api_key_id_idx" ON "api_key_rotation_history" ("api_key_id");
CREATE INDEX IF NOT EXISTS "api_key_rotation_history_created_at_idx" ON "api_key_rotation_history" ("created_at");

-- ============================================================================
-- Verify
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_keys' AND column_name = 'auto_rotation_enabled'
  ) THEN
    RAISE NOTICE 'Migration 08 applied: api_keys auto-rotation fields added';
  END IF;
END $$;
