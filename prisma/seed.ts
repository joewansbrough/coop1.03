import { MaintenanceCategory, MaintenanceFrequency, PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();

async function main() {
  console.log('Clearing existing data...');
  await prisma.tenantHistory.deleteMany();
  await prisma.maintenanceRequest.deleteMany();
  await prisma.announcement.deleteMany();
  await prisma.document.deleteMany();
  await prisma.committee.deleteMany();
  // await prisma.coopEvent.deleteMany();
  await prisma.tenant.deleteMany();
  await prisma.unit.deleteMany();

  const coop = await prisma.cooperative.upsert({
    where: { slug: 'oak-bay' },
    update: {},
    create: {
      name: 'Oak Bay Housing Co-op',
      slug: 'oak-bay',
      address: '1234 Foul Bay Road',
      city: 'Victoria',
      province: 'BC',
      adminEmail: 'admin@oakbaycoop.bc.ca',
    },
  });
  const cooperativeId = coop.id;

  console.log('Seeding units...');
  const unitDefs = [
    // Floor 1
    { number: '101', type: '1BR', floor: 1, status: 'Occupied' },
    { number: '102', type: '2BR', floor: 1, status: 'Occupied' },
    { number: '103', type: '2BR', floor: 1, status: 'Occupied' },
    { number: '104', type: '3BR', floor: 1, status: 'Occupied' },
    { number: '105', type: '1BR', floor: 1, status: 'Vacant' },
    { number: '106', type: '2BR', floor: 1, status: 'Occupied' },
    { number: '107', type: '1BR', floor: 1, status: 'Occupied' },
    { number: '108', type: '2BR', floor: 1, status: 'Occupied' },
    { number: '109', type: '1BR', floor: 1, status: 'Occupied' },
    // Floor 2
    { number: '201', type: '2BR', floor: 2, status: 'Occupied' },
    { number: '202', type: '3BR', floor: 2, status: 'Occupied' },
    { number: '203', type: '1BR', floor: 2, status: 'Occupied' },
    { number: '204', type: '2BR', floor: 2, status: 'Maintenance' },
    { number: '205', type: '3BR', floor: 2, status: 'Occupied' },
    { number: '206', type: '2BR', floor: 2, status: 'Occupied' },
    { number: '207', type: '1BR', floor: 2, status: 'Occupied' },
    { number: '208', type: '1BR', floor: 2, status: 'Occupied' },
    { number: '209', type: '2BR', floor: 2, status: 'Occupied' },
    // Floor 3
    { number: '301', type: '3BR', floor: 3, status: 'Occupied' },
    { number: '302', type: '2BR', floor: 3, status: 'Occupied' },
    { number: '303', type: '1BR', floor: 3, status: 'Occupied' },
    { number: '304', type: '2BR', floor: 3, status: 'Vacant' },
    { number: '305', type: '3BR', floor: 3, status: 'Occupied' },
    { number: '306', type: '4BR', floor: 3, status: 'Occupied' },
    { number: '307', type: '2BR', floor: 3, status: 'Occupied' },
    { number: '308', type: '1BR', floor: 3, status: 'Occupied' },
    { number: '309', type: '2BR', floor: 3, status: 'Occupied' },
    // Floor 4
    { number: '401', type: '2BR', floor: 4, status: 'Occupied' },
    { number: '402', type: '1BR', floor: 4, status: 'Occupied' },
    { number: '403', type: '2BR', floor: 4, status: 'Occupied' },
    { number: '404', type: '1BR', floor: 4, status: 'Occupied' },
    { number: '405', type: '2BR', floor: 4, status: 'Vacant' },
    { number: '406', type: '1BR', floor: 4, status: 'Occupied' },
    { number: '407', type: '2BR', floor: 4, status: 'Occupied' },
  ];

  const units: any[] = [];
  for (const u of unitDefs) {
    const unit = await prisma.unit.create({ data: { ...u, cooperativeId } });
    units.push(unit);
  }

  const unitMap: Record<string, string> = {};
  units.forEach(u => { unitMap[u.number] = u.id; });

  console.log('Seeding tenants...');
  const tenantData = [
    { firstName: 'Margaret', lastName: 'Chen', email: 'margaret.chen@email.com', phone: '250-555-0101', startDate: '2019-03-15', status: 'Current', unit: '101' },
    { firstName: 'David', lastName: 'Okafor', email: 'david.okafor@email.com', phone: '250-555-0102', startDate: '2020-07-01', status: 'Current', unit: '102' },
    { firstName: 'Priya', lastName: 'Sharma', email: 'priya.sharma@email.com', phone: '250-555-0103', startDate: '2021-01-10', status: 'Current', unit: '102' },
    { firstName: 'Robert', lastName: 'Tremblay', email: 'robert.tremblay@email.com', phone: '250-555-0104', startDate: '2018-09-01', status: 'Current', unit: '103' },
    { firstName: 'Susan', lastName: 'Tremblay', email: 'susan.tremblay@email.com', phone: '250-555-0105', startDate: '2018-09-01', status: 'Current', unit: '103' },
    { firstName: 'James', lastName: 'Nakamura', email: 'james.nakamura@email.com', phone: '250-555-0106', startDate: '2017-05-20', status: 'Current', unit: '104' },
    { firstName: 'Linda', lastName: 'Nakamura', email: 'linda.nakamura@email.com', phone: '250-555-0107', startDate: '2017-05-20', status: 'Current', unit: '104' },
    { firstName: 'Carlos', lastName: 'Rivera', email: 'carlos.rivera@email.com', phone: '250-555-0108', startDate: '2022-02-14', status: 'Current', unit: '106' },
    { firstName: 'Aisha', lastName: 'Mohammed', email: 'aisha.mohammed@email.com', phone: '250-555-0109', startDate: '2021-08-30', status: 'Current', unit: '201' },
    { firstName: 'Thomas', lastName: 'Bergstrom', email: 'thomas.bergstrom@email.com', phone: '250-555-0110', startDate: '2016-11-01', status: 'Current', unit: '202' },
    { firstName: 'Karen', lastName: 'Bergstrom', email: 'karen.bergstrom@email.com', phone: '250-555-0111', startDate: '2016-11-01', status: 'Current', unit: '202' },
    { firstName: 'Wei', lastName: 'Liu', email: 'wei.liu@email.com', phone: '250-555-0112', startDate: '2023-04-01', status: 'Current', unit: '203' },
    { firstName: 'Patricia', lastName: 'MacLeod', email: 'patricia.macleod@email.com', phone: '250-555-0113', startDate: '2019-06-15', status: 'Current', unit: '205' },
    { firstName: 'Kevin', lastName: 'MacLeod', email: 'kevin.macleod@email.com', phone: '250-555-0114', startDate: '2019-06-15', status: 'Current', unit: '205' },
    { firstName: 'Fatima', lastName: 'Al-Hassan', email: 'fatima.alhassan@email.com', phone: '250-555-0115', startDate: '2020-10-01', status: 'Current', unit: '206' },
    { firstName: 'George', lastName: 'Papadopoulos', email: 'george.papadopoulos@email.com', phone: '250-555-0116', startDate: '2015-03-01', status: 'Current', unit: '301' },
    { firstName: 'Helen', lastName: 'Papadopoulos', email: 'helen.papadopoulos@email.com', phone: '250-555-0117', startDate: '2015-03-01', status: 'Current', unit: '301' },
    { firstName: 'Michael', lastName: 'Johansson', email: 'michael.johansson@email.com', phone: '250-555-0118', startDate: '2022-09-01', status: 'Current', unit: '302' },
    { firstName: 'Yuki', lastName: 'Tanaka', email: 'yuki.tanaka@email.com', phone: '250-555-0119', startDate: '2023-01-15', status: 'Current', unit: '303' },
    { firstName: 'Brian', lastName: 'Walsh', email: 'brian.walsh@email.com', phone: '250-555-0120', startDate: '2018-07-01', status: 'Current', unit: '305' },
    { firstName: 'Catherine', lastName: 'Walsh', email: 'catherine.walsh@email.com', phone: '250-555-0121', startDate: '2018-07-01', status: 'Current', unit: '305' },
    { firstName: 'Ahmed', lastName: 'Patel', email: 'ahmed.patel@email.com', phone: '250-555-0122', startDate: '2017-12-01', status: 'Current', unit: '306' },
    { firstName: 'Nadia', lastName: 'Patel', email: 'nadia.patel@email.com', phone: '250-555-0123', startDate: '2017-12-01', status: 'Current', unit: '306' },
    // Waitlist
    { firstName: 'Oliver', lastName: 'Grant', email: 'oliver.grant@email.com', phone: '250-555-0130', startDate: '2024-01-10', status: 'Waitlist', unit: undefined },
    { firstName: 'Sophie', lastName: 'Dubois', email: 'sophie.dubois@email.com', phone: '250-555-0131', startDate: '2024-03-22', status: 'Waitlist', unit: undefined },
    { firstName: 'Marcus', lastName: 'Williams', email: 'marcus.williams@email.com', phone: '250-555-0132', startDate: '2024-05-14', status: 'Waitlist', unit: undefined },
    // Past tenants
    { firstName: 'Eleanor', lastName: 'Frost', email: 'eleanor.frost@email.com', phone: '250-555-0140', startDate: '2015-01-01', status: 'Past', unit: undefined },
    { firstName: 'Raymond', lastName: 'Kim', email: 'raymond.kim@email.com', phone: '250-555-0141', startDate: '2016-06-01', status: 'Past', unit: undefined },
    // New floor 1 tenants
    { firstName: 'Ingrid', lastName: 'Sorensen', email: 'ingrid.sorensen@email.com', phone: '250-555-0124', startDate: '2021-05-01', status: 'Current', unit: '107' },
    { firstName: 'Paulo', lastName: 'Ferreira', email: 'paulo.ferreira@email.com', phone: '250-555-0125', startDate: '2022-11-15', status: 'Current', unit: '108' },
    { firstName: 'Diana', lastName: 'Ferreira', email: 'diana.ferreira@email.com', phone: '250-555-0126', startDate: '2022-11-15', status: 'Current', unit: '108' },
    { firstName: 'Lena', lastName: 'Kowalski', email: 'lena.kowalski@email.com', phone: '250-555-0127', startDate: '2023-08-01', status: 'Current', unit: '109' },
    // New floor 2 tenants
    { firstName: 'Derek', lastName: 'Munroe', email: 'derek.munroe@email.com', phone: '250-555-0128', startDate: '2020-04-01', status: 'Current', unit: '207' },
    { firstName: 'Amara', lastName: 'Diallo', email: 'amara.diallo@email.com', phone: '250-555-0129', startDate: '2024-02-01', status: 'Current', unit: '208' },
    { firstName: 'Stefan', lastName: 'Novak', email: 'stefan.novak@email.com', phone: '250-555-0133', startDate: '2021-09-15', status: 'Current', unit: '209' },
    { firstName: 'Jana', lastName: 'Novak', email: 'jana.novak@email.com', phone: '250-555-0134', startDate: '2021-09-15', status: 'Current', unit: '209' },
    // New floor 3 tenants
    { firstName: 'Trevor', lastName: 'Osei', email: 'trevor.osei@email.com', phone: '250-555-0135', startDate: '2022-06-01', status: 'Current', unit: '307' },
    { firstName: 'Miriam', lastName: 'Goldstein', email: 'miriam.goldstein@email.com', phone: '250-555-0136', startDate: '2023-03-15', status: 'Current', unit: '308' },
    { firstName: 'Kenji', lastName: 'Watanabe', email: 'kenji.watanabe@email.com', phone: '250-555-0137', startDate: '2020-12-01', status: 'Current', unit: '309' },
    { firstName: 'Yuna', lastName: 'Watanabe', email: 'yuna.watanabe@email.com', phone: '250-555-0138', startDate: '2020-12-01', status: 'Current', unit: '309' },
    // Floor 4 tenants
    { firstName: 'Bernard', lastName: 'Lefebvre', email: 'bernard.lefebvre@email.com', phone: '250-555-0150', startDate: '2024-06-01', status: 'Current', unit: '401' },
    { firstName: 'Claire', lastName: 'Lefebvre', email: 'claire.lefebvre@email.com', phone: '250-555-0151', startDate: '2024-06-01', status: 'Current', unit: '401' },
    { firstName: 'Ravi', lastName: 'Krishnamurthy', email: 'ravi.krishnamurthy@email.com', phone: '250-555-0152', startDate: '2024-07-15', status: 'Current', unit: '402' },
    { firstName: 'Elena', lastName: 'Vasquez', email: 'elena.vasquez@email.com', phone: '250-555-0153', startDate: '2024-08-01', status: 'Current', unit: '403' },
    { firstName: 'Marco', lastName: 'Vasquez', email: 'marco.vasquez@email.com', phone: '250-555-0154', startDate: '2024-08-01', status: 'Current', unit: '403' },
    { firstName: 'Hana', lastName: 'Becker', email: 'hana.becker@email.com', phone: '250-555-0155', startDate: '2024-09-01', status: 'Current', unit: '404' },
    { firstName: 'Isaiah', lastName: 'Campbell', email: 'isaiah.campbell@email.com', phone: '250-555-0156', startDate: '2025-01-15', status: 'Current', unit: '406' },
    { firstName: 'Natasha', lastName: 'Ivanova', email: 'natasha.ivanova@email.com', phone: '250-555-0157', startDate: '2025-02-01', status: 'Current', unit: '407' },
    { firstName: 'Dmitri', lastName: 'Ivanov', email: 'dmitri.ivanov@email.com', phone: '250-555-0158', startDate: '2025-02-01', status: 'Current', unit: '407' },
  ];

  const tenants: Record<string, any> = {};
  const adminEmails = ['joewcoupons@gmail.com', 'wwansbro@gmail.com', 'maya.ellison@email.com', 'samisaeed123@gmail.com', 'margaret.chen@email.com'];
  for (const t of tenantData) {
    const tenant = await prisma.tenant.create({
      data: {
        firstName: t.firstName,
        lastName: t.lastName,
        email: t.email,
        phone: t.phone,
        startDate: new Date(t.startDate),
        status: t.status,
        cooperativeId,
        unitId: t.unit ? unitMap[t.unit] : null,
        role: adminEmails.includes(t.email.toLowerCase()) ? 'ADMIN' : 'MEMBER',
      },
    });
    tenants[t.email] = tenant;

    if (t.unit && unitMap[t.unit]) {
      await prisma.unit.update({
        where: { id: unitMap[t.unit] },
        data: { currentTenantId: tenant.id },
      });
      await prisma.tenantHistory.create({
        data: {
          tenant: { connect: { id: tenant.id } },
          unit: { connect: { id: unitMap[t.unit] } },
          cooperative: { connect: { id: cooperativeId } },
          startDate: new Date(t.startDate),
          moveReason: 'Initial occupancy',
        },
      });
    }
  }

  console.log('Seeding maintenance requests...');
  const maintenanceData = [
    {
      title: 'Leaking kitchen faucet',
      description: 'The kitchen faucet has been dripping constantly for the past week. Water is pooling under the sink cabinet.',
      status: 'Pending',
      priority: 'Medium',
      category: 'Plumbing',
      unitNumber: '101',
      requestedBy: 'margaret.chen@email.com',
      createdAt: new Date('2026-02-28'),
      notes: [
        { id: 'n1', author: 'Member Note', date: '2026-03-01T10:00:00Z', content: 'Drip is getting worse, please prioritize.' },
        { id: 'n2', author: 'Board Admin', date: '2026-03-02T09:00:00Z', content: 'Maintenance committee notified. Plumber scheduled for Thursday.' }
      ]
    },
    {
      title: 'Bathroom exhaust fan not working',
      description: 'The exhaust fan in the main bathroom stopped working. There is condensation building up on the ceiling.',
      status: 'In Progress',
      priority: 'Medium',
      category: 'Electrical',
      unitNumber: '102',
      requestedBy: 'david.okafor@email.com',
      createdAt: new Date('2026-02-20'),
      notes: [
        { id: 'n3', author: 'Board Admin', date: '2026-02-22T14:00:00Z', content: 'Contractor assigned. Part ordered.' }
      ]
    },
    {
      title: 'Dishwasher not draining',
      description: 'The dishwasher fills with water but does not drain after cycle completes. Standing water remains at bottom.',
      status: 'Completed',
      priority: 'Medium',
      category: 'Appliance',
      unitNumber: '104',
      requestedBy: 'james.nakamura@email.com',
      createdAt: new Date('2026-01-15'),
      expenses: [
        { id: 'ex1', item: 'Drain pump replacement', cost: 145.50, date: '2026-01-20' },
        { id: 'ex2', item: 'Labor - 1.5 hours', cost: 120.00, date: '2026-01-20' }
      ],
      notes: [
        { id: 'n4', author: 'Board Admin', date: '2026-01-20T16:00:00Z', content: 'Fixed. Pump was clogged with debris.' }
      ]
    },
    { title: 'Broken window latch - balcony door', description: 'The latch on the balcony sliding door is broken. The door does not lock properly which is a security concern.', status: 'Pending', priority: 'High', category: 'Structural', unitNumber: '103', requestedBy: 'robert.tremblay@email.com', createdAt: new Date('2026-03-01') },
    { title: 'Heating unit making loud noise', description: 'The baseboard heater in the living room is making a loud banging noise when it turns on. Happens every morning.', status: 'In Progress', priority: 'Low', category: 'HVAC', unitNumber: '106', requestedBy: 'carlos.rivera@email.com', createdAt: new Date('2026-02-10') },
    { title: 'Water damage on ceiling', description: 'Brown water stain appearing on the bedroom ceiling. Appears to be coming from unit above. Getting larger over time.', status: 'Pending', priority: 'Urgent', category: 'Structural', unitNumber: '201', requestedBy: 'aisha.mohammed@email.com', createdAt: new Date('2026-03-05') },
    { title: 'Unit 204 full renovation', description: 'Unit undergoing full renovation following previous tenant departure. Flooring, paint, kitchen fixtures all being replaced.', status: 'In Progress', priority: 'Medium', category: 'Structural', unitNumber: '204', requestedBy: null, createdAt: new Date('2026-02-01') },
    { title: 'Stove burner not igniting', description: 'Front left burner on gas stove does not ignite. Clicking sound present but no flame. Other burners work fine.', status: 'Pending', priority: 'Medium', category: 'Appliance', unitNumber: '203', requestedBy: 'wei.liu@email.com', createdAt: new Date('2026-03-07') },
    { title: 'Exterior parking lot light out', description: 'The lamp post nearest to stalls 12-15 is not working. Area is very dark at night, safety concern for residents.', status: 'Pending', priority: 'High', category: 'Electrical', unitNumber: '301', requestedBy: 'george.papadopoulos@email.com', createdAt: new Date('2026-03-03') },
    { title: 'Bathroom tiles cracked', description: 'Several floor tiles in the main bathroom have cracked. One tile has a sharp edge that is a safety hazard.', status: 'Completed', priority: 'High', category: 'Structural', unitNumber: '302', requestedBy: 'michael.johansson@email.com', createdAt: new Date('2026-01-20'), expenses: [{ id: 'ex3', item: 'Tile repair kit', cost: 35.99, date: '2026-01-25' }] },
    { title: 'Intercom not working', description: 'The intercom handset in the unit does not ring when visitors buzz from the front door. Cannot let guests in.', status: 'Pending', priority: 'Medium', category: 'Electrical', unitNumber: '303', requestedBy: 'yuki.tanaka@email.com', createdAt: new Date('2026-03-08') },
    { title: 'Hallway carpet damage', description: 'Large section of hallway carpet near Unit 305 has come loose and is a tripping hazard for all residents on floor 3.', status: 'In Progress', priority: 'High', category: 'Safety', unitNumber: '305', requestedBy: null, createdAt: new Date('2026-02-25') },
  ];
  for (const m of maintenanceData) {
    await prisma.maintenanceRequest.create({
      data: {
        cooperativeId,
        title: m.title,
        description: m.description,
        status: m.status,
        priority: m.priority,
        category: m.category,
        unitId: unitMap[m.unitNumber],
        requestedBy: m.requestedBy,
        createdAt: m.createdAt,
        notes: m.notes || null,
        expenses: m.expenses || null
      }
    });
  }

  console.log('Seeding scheduled preventative maintenance...');
  const preventativeTaskTemplates = [
    { task: 'Smoke and CO Alarm Test', frequency: MaintenanceFrequency.ANNUAL, assignedTo: 'Maintenance Committee', category: MaintenanceCategory.SAFETY },
    { task: 'Bathroom Fan and Vent Cleaning', frequency: MaintenanceFrequency.QUARTERLY, assignedTo: 'Maintenance Committee', category: MaintenanceCategory.HVAC },
    { task: 'Plumbing Shutoff and Leak Check', frequency: MaintenanceFrequency.ANNUAL, assignedTo: 'Maintenance Committee', category: MaintenanceCategory.PLUMBING },
  ];
  const unitEntries = Object.entries(unitMap);
  for (const [unitNumber, unitId] of unitEntries) {
    const unitIndex = unitEntries.findIndex(([number]) => number === unitNumber);
    for (const [taskIndex, template] of preventativeTaskTemplates.entries()) {
      await prisma.scheduledMaintenance.create({
        data: {
          cooperative: { connect: { id: cooperativeId } },
          unit: { connect: { id: unitId } },
          ...template,
          dueDate: new Date(Date.UTC(2026, 4 + ((unitIndex + taskIndex) % 6), 8 + ((unitIndex * 3 + taskIndex * 5) % 18))),
          isCompleted: false,
        },
      });
    }
  }

  console.log('Seeding announcements...');
  const announcementData = [
    { title: 'Annual General Meeting — April 12th', content: 'The Oak Bay Housing Co-operative Annual General Meeting will be held on Saturday, April 12th at 2:00 PM in the Community Room. Agenda items include the 2025 financial review, election of board members, and proposed bylaw amendments. All members are encouraged to attend. Light refreshments will be provided. Please RSVP to admin@oakbaycoop.bc.ca by April 5th.', type: 'General', priority: 'High', author: 'Board Administration', date: '2026-03-08', createdAt: new Date('2026-03-08') },
    { title: 'Water Shutoff — March 18th 9AM–1PM', content: 'A scheduled water shutoff is required to complete repairs to the main building supply line. The shutoff will affect all units and will take place on Tuesday March 18th from 9:00 AM to approximately 1:00 PM. Please store sufficient water in advance. We apologize for the inconvenience and thank you for your patience.', type: 'Maintenance', priority: 'High', author: 'Maintenance Committee', date: '2026-03-06', createdAt: new Date('2026-03-06') },
    { title: 'New Recycling Guidelines Effective April 1st', content: 'The City of Victoria has updated its recycling program. Starting April 1st, soft plastics must be deposited in the dedicated soft plastics bin in the recycling room rather than the blue bin. Glass bottles and jars should be rinsed before recycling. Updated sorting guides have been posted in the recycling room and laundry room.', type: 'General', priority: 'Medium', author: 'Board Administration', date: '2026-03-01', createdAt: new Date('2026-03-01') },
    { title: 'Parking Lot Repaving — Weekend of March 22nd', content: 'The parking lot will be repaved over the weekend of March 22nd–23rd. All vehicles must be removed from the lot by 7:00 AM Saturday. Street parking is available on Foul Bay Road and Granite Street. Vehicles left in the lot may be towed at the owner\'s expense. The lot will reopen by Sunday evening.', type: 'Maintenance', priority: 'High', author: 'Maintenance Committee', date: '2026-02-28', createdAt: new Date('2026-02-28') },
    { title: 'Spring Garden Volunteer Day — April 5th', content: 'Join your neighbours for the annual spring garden cleanup on Saturday April 5th starting at 10:00 AM. We\'ll be pruning, planting, and refreshing the communal garden beds. Tools and gloves provided. Lunch will be served at noon. This counts toward your annual participation hours.', type: 'General', priority: 'Low', author: 'Garden Committee', date: '2026-02-20', createdAt: new Date('2026-02-20') },
    { title: 'Housing Charge Increase — Effective July 1st', content: 'Following the board\'s annual financial review, housing charges will increase by 3.2% effective July 1st, 2026. This increase reflects rising municipal taxes, insurance premiums, and maintenance costs. Individual notice letters will be mailed to all members by April 15th.', type: 'General', priority: 'High', author: 'Finance Committee', date: '2026-02-15', createdAt: new Date('2026-02-15') },
    { title: 'Fire Alarm System Test — March 14th', content: 'The building\'s fire alarm system will undergo its mandatory annual inspection on Friday March 14th between 10:00 AM and 3:00 PM. Expect brief alarm activations throughout the day. Please do not call 911 during testing periods.', type: 'Maintenance', priority: 'Medium', author: 'Board Administration', date: '2026-03-04', createdAt: new Date('2026-03-04') },
  ];
  for (const a of announcementData) {
    await prisma.announcement.create({ data: { ...a, cooperativeId, date: new Date(a.date) } });
  }

  console.log('Seeding documents...');
  const documentData = [
    { title: 'Oak Bay Co-op Rules & Regulations 2024', category: 'Bylaws', url: 'https://storage.example.com/docs/rules-2024.pdf', fileType: 'pdf', author: 'Board Administration', date: '2024-01-15', createdAt: new Date('2024-01-15'), tags: ['legal', 'governance', 'bylaws'] },
    { title: 'Co-operative Housing Act — BC', category: 'Bylaws', url: 'https://storage.example.com/docs/coop-act-bc.pdf', fileType: 'pdf', author: 'Legislative BC', date: '2023-06-01', createdAt: new Date('2023-06-01'), tags: ['legal', 'provincial'] },
    { title: 'Member Handbook 2025', category: 'Policies', url: 'https://storage.example.com/docs/member-handbook-2025.pdf', fileType: 'pdf', author: 'Membership Committee', date: '2025-01-01', createdAt: new Date('2025-01-01'), tags: ['handbook', 'rules'] },
    { title: 'Pet Policy', category: 'Policies', url: 'https://storage.example.com/docs/pet-policy.pdf', fileType: 'pdf', author: 'Board Administration', date: '2023-09-01', createdAt: new Date('2023-09-01'), tags: ['pets', 'rules'] },
    { title: 'Noise & Quiet Hours Policy', category: 'Policies', url: 'https://storage.example.com/docs/noise-policy.pdf', fileType: 'pdf', author: 'Board Administration', date: '2022-11-15', createdAt: new Date('2022-11-15'), tags: ['noise', 'living'] },
    { title: 'Parking Policy & Stall Assignment', category: 'Policies', url: 'https://storage.example.com/docs/parking-policy.pdf', fileType: 'pdf', author: 'Maintenance Committee', date: '2024-03-01', createdAt: new Date('2024-03-01'), tags: ['parking', 'vehicles'] },
    { title: 'AGM Minutes — April 2025', category: 'Minutes', url: 'https://storage.example.com/docs/agm-minutes-2025.pdf', fileType: 'pdf', author: 'Secretary', date: '2025-04-20', createdAt: new Date('2025-04-20'), tags: ['minutes', 'agm'] },
    { title: 'Board Meeting Minutes — February 2026', category: 'Minutes', url: 'https://storage.example.com/docs/board-minutes-feb-2026.pdf', fileType: 'pdf', author: 'Secretary', date: '2026-02-18', createdAt: new Date('2026-02-18'), tags: ['minutes', 'board'] },
    { title: 'Board Meeting Minutes — January 2026', category: 'Minutes', url: 'https://storage.example.com/docs/board-minutes-jan-2026.pdf', fileType: 'pdf', author: 'Secretary', date: '2026-01-21', createdAt: new Date('2026-01-21'), tags: ['minutes', 'board'] },
    { title: 'May Board Meeting Minutes', category: 'Minutes', url: 'https://storage.example.com/docs/board-minutes-may-2026.pdf', fileType: 'pdf', author: 'Secretary', date: '2026-05-04', createdAt: new Date('2026-05-04'), tags: ['minutes', 'board'] },
    { title: 'Finance Committee Check-in Minutes - May 2026', category: 'Minutes', url: 'https://storage.example.com/docs/finance-minutes-may-2026.pdf', fileType: 'pdf', author: 'Secretary', date: '2026-05-06', createdAt: new Date('2026-05-06'), tags: ['minutes', 'finance'] },
    { title: 'Maintenance Committee Review Minutes - May 2026', category: 'Minutes', url: 'https://storage.example.com/docs/maintenance-minutes-may-2026.pdf', fileType: 'pdf', author: 'Secretary', date: '2026-05-08', createdAt: new Date('2026-05-08'), tags: ['minutes', 'maintenance'] },
    { title: 'Membership Committee Debrief Minutes - May 2026', category: 'Minutes', url: 'https://storage.example.com/docs/membership-minutes-may-2026.pdf', fileType: 'pdf', author: 'Secretary', date: '2026-05-12', createdAt: new Date('2026-05-12'), tags: ['minutes', 'membership'] },
    { title: '2025 Annual Financial Statements', category: 'Financials', url: 'https://storage.example.com/docs/financials-2025.pdf', fileType: 'pdf', author: 'Finance Committee', date: '2026-02-01', createdAt: new Date('2026-02-01'), tags: ['financial', 'audit'] },
    { title: '2026 Operating Budget', category: 'Financials', url: 'https://storage.example.com/docs/budget-2026.xls', fileType: 'xls', author: 'Finance Committee', date: '2026-01-10', createdAt: new Date('2026-01-10'), tags: ['budget', 'financial'] },
    { title: 'Reserve Fund Study 2024', category: 'Financials', url: 'https://storage.example.com/docs/reserve-fund-2024.pdf', fileType: 'pdf', author: 'Board Administration', date: '2024-06-15', createdAt: new Date('2024-06-15'), tags: ['reserve', 'future-planning'] },
  ];
  for (const d of documentData) {
    await prisma.document.create({ data: { ...d, cooperativeId, date: new Date(d.date) } });
  }

  console.log('Seeding committees...');
  const committeeData = [
    { name: 'Board of Directors', description: 'Elected governing body responsible for overall co-op management, policy decisions, and financial oversight.', chair: 'George Papadopoulos', icon: 'fa-landmark', members: ['george.papadopoulos@email.com', 'thomas.bergstrom@email.com', 'patricia.macleod@email.com', 'james.nakamura@email.com', 'fatima.alhassan@email.com'] },
    { name: 'Maintenance Committee', description: 'Oversees building upkeep, coordinates repairs, manages contractor relationships, and reviews maintenance requests.', chair: 'Thomas Bergstrom', icon: 'fa-wrench', members: ['thomas.bergstrom@email.com', 'brian.walsh@email.com', 'carlos.rivera@email.com', 'robert.tremblay@email.com'] },
    { name: 'Finance Committee', description: 'Reviews financial statements, prepares budgets, monitors reserve fund, and recommends housing charge adjustments.', chair: 'Patricia MacLeod', icon: 'fa-dollar-sign', members: ['patricia.macleod@email.com', 'ahmed.patel@email.com', 'margaret.chen@email.com'] },
    { name: 'Membership Committee', description: 'Reviews applications, manages the waitlist, conducts interviews, and facilitates member orientation.', chair: 'Fatima Al-Hassan', icon: 'fa-users', members: ['fatima.alhassan@email.com', 'aisha.mohammed@email.com', 'yuki.tanaka@email.com', 'michael.johansson@email.com'] },
    { name: 'Garden Committee', description: 'Plans and maintains communal garden areas, organizes volunteer days, and manages the community composting program.', chair: 'Helen Papadopoulos', icon: 'fa-leaf', members: ['helen.papadopoulos@email.com', 'linda.nakamura@email.com', 'karen.bergstrom@email.com', 'wei.liu@email.com', 'catherine.walsh@email.com'] },
    { name: 'Social Committee', description: 'Organizes community events, potlucks, seasonal celebrations, and fosters neighbourly connections among members.', chair: 'Susan Tremblay', icon: 'fa-calendar', members: ['susan.tremblay@email.com', 'priya.sharma@email.com', 'nadia.patel@email.com', 'david.okafor@email.com'] },
  ];

  const committeesByName: Record<string, { id: string }> = {};
  for (const c of committeeData) {
    const committee = await prisma.committee.create({
      data: {
        name: c.name,
        description: c.description,
        chair: c.chair,
        icon: c.icon,
        cooperativeId,
        members: {
          connect: c.members.map(email => ({ id: tenants[email].id })),
        },
      },
    });
    committeesByName[c.name] = committee;
  }

  console.log('Seeding calendar events...');
  const committeeEvents = [
    { committeeName: 'Board of Directors', title: 'May Board Meeting', category: 'Meeting', location: 'Community Room', time: '19:00', description: 'Monthly board review of maintenance priorities, member communications, and policy follow-up.', date: new Date('2026-05-04T19:00:00') },
    { committeeName: 'Finance Committee', title: 'Finance Committee Check-in', category: 'Meeting', location: 'Library Room', time: '18:00', description: 'Review arrears reporting, insurance renewal assumptions, and reserve contribution timing.', date: new Date('2026-05-06T18:00:00') },
    { committeeName: 'Maintenance Committee', title: 'Maintenance Committee Review', category: 'Meeting', location: 'Workshop', time: '17:30', description: 'Triage spring repair requests and confirm contractor follow-up for shared areas.', date: new Date('2026-05-08T17:30:00') },
    { committeeName: 'Membership Committee', title: 'Membership Committee Debrief', category: 'Meeting', location: 'Library Room', time: '18:30', description: 'Review orientation feedback, waitlist communication, and upcoming interview scheduling.', date: new Date('2026-05-12T18:30:00') },
    { committeeName: 'Board of Directors', title: 'Board Package Review', category: 'Meeting', location: 'Community Room', time: '18:30', description: 'Directors review agenda materials, resident correspondence, and follow-up items.', date: new Date('2026-06-02T18:30:00') },
    { committeeName: 'Maintenance Committee', title: 'Maintenance Committee Triage', category: 'Meeting', location: 'Workshop', time: '17:30', description: 'Review open repair requests, contractor follow-ups, and preventive maintenance priorities.', date: new Date('2026-06-12T17:30:00') },
    { committeeName: 'Finance Committee', title: 'Finance Committee Budget Review', category: 'Meeting', location: 'Community Room', time: '18:00', description: 'Review operating budget assumptions, arrears reporting, and reserve planning updates.', date: new Date('2026-06-16T18:00:00') },
    { committeeName: 'Membership Committee', title: 'Membership Orientation Planning', category: 'Meeting', location: 'Library Room', time: '11:00', description: 'Prepare the next orientation package and review waitlist interview scheduling.', date: new Date('2026-06-20T11:00:00') },
    { committeeName: 'Garden Committee', title: 'Garden Committee Seasonal Walk', category: 'Meeting', location: 'Garden Beds', time: '09:30', description: 'Walk the exterior areas and confirm seasonal planting and cleanup tasks.', date: new Date('2026-06-24T09:30:00') },
    { committeeName: 'Social Committee', title: 'Social Committee Summer Planning', category: 'Meeting', location: 'Courtyard', time: '14:00', description: 'Coordinate volunteers, supplies, and notices for summer community events.', date: new Date('2026-06-27T14:00:00') },
  ];

  for (const event of committeeEvents) {
    const committee = committeesByName[event.committeeName];
    if (!committee) continue;
    await prisma.coopEvent.create({
      data: {
        cooperativeId,
        committeeId: committee.id,
        title: event.title,
        category: event.category,
        location: event.location,
        time: event.time,
        description: event.description,
        date: event.date,
      },
    });
  }

  const baseEvents = [
    { title: 'Board of Directors Meeting', category: 'Board', location: 'Community Room', time: '19:00', description: 'Monthly governance review and policy discussion.' },
    { title: 'Community Potluck', category: 'Social', location: 'Courtyard', time: '17:30', description: 'Bring a dish to share and meet your neighbours!' },
    { title: 'Maintenance Committee Check', category: 'Maintenance', location: 'Basement/Roof', time: '10:00', description: 'Routine building system inspection.' },
    { title: 'General Member Meeting', category: 'Meeting', location: 'Community Room', time: '19:30', description: 'Quarterly update for all co-op members.' },
    { title: 'Garden Volunteer Day', category: 'Social', location: 'Garden Beds', time: '09:00', description: 'Helping keep our communal spaces green and clean.' },
  ];

  const startDate = new Date('2026-03-01');
  const endDate = new Date('2026-12-31');
  let currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    const numEvents = Math.floor(Math.random() * 2) + 2;
    for (let i = 0; i < numEvents; i++) {
      const baseEvent = baseEvents[Math.floor(Math.random() * baseEvents.length)];
      const eventDate = new Date(currentDate);
      eventDate.setDate(Math.floor(Math.random() * 28) + 1);

      await prisma.coopEvent.create({
        data: {
          cooperativeId,
          title: baseEvent.title,
          category: baseEvent.category,
          location: baseEvent.location,
          time: baseEvent.time,
          description: baseEvent.description,
          date: eventDate,
        },
      });
    }
    currentDate.setMonth(currentDate.getMonth() + 1);
  }

  console.log('Seeding complete!');
  console.log(`  - ${units.length} units`);
  console.log(`  - ${Object.keys(tenants).length} tenants`);
  console.log('  - 12 maintenance requests');
  console.log('  - 7 announcements');
  console.log('  - 16 documents');
  console.log('  - 6 committees');
  console.log('  - Monthly calendar events through end of 2026');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
