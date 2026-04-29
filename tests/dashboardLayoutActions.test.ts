import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addDashboardTile,
  hideDashboardTile,
  moveDashboardTile,
  resizeDashboardTile,
} from '../utils/dashboardPreferences.ts';

test('moves dashboard tiles by id', () => {
  const next = moveDashboardTile({
    version: 1,
    tiles: [
      { id: 'my-home', size: 'wide', hidden: false },
      { id: 'my-requests', size: 'wide', hidden: false },
      { id: 'community-updates', size: 'large', hidden: false },
    ],
  }, 'community-updates', 'my-home');

  assert.deepEqual(next.tiles.map(tile => tile.id), ['community-updates', 'my-home', 'my-requests']);
});

test('resizes, hides, and re-adds dashboard tiles within role rules', () => {
  const base = {
    version: 1,
    tiles: [
      { id: 'my-home' as const, size: 'wide' as const, hidden: false },
      { id: 'my-requests' as const, size: 'wide' as const, hidden: false },
    ],
  };

  const resized = resizeDashboardTile(base, 'resident', 'my-home', 'large');
  const hidden = hideDashboardTile(resized, 'resident', 'my-requests');
  const readded = addDashboardTile(hidden, 'resident', 'my-requests');
  const denied = addDashboardTile(readded, 'resident', 'waitlist-snapshot');

  assert.equal(resized.tiles[0].size, 'large');
  assert.equal(hidden.tiles.find(tile => tile.id === 'my-requests')?.hidden, true);
  assert.equal(readded.tiles.find(tile => tile.id === 'my-requests')?.hidden, false);
  assert.ok(!denied.tiles.some(tile => tile.id === 'waitlist-snapshot'));
});
