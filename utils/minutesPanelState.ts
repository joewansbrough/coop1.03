export type MinutesPanelMode = 'form' | 'record' | 'pending';

interface MinutesPanelStateInput {
  isAdmin: boolean;
  hasMinutes: boolean;
  isEditingMinutes: boolean;
}

export const getMinutesPanelMode = ({
  isAdmin,
  hasMinutes,
  isEditingMinutes,
}: MinutesPanelStateInput): MinutesPanelMode => {
  if (isAdmin) {
    return hasMinutes && !isEditingMinutes ? 'record' : 'form';
  }

  return hasMinutes ? 'record' : 'pending';
};
