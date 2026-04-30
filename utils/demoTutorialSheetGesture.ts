export type SheetGestureAction = 'expand' | 'collapse';

interface SheetGestureInput {
  deltaX: number;
  deltaY: number;
  isCollapsed: boolean;
  velocityY?: number;
}

const MIN_VERTICAL_SWIPE_DISTANCE = 32;
const MAX_HORIZONTAL_DRIFT = 64;
const MIN_VERTICAL_SWIPE_VELOCITY = 0.35;

export const getSheetDragOffset = (deltaY: number, isCollapsed: boolean) => {
  if (isCollapsed) return Math.min(0, deltaY);
  return Math.max(0, deltaY);
};

export const getSheetGestureAction = ({
  deltaX,
  deltaY,
  isCollapsed,
  velocityY = 0,
}: SheetGestureInput): SheetGestureAction | null => {
  if (Math.abs(deltaX) > MAX_HORIZONTAL_DRIFT) return null;
  if (Math.abs(deltaY) < MIN_VERTICAL_SWIPE_DISTANCE && Math.abs(velocityY) < MIN_VERTICAL_SWIPE_VELOCITY) return null;

  if (deltaY < 0 && isCollapsed) return 'expand';
  if (deltaY > 0 && !isCollapsed) return 'collapse';
  if (velocityY < -MIN_VERTICAL_SWIPE_VELOCITY && isCollapsed) return 'expand';
  if (velocityY > MIN_VERTICAL_SWIPE_VELOCITY && !isCollapsed) return 'collapse';

  return null;
};
