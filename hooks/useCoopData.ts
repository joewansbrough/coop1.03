import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { Unit, Tenant, MaintenanceRequest, Announcement, Document, Committee, CoopEvent, ScheduledMaintenance, MinutesTemplate, Building, Notification } from '../types';
import * as demoData from '../utils/demoData';
import { demoStorage } from '../utils/demoStorage';
import type { OnboardingStatus } from '../utils/onboardingStatus';

type DataQueryOptions<T> = Omit<UseQueryOptions<T, Error, T, readonly unknown[]>, 'queryKey' | 'queryFn'>;

export const isDemoMode = () => typeof window !== 'undefined' && localStorage.getItem('demo_mode') === 'true';
const DEMO_IMPERSONATED_USER_KEY = 'demo_impersonated_user';

const getDemoImpersonatedUser = () => {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(DEMO_IMPERSONATED_USER_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    localStorage.removeItem(DEMO_IMPERSONATED_USER_KEY);
    return null;
  }
};

const makeDemoUserFromTenant = (tenant: Tenant) => {
  const isAdmin = String(tenant.role || '').toUpperCase() === 'ADMIN';
  return {
    id: tenant.id,
    userId: tenant.id,
    tenantId: tenant.id,
    firstName: tenant.firstName,
    lastName: tenant.lastName,
    name: `${tenant.firstName} ${tenant.lastName}`.trim() || tenant.email,
    email: tenant.email,
    role: isAdmin ? 'ADMIN' : 'MEMBER',
    isAdmin,
    isGuest: false,
    unitNumber: tenant.unit?.number || undefined,
    cooperativeId: demoData.MOCK_USER.cooperativeId,
    isImpersonating: true,
    impersonator: {
      id: demoData.MOCK_USER.id,
      userId: demoData.MOCK_USER.id,
      email: demoData.MOCK_USER.email,
      name: demoData.MOCK_USER.name,
      isAdmin: demoData.MOCK_USER.isAdmin,
      role: demoData.MOCK_USER.role,
      cooperativeId: demoData.MOCK_USER.cooperativeId,
    },
  };
};

const fetchJson = async (url: string, options?: RequestInit) => {
  const res = await fetch(url, options);
  if (!res.ok) {
    const errorText = await res.text().catch(() => 'Unknown error');
    throw new Error(`API Error (${res.status}): ${errorText}`);
  }
  return res.json();
};

const dataQueryConfig = {
  staleTime: 5 * 60 * 1000,
  gcTime: 10 * 60 * 1000,
  retry: 2,
  refetchOnWindowFocus: false,
  refetchOnReconnect: true,
};

export const useUser = (options?: DataQueryOptions<any>) => useQuery({
  queryKey: ['user'],
  queryFn: async () => {
    if (isDemoMode()) return getDemoImpersonatedUser() || demoData.MOCK_USER;
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include', cache: 'no-cache' });
      if (res.ok) {
        const { user: sessionUser } = await res.json();
        if (sessionUser) return sessionUser;
      }
    } catch (e) { console.error('Session API check failed:', e); }
    return null;
  },
  staleTime: 5 * 60 * 1000,
  gcTime: 10 * 60 * 1000,
  retry: 1,
  refetchOnMount: 'always',
  ...options,
});

export type TestingUserOption = {
  id: string;
  email: string;
  name?: string | null;
  unitNumber?: string | null;
  isAdmin: boolean;
  groups: { id: string; name: string; slug: string; type: string }[];
};

const invalidateSessionScopedQueries = (queryClient: ReturnType<typeof useQueryClient>) => {
  queryClient.invalidateQueries();
};

export const useTestingUsers = (options?: DataQueryOptions<{ users: TestingUserOption[]; activeUserId: string | null; isImpersonating: boolean }>) => useQuery({
  queryKey: ['testing-users'],
  queryFn: () => {
    if (isDemoMode()) return Promise.resolve({ users: [], activeUserId: null, isImpersonating: false });
    return fetchJson('/api/testing/users');
  },
  staleTime: 30 * 1000,
  retry: 1,
  ...options,
});

export const useStartImpersonation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      if (isDemoMode()) {
        const tenant = demoStorage.getTenants().find(item => item.id === userId);
        if (!tenant) throw new Error('Demo member not found.');
        const demoUser = makeDemoUserFromTenant(tenant);
        localStorage.setItem(DEMO_IMPERSONATED_USER_KEY, JSON.stringify(demoUser));
        return { user: demoUser };
      }
      return fetchJson('/api/testing/impersonation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
    },
    onSuccess: () => invalidateSessionScopedQueries(queryClient),
  });
};

export const useStopImpersonation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (isDemoMode()) {
        localStorage.removeItem(DEMO_IMPERSONATED_USER_KEY);
        return { user: demoData.MOCK_USER };
      }
      return fetchJson('/api/testing/impersonation/stop', { method: 'POST' });
    },
    onSuccess: () => invalidateSessionScopedQueries(queryClient),
  });
};

// Generic CRUD factory for Hooks
const createDataHooks = <T extends { id: string }>(
  key: string, 
  apiPath: string, 
  demoGet: () => T[],
  demoAdd: (item: T) => void,
  demoUpdate: (item: T) => void,
  demoDelete: (id: string) => void
) => {
  return {
    useAll: (options?: DataQueryOptions<T[]>) => useQuery<T[]>({
      queryKey: [key],
      queryFn: () => isDemoMode() ? Promise.resolve(demoGet()) : fetchJson(apiPath),
      ...dataQueryConfig,
      ...options,
    }),
    useCreate: () => {
      const queryClient = useQueryClient();
      return useMutation({
        mutationFn: async (newItem: Omit<T, 'id'>) => {
          if (isDemoMode()) {
            const item = { ...newItem, id: `${key}-${Date.now()}` } as T;
            demoAdd(item);
            return item;
          }
          return fetchJson(apiPath, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newItem),
          });
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: [key] }),
      });
    },
    useUpdate: () => {
      const queryClient = useQueryClient();
      return useMutation({
        mutationFn: async (updatedItem: T) => {
          if (isDemoMode()) {
            demoUpdate(updatedItem);
            return updatedItem;
          }
          return fetchJson(`${apiPath}/${updatedItem.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedItem),
          });
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: [key] }),
      });
    },
    useDelete: () => {
      const queryClient = useQueryClient();
      return useMutation({
        mutationFn: async (id: string) => {
          if (isDemoMode()) {
            demoDelete(id);
            return id;
          }
          await fetch(`${apiPath}/${id}`, { method: 'DELETE' });
          return id;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: [key] }),
      });
    }
  };
};

const unitsHooks = {
  useAll: (options?: DataQueryOptions<Unit[]>) => useQuery<Unit[]>({
    queryKey: ['units'],
    queryFn: () => isDemoMode() ? Promise.resolve(demoStorage.getUnits()) : fetchJson('/api/units'),
    ...dataQueryConfig,
    ...options,
  }),
  useCreate: () => {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async (unit: Omit<Unit, 'id'>) => {
        if (isDemoMode()) {
          const newUnit = { ...unit, id: `u-${Date.now()}` } as Unit;
          demoStorage.addItem('units', demoData.MOCK_UNITS, newUnit);
          return newUnit;
        }
        return fetchJson('/api/units', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(unit),
        });
      },
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ['units'] }),
    });
  },
  useUpdate: () => {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async (unit: Unit) => {
        if (isDemoMode()) {
          demoStorage.updateUnit(unit);
          return unit;
        }
        return fetchJson(`/api/units/${unit.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(unit),
        });
      },
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ['units'] }),
    });
  }
};

const eventsHooks = createDataHooks<CoopEvent>(
  'events', 
  '/api/events', 
  demoStorage.getEvents, 
  demoStorage.addEvent, 
  demoStorage.updateEvent, 
  demoStorage.deleteEvent
);

const maintenanceHooks = createDataHooks<MaintenanceRequest>(
  'maintenance', 
  '/api/maintenance', 
  demoStorage.getMaintenance, 
  demoStorage.addMaintenance, 
  demoStorage.updateMaintenance, 
  demoStorage.deleteMaintenance
);

const announcementsHooks = createDataHooks<Announcement>(
  'announcements', 
  '/api/announcements', 
  demoStorage.getAnnouncements, 
  demoStorage.addAnnouncement, 
  demoStorage.updateAnnouncement, 
  demoStorage.deleteAnnouncement
);

const tenantsHooks = createDataHooks<Tenant>(
  'tenants', 
  '/api/tenants', 
  demoStorage.getTenants, 
  demoStorage.addTenant, 
  demoStorage.updateTenant, 
  demoStorage.deleteTenant
);

const minutesHooks = createDataHooks<MinutesTemplate>(
  'minutes',
  '/api/minutes',
  demoStorage.getMinutes,
  demoStorage.addMinutes,
  demoStorage.updateMinutes,
  demoStorage.deleteMinutes
);

export const useMinutes = minutesHooks.useAll;
export const useCreateMinutes = minutesHooks.useCreate;
export const useUpdateMinutes = minutesHooks.useUpdate;
export const useDeleteMinutes = minutesHooks.useDelete;

// Re-export specific hooks for clean API
export const useUnits = unitsHooks.useAll;
export const useCreateUnit = unitsHooks.useCreate;
export const useUpdateUnit = unitsHooks.useUpdate;

export const useEvents = eventsHooks.useAll;
export const useCreateEvent = eventsHooks.useCreate;
export const useUpdateEvent = eventsHooks.useUpdate;
export const useDeleteEvent = eventsHooks.useDelete;

export const useMaintenance = maintenanceHooks.useAll;
export const useCreateMaintenance = maintenanceHooks.useCreate;
export const useUpdateMaintenance = maintenanceHooks.useUpdate;
export const useDeleteMaintenance = maintenanceHooks.useDelete;

export const useAnnouncements = announcementsHooks.useAll;
export const useCreateAnnouncement = announcementsHooks.useCreate;
export const useUpdateAnnouncement = announcementsHooks.useUpdate;
export const useDeleteAnnouncement = announcementsHooks.useDelete;

export const useTenants = tenantsHooks.useAll;
export const useCreateTenant = tenantsHooks.useCreate;
export const useUpdateTenant = tenantsHooks.useUpdate;
export const useDeleteTenant = tenantsHooks.useDelete;

export const useDocuments = (options?: DataQueryOptions<Document[]>) => useQuery<Document[]>({
  queryKey: ['documents'],
  queryFn: () => isDemoMode() ? Promise.resolve(demoStorage.getAll('documents', demoData.MOCK_DOCUMENTS)) : fetchJson('/api/documents'),
  ...dataQueryConfig,
  ...options,
});

export const useCommittees = (options?: DataQueryOptions<Committee[]>) => useQuery<Committee[]>({
  queryKey: ['committees'],
  queryFn: () => isDemoMode() ? Promise.resolve(demoData.MOCK_COMMITTEES) : fetchJson('/api/committees'),
  ...dataQueryConfig,
  ...options,
});

export const useScheduledMaintenance = (options?: DataQueryOptions<ScheduledMaintenance[]>) => useQuery<ScheduledMaintenance[]>({
  queryKey: ['scheduledMaintenance'],
  queryFn: () => isDemoMode() ? Promise.resolve(demoData.MOCK_SCHEDULED_MAINTENANCE) : fetchJson('/api/scheduled-maintenance'),
  ...dataQueryConfig,
  ...options,
});

export const useBuildings = (options?: DataQueryOptions<Building[]>) => useQuery<Building[]>({
  queryKey: ['buildings'],
  queryFn: () => isDemoMode() ? Promise.resolve(demoStorage.getBuildings()) : fetchJson('/api/buildings'),
  ...dataQueryConfig,
  ...options,
});

export const useNotifications = (options?: DataQueryOptions<Notification[]>) => useQuery<Notification[]>({
  queryKey: ['notifications'],
  queryFn: () => isDemoMode() ? Promise.resolve(demoStorage.getNotifications()) : fetchJson('/api/notifications'),
  ...dataQueryConfig,
  ...options,
});

export const useOnboardingStatus = (options?: DataQueryOptions<OnboardingStatus>) => useQuery<OnboardingStatus>({
  queryKey: ['onboarding-status'],
  queryFn: () => fetchJson('/api/onboarding/status'),
  ...dataQueryConfig,
  ...options,
});

export type GoogleWorkspaceStatus = {
  connected: boolean;
  domain: string | null;
  adminEmail: string | null;
  lastSyncAt: string | null;
  driveRootFolderIds: string[];
  calendarId: string | null;
  timeZone: string | null;
  minutesArchiveFolderId: string | null;
  eventPacketFolderId: string | null;
  readiness: Record<string, {
    key: string;
    label: string;
    ready: boolean;
    description: string;
  }>;
  capabilities: Array<{
    id: string;
    label: string;
    value: string;
    description: string;
    enabled: boolean;
  }>;
  enabledCapabilities: Array<{
    id: string;
    label: string;
    value: string;
    description: string;
    enabled: boolean;
  }>;
};

export type GoogleWorkspaceSettingsInput = {
  enabled: boolean;
  domain: string;
  adminEmail: string;
  driveRootFolderIds: string[];
  directorySyncEnabled: boolean;
  calendarSyncEnabled: boolean;
  communicationsSyncEnabled: boolean;
  formsSyncEnabled: boolean;
  sitesEnabled: boolean;
  calendarId: string;
  timeZone: string;
  minutesArchiveFolderId: string;
  eventPacketFolderId: string;
};

const getDemoGoogleWorkspaceStatus = (): GoogleWorkspaceStatus => ({
  connected: true,
  domain: 'oakbaycoop.bc.ca',
  adminEmail: 'admin@oakbaycoop.bc.ca',
  lastSyncAt: '2026-06-15T18:00:00.000Z',
  driveRootFolderIds: ['demo-drive-root'],
  calendarId: 'board@oakbaycoop.bc.ca',
  timeZone: 'America/Vancouver',
  minutesArchiveFolderId: 'demo-minutes-folder',
  eventPacketFolderId: 'demo-event-packets-folder',
  readiness: {
    workspaceConfigured: {
      key: 'workspaceConfigured',
      label: 'Workspace Profile',
      ready: true,
      description: 'Store the co-op Workspace domain and administrator contact.',
    },
    oauthConfigured: {
      key: 'oauthConfigured',
      label: 'Google OAuth',
      ready: true,
      description: 'Configure client ID and secret for Google sign-in and delegated consent.',
    },
    serviceAccountConfigured: {
      key: 'serviceAccountConfigured',
      label: 'Service Account',
      ready: true,
      description: 'Configure service-account credentials for shared Drive ingestion.',
    },
    driveRootsConfigured: {
      key: 'driveRootsConfigured',
      label: 'Drive Roots',
      ready: true,
      description: 'Choose shared Drive folders coopHUB can browse and index.',
    },
  },
  capabilities: [
    { id: 'identity', label: 'Google Sign-In', value: 'Use Workspace identities for board, member, and staff access.', description: 'Already supported through Google OAuth and coopHUB user matching.', enabled: true },
    { id: 'drive', label: 'Drive Knowledge Hub', value: 'Sync shared Drive folders into documents, permissions, and AI search.', description: 'Builds on the existing service-account Drive root and RAG ingestion.', enabled: true },
    { id: 'directory', label: 'Directory & Groups', value: 'Mirror Workspace users and Google Groups into coopHUB people and roles.', description: 'Best for board, committees, residents, contractors, and volunteers.', enabled: false },
    { id: 'calendar', label: 'Calendar & Meet', value: 'Keep meetings, AGM dates, maintenance windows, and Meet links synchronized.', description: 'Makes coopHUB events usable in the calendars members already check.', enabled: false },
    { id: 'communications', label: 'Gmail & Groups Notices', value: 'Send announcements through trusted co-op email and group channels.', description: 'Keeps delivery in Workspace while preserving coopHUB audit history.', enabled: false },
    { id: 'forms', label: 'Forms & Sheets Intake', value: 'Turn Google Forms responses into reviewed coopHUB records.', description: 'Useful for applications, maintenance intake, RSVPs, proxy forms, and surveys.', enabled: false },
    { id: 'sites', label: 'Google Sites Portal', value: 'Publish selected public/member information through a companion Site.', description: 'Useful for co-ops that want a low-maintenance public-facing presence.', enabled: false },
  ],
  enabledCapabilities: [
    { id: 'identity', label: 'Google Sign-In', value: 'Use Workspace identities for board, member, and staff access.', description: 'Already supported through Google OAuth and coopHUB user matching.', enabled: true },
    { id: 'drive', label: 'Drive Knowledge Hub', value: 'Sync shared Drive folders into documents, permissions, and AI search.', description: 'Builds on the existing service-account Drive root and RAG ingestion.', enabled: true },
  ],
});

export const useGoogleWorkspaceStatus = (options?: DataQueryOptions<GoogleWorkspaceStatus>) => useQuery<GoogleWorkspaceStatus>({
  queryKey: ['google-workspace-status'],
  queryFn: () => isDemoMode() ? Promise.resolve(getDemoGoogleWorkspaceStatus()) : fetchJson('/api/integrations/google-workspace/status'),
  ...dataQueryConfig,
  ...options,
});

export const useSaveGoogleWorkspaceSettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (settings: GoogleWorkspaceSettingsInput) => {
      if (isDemoMode()) {
        const next = getDemoGoogleWorkspaceStatus();
        next.connected = settings.enabled && Boolean(settings.domain && settings.adminEmail);
        next.domain = settings.domain || null;
        next.adminEmail = settings.adminEmail || null;
        next.driveRootFolderIds = settings.driveRootFolderIds;
        next.calendarId = settings.calendarId || null;
        next.timeZone = settings.timeZone || 'America/Vancouver';
        next.minutesArchiveFolderId = settings.minutesArchiveFolderId || null;
        next.eventPacketFolderId = settings.eventPacketFolderId || null;
        next.capabilities = next.capabilities.map(capability => ({
          ...capability,
          enabled: capability.id === 'identity' || capability.id === 'drive'
            ? capability.enabled
            : capability.id === 'directory'
              ? settings.directorySyncEnabled
              : capability.id === 'calendar'
                ? settings.calendarSyncEnabled
                : capability.id === 'communications'
                  ? settings.communicationsSyncEnabled
                  : capability.id === 'forms'
                    ? settings.formsSyncEnabled
                    : settings.sitesEnabled,
        }));
        next.enabledCapabilities = next.capabilities.filter(capability => capability.enabled);
        return next;
      }
      return fetchJson('/api/integrations/google-workspace/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
    },
    onSuccess: (status) => {
      queryClient.setQueryData(['google-workspace-status'], status);
      queryClient.invalidateQueries({ queryKey: ['onboarding-status'] });
    },
  });
};

export const useCreateNotification = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (notification: Omit<Notification, 'id' | 'createdAt' | 'isRead'>) => {
      if (isDemoMode()) {
        const item = {
          ...notification,
          id: `notification-${Date.now()}`,
          createdAt: new Date().toISOString(),
          isRead: false,
        } as Notification;
        demoStorage.addNotification(item);
        return item;
      }
      return fetchJson('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notification),
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
};

export const useMarkNotificationRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (notification: Notification) => {
      if (isDemoMode()) {
        const updated = {
          ...notification,
          readAt: notification.readAt || new Date().toISOString(),
          isRead: true,
        };
        demoStorage.updateNotification(updated);
        return updated;
      }
      return fetchJson(`/api/notifications/${notification.id}/read`, { method: 'PUT' });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
};

export const useMarkAllNotificationsRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (isDemoMode()) {
        const readAt = new Date().toISOString();
        demoStorage.getNotifications().forEach(notification => demoStorage.updateNotification({ ...notification, readAt, isRead: true }));
        return { success: true };
      }
      return fetchJson('/api/notifications/read-all', { method: 'PUT' });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
};

export const useRefreshData = () => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries();
};

export const useMoveIn = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ unitId, tenantId, date }: { unitId: string, tenantId: string, date: string }) => {
      if (isDemoMode()) return demoStorage.moveIn(unitId, tenantId, date);
      return fetchJson(`/api/units/${unitId}/move-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, date })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units'] });
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
    }
  });
};

export const useMoveOut = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ unitId, date, reason }: { unitId: string, date: string, reason: string }) => {
      if (isDemoMode()) return demoStorage.moveOut(unitId, date, reason);
      return fetchJson(`/api/units/${unitId}/move-out`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, reason })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units'] });
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
    }
  });
};

export const useTransfer = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ fromUnitId, toUnitId, date }: { fromUnitId: string, toUnitId: string, date: string }) => {
      if (isDemoMode()) return demoStorage.transfer(fromUnitId, toUnitId, date);
      return fetchJson(`/api/units/${fromUnitId}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromUnitId, toUnitId, date })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units'] });
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
    }
  });
};
