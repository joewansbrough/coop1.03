import assert from 'node:assert/strict';
import { buildRagGenerateContentConfig, cleanRagAnswer, validateRagQuestion } from '../services/ragAsk.js';

assert.equal(validateRagQuestion('What does the pet policy say?'), 'What does the pet policy say?');
assert.throws(() => validateRagQuestion(''), /Question is required/);
assert.throws(() => validateRagQuestion('a'), /at least 2 characters/);

const controller = new AbortController();
const config = buildRagGenerateContentConfig(['stores/coop', 'stores/shared'], controller.signal);
assert.equal(config.abortSignal, controller.signal);
assert.equal(config.httpOptions?.timeout, 45000);
assert.deepEqual((config.tools?.[0] as any).fileSearch.fileSearchStoreNames, ['stores/coop', 'stores/shared']);
assert.match(String(config.systemInstruction), /Do not use Markdown/);
assert.match(String(config.systemInstruction), /2-4 short sentences/);

assert.equal(
  cleanRagAnswer('**Summary**\n\n- **Pets** require approval.'),
  'Summary\nPets require approval.',
);

console.log('ragRequestValidation tests passed');
