import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import { parseDriveRootFolderIds } from './cooperativeDriveRoots.js';
import { ensureUserForEmail, seedRbacDefaults } from '../utils/rbacDb.js';
import { OBHC_COOPERATIVE_SLUG, SUPERUSER_EMAILS } from '../utils/coopResolution.js';

type PrismaLike = PrismaClient & any;

export const OBHC_COOPERATIVE_NAME = 'Oak Bay Housing Cooperative';
export const OBHC_UNIT_NUMBER = '107';
export const WILLY_EMAIL = 'wwansbro@gmail.com';
export const JOE_EMAIL = SUPERUSER_EMAILS[0];

const now = () => new Date();

const ensureObhcOnboardingSchema = async (p: PrismaLike) => {
  if (!p.$executeRaw) return;

  await p.$executeRaw(Prisma.sql`DROP INDEX IF EXISTS "Unit_number_key"`);
  await p.$executeRaw(Prisma.sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "Unit_cooperativeId_number_key"
    ON "Unit"("cooperativeId", "number")
  `);
  await p.$executeRaw(Prisma.sql`
    CREATE TABLE IF NOT EXISTS "CooperativeDriveRoot" (
      "id" TEXT NOT NULL,
      "cooperativeId" TEXT NOT NULL,
      "folderId" TEXT NOT NULL,
      "displayName" TEXT,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "CooperativeDriveRoot_pkey" PRIMARY KEY ("id")
    )
  `);
  await p.$executeRaw(Prisma.sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "CooperativeDriveRoot_cooperativeId_folderId_key"
    ON "CooperativeDriveRoot"("cooperativeId", "folderId")
  `);
  await p.$executeRaw(Prisma.sql`
    CREATE INDEX IF NOT EXISTS "CooperativeDriveRoot_cooperativeId_idx"
    ON "CooperativeDriveRoot"("cooperativeId")
  `);
  await p.$executeRaw(Prisma.sql`
    CREATE INDEX IF NOT EXISTS "CooperativeDriveRoot_folderId_idx"
    ON "CooperativeDriveRoot"("folderId")
  `);
  await p.$executeRaw(Prisma.sql`
    ALTER TABLE "CooperativeDriveRoot"
    DROP CONSTRAINT IF EXISTS "CooperativeDriveRoot_cooperativeId_fkey"
  `);
  await p.$executeRaw(Prisma.sql`
    ALTER TABLE "CooperativeDriveRoot"
    ADD CONSTRAINT "CooperativeDriveRoot_cooperativeId_fkey"
    FOREIGN KEY ("cooperativeId") REFERENCES "Cooperative"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
  `);
};

const upsertUnit107 = async (p: PrismaLike, cooperativeId: string) => {
  const existing = await p.unit.findFirst({ where: { cooperativeId, number: OBHC_UNIT_NUMBER } });
  const data = {
    cooperativeId,
    number: OBHC_UNIT_NUMBER,
    type: '1BR',
    floor: 1,
    status: 'Occupied',
  };
  if (existing) return p.unit.update({ where: { id: existing.id }, data });
  return p.unit.create({ data: { id: crypto.randomUUID(), ...data } });
};

const upsertWillyTenant = async (p: PrismaLike, cooperativeId: string, unitId: string) => {
  const existing = await p.tenant.findFirst({ where: { email: WILLY_EMAIL } });
  const data = {
    firstName: 'Willy',
    lastName: 'Wansbrough',
    email: WILLY_EMAIL,
    cooperativeId,
    unitId,
    status: 'Current',
    role: 'ADMIN',
    startDate: now(),
  };
  if (existing) return p.tenant.update({ where: { id: existing.id }, data });
  return p.tenant.create({ data: { id: crypto.randomUUID(), ...data } });
};

const ensureAdminMembership = async (p: PrismaLike, cooperativeId: string, userId: string) => {
  const adminGroup = await p.group.findUnique({ where: { cooperativeId_slug: { cooperativeId, slug: 'admin' } } });
  if (!adminGroup) return;
  await p.membership.upsert({
    where: { userId_groupId: { userId, groupId: adminGroup.id } },
    update: { isActive: true },
    create: {
      id: crypto.randomUUID(),
      cooperativeId,
      userId,
      groupId: adminGroup.id,
      source: 'SYSTEM',
      isActive: true,
    },
  });
};

const ensureTenantHistory = async (p: PrismaLike, cooperativeId: string, tenantId: string, unitId: string) => {
  const existing = await p.tenantHistory.findFirst({ where: { cooperativeId, tenantId, unitId } });
  if (existing) return existing;
  return p.tenantHistory.create({
    data: {
      id: crypto.randomUUID(),
      cooperativeId,
      tenantId,
      unitId,
      startDate: now(),
      moveReason: 'OBHC onboarding',
    },
  });
};

export const createObhcOnboardingCoop = async (
  p: PrismaLike,
  options: { driveRootFolderIds?: string[] } = {},
) => {
  await ensureObhcOnboardingSchema(p);

  const cooperative = await p.cooperative.upsert({
    where: { slug: OBHC_COOPERATIVE_SLUG },
    update: {
      name: OBHC_COOPERATIVE_NAME,
      adminEmail: JOE_EMAIL,
    },
    create: {
      id: crypto.randomUUID(),
      name: OBHC_COOPERATIVE_NAME,
      slug: OBHC_COOPERATIVE_SLUG,
      province: 'BC',
      adminEmail: JOE_EMAIL,
    },
  });

  const unit = await upsertUnit107(p, cooperative.id);
  const willyTenant = await upsertWillyTenant(p, cooperative.id, unit.id);
  await p.unit.update({ where: { id: unit.id }, data: { currentTenantId: willyTenant.id, status: 'Occupied' } });
  await ensureTenantHistory(p, cooperative.id, willyTenant.id, unit.id);

  await seedRbacDefaults(p, cooperative.id);
  const willyUser = await ensureUserForEmail(p, cooperative.id, WILLY_EMAIL, {
    name: 'Willy Wansbrough',
    firstName: 'Willy',
    lastName: 'Wansbrough',
  });
  if (willyUser?.id) await ensureAdminMembership(p, cooperative.id, willyUser.id);

  const joeUser = await ensureUserForEmail(p, cooperative.id, JOE_EMAIL, {
    name: 'Joe Wansbrough',
    firstName: 'Joe',
    lastName: 'Wansbrough',
  });
  let effectiveJoeUser = joeUser;
  if (joeUser?.id && !(joeUser as any).__legacyTenantFallback) {
    effectiveJoeUser = await p.user.update({
      where: { id: joeUser.id },
      data: {
        name: 'Joe Wansbrough',
        firstName: 'Joe',
        lastName: 'Wansbrough',
        tenantId: null,
        isSystemAdmin: true,
        isActive: true,
      },
    });
    await ensureAdminMembership(p, cooperative.id, joeUser.id);
  }

  const cleanDriveRootFolderIds = (options.driveRootFolderIds || []).map(id => id.trim()).filter(Boolean);
  for (const folderId of cleanDriveRootFolderIds) {
    await p.cooperativeDriveRoot.upsert({
      where: { cooperativeId_folderId: { cooperativeId: cooperative.id, folderId } },
      update: { isActive: true },
      create: {
        id: crypto.randomUUID(),
        cooperativeId: cooperative.id,
        folderId,
        displayName: null,
        isActive: true,
      },
    });
  }

  return {
    cooperative,
    unit,
    willyTenant,
    willyUser,
    joeUser: effectiveJoeUser,
    driveRootFolderIds: cleanDriveRootFolderIds,
  };
};

export const parseObhcDriveRootFolderIdsFromEnv = (env: NodeJS.ProcessEnv = process.env) =>
  parseDriveRootFolderIds(
    env.OBHC_GOOGLE_DRIVE_ROOT_FOLDER_IDS || env.GOOGLE_DRIVE_ROOT_FOLDER_IDS,
    env.OBHC_GOOGLE_DRIVE_ROOT_FOLDER_ID || env.GOOGLE_DRIVE_ROOT_FOLDER_ID,
  );
