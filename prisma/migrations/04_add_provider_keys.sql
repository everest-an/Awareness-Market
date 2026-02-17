-- ============================================================================
-- Migration 04: BYOK Provider Keys
-- Adds per-user encrypted LLM provider key storage
-- Run: psql $DATABASE_URL -f prisma/migrations/04_add_provider_keys.sql
-- ============================================================================

-- provider_keys: stores AES-256-GCM encrypted API keys per user per provider
CREATE TABLE IF NOT EXISTS "provider_keys" (
  "id"            SERIAL PRIMARY KEY,
  "user_id"       INTEGER NOT NULL,
  "provider"      VARCHAR(50) NOT NULL,              -- 'openai' | 'anthropic' | 'gemini' | 'forge' | 'custom'
  "label"         VARCHAR(100),                      -- user-defined label, e.g. "Work Account"
  "encrypted_key" TEXT NOT NULL,                     -- iv_hex:authTag_hex:ciphertext_hex
  "key_mask"      VARCHAR(24) NOT NULL,              -- masked display: "sk-proj...ab4c"
  "base_url"      VARCHAR(512),                      -- optional base URL override
  "is_active"     BOOLEAN NOT NULL DEFAULT TRUE,
  "last_used_at"  TIMESTAMPTZ,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "fk_provider_keys_user"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,

  -- one active key per provider per user
  CONSTRAINT "uq_provider_keys_user_provider"
    UNIQUE ("user_id", "provider")
);

CREATE INDEX IF NOT EXISTS "idx_provider_keys_user_id"  ON "provider_keys" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_provider_keys_is_active" ON "provider_keys" ("is_active");

-- auto-update updated_at
CREATE OR REPLACE FUNCTION update_provider_keys_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_provider_keys_updated_at ON "provider_keys";
CREATE TRIGGER trg_provider_keys_updated_at
  BEFORE UPDATE ON "provider_keys"
  FOR EACH ROW EXECUTE FUNCTION update_provider_keys_updated_at();

-- ============================================================================
-- Verify
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'provider_keys') THEN
    RAISE NOTICE 'Migration 04 applied: provider_keys table created';
  END IF;
END $$;
