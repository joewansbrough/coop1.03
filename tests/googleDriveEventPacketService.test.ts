import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createGoogleDriveEventPacketFolder,
  createCoopEventWithGoogleDrivePacket,
  listGoogleDriveEventPacketFiles,
  syncGoogleDriveEventPacketFiles,
  uploadGoogleDriveEventPacketFile,
} from '../services/googleDriveEventPacket.js';

test('creates a Google Drive packet folder and stores it on the event', async () => {
  const calls: any[] = [];
  const prisma = {
    coopEvent: {
      findFirst: async () => ({
        id: 'event-123',
        cooperativeId: 'coop-1',
        title: 'Board Meeting',
        date: new Date('2026-06-18T19:00:00.000Z'),
        committee: { name: 'Board' },
      }),
      update: async ({ data }: any) => {
        calls.push(data);
        return { id: 'event-123', ...data };
      },
    },
  };
  const drive = {
    files: {
      list: async () => ({ data: { files: [] } }),
      create: async (input: any) => {
        calls.push(input.requestBody);
        return {
          data: {
            id: 'drive-folder-123',
            webViewLink: 'https://drive.google.com/drive/folders/drive-folder-123',
          },
        };
      },
    },
  };

  const event = await createGoogleDriveEventPacketFolder({
    prisma,
    drive: drive as any,
    eventId: 'event-123',
    cooperativeId: 'coop-1',
    parentFolderId: 'root-folder',
  });

  const driveCreates = calls.filter(call => call.mimeType === 'application/vnd.google-apps.folder');
  assert.deepEqual(driveCreates.map(call => call.name), ['Meetings', 'Board', '2026', '2026-06-18 Board Meeting Meeting Packet']);
  assert.deepEqual(driveCreates[3].parents, ['drive-folder-123']);
  assert.deepEqual(driveCreates[3].appProperties, {
    coopHubEventId: 'event-123',
    coopHubKind: 'meeting-packet',
  });
  assert.equal(event.googleDrivePacketFolderId, 'drive-folder-123');
  assert.equal(event.googleDrivePacketFolderUrl, 'https://drive.google.com/drive/folders/drive-folder-123');
  assert.ok(event.googleDrivePacketSyncedAt instanceof Date);
});

test('creates meeting packet folders under Meetings, committee, and year folders', async () => {
  const listQueries: string[] = [];
  const createdFolders: any[] = [];
  const prisma = {
    coopEvent: {
      findFirst: async () => ({
        id: 'event-123',
        cooperativeId: 'coop-1',
        title: 'Budget Review',
        date: new Date('2026-06-18T19:00:00.000Z'),
        committee: { name: 'Board' },
      }),
      update: async ({ data }: any) => ({ id: 'event-123', ...data }),
    },
  };
  const existingByQueryName: Record<string, string> = {
    Meetings: 'meetings-folder',
  };
  const drive = {
    files: {
      list: async (input: any) => {
        listQueries.push(input.q);
        const name = String(input.q).match(/name = '([^']+)'/)?.[1] || '';
        const id = existingByQueryName[name];
        return { data: { files: id ? [{ id, name }] : [] } };
      },
      create: async (input: any) => {
        createdFolders.push(input.requestBody);
        const id = `${String(input.requestBody.name).toLowerCase()}-folder`;
        return {
          data: {
            id,
            webViewLink: `https://drive.google.com/drive/folders/${id}`,
          },
        };
      },
    },
  };

  const event = await createGoogleDriveEventPacketFolder({
    prisma,
    drive: drive as any,
    eventId: 'event-123',
    cooperativeId: 'coop-1',
    parentFolderId: 'root-folder',
  });

  assert.equal(listQueries[0], "'root-folder' in parents and name = 'Meetings' and mimeType = 'application/vnd.google-apps.folder' and trashed = false");
  assert.equal(listQueries[1], "'meetings-folder' in parents and name = 'Board' and mimeType = 'application/vnd.google-apps.folder' and trashed = false");
  assert.equal(listQueries[2], "'board-folder' in parents and name = '2026' and mimeType = 'application/vnd.google-apps.folder' and trashed = false");
  assert.deepEqual(createdFolders.map(folder => folder.name), ['Board', '2026', '2026-06-18 Budget Review Meeting Packet']);
  assert.deepEqual(createdFolders.map(folder => folder.parents[0]), ['meetings-folder', 'board-folder', '2026-folder']);
  assert.equal(event.googleDrivePacketFolderId, '2026-06-18 budget review meeting packet-folder');
});

test('lists only files from the event packet folder', async () => {
  const calls: any[] = [];
  const prisma = {
    coopEvent: {
      findFirst: async () => ({
        id: 'event-123',
        cooperativeId: 'coop-1',
        googleDrivePacketFolderId: 'packet-folder-123',
      }),
    },
  };
  const drive = {
    files: {
      list: async (input: any) => {
        calls.push(input);
        return {
          data: {
            files: [
              {
                id: 'file-1',
                name: 'Agenda',
                mimeType: 'application/vnd.google-apps.document',
                webViewLink: 'https://docs.google.com/document/d/file-1/edit',
                iconLink: 'https://drive-thirdparty.googleusercontent.com/icon',
                modifiedTime: '2026-06-18T19:00:00.000Z',
              },
            ],
          },
        };
      },
    },
  };

  const files = await listGoogleDriveEventPacketFiles({
    prisma,
    drive: drive as any,
    eventId: 'event-123',
    cooperativeId: 'coop-1',
  });

  assert.equal(calls[0].q, "'packet-folder-123' in parents and trashed = false");
  assert.equal(files.length, 1);
  assert.deepEqual(files[0], {
    id: 'file-1',
    name: 'Agenda',
    mimeType: 'application/vnd.google-apps.document',
    webViewLink: 'https://docs.google.com/document/d/file-1/edit',
    iconLink: 'https://drive-thirdparty.googleusercontent.com/icon',
    modifiedTime: '2026-06-18T19:00:00.000Z',
    folderPath: '',
    documentId: null,
    ragStatus: null,
    ragIndexedAt: null,
    ragIndexError: null,
  });
});

test('refuses to list packet files before the event has a packet folder', async () => {
  const prisma = {
    coopEvent: {
      findFirst: async () => ({
        id: 'event-123',
        cooperativeId: 'coop-1',
        googleDrivePacketFolderId: null,
      }),
    },
  };

  await assert.rejects(
    () => listGoogleDriveEventPacketFiles({
      prisma,
      drive: { files: { list: async () => ({ data: { files: [] } }) } } as any,
      eventId: 'event-123',
      cooperativeId: 'coop-1',
    }),
    /does not have a Google Drive packet folder/i,
  );
});

test('syncs packet files recursively and indexes only new or changed documents', async () => {
  const indexedIds: string[] = [];
  const createdDocuments: any[] = [];
  const updatedDocuments: any[] = [];
  const createdVersions: any[] = [];
  const prisma = {
    coopEvent: {
      findFirst: async () => ({
        id: 'event-123',
        cooperativeId: 'coop-1',
        title: 'Board Meeting',
        date: new Date('2026-06-18T19:00:00.000Z'),
        googleDrivePacketFolderId: 'packet-folder-123',
        committee: { name: 'Board' },
      }),
    },
    document: {
      findFirst: async ({ where }: any) => {
        if (where.sourceExternalId === 'new-file') return null;
        if (where.sourceExternalId === 'unchanged-file') {
          return {
            id: 'doc-unchanged',
            title: 'Unchanged Agenda',
            tags: ['Google Drive', 'Meeting Packet', 'event:event-123'],
            sourceModifiedAt: new Date('2026-06-17T00:00:00.000Z'),
            currentVersion: {
              id: 'version-unchanged',
              version: 1,
              ragStatus: 'indexed',
              ragIndexedAt: new Date('2026-06-17T01:00:00.000Z'),
            },
          };
        }
        if (where.sourceExternalId === 'changed-file') {
          return {
            id: 'doc-changed',
            title: 'Old Report',
            tags: ['Google Drive'],
            sourceModifiedAt: new Date('2026-06-16T00:00:00.000Z'),
            currentVersion: {
              id: 'version-old',
              version: 2,
              ragStatus: 'indexed',
            },
          };
        }
        return null;
      },
      create: async ({ data }: any) => {
        createdDocuments.push(data);
        return { id: 'doc-new', ...data };
      },
      update: async ({ where, data, include }: any) => {
        updatedDocuments.push({ where, data });
        return {
          id: where.id,
          ...data,
          currentVersion: include?.currentVersion ? { id: data.currentVersionId || 'version-created', version: 3 } : undefined,
        };
      },
    },
    documentVersion: {
      create: async ({ data }: any) => {
        createdVersions.push(data);
        return { id: `version-${createdVersions.length}`, ...data };
      },
    },
    documentIngestionJob: {
      create: async () => ({ id: 'job-1' }),
    },
    $transaction: async (fn: any) => fn(prisma),
  };
  const driveFiles: Record<string, any[]> = {
    'packet-folder-123': [
      { id: 'subfolder', name: 'Supporting Docs', mimeType: 'application/vnd.google-apps.folder', parents: ['packet-folder-123'] },
      { id: 'unchanged-file', name: 'Unchanged Agenda', mimeType: 'application/pdf', modifiedTime: '2026-06-17T00:00:00.000Z', webViewLink: 'unchanged-url', parents: ['packet-folder-123'] },
    ],
    subfolder: [
      { id: 'new-file', name: 'New Budget', mimeType: 'application/vnd.google-apps.spreadsheet', modifiedTime: '2026-06-18T00:00:00.000Z', webViewLink: 'new-url', parents: ['subfolder'] },
      { id: 'changed-file', name: 'Updated Report', mimeType: 'application/pdf', modifiedTime: '2026-06-19T00:00:00.000Z', webViewLink: 'changed-url', parents: ['subfolder'] },
    ],
  };
  const drive = {
    files: {
      list: async ({ q }: any) => {
        const folderId = String(q).match(/'([^']+)' in parents/)?.[1] || '';
        return { data: { files: driveFiles[folderId] || [] } };
      },
    },
  };

  const result = await syncGoogleDriveEventPacketFiles({
    prisma: prisma as any,
    drive: drive as any,
    eventId: 'event-123',
    cooperativeId: 'coop-1',
    indexDocument: async (_prisma, input) => {
      indexedIds.push(input.documentId);
      return { ragDocumentName: `rag-${input.documentId}` };
    },
  });

  assert.equal(result.discoveredFiles, 3);
  assert.equal(result.createdDocuments, 1);
  assert.equal(result.updatedDocuments, 1);
  assert.equal(result.indexedDocuments, 2);
  assert.equal(result.skippedUnchanged, 1);
  assert.deepEqual(indexedIds, ['doc-new', 'doc-changed']);
  assert.equal(createdDocuments[0].sourceExternalId, 'new-file');
  assert.equal(createdDocuments[0].sourceFolderId, 'subfolder');
  assert.ok(createdDocuments[0].tags.includes('event:event-123'));
  assert.equal(updatedDocuments.some(update => update.where.id === 'doc-changed'), true);
  assert.equal(createdVersions.length, 2);
});

test('uploads a file into the event packet folder, creates metadata, and indexes it', async () => {
  const driveCreates: any[] = [];
  const indexCalls: any[] = [];
  const prisma = {
    coopEvent: {
      findFirst: async () => ({
        id: 'event-123',
        cooperativeId: 'coop-1',
        title: 'Board Meeting',
        date: new Date('2026-06-18T19:00:00.000Z'),
        googleDrivePacketFolderId: 'packet-folder-123',
        committee: { name: 'Board' },
      }),
    },
    document: {
      findFirst: async () => null,
      create: async ({ data }: any) => ({ id: 'doc-uploaded', ...data }),
      update: async ({ where, data, include }: any) => ({ id: where.id, sourceExternalId: 'drive-upload-1', ...data, currentVersion: include?.currentVersion ? { id: data.currentVersionId } : undefined }),
    },
    documentVersion: {
      create: async ({ data }: any) => ({ id: 'version-uploaded', ...data }),
    },
    documentIngestionJob: {
      create: async ({ data }: any) => ({ id: 'job-uploaded', ...data }),
    },
    $transaction: async (fn: any) => fn(prisma),
  };
  const drive = {
    files: {
      create: async (input: any) => {
        driveCreates.push(input);
        return {
          data: {
            id: 'drive-upload-1',
            name: input.requestBody.name,
            mimeType: input.media.mimeType,
            modifiedTime: '2026-06-18T20:00:00.000Z',
            webViewLink: 'https://drive.google.com/file/d/drive-upload-1/view',
            parents: ['packet-folder-123'],
          },
        };
      },
    },
  };

  const result = await uploadGoogleDriveEventPacketFile({
    prisma: prisma as any,
    drive: drive as any,
    eventId: 'event-123',
    cooperativeId: 'coop-1',
    file: {
      originalname: 'Agenda.pdf',
      mimetype: 'application/pdf',
      buffer: Buffer.from('pdf bytes'),
      size: 9,
    },
    indexDocument: async (_prisma, input) => {
      indexCalls.push(input);
      return { ragDocumentName: 'rag-doc-uploaded' };
    },
  });

  assert.equal(driveCreates[0].requestBody.name, 'Agenda.pdf');
  assert.deepEqual(driveCreates[0].requestBody.parents, ['packet-folder-123']);
  assert.equal(result.document.id, 'doc-uploaded');
  assert.equal(result.document.sourceExternalId, 'drive-upload-1');
  assert.deepEqual(indexCalls, [{ cooperativeId: 'coop-1', documentId: 'doc-uploaded' }]);
});



test('creates an event and returns a warning when automatic packet creation fails', async () => {
  const prisma = {
    coopEvent: {
      create: async ({ data, include }: any) => ({ id: 'event-created', ...data, attendees: include?.attendees ? [] : undefined }),
    },
  };

  const result = await createCoopEventWithGoogleDrivePacket({
    prisma: prisma as any,
    cooperativeId: 'coop-1',
    parentFolderId: 'root-folder',
    eventData: {
      title: 'Board Meeting',
      description: 'Monthly board meeting',
      date: new Date('2026-06-18T19:00:00.000Z'),
      time: '19:00',
      location: 'Common Room',
      category: 'Meeting',
      committeeId: 'committee-1',
    },
    createPacketFolder: async () => {
      throw new Error('Drive access denied');
    },
  });

  assert.equal(result.event.id, 'event-created');
  assert.equal(result.googleDrivePacketWarning, 'Drive access denied');
});

