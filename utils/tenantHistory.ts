import type { Tenant, TenantHistory, Unit } from '../types';

export const getTenantHistoryFallback = (tenant: Tenant, units: Unit[]): TenantHistory[] => {
  if (tenant.history && tenant.history.length > 0) {
    return tenant.history;
  }

  if (!tenant.unitId) {
    return [];
  }

  const unit = tenant.unit || units.find(item => item.id === tenant.unitId);
  if (!unit) {
    return [];
  }

  return [{
    id: `history-${tenant.id}-${tenant.unitId}`,
    tenantId: tenant.id,
    unitId: tenant.unitId,
    startDate: tenant.startDate,
    moveReason: 'Initial move-in',
    unit,
  }];
};
