import assert from 'node:assert/strict';
import test from 'node:test';
import {
  makeImpersonatedSessionUser,
  makeSessionUser,
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
