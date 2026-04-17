const axios = require('axios');

async function testTransfer() {
  try {
    const unitsRes = await axios.get('http://localhost:3000/api/units');
    const units = unitsRes.data;
    
    // Find unit 106 (or any occupied) and 105 (or any vacant)
    const sourceUnit = units.find(u => u.status === 'Occupied' && u.currentTenant);
    const destUnit = units.find(u => u.status === 'Vacant');
    
    if (!sourceUnit || !destUnit) {
      console.log('Need at least one occupied and one vacant unit for test.');
      console.log('Units:', units.map(u => `${u.number}:${u.status}`).join(', '));
      return;
    }
    
    console.log(`\nAttempting transfer: Unit ${sourceUnit.number} → Unit ${destUnit.number}`);
    console.log(`Tenant: ${sourceUnit.currentTenant?.firstName} ${sourceUnit.currentTenant?.lastName}`);
    console.log(`Tenant.cooperativeId: ${sourceUnit.currentTenant?.cooperativeId ?? 'NULL!'}`);
    
    // Do auth bypass
    const client = axios.create({ baseURL: 'http://localhost:3000', withCredentials: true });
    const authRes = await client.post('/api/auth/bypass');
    const cookie = authRes.headers['set-cookie'];
    
    const transferRes = await client.post(`/api/units/${sourceUnit.id}/transfer`, {
      fromUnitId: sourceUnit.id,
      toUnitId: destUnit.id,
      date: new Date().toISOString().split('T')[0]
    }, { headers: { Cookie: cookie } });
    
    console.log('\nAPI Response:', transferRes.data);
    
    // Verify DB state
    const afterRes = await axios.get('http://localhost:3000/api/units');
    const afterUnits = afterRes.data;
    const src = afterUnits.find(u => u.id === sourceUnit.id);
    const dst = afterUnits.find(u => u.id === destUnit.id);
    
    console.log(`\nAfter transfer:`);
    console.log(`  Unit ${sourceUnit.number}: status=${src.status}, currentTenant=${src.currentTenant?.firstName ?? 'NULL'}`);
    console.log(`  Unit ${destUnit.number}: status=${dst.status}, currentTenant=${dst.currentTenant?.firstName ?? 'NULL'}`);
    
  } catch (e) {
    if (e.response) {
      console.error('\nAPI Error:', e.response.status, JSON.stringify(e.response.data, null, 2));
    } else {
      console.error('\nError:', e.message);
    }
  }
}

testTransfer();
