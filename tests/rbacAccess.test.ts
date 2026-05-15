import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canAccessDocument,
  getEffectivePermissionKeys,
  getVisibleDocumentWhere,
  explainDocumentAccess,
  type DocumentAccessSubject,
  type PermissionAssignment,
} from '../utils/rbac.ts';

const memberSubject: DocumentAccessSubject = {
  userId: 'u-member',
  email: 'member@example.com',
  cooperativeId: 'coop-1',
  groupIds: ['group-member'],
  permissionKeys: ['documents.view.members'],
  isAdmin: false,
};

const boardSubject: DocumentAccessSubject = {
  userId: 'u-board',
  email: 'board@example.com',
  cooperativeId: 'coop-1',
  groupIds: ['group-member', 'group-board'],
  permissionKeys: ['documents.view.members', 'documents.view.board'],
  isAdmin: false,
};

const adminSubject: DocumentAccessSubject = {
  userId: 'u-admin',
  email: 'admin@example.com',
  cooperativeId: 'coop-1',
  groupIds: ['group-admin'],
  permissionKeys: ['documents.view.members', 'documents.view.board', 'documents.view.admin'],
  isAdmin: true,
};

test('combines permissions from all active memberships', () => {
  const assignments: PermissionAssignment[] = [
    { groupId: 'group-member', permissionKey: 'documents.view.members', active: true },
    { groupId: 'group-board', permissionKey: 'documents.view.board', active: true },
    { groupId: 'group-finance', permissionKey: 'documents.view.finance', active: false },
  ];

  assert.deepEqual(
    getEffectivePermissionKeys(['group-member', 'group-board', 'group-finance'], assignments),
    ['documents.view.board', 'documents.view.members'],
  );
});

test('blocks ordinary members from board documents', () => {
  assert.equal(
    canAccessDocument(memberSubject, {
      cooperativeId: 'coop-1',
      visibility: 'BOARD',
      accessRules: [],
    }),
    false,
  );
});

test('allows board users to view board documents', () => {
  assert.equal(
    canAccessDocument(boardSubject, {
      cooperativeId: 'coop-1',
      visibility: 'BOARD',
      accessRules: [],
    }),
    true,
  );
});

test('allows custom documents through explicit group rules', () => {
  assert.equal(
    canAccessDocument(boardSubject, {
      cooperativeId: 'coop-1',
      visibility: 'CUSTOM',
      accessRules: [{ groupId: 'group-board', permission: 'VIEW' }],
    }),
    true,
  );
});

test('allows private documents only to owner or admin', () => {
  assert.equal(
    canAccessDocument(memberSubject, {
      cooperativeId: 'coop-1',
      visibility: 'PRIVATE',
      ownerUserId: 'u-other',
      accessRules: [],
    }),
    false,
  );
  assert.equal(
    canAccessDocument({ ...memberSubject, userId: 'u-owner' }, {
      cooperativeId: 'coop-1',
      visibility: 'PRIVATE',
      ownerUserId: 'u-owner',
      accessRules: [],
    }),
    true,
  );
  assert.equal(
    canAccessDocument(adminSubject, {
      cooperativeId: 'coop-1',
      visibility: 'PRIVATE',
      ownerUserId: 'u-other',
      accessRules: [],
    }),
    true,
  );
});

test('builds a Prisma document where clause that excludes board docs for members', () => {
  assert.deepEqual(getVisibleDocumentWhere(memberSubject), {
    cooperativeId: 'coop-1',
    OR: [
      { visibility: 'PUBLIC' },
      { visibility: 'MEMBERS' },
      { visibility: 'CUSTOM', accessRules: { some: { OR: [{ userId: 'u-member' }, { groupId: { in: ['group-member'] } }] } } },
      { visibility: 'PRIVATE', ownerUserId: 'u-member' },
    ],
  });
});

test('explains why a board user can see a board document', () => {
  assert.equal(
    explainDocumentAccess(boardSubject, {
      cooperativeId: 'coop-1',
      visibility: 'BOARD',
      accessRules: [],
    }).reason,
    'User has documents.view.board.',
  );
});
