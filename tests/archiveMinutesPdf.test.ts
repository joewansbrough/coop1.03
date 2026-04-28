import assert from 'node:assert/strict';
import test from 'node:test';
import { archiveMinutesPdf } from '../services/archiveMinutesPdf.ts';

const pdfDataUrl = `data:application/pdf;base64,${Buffer.from('%PDF test').toString('base64')}`;

const createPrisma = (existingDocument: any = null, latestVersion: any = null) => {
  const calls: any = {
    documentCreate: null,
    documentUpdate: null,
    documentVersionCreate: null,
    ingestionJobCreate: null,
    blob: null,
  };

  const document = existingDocument || { id: 'doc-1' };

  return {
    calls,
    coopEvent: {
      findFirst: async () => ({
        id: 'meeting-1',
        title: 'April Board Meeting',
        committee: { name: 'Board' },
      }),
    },
    document: {
      findFirst: async () => existingDocument,
      create: async ({ data }: any) => {
        calls.documentCreate = data;
        return { ...document, ...data };
      },
      update: async ({ data }: any) => {
        calls.documentUpdate = data;
        return { ...document, ...data };
      },
    },
    documentVersion: {
      findFirst: async () => latestVersion,
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
};

test('archives a minutes PDF to Blob and queues an ingestion job', async () => {
  const prisma = createPrisma();

  const result = await archiveMinutesPdf({
    prisma,
    putBlob: async (path, bytes, options) => {
      prisma.calls.blob = { path, bytes, options };
      return {
        url: 'https://blob.example/minutes.pdf',
        pathname: path,
      };
    },
    blobToken: 'blob-token',
    meetingId: 'meeting-1',
    cooperativeId: 'coop-1',
    user: { name: 'Sam Secretary', email: 'sam@example.com' },
    pdfDataUrl,
    title: 'April Board Minutes',
    date: '2026-04-15T00:00:00.000Z',
  });

  assert.equal(result.url, 'https://blob.example/minutes.pdf');
  assert.equal(prisma.calls.documentCreate.url, 'https://blob.example/minutes.pdf');
  assert.equal(prisma.calls.documentCreate.status, 'ACTIVE');
  assert.equal(prisma.calls.documentCreate.visibility, 'MEMBERS');
  assert.equal(prisma.calls.documentVersionCreate.version, 1);
  assert.equal(prisma.calls.documentVersionCreate.storageUrl, 'https://blob.example/minutes.pdf');
  assert.equal(prisma.calls.documentVersionCreate.ingestionStatus, 'pending');
  assert.equal(prisma.calls.ingestionJobCreate.status, 'queued');
  assert.equal(prisma.calls.ingestionJobCreate.documentId, 'doc-1');
  assert.equal(prisma.calls.blob.path, 'coops/coop-1/minutes/meeting-1/minutes-v1.pdf');
  assert.equal(prisma.calls.blob.bytes.toString('utf8'), '%PDF test');
});

test('archives a replacement minutes PDF as the next document version', async () => {
  const existingDocument = { id: 'doc-7', tags: ['minutes-meeting:meeting-1'] };
  const latestVersion = { version: 3 };
  const prisma = createPrisma(existingDocument, latestVersion);

  await archiveMinutesPdf({
    prisma,
    putBlob: async (path) => ({
      url: 'https://blob.example/minutes-v4.pdf',
      pathname: path,
    }),
    blobToken: 'blob-token',
    meetingId: 'meeting-1',
    cooperativeId: 'coop-1',
    user: { email: 'sam@example.com' },
    pdfDataUrl,
  });

  assert.equal(prisma.calls.documentUpdate.url, 'https://blob.example/minutes-v4.pdf');
  assert.equal(prisma.calls.documentVersionCreate.version, 4);
  assert.equal(prisma.calls.documentVersionCreate.documentId, 'doc-7');
  assert.equal(prisma.calls.ingestionJobCreate.documentVersionId, 'version-1');
});

test('passes a configured Blob token to the storage client', async () => {
  const prisma = createPrisma();

  await archiveMinutesPdf({
    prisma,
    putBlob: async (_path, _bytes, options) => {
      prisma.calls.blob = { options };
      return {
        url: 'https://blob.example/minutes.pdf',
      };
    },
    blobToken: 'blob-token',
    meetingId: 'meeting-1',
    cooperativeId: 'coop-1',
    user: { email: 'sam@example.com' },
    pdfDataUrl,
  });

  assert.equal(prisma.calls.blob.options.token, 'blob-token');
});

test('fails before calling Blob when no token is configured', async () => {
  const previousToken = process.env.BLOB_READ_WRITE_TOKEN;
  delete process.env.BLOB_READ_WRITE_TOKEN;
  const prisma = createPrisma();
  let calledBlob = false;

  try {
    await assert.rejects(
      archiveMinutesPdf({
        prisma,
        putBlob: async () => {
          calledBlob = true;
          return { url: 'https://blob.example/minutes.pdf' };
        },
        meetingId: 'meeting-1',
        cooperativeId: 'coop-1',
        user: { email: 'sam@example.com' },
        pdfDataUrl,
      }),
      /BLOB_READ_WRITE_TOKEN is not configured/,
    );
  } finally {
    if (previousToken) {
      process.env.BLOB_READ_WRITE_TOKEN = previousToken;
    }
  }

  assert.equal(calledBlob, false);
});
