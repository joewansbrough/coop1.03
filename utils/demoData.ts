
import { Unit, Tenant, MaintenanceRequest, Announcement, Document, Committee, CoopEvent } from '../types';

export const MOCK_USER = {
  id: 'demo-user-id',
  firstName: 'Demo',
  lastName: 'Admin',
  name: 'Demo Admin',
  email: 'demo@coophub.bc.ca',
  role: 'ADMIN',
  isAdmin: true,
  isGuest: false,
  cooperativeId: 'demo-coop-id',
  cooperative: {
    name: 'Demo Housing Co-op',
    slug: 'demo-coop'
  }
};

export const MOCK_UNITS: Unit[] = Array.from({ length: 20 }, (_, i) => ({
  id: `u${i + 1}`,
  number: `${100 + i + 1}`,
  type: i % 4 === 0 ? '3BR' : i % 2 === 0 ? '2BR' : '1BR',
  floor: Math.floor(i / 5) + 1,
  status: i % 5 === 0 ? 'Vacant' : 'Occupied',
  currentTenantId: i % 5 === 0 ? null : `t${i + 1}`,
}));

export const MOCK_TENANTS: Tenant[] = [
  ...Array.from({ length: 23 }, (_, i) => ({
    id: `t${i + 1}`,
    firstName: `Member`,
    lastName: `${i + 1}`,
    email: `member${i + 1}@example.com`,
    phone: `250-555-${1000 + i}`,
    status: 'Current',
    unitId: `u${i + 1}`,
    role: 'MEMBER',
    startDate: '2020-01-01',
  })),
  ...Array.from({ length: 5 }, (_, i) => ({
    id: `t${24 + i}`,
    firstName: `Waitlist`,
    lastName: `${i + 1}`,
    email: `waitlist${i + 1}@example.com`,
    phone: `250-555-2000`,
    status: 'Waitlist',
    unitId: undefined,
    role: 'MEMBER',
    startDate: '2024-01-01',
  }))
];

export const MOCK_MAINTENANCE: MaintenanceRequest[] = Array.from({ length: 9 }, (_, i) => ({
  id: `m${i + 1}`,
  title: `Maintenance Issue ${i + 1}`,
  description: `Detail for maintenance issue ${i + 1}`,
  status: i % 3 === 0 ? 'Pending' : i % 3 === 1 ? 'In Progress' : 'Completed',
  priority: i % 3 === 0 ? 'High' : 'Medium',
  category: ['Plumbing'],
  unitId: `u${(i % 20) + 1}`,
  requestedBy: `member${i + 1}@example.com`,
  createdAt: new Date().toISOString(),
}));

export const MOCK_ANNOUNCEMENTS: Announcement[] = Array.from({ length: 5 }, (_, i) => ({
  id: `a${i + 1}`,
  title: `Announcement ${i + 1}`,
  content: `Content for announcement ${i + 1}`,
  type: 'General',
  priority: 'Normal',
  author: 'Board',
  date: new Date().toISOString(),
}));

export const MOCK_DOCUMENTS: Document[] = [
  { id: 'd1', title: 'Rules', category: 'Bylaws', url: '#', fileType: 'pdf', author: 'Board', date: '2024-01-01T00:00:00Z', createdAt: '2024-01-01T00:00:00Z' },
];

export const MOCK_COMMITTEES: Committee[] = Array.from({ length: 5 }, (_, i) => ({
  id: `c${i + 1}`,
  name: `Committee ${i + 1}`,
  description: `Description for committee ${i + 1}`,
  chair: 'Chair Person',
  icon: 'fa-users',
  members: [],
}));

export const MOCK_SCHEDULED_MAINTENANCE: ScheduledMaintenance[] = Array.from({ length: 10 }, (_, i) => ({
  id: `sm${i + 1}`,
  unitId: `u${(i % 20) + 1}`,
  task: i % 2 === 0 ? 'HVAC Filter Change' : 'Smoke Detector Test',
  dueDate: new Date(new Date().setDate(new Date().getDate() + i * 30)).toISOString(),
  frequency: i % 3 === 0 ? 'MONTHLY' : i % 3 === 1 ? 'QUARTERLY' : 'ANNUAL',
  assignedTo: 'Maintenance Team',
  category: i % 2 === 0 ? 'HVAC' : 'SAFETY',
}));

export const MOCK_EVENTS: CoopEvent[] = Array.from({ length: 5 }, (_, i) => ({
  id: `e${i + 1}`,
  title: `Board Meeting ${i + 1}`,
  category: 'Board',
  location: 'Community Room',
  time: '19:00',
  description: `Meeting description ${i + 1}`,
  date: new Date(new Date().setDate(new Date().getDate() + i * 7)).toISOString(),
}));
