import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getAnnouncementPriorityAccentClass,
  getAnnouncementPriorityBadgeClass,
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

test('urgent announcements share the high-priority color treatment', () => {
  assert.equal(getAnnouncementPriorityBadgeClass('Urgent'), getAnnouncementPriorityBadgeClass('High'));
  assert.equal(getAnnouncementPriorityAccentClass('Urgent'), getAnnouncementPriorityAccentClass('High'));
});
