import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { MaintenancePriority } from '../types.ts';
import {
  canSeeNotification,
  createNotification,
} from '../utils/notifications.ts';
import {
  createMaintenanceRequestHref,
  createDemoOracleResponse,
  detectOracleIntent,
  mergeOracleSuggestedAction,
  normalizeOracleLanguage,
  shouldAnswerOracleWithDocs,
} from '../utils/oracle.ts';
import {
  canUsePrivilegedOracleTools,
  oracleTools,
  oracleToolNames,
} from '../utils/oracleTools.ts';
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
  const question = 'My sink is leaking and I need to know what the rules say.';
  const intent = detectOracleIntent(question);

  assert.equal(intent.intent, 'maintenance');
  assert.equal(intent.suggestedAction?.type, 'start-maintenance-request');
  assert.equal(intent.suggestedAction?.label, 'Yes, help me submit a request');
  assert.equal(intent.suggestedAction?.href, createMaintenanceRequestHref(question));
  assert.equal(new URLSearchParams(intent.suggestedAction?.href.split('?')[1]).get('issue'), question);
});

test('oracle maintenance smart nudge preserves direct form prefill even if gemini returns a generic link', () => {
  const question = 'My sink is leaking, what do I do?';
  const action = mergeOracleSuggestedAction(question, {
    type: 'start-maintenance-request',
    label: 'Open maintenance',
    href: '/maintenance',
  });

  assert.equal(action?.label, 'Open maintenance');
  assert.equal(action?.href, createMaintenanceRequestHref(question));
  assert.equal(new URLSearchParams(action?.href.split('?')[1]).get('issue'), question);
});

test('demo oracle returns useful local answers without server auth', () => {
  const response = createDemoOracleResponse('My sink is leaking, what should I do?', 'Spanish');

  assert.equal(response.language, 'Spanish');
  assert.equal(response.intent, 'maintenance');
  assert.equal(response.suggestedAction?.type, 'start-maintenance-request');
  assert.match(response.answer, /maintenance request/i);
  assert.equal(response.citations[0].title, 'Demo Co-op Policy Guide');
});

test('oracle tool registry covers the co-op database models', () => {
  const requiredTools = [
    'get_cooperative_profile',
    'get_buildings',
    'get_units',
    'get_tenants',
    'get_tenant_history',
    'get_maintenance_requests',
    'get_scheduled_maintenance',
    'get_notifications',
    'get_announcements',
    'get_documents',
    'get_document_versions',
    'get_document_ingestion_jobs',
    'get_document_access_logs',
    'get_document_chunks',
    'search_coop_knowledge',
    'search_coop_database',
    'get_events',
    'get_committees',
    'get_meeting_minutes',
    'get_meeting_analyses',
    'get_policy_query_history',
    'get_dashboard_preferences',
    'get_database_schema',
  ];

  for (const toolName of requiredTools) {
    assert.equal(oracleToolNames.includes(toolName), true, `${toolName} should be exposed to Gemini`);
  }
});

test('oracle privileged tools are limited to board and admin roles', () => {
  assert.equal(canUsePrivilegedOracleTools({ isAdmin: true, role: 'MEMBER' }), true);
  assert.equal(canUsePrivilegedOracleTools({ isAdmin: false, role: 'ADMIN' }), true);
  assert.equal(canUsePrivilegedOracleTools({ isAdmin: false, role: 'BOARD' }), true);
  assert.equal(canUsePrivilegedOracleTools({ isAdmin: false, role: 'MEMBER' }), false);
});

test('oracle routes document-grounded questions to indexed docs', () => {
  assert.equal(shouldAnswerOracleWithDocs('What does the pet policy say?'), true);
  assert.equal(shouldAnswerOracleWithDocs('Summarize the occupancy agreement'), true);
  assert.equal(shouldAnswerOracleWithDocs('Who lives in unit 4?'), false);
  assert.equal(shouldAnswerOracleWithDocs('Show open maintenance requests'), false);
});

test('oracle record searches preserve member scope while applying text filters', async () => {
  let maintenanceWhere: any;
  let documentWhere: any;
  const fakePrisma = {
    tenant: {
      findUnique: async () => ({ unitId: 'u1' }),
    },
    maintenanceRequest: {
      findMany: async (args: any) => {
        maintenanceWhere = args.where;
        return [];
      },
    },
    document: {
      findMany: async (args: any) => {
        documentWhere = args.where;
        return [];
      },
    },
  };
  const context = {
    prisma: fakePrisma as any,
    cooperativeId: 'coop-1',
    userId: 't1',
    userEmail: 'member@example.com',
    role: 'MEMBER',
    isAdmin: false,
  };

  await oracleTools.get_maintenance_requests(context, { query: 'leak' });
  await oracleTools.get_documents(context, { query: 'pet' });

  assert.equal(maintenanceWhere.cooperativeId, 'coop-1');
  assert.equal(Array.isArray(maintenanceWhere.AND), true);
  assert.equal(maintenanceWhere.AND.length, 2);
  assert.deepEqual(maintenanceWhere.AND[0].OR[0], { requestedBy: 'member@example.com' });
  assert.equal(documentWhere.cooperativeId, 'coop-1');
  assert.equal(Array.isArray(documentWhere.AND), true);
  assert.equal(documentWhere.AND.length, 2);
  assert.deepEqual(documentWhere.AND[0].OR.map((item: any) => item.visibility), ['PUBLIC', 'MEMBERS']);
});

test('oracle tool calling does not request json response mime type', () => {
  const apiSource = readFileSync(new URL('../api/index.ts', import.meta.url), 'utf8');
  const toolCallingModels = apiSource.match(/getGenerativeModel\(\{\s*model: modelName,\s*tools: \[\{ functionDeclarations: oracleToolDeclarations as any \}\][\s\S]*?\}\);/g) || [];

  assert.equal(toolCallingModels.length >= 2, true);
  for (const modelConfig of toolCallingModels) {
    assert.equal(modelConfig.includes('responseMimeType'), false);
  }
});

test('demo oracle uses the effective demo user role instead of hardcoded member access', () => {
  const apiSource = readFileSync(new URL('../api/index.ts', import.meta.url), 'utf8');
  const demoRoute = apiSource.slice(
    apiSource.indexOf("app.post('/api/oracle/query-demo'"),
    apiSource.indexOf("app.post('/api/oracle/query'", apiSource.indexOf("app.post('/api/oracle/query-demo'") + 1),
  );

  assert.match(demoRoute, /demoUser/);
  assert.match(demoRoute, /isDemoAdmin/);
  assert.doesNotMatch(demoRoute, /userEmail:\s*'demo@example\.com'/);
  assert.doesNotMatch(demoRoute, /role:\s*'MEMBER'/);
  assert.doesNotMatch(demoRoute, /isAdmin:\s*false/);
});

test('oracle route passes empty args for no-argument tool calls', () => {
  const apiSource = readFileSync(new URL('../api/index.ts', import.meta.url), 'utf8');
  const toolCalls = apiSource.match(/toolHandler as any\)\(toolContext, call\.args \|\| \{\}\)/g) || [];

  assert.equal(toolCalls.length >= 2, true);
});

test('oracle knowledge search includes announcements for policy questions', async () => {
  const calls: any[] = [];
  const fakePrisma = {
    documentChunk: {
      findMany: async () => [],
    },
    document: {
      findMany: async () => [],
    },
    announcement: {
      findMany: async (args: any) => {
        calls.push(args);
        return [{ title: 'New Pet Policy Adopted', content: 'The new rules regarding pet size and registration are now in effect.' }];
      },
    },
  };

  const result = await oracleTools.search_coop_knowledge({
    prisma: fakePrisma as any,
    cooperativeId: 'coop-1',
    userId: 't1',
    userEmail: 'member@example.com',
    role: 'MEMBER',
    isAdmin: false,
  }, { query: 'pet policy' });

  assert.equal(result.announcements[0].title, 'New Pet Policy Adopted');
  assert.equal(calls[0].where.cooperativeId, 'coop-1');
});

test('oracle knowledge search returns announcements even if document search fails', async () => {
  const fakePrisma = {
    documentChunk: {
      findMany: async () => {
        throw new Error('chunk table unavailable');
      },
    },
    document: {
      findMany: async () => {
        throw new Error('document table unavailable');
      },
    },
    announcement: {
      findMany: async () => [{ title: 'New Pet Policy Adopted', content: 'Pet registration rules are now in effect.' }],
    },
  };

  const result = await oracleTools.search_coop_knowledge({
    prisma: fakePrisma as any,
    cooperativeId: 'coop-1',
    userId: 't1',
    userEmail: 'member@example.com',
    role: 'MEMBER',
    isAdmin: false,
  }, { query: 'pet policy' });

  assert.equal(result.documents.length, 0);
  assert.equal(result.announcements[0].title, 'New Pet Policy Adopted');
  assert.equal(result.errors.length, 0);
});

test('oracle prompt tells gemini to answer from partial usable records', () => {
  const apiSource = readFileSync(new URL('../api/index.ts', import.meta.url), 'utf8');

  assert.match(apiSource, /answer from the usable records/);
  assert.match(apiSource, /Only mention a failed lookup when no usable records/);
});

test('oracle routes have bounded tool loops and local fallback answers', () => {
  const apiSource = readFileSync(new URL('../api/index.ts', import.meta.url), 'utf8');

  assert.match(apiSource, /const MAX_CALLS = 3/);
  assert.match(apiSource, /createOracleAnswerFromToolResults/);
  assert.match(apiSource, /responseText \|\| fallbackAnswer/);
});

test('oracle database search can use committees and announcements as context', async () => {
  const fakePrisma = {
    building: { findMany: async () => [] },
    unit: { findMany: async () => [] },
    tenant: {
      findUnique: async () => ({ unitId: 'u1' }),
      findMany: async () => [],
    },
    maintenanceRequest: { findMany: async () => [] },
    scheduledMaintenance: { findMany: async () => [] },
    notification: { findMany: async () => [] },
    announcement: {
      findMany: async () => [{ title: 'New Pet Policy Adopted', content: 'Pet registration rules are now in effect.' }],
    },
    documentChunk: { findMany: async () => [] },
    document: { findMany: async () => [] },
    coopEvent: { findMany: async () => [] },
    committee: {
      findMany: async () => [{
        id: 'c5',
        name: 'Social Committee',
        description: 'Organizes community events.',
        chair: 'Wei Liu',
        members: [],
        events: [],
      }],
    },
    meetingMinutes: { findMany: async () => [] },
    meetingAnalysis: { findMany: async () => [] },
  };

  const result = await oracleTools.search_coop_database({
    prisma: fakePrisma as any,
    cooperativeId: 'coop-1',
    userId: 't1',
    userEmail: 'admin@example.com',
    role: 'ADMIN',
    isAdmin: true,
  }, { query: 'social committee pet policy' });

  assert.equal(result.committees[0].chair, 'Wei Liu');
  assert.equal(result.announcements[0].title, 'New Pet Policy Adopted');
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
