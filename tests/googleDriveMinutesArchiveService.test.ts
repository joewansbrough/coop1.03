import assert from 'node:assert/strict';
import test from 'node:test';
import { archiveMinutesPdfToGoogleDrive } from '../services/googleDriveMinutesArchive.ts';

const pdfDataUrl = `data:application/pdf;base64,${Buffer.from('%PDF indexed minutes').toString('base64')}`;

test('indexes the Drive-backed minutes document after archiving', async () => {
  const indexCalls: any[] = [];
  const prisma = {
    coopEvent: {
      findFirst: async () => ({
        id: 'meeting-1',
        title: 'April Board Meeting',
        committee: { name: 'Board' },
      }),
    },
    document: {
      findFirst: async () => null,
      create: async ({ data }: any) => ({ id: 'doc-1', ...data }),
      update: async ({ data, include }: any) => ({ id: 'doc-1', ...data, currentVersion: include?.currentVersion ? { id: 'version-1' } : undefined }),
    },
    documentVersion: {
      findFirst: async () => null,
      create: async ({ data }: any) => ({ id: 'version-1', ...data }),
    },
    documentIngestionJob: {
      create: async ({ data }: any) => ({ id: 'job-1', ...data }),
    },
  };
  const drive = {
    files: {
      create: async () => ({
        data: {
          id: 'drive-file-1',
          webViewLink: 'https://drive.google.com/file/d/drive-file-1/view',
        },
      }),
    },
  };

  await archiveMinutesPdfToGoogleDrive({
    prisma,
    drive: drive as any,
    meetingId: 'meeting-1',
    cooperativeId: 'coop-1',
    folderId: 'packet-folder-1',
    pdfDataUrl,
    indexDocument: async (_prisma, input) => {
      indexCalls.push(input);
      return { ragDocumentName: 'rag-doc-1' };
    },
  });

  assert.deepEqual(indexCalls, [{ cooperativeId: 'coop-1', documentId: 'doc-1' }]);
});

test('updates the existing Drive minutes PDF instead of creating a new Drive file on re-save', async () => {
  const driveCalls: any[] = [];
  const prisma = {
    coopEvent: {
      findFirst: async () => ({
        id: 'meeting-1',
        title: 'April Board Meeting',
        committee: { name: 'Board' },
      }),
    },
    document: {
      findFirst: async () => ({
        id: 'doc-existing',
        sourceExternalId: 'existing-drive-file',
        tags: ['minutes-meeting:meeting-1'],
      }),
      update: async ({ where, data, include }: any) => ({
        id: where.id,
        sourceExternalId: data.sourceExternalId || 'existing-drive-file',
        ...data,
        currentVersion: include?.currentVersion ? { id: data.currentVersionId } : undefined,
      }),
    },
    documentVersion: {
      findFirst: async () => ({ id: 'version-old', version: 2 }),
      create: async ({ data }: any) => ({ id: 'version-new', ...data }),
    },
    documentIngestionJob: {
      create: async ({ data }: any) => ({ id: 'job-new', ...data }),
    },
  };
  const drive = {
    files: {
      create: async (input: any) => {
        driveCalls.push({ method: 'create', input });
        return { data: { id: 'new-drive-file' } };
      },
      update: async (input: any) => {
        driveCalls.push({ method: 'update', input });
        return {
          data: {
            id: input.fileId,
            webViewLink: `https://drive.google.com/file/d/${input.fileId}/view`,
          },
        };
      },
    },
  };

  const document = await archiveMinutesPdfToGoogleDrive({
    prisma,
    drive: drive as any,
    meetingId: 'meeting-1',
    cooperativeId: 'coop-1',
    folderId: 'packet-folder-1',
    pdfDataUrl,
  });

  assert.deepEqual(driveCalls.map(call => call.method), ['update']);
  assert.equal(driveCalls[0].input.fileId, 'existing-drive-file');
  assert.equal(driveCalls[0].input.supportsAllDrives, true);
  assert.equal(document.sourceExternalId, 'existing-drive-file');
});


test('ignores the blob minutes document and updates the existing Drive-backed minutes PDF', async () => {
  const findCalls: any[] = [];
  const driveCalls: any[] = [];
  const prisma = {
    coopEvent: {
      findFirst: async () => ({
        id: 'meeting-1',
        title: 'April Board Meeting',
        committee: { name: 'Board' },
      }),
    },
    document: {
      findFirst: async ({ where }: any) => {
        findCalls.push(where);
        if (where.storageProvider === 'GOOGLE_DRIVE') {
          return {
            id: 'doc-drive',
            storageProvider: 'GOOGLE_DRIVE',
            sourceExternalId: 'existing-drive-file',
            tags: ['minutes-meeting:meeting-1'],
          };
        }
        return {
          id: 'doc-blob',
          storageProvider: 'VERCEL_BLOB',
          sourceExternalId: null,
          tags: ['minutes-meeting:meeting-1'],
        };
      },
      update: async ({ where, data, include }: any) => ({
        id: where.id,
        sourceExternalId: data.sourceExternalId || 'existing-drive-file',
        ...data,
        currentVersion: include?.currentVersion ? { id: data.currentVersionId } : undefined,
      }),
    },
    documentVersion: {
      findFirst: async () => ({ id: 'version-old', version: 4 }),
      create: async ({ data }: any) => ({ id: 'version-new', ...data }),
    },
    documentIngestionJob: {
      create: async ({ data }: any) => ({ id: 'job-new', ...data }),
    },
  };
  const drive = {
    files: {
      create: async (input: any) => {
        driveCalls.push({ method: 'create', input });
        return { data: { id: 'unexpected-new-file' } };
      },
      update: async (input: any) => {
        driveCalls.push({ method: 'update', input });
        return {
          data: {
            id: input.fileId,
            webViewLink: `https://drive.google.com/file/d/${input.fileId}/view`,
          },
        };
      },
    },
  };

  const document = await archiveMinutesPdfToGoogleDrive({
    prisma,
    drive: drive as any,
    meetingId: 'meeting-1',
    cooperativeId: 'coop-1',
    folderId: 'packet-folder-1',
    pdfDataUrl,
  });

  assert.equal(findCalls[0].storageProvider, 'GOOGLE_DRIVE');
  assert.deepEqual(driveCalls.map(call => call.method), ['update']);
  assert.equal(document.id, 'doc-drive');
});
