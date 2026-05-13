import type { Notification } from '../types';

type NotificationInput = Omit<Notification, 'id' | 'createdAt' | 'isRead'> & {
  id?: string;
  createdAt?: string;
  isRead?: boolean;
};

const nowIso = () => new Date().toISOString();

export const createNotification = (input: NotificationInput): Notification => {
  const createdAt = input.createdAt || nowIso();
  return {
    id: input.id || `notification-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    cooperativeId: input.cooperativeId,
    audience: input.audience,
    recipientUserEmail: input.recipientUserEmail?.toLowerCase(),
    type: input.type,
    severity: input.severity,
    title: input.title,
    body: input.body,
    entityType: input.entityType,
    entityId: input.entityId,
    actionUrl: input.actionUrl,
    createdAt,
    timestamp: input.timestamp || createdAt,
    readAt: input.readAt ?? null,
    isRead: input.isRead ?? Boolean(input.readAt),
  };
};

export const canSeeNotification = (
  notification: Notification,
  user: { email?: string | null; isAdmin?: boolean | null },
) => {
  if (notification.audience === 'all') return true;
  if (notification.audience === 'admin') return Boolean(user.isAdmin);
  if (notification.audience === 'member') return Boolean(user.email);
  if (notification.audience === 'user') {
    return Boolean(
      user.email &&
      notification.recipientUserEmail &&
      user.email.toLowerCase() === notification.recipientUserEmail.toLowerCase(),
    );
  }
  return false;
};

export const markNotificationRead = (
  notification: Notification,
  readAt = nowIso(),
): Notification => ({
  ...notification,
  readAt,
  isRead: true,
});
