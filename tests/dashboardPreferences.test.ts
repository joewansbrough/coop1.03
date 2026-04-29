import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DASHBOARD_PREFERENCE_VERSION,
  DASHBOARD_TILE_REGISTRY,
  createDefaultDashboardLayout,
  getAvailableDashboardTiles,
  loadDemoDashboardPreference,
  normalizeDashboardPreference,
  saveDemoDashboardPreference,
} from '../utils/dashboardPreferences.ts';

test('filters the dashboard tile registry by role', () => {
  const adminTiles = getAvailableDashboardTiles('admin').map(tile => tile.id);
  const residentTiles = getAvailableDashboardTiles('resident').map(tile => tile.id);

  assert.ok(adminTiles.includes('maintenance-pulse'));
  assert.ok(adminTiles.includes('waitlist-snapshot'));
  assert.ok(!residentTiles.includes('waitlist-snapshot'));
  assert.ok(residentTiles.includes('my-requests'));
  assert.ok(residentTiles.includes('community-updates'));
});

test('creates role-aware default dashboard layouts', () => {
  const adminLayout = createDefaultDashboardLayout('admin');
  const residentLayout = createDefaultDashboardLayout('resident');

  assert.equal(adminLayout.version, DASHBOARD_PREFERENCE_VERSION);
  assert.deepEqual(
    adminLayout.tiles.map(tile => [tile.id, tile.size]),
    [
      ['maintenance-pulse', 'large'],
      ['quick-actions', 'wide'],
      ['scheduled-maintenance', 'wide'],
      ['next-meeting', 'wide'],
      ['document-watch', 'wide'],
      ['announcement-digest', 'large'],
      ['building-map', 'wide'],
      ['waitlist-snapshot', 'wide'],
    ],
  );
  assert.deepEqual(
    residentLayout.tiles.map(tile => [tile.id, tile.size]),
    [
      ['my-home', 'small'],
      ['next-meeting', 'small'],
      ['my-requests', 'large'],
      ['community-updates', 'large'],
      ['useful-documents', 'large'],
    ],
  );
  assert.ok(residentLayout.tiles.every(tile => DASHBOARD_TILE_REGISTRY[tile.id].roles.includes('resident')));
});

test('normalizes dashboard layouts by removing invalid and unauthorized tiles', () => {
  const normalized = normalizeDashboardPreference(
    {
      version: 99,
      tiles: [
        { id: 'my-requests', size: 'large', hidden: false },
        { id: 'not-real', size: 'wide', hidden: false },
        { id: 'waitlist-snapshot', size: 'wide', hidden: false },
        { id: 'my-requests', size: 'tiny' as any, hidden: true },
      ],
    },
    'resident',
  );

  assert.equal(normalized.version, DASHBOARD_PREFERENCE_VERSION);
  assert.equal(normalized.tiles.filter(tile => tile.id === 'my-requests').length, 1);
  assert.ok(!(normalized.tiles.map(tile => tile.id) as string[]).includes('not-real'));
  assert.ok(!normalized.tiles.some(tile => tile.id === 'waitlist-snapshot'));
  assert.equal(normalized.tiles.find(tile => tile.id === 'my-requests')?.size, 'large');
});

test('normalizes legacy resident calendar tiles to the shared next meeting tile', () => {
  const normalized = normalizeDashboardPreference({
    version: DASHBOARD_PREFERENCE_VERSION,
    tiles: [
      { id: 'next-community-event', size: 'wide', hidden: false },
      { id: 'next-meeting', size: 'small', hidden: true },
    ],
  }, 'resident');

  assert.equal(normalized.tiles.filter(tile => tile.id === 'next-meeting').length, 1);
  assert.equal(normalized.tiles[0].id, 'next-meeting');
  assert.equal(normalized.tiles[0].size, 'wide');
  assert.equal(normalized.tiles[0].hidden, false);
  assert.ok(!(normalized.tiles.map(tile => tile.id) as string[]).includes('next-community-event'));
});

test('persists demo dashboard preferences in localStorage', () => {
  const store = new Map<string, string>();
  const localStorageMock = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
  };

  (globalThis as any).localStorage = localStorageMock;

  const preference = normalizeDashboardPreference({
    version: DASHBOARD_PREFERENCE_VERSION,
    tiles: [
      { id: 'my-home', size: 'wide', hidden: false },
      { id: 'community-updates', size: 'large', hidden: true },
    ],
  }, 'resident');

  saveDemoDashboardPreference('resident', preference);

  assert.deepEqual(loadDemoDashboardPreference('resident'), preference);

  delete (globalThis as any).localStorage;
});
