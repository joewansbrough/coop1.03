import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMarkAllNotificationsRead, useMarkNotificationRead } from '../hooks/useCoopData';
import type { Notification } from '../types';

const filters = ['all', 'unread', 'maintenance', 'governance', 'documents', 'system'] as const;

const Notifications: React.FC<{ notifications: Notification[] }> = ({ notifications }) => {
  const [filter, setFilter] = useState<typeof filters[number]>('all');
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const filtered = useMemo(() => notifications.filter(notification => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !notification.isRead;
    return notification.type === filter;
  }), [filter, notifications]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Notifications Hub</h2>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">In-app notices for maintenance, governance, documents, and system follow-up.</p>
        </div>
        <button onClick={() => markAllRead.mutate()} className="rounded-xl bg-slate-900 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white dark:bg-teal-600">
          Mark all read
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {filters.map(item => (
          <button key={item} onClick={() => setFilter(item)} className={`rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-widest ${filter === item ? 'bg-teal-600 text-white' : 'bg-white text-slate-500 dark:bg-slate-900 dark:text-slate-400'}`}>
            {item}
          </button>
        ))}
      </div>
      <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white dark:border-white/5 dark:bg-slate-900">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-xs font-black uppercase tracking-widest text-slate-400">No notifications</div>
        ) : filtered.map(notification => (
          <div key={notification.id} className={`border-b border-slate-100 p-5 last:border-b-0 dark:border-white/5 ${notification.isRead ? 'opacity-60' : ''}`}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-lg px-2 py-1 text-[9px] font-black uppercase tracking-widest ${notification.severity === 'high' || notification.severity === 'urgent' ? 'bg-rose-100 text-rose-700' : 'bg-teal-50 text-teal-700'}`}>{notification.severity}</span>
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{notification.type}</span>
                </div>
                <p className="mt-2 text-sm font-black text-slate-900 dark:text-white">{notification.title}</p>
                <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">{notification.body}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {notification.actionUrl && <Link to={notification.actionUrl} className="rounded-xl bg-slate-100 px-3 py-2 text-[10px] font-black uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">Open</Link>}
                {!notification.isRead && <button onClick={() => markRead.mutate(notification)} className="rounded-xl bg-teal-600 px-3 py-2 text-[10px] font-black uppercase text-white">Read</button>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Notifications;
