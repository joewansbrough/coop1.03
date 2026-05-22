ALTER TABLE "Cooperative"
  ADD COLUMN IF NOT EXISTS "subdomain" TEXT,
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'ONBOARDING',
  ADD COLUMN IF NOT EXISTS "onboardingState" TEXT NOT NULL DEFAULT 'SETUP',
  ADD COLUMN IF NOT EXISTS "settings" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "launchedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "suspendedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "Cooperative_subdomain_key"
  ON "Cooperative"("subdomain")
  WHERE "subdomain" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "Cooperative_status_idx"
  ON "Cooperative"("status");

CREATE INDEX IF NOT EXISTS "Cooperative_onboardingState_idx"
  ON "Cooperative"("onboardingState");
