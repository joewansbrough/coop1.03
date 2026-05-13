import type { Announcement, CoopEvent, Document, MaintenanceRequest } from '../types';
import { getDashboardDocumentLink } from './dashboardDocumentLinks';

export type GlobalSearchResult = {
  id: string;
  kind: 'document' | 'event' | 'announcement' | 'maintenance';
  label: string;
  title: string;
  description: string;
  href: string;
  icon: string;
  external?: boolean;
};

type SearchData = {
  documents: Document[];
  events: CoopEvent[];
  announcements: Announcement[];
  maintenance: MaintenanceRequest[];
};

type Candidate = GlobalSearchResult & {
  haystack: string;
};

const compact = (parts: Array<string | undefined | null | string[]>) =>
  parts.flatMap(part => Array.isArray(part) ? part : [part])
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

const dateLabel = (date?: string) => {
  if (!date) return '';
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const scoreCandidate = (candidate: Candidate, query: string) => {
  const title = candidate.title.toLowerCase();
  if (title === query) return 0;
  if (title.startsWith(query)) return 1;
  if (title.includes(query)) return 2;
  return 3;
};

export const buildGlobalSearchResults = (
  query: string,
  data: SearchData,
  limit = 8,
): GlobalSearchResult[] => {
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery.length < 2) return [];

  const documentCandidates: Candidate[] = data.documents.map(document => {
    const destination = getDashboardDocumentLink(document);
    return {
      id: `document-${document.id}`,
      kind: 'document',
      label: 'Document',
      title: document.title,
      description: [document.category, document.committee, dateLabel(document.date)].filter(Boolean).join(' · '),
      href: destination.href,
      icon: 'fa-file-lines',
      external: destination.type === 'external',
      haystack: compact([document.title, document.category, document.committee, document.author, document.date, document.tags]),
    };
  });

  const eventCandidates: Candidate[] = data.events.map(event => ({
    id: `event-${event.id}`,
    kind: 'event',
    label: 'Calendar',
    title: event.title,
    description: [event.category, dateLabel(event.date), event.location].filter(Boolean).join(' · '),
    href: `/calendar/${event.id}`,
    icon: 'fa-calendar-days',
    haystack: compact([event.title, event.category, event.description, event.location, event.date]),
  }));

  const announcementCandidates: Candidate[] = data.announcements.map(announcement => ({
    id: `announcement-${announcement.id}`,
    kind: 'announcement',
    label: 'Announcement',
    title: announcement.title,
    description: [announcement.type, announcement.priority, dateLabel(announcement.date)].filter(Boolean).join(' · '),
    href: `/announcements/${announcement.id}`,
    icon: 'fa-bullhorn',
    haystack: compact([announcement.title, announcement.content, announcement.type, announcement.priority, announcement.author, announcement.date]),
  }));

  const maintenanceCandidates: Candidate[] = data.maintenance.map(request => ({
    id: `maintenance-${request.id}`,
    kind: 'maintenance',
    label: 'Maintenance',
    title: request.title,
    description: [request.status, request.priority, ...(request.category ?? [])].filter(Boolean).join(' · '),
    href: `/maintenance/${request.id}`,
    icon: 'fa-screwdriver-wrench',
    haystack: compact([request.title, request.description, request.status, request.priority, request.category, request.unitId, request.urgency]),
  }));

  return [
    ...documentCandidates,
    ...eventCandidates,
    ...announcementCandidates,
    ...maintenanceCandidates,
  ]
    .filter(candidate => candidate.haystack.includes(normalizedQuery))
    .sort((a, b) => scoreCandidate(a, normalizedQuery) - scoreCandidate(b, normalizedQuery) || a.title.localeCompare(b.title))
    .slice(0, limit)
    .map(({ haystack, ...result }) => result);
};
