import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { Unit, Tenant, MaintenanceRequest, Announcement, Document, Committee, CoopEvent, ScheduledMaintenance } from '../types';
import * as demoData from '../utils/demoData';
import { demoStorage } from '../utils/demoStorage';

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
  cacheTime: 10 * 60 * 1000,
  retry: 2,
  refetchOnWindowFocus: false,
  refetchOnReconnect: true,
};

export const useUser = (options?: Partial<UseQueryOptions<any>>) => useQuery({
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
  cacheTime: 10 * 60 * 1000,
  retry: 1,
  refetchOnMount: 'always',
  ...options,
});

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
    useAll: (options?: Partial<UseQueryOptions<T[]>>) => useQuery<T[]>({
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
  useAll: (options?: Partial<UseQueryOptions<Unit[]>>) => useQuery<Unit[]>({
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
