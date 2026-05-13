import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getAnnouncementPriorityAccentClass,
  getAnnouncementPriorityBadgeClass,
  getAnnouncementPriorityFilterOptions,
  getAnnouncementPriorityFormOptions,
} from '../utils/announcementPriorityStyles.ts';

test('announcement priority badges use distinct high medium and low colors', () => {
  const high = getAnnouncementPriorityBadgeClass('High');
  const medium = getAnnouncementPriorityBadgeClass('Medium');
  const low = getAnnouncementPriorityBadgeClass('Low');

  assert.notEqual(high, medium);
  assert.notEqual(high, low);
  assert.notEqual(medium, low);
  assert.match(high, /rose/);
  assert.match(medium, /amber/);
  assert.match(low, /emerald/);
});

test('announcement priority options only expose high medium and low', () => {
  assert.deepEqual(getAnnouncementPriorityFormOptions(), ['High', 'Medium', 'Low']);
  assert.deepEqual(getAnnouncementPriorityFilterOptions(), ['All', 'High', 'Medium', 'Low']);
});

test('legacy urgent and normal values are not treated as supported priorities', () => {
  assert.equal(getAnnouncementPriorityBadgeClass('Urgent'), getAnnouncementPriorityBadgeClass());
  assert.equal(getAnnouncementPriorityAccentClass('Normal'), getAnnouncementPriorityAccentClass());
});
