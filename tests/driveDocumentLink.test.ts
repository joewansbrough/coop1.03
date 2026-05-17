import assert from 'node:assert/strict';
import test from 'node:test';
import { createDocumentMetadataRecord } from '../services/documentMetadataStore.ts';

const createPrisma = () => {
  const calls: any = {
    documentCreate: null,
    documentUpdate: null,
    documentVersionCreate: null,
    ingestionJobCreate: null,
  };

  const prisma: any = {
    calls,
    $transaction: async (callback: any) => callback(prisma),
    document: {
      create: async ({ data, include }: any) => {
        calls.documentCreate = { data, include };
        return { id: 'doc-1', cooperativeId: data.cooperativeId, ...data };
      },
      update: async ({ where, data, include }: any) => {
        calls.documentUpdate = { where, data, include };
        return {
          id: where.id,
          ...calls.documentCreate.data,
          ...data,
          currentVersion: { id: data.currentVersionId, version: 1 },
        };
      },
    },
    documentVersion: {
      create: async ({ data }: any) => {
        calls.documentVersionCreate = data;
        return { id: 'version-1', ...data };
      },
    },
    documentIngestionJob: {
      create: async ({ data }: any) => {
        calls.ingestionJobCreate = data;
        return { id: 'job-1', ...data };
      },
    },
  };

  return prisma;
};

test('creates a current document version and ingestion job for linked Google Drive documents', async () => {
  const prisma = createPrisma();

  const document = await createDocumentMetadataRecord(prisma, {
    cooperativeId: 'coop-1',
    ownerUserId: 'user-1',
    userName: 'Admin User',
    title: 'Board Package',
    category: 'Cloud',
    url: 'https://drive.google.com/open?id=file-1',
    fileType: 'document',
    tags: ['Google Drive', 'Linked'],
    storageProvider: 'GOOGLE_DRIVE',
    sourceExternalId: 'file-1',
    sourceWebUrl: 'https://drive.google.com/open?id=file-1',
    sourceMimeType: 'application/vnd.google-apps.document',
  });

  assert.equal(prisma.calls.documentCreate.data.storageProvider, 'GOOGLE_DRIVE');
  assert.equal(prisma.calls.documentCreate.data.sourceExternalId, 'file-1');
  assert.equal(prisma.calls.documentVersionCreate.documentId, 'doc-1');
  assert.equal(prisma.calls.documentVersionCreate.storageProvider, 'GOOGLE_DRIVE');
  assert.equal(prisma.calls.documentVersionCreate.sourceExternalId, 'file-1');
  assert.equal(prisma.calls.documentVersionCreate.storageUrl, 'https://drive.google.com/open?id=file-1');
  assert.equal(prisma.calls.documentVersionCreate.ingestionStatus, 'pending');
  assert.equal(prisma.calls.ingestionJobCreate.documentVersionId, 'version-1');
  assert.equal(prisma.calls.ingestionJobCreate.status, 'queued');
  assert.equal(prisma.calls.documentUpdate.data.currentVersionId, 'version-1');
  assert.equal(document.currentVersion.id, 'version-1');
});
