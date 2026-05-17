import assert from 'node:assert/strict';
import test from 'node:test';
import { readApiResponse } from '../utils/apiResponse.ts';

test('reads JSON API responses', async () => {
  const response = new Response(JSON.stringify({ ok: true }), {
    headers: { 'content-type': 'application/json' },
  });

  assert.deepEqual(await readApiResponse(response), { ok: true });
});

test('turns non-JSON failure pages into readable errors', async () => {
  const response = new Response('An error occurred with this application.', {
    status: 504,
    statusText: 'Gateway Timeout',
    headers: { 'content-type': 'text/plain' },
  });

  await assert.rejects(readApiResponse(response), /An error occurred/);
});
