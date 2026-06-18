import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createGoogleDriveEventPacketFolder,
  listGoogleDriveEventPacketFiles,
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
