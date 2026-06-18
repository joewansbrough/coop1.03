const safeFolderPart = (value: string) =>
  value
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/\s*-\s*/g, '-')
    .replace(/-+/g, '-')
    .trim()
    .replace(/^-|-$/g, '') || 'Meeting';

export const normalizeGoogleDriveFolderId = (folderId?: string | null) => {
  const normalized = String(folderId || '').trim();
  if (!normalized) {
    throw new Error('A Google Drive parent folder ID is required.');
  }
  return normalized;
};

export const buildGoogleDrivePacketFilesQuery = (folderId: string) =>
  `'${normalizeGoogleDriveFolderId(folderId).replace(/'/g, "\\'")}' in parents and trashed = false`;

const firstCleanFolderId = (value?: string | null) =>
  String(value || '')
    .split(',')
    .map(item => item.trim())
    .find(Boolean) || '';

export const resolveGoogleDriveEventPacketParentFolderId = ({
  explicitParentFolderId,
  workspaceEventPacketFolderId,
  env = process.env,
}: {
  explicitParentFolderId?: string | null;
  workspaceEventPacketFolderId?: string | null;
  env?: NodeJS.ProcessEnv;
}) =>
  firstCleanFolderId(explicitParentFolderId)
  || firstCleanFolderId(workspaceEventPacketFolderId)
  || firstCleanFolderId(env.GOOGLE_DRIVE_EVENT_PACKET_FOLDER_ID)
  || firstCleanFolderId(env.GOOGLE_DRIVE_ROOT_FOLDER_IDS)
  || firstCleanFolderId(env.GOOGLE_DRIVE_ROOT_FOLDER_ID);

export const buildGoogleDriveEventPacketMetadata = ({
  eventId,
  title,
  date,
  committeeName,
  parentFolderId,
}: {
  eventId: string;
  title: string;
  date?: string | Date | null;
  committeeName?: string | null;
  parentFolderId: string;
}) => {
  const eventDate = date ? new Date(date) : new Date();
  const isoDate = Number.isNaN(eventDate.getTime())
    ? new Date().toISOString().slice(0, 10)
    : eventDate.toISOString().slice(0, 10);
  const folderName = `${isoDate} ${safeFolderPart(title)} Meeting Packet`;
  const tags = Array.from(new Set([
    'Meeting Packet',
    ...(committeeName ? [committeeName] : []),
    `event:${eventId}`,
  ]));

  return {
    parentFolderId: normalizeGoogleDriveFolderId(parentFolderId),
    folderName,
    appProperties: {
      coopHubEventId: eventId,
      coopHubKind: 'meeting-packet',
    },
    tags,
  };
};
