import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function auditUnit(unitNumber) {
  console.log(`\n🔍 Auditing Residency History for Unit ${unitNumber}...`);

  try {
    const unit = await prisma.unit.findFirst({
      where: { number: unitNumber },
      include: {
        currentTenant: true,
        occupancyHistory: {
          include: { tenant: true },
          orderBy: { startDate: 'asc' }
        }
      }
    });

    if (!unit) {
      console.log('❌ Unit not found.');
      return;
    }

    console.log(`Current Status: ${unit.status}`);
    console.log(`Current Resident: ${unit.currentTenant ? `${unit.currentTenant.firstName} ${unit.currentTenant.lastName}` : 'NONE'}`);
    
    console.log('\nTimeline:');
    if (unit.occupancyHistory.length === 0) {
      console.log('  (No historical records found)');
    }

    unit.occupancyHistory.forEach((h, i) => {
      const start = new Date(h.startDate).toLocaleDateString();
      const end = h.endDate ? new Date(h.endDate).toLocaleDateString() : 'PRESENT';
      const tenantName = h.tenant ? `${h.tenant.firstName} ${h.tenant.lastName}` : 'Unknown';
      console.log(`  [${i + 1}] ${start} to ${end}: ${tenantName} (${h.moveReason || 'N/A'})`);
    });

  } catch (error) {
    console.error('❌ Audit Failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Default to auditing Unit 106 (Carlos Rivera's previous unit)
const unitArg = process.argv[2] || '106';
auditUnit(unitArg);
