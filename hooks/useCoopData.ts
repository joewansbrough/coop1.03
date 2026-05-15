import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { Unit, Tenant, MaintenanceRequest, Announcement, Document, Committee, CoopEvent, ScheduledMaintenance, MinutesTemplate, Building, Notification } from '../types';
import * as demoData from '../utils/demoData';
import { demoStorage } from '../utils/demoStorage';

type DataQueryOptions<T> = Omit<UseQueryOptions<T, Error, T, readonly unknown[]>, 'queryKey' | 'queryFn'>;

export const isDemoMode = () => typeof window !== 'undefined' && localStorage.getItem('demo_mode') === 'true';

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
    if (isDemoMode()) return demoData.MOCK_USER;
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
  queryFn: () => fetchJson('/api/testing/users'),
  staleTime: 30 * 1000,
  retry: 1,
  ...options,
});

export const useStartImpersonation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => fetchJson('/api/testing/impersonation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    }),
    onSuccess: () => invalidateSessionScopedQueries(queryClient),
  });
};

export const useStopImpersonation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => fetchJson('/api/testing/impersonation/stop', { method: 'POST' }),
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
