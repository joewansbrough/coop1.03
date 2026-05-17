import assert from 'node:assert/strict';
import {
  createPendingRagAskSession,
  createResolvedRagAskSession,
  parseRagAskSession,
} from '../utils/ragAskSession.ts';

const pending = createPendingRagAskSession('  What is our pet policy?  ');
assert.equal(pending.status, 'pending');
assert.equal(pending.question, 'What is our pet policy?');
assert.equal(pending.answer, '');
assert.equal(Array.isArray(pending.citations), true);

const resolved = createResolvedRagAskSession(pending, {
  answer: 'Pets are allowed with approval.',
  citations: [{ title: 'Pet Policy', text: 'Approval is required.' }],
  storeNames: ['stores/coop'],
});
assert.equal(resolved.status, 'answered');
assert.equal(resolved.question, 'What is our pet policy?');
assert.equal(resolved.answer, 'Pets are allowed with approval.');
assert.equal(resolved.citations.length, 1);
assert.deepEqual(resolved.storeNames, ['stores/coop']);

assert.deepEqual(parseRagAskSession(JSON.stringify(resolved)), resolved);
assert.equal(parseRagAskSession('not json'), null);
assert.equal(parseRagAskSession(JSON.stringify({ status: 'answered' })), null);

console.log('ragAskSession tests passed');
