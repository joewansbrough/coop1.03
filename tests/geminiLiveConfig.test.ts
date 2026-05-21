import assert from 'node:assert/strict';
import test from 'node:test';
import { getBrowserGeminiApiKey } from '../services/geminiService.ts';

test('browser Gemini key falls back to server-style env names used by Vite config', () => {
  const originalGeminiKey = process.env.GEMINI_API_KEY;
  const originalApiKey = process.env.API_KEY;

  try {
    delete process.env.GEMINI_API_KEY;
    process.env.API_KEY = 'api-key-fallback';
    assert.equal(getBrowserGeminiApiKey(), 'api-key-fallback');

    process.env.GEMINI_API_KEY = 'gemini-key';
    assert.equal(getBrowserGeminiApiKey(), 'gemini-key');
  } finally {
    if (originalGeminiKey === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = originalGeminiKey;
    }

    if (originalApiKey === undefined) {
      delete process.env.API_KEY;
    } else {
      process.env.API_KEY = originalApiKey;
    }
  }
});
