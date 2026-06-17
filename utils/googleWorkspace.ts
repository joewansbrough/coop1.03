export type GoogleWorkspaceCapabilityId =
  | 'identity'
  | 'drive'
  | 'directory'
  | 'calendar'
  | 'communications'
  | 'forms'
  | 'sites';

export type GoogleWorkspaceSettings = {
  enabled: boolean;
  domain: string | null;
  adminEmail: string | null;
  driveRootFolderIds: string[];
  directorySyncEnabled: boolean;
  calendarSyncEnabled: boolean;
  communicationsSyncEnabled: boolean;
  formsSyncEnabled: boolean;
  sitesEnabled: boolean;
  calendarId: string | null;
  timeZone: string | null;
  minutesArchiveFolderId: string | null;
  lastSyncAt: string | null;
};

export type GoogleWorkspaceReadinessStep = {
  key: string;
  label: string;
  ready: boolean;
  description: string;
};

export type GoogleWorkspaceCapability = {
  id: GoogleWorkspaceCapabilityId;
  label: string;
  value: string;
  description: string;
  enabled: boolean;
};

export type GoogleWorkspaceStatus = {
  connected: boolean;
  domain: string | null;
  adminEmail: string | null;
  lastSyncAt: string | null;
  driveRootFolderIds: string[];
  calendarId: string | null;
  timeZone: string | null;
  minutesArchiveFolderId: string | null;
  readiness: Record<string, GoogleWorkspaceReadinessStep>;
  capabilities: GoogleWorkspaceCapability[];
  enabledCapabilities: GoogleWorkspaceCapability[];
};

export type GoogleWorkspaceSettingsInput = Partial<Omit<GoogleWorkspaceSettings, 'lastSyncAt'>> & {
  lastSyncAt?: string | null;
};

export const GOOGLE_WORKSPACE_CAPABILITIES: Omit<GoogleWorkspaceCapability, 'enabled'>[] = [
  {
    id: 'identity',
    label: 'Google Sign-In',
    value: 'Use Workspace identities for board, member, and staff access.',
    description: 'Already supported through Google OAuth and coopHUB user matching.',
  },
  {
    id: 'drive',
    label: 'Drive Knowledge Hub',
    value: 'Sync shared Drive folders into documents, permissions, and AI search.',
    description: 'Builds on the existing service-account Drive root and RAG ingestion.',
  },
  {
    id: 'directory',
    label: 'Directory & Groups',
    value: 'Mirror Workspace users and Google Groups into coopHUB people and roles.',
    description: 'Best for board, committees, residents, contractors, and volunteers.',
  },
  {
    id: 'calendar',
    label: 'Calendar & Meet',
    value: 'Keep meetings, AGM dates, maintenance windows, and Meet links synchronized.',
    description: 'Makes coopHUB events usable in the calendars members already check.',
  },
  {
    id: 'communications',
    label: 'Gmail & Groups Notices',
    value: 'Send announcements through trusted co-op email and group channels.',
    description: 'Keeps delivery in Workspace while preserving coopHUB audit history.',
  },
  {
    id: 'forms',
    label: 'Forms & Sheets Intake',
    value: 'Turn Google Forms responses into reviewed coopHUB records.',
    description: 'Useful for applications, maintenance intake, RSVPs, proxy forms, and surveys.',
  },
  {
    id: 'sites',
    label: 'Google Sites Portal',
    value: 'Publish selected public/member information through a companion Site.',
    description: 'Useful for co-ops that want a low-maintenance public-facing presence.',
  },
];

const asObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

const cleanString = (value: unknown) => {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || null;
};

const cleanLowerString = (value: unknown) => cleanString(value)?.toLowerCase() || null;

const cleanStringArray = (value: unknown) =>
  Array.isArray(value)
    ? Array.from(new Set(value.map(item => cleanString(item)).filter((item): item is string => Boolean(item))))
    : [];

export const normalizeGoogleWorkspaceSettings = (settings: unknown): GoogleWorkspaceSettings => {
  const root = asObject(settings);
  const workspace = asObject(root.googleWorkspace ?? root);

  return {
    enabled: workspace.enabled === true,
    domain: cleanString(workspace.domain),
    adminEmail: cleanString(workspace.adminEmail),
    driveRootFolderIds: cleanStringArray(workspace.driveRootFolderIds),
    directorySyncEnabled: workspace.directorySyncEnabled === true,
    calendarSyncEnabled: workspace.calendarSyncEnabled === true,
    communicationsSyncEnabled: workspace.communicationsSyncEnabled === true,
    formsSyncEnabled: workspace.formsSyncEnabled === true,
    sitesEnabled: workspace.sitesEnabled === true,
    calendarId: cleanString(workspace.calendarId),
    timeZone: cleanString(workspace.timeZone) || 'America/Vancouver',
    minutesArchiveFolderId: cleanString(workspace.minutesArchiveFolderId),
    lastSyncAt: cleanString(workspace.lastSyncAt),
  };
};

export const buildGoogleWorkspaceSettingsUpdate = ({
  existingSettings,
  input,
}: {
  existingSettings: unknown;
  input: GoogleWorkspaceSettingsInput;
}) => {
  const root = asObject(existingSettings);
  const previous = normalizeGoogleWorkspaceSettings(root);
  const enabled = input.enabled === true;
  const domain = cleanLowerString(input.domain);
  const adminEmail = cleanLowerString(input.adminEmail);

  if (enabled && (!domain || !adminEmail)) {
    throw new Error('Google Workspace domain and admin email are required when enabling Workspace integration.');
  }

  return {
    ...root,
    googleWorkspace: {
      enabled,
      domain,
      adminEmail,
      driveRootFolderIds: cleanStringArray(input.driveRootFolderIds),
      directorySyncEnabled: input.directorySyncEnabled === true,
      calendarSyncEnabled: input.calendarSyncEnabled === true,
      communicationsSyncEnabled: input.communicationsSyncEnabled === true,
      formsSyncEnabled: input.formsSyncEnabled === true,
      sitesEnabled: input.sitesEnabled === true,
      calendarId: cleanString((input as any).calendarId),
      timeZone: cleanString((input as any).timeZone) || previous.timeZone,
      minutesArchiveFolderId: cleanString((input as any).minutesArchiveFolderId),
      lastSyncAt: cleanString(input.lastSyncAt) || previous.lastSyncAt,
    },
  };
};

const hasEnv = (env: NodeJS.ProcessEnv, key: string) => Boolean(cleanString(env[key]));

export const buildGoogleWorkspaceStatus = ({
  cooperativeSettings,
  env = process.env,
  activeDriveRootCount = 0,
}: {
  cooperativeSettings: unknown;
  env?: NodeJS.ProcessEnv;
  activeDriveRootCount?: number;
}): GoogleWorkspaceStatus => {
  const settings = normalizeGoogleWorkspaceSettings(cooperativeSettings);
  const driveRootFolderIds = settings.driveRootFolderIds;
  const driveRootsConfigured = activeDriveRootCount > 0 || driveRootFolderIds.length > 0;
  const oauthConfigured = hasEnv(env, 'GOOGLE_CLIENT_ID') && hasEnv(env, 'GOOGLE_CLIENT_SECRET');
  const serviceAccountConfigured = hasEnv(env, 'GOOGLE_SERVICE_ACCOUNT_JSON');

  const readiness = {
    workspaceConfigured: {
      key: 'workspaceConfigured',
      label: 'Workspace Profile',
      ready: settings.enabled && Boolean(settings.domain && settings.adminEmail),
      description: 'Store the co-op Workspace domain and administrator contact.',
    },
    oauthConfigured: {
      key: 'oauthConfigured',
      label: 'Google OAuth',
      ready: oauthConfigured,
      description: 'Configure client ID and secret for Google sign-in and delegated consent.',
    },
    serviceAccountConfigured: {
      key: 'serviceAccountConfigured',
      label: 'Service Account',
      ready: serviceAccountConfigured,
      description: 'Configure service-account credentials for shared Drive ingestion.',
    },
    driveRootsConfigured: {
      key: 'driveRootsConfigured',
      label: 'Drive Roots',
      ready: driveRootsConfigured,
      description: 'Choose shared Drive folders coopHUB can browse and index.',
    },
  };

  const capabilities = GOOGLE_WORKSPACE_CAPABILITIES.map(capability => ({
    ...capability,
    enabled: capability.id === 'identity'
      ? oauthConfigured
      : capability.id === 'drive'
        ? serviceAccountConfigured && driveRootsConfigured
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

  return {
    connected: readiness.workspaceConfigured.ready,
    domain: settings.domain,
    adminEmail: settings.adminEmail,
    lastSyncAt: settings.lastSyncAt,
    driveRootFolderIds,
    calendarId: settings.calendarId,
    timeZone: settings.timeZone,
    minutesArchiveFolderId: settings.minutesArchiveFolderId,
    readiness,
    capabilities,
    enabledCapabilities: capabilities.filter(capability => capability.enabled),
  };
};
