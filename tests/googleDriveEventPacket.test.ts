import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildGoogleDriveEventPacketMetadata,
  buildGoogleDrivePacketFilesQuery,
  resolveGoogleDriveEventPacketParentFolderId,
  normalizeGoogleDriveFolderId,
} from '../utils/googleDriveEventPacket.ts';

test('builds stable Google Drive packet folder metadata for a meeting event', () => {
  const metadata = buildGoogleDriveEventPacketMetadata({
    eventId: 'event-123',
    title: '  Board / Budget: Planning?  ',
    date: '2026-06-18T19:00:00.000Z',
    committeeName: 'Board',
    parentFolderId: ' root-folder ',
  });

  assert.deepEqual(metadata, {
    parentFolderId: 'root-folder',
    folderName: '2026-06-18 Board-Budget-Planning Meeting Packet',
    appProperties: {
      coopHubEventId: 'event-123',
      coopHubKind: 'meeting-packet',
    },
    tags: ['Meeting Packet', 'Board', 'event:event-123'],
  });
});

test('rejects blank Google Drive parent folders', () => {
  assert.throws(
    () => normalizeGoogleDriveFolderId('   '),
    /folder id is required/i,
  );
});

test('builds a file listing query scoped to one packet folder', () => {
  assert.equal(
    buildGoogleDrivePacketFilesQuery(' packet-folder-123 '),
    "'packet-folder-123' in parents and trashed = false",
  );
});

test('resolves packet parent folder from explicit, workspace, and legacy Drive root settings', () => {
  assert.equal(
    resolveGoogleDriveEventPacketParentFolderId({
      explicitParentFolderId: ' explicit-folder ',
      workspaceEventPacketFolderId: 'workspace-folder',
      env: { GOOGLE_DRIVE_ROOT_FOLDER_IDS: 'root-a,root-b' } as any,
    }),
    'explicit-folder',
  );
  assert.equal(
    resolveGoogleDriveEventPacketParentFolderId({
      workspaceEventPacketFolderId: ' workspace-folder ',
      env: { GOOGLE_DRIVE_ROOT_FOLDER_IDS: 'root-a,root-b' } as any,
    }),
    'workspace-folder',
  );
  assert.equal(
    resolveGoogleDriveEventPacketParentFolderId({
      env: { GOOGLE_DRIVE_ROOT_FOLDER_IDS: ' root-a, root-b ' } as any,
    }),
    'root-a',
  );
  assert.equal(
    resolveGoogleDriveEventPacketParentFolderId({
      env: { GOOGLE_DRIVE_ROOT_FOLDER_ID: ' legacy-single-root ' } as any,
    }),
    'legacy-single-root',
  );
});
