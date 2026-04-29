import assert from 'node:assert/strict';
import test from 'node:test';
import { getDashboardDocumentLink } from '../utils/dashboardDocumentLinks.ts';

const minutesDocument = {
  id: 'doc-1',
  title: 'Board Meeting Minutes - April 2026',
  category: 'Minutes',
  url: 'https://example.com/minutes.pdf',
  fileType: 'pdf',
  author: 'Secretary',
  date: '2026-04-28',
  tags: ['minutes', 'minutes-meeting:e5'],
};

test('links minutes documents to the meeting minutes page before the file URL', () => {
  assert.deepEqual(getDashboardDocumentLink(minutesDocument), {
    type: 'route',
    href: '/calendar/e5?tab=minutes',
  });
});

test('links ordinary documents directly to their file URL', () => {
  assert.deepEqual(getDashboardDocumentLink({
    ...minutesDocument,
    id: 'doc-2',
    title: 'Pet Policy',
    category: 'Policy',
    tags: ['policy'],
  }), {
    type: 'external',
    href: 'https://example.com/minutes.pdf',
  });
});

test('falls back to the document library when no direct destination exists', () => {
  assert.deepEqual(getDashboardDocumentLink({
    ...minutesDocument,
    url: '#',
    tags: [],
  }), {
    type: 'route',
    href: '/documents',
  });
});
