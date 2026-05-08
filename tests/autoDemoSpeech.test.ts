import assert from 'node:assert/strict';
import test from 'node:test';
import { AUTO_DEMO_STOPS } from '../utils/autoDemo.ts';
import { getAutoDemoSpeechText } from '../utils/autoDemoSpeech.ts';

test('tour narration combines body and capability without reading the label', () => {
  const stop = AUTO_DEMO_STOPS.find(item => item.id === 'mission-control');
  assert.ok(stop);

  const speechText = getAutoDemoSpeechText(stop);

  assert.match(speechText, new RegExp(stop.body.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(speechText, new RegExp(stop.keyCapability.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(speechText, /key capability/i);
});
