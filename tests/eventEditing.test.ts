import assert from 'node:assert/strict';
import test from 'node:test';
import { applyEventEdit, createEventUpdateRequestInit } from '../utils/eventEditing.ts';

const payload = {
  title: 'Community Garden Kickoff',
  category: 'Social',
  date: '2026-05-02',
  time: '10:00',
  location: 'Back Courtyard',
  description: 'First planting session of the year.',
  committeeId: 'c6',
};

test('applies committee edits to a local event without losing its id', () => {
  const event = {
    id: 'e3',
    title: 'Community Garden Kickoff',
    category: 'Social',
    date: '2026-05-02T10:00:00Z',
    time: '10:00',
    location: 'Back Courtyard',
    description: 'First planting session of the year.',
  };

  const updated = applyEventEdit(event, payload);

  assert.equal(updated.id, 'e3');
  assert.equal(updated.committeeId, 'c6');
});

test('event update request includes session credentials', () => {
  const request = createEventUpdateRequestInit(payload);

  assert.equal(request.method, 'PUT');
  assert.equal(request.credentials, 'include');
  assert.deepEqual(request.headers, { 'Content-Type': 'application/json' });
  assert.equal(request.body, JSON.stringify(payload));
});
