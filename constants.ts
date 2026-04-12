
import { Unit, Tenant, MaintenanceRequest, Document, RequestStatus, Announcement, Message, CoopEvent, Committee, ScheduledMaintenance, RepairQuote, Notification, ParticipationRecord } from './types';

export const MOCK_UNITS: Unit[] = [];
export const MOCK_TENANTS: Tenant[] = [];
export const MOCK_PARTICIPATION: ParticipationRecord[] = [];
export const MOCK_QUOTES: RepairQuote[] = [];
export const MOCK_NOTIFICATIONS: Notification[] = [];
export const MOCK_REQUESTS: MaintenanceRequest[] = [];
export const MOCK_EVENTS: CoopEvent[] = [];
export const MOCK_COMMITTEES: Committee[] = [];
export const MOCK_SCHEDULED: ScheduledMaintenance[] = [];
export const MOCK_DOCS: Document[] = [
  {
    id: 'd1',
    title: 'Co-op Bylaws 2024',
    category: 'Bylaws',
    url: '#',
    fileType: 'pdf',
    date: '2024-01-15',
    author: 'Board of Directors',
    content: 'The Co-operative Association Act of BC governs this association. General meetings require 14 days notice. Board members are elected for 2-year terms. Quorum for general meetings is 15% of members.',
    tags: ['legal', 'governance', 'bylaws']
  },
  {
    id: 'd2',
    title: 'Pet Policy',
    category: 'Policy',
    url: '#',
    fileType: 'pdf',
    date: '2023-11-10',
    author: 'Policy Committee',
    content: 'Members may keep up to two domestic pets. Dogs must be leashed in common areas. Exotic animals are prohibited. Pet owners are responsible for any damage caused by their pets.',
    tags: ['pets', 'rules', 'living']
  },
  {
    id: 'd3',
    title: 'Subletting Rules',
    category: 'Policy',
    url: '#',
    fileType: 'pdf',
    date: '2024-02-01',
    author: 'Board of Directors',
    content: 'Subletting is permitted for a maximum of 12 months with prior Board approval. Members must have resided in the co-op for at least 2 years before applying to sublet. A sublet fee of $50/month applies.',
    tags: ['sublet', 'occupancy', 'rules']
  }
];
export const MOCK_ANNOUNCEMENTS: Announcement[] = [];
export const MOCK_MESSAGES: Message[] = [];
