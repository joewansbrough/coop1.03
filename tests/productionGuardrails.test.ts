import assert from 'node:assert/strict';
import {
  buildSafeDebugConfig,
  canAccessDangerousRoute,
} from '../utils/productionGuardrails.ts';

assert.equal(canAccessDangerousRoute({
  sessionUser: null,
  adminApiKey: 'secret',
  providedAdminApiKey: null,
}), false);

assert.equal(canAccessDangerousRoute({
  sessionUser: { isAdmin: true },
  adminApiKey: 'secret',
  providedAdminApiKey: null,
}), true);

assert.equal(canAccessDangerousRoute({
  sessionUser: null,
  adminApiKey: 'secret',
  providedAdminApiKey: 'secret',
}), true);

assert.equal(canAccessDangerousRoute({
  sessionUser: { isAdmin: false },
  adminApiKey: 'secret',
  providedAdminApiKey: 'wrong',
}), false);

const debugConfig = buildSafeDebugConfig({
  env: {
    GOOGLE_CLIENT_ID: 'client-id',
    GOOGLE_CLIENT_SECRET: 'client-secret',
    PICKER_API_KEY: '',
    SESSION_SECRET: 'session-secret',
  },
  baseUrl: 'https://coop.example',
  isSecure: true,
  protocol: 'https',
  url: '/api/debug/config',
  originalUrl: '/api/debug/config?x=1',
});

assert.deepEqual(debugConfig, {
  hasClientId: true,
  hasClientSecret: true,
  hasPickerApiKey: false,
  hasSessionSecret: true,
  baseUrl: 'https://coop.example',
  isSecure: true,
  protocol: 'https',
  url: '/api/debug/config',
  originalUrl: '/api/debug/config?x=1',
});
assert.equal('headers' in debugConfig, false);

console.log('productionGuardrails tests passed');
