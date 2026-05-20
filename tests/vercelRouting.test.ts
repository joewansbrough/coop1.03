import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('vercel routing does not rewrite static assets through the SPA fallback', () => {
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  const rewrites = config.rewrites || [];

  assert.equal(
    rewrites.some((rewrite: any) => rewrite.source === '/(.*)' && rewrite.destination === '/index.html'),
    false,
    'A broad /(.*) rewrite can make Vercel serve module assets with the wrong MIME type.',
  );
});
