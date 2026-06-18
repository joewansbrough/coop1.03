import { driveClient } from './googleDrive.js';
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

  const result = await drive.files.list({
    q: buildGoogleDrivePacketFilesQuery(event.googleDrivePacketFolderId),
    fields: 'files(id, name, mimeType, webViewLink, iconLink, modifiedTime)',
    orderBy: 'folder,name_natural',
    pageSize: 100,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  return (result.data.files || []).map(file => ({
    id: file.id || '',
    name: file.name || 'Untitled',
    mimeType: file.mimeType || 'application/octet-stream',
    webViewLink: file.webViewLink || null,
    iconLink: file.iconLink || null,
    modifiedTime: file.modifiedTime || null,
  })).filter(file => Boolean(file.id));
};
