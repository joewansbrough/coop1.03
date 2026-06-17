const PDF_DATA_URL_PREFIX = 'data:application/pdf;base64,';

const safeFilePart = (value: string) =>
  value
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'Meeting-Minutes';

export const decodePdfDataUrl = (pdfDataUrl: string) => {
  if (typeof pdfDataUrl !== 'string' || !pdfDataUrl.startsWith(PDF_DATA_URL_PREFIX)) {
    throw new Error('A PDF data URL is required.');
  }
  return Buffer.from(pdfDataUrl.slice(PDF_DATA_URL_PREFIX.length), 'base64');
};

export const buildGoogleDriveMinutesArchiveInput = ({
  meetingId,
  eventTitle,
  committeeName,
  title,
  date,
  folderId,
  pdfDataUrl,
}: {
  meetingId: string;
  cooperativeId: string;
  eventTitle: string;
  committeeName?: string | null;
  title?: string | null;
  date?: string | Date | null;
  folderId: string;
  pdfDataUrl: string;
}) => {
  const documentTitle = title?.trim() || `${eventTitle} Minutes`;
  const documentDate = date ? new Date(date) : new Date();
  const stableTag = `minutes-meeting:${meetingId}`;
  const tags = Array.from(new Set([
    documentDate.getFullYear().toString(),
    'Minutes',
    'Meeting Minutes',
    ...(committeeName ? [committeeName] : []),
    stableTag,
  ]));

  return {
    folderId,
    fileName: `${safeFilePart(documentTitle)}.pdf`,
    documentTitle,
    documentDate,
    tags,
    stableTag,
    pdfBytes: decodePdfDataUrl(pdfDataUrl),
  };
};
