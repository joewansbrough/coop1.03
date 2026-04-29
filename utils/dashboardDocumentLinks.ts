import type { Document } from '../types';

export type DashboardDocumentLink =
  | { type: 'route'; href: string }
  | { type: 'external'; href: string };

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

export const getDashboardDocumentLink = (document: Document): DashboardDocumentLink => {
  if (isMinutesDocument(document)) {
    const eventId = getMinutesEventId(document);
    if (eventId) {
      return { type: 'route', href: `/calendar/${eventId}?tab=minutes` };
    }
  }

  const fileUrl = getDocumentFileUrl(document);
  if (fileUrl) {
    return { type: 'external', href: fileUrl };
  }

  return { type: 'route', href: '/documents' };
};
