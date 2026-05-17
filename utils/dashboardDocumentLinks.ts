import type { Document } from '../types';

export type DashboardDocumentLink =
  | { type: 'route'; href: string }
  | { type: 'external'; href: string };

export type DocumentLibraryDestination =
  | DashboardDocumentLink
  | { type: 'review' };

export const isMinutesDocument = (document: Document) => {
  const searchable = [
    document.category,
    document.title,
    ...(document.tags ?? []),
  ].join(' ').toLowerCase();

  return searchable.includes('minute');
};

export const getMinutesEventId = (document: Document) => {
  const taggedEvent = document.tags?.find(tag => tag.startsWith('minutes-meeting:'));
  return taggedEvent?.split(':')[1] || null;
};

export const getDriveDocumentUrl = (document: Document) => {
  const isDriveDocument = document.storageProvider === 'GOOGLE_DRIVE' || Boolean(document.sourceExternalId);
  if (!isDriveDocument) return null;

  if (document.sourceWebUrl) return document.sourceWebUrl;
  if (document.url && document.url !== '#') return document.url;
  if (document.currentVersion?.storageUrl?.includes('drive.google.com')) return document.currentVersion.storageUrl;
  if (document.sourceExternalId) {
    return `https://drive.google.com/open?id=${encodeURIComponent(document.sourceExternalId)}`;
  }

  return null;
};

export const getDocumentFileUrl = (document: Document) => {
  const driveUrl = getDriveDocumentUrl(document);
  if (driveUrl) return driveUrl;
  if (document.currentVersion?.storageUrl) return document.currentVersion.storageUrl;
  if (document.url && document.url !== '#') return document.url;
  return null;
};

export const isBlobBackedDocument = (document: Document) =>
  Boolean(document.currentVersion?.storageUrl || document.url?.includes('blob.vercel-storage.com'));

export const getDocumentLibraryOriginalUrl = (document: Document) => {
  const driveUrl = getDriveDocumentUrl(document);
  if (driveUrl) return driveUrl;

  if (isBlobBackedDocument(document)) {
    return `/api/documents/${encodeURIComponent(document.id)}/original`;
  }

  return getDocumentFileUrl(document);
};

export const getDashboardDocumentLink = (document: Document): DashboardDocumentLink => {
  if (isMinutesDocument(document)) {
    const eventId = getMinutesEventId(document);
    if (eventId) {
      return { type: 'route', href: `/calendar/${eventId}?tab=minutes` };
    }
  }

  const fileUrl = getDocumentLibraryOriginalUrl(document);
  if (fileUrl) {
    return { type: 'external', href: fileUrl };
  }

  return { type: 'route', href: '/documents' };
};

export const getDocumentLibraryDestination = (
  document: Document,
  { isAdmin }: { isAdmin: boolean },
): DocumentLibraryDestination => {
  const driveUrl = getDriveDocumentUrl(document);
  if (driveUrl) return { type: 'external', href: driveUrl };

  if (isAdmin) return { type: 'review' };

  if (isMinutesDocument(document)) {
    const eventId = getMinutesEventId(document);
    if (eventId) {
      return { type: 'route', href: `/calendar/${eventId}?tab=minutes` };
    }
  }

  const fileUrl = getDocumentLibraryOriginalUrl(document);
  if (fileUrl) {
    return { type: 'external', href: fileUrl };
  }

  return { type: 'review' };
};
