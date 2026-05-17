export const shouldDelayInitialDataRender = ({
  isEnabled,
  isInitialDataReady,
  hasInitialDataError,
}: {
  isEnabled: boolean;
  isInitialDataReady: boolean;
  hasInitialDataError: boolean;
}) => isEnabled && !isInitialDataReady && !hasInitialDataError;

export const shouldFetchTestingUsers = ({
  canUseUserSwitcher,
  isProfileOpen,
}: {
  canUseUserSwitcher: boolean;
  isProfileOpen: boolean;
}) => canUseUserSwitcher && isProfileOpen;
