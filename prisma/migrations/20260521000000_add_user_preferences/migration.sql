CREATE TABLE IF NOT EXISTS "UserPreference" (
  "id" TEXT NOT NULL,
  "cooperativeId" TEXT NOT NULL,
  "userEmail" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserPreference_cooperativeId_userEmail_key_key"
  ON "UserPreference"("cooperativeId", "userEmail", "key");

CREATE INDEX IF NOT EXISTS "UserPreference_cooperativeId_idx"
  ON "UserPreference"("cooperativeId");

CREATE INDEX IF NOT EXISTS "UserPreference_userEmail_idx"
  ON "UserPreference"("userEmail");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'UserPreference_cooperativeId_fkey'
  ) THEN
    ALTER TABLE "UserPreference"
      ADD CONSTRAINT "UserPreference_cooperativeId_fkey"
      FOREIGN KEY ("cooperativeId") REFERENCES "Cooperative"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
