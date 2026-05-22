type SessionUserLike = {
  isAdmin?: boolean | null;
} | null | undefined;

export type DangerousRouteAccessInput = {
  sessionUser: SessionUserLike;
  adminApiKey?: string | null;
  providedAdminApiKey?: string | null;
};

export type SafeDebugConfigInput = {
  env: Record<string, string | undefined>;
  baseUrl: string;
  isSecure: boolean;
  protocol: string;
  url: string;
  originalUrl: string;
};

export const canAccessDangerousRoute = ({
  sessionUser,
  adminApiKey,
  providedAdminApiKey,
}: DangerousRouteAccessInput) => {
  if (sessionUser?.isAdmin) return true;
  if (!adminApiKey || !providedAdminApiKey) return false;
  return providedAdminApiKey === adminApiKey;
};

export const buildSafeDebugConfig = ({
  env,
  baseUrl,
  isSecure,
  protocol,
  url,
  originalUrl,
}: SafeDebugConfigInput) => ({
  hasClientId: Boolean(env.GOOGLE_CLIENT_ID),
  hasClientSecret: Boolean(env.GOOGLE_CLIENT_SECRET),
  hasPickerApiKey: Boolean(env.PICKER_API_KEY),
  hasSessionSecret: Boolean(env.SESSION_SECRET),
  baseUrl,
  isSecure,
  protocol,
  url,
  originalUrl,
});
