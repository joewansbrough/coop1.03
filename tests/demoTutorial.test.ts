import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEMO_TUTORIAL_TRACKS,
  createInitialTutorialState,
  getNextIncompleteStep,
  markTutorialStepDone,
  resetTutorialState,
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
