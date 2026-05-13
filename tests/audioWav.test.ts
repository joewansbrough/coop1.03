import assert from 'node:assert/strict';
import test from 'node:test';
import { pcm16ToWavBuffer } from '../utils/audioWav.ts';

test('wraps 16-bit pcm audio in a playable wav header', () => {
  const pcm = Buffer.from([0, 0, 255, 127, 0, 128, 0, 0]);
  const wav = pcm16ToWavBuffer(pcm, 24000, 1);

  assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
  assert.equal(wav.toString('ascii', 8, 12), 'WAVE');
  assert.equal(wav.toString('ascii', 12, 16), 'fmt ');
  assert.equal(wav.readUInt16LE(20), 1);
  assert.equal(wav.readUInt16LE(22), 1);
  assert.equal(wav.readUInt32LE(24), 24000);
  assert.equal(wav.readUInt16LE(34), 16);
  assert.equal(wav.toString('ascii', 36, 40), 'data');
  assert.equal(wav.readUInt32LE(40), pcm.length);
  assert.deepEqual(wav.subarray(44), pcm);
});
