import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getStoredDashboardPreference,
  saveStoredDashboardPreference,
} from '../services/dashboardPreferenceStore.ts';

const createPreferenceClient = () => {
  const records = new Map<string, any>();
  return {
    records,
    dashboardPreference: {
      findUnique: async ({ where }: any) => records.get(where.cooperativeId_userEmail.cooperativeId + ':' + where.cooperativeId_userEmail.userEmail) ?? null,
      upsert: async ({ where, create, update }: any) => {
        const key = where.cooperativeId_userEmail.cooperativeId + ':' + where.cooperativeId_userEmail.userEmail;
        const record = records.has(key)
          ? { ...records.get(key), ...update, updatedAt: new Date('2026-04-29T12:00:00Z') }
          : { ...create, id: `pref-${records.size + 1}`, createdAt: new Date('2026-04-29T12:00:00Z'), updatedAt: new Date('2026-04-29T12:00:00Z') };
        records.set(key, record);
        return record;
      },
    },
  };
};

test('loads role defaults when no stored dashboard preference exists', async () => {
  const client = createPreferenceClient();

  const preference = await getStoredDashboardPreference(client as any, {
    cooperativeId: 'coop-a',
    userEmail: 'resident@example.com',
    role: 'resident',
  });

  assert.equal(preference.tiles[0].id, 'my-home');
});

test('saves normalized dashboard preferences per cooperative and user email', async () => {
  const client = createPreferenceClient();

  await saveStoredDashboardPreference(client as any, {
    cooperativeId: 'coop-a',
    userEmail: 'admin@example.com',
    role: 'admin',
    preference: {
      version: 1,
      tiles: [
        { id: 'waitlist-snapshot', size: 'wide', hidden: false },
        { id: 'my-home', size: 'wide', hidden: false },
      ],
    },
  });

  await saveStoredDashboardPreference(client as any, {
    cooperativeId: 'coop-b',
    userEmail: 'admin@example.com',
    role: 'admin',
    preference: {
      version: 1,
      tiles: [
        { id: 'maintenance-pulse', size: 'large', hidden: true },
      ],
    },
  });

  const coopA = await getStoredDashboardPreference(client as any, {
    cooperativeId: 'coop-a',
    userEmail: 'admin@example.com',
    role: 'admin',
  });
  const coopB = await getStoredDashboardPreference(client as any, {
    cooperativeId: 'coop-b',
    userEmail: 'admin@example.com',
    role: 'admin',
  });

  assert.equal(coopA.tiles[0].id, 'waitlist-snapshot');
  assert.ok(!coopA.tiles.some(tile => tile.id === 'my-home'));
  assert.equal(coopB.tiles[0].id, 'maintenance-pulse');
  assert.equal(coopB.tiles[0].hidden, true);
});
