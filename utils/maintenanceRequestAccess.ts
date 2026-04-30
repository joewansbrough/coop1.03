import type { MaintenanceRequest, Tenant, Unit } from '../types';

type UserLike = {
  email?: string;
  tenantId?: string;
  id?: string;
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
