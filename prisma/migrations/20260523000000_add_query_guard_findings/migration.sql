CREATE TABLE IF NOT EXISTS "QueryGuardFinding" (
  "id" TEXT NOT NULL,
  "cooperativeId" TEXT,
  "model" TEXT,
  "action" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "environment" TEXT,
  "argsSummary" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "resolutionNote" TEXT,

  CONSTRAINT "QueryGuardFinding_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "QueryGuardFinding_cooperativeId_idx" ON "QueryGuardFinding"("cooperativeId");
CREATE INDEX IF NOT EXISTS "QueryGuardFinding_model_action_idx" ON "QueryGuardFinding"("model", "action");
CREATE INDEX IF NOT EXISTS "QueryGuardFinding_environment_idx" ON "QueryGuardFinding"("environment");
CREATE INDEX IF NOT EXISTS "QueryGuardFinding_createdAt_idx" ON "QueryGuardFinding"("createdAt");
CREATE INDEX IF NOT EXISTS "QueryGuardFinding_resolvedAt_idx" ON "QueryGuardFinding"("resolvedAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'QueryGuardFinding_cooperativeId_fkey'
  ) THEN
    ALTER TABLE "QueryGuardFinding"
      ADD CONSTRAINT "QueryGuardFinding_cooperativeId_fkey"
      FOREIGN KEY ("cooperativeId") REFERENCES "Cooperative"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
