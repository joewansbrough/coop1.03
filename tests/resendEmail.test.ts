import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildMagicLinkEmail,
  getAccessRequestRecipient,
  sendResendEmail,
} from '../services/resendEmail.ts';

test('builds magic link email with the sign-in URL', () => {
  const email = buildMagicLinkEmail({
    loginUrl: 'https://demo.coophub.ca/auth/magic/verify?token=abc',
    recipientEmail: 'member@example.com',
  });

  assert.equal(email.subject, 'Your coopHUB secure sign-in link');
  assert.match(email.text, /https:\/\/demo\.coophub\.ca\/auth\/magic\/verify\?token=abc/);
  assert.match(email.html, /member@example\.com/);
});

test('sends email through Resend REST API', async () => {
  const calls: any[] = [];
  const fetchImpl = async (url: string, init: any) => {
    calls.push({ url, init });
    return {
      ok: true,
      json: async () => ({ id: 'email-1' }),
    } as any;
  };

  const result = await sendResendEmail({
    to: 'member@example.com',
    subject: 'Subject',
    text: 'Text',
    html: '<p>Text</p>',
  }, {
    env: { RESEND_API_KEY: 'test-key', RESEND_FROM_EMAIL: 'coopHUB BC <hello@example.com>' } as any,
    fetchImpl: fetchImpl as any,
  });

  assert.deepEqual(result, { id: 'email-1' });
  assert.equal(calls[0].url, 'https://api.resend.com/emails');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer test-key');
  assert.deepEqual(JSON.parse(calls[0].init.body).to, ['member@example.com']);
});

test('access requests default to hello@coophub.ca', () => {
  assert.equal(getAccessRequestRecipient({} as any), 'hello@coophub.ca');
  assert.equal(getAccessRequestRecipient({ ACCESS_REQUEST_EMAIL: 'access@example.com' } as any), 'access@example.com');
});
