import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Connecting to database...');
    await prisma.$connect();
    console.log('Adding column "content" to "Document" table if it doesn\'t exist...');
    await prisma.$executeRawUnsafe(`ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "content" TEXT;`);
    console.log('Successfully updated database!');
  } catch (err) {
    console.error('Error updating database:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
