# Gemini File Search RAG Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an admin-only Gemini File Search validation slice that indexes Drive-backed co-op documents, queries them with a shared provincial knowledge store, and shows grounded answers with citations.

**Architecture:** Google Drive remains the source of truth for co-op files. Gemini File Search owns chunking, embeddings, retrieval, and grounding. coopHUB stores metadata, RAG status, and Gemini store/document references, with one `coop_documents` store per co-op plus one shared `province_common` store.

**Tech Stack:** TypeScript, Express, Prisma, React, Vite, `@google/genai`, Google Drive API, existing coopHUB RBAC utilities.

---

## File Structure

- Modify `prisma/schema.prisma`: add `RagStore` and RAG fields on `DocumentVersion`.
- Modify `api/index.ts`: add migration SQL for new RAG fields/store and mount admin-only RAG routes.
- Create `services/ragTypes.ts`: shared RAG status, citation, and store scope types.
- Create `services/geminiFileSearchClient.ts`: isolated `@google/genai` client factory and config checks.
- Create `services/ragStore.ts`: resolve or create co-op and shared Gemini File Search stores.
- Create `services/ragDriveDownload.ts`: download Drive files to temporary files and clean them up.
- Create `services/ragCitation.ts`: normalize Gemini grounding/citation data into UI-safe source cards.
- Create `services/ragIndexing.ts`: index a Drive-backed `DocumentVersion` into Gemini File Search.
- Create `services/ragAsk.ts`: ask Gemini using the co-op and shared File Search stores.
- Modify `types.ts`: expose current-version RAG fields and add UI citation/answer types.
- Modify `pages/ResourceLibrary.tsx`: add admin-only ask panel, status badge, and index/retry action.
- Create tests in `tests/ragCitation.test.ts`, `tests/ragStore.test.ts`, and `tests/ragRequestValidation.test.ts`.

---

### Task 1: Schema And Migration State

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `api/index.ts`
- Test: `npx prisma validate`

- [ ] **Step 1: Add RAG fields to `DocumentVersion`**

In `prisma/schema.prisma`, add these fields to `model DocumentVersion` after `summary String?`:

```prisma
  ragStatus       String    @default("not_indexed")
  ragStoreName    String?
  ragDocumentName String?
  ragIndexedAt    DateTime?
  ragIndexError   String?
```

- [ ] **Step 2: Add `RagStore` model**

In `prisma/schema.prisma`, add this model near `PolicyAssistantQuery`:

```prisma
model RagStore {
  id              String   @id @default(uuid())
  cooperativeId   String?
  cooperative     Cooperative? @relation(fields: [cooperativeId], references: [id], onDelete: Cascade)
  scope           String
  displayName     String
  geminiStoreName String   @unique
  embeddingModel  String
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([cooperativeId, scope])
  @@index([cooperativeId])
  @@index([scope])
}
```

Also add this relation to `model Cooperative`:

```prisma
  ragStores            RagStore[]
```

- [ ] **Step 3: Add robust SQL migration fallback**

In `api/index.ts`, inside `/api/migrate` near existing document schema migration statements, add:

```ts
    await p.$executeRawUnsafe(`ALTER TABLE "DocumentVersion" ADD COLUMN IF NOT EXISTS "ragStatus" TEXT NOT NULL DEFAULT 'not_indexed';`);
    await p.$executeRawUnsafe(`ALTER TABLE "DocumentVersion" ADD COLUMN IF NOT EXISTS "ragStoreName" TEXT;`);
    await p.$executeRawUnsafe(`ALTER TABLE "DocumentVersion" ADD COLUMN IF NOT EXISTS "ragDocumentName" TEXT;`);
    await p.$executeRawUnsafe(`ALTER TABLE "DocumentVersion" ADD COLUMN IF NOT EXISTS "ragIndexedAt" TIMESTAMP(3);`);
    await p.$executeRawUnsafe(`ALTER TABLE "DocumentVersion" ADD COLUMN IF NOT EXISTS "ragIndexError" TEXT;`);
    await p.$executeRawUnsafe(`
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
    `);
    await p.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "RagStore_geminiStoreName_key" ON "RagStore"("geminiStoreName");`);
    await p.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "RagStore_cooperativeId_scope_key" ON "RagStore"("cooperativeId", "scope");`);
    await p.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "RagStore_cooperativeId_idx" ON "RagStore"("cooperativeId");`);
    await p.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "RagStore_scope_idx" ON "RagStore"("scope");`);
```

- [ ] **Step 4: Validate Prisma schema**

Run:

```bash
npx prisma validate
```

Expected: schema validates successfully.

- [ ] **Step 5: Generate Prisma client**

Run:

```bash
npx prisma generate
```

Expected: Prisma Client generated successfully.

- [ ] **Step 6: Commit schema work**

```bash
git add prisma/schema.prisma api/index.ts
git commit -m "feat: add rag schema state"
```

---

### Task 2: RAG Types And Citation Normalization

**Files:**
- Create: `services/ragTypes.ts`
- Create: `services/ragCitation.ts`
- Create: `tests/ragCitation.test.ts`

- [ ] **Step 1: Write citation normalization tests**

Create `tests/ragCitation.test.ts`:

```ts
import assert from 'node:assert/strict';
import { normalizeGeminiCitations } from '../services/ragCitation.js';

const response = {
  candidates: [{
    groundingMetadata: {
      groundingChunks: [{
        retrievedContext: {
          title: 'Pet Policy.pdf',
          text: 'Members may keep approved pets.',
          uri: 'https://drive.google.com/file/d/example/view',
        },
      }],
      groundingSupports: [{
        segment: { text: 'Pets require approval.' },
        groundingChunkIndices: [0],
      }],
    },
  }],
};

const citations = normalizeGeminiCitations(response);

assert.equal(citations.length, 1);
assert.equal(citations[0].title, 'Pet Policy.pdf');
assert.equal(citations[0].text, 'Members may keep approved pets.');
assert.equal(citations[0].uri, 'https://drive.google.com/file/d/example/view');

console.log('ragCitation tests passed');
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx tsx tests/ragCitation.test.ts
```

Expected: fails because `services/ragCitation.ts` does not exist.

- [ ] **Step 3: Add shared RAG types**

Create `services/ragTypes.ts`:

```ts
export const RAG_STORE_SCOPES = {
  COOP_DOCUMENTS: 'coop_documents',
  PROVINCE_COMMON: 'province_common',
} as const;

export type RagStoreScope = typeof RAG_STORE_SCOPES[keyof typeof RAG_STORE_SCOPES];

export const RAG_STATUSES = {
  NOT_INDEXED: 'not_indexed',
  INDEXING: 'indexing',
  INDEXED: 'indexed',
  FAILED: 'failed',
  STALE: 'stale',
  DELETED: 'deleted',
} as const;

export type RagStatus = typeof RAG_STATUSES[keyof typeof RAG_STATUSES];

export type RagCitation = {
  title: string;
  text?: string;
  uri?: string;
  pageNumber?: number | null;
  documentId?: string | null;
  documentVersionId?: string | null;
  scope?: string | null;
  sourceSystem?: string | null;
};
```

- [ ] **Step 4: Implement citation normalization**

Create `services/ragCitation.ts`:

```ts
import type { RagCitation } from './ragTypes.js';

const asArray = <T>(value: T[] | undefined | null): T[] => Array.isArray(value) ? value : [];

const metadataValue = (metadata: any[] | undefined, key: string) => {
  const item = asArray(metadata).find((entry: any) => entry?.key === key);
  return item?.stringValue || item?.numericValue || null;
};

export const normalizeGeminiCitations = (response: any): RagCitation[] => {
  const chunks = asArray(response?.candidates?.[0]?.groundingMetadata?.groundingChunks);
  const seen = new Set<string>();

  return chunks
    .map((chunk: any): RagCitation | null => {
      const context = chunk?.retrievedContext || chunk?.web || chunk;
      const metadata = context?.customMetadata || chunk?.customMetadata;
      const title = String(context?.title || metadataValue(metadata, 'title') || 'Source document');
      const text = context?.text ? String(context.text) : undefined;
      const uri = context?.uri ? String(context.uri) : undefined;
      const pageRaw = metadataValue(metadata, 'pageNumber');
      const pageNumber = typeof pageRaw === 'number' ? pageRaw : pageRaw ? Number(pageRaw) : null;
      const documentId = metadataValue(metadata, 'documentId');
      const documentVersionId = metadataValue(metadata, 'documentVersionId');
      const scope = metadataValue(metadata, 'scope');
      const sourceSystem = metadataValue(metadata, 'sourceSystem');
      const key = `${title}|${uri || ''}|${documentId || ''}|${text || ''}`;

      if (seen.has(key)) return null;
      seen.add(key);

      return {
        title,
        text,
        uri,
        pageNumber: Number.isFinite(pageNumber) ? pageNumber : null,
        documentId: documentId ? String(documentId) : null,
        documentVersionId: documentVersionId ? String(documentVersionId) : null,
        scope: scope ? String(scope) : null,
        sourceSystem: sourceSystem ? String(sourceSystem) : null,
      };
    })
    .filter((citation): citation is RagCitation => Boolean(citation));
};
```

- [ ] **Step 5: Run citation test**

Run:

```bash
npx tsx tests/ragCitation.test.ts
```

Expected: `ragCitation tests passed`.

- [ ] **Step 6: Commit citation utilities**

```bash
git add services/ragTypes.ts services/ragCitation.ts tests/ragCitation.test.ts
git commit -m "feat: normalize rag citations"
```

---

### Task 3: Gemini Client And Store Resolver

**Files:**
- Create: `services/geminiFileSearchClient.ts`
- Create: `services/ragStore.ts`
- Create: `tests/ragStore.test.ts`

- [ ] **Step 1: Write store resolver tests**

Create `tests/ragStore.test.ts`:

```ts
import assert from 'node:assert/strict';
import { getAskStoreNamesFromResolvedStores, resolveEnvStoreOverrides } from '../services/ragStore.js';

const previousCoop = process.env.GEMINI_FILE_SEARCH_STORE_NAME;
const previousShared = process.env.GEMINI_PROVINCE_FILE_SEARCH_STORE_NAME;

process.env.GEMINI_FILE_SEARCH_STORE_NAME = 'fileSearchStores/coop-test';
process.env.GEMINI_PROVINCE_FILE_SEARCH_STORE_NAME = 'fileSearchStores/province-test';

const overrides = resolveEnvStoreOverrides('coop-1');
assert.equal(overrides.coop?.geminiStoreName, 'fileSearchStores/coop-test');
assert.equal(overrides.shared?.geminiStoreName, 'fileSearchStores/province-test');
assert.deepEqual(getAskStoreNamesFromResolvedStores(overrides), [
  'fileSearchStores/coop-test',
  'fileSearchStores/province-test',
]);

if (previousCoop === undefined) delete process.env.GEMINI_FILE_SEARCH_STORE_NAME;
else process.env.GEMINI_FILE_SEARCH_STORE_NAME = previousCoop;

if (previousShared === undefined) delete process.env.GEMINI_PROVINCE_FILE_SEARCH_STORE_NAME;
else process.env.GEMINI_PROVINCE_FILE_SEARCH_STORE_NAME = previousShared;

console.log('ragStore tests passed');
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx tsx tests/ragStore.test.ts
```

Expected: fails because `services/ragStore.ts` does not exist.

- [ ] **Step 3: Add Gemini File Search client**

Create `services/geminiFileSearchClient.ts`:

```ts
import { GoogleGenAI } from '@google/genai';

export const getGeminiApiKey = () => process.env.GEMINI_API_KEY || process.env.API_KEY || '';

export const getGeminiRagModel = () => process.env.GEMINI_RAG_MODEL || 'gemini-3.1-flash-lite';

export const getGeminiEmbeddingModel = () =>
  process.env.GEMINI_RAG_EMBEDDING_MODEL || 'models/gemini-embedding-2';

export const createGeminiFileSearchClient = () => {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY or API_KEY for Gemini File Search');
  }
  return new GoogleGenAI({ apiKey });
};
```

- [ ] **Step 4: Add store resolver**

Create `services/ragStore.ts`:

```ts
import type { PrismaClient } from '@prisma/client';
import { createGeminiFileSearchClient, getGeminiEmbeddingModel } from './geminiFileSearchClient.js';
import { RAG_STORE_SCOPES } from './ragTypes.js';

type ResolvedStore = {
  scope: string;
  cooperativeId: string | null;
  displayName: string;
  geminiStoreName: string;
  embeddingModel: string;
};

export const resolveEnvStoreOverrides = (cooperativeId: string): { coop?: ResolvedStore; shared?: ResolvedStore } => {
  const embeddingModel = getGeminiEmbeddingModel();
  return {
    coop: process.env.GEMINI_FILE_SEARCH_STORE_NAME ? {
      cooperativeId,
      scope: RAG_STORE_SCOPES.COOP_DOCUMENTS,
      displayName: 'coopHUB co-op documents',
      geminiStoreName: process.env.GEMINI_FILE_SEARCH_STORE_NAME,
      embeddingModel,
    } : undefined,
    shared: process.env.GEMINI_PROVINCE_FILE_SEARCH_STORE_NAME ? {
      cooperativeId: null,
      scope: RAG_STORE_SCOPES.PROVINCE_COMMON,
      displayName: 'coopHUB BC co-op references',
      geminiStoreName: process.env.GEMINI_PROVINCE_FILE_SEARCH_STORE_NAME,
      embeddingModel,
    } : undefined,
  };
};

export const getAskStoreNamesFromResolvedStores = (stores: { coop?: ResolvedStore; shared?: ResolvedStore }) =>
  [stores.coop?.geminiStoreName, stores.shared?.geminiStoreName].filter((name): name is string => Boolean(name));

const createGeminiStore = async (displayName: string) => {
  const ai = createGeminiFileSearchClient();
  const store = await ai.fileSearchStores.create({
    config: {
      displayName,
      embeddingModel: getGeminiEmbeddingModel(),
    },
  });
  if (!store.name) throw new Error('Gemini did not return a File Search store name');
  return store.name;
};

export const getOrCreateCoopRagStore = async (prisma: PrismaClient, cooperativeId: string): Promise<ResolvedStore> => {
  const env = resolveEnvStoreOverrides(cooperativeId).coop;
  if (env) return env;

  const existing = await (prisma as any).ragStore.findUnique({
    where: { cooperativeId_scope: { cooperativeId, scope: RAG_STORE_SCOPES.COOP_DOCUMENTS } },
  });
  if (existing) return existing;

  const displayName = `coopHUB-${cooperativeId}-documents`;
  const geminiStoreName = await createGeminiStore(displayName);
  return (prisma as any).ragStore.create({
    data: {
      cooperativeId,
      scope: RAG_STORE_SCOPES.COOP_DOCUMENTS,
      displayName,
      geminiStoreName,
      embeddingModel: getGeminiEmbeddingModel(),
    },
  });
};

export const getOrCreateSharedProvinceRagStore = async (prisma: PrismaClient): Promise<ResolvedStore> => {
  const env = resolveEnvStoreOverrides('shared').shared;
  if (env) return env;

  const existing = await (prisma as any).ragStore.findFirst({
    where: { cooperativeId: null, scope: RAG_STORE_SCOPES.PROVINCE_COMMON },
  });
  if (existing) return existing;

  const displayName = 'coopHUB BC co-op references';
  const geminiStoreName = await createGeminiStore(displayName);
  return (prisma as any).ragStore.create({
    data: {
      cooperativeId: null,
      scope: RAG_STORE_SCOPES.PROVINCE_COMMON,
      displayName,
      geminiStoreName,
      embeddingModel: getGeminiEmbeddingModel(),
    },
  });
};

export const getAskRagStores = async (prisma: PrismaClient, cooperativeId: string) => {
  const [coop, shared] = await Promise.all([
    getOrCreateCoopRagStore(prisma, cooperativeId),
    getOrCreateSharedProvinceRagStore(prisma),
  ]);
  return { coop, shared };
};
```

- [ ] **Step 5: Run store resolver test**

Run:

```bash
npx tsx tests/ragStore.test.ts
```

Expected: `ragStore tests passed`.

- [ ] **Step 6: Commit store resolver**

```bash
git add services/geminiFileSearchClient.ts services/ragStore.ts tests/ragStore.test.ts
git commit -m "feat: resolve gemini rag stores"
```

---

### Task 4: Drive Download And Indexing Service

**Files:**
- Create: `services/ragDriveDownload.ts`
- Create: `services/ragIndexing.ts`
- Modify: `api/index.ts`

- [ ] **Step 1: Add Drive temp download helper**

Create `services/ragDriveDownload.ts`:

```ts
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { driveClient } from './googleDrive.js';

const safeFilename = (filename: string) =>
  filename.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-').toLowerCase() || 'document';

export const downloadDriveFileToTemp = async (fileId: string, filename: string) => {
  const tempPath = path.join(os.tmpdir(), `${Date.now()}-${safeFilename(filename)}`);
  const drive = driveClient();
  const response = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'stream' },
  );
  await pipeline(response.data as any, fs.createWriteStream(tempPath));
  return tempPath;
};
```

- [ ] **Step 2: Add indexing service**

Create `services/ragIndexing.ts`:

```ts
import fs from 'node:fs/promises';
import type { PrismaClient } from '@prisma/client';
import { createGeminiFileSearchClient } from './geminiFileSearchClient.js';
import { downloadDriveFileToTemp } from './ragDriveDownload.js';
import { getOrCreateCoopRagStore } from './ragStore.js';
import { RAG_STATUSES } from './ragTypes.js';

const waitForOperation = async (ai: any, operation: any, timeoutMs = 120000) => {
  const startedAt = Date.now();
  let current = operation;
  while (!current.done) {
    if (Date.now() - startedAt > timeoutMs) throw new Error('Gemini File Search indexing timed out');
    await new Promise(resolve => setTimeout(resolve, 3000));
    current = await ai.operations.get({ operation: current });
  }
  return current;
};

export const indexDocumentVersionIntoGemini = async (
  prisma: PrismaClient,
  input: { cooperativeId: string; documentId: string },
) => {
  const document = await prisma.document.findFirst({
    where: { id: input.documentId, cooperativeId: input.cooperativeId },
    include: { currentVersion: true },
  });
  if (!document) throw new Error('Document not found');
  if (!document.currentVersion) throw new Error('Document has no current version');
  if ((document as any).storageProvider !== 'GOOGLE_DRIVE' && !(document as any).sourceExternalId) {
    throw new Error('Only Drive-backed documents can be indexed in this slice');
  }

  const version = document.currentVersion;
  const driveFileId = (document as any).sourceExternalId || (version as any).sourceExternalId;
  if (!driveFileId) throw new Error('Document has no Google Drive file ID');

  await prisma.documentVersion.update({
    where: { id: version.id },
    data: { ragStatus: RAG_STATUSES.INDEXING, ragIndexError: null },
  } as any);

  const store = await getOrCreateCoopRagStore(prisma, input.cooperativeId);
  const ai = createGeminiFileSearchClient();
  let tempPath = '';

  try {
    tempPath = await downloadDriveFileToTemp(driveFileId, document.title || version.storageUrl || document.id);
    const operation = await ai.fileSearchStores.uploadToFileSearchStore({
      file: tempPath,
      fileSearchStoreName: store.geminiStoreName,
      config: {
        displayName: document.title,
        customMetadata: [
          { key: 'cooperativeId', stringValue: input.cooperativeId },
          { key: 'documentId', stringValue: document.id },
          { key: 'documentVersionId', stringValue: version.id },
          { key: 'title', stringValue: document.title },
          { key: 'category', stringValue: document.category || '' },
          { key: 'visibility', stringValue: String((document as any).visibility || '') },
          { key: 'committee', stringValue: document.committee || '' },
          { key: 'driveFileId', stringValue: driveFileId },
          { key: 'driveFolderId', stringValue: (document as any).sourceFolderId || '' },
          { key: 'sourceSystem', stringValue: 'google-drive' },
        ],
      },
    });
    const completed = await waitForOperation(ai, operation);
    const ragDocumentName = completed?.response?.name || completed?.metadata?.name || null;
    const updatedVersion = await prisma.documentVersion.update({
      where: { id: version.id },
      data: {
        ragStatus: RAG_STATUSES.INDEXED,
        ragStoreName: store.geminiStoreName,
        ragDocumentName,
        ragIndexedAt: new Date(),
        ragIndexError: null,
      },
    } as any);
    return { document, version: updatedVersion, storeName: store.geminiStoreName, ragDocumentName };
  } catch (error: any) {
    await prisma.documentVersion.update({
      where: { id: version.id },
      data: { ragStatus: RAG_STATUSES.FAILED, ragIndexError: error?.message || String(error) },
    } as any);
    throw error;
  } finally {
    if (tempPath) await fs.unlink(tempPath).catch(() => undefined);
  }
};
```

- [ ] **Step 3: Add index and status endpoints**

In `api/index.ts`, import:

```ts
import { indexDocumentVersionIntoGemini } from '../services/ragIndexing.js';
```

Add endpoints after the document routes:

```ts
app.post('/api/rag/documents/:id/index', requireAuth, requirePermission('documents.manage_visibility'), async (req, res) => {
  try {
    const p = getPrisma();
    const cooperativeId = await getCoopId(req, p);
    const documentId = getParam(req.params.id);
    const result = await indexDocumentVersionIntoGemini(p, { cooperativeId, documentId });
    res.json({
      success: true,
      documentId,
      versionId: result.version.id,
      ragStatus: (result.version as any).ragStatus,
      storeName: result.storeName,
      ragDocumentName: result.ragDocumentName,
    });
  } catch (error: any) {
    console.error('RAG index failed:', error);
    res.status(500).json({ error: 'Failed to index document for AI.', details: error.message });
  }
});

app.get('/api/rag/documents/:id/status', requireAuth, requirePermission('documents.manage_visibility'), async (req, res) => {
  try {
    const p = getPrisma();
    const cooperativeId = await getCoopId(req, p);
    const documentId = getParam(req.params.id);
    const document = await p.document.findFirst({
      where: { id: documentId, cooperativeId },
      include: { currentVersion: true },
    });
    if (!document) return res.status(404).json({ error: 'Document not found' });
    res.json({
      documentId,
      versionId: document.currentVersion?.id || null,
      ragStatus: (document.currentVersion as any)?.ragStatus || 'not_indexed',
      ragStoreName: (document.currentVersion as any)?.ragStoreName || null,
      ragDocumentName: (document.currentVersion as any)?.ragDocumentName || null,
      ragIndexedAt: (document.currentVersion as any)?.ragIndexedAt || null,
      ragIndexError: (document.currentVersion as any)?.ragIndexError || null,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to load AI index status.', details: error.message });
  }
});
```

- [ ] **Step 4: Run TypeScript check**

Run:

```bash
npm run lint
```

Expected: no TypeScript errors from new services/endpoints.

- [ ] **Step 5: Commit indexing service**

```bash
git add api/index.ts services/ragDriveDownload.ts services/ragIndexing.ts
git commit -m "feat: index drive documents with gemini file search"
```

---

### Task 5: Ask Service And Endpoint

**Files:**
- Create: `services/ragAsk.ts`
- Modify: `api/index.ts`
- Test: `tests/ragRequestValidation.test.ts`

- [ ] **Step 1: Add request validation test**

Create `tests/ragRequestValidation.test.ts`:

```ts
import assert from 'node:assert/strict';
import { validateRagQuestion } from '../services/ragAsk.js';

assert.equal(validateRagQuestion('What does the pet policy say?'), 'What does the pet policy say?');
assert.throws(() => validateRagQuestion(''), /Question is required/);
assert.throws(() => validateRagQuestion('a'), /at least 2 characters/);

console.log('ragRequestValidation tests passed');
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx tsx tests/ragRequestValidation.test.ts
```

Expected: fails because `services/ragAsk.ts` does not exist.

- [ ] **Step 3: Implement ask service**

Create `services/ragAsk.ts`:

```ts
import type { PrismaClient } from '@prisma/client';
import { createGeminiFileSearchClient, getGeminiRagModel } from './geminiFileSearchClient.js';
import { normalizeGeminiCitations } from './ragCitation.js';
import { getAskRagStores, getAskStoreNamesFromResolvedStores } from './ragStore.js';

export const validateRagQuestion = (value: unknown) => {
  const question = String(value || '').trim();
  if (!question) throw new Error('Question is required');
  if (question.length < 2) throw new Error('Question must be at least 2 characters');
  if (question.length > 2000) throw new Error('Question is too long');
  return question;
};

export const askGeminiFileSearch = async (
  prisma: PrismaClient,
  input: { cooperativeId: string; question: string },
) => {
  const question = validateRagQuestion(input.question);
  const stores = await getAskRagStores(prisma, input.cooperativeId);
  const storeNames = getAskStoreNamesFromResolvedStores(stores);
  if (!storeNames.length) throw new Error('No Gemini File Search stores are configured');

  const ai = createGeminiFileSearchClient();
  const response = await ai.models.generateContent({
    model: getGeminiRagModel(),
    contents: [{
      role: 'user',
      parts: [{ text: question }],
    }],
    config: {
      systemInstruction: [
        'You are coopHUB Docs, an admin-only document question answering assistant.',
        'Answer only from retrieved coopHUB co-op documents and shared BC co-op reference documents.',
        'If the answer is not in the retrieved documents, say you could not find it in the indexed documents.',
        'Do not invent policy, fees, dates, legal requirements, or board decisions.',
        'Keep answers concise and cite source documents when grounding metadata is available.',
      ].join('\n'),
      tools: [{
        fileSearch: {
          fileSearchStoreNames: storeNames,
        },
      }],
    },
  } as any);

  const answer = typeof (response as any).text === 'string'
    ? (response as any).text
    : ((response as any).text?.() || '');

  return {
    answer: answer || 'I could not find this in the indexed documents.',
    citations: normalizeGeminiCitations(response),
    storeNames,
  };
};
```

- [ ] **Step 4: Run request validation test**

Run:

```bash
npx tsx tests/ragRequestValidation.test.ts
```

Expected: `ragRequestValidation tests passed`.

- [ ] **Step 5: Add ask endpoint**

In `api/index.ts`, import:

```ts
import { askGeminiFileSearch } from '../services/ragAsk.js';
```

Add endpoint after the RAG document endpoints:

```ts
app.post('/api/rag/ask', requireAuth, requirePermission('documents.manage_visibility'), async (req, res) => {
  const startedAt = Date.now();
  const p = getPrisma();
  const user = (req as any).user || (req as any).session?.user;
  let cooperativeId = '';

  try {
    cooperativeId = await getCoopId(req, p);
    const result = await askGeminiFileSearch(p, {
      cooperativeId,
      question: req.body?.question,
    });

    await p.policyAssistantQuery.create({
      data: {
        cooperativeId,
        userId: user?.email || 'unknown',
        question: String(req.body?.question || '').trim(),
        retrievedChunks: [],
        answer: result.answer.slice(0, 4000),
        citations: JSON.parse(JSON.stringify(result.citations)),
        language: 'English',
        intent: 'policy',
        suggestedAction: null,
        latencyMs: Date.now() - startedAt,
      },
    }).catch((error: any) => console.error('Failed to log RAG query:', error));

    res.json(result);
  } catch (error: any) {
    console.error('RAG ask failed:', error);
    res.status(500).json({ error: 'Failed to ask indexed documents.', details: error.message });
  }
});
```

- [ ] **Step 6: Run service tests and lint**

Run:

```bash
npx tsx tests/ragCitation.test.ts
npx tsx tests/ragStore.test.ts
npx tsx tests/ragRequestValidation.test.ts
npm run lint
```

Expected: all tests pass and TypeScript check succeeds.

- [ ] **Step 7: Commit ask service**

```bash
git add api/index.ts services/ragAsk.ts tests/ragRequestValidation.test.ts
git commit -m "feat: ask gemini file search stores"
```

---

### Task 6: Frontend Types And Admin UI

**Files:**
- Modify: `types.ts`
- Modify: `pages/ResourceLibrary.tsx`

- [ ] **Step 1: Extend frontend types**

In `types.ts`, add RAG fields to `Document.currentVersion`:

```ts
    ragStatus?: 'not_indexed' | 'indexing' | 'indexed' | 'failed' | 'stale' | 'deleted' | string;
    ragStoreName?: string | null;
    ragDocumentName?: string | null;
    ragIndexedAt?: string | null;
    ragIndexError?: string | null;
```

Add these exported types near `OracleResponse`:

```ts
export interface RagCitation {
  title: string;
  text?: string;
  uri?: string;
  pageNumber?: number | null;
  documentId?: string | null;
  documentVersionId?: string | null;
  scope?: string | null;
  sourceSystem?: string | null;
}

export interface RagAskResponse {
  answer: string;
  citations: RagCitation[];
  storeNames: string[];
}
```

- [ ] **Step 2: Add UI state and helpers**

In `pages/ResourceLibrary.tsx`, import `RagCitation`:

```ts
import { Document, Committee, RagCitation } from '../types';
```

Add state near the existing AI question state:

```ts
  const [ragQuestion, setRagQuestion] = useState('');
  const [ragAnswer, setRagAnswer] = useState('');
  const [ragCitations, setRagCitations] = useState<RagCitation[]>([]);
  const [isRagAsking, setIsRagAsking] = useState(false);
  const [indexingDocumentId, setIndexingDocumentId] = useState<string | null>(null);
```

Add helpers near `getIngestionDisplay`:

```ts
  const getRagDisplay = (doc: Document) => {
    const status = doc.currentVersion?.ragStatus || 'not_indexed';
    switch (status) {
      case 'indexing':
        return { label: 'AI indexing', className: 'bg-amber-500/10 text-amber-600 border-amber-500/20' };
      case 'indexed':
        return { label: 'AI indexed', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' };
      case 'failed':
        return { label: 'AI failed', className: 'bg-rose-500/10 text-rose-600 border-rose-500/20' };
      case 'stale':
        return { label: 'AI stale', className: 'bg-orange-500/10 text-orange-600 border-orange-500/20' };
      default:
        return { label: 'Not AI indexed', className: 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-white/5' };
    }
  };
```

- [ ] **Step 3: Add ask and index handlers**

In `pages/ResourceLibrary.tsx`, add:

```ts
  const handleAskRag = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!ragQuestion.trim()) return;

    setIsRagAsking(true);
    setRagAnswer('');
    setRagCitations([]);

    try {
      const res = await fetch('/api/rag/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ question: ragQuestion }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.details || data.error || 'Failed to ask indexed documents');
      setRagAnswer(data.answer || 'I could not find this in the indexed documents.');
      setRagCitations(Array.isArray(data.citations) ? data.citations : []);
    } catch (error: any) {
      showAlert(error.message || 'Failed to ask indexed documents.', 'error');
    } finally {
      setIsRagAsking(false);
    }
  };

  const handleIndexForAi = async (doc: Document, event?: React.MouseEvent) => {
    event?.stopPropagation();
    if (!doc.currentVersion?.id) {
      showAlert('This document needs a current Drive-backed version before AI indexing.', 'error');
      return;
    }

    setIndexingDocumentId(doc.id);
    try {
      const res = await fetch(`/api/rag/documents/${doc.id}/index`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.details || data.error || 'Failed to index document');
      showAlert('Document indexed for AI.', 'success');
      refreshData();
    } catch (error: any) {
      showAlert(error.message || 'Failed to index document for AI.', 'error');
      refreshData();
    } finally {
      setIndexingDocumentId(null);
    }
  };
```

- [ ] **Step 4: Add admin ask panel**

In the returned JSX before the document grid, add:

```tsx
      {isAdmin && !isGuest && (
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-2xl p-5 shadow-sm">
          <div className="flex flex-col gap-1 mb-4">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Ask coopHUB Docs</h3>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Admin test: indexed co-op Drive documents plus shared BC co-op references.
            </p>
          </div>
          <form onSubmit={handleAskRag} className="flex flex-col sm:flex-row gap-3">
            <input
              value={ragQuestion}
              onChange={(event) => setRagQuestion(event.target.value)}
              placeholder="Ask about indexed documents..."
              className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 text-slate-900 dark:text-white"
            />
            <button
              type="submit"
              disabled={isRagAsking || !ragQuestion.trim()}
              className="px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-slate-900 text-white hover:bg-brand-600 disabled:opacity-50 disabled:pointer-events-none transition-all"
            >
              {isRagAsking ? 'Asking...' : 'Ask'}
            </button>
          </form>
          {ragAnswer && (
            <div className="mt-4 rounded-xl border border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-slate-800 p-4">
              <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-slate-200">{ragAnswer}</p>
            </div>
          )}
          {ragCitations.length > 0 && (
            <div className="mt-4 grid gap-2">
              {ragCitations.map((citation, index) => (
                <div key={`${citation.title}-${index}`} className="rounded-xl border border-slate-200 dark:border-white/5 p-3 text-sm">
                  <div className="font-black text-slate-800 dark:text-white">{citation.title}</div>
                  {citation.pageNumber && <div className="text-xs text-slate-500">Page {citation.pageNumber}</div>}
                  {citation.text && <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-500 dark:text-slate-400">{citation.text}</p>}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
```

- [ ] **Step 5: Add status badge and index action to cards**

Inside the document grid map, after `const ingestion = getIngestionDisplay(doc);`, add:

```ts
            const rag = getRagDisplay(doc);
            const canIndexForAi = isAdmin && !isGuest && doc.storageProvider === 'GOOGLE_DRIVE';
```

Near the existing ingestion badge, add:

```tsx
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg border text-[8px] font-black uppercase tracking-widest ${rag.className}`}>
                          {rag.label}
                        </span>
```

Near existing document card actions, add:

```tsx
                    {canIndexForAi && (
                      <button
                        onClick={(event) => handleIndexForAi(doc, event)}
                        disabled={indexingDocumentId === doc.id}
                        className="px-3 py-2 rounded-lg bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest hover:bg-brand-600 disabled:opacity-50 transition-colors"
                      >
                        {indexingDocumentId === doc.id ? 'Indexing...' : doc.currentVersion?.ragStatus === 'failed' ? 'Retry AI' : 'Index AI'}
                      </button>
                    )}
```

- [ ] **Step 6: Run lint/build**

Run:

```bash
npm run lint
npm run build
```

Expected: TypeScript and production build succeed.

- [ ] **Step 7: Commit UI**

```bash
git add types.ts pages/ResourceLibrary.tsx
git commit -m "feat: add admin rag document UI"
```

---

### Task 7: Final Verification

**Files:**
- Verify only unless fixes are needed.

- [ ] **Step 1: Run all focused RAG tests**

Run:

```bash
npx tsx tests/ragCitation.test.ts
npx tsx tests/ragStore.test.ts
npx tsx tests/ragRequestValidation.test.ts
```

Expected: all print passed messages.

- [ ] **Step 2: Run full build**

Run:

```bash
npm run build
```

Expected: Prisma generation and Vite build succeed.

- [ ] **Step 3: Start dev server**

Run:

```bash
npm run dev
```

Expected: server starts at `http://localhost:3000`.

- [ ] **Step 4: Manual browser check**

Open `http://localhost:3000/documents` as an admin and verify:

- The Ask coopHUB Docs panel appears only for admin users.
- Drive-backed documents show an AI index badge.
- Non-Drive documents do not show the Index AI action.
- Clicking Index AI reaches the endpoint and reports a useful success or configuration error.
- Asking with missing Gemini config reports a friendly UI error.

- [ ] **Step 5: Manual live Gemini check when credentials are configured**

With `GEMINI_API_KEY`, Drive service account config, a co-op store, and a shared provincial store configured:

- Link one Drive PDF.
- Click `Index AI`.
- Confirm the badge updates to `AI indexed`.
- Ask a question answered by that PDF.
- Ask a question answered by shared BC co-op reference material.
- Confirm sources appear.
- Ask a question not covered by indexed material and confirm the answer says it could not find it.

- [ ] **Step 6: Update graph**

Run:

```bash
graphify update .
```

Expected: graph update completes.

- [ ] **Step 7: Commit graph update if it changed files**

```bash
git status --short
git add graphify-out
git commit -m "chore: update graph after rag feature"
```

Only commit this if `graphify update .` changed files.
