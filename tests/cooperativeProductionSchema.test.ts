import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const schema = readFileSync('prisma/schema.prisma', 'utf8');
const cooperativeModel = schema.match(/model Cooperative \{[\s\S]*?\n\}/)?.[0] || '';

for (const field of [
  'subdomain',
  'status',
  'onboardingState',
  'settings',
  'launchedAt',
  'suspendedAt',
  'archivedAt',
]) {
  assert.ok(cooperativeModel.includes(field), `Cooperative model should include ${field}`);
}

const subdomainLine = cooperativeModel.split('\n').find(line => line.includes('subdomain')) || '';
assert.ok(subdomainLine.includes('String?'), 'Cooperative.subdomain should be optional');
assert.ok(subdomainLine.includes('@unique'), 'Cooperative.subdomain should be unique');
assert.ok(
  cooperativeModel.includes('settings') && cooperativeModel.includes('Json'),
  'Cooperative.settings should use Json storage',
);

const migration = readFileSync(
  'prisma/migrations/20260522000000_add_cooperative_lifecycle_fields/migration.sql',
  'utf8',
);

for (const column of [
  '"subdomain"',
  '"status"',
  '"onboardingState"',
  '"settings"',
  '"launchedAt"',
  '"suspendedAt"',
  '"archivedAt"',
]) {
  assert.ok(migration.includes(column), `migration should add ${column}`);
}

console.log('cooperativeProductionSchema tests passed');
