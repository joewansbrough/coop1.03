const axios = require('axios');

async function testApi() {
  try {
    // We need an ID of an existing unit and an existing tenant
    const res = await axios.get('http://localhost:3000/api/units');
    const units = res.data;
    
    // Find a vacant unit
    const vacantUnit = units.find(u => u.status === 'Vacant');
    
    const tenantRes = await axios.get('http://localhost:3000/api/tenants');
    const tenants = tenantRes.data;
    
    // Find a tenant
    const tenant = tenants.find(t => t.status !== 'Current' || !t.unitId);
    
    if (!vacantUnit || !tenant) {
      console.log('Not enough data to test. Need a vacant unit and available tenant.');
      return;
    }
    
    console.log(`Testing move-in to Unit ${vacantUnit.number} with Tenant ${tenant.firstName}...`);
    
    // Create an axios instance with bypass auth
    const client = axios.create({ baseURL: 'http://localhost:3000' });
    const authRes = await client.post('/api/auth/bypass');
    const cookie = authRes.headers['set-cookie'];
    
    const moveRes = await client.post(`/api/units/${vacantUnit.id}/move-in`, {
      tenantId: tenant.id,
      date: new Date().toISOString()
    }, {
      headers: { Cookie: cookie }
    });
    
    console.log('Success:', moveRes.data);
  } catch (e) {
    if (e.response) {
      console.error('API Error Response:', e.response.status, e.response.data);
    } else {
      console.error('Connection Error:', e.message);
    }
  }
}

testApi();
