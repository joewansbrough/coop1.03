import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGoogleTokenRequestBody,
  getOAuthErrorSummary,
} from '../utils/googleOAuth.ts';

test('builds Google token exchange as form encoded body', () => {
  const body = buildGoogleTokenRequestBody({
    code: 'code-123',
    clientId: 'client-id',
    clientSecret: 'secret-value',
    redirectUri: 'https://demo.coophub.ca/auth/callback',
  });

  assert.equal(body.toString(), 'code=code-123&client_id=client-id&client_secret=secret-value&redirect_uri=https%3A%2F%2Fdemo.coophub.ca%2Fauth%2Fcallback&grant_type=authorization_code');
});

test('summarizes OAuth errors without leaking request secrets', () => {
  const summary = getOAuthErrorSummary({
    code: 'ERR_BAD_REQUEST',
    message: 'Request failed with status code 400',
    config: {
      data: JSON.stringify({
        code: 'one-time-code',
        client_secret: 'super-secret',
      }),
    },
    response: {
      status: 400,
      data: {
        error: 'invalid_grant',
        error_description: 'Bad Request',
      },
    },
  });

  assert.deepEqual(summary, {
    code: 'ERR_BAD_REQUEST',
    message: 'Request failed with status code 400',
    status: 400,
    providerError: 'invalid_grant',
    providerDescription: 'Bad Request',
  });
  assert.equal(JSON.stringify(summary).includes('super-secret'), false);
  assert.equal(JSON.stringify(summary).includes('one-time-code'), false);
});
