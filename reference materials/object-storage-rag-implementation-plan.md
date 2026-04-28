# Object Storage + RAG Implementation Plan

## Goal

Move all site documents into Vercel Blob object storage and build a RAG pipeline so Policy Assistant can answer questions using uploaded, linked, generated, and archived co-op documents.

Assumptions:

- File storage: Vercel Blob
- LLM/document understanding: Gemini API
- Embeddings: Gemini embeddings
- App database remains the system of record for document metadata, ingestion state, chunks, and permissions

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

## 2. Data Model Changes

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
  isActive           Boolean @default(true)

  createdAt          DateTime @default(now())

  @@index([cooperativeId])
  @@index([documentId])
  @@index([documentVersionId])
  @@index([isActive])
}
```

If the production database supports `pgvector`, replace `embedding Json` with a vector column. If not, store JSON first and upgrade later.

### DocumentIngestionJob

Optional but helpful for reliability.

```prisma
model DocumentIngestionJob {
  id                String @id @default(uuid())
  documentId         String
  documentVersionId  String
  cooperativeId      String

  status             String // queued | processing | complete | failed
  attempts           Int @default(0)
  error              String?

  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
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
7. Mark old chunks inactive.

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
- Mark old chunks inactive after new ingestion succeeds, or immediately depending on preference.

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

Admin/internal only.

Responsibilities:

- Retrieve current version.
- Extract text.
- Chunk text.
- Generate embeddings.
- Save chunks.
- Update ingestion status.

Could also be run automatically from document upload routes.

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

Chunking strategy:

- 700-1,000 tokens per chunk
- 100-150 token overlap
- Preserve headings where possible
- Include metadata prefix for better retrieval

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

### Step 5: Activation

When replacing a document:

- Create new version.
- Ingest new chunks.
- Mark old chunks inactive.
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
5. Select top 5-10 chunks.
6. Send context to Gemini.
7. Ask Gemini to answer using provided context and cite sources.

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
  }[];
}
```

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
- Allow opening cited document.
- Possibly show "context used" expandable panel.

## 8. Security And Permissions

All retrieval must filter by `cooperativeId`.

Never retrieve chunks across cooperatives.

Future permission layers:

- Admin-only documents
- Committee-private documents
- Member-visible documents
- Guest-visible documents

Add fields eventually:

```prisma
visibility String // admin | committee | members | public
```

RAG retrieval should honor this field.

## 9. Rollout Phases

### Phase 1: Blob Storage

- Add `DocumentVersion`.
- Upload files/minutes PDFs to Vercel Blob.
- Stop storing base64 PDFs in `Document.url`.
- Store Blob URL instead.
- Keep existing Document Library UI mostly unchanged.

Deliverable:

- All new files use object storage.

### Phase 2: Ingestion Status

- Add ingestion fields.
- Create ingestion route/service.
- Extract text from uploaded/generated documents.
- Store extracted text and summaries.
- Show ingestion status in UI.

Deliverable:

- Documents are digested, but Policy Assistant may still use broad text context.

### Phase 3: Embeddings And Chunks

- Add `DocumentChunk`.
- Chunk extracted text.
- Generate Gemini embeddings.
- Store embeddings.
- Mark old chunks inactive on replacement.

Deliverable:

- Searchable document knowledge base.

### Phase 4: Policy Assistant RAG

- Embed user question.
- Retrieve relevant chunks.
- Send citations/context to Gemini.
- Display cited sources.

Deliverable:

- Policy Assistant answers with document-grounded context.

### Phase 5: Hardening

- Background queue/retry support.
- Version history UI.
- Re-ingestion controls.
- Better OCR/scanned PDF handling.
- Admin visibility controls.
- Retrieval analytics.

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

Hybrid. Keep original Drive link, but export/copy an indexed snapshot into Blob so RAG remains stable even if Drive permissions or content changes.

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
5. Add `ingestionStatus = pending`.
6. Display storage/status in Document Library.

Then proceed to extraction and embeddings.
