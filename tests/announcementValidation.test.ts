import test from 'node:test';
import assert from 'node:assert/strict';
import { announcementSchema } from '../api/validation.ts';

const baseAnnouncement = {
  title: 'Notice',
  content: 'A useful building notice.',
  type: 'General',
  author: 'board@example.com',
  date: '2026-05-12',
};

test('announcement validation accepts only high medium and low priorities', () => {
  for (const priority of ['High', 'Medium', 'Low']) {
    assert.equal(announcementSchema.safeParse({ ...baseAnnouncement, priority }).success, true);
  }

  for (const priority of ['Urgent', 'Normal']) {
    assert.equal(announcementSchema.safeParse({ ...baseAnnouncement, priority }).success, false);
  }
});

test('announcement validation does not expose urgent as an announcement type', () => {
  assert.equal(announcementSchema.safeParse({ ...baseAnnouncement, type: 'Urgent', priority: 'High' }).success, false);
});
