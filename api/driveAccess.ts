export type DriveAccessInput = {
  sessionUser?: unknown;
  demoModeHeader?: string | string[] | undefined;
};

export const canAccessDriveRoutes = ({ sessionUser, demoModeHeader }: DriveAccessInput) => {
  if (sessionUser) return true;
  const headerValue = Array.isArray(demoModeHeader) ? demoModeHeader[0] : demoModeHeader;
  // SECURITY NOTE: This header is intentionally client-controlled for the public demo.
  // Before using Drive routes for real cooperative data, replace this with a
  // server-side demo deployment check or a signed demo token.
  return headerValue === 'true';
};
