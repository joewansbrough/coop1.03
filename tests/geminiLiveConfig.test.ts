import assert from 'node:assert/strict';
import fs from 'node:fs';
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

test('Oracle Live mode uses the current Gemini Live model name', () => {
  const source = fs.readFileSync('services/geminiService.ts', 'utf8');

  assert.match(source, /ORACLE_LIVE_MODEL\s*=\s*['"]gemini-2\.5-flash-native-audio-preview-12-2025['"]/);
  assert.doesNotMatch(source, /gemini-live-2\.5-flash-preview/);
  assert.doesNotMatch(source, /gemini-3\.1-flash-live-preview/);
});

test('Oracle Live startup prompt is sent as client content text', () => {
  const source = fs.readFileSync('components/OracleAssistant.tsx', 'utf8');

  assert.match(source, /sendClientContent\(\{\s*turns:\s*[^,]+,\s*turnComplete:\s*true\s*\}\)/);
  assert.doesNotMatch(source, /sendRealtimeInput\(\{\s*text:/);
});

test('Oracle microphone worklet is connected so audio frames are pulled', () => {
  const source = fs.readFileSync('components/OracleAssistant.tsx', 'utf8');

  assert.match(source, /source\.connect\(workletNode\);[\s\S]*workletNode\.connect\(ctx\.destination\);/);
});

test('Oracle does not stream microphone chunks into a closed Live socket', () => {
  const source = fs.readFileSync('components/OracleAssistant.tsx', 'utf8');

  assert.match(source, /connection\.readyState !== WebSocket\.OPEN/);
});
