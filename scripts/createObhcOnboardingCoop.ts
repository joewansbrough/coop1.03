import { PrismaClient } from '@prisma/client';
import { createObhcOnboardingCoop, parseObhcDriveRootFolderIdsFromEnv } from '../services/obhcOnboarding.js';

const prisma = new PrismaClient();

const main = async () => {
  const result = await createObhcOnboardingCoop(prisma as any, {
    driveRootFolderIds: parseObhcDriveRootFolderIdsFromEnv(),
  });
  console.log(JSON.stringify({
    cooperativeId: result.cooperative.id,
    slug: result.cooperative.slug,
    unitNumber: result.unit.number,
    willyTenantId: result.willyTenant.id,
    joeUserId: result.joeUser?.id,
    driveRootFolderIds: result.driveRootFolderIds,
  }, null, 2));
};

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
