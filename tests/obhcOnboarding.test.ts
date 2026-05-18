import assert from 'node:assert/strict';
import test from 'node:test';
import { createObhcOnboardingCoop } from '../services/obhcOnboarding.ts';

class InMemoryObhcPrisma {
  cooperatives: any[] = [];
  units: any[] = [];
  tenants: any[] = [];
  users: any[] = [];
  driveRoots: any[] = [];
  memberships: any[] = [];
  groups: any[] = [];
  permissions: any[] = [];
  groupPermissions: any[] = [];
  tenantHistories: any[] = [];

  cooperative = {
    upsert: async ({ where, update, create }: any) => {
      let row = this.cooperatives.find(coop => coop.slug === where.slug);
      if (!row) {
        row = { ...create };
        this.cooperatives.push(row);
      } else {
        Object.assign(row, update);
      }
      return row;
    },
  };

  unit = {
    findFirst: async ({ where }: any) => this.units.find(unit => unit.cooperativeId === where.cooperativeId && unit.number === where.number) || null,
    create: async ({ data }: any) => {
      const row = { ...data };
      this.units.push(row);
      return row;
    },
    update: async ({ where, data }: any) => {
      const row = this.units.find(unit => unit.id === where.id);
      Object.assign(row, data);
      return row;
    },
  };

  tenant = {
    findFirst: async ({ where }: any) => this.tenants.find(tenant => tenant.email === where.email || tenant.id === where.id) || null,
    create: async ({ data }: any) => {
      const row = { ...data, committees: [], unit: this.units.find(unit => unit.id === data.unitId) };
      this.tenants.push(row);
      return row;
    },
    update: async ({ where, data }: any) => {
      const row = this.tenants.find(tenant => tenant.id === where.id);
      Object.assign(row, data, { unit: this.units.find(unit => unit.id === data.unitId) });
      return row;
    },
  };

  tenantHistory = {
    findFirst: async ({ where }: any) => this.tenantHistories.find(history => history.cooperativeId === where.cooperativeId && history.tenantId === where.tenantId && history.unitId === where.unitId) || null,
    create: async ({ data }: any) => {
      this.tenantHistories.push({ ...data });
      return data;
    },
  };

  permission = { upsert: async ({ where, create, update }: any) => this.upsertBy(this.permissions, 'key', where.key, create, update) };
  group = {
    upsert: async ({ where, create, update }: any) => this.upsertBy(this.groups, 'slug', where.cooperativeId_slug.slug, create, update, where.cooperativeId_slug.cooperativeId),
    findUnique: async ({ where }: any) => this.groups.find(group => group.cooperativeId === where.cooperativeId_slug.cooperativeId && group.slug === where.cooperativeId_slug.slug) || null,
  };
  groupPermission = { upsert: async ({ where, create, update }: any) => this.upsertBy(this.groupPermissions, 'id', `${where.groupId_permissionId.groupId}:${where.groupId_permissionId.permissionId}`, { ...create, id: `${where.groupId_permissionId.groupId}:${where.groupId_permissionId.permissionId}` }, update) };
  committee = { findMany: async () => [] };
  membership = { upsert: async ({ where, create, update }: any) => this.upsertBy(this.memberships, 'id', `${where.userId_groupId.userId}:${where.userId_groupId.groupId}`, { ...create, id: `${where.userId_groupId.userId}:${where.userId_groupId.groupId}` }, update) };
  user = {
    upsert: async ({ where, create, update }: any) => this.upsertBy(this.users, 'email', where.cooperativeId_email.email, create, update, where.cooperativeId_email.cooperativeId),
    update: async ({ where, data }: any) => {
      const row = this.users.find(user => user.id === where.id);
      Object.assign(row, data);
      return row;
    },
    findUnique: async ({ where }: any) => {
      const row = this.users.find(user => user.id === where.id);
      if (!row) return null;
      return { ...row, memberships: this.memberships.filter(membership => membership.userId === row.id).map(membership => ({ ...membership, group: this.groups.find(group => group.id === membership.groupId) })), accessOverrides: [], tenant: this.tenants.find(tenant => tenant.id === row.tenantId) || null };
    },
  };
  cooperativeDriveRoot = {
    upsert: async ({ where, create, update }: any) => this.upsertBy(this.driveRoots, 'folderId', where.cooperativeId_folderId.folderId, create, update, where.cooperativeId_folderId.cooperativeId),
  };

  upsertBy(rows: any[], field: string, value: string, create: any, update: any, cooperativeId?: string) {
    let row = rows.find(candidate => candidate[field] === value && (!cooperativeId || candidate.cooperativeId === cooperativeId));
    if (!row) {
      row = { ...create };
      rows.push(row);
    } else {
      Object.assign(row, update);
    }
    return row;
  }
}

test('OBHC onboarding setup is idempotent and keeps Joe tenantless', async () => {
  const prisma = new InMemoryObhcPrisma();

  await createObhcOnboardingCoop(prisma as any, { driveRootFolderIds: ['drive-root-a'] });
  await createObhcOnboardingCoop(prisma as any, { driveRootFolderIds: ['drive-root-a'] });

  assert.equal(prisma.cooperatives.length, 1);
  assert.equal(prisma.cooperatives[0].slug, 'obhc');
  assert.equal(prisma.units.length, 1);
  assert.equal(prisma.units[0].number, '107');
  assert.equal(prisma.tenants.length, 1);
  assert.equal(prisma.tenants[0].email, 'wwansbro@gmail.com');
  assert.equal(prisma.tenants[0].role, 'ADMIN');
  assert.equal(prisma.users.find(user => user.email === 'wwansbro@gmail.com')?.tenantId, prisma.tenants[0].id);
  const joe = prisma.users.find(user => user.email === 'joewansbrough@gmail.com');
  assert.equal(joe?.isSystemAdmin, true);
  assert.equal(joe?.tenantId, null);
  assert.equal(prisma.driveRoots.length, 1);
  assert.equal(prisma.driveRoots[0].folderId, 'drive-root-a');
});
