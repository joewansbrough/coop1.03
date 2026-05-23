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
  report: finding => {
    installed.push({ finding });
  },
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
  cooperativeId: null,
  environment: 'production',
  argsSummary: {
    whereKeys: ['status'],
    hasData: false,
  },
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

const durableMiddleware: any[] = [];
const durableWrites: any[] = [];
installQueryGuard({
  $use: (middleware: any) => durableMiddleware.push(middleware),
  queryGuardFinding: {
    create: async (payload: any) => {
      durableWrites.push(payload);
      return { id: 'finding-1', ...payload.data };
    },
  },
}, 'production');

const originalWarn = console.warn;
console.warn = () => {
  throw new Error('production query guard findings should not be console.warn-only');
};

try {
  const durableResult = await durableMiddleware[0](
    { model: 'Document', action: 'findFirst', args: { where: { id: 'doc-1' } } },
    async () => 'allowed',
  );

  assert.equal(durableResult, 'allowed');
  assert.equal(durableWrites.length, 1);
  assert.deepEqual(durableWrites[0].data, {
    model: 'Document',
    action: 'findFirst',
    message: '[QueryGuard] Document.findFirst missing cooperativeId scope.',
    cooperativeId: null,
    environment: 'production',
    argsSummary: {
      whereKeys: ['id'],
      hasData: false,
    },
  });
} finally {
  console.warn = originalWarn;
}

const reporterFailureMiddleware: any[] = [];
installQueryGuard({ $use: (middleware: any) => reporterFailureMiddleware.push(middleware) }, 'production', {
  report: async () => {
    throw new Error('report sink unavailable');
  },
});

const originalError = console.error;
const errorMessages: string[] = [];
console.error = (...args: any[]) => {
  errorMessages.push(args.map(String).join(' '));
};

try {
  const reporterFailureResult = await reporterFailureMiddleware[0](
    { model: 'Tenant', action: 'findMany', args: { where: { status: 'Current' } } },
    async () => 'still allowed',
  );

  assert.equal(reporterFailureResult, 'still allowed');
  assert.equal(errorMessages.some(message => message.includes('Failed to report finding')), true);
} finally {
  console.error = originalError;
}

console.log('queryGuard tests passed');
