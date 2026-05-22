import assert from 'node:assert/strict';
import {
  TenantContextError,
  withCooperativeContext,
  withTenantContext,
} from '../utils/tenantContext.ts';

const transactionPrisma = (overrides: Record<string, any> = {}) => ({
  cooperative: {
    findUnique: async ({ where }: any) => {
      if (where.subdomain === 'oak') return { id: 'coop-oak', status: 'ACTIVE' };
      if (where.id === 'coop-oak') return { id: 'coop-oak', status: 'ACTIVE' };
      return null;
    },
    findFirst: async () => null,
  },
  user: { findFirst: async () => null },
  tenant: { findFirst: async () => null },
  $transaction: async (callback: any) => callback({
    cooperative: {
      findUnique: async ({ where }: any) => {
        if (where.subdomain === 'oak') return { id: 'coop-oak', status: 'ACTIVE' };
        if (where.id === 'coop-oak') return { id: 'coop-oak', status: 'ACTIVE' };
        return null;
      },
    },
    user: {
      findFirst: async ({ where }: any) => {
        if (where.cooperativeId === 'coop-oak' && where.email === 'member@example.com') {
          return {
            id: 'user-1',
            email: 'member@example.com',
            cooperativeId: 'coop-oak',
            isActive: true,
            memberships: [{ id: 'membership-1', isActive: true, group: { slug: 'member' } }],
          };
        }
        return null;
      },
    },
    ...overrides,
  }),
  ...overrides,
});

const request = {
  get: (name: string) => name === 'host' ? 'oak.coophub.test' : '',
  session: { user: { email: 'member@example.com' } },
};

const tenantResult = await withTenantContext(transactionPrisma() as any, request, async context => {
  assert.equal(context.cooperativeId, 'coop-oak');
  assert.equal(context.user.email, 'member@example.com');
  assert.equal(context.memberships.length, 1);
  assert.equal(context.permissions.isAdmin, false);
  return 'ok';
});

assert.equal(tenantResult, 'ok');

await assert.rejects(
  () => withTenantContext(transactionPrisma() as any, { get: () => 'oak.coophub.test', session: {} }, async () => 'nope'),
  (error: any) => error instanceof TenantContextError && error.statusCode === 401,
);

await assert.rejects(
  () => withTenantContext(transactionPrisma() as any, {
    get: (name: string) => name === 'host' ? 'oak.coophub.test' : '',
    session: { user: { email: 'stranger@example.com' } },
  }, async () => 'nope'),
  (error: any) => error instanceof TenantContextError && error.statusCode === 403,
);

const backgroundResult = await withCooperativeContext(transactionPrisma() as any, 'coop-oak', async context => {
  assert.equal(context.cooperativeId, 'coop-oak');
  return 'background-ok';
});

assert.equal(backgroundResult, 'background-ok');

await assert.rejects(
  () => withCooperativeContext(transactionPrisma() as any, '', async () => 'nope'),
  (error: any) => error instanceof TenantContextError && error.statusCode === 400,
);

await assert.rejects(
  () => withCooperativeContext(transactionPrisma() as any, 'missing-coop', async () => 'nope'),
  (error: any) => error instanceof TenantContextError && error.statusCode === 404,
);

console.log('tenantContext tests passed');
