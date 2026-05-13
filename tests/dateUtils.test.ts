import assert from 'node:assert/strict';
import test from 'node:test';
import { formatCalendarDateLabel, getLocalDateInputValue } from '../utils/dateUtils.ts';

test('gets date input value from the local calendar day instead of UTC', () => {
  const vancouverEvening = new Date(2026, 4, 12, 21, 0, 0);

  assert.equal(getLocalDateInputValue(vancouverEvening), '2026-05-12');
});

test('formats date-only values without UTC day shifting', () => {
  assert.equal(formatCalendarDateLabel('2026-05-12'), 'May 12');
  assert.equal(formatCalendarDateLabel('2026-05-12T19:00:00Z'), 'May 12');
});
