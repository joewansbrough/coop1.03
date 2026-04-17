const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function diagnose() {
  try {
    // Find units 103 and 106
    const units = await prisma.unit.findMany({
      where: { number: { in: ['103', '106'] } },
      include: { currentTenant: true }
    });
    
    console.log('\n=== UNIT STATE IN DATABASE ===');
    for (const u of units) {
      console.log(`\nUnit ${u.number}:`);
      console.log(`  status:          ${u.status}`);
      console.log(`  currentTenantId: ${u.currentTenantId ?? 'NULL'}`);
      console.log(`  currentTenant:   ${u.currentTenant ? `${u.currentTenant.firstName} ${u.currentTenant.lastName}` : 'NULL'}`);
    }
    
    // Find all tenants whose unitId = 103 or 106
    const affectedTenants = await prisma.tenant.findMany({
      where: { 
        OR: [
          { unit: { number: '103' } },
          { unit: { number: '106' } }
        ]
      },
      include: { unit: true }
    });
    
    console.log('\n=== TENANTS WITH UNIT 103 or 106 (via unitId) ===');
    if (affectedTenants.length === 0) {
      console.log('  No tenants found with unitId pointing to 103 or 106!');
    }
    for (const t of affectedTenants) {
      console.log(`\nTenant: ${t.firstName} ${t.lastName}`);
      console.log(`  status:        ${t.status}`);
      console.log(`  unitId:        ${t.unitId ?? 'NULL'}`);
      console.log(`  cooperativeId: ${t.cooperativeId ?? 'NULL'}`);
      console.log(`  unit.number:   ${t.unit?.number ?? 'NULL'}`);
    }
    
    // Show recent TenantHistory records
    const recentHistory = await prisma.tenantHistory.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { tenant: true, unit: true }
    });
    
    console.log('\n=== 5 MOST RECENT TENANT HISTORY RECORDS ===');
    for (const h of recentHistory) {
      console.log(`\n  ${h.tenant?.firstName} ${h.tenant?.lastName} → Unit ${h.unit?.number}`);
      console.log(`  startDate: ${h.startDate}, endDate: ${h.endDate ?? 'OPEN'}`);
      console.log(`  reason: ${h.moveReason ?? 'none'}`);
    }
    
  } catch(e) {
    console.error('Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

diagnose();
