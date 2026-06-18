import { driveClient } from './googleDrive.js';
import { createDocumentMetadataRecord, type DocumentMetadataInput } from './documentMetadataStore.js';
import { indexDocumentVersionIntoGemini } from './ragIndexing.js';
import {
  buildGoogleDriveEventPacketMetadata,
  buildGoogleDrivePacketFilesQuery,
} from '../utils/googleDriveEventPacket.js';

const DRIVE_FILE_SCOPE = ['https://www.googleapis.com/auth/drive.file'];
const DRIVE_METADATA_SCOPE = ['https://www.googleapis.com/auth/drive.metadata.readonly'];
const DRIVE_FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';

const escapeDriveQueryString = (value: string) => value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

const cleanFolderName = (value: string) =>
  value
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/\s*-\s*/g, '-')
    .trim()
    .replace(/^-|-$/g, '') || 'General';

type CreateGoogleDriveEventPacketFolderInput = {
  prisma: any;
  eventId: string;
  cooperativeId: string;
  parentFolderId: string;
  drive?: ReturnType<typeof driveClient>;
};

const findOrCreateDriveFolder = async ({
  drive,
  parentFolderId,
  name,
  appProperties,
}: {
  drive: ReturnType<typeof driveClient>;
  parentFolderId: string;
  name: string;
  appProperties?: Record<string, string>;
}) => {
  const folderName = cleanFolderName(name);
  const existing = await drive.files.list({
    q: `'${escapeDriveQueryString(parentFolderId)}' in parents and name = '${escapeDriveQueryString(folderName)}' and mimeType = '${DRIVE_FOLDER_MIME_TYPE}' and trashed = false`,
    fields: 'files(id, name, webViewLink)',
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const existingFolder = existing.data.files?.[0];
  if (existingFolder?.id) return existingFolder.id;

  const created = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: DRIVE_FOLDER_MIME_TYPE,
      parents: [parentFolderId],
      ...(appProperties ? { appProperties } : {}),
    },
    fields: 'id, webViewLink',
    supportsAllDrives: true,
  });
  const folderId = created.data.id;
  if (!folderId) throw new Error(`Google Drive did not return a folder ID for ${folderName}.`);
  return folderId;
};

const getMeetingPacketParentFolderId = async ({
  drive,
  rootFolderId,
  committeeName,
  eventDate,
}: {
  drive: ReturnType<typeof driveClient>;
  rootFolderId: string;
  committeeName?: string | null;
  eventDate: Date;
}) => {
  const meetingsFolderId = await findOrCreateDriveFolder({
    drive,
    parentFolderId: rootFolderId,
    name: 'Meetings',
    appProperties: { coopHubKind: 'meetings-root' },
  });
  const committeeFolderId = await findOrCreateDriveFolder({
    drive,
    parentFolderId: meetingsFolderId,
    name: committeeName || 'General',
    appProperties: { coopHubKind: 'meeting-committee' },
  });
  return findOrCreateDriveFolder({
    drive,
    parentFolderId: committeeFolderId,
    name: String(eventDate.getFullYear()),
    appProperties: { coopHubKind: 'meeting-year' },
  });
};

export const createGoogleDriveEventPacketFolder = async ({
  prisma,
  eventId,
  cooperativeId,
  parentFolderId,
  drive = driveClient(DRIVE_FILE_SCOPE),
}: CreateGoogleDriveEventPacketFolderInput) => {
  const event = await prisma.coopEvent.findFirst({
    where: { id: eventId, cooperativeId },
    include: { committee: true, attendees: true },
  });
  if (!event) throw new Error('Event not found for this cooperative.');

  const eventDate = event.date ? new Date(event.date) : new Date();
  const hierarchyParentFolderId = await getMeetingPacketParentFolderId({
    drive,
    rootFolderId: parentFolderId,
    committeeName: event.committee?.name || null,
    eventDate: Number.isNaN(eventDate.getTime()) ? new Date() : eventDate,
  });
  const packet = buildGoogleDriveEventPacketMetadata({
    eventId,
    title: event.title,
    date: eventDate,
    committeeName: event.committee?.name || null,
    parentFolderId: hierarchyParentFolderId,
  });
  const created = await drive.files.create({
    requestBody: {
      name: packet.folderName,
      mimeType: DRIVE_FOLDER_MIME_TYPE,
      parents: [packet.parentFolderId],
      appProperties: packet.appProperties,
    },
    fields: 'id, webViewLink',
    supportsAllDrives: true,
  });
  const folderId = created.data.id;
  if (!folderId) throw new Error('Google Drive did not return a folder ID.');
  const folderUrl = created.data.webViewLink || `https://drive.google.com/drive/folders/${folderId}`;

  return prisma.coopEvent.update({
    where: { id: eventId },
    data: {
      googleDrivePacketFolderId: folderId,
      googleDrivePacketFolderUrl: folderUrl,
      googleDrivePacketSyncedAt: new Date(),
    },
    include: { attendees: true },
  });
};

export type GoogleDrivePacketFile = {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string | null;
  iconLink: string | null;
  modifiedTime: string | null;
  folderPath?: string;
  documentId?: string | null;
  ragStatus?: string | null;
  ragIndexedAt?: string | null;
  ragIndexError?: string | null;
};

export const listGoogleDriveEventPacketFiles = async ({
  prisma,
  eventId,
  cooperativeId,
  drive = driveClient(DRIVE_METADATA_SCOPE),
}: {
  prisma: any;
  eventId: string;
  cooperativeId: string;
  drive?: ReturnType<typeof driveClient>;
}): Promise<GoogleDrivePacketFile[]> => {
  const event = await prisma.coopEvent.findFirst({
    where: { id: eventId, cooperativeId },
    select: {
      id: true,
      googleDrivePacketFolderId: true,
    },
  });
  if (!event) throw new Error('Event not found for this cooperative.');
  if (!event.googleDrivePacketFolderId) {
    throw new Error('This event does not have a Google Drive packet folder yet.');
  }

  const discovered = await crawlPacketFilesRecursive(drive, event.googleDrivePacketFolderId);
  const fileIds = discovered.map(({ file }) => file.id).filter((id): id is string => Boolean(id));
  const documents = fileIds.length > 0 && prisma.document?.findMany
    ? await prisma.document.findMany({
      where: {
        cooperativeId,
        sourceExternalId: { in: fileIds },
      },
      include: { currentVersion: true },
    })
    : [];
  const documentByFileId = new Map<string, any>((documents || []).map((document: any) => [document.sourceExternalId, document]));

  return discovered.map(({ file, folderPath }) => {
    const document = file.id ? documentByFileId.get(file.id) : null;
    return {
      id: file.id || '',
      name: file.name || 'Untitled',
      mimeType: file.mimeType || 'application/octet-stream',
      webViewLink: file.webViewLink || null,
      iconLink: file.iconLink || null,
      modifiedTime: file.modifiedTime || null,
      folderPath,
      documentId: document?.id || null,
      ragStatus: document?.currentVersion?.ragStatus || null,
      ragIndexedAt: document?.currentVersion?.ragIndexedAt || null,
      ragIndexError: document?.currentVersion?.ragIndexError || null,
    };
  }).filter(file => Boolean(file.id));
};
type IndexDocumentFn = (
  prisma: any,
  input: { cooperativeId: string; documentId: string },
) => Promise<any>;

type EventPacketDriveFile = {
  id?: string | null;
  name?: string | null;
  mimeType?: string | null;
  modifiedTime?: string | null;
  size?: string | null;
  webViewLink?: string | null;
  iconLink?: string | null;
  parents?: string[] | null;
};

type PacketDocumentResult = {
  document: any;
  changed: boolean;
  created: boolean;
};

const toDateTime = (value?: string | Date | null) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const datesEqual = (a?: string | Date | null, b?: string | Date | null) => {
  const left = toDateTime(a);
  const right = toDateTime(b);
  if (!left && !right) return true;
  if (!left || !right) return false;
  return left.getTime() === right.getTime();
};

const inferPacketFileType = (file: EventPacketDriveFile) => {
  const mimeType = file.mimeType || '';
  if (mimeType === 'application/vnd.google-apps.document') return 'document';
  if (mimeType === 'application/vnd.google-apps.spreadsheet') return 'spreadsheet';
  if (mimeType === 'application/vnd.google-apps.presentation') return 'presentation';
  const name = file.name || '';
  const extension = name.includes('.') ? name.split('.').pop()?.toLowerCase() : '';
  return extension || mimeType.split('/').pop() || 'bin';
};

const eventPacketTags = (eventId: string, committeeName?: string | null) => Array.from(new Set([
  'Google Drive',
  'Meeting Packet',
  `event:${eventId}`,
  ...(committeeName ? [committeeName] : []),
]));

const toPacketDocumentInput = ({
  file,
  event,
  cooperativeId,
  sourceFolderId,
}: {
  file: EventPacketDriveFile;
  event: any;
  cooperativeId: string;
  sourceFolderId: string;
}): DocumentMetadataInput => ({
  cooperativeId,
  title: file.name || 'Google Drive packet document',
  category: 'Meeting Packet',
  url: file.webViewLink || (file.id ? `https://drive.google.com/open?id=${file.id}` : '#'),
  fileType: inferPacketFileType(file),
  author: 'Google Drive',
  date: file.modifiedTime || event.date || new Date(),
  tags: eventPacketTags(event.id, event.committee?.name || null),
  committee: event.committee?.name || null,
  visibility: event.committee?.name ? 'COMMITTEE' : 'MEMBERS',
  committeeAccess: event.committee?.name || null,
  storageProvider: 'GOOGLE_DRIVE',
  sourceExternalId: file.id || null,
  sourceFolderId,
  sourceWebUrl: file.webViewLink || (file.id ? `https://drive.google.com/open?id=${file.id}` : null),
  sourceMimeType: file.mimeType || null,
  sourceModifiedAt: file.modifiedTime || null,
});

const createDriveBackedVersion = async ({
  tx,
  document,
  input,
  nextVersion,
}: {
  tx: any;
  document: any;
  input: DocumentMetadataInput;
  nextVersion: number;
}) => {
  const version = await tx.documentVersion.create({
    data: {
      documentId: document.id,
      cooperativeId: input.cooperativeId,
      version: nextVersion,
      source: 'google-drive',
      storageProvider: 'GOOGLE_DRIVE',
      sourceExternalId: input.sourceExternalId,
      sourceFolderId: input.sourceFolderId,
      sourceWebUrl: input.sourceWebUrl,
      storageUrl: input.sourceWebUrl || input.url || `https://drive.google.com/open?id=${input.sourceExternalId}`,
      storageKey: null,
      fileType: input.fileType || 'bin',
      mimeType: input.sourceMimeType || null,
      sizeBytes: null,
      ingestionStatus: 'pending',
    },
  });

  await tx.documentIngestionJob.create({
    data: {
      documentId: document.id,
      documentVersionId: version.id,
      cooperativeId: input.cooperativeId,
      status: 'queued',
    },
  });

  return version;
};

const createOrUpdatePacketDocument = async (
  prisma: any,
  input: DocumentMetadataInput,
): Promise<PacketDocumentResult> => {
  const existing = input.sourceExternalId ? await prisma.document.findFirst({
    where: {
      cooperativeId: input.cooperativeId,
      sourceExternalId: input.sourceExternalId,
    },
    include: { currentVersion: true, accessRules: true },
  }) : null;

  if (!existing) {
    const document = await createDocumentMetadataRecord(prisma, input);
    return { document, changed: true, created: true };
  }

  const existingIndexed = existing.currentVersion?.ragStatus === 'indexed';
  const modifiedChanged = !datesEqual(existing.sourceModifiedAt, input.sourceModifiedAt);
  const needsIndex = !existingIndexed;

  if (!modifiedChanged && !needsIndex) {
    return { document: existing, changed: false, created: false };
  }

  const document = await prisma.$transaction(async (tx: any) => {
    let currentVersionId = existing.currentVersionId || existing.currentVersion?.id || null;
    if (modifiedChanged) {
      const nextVersion = Number(existing.currentVersion?.version || 0) + 1;
      const version = await createDriveBackedVersion({ tx, document: existing, input, nextVersion });
      currentVersionId = version.id;
    }

    return tx.document.update({
      where: { id: existing.id },
      data: {
        title: input.title || existing.title,
        category: input.category || existing.category,
        url: input.url || existing.url,
        fileType: input.fileType || existing.fileType,
        author: input.author || existing.author,
        date: input.date ? new Date(input.date) : existing.date,
        tags: Array.from(new Set([...(existing.tags || []), ...((input.tags as string[]) || [])])),
        committee: input.committee || existing.committee,
        visibility: input.visibility || existing.visibility,
        committeeAccess: input.committeeAccess || existing.committeeAccess,
        storageProvider: 'GOOGLE_DRIVE',
        sourceFolderId: input.sourceFolderId || existing.sourceFolderId,
        sourceWebUrl: input.sourceWebUrl || existing.sourceWebUrl,
        sourceMimeType: input.sourceMimeType || existing.sourceMimeType,
        sourceModifiedAt: input.sourceModifiedAt ? new Date(input.sourceModifiedAt) : existing.sourceModifiedAt,
        currentVersionId,
      },
      include: { currentVersion: true, accessRules: true },
    });
  });

  return { document, changed: true, created: false };
};

const crawlPacketFilesRecursive = async (
  drive: ReturnType<typeof driveClient>,
  packetFolderId: string,
) => {
  const queue: Array<{ id: string; path: string[] }> = [{ id: packetFolderId, path: [] }];
  const visited = new Set<string>();
  const files: Array<{ file: EventPacketDriveFile; sourceFolderId: string; folderPath: string }> = [];

  while (queue.length > 0) {
    const folder = queue.shift()!;
    if (visited.has(folder.id)) continue;
    visited.add(folder.id);

    let pageToken: string | undefined;
    do {
      const response = await drive.files.list({
        q: buildGoogleDrivePacketFilesQuery(folder.id),
        fields: 'nextPageToken, files(id, name, mimeType, modifiedTime, size, webViewLink, iconLink, parents)',
        orderBy: 'folder,name_natural',
        pageSize: 200,
        pageToken,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });

      for (const child of response.data.files || []) {
        if (!child.id) continue;
        if (child.mimeType === DRIVE_FOLDER_MIME_TYPE) {
          queue.push({ id: child.id, path: [...folder.path, child.name || 'Folder'] });
          continue;
        }
        files.push({
          file: child,
          sourceFolderId: child.parents?.[0] || folder.id,
          folderPath: folder.path.join(' / '),
        });
      }
      pageToken = response.data.nextPageToken || undefined;
    } while (pageToken);
  }

  return files;
};

export type GoogleDriveEventPacketSyncResult = {
  eventId: string;
  packetFolderId: string;
  discoveredFiles: number;
  createdDocuments: number;
  updatedDocuments: number;
  indexedDocuments: number;
  skippedUnchanged: number;
  failedFiles: { fileId: string; name: string; stage: 'metadata' | 'index'; error: string }[];
  documents: Array<{
    documentId: string;
    fileId: string;
    title: string;
    indexed: boolean;
    folderPath: string;
    ragDocumentName?: string | null;
    storeName?: string | null;
  }>;
};

export const syncGoogleDriveEventPacketFiles = async ({
  prisma,
  eventId,
  cooperativeId,
  drive = driveClient(DRIVE_METADATA_SCOPE),
  indexDocument = indexDocumentVersionIntoGemini,
}: {
  prisma: any;
  eventId: string;
  cooperativeId: string;
  drive?: ReturnType<typeof driveClient>;
  indexDocument?: IndexDocumentFn;
}): Promise<GoogleDriveEventPacketSyncResult> => {
  const event = await prisma.coopEvent.findFirst({
    where: { id: eventId, cooperativeId },
    include: { committee: true },
  });
  if (!event) throw new Error('Event not found for this cooperative.');
  if (!event.googleDrivePacketFolderId) throw new Error('This event does not have a Google Drive packet folder yet.');

  const discovered = await crawlPacketFilesRecursive(drive, event.googleDrivePacketFolderId);
  const result: GoogleDriveEventPacketSyncResult = {
    eventId,
    packetFolderId: event.googleDrivePacketFolderId,
    discoveredFiles: discovered.length,
    createdDocuments: 0,
    updatedDocuments: 0,
    indexedDocuments: 0,
    skippedUnchanged: 0,
    failedFiles: [],
    documents: [],
  };

  for (const { file, sourceFolderId, folderPath } of discovered) {
    if (!file.id) continue;
    let packetDocument: PacketDocumentResult;
    try {
      packetDocument = await createOrUpdatePacketDocument(prisma, toPacketDocumentInput({
        file,
        event,
        cooperativeId,
        sourceFolderId,
      }));
      if (packetDocument.created) result.createdDocuments += 1;
      else if (packetDocument.changed) result.updatedDocuments += 1;
      else result.skippedUnchanged += 1;
    } catch (error: any) {
      result.failedFiles.push({ fileId: file.id, name: file.name || file.id, stage: 'metadata', error: error?.message || String(error) });
      continue;
    }

    if (!packetDocument.changed) {
      result.documents.push({
        documentId: packetDocument.document.id,
        fileId: file.id,
        title: packetDocument.document.title || file.name || file.id,
        indexed: packetDocument.document.currentVersion?.ragStatus === 'indexed',
        folderPath,
        ragDocumentName: packetDocument.document.currentVersion?.ragDocumentName || null,
        storeName: packetDocument.document.currentVersion?.ragStoreName || null,
      });
      continue;
    }

    try {
      const indexed = await indexDocument(prisma, { cooperativeId, documentId: packetDocument.document.id });
      result.indexedDocuments += 1;
      result.documents.push({
        documentId: packetDocument.document.id,
        fileId: file.id,
        title: packetDocument.document.title || file.name || file.id,
        indexed: true,
        folderPath,
        ragDocumentName: indexed?.ragDocumentName || null,
        storeName: indexed?.storeName || null,
      });
    } catch (error: any) {
      result.failedFiles.push({ fileId: file.id, name: file.name || file.id, stage: 'index', error: error?.message || String(error) });
      result.documents.push({
        documentId: packetDocument.document.id,
        fileId: file.id,
        title: packetDocument.document.title || file.name || file.id,
        indexed: false,
        folderPath,
      });
    }
  }

  return result;
};

export const uploadGoogleDriveEventPacketFile = async ({
  prisma,
  eventId,
  cooperativeId,
  file,
  drive = driveClient(DRIVE_FILE_SCOPE),
  indexDocument = indexDocumentVersionIntoGemini,
}: {
  prisma: any;
  eventId: string;
  cooperativeId: string;
  file: { originalname: string; mimetype?: string; buffer: Buffer; size?: number };
  drive?: ReturnType<typeof driveClient>;
  indexDocument?: IndexDocumentFn;
}) => {
  const event = await prisma.coopEvent.findFirst({
    where: { id: eventId, cooperativeId },
    include: { committee: true },
  });
  if (!event) throw new Error('Event not found for this cooperative.');
  if (!event.googleDrivePacketFolderId) throw new Error('This event does not have a Google Drive packet folder yet.');

  const uploaded = await drive.files.create({
    requestBody: {
      name: file.originalname || 'Event packet upload',
      parents: [event.googleDrivePacketFolderId],
      appProperties: {
        coopHubEventId: eventId,
        coopHubKind: 'meeting-packet-document',
      },
    },
    media: {
      mimeType: file.mimetype || 'application/octet-stream',
      body: file.buffer,
    },
    fields: 'id, name, mimeType, modifiedTime, size, webViewLink, iconLink, parents',
    supportsAllDrives: true,
  });

  const driveFile: EventPacketDriveFile = {
    ...uploaded.data,
    name: uploaded.data.name || file.originalname,
    mimeType: uploaded.data.mimeType || file.mimetype || 'application/octet-stream',
    parents: uploaded.data.parents || [event.googleDrivePacketFolderId],
    modifiedTime: uploaded.data.modifiedTime || new Date().toISOString(),
    webViewLink: uploaded.data.webViewLink || (uploaded.data.id ? `https://drive.google.com/open?id=${uploaded.data.id}` : null),
  };
  const packetDocument = await createOrUpdatePacketDocument(prisma, toPacketDocumentInput({
    file: driveFile,
    event,
    cooperativeId,
    sourceFolderId: event.googleDrivePacketFolderId,
  }));
  const indexed = await indexDocument(prisma, { cooperativeId, documentId: packetDocument.document.id });

  return {
    file: driveFile,
    document: packetDocument.document,
    indexed,
  };
};

export const createCoopEventWithGoogleDrivePacket = async ({
  prisma,
  cooperativeId,
  parentFolderId,
  eventData,
  createPacketFolder = createGoogleDriveEventPacketFolder,
}: {
  prisma: any;
  cooperativeId: string;
  parentFolderId: string;
  eventData: {
    title: string;
    description?: string | null;
    date: Date;
    time: string;
    location: string;
    category: string;
    committeeId?: string | null;
  };
  createPacketFolder?: typeof createGoogleDriveEventPacketFolder;
}) => {
  const createdEvent = await prisma.coopEvent.create({
    data: {
      cooperativeId,
      title: eventData.title,
      description: eventData.description || '',
      date: eventData.date,
      time: eventData.time,
      location: eventData.location,
      category: eventData.category,
      committeeId: eventData.committeeId || null,
    },
    include: { attendees: true },
  });

  try {
    const eventWithPacket = await createPacketFolder({
      prisma,
      eventId: createdEvent.id,
      cooperativeId,
      parentFolderId,
    });
    return { event: eventWithPacket, googleDrivePacketWarning: null };
  } catch (error: any) {
    return {
      event: createdEvent,
      googleDrivePacketWarning: error?.message || 'Google Drive packet creation failed.',
    };
  }
};


