import pg from 'pg';
const { Client } = pg;
const connectionString = "postgres://postgres:T3oVJP0xvzOboFhr@db.pjbopzxnktmkodjlvjwh.supabase.co:5432/postgres?sslmode=require";

async function main() {
  const client = new Client({ connectionString });
  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Adding column "content" to "Document" table...');
    await client.query('ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "content" TEXT;');
    console.log('Successfully updated database!');
  } catch (err) {
    console.error('Error updating database:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
