import assert from 'node:assert/strict';
import test from 'node:test';
import { sortNewestFirst } from '../utils/contentOrdering.ts';

test('sorts content newest first using created, updated, and display dates', () => {
  const sorted = sortNewestFirst([
    { id: 'older-created', createdAt: '2026-02-01T10:00:00Z', date: '2026-02-01' },
    { id: 'updated-newest', updatedAt: '2026-04-20T09:00:00Z', date: '2026-01-01' },
    { id: 'date-only', date: '2026-03-15' },
  ]);

  assert.deepEqual(sorted.map(item => item.id), ['updated-newest', 'date-only', 'older-created']);
});

test('does not mutate the source list while sorting', () => {
  const items = [
    { id: 'first', date: '2026-01-01' },
    { id: 'second', date: '2026-02-01' },
  ];

  sortNewestFirst(items);

  assert.deepEqual(items.map(item => item.id), ['first', 'second']);
});
