import assert from 'node:assert/strict';
import {
  COOPERATIVE_OWNED_MODELS,
  assertCooperativeScopedQuery,
  installQueryGuard,
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

assert.equal(shouldInstallQueryGuard('production'), true);
assert.equal(shouldInstallQueryGuard('development'), true);
assert.equal(shouldInstallQueryGuard('test'), true);

const installed: any[] = [];
const fakePrisma = { $use: (middleware: any) => installed.push(middleware) };
installQueryGuard(fakePrisma, 'production', {
  report: finding => installed.push({ finding }),
});

assert.equal(installed.length, 1);
const productionResult = await installed[0](
  { model: 'Tenant', action: 'findMany', args: { where: { status: 'Current' } } },
  async () => 'continued',
);

assert.equal(productionResult, 'continued');
assert.equal(installed.length, 2);
assert.deepEqual(installed[1].finding, {
  model: 'Tenant',
  action: 'findMany',
  message: '[QueryGuard] Tenant.findMany missing cooperativeId scope.',
});

const devMiddleware: any[] = [];
installQueryGuard({ $use: (middleware: any) => devMiddleware.push(middleware) }, 'development');
await assert.rejects(
  () => devMiddleware[0](
    { model: 'Tenant', action: 'findMany', args: { where: { status: 'Current' } } },
    async () => 'blocked',
  ),
  /missing cooperativeId scope/,
);

console.log('queryGuard tests passed');
