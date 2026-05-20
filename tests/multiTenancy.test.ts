import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertCooperativeWhere,
  resolveCooperativeLookup,
  resolveWorkspaceAccess,
} from '../utils/multiTenancy.ts';

test('resolves cooperative lookup from production subdomain', () => {
  assert.deepEqual(resolveCooperativeLookup('oak-bay.coopbase.app'), {
    subdomain: 'oak-bay',
    isLocal: false,
  });
});

test('does not silently resolve localhost without an explicit default slug', () => {
  assert.deepEqual(resolveCooperativeLookup('localhost:3000'), {
    subdomain: null,
    isLocal: true,
  });
});

test('uses explicit local development cooperative only for localhost', () => {
  assert.deepEqual(resolveCooperativeLookup('localhost:3000', 'oak-bay'), {
    subdomain: 'oak-bay',
    isLocal: true,
  });
});

test('workspace access denies ambiguous and inactive states with defined statuses', () => {
  assert.deepEqual(resolveWorkspaceAccess(null, null), {
    allowed: false,
    httpStatus: 404,
    code: 'workspace_not_found',
    message: 'Workspace not found.',
  });

  assert.deepEqual(resolveWorkspaceAccess({ status: 'pending_setup' }, null), {
    allowed: false,
    httpStatus: 403,
    code: 'workspace_not_live',
    message: 'This workspace is not live yet.',
  });

  assert.deepEqual(resolveWorkspaceAccess({ status: 'cancelled' }, null), {
    allowed: false,
    httpStatus: 410,
    code: 'workspace_unavailable',
    message: 'This workspace is no longer available.',
  });

  assert.deepEqual(resolveWorkspaceAccess({ status: 'active' }, { status: 'Past' }), {
    allowed: false,
    httpStatus: 403,
    code: 'membership_inactive',
    message: 'Your membership is no longer active. Contact the board if this is incorrect.',
  });
});

test('workspace access allows active members of active cooperatives', () => {
  assert.deepEqual(resolveWorkspaceAccess({ status: 'active' }, { status: 'Current' }), {
    allowed: true,
  });
});

test('tenant query guard requires cooperativeId filters on scoped models', () => {
  assert.doesNotThrow(() => assertCooperativeWhere('Document', 'findMany', { where: { cooperativeId: 'coop-1' } }));
  assert.throws(
    () => assertCooperativeWhere('Document', 'findMany', { where: { category: 'Minutes' } }),
    /Document\.findMany missing cooperativeId filter/,
  );
  assert.doesNotThrow(() => assertCooperativeWhere('Cooperative', 'findMany', {}));
});
