export type DriveAccessInput = {
  sessionUser?: unknown;
  demoModeHeader?: string | string[] | undefined;
};

export const canAccessDriveRoutes = ({ sessionUser, demoModeHeader }: DriveAccessInput) => {
  if (sessionUser) return true;
  const headerValue = Array.isArray(demoModeHeader) ? demoModeHeader[0] : demoModeHeader;
  return headerValue === 'true';
};
