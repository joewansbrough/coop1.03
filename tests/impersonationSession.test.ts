import assert from 'node:assert/strict';
import test from 'node:test';
import {
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
