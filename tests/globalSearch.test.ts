import assert from 'node:assert/strict';
import test from 'node:test';
import { buildGlobalSearchResults } from '../utils/globalSearch.ts';
import { MaintenancePriority, RequestStatus, type Announcement, type CoopEvent, type Document, type MaintenanceRequest } from '../types.ts';

const minutesDocument: Document = {
  id: 'doc-minutes',
  title: 'Board Meeting Minutes - April 2026',
  category: 'Minutes',
  url: 'https://example.com/minutes.pdf',
  fileType: 'pdf',
  author: 'Secretary',
  date: '2026-04-28',
  tags: ['minutes', 'minutes-meeting:e5'],
};

const agmEvent: CoopEvent = {
  id: 'event-agm',
  title: 'Annual General Meeting',
  date: '2026-05-07',
  time: '6:00 PM',
  location: 'Community Room',
  category: 'Meeting',
  description: 'AGM package review and votes.',
};

const agmAnnouncement: Announcement = {
  id: 'ann-agm',
  title: 'AGM Package Posted',
  content: 'Members can review the annual general meeting package.',
  type: 'Governance',
  priority: 'High',
  author: 'Board',
  date: '2026-05-01',
};

const leakRequest: MaintenanceRequest = {
  id: 'req-leak',
  title: 'Kitchen Sink Leak',
  description: 'Water under the cabinet after using the sink.',
  status: RequestStatus.PENDING,
  priority: MaintenancePriority.HIGH,
  category: ['Plumbing'],
  unitId: 'unit-101',
};

test('global search returns documents with their existing minutes deeplink destination', () => {
  const results = buildGlobalSearchResults('minutes', {
    documents: [minutesDocument],
    events: [],
    announcements: [],
    maintenance: [],
  });

  assert.equal(results[0]?.title, 'Board Meeting Minutes - April 2026');
  assert.equal(results[0]?.href, '/calendar/e5?tab=minutes');
});

test('global search finds events announcements and maintenance records', () => {
  const results = buildGlobalSearchResults('agm', {
    documents: [],
    events: [agmEvent],
    announcements: [agmAnnouncement],
    maintenance: [leakRequest],
  });

  assert.ok(results.some(result => result.title === 'Annual General Meeting' && result.href === '/calendar/event-agm'));
  assert.ok(results.some(result => result.title === 'AGM Package Posted' && result.href === '/announcements/ann-agm'));

  const maintenanceResults = buildGlobalSearchResults('leak', {
    documents: [],
    events: [agmEvent],
    announcements: [agmAnnouncement],
    maintenance: [leakRequest],
  });

  assert.ok(maintenanceResults.some(result => result.title === 'Kitchen Sink Leak' && result.href === '/maintenance/req-leak'));
});

test('global search ignores blank and very short queries', () => {
  assert.deepEqual(buildGlobalSearchResults(' ', {
    documents: [minutesDocument],
    events: [agmEvent],
    announcements: [agmAnnouncement],
    maintenance: [leakRequest],
  }), []);

  assert.deepEqual(buildGlobalSearchResults('a', {
    documents: [minutesDocument],
    events: [agmEvent],
    announcements: [agmAnnouncement],
    maintenance: [leakRequest],
  }), []);
});
