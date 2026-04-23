import { Unit, Tenant, MaintenanceRequest, Announcement, Document, Committee, CoopEvent, ScheduledMaintenance } from '../types';

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
    name: 'Oak Bay Housing Co-op',
    slug: 'oak-bay'
  }
};

export const MOCK_UNITS: Unit[] = [
  { id: 'u1', number: '101', type: '1BR', floor: 1, status: 'Occupied' },
  { id: 'u2', number: '102', type: '2BR', floor: 1, status: 'Occupied' },
  { id: 'u3', number: '103', type: '2BR', floor: 1, status: 'Occupied' },
  { id: 'u4', number: '104', type: '3BR', floor: 1, status: 'Occupied' },
  { id: 'u5', number: '105', type: '1BR', floor: 1, status: 'Vacant' },
  { id: 'u6', number: '106', type: '2BR', floor: 1, status: 'Occupied' },
  { id: 'u7', number: '107', type: '1BR', floor: 1, status: 'Occupied' },
  { id: 'u8', number: '108', type: '2BR', floor: 1, status: 'Occupied' },
  { id: 'u9', number: '109', type: '1BR', floor: 1, status: 'Occupied' },
  { id: 'u10', number: '201', type: '2BR', floor: 2, status: 'Occupied' },
  { id: 'u11', number: '202', type: '3BR', floor: 2, status: 'Occupied' },
  { id: 'u12', number: '203', type: '1BR', floor: 2, status: 'Occupied' },
  { id: 'u13', number: '204', type: '2BR', floor: 2, status: 'Maintenance' },
  { id: 'u14', number: '205', type: '3BR', floor: 2, status: 'Occupied' },
  { id: 'u15', number: '206', type: '2BR', floor: 2, status: 'Occupied' },
  { id: 'u16', number: '207', type: '1BR', floor: 2, status: 'Occupied' },
  { id: 'u17', number: '208', type: '1BR', floor: 2, status: 'Occupied' },
  { id: 'u18', number: '209', type: '2BR', floor: 2, status: 'Occupied' },
  { id: 'u19', number: '301', type: '3BR', floor: 3, status: 'Occupied' },
  { id: 'u20', number: '302', type: '2BR', floor: 3, status: 'Occupied' },
];

export const MOCK_TENANTS: Tenant[] = [
  { id: 't1', firstName: 'Margaret', lastName: 'Chen', email: 'margaret.chen@email.com', phone: '250-555-0101', status: 'Current', role: 'MEMBER', startDate: '2019-03-15' },
  { id: 't2', firstName: 'David', lastName: 'Okafor', email: 'david.okafor@email.com', phone: '250-555-0102', status: 'Current', role: 'MEMBER', startDate: '2020-07-01' },
  { id: 't3', firstName: 'Priya', lastName: 'Sharma', email: 'priya.sharma@email.com', phone: '250-555-0103', status: 'Current', role: 'MEMBER', startDate: '2021-01-10' },
  { id: 't4', firstName: 'Robert', lastName: 'Tremblay', email: 'robert.tremblay@email.com', phone: '250-555-0104', status: 'Current', role: 'MEMBER', startDate: '2018-09-01' },
  { id: 't5', firstName: 'Susan', lastName: 'Tremblay', email: 'susan.tremblay@email.com', phone: '250-555-0105', status: 'Current', role: 'MEMBER', startDate: '2018-09-01' },
  { id: 't6', firstName: 'James', lastName: 'Nakamura', email: 'james.nakamura@email.com', phone: '250-555-0106', status: 'Current', role: 'MEMBER', startDate: '2017-05-20' },
  { id: 't7', firstName: 'Linda', lastName: 'Nakamura', email: 'linda.nakamura@email.com', phone: '250-555-0107', status: 'Current', role: 'MEMBER', startDate: '2017-05-20' },
  { id: 't8', firstName: 'Carlos', lastName: 'Rivera', email: 'carlos.rivera@email.com', phone: '250-555-0108', status: 'Current', role: 'MEMBER', startDate: '2022-02-14' },
  { id: 't9', firstName: 'Aisha', lastName: 'Mohammed', email: 'aisha.mohammed@email.com', phone: '250-555-0109', status: 'Current', role: 'MEMBER', startDate: '2021-08-30' },
  { id: 't10', firstName: 'Thomas', lastName: 'Bergstrom', email: 'thomas.bergstrom@email.com', phone: '250-555-0110', status: 'Current', role: 'ADMIN', startDate: '2016-11-01' },
  { id: 't11', firstName: 'Karen', lastName: 'Bergstrom', email: 'karen.bergstrom@email.com', phone: '250-555-0111', status: 'Current', role: 'MEMBER', startDate: '2016-11-01' },
  { id: 't12', firstName: 'Wei', lastName: 'Liu', email: 'wei.liu@email.com', phone: '250-555-0112', status: 'Current', role: 'MEMBER', startDate: '2023-04-01' },
  { id: 't13', firstName: 'Patricia', lastName: 'MacLeod', email: 'patricia.macleod@email.com', phone: '250-555-0113', status: 'Current', role: 'ADMIN', startDate: '2019-06-15' },
  { id: 't14', firstName: 'Kevin', lastName: 'MacLeod', email: 'kevin.macleod@email.com', phone: '250-555-0114', status: 'Current', role: 'MEMBER', startDate: '2019-06-15' },
  { id: 't15', firstName: 'Fatima', lastName: 'Al-Hassan', email: 'fatima.alhassan@email.com', phone: '250-555-0115', status: 'Current', role: 'ADMIN', startDate: '2020-10-01' },
  { id: 't16', firstName: 'George', lastName: 'Papadopoulos', email: 'george.papadopoulos@email.com', phone: '250-555-0116', status: 'Current', role: 'ADMIN', startDate: '2015-03-01' },
  { id: 't17', firstName: 'Helen', lastName: 'Papadopoulos', email: 'helen.papadopoulos@email.com', phone: '250-555-0117', status: 'Current', role: 'MEMBER', startDate: '2015-03-01' },
  { id: 't18', firstName: 'Michael', lastName: 'Johansson', email: 'michael.johansson@email.com', phone: '250-555-0118', status: 'Current', role: 'MEMBER', startDate: '2022-09-01' },
  { id: 't19', firstName: 'Yuki', lastName: 'Tanaka', email: 'yuki.tanaka@email.com', phone: '250-555-0119', status: 'Current', role: 'MEMBER', startDate: '2023-01-15' },
  { id: 't20', firstName: 'Brian', lastName: 'Walsh', email: 'brian.walsh@email.com', phone: '250-555-0120', status: 'Current', role: 'MEMBER', startDate: '2018-07-01' },
  { id: 't21', firstName: 'Catherine', lastName: 'Walsh', email: 'catherine.walsh@email.com', phone: '250-555-0121', status: 'Current', role: 'MEMBER', startDate: '2018-07-01' },
  { id: 't22', firstName: 'Ahmed', lastName: 'Patel', email: 'ahmed.patel@email.com', phone: '250-555-0122', status: 'Current', role: 'MEMBER', startDate: '2017-12-01' },
  { id: 't23', firstName: 'Nadia', lastName: 'Patel', email: 'nadia.patel@email.com', phone: '250-555-0123', status: 'Current', role: 'MEMBER', startDate: '2017-12-01' },
  { id: 't24', firstName: 'Oliver', lastName: 'Grant', email: 'oliver.grant@email.com', phone: '250-555-0130', status: 'Waitlist', role: 'MEMBER', startDate: '2024-01-10' },
  { id: 't25', firstName: 'Sophie', lastName: 'Dubois', email: 'sophie.dubois@email.com', phone: '250-555-0131', status: 'Waitlist', role: 'MEMBER', startDate: '2024-03-22' },
  { id: 't26', firstName: 'Marcus', lastName: 'Williams', email: 'marcus.williams@email.com', phone: '250-555-0132', status: 'Waitlist', role: 'MEMBER', startDate: '2024-05-14' },
  { id: 't27', firstName: 'Eleanor', lastName: 'Frost', email: 'eleanor.frost@email.com', phone: '250-555-0140', status: 'Past', role: 'MEMBER', startDate: '2015-01-01' },
  { id: 't28', firstName: 'Raymond', lastName: 'Kim', email: 'raymond.kim@email.com', phone: '250-555-0141', status: 'Past', role: 'MEMBER', startDate: '2016-06-01' },
];

export const MOCK_MAINTENANCE: MaintenanceRequest[] = [
  { id: 'm1', title: 'Leaking kitchen faucet', description: 'Leaking constantly.', status: 'Pending', priority: 'Medium', category: ['Plumbing'], unitId: 'u1', requestedBy: 'margaret.chen@email.com', createdAt: '2026-02-28', notes: [], expenses: [] },
  { id: 'm2', title: 'Bathroom fan broken', description: 'No exhaust.', status: 'In Progress', priority: 'Medium', category: ['Electrical'], unitId: 'u2', requestedBy: 'david.okafor@email.com', createdAt: '2026-02-20', notes: [], expenses: [] },
  { id: 'm3', title: 'Dishwasher not draining', description: 'Standing water.', status: 'Completed', priority: 'Medium', category: ['Appliance'], unitId: 'u4', requestedBy: 'james.nakamura@email.com', createdAt: '2026-01-15', notes: [], expenses: [] },
  { id: 'm4', title: 'Broken window latch', description: 'Security concern.', status: 'Pending', priority: 'High', category: ['Structural'], unitId: 'u3', requestedBy: 'robert.tremblay@email.com', createdAt: '2026-03-01', notes: [], expenses: [] },
  { id: 'm5', title: 'Heating unit noise', description: 'Loud banging.', status: 'In Progress', priority: 'Low', category: ['HVAC'], unitId: 'u6', requestedBy: 'carlos.rivera@email.com', createdAt: '2026-02-10', notes: [], expenses: [] },
  { id: 'm6', title: 'Water damage on ceiling', description: 'Stain spreading.', status: 'Pending', priority: 'High', category: ['Structural'], unitId: 'u10', requestedBy: 'aisha.mohammed@email.com', createdAt: '2026-03-05', notes: [], expenses: [] },
  { id: 'm7', title: 'Unit 204 renovation', description: 'Full unit reno.', status: 'In Progress', priority: 'Medium', category: ['Structural'], unitId: 'u13', requestedBy: '', createdAt: '2026-02-01', notes: [], expenses: [] },
  { id: 'm8', title: 'Stove burner fail', description: 'Does not ignite.', status: 'Pending', priority: 'Medium', category: ['Appliance'], unitId: 'u12', requestedBy: 'wei.liu@email.com', createdAt: '2026-03-07', notes: [], expenses: [] },
  { id: 'm9', title: 'Parking light out', description: 'Very dark.', status: 'Pending', priority: 'High', category: ['Electrical'], unitId: 'u19', requestedBy: 'george.papadopoulos@email.com', createdAt: '2026-03-03', notes: [], expenses: [] },
];

export const MOCK_ANNOUNCEMENTS: Announcement[] = [
  { id: 'a1', title: 'AGM April 12th', content: 'Annual General Meeting details.', type: 'General', priority: 'High', author: 'Board', date: '2026-03-08' },
  { id: 'a2', title: 'Water Shutoff', content: 'March 18th 9AM-1PM.', type: 'Maintenance', priority: 'Urgent', author: 'Board', date: '2026-03-06' },
  { id: 'a3', title: 'New Recycling Guidelines', content: 'Effective April 1st.', type: 'General', priority: 'Normal', author: 'Board', date: '2026-03-01' },
  { id: 'a4', title: 'Parking Lot Repaving', content: 'March 22nd-23rd.', type: 'Maintenance', priority: 'High', author: 'Board', date: '2026-02-28' },
  { id: 'a5', title: 'Spring Garden Day', content: 'April 5th.', type: 'General', priority: 'Normal', author: 'Board', date: '2026-02-20' },
];

export const MOCK_DOCUMENTS: Document[] = [
  { id: 'd1', title: 'Co-op Rules 2024', category: 'Bylaws', url: '#', fileType: 'pdf', author: 'Board', date: '2024-01-15' },
];

export const MOCK_COMMITTEES: Committee[] = [
  { id: 'c1', name: 'Board', description: 'Gov body.', chair: 'George Papadopoulos', icon: 'fa-landmark' },
  { id: 'c2', name: 'Maintenance', description: 'Upkeep.', chair: 'Thomas Bergstrom', icon: 'fa-wrench' },
  { id: 'c3', name: 'Finance', description: 'Budgeting.', chair: 'Patricia MacLeod', icon: 'fa-dollar-sign' },
  { id: 'c4', name: 'Membership', description: 'Applications.', chair: 'Fatima Al-Hassan', icon: 'fa-users' },
  { id: 'c5', name: 'Social', description: 'Events.', chair: 'Susan Tremblay', icon: 'fa-calendar' },
];

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
