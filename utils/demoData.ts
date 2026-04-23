
import { Unit, Tenant, MaintenanceRequest, Announcement, Document, Committee, CoopEvent } from '../types';

export const MOCK_USER = {
  id: 'demo-user-id',
  firstName: 'Demo',
  lastName: 'Admin',
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

export const MOCK_UNITS: Unit[] = [
  { id: 'u1', number: '101', type: '1BR', floor: 1, status: 'Occupied', currentTenantId: 't1' },
  { id: 'u2', number: '102', type: '2BR', floor: 1, status: 'Occupied', currentTenantId: 't2' },
  { id: 'u3', number: '103', type: '2BR', floor: 1, status: 'Vacant', currentTenantId: null },
  { id: 'u4', number: '201', type: '3BR', floor: 2, status: 'Occupied', currentTenantId: 't3' },
  { id: 'u5', number: '202', type: '1BR', floor: 2, status: 'Maintenance', currentTenantId: null },
];

export const MOCK_TENANTS: Tenant[] = [
  { id: 't1', firstName: 'Margaret', lastName: 'Chen', email: 'margaret.chen@email.com', phone: '250-555-0101', status: 'Current', unitId: 'u1', role: 'MEMBER', startDate: '2019-03-15' },
  { id: 't2', firstName: 'David', lastName: 'Okafor', email: 'david.okafor@email.com', phone: '250-555-0102', status: 'Current', unitId: 'u2', role: 'MEMBER', startDate: '2020-07-01' },
  { id: 't3', firstName: 'Aisha', lastName: 'Mohammed', email: 'aisha.mohammed@email.com', phone: '250-555-0109', status: 'Current', unitId: 'u4', role: 'MEMBER', startDate: '2021-08-30' },
  { id: 't4', firstName: 'Oliver', lastName: 'Grant', email: 'oliver.grant@email.com', phone: '250-555-0130', status: 'Waitlist', unitId: null, role: 'MEMBER', startDate: '2024-01-10' },
];

export const MOCK_MAINTENANCE: MaintenanceRequest[] = [
  {
    id: 'm1',
    title: 'Leaking kitchen faucet',
    description: 'The kitchen faucet has been dripping constantly for the past week.',
    status: 'Pending',
    priority: 'Medium',
    category: ['Plumbing'],
    unitId: 'u1',
    requestedBy: 'margaret.chen@email.com',
    createdAt: '2026-03-01T10:00:00Z',
    notes: [
      { id: 'n1', author: 'Member', date: '2026-03-01T10:00:00Z', content: 'Drip is getting worse.' }
    ]
  },
  {
    id: 'm2',
    title: 'Bathroom exhaust fan not working',
    description: 'Fan stopped working in Unit 102.',
    status: 'In Progress',
    priority: 'Medium',
    category: ['Electrical'],
    unitId: 'u2',
    requestedBy: 'david.okafor@email.com',
    createdAt: '2026-02-20T14:00:00Z',
  }
];

export const MOCK_ANNOUNCEMENTS: Announcement[] = [
  { id: 'a1', title: 'Annual General Meeting', content: 'The AGM will be held on April 12th.', type: 'General', priority: 'High', author: 'Board', date: '2026-04-12T14:00:00Z', createdAt: '2026-03-08T09:00:00Z' },
  { id: 'a2', title: 'Water Shutoff', content: 'Scheduled for March 18th 9AM-1PM.', type: 'Maintenance', priority: 'Urgent', author: 'Maintenance Committee', date: '2026-03-18T09:00:00Z', createdAt: '2026-03-06T15:00:00Z' },
];

export const MOCK_DOCUMENTS: Document[] = [
  { id: 'd1', title: 'Co-op Rules 2024', category: 'Bylaws', url: '#', fileType: 'pdf', author: 'Board', date: '2024-01-15T00:00:00Z', createdAt: '2024-01-15T00:00:00Z', tags: ['legal', 'governance'] },
  { id: 'd2', title: 'Pet Policy', category: 'Policies', url: '#', fileType: 'pdf', author: 'Board', date: '2023-09-01T00:00:00Z', createdAt: '2023-09-01T00:00:00Z', tags: ['pets'] },
];

export const MOCK_COMMITTEES: Committee[] = [
  { id: 'c1', name: 'Board of Directors', description: 'Governing body.', chair: 'George Papadopoulos', icon: 'fa-landmark', members: [] },
  { id: 'c2', name: 'Maintenance Committee', description: 'Building upkeep.', chair: 'Thomas Bergstrom', icon: 'fa-wrench', members: [] },
];

export const MOCK_EVENTS: CoopEvent[] = [
  { id: 'e1', title: 'Board Meeting', category: 'Board', location: 'Community Room', time: '19:00', description: 'Monthly meeting.', date: '2026-04-15T19:00:00Z' },
  { id: 'e2', title: 'Community Potluck', category: 'Social', location: 'Courtyard', time: '17:30', description: 'Bring a dish!', date: '2026-04-20T17:30:00Z' },
];
