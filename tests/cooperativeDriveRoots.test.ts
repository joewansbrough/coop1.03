import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getCooperativeDriveRootFolderIds,
  isFolderWithinDriveRoots,
  parseDriveRootFolderIds,
} from '../services/cooperativeDriveRoots.ts';

test('parses Drive root env values with single-id fallback', () => {
  assert.deepEqual(parseDriveRootFolderIds(' root-a, root-b ,, ', 'fallback'), ['root-a', 'root-b']);
  assert.deepEqual(parseDriveRootFolderIds('', 'fallback'), ['fallback']);
  assert.deepEqual(parseDriveRootFolderIds(undefined, undefined), []);
});

test('selects active Drive roots for only the active cooperative', async () => {
  const prisma = {
    cooperativeDriveRoot: {
      findMany: async ({ where, orderBy }: any) => {
        assert.deepEqual(where, { cooperativeId: 'coop-a', isActive: true });
        assert.deepEqual(orderBy, [{ displayName: 'asc' }, { folderId: 'asc' }]);
        return [
          { folderId: ' root-a ' },
          { folderId: 'root-b' },
          { folderId: '' },
        ];
      },
    },
  };

  const roots = await getCooperativeDriveRootFolderIds(prisma as any, 'coop-a', {
    legacyRootFolderIds: ['legacy-root'],
  });

  assert.deepEqual(roots, ['root-a', 'root-b']);
});

test('falls back to legacy env roots only when a cooperative has no DB roots', async () => {
  const prisma = {
    cooperativeDriveRoot: {
      findMany: async () => [],
    },
  };

  const roots = await getCooperativeDriveRootFolderIds(prisma as any, 'coop-empty', {
    legacyRootFolderIds: ['legacy-a', 'legacy-b'],
  });

  assert.deepEqual(roots, ['legacy-a', 'legacy-b']);
});

test('checks folder ancestry against caller-provided cooperative roots', async () => {
  const drive = {
    files: {
      get: async ({ fileId }: any) => {
        const parentsById: Record<string, string[]> = {
          child: ['parent'],
          parent: ['root-a'],
          outside: ['other-root'],
        };
        return { data: { id: fileId, parents: parentsById[fileId] || [] } };
      },
    },
  };

  assert.equal(await isFolderWithinDriveRoots(drive as any, ['root-a'], 'root-a'), true);
  assert.equal(await isFolderWithinDriveRoots(drive as any, ['root-a'], 'child'), true);
  assert.equal(await isFolderWithinDriveRoots(drive as any, ['root-a'], 'outside'), false);
});
