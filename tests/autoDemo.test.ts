import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AUTO_DEMO_STOPS,
  AUTO_DEMO_TIMING,
  getAutoDemoStop,
  getNextAutoDemoIndex,
  getPreviousAutoDemoIndex,
  isAutoDemoStopIndex,
} from '../utils/autoDemo.ts';

test('defines a guided sales story in the expected order', () => {
  assert.deepEqual(
    AUTO_DEMO_STOPS.map(stop => stop.id),
    [
      'mission-control',
      'maintenance-ai',
      'unit-intelligence',
      'governance-archive',
      'meeting-records',
      'policy-assistant',
      'resident-view',
    ],
  );
});

test('every stop has route target and customer-facing copy', () => {
  for (const stop of AUTO_DEMO_STOPS) {
    assert.match(stop.route, /^\//);
    assert.match(stop.target, /^[a-z0-9-]+$/);
    assert.ok(stop.title.length >= 8);
    assert.ok(stop.body.length >= 80);
    assert.ok(stop.sellingPoint.length >= 20);
  }
});

test('looks up stops only for valid indices', () => {
  assert.equal(isAutoDemoStopIndex(0), true);
  assert.equal(isAutoDemoStopIndex(AUTO_DEMO_STOPS.length - 1), true);
  assert.equal(isAutoDemoStopIndex(-1), false);
  assert.equal(isAutoDemoStopIndex(AUTO_DEMO_STOPS.length), false);
  assert.equal(getAutoDemoStop(0)?.id, 'mission-control');
  assert.equal(getAutoDemoStop(AUTO_DEMO_STOPS.length), null);
});

test('progress helpers clamp at tour boundaries', () => {
  assert.equal(getNextAutoDemoIndex(0), 1);
  assert.equal(getNextAutoDemoIndex(AUTO_DEMO_STOPS.length - 1), AUTO_DEMO_STOPS.length - 1);
  assert.equal(getPreviousAutoDemoIndex(1), 0);
  assert.equal(getPreviousAutoDemoIndex(0), 0);
});

test('uses a staged cursor reveal before opening the narration panel', () => {
  assert.ok(AUTO_DEMO_TIMING.cursorTravelMs >= 1000);
  assert.ok(AUTO_DEMO_TIMING.arrivalHoldMs >= 500);
  assert.ok(AUTO_DEMO_TIMING.panelDelayMs >= AUTO_DEMO_TIMING.cursorTravelMs + AUTO_DEMO_TIMING.arrivalHoldMs);
});
