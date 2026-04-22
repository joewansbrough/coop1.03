import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { Unit, Tenant, MaintenanceRequest, Announcement, Document, Committee, CoopEvent } from '../types';

const fetchJson = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
  return res.json();
};

export const useUser = (options?: Partial<UseQueryOptions<any>>) => useQuery({
  queryKey: ['user'],
  queryFn: async () => {
    // Check our API for the full user object (role, tenantId, etc)
    try {
      const res = await fetch('/api/auth/me');
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
  ...options,
});

export const useUnits = (options?: Partial<UseQueryOptions<Unit[]>>) => useQuery<Unit[]>({
  queryKey: ['units'],
  queryFn: () => fetchJson('/api/units'),
  ...options,
});

export const useTenants = (options?: Partial<UseQueryOptions<Tenant[]>>) => useQuery<Tenant[]>({
  queryKey: ['tenants'],
  queryFn: () => fetchJson('/api/tenants'),
  ...options,
});

export const useMaintenance = (options?: Partial<UseQueryOptions<MaintenanceRequest[]>>) => useQuery<MaintenanceRequest[]>({
  queryKey: ['maintenance'],
  queryFn: () => fetchJson('/api/maintenance'),
  ...options,
});

export const useAnnouncements = (options?: Partial<UseQueryOptions<Announcement[]>>) => useQuery<Announcement[]>({
  queryKey: ['announcements'],
  queryFn: () => fetchJson('/api/announcements'),
  ...options,
});

export const useDocuments = (options?: Partial<UseQueryOptions<Document[]>>) => useQuery<Document[]>({
  queryKey: ['documents'],
  queryFn: () => fetchJson('/api/documents'),
  ...options,
});

export const useCommittees = (options?: Partial<UseQueryOptions<Committee[]>>) => useQuery<Committee[]>({
  queryKey: ['committees'],
  queryFn: () => fetchJson('/api/committees'),
  ...options,
});

export const useEvents = (options?: Partial<UseQueryOptions<CoopEvent[]>>) => useQuery<CoopEvent[]>({
  queryKey: ['events'],
  queryFn: () => fetchJson('/api/events'),
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
  };
};
