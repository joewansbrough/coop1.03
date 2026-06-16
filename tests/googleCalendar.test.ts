import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildGoogleCalendarEventPayload,
  getGoogleCalendarSyncKey,
} from '../utils/googleCalendar.ts';

test('builds a Google Calendar event payload from a coopHUB event', () => {
  const payload = buildGoogleCalendarEventPayload({
    event: {
      id: 'event-123',
      title: 'Board Meeting',
      description: 'Review budget and maintenance priorities.',
      date: new Date('2026-06-20T00:00:00.000Z'),
      time: '19:30',
      location: 'Common Room',
      category: 'Board',
    },
    cooperative: {
      name: 'Oak Bay Housing Co-op',
      slug: 'oak-bay',
    },
    appBaseUrl: 'https://demo.coophub.ca',
    timeZone: 'America/Vancouver',
  });

  assert.equal(payload.summary, 'Board Meeting');
  assert.equal(payload.location, 'Common Room');
  assert.equal(payload.start?.dateTime, '2026-06-20T19:30:00');
  assert.equal(payload.start?.timeZone, 'America/Vancouver');
  assert.equal(payload.end?.dateTime, '2026-06-20T20:30:00');
  assert.match(String(payload.description), /Review budget/);
  assert.match(String(payload.description), /https:\/\/demo\.coophub\.ca\/#\/calendar\/event-123/);
  assert.equal(payload.extendedProperties?.private?.coopHubEventId, 'event-123');
  assert.equal(payload.extendedProperties?.private?.coopHubCooperativeSlug, 'oak-bay');
  assert.equal(payload.conferenceData?.createRequest?.requestId, 'coophub-event-123-meet');
});

test('creates a stable sync key for Calendar private extended properties', () => {
  assert.equal(getGoogleCalendarSyncKey('event-123'), 'coopHubEventId=event-123');
});
