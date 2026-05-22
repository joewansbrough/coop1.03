export type EmptyState = {
  isEmpty: boolean;
  title: string;
  description: string;
  primaryActionLabel: string;
};

export type MaintenanceEmptyStateInput = {
  requestCount: number;
  unitCount: number;
  currentMemberCount: number;
  isAdmin: boolean;
};

export type CalendarEmptyStateInput = {
  eventCount: number;
  isAdmin: boolean;
};

export type CommitteeOnboardingState = EmptyState & {
  presetNames: string[];
};

export const COMMON_COMMITTEE_PRESETS = [
  'Board',
  'Maintenance',
  'Finance',
  'Membership',
  'Communications',
];

export const getMaintenanceEmptyState = ({
  requestCount,
  unitCount,
  currentMemberCount,
  isAdmin,
}: MaintenanceEmptyStateInput): EmptyState => {
  if (requestCount > 0) {
    return {
      isEmpty: false,
      title: 'Maintenance requests are being tracked',
      description: 'The request log is active. Keep triage, notes, and status updates current.',
      primaryActionLabel: 'Create request',
    };
  }

  if (unitCount === 0 || currentMemberCount === 0) {
    return {
      isEmpty: true,
      title: 'Start the maintenance log',
      description: isAdmin
        ? 'You can create a common-area request now. Adding unit and member context later will improve assignment, history, and triage.'
        : 'You can report a problem now. Unit and member context may be completed by an admin as onboarding continues.',
      primaryActionLabel: 'Create first request',
    };
  }

  return {
    isEmpty: true,
    title: 'No service requests yet',
    description: 'Maintenance is ready to capture the first resident or common-area issue.',
    primaryActionLabel: 'Create first request',
  };
};

export const getCalendarEmptyState = ({ eventCount, isAdmin }: CalendarEmptyStateInput): EmptyState => ({
  isEmpty: eventCount === 0,
  title: eventCount === 0 ? 'Schedule the first co-op meeting' : 'Calendar is active',
  description: eventCount === 0
    ? 'Create the first board, committee, maintenance, or social event so members have a live schedule to follow.'
    : 'Upcoming meetings and events are available to members.',
  primaryActionLabel: isAdmin ? 'Create first meeting' : 'View calendar',
});

export const getCommitteeOnboardingState = ({
  committeeCount,
  currentMemberCount,
}: {
  committeeCount: number;
  currentMemberCount: number;
}): CommitteeOnboardingState => {
  if (committeeCount > 0) {
    return {
      isEmpty: false,
      title: 'Committees are ready for assignments',
      description: 'Use committee pages to add members, schedule meetings, and collect documents.',
      primaryActionLabel: 'Add committee',
      presetNames: COMMON_COMMITTEE_PRESETS,
    };
  }

  return {
    isEmpty: true,
    title: 'Create committee spaces',
    description: currentMemberCount > 0
      ? 'Start with common presets, then assign imported members as chairs or participants.'
      : 'Start with common presets. Import members first when you are ready to assign chairs and participants.',
    primaryActionLabel: 'Add committee',
    presetNames: COMMON_COMMITTEE_PRESETS,
  };
};
