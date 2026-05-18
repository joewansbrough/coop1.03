import type { PrismaClient } from '@prisma/client';

type PrismaLike = Pick<PrismaClient, never> & {
  cooperativeDriveRoot?: {
    findMany: (args: any) => Promise<Array<{ folderId?: string | null }>>;
  };
};

type DriveLike = {
  files: {
    get: (args: any) => Promise<{ data: { id?: string | null; parents?: string[] | null } }>;
  };
};

export const parseDriveRootFolderIds = (
  rootFolderIds?: string | null,
  singleRootFolderId?: string | null,
) => {
  const ids = String(rootFolderIds || '')
    .split(',')
    .map(id => id.trim())
    .filter(Boolean);

  if (ids.length > 0) return ids;

  const fallback = String(singleRootFolderId || '').trim();
  return fallback ? [fallback] : [];
};

export const getLegacyDriveRootFolderIds = (env: NodeJS.ProcessEnv = process.env) =>
  parseDriveRootFolderIds(env.GOOGLE_DRIVE_ROOT_FOLDER_IDS, env.GOOGLE_DRIVE_ROOT_FOLDER_ID);

export const getCooperativeDriveRootFolderIds = async (
  prisma: PrismaLike,
  cooperativeId: string,
  options: { legacyRootFolderIds?: string[] } = {},
) => {
  const legacyRootFolderIds = options.legacyRootFolderIds ?? getLegacyDriveRootFolderIds();
  if (!cooperativeId || !prisma.cooperativeDriveRoot?.findMany) return legacyRootFolderIds;

  try {
    const rows = await prisma.cooperativeDriveRoot.findMany({
      where: { cooperativeId, isActive: true },
      orderBy: [{ displayName: 'asc' }, { folderId: 'asc' }],
    });
    const dbRoots = rows.map(row => String(row.folderId || '').trim()).filter(Boolean);
    return dbRoots.length > 0 ? dbRoots : legacyRootFolderIds;
  } catch (error: any) {
    if (error?.code === 'P2021' || error?.code === 'P2022') return legacyRootFolderIds;
    throw error;
  }
};

export const isFolderWithinDriveRoots = async (
  drive: DriveLike,
  rootFolderIds: string[],
  folderId: string,
  cache?: Map<string, boolean>,
) => {
  const cleanRootIds = rootFolderIds.map(id => id.trim()).filter(Boolean);
  if (cleanRootIds.length === 0 || !folderId) return false;
  if (cleanRootIds.includes(folderId)) return true;
  if (cache?.has(folderId)) return cache.get(folderId)!;

  let currentId = folderId;
  const visited: string[] = [];

  try {
    while (currentId) {
      visited.push(currentId);
      const file = await drive.files.get({
        fileId: currentId,
        fields: 'id, parents',
        supportsAllDrives: true,
      });

      const parents = file.data.parents || [];
      if (parents.some(parent => cleanRootIds.includes(parent))) {
        if (cache) visited.forEach(id => cache.set(id, true));
        return true;
      }

      currentId = parents[0] || '';
      if (currentId && cache?.has(currentId)) {
        const result = cache.get(currentId)!;
        visited.forEach(id => cache.set(id, result));
        return result;
      }
    }
  } catch {
    // Treat inaccessible folders as outside the configured roots.
  }

  if (cache) visited.forEach(id => cache.set(id, false));
  return false;
};
