import assert from 'node:assert/strict';
import {
  getCalendarEmptyState,
  getCommitteeOnboardingState,
  getMaintenanceEmptyState,
} from '../utils/pageEmptyStates.ts';

const maintenanceNoContext = getMaintenanceEmptyState({
  requestCount: 0,
  unitCount: 0,
  currentMemberCount: 0,
  isAdmin: true,
});

assert.equal(maintenanceNoContext.isEmpty, true);
assert.equal(maintenanceNoContext.title, 'Start the maintenance log');
assert.equal(maintenanceNoContext.primaryActionLabel, 'Create first request');
assert.ok(maintenanceNoContext.description.includes('unit and member context'));

const maintenanceWithContext = getMaintenanceEmptyState({
  requestCount: 0,
  unitCount: 12,
  currentMemberCount: 9,
  isAdmin: false,
});

assert.equal(maintenanceWithContext.isEmpty, true);
assert.equal(maintenanceWithContext.title, 'No service requests yet');
assert.equal(maintenanceWithContext.description.includes('ready to capture'), true);

const calendarEmpty = getCalendarEmptyState({ eventCount: 0, isAdmin: true });
assert.equal(calendarEmpty.isEmpty, true);
assert.equal(calendarEmpty.title, 'Schedule the first co-op meeting');
assert.equal(calendarEmpty.primaryActionLabel, 'Create first meeting');

const committeeNoMembers = getCommitteeOnboardingState({
  committeeCount: 0,
  currentMemberCount: 0,
});

assert.equal(committeeNoMembers.isEmpty, true);
assert.equal(committeeNoMembers.title, 'Create committee spaces');
assert.equal(committeeNoMembers.primaryActionLabel, 'Add committee');
assert.equal(committeeNoMembers.presetNames.length, 5);
assert.ok(committeeNoMembers.description.includes('Import members first'));

const committeeWithMembers = getCommitteeOnboardingState({
  committeeCount: 0,
  currentMemberCount: 4,
});

assert.equal(committeeWithMembers.isEmpty, true);
assert.ok(committeeWithMembers.description.includes('assign imported members'));

const committeeReady = getCommitteeOnboardingState({
  committeeCount: 2,
  currentMemberCount: 4,
});

assert.equal(committeeReady.isEmpty, false);
assert.equal(committeeReady.title, 'Committees are ready for assignments');

console.log('pageEmptyStates tests passed');
