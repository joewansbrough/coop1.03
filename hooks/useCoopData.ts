import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Unit, Tenant, MaintenanceRequest, Announcement, Document, Committee, CoopEvent } from '../types';

const fetchJson = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
  return res.json();
};

export const useUser = () => useQuery({
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
});

export const useUnits = () => useQuery<Unit[]>({
  queryKey: ['units'],
  queryFn: () => fetchJson('/api/units'),
});

export const useTenants = () => useQuery<Tenant[]>({
  queryKey: ['tenants'],
  queryFn: () => fetchJson('/api/tenants'),
});

export const useMaintenance = () => useQuery<MaintenanceRequest[]>({
  queryKey: ['maintenance'],
  queryFn: () => fetchJson('/api/maintenance'),
});

export const useAnnouncements = () => useQuery<Announcement[]>({
  queryKey: ['announcements'],
  queryFn: () => fetchJson('/api/announcements'),
});

export const useDocuments = () => useQuery<Document[]>({
  queryKey: ['documents'],
  queryFn: () => fetchJson('/api/documents'),
});

export const useCommittees = () => useQuery<Committee[]>({
  queryKey: ['committees'],
  queryFn: () => fetchJson('/api/committees'),
});

export const useEvents = () => useQuery<CoopEvent[]>({
  queryKey: ['events'],
  queryFn: () => fetchJson('/api/events'),
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
