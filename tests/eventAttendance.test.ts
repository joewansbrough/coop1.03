import assert from 'node:assert/strict';
import test from 'node:test';
import { addUserAttendance, createAttendanceRequestInit } from '../utils/eventAttendance.ts';

test('adds current user to event attendees once', () => {
  const event = { id: 'e5', attendees: [] };
  const user = { id: 'demo-user-id', tenantId: 't1', name: 'Margaret Chen', email: 'margaret.chen@email.com' };

  const updated = addUserAttendance(event, user);
  const updatedAgain = addUserAttendance(updated, user);

  assert.equal(updated.attendees.length, 1);
  assert.equal(updated.attendees[0].id, 't1');
  assert.equal(updated.attendees[0].firstName, 'Margaret');
  assert.equal(updated.attendees[0].lastName, 'Chen');
  assert.equal(updatedAgain.attendees.length, 1);
});

test('attendance request includes session credentials', () => {
  assert.deepEqual(createAttendanceRequestInit(), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });
});
