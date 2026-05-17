import type { PrismaClient } from '@prisma/client';

type AccessRuleInput = {
  groupId?: string | null;
  userId?: string | null;
  permission?: string | null;
};

export type DocumentMetadataInput = {
  cooperativeId: string;
  ownerUserId?: string | null;
  userName?: string | null;
  title?: string | null;
  category?: string | null;
  url?: string | null;
  fileType?: string | null;
  author?: string | null;
  date?: string | Date | null;
  tags?: unknown;
  committee?: string | null;
  content?: string | null;
  visibility?: string | null;
  committeeAccess?: string | null;
  storageProvider?: string | null;
  sourceExternalId?: string | null;
  sourceFolderId?: string | null;
  sourceWebUrl?: string | null;
  sourceMimeType?: string | null;
  sourceModifiedAt?: string | Date | null;
  accessRules?: AccessRuleInput[];
};

const sanitizeUtf8 = (value: unknown) =>
  typeof value === 'string' ? value.replace(/\0/g, '') : value;

const sanitizeString = (value: unknown) => {
  const sanitized = sanitizeUtf8(value);
  return typeof sanitized === 'string' ? sanitized.trim() : '';
};

const normalizeDate = (value: string | Date | null | undefined) =>
  value ? new Date(value) : new Date();

const isDriveBacked = (input: DocumentMetadataInput) =>
  input.storageProvider === 'GOOGLE_DRIVE' || Boolean(input.sourceExternalId);

const normalizeTags = (tags: unknown, committee?: string | null) => {
  const currentYear = new Date().getFullYear().toString();
  const providedTags = Array.isArray(tags)
    ? tags.map(tag => sanitizeString(tag)).filter(Boolean)
    : [];
  return Array.from(new Set([
    currentYear,
    ...(committee ? [committee] : []),
    ...providedTags,
  ]));
};

export const createDocumentMetadataRecord = async (
  prisma: PrismaClient,
  input: DocumentMetadataInput,
) => {
  const committee = sanitizeString(input.committee) || null;
  const sourceExternalId = sanitizeString(input.sourceExternalId) || null;
  const sourceWebUrl = sanitizeString(input.sourceWebUrl) || sanitizeString(input.url) || null;
  const storageProvider = input.storageProvider || (sourceExternalId ? 'GOOGLE_DRIVE' : 'EXTERNAL_LINK');
  const title = sanitizeString(input.title) || 'Untitled Document';
  const url = sanitizeString(input.url) || sourceWebUrl || '#';
  const fileType = sanitizeString(input.fileType) || 'txt';
  const sourceMimeType = sanitizeString(input.sourceMimeType) || null;

  const documentData = {
    cooperativeId: input.cooperativeId,
    title,
    category: sanitizeString(input.category) || 'General',
    url,
    fileType,
    author: sanitizeString(input.author) || sanitizeString(input.userName) || 'System',
    date: normalizeDate(input.date),
    tags: normalizeTags(input.tags, committee),
    committee,
    content: input.content ? String(sanitizeUtf8(input.content)) : null,
    visibility: input.visibility || 'MEMBERS',
    committeeAccess: input.committeeAccess || committee || null,
    ownerUserId: input.ownerUserId || null,
    storageProvider,
    sourceExternalId,
    sourceFolderId: sanitizeString(input.sourceFolderId) || null,
    sourceWebUrl,
    sourceMimeType,
    sourceModifiedAt: input.sourceModifiedAt ? new Date(input.sourceModifiedAt) : null,
    accessRules: Array.isArray(input.accessRules) ? {
      create: input.accessRules.map(rule => ({
        cooperativeId: input.cooperativeId,
        groupId: rule.groupId || null,
        userId: rule.userId || null,
        permission: rule.permission || 'VIEW',
        createdBy: input.ownerUserId || null,
      })),
    } : undefined,
  } as any;

  if (!isDriveBacked(input)) {
    return prisma.document.create({
      data: documentData,
      include: { accessRules: true, currentVersion: true },
    });
  }

  if (!sourceExternalId) {
    throw new Error('Google Drive documents require a sourceExternalId file ID.');
  }

  return prisma.$transaction(async (tx) => {
    const createdDocument = await tx.document.create({
      data: documentData,
      include: { accessRules: true },
    });

    const version = await tx.documentVersion.create({
      data: {
        documentId: createdDocument.id,
        cooperativeId: input.cooperativeId,
        version: 1,
        source: 'google-drive',
        storageProvider: 'GOOGLE_DRIVE',
        sourceExternalId,
        sourceFolderId: sanitizeString(input.sourceFolderId) || null,
        sourceWebUrl,
        storageUrl: sourceWebUrl || url || `https://drive.google.com/open?id=${sourceExternalId}`,
        storageKey: null,
        fileType,
        mimeType: sourceMimeType,
        sizeBytes: null,
        ingestionStatus: 'pending',
      },
    } as any);

    await tx.documentIngestionJob.create({
      data: {
        documentId: createdDocument.id,
        documentVersionId: version.id,
        cooperativeId: input.cooperativeId,
        status: 'queued',
      },
    });

    return tx.document.update({
      where: { id: createdDocument.id },
      data: { currentVersionId: version.id },
      include: { accessRules: true, currentVersion: true },
    });
  });
};
