import type { MaintenanceRequest, Tenant, Unit } from '../types';

type UserLike = {
  email?: string;
  tenantId?: string;
  id?: string;
  unitNumber?: string;
};

export const getUserMaintenanceUnitId = (
  units: Unit[],
  tenants: Tenant[],
  user?: UserLike | null,
) => {
  if (!user) return units[0]?.id || 'u1';

  if (user.unitNumber) {
    const unitByNumber = units.find(unit => unit.number === user.unitNumber);
    if (unitByNumber) return unitByNumber.id;
  }

  const userTenantId = user.tenantId || user.id;
  if (userTenantId) {
    const unitByCurrentTenant = units.find(unit => unit.currentTenantId === userTenantId);
    if (unitByCurrentTenant) return unitByCurrentTenant.id;

    const tenant = tenants.find(item => item.id === userTenantId);
    if (tenant?.unitId) return tenant.unitId;
  }

  const normalizedEmail = user.email?.trim().toLowerCase();
  if (normalizedEmail) {
    const tenant = tenants.find(item => item.email.trim().toLowerCase() === normalizedEmail && item.status === 'Current');
    if (tenant?.unitId) return tenant.unitId;
  }

  return units[0]?.id || 'u1';
};

export const isCurrentTenantForMaintenanceRequest = (
  request: MaintenanceRequest,
  unit: Unit | undefined,
  tenants: Tenant[],
  user?: UserLike | null,
) => {
  if (!user) return false;
  if (request.tenantId && (request.tenantId === user.tenantId || request.tenantId === user.id)) return true;
  if (unit?.currentTenantId && (unit.currentTenantId === user.tenantId || unit.currentTenantId === user.id)) return true;

  const normalizedEmail = user.email?.trim().toLowerCase();
  if (!normalizedEmail) return false;

  return tenants.some((tenant) =>
    tenant.unitId === request.unitId &&
    tenant.status === 'Current' &&
    tenant.email.trim().toLowerCase() === normalizedEmail
  );
};

export const canExportMaintenanceRequest = (
  request: MaintenanceRequest,
  unit: Unit | undefined,
  tenants: Tenant[],
  user: UserLike | null | undefined,
  isAdmin: boolean,
) => isAdmin || isCurrentTenantForMaintenanceRequest(request, unit, tenants, user);
