import assert from 'node:assert/strict';
import test from 'node:test';
import { syncCreatedEventToGoogleMeet } from '../utils/googleMeetEventCreate.ts';

type TestEvent = {
  id: string;
  title: string;
  googleMeetLink?: string;
  googleCalendarHtmlLink?: string;
};

test('returns the original event when Google Meet creation is not requested', async () => {
  let calls = 0;
  const event: TestEvent = { id: 'event-1', title: 'Board Meeting' };

  const result = await syncCreatedEventToGoogleMeet({
    event,
    shouldCreateMeet: false,
    syncEvent: async () => {
      calls += 1;
      return { event: { id: 'event-1', title: 'Board Meeting', googleMeetLink: 'https://meet.google.com/abc' } };
    },
  });

  assert.equal(calls, 0);
  assert.deepEqual(result, { event, synced: false });
});

test('returns synced event and links when Google Meet creation succeeds', async () => {
  const result = await syncCreatedEventToGoogleMeet({
    event: { id: 'event-1', title: 'Board Meeting' } as TestEvent,
    shouldCreateMeet: true,
    syncEvent: async (eventId) => {
      assert.equal(eventId, 'event-1');
      return {
        event: {
          id: 'event-1',
          title: 'Board Meeting',
          googleMeetLink: 'https://meet.google.com/abc-defg-hij',
          googleCalendarHtmlLink: 'https://calendar.google.com/event?eid=abc',
        },
        hangoutLink: 'https://meet.google.com/abc-defg-hij',
        htmlLink: 'https://calendar.google.com/event?eid=abc',
      };
    },
  });

  assert.equal(result.synced, true);
  assert.equal(result.meetLink, 'https://meet.google.com/abc-defg-hij');
  assert.equal(result.calendarLink, 'https://calendar.google.com/event?eid=abc');
  assert.equal(result.event.googleMeetLink, 'https://meet.google.com/abc-defg-hij');
});

test('keeps the created event and reports an error when Meet sync fails', async () => {
  const event: TestEvent = { id: 'event-1', title: 'Board Meeting' };
  const result = await syncCreatedEventToGoogleMeet({
    event,
    shouldCreateMeet: true,
    syncEvent: async () => {
      throw new Error('Calendar sync is not enabled');
    },
  });

  assert.equal(result.synced, false);
  assert.equal(result.error, 'Calendar sync is not enabled');
  assert.deepEqual(result.event, event);
});
