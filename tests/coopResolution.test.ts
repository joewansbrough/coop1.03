import assert from 'node:assert/strict';
import test from 'node:test';
import {
  OBHC_COOPERATIVE_SLUG,
  CooperativeResolutionError,
  isSuperuserEmail,
  resolveCooperativeIdForRequest,
  resolveCooperativeIdForEmail,
  resolveKnownCooperativeIdForEmail,
} from '../utils/coopResolution.ts';

test('recognizes Joe as the formal system superuser without promoting Willy', () => {
  assert.equal(isSuperuserEmail('joewansbrough@gmail.com'), true);
  assert.equal(isSuperuserEmail('joewcoupons@gmail.com'), true);
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

test('superuser fallback prefers selected coop, then OBHC', async () => {
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

test('known auth resolution denies unknown emails instead of falling back to first coop', async () => {
  const prisma = {
    user: { findFirst: async () => null },
    tenant: { findFirst: async () => null },
    cooperative: {
      findUnique: async () => null,
      findFirst: async () => ({ id: 'first-coop' }),
    },
  };

  assert.equal(await resolveKnownCooperativeIdForEmail(prisma as any, 'stranger@example.com'), null);
  await assert.rejects(
    () => resolveCooperativeIdForEmail(prisma as any, 'stranger@example.com'),
    /No cooperative membership found/,
  );
});

test('normal requests resolve cooperative from subdomain host', async () => {
  const prisma = {
    user: { findFirst: async () => ({ cooperativeId: 'wrong-coop', isSystemAdmin: false }) },
    tenant: { findFirst: async () => null },
    cooperative: {
      findUnique: async ({ where }: any) => {
        assert.deepEqual(where, { subdomain: 'oak' });
        return { id: 'coop-oak', status: 'ACTIVE' };
      },
      findFirst: async () => null,
    },
  };

  const req = {
    get: (name: string) => name === 'host' ? 'oak.coophub.test' : '',
    session: { user: { email: 'resident@example.com', cooperativeId: 'wrong-coop' } },
  };

  assert.equal(await resolveCooperativeIdForRequest(prisma as any, req), 'coop-oak');
});

test('unmanaged preview hosts use authenticated cooperative context instead of subdomain lookup', async () => {
  let cooperativeLookupCount = 0;
  const prisma = {
    user: {
      findFirst: async ({ where }: any) => {
        assert.equal(where.email, 'resident@example.com');
        return { cooperativeId: 'coop-user', isSystemAdmin: false };
      },
    },
    tenant: { findFirst: async () => null },
    cooperative: {
      findUnique: async () => {
        cooperativeLookupCount += 1;
        return null;
      },
      findFirst: async () => ({ id: 'first-coop' }),
    },
  };

  assert.equal(await resolveCooperativeIdForRequest(prisma as any, {
    get: (name: string) => name === 'host' ? 'coop103-preview.vercel.app' : '',
    session: { user: { email: 'resident@example.com', cooperativeId: 'coop-user' } },
  }), 'coop-user');
  assert.equal(cooperativeLookupCount, 0);
});

test('unknown host does not fall back to first cooperative', async () => {
  const prisma = {
    user: { findFirst: async () => null },
    tenant: { findFirst: async () => null },
    cooperative: {
      findUnique: async () => null,
      findFirst: async () => ({ id: 'first-coop' }),
    },
  };

  await assert.rejects(
    () => resolveCooperativeIdForRequest(prisma as any, {
      get: (name: string) => name === 'host' ? 'missing.coophub.test' : '',
      session: { user: { email: 'resident@example.com' } },
    }),
    (error: any) => error instanceof CooperativeResolutionError && error.statusCode === 404,
  );
});

test('archived and suspended host cooperatives fail closed with explicit statuses', async () => {
  const makePrisma = (status: string) => ({
    cooperative: {
      findUnique: async () => ({ id: 'coop-1', status }),
      findFirst: async () => null,
    },
  });

  await assert.rejects(
    () => resolveCooperativeIdForRequest(makePrisma('ARCHIVED') as any, {
      get: (name: string) => name === 'host' ? 'oak.coophub.test' : '',
    }),
    (error: any) => error instanceof CooperativeResolutionError && error.statusCode === 410,
  );

  await assert.rejects(
    () => resolveCooperativeIdForRequest(makePrisma('SUSPENDED') as any, {
      get: (name: string) => name === 'host' ? 'oak.coophub.test' : '',
    }),
    (error: any) => error instanceof CooperativeResolutionError && error.statusCode === 403,
  );
});
