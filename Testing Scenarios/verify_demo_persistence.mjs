/**
 * Unit test for Demo Mode persistence logic.
 * This runs locally without a database, interacting directly with a mock localStorage.
 */

import { demoStorage } from '../utils/demoStorage.ts';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value.toString(); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();

Object.defineProperty(global, 'localStorage', { value: localStorageMock });

async function runDemoTests() {
  console.log('🚀 Starting Demo Mode Persistence Verification...');

  try {
    // 1. Initial State Check
    const initialUnits = demoStorage.getUnits();
    const unit101 = initialUnits.find(u => u.number === '101');
    const unit102 = initialUnits.find(u => u.number === '102');
    const tenant = demoStorage.getTenants()[0];

    if (!unit101 || !unit102 || !tenant) {
      throw new Error('Test data initialization failed.');
    }

    console.log(`\n--- Test 1: Move-In (Unit ${unit101.number} <- Tenant: ${tenant.firstName}) ---`);
    demoStorage.moveIn(unit101.id, tenant.id, '2026-04-24');
    
    let units = demoStorage.getUnits();
    let tenants = demoStorage.getTenants();
    let updatedUnit = units.find(u => u.id === unit101.id);
    let updatedTenant = tenants.find(t => t.id === tenant.id);

    if (updatedUnit?.status === 'Occupied' && updatedTenant?.unitId === unit101.id) {
      console.log('✅ SUCCESS: Move-in persisted.');
    } else {
      throw new Error('Move-in state mismatch.');
    }

    console.log(`\n--- Test 2: Transfer (${unit101.number} -> ${unit102.number}) ---`);
    demoStorage.transfer(unit101.id, unit102.id, '2026-04-25');

    units = demoStorage.getUnits();
    tenants = demoStorage.getTenants();
    const fromUnit = units.find(u => u.id === unit101.id);
    const toUnit = units.find(u => u.id === unit102.id);
    updatedTenant = tenants.find(t => t.id === tenant.id);

    if (fromUnit?.status === 'Vacant' && toUnit?.status === 'Occupied' && updatedTenant?.unitId === unit102.id) {
      console.log('✅ SUCCESS: Transfer persisted.');
    } else {
      throw new Error('Transfer state mismatch.');
    }

    console.log(`\n--- Test 3: Move-Out (Unit ${unit102.number}) ---`);
    demoStorage.moveOut(unit102.id, '2026-04-26', 'End of Lease');

    units = demoStorage.getUnits();
    tenants = demoStorage.getTenants();
    const finalUnit = units.find(u => u.id === unit102.id);
    updatedTenant = tenants.find(t => t.id === tenant.id);

    if (finalUnit?.status === 'Vacant' && updatedTenant?.status === 'Past') {
      console.log('✅ SUCCESS: Move-out persisted.');
    } else {
      throw new Error('Move-out state mismatch.');
    }

    console.log('\n✨ All Demo Mode Persistence Tests Passed!');
  } catch (error) {
    console.error('\n❌ Test Suite Failed:', error.message);
  }
}

runDemoTests();
