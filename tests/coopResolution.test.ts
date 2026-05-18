import assert from 'node:assert/strict';
import test from 'node:test';
import {
  OBHC_COOPERATIVE_SLUG,
  isSuperuserEmail,
  resolveCooperativeIdForEmail,
} from '../utils/coopResolution.ts';

test('recognizes Joe as the formal system superuser without promoting Willy', () => {
  assert.equal(isSuperuserEmail('joewansbrough@gmail.com'), true);
  assert.equal(isSuperuserEmail('wwansbro@gmail.com'), false);
});

test('regular users resolve by existing user before tenant and fallback', async () => {
  const prisma = {
    user: {
      findFirst: async ({ where }: any) => {
        assert.equal(where.email, 'resident@example.com');
        return { cooperativeId: 'coop-user', isSystemAdmin: false };
      },
    },
    tenant: { findFirst: async () => ({ cooperativeId: 'coop-tenant' }) },
    cooperative: { findUnique: async () => null, findFirst: async () => ({ id: 'coop-first' }) },
  };

  assert.equal(await resolveCooperativeIdForEmail(prisma as any, 'resident@example.com'), 'coop-user');
});

test('regular users resolve by tenant email when no user row exists', async () => {
  const prisma = {
    user: { findFirst: async () => null },
    tenant: { findFirst: async () => ({ cooperativeId: 'coop-tenant' }) },
    cooperative: { findUnique: async () => null, findFirst: async () => ({ id: 'coop-first' }) },
  };

  assert.equal(await resolveCooperativeIdForEmail(prisma as any, 'resident@example.com'), 'coop-tenant');
});

test('superuser fallback prefers selected coop, then OBHC, then first coop', async () => {
  const calls: string[] = [];
  const prisma = {
    user: { findFirst: async () => ({ cooperativeId: 'coop-joe-home', isSystemAdmin: true }) },
    tenant: { findFirst: async () => null },
    cooperative: {
      findUnique: async ({ where }: any) => {
        calls.push(`unique:${where.id || where.slug}`);
        if (where.id === 'selected-coop') return { id: 'selected-coop' };
        if (where.slug === OBHC_COOPERATIVE_SLUG) return { id: 'obhc-coop' };
        return null;
      },
      findFirst: async () => ({ id: 'first-coop' }),
    },
  };

  assert.equal(
    await resolveCooperativeIdForEmail(prisma as any, 'joewansbrough@gmail.com', { selectedCooperativeId: 'selected-coop' }),
    'selected-coop',
  );
  assert.equal(await resolveCooperativeIdForEmail(prisma as any, 'joewansbrough@gmail.com'), 'obhc-coop');
  assert.deepEqual(calls, [`unique:selected-coop`, `unique:${OBHC_COOPERATIVE_SLUG}`]);
});
