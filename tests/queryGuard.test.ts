import assert from 'node:assert/strict';
import {
  COOPERATIVE_OWNED_MODELS,
  assertCooperativeScopedQuery,
  shouldInstallQueryGuard,
} from '../utils/queryGuard.ts';

assert.equal(COOPERATIVE_OWNED_MODELS.includes('Tenant'), true);
assert.equal(COOPERATIVE_OWNED_MODELS.includes('Document'), true);
assert.equal(COOPERATIVE_OWNED_MODELS.includes('Cooperative'), false);

assert.doesNotThrow(() => assertCooperativeScopedQuery({
  model: 'Tenant',
  action: 'findMany',
  args: { where: { cooperativeId: 'coop-1' } },
}));

assert.doesNotThrow(() => assertCooperativeScopedQuery({
  model: 'DocumentVersion',
  action: 'findFirst',
  args: { where: { document: { cooperativeId: 'coop-1' } } },
}));

assert.throws(
  () => assertCooperativeScopedQuery({
    model: 'MaintenanceRequest',
    action: 'findMany',
    args: { where: { status: 'Pending' } },
  }),
  /missing cooperativeId scope/,
);

assert.throws(
  () => assertCooperativeScopedQuery({
    model: 'Tenant',
    action: 'update',
    args: { where: { id: 'tenant-1' }, data: { firstName: 'Ada' } },
  }),
  /missing cooperativeId scope/,
);

assert.doesNotThrow(() => assertCooperativeScopedQuery({
  model: 'Tenant',
  action: 'create',
  args: { data: { cooperativeId: 'coop-1', email: 'member@example.com' } },
}));

assert.equal(shouldInstallQueryGuard('production'), false);
assert.equal(shouldInstallQueryGuard('development'), true);
assert.equal(shouldInstallQueryGuard('test'), true);

console.log('queryGuard tests passed');
