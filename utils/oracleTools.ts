import { PrismaClient } from '@prisma/client';

export interface ToolContext {
  prisma: PrismaClient;
  cooperativeId: string;
  userId: string;
  userEmail: string;
  role: string;
  isAdmin: boolean;
}

type ToolDeclaration = {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
};

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 20;

const limitFor = (value?: number) => Math.max(1, Math.min(Number(value || DEFAULT_LIMIT), MAX_LIMIT));
const textFilter = (value?: string) => String(value || '').trim();
const contains = (value: string) => ({ contains: value, mode: 'insensitive' as const });
const settledValue = async <T>(label: string, promise: Promise<T>) => {
  try {
    return { label, value: await promise };
  } catch (error: any) {
    return { label, value: [], error: error?.message || String(error) };
  }
};

export const canUsePrivilegedOracleTools = (context: Pick<ToolContext, 'isAdmin' | 'role'>) => {
  const role = String(context.role || '').toUpperCase();
  return context.isAdmin || ['ADMIN', 'BOARD', 'DIRECTOR'].includes(role);
};

const deny = (message = 'Access denied. This Oracle tool is limited to board or admin users.') => ({ error: message });

const documentVisibilityWhere = (context: ToolContext) => {
  if (canUsePrivilegedOracleTools(context)) return {};
  return {
    OR: [
      { visibility: 'PUBLIC' },
      { visibility: 'MEMBERS' },
    ],
  };
};

const memberScopedUnitIds = async (context: ToolContext) => {
  const tenant = await (context.prisma as any).tenant.findUnique({
    where: { email: context.userEmail },
    select: { unitId: true },
  });
  return tenant?.unitId ? [tenant.unitId] : [];
};

export const oracleTools = {
  get_cooperative_profile: async (context: ToolContext) => {
    return (context.prisma as any).cooperative.findUnique({
      where: { id: context.cooperativeId },
      select: {
        id: true,
        name: true,
        slug: true,
        address: true,
        city: true,
        province: true,
        adminEmail: canUsePrivilegedOracleTools(context),
        createdAt: true,
        updatedAt: true,
      },
    });
  },

  get_buildings: async (context: ToolContext, params: { query?: string; limit?: number }) => {
    const query = textFilter(params.query);
    return (context.prisma as any).building.findMany({
      where: {
        cooperativeId: context.cooperativeId,
        ...(query ? { OR: [{ name: contains(query) }, { code: contains(query) }, { address: contains(query) }] } : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      take: limitFor(params.limit),
      include: {
        units: {
          select: { id: true, number: true, floor: true, type: true, status: true },
          orderBy: { number: 'asc' },
        },
      },
    });
  },

  get_units: async (context: ToolContext, params: { query?: string; floor?: number; status?: string; buildingId?: string; limit?: number }) => {
    const query = textFilter(params.query);
    return (context.prisma as any).unit.findMany({
      where: {
        cooperativeId: context.cooperativeId,
        ...(params.floor !== undefined ? { floor: params.floor } : {}),
        ...(params.status ? { status: params.status } : {}),
        ...(params.buildingId ? { buildingId: params.buildingId } : {}),
        ...(query ? { OR: [{ number: contains(query) }, { type: contains(query) }, { status: contains(query) }] } : {}),
      },
      orderBy: [{ floor: 'asc' }, { number: 'asc' }],
      take: limitFor(params.limit),
      select: {
        id: true,
        number: true,
        type: true,
        floor: true,
        status: true,
        buildingId: true,
        currentTenantId: canUsePrivilegedOracleTools(context),
        createdAt: true,
        updatedAt: true,
        building: { select: { id: true, name: true, code: true, address: true } },
        currentTenant: canUsePrivilegedOracleTools(context)
          ? { select: { id: true, firstName: true, lastName: true, email: true, phone: true, status: true, role: true } }
          : false,
      },
    });
  },

  get_tenants: async (context: ToolContext, params: { query?: string; status?: string; unitId?: string; limit?: number }) => {
    const privileged = canUsePrivilegedOracleTools(context);
    if (!privileged && params.query) return deny('Member accounts can only retrieve their own tenant profile.');
    const query = textFilter(params.query);
    return (context.prisma as any).tenant.findMany({
      where: privileged
        ? {
            cooperativeId: context.cooperativeId,
            ...(params.status ? { status: params.status } : {}),
            ...(params.unitId ? { unitId: params.unitId } : {}),
            ...(query ? { OR: [{ firstName: contains(query) }, { lastName: contains(query) }, { email: contains(query) }, { phone: contains(query) }] } : {}),
          }
        : { cooperativeId: context.cooperativeId, email: context.userEmail },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      take: privileged ? limitFor(params.limit) : 1,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: privileged,
        phone: privileged,
        startDate: true,
        status: true,
        role: true,
        cooperativeId: true,
        unitId: true,
        createdAt: true,
        updatedAt: true,
        unit: { select: { id: true, number: true, floor: true, type: true, status: true, building: true } },
        committees: { select: { id: true, name: true, chair: true } },
      },
    });
  },

  get_tenant_history: async (context: ToolContext, params: { tenantId?: string; unitId?: string; limit?: number }) => {
    if (!canUsePrivilegedOracleTools(context)) return deny();
    return (context.prisma as any).tenantHistory.findMany({
      where: {
        cooperativeId: context.cooperativeId,
        ...(params.tenantId ? { tenantId: params.tenantId } : {}),
        ...(params.unitId ? { unitId: params.unitId } : {}),
      },
      orderBy: { startDate: 'desc' },
      take: limitFor(params.limit),
      include: {
        tenant: { select: { id: true, firstName: true, lastName: true, email: true, status: true } },
        unit: { select: { id: true, number: true, floor: true, building: true } },
      },
    });
  },

  get_maintenance_requests: async (context: ToolContext, params: { query?: string; status?: string; priority?: string; category?: string; unitId?: string; floor?: number; buildingId?: string; limit?: number }) => {
    const privileged = canUsePrivilegedOracleTools(context);
    const query = textFilter(params.query);
    const memberUnits = privileged ? [] : await memberScopedUnitIds(context);
    const andFilters = [
      ...(!privileged ? [{ OR: [{ requestedBy: context.userEmail }, { unitId: { in: memberUnits } }] }] : []),
      ...(query ? [{ OR: [{ title: contains(query) }, { description: contains(query) }, { category: contains(query) }] }] : []),
    ];
    return (context.prisma as any).maintenanceRequest.findMany({
      where: {
        cooperativeId: context.cooperativeId,
        ...(andFilters.length ? { AND: andFilters } : {}),
        ...(params.status ? { status: params.status } : {}),
        ...(params.priority ? { priority: params.priority } : {}),
        ...(params.category ? { category: params.category } : {}),
        ...(params.unitId ? { unitId: params.unitId } : {}),
        ...(params.floor !== undefined || params.buildingId ? {
          unit: {
            ...(params.floor !== undefined ? { floor: params.floor } : {}),
            ...(params.buildingId ? { buildingId: params.buildingId } : {}),
          },
        } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      take: limitFor(params.limit),
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        category: true,
        cooperativeId: true,
        unitId: true,
        tenantId: privileged,
        requestedBy: privileged,
        notes: privileged,
        expenses: privileged,
        attachments: true,
        aiTriage: true,
        visualDescription: true,
        residentTip: true,
        triageReviewedBy: privileged,
        triageReviewedAt: privileged,
        createdAt: true,
        updatedAt: true,
        unit: { select: { id: true, number: true, floor: true, building: true } },
      },
    });
  },

  get_scheduled_maintenance: async (context: ToolContext, params: { unitId?: string; category?: string; frequency?: string; isCompleted?: boolean; isActive?: boolean; limit?: number }) => {
    const privileged = canUsePrivilegedOracleTools(context);
    const memberUnits = privileged ? [] : await memberScopedUnitIds(context);
    return (context.prisma as any).scheduledMaintenance.findMany({
      where: {
        cooperativeId: context.cooperativeId,
        ...(privileged ? {} : { unitId: { in: memberUnits } }),
        ...(params.unitId ? { unitId: params.unitId } : {}),
        ...(params.category ? { category: params.category } : {}),
        ...(params.frequency ? { frequency: params.frequency } : {}),
        ...(params.isCompleted !== undefined ? { isCompleted: params.isCompleted } : {}),
        ...(params.isActive !== undefined ? { isActive: params.isActive } : {}),
      },
      orderBy: { dueDate: 'asc' },
      take: limitFor(params.limit),
      include: { unit: { select: { id: true, number: true, floor: true, building: true } } },
    });
  },

  get_notifications: async (context: ToolContext, params: { type?: string; severity?: string; unreadOnly?: boolean; limit?: number }) => {
    const privileged = canUsePrivilegedOracleTools(context);
    return (context.prisma as any).notification.findMany({
      where: {
        cooperativeId: context.cooperativeId,
        ...(privileged ? {} : {
          OR: [
            { audience: 'member' },
            { audience: 'all' },
            { recipientUserEmail: context.userEmail },
          ],
        }),
        ...(params.type ? { type: params.type } : {}),
        ...(params.severity ? { severity: params.severity } : {}),
        ...(params.unreadOnly ? { readAt: null } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limitFor(params.limit),
    });
  },

  get_announcements: async (context: ToolContext, params: { query?: string; type?: string; priority?: string; limit?: number }) => {
    const query = textFilter(params.query);
    return (context.prisma as any).announcement.findMany({
      where: {
        cooperativeId: context.cooperativeId,
        ...(params.type ? { type: params.type } : {}),
        ...(params.priority ? { priority: params.priority } : {}),
        ...(query ? { OR: [{ title: contains(query) }, { content: contains(query) }, { author: contains(query) }] } : {}),
      },
      orderBy: { date: 'desc' },
      take: limitFor(params.limit),
    });
  },

  get_documents: async (context: ToolContext, params: { query?: string; category?: string; status?: string; visibility?: string; committee?: string; limit?: number }) => {
    const query = textFilter(params.query);
    const andFilters = [
      documentVisibilityWhere(context),
      ...(query ? [{
        OR: [
          { title: contains(query) },
          { content: contains(query) },
          { fullTextSearch: contains(query) },
          { keywords: { has: query } },
          { tags: { has: query } },
        ],
      }] : []),
    ].filter(filter => Object.keys(filter).length > 0);
    return (context.prisma as any).document.findMany({
      where: {
        cooperativeId: context.cooperativeId,
        ...(andFilters.length ? { AND: andFilters } : {}),
        ...(params.category ? { category: params.category } : {}),
        ...(params.status ? { status: params.status } : {}),
        ...(params.visibility && canUsePrivilegedOracleTools(context) ? { visibility: params.visibility } : {}),
        ...(params.committee ? { committee: params.committee } : {}),
      },
      orderBy: { date: 'desc' },
      take: limitFor(params.limit),
      select: {
        id: true,
        title: true,
        category: true,
        committee: true,
        url: true,
        fileType: true,
        author: true,
        date: true,
        tags: true,
        content: true,
        status: true,
        visibility: true,
        committeeAccess: true,
        effectiveDate: true,
        expiryDate: true,
        reviewDate: true,
        supersedes: true,
        supersededBy: true,
        relatedDocs: true,
        keywords: true,
        currentVersionId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  },

  get_document_versions: async (context: ToolContext, params: { documentId?: string; status?: string; limit?: number }) => {
    if (!canUsePrivilegedOracleTools(context)) return deny('Document version internals are limited to board or admin users.');
    return (context.prisma as any).documentVersion.findMany({
      where: {
        cooperativeId: context.cooperativeId,
        ...(params.documentId ? { documentId: params.documentId } : {}),
        ...(params.status ? { ingestionStatus: params.status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limitFor(params.limit),
      include: { document: { select: { id: true, title: true, category: true, visibility: true } } },
    });
  },

  get_document_ingestion_jobs: async (context: ToolContext, params: { documentId?: string; documentVersionId?: string; status?: string; limit?: number }) => {
    if (!canUsePrivilegedOracleTools(context)) return deny('Document ingestion jobs are limited to board or admin users.');
    return (context.prisma as any).documentIngestionJob.findMany({
      where: {
        cooperativeId: context.cooperativeId,
        ...(params.documentId ? { documentId: params.documentId } : {}),
        ...(params.documentVersionId ? { documentVersionId: params.documentVersionId } : {}),
        ...(params.status ? { status: params.status } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      take: limitFor(params.limit),
      include: {
        document: { select: { id: true, title: true, category: true, visibility: true } },
        documentVersion: { select: { id: true, version: true, ingestionStatus: true, createdAt: true } },
      },
    });
  },

  get_document_access_logs: async (context: ToolContext, params: { documentId?: string; userId?: string; action?: string; limit?: number }) => {
    if (!canUsePrivilegedOracleTools(context)) return deny('Document access logs are limited to board or admin users.');
    return (context.prisma as any).documentAccessLog.findMany({
      where: {
        ...(params.documentId ? { documentId: params.documentId } : {}),
        ...(params.userId ? { userId: params.userId } : {}),
        ...(params.action ? { action: params.action } : {}),
        document: { cooperativeId: context.cooperativeId },
      },
      orderBy: { createdAt: 'desc' },
      take: limitFor(params.limit),
      include: {
        document: { select: { id: true, title: true, category: true, visibility: true } },
      },
    });
  },

  get_document_chunks: async (context: ToolContext, params: { documentId?: string; query?: string; limit?: number }) => {
    const query = textFilter(params.query);
    return (context.prisma as any).documentChunk.findMany({
      where: {
        cooperativeId: context.cooperativeId,
        isActive: true,
        ...(params.documentId ? { documentId: params.documentId } : {}),
        ...(query ? { text: contains(query) } : {}),
        document: documentVisibilityWhere(context),
      },
      orderBy: { chunkIndex: 'asc' },
      take: limitFor(params.limit),
      select: {
        id: true,
        documentId: true,
        documentVersionId: true,
        chunkIndex: true,
        text: true,
        tokenEstimate: true,
        category: true,
        committee: true,
        tags: true,
        pageNumber: true,
        embeddingModel: true,
        embeddingVersion: true,
        isActive: true,
        createdAt: true,
        document: { select: { id: true, title: true, category: true, visibility: true } },
      },
    });
  },

  search_documents: async (context: ToolContext, params: { query: string; limit?: number }) => {
    const query = textFilter(params.query);
    const chunksResult = await settledValue('documentChunks', oracleTools.get_document_chunks(context, { query, limit: params.limit || 8 }));
    const chunks = chunksResult.value;
    if (Array.isArray(chunks) && chunks.length > 0) {
      return chunks.map((chunk: any) => ({
        documentId: chunk.documentId,
        documentTitle: chunk.document?.title,
        documentUrl: chunk.document?.url,
        category: chunk.category || chunk.document?.category,
        text: chunk.text,
        pageNumber: chunk.pageNumber,
      }));
    }
    const documentsResult = await settledValue('documents', oracleTools.get_documents(context, { query, limit: params.limit || 5 }));
    return Array.isArray(documentsResult.value) ? documentsResult.value.map((d: any) => ({
      documentId: d.id,
      documentTitle: d.title,
      documentUrl: d.url,
      category: d.category,
      text: d.content?.substring(0, 1000),
    })) : [];
  },

  search_coop_knowledge: async (context: ToolContext, params: { query: string; limit?: number }) => {
    const limit = limitFor(params.limit || 8);
    const query = textFilter(params.query);
    const [documentsResult, announcementsResult] = await Promise.all([
      settledValue('documents', oracleTools.search_documents(context, { query, limit })),
      settledValue('announcements', oracleTools.get_announcements(context, { query, limit })),
    ]);

    const documents = Array.isArray(documentsResult.value) ? documentsResult.value : [];
    const announcements = Array.isArray(announcementsResult.value) ? announcementsResult.value : [];
    const errors = [documentsResult, announcementsResult]
      .filter(result => result.error)
      .map(result => ({ source: result.label, error: result.error }));

    return {
      query,
      documents,
      announcements,
      errors: documents.length || announcements.length ? [] : errors,
    };
  },

  search_coop_database: async (context: ToolContext, params: { query: string; limit?: number }) => {
    const limit = Math.min(limitFor(params.limit || 5), 10);
    const query = textFilter(params.query);
    const privileged = canUsePrivilegedOracleTools(context);
    const results = await Promise.all([
      settledValue('buildings', oracleTools.get_buildings(context, { query, limit })),
      settledValue('units', oracleTools.get_units(context, { query, limit })),
      settledValue('tenants', oracleTools.get_tenants(context, { query, limit })),
      settledValue('maintenanceRequests', oracleTools.get_maintenance_requests(context, { query, limit })),
      settledValue('scheduledMaintenance', oracleTools.get_scheduled_maintenance(context, { limit })),
      settledValue('notifications', oracleTools.get_notifications(context, { type: query, limit })),
      settledValue('announcements', oracleTools.get_announcements(context, { query, limit })),
      settledValue('knowledge', oracleTools.search_coop_knowledge(context, { query, limit })),
      settledValue('events', oracleTools.get_events(context, { query, limit })),
      settledValue('committees', oracleTools.get_committees(context, { query, limit })),
      settledValue('meetingMinutes', privileged ? oracleTools.get_meeting_minutes(context, { limit }) : Promise.resolve([])),
      settledValue('meetingAnalyses', privileged ? oracleTools.get_meeting_analyses(context, { limit }) : Promise.resolve([])),
    ]);
    const byLabel = Object.fromEntries(results.map(result => [result.label, result]));
    const valueFor = (label: string) => byLabel[label]?.value || [];
    const knowledge = valueFor('knowledge') as any;

    const errors = results
      .filter(result => result.error)
      .map(result => ({ source: result.label, error: result.error }));
    const searchableGroups = [
      valueFor('buildings'),
      valueFor('units'),
      valueFor('tenants'),
      valueFor('maintenanceRequests'),
      valueFor('scheduledMaintenance'),
      valueFor('notifications'),
      valueFor('announcements'),
      knowledge.documents || [],
      knowledge.announcements || [],
      valueFor('events'),
      valueFor('committees'),
      valueFor('meetingMinutes'),
      valueFor('meetingAnalyses'),
    ];
    const hasUsableRecords = searchableGroups.some(group => Array.isArray(group) && group.length > 0);

    return {
      query,
      access: privileged ? 'privileged' : 'member-scoped',
      buildings: valueFor('buildings'),
      units: valueFor('units'),
      tenants: valueFor('tenants'),
      maintenanceRequests: valueFor('maintenanceRequests'),
      scheduledMaintenance: valueFor('scheduledMaintenance'),
      notifications: valueFor('notifications'),
      announcements: valueFor('announcements'),
      documents: knowledge.documents || [],
      documentAnnouncements: knowledge.announcements || [],
      events: valueFor('events'),
      committees: valueFor('committees'),
      meetingMinutes: valueFor('meetingMinutes'),
      meetingAnalyses: valueFor('meetingAnalyses'),
      errors: hasUsableRecords ? [] : errors,
    };
  },

  get_events: async (context: ToolContext, params: { query?: string; category?: string; committeeId?: string; upcomingOnly?: boolean; limit?: number }) => {
    const query = textFilter(params.query);
    return (context.prisma as any).coopEvent.findMany({
      where: {
        cooperativeId: context.cooperativeId,
        ...(params.category ? { category: params.category } : {}),
        ...(params.committeeId ? { committeeId: params.committeeId } : {}),
        ...(params.upcomingOnly ? { date: { gte: new Date() } } : {}),
        ...(query ? { OR: [{ title: contains(query) }, { description: contains(query) }, { location: contains(query) }] } : {}),
      },
      orderBy: { date: params.upcomingOnly ? 'asc' : 'desc' },
      take: limitFor(params.limit),
      include: {
        committee: { select: { id: true, name: true, chair: true } },
        minutes: canUsePrivilegedOracleTools(context),
      },
    });
  },

  get_upcoming_events: async (context: ToolContext) => oracleTools.get_events(context, { upcomingOnly: true, limit: 10 }),

  get_committees: async (context: ToolContext, params: { query?: string; limit?: number }) => {
    const query = textFilter(params.query);
    const committees = await (context.prisma as any).committee.findMany({
      where: {
        cooperativeId: context.cooperativeId,
        ...(query ? { OR: [{ name: contains(query) }, { description: contains(query) }, { chair: contains(query) }] } : {}),
      },
      orderBy: { name: 'asc' },
      take: limitFor(params.limit),
      include: {
        members: {
          select: {
            firstName: true,
            lastName: true
          },
        }
      },
    });
    return committees.map((c: any) => ({
      id: c.id,
      name: c.name,
      chairName: c.chair,
      description: c.description,
      memberCount: c.members.length,
      memberNames: c.members.map((m: any) => `${m.firstName} ${m.lastName}`)
    }));
  },

  get_meeting_minutes: async (context: ToolContext, params: { meetingId?: string; meetingType?: string; limit?: number }) => {
    if (!canUsePrivilegedOracleTools(context)) return deny('Meeting minutes detail is limited to board or admin users.');
    return (context.prisma as any).meetingMinutes.findMany({
      where: {
        cooperativeId: context.cooperativeId,
        ...(params.meetingId ? { meetingId: params.meetingId } : {}),
        ...(params.meetingType ? { meetingType: params.meetingType } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      take: limitFor(params.limit),
      include: { meeting: { select: { id: true, title: true, date: true, category: true } } },
    });
  },

  get_meeting_analyses: async (context: ToolContext, params: { meetingId?: string; limit?: number }) => {
    if (!canUsePrivilegedOracleTools(context)) return deny('Meeting analysis records are limited to board or admin users.');
    return (context.prisma as any).meetingAnalysis.findMany({
      where: {
        cooperativeId: context.cooperativeId,
        ...(params.meetingId ? { meetingId: params.meetingId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limitFor(params.limit),
      include: { meeting: { select: { id: true, title: true, date: true, category: true } } },
    });
  },

  get_policy_query_history: async (context: ToolContext, params: { userId?: string; intent?: string; limit?: number }) => {
    const privileged = canUsePrivilegedOracleTools(context);
    return (context.prisma as any).policyAssistantQuery.findMany({
      where: {
        cooperativeId: context.cooperativeId,
        ...(privileged && params.userId ? { userId: params.userId } : { userId: context.userEmail }),
        ...(params.intent ? { intent: params.intent } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limitFor(params.limit),
    });
  },

  get_dashboard_preferences: async (context: ToolContext, params: { userEmail?: string }) => {
    const userEmail = canUsePrivilegedOracleTools(context) && params.userEmail ? params.userEmail : context.userEmail;
    return (context.prisma as any).dashboardPreference.findUnique({
      where: { cooperativeId_userEmail: { cooperativeId: context.cooperativeId, userEmail } },
    });
  },

  get_database_schema: async (context: ToolContext) => {
    return {
      access: canUsePrivilegedOracleTools(context) ? 'privileged' : 'member-scoped',
      note: 'All tools are cooperative-scoped. Sensitive fields and broad member data require board/admin access.',
      models: {
        Cooperative: ['id', 'name', 'slug', 'address', 'city', 'province', 'adminEmail', 'createdAt', 'updatedAt'],
        Building: ['id', 'name', 'code', 'address', 'sortOrder', 'cooperativeId', 'createdAt', 'updatedAt'],
        Unit: ['id', 'number', 'type', 'floor', 'status', 'cooperativeId', 'buildingId', 'currentTenantId', 'createdAt', 'updatedAt'],
        Tenant: ['id', 'firstName', 'lastName', 'email', 'phone', 'startDate', 'status', 'role', 'cooperativeId', 'unitId', 'createdAt', 'updatedAt'],
        TenantHistory: ['id', 'tenantId', 'unitId', 'cooperativeId', 'startDate', 'endDate', 'moveReason', 'createdAt'],
        MaintenanceRequest: ['id', 'title', 'description', 'status', 'priority', 'category', 'cooperativeId', 'unitId', 'tenantId', 'requestedBy', 'notes', 'expenses', 'attachments', 'aiTriage', 'visualDescription', 'residentTip', 'triageReviewedBy', 'triageReviewedAt', 'createdAt', 'updatedAt'],
        Notification: ['id', 'cooperativeId', 'audience', 'recipientUserEmail', 'type', 'severity', 'title', 'body', 'entityType', 'entityId', 'actionUrl', 'readAt', 'createdAt'],
        Announcement: ['id', 'title', 'content', 'type', 'priority', 'author', 'date', 'cooperativeId', 'createdAt', 'updatedAt'],
        Document: ['id', 'title', 'category', 'committee', 'url', 'fileType', 'author', 'date', 'tags', 'content', 'status', 'visibility', 'committeeAccess', 'effectiveDate', 'expiryDate', 'reviewDate', 'supersedes', 'supersededBy', 'relatedDocs', 'keywords', 'fullTextSearch', 'currentVersionId', 'cooperativeId', 'createdAt', 'updatedAt'],
        DocumentVersion: ['id', 'documentId', 'cooperativeId', 'version', 'source', 'storageUrl', 'storageKey', 'fileType', 'mimeType', 'sizeBytes', 'checksum', 'ingestionStatus', 'ingestionError', 'ingestionStartedAt', 'ingestionCompletedAt', 'ingestionDurationMs', 'extractionMethod', 'extractionConfidence', 'chunkCount', 'tokenCount', 'extractedText', 'summary', 'createdAt'],
        DocumentChunk: ['id', 'documentId', 'documentVersionId', 'cooperativeId', 'chunkIndex', 'text', 'tokenEstimate', 'category', 'committee', 'tags', 'pageNumber', 'embeddingModel', 'embeddingVersion', 'isActive', 'replacedAt', 'replacedByBatchId', 'chunkBatchId', 'createdAt'],
        DocumentIngestionJob: ['id', 'documentId', 'documentVersionId', 'cooperativeId', 'status', 'attempts', 'maxAttempts', 'nextRetryAt', 'error', 'errorStack', 'createdAt', 'updatedAt'],
        PolicyAssistantQuery: ['id', 'cooperativeId', 'userId', 'question', 'retrievedChunks', 'answer', 'citations', 'language', 'intent', 'suggestedAction', 'userFeedback', 'feedback', 'feedbackReason', 'latencyMs', 'createdAt'],
        DocumentAccessLog: ['id', 'documentId', 'userId', 'action', 'ipAddress', 'userAgent', 'createdAt'],
        CoopEvent: ['id', 'title', 'description', 'date', 'time', 'location', 'category', 'cooperativeId', 'committeeId', 'createdAt', 'updatedAt'],
        Committee: ['id', 'name', 'description', 'chair', 'icon', 'cooperativeId', 'createdAt', 'updatedAt'],
        MeetingMinutes: ['id', 'meetingId', 'meetingType', 'data', 'attendees', 'motions', 'cooperativeId', 'createdAt', 'updatedAt', 'createdBy', 'approvedBy', 'approvalDate'],
        MeetingAnalysis: ['id', 'meetingId', 'cooperativeId', 'rawNotes', 'professionalSummary', 'decisions', 'motionsMentioned', 'actionItems', 'risksOrFollowUps', 'createdBy', 'approvedAt', 'createdAt'],
        ScheduledMaintenance: ['id', 'unitId', 'task', 'description', 'frequency', 'dueDate', 'lastCompleted', 'assignedTo', 'isCompleted', 'isActive', 'category', 'cooperativeId', 'createdAt', 'updatedAt'],
        DashboardPreference: ['id', 'cooperativeId', 'userEmail', 'layout', 'createdAt', 'updatedAt'],
      },
      tools: Object.keys(oracleTools),
    };
  },

  admin_query_tenants: async (context: ToolContext, params: { query?: string; limit?: number }) => {
    return oracleTools.get_tenants(context, params);
  },

  view_maintenance_request: async (context: ToolContext, params: { requestId: string }) => {
    return { success: true, message: `Showing maintenance request ${params.requestId}` };
  },

  view_event: async (context: ToolContext, params: { eventId: string; view?: string }) => {
    return { success: true, message: `Showing event ${params.eventId}${params.view ? ` (${params.view})` : ''}` };
  },

  view_committee: async (context: ToolContext, params: { committeeId: string }) => {
    return { success: true, message: `Showing committee ${params.committeeId}` };
  },

  view_document: async (context: ToolContext, params: { documentId?: string; title?: string }) => {
    return { success: true, message: `Showing document ${params.documentId || params.title}` };
  },

  view_tenant: async (context: ToolContext, params: { tenantId: string }) => {
    return { success: true, message: `Showing tenant ${params.tenantId}` };
  },

  view_unit: async (context: ToolContext, params: { unitId: string }) => {
    return { success: true, message: `Showing unit ${params.unitId}` };
  },

  navigate_to_page: async (context: ToolContext, params: { page: string; query?: string }) => {
    return { success: true, message: `Navigating to ${params.page}` };
  },
};

const stringProp = (description: string) => ({ type: 'string', description });
const numberProp = (description: string) => ({ type: 'number', description });
const booleanProp = (description: string) => ({ type: 'boolean', description });

const commonFilters = {
  query: stringProp('Optional text search.'),
  limit: numberProp(`Maximum records to return. Capped at ${MAX_LIMIT}.`),
};

const declaration = (name: keyof typeof oracleTools, description: string, properties: Record<string, any> = {}, required?: string[]): ToolDeclaration => ({
  name,
  description,
  parameters: {
    type: 'object',
    properties,
    ...(required ? { required } : {}),
  },
});

export const oracleToolDeclarations: ToolDeclaration[] = [
  declaration('get_cooperative_profile', 'Get the current co-op profile and basic cooperative fields.'),
  declaration('get_buildings', 'Get buildings and their units.', commonFilters),
  declaration('get_units', 'Get co-op units with building and optional resident details depending on user permissions.', {
    ...commonFilters,
    floor: numberProp('Filter by floor number.'),
    status: stringProp('Filter by unit status.'),
    buildingId: stringProp('Filter by building ID.'),
  }),
  declaration('get_tenants', 'Get tenant/member records. Members can only retrieve their own profile; board/admin can search broadly.', {
    ...commonFilters,
    status: stringProp('Filter by tenant status, such as Current, Past, or Waitlist.'),
    unitId: stringProp('Filter by unit ID.'),
  }),
  declaration('get_tenant_history', 'Board/admin only: get occupancy history by tenant or unit.', {
    tenantId: stringProp('Filter by tenant ID.'),
    unitId: stringProp('Filter by unit ID.'),
    limit: commonFilters.limit,
  }),
  declaration('get_maintenance_requests', 'Get maintenance requests. Members are limited to their own/unit requests; board/admin can query all co-op requests.', {
    ...commonFilters,
    status: stringProp('Filter by request status.'),
    priority: stringProp('Filter by request priority.'),
    category: stringProp('Filter by maintenance category.'),
    unitId: stringProp('Filter by unit ID.'),
    floor: numberProp('Filter by unit floor number.'),
    buildingId: stringProp('Filter by building ID.'),
  }),
  declaration('get_scheduled_maintenance', 'Get scheduled/routine maintenance. Members are limited to their own unit.', {
    unitId: stringProp('Filter by unit ID.'),
    category: stringProp('Filter by category.'),
    frequency: stringProp('Filter by MONTHLY, QUARTERLY, or ANNUAL.'),
    isCompleted: booleanProp('Filter completed tasks.'),
    isActive: booleanProp('Filter active tasks.'),
    limit: commonFilters.limit,
  }),
  declaration('get_notifications', 'Get notifications visible to the user.', {
    type: stringProp('Filter by notification type.'),
    severity: stringProp('Filter by severity.'),
    unreadOnly: booleanProp('Only unread notifications.'),
    limit: commonFilters.limit,
  }),
  declaration('get_announcements', 'Get co-op announcements.', {
    ...commonFilters,
    type: stringProp('Filter by announcement type.'),
    priority: stringProp('Filter by priority.'),
  }),
  declaration('get_documents', 'Get visible document records and metadata.', {
    ...commonFilters,
    category: stringProp('Filter by document category.'),
    status: stringProp('Filter by document status.'),
    visibility: stringProp('Board/admin only: filter by document visibility.'),
    committee: stringProp('Filter by committee.'),
  }),
  declaration('get_document_versions', 'Board/admin only: get document version and ingestion records.', {
    documentId: stringProp('Filter by document ID.'),
    status: stringProp('Filter by ingestion status.'),
    limit: commonFilters.limit,
  }),
  declaration('get_document_ingestion_jobs', 'Board/admin only: get document ingestion job records and errors.', {
    documentId: stringProp('Filter by document ID.'),
    documentVersionId: stringProp('Filter by document version ID.'),
    status: stringProp('Filter by job status.'),
    limit: commonFilters.limit,
  }),
  declaration('get_document_access_logs', 'Board/admin only: get document access log records.', {
    documentId: stringProp('Filter by document ID.'),
    userId: stringProp('Filter by user ID or email.'),
    action: stringProp('Filter by logged action.'),
    limit: commonFilters.limit,
  }),
  declaration('get_document_chunks', 'Search or retrieve active document chunks visible to the user.', {
    documentId: stringProp('Filter by document ID.'),
    query: stringProp('Keyword or phrase to search in chunk text.'),
    limit: commonFilters.limit,
  }),
  declaration('search_documents', 'Search co-op documents and policy chunks by keyword.', {
    query: stringProp('Keyword or phrase to search for.'),
    limit: commonFilters.limit,
  }, ['query']),
  declaration('search_coop_knowledge', 'Search policy-relevant co-op knowledge across document chunks, document records, and announcements.', {
    query: stringProp('Keyword or phrase to search for.'),
    limit: commonFilters.limit,
  }, ['query']),
  declaration('search_coop_database', 'Search the entire permission-accessible co-op database across records, documents, announcements, committees, events, maintenance, units, members, and meeting data.', {
    query: stringProp('Keyword or phrase to search across the co-op database.'),
    limit: commonFilters.limit,
  }, ['query']),
  declaration('get_events', 'Get co-op events and meetings.', {
    ...commonFilters,
    category: stringProp('Filter by event category.'),
    committeeId: stringProp('Filter by committee ID.'),
    upcomingOnly: booleanProp('Only future events.'),
  }),
  declaration('get_upcoming_events', 'Get upcoming co-op events and meetings.'),
  declaration('get_committees', 'Get committees, chairs (chairName), and member names (memberNames).', commonFilters),
  declaration('get_meeting_minutes', 'Board/admin only: get structured meeting minutes records.', {
    meetingId: stringProp('Filter by meeting/event ID.'),
    meetingType: stringProp('Filter by quick, regular, agm, or special.'),
    limit: commonFilters.limit,
  }),
  declaration('get_meeting_analyses', 'Board/admin only: get AI meeting analysis records.', {
    meetingId: stringProp('Filter by meeting/event ID.'),
    limit: commonFilters.limit,
  }),
  declaration('get_policy_query_history', 'Get Oracle query history. Members see their own; board/admin can filter by user.', {
    userId: stringProp('Board/admin only: filter by user email/id.'),
    intent: stringProp('Filter by intent.'),
    limit: commonFilters.limit,
  }),
  declaration('get_dashboard_preferences', 'Get dashboard layout preferences for the current user, or board/admin-selected user.', {
    userEmail: stringProp('Board/admin only: dashboard preference owner.'),
  }),
  declaration('get_database_schema', 'Get available Oracle tools, database models, fields, and access level.'),
  declaration('admin_query_tenants', 'Backward-compatible alias for get_tenants. Board/admin can search members by name, email, phone, or status.', {
    query: stringProp('Name, email, phone, or partial search text.'),
    limit: commonFilters.limit,
  }),
  declaration('view_maintenance_request', 'Navigate the UI to show a specific maintenance request.', {
    requestId: stringProp('The ID of the maintenance request.'),
  }, ['requestId']),
  declaration('view_event', 'Navigate the UI to show a specific co-op event or meeting.', {
    eventId: stringProp('The ID of the event.'),
    view: stringProp('Optional view: "details" or "minutes".'),
  }, ['eventId']),
  declaration('view_committee', 'Navigate the UI to show a specific committee.', {
    committeeId: stringProp('The ID of the committee.'),
  }, ['committeeId']),
  declaration('view_document', 'Navigate the UI to show a specific document.', {
    documentId: stringProp('The ID of the document.'),
    title: stringProp('The title of the document.'),
  }),
  declaration('view_tenant', 'Board/admin only: Navigate the UI to show a specific tenant record.', {
    tenantId: stringProp('The ID of the tenant.'),
  }, ['tenantId']),
  declaration('view_unit', 'Board/admin only: Navigate the UI to show a specific unit record.', {
    unitId: stringProp('The ID of the unit.'),
  }, ['unitId']),
  declaration('navigate_to_page', 'Navigate the UI to a specific co-op page.', {
    page: stringProp('The target page (e.g., /maintenance, /tenants, /committees, /calendar, /resource-library, /announcements, /directory).'),
    query: stringProp('Optional query parameters.'),
  }, ['page']),
];

export const oracleToolNames = oracleToolDeclarations.map(tool => tool.name);
