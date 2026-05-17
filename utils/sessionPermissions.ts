export const SESSION_PERMISSION_TTL_MS = 5 * 60 * 1000;

export const hasFreshSessionPermissions = (sessionUser: any, now = Date.now()) =>
  Boolean(
    sessionUser?.email &&
    sessionUser?.cooperativeId &&
    Array.isArray(sessionUser?.permissionKeys) &&
    Array.isArray(sessionUser?.groupIds) &&
    typeof sessionUser?.permissionsHydratedAt === 'number' &&
    now - sessionUser.permissionsHydratedAt < SESSION_PERMISSION_TTL_MS,
  );
