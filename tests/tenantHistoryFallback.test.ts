import assert from 'node:assert/strict';
import test from 'node:test';
import { getTenantHistoryFallback } from '../utils/tenantHistory.ts';
import type { Tenant, Unit } from '../types.ts';

const units: Unit[] = [
  { id: 'u1', number: '101', type: '1BR', floor: 1, status: 'Occupied' },
  { id: 'u5', number: '105', type: '1BR', floor: 1, status: 'Vacant' },
];

test('demo tenant history uses the assigned unit when no stored history exists', () => {
  const tenant: Tenant = {
    id: 'tenant-new',
    firstName: 'New',
    lastName: 'Member',
    email: 'new.member@example.com',
    phone: '555-555-1212',
    startDate: '2026-05-12',
    status: 'Current',
    role: 'MEMBER',
    unitId: 'u5',
  };

  const [record] = getTenantHistoryFallback(tenant, units);

  assert.equal(record.unitId, 'u5');
  assert.equal(record.unit?.number, '105');
});

test('demo tenant history preserves stored history when present', () => {
  const tenant: Tenant = {
    id: 'tenant-existing',
    firstName: 'Existing',
    lastName: 'Member',
    email: 'existing.member@example.com',
    startDate: '2024-01-01',
    status: 'Current',
    role: 'MEMBER',
    unitId: 'u5',
    history: [
      {
        id: 'history-1',
        tenantId: 'tenant-existing',
        unitId: 'u1',
        startDate: '2020-01-01',
        endDate: '2024-01-01',
        unit: units[0],
      },
    ],
  };

  assert.equal(getTenantHistoryFallback(tenant, units)[0].unitId, 'u1');
});
