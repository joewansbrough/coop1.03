import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ingestConfiguredDriveRoots,
  parseDriveRootFolderIds,
} from '../services/driveRootIngestion.ts';

test('parses comma separated Drive root folder ids with single-id fallback', () => {
  assert.deepEqual(parseDriveRootFolderIds(' root-a,root-b ,, root-c ', 'fallback'), [
    'root-a',
    'root-b',
    'root-c',
  ]);
  assert.deepEqual(parseDriveRootFolderIds('', 'fallback-root'), ['fallback-root']);
  assert.deepEqual(parseDriveRootFolderIds(undefined, undefined), []);
});

test('crawls configured Drive roots, creates metadata records, and indexes each file', async () => {
  const listedQueries: string[] = [];
  const createdInputs: any[] = [];
  const indexedIds: string[] = [];
  const driveFiles: Record<string, any[]> = {
    'root-a': [
      { id: 'folder-1', name: 'Policies', mimeType: 'application/vnd.google-apps.folder', webViewLink: 'folder-url' },
      { id: 'file-1', name: 'House Rules', mimeType: 'application/vnd.google-apps.document', modifiedTime: '2026-05-01T00:00:00.000Z', webViewLink: 'file-1-url', parents: ['root-a'] },
    ],
    'folder-1': [
      { id: 'file-2', name: 'Parking Map.pdf', mimeType: 'application/pdf', modifiedTime: '2026-05-02T00:00:00.000Z', size: '1234', webViewLink: 'file-2-url', parents: ['folder-1'] },
    ],
    root_b: [
      { id: 'file-3', name: 'Budget Sheet', mimeType: 'application/vnd.google-apps.spreadsheet', modifiedTime: '2026-05-03T00:00:00.000Z', webViewLink: 'file-3-url', parents: ['root_b'] },
    ],
  };

  const drive = {
    files: {
      list: async ({ q }: any) => {
        listedQueries.push(q);
        const folderId = String(q).match(/'([^']+)' in parents/)?.[1] || '';
        return { data: { files: driveFiles[folderId] || [] } };
      },
    },
  };

  const result = await ingestConfiguredDriveRoots({
    prisma: {} as any,
    cooperativeId: 'coop-1',
    rootFolderIds: ['root-a', 'root_b'],
    drive,
    createDocument: async (_prisma, input) => {
      createdInputs.push(input);
      return { id: `doc-${createdInputs.length}`, ...input };
    },
    indexDocument: async (_prisma, input) => {
      indexedIds.push(input.documentId);
      return { storeName: 'fileSearchStores/test', ragDocumentName: `rag-${input.documentId}` };
    },
  });

  assert.equal(result.rootFolderIds.length, 2);
  assert.equal(result.discoveredFiles, 3);
  assert.equal(result.createdDocuments, 3);
  assert.equal(result.indexedDocuments, 3);
  assert.deepEqual(indexedIds, ['doc-1', 'doc-2', 'doc-3']);
  assert.deepEqual(createdInputs.map(input => input.sourceExternalId), ['file-1', 'file-3', 'file-2']);
  assert.equal(createdInputs[0].sourceFolderId, 'root-a');
  assert.equal(createdInputs[2].sourceFolderId, 'folder-1');
  assert.equal(createdInputs[1].category, 'Cloud');
  assert.equal(createdInputs[1].fileType, 'spreadsheet');
  assert.equal(listedQueries.length, 3);
});
