import assert from 'node:assert/strict';
import {
  buildOnboardingStatus,
  getIncompleteOnboardingSteps,
} from '../utils/onboardingStatus.ts';

const profile = {
  id: 'coop-1',
  name: 'Oak Bay Housing Cooperative',
  slug: 'obhc',
  province: 'BC',
  adminEmail: 'admin@example.com',
};

const emptyStatus = buildOnboardingStatus({
  cooperative: profile,
  counts: {
    units: 0,
    activeTenants: 0,
    assignedActiveTenants: 0,
    documents: 0,
    activeDriveRoots: 0,
    indexedDocumentVersions: 0,
    committees: 0,
  },
  hasDriveConfiguration: false,
  hasRagConfiguration: false,
});

assert.equal(emptyStatus.isReadyToLaunch, false);
assert.equal(emptyStatus.completedCount, 1);
assert.equal(emptyStatus.totalCount, 8);
assert.deepEqual(getIncompleteOnboardingSteps(emptyStatus).map(step => step.key), [
  'units',
  'tenants',
  'assignments',
  'documents',
  'drive',
  'rag',
  'committees',
]);
assert.equal(emptyStatus.steps.profile.ready, true);
assert.equal(emptyStatus.steps.units.ready, false);
assert.equal(emptyStatus.steps.documents.actionHref, '/documents');

const partialStatus = buildOnboardingStatus({
  cooperative: profile,
  counts: {
    units: 4,
    activeTenants: 2,
    assignedActiveTenants: 1,
    documents: 0,
    activeDriveRoots: 1,
    indexedDocumentVersions: 0,
    committees: 0,
  },
  hasDriveConfiguration: false,
  hasRagConfiguration: true,
});

assert.equal(partialStatus.steps.units.ready, true);
assert.equal(partialStatus.steps.tenants.ready, true);
assert.equal(partialStatus.steps.assignments.ready, false);
assert.equal(partialStatus.steps.documents.ready, true);
assert.equal(partialStatus.steps.drive.ready, true);
assert.equal(partialStatus.steps.rag.ready, true);
assert.equal(partialStatus.isReadyToLaunch, false);

const readyStatus = buildOnboardingStatus({
  cooperative: profile,
  counts: {
    units: 4,
    activeTenants: 4,
    assignedActiveTenants: 4,
    documents: 12,
    activeDriveRoots: 1,
    indexedDocumentVersions: 3,
    committees: 4,
  },
  hasDriveConfiguration: false,
  hasRagConfiguration: false,
});

assert.equal(readyStatus.isReadyToLaunch, true);
assert.equal(readyStatus.completedCount, readyStatus.totalCount);
assert.deepEqual(getIncompleteOnboardingSteps(readyStatus), []);

const missingProfileStatus = buildOnboardingStatus({
  cooperative: { id: 'coop-2', name: '', slug: 'demo', province: 'BC', adminEmail: '' },
  counts: {
    units: 1,
    activeTenants: 1,
    assignedActiveTenants: 1,
    documents: 1,
    activeDriveRoots: 1,
    indexedDocumentVersions: 1,
    committees: 1,
  },
  hasDriveConfiguration: false,
  hasRagConfiguration: false,
});

assert.equal(missingProfileStatus.steps.profile.ready, false);
assert.equal(missingProfileStatus.isReadyToLaunch, false);

console.log('onboardingStatus tests passed');
