export type SheetGestureAction = 'expand' | 'collapse';

interface SheetGestureInput {
  deltaX: number;
  deltaY: number;
  isCollapsed: boolean;
}

const MIN_VERTICAL_SWIPE_DISTANCE = 48;
const MAX_HORIZONTAL_DRIFT = 44;

export const getSheetGestureAction = ({
  deltaX,
  deltaY,
  isCollapsed,
}: SheetGestureInput): SheetGestureAction | null => {
  if (Math.abs(deltaY) < MIN_VERTICAL_SWIPE_DISTANCE) return null;
  if (Math.abs(deltaX) > MAX_HORIZONTAL_DRIFT) return null;

  if (deltaY < 0 && isCollapsed) return 'expand';
  if (deltaY > 0 && !isCollapsed) return 'collapse';

  return null;
};
