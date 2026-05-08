import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MOCK_DOCUMENTS,
  MOCK_EVENTS,
  MOCK_MAINTENANCE,
  MOCK_MINUTES,
  MOCK_TENANTS,
  MOCK_UNITS,
} from '../utils/demoData.ts';
import { DEMO_DATA_SEED_VERSION, demoStorage, initializeDemoStorage } from '../utils/demoStorage.ts';

test('demo mode uses a full-size seed dataset instead of the compact legacy sample', () => {
  assert.ok(MOCK_UNITS.length >= 30);
  assert.ok(MOCK_TENANTS.length >= 45);
  assert.ok(MOCK_MAINTENANCE.length >= 10);
  assert.ok(MOCK_EVENTS.length >= 7);
  assert.ok(MOCK_DOCUMENTS.length >= 10);
});

test('demo seed includes resident-visible minutes for existing calendar events', () => {
  assert.ok(MOCK_MINUTES.length >= 2);

  const eventIds = new Set(MOCK_EVENTS.map(event => event.id));
  for (const minutes of MOCK_MINUTES) {
    assert.ok(eventIds.has(minutes.meetingId), `${minutes.id} should point to a seeded event`);
    assert.ok(minutes.formData.chair);
    assert.ok(minutes.formData.minuteTaker);
    assert.equal(minutes.status, 'Finalized');
  }
});

test('demo seed fleshes out the board committee detail page', () => {
  const boardMeetings = MOCK_EVENTS.filter(event => event.committeeId === 'c1');
  const boardDocuments = MOCK_DOCUMENTS.filter(document => document.committee === 'Board of Directors');

  assert.ok(boardMeetings.length >= 2);
  assert.ok(boardMeetings.some(event => event.date >= '2026-05-08'));
  assert.ok(boardDocuments.length >= 2);
});

test('demo storage initializer refreshes older local demo snapshots to the current seed', () => {
  const store = new Map<string, string>([
    ['demo_v1_seed_version', 'legacy'],
    ['demo_v1_units', JSON.stringify([{ id: 'old-unit' }])],
    ['demo_v1_minutes', JSON.stringify([])],
  ]);
  const localStorageMock = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() { return store.size; },
  };

  (globalThis as any).window = { localStorage: localStorageMock };
  (globalThis as any).localStorage = localStorageMock;

  initializeDemoStorage();

  assert.equal(store.get('demo_v1_seed_version'), DEMO_DATA_SEED_VERSION);
  assert.notEqual(demoStorage.getUnits()[0].id, 'old-unit');
  assert.ok(demoStorage.getMinutes().length >= 2);

  delete (globalThis as any).window;
  delete (globalThis as any).localStorage;
});

test('demo storage persists document committee updates', () => {
  const store = new Map<string, string>();
  const localStorageMock = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() { return store.size; },
  };

  (globalThis as any).window = { localStorage: localStorageMock };
  (globalThis as any).localStorage = localStorageMock;

  const document = demoStorage.getAll('documents', MOCK_DOCUMENTS)[0];
  demoStorage.updateDocument({ ...document, committee: 'Finance Committee' });

  const updated = demoStorage.getAll('documents', MOCK_DOCUMENTS).find(doc => doc.id === document.id);
  assert.equal(updated?.committee, 'Finance Committee');

  delete (globalThis as any).window;
  delete (globalThis as any).localStorage;
});
