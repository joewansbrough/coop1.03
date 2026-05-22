export const COOPERATIVE_OWNED_MODELS: string[] = [
  'Announcement',
  'AuditLog',
  'Building',
  'Committee',
  'CoopEvent',
  'CooperativeDriveRoot',
  'DashboardPreference',
  'Document',
  'DocumentAccessRule',
  'DocumentChunk',
  'DocumentIngestionJob',
  'DocumentVersion',
  'Group',
  'MaintenanceRequest',
  'MeetingAnalysis',
  'MeetingMinutes',
  'Membership',
  'Notification',
  'PolicyAssistantQuery',
  'RagStore',
  'ScheduledMaintenance',
  'Tenant',
  'TenantHistory',
  'Unit',
  'User',
  'UserPreference',
  'UserPermissionOverride',
] as const;

const GUARDED_ACTIONS = new Set([
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
  'update',
  'updateMany',
  'upsert',
  'delete',
  'deleteMany',
]);

const CREATE_ACTIONS = new Set(['create', 'createMany']);

export type QueryGuardParams = {
  model?: string;
  action: string;
  args?: any;
};

export type QueryGuardFinding = {
  model?: string;
  action: string;
  message: string;
};

export type QueryGuardOptions = {
  report?: (finding: QueryGuardFinding) => void;
};

const hasCooperativeScope = (value: unknown): boolean => {
  if (!value || typeof value !== 'object') return false;
  if (Object.prototype.hasOwnProperty.call(value, 'cooperativeId')) return true;
  return Object.values(value as Record<string, unknown>).some(item => {
    if (Array.isArray(item)) return item.some(hasCooperativeScope);
    return hasCooperativeScope(item);
  });
};

const assertCreateDataScoped = (params: QueryGuardParams) => {
  const data = params.args?.data;
  const rows = Array.isArray(data) ? data : [data];
  if (rows.every(hasCooperativeScope)) return;
  throw new Error(`[QueryGuard] ${params.model}.${params.action} missing cooperativeId scope in data.`);
};

export const assertCooperativeScopedQuery = (params: QueryGuardParams) => {
  if (!params.model || !COOPERATIVE_OWNED_MODELS.includes(params.model as any)) return;

  if (CREATE_ACTIONS.has(params.action)) {
    assertCreateDataScoped(params);
    return;
  }

  if (!GUARDED_ACTIONS.has(params.action)) return;
  if (hasCooperativeScope(params.args?.where)) return;

  throw new Error(`[QueryGuard] ${params.model}.${params.action} missing cooperativeId scope.`);
};

export const shouldInstallQueryGuard = (nodeEnv = process.env.NODE_ENV) =>
  // Production is report-only for now; non-production hard-fails. See docs/production-guardrails.md.
  nodeEnv !== 'query-guard-disabled';

const defaultReport = (finding: QueryGuardFinding) => {
  console.warn('[QueryGuard]', JSON.stringify(finding));
};

const toFinding = (params: QueryGuardParams, error: unknown): QueryGuardFinding => ({
  model: params.model,
  action: params.action,
  message: error instanceof Error ? error.message : String(error),
});

export const installQueryGuard = <T>(
  prisma: T,
  nodeEnv = process.env.NODE_ENV,
  options: QueryGuardOptions = {},
): T => {
  const client = prisma as any;
  if (!shouldInstallQueryGuard(nodeEnv) || typeof client.$use !== 'function') return prisma;
  client.$use(async (params: QueryGuardParams, next: (params: QueryGuardParams) => Promise<unknown>) => {
    try {
      assertCooperativeScopedQuery(params);
    } catch (error) {
      if (nodeEnv === 'production') {
        (options.report || defaultReport)(toFinding(params, error));
        return next(params);
      }
      throw error;
    }
    return next(params);
  });
  return prisma;
};
