import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const apiSource = () => readFileSync(new URL('../api/index.ts', import.meta.url), 'utf8');

test('dangerous public database maintenance routes are not exposed', () => {
  const source = apiSource();

  assert.equal(source.includes("app.get('/api/migrate'"), false);
  assert.equal(source.includes("app.get('/api/seed'"), false);
  assert.equal(source.includes("'/api/debug/config'"), false);
  assert.equal(source.includes("'/debug/config'"), false);
});

test('API no longer falls back to the first cooperative', () => {
  const source = apiSource();

  assert.equal(source.includes('Fallback to first cooperative'), false);
  assert.equal(source.includes('findFirst();'), false);
  assert.equal(source.includes('No cooperative found in the system.'), false);
});

test('obvious tenant-owned destructive writes are not id-only operations', () => {
  const source = apiSource();

  assert.equal(source.includes('maintenanceRequest.delete({ where: { id: maintenanceId }'), false);
  assert.equal(source.includes('announcement.delete({ where: { id: announcementId }'), false);
  assert.equal(source.includes('document.delete({ where: { id: documentId }'), false);
  assert.equal(source.includes('coopEvent.delete({ where: { id: eventId }'), false);
});
