import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { Unit, Tenant, MaintenanceRequest, Announcement, Document, Committee, CoopEvent, ScheduledMaintenance } from '../types';
import * as demoData from '../utils/demoData';

const isDemoMode = () => typeof window !== 'undefined' && localStorage.getItem('demo_mode') === 'true';

const fetchJson = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    // Better error with status code
    const errorText = await res.text().catch(() => 'Unknown error');
    throw new Error(`API Error (${res.status}): ${errorText}`);
  }
  return res.json();
};

// Shared query config for all data hooks
const dataQueryConfig = {
  staleTime: 5 * 60 * 1000, // 5 minutes - data stays fresh
  cacheTime: 10 * 60 * 1000, // 10 minutes - cache persists
  retry: 2, // Retry twice on failure
  refetchOnWindowFocus: false, // Don't refetch when user switches tabs
  refetchOnReconnect: true, // Do refetch when network reconnects
};

export const useUser = (options?: Partial<UseQueryOptions<any>>) => useQuery({
  queryKey: ['user'],
  queryFn: async () => {
    if (isDemoMode()) {
      return demoData.MOCK_USER;
    }

    // Check our API for the full user object (role, tenantId, etc)
    try {
      const res = await fetch('/api/auth/me', {
        credentials: 'include', // Ensure cookies are sent
        cache: 'no-cache', // Don't use cached response
      });
      if (res.ok) {
        const { user: sessionUser } = await res.json();
        if (sessionUser) return sessionUser;
      }
    } catch (e) {
      console.error('Session API check failed:', e);
    }
    
    return null;
  },
  staleTime: 5 * 60 * 1000, // 5 minutes
  cacheTime: 10 * 60 * 1000,
  retry: 1, // Only retry once for auth - fail fast
  refetchOnMount: 'always', // Always check auth on mount
  ...options,
});

export const useUnits = (options?: Partial<UseQueryOptions<Unit[]>>) => useQuery<Unit[]>({
  queryKey: ['units'],
  queryFn: () => isDemoMode() ? Promise.resolve(demoData.MOCK_UNITS) : fetchJson('/api/units'),
  ...dataQueryConfig,
  ...options,
});

export const useTenants = (options?: Partial<UseQueryOptions<Tenant[]>>) => useQuery<Tenant[]>({
  queryKey: ['tenants'],
  queryFn: () => isDemoMode() ? Promise.resolve(demoData.MOCK_TENANTS) : fetchJson('/api/tenants'),
  ...dataQueryConfig,
  ...options,
});

export const useMaintenance = (options?: Partial<UseQueryOptions<MaintenanceRequest[]>>) => useQuery<MaintenanceRequest[]>({
  queryKey: ['maintenance'],
  queryFn: () => isDemoMode() ? Promise.resolve(demoData.MOCK_MAINTENANCE) : fetchJson('/api/maintenance'),
  ...dataQueryConfig,
  ...options,
});

export const useAnnouncements = (options?: Partial<UseQueryOptions<Announcement[]>>) => useQuery<Announcement[]>({
  queryKey: ['announcements'],
  queryFn: () => isDemoMode() ? Promise.resolve(demoData.MOCK_ANNOUNCEMENTS) : fetchJson('/api/announcements'),
  ...dataQueryConfig,
  ...options,
});

export const useDocuments = (options?: Partial<UseQueryOptions<Document[]>>) => useQuery<Document[]>({
  queryKey: ['documents'],
  queryFn: () => isDemoMode() ? Promise.resolve(demoData.MOCK_DOCUMENTS) : fetchJson('/api/documents'),
  ...dataQueryConfig,
  ...options,
});

export const useCommittees = (options?: Partial<UseQueryOptions<Committee[]>>) => useQuery<Committee[]>({
  queryKey: ['committees'],
  queryFn: () => isDemoMode() ? Promise.resolve(demoData.MOCK_COMMITTEES) : fetchJson('/api/committees'),
  ...dataQueryConfig,
  ...options,
});

export const useEvents = (options?: Partial<UseQueryOptions<CoopEvent[]>>) => useQuery<CoopEvent[]>({
  queryKey: ['events'],
  queryFn: () => isDemoMode() ? Promise.resolve(demoData.MOCK_EVENTS) : fetchJson('/api/events'),
  ...dataQueryConfig,
  ...options,
});

export const useScheduledMaintenance = (options?: Partial<UseQueryOptions<ScheduledMaintenance[]>>) => useQuery<ScheduledMaintenance[]>({
  queryKey: ['scheduledMaintenance'],
  queryFn: () => isDemoMode() ? Promise.resolve(demoData.MOCK_SCHEDULED_MAINTENANCE) : fetchJson('/api/scheduled-maintenance'),
  ...dataQueryConfig,
  ...options,
});

// Mutations helper
export const useRefreshData = () => {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['units'] });
    queryClient.invalidateQueries({ queryKey: ['tenants'] });
    queryClient.invalidateQueries({ queryKey: ['maintenance'] });
    queryClient.invalidateQueries({ queryKey: ['announcements'] });
    queryClient.invalidateQueries({ queryKey: ['documents'] });
    queryClient.invalidateQueries({ queryKey: ['committees'] });
    queryClient.invalidateQueries({ queryKey: ['events'] });
    queryClient.invalidateQueries({ queryKey: ['scheduledMaintenance'] });
  };
};
