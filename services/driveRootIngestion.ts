import type { PrismaClient } from '@prisma/client';
import { createDocumentMetadataRecord, type DocumentMetadataInput } from './documentMetadataStore.js';
import {
  getCooperativeDriveRootFolderIds,
  parseDriveRootFolderIds,
} from './cooperativeDriveRoots.js';
import { driveClient } from './googleDrive.js';
import { indexDocumentVersionIntoGemini } from './ragIndexing.js';

const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';

export { parseDriveRootFolderIds };

type DriveFile = {
  id?: string | null;
  name?: string | null;
  mimeType?: string | null;
  modifiedTime?: string | null;
  size?: string | null;
  webViewLink?: string | null;
  parents?: string[] | null;
};

type DriveClientLike = {
  files: {
    list: (args: any) => Promise<{ data: { files?: DriveFile[]; nextPageToken?: string | null } }>;
  };
};

type CreateDocumentFn = (
  prisma: PrismaClient,
  input: DocumentMetadataInput,
) => Promise<any>;

type IndexDocumentFn = (
  prisma: PrismaClient,
  input: { cooperativeId: string; documentId: string },
) => Promise<any>;

export type DriveRootIngestionResult = {
  rootFolderIds: string[];
  discoveredFiles: number;
  createdDocuments: number;
  indexedDocuments: number;
  skippedFiles: number;
  failedFiles: {
    fileId: string;
    name: string;
    stage: 'metadata' | 'index';
    error: string;
  }[];
  documents: {
    documentId: string;
    fileId: string;
    title: string;
    indexed: boolean;
    ragDocumentName?: string | null;
    storeName?: string | null;
  }[];
};

const escapeDriveQueryValue = (value: string) => value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

const inferFileType = (file: DriveFile) => {
  const mimeType = file.mimeType || '';
  if (mimeType === 'application/vnd.google-apps.document') return 'document';
  if (mimeType === 'application/vnd.google-apps.spreadsheet') return 'spreadsheet';
  if (mimeType === 'application/vnd.google-apps.presentation') return 'presentation';
  const name = file.name || '';
  const extension = name.includes('.') ? name.split('.').pop()?.toLowerCase() : '';
  return extension || mimeType.split('/').pop() || 'bin';
};

const toDocumentInput = (
  file: DriveFile,
  cooperativeId: string,
  sourceFolderId: string,
): DocumentMetadataInput => ({
  cooperativeId,
  title: file.name || 'Google Drive document',
  category: 'Cloud',
  url: file.webViewLink || (file.id ? `https://drive.google.com/open?id=${file.id}` : '#'),
  fileType: inferFileType(file),
  author: 'Google Drive',
  date: file.modifiedTime || new Date(),
  tags: ['Google Drive', 'Linked', 'Drive Root'],
  visibility: 'MEMBERS',
  storageProvider: 'GOOGLE_DRIVE',
  sourceExternalId: file.id || null,
  sourceFolderId,
  sourceWebUrl: file.webViewLink || (file.id ? `https://drive.google.com/open?id=${file.id}` : null),
  sourceMimeType: file.mimeType || null,
  sourceModifiedAt: file.modifiedTime || null,
});

const crawlDriveRootFiles = async (
  drive: DriveClientLike,
  rootFolderIds: string[],
  maxFiles = Number.POSITIVE_INFINITY,
) => {
  const queue = [...rootFolderIds];
  const visitedFolders = new Set<string>();
  const files: Array<{ file: DriveFile; sourceFolderId: string }> = [];

  while (queue.length > 0 && files.length < maxFiles) {
    const folderId = queue.shift()!;
    if (visitedFolders.has(folderId)) continue;
    visitedFolders.add(folderId);

    let pageToken: string | undefined;
    do {
      const response = await drive.files.list({
        q: `'${escapeDriveQueryValue(folderId)}' in parents and trashed = false`,
        fields: 'nextPageToken, files(id, name, mimeType, modifiedTime, size, webViewLink, parents)',
        orderBy: 'folder,name',
        pageSize: 200,
        pageToken,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });

      const children = response.data.files || [];
      for (const child of children) {
        if (!child.id) continue;
        if (child.mimeType === FOLDER_MIME_TYPE) {
          queue.push(child.id);
          continue;
        }
        files.push({ file: child, sourceFolderId: child.parents?.[0] || folderId });
        if (files.length >= maxFiles) break;
      }

      pageToken = response.data.nextPageToken || undefined;
    } while (pageToken && files.length < maxFiles);
  }

  return files;
};

const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);

const createOrUpdateDriveDocument = async (
  prisma: PrismaClient,
  input: DocumentMetadataInput,
) => {
  const existing = input.sourceExternalId ? await (prisma as any).document.findFirst({
    where: {
      cooperativeId: input.cooperativeId,
      sourceExternalId: input.sourceExternalId,
    },
    include: { currentVersion: true, accessRules: true },
  }) : null;

  if (!existing) return createDocumentMetadataRecord(prisma, input);

  return (prisma as any).document.update({
    where: { id: existing.id },
    data: {
      title: input.title || existing.title,
      category: input.category || existing.category,
      url: input.url || existing.url,
      fileType: input.fileType || existing.fileType,
      author: input.author || existing.author,
      date: input.date ? new Date(input.date) : existing.date,
      storageProvider: 'GOOGLE_DRIVE',
      sourceFolderId: input.sourceFolderId || existing.sourceFolderId,
      sourceWebUrl: input.sourceWebUrl || existing.sourceWebUrl,
      sourceMimeType: input.sourceMimeType || existing.sourceMimeType,
      sourceModifiedAt: input.sourceModifiedAt ? new Date(input.sourceModifiedAt) : existing.sourceModifiedAt,
      tags: Array.from(new Set([...(existing.tags || []), ...((input.tags as string[]) || [])])),
    },
    include: { currentVersion: true, accessRules: true },
  });
};

export const ingestConfiguredDriveRoots = async ({
  prisma,
  cooperativeId,
  rootFolderIds,
  drive = driveClient() as DriveClientLike,
  createDocument = createOrUpdateDriveDocument,
  indexDocument = indexDocumentVersionIntoGemini,
  maxFiles,
}: {
  prisma: PrismaClient;
  cooperativeId: string;
  rootFolderIds?: string[];
  drive?: DriveClientLike;
  createDocument?: CreateDocumentFn;
  indexDocument?: IndexDocumentFn;
  maxFiles?: number;
}): Promise<DriveRootIngestionResult> => {
  const resolvedRootFolderIds = rootFolderIds ?? await getCooperativeDriveRootFolderIds(prisma as any, cooperativeId);
  const cleanRootFolderIds = resolvedRootFolderIds.map(id => id.trim()).filter(Boolean);
  if (cleanRootFolderIds.length === 0) {
    throw new Error('GOOGLE_DRIVE_ROOT_FOLDER_IDS or GOOGLE_DRIVE_ROOT_FOLDER_ID is not configured');
  }

  const discovered = await crawlDriveRootFiles(drive, cleanRootFolderIds, maxFiles);
  const result: DriveRootIngestionResult = {
    rootFolderIds: cleanRootFolderIds,
    discoveredFiles: discovered.length,
    createdDocuments: 0,
    indexedDocuments: 0,
    skippedFiles: 0,
    failedFiles: [],
    documents: [],
  };

  for (const { file, sourceFolderId } of discovered) {
    if (!file.id) {
      result.skippedFiles += 1;
      continue;
    }

    let document: any;
    try {
      document = await createDocument(prisma, toDocumentInput(file, cooperativeId, sourceFolderId));
      result.createdDocuments += 1;
    } catch (error) {
      result.failedFiles.push({
        fileId: file.id,
        name: file.name || file.id,
        stage: 'metadata',
        error: errorMessage(error),
      });
      continue;
    }

    try {
      const indexed = await indexDocument(prisma, { cooperativeId, documentId: document.id });
      result.indexedDocuments += 1;
      result.documents.push({
        documentId: document.id,
        fileId: file.id,
        title: document.title || file.name || file.id,
        indexed: true,
        ragDocumentName: indexed?.ragDocumentName || null,
        storeName: indexed?.storeName || null,
      });
    } catch (error) {
      result.failedFiles.push({
        fileId: file.id,
        name: file.name || file.id,
        stage: 'index',
        error: errorMessage(error),
      });
      result.documents.push({
        documentId: document.id,
        fileId: file.id,
        title: document.title || file.name || file.id,
        indexed: false,
      });
    }
  }

  return result;
};
