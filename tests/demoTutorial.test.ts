import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEMO_TUTORIAL_TRACKS,
  DEMO_TUTORIAL_ROLE_VIEW_KEY,
  DEMO_TUTORIAL_STORAGE_KEY,
  createInitialTutorialState,
  getVisibleTutorialTracks,
  getNextIncompleteStep,
  markTutorialStepDone,
  resetTutorialState,
  skipDemoTutorial,
  updateTutorialProgress,
} from '../utils/demoTutorial.ts';

test('creates initial state for each tutorial track', () => {
  for (const track of DEMO_TUTORIAL_TRACKS) {
    const state = createInitialTutorialState(track.id);

    assert.equal(state.trackId, track.id);
    assert.deepEqual(state.completedStepIds, []);
    assert.equal(state.isPanelDismissed, false);
    assert.equal(getNextIncompleteStep(state)?.id, track.steps[0].id);
  }
});

test('hides the pitch track from guided demo choices', () => {
  const visibleTrackIds = getVisibleTutorialTracks().map(track => track.id);

  assert.deepEqual(visibleTrackIds, ['admin', 'resident']);
});

test('skipping the tour starts demo mode in admin view without tutorial state', () => {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
  };

  store.set(DEMO_TUTORIAL_STORAGE_KEY, JSON.stringify(createInitialTutorialState('resident')));
  store.set(DEMO_TUTORIAL_ROLE_VIEW_KEY, 'true');

  skipDemoTutorial();

  assert.equal(store.get('demo_mode'), 'true');
  assert.equal(store.get(DEMO_TUTORIAL_ROLE_VIEW_KEY), 'false');
  assert.equal(store.has(DEMO_TUTORIAL_STORAGE_KEY), false);

  delete (globalThis as any).localStorage;
});

test('auto-completes route based tutorial milestones', () => {
  const state = createInitialTutorialState('admin');
  const next = updateTutorialProgress(state, { pathname: '/admin/units/u1' });

  assert.ok(next.completedStepIds.includes('admin-unit-detail'));
});

test('auto-completes action based tutorial milestones', () => {
  const state = createInitialTutorialState('pitch');
  const next = updateTutorialProgress(state, { eventName: 'minutes_saved' });

  assert.ok(next.completedStepIds.includes('pitch-minutes'));
});

test('manual completion marks a tutorial step done once', () => {
  const state = createInitialTutorialState('resident');
  const once = markTutorialStepDone(state, 'resident-documents');
  const twice = markTutorialStepDone(once, 'resident-documents');

  assert.deepEqual(twice.completedStepIds, ['resident-documents']);
});

test('progress updates are idempotent after a matching step is already complete', () => {
  const routeState = updateTutorialProgress(createInitialTutorialState('admin'), { pathname: '/' });
  const routeAgain = updateTutorialProgress(routeState, { pathname: '/' });

  assert.equal(routeAgain, routeState);

  const eventState = updateTutorialProgress(createInitialTutorialState('pitch'), { eventName: 'minutes_saved' });
  const eventAgain = updateTutorialProgress(eventState, { eventName: 'minutes_saved' });

  assert.equal(eventAgain, eventState);
});

test('reset keeps selected track but clears progress and panel dismissal', () => {
  const state = {
    ...createInitialTutorialState('admin'),
    completedStepIds: ['admin-dashboard', 'admin-unit-detail'],
    isPanelDismissed: true,
  };

  assert.deepEqual(resetTutorialState(state), createInitialTutorialState('admin'));
});
