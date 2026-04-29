import assert from 'node:assert/strict';
import test from 'node:test';
import { getMinutesPanelMode } from '../utils/minutesPanelState.ts';

test('shows admins the locked community record after minutes are saved', () => {
  assert.equal(
    getMinutesPanelMode({ isAdmin: true, hasMinutes: true, isEditingMinutes: false }),
    'record',
  );
});

test('lets admins reopen saved minutes for editing', () => {
  assert.equal(
    getMinutesPanelMode({ isAdmin: true, hasMinutes: true, isEditingMinutes: true }),
    'form',
  );
});

test('keeps the minutes form available to admins before minutes are saved', () => {
  assert.equal(
    getMinutesPanelMode({ isAdmin: true, hasMinutes: false, isEditingMinutes: false }),
    'form',
  );
});

test('shows residents saved records or pending state', () => {
  assert.equal(
    getMinutesPanelMode({ isAdmin: false, hasMinutes: true, isEditingMinutes: false }),
    'record',
  );
  assert.equal(
    getMinutesPanelMode({ isAdmin: false, hasMinutes: false, isEditingMinutes: false }),
    'pending',
  );
});
