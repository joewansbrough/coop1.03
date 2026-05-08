import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AUTO_DEMO_STOPS,
  AUTO_DEMO_TIMING,
  getAutoDemoPanelPlacement,
  getAutoDemoStop,
  getNextAutoDemoIndex,
  getPreviousAutoDemoIndex,
  isAutoDemoStopIndex,
} from '../utils/autoDemo.ts';

test('defines a guided sales story in the expected order', () => {
  assert.deepEqual(
    AUTO_DEMO_STOPS.map(stop => stop.id),
    [
      'welcome',
      'mission-control',
      'open-calendar',
      'calendar-space',
      'open-calendar-event',
      'open-meeting-minutes',
      'meeting-record-actions',
      'open-linked-documents',
      'governance-archive',
      'open-committees',
      'committee-space',
      'open-communications',
      'communications-space',
      'open-maintenance',
      'maintenance-queue',
      'open-maintenance-detail',
      'maintenance-detail',
      'maintenance-status',
      'maintenance-update-log',
      'maintenance-categories',
      'maintenance-export',
      'open-unit-from-maintenance',
      'unit-intelligence',
      'unit-maintenance-tab',
      'unit-schedule-tab',
      'unit-members-tab',
      'unit-history-tab',
      'unit-documents-tab',
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
    assert.ok(stop.customerValue.length >= 40);
    assert.doesNotMatch(`${stop.title} ${stop.body} ${stop.customerValue}`, /selling point|investor/i);
  }
});

test('defines explicit click-through navigation steps for maintenance and meeting minutes', () => {
  const byId = new Map(AUTO_DEMO_STOPS.map(stop => [stop.id, stop]));

  assert.equal(byId.get('open-maintenance')?.route, '/');
  assert.equal(byId.get('open-maintenance')?.target, 'nav-maintenance');
  assert.equal(byId.get('open-maintenance')?.routeAfterClick, '/maintenance');
  assert.equal(byId.get('open-maintenance-detail')?.routeAfterClick, '/admin/maintenance/m1');
  assert.equal(byId.get('open-unit-from-maintenance')?.target, 'maintenance-unit-link');
  assert.equal(byId.get('open-unit-from-maintenance')?.routeAfterClick, '/admin/units/u1');

  assert.equal(byId.get('open-calendar')?.target, 'nav-calendar');
  assert.equal(byId.get('open-calendar')?.routeAfterClick, '/calendar');
  assert.equal(byId.get('open-calendar-event')?.target, 'calendar-demo-event');
  assert.equal(byId.get('open-calendar-event')?.routeAfterClick, '/calendar/e1');
  assert.equal(byId.get('open-meeting-minutes')?.target, 'meeting-minutes-tab');
  assert.equal(byId.get('open-meeting-minutes')?.routeAfterClick, '/calendar/e1?tab=minutes');
  assert.equal(byId.get('meeting-record-actions')?.target, 'meeting-record-actions');
  assert.equal(byId.get('open-linked-documents')?.target, 'meeting-documents-link');
  assert.equal(byId.get('open-linked-documents')?.routeAfterClick, '/documents');

  assert.equal(byId.get('open-committees')?.target, 'nav-committees');
  assert.equal(byId.get('open-committees')?.routeAfterClick, '/committees');
  assert.equal(byId.get('open-communications')?.target, 'nav-communications');
  assert.equal(byId.get('open-communications')?.routeAfterClick, '/communications');

  assert.equal(byId.get('unit-maintenance-tab')?.routeAfterClick, '/admin/units/u1?tab=maintenance');
  assert.equal(byId.get('unit-schedule-tab')?.routeAfterClick, '/admin/units/u1?tab=schedule');
  assert.equal(byId.get('unit-members-tab')?.routeAfterClick, '/admin/units/u1?tab=occupancy');
  assert.equal(byId.get('unit-history-tab')?.routeAfterClick, '/admin/units/u1?tab=history');
  assert.equal(byId.get('unit-documents-tab')?.routeAfterClick, '/admin/units/u1?tab=documents');
});

test('looks up stops only for valid indices', () => {
  assert.equal(isAutoDemoStopIndex(0), true);
  assert.equal(isAutoDemoStopIndex(AUTO_DEMO_STOPS.length - 1), true);
  assert.equal(isAutoDemoStopIndex(-1), false);
  assert.equal(isAutoDemoStopIndex(AUTO_DEMO_STOPS.length), false);
  assert.equal(getAutoDemoStop(0)?.id, 'welcome');
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
  assert.ok(AUTO_DEMO_TIMING.clickPulseMs >= 500);
});

test('keeps the narration panel inside small viewport bounds', () => {
  const placement = getAutoDemoPanelPlacement({
    rect: { top: 620, left: 930, width: 180, height: 90 },
    viewportWidth: 1024,
    viewportHeight: 700,
  });

  assert.ok(placement.left >= 16);
  assert.ok(placement.top >= 16);
  assert.ok(placement.left + placement.width <= 1024 - 16);
  assert.ok(placement.top + placement.maxHeight <= 700 || placement.maxHeight <= 700 - 32);
});
