import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();

test('Vercel deploys run database migrations before building the app', () => {
  const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));

  assert.equal(
    vercel.buildCommand,
    'npm run build:with-baseline',
    'Vercel must run Prisma migrations before serving code that includes new document relations.',
  );
});

test('migrations provision Drive document versioning and dashboard preference tables', () => {
  const migrations = fs.readdirSync(path.join(root, 'prisma', 'migrations'))
    .filter(name => fs.existsSync(path.join(root, 'prisma', 'migrations', name, 'migration.sql')))
    .map(name => fs.readFileSync(path.join(root, 'prisma', 'migrations', name, 'migration.sql'), 'utf8'))
    .join('\n');

  for (const requiredSql of [
    'CREATE TABLE IF NOT EXISTS "DocumentVersion"',
    'ADD COLUMN IF NOT EXISTS "currentVersionId"',
    'CREATE TABLE IF NOT EXISTS "DocumentIngestionJob"',
    'CREATE TABLE IF NOT EXISTS "RagStore"',
    'CREATE TABLE IF NOT EXISTS "DashboardPreference"',
    'CREATE TABLE IF NOT EXISTS "PolicyAssistantQuery"',
  ]) {
    assert.match(migrations, new RegExp(requiredSql.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});
