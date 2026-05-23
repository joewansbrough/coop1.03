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
  cooperativeId?: string | null;
  environment?: string;
  argsSummary?: {
    whereKeys: string[];
    hasData: boolean;
  };
};

export type QueryGuardOptions = {
  report?: (finding: QueryGuardFinding) => void | Promise<void>;
};

const hasCooperativeScope = (value: unknown): boolean => {
  if (!value || typeof value !== 'object') return false;
  if (Object.prototype.hasOwnProperty.call(value, 'cooperativeId')) return true;
  return Object.values(value as Record<string, unknown>).some(item => {
    if (Array.isArray(item)) return item.some(hasCooperativeScope);
    return hasCooperativeScope(item);
  });
};

const findCooperativeId = (value: unknown): string | null => {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (typeof record.cooperativeId === 'string' && record.cooperativeId.trim()) {
    return record.cooperativeId;
  }
  for (const item of Object.values(record)) {
    if (Array.isArray(item)) {
      for (const child of item) {
        const childCooperativeId = findCooperativeId(child);
        if (childCooperativeId) return childCooperativeId;
      }
      continue;
    }
    const childCooperativeId = findCooperativeId(item);
    if (childCooperativeId) return childCooperativeId;
  }
  return null;
};

const summarizeArgs = (params: QueryGuardParams) => ({
  whereKeys: params.args?.where && typeof params.args.where === 'object'
    ? Object.keys(params.args.where).sort()
    : [],
  hasData: Boolean(params.args?.data),
});

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
  console.error('[QueryGuard] Durable reporting is unavailable.', JSON.stringify(finding));
};

const toFinding = (params: QueryGuardParams, error: unknown): QueryGuardFinding => ({
  model: params.model,
  action: params.action,
  message: error instanceof Error ? error.message : String(error),
});

const createDurableReport = (client: any, nodeEnv: string): QueryGuardOptions['report'] => async (finding) => {
  if (typeof client.queryGuardFinding?.create !== 'function') {
    defaultReport(finding);
    return;
  }

  await client.queryGuardFinding.create({
    data: {
      model: finding.model || null,
      action: finding.action,
      message: finding.message,
      cooperativeId: finding.cooperativeId || null,
      environment: finding.environment || nodeEnv || null,
      argsSummary: finding.argsSummary || {},
    },
  });
};

export const installQueryGuard = <T>(
  prisma: T,
  nodeEnv = process.env.NODE_ENV,
  options: QueryGuardOptions = {},
): T => {
  const client = prisma as any;
  if (!shouldInstallQueryGuard(nodeEnv) || typeof client.$use !== 'function') return prisma;
  const report = options.report || createDurableReport(client, nodeEnv || 'unknown');
  client.$use(async (params: QueryGuardParams, next: (params: QueryGuardParams) => Promise<unknown>) => {
    try {
      assertCooperativeScopedQuery(params);
    } catch (error) {
      if (nodeEnv === 'production') {
        try {
          await report({
            ...toFinding(params, error),
            cooperativeId: findCooperativeId(params.args) || null,
            environment: nodeEnv || 'production',
            argsSummary: summarizeArgs(params),
          });
        } catch (reportError) {
          console.error('[QueryGuard] Failed to report finding.', reportError);
        }
        return next(params);
      }
      throw error;
    }
    return next(params);
  });
  return prisma;
};
