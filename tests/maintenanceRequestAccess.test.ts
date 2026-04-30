import assert from 'node:assert/strict';
import test from 'node:test';
import { canExportMaintenanceRequest } from '../utils/maintenanceRequestAccess.ts';
import { MaintenancePriority, RequestStatus, type MaintenanceRequest, type Tenant, type Unit } from '../types.ts';

const request: MaintenanceRequest = {
  id: 'm1',
  title: 'Leak',
  description: 'Kitchen leak',
  status: RequestStatus.PENDING,
  priority: MaintenancePriority.MEDIUM,
  category: ['Plumbing'],
  unitId: 'u1',
  tenantId: 't1',
};

const unit: Unit = {
  id: 'u1',
  number: '101',
  type: 'One Bedroom',
  floor: 1,
  status: 'Occupied',
  currentTenantId: 't1',
};

const tenants: Tenant[] = [{
  id: 't1',
  firstName: 'Margaret',
  lastName: 'Chen',
  email: 'margaret@example.com',
  startDate: '2020-01-01',
  status: 'Current',
  role: 'Member',
  unitId: 'u1',
}];

test('allows admins to export any maintenance request', () => {
  assert.equal(canExportMaintenanceRequest(request, unit, tenants, null, true), true);
});

test('allows the current tenant of the unit to export their maintenance request', () => {
  assert.equal(canExportMaintenanceRequest(request, unit, tenants, { tenantId: 't1', email: 'margaret@example.com' }, false), true);
});

test('blocks unrelated residents from exporting another unit maintenance request', () => {
  assert.equal(canExportMaintenanceRequest(request, unit, tenants, { tenantId: 't2', email: 'other@example.com' }, false), false);
});
