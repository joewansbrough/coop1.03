import assert from 'node:assert/strict';
import test from 'node:test';
import { buildGoogleDrivePacketFetchInit } from '../utils/googleDriveEventPacketClient.ts';

test('builds packet fetch options with credentials for authenticated sessions', () => {
  assert.deepEqual(buildGoogleDrivePacketFetchInit({ method: 'GET', demoMode: false }), {
    method: 'GET',
    credentials: 'include',
    headers: {},
  });
});

test('adds the demo Drive access header when demo mode is active', () => {
  assert.deepEqual(buildGoogleDrivePacketFetchInit({ method: 'POST', demoMode: true }), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'x-coophub-demo-mode': 'true',
    },
  });
});
