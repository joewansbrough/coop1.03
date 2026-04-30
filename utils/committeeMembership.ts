import type { Committee, Tenant } from '../types';

const normalizeName = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();

export const getTenantDisplayName = (tenant: Tenant) => `${tenant.firstName} ${tenant.lastName}`;

export const getTenantCommitteeAssignments = (tenant: Tenant, committees: Committee[]) => {
  const tenantName = normalizeName(getTenantDisplayName(tenant));

  return committees
    .filter((committee) =>
      (committee.members || []).some((member) => {
        const memberName = typeof member === 'string'
          ? member
          : `${member.firstName || ''} ${member.lastName || ''}`;
        return normalizeName(memberName) === tenantName;
      })
    )
    .sort((a, b) => a.name.localeCompare(b.name));
};
