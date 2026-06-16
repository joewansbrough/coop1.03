import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GOOGLE_WORKSPACE_CAPABILITIES,
  buildGoogleWorkspaceSettingsUpdate,
  buildGoogleWorkspaceStatus,
  normalizeGoogleWorkspaceSettings,
} from '../utils/googleWorkspace.ts';

test('normalizes missing Google Workspace settings into a disconnected status', () => {
  const settings = normalizeGoogleWorkspaceSettings(undefined);

  assert.equal(settings.enabled, false);
  assert.deepEqual(settings.adminEmail, null);
  assert.deepEqual(settings.domain, null);
  assert.deepEqual(settings.driveRootFolderIds, []);
});

test('builds readiness steps from coop settings and environment', () => {
  const status = buildGoogleWorkspaceStatus({
    cooperativeSettings: {
      googleWorkspace: {
        enabled: true,
        domain: 'oakbaycoop.bc.ca',
        adminEmail: 'admin@oakbaycoop.bc.ca',
        driveRootFolderIds: ['drive-root-a', 'drive-root-b'],
        directorySyncEnabled: true,
        calendarSyncEnabled: false,
        communicationsSyncEnabled: true,
        formsSyncEnabled: false,
        calendarId: 'calendar@example.com',
        timeZone: 'America/Vancouver',
        lastSyncAt: '2026-06-15T18:00:00.000Z',
      },
    },
    env: {
      GOOGLE_CLIENT_ID: 'client-id',
      GOOGLE_CLIENT_SECRET: 'client-secret',
      GOOGLE_SERVICE_ACCOUNT_JSON: '{"client_email":"svc@example.iam.gserviceaccount.com"}',
    } as any,
    activeDriveRootCount: 2,
  });

  assert.equal(status.connected, true);
  assert.equal(status.domain, 'oakbaycoop.bc.ca');
  assert.equal(status.adminEmail, 'admin@oakbaycoop.bc.ca');
  assert.equal(status.lastSyncAt, '2026-06-15T18:00:00.000Z');
  assert.equal(status.readiness.oauthConfigured.ready, true);
  assert.equal(status.readiness.serviceAccountConfigured.ready, true);
  assert.equal(status.readiness.driveRootsConfigured.ready, true);
  assert.equal(status.enabledCapabilities.length, 4);
  assert.deepEqual(status.enabledCapabilities.map(capability => capability.id), ['identity', 'drive', 'directory', 'communications']);
});

test('keeps capability metadata ordered by recommended rollout value', () => {
  assert.deepEqual(
    GOOGLE_WORKSPACE_CAPABILITIES.map(capability => capability.id),
    ['identity', 'drive', 'directory', 'calendar', 'communications', 'forms', 'sites'],
  );
});

test('builds a settings update without clobbering unrelated cooperative settings', () => {
  const nextSettings = buildGoogleWorkspaceSettingsUpdate({
    existingSettings: {
      theme: 'coastal',
      googleWorkspace: {
        enabled: false,
        domain: 'old.example',
        lastSyncAt: '2026-06-01T12:00:00.000Z',
      },
    },
    input: {
      enabled: true,
      domain: ' OakBayCoop.BC.CA ',
      adminEmail: ' Admin@OakBayCoop.BC.CA ',
      driveRootFolderIds: [' drive-a ', 'drive-a', '', 'drive-b'],
      directorySyncEnabled: true,
      calendarSyncEnabled: true,
      communicationsSyncEnabled: false,
      formsSyncEnabled: true,
      sitesEnabled: false,
      calendarId: ' board@example.com ',
      timeZone: 'America/Vancouver',
    },
  });

  assert.equal((nextSettings as any).theme, 'coastal');
  assert.deepEqual((nextSettings as any).googleWorkspace, {
    enabled: true,
    domain: 'oakbaycoop.bc.ca',
    adminEmail: 'admin@oakbaycoop.bc.ca',
    driveRootFolderIds: ['drive-a', 'drive-b'],
    directorySyncEnabled: true,
    calendarSyncEnabled: true,
    communicationsSyncEnabled: false,
    formsSyncEnabled: true,
    sitesEnabled: false,
    calendarId: 'board@example.com',
    timeZone: 'America/Vancouver',
    lastSyncAt: '2026-06-01T12:00:00.000Z',
  });
});

test('requires domain and admin email when enabling Workspace', () => {
  assert.throws(
    () => buildGoogleWorkspaceSettingsUpdate({
      existingSettings: {},
      input: { enabled: true, domain: '', adminEmail: '' },
    }),
    /domain and admin email/i,
  );
});
