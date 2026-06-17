ALTER TABLE "CoopEvent"
  ADD COLUMN IF NOT EXISTS "googleDrivePacketFolderId" TEXT,
  ADD COLUMN IF NOT EXISTS "googleDrivePacketFolderUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "googleDrivePacketSyncedAt" TIMESTAMP(3);
