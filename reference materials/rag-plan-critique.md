# RAG Implementation Plan - Critique and Improvements

## Strengths

**Solid architecture foundation**: The separation of `Document` (logical record) from `DocumentVersion` (physical files) is exactly right. This pattern supports versioning cleanly and prevents the common mistake of coupling metadata to file changes.

**Practical phasing**: Starting with Blob storage migration before tackling RAG complexity is smart. Each phase delivers incremental value and reduces risk.

**Security-first thinking**: Cooperative isolation and permission filtering are baked into the data model from the start rather than bolted on later.

## Critical Issues

### 1. **Missing Chunk Deduplication Strategy**

When you replace a document version, you're marking old chunks `isActive = false` but keeping them forever. For a co-op with 20 years of meeting minutes, this means thousands of obsolete chunks polluting your database.

**Problem**: Your retrieval query will still scan inactive chunks (slower queries), and storage costs grow unbounded.

**Fix**: Add a cleanup strategy:

```prisma
model DocumentChunk {
  // ... existing fields
  isActive      Boolean @default(true)
  replacedAt    DateTime?
  replacedBy    String? // references new chunk batch
  
  @@index([cooperativeId, isActive]) // crucial composite index
}
```

Then either:
- **Hard delete** inactive chunks after 30-90 days
- **Soft archive** to a separate `DocumentChunkArchive` table
- **Prune on version threshold** (keep only last N versions)

### 2. **Ingestion Job Lacks Retry Logic**

`DocumentIngestionJob.attempts` exists but you haven't specified retry behavior. Gemini API calls can fail transiently.

**Add**:
```prisma
model DocumentIngestionJob {
  // ... existing fields
  attempts      Int @default(0)
  maxAttempts   Int @default(3)
  nextRetryAt   DateTime?
  lastError     String?
  errorStack    Json?
}
```

**Implement exponential backoff**: 1min → 5min → 30min

### 3. **Chunking Strategy Too Generic**

Your 700-1000 token chunks with overlap will work but miss document-specific optimizations:

- **Meeting minutes**: Natural boundaries are agenda items, motions, decisions
- **Policies**: Section headers and numbered clauses
- **Bylaws**: Articles and subsections

**Improvement**: Use semantic chunking based on document type:

```typescript
interface ChunkingStrategy {
  bylaw: (text: string) => Chunk[]; // Split on "Article N", "Section N.N"
  minutes: (structured: MinutesData) => Chunk[]; // One chunk per agenda item
  policy: (text: string) => Chunk[]; // Preserve H2/H3 structure
  generic: (text: string) => Chunk[]; // Fallback fixed-size
}
```

This produces more coherent retrieval results. A question about "pet deposits" should retrieve the entire pet policy section, not a 700-token fragment mid-paragraph.

### 4. **Embedding Model Lock-In**

You're hardcoding Gemini embeddings. If Google changes their model or you want to A/B test alternatives, you'll need to re-embed everything.

**Add version tracking**:
```prisma
model DocumentChunk {
  // ... existing
  embeddingModel    String // "gemini-embedding-001"
  embeddingVersion  String // "2024-04-15"
  
  @@index([embeddingModel, embeddingVersion])
}
```

This lets you:
- Test new models side-by-side
- Gradually migrate embeddings
- Debug model-specific retrieval issues

### 5. **Missing Similarity Search Details**

You mention "search chunks by vector similarity" but don't specify:
- Similarity metric (cosine? L2?)
- Score threshold (what's "similar enough"?)
- Re-ranking strategy (do you post-filter by recency, category, etc.?)

**Specify**:
```typescript
interface RetrievalConfig {
  similarityMetric: 'cosine' | 'l2';
  minScore: number; // e.g., 0.7 for cosine
  topK: number; // retrieve top 20, then re-rank to 5
  reranking: {
    boostRecent: boolean; // prefer docs from last 2 years
    categoryWeight: number; // prefer docs matching question category
  };
}
```

### 6. **No Fallback for Gemini Failures**

If Gemini document understanding fails during ingestion, you mark status `failed` but don't specify a fallback path.

**Add graceful degradation**:
1. Try Gemini vision/multimodal
2. Fall back to local PDF text extraction (pdf-parse, Tesseract for OCR)
3. Fall back to storing file without indexing (mark `ingestion_skipped`)

Don't block document storage on AI availability.

### 7. **Context Window Management**

Your prompt will inject 5-10 chunks. At 700-1000 tokens each, that's **7,000-10,000 tokens of context** before the user question. Gemini Pro's context limit is 32k tokens, but you're using 30%+ just for retrieval.

**Problems**:
- Long conversations hit limits quickly
- Retrieval quality degrades if you truncate chunks
- Token costs scale with every query

**Improvements**:
- **Adaptive retrieval**: Start with top 3 chunks, expand to 10 only if confidence is low
- **Chunk compression**: Summarize each chunk to 200 tokens before injecting (trade quality for capacity)
- **Two-stage retrieval**: Retrieve 20 candidates, re-rank by cross-encoder, inject top 5

### 8. **No Evaluation Metrics**

How will you know if RAG is working? You need:

**Retrieval metrics**:
- Precision@K (are retrieved chunks relevant?)
- Recall (are we finding the right documents?)
- Mean Reciprocal Rank (is the best chunk ranked first?)

**Generation metrics**:
- Faithfulness (does answer match retrieved context?)
- Citation accuracy (do citations point to correct chunks?)
- User satisfaction (thumbs up/down)

**Add**:
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
}
```

Track every query to measure and improve retrieval quality.

## Architectural Improvements

### 9. **Separate Ingestion Service**

You're planning to run ingestion as API routes. This creates problems:

- **Timeouts**: Vercel functions timeout at 10s (Hobby) / 60s (Pro). PDF extraction + chunking + embedding 50 chunks = 90+ seconds
- **Cold starts**: Ingestion will be slow and unreliable
- **Cost**: Serverless function duration charges

**Better**: Dedicated worker service (Vercel Cron, Inngest, BullMQ, or Railway background worker)

Workflow:
1. Upload endpoint creates `DocumentIngestionJob` with status `queued`
2. Worker polls for `queued` jobs every minute
3. Worker processes job, updates status
4. UI polls job status or uses webhooks

### 10. **Google Drive Sync Ambiguity**

You mention "hybrid" approach (keep Drive link + export snapshot) but don't specify:
- **Sync frequency**: How often do you re-export Drive files?
- **Change detection**: How do you know if Drive file changed?
- **Permissions**: What if Drive doc becomes private?

**Recommendation**: Don't automatically sync Drive files. Instead:
- Store Drive link as reference
- On initial link, export snapshot and ingest
- Add manual "Refresh from Drive" button
- Show "Last synced: 14 days ago" indicator

Automatic sync risks ingesting documents users deleted from Drive or no longer have access to.

### 11. **Citation UX Gap**

Your response shape includes `chunkId` and `pageNumber`, but you haven't specified how users navigate to citations.

**Add**:
```typescript
{
  citations: [{
    documentId: string;
    documentTitle: string;
    chunkId: string;
    pageNumber?: number;
    highlightText: string; // 50 chars of matching text
    blobUrl: string; // deep link to PDF page
  }]
}
```

Then in UI:
- Clicking citation opens PDF viewer at `pageNumber`
- Highlight the relevant text snippet
- Show "View full document" link

Without this, citations are just decorative.

## Data Model Refinements

### 12. **Add Document Metadata Fields**

You're missing fields that will be useful for filtering and display:

```prisma
model Document {
  // ... existing
  
  // Lifecycle
  status         String @default("active") // active | archived | superseded
  effectiveDate  DateTime? // when policy takes effect
  expiryDate     DateTime? // when policy expires
  reviewDate     DateTime? // when policy needs review
  
  // Relationships
  supersedes     String? // previous document ID
  supersededBy   String? // newer document ID
  relatedDocs    String[] @default([]) // cross-references
  
  // Searchability
  keywords       String[] @default([])
  fullTextSearch String? // denormalized for Postgres full-text search
}
```

This enables:
- "Show me active policies"
- "What policies need review this quarter?"
- "Find all documents related to parking"

### 13. **Track Ingestion Metadata**

```prisma
model DocumentVersion {
  // ... existing
  
  ingestionStartedAt   DateTime?
  ingestionCompletedAt DateTime?
  ingestionDurationMs  Int?
  
  extractionMethod     String? // gemini | pdf-parse | ocr | structured
  extractionConfidence Float? // 0-1 score
  
  chunkCount           Int?
  tokenCount           Int?
}
```

This helps you:
- Debug slow ingestions
- Compare extraction quality across methods
- Estimate costs (tokens × chunk count)

## Security Enhancements

### 14. **Add Permission Model Now**

Don't wait for "Future permission layers". The schema changes required will be painful to migrate later.

**Add immediately**:
```prisma
enum DocumentVisibility {
  PUBLIC      // anyone can view
  MEMBERS     // authenticated co-op members
  COMMITTEE   // specific committee only
  BOARD       // board members only
  ADMIN       // admins only
}

model Document {
  // ... existing
  visibility      DocumentVisibility @default(MEMBERS)
  committeeAccess String? // references committee if visibility = COMMITTEE
}
```

Then enforce in retrieval:
```typescript
const chunks = await prisma.documentChunk.findMany({
  where: {
    cooperativeId: user.cooperativeId,
    isActive: true,
    document: {
      OR: [
        { visibility: 'PUBLIC' },
        { visibility: 'MEMBERS', AND: user.isMember },
        { visibility: 'BOARD', AND: user.isBoard },
        // ... etc
      ]
    }
  }
});
```

### 15. **Audit Logging**

Track who accessed what:

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

This is important for:
- Compliance (who saw confidential documents?)
- Debugging (why is AI citing archived policies?)
- Analytics (which documents are most useful?)

## Implementation Recommendations

### First Slice Refinement

Your suggested first slice is good but add one more step:

1. Blob storage migration ✓
2. `DocumentVersion` ✓
3. Update minutes PDF endpoint ✓
4. **Add ingestion job creation** (even if it does nothing yet)
5. Display status in UI ✓

This ensures your data model supports async processing from day one, even if processing is a no-op initially.

### Testing Strategy (Missing)

Before rolling out each phase:

**Unit tests**:
- Chunking produces expected boundaries
- Embedding storage/retrieval roundtrips correctly
- Permission filtering blocks unauthorized access

**Integration tests**:
- Upload → ingest → retrieve pipeline
- Version replacement marks old chunks inactive
- Gemini API failures don't block storage

**Evaluation dataset**:
Create 20 test questions with known correct documents:
- "What is the pet deposit amount?" → Pet Policy 2026, page 3
- "When was the AGM held?" → AGM Minutes 2026, page 1

Measure retrieval precision before and after changes.

## Final Recommendations

**High priority (do before Phase 1)**:
1. Add permission model to schema now
2. Specify retry logic for ingestion jobs
3. Plan chunk cleanup strategy
4. Add document status/lifecycle fields

**Medium priority (do during Phase 3)**:
5. Implement semantic chunking by document type
6. Add embedding model versioning
7. Track ingestion performance metrics
8. Build evaluation harness

**Low priority (Phase 5+)**:
9. Advanced re-ranking algorithms
10. Multi-language support
11. Document change detection/diffing

**Overall**: This is a well-thought-out plan. The main gaps are operational (retry logic, monitoring, cleanup) rather than architectural. With the improvements above, you'll have a production-ready RAG system that scales beyond the first co-op.
