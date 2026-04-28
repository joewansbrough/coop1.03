# Object Storage + RAG Implementation Plan

## Goal

Move all site documents into Vercel Blob object storage and build a RAG pipeline so Policy Assistant can answer questions using uploaded, linked, generated, and archived co-op documents.

Assumptions:

- File storage: Vercel Blob
- LLM/document understanding: Gemini API
- Embeddings: Gemini embeddings
- App database remains the system of record for document metadata, ingestion state, chunks, and permissions
- Ingestion runs asynchronously through a worker or scheduled processor, not as a long-running user-facing request

## 1. Target Architecture

### Document Flow

1. User uploads, links, creates, or generates a document.
2. File bytes are stored in Vercel Blob.
3. A `Document` database record stores metadata and Blob URL.
4. An ingestion job extracts or summarizes text.
5. Extracted text is chunked.
6. Gemini embeddings are generated for each chunk.
7. Chunks and embeddings are stored in the database.
8. Policy Assistant retrieves relevant chunks before answering.

### High-Level Components

- `Document`: Metadata record shown in the Document Library.
- `DocumentVersion`: Tracks each uploaded/generated file version.
- `DocumentChunk`: Stores extracted text chunks and vector embeddings.
- `DocumentIngestionJob`: Tracks async ingestion status.
- `Policy Assistant Retrieval`: Searches relevant chunks, injects context into Gemini, and returns cited answers.
- `PolicyAssistantQuery`: Logs retrieval/generation quality, latency, citations, and user feedback.
- `DocumentAccessLog`: Audits document views, downloads, and AI citations.

## 2. Data Model Changes

### Enums

Add explicit lifecycle and permission values early so retrieval does not need a painful migration later.

```prisma
enum DocumentVisibility {
  PUBLIC
  MEMBERS
  COMMITTEE
  BOARD
  ADMIN
}

enum DocumentStatus {
  ACTIVE
  ARCHIVED
  SUPERSEDED
}
```

### Document

Current `Document` should become a stable logical record.

```prisma
model Document {
  id            String   @id @default(uuid())
  cooperativeId String
  title         String
  category      String
  committee     String?
  author        String
  date          DateTime
  tags          String[] @default([])
  content       String?

  status          DocumentStatus @default(ACTIVE)
  visibility      DocumentVisibility @default(MEMBERS)
  committeeAccess String?

  effectiveDate DateTime?
  expiryDate    DateTime?
  reviewDate    DateTime?

  supersedes   String?
  supersededBy String?
  relatedDocs  String[] @default([])
  keywords     String[] @default([])

  fullTextSearch String?

  currentVersionId String?
  currentVersion   DocumentVersion? @relation("CurrentDocumentVersion", fields: [currentVersionId], references: [id])

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### DocumentVersion

Represents one stored file.

```prisma
model DocumentVersion {
  id            String   @id @default(uuid())
  documentId    String
  document      Document @relation(fields: [documentId], references: [id], onDelete: Cascade)

  cooperativeId String
  version       Int
  source        String   // upload | google-drive | generated-minutes | manual
  storageUrl    String
  storageKey    String?
  fileType      String
  mimeType      String?
  sizeBytes     Int?
  checksum      String?

  ingestionStatus String // pending | processing | ready | failed
  ingestionError  String?
  ingestionStartedAt   DateTime?
  ingestionCompletedAt DateTime?
  ingestionDurationMs  Int?

  extractionMethod     String? // structured | gemini | pdf-parse | ocr | skipped
  extractionConfidence Float?
  chunkCount           Int?
  tokenCount           Int?

  extractedText   String?
  summary         String?

  createdAt DateTime @default(now())
}
```

### DocumentChunk

Stores searchable RAG units.

```prisma
model DocumentChunk {
  id                String @id @default(uuid())
  documentId         String
  documentVersionId  String
  cooperativeId      String

  chunkIndex         Int
  text               String
  tokenEstimate      Int?

  category           String?
  committee          String?
  tags               String[] @default([])
  pageNumber         Int?

  embedding          Json
  embeddingModel     String
  embeddingVersion   String
  isActive           Boolean @default(true)
  replacedAt         DateTime?
  replacedByBatchId  String?
  chunkBatchId       String

  createdAt          DateTime @default(now())

  @@index([cooperativeId])
  @@index([cooperativeId, isActive])
  @@index([documentId])
  @@index([documentVersionId])
  @@index([isActive])
  @@index([embeddingModel, embeddingVersion])
}
```

If the production database supports `pgvector`, replace `embedding Json` with a vector column. If not, store JSON first and upgrade later.

Inactive chunks should not live forever. Keep inactive chunks for a short rollback window, then either hard delete after 30-90 days or archive them to a separate table. For this app, start with "keep the current version plus one previous version, prune older inactive chunks nightly" unless a co-op explicitly requires long-term RAG history.

### DocumentIngestionJob

Required for reliability. Uploads should create a queued job even before the real ingestion worker exists.

```prisma
model DocumentIngestionJob {
  id                String @id @default(uuid())
  documentId         String
  documentVersionId  String
  cooperativeId      String

  status             String // queued | processing | complete | failed
  attempts           Int @default(0)
  maxAttempts        Int @default(3)
  nextRetryAt        DateTime?
  error              String?
  errorStack         Json?

  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
}
```

Retry behavior:

- Attempt 1 immediately.
- Attempt 2 after 1 minute.
- Attempt 3 after 5 minutes.
- Final retry after 30 minutes if `maxAttempts` is raised for a specific job.
- Store the last error and extraction stage so admins can distinguish API failures from bad files.

### PolicyAssistantQuery

Log every RAG response so retrieval quality can be evaluated and improved.

```prisma
model PolicyAssistantQuery {
  id              String @id @default(uuid())
  cooperativeId   String
  userId          String
  question        String
  retrievedChunks Json
  answer          String
  citations       Json
  userFeedback    String? // helpful | not_helpful
  feedbackReason  String?
  latencyMs       Int
  createdAt       DateTime @default(now())

  @@index([cooperativeId, createdAt])
  @@index([userId, createdAt])
}
```

### DocumentAccessLog

Audit document access and AI citation events.

```prisma
model DocumentAccessLog {
  id           String @id @default(uuid())
  documentId   String
  userId       String
  action       String // viewed | downloaded | cited_in_ai_response
  ipAddress    String?
  userAgent    String?
  createdAt    DateTime @default(now())

  @@index([documentId, createdAt])
  @@index([userId, createdAt])
}
```

## 3. Storage Strategy

### Vercel Blob Paths

Use predictable names:

```txt
coops/{cooperativeId}/documents/{documentId}/v{version}/{safeFileName}
coops/{cooperativeId}/minutes/{meetingId}/minutes-v{version}.pdf
```

### Generated Meeting Minutes

When minutes are finalized:

1. Generate PDF in browser or server.
2. Upload PDF to Vercel Blob.
3. Upsert one `Document` record for the meeting.
4. Create a new `DocumentVersion`.
5. Set `Document.currentVersionId`.
6. Queue ingestion.
7. After replacement ingestion succeeds, mark old chunks inactive and record the replacing chunk batch.

Important: keep the same `Document.id` for the meeting minutes record. Only versions change.

## 4. API Changes

### Upload Document

```http
POST /api/documents/upload
```

Responsibilities:

- Accept file upload.
- Upload file to Vercel Blob.
- Create `Document`.
- Create `DocumentVersion`.
- Queue ingestion.
- Return updated document.

### Replace Document Version

```http
POST /api/documents/:id/version
```

Responsibilities:

- Upload replacement file.
- Increment version number.
- Update `currentVersionId`.
- Queue ingestion.
- Mark old chunks inactive only after new ingestion succeeds.

### Archive Minutes PDF

Replace current base64 storage route:

```http
POST /api/minutes/:meetingId/library-pdf
```

New behavior:

- Accept PDF blob or base64 payload.
- Upload to Vercel Blob.
- Find existing `Document` by stable meeting tag.
- Create or update `Document`.
- Create new `DocumentVersion`.
- Queue ingestion.

### Ingestion Endpoint

```http
POST /api/documents/:id/ingest
```

Admin/internal only. This route should enqueue or claim work; it should not do long PDF extraction and embedding inside a user-facing request.

Responsibilities:

- Retrieve current version.
- Extract text.
- Chunk text.
- Generate embeddings.
- Save chunks.
- Update ingestion status.

The actual processing should run in a worker: Vercel Cron polling queued jobs, Inngest, BullMQ, or a small Railway/background worker. The minimum viable version can be a cron-triggered route that claims a small batch of queued jobs and respects function timeout limits.

### Policy Assistant Query

```http
POST /api/ai/policy
```

Enhanced behavior:

- Embed user question.
- Retrieve top matching chunks filtered by cooperative/user permissions.
- Send question + retrieved context to Gemini.
- Return answer with citations.

## 5. Ingestion Pipeline

### Step 1: Text Extraction

By file source/type:

- Generated minutes: use structured minutes data if available, plus PDF text if needed.
- Uploaded PDF: first use local PDF text extraction. If extraction is weak or empty, use Gemini document understanding.
- Google Drive docs: prefer Drive export to text/PDF where available. Then ingest exported content.
- Images/scanned PDFs: use Gemini document understanding/OCR.

Fallback order:

1. Use structured source data when available.
2. Use local text extraction for PDFs and supported office formats.
3. Use Gemini multimodal/document understanding.
4. Use OCR for scanned files.
5. Store the file without indexing and mark `extractionMethod = "skipped"` if all extraction fails.

Document storage must succeed even when AI extraction is unavailable. Failed ingestion should affect search readiness, not whether the co-op can keep the file.

### Step 2: Gemini Document Understanding

Use Gemini to produce:

- extracted text
- short summary
- suggested tags
- document category
- key policies/procedures
- important dates, obligations, permissions, restrictions

Store summary on `DocumentVersion.summary`.

Do not rely only on summary for RAG. Store real extracted chunks too.

### Step 3: Chunking

Use semantic chunking by document type before falling back to fixed token windows:

- Meeting minutes: chunk by agenda item, motion, decision, and action item.
- Bylaws: chunk by article and section.
- Policies: chunk by heading/subheading and numbered clause.
- Generic documents: 700-1,000 tokens per chunk with 100-150 token overlap.
- Always preserve headings and include a metadata prefix for better retrieval.

Example chunk text:

```txt
Document: Pet Policy 2026
Category: Policy
Committee: Board
Section: Pets and Animals

Residents may keep...
```

### Step 4: Embeddings

Use Gemini embeddings for:

- each `DocumentChunk.text`
- user question at query time

Store embedding vector with chunk.

Always store `embeddingModel` and `embeddingVersion` on each chunk. This allows model upgrades, side-by-side evaluation, and selective re-embedding without losing the old index.

### Step 5: Activation

When replacing a document:

- Create new version.
- Ingest new chunks.
- Mark old chunks inactive only after the new chunk batch is ready.
- Set `replacedAt` and `replacedByBatchId` on the old chunks.
- Keep the previous active batch for rollback, then prune older inactive chunks on a schedule.
- Mark new version `ready`.

This prevents Policy Assistant from citing stale minutes or outdated policies.

## 6. Retrieval Design

### Query-Time Flow

1. User asks Policy Assistant a question.
2. Generate embedding for the question.
3. Search chunks by vector similarity.
4. Filter by:
   - `cooperativeId`
   - `isActive = true`
   - document permissions
   - optional committee/category filters
5. Retrieve the top 20 candidate chunks.
6. Re-rank candidates by similarity score, document recency, category match, and permission confidence.
7. Start with the top 3-5 chunks in the prompt, expanding only when confidence is low.
8. Send context to Gemini.
9. Ask Gemini to answer using provided context and cite sources.

Retrieval configuration:

```ts
interface RetrievalConfig {
  similarityMetric: 'cosine';
  minScore: number; // start around 0.7 and tune with evaluation data
  candidateK: number; // retrieve 20
  contextK: number; // inject 3-5 by default
  maxContextTokens: number;
  reranking: {
    boostRecent: boolean;
    categoryWeight: number;
    exactTitleWeight: number;
  };
}
```

If `pgvector` is available, use cosine distance for embedding search. If embeddings are stored as JSON during the first slice, keep the corpus small and move vector search to `pgvector` before broad production use.

Context-window management:

- Prefer fewer, higher-confidence chunks over 10 large chunks.
- Compress or summarize long chunks only after preserving the original chunk text for citation.
- If no chunk clears `minScore`, answer that the document library did not contain enough supporting context.
- Track selected chunk IDs and scores in `PolicyAssistantQuery.retrievedChunks`.

### Prompt Shape

```txt
You are the Policy Assistant for this housing co-op.
Answer using the provided document context when relevant.
If the answer is not supported by context, say what is missing and suggest who to contact.

Context:
[1] Document: Pet Policy 2026
Category: Policy
Excerpt: ...

[2] Document: AGM Minutes 2026
Category: Minutes
Excerpt: ...

Question:
...
```

### Response Shape

```ts
{
  answer: string;
  citations: {
    documentId: string;
    documentTitle: string;
    chunkId: string;
    pageNumber?: number;
    highlightText: string;
    blobUrl: string;
    score: number;
  }[];
}
```

Citation UX should be functional, not decorative:

- Clicking a citation opens the stored document.
- For PDFs, open the viewer at `pageNumber` when available.
- Show the matching `highlightText` next to each citation.
- Record `DocumentAccessLog.action = "cited_in_ai_response"` for cited documents.

## 7. UI Changes

### Document Library

Add ingestion indicators:

- `Processing`
- `Ready for AI`
- `Failed`
- `Re-ingest`

Document card should show:

- storage source
- category
- committee
- ingestion status
- current version
- last indexed date

### Document Review Portal

Add:

- file metadata
- version history
- extracted summary
- re-ingest button
- "Included in Policy Assistant" toggle if desired

### Minutes Editor

On finalize:

- Save minutes data.
- Generate PDF.
- Upload PDF to Blob.
- Update Document Library record.
- Trigger ingestion.
- Show status:
  - "Minutes saved"
  - "PDF archived"
  - "AI indexing queued"

### Policy Assistant

Enhance answer UI:

- Show cited documents.
- Allow opening cited document at the cited page when possible.
- Show a short matching text highlight for each citation.
- Add helpful/not helpful feedback controls.
- Possibly show "context used" expandable panel.

## 8. Security And Permissions

All retrieval must filter by `cooperativeId`.

Never retrieve chunks across cooperatives.

Add permission layers now, not later:

- `PUBLIC`: visible to guests or public site users if that exists.
- `MEMBERS`: visible to authenticated co-op members.
- `COMMITTEE`: visible only to the selected committee.
- `BOARD`: visible only to board roles.
- `ADMIN`: visible only to admins.

Required fields:

```prisma
visibility      DocumentVisibility @default(MEMBERS)
committeeAccess String?
```

RAG retrieval must honor these fields before similarity ranking. Do not retrieve a chunk first and filter permissions afterward in application code if the database query can apply the restriction.

Example permission filter:

```ts
const permissionFilter = {
  OR: [
    { visibility: 'PUBLIC' },
    { visibility: 'MEMBERS', cooperativeId: user.cooperativeId },
    user.isBoard ? { visibility: 'BOARD' } : undefined,
    user.isAdmin ? { visibility: 'ADMIN' } : undefined,
    user.committeeIds.length > 0
      ? { visibility: 'COMMITTEE', committeeAccess: { in: user.committeeIds } }
      : undefined,
  ].filter(Boolean),
};
```

Also audit:

- direct document views
- downloads
- citations in Policy Assistant answers
- re-ingestion and replacement actions

## 9. Rollout Phases

### Phase 1: Blob Storage

- Add `DocumentVersion`.
- Add `DocumentVisibility`, document lifecycle fields, and basic permission enforcement.
- Upload files/minutes PDFs to Vercel Blob.
- Stop storing base64 PDFs in `Document.url`.
- Store Blob URL instead.
- Create a no-op `DocumentIngestionJob` with `queued` status when a new version is created.
- Keep existing Document Library UI mostly unchanged.

Deliverable:

- All new files use object storage.

### Phase 2: Ingestion Status

- Add retry-ready ingestion fields.
- Create ingestion route and worker/cron processor.
- Extract text from uploaded/generated documents.
- Store extracted text and summaries.
- Show ingestion status in UI.
- Implement graceful degradation when Gemini or local extraction fails.

Deliverable:

- Documents are digested, but Policy Assistant may still use broad text context.

### Phase 3: Embeddings And Chunks

- Add `DocumentChunk`.
- Chunk extracted text using semantic strategies by document type.
- Generate Gemini embeddings.
- Store embeddings.
- Store embedding model/version.
- Mark old chunks inactive after replacement ingestion succeeds.
- Add scheduled pruning of old inactive chunks.

Deliverable:

- Searchable document knowledge base.

### Phase 4: Policy Assistant RAG

- Embed user question.
- Retrieve, filter, and re-rank relevant chunks.
- Send citations/context to Gemini.
- Display cited sources.
- Log query quality, latency, citations, and feedback.

Deliverable:

- Policy Assistant answers with document-grounded context.

### Phase 5: Hardening

- Version history UI.
- Re-ingestion controls.
- Better OCR/scanned PDF handling.
- Retrieval analytics.
- Evaluation harness and quality dashboard.
- Optional advanced re-ranking.

## 10. Key Decisions Needed

### Decision 1: Vector Storage

Options:

- Existing Postgres with `pgvector`
- Store embeddings as JSON initially
- External vector DB

Recommendation:

Start with Postgres/pgvector if available. If not, JSON can work for a small co-op corpus, but pgvector is the right production target.

### Decision 2: Ingestion Timing

Options:

- Synchronous during upload/save
- Async background job
- Hybrid: save immediately, ingest after

Recommendation:

Hybrid. Save the file immediately, mark as `pending`, then ingest asynchronously or via a follow-up API call.

### Decision 3: Source Of Truth For Minutes

Options:

- PDF only
- Structured minutes data only
- Both

Recommendation:

Both. Use structured minutes data for cleaner ingestion and store the PDF as the official artifact.

### Decision 4: Google Drive Files

Options:

- Store only Drive links
- Copy/export Drive files into Blob
- Hybrid

Recommendation:

Hybrid, but manual refresh only. Keep original Drive link, export/copy an indexed snapshot into Blob on initial link, and show "Last synced" in the UI. Add a manual "Refresh from Drive" button later. Avoid automatic sync until permissions and deletion semantics are clearly understood.

### Decision 5: Replacing Files

Options:

- Overwrite same Blob path
- Versioned Blob path with current pointer

Recommendation:

Versioned Blob paths. Never overwrite bytes in place; update the current version pointer.

## 11. Suggested First Implementation Slice

Implement the smallest useful slice:

1. Replace base64 minutes PDF storage with Vercel Blob upload.
2. Add `DocumentVersion`.
3. Update `/api/minutes/:meetingId/library-pdf`.
4. Store Blob URL on the version/current document.
5. Add document visibility/lifecycle defaults.
6. Create a queued `DocumentIngestionJob` even if the worker is still a no-op.
7. Add `ingestionStatus = pending`.
8. Display storage/status in Document Library.

Then proceed to extraction and embeddings.

## 12. Testing And Evaluation

### Unit Tests

- Chunking respects minutes agenda items, bylaw articles/sections, and policy headings.
- Replacement only deactivates old chunks after a new chunk batch is ready.
- Retry scheduling sets `attempts`, `nextRetryAt`, and terminal failure state correctly.
- Permission filtering blocks unauthorized document chunks.

### Integration Tests

- Upload to Blob creates `Document`, `DocumentVersion`, and queued `DocumentIngestionJob`.
- Minutes finalization stores the official PDF in Blob and keeps a stable `Document.id`.
- Ingestion failure does not block file storage.
- Upload -> ingest -> retrieve returns only chunks from the user's cooperative and allowed visibility scope.

### Evaluation Dataset

Create at least 20 representative questions with expected source documents and page/section references. Examples:

- "What is the pet deposit amount?" -> Pet Policy, pets/deposits section.
- "When was the AGM held?" -> AGM minutes, meeting metadata.
- "Who approves parking exceptions?" -> Parking policy, exceptions section.

Track:

- retrieval precision at K
- whether the expected document appears in top K
- citation accuracy
- answer faithfulness to cited context
- user helpful/not helpful feedback
