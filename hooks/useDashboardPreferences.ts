import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createDefaultDashboardLayout,
  loadDemoDashboardPreference,
  normalizeDashboardPreference,
  saveDemoDashboardPreference,
  type DashboardPreference,
  type DashboardRole,
} from '../utils/dashboardPreferences';
import { isDemoMode } from './useCoopData';

const fetchDashboardPreference = async (role: DashboardRole): Promise<DashboardPreference> => {
  if (isDemoMode()) {
    return loadDemoDashboardPreference(role) ?? createDefaultDashboardLayout(role);
  }

  const response = await fetch('/api/dashboard/preferences', { credentials: 'include' });
  if (!response.ok) throw new Error(await response.text());
  return normalizeDashboardPreference(await response.json(), role);
};

const saveDashboardPreference = async (
  role: DashboardRole,
  preference: DashboardPreference,
): Promise<DashboardPreference> => {
  const normalized = normalizeDashboardPreference(preference, role);

  if (isDemoMode()) {
    saveDemoDashboardPreference(role, normalized);
    return normalized;
  }

  const response = await fetch('/api/dashboard/preferences', {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(normalized),
  });
  if (!response.ok) throw new Error(await response.text());
  return normalizeDashboardPreference(await response.json(), role);
};

export const useDashboardPreferences = (role: DashboardRole) => {
  const queryClient = useQueryClient();
  const queryKey = ['dashboardPreferences', role] as const;
  const fallback = createDefaultDashboardLayout(role);
  const query = useQuery({
    queryKey,
    queryFn: () => fetchDashboardPreference(role),
    staleTime: 5 * 60 * 1000,
    placeholderData: fallback,
  });

  const mutation = useMutation({
    mutationFn: (preference: DashboardPreference) => saveDashboardPreference(role, preference),
    onMutate: async (preference) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<DashboardPreference>(queryKey);
      queryClient.setQueryData(queryKey, normalizeDashboardPreference(preference, role));
      return { previous };
    },
    onError: (_error, _preference, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
    },
    onSuccess: (preference) => {
      queryClient.setQueryData(queryKey, preference);
    },
  });

  return {
    preference: normalizeDashboardPreference(query.data ?? fallback, role),
    isLoading: query.isLoading,
    isSaving: mutation.isPending,
    savePreference: mutation.mutate,
    savePreferenceAsync: mutation.mutateAsync,
  };
};
