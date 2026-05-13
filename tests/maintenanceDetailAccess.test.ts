import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('maintenance detail keeps all hooks before the tenant access guard', () => {
  const source = readFileSync(new URL('../pages/MaintenanceDetail.tsx', import.meta.url), 'utf8');

  const firstStateHook = source.indexOf("useState('')");
  const accessGuard = source.indexOf('Access Restricted');

  assert.ok(firstStateHook >= 0, 'MaintenanceDetail should declare its local state hooks');
  assert.ok(accessGuard >= 0, 'MaintenanceDetail should render an access restricted state');
  assert.ok(
    firstStateHook < accessGuard,
    'The access restricted return must come after hooks so switching admin to tenant view does not violate React hook ordering.',
  );
});
