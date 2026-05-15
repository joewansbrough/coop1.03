import assert from 'node:assert/strict';
import { validateRagQuestion } from '../services/ragAsk.js';

assert.equal(validateRagQuestion('What does the pet policy say?'), 'What does the pet policy say?');
assert.throws(() => validateRagQuestion(''), /Question is required/);
assert.throws(() => validateRagQuestion('a'), /at least 2 characters/);

console.log('ragRequestValidation tests passed');
