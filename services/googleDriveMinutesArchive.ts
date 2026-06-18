import { Readable } from 'node:stream';
import { driveClient } from './googleDrive.js';
import { buildGoogleDriveMinutesArchiveInput } from '../utils/googleDriveMinutesArchive.js';

const DRIVE_FILE_SCOPE = ['https://www.googleapis.com/auth/drive.file'];

type ArchiveMinutesPdfToGoogleDriveInput = {
  prisma: any;
  meetingId: string;
  cooperativeId: string;
  folderId: string;
  user?: { name?: string; email?: string };
  pdfDataUrl: string;
  title?: string;
  date?: string;
  drive?: ReturnType<typeof driveClient>;
  indexDocument?: (prisma: any, input: { cooperativeId: string; documentId: string }) => Promise<any>;
};

const bufferToStream = (buffer: Buffer) => Readable.from(buffer);

export const archiveMinutesPdfToGoogleDrive = async ({
  prisma,
  meetingId,
  cooperativeId,
  folderId,
  user,
  pdfDataUrl,
  title,
  date,
  drive = driveClient(DRIVE_FILE_SCOPE),
  indexDocument,
}: ArchiveMinutesPdfToGoogleDriveInput) => {
  if (!folderId?.trim()) throw new Error('A Google Drive archive folder is required.');

  const event = await prisma.coopEvent.findFirst({
    where: { id: meetingId, cooperativeId },
    include: { committee: true },
  });
  if (!event) throw new Error('Meeting not found for this cooperative.');

  const archive = buildGoogleDriveMinutesArchiveInput({
    meetingId,
    cooperativeId,
    eventTitle: event.title,
    committeeName: event.committee?.name || null,
    title,
    date,
    folderId,
    pdfDataUrl,
  });
  const existingDocument = await prisma.document.findFirst({
    where: {
      cooperativeId,
      tags: { has: archive.stableTag },
    },
  });
  const latestVersion = existingDocument
    ? await prisma.documentVersion.findFirst({
      where: { documentId: existingDocument.id },
      orderBy: { version: 'desc' },
    })
    : null;
  const version = (latestVersion?.version || 0) + 1;
  const author = user?.name || user?.email || 'Secretary';
  const existingDriveFileId = existingDocument?.sourceExternalId || null;
  const uploaded = existingDriveFileId
    ? await drive.files.update({
      fileId: existingDriveFileId,
      requestBody: {
        name: archive.fileName,
        mimeType: 'application/pdf',
      },
      media: {
        mimeType: 'application/pdf',
        body: bufferToStream(archive.pdfBytes),
      },
      fields: 'id, webViewLink, webContentLink',
      supportsAllDrives: true,
    })
    : await drive.files.create({
      requestBody: {
        name: archive.fileName,
        parents: [folderId],
        mimeType: 'application/pdf',
      },
      media: {
        mimeType: 'application/pdf',
        body: bufferToStream(archive.pdfBytes),
      },
      fields: 'id, webViewLink, webContentLink',
      supportsAllDrives: true,
    });
  const fileId = uploaded.data.id;
  if (!fileId) throw new Error('Google Drive did not return a file ID.');
  const sourceWebUrl = uploaded.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;
  const content = `Google Drive PDF archive for meeting ${meetingId}. Replaced automatically when minutes are re-saved.`;

  const document = existingDocument
    ? await prisma.document.update({
      where: { id: existingDocument.id },
      data: {
        title: archive.documentTitle,
        category: 'Minutes',
        url: sourceWebUrl,
        fileType: 'pdf',
        author,
        date: archive.documentDate,
        tags: { set: archive.tags },
        committee: event.committee?.name || null,
        content,
        status: 'ACTIVE',
        visibility: 'MEMBERS',
        storageProvider: 'GOOGLE_DRIVE',
        sourceExternalId: fileId,
        sourceFolderId: folderId,
        sourceWebUrl,
        sourceMimeType: 'application/pdf',
        sourceModifiedAt: new Date(),
      },
    })
    : await prisma.document.create({
      data: {
        cooperativeId,
        title: archive.documentTitle,
        category: 'Minutes',
        url: sourceWebUrl,
        fileType: 'pdf',
        author,
        date: archive.documentDate,
        tags: archive.tags,
        committee: event.committee?.name || null,
        content,
        status: 'ACTIVE',
        visibility: 'MEMBERS',
        storageProvider: 'GOOGLE_DRIVE',
        sourceExternalId: fileId,
        sourceFolderId: folderId,
        sourceWebUrl,
        sourceMimeType: 'application/pdf',
        sourceModifiedAt: new Date(),
      },
    });

  const documentVersion = await prisma.documentVersion.create({
    data: {
      documentId: document.id,
      cooperativeId,
      version,
      source: 'google-drive-minutes',
      storageProvider: 'GOOGLE_DRIVE',
      sourceExternalId: fileId,
      sourceFolderId: folderId,
      sourceWebUrl,
      storageUrl: sourceWebUrl,
      storageKey: fileId,
      fileType: 'pdf',
      mimeType: 'application/pdf',
      sizeBytes: archive.pdfBytes.length,
      ingestionStatus: 'pending',
    },
  });
  const updatedDocument = await prisma.document.update({
    where: { id: document.id },
    data: {
      currentVersionId: documentVersion.id,
      url: sourceWebUrl,
    },
    include: { currentVersion: true },
  });
  await prisma.documentIngestionJob.create({
    data: {
      documentId: document.id,
      documentVersionId: documentVersion.id,
      cooperativeId,
      status: 'queued',
    },
  });

  if (indexDocument) {
    try {
      await indexDocument(prisma, { cooperativeId, documentId: document.id });
    } catch (error: any) {
      console.error('Failed to index Google Drive minutes archive:', error?.message || error);
    }
  }

  return updatedDocument;
};



