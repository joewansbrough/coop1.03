ALTER TABLE "Cooperative" ADD COLUMN IF NOT EXISTS "subdomain" TEXT;
ALTER TABLE "Cooperative" ADD COLUMN IF NOT EXISTS "googleWorkspaceDomain" TEXT;
ALTER TABLE "Cooperative" ADD COLUMN IF NOT EXISTS "googleDriveRootFolderIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Cooperative" ADD COLUMN IF NOT EXISTS "plan" TEXT NOT NULL DEFAULT 'starter';
ALTER TABLE "Cooperative" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "Cooperative" ADD COLUMN IF NOT EXISTS "onboardingState" TEXT NOT NULL DEFAULT 'live';
ALTER TABLE "Cooperative" ADD COLUMN IF NOT EXISTS "settings" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "Cooperative" ADD COLUMN IF NOT EXISTS "onboardedAt" TIMESTAMP(3);
ALTER TABLE "Cooperative" ADD COLUMN IF NOT EXISTS "abandonedAt" TIMESTAMP(3);
ALTER TABLE "Cooperative" ADD COLUMN IF NOT EXISTS "suspendedAt" TIMESTAMP(3);
ALTER TABLE "Cooperative" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);
ALTER TABLE "Cooperative" ADD COLUMN IF NOT EXISTS "retentionEndsAt" TIMESTAMP(3);

UPDATE "Cooperative"
SET "subdomain" = COALESCE("subdomain", "slug"),
    "status" = COALESCE("status", 'active'),
    "onboardingState" = COALESCE("onboardingState", 'live');

CREATE UNIQUE INDEX IF NOT EXISTS "Cooperative_subdomain_key" ON "Cooperative"("subdomain");

DROP INDEX IF EXISTS "Tenant_email_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Tenant_cooperativeId_email_key" ON "Tenant"("cooperativeId", "email");
CREATE INDEX IF NOT EXISTS "Tenant_cooperativeId_idx" ON "Tenant"("cooperativeId");

DROP INDEX IF EXISTS "Unit_number_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Unit_cooperativeId_number_key" ON "Unit"("cooperativeId", "number");
CREATE INDEX IF NOT EXISTS "Unit_cooperativeId_idx" ON "Unit"("cooperativeId");
