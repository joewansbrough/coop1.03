-- Native RBAC, document access rules, and drive-backed document metadata.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'GroupType') THEN
    CREATE TYPE "GroupType" AS ENUM ('SYSTEM', 'BOARD', 'COMMITTEE', 'CHAIR', 'ADMIN', 'MEMBER', 'CONTRACTOR', 'CUSTOM');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MembershipSource') THEN
    CREATE TYPE "MembershipSource" AS ENUM ('MANUAL', 'GOOGLE_SYNC', 'SYSTEM', 'IMPORT');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PermissionEffect') THEN
    CREATE TYPE "PermissionEffect" AS ENUM ('ALLOW', 'DENY');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DocumentAccessLevel') THEN
    CREATE TYPE "DocumentAccessLevel" AS ENUM ('VIEW', 'COMMENT', 'EDIT', 'MANAGE');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StorageProvider') THEN
    CREATE TYPE "StorageProvider" AS ENUM ('LOCAL', 'VERCEL_BLOB', 'GOOGLE_DRIVE', 'EXTERNAL_LINK');
  END IF;
END $$;

ALTER TYPE "DocumentVisibility" ADD VALUE IF NOT EXISTS 'CUSTOM';
ALTER TYPE "DocumentVisibility" ADD VALUE IF NOT EXISTS 'PRIVATE';

ALTER TABLE "Document"
  ADD COLUMN IF NOT EXISTS "ownerUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "storageProvider" "StorageProvider" NOT NULL DEFAULT 'EXTERNAL_LINK',
  ADD COLUMN IF NOT EXISTS "sourceExternalId" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceFolderId" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceWebUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceMimeType" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceModifiedAt" TIMESTAMP(3);

ALTER TABLE "DocumentVersion"
  ADD COLUMN IF NOT EXISTS "storageProvider" "StorageProvider" NOT NULL DEFAULT 'EXTERNAL_LINK',
  ADD COLUMN IF NOT EXISTS "sourceExternalId" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceFolderId" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceWebUrl" TEXT;

CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT NOT NULL,
  "cooperativeId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT,
  "firstName" TEXT,
  "lastName" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "isSystemAdmin" BOOLEAN NOT NULL DEFAULT false,
  "lastLoginAt" TIMESTAMP(3),
  "tenantId" TEXT,
  "googleSubjectId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Group" (
  "id" TEXT NOT NULL,
  "cooperativeId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "type" "GroupType" NOT NULL,
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "committeeId" TEXT,
  "googleGroupId" TEXT,
  "googleGroupEmail" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Membership" (
  "id" TEXT NOT NULL,
  "cooperativeId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "source" "MembershipSource" NOT NULL DEFAULT 'MANUAL',
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Permission" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT NOT NULL,
  "isSystem" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "GroupPermission" (
  "id" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "permissionId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GroupPermission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "UserPermissionOverride" (
  "id" TEXT NOT NULL,
  "cooperativeId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "permissionId" TEXT NOT NULL,
  "effect" "PermissionEffect" NOT NULL,
  "reason" TEXT,
  "expiresAt" TIMESTAMP(3),
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserPermissionOverride_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "DocumentAccessRule" (
  "id" TEXT NOT NULL,
  "cooperativeId" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "groupId" TEXT,
  "userId" TEXT,
  "permission" "DocumentAccessLevel" NOT NULL,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentAccessRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id" TEXT NOT NULL,
  "cooperativeId" TEXT NOT NULL,
  "actorUserId" TEXT,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "before" JSONB,
  "after" JSONB,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MagicLinkToken" (
  "id" TEXT NOT NULL,
  "cooperativeId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MagicLinkToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "User_cooperativeId_email_key" ON "User"("cooperativeId", "email");
CREATE UNIQUE INDEX IF NOT EXISTS "User_tenantId_key" ON "User"("tenantId");
CREATE INDEX IF NOT EXISTS "User_cooperativeId_idx" ON "User"("cooperativeId");
CREATE INDEX IF NOT EXISTS "User_email_idx" ON "User"("email");

CREATE UNIQUE INDEX IF NOT EXISTS "Group_cooperativeId_slug_key" ON "Group"("cooperativeId", "slug");
CREATE INDEX IF NOT EXISTS "Group_cooperativeId_idx" ON "Group"("cooperativeId");
CREATE INDEX IF NOT EXISTS "Group_committeeId_idx" ON "Group"("committeeId");

CREATE UNIQUE INDEX IF NOT EXISTS "Membership_userId_groupId_key" ON "Membership"("userId", "groupId");
CREATE INDEX IF NOT EXISTS "Membership_cooperativeId_idx" ON "Membership"("cooperativeId");
CREATE INDEX IF NOT EXISTS "Membership_groupId_idx" ON "Membership"("groupId");

CREATE UNIQUE INDEX IF NOT EXISTS "Permission_key_key" ON "Permission"("key");
CREATE UNIQUE INDEX IF NOT EXISTS "GroupPermission_groupId_permissionId_key" ON "GroupPermission"("groupId", "permissionId");

CREATE INDEX IF NOT EXISTS "UserPermissionOverride_cooperativeId_idx" ON "UserPermissionOverride"("cooperativeId");
CREATE INDEX IF NOT EXISTS "UserPermissionOverride_userId_idx" ON "UserPermissionOverride"("userId");

CREATE INDEX IF NOT EXISTS "DocumentAccessRule_cooperativeId_idx" ON "DocumentAccessRule"("cooperativeId");
CREATE INDEX IF NOT EXISTS "DocumentAccessRule_documentId_idx" ON "DocumentAccessRule"("documentId");
CREATE INDEX IF NOT EXISTS "DocumentAccessRule_groupId_idx" ON "DocumentAccessRule"("groupId");
CREATE INDEX IF NOT EXISTS "DocumentAccessRule_userId_idx" ON "DocumentAccessRule"("userId");

CREATE INDEX IF NOT EXISTS "AuditLog_cooperativeId_idx" ON "AuditLog"("cooperativeId");
CREATE INDEX IF NOT EXISTS "AuditLog_actorUserId_idx" ON "AuditLog"("actorUserId");
CREATE INDEX IF NOT EXISTS "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "MagicLinkToken_tokenHash_key" ON "MagicLinkToken"("tokenHash");
CREATE INDEX IF NOT EXISTS "MagicLinkToken_cooperativeId_idx" ON "MagicLinkToken"("cooperativeId");
CREATE INDEX IF NOT EXISTS "MagicLinkToken_email_idx" ON "MagicLinkToken"("email");
CREATE INDEX IF NOT EXISTS "MagicLinkToken_expiresAt_idx" ON "MagicLinkToken"("expiresAt");

DO $$
BEGIN
  ALTER TABLE "User" ADD CONSTRAINT "User_cooperativeId_fkey" FOREIGN KEY ("cooperativeId") REFERENCES "Cooperative"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "Group" ADD CONSTRAINT "Group_cooperativeId_fkey" FOREIGN KEY ("cooperativeId") REFERENCES "Cooperative"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "Group" ADD CONSTRAINT "Group_committeeId_fkey" FOREIGN KEY ("committeeId") REFERENCES "Committee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "Membership" ADD CONSTRAINT "Membership_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "GroupPermission" ADD CONSTRAINT "GroupPermission_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "GroupPermission" ADD CONSTRAINT "GroupPermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "UserPermissionOverride" ADD CONSTRAINT "UserPermissionOverride_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "UserPermissionOverride" ADD CONSTRAINT "UserPermissionOverride_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "DocumentAccessRule" ADD CONSTRAINT "DocumentAccessRule_cooperativeId_fkey" FOREIGN KEY ("cooperativeId") REFERENCES "Cooperative"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "DocumentAccessRule" ADD CONSTRAINT "DocumentAccessRule_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "DocumentAccessRule" ADD CONSTRAINT "DocumentAccessRule_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "DocumentAccessRule" ADD CONSTRAINT "DocumentAccessRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_cooperativeId_fkey" FOREIGN KEY ("cooperativeId") REFERENCES "Cooperative"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
