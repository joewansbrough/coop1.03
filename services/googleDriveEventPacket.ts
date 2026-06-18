import { driveClient } from './googleDrive.js';
import {
  buildGoogleDriveEventPacketMetadata,
  buildGoogleDrivePacketFilesQuery,
} from '../utils/googleDriveEventPacket.js';

const DRIVE_FILE_SCOPE = ['https://www.googleapis.com/auth/drive.file'];
const DRIVE_METADATA_SCOPE = ['https://www.googleapis.com/auth/drive.metadata.readonly'];
const DRIVE_FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';

type CreateGoogleDriveEventPacketFolderInput = {
  prisma: any;
  eventId: string;
  cooperativeId: string;
  parentFolderId: string;
  drive?: ReturnType<typeof driveClient>;
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

  const packet = buildGoogleDriveEventPacketMetadata({
    eventId,
    title: event.title,
    date: event.date,
    committeeName: event.committee?.name || null,
    parentFolderId,
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
