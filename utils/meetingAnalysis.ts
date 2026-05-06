import type { MeetingAnalysisActionItem, Notification } from '../types';
import { createNotification } from './notifications';

export const mapMeetingActionsToNotifications = ({
  cooperativeId,
  meetingId,
  actions,
}: {
  cooperativeId: string;
  meetingId?: string;
  actions: MeetingAnalysisActionItem[];
}): Notification[] => actions.map(action => createNotification({
  cooperativeId,
  audience: 'admin',
  type: 'governance',
  severity: action.priority === 'High' ? 'high' : action.priority === 'Medium' ? 'medium' : 'info',
  title: action.committee ? `${action.committee} action item` : 'Meeting action item',
  body: `${action.description}${action.dueDate ? ` Due ${action.dueDate}.` : ''}`,
  entityType: 'meeting-analysis',
  entityId: meetingId,
  actionUrl: meetingId ? `/calendar/${meetingId}` : '/calendar',
}));
