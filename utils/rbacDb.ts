import crypto from 'crypto';
import { DEFAULT_PERMISSION_KEYS, getEffectivePermissionKeys, type DocumentAccessSubject } from './rbac.js';

type PrismaLike = any;

const SYSTEM_GROUPS = [
  { name: 'Member', slug: 'member', type: 'MEMBER', permissions: ['documents.view.members', 'maintenance.requests.create', 'maintenance.requests.view_own', 'events.view.members'] },
  { name: 'Board', slug: 'board', type: 'BOARD', permissions: ['documents.view.members', 'documents.view.board', 'documents.create', 'documents.update', 'events.view.board', 'events.create', 'events.update', 'maintenance.requests.view_all'] },
  { name: 'Admin', slug: 'admin', type: 'ADMIN', permissions: [...DEFAULT_PERMISSION_KEYS] },
  { name: 'Contractor', slug: 'contractor', type: 'CONTRACTOR', permissions: ['maintenance.requests.view_own'] },
  { name: 'Auditor', slug: 'auditor', type: 'CUSTOM', permissions: ['documents.view.members', 'documents.view.board', 'audit.view'] },
] as const;

export const slugifyGroupName = (value: string) =>
  value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'group';

const permissionLabel = (key: string) =>
  key.split('.').map(part => part.replace(/_/g, ' ')).join(' / ');

const isMissingUserTableError = (error: any) =>
  error?.code === 'P2021' && String(error?.meta?.table || '').includes('User');

const makeLegacyTenantUser = (
  cooperativeId: string,
  normalizedEmail: string,
  displayName: string,
  tenant: any,
  profile: { firstName?: string | null; lastName?: string | null; googleSubjectId?: string | null },
) => ({
  id: tenant?.id || normalizedEmail,
  cooperativeId: tenant?.cooperativeId || cooperativeId,
  email: normalizedEmail,
  name: displayName,
  firstName: profile.firstName || tenant?.firstName || null,
  lastName: profile.lastName || tenant?.lastName || null,
  tenantId: tenant?.id || null,
  tenant: tenant || null,
  googleSubjectId: profile.googleSubjectId || null,
  isActive: tenant?.status ? tenant.status !== 'Inactive' : true,
  isSystemAdmin: String(tenant?.role || '').toUpperCase() === 'ADMIN',
  memberships: [],
  accessOverrides: [],
  __legacyTenantFallback: true,
});

export const seedRbacDefaults = async (p: PrismaLike, cooperativeId: string) => {
  const permissionsByKey = new Map<string, any>();
  for (const key of DEFAULT_PERMISSION_KEYS) {
    const permission = await p.permission.upsert({
      where: { key },
      update: {
        name: permissionLabel(key),
        category: key.split('.')[0] || 'general',
        isSystem: true,
      },
      create: {
        id: crypto.randomUUID(),
        key,
        name: permissionLabel(key),
        category: key.split('.')[0] || 'general',
        isSystem: true,
      },
    });
    permissionsByKey.set(key, permission);
  }

  for (const groupDef of SYSTEM_GROUPS) {
    const group = await p.group.upsert({
      where: { cooperativeId_slug: { cooperativeId, slug: groupDef.slug } },
      update: {
        name: groupDef.name,
        type: groupDef.type,
        isSystem: true,
      },
      create: {
        id: crypto.randomUUID(),
        cooperativeId,
        name: groupDef.name,
        slug: groupDef.slug,
        type: groupDef.type,
        isSystem: true,
      },
    });

    for (const key of groupDef.permissions) {
      const permission = permissionsByKey.get(key);
      if (!permission) continue;
      await p.groupPermission.upsert({
        where: { groupId_permissionId: { groupId: group.id, permissionId: permission.id } },
        update: {},
        create: {
          id: crypto.randomUUID(),
          groupId: group.id,
          permissionId: permission.id,
        },
      });
    }
  }

  const committees = await p.committee.findMany({ where: { cooperativeId } });
  for (const committee of committees) {
    const slug = slugifyGroupName(committee.name);
    const chairSlug = `${slug}-chair`;
    const committeeGroup = await p.group.upsert({
      where: { cooperativeId_slug: { cooperativeId, slug } },
      update: { name: committee.name, type: 'COMMITTEE', committeeId: committee.id, isSystem: true },
      create: {
        id: crypto.randomUUID(),
        cooperativeId,
        name: committee.name,
        slug,
        type: 'COMMITTEE',
        committeeId: committee.id,
        isSystem: true,
      },
    });
    const chairGroup = await p.group.upsert({
      where: { cooperativeId_slug: { cooperativeId, slug: chairSlug } },
      update: { name: `${committee.name} Chair`, type: 'CHAIR', committeeId: committee.id, isSystem: true },
      create: {
        id: crypto.randomUUID(),
        cooperativeId,
        name: `${committee.name} Chair`,
        slug: chairSlug,
        type: 'CHAIR',
        committeeId: committee.id,
        isSystem: true,
      },
    });
    const permissionKeys = ['documents.view.members', 'documents.view.committee', 'events.view.committee'];
    const chairPermissionKeys = [...permissionKeys, 'documents.create', 'documents.update', 'events.create', 'events.update'];
    for (const [group, keys] of [[committeeGroup, permissionKeys], [chairGroup, chairPermissionKeys]] as const) {
      for (const key of keys) {
        const permission = permissionsByKey.get(key);
        if (!permission) continue;
        await p.groupPermission.upsert({
          where: { groupId_permissionId: { groupId: group.id, permissionId: permission.id } },
          update: {},
          create: { id: crypto.randomUUID(), groupId: group.id, permissionId: permission.id },
        });
      }
    }
  }
};

export const ensureUserForEmail = async (
  p: PrismaLike,
  cooperativeId: string,
  email: string,
  profile: { name?: string | null; firstName?: string | null; lastName?: string | null; googleSubjectId?: string | null } = {},
) => {
  const normalizedEmail = email.trim().toLowerCase();
  const tenant = await p.tenant.findFirst({
    where: { cooperativeId, email: normalizedEmail },
    include: { unit: true, committees: true },
  });
  const [firstNameFromEmail] = normalizedEmail.split('@');
  const displayName = profile.name || (tenant ? `${tenant.firstName} ${tenant.lastName}`.trim() : firstNameFromEmail);
  let user;
  try {
    user = await p.user.upsert({
      where: { cooperativeId_email: { cooperativeId, email: normalizedEmail } },
      update: {
        name: displayName,
        firstName: profile.firstName || tenant?.firstName || null,
        lastName: profile.lastName || tenant?.lastName || null,
        tenantId: tenant?.id || undefined,
        googleSubjectId: profile.googleSubjectId || undefined,
        isActive: tenant?.status ? tenant.status !== 'Inactive' : true,
        lastLoginAt: new Date(),
      },
      create: {
        id: crypto.randomUUID(),
        cooperativeId,
        email: normalizedEmail,
        name: displayName,
        firstName: profile.firstName || tenant?.firstName || null,
        lastName: profile.lastName || tenant?.lastName || null,
        tenantId: tenant?.id || null,
        googleSubjectId: profile.googleSubjectId || null,
        isActive: tenant?.status ? tenant.status !== 'Inactive' : true,
        lastLoginAt: new Date(),
      },
    });
  } catch (error) {
    if (isMissingUserTableError(error)) {
      return makeLegacyTenantUser(cooperativeId, normalizedEmail, displayName, tenant, profile);
    }
    throw error;
  }

  await seedRbacDefaults(p, cooperativeId);
  const memberGroup = await p.group.findUnique({ where: { cooperativeId_slug: { cooperativeId, slug: 'member' } } });
  if (memberGroup) {
    await p.membership.upsert({
      where: { userId_groupId: { userId: user.id, groupId: memberGroup.id } },
      update: { isActive: true },
      create: {
        id: crypto.randomUUID(),
        cooperativeId,
        userId: user.id,
        groupId: memberGroup.id,
        source: 'SYSTEM',
        isActive: true,
      },
    });
  }

  const legacyRole = String(tenant?.role || '').toUpperCase();
  if (legacyRole === 'ADMIN') {
    const adminGroup = await p.group.findUnique({ where: { cooperativeId_slug: { cooperativeId, slug: 'admin' } } });
    if (adminGroup) {
      await p.membership.upsert({
        where: { userId_groupId: { userId: user.id, groupId: adminGroup.id } },
        update: { isActive: true },
        create: { id: crypto.randomUUID(), cooperativeId, userId: user.id, groupId: adminGroup.id, source: 'SYSTEM', isActive: true },
      });
    }
  }

  return p.user.findUnique({
    where: { id: user.id },
    include: {
      memberships: {
        where: { isActive: true },
        include: { group: { include: { permissions: { include: { permission: true } } } } },
      },
      accessOverrides: { include: { permission: true } },
      tenant: { include: { committees: true, unit: true } },
    },
  });
};

export const getEffectiveUser = async (p: PrismaLike, cooperativeId: string, email: string) =>
  ensureUserForEmail(p, cooperativeId, email);

export const getEffectiveUserInclude = {
  memberships: {
    where: { isActive: true },
    include: { group: { include: { permissions: { include: { permission: true } } } } },
  },
  accessOverrides: { include: { permission: true } },
  tenant: { include: { committees: true, unit: true } },
};

export const resolveTestingTargetUser = async (p: PrismaLike, cooperativeId: string, targetId: string) => {
  const existingUser = await p.user.findFirst({
    where: { id: targetId, cooperativeId, isActive: true },
    include: getEffectiveUserInclude,
  });
  if (existingUser) return existingUser;

  const tenant = await p.tenant.findFirst({
    where: { id: targetId, cooperativeId },
  });
  if (!tenant) return null;

  const ensuredUser = await ensureUserForEmail(p, cooperativeId, tenant.email);
  return p.user.findUnique({
    where: { id: ensuredUser.id },
    include: getEffectiveUserInclude,
  });
};

export const buildAccessSubject = (user: any, cooperativeId?: string): DocumentAccessSubject => {
  const memberships = (user?.memberships || []).filter((membership: any) => membership.isActive !== false);
  const groupIds = memberships.map((membership: any) => membership.groupId);
  const assignments = memberships.flatMap((membership: any) =>
    (membership.group?.permissions || []).map((permissionLink: any) => ({
      groupId: membership.groupId,
      permissionKey: permissionLink.permission.key,
      active: true,
    })),
  );
  const basePermissions = getEffectivePermissionKeys(groupIds, assignments);
  const now = Date.now();
  const overrides = (user?.accessOverrides || []).filter((override: any) =>
    !override.expiresAt || new Date(override.expiresAt).getTime() > now,
  );
  const denied = new Set(overrides.filter((override: any) => override.effect === 'DENY').map((override: any) => override.permission.key));
  const allowed = overrides.filter((override: any) => override.effect === 'ALLOW').map((override: any) => override.permission.key);
  const permissionKeys = Array.from(new Set([...basePermissions, ...allowed])).filter(key => !denied.has(key)).sort();
  const committeeIds = memberships
    .map((membership: any) => membership.group?.committeeId)
    .filter(Boolean);

  return {
    userId: user?.id || null,
    email: user?.email || null,
    cooperativeId: cooperativeId || user?.cooperativeId,
    groupIds,
    permissionKeys,
    committeeIds,
    isAdmin: Boolean(user?.isSystemAdmin || permissionKeys.includes('settings.update') || permissionKeys.includes('users.manage_groups')),
  };
};

export const makeSessionUser = (user: any, subject: DocumentAccessSubject) => ({
  id: user.id,
  userId: user.id,
  email: user.email,
  name: user.name || [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email,
  isAdmin: subject.isAdmin,
  tenantId: user.tenantId || null,
  unitNumber: user.tenant?.unit?.number || null,
  cooperativeId: user.cooperativeId,
  role: subject.isAdmin ? 'ADMIN' : 'MEMBER',
  groupIds: subject.groupIds,
  permissionKeys: subject.permissionKeys,
  committeeIds: subject.committeeIds,
});

export const makeImpersonatedSessionUser = (
  originalSessionUser: any,
  targetUser: any,
  targetSubject: DocumentAccessSubject,
) => {
  const impersonator: any = {
    id: originalSessionUser.userId || originalSessionUser.id,
    userId: originalSessionUser.userId || originalSessionUser.id,
    email: originalSessionUser.email,
    name: originalSessionUser.name,
    isAdmin: originalSessionUser.isAdmin,
    tenantId: originalSessionUser.tenantId || null,
    unitNumber: originalSessionUser.unitNumber || null,
    cooperativeId: originalSessionUser.cooperativeId,
    role: originalSessionUser.role,
    groupIds: originalSessionUser.groupIds || [],
    permissionKeys: originalSessionUser.permissionKeys || [],
    committeeIds: originalSessionUser.committeeIds || [],
  };
  if (originalSessionUser.picture !== undefined) impersonator.picture = originalSessionUser.picture;
  if (originalSessionUser.geminiModel !== undefined) impersonator.geminiModel = originalSessionUser.geminiModel;

  return {
    ...makeSessionUser(targetUser, targetSubject),
    isImpersonating: true,
    impersonator,
  };
};

export const restoreImpersonatedSessionUser = (sessionUser: any) =>
  sessionUser?.isImpersonating && sessionUser.impersonator ? sessionUser.impersonator : sessionUser;
