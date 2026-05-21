import assert from 'node:assert/strict';
import {
  TENANT_TEMPLATE_COLUMNS,
  buildTenantTemplateCsv,
  parseTenantImportCsv,
  validateTenantImportRows,
} from '../utils/tenantImport.ts';

assert.deepEqual(TENANT_TEMPLATE_COLUMNS, [
  'firstName',
  'lastName',
  'email',
  'phone',
  'unitNumber',
  'role',
  'status',
  'moveInDate',
  'emergencyContactName',
  'emergencyContactPhone',
  'parkingStall',
  'storageLocker',
  'notes',
]);

const template = buildTenantTemplateCsv();
assert.equal(template.split('\n')[0], TENANT_TEMPLATE_COLUMNS.join(','));
assert.ok(template.includes('Ada,Lovelace,ada@example.com'));

const rows = parseTenantImportCsv([
  'firstName,lastName,email,phone,unitNumber,role,status,moveInDate,notes',
  'Ada,Lovelace, ada@example.com ,250-000-0000,101,admin,current,2026-01-15,"Board member, imported"',
  'Grace,Hopper,grace@example.com,,999,member,current,not-a-date,',
  'Duplicate,Email,ada@example.com,,102,member,current,2026-02-01,',
  'Missing,Email,,,102,member,current,2026-02-01,',
].join('\n'));

assert.equal(rows.length, 4);
assert.equal(rows[0].firstName, 'Ada');
assert.equal(rows[0].email, 'ada@example.com');
assert.equal(rows[0].role, 'ADMIN');
assert.equal(rows[0].status, 'Current');
assert.equal(rows[0].moveInDate, '2026-01-15');
assert.equal(rows[0].notes, 'Board member, imported');

const preview = validateTenantImportRows(rows, {
  existingUnits: [
    { id: 'unit-101', number: '101', currentTenantId: null },
    { id: 'unit-102', number: '102', currentTenantId: 'tenant-existing' },
  ],
  existingTenants: [
    { id: 'tenant-existing', email: 'existing@example.com', unitId: 'unit-102' },
  ],
});

assert.equal(preview.validRows, 1);
assert.equal(preview.errorRows, 3);
assert.equal(preview.rows[0].valid, true);
assert.equal(preview.rows[0].unitId, 'unit-101');
assert.deepEqual(preview.rows[0].warnings, []);
assert.ok(preview.rows[1].errors.includes('Unit number 999 does not exist.'));
assert.ok(preview.rows[1].errors.includes('Move-in date must be a valid date.'));
assert.ok(preview.rows[2].errors.includes('Duplicate email in upload.'));
assert.ok(preview.rows[2].warnings.includes('Unit 102 already has an active occupant.'));
assert.ok(preview.rows[3].errors.includes('Email is required.'));

const unsupportedRows = parseTenantImportCsv([
  'firstName,lastName,email,phone,unitNumber,role,status,moveInDate',
  'Wrong,Role,wrong-role@example.com,,101,owner,current,2026-01-15',
  'Wrong,Status,wrong-status@example.com,,101,member,active,2026-01-15',
].join('\n'));
const unsupportedPreview = validateTenantImportRows(unsupportedRows, {
  existingUnits: [{ id: 'unit-101', number: '101', currentTenantId: null }],
  existingTenants: [],
});
assert.ok(unsupportedPreview.rows[0].errors.includes('Role OWNER is not supported.'));
assert.ok(unsupportedPreview.rows[1].errors.includes('Status active is not supported.'));

console.log('tenantImport tests passed');
