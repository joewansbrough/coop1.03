-- Enable pgvector extension (already done above, but idempotent)
CREATE EXTENSION IF NOT EXISTS vector;

-- DocumentChunk table for RAG
CREATE TABLE "DocumentChunk" (
    "id"         TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "coopId"     TEXT NOT NULL DEFAULT 'default',
    "content"    TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "embedding"  vector(768),
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentChunk_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DocumentChunk_documentId_fkey"
        FOREIGN KEY ("documentId") REFERENCES "Document"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

-- IVFFlat index for fast approximate nearest-neighbor search
-- (requires at least ~100 rows to be effective; safe to create empty)
CREATE INDEX "DocumentChunk_embedding_idx"
    ON "DocumentChunk"
    USING ivfflat ("embedding" vector_cosine_ops)
    WITH (lists = 100);

-- Index for filtering by coopId (multi-tenant isolation)
CREATE INDEX "DocumentChunk_coopId_idx" ON "DocumentChunk"("coopId");

-- Index for joining back to Document
CREATE INDEX "DocumentChunk_documentId_idx" ON "DocumentChunk"("documentId");