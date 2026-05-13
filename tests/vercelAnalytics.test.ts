import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');

test('App mounts Vercel Analytics at the root', () => {
  assert.match(appSource, /@vercel\/analytics\/react/);
  assert.match(appSource, /<Analytics\s*\/>/);
});
