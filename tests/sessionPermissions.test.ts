import assert from 'node:assert/strict';
import {
  hasFreshSessionPermissions,
  SESSION_PERMISSION_TTL_MS,
} from '../utils/sessionPermissions.ts';

const now = 1_000_000;

assert.equal(hasFreshSessionPermissions(null, now), false);
assert.equal(hasFreshSessionPermissions({ email: 'admin@example.com' }, now), false);
assert.equal(hasFreshSessionPermissions({
  email: 'admin@example.com',
  cooperativeId: 'coop-1',
  permissionKeys: ['documents.view.members'],
  groupIds: [],
  permissionsHydratedAt: now - SESSION_PERMISSION_TTL_MS + 1,
}, now), true);
assert.equal(hasFreshSessionPermissions({
  email: 'admin@example.com',
  cooperativeId: 'coop-1',
  permissionKeys: ['documents.view.members'],
  groupIds: [],
  permissionsHydratedAt: now - SESSION_PERMISSION_TTL_MS - 1,
}, now), false);

console.log('sessionPermissions tests passed');
