type BlobResult = {
  url: string;
  pathname?: string;
};

type ArchiveMinutesPdfInput = {
  prisma: any;
  putBlob: (path: string, bytes: Buffer, options: { access: 'public' | 'private'; contentType: string; token?: string }) => Promise<BlobResult>;
  blobToken?: string;
  blobAccess?: 'public' | 'private';
  meetingId: string;
  cooperativeId: string;
  user?: { name?: string; email?: string };
  pdfDataUrl: string;
  title?: string;
  date?: string;
};

const PDF_DATA_URL_PREFIX = 'data:application/pdf;base64,';

const toSafePathPart = (value: string) => value.replace(/[^a-zA-Z0-9._-]/g, '-');

const decodePdfDataUrl = (pdfDataUrl: string) => {
  if (typeof pdfDataUrl !== 'string' || !pdfDataUrl.startsWith(PDF_DATA_URL_PREFIX)) {
    throw new Error('A PDF data URL is required.');
  }

  return Buffer.from(pdfDataUrl.slice(PDF_DATA_URL_PREFIX.length), 'base64');
};

const getBlobToken = (blobToken?: string) =>
  blobToken || process.env.BLOB_READ_WRITE_TOKEN || process.env.coophub_READ_WRITE_TOKEN;

export const archiveMinutesPdf = async ({
  prisma,
  putBlob,
  blobToken,
  blobAccess = 'private',
  meetingId,
  cooperativeId,
  user,
  pdfDataUrl,
  title,
  date,
}: ArchiveMinutesPdfInput) => {
  const event = await prisma.coopEvent.findFirst({
    where: {
      id: meetingId,
      cooperativeId,
    },
    include: {
      committee: true,
    },
  });

  if (!event) {
    throw new Error('Meeting not found for this cooperative.');
  }

  const stableTag = `minutes-meeting:${meetingId}`;
  const documentTitle = title || `${event.title} Minutes`;
  const documentDate = date ? new Date(date) : new Date();
  const committeeName = event.committee?.name || null;
  const tags = Array.from(new Set([
    new Date().getFullYear().toString(),
    'Minutes',
    'Meeting Minutes',
    ...(committeeName ? [committeeName] : []),
    stableTag,
  ]));

  const existingDocument = await prisma.document.findFirst({
    where: {
      cooperativeId,
      tags: {
        has: stableTag,
      },
    },
  });

  const latestVersion = existingDocument
    ? await prisma.documentVersion.findFirst({
        where: { documentId: existingDocument.id, cooperativeId },
        orderBy: { version: 'desc' },
      })
    : null;
  const version = (latestVersion?.version || 0) + 1;
  const storagePath = `coops/${toSafePathPart(cooperativeId)}/minutes/${toSafePathPart(meetingId)}/minutes-v${version}.pdf`;
  const pdfBytes = decodePdfDataUrl(pdfDataUrl);
  const resolvedBlobToken = getBlobToken(blobToken);

  if (!resolvedBlobToken) {
    throw new Error('No Vercel Blob read-write token is configured for the running server process.');
  }

  const blob = await putBlob(storagePath, pdfBytes, {
    access: blobAccess,
    contentType: 'application/pdf',
    token: resolvedBlobToken,
  });
  const storageUrl = blob.url;
  const storageKey = blob.pathname || storagePath;
  const author = user?.name || user?.email || 'Secretary';
  const content = `PDF archive for meeting ${meetingId}. Replaced automatically when minutes are re-saved.`;

  const document = existingDocument
    ? await prisma.document.update({
        where: { id: existingDocument.id },
        data: {
          title: documentTitle,
          category: 'Minutes',
          url: storageUrl,
          fileType: 'pdf',
          author,
          date: documentDate,
          tags: { set: tags },
          committee: committeeName,
          content,
          status: 'ACTIVE',
          visibility: 'MEMBERS',
        },
      })
    : await prisma.document.create({
        data: {
          cooperativeId,
          title: documentTitle,
          category: 'Minutes',
          url: storageUrl,
          fileType: 'pdf',
          author,
          date: documentDate,
          tags,
          committee: committeeName,
          content,
          status: 'ACTIVE',
          visibility: 'MEMBERS',
        },
      });

  const documentVersion = await prisma.documentVersion.create({
    data: {
      documentId: document.id,
      cooperativeId,
      version,
      source: 'generated-minutes',
      storageUrl,
      storageKey,
      fileType: 'pdf',
      mimeType: 'application/pdf',
      sizeBytes: pdfBytes.length,
      ingestionStatus: 'pending',
    },
  });

  const updatedDocument = await prisma.document.update({
    where: { id: document.id },
    data: {
      currentVersionId: documentVersion.id,
      url: storageUrl,
    },
    include: {
      currentVersion: true,
    },
  });

  await prisma.documentIngestionJob.create({
    data: {
      documentId: document.id,
      documentVersionId: documentVersion.id,
      cooperativeId,
      status: 'queued',
    },
  });

  return updatedDocument;
};
