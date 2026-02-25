-- Link workflows to workspaces (nullable FK for backward compat)
ALTER TABLE "workflows" ADD COLUMN "workspace_id" VARCHAR(32);

-- Foreign key constraint
ALTER TABLE "workflows"
  ADD CONSTRAINT "workflows_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Index for efficient queries by workspace
CREATE INDEX "workflows_workspace_id_idx" ON "workflows"("workspace_id");
