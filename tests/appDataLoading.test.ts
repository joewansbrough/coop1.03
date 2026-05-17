import assert from 'node:assert/strict';
import {
  shouldDelayInitialDataRender,
  shouldFetchTestingUsers,
} from '../utils/appDataLoading.ts';

assert.equal(shouldDelayInitialDataRender({
  isEnabled: false,
  isInitialDataReady: false,
  hasInitialDataError: false,
}), false);

assert.equal(shouldDelayInitialDataRender({
  isEnabled: true,
  isInitialDataReady: false,
  hasInitialDataError: false,
}), true);

assert.equal(shouldDelayInitialDataRender({
  isEnabled: true,
  isInitialDataReady: false,
  hasInitialDataError: true,
}), false);

assert.equal(shouldDelayInitialDataRender({
  isEnabled: true,
  isInitialDataReady: true,
  hasInitialDataError: false,
}), false);

assert.equal(shouldFetchTestingUsers({ canUseUserSwitcher: true, isProfileOpen: false }), false);
assert.equal(shouldFetchTestingUsers({ canUseUserSwitcher: true, isProfileOpen: true }), true);
assert.equal(shouldFetchTestingUsers({ canUseUserSwitcher: false, isProfileOpen: true }), false);

console.log('appDataLoading tests passed');
