import assert from 'node:assert/strict';
import test from 'node:test';
import { parseGeminiJson } from '../utils/geminiJson.ts';

test('parses direct JSON responses', () => {
  assert.deepEqual(parseGeminiJson('{"summary":"ok","tags":["policy"]}', { summary: '', tags: [] }), {
    summary: 'ok',
    tags: ['policy'],
  });
});

test('parses JSON fenced in markdown', () => {
  const response = '```json\n{"summary":"ok","tags":["parking"]}\n```';
  assert.deepEqual(parseGeminiJson(response, { summary: '', tags: [] }), {
    summary: 'ok',
    tags: ['parking'],
  });
});

test('falls back when Gemini returns prose markdown instead of JSON', () => {
  const fallback = { summary: '', tags: [] };
  assert.deepEqual(parseGeminiJson('**Summary**\nThis is a policy document.', fallback), fallback);
});
