const normalizeAnnouncementPriority = (priority?: string) => String(priority || '').trim().toLowerCase();

export const getAnnouncementPriorityBadgeClass = (priority?: string) => {
  switch (normalizeAnnouncementPriority(priority)) {
    case 'urgent':
    case 'high':
      return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400';
    case 'medium':
    case 'normal':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    case 'low':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
    default:
      return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
  }
};

export const getAnnouncementPriorityAccentClass = (priority?: string) => {
  switch (normalizeAnnouncementPriority(priority)) {
    case 'urgent':
    case 'high':
      return 'bg-rose-500 dark:bg-rose-600';
    case 'medium':
    case 'normal':
      return 'bg-amber-500 dark:bg-amber-600';
    case 'low':
      return 'bg-emerald-500 dark:bg-emerald-600';
    default:
      return 'bg-slate-300 dark:bg-slate-700';
  }
};

export const getAnnouncementPriorityHeaderClass = (priority?: string) => {
  switch (normalizeAnnouncementPriority(priority)) {
    case 'urgent':
    case 'high':
      return 'bg-rose-50/30 dark:bg-rose-950/20';
    case 'medium':
    case 'normal':
      return 'bg-amber-50/30 dark:bg-amber-950/20';
    case 'low':
      return 'bg-emerald-50/30 dark:bg-emerald-950/20';
    default:
      return 'bg-slate-50/50 dark:bg-slate-950/30';
  }
};
