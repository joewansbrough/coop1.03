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

export const getDocumentFileUrl = (document: Document) => {
  if (document.currentVersion?.storageUrl) return document.currentVersion.storageUrl;
  if (document.url && document.url !== '#') return document.url;
  return null;
};

export const isBlobBackedDocument = (document: Document) =>
  Boolean(document.currentVersion?.storageUrl || document.url?.includes('blob.vercel-storage.com'));

export const getDocumentLibraryOriginalUrl = (document: Document) => {
  if (document.storageProvider === 'GOOGLE_DRIVE' || document.sourceExternalId) {
    return `/api/documents/${encodeURIComponent(document.id)}/original`;
  }

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
