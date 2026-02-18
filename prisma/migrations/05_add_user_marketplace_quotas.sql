-- ============================================================================
-- Migration 05: Add marketplace quota columns to users table
-- Fixes: "The column `users.max_listings` does not exist" error
-- Run: psql $DATABASE_URL -f prisma/migrations/05_add_user_marketplace_quotas.sql
-- ============================================================================

-- V1 Marketplace Quotas (P0-2 Security Fix)
DO $$ BEGIN
  ALTER TABLE "users" ADD COLUMN "max_listings" INTEGER NOT NULL DEFAULT 10;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "users" ADD COLUMN "current_listing_count" INTEGER NOT NULL DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ============================================================================
-- Verify
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'max_listings'
  ) THEN
    RAISE NOTICE 'Migration 05 applied: max_listings and current_listing_count columns added to users';
  END IF;
END $$;
