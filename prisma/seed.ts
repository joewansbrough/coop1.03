import { PrismaClient } from '@prisma/client';
import { MOCK_UNITS, MOCK_TENANTS, MOCK_REQUESTS, MOCK_ANNOUNCEMENTS, MOCK_DOCS, MOCK_COMMITTEES } from '../constants';
import 'dotenv/config';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Clear existing data
  await prisma.tenantHistory.deleteMany();
  await prisma.maintenanceRequest.deleteMany();
  await prisma.announcement.deleteMany();
  await prisma.document.deleteMany();
  await prisma.committee.deleteMany();
  await prisma.tenant.deleteMany();
  await prisma.unit.deleteMany();

  // Seed Units
  for (const unit of MOCK_UNITS) {
    await prisma.unit.create({
      data: {
        id: unit.id,
        number: unit.number,
        type: unit.type,
        floor: unit.floor,
        status: unit.status,
      },
    });
  }

  // Seed Tenants
  for (const tenant of MOCK_TENANTS) {
    await prisma.tenant.create({
      data: {
        id: tenant.id,
        firstName: tenant.firstName,
        lastName: tenant.lastName,
        email: tenant.email,
        phone: tenant.phone,
        startDate: tenant.startDate,
        status: tenant.status,
        unitId: tenant.unitId,
      },
    });
    
    // Update Unit's currentTenantId
    if (tenant.unitId) {
      await prisma.unit.update({
        where: { id: tenant.unitId },
        data: { currentTenantId: tenant.id },
      });
      
      // Add to history
      await prisma.tenantHistory.create({
        data: {
          tenantId: tenant.id,
          unitId: tenant.unitId,
          startDate: new Date(tenant.startDate),
          moveReason: 'Initial seed data',
        },
      });
    }
  }

  // Seed Maintenance Requests
  for (const req of MOCK_REQUESTS) {
    await prisma.maintenanceRequest.create({
      data: {
        id: req.id,
        title: req.title,
        description: req.description,
        status: req.status,
        priority: req.priority,
        category: req.category[0] || 'General',
        unitId: req.unitId,
        tenantId: req.tenantId,
        requestedBy: req.tenantId ? MOCK_TENANTS.find(t => t.id === req.tenantId)?.email : null,
        createdAt: new Date(req.createdAt),
      },
    });
  }

  // Seed Announcements
  for (const ann of MOCK_ANNOUNCEMENTS) {
    await prisma.announcement.create({
      data: {
        id: ann.id,
        title: ann.title,
        content: ann.content,
        type: ann.type,
        priority: ann.priority,
        author: ann.author,
        date: ann.date,
        createdAt: new Date(ann.date),
      },
    });
  }

  // Seed Documents
  for (const doc of MOCK_DOCS) {
    await prisma.document.create({
      data: {
        id: doc.id,
        title: doc.title,
        category: doc.category,
        url: doc.url,
        fileType: doc.fileType,
        author: doc.author,
        date: doc.date,
        createdAt: new Date(doc.date),
      },
    });
  }

  // Seed Committees
  for (const comm of MOCK_COMMITTEES) {
    await prisma.committee.create({
      data: {
        id: comm.id,
        name: comm.name,
        description: comm.description,
        chair: comm.chair,
        icon: comm.icon,
        members: {
          connect: comm.members.map(m => ({ id: m.id })),
        },
      },
    });
  }

  console.log('Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
