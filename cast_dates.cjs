const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Casting Document.date...');
    await prisma.$executeRawUnsafe(`ALTER TABLE "Document" ALTER COLUMN "date" TYPE timestamptz USING "date"::timestamptz;`);
    
    console.log('Casting ScheduledMaintenance.dueDate...');
    await prisma.$executeRawUnsafe(`ALTER TABLE "ScheduledMaintenance" ALTER COLUMN "dueDate" TYPE timestamptz USING "dueDate"::timestamptz;`);
    
    console.log('Casting ScheduledMaintenance.lastCompleted...');
    await prisma.$executeRawUnsafe(`ALTER TABLE "ScheduledMaintenance" ALTER COLUMN "lastCompleted" TYPE timestamptz USING "lastCompleted"::timestamptz;`);
    
    console.log('Successfully cast string dates to timestamptz in Postgres!');
  } catch (e) {
    console.error('Error casting columns:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
