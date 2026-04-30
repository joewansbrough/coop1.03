import assert from 'node:assert/strict';
import test from 'node:test';
import { getSheetDragOffset, getSheetGestureAction } from '../utils/demoTutorialSheetGesture.ts';

test('expands the demo guide after an upward mobile swipe', () => {
  assert.equal(getSheetGestureAction({ deltaY: -72, deltaX: 8, isCollapsed: true }), 'expand');
  assert.equal(getSheetGestureAction({ deltaY: -30, deltaX: 20, isCollapsed: true }), 'expand');
});

test('collapses the demo guide after a downward mobile swipe', () => {
  assert.equal(getSheetGestureAction({ deltaY: 76, deltaX: 4, isCollapsed: false }), 'collapse');
  assert.equal(getSheetGestureAction({ deltaY: 30, deltaX: 24, isCollapsed: false }), 'collapse');
});

test('ignores short or mostly horizontal swipes', () => {
  assert.equal(getSheetGestureAction({ deltaY: -24, deltaX: 2, isCollapsed: true }), null);
  assert.equal(getSheetGestureAction({ deltaY: -80, deltaX: 140, isCollapsed: true }), null);
});

test('uses release velocity for fast thumb motion', () => {
  assert.equal(getSheetGestureAction({ deltaY: -18, deltaX: 4, velocityY: -0.62, isCollapsed: true }), 'expand');
  assert.equal(getSheetGestureAction({ deltaY: 20, deltaX: 4, velocityY: 0.58, isCollapsed: false }), 'collapse');
});

test('returns live drag offsets only in the useful sheet direction', () => {
  assert.equal(getSheetDragOffset(-40, true), -10);
  assert.equal(getSheetDragOffset(-140, true), -24);
  assert.equal(getSheetDragOffset(40, true), 0);
  assert.equal(getSheetDragOffset(52, false), 52);
  assert.equal(getSheetDragOffset(240, false), 96);
  assert.equal(getSheetDragOffset(-52, false), 0);
});
