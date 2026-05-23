import assert from 'node:assert/strict';
import {
  ONBOARDING_TEMPLATE_COLUMNS,
  ONBOARDING_TEMPLATE_RECORD_TYPES,
  buildOnboardingTemplateCsv,
} from '../utils/onboardingTemplate.ts';

assert.deepEqual(ONBOARDING_TEMPLATE_RECORD_TYPES, [
  'unit',
  'member',
  'committee',
  'committeeMembership',
  'roleAssignment',
  'document',
  'event',
  'announcement',
  'maintenanceRequest',
]);

assert.ok(ONBOARDING_TEMPLATE_COLUMNS.includes('recordType'));
assert.ok(ONBOARDING_TEMPLATE_COLUMNS.includes('unitNumber'));
assert.ok(ONBOARDING_TEMPLATE_COLUMNS.includes('email'));
assert.ok(ONBOARDING_TEMPLATE_COLUMNS.includes('committeeName'));
assert.ok(ONBOARDING_TEMPLATE_COLUMNS.includes('committeeRole'));
assert.ok(ONBOARDING_TEMPLATE_COLUMNS.includes('appRole'));
assert.ok(ONBOARDING_TEMPLATE_COLUMNS.includes('documentTitle'));
assert.ok(ONBOARDING_TEMPLATE_COLUMNS.includes('eventTitle'));
assert.ok(ONBOARDING_TEMPLATE_COLUMNS.includes('announcementTitle'));
assert.ok(ONBOARDING_TEMPLATE_COLUMNS.includes('maintenanceTitle'));

const csv = buildOnboardingTemplateCsv();
const lines = csv.split('\n');

assert.equal(lines[0], ONBOARDING_TEMPLATE_COLUMNS.join(','));
assert.ok(csv.includes('unit,101,Main Building'));
assert.ok(csv.includes('member,101,,,,,Ada,Lovelace,ada@example.com'));
assert.ok(csv.includes('committee,,,,,'));
assert.ok(csv.includes('committeeMembership,,,,,'));
assert.ok(csv.includes('roleAssignment,,,,,'));
assert.ok(csv.includes('document,,,,,'));
assert.ok(csv.includes('event,,,,,'));
assert.ok(csv.includes('announcement,,,,,'));
assert.ok(csv.includes('maintenanceRequest,101,,,,'));
assert.ok(csv.includes('"Policy, Governance"'));

const dataRows = lines.slice(1).filter(Boolean);
assert.equal(dataRows.length, ONBOARDING_TEMPLATE_RECORD_TYPES.length);

console.log('onboardingTemplate tests passed');
