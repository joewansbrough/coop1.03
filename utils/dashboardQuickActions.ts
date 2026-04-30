import type { DashboardRole } from './dashboardPreferences';

export type DashboardQuickAction = {
  label: string;
  path: string;
  icon: string;
};

export const ADMIN_DASHBOARD_QUICK_ACTIONS: DashboardQuickAction[] = [
  { label: 'Add New Event', path: '/calendar?action=new-event', icon: 'fa-calendar-plus' },
  { label: 'Add New Request', path: '/maintenance?action=new-request', icon: 'fa-screwdriver-wrench' },
  { label: 'Add New Announcement', path: '/communications?action=new-broadcast', icon: 'fa-bullhorn' },
  { label: 'Upload Document', path: '/documents?action=upload', icon: 'fa-file-arrow-up' },
];

export const RESIDENT_DASHBOARD_QUICK_ACTIONS: DashboardQuickAction[] = [
  { label: 'Add New Request', path: '/maintenance?action=new-request', icon: 'fa-screwdriver-wrench' },
  { label: 'Rules & Bylaws', path: '/documents', icon: 'fa-book-open' },
  { label: 'Calendar', path: '/calendar', icon: 'fa-calendar-days' },
  { label: 'Committees', path: '/committees', icon: 'fa-people-group' },
];

export const getDashboardQuickActions = (role: DashboardRole): DashboardQuickAction[] =>
  role === 'admin' ? ADMIN_DASHBOARD_QUICK_ACTIONS : RESIDENT_DASHBOARD_QUICK_ACTIONS;
