import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:3000'; // Adjust if your local dev server is on a different port

async function runTests() {
  console.log('🚀 Starting Residency Logic Verification...');

  try {
    // 1. Setup: Find a clean state
    const unit105 = await prisma.unit.findFirst({ where: { number: '105' } }); // Vacant in seed
    const unit304 = await prisma.unit.findFirst({ where: { number: '304' } }); // Vacant in seed
    const waitlistTenant = await prisma.tenant.findFirst({ where: { status: 'Waitlist' } });

    if (!unit105 || !unit304 || !waitlistTenant) {
      throw new Error('Test data not found. Please run /api/seed first.');
    }

    console.log(`\n--- Test 1: Move-In (Tenant: ${waitlistTenant.firstName}) ---`);
    const moveInRes = await fetch(`${BASE_URL}/api/units/${unit105.id}/move-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: waitlistTenant.id, date: new Date().toISOString() })
    });
    
    if (moveInRes.ok) {
      const history = await prisma.tenantHistory.findFirst({
        where: { tenantId: waitlistTenant.id, unitId: unit105.id, endDate: null }
      });
      console.log(history ? '✅ SUCCESS: Open history record created.' : '❌ FAILURE: No open history record.');
    }

    console.log(`\n--- Test 2: Internal Transfer (105 -> 304) ---`);
    const transferRes = await fetch(`${BASE_URL}/api/units/${unit105.id}/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toUnitId: unit304.id, date: new Date().toISOString() })
    });

    if (transferRes.ok) {
      const oldHistory = await prisma.tenantHistory.findFirst({
        where: { tenantId: waitlistTenant.id, unitId: unit105.id, NOT: { endDate: null } }
      });
      const newHistory = await prisma.tenantHistory.findFirst({
        where: { tenantId: waitlistTenant.id, unitId: unit304.id, endDate: null }
      });
      console.log(oldHistory ? '✅ SUCCESS: Old history closed.' : '❌ FAILURE: Old history remains open.');
      console.log(newHistory ? '✅ SUCCESS: New history opened.' : '❌ FAILURE: New history not created.');
    }

    console.log(`\n--- Test 3: Move-Out (Unit 304) ---`);
    const moveOutRes = await fetch(`${BASE_URL}/api/units/${unit304.id}/move-out`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: new Date().toISOString(), reason: 'End of Lease' })
    });

    if (moveOutRes.ok) {
      const finalHistory = await prisma.tenantHistory.findFirst({
        where: { tenantId: waitlistTenant.id, unitId: unit304.id, NOT: { endDate: null } }
      });
      const tenantStatus = await prisma.tenant.findUnique({ where: { id: waitlistTenant.id } });
      console.log(finalHistory ? '✅ SUCCESS: Final history closed.' : '❌ FAILURE: Final history remains open.');
      console.log(tenantStatus.status === 'Past' ? '✅ SUCCESS: Tenant status is Past.' : '❌ FAILURE: Tenant status incorrect.');
    }

  } catch (error) {
    console.error('❌ Test Suite Failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
