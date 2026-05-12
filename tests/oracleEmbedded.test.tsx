import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import OracleAssistant from '../components/OracleAssistant.tsx';
import { FloatingOracleAssistant } from '../components/Layout.tsx';
import PolicyAssistant from '../pages/PolicyAssistant.tsx';

test('embedded OracleAssistant renders the chat surface, not a placeholder', () => {
  const html = renderToStaticMarkup(
    <MemoryRouter>
      <OracleAssistant embedded />
    </MemoryRouter>,
  );

  assert.doesNotMatch(html, /Embedded Oracle Assistant/);
  assert.match(html, /Ask me about co-op policies/);
  assert.match(html, /policy-assistant-qa/);
  assert.match(html, /Start Live Mode/);
  assert.doesNotMatch(html, /Ask about policies, meetings, or maintenance/);
  assert.doesNotMatch(html, /Send question/);
});

test('floating OracleAssistant is hidden on the Policy Assistant route', () => {
  const html = renderToStaticMarkup(
    <MemoryRouter initialEntries={['/policy-assistant']}>
      <FloatingOracleAssistant isAutoDemoOpen={false} />
    </MemoryRouter>,
  );

  assert.equal(html, '');
});

test('floating OracleAssistant remains available away from the Policy Assistant route', () => {
  const html = renderToStaticMarkup(
    <MemoryRouter initialEntries={['/maintenance']}>
      <FloatingOracleAssistant isAutoDemoOpen={false} />
    </MemoryRouter>,
  );

  assert.match(html, /Open Co-op Oracle/);
});

test('Policy Assistant page uses a compact embedded chat height', () => {
  const html = renderToStaticMarkup(
    <MemoryRouter>
      <PolicyAssistant documents={[]} announcements={[]} />
    </MemoryRouter>,
  );

  assert.match(html, /h-\[520px\]/);
  assert.doesNotMatch(html, /h-\[720px\]/);
});
