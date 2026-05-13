import {
  Announcement,
  Building,
  Committee,
  CoopEvent,
  Document,
  MaintenancePriority,
  MaintenanceRequest,
  MinutesTemplate,
  Notification,
  RequestStatus,
  ScheduledMaintenance,
  Tenant,
  Unit,
} from '../types';

export const MOCK_USER = {
  id: 'demo-user-id',
  tenantId: 't-ob-hc',
  firstName: 'OB',
  lastName: 'HC',
  name: 'OB HC',
  email: 'ob.hc@email.com',
  role: 'ADMIN',
  isAdmin: true,
  isGuest: false,
  cooperativeId: 'demo-coop-id',
  cooperative: {
    name: 'Oak Bay Housing Co-op',
    slug: 'oak-bay',
  },
};

const unitDefs = [
  ['101', '1BR', 1, 'Occupied'],
  ['102', '2BR', 1, 'Occupied'],
  ['103', '2BR', 1, 'Occupied'],
  ['104', '3BR', 1, 'Occupied'],
  ['105', '1BR', 1, 'Vacant'],
  ['106', '2BR', 1, 'Occupied'],
  ['107', '1BR', 1, 'Occupied'],
  ['108', '2BR', 1, 'Occupied'],
  ['109', '1BR', 1, 'Occupied'],
  ['201', '2BR', 2, 'Occupied'],
  ['202', '3BR', 2, 'Occupied'],
  ['203', '1BR', 2, 'Occupied'],
  ['204', '2BR', 2, 'Maintenance'],
  ['205', '3BR', 2, 'Occupied'],
  ['206', '2BR', 2, 'Occupied'],
  ['207', '1BR', 2, 'Occupied'],
  ['208', '1BR', 2, 'Occupied'],
  ['209', '2BR', 2, 'Occupied'],
  ['210', '1BR', 2, 'Occupied'],
  ['301', '3BR', 3, 'Occupied'],
  ['302', '2BR', 3, 'Occupied'],
  ['303', '1BR', 3, 'Occupied'],
  ['304', '2BR', 3, 'Vacant'],
  ['305', '3BR', 3, 'Occupied'],
  ['306', '4BR', 3, 'Occupied'],
  ['307', '2BR', 3, 'Occupied'],
  ['308', '1BR', 3, 'Occupied'],
  ['309', '2BR', 3, 'Occupied'],
  ['310', '3BR', 3, 'Occupied'],
  ['401', '2BR', 4, 'Occupied'],
  ['402', '1BR', 4, 'Occupied'],
  ['403', '2BR', 4, 'Occupied'],
  ['404', '1BR', 4, 'Occupied'],
  ['405', '2BR', 4, 'Vacant'],
  ['406', '1BR', 4, 'Occupied'],
  ['407', '2BR', 4, 'Occupied'],
] as const;

const tenantDefs = [
  ['Margaret', 'Chen', 'margaret.chen@email.com', '250-555-0101', '2019-03-15', 'Current', '101'],
  ['David', 'Okafor', 'david.okafor@email.com', '250-555-0102', '2020-07-01', 'Current', '102'],
  ['Priya', 'Sharma', 'priya.sharma@email.com', '250-555-0103', '2021-01-10', 'Current', '102'],
  ['Robert', 'Tremblay', 'robert.tremblay@email.com', '250-555-0104', '2018-09-01', 'Current', '103'],
  ['Susan', 'Tremblay', 'susan.tremblay@email.com', '250-555-0105', '2018-09-01', 'Current', '103'],
  ['James', 'Nakamura', 'james.nakamura@email.com', '250-555-0106', '2017-05-20', 'Current', '104'],
  ['Linda', 'Nakamura', 'linda.nakamura@email.com', '250-555-0107', '2017-05-20', 'Current', '104'],
  ['Carlos', 'Rivera', 'carlos.rivera@email.com', '250-555-0108', '2022-02-14', 'Current', '106'],
  ['Aisha', 'Mohammed', 'aisha.mohammed@email.com', '250-555-0109', '2021-08-30', 'Current', '201'],
  ['Thomas', 'Bergstrom', 'thomas.bergstrom@email.com', '250-555-0110', '2016-11-01', 'Current', '202'],
  ['Karen', 'Bergstrom', 'karen.bergstrom@email.com', '250-555-0111', '2016-11-01', 'Current', '202'],
  ['Wei', 'Liu', 'wei.liu@email.com', '250-555-0112', '2023-04-01', 'Current', '203'],
  ['Patricia', 'MacLeod', 'patricia.macleod@email.com', '250-555-0113', '2019-06-15', 'Current', '205'],
  ['Kevin', 'MacLeod', 'kevin.macleod@email.com', '250-555-0114', '2019-06-15', 'Current', '205'],
  ['Fatima', 'Al-Hassan', 'fatima.alhassan@email.com', '250-555-0115', '2020-10-01', 'Current', '206'],
  ['George', 'Papadopoulos', 'george.papadopoulos@email.com', '250-555-0116', '2015-03-01', 'Current', '301'],
  ['Helen', 'Papadopoulos', 'helen.papadopoulos@email.com', '250-555-0117', '2015-03-01', 'Current', '301'],
  ['Michael', 'Johansson', 'michael.johansson@email.com', '250-555-0118', '2022-09-01', 'Current', '302'],
  ['Yuki', 'Tanaka', 'yuki.tanaka@email.com', '250-555-0119', '2023-01-15', 'Current', '303'],
  ['Brian', 'Walsh', 'brian.walsh@email.com', '250-555-0120', '2018-07-01', 'Current', '305'],
  ['Catherine', 'Walsh', 'catherine.walsh@email.com', '250-555-0121', '2018-07-01', 'Current', '305'],
  ['Ahmed', 'Patel', 'ahmed.patel@email.com', '250-555-0122', '2017-12-01', 'Current', '306'],
  ['Nadia', 'Patel', 'nadia.patel@email.com', '250-555-0123', '2017-12-01', 'Current', '306'],
  ['Ingrid', 'Sorensen', 'ingrid.sorensen@email.com', '250-555-0124', '2021-05-01', 'Current', '107'],
  ['Paulo', 'Ferreira', 'paulo.ferreira@email.com', '250-555-0125', '2022-11-15', 'Current', '108'],
  ['Diana', 'Ferreira', 'diana.ferreira@email.com', '250-555-0126', '2022-11-15', 'Current', '108'],
  ['Lena', 'Kowalski', 'lena.kowalski@email.com', '250-555-0127', '2023-08-01', 'Current', '109'],
  ['Derek', 'Munroe', 'derek.munroe@email.com', '250-555-0128', '2020-04-01', 'Current', '207'],
  ['Amara', 'Diallo', 'amara.diallo@email.com', '250-555-0129', '2024-02-01', 'Current', '208'],
  ['Stefan', 'Novak', 'stefan.novak@email.com', '250-555-0133', '2021-09-15', 'Current', '209'],
  ['Jana', 'Novak', 'jana.novak@email.com', '250-555-0134', '2021-09-15', 'Current', '209'],
  ['Trevor', 'Osei', 'trevor.osei@email.com', '250-555-0135', '2022-06-01', 'Current', '307'],
  ['Miriam', 'Goldstein', 'miriam.goldstein@email.com', '250-555-0136', '2023-03-15', 'Current', '308'],
  ['Kenji', 'Watanabe', 'kenji.watanabe@email.com', '250-555-0137', '2020-12-01', 'Current', '309'],
  ['Yuna', 'Watanabe', 'yuna.watanabe@email.com', '250-555-0138', '2020-12-01', 'Current', '309'],
  ['Bernard', 'Lefebvre', 'bernard.lefebvre@email.com', '250-555-0150', '2024-06-01', 'Current', '401'],
  ['Claire', 'Lefebvre', 'claire.lefebvre@email.com', '250-555-0151', '2024-06-01', 'Current', '401'],
  ['Ravi', 'Krishnamurthy', 'ravi.krishnamurthy@email.com', '250-555-0152', '2024-07-15', 'Current', '402'],
  ['Elena', 'Vasquez', 'elena.vasquez@email.com', '250-555-0153', '2024-08-01', 'Current', '403'],
  ['Marco', 'Vasquez', 'marco.vasquez@email.com', '250-555-0154', '2024-08-01', 'Current', '403'],
  ['Hana', 'Becker', 'hana.becker@email.com', '250-555-0155', '2024-09-01', 'Current', '404'],
  ['Isaiah', 'Campbell', 'isaiah.campbell@email.com', '250-555-0156', '2025-01-15', 'Current', '406'],
  ['Natasha', 'Ivanova', 'natasha.ivanova@email.com', '250-555-0157', '2025-02-01', 'Current', '407'],
  ['Dmitri', 'Ivanov', 'dmitri.ivanov@email.com', '250-555-0158', '2025-02-01', 'Current', '407'],
  ['Maya', 'Ellison', 'maya.ellison@email.com', '250-555-9999', '2025-05-01', 'Current', '210'],
  ['Alice', 'Waites', 'alice.wait@email.com', '250-555-1001', '2026-01-01', 'Waitlist', null],
  ['Bob', 'Waites', 'bob.wait@email.com', '250-555-1002', '2026-01-01', 'Waitlist', null],
  ['Sarah', 'Jenkins', 'sarah.j@email.com', '250-555-1003', '2026-02-15', 'Waitlist', null],
  ['Mike', 'Ross', 'mike.ross@email.com', '250-555-1004', '2026-03-01', 'Waitlist', null],
  ['Rachel', 'Zane', 'rachel.z@email.com', '250-555-1005', '2026-03-01', 'Waitlist', null],
  ['Harvey', 'Specter', 'harvey.s@email.com', '250-555-1006', '2026-03-10', 'Waitlist', null],
  ['Donna', 'Paulsen', 'donna.p@email.com', '250-555-1007', '2026-03-10', 'Waitlist', null],
  ['Louis', 'Litt', 'louis.l@email.com', '250-555-1008', '2026-04-01', 'Waitlist', null],
] as const;

const adminEmails = new Set([
  'joewcoupons@gmail.com',
  'wwansbro@gmail.com',
  'maya.ellison@email.com',
  'samisaeed123@gmail.com',
  'margaret.chen@email.com',
  'ob.hc@email.com',
]);

const unitIdByNumber = new Map(unitDefs.map(([number], index) => [number, `u${index + 1}`]));
const DEMO_OB_TENANT_ID = 't-ob-hc';
const DEMO_OB_UNIT_NUMBER = '101';
const DEMO_OB_UNIT_ID = unitIdByNumber.get(DEMO_OB_UNIT_NUMBER) || 'u1';
const tenantIdByEmail = new Map([
  ...tenantDefs.map((tenant, index) => [tenant[2], `t${index + 1}`] as const),
  ['ob.hc@email.com', DEMO_OB_TENANT_ID] as const,
]);

export const MOCK_BUILDINGS: Building[] = [
  {
    id: 'b1',
    cooperativeId: 'demo-coop-id',
    name: 'Main Building',
    code: 'MAIN',
    address: '1234 Foul Bay Road',
    sortOrder: 1,
  },
];

export const MOCK_TENANTS: Tenant[] = [
  ...tenantDefs.map(([firstName, lastName, email, phone, startDate, status, unitNumber], index) => ({
  id: `t${index + 1}`,
  firstName,
  lastName,
  email,
  phone,
  startDate,
  status,
  unitId: unitNumber ? unitIdByNumber.get(unitNumber) : undefined,
  role: adminEmails.has(email.toLowerCase()) ? 'ADMIN' : 'MEMBER',
  history: unitNumber
    ? [{
        id: `h${index + 1}`,
        tenantId: `t${index + 1}`,
        unitId: unitIdByNumber.get(unitNumber) || '',
        startDate,
        moveReason: 'Initial Seed Residency',
      }]
    : [],
  })),
  {
    id: DEMO_OB_TENANT_ID,
    firstName: 'OB',
    lastName: 'HC',
    email: 'ob.hc@email.com',
    phone: '250-555-0199',
    startDate: '2025-10-01',
    status: 'Current',
    unitId: DEMO_OB_UNIT_ID,
    role: 'ADMIN',
    notes: 'Default demo resident profile with complete unit, service, committee, and history context.',
    history: [
      {
        id: 'h-ob-hc-previous',
        tenantId: DEMO_OB_TENANT_ID,
        unitId: unitIdByNumber.get('304') || 'u23',
        startDate: '2023-04-15',
        endDate: '2025-09-30',
        moveReason: 'Internal transfer after accessibility review',
      },
      {
        id: 'h-ob-hc-current',
        tenantId: DEMO_OB_TENANT_ID,
        unitId: DEMO_OB_UNIT_ID,
        startDate: '2025-10-01',
        moveReason: 'Internal transfer to maintenance-monitored unit',
      },
    ],
  },
];

export const MOCK_UNITS: Unit[] = unitDefs.map(([number, type, floor, status], index) => {
  const id = `u${index + 1}`;
  const currentTenant = MOCK_TENANTS.find(tenant => tenant.unitId === id && tenant.status === 'Current');
  const isDemoUserUnit = number === DEMO_OB_UNIT_NUMBER;
  return {
    id,
    number,
    type,
    floor,
    buildingId: 'b1',
    building: MOCK_BUILDINGS[0],
    status,
    currentTenantId: isDemoUserUnit ? DEMO_OB_TENANT_ID : currentTenant?.id,
    occupancyHistory: isDemoUserUnit ? [
      {
        id: 'u101-history-evelyn-hart',
        tenantId: 'past-u101-evelyn',
        unitId: id,
        tenant: {
          id: 'past-u101-evelyn',
          firstName: 'Evelyn',
          lastName: 'Hart',
          email: 'evelyn.hart.archive@email.com',
          phone: '250-555-0188',
          startDate: '2014-05-01',
          status: 'Past',
          role: 'MEMBER',
        },
        startDate: '2014-05-01',
        endDate: '2019-02-28',
        moveReason: 'Moved to be closer to family',
      },
      {
        id: 'u101-history-ob-previous-review',
        tenantId: DEMO_OB_TENANT_ID,
        unitId: id,
        tenant: MOCK_TENANTS.find(tenant => tenant.id === DEMO_OB_TENANT_ID),
        startDate: '2025-10-01',
        endDate: '2025-10-01',
        moveReason: 'Current residency opened after internal transfer',
      },
    ] : undefined,
  };
});

const maintenanceDefs = [
  ['Leaking kitchen faucet', 'The kitchen faucet has been dripping constantly and water is pooling under the sink cabinet.', RequestStatus.PENDING, MaintenancePriority.MEDIUM, 'Plumbing', '101', 'ob.hc@email.com'],
  ['Bathroom exhaust fan not working', 'The exhaust fan stopped working and condensation is building up on the ceiling.', RequestStatus.IN_PROGRESS, MaintenancePriority.MEDIUM, 'Electrical', '102', 'david.okafor@email.com'],
  ['Broken window latch - balcony door', 'The balcony door latch does not lock properly, creating a security concern.', RequestStatus.COMPLETED, MaintenancePriority.HIGH, 'Safety', '104', 'james.nakamura@email.com'],
  ['Hallway light flickering', 'Light fixture near unit 205 flickers throughout the evening.', RequestStatus.COMPLETED, MaintenancePriority.LOW, 'Electrical', '205', 'patricia.macleod@email.com'],
  ['No hot water', 'Hot water is not available in the unit.', RequestStatus.PENDING, MaintenancePriority.HIGH, 'Plumbing', '301', 'george.papadopoulos@email.com'],
  ['Fridge making loud noise', 'Internal fan may be failing and the appliance is very loud.', RequestStatus.IN_PROGRESS, MaintenancePriority.LOW, 'Appliance', '306', 'ahmed.patel@email.com'],
  ['Drafty balcony door', 'Weather stripping needs replacement before next rain cycle.', RequestStatus.PENDING, MaintenancePriority.MEDIUM, 'Structural', '407', 'natasha.ivanova@email.com'],
  ['Intercom not buzzing', 'Resident can hear guests but cannot release the entrance door.', RequestStatus.COMPLETED, MaintenancePriority.MEDIUM, 'Electrical', '201', 'aisha.mohammed@email.com'],
  ['Loose floorboards', 'Several living room boards are lifting and could become a tripping hazard.', RequestStatus.PENDING, MaintenancePriority.LOW, 'Structural', '109', 'lena.kowalski@email.com'],
  ['Slow drain in tub', 'Standing water remains after showers.', RequestStatus.COMPLETED, MaintenancePriority.MEDIUM, 'Plumbing', '402', 'ravi.krishnamurthy@email.com'],
  ['Clogged gutter', 'Overflowing gutter is draining onto the balcony during rain.', RequestStatus.PENDING, MaintenancePriority.MEDIUM, 'Exterior', '401', 'bernard.lefebvre@email.com'],
  ['Loose railing', 'External stairs near parking have a loose railing.', RequestStatus.IN_PROGRESS, MaintenancePriority.HIGH, 'Safety', '101', 'ob.hc@email.com'],
  ['Baseboard heater serviced', 'Bedroom baseboard heater was cycling inconsistently and was inspected, cleaned, and recalibrated.', RequestStatus.COMPLETED, MaintenancePriority.MEDIUM, 'HVAC', '101', 'ob.hc@email.com'],
  ['Entry threshold repaired', 'Front entry threshold was loose after the fall rain cycle and has been secured with new fasteners.', RequestStatus.COMPLETED, MaintenancePriority.LOW, 'Structural', '101', 'ob.hc@email.com'],
] as const;

export const MOCK_MAINTENANCE: MaintenanceRequest[] = maintenanceDefs.map(([title, description, status, priority, category, unitNumber, requestedBy], index) => ({
  id: `m${index + 1}`,
  title,
  description,
  status,
  priority,
  category: [category],
  unitId: unitIdByNumber.get(unitNumber) || '',
  tenantId: tenantIdByEmail.get(requestedBy),
  requestedBy,
  createdAt: new Date(2026, 2, Math.min(index + 1, 28)).toISOString(),
  notes: index < 3 ? [{ id: `mn${index + 1}`, author: 'Board Admin', date: '2026-03-10T10:00:00Z', content: 'Seeded maintenance note for demo review.' }] : [],
  expenses: status === RequestStatus.COMPLETED ? [{ id: `ex${index + 1}`, item: 'Contractor service', cost: 125 + index * 15, date: '2026-03-12' }] : [],
}));

export const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: 'n1',
    cooperativeId: 'demo-coop-id',
    audience: 'admin',
    title: 'High priority maintenance request',
    body: 'Loose railing has been flagged for review.',
    type: 'maintenance',
    severity: 'high',
    entityType: 'maintenance',
    entityId: 'm12',
    actionUrl: '/admin/maintenance/m12',
    createdAt: '2026-05-01T09:00:00Z',
    timestamp: '2026-05-01T09:00:00Z',
    readAt: null,
    isRead: false,
  },
  {
    id: 'n2',
    cooperativeId: 'demo-coop-id',
    audience: 'member',
    title: 'AGM minutes published',
    body: 'The latest AGM minutes are available in the document library.',
    type: 'governance',
    severity: 'info',
    entityType: 'document',
    entityId: 'd3',
    actionUrl: '/documents',
    createdAt: '2026-04-29T12:00:00Z',
    timestamp: '2026-04-29T12:00:00Z',
    readAt: '2026-04-30T12:00:00Z',
    isRead: true,
  },
];

export const MOCK_ANNOUNCEMENTS: Announcement[] = [
  { id: 'a1', title: 'Annual General Meeting - April 12th', content: 'Co-op AGM details and agenda in the common room.', type: 'General', priority: 'High', author: 'Board', date: '2026-03-08' },
  { id: 'a2', title: 'New Pet Policy Adopted', content: 'The new rules regarding pet size and registration are now in effect.', type: 'Policy', priority: 'Medium', author: 'Board', date: '2026-01-15' },
  { id: 'a3', title: 'Spring Landscaping Clean-up', content: 'Volunteers needed for Saturday morning garden work.', type: 'Event', priority: 'Low', author: 'Maintenance', date: '2026-03-20' },
  { id: 'a4', title: 'Elevator Maintenance Schedule', content: 'Elevator will be out of service for inspection on Wednesday.', type: 'Alert', priority: 'High', author: 'Maintenance', date: '2026-04-01' },
  { id: 'a5', title: 'Parking Lot Repaving', content: 'Please move all vehicles by 8 AM on Monday morning.', type: 'Alert', priority: 'High', author: 'Board', date: '2026-04-10' },
];

export const MOCK_EVENTS: CoopEvent[] = [
  { id: 'e1', title: 'Co-op AGM', description: 'Official annual meeting and board elections.', date: '2026-04-12T19:00:00Z', time: '19:00', location: 'Common Room', category: 'Meeting', committeeId: 'c1' },
  { id: 'e2', title: 'Block Party Prep', description: 'Planning meeting for the Cook Street Block Party.', date: '2026-04-20T18:30:00Z', time: '18:30', location: 'Unit 210', category: 'Social' },
  { id: 'e3', title: 'Community Garden Kickoff', description: 'First planting session of the year.', date: '2026-05-02T10:00:00Z', time: '10:00', location: 'Back Courtyard', category: 'Social' },
  { id: 'e4', title: 'Coffee & Conversation', description: 'Casual meetup for new and old members.', date: '2026-05-15T11:00:00Z', time: '11:00', location: 'Common Room', category: 'Social' },
  { id: 'e5', title: 'Board Meeting', description: 'Monthly oversight meeting.', date: '2026-04-28T19:30:00Z', time: '19:30', location: 'Zoom', category: 'Board' },
  { id: 'e6', title: 'Summer BBQ', description: 'Annual summer social.', date: '2026-07-04T16:00:00Z', time: '16:00', location: 'Front Lawn', category: 'Social' },
  { id: 'e7', title: 'Emergency Drill', description: 'Fire safety walkthrough for all residents.', date: '2026-05-10T14:00:00Z', time: '14:00', location: 'Main Entrance', category: 'Maintenance' },
  { id: 'e8', title: 'Finance Committee Review', description: 'Operating budget and reserve fund review.', date: '2026-06-09T18:00:00Z', time: '18:00', location: 'Common Room', category: 'Meeting' },
  { id: 'e9', title: 'Maintenance Committee Walkthrough', description: 'Shared-area walkthrough and open request triage.', date: '2026-06-18T10:00:00Z', time: '10:00', location: 'Lobby', category: 'Maintenance' },
  { id: 'e17', title: 'May Board Meeting', description: 'Monthly board review of maintenance priorities, member communications, and policy follow-up.', date: '2026-05-04T19:00:00Z', time: '19:00', location: 'Common Room', category: 'Meeting', committeeId: 'c1' },
  { id: 'e18', title: 'Finance Committee Check-in', description: 'Review arrears reporting, insurance renewal assumptions, and reserve contribution timing.', date: '2026-05-06T18:00:00Z', time: '18:00', location: 'Library Room', category: 'Meeting', committeeId: 'c3' },
  { id: 'e19', title: 'Maintenance Committee Review', description: 'Triage spring repair requests and confirm contractor follow-up for shared areas.', date: '2026-05-08T17:30:00Z', time: '17:30', location: 'Workshop', category: 'Meeting', committeeId: 'c2' },
  { id: 'e20', title: 'Membership Committee Debrief', description: 'Review orientation feedback, waitlist communication, and upcoming interview scheduling.', date: '2026-05-12T18:30:00Z', time: '18:30', location: 'Library Room', category: 'Meeting', committeeId: 'c4' },
  { id: 'e10', title: 'Board Package Review', description: 'Directors review agenda materials, resident correspondence, and follow-up items before the next board meeting.', date: '2026-06-02T18:30:00Z', time: '18:30', location: 'Common Room', category: 'Meeting', committeeId: 'c1' },
  { id: 'e11', title: 'Board Policy Working Session', description: 'Focused board session for bylaw updates, communications planning, and document readiness.', date: '2026-06-23T19:00:00Z', time: '19:00', location: 'Zoom', category: 'Meeting', committeeId: 'c1' },
  { id: 'e12', title: 'Maintenance Committee Triage', description: 'Review open repair requests, contractor follow-ups, and preventive maintenance priorities.', date: '2026-06-12T17:30:00Z', time: '17:30', location: 'Workshop', category: 'Meeting', committeeId: 'c2' },
  { id: 'e13', title: 'Finance Committee Budget Review', description: 'Review operating budget assumptions, arrears reporting, and reserve planning updates.', date: '2026-06-16T18:00:00Z', time: '18:00', location: 'Common Room', category: 'Meeting', committeeId: 'c3' },
  { id: 'e14', title: 'Membership Orientation Planning', description: 'Prepare the next orientation package and review waitlist interview scheduling.', date: '2026-06-20T11:00:00Z', time: '11:00', location: 'Library Room', category: 'Meeting', committeeId: 'c4' },
  { id: 'e15', title: 'Social Committee Summer Planning', description: 'Coordinate volunteers, supplies, and notices for summer community events.', date: '2026-06-27T14:00:00Z', time: '14:00', location: 'Courtyard', category: 'Meeting', committeeId: 'c5' },
  { id: 'e16', title: 'Landscape Committee Garden Walk', description: 'Walk the exterior areas and confirm seasonal planting and cleanup tasks.', date: '2026-06-29T09:30:00Z', time: '09:30', location: 'Garden Shed', category: 'Meeting', committeeId: 'c6' },
];

export const MOCK_DOCUMENTS: Document[] = [
  { id: 'd1', title: 'Rules & Regulations', category: 'Bylaws', url: '#', fileType: 'pdf', author: 'Board', date: '2020-01-01', tags: ['rules', 'governance'] },
  { id: 'd2', title: 'Pet Policy 2026', category: 'Policies', url: '#', fileType: 'pdf', author: 'Board', date: '2026-01-15', tags: ['pets', 'policy'] },
  { id: 'd3', title: 'AGM Minutes March 2026', category: 'Minutes', url: '#', fileType: 'pdf', author: 'Secretary', date: '2026-03-10', tags: ['minutes', 'agm', 'minutes-meeting:e1', 'Board of Directors'], committee: 'Board of Directors' },
  { id: 'd4', title: 'Co-op Membership Application', category: 'Forms', url: '#', fileType: 'pdf', author: 'Admin', date: '2025-11-01', tags: ['membership', 'forms'] },
  { id: 'd5', title: 'Building Safety Map', category: 'Safety', url: '#', fileType: 'pdf', author: 'Maintenance', date: '2024-05-20', tags: ['safety'] },
  { id: 'd6', title: 'Board Meeting Minutes - April 2026', category: 'Minutes', url: '#', fileType: 'pdf', author: 'Secretary', date: '2026-04-28', tags: ['minutes', 'board', 'minutes-meeting:e5', 'Board of Directors'], committee: 'Board of Directors' },
  { id: 'd7', title: '2026 Operating Budget', category: 'Financials', url: '#', fileType: 'xls', author: 'Finance Committee', date: '2026-01-10', tags: ['budget', 'financial'] },
  { id: 'd8', title: 'Reserve Fund Study 2024', category: 'Financials', url: '#', fileType: 'pdf', author: 'Board', date: '2024-06-15', tags: ['reserve', 'planning'] },
  { id: 'd9', title: 'Noise & Quiet Hours Policy', category: 'Policies', url: '#', fileType: 'pdf', author: 'Board', date: '2022-11-15', tags: ['noise', 'living'] },
  { id: 'd10', title: 'Parking Policy & Stall Assignment', category: 'Policies', url: '#', fileType: 'pdf', author: 'Maintenance', date: '2024-03-01', tags: ['parking', 'vehicles'] },
  { id: 'd11', title: 'Finance Committee Review Minutes - June 2026', category: 'Minutes', url: '#', fileType: 'pdf', author: 'Secretary', date: '2026-06-09', tags: ['minutes', 'finance', 'minutes-meeting:e8'] },
  { id: 'd12', title: 'Board Orientation Package', category: 'Policies', url: '#', fileType: 'pdf', author: 'Board of Directors', date: '2026-05-20', tags: ['orientation', 'governance', 'Board of Directors'], committee: 'Board of Directors' },
  { id: 'd13', title: 'June Board Package Draft', category: 'Minutes', url: '#', fileType: 'pdf', author: 'Secretary', date: '2026-05-28', tags: ['agenda', 'board', 'Board of Directors'], committee: 'Board of Directors' },
  { id: 'd14', title: 'May Board Meeting Minutes', category: 'Minutes', url: '#', fileType: 'pdf', author: 'Secretary', date: '2026-05-04', tags: ['minutes', 'board', 'minutes-meeting:e17', 'Board of Directors'], committee: 'Board of Directors' },
  { id: 'd15', title: 'Finance Committee Check-in Minutes - May 2026', category: 'Minutes', url: '#', fileType: 'pdf', author: 'Secretary', date: '2026-05-06', tags: ['minutes', 'finance', 'minutes-meeting:e18', 'Finance Committee'], committee: 'Finance Committee' },
  { id: 'd16', title: 'Maintenance Committee Review Minutes - May 2026', category: 'Minutes', url: '#', fileType: 'pdf', author: 'Secretary', date: '2026-05-08', tags: ['minutes', 'maintenance', 'minutes-meeting:e19', 'Maintenance Committee'], committee: 'Maintenance Committee' },
  { id: 'd17', title: 'Membership Committee Debrief Minutes - May 2026', category: 'Minutes', url: '#', fileType: 'pdf', author: 'Secretary', date: '2026-05-12', tags: ['minutes', 'membership', 'minutes-meeting:e20', 'Membership Committee'], committee: 'Membership Committee' },
];

export const MOCK_COMMITTEES: Committee[] = [
  { id: 'c1', name: 'Board of Directors', description: 'Elected governing body responsible for management, policy decisions, and financial oversight.', chair: 'George Papadopoulos', icon: 'fa-landmark', members: ['George Papadopoulos', 'Thomas Bergstrom', 'Margaret Chen', 'Maya Ellison'] },
  { id: 'c2', name: 'Maintenance Committee', description: 'Coordinates building repairs and contractor relationships.', chair: 'Thomas Bergstrom', icon: 'fa-wrench', members: ['Thomas Bergstrom', 'Carlos Rivera', 'Patricia MacLeod', 'OB HC'] },
  { id: 'c3', name: 'Finance Committee', description: 'Reviews statements, budgets, and reserve fund planning.', chair: 'Patricia MacLeod', icon: 'fa-dollar-sign', members: ['Patricia MacLeod', 'Margaret Chen', 'Ahmed Patel'] },
  { id: 'c4', name: 'Membership Committee', description: 'Reviews applications, manages waitlist interviews, and supports orientation.', chair: 'Linda Nakamura', icon: 'fa-users', members: ['Linda Nakamura', 'Priya Sharma', 'Yuki Tanaka'] },
  { id: 'c5', name: 'Social Committee', description: 'Organizes community events and seasonal gatherings.', chair: 'Wei Liu', icon: 'fa-calendar', members: ['Wei Liu', 'Maya Ellison', 'Fatima Al-Hassan', 'OB HC'] },
  { id: 'c6', name: 'Landscape Committee', description: 'Plans garden and exterior volunteer projects.', chair: 'Michael Johansson', icon: 'fa-leaf', members: ['Michael Johansson', 'Wei Liu', 'James Nakamura'] },
];

export const MOCK_SCHEDULED_MAINTENANCE: ScheduledMaintenance[] = MOCK_UNITS.slice(0, 12).map((unit, index) => ({
  id: `sm${index + 1}`,
  unitId: unit.id,
  task: index % 2 === 0 ? 'HVAC Filter Change' : 'Smoke Detector Test',
  dueDate: new Date(2026, 3 + index, 15).toISOString(),
  frequency: index % 3 === 0 ? 'MONTHLY' : index % 3 === 1 ? 'QUARTERLY' : 'ANNUAL',
  assignedTo: 'Maintenance Committee',
  category: index % 2 === 0 ? 'HVAC' : 'SAFETY',
}));

type DemoMinutesSeed = MinutesTemplate & {
  formData: Record<string, any>;
  data: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
};

const makeMinutes = (
  id: string,
  meetingId: string,
  meetingType: MinutesTemplate['meetingType'],
  date: string,
  chair: string,
  minuteTaker: string,
  report: string,
): DemoMinutesSeed => {
  const formData = {
    meetingDate: date,
    startTime: MOCK_EVENTS.find(event => event.id === meetingId)?.time || '19:00',
    endTime: '21:00',
    location: MOCK_EVENTS.find(event => event.id === meetingId)?.location || 'Common Room',
    chair,
    minuteTaker,
    boardReport: report,
    financeReport: 'Treasurer reviewed operating expenses, reserve contributions, and upcoming insurance renewal pressure.',
    committeeReports: 'Maintenance, membership, and landscape committees provided brief updates.',
    newBusiness: 'Members discussed priorities for spring repairs, communications, and document readiness.',
    actionItemsList: [
      { id: `${id}-ai1`, description: 'Publish summary to the document library.', responsible: [minuteTaker], dueDate: '2026-05-05' },
      { id: `${id}-ai2`, description: 'Follow up on assigned maintenance items.', responsible: ['Maintenance Committee'], dueDate: '2026-05-20' },
    ],
    guests: [],
    directorsAbsent: ['Patricia MacLeod'],
    linkedDocuments: MOCK_DOCUMENTS.filter(doc => doc.tags?.includes(`minutes-meeting:${meetingId}`)).map(doc => ({
      id: doc.id,
      title: doc.title,
      url: doc.url,
      fileType: doc.fileType,
    })),
    approvedBy: chair,
    approvalDate: date,
  };

  return {
    id,
    meetingId,
    coopName: 'Oak Bay Housing Co-op',
    meetingType,
    date,
    startTime: formData.startTime,
    endTime: formData.endTime,
    location: formData.location,
    chair,
    secretary: minuteTaker,
    attendees: ['George Papadopoulos', 'Thomas Bergstrom', 'Margaret Chen', 'Fatima Al-Hassan'],
    guests: [],
    agenda: [
      { id: `${id}-ag1`, title: 'Call to order and approval of agenda', completed: true },
      { id: `${id}-ag2`, title: 'Committee and finance reports', completed: true },
      { id: `${id}-ag3`, title: 'New business and action items', completed: true },
    ],
    motions: [
      { id: `${id}-mo1`, mover: 'Margaret Chen', seconder: 'Thomas Bergstrom', resolution: 'Approve the meeting record and publish it to the member library.', carried: true },
    ],
    actionItems: formData.actionItemsList.map((item: any) => ({ id: item.id, task: item.description, owner: item.responsible.join(', '), dueDate: item.dueDate })),
    notes: report,
    status: 'Finalized',
    formData,
    data: formData,
    createdAt: `${date}T21:00:00Z`,
    updatedAt: `${date}T21:00:00Z`,
    createdBy: 'margaret.chen@email.com',
  };
};

export const MOCK_MINUTES = [
  makeMinutes('min1', 'e1', 'agm', '2026-04-12', 'George Papadopoulos', 'Margaret Chen', 'The AGM confirmed board election results, reviewed the annual budget, and approved publication of updated member materials.'),
  makeMinutes('min2', 'e5', 'regular', '2026-04-28', 'George Papadopoulos', 'Margaret Chen', 'The board reviewed open service requests, document library readiness, and upcoming resident communications.'),
  makeMinutes('min3', 'e8', 'regular', '2026-06-09', 'Patricia MacLeod', 'Margaret Chen', 'The finance committee reviewed reserve fund assumptions and recommended preparing a plain-language budget notice.'),
  makeMinutes('min4', 'e17', 'regular', '2026-05-04', 'George Papadopoulos', 'Margaret Chen', 'The board reviewed spring maintenance priorities, member communications, and follow-up from the AGM.'),
  makeMinutes('min5', 'e18', 'regular', '2026-05-06', 'Patricia MacLeod', 'Ahmed Patel', 'The finance committee reviewed arrears reporting, insurance renewal assumptions, and reserve contribution timing.'),
  makeMinutes('min6', 'e19', 'regular', '2026-05-08', 'Thomas Bergstrom', 'Carlos Rivera', 'The maintenance committee triaged spring repairs, confirmed contractor follow-up, and prioritized shared-area safety items.'),
  makeMinutes('min7', 'e20', 'regular', '2026-05-12', 'Linda Nakamura', 'Priya Sharma', 'The membership committee reviewed orientation feedback, waitlist communication, and the next interview schedule.'),
];
