import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { driveClient } from './googleDrive.js';

const safeFilename = (filename: string) =>
  filename.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-').toLowerCase() || 'document';

const GOOGLE_WORKSPACE_EXPORTS: Record<string, { mimeType: string; extension: string }> = {
  'application/vnd.google-apps.document': { mimeType: 'text/plain', extension: '.txt' },
  'application/vnd.google-apps.spreadsheet': { mimeType: 'text/csv', extension: '.csv' },
  'application/vnd.google-apps.presentation': { mimeType: 'application/pdf', extension: '.pdf' },
};

export const downloadDriveFileToTemp = async (fileId: string, filename: string, mimeType?: string | null) => {
  const drive = driveClient();
  const metadata = mimeType ? { name: filename, mimeType } : (await drive.files.get({
    fileId,
    fields: 'id,name,mimeType',
    supportsAllDrives: true,
  })).data;
  const sourceMimeType = metadata.mimeType || mimeType || '';
  const exportTarget = GOOGLE_WORKSPACE_EXPORTS[sourceMimeType];
  const downloadName = metadata.name || filename;
  const tempPath = path.join(os.tmpdir(), `${Date.now()}-${safeFilename(downloadName)}${exportTarget?.extension || ''}`);

  try {
    const response = exportTarget
      ? await drive.files.export(
        { fileId, mimeType: exportTarget.mimeType, supportsAllDrives: true } as any,
        { responseType: 'stream' },
      )
      : await drive.files.get(
        { fileId, alt: 'media', supportsAllDrives: true },
        { responseType: 'stream' },
      );

    await pipeline(response.data as any, fs.createWriteStream(tempPath));
    return {
      tempPath,
      mimeType: exportTarget?.mimeType || sourceMimeType || 'application/octet-stream',
      sourceMimeType,
    };
  } catch (error) {
    await fs.promises.unlink(tempPath).catch(() => undefined);
    throw error;
  }
};
