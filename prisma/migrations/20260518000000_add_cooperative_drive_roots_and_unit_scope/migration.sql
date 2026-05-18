ALTER TABLE "Unit" DROP CONSTRAINT IF EXISTS "Unit_number_key";

DROP INDEX IF EXISTS "Unit_number_key";

CREATE UNIQUE INDEX IF NOT EXISTS "Unit_cooperativeId_number_key"
  ON "Unit"("cooperativeId", "number");

CREATE TABLE IF NOT EXISTS "CooperativeDriveRoot" (
  "id" TEXT NOT NULL,
  "cooperativeId" TEXT NOT NULL,
  "folderId" TEXT NOT NULL,
  "displayName" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CooperativeDriveRoot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CooperativeDriveRoot_cooperativeId_folderId_key"
  ON "CooperativeDriveRoot"("cooperativeId", "folderId");

CREATE INDEX IF NOT EXISTS "CooperativeDriveRoot_cooperativeId_idx"
  ON "CooperativeDriveRoot"("cooperativeId");

CREATE INDEX IF NOT EXISTS "CooperativeDriveRoot_folderId_idx"
  ON "CooperativeDriveRoot"("folderId");

ALTER TABLE "CooperativeDriveRoot"
  DROP CONSTRAINT IF EXISTS "CooperativeDriveRoot_cooperativeId_fkey";

ALTER TABLE "CooperativeDriveRoot"
  ADD CONSTRAINT "CooperativeDriveRoot_cooperativeId_fkey"
  FOREIGN KEY ("cooperativeId") REFERENCES "Cooperative"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
