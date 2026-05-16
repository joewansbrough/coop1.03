import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ensureUserForEmail,
  makeImpersonatedSessionUser,
  makeSessionUser,
  resolveTestingTargetUser,
  restoreImpersonatedSessionUser,
} from '../utils/rbacDb.ts';

const adminSubject = {
  userId: 'admin-user',
  email: 'admin@example.com',
  cooperativeId: 'coop-1',
  groupIds: ['admin-group'],
  permissionKeys: ['users.manage_groups', 'settings.update'],
  committeeIds: [],
  isAdmin: true,
};

const memberSubject = {
  userId: 'member-user',
  email: 'member@example.com',
  cooperativeId: 'coop-1',
  groupIds: ['member-group'],
  permissionKeys: ['documents.view.members'],
  committeeIds: [],
  isAdmin: false,
};

test('impersonated session uses target user permissions and keeps original admin', () => {
  const adminSession = makeSessionUser({
    id: 'admin-user',
    email: 'admin@example.com',
    name: 'Admin User',
    cooperativeId: 'coop-1',
  }, adminSubject);

  const memberSession = makeImpersonatedSessionUser(adminSession, {
    id: 'member-user',
    email: 'member@example.com',
    name: 'Member User',
    cooperativeId: 'coop-1',
    tenant: { unit: { number: '101' } },
  }, memberSubject);

  assert.equal(memberSession.email, 'member@example.com');
  assert.equal(memberSession.isAdmin, false);
  assert.deepEqual(memberSession.permissionKeys, ['documents.view.members']);
  assert.equal(memberSession.isImpersonating, true);
  assert.equal(memberSession.impersonator.email, 'admin@example.com');
});

test('restores original admin session from impersonated session', () => {
  const adminSession = makeSessionUser({
    id: 'admin-user',
    email: 'admin@example.com',
    name: 'Admin User',
    cooperativeId: 'coop-1',
  }, adminSubject);
  const memberSession = makeImpersonatedSessionUser(adminSession, {
    id: 'member-user',
    email: 'member@example.com',
    name: 'Member User',
    cooperativeId: 'coop-1',
  }, memberSubject);

  assert.deepEqual(restoreImpersonatedSessionUser(memberSession), adminSession);
});

test('resolves an impersonation target from a member directory tenant id', async () => {
  const calls: string[] = [];
  const fakeUser = { id: 'user-from-tenant', email: 'member@example.com' };
  const fakePrisma = {
    user: {
      findFirst: async () => null,
      upsert: async () => fakeUser,
      findUnique: async () => fakeUser,
    },
    tenant: {
      findFirst: async ({ where }: any) => {
        if (where.id) calls.push(where.id);
        return { id: 'tenant-1', email: 'member@example.com', cooperativeId: 'coop-1' };
      },
    },
    permission: {
      upsert: async ({ create }: any) => create,
    },
    group: {
      upsert: async ({ create }: any) => create,
      findUnique: async () => ({ id: 'member-group' }),
    },
    groupPermission: {
      upsert: async () => ({}),
    },
    committee: {
      findMany: async () => [],
    },
    membership: {
      upsert: async () => ({}),
    },
  };

  const target = await resolveTestingTargetUser(fakePrisma, 'coop-1', 'tenant-1');

  assert.equal(target.id, 'user-from-tenant');
  assert.deepEqual(calls, ['tenant-1']);
});

test('falls back to legacy tenant session shape when the User table is missing', async () => {
  const fakePrisma = {
    user: {
      upsert: async () => {
        const error: any = new Error('The table `public.User` does not exist in the current database.');
        error.code = 'P2021';
        error.meta = { table: 'public.User' };
        throw error;
      },
    },
    tenant: {
      findFirst: async () => ({
        id: 'tenant-1',
        cooperativeId: 'coop-1',
        email: 'admin@example.com',
        firstName: 'Ada',
        lastName: 'Admin',
        status: 'Current',
        role: 'ADMIN',
        unit: { number: '101' },
        committees: [],
      }),
    },
  };

  const user = await ensureUserForEmail(fakePrisma, 'coop-1', 'admin@example.com', {
    name: 'Ada Admin',
    googleSubjectId: 'google-subject',
  });
  const subject = {
    userId: user.id,
    email: user.email,
    cooperativeId: user.cooperativeId,
    groupIds: [],
    permissionKeys: [],
    committeeIds: [],
    isAdmin: user.isSystemAdmin,
  };
  const sessionUser = makeSessionUser(user, subject);

  assert.equal(sessionUser.email, 'admin@example.com');
  assert.equal(sessionUser.tenantId, 'tenant-1');
  assert.equal(sessionUser.unitNumber, '101');
  assert.equal(sessionUser.isAdmin, true);
  assert.equal(user.__legacyTenantFallback, true);
});
