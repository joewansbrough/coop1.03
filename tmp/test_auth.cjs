
const { Client } = require('pg');
const connectionString = "postgres://postgres:T3oVJP0xvzOboFhr@db.ybncyrxvgyvkdsmrliwm.supabase.co:5432/postgres";

async function main() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log('SUCCESS: Connected with T3oVJP0xvzOboFhr');
    const res = await client.query('SELECT 1');
    console.log('Query result:', res.rows);
  } catch (err) {
    console.error('FAILED: Connected with T3oVJP0xvzOboFhr', err.message);
  } finally {
    await client.end();
  }
}

main();
