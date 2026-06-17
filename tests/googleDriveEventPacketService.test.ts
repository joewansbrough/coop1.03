import assert from 'node:assert/strict';
import test from 'node:test';
import { createGoogleDriveEventPacketFolder } from '../services/googleDriveEventPacket.js';

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

  assert.equal(calls[0].name, '2026-06-18 Board Meeting Meeting Packet');
  assert.equal(calls[0].mimeType, 'application/vnd.google-apps.folder');
  assert.deepEqual(calls[0].parents, ['root-folder']);
  assert.deepEqual(calls[0].appProperties, {
    coopHubEventId: 'event-123',
    coopHubKind: 'meeting-packet',
  });
  assert.equal(event.googleDrivePacketFolderId, 'drive-folder-123');
  assert.equal(event.googleDrivePacketFolderUrl, 'https://drive.google.com/drive/folders/drive-folder-123');
  assert.ok(event.googleDrivePacketSyncedAt instanceof Date);
});
