import assert from 'node:assert/strict';
import test from 'node:test';
import { MaintenancePriority } from '../types.ts';
import {
  canSeeNotification,
  createNotification,
} from '../utils/notifications.ts';
import {
  createDemoOracleResponse,
  detectOracleIntent,
  normalizeOracleLanguage,
} from '../utils/oracle.ts';
import {
  createMaintenanceTriage,
  shouldFlagTriageForReview,
} from '../utils/maintenanceAI.ts';
import {
  createDemoMeetingAnalysis,
  mapMeetingActionsToNotifications,
} from '../utils/meetingAnalysis.ts';
import {
  groupUnitsByBuildingAndFloor,
} from '../utils/buildingHierarchy.ts';
import {
  addDashboardTile,
  hideDashboardTile,
} from '../utils/dashboardPreferences.ts';

test('notification visibility respects admin audience and direct recipient targeting', () => {
  const adminNotice = createNotification({
    cooperativeId: 'coop-1',
    audience: 'admin',
    type: 'maintenance',
    severity: 'high',
    title: 'New high priority request',
    body: 'Unit 101 has a leak.',
  });
  const directNotice = createNotification({
    cooperativeId: 'coop-1',
    audience: 'user',
    recipientUserEmail: 'member@example.com',
    type: 'governance',
    severity: 'info',
    title: 'Action assigned',
    body: 'Please review your meeting action.',
  });

  assert.equal(canSeeNotification(adminNotice, { email: 'admin@example.com', isAdmin: true }), true);
  assert.equal(canSeeNotification(adminNotice, { email: 'member@example.com', isAdmin: false }), false);
  assert.equal(canSeeNotification(directNotice, { email: 'member@example.com', isAdmin: false }), true);
  assert.equal(canSeeNotification(directNotice, { email: 'other@example.com', isAdmin: false }), false);
});

test('oracle language normalization supports the production language list', () => {
  assert.equal(normalizeOracleLanguage('Cantonese'), 'Cantonese');
  assert.equal(normalizeOracleLanguage('unknown'), 'English');
});

test('oracle detects maintenance intent without losing policy context', () => {
  const intent = detectOracleIntent('My sink is leaking and I need to know what the rules say.');

  assert.equal(intent.intent, 'maintenance');
  assert.equal(intent.suggestedAction?.type, 'start-maintenance-request');
  assert.equal(intent.suggestedAction?.href, '/maintenance?action=new-request');
});

test('demo oracle returns useful local answers without server auth', () => {
  const response = createDemoOracleResponse('My sink is leaking, what should I do?', 'Spanish');

  assert.equal(response.language, 'Spanish');
  assert.equal(response.intent, 'maintenance');
  assert.equal(response.suggestedAction?.type, 'start-maintenance-request');
  assert.match(response.answer, /maintenance request/i);
  assert.equal(response.citations[0].title, 'Demo Co-op Policy Guide');
});

test('maintenance triage stores advisory AI metadata and flags risky suggestions for review', () => {
  const triage = createMaintenanceTriage({
    priority: 'Emergency',
    urgency: 'Emergency',
    category: ['Plumbing'],
    residentTip: 'Turn off the nearest shut-off valve while waiting for help.',
    confidence: 0.62,
    safetyWarning: 'Active leak near electrical fixtures.',
  });

  assert.equal(triage.priority, MaintenancePriority.EMERGENCY);
  assert.equal(triage.category[0], 'Plumbing');
  assert.equal(shouldFlagTriageForReview(triage), true);
});

test('meeting actions become targeted governance notifications', () => {
  const notifications = mapMeetingActionsToNotifications({
    cooperativeId: 'coop-1',
    meetingId: 'event-1',
    actions: [
      {
        id: 'a1',
        description: 'Book plumber for backflow inspection.',
        ownerName: 'Maintenance Committee',
        committee: 'Maintenance',
        dueDate: '2026-05-20',
        priority: 'High',
        sourceSnippet: 'Maintenance will book the plumber.',
      },
    ],
  });

  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].audience, 'admin');
  assert.equal(notifications[0].type, 'governance');
  assert.equal(notifications[0].entityType, 'meeting-analysis');
  assert.match(notifications[0].body, /Book plumber/);
});

test('demo meeting analysis maps rough notes into editable minutes fields', () => {
  const analysis = createDemoMeetingAnalysis(
    'Board approved repainting the lobby. Motion to accept the quote was carried. Action: Maintenance committee will book the painter by next Friday.',
    'event-1',
  );

  assert.equal(analysis.meetingId, 'event-1');
  assert.match(analysis.professionalSummary, /repainting/);
  assert.equal(Array.isArray(analysis.topicBriefings), true);
  assert.match(analysis.topicBriefings?.[0].recommendedMinuteText || '', /meeting discussed/i);
  assert.equal(analysis.decisions.some(item => /approved repainting/.test(item)), true);
  assert.equal(analysis.motionsMentioned.length, 1);
  assert.equal(analysis.actionItems.some(item => /Maintenance committee/.test(item.description)), true);
  assert.match(analysis.confidenceNotes?.[0] || '', /Review/i);
});

test('demo meeting analysis groups community garden notes into professional minutes', () => {
  const analysis = createDemoMeetingAnalysis(
    [
      'Bob introduced the idea of creating a community garden space in the front',
      'Seconded by Margaret',
      'Consideration to be given to visual layout',
      'City said they could contribute trees at no cost',
      'Volunteers needed',
      'Committee should be stood up to address plan',
    ].join('\n'),
    'event-2',
  );

  assert.match(analysis.professionalSummary, /community garden/i);
  assert.match(analysis.professionalSummary, /seconded by Margaret/i);
  assert.equal(analysis.topicBriefings?.length, 1);
  assert.match(analysis.topicBriefings?.[0].recommendedMinuteText || '', /City support for trees at no cost/i);
  assert.equal(analysis.motionsMentioned.length, 1);
  assert.equal(analysis.decisions.length, 0);
  assert.equal(analysis.actionItems.some(item => /committee or working group/i.test(item.description)), true);
  assert.equal(analysis.actionItems.some(item => /visual layout/i.test(item.description)), true);
  assert.match(analysis.confidenceNotes?.join(' ') || '', /do not state the final outcome/i);
});

test('units can be grouped by building while preserving floor-only defaults', () => {
  const grouped = groupUnitsByBuildingAndFloor(
    [
      { id: 'u1', number: '101', type: '1BR', floor: 1, status: 'Occupied', buildingId: 'b1' },
      { id: 'u2', number: '201', type: '2BR', floor: 2, status: 'Vacant' },
    ],
    [{ id: 'b1', name: 'Main Building', cooperativeId: 'coop-1', sortOrder: 1 }],
  );

  assert.deepEqual(Object.keys(grouped), ['Main Building', 'Building']);
  assert.equal(grouped['Main Building'][1][0].number, '101');
  assert.equal(grouped.Building[2][0].number, '201');
});

test('new dashboard tiles can be hidden and restored by role', () => {
  const base = {
    version: 1,
    tiles: [
      { id: 'notifications-hub' as const, size: 'wide' as const, hidden: false },
    ],
  };

  const hidden = hideDashboardTile(base, 'admin', 'notifications-hub');
  const restored = addDashboardTile(hidden, 'admin', 'notifications-hub');

  assert.equal(hidden.tiles.find(tile => tile.id === 'notifications-hub')?.hidden, true);
  assert.equal(restored.tiles.find(tile => tile.id === 'notifications-hub')?.hidden, false);
});
