import type { PrismaClient } from '@prisma/client';

let documentRagSchemaPromise: Promise<void> | null = null;
let dashboardPreferenceSchemaPromise: Promise<void> | null = null;
let policyAssistantQuerySchemaPromise: Promise<void> | null = null;
let userPreferenceSchemaPromise: Promise<void> | null = null;

export const resetSchemaRepairCacheForTests = () => {
  documentRagSchemaPromise = null;
  dashboardPreferenceSchemaPromise = null;
  policyAssistantQuerySchemaPromise = null;
  userPreferenceSchemaPromise = null;
};

export const ensureDashboardPreferenceSchema = async (prisma: PrismaClient) => {
  dashboardPreferenceSchemaPromise ||= (async () => {
    await (prisma as any).$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "DashboardPreference" (
        "id" TEXT NOT NULL,
        "cooperativeId" TEXT NOT NULL,
        "userEmail" TEXT NOT NULL,
        "layout" JSONB NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "DashboardPreference_pkey" PRIMARY KEY ("id")
      );
    `);
    await (prisma as any).$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "DashboardPreference_cooperativeId_userEmail_key" ON "DashboardPreference"("cooperativeId", "userEmail");`);
    await (prisma as any).$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "DashboardPreference_cooperativeId_idx" ON "DashboardPreference"("cooperativeId");`);
  })();

  return dashboardPreferenceSchemaPromise;
};

export const ensureUserPreferenceSchema = async (prisma: PrismaClient) => {
  userPreferenceSchemaPromise ||= (async () => {
    await (prisma as any).$executeRawUnsafe(`
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
    `);
    await (prisma as any).$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "UserPreference_cooperativeId_userEmail_key_key" ON "UserPreference"("cooperativeId", "userEmail", "key");`);
    await (prisma as any).$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "UserPreference_cooperativeId_idx" ON "UserPreference"("cooperativeId");`);
    await (prisma as any).$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "UserPreference_userEmail_idx" ON "UserPreference"("userEmail");`);
  })();

  return userPreferenceSchemaPromise;
};

export const ensureDocumentRagSchema = async (prisma: PrismaClient) => {
  documentRagSchemaPromise ||= (async () => {
    await (prisma as any).$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StorageProvider') THEN
          CREATE TYPE "StorageProvider" AS ENUM ('LOCAL', 'VERCEL_BLOB', 'GOOGLE_DRIVE', 'EXTERNAL_LINK');
        END IF;
      END $$;
    `);

    await (prisma as any).$executeRawUnsafe(`ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "currentVersionId" TEXT;`);
    await (prisma as any).$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Document_currentVersionId_key" ON "Document"("currentVersionId") WHERE "currentVersionId" IS NOT NULL;`);

    await (prisma as any).$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "DocumentVersion" (
        "id" TEXT NOT NULL,
        "documentId" TEXT NOT NULL,
        "cooperativeId" TEXT NOT NULL,
        "version" INTEGER NOT NULL,
        "source" TEXT NOT NULL,
        "storageUrl" TEXT NOT NULL,
        "storageKey" TEXT,
        "fileType" TEXT NOT NULL,
        "mimeType" TEXT,
        "sizeBytes" INTEGER,
        "checksum" TEXT,
        "ingestionStatus" TEXT NOT NULL DEFAULT 'pending',
        "ingestionError" TEXT,
        "ingestionStartedAt" TIMESTAMP(3),
        "ingestionCompletedAt" TIMESTAMP(3),
        "ingestionDurationMs" INTEGER,
        "extractionMethod" TEXT,
        "extractionConfidence" DOUBLE PRECISION,
        "chunkCount" INTEGER,
        "tokenCount" INTEGER,
        "extractedText" TEXT,
        "summary" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "DocumentVersion_pkey" PRIMARY KEY ("id")
      );
    `);

    await (prisma as any).$executeRawUnsafe(`ALTER TABLE "DocumentVersion" ADD COLUMN IF NOT EXISTS "storageProvider" "StorageProvider" NOT NULL DEFAULT 'EXTERNAL_LINK';`);
    await (prisma as any).$executeRawUnsafe(`ALTER TABLE "DocumentVersion" ADD COLUMN IF NOT EXISTS "sourceExternalId" TEXT;`);
    await (prisma as any).$executeRawUnsafe(`ALTER TABLE "DocumentVersion" ADD COLUMN IF NOT EXISTS "sourceFolderId" TEXT;`);
    await (prisma as any).$executeRawUnsafe(`ALTER TABLE "DocumentVersion" ADD COLUMN IF NOT EXISTS "sourceWebUrl" TEXT;`);
    await (prisma as any).$executeRawUnsafe(`ALTER TABLE "DocumentVersion" ADD COLUMN IF NOT EXISTS "ragStatus" TEXT NOT NULL DEFAULT 'not_indexed';`);
    await (prisma as any).$executeRawUnsafe(`ALTER TABLE "DocumentVersion" ADD COLUMN IF NOT EXISTS "ragStoreName" TEXT;`);
    await (prisma as any).$executeRawUnsafe(`ALTER TABLE "DocumentVersion" ADD COLUMN IF NOT EXISTS "ragDocumentName" TEXT;`);
    await (prisma as any).$executeRawUnsafe(`ALTER TABLE "DocumentVersion" ADD COLUMN IF NOT EXISTS "ragIndexedAt" TIMESTAMP(3);`);
    await (prisma as any).$executeRawUnsafe(`ALTER TABLE "DocumentVersion" ADD COLUMN IF NOT EXISTS "ragIndexError" TEXT;`);
    await (prisma as any).$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "DocumentVersion_documentId_version_key" ON "DocumentVersion"("documentId", "version");`);
    await (prisma as any).$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "DocumentVersion_cooperativeId_idx" ON "DocumentVersion"("cooperativeId");`);
    await (prisma as any).$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "DocumentVersion_documentId_idx" ON "DocumentVersion"("documentId");`);
    await (prisma as any).$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "DocumentVersion_ingestionStatus_idx" ON "DocumentVersion"("ingestionStatus");`);

    await (prisma as any).$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "DocumentIngestionJob" (
        "id" TEXT NOT NULL,
        "documentId" TEXT NOT NULL,
        "documentVersionId" TEXT NOT NULL,
        "cooperativeId" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'queued',
        "attempts" INTEGER NOT NULL DEFAULT 0,
        "maxAttempts" INTEGER NOT NULL DEFAULT 3,
        "nextRetryAt" TIMESTAMP(3),
        "error" TEXT,
        "errorStack" JSONB,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "DocumentIngestionJob_pkey" PRIMARY KEY ("id")
      );
    `);
    await (prisma as any).$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "DocumentIngestionJob_cooperativeId_idx" ON "DocumentIngestionJob"("cooperativeId");`);
    await (prisma as any).$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "DocumentIngestionJob_status_nextRetryAt_idx" ON "DocumentIngestionJob"("status", "nextRetryAt");`);
    await (prisma as any).$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "DocumentIngestionJob_documentVersionId_idx" ON "DocumentIngestionJob"("documentVersionId");`);
  })();

  return documentRagSchemaPromise;
};

export const ensurePolicyAssistantQuerySchema = async (prisma: PrismaClient) => {
  policyAssistantQuerySchemaPromise ||= (async () => {
    await (prisma as any).$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "PolicyAssistantQuery" (
        "id" TEXT NOT NULL,
        "cooperativeId" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "question" TEXT NOT NULL,
        "retrievedChunks" JSONB NOT NULL,
        "answer" TEXT NOT NULL,
        "citations" JSONB NOT NULL,
        "language" TEXT NOT NULL DEFAULT 'English',
        "intent" TEXT NOT NULL DEFAULT 'policy',
        "suggestedAction" JSONB,
        "userFeedback" TEXT,
        "feedback" TEXT,
        "feedbackReason" TEXT,
        "latencyMs" INTEGER NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PolicyAssistantQuery_pkey" PRIMARY KEY ("id")
      );
    `);
    await (prisma as any).$executeRawUnsafe(`ALTER TABLE "PolicyAssistantQuery" ADD COLUMN IF NOT EXISTS "language" TEXT NOT NULL DEFAULT 'English';`);
    await (prisma as any).$executeRawUnsafe(`ALTER TABLE "PolicyAssistantQuery" ADD COLUMN IF NOT EXISTS "intent" TEXT NOT NULL DEFAULT 'policy';`);
    await (prisma as any).$executeRawUnsafe(`ALTER TABLE "PolicyAssistantQuery" ADD COLUMN IF NOT EXISTS "suggestedAction" JSONB;`);
    await (prisma as any).$executeRawUnsafe(`ALTER TABLE "PolicyAssistantQuery" ADD COLUMN IF NOT EXISTS "userFeedback" TEXT;`);
    await (prisma as any).$executeRawUnsafe(`ALTER TABLE "PolicyAssistantQuery" ADD COLUMN IF NOT EXISTS "feedback" TEXT;`);
    await (prisma as any).$executeRawUnsafe(`ALTER TABLE "PolicyAssistantQuery" ADD COLUMN IF NOT EXISTS "feedbackReason" TEXT;`);
    await (prisma as any).$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PolicyAssistantQuery_cooperativeId_createdAt_idx" ON "PolicyAssistantQuery"("cooperativeId", "createdAt");`);
    await (prisma as any).$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PolicyAssistantQuery_userId_createdAt_idx" ON "PolicyAssistantQuery"("userId", "createdAt");`);
  })();

  return policyAssistantQuerySchemaPromise;
};
