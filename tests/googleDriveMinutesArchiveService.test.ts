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
