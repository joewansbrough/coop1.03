export type DocumentVisibilityValue = 'PUBLIC' | 'MEMBERS' | 'COMMITTEE' | 'BOARD' | 'ADMIN' | 'CUSTOM' | 'PRIVATE';
export type DocumentAccessLevelValue = 'VIEW' | 'COMMENT' | 'EDIT' | 'MANAGE';

export type PermissionAssignment = {
  groupId: string;
  permissionKey: string;
  active?: boolean;
};

export type DocumentAccessSubject = {
  userId?: string | null;
  email?: string | null;
  cooperativeId: string;
  groupIds: string[];
  permissionKeys: string[];
  committeeIds?: string[];
  isAdmin?: boolean;
};

export type DocumentAccessRuleLike = {
  groupId?: string | null;
  userId?: string | null;
  permission: DocumentAccessLevelValue | string;
};

export type DocumentAccessTarget = {
  cooperativeId: string;
  visibility: DocumentVisibilityValue | string;
  committeeAccess?: string | null;
  ownerUserId?: string | null;
  accessRules?: DocumentAccessRuleLike[];
};

export type DocumentAccessExplanation = {
  allowed: boolean;
  reason: string;
};

const ACCESS_LEVEL_RANK: Record<DocumentAccessLevelValue, number> = {
  VIEW: 1,
  COMMENT: 2,
  EDIT: 3,
  MANAGE: 4,
};

export const DEFAULT_PERMISSION_KEYS = [
  'documents.view.public',
  'documents.view.members',
  'documents.view.board',
  'documents.view.admin',
  'documents.view.committee',
  'documents.create',
  'documents.update',
  'documents.archive',
  'documents.delete',
  'documents.manage_visibility',
  'events.view.members',
  'events.view.board',
  'events.view.committee',
  'events.create',
  'events.update',
  'events.delete',
  'maintenance.requests.create',
  'maintenance.requests.view_own',
  'maintenance.requests.view_all',
  'maintenance.requests.assign',
  'maintenance.requests.update_status',
  'users.view',
  'users.create',
  'users.update',
  'users.deactivate',
  'users.manage_groups',
  'settings.view',
  'settings.update',
  'integrations.google.view_status',
  'integrations.google.configure',
  'integrations.google.sync',
  'audit.view',
] as const;

export const getEffectivePermissionKeys = (
  groupIds: string[],
  assignments: PermissionAssignment[],
): string[] => {
  const activeGroupIds = new Set(groupIds);
  return Array.from(new Set(
    assignments
      .filter(assignment => assignment.active !== false && activeGroupIds.has(assignment.groupId))
      .map(assignment => assignment.permissionKey),
  )).sort();
};

export const hasPermission = (subject: DocumentAccessSubject, permissionKey: string) =>
  Boolean(subject.isAdmin || subject.permissionKeys.includes(permissionKey));

const hasRuleAccess = (
  subject: DocumentAccessSubject,
  rules: DocumentAccessRuleLike[],
  requestedLevel: DocumentAccessLevelValue,
) => {
  const requiredRank = ACCESS_LEVEL_RANK[requestedLevel];
  const groupIds = new Set(subject.groupIds);
  return rules.some((rule) => {
    const ruleRank = ACCESS_LEVEL_RANK[String(rule.permission || 'VIEW').toUpperCase() as DocumentAccessLevelValue] || 0;
    if (ruleRank < requiredRank) return false;
    if (rule.userId && subject.userId && rule.userId === subject.userId) return true;
    return Boolean(rule.groupId && groupIds.has(rule.groupId));
  });
};

export const explainDocumentAccess = (
  subject: DocumentAccessSubject,
  document: DocumentAccessTarget,
  requestedLevel: DocumentAccessLevelValue = 'VIEW',
): DocumentAccessExplanation => {
  if (document.cooperativeId !== subject.cooperativeId) {
    return { allowed: false, reason: 'Document belongs to a different cooperative.' };
  }

  if (subject.isAdmin) {
    return { allowed: true, reason: 'User is an admin.' };
  }

  const visibility = String(document.visibility || 'MEMBERS').toUpperCase();
  if (visibility === 'PUBLIC') {
    return { allowed: true, reason: 'Document is public.' };
  }
  if (visibility === 'MEMBERS' && hasPermission(subject, 'documents.view.members')) {
    return { allowed: true, reason: 'User has documents.view.members.' };
  }
  if (visibility === 'BOARD' && hasPermission(subject, 'documents.view.board')) {
    return { allowed: true, reason: 'User has documents.view.board.' };
  }
  if (visibility === 'ADMIN' && hasPermission(subject, 'documents.view.admin')) {
    return { allowed: true, reason: 'User has documents.view.admin.' };
  }
  if (visibility === 'COMMITTEE' && hasPermission(subject, 'documents.view.committee')) {
    const allowedCommittees = new Set(subject.committeeIds || []);
    if (!document.committeeAccess || allowedCommittees.has(document.committeeAccess)) {
      return { allowed: true, reason: 'User has committee document access.' };
    }
  }
  if (visibility === 'CUSTOM' && hasRuleAccess(subject, document.accessRules || [], requestedLevel)) {
    return { allowed: true, reason: 'User is explicitly granted document access.' };
  }
  if (visibility === 'PRIVATE' && subject.userId && document.ownerUserId === subject.userId) {
    return { allowed: true, reason: 'User owns this private document.' };
  }

  return { allowed: false, reason: 'No matching document access rule.' };
};

export const canAccessDocument = (
  subject: DocumentAccessSubject,
  document: DocumentAccessTarget,
  requestedLevel: DocumentAccessLevelValue = 'VIEW',
) => explainDocumentAccess(subject, document, requestedLevel).allowed;

export const getVisibleDocumentWhere = (subject: DocumentAccessSubject) => {
  const visibilityClauses: any[] = [];
  visibilityClauses.push({ visibility: 'PUBLIC' });
  if (hasPermission(subject, 'documents.view.members')) visibilityClauses.push({ visibility: 'MEMBERS' });
  if (hasPermission(subject, 'documents.view.board')) visibilityClauses.push({ visibility: 'BOARD' });
  if (hasPermission(subject, 'documents.view.admin')) visibilityClauses.push({ visibility: 'ADMIN' });
  if (hasPermission(subject, 'documents.view.committee')) {
    visibilityClauses.push({
      visibility: 'COMMITTEE',
      OR: [
        { committeeAccess: null },
        { committeeAccess: '' },
        { committeeAccess: { in: subject.committeeIds || [] } },
      ],
    });
  }
  visibilityClauses.push({
    visibility: 'CUSTOM',
    accessRules: {
      some: {
        OR: [
          ...(subject.userId ? [{ userId: subject.userId }] : []),
          { groupId: { in: subject.groupIds } },
        ],
      },
    },
  });
  if (subject.userId) visibilityClauses.push({ visibility: 'PRIVATE', ownerUserId: subject.userId });

  return {
    cooperativeId: subject.cooperativeId,
    OR: visibilityClauses,
  };
};
