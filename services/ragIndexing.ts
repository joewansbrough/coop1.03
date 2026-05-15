import fs from 'node:fs/promises';
import type { PrismaClient } from '@prisma/client';
import { createGeminiFileSearchClient } from './geminiFileSearchClient.js';
import { downloadDriveFileToTemp } from './ragDriveDownload.js';
import { getOrCreateCoopRagStore } from './ragStore.js';
import { RAG_STATUSES } from './ragTypes.js';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);

const waitForOperation = async (ai: any, operation: any, timeoutMs = 120_000) => {
  const startedAt = Date.now();
  let current = operation;

  while (!current?.done) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error('Gemini File Search indexing timed out');
    }
    await sleep(3_000);
    current = await ai.operations.get({ operation: current });
  }

  if (current.error) {
    throw new Error(`Gemini File Search indexing failed: ${JSON.stringify(current.error)}`);
  }

  return current;
};

const stringMetadata = (key: string, value: unknown) => ({
  key,
  stringValue: value == null ? '' : String(value),
});

const isDriveDocument = (document: any) =>
  document.storageProvider === 'GOOGLE_DRIVE' || Boolean(document.sourceExternalId);

const isDriveVersion = (version: any) =>
  version?.storageProvider === 'GOOGLE_DRIVE' || Boolean(version?.sourceExternalId);

const createCurrentDriveVersion = async (prisma: PrismaClient, document: any) => {
  if (!isDriveDocument(document)) {
    throw new Error('Document has no current version');
  }

  const driveFileId = document.sourceExternalId;
  if (!driveFileId) throw new Error('Document has no Google Drive file ID');

  const latest = await (prisma.documentVersion.aggregate as any)({
    where: { documentId: document.id },
    _max: { version: true },
  });
  const nextVersion = (latest?._max?.version || 0) + 1;
  const storageUrl = document.sourceWebUrl || document.url || `https://drive.google.com/file/d/${driveFileId}/view`;
  const createdVersion = await prisma.documentVersion.create({
    data: {
      documentId: document.id,
      cooperativeId: document.cooperativeId,
      version: nextVersion,
      source: 'google-drive',
      storageProvider: 'GOOGLE_DRIVE',
      sourceExternalId: driveFileId,
      sourceFolderId: document.sourceFolderId || null,
      sourceWebUrl: document.sourceWebUrl || null,
      storageUrl,
      storageKey: null,
      fileType: document.fileType || 'bin',
      mimeType: document.sourceMimeType || null,
      sizeBytes: null,
    },
  } as any);

  await prisma.document.update({
    where: { id: document.id },
    data: { currentVersionId: createdVersion.id },
  });

  return createdVersion;
};

export const indexDocumentVersionIntoGemini = async (
  prisma: PrismaClient,
  input: { cooperativeId: string; documentId: string },
) => {
  const document: any = await prisma.document.findFirst({
    where: { id: input.documentId, cooperativeId: input.cooperativeId },
    include: { currentVersion: true },
  });

  if (!document) throw new Error('Document not found');
  let version: any = document.currentVersion;
  if (!version) {
    version = await createCurrentDriveVersion(prisma, document);
    document.currentVersion = version;
    document.currentVersionId = version.id;
  }

  const isDriveBacked =
    isDriveDocument(document) ||
    isDriveVersion(version);

  if (!isDriveBacked) {
    throw new Error('Only Drive-backed documents can be indexed in this slice');
  }

  const driveFileId = (document as any).sourceExternalId || (version as any).sourceExternalId;
  if (!driveFileId) throw new Error('Document has no Google Drive file ID');

  await prisma.documentVersion.update({
    where: { id: version.id },
    data: {
      ragStatus: RAG_STATUSES.INDEXING,
      ragIndexError: null,
    },
  } as any);

  let tempPath = '';

  try {
    const store = await getOrCreateCoopRagStore(prisma, input.cooperativeId);
    const ai = createGeminiFileSearchClient();
    const download = await downloadDriveFileToTemp(
      driveFileId,
      document.title || version.storageUrl || document.id,
      version.mimeType || document.sourceMimeType,
    );
    tempPath = download.tempPath;
    const operation = await ai.fileSearchStores.uploadToFileSearchStore({
      fileSearchStoreName: store.geminiStoreName,
      file: tempPath,
      config: {
        displayName: document.title,
        mimeType: download.mimeType || version.mimeType || document.sourceMimeType || undefined,
        customMetadata: [
          stringMetadata('cooperativeId', input.cooperativeId),
          stringMetadata('documentId', document.id),
          stringMetadata('documentVersionId', version.id),
          stringMetadata('title', document.title),
          stringMetadata('category', document.category),
          stringMetadata('visibility', (document as any).visibility),
          stringMetadata('committee', document.committee),
          stringMetadata('driveFileId', driveFileId),
          stringMetadata('driveFolderId', (document as any).sourceFolderId || (version as any).sourceFolderId),
          stringMetadata('sourceSystem', 'google-drive'),
        ],
      },
    });

    const completed = await waitForOperation(ai, operation);
    const ragDocumentName = completed?.response?.documentName || completed?.response?.name || null;
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

    return {
      document,
      version: updatedVersion,
      storeName: store.geminiStoreName,
      ragDocumentName,
    };
  } catch (error) {
    await prisma.documentVersion.update({
      where: { id: version.id },
      data: {
        ragStatus: RAG_STATUSES.FAILED,
        ragIndexError: errorMessage(error),
      },
    } as any);
    throw error;
  } finally {
    if (tempPath) await fs.unlink(tempPath).catch(() => undefined);
  }
};
