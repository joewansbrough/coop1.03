import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const apiSource = () => readFileSync(new URL('../api/index.ts', import.meta.url), 'utf8');
const driveSource = () => readFileSync(new URL('../api/drive.ts', import.meta.url), 'utf8');
const multiTenancySource = () => readFileSync(new URL('../utils/multiTenancy.ts', import.meta.url), 'utf8');

test('meeting minutes are fully isolated on GET and POST', () => {
  const source = apiSource();

  // GET Minutes: must strictly check that cooperativeId exists and matches
  assert.ok(
    source.includes('!minutes.cooperativeId || minutes.cooperativeId !== coopId'),
    'GET /api/minutes/:meetingId is missing strict cooperativeId validation'
  );

  // POST Minutes: pre-flight check on associated event
  assert.ok(
    source.includes('coopEvent.findFirst') && source.includes('where: { id: meetingId, cooperativeId: coopId }'),
    'POST /api/minutes/:meetingId is missing pre-flight check to verify the meeting event cooperative'
  );

  // POST Minutes: pre-flight check on existing minutes
  assert.ok(
    source.includes('existing && (!existing.cooperativeId || existing.cooperativeId !== coopId)'),
    'POST /api/minutes/:meetingId is missing pre-flight check to verify existing minutes cooperative'
  );

  // MINUTES_SAVE audit log must be called
  assert.ok(
    source.includes("action: 'MINUTES_SAVE'"),
    'POST /api/minutes/:meetingId is missing MINUTES_SAVE audit logging'
  );
});

test('unit turnover operations strictly enforce cooperative ownership', () => {
  const source = apiSource();

  // Move-out: pre-flight unit ownership check
  assert.ok(
    source.includes('unit.findFirst') && source.includes('where: { id, cooperativeId: coopId }'),
    'Move-out endpoint is missing pre-flight check on unit cooperative ownership'
  );

  // Move-in: pre-flight unit and tenant ownership checks
  assert.ok(
    source.includes('tenant.findFirst') && source.includes('where: { id: tenantId, cooperativeId: coopId }'),
    'Move-in endpoint is missing pre-flight check on tenant cooperative ownership'
  );

  // Transfer: pre-flight source and destination unit ownership checks
  assert.ok(
    source.includes('unit.findFirst') && source.includes('where: { id: toUnitId, cooperativeId: coopId }'),
    'Transfer endpoint is missing pre-flight check on destination unit cooperative ownership'
  );
});

test('tenant registration protects unit associations', () => {
  const source = apiSource();

  // Tenant POST: pre-flight unit ownership verification
  assert.ok(
    source.includes('unit.findFirst') && source.includes('where: { id: req.body.unitId, cooperativeId: coopId }'),
    'Tenant creation endpoint is missing pre-flight check on linked unit cooperative ownership'
  );
});

test('events prevent linking committees from different cooperatives', () => {
  const source = apiSource();

  // Events POST and PUT: pre-flight committee verification
  assert.ok(
    source.includes('committee.findFirst') && source.includes('where: { id: committeeId, cooperativeId: coopId }'),
    'Events POST/PUT endpoints are missing pre-flight validation on linked committee cooperative'
  );
});

test('maintenance requests prevent linking units from different cooperatives', () => {
  const source = apiSource();

  // Maintenance POST: pre-flight unit verification
  assert.ok(
    source.includes('unit.findFirst') && source.includes('where: { id: unitId, cooperativeId: coopId }'),
    'Maintenance POST endpoint is missing pre-flight validation on unit cooperative'
  );

  // Maintenance PUT: pre-flight unit verification
  assert.ok(
    source.includes('unit.findFirst') && source.includes('where: { id: body.unitId, cooperativeId: coopId }'),
    'Maintenance PUT endpoint is missing pre-flight validation on unit cooperative'
  );
});

test('Google Drive endpoints dynamically isolate roots per cooperative', () => {
  const source = driveSource();

  // Ensure isFolderWithinRoot accepts a dynamic roots array
  assert.ok(
    source.includes('async function isFolderWithinRoot(folderId: string, roots: string[], cache?: Map<string, boolean>)'),
    'isFolderWithinRoot helper signature is not updated to support dynamic roots'
  );

  // Ensure helper to get request roots is implemented and leveragesreq.cooperative
  assert.ok(
    source.includes('getRequestRootFolderIds = (req: Request)') && source.includes('googleDriveRootFolderIds'),
    'getRequestRootFolderIds helper is missing or not resolving from cooperative model'
  );

  // Ensure roots are resolved in each key handler and passed into isFolderWithinRoot
  assert.ok(
    source.includes('const roots = getRequestRootFolderIds(req);'),
    'Drive routes do not dynamically extract request-scoped roots'
  );

  assert.ok(
    source.includes('isFolderWithinRoot(folderId, roots)'),
    'Folder contents route does not pass dynamic roots to ancestry check'
  );

  assert.ok(
    source.includes('isFolderWithinRoot(parents?.[0] ?? \'\', roots)'),
    'Download route does not pass dynamic roots to ancestry check'
  );
});

test('subdomain session cookie configuration prevents bleed', () => {
  const source = apiSource();

  assert.ok(
    source.includes('secure: !isLocal') && source.includes('sameSite: isLocal ? \'lax\' : \'none\''),
    'Cookie session does not enforce secure sameSite boundaries across subdomains'
  );
});

test('all administrative write operations require ADMIN role', () => {
  const source = apiSource();

  const adminRoutes = [
    "app.post('/api/tenants', requireAuth, requireRole('ADMIN')",
    "app.put('/api/maintenance/:id', requireAuth, requireRole('ADMIN')",
    "app.delete('/api/maintenance/:id', requireAuth, requireRole('ADMIN')",
    "app.post('/api/announcements', requireAuth, requireRole('ADMIN')",
    "app.put('/api/announcements/:id', requireAuth, requireRole('ADMIN')",
    "app.delete('/api/announcements/:id', requireAuth, requireRole('ADMIN')",
    "app.post('/api/upload-to-blob', requireAuth, requireRole('ADMIN')",
    "app.post('/api/documents', requireAuth, requireRole('ADMIN')",
    "app.put('/api/documents/:id', requireAuth, requireRole('ADMIN')",
    "app.delete('/api/documents/:id', requireAuth, requireRole('ADMIN')",
    "app.post('/api/events', requireAuth, requireRole('ADMIN')",
    "app.put('/api/events/:id', requireAuth, requireRole('ADMIN')",
    "app.delete('/api/events/:id', requireAuth, requireRole('ADMIN')",
    "app.post('/api/minutes/:meetingId', requireAuth, requireRole('ADMIN')",
    "app.post('/api/minutes/:meetingId/library-pdf', requireAuth, requireRole('ADMIN')"
  ];

  for (const route of adminRoutes) {
    assert.ok(
      source.includes(route),
      `Admin route verification failed: expected protection pattern for route ${route}`
    );
  }
});

test('DocumentAccessLog is registered for automatic multi-tenancy logical isolation', () => {
  const source = multiTenancySource();

  assert.ok(
    source.includes("'DocumentAccessLog'"),
    'DocumentAccessLog is missing from COOPERATIVE_SCOPED_MODELS in utils/multiTenancy.ts'
  );
  assert.ok(
    source.includes("'MeetingMinutes'"),
    'MeetingMinutes is missing from COOPERATIVE_SCOPED_MODELS in utils/multiTenancy.ts'
  );
});
