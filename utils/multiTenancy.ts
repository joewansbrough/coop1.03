export type CooperativeLookup = {
  subdomain: string | null;
  isLocal: boolean;
};

export type WorkspaceAccessResult =
  | { allowed: true }
  | { allowed: false; httpStatus: number; code: string; message: string };

export const COOPERATIVE_SCOPED_MODELS = new Set([
  'Announcement',
  'Committee',
  'CoopEvent',
  'DashboardPreference',
  'Document',
  'DocumentChunk',
  'DocumentIngestionJob',
  'DocumentVersion',
  'MaintenanceRequest',
  'MeetingMinutes',
  'ScheduledMaintenance',
  'Tenant',
  'TenantHistory',
  'Unit',
]);

const RESERVED_SUBDOMAINS = new Set(['app', 'www', 'api']);

export const normalizeHost = (host: string) =>
  host
    .split(',')[0]
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/:\d+$/, '');

export const resolveCooperativeLookup = (
  host: string,
  localDefaultSubdomain?: string | null,
): CooperativeLookup => {
  const normalized = normalizeHost(host);
  const isLocal = normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1';

  if (isLocal) {
    return { subdomain: localDefaultSubdomain || null, isLocal: true };
  }

  const [firstLabel] = normalized.split('.');
  const subdomain = firstLabel && !RESERVED_SUBDOMAINS.has(firstLabel) ? firstLabel : null;
  return { subdomain, isLocal: false };
};

export const resolveWorkspaceAccess = (
  cooperative: { status?: string | null } | null,
  membership: { status?: string | null } | null,
): WorkspaceAccessResult => {
  if (!cooperative) {
    return { allowed: false, httpStatus: 404, code: 'workspace_not_found', message: 'Workspace not found.' };
  }

  const status = cooperative.status || 'active';
  if (status === 'pending_setup') {
    return { allowed: false, httpStatus: 403, code: 'workspace_not_live', message: 'This workspace is not live yet.' };
  }
  if (status === 'suspended') {
    return { allowed: false, httpStatus: 403, code: 'workspace_suspended', message: 'This workspace is temporarily suspended.' };
  }
  if (status === 'cancelled') {
    return { allowed: false, httpStatus: 410, code: 'workspace_unavailable', message: 'This workspace is no longer available.' };
  }

  if (!membership) {
    return { allowed: false, httpStatus: 403, code: 'membership_required', message: 'Your account is not authorized for this workspace.' };
  }
  if (membership.status !== 'Current') {
    return {
      allowed: false,
      httpStatus: 403,
      code: 'membership_inactive',
      message: 'Your membership is no longer active. Contact the board if this is incorrect.',
    };
  }

  return { allowed: true };
};

const hasCooperativeIdFilter = (where: any): boolean => {
  if (!where || typeof where !== 'object') return false;
  if (Object.prototype.hasOwnProperty.call(where, 'cooperativeId')) return true;
  return ['AND', 'OR'].some((key) => {
    const value = where[key];
    return Array.isArray(value) && value.some(hasCooperativeIdFilter);
  });
};

export const assertCooperativeWhere = (model: string | undefined, action: string, args: any) => {
  if (!model || !COOPERATIVE_SCOPED_MODELS.has(model)) return;
  if (!['findMany', 'findFirst', 'updateMany', 'deleteMany'].includes(action)) return;

  if (!hasCooperativeIdFilter(args?.where)) {
    throw new Error(`Safety: ${model}.${action} missing cooperativeId filter`);
  }
};

export type CooperativeContext<TClient = unknown, TUser = unknown> = {
  db: TClient;
  cooperativeId: string;
  user?: TUser;
};

export const withCooperativeContext = async <TClient, TResult>(
  db: TClient,
  cooperativeId: string | null | undefined,
  callback: (context: CooperativeContext<TClient>) => Promise<TResult>,
) => {
  if (!cooperativeId) {
    throw new Error('A validated cooperativeId is required for background cooperative context.');
  }

  return callback({ db, cooperativeId });
};
