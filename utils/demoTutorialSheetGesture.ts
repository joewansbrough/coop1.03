export type SheetGestureAction = 'expand' | 'collapse';

interface SheetGestureInput {
  deltaX: number;
  deltaY: number;
  isCollapsed: boolean;
  velocityY?: number;
}

const MIN_VERTICAL_SWIPE_DISTANCE = 28;
const MAX_HORIZONTAL_TO_VERTICAL_RATIO = 1.35;
const MIN_VERTICAL_SWIPE_VELOCITY = 0.35;

export const getSheetDragOffset = (deltaY: number, isCollapsed: boolean) => {
  if (isCollapsed) return Math.max(-24, Math.min(0, deltaY * 0.25));
  return Math.min(96, Math.max(0, deltaY));
};

export const getSheetGestureAction = ({
  deltaX,
  deltaY,
  isCollapsed,
  velocityY = 0,
}: SheetGestureInput): SheetGestureAction | null => {
  if (Math.abs(deltaX) > Math.abs(deltaY) * MAX_HORIZONTAL_TO_VERTICAL_RATIO) return null;
  if (Math.abs(deltaY) < MIN_VERTICAL_SWIPE_DISTANCE && Math.abs(velocityY) < MIN_VERTICAL_SWIPE_VELOCITY) return null;

  if (deltaY < 0 && isCollapsed) return 'expand';
  if (deltaY > 0 && !isCollapsed) return 'collapse';
  if (velocityY < -MIN_VERTICAL_SWIPE_VELOCITY && isCollapsed) return 'expand';
  if (velocityY > MIN_VERTICAL_SWIPE_VELOCITY && !isCollapsed) return 'collapse';

  return null;
};
