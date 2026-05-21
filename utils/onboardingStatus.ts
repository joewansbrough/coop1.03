export type OnboardingStepKey =
  | 'profile'
  | 'units'
  | 'tenants'
  | 'assignments'
  | 'documents'
  | 'drive'
  | 'rag'
  | 'committees';

export type OnboardingCooperativeProfile = {
  id?: string | null;
  name?: string | null;
  slug?: string | null;
  province?: string | null;
  adminEmail?: string | null;
};

export type OnboardingCounts = {
  units: number;
  activeTenants: number;
  assignedActiveTenants: number;
  documents: number;
  activeDriveRoots: number;
  indexedDocumentVersions: number;
  committees: number;
};

export type OnboardingStatusInput = {
  cooperative: OnboardingCooperativeProfile | null;
  counts: OnboardingCounts;
  hasDriveConfiguration: boolean;
  hasRagConfiguration: boolean;
};

export type OnboardingStep = {
  key: OnboardingStepKey;
  label: string;
  ready: boolean;
  description: string;
  actionLabel: string;
  actionHref: string;
};

export type OnboardingStatus = {
  isReadyToLaunch: boolean;
  completedCount: number;
  totalCount: number;
  steps: Record<OnboardingStepKey, OnboardingStep>;
};

const hasText = (value?: string | null) => Boolean(value?.trim());

const step = (
  key: OnboardingStepKey,
  label: string,
  ready: boolean,
  description: string,
  actionLabel: string,
  actionHref: string,
): OnboardingStep => ({
  key,
  label,
  ready,
  description,
  actionLabel,
  actionHref,
});

export const buildOnboardingStatus = ({
  cooperative,
  counts,
  hasDriveConfiguration,
  hasRagConfiguration,
}: OnboardingStatusInput): OnboardingStatus => {
  const profileReady = Boolean(
    cooperative
      && hasText(cooperative.name)
      && hasText(cooperative.slug)
      && hasText(cooperative.province)
      && hasText(cooperative.adminEmail),
  );
  const unitsReady = counts.units > 0;
  const tenantsReady = counts.activeTenants > 0;
  const assignmentsReady = counts.activeTenants > 0
    && counts.assignedActiveTenants >= counts.activeTenants;
  const driveReady = counts.activeDriveRoots > 0 || hasDriveConfiguration;
  const documentsReady = counts.documents > 0 || driveReady;
  const ragReady = counts.indexedDocumentVersions > 0 || hasRagConfiguration;
  const committeesReady = counts.committees > 0;

  const steps: Record<OnboardingStepKey, OnboardingStep> = {
    profile: step(
      'profile',
      'Co-op profile',
      profileReady,
      'Confirm the cooperative identity, province, and admin contact.',
      'Review profile',
      '/onboarding',
    ),
    units: step(
      'units',
      'Units and buildings',
      unitsReady,
      'Create the unit backbone before importing members.',
      'Set up units',
      '/admin/units',
    ),
    tenants: step(
      'tenants',
      'Members and residents',
      tenantsReady,
      'Import or add current members and residents.',
      'Import members',
      '/directory',
    ),
    assignments: step(
      'assignments',
      'Unit assignments',
      assignmentsReady,
      'Match active residents to their units.',
      'Review assignments',
      '/directory',
    ),
    documents: step(
      'documents',
      'Documents',
      documentsReady,
      'Connect Drive or add initial co-op documents.',
      'Add documents',
      '/documents',
    ),
    drive: step(
      'drive',
      'Google Drive',
      driveReady,
      'Connect a shared Drive root for co-op records.',
      'Connect Drive',
      '/documents',
    ),
    rag: step(
      'rag',
      'Oracle document search',
      ragReady,
      'Index documents so Oracle can answer from source material.',
      'Index documents',
      '/documents',
    ),
    committees: step(
      'committees',
      'Committees',
      committeesReady,
      'Create common committee spaces and assign members.',
      'Set up committees',
      '/committees',
    ),
  };

  const values = Object.values(steps);
  const completedCount = values.filter(item => item.ready).length;

  return {
    isReadyToLaunch: completedCount === values.length,
    completedCount,
    totalCount: values.length,
    steps,
  };
};

export const getIncompleteOnboardingSteps = (status: OnboardingStatus) =>
  Object.values(status.steps).filter(step => !step.ready);
