import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AUDIO_PREFERENCE_KEY,
  AUDIO_PREFERENCE_STORAGE_KEY,
  AUDIO_VOICES,
  DEFAULT_AUDIO_VOICE,
  getAudioPreferenceFromStorage,
  getAudioVoiceLabel,
  normalizeAudioPreference,
  normalizeAudioVoiceName,
  saveAudioPreferenceToStorage,
} from '../utils/audioPreferences.ts';

test('audio voice list includes the documented Gemini voices', () => {
  assert.equal(AUDIO_VOICES.length, 30);
  assert.equal(DEFAULT_AUDIO_VOICE, 'Kore');
  assert.equal(getAudioVoiceLabel('Kore'), 'Kore - Firm');
  assert.equal(getAudioVoiceLabel('Sulafat'), 'Sulafat - Warm');
});

test('normalizes audio voice names to a supported default', () => {
  assert.equal(normalizeAudioVoiceName('Puck'), 'Puck');
  assert.equal(normalizeAudioVoiceName('  Sulafat  '), 'Sulafat');
  assert.equal(normalizeAudioVoiceName('NotARealVoice'), DEFAULT_AUDIO_VOICE);
  assert.equal(normalizeAudioVoiceName(null), DEFAULT_AUDIO_VOICE);
});

test('normalizes audio preference payloads', () => {
  assert.deepEqual(normalizeAudioPreference({ voiceName: 'Achird' }), { voiceName: 'Achird' });
  assert.deepEqual(normalizeAudioPreference({ voiceName: 'bad' }), { voiceName: DEFAULT_AUDIO_VOICE });
  assert.deepEqual(normalizeAudioPreference(null), { voiceName: DEFAULT_AUDIO_VOICE });
});

test('persists demo audio preference in localStorage', () => {
  const store = new Map<string, string>();
  const localStorageMock = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
  };

  (globalThis as any).localStorage = localStorageMock;

  saveAudioPreferenceToStorage({ voiceName: 'Vindemiatrix' });
  assert.deepEqual(getAudioPreferenceFromStorage(), { voiceName: 'Vindemiatrix' });
  assert.equal(AUDIO_PREFERENCE_KEY, 'audio');
  assert.equal(JSON.parse(store.get(AUDIO_PREFERENCE_STORAGE_KEY) || '{}').voiceName, 'Vindemiatrix');

  store.set(AUDIO_PREFERENCE_STORAGE_KEY, JSON.stringify({ voiceName: 'bad' }));
  assert.deepEqual(getAudioPreferenceFromStorage(), { voiceName: DEFAULT_AUDIO_VOICE });

  delete (globalThis as any).localStorage;
});
