import assert from 'node:assert/strict';
import test from 'node:test';
import { getDashboardQuickActions } from '../utils/dashboardQuickActions.ts';

test('admin quick actions link directly to creation intents', () => {
  assert.deepEqual(getDashboardQuickActions('admin'), [
    { label: 'Add New Event', path: '/calendar?action=new-event', icon: 'fa-calendar-plus' },
    { label: 'Add New Request', path: '/maintenance?action=new-request', icon: 'fa-screwdriver-wrench' },
    { label: 'Add New Announcement', path: '/communications?action=new-broadcast', icon: 'fa-bullhorn' },
    { label: 'Upload Document', path: '/documents?action=upload', icon: 'fa-file-arrow-up' },
  ]);
});

test('resident quick actions keep the maintenance request shortcut direct', () => {
  assert.equal(getDashboardQuickActions('resident')[0].path, '/maintenance?action=new-request');
});
