import {
  createDefaultDashboardLayout,
  normalizeDashboardPreference,
  type DashboardPreference,
  type DashboardRole,
} from '../utils/dashboardPreferences.js';

interface DashboardPreferenceIdentity {
  cooperativeId: string;
  userEmail: string;
  role: DashboardRole;
}

interface SaveDashboardPreferenceInput extends DashboardPreferenceIdentity {
  preference: DashboardPreference;
}

interface DashboardPreferenceClient {
  dashboardPreference: {
    findUnique: (args: {
      where: {
        cooperativeId_userEmail: {
          cooperativeId: string;
          userEmail: string;
        };
      };
    }) => Promise<{ layout: unknown } | null>;
    upsert: (args: any) => Promise<unknown>;
  };
}

const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const getStoredDashboardPreference = async (
  client: DashboardPreferenceClient,
  { cooperativeId, userEmail, role }: DashboardPreferenceIdentity,
): Promise<DashboardPreference> => {
  const normalizedEmail = normalizeEmail(userEmail);
  const record = await client.dashboardPreference.findUnique({
    where: {
      cooperativeId_userEmail: {
        cooperativeId,
        userEmail: normalizedEmail,
      },
    },
  });

  if (!record) return createDefaultDashboardLayout(role);
  return normalizeDashboardPreference(record.layout, role);
};

export const saveStoredDashboardPreference = async (
  client: DashboardPreferenceClient,
  { cooperativeId, userEmail, role, preference }: SaveDashboardPreferenceInput,
): Promise<DashboardPreference> => {
  const normalizedEmail = normalizeEmail(userEmail);
  const layout = normalizeDashboardPreference(preference, role);

  await client.dashboardPreference.upsert({
    where: {
      cooperativeId_userEmail: {
        cooperativeId,
        userEmail: normalizedEmail,
      },
    },
    create: {
      cooperativeId,
      userEmail: normalizedEmail,
      layout,
    },
    update: {
      layout,
    },
  });

  return layout;
};
