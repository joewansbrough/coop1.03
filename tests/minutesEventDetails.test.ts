import assert from 'node:assert/strict';
import test from 'node:test';
import { getMinutesEventDetails, applyMinutesEventDetails } from '../utils/minutesEventDetails.ts';

const boardMeeting = {
  id: 'event-1',
  title: 'Board Meeting',
  date: '2026-05-06T00:00:00.000Z',
  time: '19:30',
  location: 'Common Room',
  category: 'Board',
  description: 'Monthly board meeting',
};

test('derives minutes date, start time, and location from the event', () => {
  assert.deepEqual(getMinutesEventDetails(boardMeeting), {
    meetingDate: '2026-05-06',
    startTime: '19:30',
    location: 'Common Room',
  });
});

test('event details override stale or blank minutes form values', () => {
  assert.deepEqual(
    applyMinutesEventDetails({
      meetingDate: '',
      startTime: '18:00',
      location: 'Old office',
      chair: 'Priya Sharma',
    }, boardMeeting),
    {
      meetingDate: '2026-05-06',
      startTime: '19:30',
      location: 'Common Room',
      chair: 'Priya Sharma',
    },
  );
});
