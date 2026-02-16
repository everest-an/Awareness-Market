-- ============================================================================
-- V3 Governance Migration: Phase 3-5 Models
-- Decision Audit, Agent Reputation, Verification, Evidence, Dependencies
-- ============================================================================

-- Enums (idempotent: create only if not exists)
DO $$ BEGIN
  CREATE TYPE "VerificationStatus" AS ENUM ('pending', 'assigned', 'verified', 'rejected', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "EvidenceType" AS ENUM ('arxiv', 'doi', 'internal_data', 'experimental', 'computational', 'url');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "DependencyType" AS ENUM ('assumes', 'builds_on', 'requires', 'refutes');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "OrgPlanTier" AS ENUM ('lite', 'team', 'enterprise', 'scientific');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PoolType" AS ENUM ('private', 'domain', 'global');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- Phase 1-2: Organization infrastructure (idempotent — may already exist)
-- ============================================================================

-- Add pool_type to memory_entries if not exists
DO $$ BEGIN
  ALTER TABLE "memory_entries" ADD COLUMN "pool_type" "PoolType" NOT NULL DEFAULT 'domain';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Add org governance columns to organizations if not exists
DO $$ BEGIN
  ALTER TABLE "organizations" ADD COLUMN "plan_tier" "OrgPlanTier" NOT NULL DEFAULT 'lite';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "organizations" ADD COLUMN "enable_memory_pools" BOOLEAN NOT NULL DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "organizations" ADD COLUMN "enable_decisions" BOOLEAN NOT NULL DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ============================================================================
-- Phase 3: Decisions + Agent Reputation
-- ============================================================================

-- Decisions table
CREATE TABLE IF NOT EXISTS "decisions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" INTEGER NOT NULL,
    "agent_id" VARCHAR(255) NOT NULL,
    "department_id" INTEGER,
    "input_query" TEXT NOT NULL,
    "output" TEXT NOT NULL,
    "confidence" DECIMAL(3,2) NOT NULL,
    "retrieved_memory_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "memory_scores_snapshot" JSONB,
    "pool_breakdown" JSONB,
    "total_tokens_used" INTEGER NOT NULL DEFAULT 0,
    "outcome_verified" BOOLEAN NOT NULL DEFAULT false,
    "outcome_correct" BOOLEAN,
    "outcome_notes" TEXT,
    "verified_at" TIMESTAMP(3),
    "verified_by" VARCHAR(255),
    "decision_type" VARCHAR(50),
    "latency_ms" INTEGER,
    "model_used" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "decisions_pkey" PRIMARY KEY ("id")
);

-- Agent Reputations table
CREATE TABLE IF NOT EXISTS "agent_reputations" (
    "id" SERIAL NOT NULL,
    "agent_id" VARCHAR(255) NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "department_id" INTEGER,
    "write_quality" DECIMAL(5,2) NOT NULL DEFAULT 50,
    "decision_accuracy" DECIMAL(5,2) NOT NULL DEFAULT 50,
    "collaboration_score" DECIMAL(5,2) NOT NULL DEFAULT 50,
    "domain_expertise" DECIMAL(5,2) NOT NULL DEFAULT 50,
    "overall_reputation" DECIMAL(5,2) NOT NULL DEFAULT 50,
    "total_writes" INTEGER NOT NULL DEFAULT 0,
    "validated_writes" INTEGER NOT NULL DEFAULT 0,
    "conflicted_writes" INTEGER NOT NULL DEFAULT 0,
    "total_decisions" INTEGER NOT NULL DEFAULT 0,
    "correct_decisions" INTEGER NOT NULL DEFAULT 0,
    "total_collaborations" INTEGER NOT NULL DEFAULT 0,
    "last_active_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agent_reputations_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- Phase 2: Memory Pools
-- ============================================================================

CREATE TABLE IF NOT EXISTS "memory_pools" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "pool_type" "PoolType" NOT NULL,
    "department_id" INTEGER,
    "read_policy" JSONB,
    "write_policy" JSONB,
    "promotion_threshold" INTEGER NOT NULL DEFAULT 5,
    "promotion_min_score" DECIMAL(5,2) NOT NULL DEFAULT 60,
    "auto_promote" BOOLEAN NOT NULL DEFAULT false,
    "memory_count" INTEGER NOT NULL DEFAULT 0,
    "total_tokens" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "memory_pools_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- Phase 4: Verification + Evidence + Dependencies
-- ============================================================================

CREATE TABLE IF NOT EXISTS "verification_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "memory_id" UUID NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "source_department_id" INTEGER,
    "target_department_id" INTEGER,
    "status" "VerificationStatus" NOT NULL DEFAULT 'pending',
    "verifier_agent_id" VARCHAR(255),
    "verification_result" JSONB,
    "score_impact" DECIMAL(5,2),
    "priority" INTEGER NOT NULL DEFAULT 0,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    CONSTRAINT "verification_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "evidence" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "memory_id" UUID NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "evidence_type" "EvidenceType" NOT NULL,
    "source_url" TEXT,
    "source_doi" VARCHAR(255),
    "title" VARCHAR(500),
    "description" TEXT,
    "claim_type" VARCHAR(50),
    "assumptions" JSONB,
    "unit" VARCHAR(50),
    "dimension" VARCHAR(50),
    "confidence" DECIMAL(3,2) NOT NULL DEFAULT 0.5,
    "peer_reviewed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" VARCHAR(255) NOT NULL,
    CONSTRAINT "evidence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "memory_dependencies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "source_memory_id" UUID NOT NULL,
    "depends_on_memory_id" UUID NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "dependency_type" "DependencyType" NOT NULL,
    "strength" DECIMAL(3,2) NOT NULL DEFAULT 0.5,
    "description" TEXT,
    "needs_revalidation" BOOLEAN NOT NULL DEFAULT false,
    "last_validated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" VARCHAR(255) NOT NULL,
    CONSTRAINT "memory_dependencies_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- Indexes
-- ============================================================================

-- Decisions
CREATE INDEX IF NOT EXISTS "decisions_organization_id_idx" ON "decisions"("organization_id");
CREATE INDEX IF NOT EXISTS "decisions_agent_id_idx" ON "decisions"("agent_id");
CREATE INDEX IF NOT EXISTS "decisions_department_id_idx" ON "decisions"("department_id");
CREATE INDEX IF NOT EXISTS "decisions_created_at_idx" ON "decisions"("created_at");
CREATE INDEX IF NOT EXISTS "decisions_outcome_verified_idx" ON "decisions"("outcome_verified");

-- Agent Reputations
CREATE INDEX IF NOT EXISTS "agent_reputations_organization_id_idx" ON "agent_reputations"("organization_id");
CREATE INDEX IF NOT EXISTS "agent_reputations_agent_id_idx" ON "agent_reputations"("agent_id");
CREATE INDEX IF NOT EXISTS "agent_reputations_overall_reputation_idx" ON "agent_reputations"("overall_reputation" DESC);
CREATE UNIQUE INDEX IF NOT EXISTS "agent_reputations_agent_id_organization_id_department_id_key" ON "agent_reputations"("agent_id", "organization_id", "department_id");

-- Memory Pools
CREATE INDEX IF NOT EXISTS "memory_pools_organization_id_idx" ON "memory_pools"("organization_id");
CREATE INDEX IF NOT EXISTS "memory_pools_pool_type_idx" ON "memory_pools"("pool_type");
CREATE UNIQUE INDEX IF NOT EXISTS "memory_pools_organization_id_pool_type_department_id_key" ON "memory_pools"("organization_id", "pool_type", "department_id");

-- Verification Requests
CREATE INDEX IF NOT EXISTS "verification_requests_organization_id_idx" ON "verification_requests"("organization_id");
CREATE INDEX IF NOT EXISTS "verification_requests_memory_id_idx" ON "verification_requests"("memory_id");
CREATE INDEX IF NOT EXISTS "verification_requests_status_idx" ON "verification_requests"("status");
CREATE INDEX IF NOT EXISTS "verification_requests_verifier_agent_id_idx" ON "verification_requests"("verifier_agent_id");
CREATE INDEX IF NOT EXISTS "verification_requests_target_department_id_idx" ON "verification_requests"("target_department_id");

-- Evidence
CREATE INDEX IF NOT EXISTS "evidence_memory_id_idx" ON "evidence"("memory_id");
CREATE INDEX IF NOT EXISTS "evidence_organization_id_idx" ON "evidence"("organization_id");
CREATE INDEX IF NOT EXISTS "evidence_evidence_type_idx" ON "evidence"("evidence_type");
CREATE INDEX IF NOT EXISTS "evidence_source_doi_idx" ON "evidence"("source_doi");

-- Memory Dependencies
CREATE INDEX IF NOT EXISTS "memory_dependencies_source_memory_id_idx" ON "memory_dependencies"("source_memory_id");
CREATE INDEX IF NOT EXISTS "memory_dependencies_depends_on_memory_id_idx" ON "memory_dependencies"("depends_on_memory_id");
CREATE INDEX IF NOT EXISTS "memory_dependencies_organization_id_idx" ON "memory_dependencies"("organization_id");
CREATE INDEX IF NOT EXISTS "memory_dependencies_needs_revalidation_idx" ON "memory_dependencies"("needs_revalidation");
CREATE UNIQUE INDEX IF NOT EXISTS "memory_dependencies_source_memory_id_depends_on_memory_id_d_key" ON "memory_dependencies"("source_memory_id", "depends_on_memory_id", "dependency_type");

-- ============================================================================
-- Foreign Keys (idempotent via DO blocks)
-- ============================================================================

DO $$ BEGIN
  ALTER TABLE "decisions" ADD CONSTRAINT "decisions_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "agent_reputations" ADD CONSTRAINT "agent_reputations_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "memory_pools" ADD CONSTRAINT "memory_pools_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "verification_requests" ADD CONSTRAINT "verification_requests_memory_id_fkey"
    FOREIGN KEY ("memory_id") REFERENCES "memory_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "verification_requests" ADD CONSTRAINT "verification_requests_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "evidence" ADD CONSTRAINT "evidence_memory_id_fkey"
    FOREIGN KEY ("memory_id") REFERENCES "memory_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "evidence" ADD CONSTRAINT "evidence_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "memory_dependencies" ADD CONSTRAINT "memory_dependencies_source_memory_id_fkey"
    FOREIGN KEY ("source_memory_id") REFERENCES "memory_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "memory_dependencies" ADD CONSTRAINT "memory_dependencies_depends_on_memory_id_fkey"
    FOREIGN KEY ("depends_on_memory_id") REFERENCES "memory_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "memory_dependencies" ADD CONSTRAINT "memory_dependencies_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- Fix: Add FK for resolution_memory_id on memory_conflicts
-- ============================================================================

DO $$ BEGIN
  ALTER TABLE "memory_conflicts" ADD CONSTRAINT "memory_conflicts_resolution_memory_id_fkey"
    FOREIGN KEY ("resolution_memory_id") REFERENCES "memory_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
