import { driveClient } from './googleDrive.js';
import { buildGoogleDriveEventPacketMetadata } from '../utils/googleDriveEventPacket.js';

const DRIVE_FILE_SCOPE = ['https://www.googleapis.com/auth/drive.file'];
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
