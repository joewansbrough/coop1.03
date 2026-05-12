import test from 'node:test';
import assert from 'node:assert/strict';
import { canAccessDriveRoutes } from '../api/driveAccess.ts';

test('allows Drive routes for an authenticated session', () => {
  assert.equal(canAccessDriveRoutes({ sessionUser: { email: 'member@example.com' } }), true);
});

test('allows Drive routes for explicit mock demo requests', () => {
  assert.equal(canAccessDriveRoutes({ demoModeHeader: 'true' }), true);
});

test('rejects Drive routes without a session or mock demo marker', () => {
  assert.equal(canAccessDriveRoutes({}), false);
});
