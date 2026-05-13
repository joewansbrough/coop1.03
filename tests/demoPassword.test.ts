import assert from 'node:assert/strict';
import test from 'node:test';
import { isValidDemoPassword } from '../pages/Login.tsx';

test('demo password only accepts the configured passphrase', () => {
  assert.equal(isValidDemoPassword('coophub2026'), true);
  assert.equal(isValidDemoPassword('CoopHub2026'), false);
  assert.equal(isValidDemoPassword(' coophub2026 '), false);
  assert.equal(isValidDemoPassword(''), false);
});
