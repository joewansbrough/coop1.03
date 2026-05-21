import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getStoredUserPreference,
  saveStoredUserPreference,
} from '../services/userPreferenceStore.ts';

const createPreferenceClient = () => {
  const records = new Map<string, any>();
  return {
    records,
    userPreference: {
      findUnique: async ({ where }: any) => records.get([
        where.cooperativeId_userEmail_key.cooperativeId,
        where.cooperativeId_userEmail_key.userEmail,
        where.cooperativeId_userEmail_key.key,
      ].join(':')) ?? null,
      upsert: async ({ where, create, update }: any) => {
        const key = [
          where.cooperativeId_userEmail_key.cooperativeId,
          where.cooperativeId_userEmail_key.userEmail,
          where.cooperativeId_userEmail_key.key,
        ].join(':');
        const record = records.has(key)
          ? { ...records.get(key), ...update, updatedAt: new Date('2026-05-21T12:00:00Z') }
          : { ...create, id: `pref-${records.size + 1}`, createdAt: new Date('2026-05-21T12:00:00Z'), updatedAt: new Date('2026-05-21T12:00:00Z') };
        records.set(key, record);
        return record;
      },
    },
  };
};

test('loads a default when no stored user preference exists', async () => {
  const client = createPreferenceClient();
  const preference = await getStoredUserPreference(client as any, {
    cooperativeId: 'coop-a',
    userEmail: 'Resident@Example.com',
    key: 'audio',
    defaultValue: { voiceName: 'Kore' },
  });

  assert.deepEqual(preference, { voiceName: 'Kore' });
});

test('saves user preferences per cooperative, user email, and key', async () => {
  const client = createPreferenceClient();

  await saveStoredUserPreference(client as any, {
    cooperativeId: 'coop-a',
    userEmail: 'Admin@Example.com',
    key: 'audio',
    value: { voiceName: 'Puck' },
  });
  await saveStoredUserPreference(client as any, {
    cooperativeId: 'coop-b',
    userEmail: 'admin@example.com',
    key: 'audio',
    value: { voiceName: 'Sulafat' },
  });

  const coopA = await getStoredUserPreference(client as any, {
    cooperativeId: 'coop-a',
    userEmail: 'admin@example.com',
    key: 'audio',
    defaultValue: { voiceName: 'Kore' },
  });
  const coopB = await getStoredUserPreference(client as any, {
    cooperativeId: 'coop-b',
    userEmail: 'ADMIN@example.com',
    key: 'audio',
    defaultValue: { voiceName: 'Kore' },
  });

  assert.deepEqual(coopA, { voiceName: 'Puck' });
  assert.deepEqual(coopB, { voiceName: 'Sulafat' });
});
