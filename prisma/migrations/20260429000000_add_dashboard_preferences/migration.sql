CREATE TABLE IF NOT EXISTS "DashboardPreference" (
  "id" TEXT NOT NULL,
  "cooperativeId" TEXT NOT NULL,
  "userEmail" TEXT NOT NULL,
  "layout" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DashboardPreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DashboardPreference_cooperativeId_userEmail_key"
  ON "DashboardPreference"("cooperativeId", "userEmail");

CREATE INDEX IF NOT EXISTS "DashboardPreference_cooperativeId_idx"
  ON "DashboardPreference"("cooperativeId");

ALTER TABLE "DashboardPreference"
  ADD CONSTRAINT "DashboardPreference_cooperativeId_fkey"
  FOREIGN KEY ("cooperativeId") REFERENCES "Cooperative"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
