-- Core document versioning and RAG tables required before Drive metadata links.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StorageProvider') THEN
    CREATE TYPE "StorageProvider" AS ENUM ('LOCAL', 'VERCEL_BLOB', 'GOOGLE_DRIVE', 'EXTERNAL_LINK');
  END IF;
END $$;

ALTER TABLE "Document"
  ADD COLUMN IF NOT EXISTS "currentVersionId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Document_currentVersionId_key"
  ON "Document"("currentVersionId")
  WHERE "currentVersionId" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "DocumentVersion" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "cooperativeId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "source" TEXT NOT NULL,
  "storageProvider" "StorageProvider" NOT NULL DEFAULT 'EXTERNAL_LINK',
  "sourceExternalId" TEXT,
  "sourceFolderId" TEXT,
  "sourceWebUrl" TEXT,
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
  "ragStatus" TEXT NOT NULL DEFAULT 'not_indexed',
  "ragStoreName" TEXT,
  "ragDocumentName" TEXT,
  "ragIndexedAt" TIMESTAMP(3),
  "ragIndexError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DocumentVersion_documentId_version_key"
  ON "DocumentVersion"("documentId", "version");

CREATE INDEX IF NOT EXISTS "DocumentVersion_cooperativeId_idx"
  ON "DocumentVersion"("cooperativeId");

CREATE INDEX IF NOT EXISTS "DocumentVersion_documentId_idx"
  ON "DocumentVersion"("documentId");

CREATE INDEX IF NOT EXISTS "DocumentVersion_ingestionStatus_idx"
  ON "DocumentVersion"("ingestionStatus");

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

CREATE INDEX IF NOT EXISTS "DocumentIngestionJob_cooperativeId_idx"
  ON "DocumentIngestionJob"("cooperativeId");

CREATE INDEX IF NOT EXISTS "DocumentIngestionJob_status_nextRetryAt_idx"
  ON "DocumentIngestionJob"("status", "nextRetryAt");

CREATE INDEX IF NOT EXISTS "DocumentIngestionJob_documentVersionId_idx"
  ON "DocumentIngestionJob"("documentVersionId");

CREATE TABLE IF NOT EXISTS "RagStore" (
  "id" TEXT NOT NULL,
  "cooperativeId" TEXT,
  "scope" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "geminiStoreName" TEXT NOT NULL,
  "embeddingModel" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RagStore_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RagStore_geminiStoreName_key"
  ON "RagStore"("geminiStoreName");

CREATE UNIQUE INDEX IF NOT EXISTS "RagStore_cooperativeId_scope_key"
  ON "RagStore"("cooperativeId", "scope");

CREATE UNIQUE INDEX IF NOT EXISTS "RagStore_shared_scope_key"
  ON "RagStore"("scope")
  WHERE "cooperativeId" IS NULL;

CREATE INDEX IF NOT EXISTS "RagStore_cooperativeId_idx"
  ON "RagStore"("cooperativeId");

CREATE INDEX IF NOT EXISTS "RagStore_scope_idx"
  ON "RagStore"("scope");
