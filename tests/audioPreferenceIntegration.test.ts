import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('API exposes authenticated audio preference routes', () => {
  const source = fs.readFileSync('api/index.ts', 'utf8');

  assert.match(source, /app\.get\('\/api\/user\/preferences\/audio', requireAuth/);
  assert.match(source, /app\.put\('\/api\/user\/preferences\/audio', requireAuth/);
  assert.match(source, /normalizeAudioPreference/);
  assert.match(source, /ensureUserPreferenceSchema/);
});

test('TTS generation validates voice and keys cache by voice', () => {
  const source = fs.readFileSync('api/index.ts', 'utf8');

  assert.match(source, /normalizeAudioVoiceName\(req\.body\?\.voiceName\)/);
  assert.match(source, /update\(`\$\{style\}:\$\{voiceName\}:\$\{text\}`\)/);
  assert.match(source, /prebuiltVoiceConfig: \{ voiceName \}/);
});

test('Oracle passes the selected audio voice into Live mode', () => {
  const oracleSource = fs.readFileSync('components/OracleAssistant.tsx', 'utf8');
  const geminiSource = fs.readFileSync('services/geminiService.ts', 'utf8');

  assert.match(oracleSource, /useAudioPreferences/);
  assert.match(oracleSource, /Audio Voice/);
  assert.match(oracleSource, /connectLive\([\s\S]*audioPreference\.voiceName/);
  assert.match(geminiSource, /voiceName = DEFAULT_AUDIO_VOICE/);
  assert.match(geminiSource, /prebuiltVoiceConfig: \{ voiceName: normalizedVoiceName \}/);
});
